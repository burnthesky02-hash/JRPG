(function registerColiseumGameController(globalObject) {
const { JOBS, MAIN_CHARACTER, NATIONS, RECRUITABLES, SAVE_KEY } = globalObject.JRPG.systems.game.data;
const ENEMY_GLOBAL_TURN_COOLDOWN = 0.08;
const ATB_WAIT_MODE = true;
const MAX_LEVEL = 99;
const PROGRESSION_PRESETS = {
  slow: {
    id: "slow",
    xpRewardScale: 0.82,
    xpBase: 92,
    xpGrowth: 42,
    xpCurve: 1.24
  },
  normal: {
    id: "normal",
    xpRewardScale: 1,
    xpBase: 74,
    xpGrowth: 34,
    xpCurve: 1.2
  },
  fast: {
    id: "fast",
    xpRewardScale: 1.2,
    xpBase: 60,
    xpGrowth: 27,
    xpCurve: 1.16
  }
};
const ACTIVE_PROGRESSION = PROGRESSION_PRESETS.normal;

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computeCombatStats(character) {
  const job = JOBS[character.jobId] || Object.values(JOBS)[0] || {
    maxHpMod: 1,
    attackMod: 1,
    defenseMod: 1,
    speedMod: 1
  };
  return {
    maxHp: Math.floor(character.baseStats.maxHp * job.maxHpMod),
    attack: Math.floor(character.baseStats.attack * job.attackMod),
    defense: Math.floor(character.baseStats.defense * job.defenseMod),
    speed: Math.floor(character.baseStats.speed * job.speedMod)
  };
}

function getXpToNextLevel(level) {
  const safeLevel = Math.max(1, Number(level || 1));
  return Math.floor(
    ACTIVE_PROGRESSION.xpBase + Math.pow(safeLevel, ACTIVE_PROGRESSION.xpCurve) * ACTIVE_PROGRESSION.xpGrowth
  );
}

function makeEnemyWave(rank, options) {
  const config = options || {};
  const count = clamp(config.enemyCount || (2 + rank), 2, 6);
  const enemyPrefix = config.enemyPrefix || "Arena Trooper";
  const enemies = [];

  for (let i = 0; i < count; i += 1) {
    const tier = rank + 1;
    enemies.push({
      id: `enemy_${rank}_${i}`,
      name: `${enemyPrefix} ${i + 1}`,
      stats: {
        maxHp: 65 + tier * 18 + i * 8,
        attack: 14 + tier * 3,
        defense: 7 + tier * 2,
        speed: 10 + tier * 2
      },
      hp: 0,
      atb: 0,
      isGuarding: false,
      side: "enemy"
    });
  }

  return enemies;
}

class ColiseumGameController {
  constructor({ root }) {
    this.root = root;

    this.state = {
      nationId: null,
      rank: 1,
      credits: 0,
      roster: [],
      battle: null,
      lastTickTime: 0,
      battleContext: null,
      enemyTurnCooldown: 0
    };

    this.elements = {
      panel: root.querySelector("#game-panel"),
      nationButtons: Array.from(root.querySelectorAll("[data-nation-id]")),
      chosenNation: root.querySelector("#chosen-nation"),
      nationFraming: root.querySelector("#nation-framing"),
      rankText: root.querySelector("#game-rank"),
      creditsText: root.querySelector("#game-credits"),
      roster: root.querySelector("#game-roster"),
      party: root.querySelector("#game-party"),
      recruitButtons: root.querySelector("#game-recruit-buttons"),
      startBattle: root.querySelector("#game-start-battle"),
      saveGame: root.querySelector("#game-save"),
      loadGame: root.querySelector("#game-load"),
      commandRow: root.querySelector("#game-command-row"),
      battleStatus: root.querySelector("#game-battle-status"),
      allyBoard: root.querySelector("#game-ally-board"),
      enemyBoard: root.querySelector("#game-enemy-board"),
      log: root.querySelector("#game-log")
    };

    this.battleLoopId = null;
    this.pendingActorId = null;
    this.onExternalBattleRequest = null;
    this.onExternalGrantCredits = null;
    this.onExternalRecruitRequest = null;
    this.onExternalPartyAddRequest = null;
    this.onExternalPartyRemoveRequest = null;
    this.onEntityDbUpdated = null;
  }

  initialize() {
    if (!this.elements.panel) {
      return;
    }

    this.bindInputs();
    this.state.roster = this.normalizeRoster(null);
    this.loadFromStorage(false);
    this.renderAll();
    this.broadcastCampaignState();
  }

  normalizeRoster(inputRoster) {
    const defaults = [deepClone(MAIN_CHARACTER), ...deepClone(RECRUITABLES)];
    const parsed = Array.isArray(inputRoster) ? inputRoster : [];

    const merged = defaults.map((base) => {
      const existing = parsed.find((entry) => entry && entry.id === base.id) || {};
      const baseStats = {
        ...base.baseStats,
        ...(existing.baseStats || {})
      };

      const level = Math.max(1, Number(existing.level || base.level || 1));
      const experience = Math.max(0, Number(existing.experience || 0));

      return {
        ...base,
        ...existing,
        level,
        experience,
        recruited: Boolean(existing.recruited ?? base.recruited),
        inParty: Boolean(existing.inParty ?? base.inParty),
        baseStats
      };
    });

    const hero = merged.find((member) => member.id === MAIN_CHARACTER.id);
    if (hero) {
      hero.recruited = true;
      hero.inParty = true;
    }

    const partyMembers = merged.filter((member) => member.recruited && member.inParty);
    if (partyMembers.length > 4) {
      const keepIds = new Set([MAIN_CHARACTER.id]);
      merged.forEach((member) => {
        if (keepIds.size < 4 && member.recruited && member.id !== MAIN_CHARACTER.id && member.inParty) {
          keepIds.add(member.id);
        }
      });

      merged.forEach((member) => {
        if (member.id === MAIN_CHARACTER.id) {
          member.inParty = true;
          return;
        }

        if (member.recruited) {
          member.inParty = keepIds.has(member.id);
        }
      });
    }

    return merged;
  }

  applyLevelUpGrowth(member) {
    member.baseStats.maxHp += 9 + Math.floor(member.level * 1.5);
    member.baseStats.attack += 2 + (member.level % 3 === 0 ? 1 : 0);
    member.baseStats.defense += 1 + (member.level % 4 === 0 ? 1 : 0);
    member.baseStats.speed += member.level % 2 === 0 ? 1 : 0;
  }

  awardExperienceToParty(amount, battleAllies) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return [];
    }

    const allyIds = new Set((battleAllies || []).map((ally) => ally.id));
    const levelUps = [];

    this.state.roster.forEach((member) => {
      if (!allyIds.has(member.id) || !member.recruited) {
        return;
      }

      member.experience = Math.max(0, Number(member.experience || 0)) + amount;
      while (member.level < MAX_LEVEL && member.experience >= getXpToNextLevel(member.level)) {
        member.experience -= getXpToNextLevel(member.level);
        member.level += 1;
        this.applyLevelUpGrowth(member);
        levelUps.push(member.name);
      }
    });

    return levelUps;
  }

  broadcastCampaignState() {
    const rosterSummary = this.state.roster.map((member) => ({
      id: member.id,
      name: member.name,
      portraitUrl: member.portraitUrl || "",
      lore: member.lore,
      jobId: member.jobId,
      jobLabel: JOBS[member.jobId]?.label || member.jobId,
      jobIconUrl: JOBS[member.jobId]?.iconUrl || "",
      skillIconUrl: JOBS[member.jobId]?.skill?.iconUrl || "",
      recruited: Boolean(member.recruited),
      inParty: Boolean(member.inParty),
      level: member.level,
      stats: computeCombatStats(member),
      experience: Number(member.experience || 0),
      nextLevelXp: getXpToNextLevel(member.level)
    }));

    window.dispatchEvent(
      new CustomEvent("jrpg:campaignState", {
        detail: {
          nationId: this.state.nationId,
          nationLabel: this.state.nationId ? NATIONS[this.state.nationId].label : "Unaligned",
          rank: this.state.rank,
          credits: this.state.credits,
          roster: rosterSummary
        }
      })
    );
  }

  bindInputs() {
    this.elements.nationButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nationId = button.getAttribute("data-nation-id");
        this.chooseNation(nationId);
      });
    });

    if (this.elements.startBattle) {
      this.elements.startBattle.addEventListener("click", () => {
        this.startBattle();
      });
    }

    if (this.elements.saveGame) {
      this.elements.saveGame.addEventListener("click", () => {
        this.saveToStorage();
        this.log("Campaign saved.");
      });
    }

    if (this.elements.loadGame) {
      this.elements.loadGame.addEventListener("click", () => {
        this.loadFromStorage(true);
        this.renderAll();
        this.log("Campaign loaded.");
      });
    }

    this.onExternalBattleRequest = (event) => {
      const detail = event.detail || {};
      this.startBattle(detail);
    };

    this.onExternalGrantCredits = (event) => {
      const detail = event.detail || {};
      const amount = Number(detail.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }

      this.state.credits += amount;
      this.renderProgress();
      this.log(`Received ${amount} credits from map interaction.`);
    };

    this.onExternalRecruitRequest = (event) => {
      const detail = event.detail || {};
      this.recruitMember(detail.memberId, true);
    };

    this.onExternalPartyAddRequest = (event) => {
      const detail = event.detail || {};
      this.addMemberToParty(detail.memberId);
    };

    this.onExternalPartyRemoveRequest = (event) => {
      const detail = event.detail || {};
      this.removeMemberFromParty(detail.memberId);
    };

    window.addEventListener("jrpg:startBattle", this.onExternalBattleRequest);
    window.addEventListener("jrpg:grantCredits", this.onExternalGrantCredits);
    window.addEventListener("jrpg:recruitRequest", this.onExternalRecruitRequest);
    window.addEventListener("jrpg:partyAddRequest", this.onExternalPartyAddRequest);
    window.addEventListener("jrpg:partyRemoveRequest", this.onExternalPartyRemoveRequest);

    this.onEntityDbUpdated = () => {
      this.state.roster = this.normalizeRoster(this.state.roster);
      this.renderAll();
      this.broadcastCampaignState();
      this.log("Entity database updated.");
    };

    window.addEventListener("jrpg:entityDbUpdated", this.onEntityDbUpdated);
  }

  recruitMember(memberId, autoAddToParty) {
    const member = this.getRosterById(memberId);
    if (!member) {
      return;
    }

    if (member.recruited) {
      window.dispatchEvent(
        new CustomEvent("jrpg:recruitResult", {
          detail: {
            ok: false,
            memberId,
            memberName: member.name,
            reason: "already-recruited"
          }
        })
      );
      return;
    }

    member.recruited = true;
    if (autoAddToParty && this.getPartyMembers().length < 4) {
      member.inParty = true;
    }

    this.renderAll();
    this.broadcastCampaignState();
    this.log(`${member.name} joined your company.`);
    window.dispatchEvent(
      new CustomEvent("jrpg:recruitResult", {
        detail: {
          ok: true,
          memberId,
          memberName: member.name,
          inParty: member.inParty
        }
      })
    );
  }

  addMemberToParty(memberId) {
    const member = this.getRosterById(memberId);
    if (!member || !member.recruited || member.inParty) {
      return;
    }

    if (this.getPartyMembers().length >= 4) {
      this.log("Party is full. Remove a member first.");
      return;
    }

    member.inParty = true;
    this.renderAll();
    this.broadcastCampaignState();
    this.log(`${member.name} moved to the active party.`);
  }

  removeMemberFromParty(memberId) {
    const member = this.getRosterById(memberId);
    if (!member || !member.inParty) {
      return;
    }

    if (member.id === MAIN_CHARACTER.id) {
      this.log(`${MAIN_CHARACTER.name} cannot be removed from the active party.`);
      return;
    }

    if (this.getPartyMembers().length <= 1) {
      this.log("At least one member must remain in the active party.");
      return;
    }

    member.inParty = false;
    this.renderAll();
    this.broadcastCampaignState();
    this.log(`${member.name} moved to reserve.`);
  }

  chooseNation(nationId) {
    if (!NATIONS[nationId]) {
      return;
    }

    this.state.nationId = nationId;
    this.renderNation();
    this.broadcastCampaignState();
    this.log(`You pledged to ${NATIONS[nationId].label}.`);
  }

  getRosterById(characterId) {
    return this.state.roster.find((member) => member.id === characterId);
  }

  getPartyMembers() {
    return this.state.roster.filter((member) => member.inParty && member.recruited).slice(0, 4);
  }

  renderAll() {
    this.renderNation();
    this.renderProgress();
    this.renderRoster();
    this.renderParty();
    this.renderRecruitControls();
    this.renderBattleBoards();
  }

  renderNation() {
    if (!this.elements.chosenNation || !this.elements.nationFraming) {
      return;
    }

    const nation = this.state.nationId ? NATIONS[this.state.nationId] : null;

    this.elements.chosenNation.textContent = nation
      ? `Contracted Nation: ${nation.label}`
      : "Contracted Nation: Unaligned mercenary";

    this.elements.nationFraming.textContent = nation
      ? `${nation.values}. ${nation.framing}`
      : "Every nation claims righteousness. Pick who pays and persuades you.";

    this.elements.nationButtons.forEach((button) => {
      const isActive = button.getAttribute("data-nation-id") === this.state.nationId;
      button.classList.toggle("active", isActive);
    });
  }

  renderProgress() {
    if (this.elements.rankText) {
      this.elements.rankText.textContent = String(this.state.rank);
    }

    if (this.elements.creditsText) {
      this.elements.creditsText.textContent = String(this.state.credits);
    }

    this.broadcastCampaignState();
  }

  renderRoster() {
    if (!this.elements.roster) {
      return;
    }

    this.elements.roster.innerHTML = this.state.roster
      .map((member) => {
        const stats = computeCombatStats(member);
        const recruitText = member.recruited ? "Recruited" : "Available";
        const portrait = member.portraitUrl
          ? `<img class="party-portrait" src="${member.portraitUrl}" alt="${member.name}" />`
          : "";

        return `<li>
          ${portrait}
          <strong>${member.name}</strong> (${recruitText})<br>
          Job:
          <select data-job-id="${member.id}">
            ${Object.values(JOBS)
              .map(
                (job) =>
                  `<option value="${job.id}" ${job.id === member.jobId ? "selected" : ""}>${job.label}</option>`
              )
              .join("")}
          </select><br>
          Lv ${member.level} XP ${member.experience || 0}/${getXpToNextLevel(member.level)}<br>
          HP ${stats.maxHp} | ATK ${stats.attack} | DEF ${stats.defense} | SPD ${stats.speed}
        </li>`;
      })
      .join("");

    this.elements.roster.querySelectorAll("[data-job-id]").forEach((select) => {
      select.addEventListener("change", () => {
        const member = this.getRosterById(select.getAttribute("data-job-id"));
        if (!member) {
          return;
        }

        member.jobId = select.value;
        this.renderRoster();
        this.renderParty();
      });
    });
  }

  renderParty() {
    if (!this.elements.party) {
      return;
    }

    const party = this.getPartyMembers();
    this.elements.party.innerHTML = party
      .map(
        (member) => {
          const job = JOBS[member.jobId] || { label: member.jobId, iconUrl: "" };
          const icon = job.iconUrl ? `<img class="job-inline-icon" src="${job.iconUrl}" alt="${job.label}" />` : "";
          return `<li>${icon}<strong>${member.name}</strong> - ${job.label}</li>`;
        }
      )
      .join("");

    if (party.length === 0) {
      this.elements.party.innerHTML = "<li>No party members.</li>";
    }
  }

  renderRecruitControls() {
    if (!this.elements.recruitButtons) {
      return;
    }

    const available = this.state.roster.filter((member) => !member.recruited);

    this.elements.recruitButtons.innerHTML = available
      .map(
        (member) => `<button type="button" data-recruit-id="${member.id}" class="ghost">Recruit ${member.name}</button>`
      )
      .join("");

    this.elements.recruitButtons.querySelectorAll("[data-recruit-id]").forEach((button) => {
      button.addEventListener("click", () => {
        this.recruitMember(button.getAttribute("data-recruit-id"), true);
      });
    });
  }

  startBattle(options) {
    const config = options || {};

    if (this.state.battle && this.state.battle.active) {
      this.log("Battle already in progress.");
      return;
    }

    const party = this.getPartyMembers();
    if (party.length === 0) {
      this.log("You need at least one fighter in the party.");
      return;
    }

    const allies = party.map((member) => {
      const stats = computeCombatStats(member);
      return {
        id: member.id,
        name: member.name,
        jobId: member.jobId,
        stats,
        hp: stats.maxHp,
        mp: 35,
        atb: 0,
        isGuarding: false,
        side: "ally"
      };
    });

    const encounterRank = clamp(this.state.rank + Number(config.rankOffset || 0), 1, 99);
    const enemies = makeEnemyWave(encounterRank, {
      enemyCount: config.enemyCount,
      enemyPrefix: config.enemyPrefix
    });
    enemies.forEach((enemy) => {
      enemy.hp = enemy.stats.maxHp;
    });

    this.state.battle = {
      active: true,
      allies,
      enemies,
      log: ["Arena match started."],
      victor: null
    };
    this.state.battleContext = {
      source: config.source || "coliseum",
      label: config.label || "Arena match",
      rewardBonus: Number(config.rewardBonus || 0),
      encounterRank
    };

    this.pendingActorId = null;
    this.state.enemyTurnCooldown = 0;
    this.renderBattleBoards();
    this.renderCommandRow();
    this.log(`${this.state.battleContext.label} started. Fill gauges and issue commands.`);
    window.dispatchEvent(new CustomEvent("jrpg:battleState", { detail: { active: true } }));
    this.startBattleLoop();
  }

  startBattleLoop() {
    this.stopBattleLoop();
    this.state.lastTickTime = performance.now();

    this.battleLoopId = window.setInterval(() => {
      if (!this.state.battle || !this.state.battle.active) {
        this.stopBattleLoop();
        return;
      }

      const now = performance.now();
      const delta = Math.min(120, now - this.state.lastTickTime);
      this.state.lastTickTime = now;

      this.tickBattle(delta / 1000);
      this.renderBattleBoards();
    }, 100);
  }

  stopBattleLoop() {
    if (this.battleLoopId) {
      window.clearInterval(this.battleLoopId);
      this.battleLoopId = null;
    }
  }

  tickBattle(deltaSeconds) {
    const battle = this.state.battle;
    this.state.enemyTurnCooldown = Math.max(0, this.state.enemyTurnCooldown - deltaSeconds);

    const playerChoosingCommand = Boolean(this.pendingActorId);
    if (!(ATB_WAIT_MODE && playerChoosingCommand)) {
      const units = [...battle.allies, ...battle.enemies].filter((unit) => unit.hp > 0);

      units.forEach((unit) => {
        if (unit.atb >= 100) {
          return;
        }

        unit.atb = clamp(unit.atb + unit.stats.speed * deltaSeconds * 8, 0, 100);
      });
    }

    if (!this.pendingActorId) {
      const readyAlly = battle.allies.find((ally) => ally.hp > 0 && ally.atb >= 100);
      if (readyAlly) {
        this.pendingActorId = readyAlly.id;
        this.renderCommandRow();
          this.checkBattleEnd();
          return;
        }
      }

      if (!this.pendingActorId && this.state.enemyTurnCooldown <= 0) {
        const readyEnemy = battle.enemies.find((enemy) => enemy.hp > 0 && enemy.atb >= 100);
        if (readyEnemy) {
          this.enemyTakeTurn(readyEnemy);
          this.checkBattleEnd();
      }
    }

    this.checkBattleEnd();
  }

  enemyTakeTurn(enemy) {
    const battle = this.state.battle;
    const targets = battle.allies.filter((ally) => ally.hp > 0);
    if (targets.length === 0) {
      return;
    }

    const target = targets[Math.floor(Math.random() * targets.length)];
    const base = enemy.stats.attack - target.stats.defense * 0.45;
    const variance = 0.85 + Math.random() * 0.3;
    let damage = Math.max(4, Math.floor(base * variance));

    if (target.isGuarding) {
      damage = Math.floor(damage * 0.55);
      target.isGuarding = false;
    }

    target.hp = clamp(target.hp - damage, 0, target.stats.maxHp);
    enemy.atb = 0;
    // Prevent enemy packs from firing back-to-back before allies can respond.
    this.state.enemyTurnCooldown = ENEMY_GLOBAL_TURN_COOLDOWN;
    this.log(`${enemy.name} hits ${target.name} for ${damage}.`);
  }

  renderCommandRow() {
    const battle = this.state.battle;
    if (!battle || !battle.active || !this.pendingActorId) {
      this.elements.commandRow.innerHTML = "<p class=\"hint\">No active command.</p>";
      return;
    }

    const actor = battle.allies.find((ally) => ally.id === this.pendingActorId);
    if (!actor || actor.hp <= 0 || actor.atb < 100) {
      this.pendingActorId = null;
      this.elements.commandRow.innerHTML = "<p class=\"hint\">No active command.</p>";
      return;
    }

    const job = JOBS[actor.jobId] || Object.values(JOBS)[0];
    const skillIcon = job.skill?.iconUrl
      ? `<img class="skill-inline-icon" src="${job.skill.iconUrl}" alt="${job.skill.name}" />`
      : "";
    this.elements.commandRow.innerHTML = `
      <p><strong>${actor.name}</strong> is ready.</p>
      <div class="button-row">
        <button type="button" data-command="attack">Attack</button>
        <button type="button" data-command="skill">${skillIcon}${job.skill.name} (${job.skill.cost} MP)</button>
      </div>
      <button type="button" class="ghost" data-command="guard">Guard</button>
    `;

    this.elements.commandRow.querySelectorAll("[data-command]").forEach((button) => {
      button.addEventListener("click", () => {
        this.allyTakeTurn(button.getAttribute("data-command"));
      });
    });
  }

  allyTakeTurn(command) {
    const battle = this.state.battle;
    if (!battle || !this.pendingActorId) {
      return;
    }

    const actor = battle.allies.find((ally) => ally.id === this.pendingActorId);
    if (!actor || actor.hp <= 0) {
      this.pendingActorId = null;
      this.renderCommandRow();
      return;
    }

    if (command === "guard") {
      actor.isGuarding = true;
      actor.atb = 0;
      this.pendingActorId = null;
      this.log(`${actor.name} braces for impact.`);
      this.renderCommandRow();
      return;
    }

    const targets = battle.enemies.filter((enemy) => enemy.hp > 0);
    if (targets.length === 0) {
      return;
    }

    const target = targets[Math.floor(Math.random() * targets.length)];
    const job = JOBS[actor.jobId] || Object.values(JOBS)[0];
    if (command === "skill" && actor.mp < job.skill.cost) {
      this.log(`${actor.name} does not have enough MP for ${job.skill.name}.`);
      this.renderCommandRow();
      return;
    }

    const usingSkill = command === "skill";

    let powerMultiplier = 1;
    if (usingSkill) {
      powerMultiplier = job.skill.power;
      actor.mp -= job.skill.cost;
    }

    const base = actor.stats.attack * powerMultiplier - target.stats.defense * 0.4;
    const variance = 0.9 + Math.random() * 0.25;
    let damage = Math.max(5, Math.floor(base * variance));

    if (target.isGuarding) {
      damage = Math.floor(damage * 0.6);
      target.isGuarding = false;
    }

    target.hp = clamp(target.hp - damage, 0, target.stats.maxHp);
    actor.atb = 0;
    this.pendingActorId = null;

    this.log(
      usingSkill
        ? `${actor.name} used ${job.skill.name} on ${target.name} for ${damage}.`
        : `${actor.name} attacked ${target.name} for ${damage}.`
    );

    this.renderCommandRow();
    this.renderBattleBoards();
    this.checkBattleEnd();
  }

  checkBattleEnd() {
    const battle = this.state.battle;
    if (!battle || !battle.active) {
      return;
    }

    const alliesAlive = battle.allies.some((ally) => ally.hp > 0);
    const enemiesAlive = battle.enemies.some((enemy) => enemy.hp > 0);

    if (alliesAlive && enemiesAlive) {
      return;
    }

    battle.active = false;
    this.pendingActorId = null;
    this.renderCommandRow();
    this.stopBattleLoop();

    let xpReward = 0;
    let creditReward = 0;
    let leveledNames = [];

    if (alliesAlive) {
      xpReward = Math.floor(
        (22 + this.state.battleContext.encounterRank * 6 + battle.enemies.length * 3) *
          ACTIVE_PROGRESSION.xpRewardScale
      );
      leveledNames = this.awardExperienceToParty(xpReward, battle.allies);
      this.state.rank += 1;
      creditReward = 65 + this.state.rank * 20 + (this.state.battleContext?.rewardBonus || 0);
      this.state.credits += creditReward;
      this.log(`Victory. Rank up to ${this.state.rank}. Earned ${creditReward} credits and ${xpReward} XP.`);
      if (leveledNames.length > 0) {
        this.log(`Level up: ${leveledNames.join(", ")}.`);
      }
    } else {
      this.log("Defeat. You hold your rank but lose face in the pit.");
    }

    const battleResultDetail = {
      source: this.state.battleContext?.source || "coliseum",
      label: this.state.battleContext?.label || "Arena match",
      victory: alliesAlive,
      rank: this.state.rank,
      credits: this.state.credits
    };

    if (alliesAlive) {
      battleResultDetail.xpReward = xpReward;
      battleResultDetail.creditReward = creditReward;
      battleResultDetail.levelUps = leveledNames.map((name) => {
        const member = this.state.roster.find((entry) => entry.name === name);
        return {
          id: member?.id || name,
          name,
          level: member?.level || 1
        };
      });
    }

    window.dispatchEvent(
      new CustomEvent("jrpg:battleFinished", {
        detail: battleResultDetail
      })
    );
    window.dispatchEvent(
      new CustomEvent("jrpg:battleResult", {
        detail: battleResultDetail
      })
    );

    this.renderProgress();
    this.renderBattleBoards();
  }

  renderBattleBoards() {
    const battle = this.state.battle;
    if (!battle) {
      this.elements.battleStatus.textContent = "No active match.";
      this.elements.allyBoard.innerHTML = "<li>Party not deployed.</li>";
      this.elements.enemyBoard.innerHTML = "<li>Enemies not deployed.</li>";
      return;
    }

    this.elements.battleStatus.textContent = battle.active
      ? "Match in progress"
      : "Match ended";

    this.elements.allyBoard.innerHTML = battle.allies
      .map((unit) => this.renderUnitCard(unit))
      .join("");

    this.elements.enemyBoard.innerHTML = battle.enemies
      .map((unit) => this.renderUnitCard(unit))
      .join("");
  }

  renderUnitCard(unit) {
    const hpPercent = Math.floor((unit.hp / unit.stats.maxHp) * 100);
    const atbPercent = Math.floor(unit.atb);
    let status = "Charging";
    if (unit.hp <= 0) {
      status = "KO";
    } else if (unit.isGuarding) {
      status = "Guard";
    } else if (unit.side === "ally" && this.pendingActorId === unit.id) {
      status = "Act";
    } else if (unit.atb >= 100) {
      status = unit.side === "ally" ? "Queued" : "Ready";
    }

    const portrait = unit.side === "ally"
      ? (this.state.roster.find((entry) => entry.id === unit.id)?.portraitUrl || "")
      : "";
    const portraitMarkup = portrait ? `<img class="battle-portrait" src="${portrait}" alt="${unit.name}" />` : "";

    return `<li>
      ${portraitMarkup}
      <strong>${unit.name}</strong> (${status})<br>
      HP ${unit.hp}/${unit.stats.maxHp}
      <div class="meter"><span style="width:${hpPercent}%"></span></div>
      ATB ${atbPercent}
      <div class="meter atb"><span style="width:${atbPercent}%"></span></div>
    </li>`;
  }

  saveToStorage() {
    const payload = {
      nationId: this.state.nationId,
      rank: this.state.rank,
      credits: this.state.credits,
      roster: this.state.roster
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  }

  loadFromStorage(showMissingLog) {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      if (showMissingLog) {
        this.log("No save data found.");
      }
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      this.state.nationId = parsed.nationId || null;
      this.state.rank = parsed.rank || 1;
      this.state.credits = parsed.credits || 0;
      this.state.roster = this.normalizeRoster(parsed.roster);
    } catch {
      this.log("Save data was corrupted and could not be read.");
      this.state.roster = this.normalizeRoster(null);
    }
  }

  log(message) {
    const timestamp = new Date().toLocaleTimeString();
    const line = `[${timestamp}] ${message}`;

    const current = this.elements.log.innerHTML;
    this.elements.log.innerHTML = `<li>${line}</li>${current}`;
  }
}

globalObject.JRPG.systems.game.ColiseumGameController = ColiseumGameController;
})(window);
