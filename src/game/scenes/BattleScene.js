/* global Phaser */
class BattleScene extends Phaser.Scene {
  constructor() {
    super({ key: "BattleScene" });
  }

  init(data) {
    this.battleConfig = data || {};
  }

  create() {
    const { computeCombatStats } = window.JRPG.systems.campaign;
    const { JOBS }               = window.JRPG.systems.game.data;
    const campaign               = window.JRPG.systems.activeCampaign;
    const W = this.scale.width, H = this.scale.height;

    this.sceneShuttingDown = false;
    this.autoBattle = false;
    this.pendingActorId = null;
    this.enemyTurnCooldown = 0;
    this.lastTick = 0;

    // ── Background ────────────────────────────────────────────────────────────
    this.add.rectangle(W / 2, H / 2, W, H, 0x0d1b2a, 0.97).setDepth(0);

    // ── Title bar ─────────────────────────────────────────────────────────────
    const label = this.battleConfig.label || "Arena Match";
    this.add.text(W / 2, 14, label.toUpperCase(), {
      fontSize: "13px", color: "#e8d8b0", letterSpacing: 2
    }).setOrigin(0.5, 0).setDepth(1);

    // ── Build ally / enemy arrays ─────────────────────────────────────────────
    const party = campaign ? campaign.getPartyMembers() : [];
    const encounterRank = Math.max(1, (campaign ? Number(campaign.getSnapshot().rank || 1) : 1)
      + (this.battleConfig.rankOffset || 0));

    this.allies  = party.map(member => {
      const stats = computeCombatStats(member);
      const job   = JOBS[member.jobId] || Object.values(JOBS)[0];
      return {
        id: member.id, name: member.name, jobId: member.jobId,
        stats,
        hp: stats.maxHp,
        mp: 40,
        atb: 0,
        isGuarding: false,
        side: "ally",
        skill: job.skill || { name: "Strike", power: 1.2, cost: 8 }
      };
    });

    if (this.allies.length === 0) {
      this.allies = [{
        id: "fallback", name: "Mercenary", jobId: "vanguard",
        stats: { maxHp: 120, attack: 18, defense: 10, speed: 12 },
        hp: 120, mp: 40, atb: 0, isGuarding: false, side: "ally",
        skill: { name: "Strike", power: 1.2, cost: 8 }
      }];
    }

    const enemyCount  = Math.min(6, 2 + encounterRank);
    const enemyPrefix = this.battleConfig.enemyPrefix || "Arena Trooper";
    this.enemies = Array.from({ length: enemyCount }, (_, i) => {
      const tier = encounterRank + 1;
      return {
        id: `enemy_${i}`, name: `${enemyPrefix} ${i + 1}`,
        stats: { maxHp: 65 + tier * 18 + i * 8, attack: 14 + tier * 3,
                 defense: 7 + tier * 2, speed: 10 + tier * 2 },
        hp: 65 + tier * 18 + i * 8, atb: 0, isGuarding: false, side: "enemy"
      };
    });

    this.battleState = { active: true, log: [] };
    this.encounterRank = encounterRank;

    // ── Layout ────────────────────────────────────────────────────────────────
    this.unitCards = {};
    this.buildLayout(W, H);

    // ── Battle log ────────────────────────────────────────────────────────────
    this.logLines = [];
    this.logContainer = this.add.container(W / 2, H - 70).setDepth(1);
    this.logBg = this.add.rectangle(0, 0, W - 20, 58, 0x000000, 0.5)
      .setOrigin(0.5).setDepth(1);
    this.logContainer.add(this.logBg);
    this.logText = this.add.text(0, -22, "", {
      fontSize: "9px", color: "#ddd", align: "center",
      wordWrap: { width: W - 30 }, lineSpacing: 4
    }).setOrigin(0.5, 0).setDepth(2);
    this.logContainer.add(this.logText);

    // ── Command area ──────────────────────────────────────────────────────────
    this.commandContainer = this.add.container(W / 2, H - 130).setDepth(5);

    // ── Auto-battle toggle (HTML button) ──────────────────────────────────────
    const autoBtn = document.getElementById("auto-battle-toggle");
    if (autoBtn) {
      autoBtn.style.display = "inline-block";
      this._autoBtnHandler = () => {
        this.autoBattle = !this.autoBattle;
        autoBtn.textContent = `Auto Battle: ${this.autoBattle ? "ON" : "OFF"}`;
        autoBtn.classList.toggle("is-active", this.autoBattle);
      };
      autoBtn.addEventListener("click", this._autoBtnHandler);
    }

    window.dispatchEvent(new CustomEvent("jrpg:battleState", { detail: { active: true } }));
    this.addLog("Battle started. Fill ATB gauges to act.");

    // ── ATB tick ──────────────────────────────────────────────────────────────
    this.lastTick = this.time.now;
    this.time.addEvent({ delay: 100, loop: true, callback: this.tickBattle, callbackScope: this });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Layout / rendering
  // ──────────────────────────────────────────────────────────────────────────
  buildLayout(W, H) {
    const colW    = (W - 40) / 2;
    const cardH   = 52;
    const spacing = 8;
    const topY    = 40;

    const buildColumn = (units, startX, label) => {
      this.add.text(startX + colW / 2, topY, label, {
        fontSize: "10px", color: "#a0c0d0"
      }).setOrigin(0.5, 0).setDepth(1);

      units.forEach((unit, i) => {
        const y = topY + 18 + i * (cardH + spacing);
        const card = this.buildUnitCard(unit, startX + 4, y, colW - 8, cardH);
        this.unitCards[unit.id] = card;
      });
    };

    buildColumn(this.allies,  20,          "ALLIES");
    buildColumn(this.enemies, 20 + colW + 10, "ENEMIES");
  }

  buildUnitCard(unit, x, y, w, h) {
    const bg = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x1a2a3a).setDepth(1);
    const name = this.add.text(x + 6, y + 5, unit.name, {
      fontSize: "9px", color: "#ffffff"
    }).setDepth(2);
    const hpLabel = this.add.text(x + 6, y + 18, `HP ${unit.hp}/${unit.stats.maxHp}`, {
      fontSize: "8px", color: "#88cc88"
    }).setDepth(2);
    const hpBg  = this.add.rectangle(x + 6, y + 30, w - 12, 6, 0x333333).setOrigin(0, 0.5).setDepth(2);
    const hpBar = this.add.rectangle(x + 6, y + 30, w - 12, 6, 0x44cc44).setOrigin(0, 0.5).setDepth(3);
    const atbBg  = this.add.rectangle(x + 6, y + 40, w - 12, 4, 0x222222).setOrigin(0, 0.5).setDepth(2);
    const atbBar = this.add.rectangle(x + 6, y + 40, 0, 4, 0xf0c040).setOrigin(0, 0.5).setDepth(3);

    return { bg, name, hpLabel, hpBg, hpBar, atbBg, atbBar, unit, x, y, w, h };
  }

  refreshCard(unit) {
    const card = this.unitCards[unit.id];
    if (!card) return;
    const hpPct  = Math.max(0, unit.hp / unit.stats.maxHp);
    const atbPct = Math.min(1, unit.atb / 100);
    const maxW   = card.w - 12;

    card.hpBar.width  = Math.floor(hpPct  * maxW);
    card.atbBar.width = Math.floor(atbPct * maxW);
    card.hpLabel.setText(`HP ${Math.max(0, unit.hp)}/${unit.stats.maxHp}`);

    const isAlive = unit.hp > 0;
    card.bg.setFillStyle(unit.id === this.pendingActorId ? 0x2a3f55 : (isAlive ? 0x1a2a3a : 0x111111));
    card.name.setColor(isAlive ? "#ffffff" : "#666666");
    card.hpBar.setFillStyle(hpPct > 0.5 ? 0x44cc44 : hpPct > 0.25 ? 0xddaa22 : 0xcc3333);
  }

  refreshAllCards() {
    [...this.allies, ...this.enemies].forEach(u => this.refreshCard(u));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ATB / battle logic
  // ──────────────────────────────────────────────────────────────────────────
  tickBattle() {
    if (!this.battleState.active) return;

    const now    = this.time.now;
    const delta  = Math.min(0.2, (now - this.lastTick) / 1000);
    this.lastTick = now;

    this.enemyTurnCooldown = Math.max(0, this.enemyTurnCooldown - delta);

    const waiting = Boolean(this.pendingActorId);
    if (!waiting) {
      const units = [...this.allies, ...this.enemies].filter(u => u.hp > 0);
      units.forEach(u => { if (u.atb < 100) u.atb = Math.min(100, u.atb + u.stats.speed * delta * 8); });
    }

    if (!this.pendingActorId) {
      const readyAlly = this.allies.find(a => a.hp > 0 && a.atb >= 100);
      if (readyAlly) {
        this.pendingActorId = readyAlly.id;
        if (this.autoBattle) {
          const useSkill = readyAlly.mp >= readyAlly.skill.cost;
          this.allyTakeTurn(useSkill ? "skill" : "attack");
        } else {
          this.renderCommandRow();
        }
        this.checkBattleEnd();
        this.refreshAllCards();
        return;
      }
    }

    if (!this.pendingActorId && this.enemyTurnCooldown <= 0) {
      const readyEnemy = this.enemies.find(e => e.hp > 0 && e.atb >= 100);
      if (readyEnemy) {
        this.enemyTakeTurn(readyEnemy);
        this.checkBattleEnd();
      }
    }

    this.refreshAllCards();
    this.checkBattleEnd();
  }

  enemyTakeTurn(enemy) {
    const targets = this.allies.filter(a => a.hp > 0);
    if (!targets.length) return;
    const target   = targets[Math.floor(Math.random() * targets.length)];
    const base     = enemy.stats.attack - target.stats.defense * 0.45;
    let damage     = Math.max(4, Math.floor(base * (0.85 + Math.random() * 0.3)));
    if (target.isGuarding) { damage = Math.floor(damage * 0.55); target.isGuarding = false; }
    target.hp = Math.max(0, target.hp - damage);
    enemy.atb  = 0;
    this.enemyTurnCooldown = 0.08;
    this.addLog(`${enemy.name} hits ${target.name} for ${damage}.`);
  }

  allyTakeTurn(command) {
    const actor = this.allies.find(a => a.id === this.pendingActorId);
    if (!actor || actor.hp <= 0) { this.pendingActorId = null; this.clearCommandRow(); return; }

    if (command === "guard") {
      actor.isGuarding = true; actor.atb = 0;
      this.pendingActorId = null;
      this.addLog(`${actor.name} braces for impact.`);
      this.clearCommandRow();
      return;
    }

    const targets = this.enemies.filter(e => e.hp > 0);
    if (!targets.length) return;
    const target = targets[Math.floor(Math.random() * targets.length)];
    const usingSkill = command === "skill";

    if (usingSkill && actor.mp < actor.skill.cost) {
      this.addLog(`${actor.name} lacks MP for ${actor.skill.name}.`);
      this.clearCommandRow();
      return;
    }

    let power = 1;
    if (usingSkill) { power = actor.skill.power; actor.mp -= actor.skill.cost; }

    const base   = actor.stats.attack * power - target.stats.defense * 0.4;
    let damage   = Math.max(5, Math.floor(base * (0.9 + Math.random() * 0.25)));
    if (target.isGuarding) { damage = Math.floor(damage * 0.6); target.isGuarding = false; }
    target.hp     = Math.max(0, target.hp - damage);
    actor.atb     = 0;
    this.pendingActorId = null;

    this.addLog(usingSkill
      ? `${actor.name} used ${actor.skill.name} on ${target.name} for ${damage}.`
      : `${actor.name} attacked ${target.name} for ${damage}.`);

    this.clearCommandRow();
    this.refreshAllCards();
    this.checkBattleEnd();
  }

  checkBattleEnd() {
    if (!this.battleState.active || this.sceneShuttingDown) return;
    const alliesAlive  = this.allies.some(a => a.hp > 0);
    const enemiesAlive = this.enemies.some(e => e.hp > 0);
    if (alliesAlive && enemiesAlive) return;

    this.battleState.active = false;
    this.pendingActorId     = null;
    this.clearCommandRow();

    const allyIds  = this.allies.map(a => a.id);
    const campaign = window.JRPG.systems.activeCampaign;
    let rewards    = { levelUps: [], creditReward: 0, xpReward: 0 };

    if (alliesAlive && campaign) {
      rewards = campaign.applyBattleResult(true, allyIds, this.encounterRank,
        this.battleConfig.rewardBonus || 0);
      this.addLog(`Victory! Rank up. Earned ${rewards.creditReward} credits, ${rewards.xpReward} XP.`);
      if (rewards.levelUps.length) this.addLog(`Level up: ${rewards.levelUps.join(", ")}.`);
    } else {
      this.addLog("Defeat. You hold your rank but lose face in the pit.");
    }

    const detail = {
      source:       this.battleConfig.source || "coliseum",
      label:        this.battleConfig.label  || "Arena Match",
      victory:      alliesAlive,
      rank:         campaign ? campaign.getSnapshot().rank : 1,
      credits:      campaign ? campaign.getSnapshot().credits : 0,
      xpReward:     rewards.xpReward,
      creditReward: rewards.creditReward,
      levelUps:     rewards.levelUps.map(name => ({ name }))
    };

    // Reset auto-battle button
    const autoBtn = document.getElementById("auto-battle-toggle");
    if (autoBtn) {
      autoBtn.textContent = "Auto Battle: OFF";
      autoBtn.classList.remove("is-active");
      autoBtn.style.display = "none";
    }

    // Return to map after a short delay
    this.time.delayedCall(2000, () => {
      if (this.sceneShuttingDown) {
        console.log("Battle scene already shutting down, skipping transition");
        return;
      }
      try {
        console.log("Transitioning from Battle to Map...");
        window.dispatchEvent(new CustomEvent("jrpg:battleState", { detail: { active: false } }));
        this.scene.stop();
        this.scene.start("MapScene", { sceneId: "district" });
        
        // Dispatch battle result events AFTER MapScene has started and initialized
        this.time.delayedCall(50, () => {
          window.dispatchEvent(new CustomEvent("jrpg:battleResult",   { detail }));
          window.dispatchEvent(new CustomEvent("jrpg:battleFinished", { detail }));
        });
      } catch (e) {
        console.error("Scene transition error:", e);
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Command row
  // ──────────────────────────────────────────────────────────────────────────
  renderCommandRow() {
    this.clearCommandRow();
    const actor = this.allies.find(a => a.id === this.pendingActorId);
    if (!actor || actor.hp <= 0) return;

    const W   = this.scale.width;
    const btns = [
      { label: "Attack", cmd: "attack", color: 0x335577 },
      { label: actor.skill.name, cmd: "skill", color: 0x4a3370 },
      { label: "Guard",  cmd: "guard",  color: 0x3a5533 }
    ];

    const btnW = 100, btnH = 30, gap = 12;
    const totalW = btns.length * btnW + (btns.length - 1) * gap;
    let startX  = -totalW / 2;

    this.commandContainer.removeAll(true);

    const prompt = this.add.text(0, -22, `${actor.name} is ready!`,
      { fontSize: "10px", color: "#e8d8a0" }).setOrigin(0.5).setDepth(5);
    this.commandContainer.add(prompt);

    btns.forEach(({ label, cmd, color }) => {
      const cx = startX + btnW / 2;
      const bg = this.add.rectangle(cx, 0, btnW, btnH, color)
        .setInteractive({ useHandCursor: true }).setDepth(5);
      const txt = this.add.text(cx, 0, label,
        { fontSize: "9px", color: "#ffffff" }).setOrigin(0.5).setDepth(6);

      bg.on("pointerover",  () => bg.setFillStyle(Phaser.Display.Color.ValueToColor(color).brighten(30).color));
      bg.on("pointerout",   () => bg.setFillStyle(color));
      bg.on("pointerdown",  () => this.allyTakeTurn(cmd));

      this.commandContainer.add([bg, txt]);
      startX += btnW + gap;
    });
  }

  clearCommandRow() {
    if (this.commandContainer) this.commandContainer.removeAll(true);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Log
  // ──────────────────────────────────────────────────────────────────────────
  addLog(text) {
    this.battleState.log.unshift(text);
    if (this.battleState.log.length > 4) this.battleState.log.length = 4;
    if (this.logText) this.logText.setText(this.battleState.log.join("\n"));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ──────────────────────────────────────────────────────────────────────────
  shutdown() {
    this.sceneShuttingDown = true;
    if (this._autoBtnHandler) {
      const autoBtn = document.getElementById("auto-battle-toggle");
      if (autoBtn) autoBtn.removeEventListener("click", this._autoBtnHandler);
    }
  }
}
