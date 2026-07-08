/* global Phaser */
class MapScene extends Phaser.Scene {
  constructor() {
    super({ key: "MapScene" });
  }

  init(data) {
    this.initSceneId = (data && data.sceneId) || "district";
    this.initSpawnId = (data && data.spawnId)  || null;
  }

  create() {
    const md = window.JRPG.systems.map.data;
    this.D = md;  // shortcut for data

    const T = md.TILE_SIZE;
    this.T = T;

    // ── Restore / init game state ─────────────────────────────────────────────
    const saved = this.loadMapProgress();
    this.ms = {
      flags:                (saved && saved.flags) || {},
      openedObjectIds:      new Set((saved && saved.openedObjectIds) || []),
      phase:                (saved && saved.phase) || "day",
      phaseStepCounter:     (saved && saved.phaseStepCounter) || 0,
      encounterCooldown:    0,
      inBattle:             false,
      campaignSnapshot:     null,
      selectedSignupRank:   null
    };

    // ── Build visual scene ────────────────────────────────────────────────────
    this.mapNpcs    = [];
    this.mapObjects = [];
    this.mapPortals = [];
    this.blocked    = new Set();

    // Restore player position if returning to the same scene
    let startX = 1, startY = 1, startFacing = "down";
    if (saved && saved.currentSceneId === this.initSceneId && !this.initSpawnId) {
      startX      = saved.player.x;
      startY      = saved.player.y;
      startFacing = saved.player.facing || "down";
    }

    const { px, py, facing } = this.buildSceneState(this.initSceneId, this.initSpawnId, startX, startY, startFacing);
    this.playerTileX   = px;
    this.playerTileY   = py;
    this.playerFacing  = facing;
    this.currentSceneId = this.initSceneId;

    // ── Player sprite ─────────────────────────────────────────────────────────
    this.playerSprite = this.add.image(
      px * T + T / 2, py * T + T / 2,
      `player_${this.playerFacing}`
    ).setDepth(20);

    // ── Camera ───────────────────────────────────────────────────────────────
    const scene = md.WORLD_SCENES[this.initSceneId] || md.WORLD_SCENES.district;
    const mapW  = scene.template[0].length * T;
    const mapH  = scene.template.length    * T;
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.startFollow(this.playerSprite, true, 0.12, 0.12);

    // ── Input ─────────────────────────────────────────────────────────────────
    this.cursors  = this.input.keyboard.createCursorKeys();
    this.wasd     = this.input.keyboard.addKeys({
      up:       Phaser.Input.Keyboard.KeyCodes.W,
      down:     Phaser.Input.Keyboard.KeyCodes.S,
      left:     Phaser.Input.Keyboard.KeyCodes.A,
      right:    Phaser.Input.Keyboard.KeyCodes.D,
      interact: Phaser.Input.Keyboard.KeyCodes.E
    });
    this.lastMoveTime = 0;
    this.moveDelay    = 130;

    this.setupTouchInput();
    this.setupHtmlControls();

    // ── Window events ─────────────────────────────────────────────────────────
    this.evBattleState  = e => { this.ms.inBattle = Boolean(e.detail?.active); };
    this.evBattleResult = e => {
      const d = e.detail || {};
      if (d.source !== "map" && d.source !== "registrar") return;
      this.ms.encounterCooldown = 12;
      this.addLog(d.victory ? `${d.label}: You prevailed.` : `${d.label}: Your squad retreated.`);
      this.saveMapProgress();
      this.hideSignupPanel();
      this.updateContextPrompt();
    };
    this.evCampaign     = e => { this.ms.campaignSnapshot = e.detail || {}; };
    this.evRecruit      = e => {
      const d = e.detail || {};
      if (d.ok) { this.ms.flags[d.memberId] = true; this.addLog(`${d.memberName} agreed to join.`); }
      this.saveMapProgress(); this.emitMapState();
    };
    window.addEventListener("jrpg:battleState",  this.evBattleState);
    window.addEventListener("jrpg:battleResult", this.evBattleResult);
    window.addEventListener("jrpg:campaignState",this.evCampaign);
    window.addEventListener("jrpg:recruitResult",this.evRecruit);

    // ── Portal twinkle ────────────────────────────────────────────────────────
    this.time.addEvent({
      delay: 900, loop: true,
      callback: () => this.mapPortals.forEach(p => {
        this.tweens.add({ targets: p.sprite, alpha: { from: 0.5, to: 1 },
          duration: 900, yoyo: true, ease: "Sine.InOut" });
      })
    });

    this.emitMapState();
    this.updateLocationText();
    this.setPrompt("Move with WASD/Arrow keys. Press E or Interact near NPCs and objects.");

    this.createHUD();
    this.createDialogBox();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // On-canvas HUD
  // ──────────────────────────────────────────────────────────────────────────
  createHUD() {
    const W = this.scale.width;
    const H = this.scale.height;

    // Top info bar
    this.add.rectangle(W / 2, 13, W, 26, 0x000000, 0.5).setDepth(30).setScrollFactor(0);
    this.hudSceneText = this.add.text(8, 4, "", {
      fontSize: "9px", color: "#c8d8e8"
    }).setDepth(31).setScrollFactor(0);
    this.hudPhaseText = this.add.text(W / 2, 4, "", {
      fontSize: "9px", color: "#f0c868"
    }).setOrigin(0.5, 0).setDepth(31).setScrollFactor(0);
    this.hudLocationText = this.add.text(W - 8, 4, "", {
      fontSize: "9px", color: "#c8d8e8"
    }).setOrigin(1, 0).setDepth(31).setScrollFactor(0);

    // Prompt bar just above dialog zone
    this.hudPromptBg = this.add.rectangle(W / 2, H - 100, W, 20, 0x000000, 0.4)
      .setDepth(30).setScrollFactor(0);
    this.hudPromptText = this.add.text(W / 2, H - 100, "", {
      fontSize: "9px", color: "#b8d0e8", align: "center",
      wordWrap: { width: W - 20 }
    }).setOrigin(0.5, 0.5).setDepth(31).setScrollFactor(0);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // On-canvas dialog box
  // ──────────────────────────────────────────────────────────────────────────
  createDialogBox() {
    const W   = this.scale.width;
    const H   = this.scale.height;
    const bH  = 88;
    const bY  = H - bH - 6;

    this.dialogContainer = this.add.container(0, 0).setDepth(50).setVisible(false).setScrollFactor(0);

    const bg = this.add.rectangle(W / 2, bY + bH / 2, W - 16, bH, 0x08111e, 0.93)
      .setOrigin(0.5).setStrokeStyle(1, 0x3a5580, 1)
      .setInteractive({ useHandCursor: false });
    bg.on("pointerdown", () => this.hideDialog());

    this.dlgSpeaker = this.add.text(16, bY + 8, "", {
      fontSize: "11px", color: "#f0c040", fontStyle: "bold"
    });
    this.dlgBody = this.add.text(16, bY + 26, "", {
      fontSize: "10px", color: "#e8dece",
      wordWrap: { width: W - 36 }, lineSpacing: 3
    });
    this.dlgContinue = this.add.text(W - 16, bY + bH - 10, "\u25b6 Continue", {
      fontSize: "9px", color: "#6699bb"
    }).setOrigin(1, 1);

    this.dialogContainer.add([bg, this.dlgSpeaker, this.dlgBody, this.dlgContinue]);

    // Flicker the continue indicator
    this.time.addEvent({
      delay: 550, loop: true,
      callback: () => {
        if (this.dialogContainer.visible)
          this.dlgContinue.setVisible(!this.dlgContinue.visible);
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Scene builder
  // ──────────────────────────────────────────────────────────────────────────
  buildSceneState(sceneId, spawnId, defaultX, defaultY, defaultFacing) {
    const md    = this.D;
    const T     = this.T;
    const scene = md.WORLD_SCENES[sceneId] || md.WORLD_SCENES.district;

    // Destroy previous tile objects
    if (this.tileContainer) this.tileContainer.destroy(true);
    this.tileContainer = this.add.container(0, 0);
    this.mapNpcs    = [];
    this.mapObjects = [];
    this.mapPortals = [];
    this.blocked    = new Set();

    const template = scene.template;
    const mapH = template.length;
    const mapW = template[0].length;
    let px = defaultX || 1, py = defaultY || 1;
    let facing = defaultFacing || "down";
    let hasExplicitSpawn = false;

    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const sym = template[y][x];
        let key   = "tile_floor";

        if (sym === "#") { key = "tile_wall";  this.blocked.add(`${x},${y}`); }
        else if (sym === "~") { key = "tile_water"; this.blocked.add(`${x},${y}`); }
        else if (sym === "@" && !spawnId) { px = x; py = y; hasExplicitSpawn = true; }

        const tile = this.add.image(x * T + T / 2, y * T + T / 2, key).setDisplaySize(T, T);
        this.tileContainer.add(tile);

        // NPC
        if (md.NPC_ARCHETYPES[sym]) {
          const arch = md.NPC_ARCHETYPES[sym];
          this.blocked.add(`${x},${y}`);
          const sprite = this.add.image(x * T + T / 2, y * T + T / 2, "npc")
            .setDisplaySize(T - 2, T - 2).setDepth(10);
          const label  = this.add.text(x * T + T / 2, y * T + 2, arch.name,
            { fontSize: "7px", color: "#222", backgroundColor: "#ffffffcc",
              padding: { x: 2, y: 1 } }).setOrigin(0.5, 0).setDepth(11);
          this.mapNpcs.push({
            id: `${scene.id}_${arch.id}_${x}_${y}`,
            archetypeKey: sym, x, y, dialogueIndex: 0, sprite, label
          });
        }

        // Object
        if (md.OBJECT_ARCHETYPES[sym]) {
          const arch     = md.OBJECT_ARCHETYPES[sym];
          this.blocked.add(`${x},${y}`);
          const objectId = `${scene.id}_${arch.id}_${x}_${y}`;
          const isOpened = this.ms.openedObjectIds.has(objectId);
          const sprite   = this.add.image(x * T + T / 2, y * T + T / 2, "obj_chest")
            .setDisplaySize(T - 6, T - 8).setAlpha(isOpened ? 0.4 : 1).setDepth(10);
          this.mapObjects.push({ id: objectId, archetypeKey: sym, x, y, opened: isOpened, sprite });
        }

        // Portal
        if (/^[0-9]$/.test(sym)) {
          const portalKey = scene.id === "district" ? sym : `${sym}_${scene.id}`;
          const portalDef = md.PORTAL_LINKS[portalKey];
          if (portalDef) {
            const sprite = this.add.image(x * T + T / 2, y * T + T / 2, "portal")
              .setDisplaySize(T - 2, T - 2).setDepth(9);
            this.mapPortals.push({ x, y, sprite, ...portalDef });
          }
        }
      }
    }

    // Determine final player position
    if (spawnId && scene.spawns?.[spawnId]) {
      const sp = scene.spawns[spawnId];
      px = sp.x; py = sp.y; facing = sp.facing || "down";
    } else if (!hasExplicitSpawn && scene.spawns?.entry) {
      const sp = scene.spawns.entry;
      px = sp.x; py = sp.y; facing = sp.facing || "down";
    }

    this.sceneLabel     = scene.label;
    this.currentSceneId = scene.id;
    this.mapWidth       = mapW;
    this.mapHeight      = mapH;

    // Update camera bounds for new scene
    if (this.cameras && this.cameras.main) {
      this.cameras.main.setBounds(0, 0, mapW * T, mapH * T);
    }

    return { px, py, facing };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Input setup
  // ──────────────────────────────────────────────────────────────────────────
  setupTouchInput() {
    let sx = 0, sy = 0;
    this.input.on("pointerdown", p => { sx = p.x; sy = p.y; });
    this.input.on("pointerup",   p => {
      const dx = p.x - sx, dy = p.y - sy;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax < 24 && ay < 24) return;
      if (ax >= ay) this.tryMove(dx > 0 ? 1 : -1, 0, dx > 0 ? "right" : "left");
      else          this.tryMove(0, dy > 0 ? 1 : -1, dy > 0 ? "down"  : "up");
    });
  }

  setupHtmlControls() {
    const T = this.T;
    const dirVec = {
      up:    [0, -1, "up"],
      down:  [0,  1, "down"],
      left:  [-1, 0, "left"],
      right: [1,  0, "right"]
    };

    document.querySelectorAll(".dpad-btn[data-dpad]").forEach(btn => {
      const dir = btn.getAttribute("data-dpad");
      let interval = null;

      const start = e => {
        e.preventDefault();
        if (dir === "interact") { this.tryInteract(); return; }
        const [dx, dy, facing] = dirVec[dir] || [0, 0, "down"];
        this.tryMove(dx, dy, facing);
        btn.classList.add("is-pressed");
        interval = setInterval(() => this.tryMove(dx, dy, facing), this.moveDelay);
      };
      const stop = () => {
        clearInterval(interval); interval = null;
        btn.classList.remove("is-pressed");
      };

      btn.addEventListener("pointerdown", start);
      btn.addEventListener("pointerup",   stop);
      btn.addEventListener("pointerleave", stop);
      btn.addEventListener("pointercancel", stop);
    });

    const interactBtn    = document.getElementById("map-interact");
    const histBtn        = document.getElementById("map-history-btn");
    const histModal      = document.getElementById("map-history-modal");
    const histClose      = document.getElementById("map-history-close");
    const dialogClose    = document.getElementById("map-dialog-close");
    const signupClose    = document.getElementById("map-signup-close");
    const signupRanks    = document.getElementById("map-signup-ranks");
    const signupStart    = document.getElementById("map-signup-start");

    if (interactBtn)  interactBtn.addEventListener("click", () => this.tryInteract());
    if (histBtn && histModal) histBtn.addEventListener("click", () => histModal.classList.toggle("is-visible"));
    if (histClose && histModal) histClose.addEventListener("click", () => histModal.classList.remove("is-visible"));
    if (dialogClose) dialogClose.addEventListener("click", () => this.hideDialog());
    if (signupClose) signupClose.addEventListener("click", () => this.hideSignupPanel());

    if (signupRanks) {
      signupRanks.addEventListener("click", e => {
        const btn = e.target;
        if (!(btn instanceof HTMLElement)) return;
        const rankVal = btn.getAttribute("data-signup-rank");
        if (!rankVal) return;
        const rank = Number(rankVal);
        if (Number.isFinite(rank)) this.selectSignupRank(rank);
      });
    }

    if (signupStart) {
      signupStart.addEventListener("click", () => {
        if (Number.isFinite(this.ms.selectedSignupRank))
          this.requestRankBattle(this.ms.selectedSignupRank);
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Game loop
  // ──────────────────────────────────────────────────────────────────────────
  update(time) {
    if (this.dialogContainer && this.dialogContainer.visible) {
      if (Phaser.Input.Keyboard.JustDown(this.wasd.interact) ||
          Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
        this.hideDialog();
      }
      return;
    }
    if (this.ms.inBattle) return;
    if (time - this.lastMoveTime < this.moveDelay) return;

    if (Phaser.Input.Keyboard.JustDown(this.wasd.interact)) {
      this.tryInteract(); this.lastMoveTime = time; return;
    }

    const { cursors, wasd } = this;
    if      (cursors.up.isDown    || wasd.up.isDown)    { this.tryMove( 0, -1, "up");    this.lastMoveTime = time; }
    else if (cursors.down.isDown  || wasd.down.isDown)  { this.tryMove( 0,  1, "down");  this.lastMoveTime = time; }
    else if (cursors.left.isDown  || wasd.left.isDown)  { this.tryMove(-1,  0, "left");  this.lastMoveTime = time; }
    else if (cursors.right.isDown || wasd.right.isDown) { this.tryMove( 1,  0, "right"); this.lastMoveTime = time; }
  }

  tryMove(dx, dy, facing) {
    const T     = this.T;
    const nextX = this.playerTileX + dx;
    const nextY = this.playerTileY + dy;

    if (nextX < 0 || nextY < 0 || nextX >= this.mapWidth || nextY >= this.mapHeight
        || this.blocked.has(`${nextX},${nextY}`)) return false;

    this.playerFacing  = facing;
    this.playerTileX   = nextX;
    this.playerTileY   = nextY;
    this.playerSprite.setTexture(`player_${facing}`);

    this.tweens.add({
      targets: this.playerSprite,
      x: nextX * T + T / 2,
      y: nextY * T + T / 2,
      duration: 70,
      ease: "Linear"
    });

    this.stepTimeCycle();
    if (this.ms.encounterCooldown > 0) this.ms.encounterCooldown--;
    this.trySceneTransition();
    this.updateLocationText();
    this.updateContextPrompt();
    this.maybeTriggerEncounter();
    this.saveMapProgress();
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Interaction
  // ──────────────────────────────────────────────────────────────────────────
  tryInteract() {
    if (this.ms.inBattle) { this.setPrompt("Finish the current battle before interacting."); return; }

    const target = this.getFacingTile();

    const npc = this.mapNpcs.find(n => n.x === target.x && n.y === target.y && this.isNpcActive(n));
    if (npc) {
      const arch = this.D.NPC_ARCHETYPES[npc.archetypeKey];
      const line = this.resolveNpcDialogue(npc, arch);
      npc.dialogueIndex++;
      this.addLog(`${arch.name}: ${line}`);
      this.setPrompt(`Talking to ${arch.name}.`);
      this.showDialog(arch.name, line);

      const campaign = this.getCampaignSnapshot();

      if (arch.id === "supply_broker" && campaign.nationId === "orinth")
        this.markContractAccepted("orinth_contract_accepted",
          "Orinth cargo route accepted.", "Orinth contract accepted.");

      if (arch.id === "retired_captain" && campaign.nationId === "valmere")
        this.markContractAccepted("valmere_contract_accepted",
          "Valmere salvage request accepted.", "Valmere contract accepted.");

      if (arch.registrar) {
        this.ms.flags.spoke_registrar = true;
        if (campaign.nationId === "cindrel")
          this.completeContract("cindrel_contract_accepted", "cindrel_contract_complete",
            "Cindrel dispatch returned.", "Cindrel contract completed.", 55, "iron_longsword");
        this.showSignupPanel();
        this.emitMapState();
        this.saveMapProgress();
        return;
      }

      this.tryRecruitFromNpc(arch);
      this.saveMapProgress();
      return;
    }

    const obj = this.mapObjects.find(o => o.x === target.x && o.y === target.y);
    if (obj) {
      const arch = this.D.OBJECT_ARCHETYPES[obj.archetypeKey];
      if (arch.oneTime && obj.opened) {
        this.addLog(`${arch.name}: Nothing left here.`);
        this.setPrompt("This object has already been used.");
        this.showDialog(arch.name, "Nothing left here.");
        return;
      }
      this.handleObjectInteraction(obj, arch);
      this.saveMapProgress();
      return;
    }

    this.setPrompt("There is nothing to interact with in front of you.");
    this.hideSignupPanel();
  }

  getFacingTile() {
    const { x, y, facing } = { x: this.playerTileX, y: this.playerTileY, facing: this.playerFacing };
    if (facing === "up")    return { x, y: y - 1 };
    if (facing === "down")  return { x, y: y + 1 };
    if (facing === "left")  return { x: x - 1, y };
    return { x: x + 1, y };
  }

  isNpcActive(npc) {
    const arch = this.D.NPC_ARCHETYPES[npc.archetypeKey];
    if (!arch) return false;
    const schedule = Array.isArray(arch.schedule) ? arch.schedule : ["day", "night"];
    return schedule.includes(this.ms.phase);
  }

  resolveNpcDialogue(npc, arch) {
    const c = this.getCampaignSnapshot();
    const isRecruited = Array.isArray(c.roster)
      ? c.roster.some(m => m.id === arch.recruitId && m.recruited) : false;
    if (arch.recruitId && isRecruited) return "I am already on your roster.";
    if (arch.id === "retired_captain" && !this.ms.flags.captainWarningHeard) {
      this.ms.flags.captainWarningHeard = true; this.emitMapState();
      return "I have seen every banner call itself righteous. Keep your own conscience.";
    }
    if (arch.id === "supply_broker" && this.ms.flags.observerContractAccepted)
      return "Observer contracts are live. Stock up before heading out.";
    if (arch.id === "supply_broker" && c.nationId === "orinth" && !this.ms.flags.orinth_contract_accepted)
      return "Orinth needs clean routes and quiet hands.";
    if (arch.id === "retired_captain" && c.nationId === "valmere" && !this.ms.flags.valmere_contract_accepted)
      return "Valmere still remembers old routes. Recover one cache and I will vouch for you.";
    if (arch.id === "arena_scout" && c.nationId === "cindrel" && !this.ms.flags.cindrel_contract_accepted)
      return "Cindrel wants order but their paperwork still needs people who can move fast.";
    if (arch.id === "guild_quartermaster" && c.nationId)
      return "Your chosen banner is drawing attention. Keep your party equipped.";
    if (arch.id === "arena_scout" && c.rank >= 3)
      return "Rank three already? Commanders will start sending private offers soon.";
    return arch.dialogues[npc.dialogueIndex % arch.dialogues.length];
  }

  handleObjectInteraction(obj, arch) {
    const c = this.getCampaignSnapshot();

    if (arch.id === "supply_cache") {
      obj.opened = true;
      if (obj.sprite) obj.sprite.setAlpha(0.4);
      this.ms.openedObjectIds.add(obj.id);
      this.addLog(`${arch.name}: ${arch.interactionText}`);
      this.showDialog(arch.name, arch.interactionText);
      window.dispatchEvent(new CustomEvent("jrpg:grantCredits", { detail: { amount: 20 } }));
      window.dispatchEvent(new CustomEvent("jrpg:grantItem", { detail: { itemId: "field_kit", quantity: 1 } }));
      if (c.nationId === "orinth")
        this.completeContract("orinth_contract_accepted", "orinth_contract_complete",
          "Orinth cargo routes secured.", "Orinth contract completed.", 45, "signal_charm");
      this.setPrompt(`Recovered supplies from ${arch.name}.`);
      return;
    }

    if (arch.id === "notice_board") {
      this.ms.flags.observerContractSeen = true;
      this.addLog(`${arch.name}: ${arch.interactionText}`);
      this.showDialog(arch.name, arch.interactionText);
      if (c.nationId === "cindrel")
        this.markContractAccepted("cindrel_contract_accepted",
          "Cindrel dispatch accepted from the board.", "Cindrel contract accepted. Report to the registrar.");
      else this.setPrompt("A new contract thread has been noted.");
      this.emitMapState();
      return;
    }

    if (arch.id === "training_gate") {
      if (c.nationId === "valmere" && this.ms.flags.valmere_contract_accepted && !this.ms.flags.valmere_contract_complete) {
        this.completeContract("valmere_contract_accepted", "valmere_contract_complete",
          "Valmere salvage request completed.", "Valmere contract completed.", 60, "duelist_blade");
        return;
      }
      if (c.rank < 3) {
        const msg = "Locked. Reach Coliseum rank 3 first.";
        this.addLog(`${arch.name}: ${msg}`); this.showDialog(arch.name, msg);
        this.setPrompt("Gate remains closed."); return;
      }
      if (!this.ms.flags.observerContractSeen) {
        const msg = "You need contract clearance from the notice board.";
        this.addLog(`${arch.name}: ${msg}`); this.showDialog(arch.name, msg);
        this.setPrompt("Missing contract clearance."); return;
      }
      obj.opened = true;
      if (obj.sprite) obj.sprite.setAlpha(0.4);
      this.ms.openedObjectIds.add(obj.id);
      const msg2 = arch.interactionText || "The gate opens for you.";
      this.addLog(`${arch.name}: ${msg2}`); this.showDialog(arch.name, msg2);
      this.ms.flags.observerContractAccepted = true;
      this.setPrompt("Observer contract active.");
      this.emitMapState();
      return;
    }

    const defaultMsg = arch.interactionText || `Interacted with ${arch.name}.`;
    obj.opened = true;
    if (obj.sprite) obj.sprite.setAlpha(0.4);
    this.ms.openedObjectIds.add(obj.id);
    this.addLog(`${arch.name}: ${defaultMsg}`);
    this.showDialog(arch.name, defaultMsg);
    this.setPrompt(defaultMsg);
  }

  tryRecruitFromNpc(arch) {
    if (!arch.recruitId) return;
    const c = this.getCampaignSnapshot();
    const alreadyRecruited = Array.isArray(c.roster)
      ? c.roster.some(m => m.id === arch.recruitId && m.recruited) : false;
    if (alreadyRecruited) return;
    window.dispatchEvent(new CustomEvent("jrpg:recruitRequest",
      { detail: { source: "map", memberId: arch.recruitId } }));
    this.setPrompt(`Recruitment terms offered to ${arch.name}.`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Scene transition (portals)
  // ──────────────────────────────────────────────────────────────────────────
  trySceneTransition() {
    const portal = this.mapPortals.find(p => p.x === this.playerTileX && p.y === this.playerTileY);
    if (!portal) return;

    this.setPrompt(portal.label);
    this.addLog(portal.label);
    this.cameras.main.fade(200, 0, 0, 0, false, (_cam, progress) => {
      if (progress < 1) return;
      const T  = this.T;
      const { px, py, facing } = this.buildSceneState(portal.toSceneId, portal.toSpawnId, 1, 1, "down");
      this.playerTileX  = px;
      this.playerTileY  = py;
      this.playerFacing = facing;
      this.playerSprite.setTexture(`player_${facing}`);
      this.playerSprite.setPosition(px * T + T / 2, py * T + T / 2);
      this.cameras.main.flash(200);
      this.emitMapState();
      this.updateLocationText();
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Encounter
  // ──────────────────────────────────────────────────────────────────────────
  maybeTriggerEncounter() {
    if (this.ms.inBattle || this.ms.encounterCooldown > 0) return;

    const x = this.playerTileX, y = this.playerTileY;
    const zone = this.D.ENCOUNTER_ZONES.find(z =>
      z.sceneId === this.currentSceneId &&
      x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2
    );
    if (!zone || Math.random() > zone.chancePerStep) return;

    this.ms.encounterCooldown = 18;
    this.setPrompt(`Encounter triggered: ${zone.encounter.label}`);
    this.addLog(`Encounter: ${zone.encounter.label}`);

    this.cameras.main.flash(300, 255, 255, 255);
    this.time.delayedCall(350, () => {
      window.dispatchEvent(new CustomEvent("jrpg:startBattle", {
        detail: {
          source:      "map",
          label:       zone.encounter.label,
          rankOffset:  zone.encounter.rankOffset,
          rewardBonus: zone.encounter.rewardBonus,
          enemyPrefix: zone.encounter.enemyPrefix
        }
      }));
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Day/Night cycle
  // ──────────────────────────────────────────────────────────────────────────
  stepTimeCycle() {
    this.ms.phaseStepCounter++;
    if (this.ms.phaseStepCounter < 48) return;
    this.ms.phaseStepCounter = 0;
    this.ms.phase = this.ms.phase === "day" ? "night" : "day";
    this.addLog(`The district shifts to ${this.ms.phase}.`);
    this.emitMapState();
    this.updateLocationText();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Signup / Battle registrar
  // ──────────────────────────────────────────────────────────────────────────
  showSignupPanel() {
    const panel = document.getElementById("map-signup-panel");
    const ranksEl = document.getElementById("map-signup-ranks");
    const statusEl = document.getElementById("map-signup-status");
    if (!panel || !ranksEl || !statusEl) return;

    const c            = this.getCampaignSnapshot();
    const unlockedRank = Math.max(1, Number(c.rank || 1));
    const maxOffer     = Math.min(12, unlockedRank);
    const rows = [];
    for (let r = 1; r <= maxOffer; r++) {
      rows.push(`<button type="button" data-signup-rank="${r}" class="${r === unlockedRank ? "" : "ghost"}">` +
        `Rank ${r}${r === unlockedRank ? " (current)" : ""}</button>`);
    }
    statusEl.textContent = `Unlocked ranks: 1–${maxOffer}. Choose a bracket.`;
    ranksEl.innerHTML    = rows.join("");
    this.ms.selectedSignupRank = unlockedRank;
    this.selectSignupRank(unlockedRank);
    panel.classList.remove("is-hidden");
  }

  hideSignupPanel() {
    const panel = document.getElementById("map-signup-panel");
    if (!panel) return;
    this.ms.selectedSignupRank = null;
    const btn = document.getElementById("map-signup-start");
    if (btn) { btn.disabled = true; btn.textContent = "Start Selected Bout"; }
    const prev = document.getElementById("map-signup-preview");
    if (prev) prev.textContent = "Choose a rank to preview rewards.";
    panel.classList.add("is-hidden");
  }

  selectSignupRank(rank) {
    const c = this.getCampaignSnapshot();
    if (rank < 1 || rank > Math.max(1, Number(c.rank || 1))) return;
    this.ms.selectedSignupRank = rank;

    document.querySelectorAll("[data-signup-rank]").forEach(btn => {
      btn.classList.toggle("is-selected", Number(btn.getAttribute("data-signup-rank")) === rank);
    });

    const preview = document.getElementById("map-signup-preview");
    if (preview) {
      const enemies = Math.min(6, 2 + rank);
      const credits = 65 + (Number(c.rank || 1) + 1) * 20 + rank * 6;
      const xp      = Math.floor((22 + rank * 6 + enemies * 3));
      preview.textContent = `Preview: ~${xp} XP per ally, ~${credits} credits, ${enemies} enemies.`;
    }

    const startBtn = document.getElementById("map-signup-start");
    if (startBtn) { startBtn.disabled = false; startBtn.textContent = `Start Rank ${rank} Bout`; }
  }

  requestRankBattle(rank) {
    const c = this.getCampaignSnapshot();
    if (rank > Math.max(1, Number(c.rank || 1)) || rank < 1) {
      this.setPrompt("That rank is not unlocked yet."); return;
    }
    this.addLog(`Registrar Vonn queued a Rank ${rank} bout.`);
    this.setPrompt(`Registered for Rank ${rank} bout.`);
    window.dispatchEvent(new CustomEvent("jrpg:startBattle", {
      detail: {
        source:      "registrar",
        label:       `Sanctioned Rank ${rank} Bout`,
        rankOffset:  rank - Math.max(1, Number(c.rank || 1)),
        rewardBonus: rank * 6,
        enemyPrefix: "Arena Cohort"
      }
    }));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Contracts / items
  // ──────────────────────────────────────────────────────────────────────────
  markContractAccepted(flagName, logText, promptText) {
    if (this.ms.flags[flagName]) return false;
    this.ms.flags[flagName] = true;
    this.addLog(logText); this.setPrompt(promptText); this.emitMapState();
    return true;
  }

  completeContract(acceptedFlag, completeFlag, logText, promptText, rewardCredits, rewardItemId) {
    if (!this.ms.flags[acceptedFlag] || this.ms.flags[completeFlag]) return false;
    this.ms.flags[completeFlag] = true;
    this.addLog(logText); this.setPrompt(promptText);
    if (Number.isFinite(rewardCredits) && rewardCredits > 0)
      window.dispatchEvent(new CustomEvent("jrpg:grantCredits", { detail: { amount: rewardCredits } }));
    if (rewardItemId)
      window.dispatchEvent(new CustomEvent("jrpg:grantItem",
        { detail: { itemId: rewardItemId, quantity: 1 } }));
    this.emitMapState();
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // UI helpers
  // ──────────────────────────────────────────────────────────────────────────
  setPrompt(text) {
    if (this.hudPromptText) this.hudPromptText.setText(text);
    const el = document.getElementById("map-prompt");
    if (el) el.textContent = text;
  }

  addLog(text) {
    const timestamp = new Date().toLocaleTimeString();
    const list = document.getElementById("map-history-list");
    if (list) list.innerHTML = `<li>[${timestamp}] ${text}</li>${list.innerHTML}`;
  }

  showDialog(speaker, text) {
    if (!this.dialogContainer) return;
    this.dlgSpeaker.setText(speaker);
    this.dlgBody.setText(text);
    this.dlgContinue.setVisible(true);
    this.dialogContainer.setVisible(true);
  }

  hideDialog() {
    if (this.dialogContainer) this.dialogContainer.setVisible(false);
  }

  updateLocationText() {
    if (this.hudSceneText)    this.hudSceneText.setText(`Scene: ${this.sceneLabel || "—"}`);
    if (this.hudPhaseText)    this.hudPhaseText.setText(`Phase: ${this.ms.phase || "day"}`);
    if (this.hudLocationText) this.hudLocationText.setText(`${this.playerTileX}, ${this.playerTileY}`);
    const sceneEl    = document.getElementById("map-scene");
    const phaseEl    = document.getElementById("map-phase");
    const locationEl = document.getElementById("map-location");
    if (sceneEl)    sceneEl.textContent    = this.sceneLabel || "—";
    if (phaseEl)    phaseEl.textContent    = this.ms.phase   || "day";
    if (locationEl) locationEl.textContent = `Position ${this.playerTileX}, ${this.playerTileY}`;
  }

  updateContextPrompt() {
    if (this.ms.inBattle) { this.setPrompt("Battle in progress."); return; }
    const t = this.getFacingTile();
    const hasNpc    = this.mapNpcs.some(n => n.x === t.x && n.y === t.y && this.isNpcActive(n));
    const hasObject = this.mapObjects.some(o => o.x === t.x && o.y === t.y);
    const hasPortal = this.mapPortals.some(p => p.x === t.x && p.y === t.y);
    if (hasNpc || hasObject || hasPortal) {
      this.setPrompt("Press E or Interact to inspect what is ahead."); return;
    }
    this.setPrompt("Move through the district. Skirmishes can occur in contested zones.");
  }

  emitMapState() {
    window.dispatchEvent(new CustomEvent("jrpg:mapState", {
      detail: {
        sceneId:    this.currentSceneId,
        sceneLabel: this.sceneLabel,
        phase:      this.ms.phase,
        flags:      { ...this.ms.flags },
        quests:     this.D.QUEST_LABELS
      }
    }));
  }

  getCampaignSnapshot() {
    if (this.ms.campaignSnapshot) return this.ms.campaignSnapshot;
    const raw = localStorage.getItem(window.JRPG.systems.game.data.SAVE_KEY);
    if (!raw) return { rank: 1, nationId: null, credits: 0, roster: [] };
    try {
      const p = JSON.parse(raw);
      return { rank: Number(p.rank || 1), nationId: p.nationId || null,
        credits: Number(p.credits || 0), roster: Array.isArray(p.roster) ? p.roster : [] };
    } catch { return { rank: 1, nationId: null, credits: 0, roster: [] }; }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Save / Load
  // ──────────────────────────────────────────────────────────────────────────
  saveMapProgress() {
    localStorage.setItem(this.D.MAP_SAVE_KEY, JSON.stringify({
      currentSceneId:   this.currentSceneId,
      player:           { x: this.playerTileX, y: this.playerTileY, facing: this.playerFacing },
      phase:            this.ms.phase,
      phaseStepCounter: this.ms.phaseStepCounter,
      flags:            this.ms.flags,
      openedObjectIds:  Array.from(this.ms.openedObjectIds)
    }));
  }

  loadMapProgress() {
    const raw = localStorage.getItem(
      window.JRPG?.systems?.map?.data?.MAP_SAVE_KEY || "jrpg_map_save_v1"
    );
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Scene cleanup
  // ──────────────────────────────────────────────────────────────────────────
  shutdown() {
    window.removeEventListener("jrpg:battleState",   this.evBattleState);
    window.removeEventListener("jrpg:battleResult",  this.evBattleResult);
    window.removeEventListener("jrpg:campaignState", this.evCampaign);
    window.removeEventListener("jrpg:recruitResult", this.evRecruit);
  }
}
