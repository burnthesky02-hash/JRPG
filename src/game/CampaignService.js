(function registerCampaignService(globalObject) {
  "use strict";

  const { EQUIPMENT, JOBS, MAIN_CHARACTER, NATIONS, RECRUITABLES, SAVE_KEY } =
    globalObject.JRPG.systems.game.data;

  const MAX_LEVEL = 99;
  const PROGRESSION = { xpBase: 74, xpGrowth: 34, xpCurve: 1.2, xpRewardScale: 1 };

  function deepClone(v) { return JSON.parse(JSON.stringify(v)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function computeCombatStats(character) {
    const job = JOBS[character.jobId] || Object.values(JOBS)[0] ||
      { maxHpMod: 1, attackMod: 1, defenseMod: 1, speedMod: 1 };
    const equipIds = character.equipment && typeof character.equipment === "object"
      ? Object.values(character.equipment).filter(Boolean) : [];
    const bonus = equipIds.reduce((t, eid) => {
      const item = EQUIPMENT[eid];
      if (!item || !item.statMods) return t;
      t.maxHp   += Number(item.statMods.maxHp   || 0);
      t.attack  += Number(item.statMods.attack   || 0);
      t.defense += Number(item.statMods.defense  || 0);
      t.speed   += Number(item.statMods.speed    || 0);
      return t;
    }, { maxHp: 0, attack: 0, defense: 0, speed: 0 });
    return {
      maxHp:   Math.floor(character.baseStats.maxHp   * job.maxHpMod   + bonus.maxHp),
      attack:  Math.floor(character.baseStats.attack  * job.attackMod  + bonus.attack),
      defense: Math.floor(character.baseStats.defense * job.defenseMod + bonus.defense),
      speed:   Math.floor(character.baseStats.speed   * job.speedMod   + bonus.speed)
    };
  }

  function getXpToNextLevel(level) {
    const lv = Math.max(1, Number(level || 1));
    return Math.floor(PROGRESSION.xpBase + Math.pow(lv, PROGRESSION.xpCurve) * PROGRESSION.xpGrowth);
  }

  class CampaignService {
    constructor() {
      this.state = {
        nationId: null,
        rank: 1,
        credits: 0,
        inventory: [],
        roster: []
      };
    }

    normalizeRoster(inputRoster) {
      const defaults = [deepClone(MAIN_CHARACTER), ...deepClone(RECRUITABLES)];
      const parsed = Array.isArray(inputRoster) ? inputRoster : [];
      const merged = defaults.map(base => {
        const existing = parsed.find(e => e && e.id === base.id) || {};
        return {
          ...base,
          ...existing,
          level:      Math.max(1, Number(existing.level      || base.level      || 1)),
          experience: Math.max(0, Number(existing.experience || 0)),
          bond:       Math.max(0, Number(existing.bond       ?? base.bond       ?? 0)),
          recruited:  Boolean(existing.recruited  ?? base.recruited),
          inParty:    Boolean(existing.inParty    ?? base.inParty),
          baseStats:  { ...base.baseStats,    ...(existing.baseStats  || {}) },
          equipment:  { ...(base.equipment || {}), ...(existing.equipment || {}) }
        };
      });

      const hero = merged.find(m => m.id === MAIN_CHARACTER.id);
      if (hero) { hero.recruited = true; hero.inParty = true; }

      if (merged.filter(m => m.recruited && m.inParty).length > 4) {
        const keep = new Set([MAIN_CHARACTER.id]);
        merged.forEach(m => {
          if (keep.size < 4 && m.recruited && m.id !== MAIN_CHARACTER.id && m.inParty) keep.add(m.id);
        });
        merged.forEach(m => { if (m.id !== MAIN_CHARACTER.id && m.recruited) m.inParty = keep.has(m.id); });
      }
      return merged;
    }

    applyLevelUpGrowth(member) {
      member.baseStats.maxHp   += 9 + Math.floor(member.level * 1.5);
      member.baseStats.attack  += 2 + (member.level % 3 === 0 ? 1 : 0);
      member.baseStats.defense += 1 + (member.level % 4 === 0 ? 1 : 0);
      member.baseStats.speed   += member.level % 2 === 0 ? 1 : 0;
    }

    awardExperienceToParty(amount, battleAllyIds) {
      if (!Number.isFinite(amount) || amount <= 0) return [];
      const ids = new Set(battleAllyIds || []);
      const levelUps = [];
      this.state.roster.forEach(member => {
        if (!ids.has(member.id) || !member.recruited) return;
        member.experience = Math.max(0, Number(member.experience || 0)) + amount;
        member.bond       = Math.max(0, Number(member.bond       || 0)) + 1;
        while (member.level < MAX_LEVEL && member.experience >= getXpToNextLevel(member.level)) {
          member.experience -= getXpToNextLevel(member.level);
          member.level += 1;
          this.applyLevelUpGrowth(member);
          levelUps.push(member.name);
        }
      });
      return levelUps;
    }

    getPartyMembers() {
      return this.state.roster.filter(m => m.inParty && m.recruited).slice(0, 4);
    }

    getRosterById(id) {
      return this.state.roster.find(m => m.id === id);
    }

    broadcastState() {
      const rosterSummary = this.state.roster.map(member => ({
        id:           member.id,
        name:         member.name,
        portraitUrl:  member.portraitUrl || "",
        lore:         member.lore,
        jobId:        member.jobId,
        jobLabel:     JOBS[member.jobId]?.label || member.jobId,
        jobIconUrl:   JOBS[member.jobId]?.iconUrl || "",
        skillIconUrl: JOBS[member.jobId]?.skill?.iconUrl || "",
        recruited:    Boolean(member.recruited),
        inParty:      Boolean(member.inParty),
        level:        member.level,
        bond:         Number(member.bond || 0),
        stats:        computeCombatStats(member),
        equipment:    { ...(member.equipment || {}) },
        experience:   Number(member.experience || 0),
        nextLevelXp:  getXpToNextLevel(member.level)
      }));

      window.dispatchEvent(new CustomEvent("jrpg:campaignState", {
        detail: {
          nationId:    this.state.nationId,
          nationLabel: this.state.nationId ? NATIONS[this.state.nationId]?.label : "Unaligned",
          rank:        this.state.rank,
          credits:     this.state.credits,
          inventory:   this.state.inventory.slice(),
          roster:      rosterSummary
        }
      }));
    }

    save() {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        nationId:  this.state.nationId,
        rank:      this.state.rank,
        credits:   this.state.credits,
        inventory: this.state.inventory,
        roster:    this.state.roster
      }));
    }

    load() {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      try {
        const parsed         = JSON.parse(raw);
        this.state.nationId  = parsed.nationId  || null;
        this.state.rank      = Number(parsed.rank    || 1);
        this.state.credits   = Number(parsed.credits || 0);
        this.state.inventory = Array.isArray(parsed.inventory) ? parsed.inventory.slice() : [];
        this.state.roster    = this.normalizeRoster(parsed.roster);
        return true;
      } catch { return false; }
    }

    recruitMember(memberId) {
      const member = this.getRosterById(memberId);
      if (!member) {
        window.dispatchEvent(new CustomEvent("jrpg:recruitResult",
          { detail: { ok: false, reason: "not-found", memberId } }));
        return;
      }
      if (member.recruited) {
        window.dispatchEvent(new CustomEvent("jrpg:recruitResult",
          { detail: { ok: false, reason: "already-recruited", memberId, memberName: member.name } }));
        return;
      }
      member.recruited = true;
      if (this.getPartyMembers().length < 4) member.inParty = true;
      this.save();
      this.broadcastState();
      window.dispatchEvent(new CustomEvent("jrpg:recruitResult",
        { detail: { ok: true, memberId, memberName: member.name } }));
    }

    addMemberToParty(memberId) {
      const member = this.getRosterById(memberId);
      if (!member || !member.recruited || member.inParty) return;
      if (this.getPartyMembers().length >= 4) return;
      member.inParty = true;
      this.save();
      this.broadcastState();
    }

    removeMemberFromParty(memberId) {
      const member = this.getRosterById(memberId);
      if (!member || !member.inParty) return;
      if (member.id === MAIN_CHARACTER.id) return;
      if (this.getPartyMembers().length <= 1) return;
      member.inParty = false;
      this.save();
      this.broadcastState();
    }

    addCredits(amount) {
      if (!Number.isFinite(amount) || amount <= 0) return;
      this.state.credits += amount;
      this.save();
      this.broadcastState();
    }

    addInventory(itemId, quantity) {
      const count = Math.max(1, Number(quantity || 1));
      for (let i = 0; i < count; i++) this.state.inventory.push(String(itemId));
      this.save();
      this.broadcastState();
    }

    chooseNation(nationId) {
      if (!NATIONS[nationId]) return;
      this.state.nationId = nationId;
      this.save();
      this.broadcastState();
    }

    applyBattleResult(victory, allyIds, encounterRank, rewardBonus) {
      if (!victory) return { levelUps: [], creditReward: 0, xpReward: 0 };
      const xpReward     = Math.floor((22 + encounterRank * 6 + 3) * PROGRESSION.xpRewardScale);
      const levelUps     = this.awardExperienceToParty(xpReward, allyIds);
      this.state.rank   += 1;
      const creditReward = 65 + this.state.rank * 20 + (rewardBonus || 0);
      this.state.credits += creditReward;
      this.save();
      this.broadcastState();
      return { levelUps, creditReward, xpReward };
    }

    getSnapshot() {
      return {
        nationId: this.state.nationId,
        rank:     this.state.rank,
        credits:  this.state.credits,
        roster:   this.state.roster
      };
    }

    initialize() {
      this.state.roster = this.normalizeRoster(null);
      this.load();
      this.broadcastState();

      window.addEventListener("jrpg:recruitRequest",    e => this.recruitMember(e.detail?.memberId));
      window.addEventListener("jrpg:grantCredits",      e => this.addCredits(Number(e.detail?.amount || 0)));
      window.addEventListener("jrpg:grantItem",         e => {
        const id = String(e.detail?.itemId || "").trim();
        if (id) this.addInventory(id, e.detail?.quantity || 1);
      });
      window.addEventListener("jrpg:partyAddRequest",    e => this.addMemberToParty(e.detail?.memberId));
      window.addEventListener("jrpg:partyRemoveRequest", e => this.removeMemberFromParty(e.detail?.memberId));
    }
  }

  globalObject.JRPG.systems.campaign = { CampaignService, computeCombatStats, getXpToNextLevel };
})(window);
