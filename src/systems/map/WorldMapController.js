(function registerWorldMapController(globalObject) {
const {
  ENCOUNTER_ZONES,
  MAP_SAVE_KEY,
  NPC_ARCHETYPES,
  OBJECT_ARCHETYPES,
  PORTAL_LINKS,
  QUEST_LABELS,
  TILE_COLORS,
  TILE_SIZE,
  VIEWPORT_TILES,
  WORLD_SCENES
} = globalObject.JRPG.systems.map.data;
const CAMPAIGN_SAVE_KEY = globalObject.JRPG.systems.game.data.SAVE_KEY;
const PREVIEW_XP_SCALE = 1;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

class WorldMapController {
  constructor({ root }) {
    this.root = root;

    this.state = {
      tiles: [],
      width: 0,
      height: 0,
      player: { x: 1, y: 1, facing: "down" },
      currentSceneId: "district",
      sceneLabel: "Mercenary District",
      phase: "day",
      phaseStepCounter: 0,
      npcs: [],
      objects: [],
      portals: [],
      openedObjectIds: new Set(),
      blocked: new Set(),
      keysDown: new Set(),
      moveIntervalMs: 130,
      lastMoveAt: 0,
      running: false,
      inBattle: false,
      encounterCooldownSteps: 0,
      campaignSnapshot: null,
      flags: {
        captainWarningHeard: false,
        observerContractSeen: false,
        observerContractAccepted: false
      }
    };

    this.elements = {
      panel: root.querySelector("#map-panel"),
      canvas: root.querySelector("#map-canvas"),
      scene: root.querySelector("#map-scene"),
      phase: root.querySelector("#map-phase"),
      location: root.querySelector("#map-location"),
      prompt: root.querySelector("#map-prompt"),
      interactButton: root.querySelector("#map-interact"),
      interactionLog: root.querySelector("#map-log"),
      historyButton: root.querySelector("#map-history-btn"),
      historyModal: root.querySelector("#map-history-modal"),
      historyClose: root.querySelector("#map-history-close"),
      historyList: root.querySelector("#map-history-list"),
      dialogBox: root.querySelector("#map-dialog-box"),
      dialogSpeaker: root.querySelector("#map-dialog-speaker"),
      dialogText: root.querySelector("#map-dialog-text"),
      dialogClose: root.querySelector("#map-dialog-close"),
      signupPanel: root.querySelector("#map-signup-panel"),
      signupStatus: root.querySelector("#map-signup-status"),
      signupRanks: root.querySelector("#map-signup-ranks"),
      signupPreview: root.querySelector("#map-signup-preview"),
      signupStart: root.querySelector("#map-signup-start"),
      signupClose: root.querySelector("#map-signup-close")
    };

    this.loopId = null;
    this.onBattleStateChange = null;
    this.onBattleResult = null;
    this.onCampaignState = null;
    this.onRecruitResult = null;
    this.onSignupBattleRequest = null;
    this.selectedSignupRank = null;
  }

  initialize() {
    if (!this.elements.panel || !this.elements.canvas) {
      return;
    }

    this.loadMapProgress();
    this.buildSceneState(this.state.currentSceneId, null);
    this.configureCanvas();
    this.bindInputs();
    this.state.running = true;
    this.render();
    this.loop();
    this.setPrompt("Move with WASD/Arrow keys. Press E or Interact near NPCs and objects.");
    this.emitMapState();
  }

  loadMapProgress() {
    const raw = localStorage.getItem(MAP_SAVE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (parsed.player && Number.isInteger(parsed.player.x) && Number.isInteger(parsed.player.y)) {
        this.state.player.x = parsed.player.x;
        this.state.player.y = parsed.player.y;
        this.state.player.facing = parsed.player.facing || "down";
      }

      if (typeof parsed.currentSceneId === "string" && WORLD_SCENES[parsed.currentSceneId]) {
        this.state.currentSceneId = parsed.currentSceneId;
      }

      if (parsed.phase === "day" || parsed.phase === "night") {
        this.state.phase = parsed.phase;
      }

      if (Number.isInteger(parsed.phaseStepCounter)) {
        this.state.phaseStepCounter = parsed.phaseStepCounter;
      }

      if (parsed.flags && typeof parsed.flags === "object") {
        this.state.flags = {
          ...this.state.flags,
          ...parsed.flags
        };
      }

      this.state.openedObjectIds = new Set(Array.isArray(parsed.openedObjectIds) ? parsed.openedObjectIds : []);
    } catch {
      this.addLog("Map save data was unreadable and has been ignored.");
    }
  }

  saveMapProgress() {
    const openedObjectIds = Array.from(this.state.openedObjectIds);
    const payload = {
      currentSceneId: this.state.currentSceneId,
      player: this.state.player,
      phase: this.state.phase,
      phaseStepCounter: this.state.phaseStepCounter,
      flags: this.state.flags,
      openedObjectIds
    };

    localStorage.setItem(MAP_SAVE_KEY, JSON.stringify(payload));
  }

  getCampaignSnapshot() {
    if (this.state.campaignSnapshot !== null) {
      return this.state.campaignSnapshot;
    }

    const raw = localStorage.getItem(CAMPAIGN_SAVE_KEY);
    if (!raw) {
      return { rank: 1, nationId: null, credits: 0, roster: [] };
    }

    try {
      const parsed = JSON.parse(raw);
      return {
        rank: Number(parsed.rank || 1),
        nationId: parsed.nationId || null,
        credits: Number(parsed.credits || 0),
        roster: Array.isArray(parsed.roster) ? parsed.roster : []
      };
    } catch {
      return { rank: 1, nationId: null, credits: 0, roster: [] };
    }
  }

  emitMapState() {
    window.dispatchEvent(
      new CustomEvent("jrpg:mapState", {
        detail: {
          sceneId: this.state.currentSceneId,
          sceneLabel: this.state.sceneLabel,
          phase: this.state.phase,
          flags: { ...this.state.flags },
          quests: QUEST_LABELS
        }
      })
    );
  }

  getPortalKey(symbol, sceneId) {
    if (sceneId === "district") {
      return symbol;
    }

    return `${symbol}_${sceneId}`;
  }

  buildSceneState(sceneId, spawnId) {
    const scene = WORLD_SCENES[sceneId] || WORLD_SCENES.district;
    const tiles = [];
    const blocked = new Set();
    const npcs = [];
    const objects = [];
    const portals = [];

    const template = scene.template;
    const height = template.length;
    const width = template[0].length;
    let hasExplicitSpawn = false;

    for (let y = 0; y < height; y += 1) {
      const row = [];
      for (let x = 0; x < width; x += 1) {
        const symbol = template[y][x];
        let tileType = "floor";

        if (symbol === "#") {
          tileType = "wall";
          blocked.add(`${x},${y}`);
        } else if (symbol === "~") {
          tileType = "water";
          blocked.add(`${x},${y}`);
        } else if (symbol === "@") {
          if (!spawnId) {
            this.state.player.x = x;
            this.state.player.y = y;
            hasExplicitSpawn = true;
          }
        } else if (NPC_ARCHETYPES[symbol]) {
          npcs.push({
            id: `${scene.id}_${NPC_ARCHETYPES[symbol].id}_${x}_${y}`,
            archetypeKey: symbol,
            x,
            y,
            dialogueIndex: 0
          });
          blocked.add(`${x},${y}`);
        } else if (OBJECT_ARCHETYPES[symbol]) {
          const objectId = `${scene.id}_${OBJECT_ARCHETYPES[symbol].id}_${x}_${y}`;
          objects.push({
            id: objectId,
            archetypeKey: symbol,
            x,
            y,
            opened: this.state.openedObjectIds.has(objectId)
          });
          blocked.add(`${x},${y}`);
        } else if (/^[0-9]$/.test(symbol)) {
          const portalKey = this.getPortalKey(symbol, scene.id);
          const portal = PORTAL_LINKS[portalKey];
          if (portal) {
            portals.push({
              x,
              y,
              ...portal
            });
            tileType = "floor";
          }
        }

        row.push(tileType);
      }
      tiles.push(row);
    }

    if (spawnId && scene.spawns?.[spawnId]) {
      this.state.player.x = scene.spawns[spawnId].x;
      this.state.player.y = scene.spawns[spawnId].y;
      this.state.player.facing = scene.spawns[spawnId].facing || "down";
    } else if (!hasExplicitSpawn && scene.spawns?.entry) {
      this.state.player.x = scene.spawns.entry.x;
      this.state.player.y = scene.spawns.entry.y;
      this.state.player.facing = scene.spawns.entry.facing || "down";
    }

    this.state.currentSceneId = scene.id;
    this.state.sceneLabel = scene.label;
    this.state.tiles = tiles;
    this.state.width = width;
    this.state.height = height;
    this.state.blocked = blocked;
    this.state.npcs = npcs;
    this.state.objects = objects;
    this.state.portals = portals;
  }

  isNpcActive(npc) {
    const archetype = NPC_ARCHETYPES[npc.archetypeKey];
    if (!archetype) {
      return false;
    }

    const schedule = Array.isArray(archetype.schedule) ? archetype.schedule : ["day", "night"];
    return schedule.includes(this.state.phase);
  }

  stepTimeCycle() {
    this.state.phaseStepCounter += 1;
    if (this.state.phaseStepCounter < 48) {
      return;
    }

    this.state.phaseStepCounter = 0;
    this.state.phase = this.state.phase === "day" ? "night" : "day";
    this.addLog(`The district shifts to ${this.state.phase}.`);
    this.emitMapState();
  }

  trySceneTransition() {
    const portal = this.state.portals.find(
      (entry) => entry.x === this.state.player.x && entry.y === this.state.player.y
    );

    if (!portal) {
      return;
    }

    this.buildSceneState(portal.toSceneId, portal.toSpawnId);
    this.setPrompt(portal.label);
    this.addLog(portal.label);
    this.emitMapState();
  }

  configureCanvas() {
    const width = VIEWPORT_TILES.width * TILE_SIZE;
    const height = VIEWPORT_TILES.height * TILE_SIZE;
    this.elements.canvas.width = width;
    this.elements.canvas.height = height;
  }

  bindInputs() {
    window.addEventListener("keydown", (event) => {
      const target = event.target;
      const isTypingTarget = target instanceof HTMLElement
        && (
          target.tagName === "INPUT"
          || target.tagName === "TEXTAREA"
          || target.tagName === "SELECT"
          || target.isContentEditable
        );

      if (isTypingTarget) {
        return;
      }

      const key = event.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", "e"].includes(key)) {
        event.preventDefault();
      }

      if (key === "e") {
        this.tryInteract();
        return;
      }

      this.state.keysDown.add(key);
    });

    window.addEventListener("keyup", (event) => {
      const target = event.target;
      const isTypingTarget = target instanceof HTMLElement
        && (
          target.tagName === "INPUT"
          || target.tagName === "TEXTAREA"
          || target.tagName === "SELECT"
          || target.isContentEditable
        );

      if (isTypingTarget) {
        return;
      }

      this.state.keysDown.delete(event.key.toLowerCase());
    });

    this.elements.interactButton.addEventListener("click", () => {
      this.tryInteract();
    });

    if (this.elements.historyButton) {
      this.elements.historyButton.addEventListener("click", () => {
        this.elements.historyModal.classList.toggle("is-visible");
      });
    }

    if (this.elements.historyClose) {
      this.elements.historyClose.addEventListener("click", () => {
        this.elements.historyModal.classList.remove("is-visible");
      });
    }

    if (this.elements.dialogClose) {
      this.elements.dialogClose.addEventListener("click", () => {
        this.hideDialog();
      });
    }

    this.bindTouchControls();

    if (this.elements.signupRanks) {
      this.elements.signupRanks.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const rankValue = target.getAttribute("data-signup-rank");
        if (!rankValue) {
          return;
        }

        const rank = Number(rankValue);
        if (!Number.isFinite(rank)) {
          return;
        }

        this.selectSignupRank(rank);
      });
    }

    if (this.elements.signupStart) {
      this.elements.signupStart.addEventListener("click", () => {
        if (!Number.isFinite(this.selectedSignupRank)) {
          return;
        }

        this.requestRankBattle(this.selectedSignupRank);
      });
    }

    if (this.elements.signupClose) {
      this.elements.signupClose.addEventListener("click", () => {
        this.hideSignupPanel();
      });
    }

    this.onBattleStateChange = (event) => {
      const detail = event.detail || {};
      this.state.inBattle = Boolean(detail.active);
      if (this.state.inBattle) {
        this.setPrompt("Battle in progress. Resolve the fight in the Coliseum panel.");
      }
    };

    this.onBattleResult = (event) => {
      const detail = event.detail || {};
      if (detail.source !== "map" && detail.source !== "registrar") {
        return;
      }

      if (detail.victory) {
        this.addLog(`${detail.label}: You prevailed and returned to the district.`);
      } else {
        this.addLog(`${detail.label}: Your squad retreated to regroup.`);
      }

      this.state.encounterCooldownSteps = 12;
      this.hideSignupPanel();
      this.saveMapProgress();
      this.updateContextPrompt();
    };

    this.onCampaignState = (event) => {
      const detail = event.detail || {};
      this.state.campaignSnapshot = {
        rank: Number(detail.rank || 1),
        nationId: detail.nationId || null,
        credits: Number(detail.credits || 0),
        roster: Array.isArray(detail.roster) ? detail.roster : []
      };
      this.emitMapState();
    };

    this.onRecruitResult = (event) => {
      const detail = event.detail || {};
      if (detail.ok) {
        this.state.flags[detail.memberId] = true;
        this.addLog(`${detail.memberName} agreed to join your company.`);
      } else if (detail.reason === "already-recruited") {
        this.addLog(`${detail.memberName} is already part of your roster.`);
      }

      this.saveMapProgress();
      this.emitMapState();
    };

    window.addEventListener("jrpg:battleState", this.onBattleStateChange);
    window.addEventListener("jrpg:battleResult", this.onBattleResult);
    window.addEventListener("jrpg:campaignState", this.onCampaignState);
    window.addEventListener("jrpg:recruitResult", this.onRecruitResult);
  }

  showSignupPanel() {
    if (!this.elements.signupPanel || !this.elements.signupRanks || !this.elements.signupStatus) {
      return;
    }

    const campaign = this.getCampaignSnapshot();
    const unlockedRank = Math.max(1, Number(campaign.rank || 1));
    const maxOffer = Math.min(12, unlockedRank);
    const rows = [];

    for (let rank = 1; rank <= maxOffer; rank += 1) {
      const isCurrent = rank === unlockedRank;
      rows.push(
        `<button type="button" data-signup-rank="${rank}" class="${isCurrent ? "" : "ghost"}">Rank ${rank}${isCurrent ? " (current)" : ""}</button>`
      );
    }

    this.elements.signupStatus.textContent = `Unlocked ranks: 1-${maxOffer}. Choose a bracket to start an official bout.`;
    this.elements.signupRanks.innerHTML = rows.join("");
    this.selectedSignupRank = unlockedRank;
    this.selectSignupRank(unlockedRank);
    this.elements.signupPanel.classList.remove("is-hidden");
  }

  getSignupPreview(targetRank) {
    const campaign = this.getCampaignSnapshot();
    const unlockedRank = Math.max(1, Number(campaign.rank || 1));
    const encounterRank = targetRank;
    const enemyCount = clamp(2 + encounterRank, 2, 6);
    const rewardBonus = targetRank * 6;
    const predictedCredits = 65 + (unlockedRank + 1) * 20 + rewardBonus;
    const predictedXpEach = Math.floor((22 + encounterRank * 6 + enemyCount * 3) * PREVIEW_XP_SCALE);

    return {
      encounterRank,
      enemyCount,
      predictedCredits,
      predictedXpEach
    };
  }

  selectSignupRank(rank) {
    const campaign = this.getCampaignSnapshot();
    const unlockedRank = Math.max(1, Number(campaign.rank || 1));
    if (rank < 1 || rank > unlockedRank) {
      return;
    }

    this.selectedSignupRank = rank;

    if (this.elements.signupRanks) {
      this.elements.signupRanks.querySelectorAll("[data-signup-rank]").forEach((button) => {
        const isSelected = Number(button.getAttribute("data-signup-rank")) === rank;
        button.classList.toggle("is-selected", isSelected);
      });
    }

    const preview = this.getSignupPreview(rank);
    if (this.elements.signupPreview) {
      this.elements.signupPreview.textContent =
        `Preview: ~${preview.predictedXpEach} XP per deployed ally, ~${preview.predictedCredits} credits on victory, ${preview.enemyCount} enemies.`;
    }

    if (this.elements.signupStart) {
      this.elements.signupStart.disabled = false;
      this.elements.signupStart.textContent = `Start Rank ${rank} Bout`;
    }
  }

  hideSignupPanel() {
    if (!this.elements.signupPanel) {
      return;
    }

    this.selectedSignupRank = null;
    if (this.elements.signupStart) {
      this.elements.signupStart.disabled = true;
      this.elements.signupStart.textContent = "Start Selected Bout";
    }
    if (this.elements.signupPreview) {
      this.elements.signupPreview.textContent = "Choose a rank to preview rewards.";
    }
    this.elements.signupPanel.classList.add("is-hidden");
  }

  requestRankBattle(targetRank) {
    const campaign = this.getCampaignSnapshot();
    const unlockedRank = Math.max(1, Number(campaign.rank || 1));

    if (targetRank > unlockedRank || targetRank < 1) {
      this.setPrompt("That rank is not unlocked yet.");
      return;
    }

    const rankOffset = targetRank - unlockedRank;
    const rewardBonus = targetRank * 6;
    this.addLog(`Registrar Vonn queued a Rank ${targetRank} sanctioned bout.`);
    this.setPrompt(`Registered for Rank ${targetRank} bout.`);

    window.dispatchEvent(
      new CustomEvent("jrpg:startBattle", {
        detail: {
          source: "registrar",
          label: `Sanctioned Rank ${targetRank} Bout`,
          rankOffset,
          rewardBonus,
          enemyPrefix: "Arena Cohort"
        }
      })
    );
  }

  bindTouchControls() {
    const dpadKeyMap = { up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright" };

    const dpadButtons = this.root
      ? Array.from(this.root.querySelectorAll(".dpad-btn[data-dpad]"))
      : [];

    dpadButtons.forEach((btn) => {
      const direction = btn.getAttribute("data-dpad");

      const press = (event) => {
        event.preventDefault();
        if (direction === "interact") {
          this.tryInteract();
          return;
        }
        const key = dpadKeyMap[direction];
        if (key) {
          btn.classList.add("is-pressed");
          this.state.keysDown.add(key);
        }
      };

      const release = () => {
        const key = dpadKeyMap[direction];
        if (key) {
          btn.classList.remove("is-pressed");
          this.state.keysDown.delete(key);
        }
      };

      btn.addEventListener("pointerdown", press);
      btn.addEventListener("pointerup", release);
      btn.addEventListener("pointerleave", release);
      btn.addEventListener("pointercancel", release);
    });

    if (!this.elements.canvas) {
      return;
    }

    let swipeStartX = 0;
    let swipeStartY = 0;

    this.elements.canvas.addEventListener("touchstart", (event) => {
      const touch = event.touches[0];
      swipeStartX = touch.clientX;
      swipeStartY = touch.clientY;
    }, { passive: true });

    this.elements.canvas.addEventListener("touchend", (event) => {
      const touch = event.changedTouches[0];
      const dx = touch.clientX - swipeStartX;
      const dy = touch.clientY - swipeStartY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const threshold = 24;

      if (absX < threshold && absY < threshold) {
        return;
      }

      if (absX >= absY) {
        this.attemptStep(dx > 0 ? 1 : -1, 0, dx > 0 ? "right" : "left");
      } else {
        this.attemptStep(0, dy > 0 ? 1 : -1, dy > 0 ? "down" : "up");
      }
    }, { passive: true });
  }

  loop() {
    if (!this.state.running) {
      return;
    }

    const now = performance.now();
    if (now - this.state.lastMoveAt >= this.state.moveIntervalMs) {
      if (this.processMovementInput()) {
        this.state.lastMoveAt = now;
      }
    }

    this.render();
    this.loopId = window.requestAnimationFrame(() => this.loop());
  }

  processMovementInput() {
    if (this.state.inBattle) {
      return false;
    }

    const movementOrder = [
      { keys: ["arrowup", "w"], dx: 0, dy: -1, facing: "up" },
      { keys: ["arrowdown", "s"], dx: 0, dy: 1, facing: "down" },
      { keys: ["arrowleft", "a"], dx: -1, dy: 0, facing: "left" },
      { keys: ["arrowright", "d"], dx: 1, dy: 0, facing: "right" }
    ];

    for (const move of movementOrder) {
      if (move.keys.some((key) => this.state.keysDown.has(key))) {
        return this.attemptStep(move.dx, move.dy, move.facing);
      }
    }

    return false;
  }

  attemptStep(dx, dy, facing) {
    this.state.player.facing = facing;

    const nextX = this.state.player.x + dx;
    const nextY = this.state.player.y + dy;
    const key = `${nextX},${nextY}`;

    if (
      nextX < 0 ||
      nextY < 0 ||
      nextX >= this.state.width ||
      nextY >= this.state.height ||
      this.state.blocked.has(key)
    ) {
      this.setPrompt("Blocked path. Try another direction or interact nearby.");
      return true;
    }

    this.state.player.x = nextX;
    this.state.player.y = nextY;
    this.stepTimeCycle();
    if (this.state.encounterCooldownSteps > 0) {
      this.state.encounterCooldownSteps -= 1;
    }
    this.trySceneTransition();
    this.updateLocationText();
    this.updateContextPrompt();
    this.maybeTriggerEncounter();
    this.saveMapProgress();
    return true;
  }

  maybeTriggerEncounter() {
    if (this.state.inBattle) {
      return;
    }

    if (this.state.encounterCooldownSteps > 0) {
      return;
    }

    const x = this.state.player.x;
    const y = this.state.player.y;
    const activeZone = ENCOUNTER_ZONES.find(
      (zone) =>
        zone.sceneId === this.state.currentSceneId &&
        x >= zone.x1 &&
        x <= zone.x2 &&
        y >= zone.y1 &&
        y <= zone.y2
    );

    if (!activeZone) {
      return;
    }

    const roll = Math.random();
    if (roll > activeZone.chancePerStep) {
      return;
    }

    this.state.encounterCooldownSteps = 18;
    this.setPrompt(`Encounter triggered: ${activeZone.encounter.label}`);
    this.addLog(`Encounter: ${activeZone.encounter.label}`);

    window.dispatchEvent(
      new CustomEvent("jrpg:startBattle", {
        detail: {
          source: "map",
          label: activeZone.encounter.label,
          rankOffset: activeZone.encounter.rankOffset,
          rewardBonus: activeZone.encounter.rewardBonus,
          enemyPrefix: activeZone.encounter.enemyPrefix
        }
      })
    );
  }

  getFacingTile() {
    const { x, y, facing } = this.state.player;
    if (facing === "up") {
      return { x, y: y - 1 };
    }
    if (facing === "down") {
      return { x, y: y + 1 };
    }
    if (facing === "left") {
      return { x: x - 1, y };
    }
    return { x: x + 1, y };
  }

  tryInteract() {
    if (this.state.inBattle) {
      this.setPrompt("Finish the current battle before interacting.");
      return;
    }

    const campaign = this.getCampaignSnapshot();

    const target = this.getFacingTile();
    const npc = this.state.npcs.find(
      (entry) => entry.x === target.x && entry.y === target.y && this.isNpcActive(entry)
    );
    if (npc) {
      const archetype = NPC_ARCHETYPES[npc.archetypeKey];
      const line = this.resolveNpcDialogue(npc, archetype);
      npc.dialogueIndex += 1;
      this.addLog(`${archetype.name}: ${line}`);
      this.setPrompt(`Talking to ${archetype.name}.`);
      this.showDialog(archetype.name, line);

      if (archetype.id === "supply_broker" && campaign.nationId === "orinth") {
        this.markContractAccepted(
          "orinth_contract_accepted",
          "Orinth cargo route accepted from the broker.",
          "Orinth contract accepted. Recover the cargo cache next."
        );
      }

      if (archetype.id === "retired_captain" && campaign.nationId === "valmere") {
        this.markContractAccepted(
          "valmere_contract_accepted",
          "Valmere salvage request accepted from the captain.",
          "Valmere contract accepted. Recover the field cache next."
        );
      }

      if (archetype.registrar) {
        this.state.flags.spoke_registrar = true;

        if (campaign.nationId === "cindrel") {
          this.completeContract(
            "cindrel_contract_accepted",
            "cindrel_contract_complete",
            "Cindrel dispatch returned to the registrar.",
            "Cindrel contract completed.",
            55,
            "iron_longsword"
          );
        }

        this.showSignupPanel();
        this.emitMapState();
        this.saveMapProgress();
        return;
      }

      this.tryRecruitFromNpc(archetype);
      this.saveMapProgress();
      return;
    }

    const object = this.state.objects.find((entry) => entry.x === target.x && entry.y === target.y);
    if (object) {
      const archetype = OBJECT_ARCHETYPES[object.archetypeKey];
      if (archetype.oneTime && object.opened) {
        this.addLog(`${archetype.name}: Nothing left here.`);
        this.setPrompt("This object has already been used.");
        return;
      }

      this.handleObjectInteraction(object, archetype);
      this.saveMapProgress();
      return;
    }

    this.setPrompt("There is nothing to interact with in front of you.");
    this.hideSignupPanel();
  }

  updateLocationText() {
    if (this.elements.scene) {
      this.elements.scene.textContent = this.state.sceneLabel;
    }

    if (this.elements.phase) {
      this.elements.phase.textContent = this.state.phase;
    }

    this.elements.location.textContent = `Position ${this.state.player.x}, ${this.state.player.y}`;
  }

  updateContextPrompt() {
    if (this.state.inBattle) {
      this.setPrompt("Battle in progress. Resolve combat before exploring further.");
      return;
    }

    const target = this.getFacingTile();
    const hasNpc = this.state.npcs.some(
      (entry) => entry.x === target.x && entry.y === target.y && this.isNpcActive(entry)
    );
    const hasObject = this.state.objects.some((entry) => entry.x === target.x && entry.y === target.y);
    const hasPortal = this.state.portals.some((entry) => entry.x === target.x && entry.y === target.y);

    if (hasNpc || hasObject || hasPortal) {
      this.setPrompt("Press E or Interact to inspect what is ahead.");
      return;
    }

    this.setPrompt("Move through the district. Skirmishes can occur in contested zones.");
  }

  resolveNpcDialogue(npc, archetype) {
    const campaign = this.getCampaignSnapshot();
    const isRecruited = Array.isArray(campaign.roster)
      ? campaign.roster.some((member) => member.id === archetype.recruitId && member.recruited)
      : false;

    if (archetype.recruitId && isRecruited) {
      return "I am already on your roster. Check the left HUD to set party position.";
    }

    if (archetype.id === "retired_captain" && !this.state.flags.captainWarningHeard) {
      this.state.flags.captainWarningHeard = true;
      this.emitMapState();
      return "I have seen every banner call itself righteous. Keep your own conscience.";
    }

    if (archetype.id === "supply_broker" && this.state.flags.observerContractAccepted) {
      return "Observer contracts are live. Patrols are nervous, so stock up before heading out.";
    }

    if (archetype.id === "supply_broker" && campaign.nationId === "orinth" && !this.state.flags.orinth_contract_accepted) {
      return "Orinth needs clean routes and quiet hands. We can talk business after the greeting.";
    }

    if (archetype.id === "retired_captain" && campaign.nationId === "valmere" && !this.state.flags.valmere_contract_accepted) {
      return "Valmere still remembers old routes. If you can recover one cache, I will vouch for you.";
    }

    if (archetype.id === "arena_scout" && campaign.nationId === "cindrel" && !this.state.flags.cindrel_contract_accepted) {
      return "Cindrel wants order, but their paperwork still needs people who can move fast.";
    }

    if (archetype.id === "guild_quartermaster" && campaign.nationId) {
      return "Your chosen banner is drawing attention. Keep your party equipped and discreet.";
    }

    if (archetype.id === "arena_scout" && campaign.rank >= 3) {
      return "Rank three already? Commanders will start sending private offers soon.";
    }

    return archetype.dialogues[npc.dialogueIndex % archetype.dialogues.length];
  }

  tryRecruitFromNpc(archetype) {
    if (!archetype.recruitId) {
      return;
    }

    const campaign = this.getCampaignSnapshot();
    const alreadyRecruited = Array.isArray(campaign.roster)
      ? campaign.roster.some((member) => member.id === archetype.recruitId && member.recruited)
      : false;

    if (alreadyRecruited) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent("jrpg:recruitRequest", {
        detail: {
          source: "map",
          memberId: archetype.recruitId
        }
      })
    );

    this.setPrompt(`Recruitment terms offered to ${archetype.name}.`);
  }

  grantItem(itemId, quantity, message) {
    const count = Math.max(1, Number(quantity || 1));
    window.dispatchEvent(
      new CustomEvent("jrpg:grantItem", {
        detail: {
          itemId,
          quantity: count,
          message: message || `Received ${itemId}.`
        }
      })
    );
  }

  markContractAccepted(flagName, logText, promptText) {
    if (this.state.flags[flagName]) {
      return false;
    }

    this.state.flags[flagName] = true;
    this.addLog(logText);
    this.setPrompt(promptText);
    this.emitMapState();
    return true;
  }

  completeContract(acceptedFlag, completeFlag, logText, promptText, rewardCredits, rewardItemId) {
    if (!this.state.flags[acceptedFlag] || this.state.flags[completeFlag]) {
      return false;
    }

    this.state.flags[completeFlag] = true;
    this.addLog(logText);
    this.setPrompt(promptText);
    if (Number.isFinite(rewardCredits) && rewardCredits > 0) {
      window.dispatchEvent(new CustomEvent("jrpg:grantCredits", { detail: { amount: rewardCredits } }));
    }
    if (rewardItemId) {
      this.grantItem(rewardItemId, 1, `Recovered ${rewardItemId.replace(/_/g, " ")}.`);
    }
    this.emitMapState();
    return true;
  }

  handleObjectInteraction(object, archetype) {
    const campaign = this.getCampaignSnapshot();

    if (archetype.id === "supply_cache") {
      object.opened = true;
      this.addLog(`${archetype.name}: ${archetype.interactionText}`);
      window.dispatchEvent(new CustomEvent("jrpg:grantCredits", { detail: { amount: 20 } }));
      this.grantItem("field_kit", 1, "Received a field kit.");

      if (campaign.nationId === "orinth") {
        this.completeContract(
          "orinth_contract_accepted",
          "orinth_contract_complete",
          "Orinth cargo routes are now secured.",
          "Orinth contract completed.",
          45,
          "signal_charm"
        );
      }
      this.setPrompt(`Recovered supplies from ${archetype.name}.`);
      return;
    }

    if (archetype.id === "notice_board") {
      this.state.flags.observerContractSeen = true;
      this.addLog(`${archetype.name}: ${archetype.interactionText}`);
      if (campaign.nationId === "cindrel") {
        this.markContractAccepted(
          "cindrel_contract_accepted",
          "Cindrel dispatch accepted from the board.",
          "Cindrel contract accepted. Report to the registrar next."
        );
      } else {
        this.setPrompt("A new contract thread has been noted.");
      }
      this.emitMapState();
      return;
    }

    if (archetype.id === "training_gate") {
      if (campaign.nationId === "valmere" && this.state.flags.valmere_contract_accepted && !this.state.flags.valmere_contract_complete) {
        this.completeContract(
          "valmere_contract_accepted",
          "valmere_contract_complete",
          "Valmere salvage request completed.",
          "Valmere contract completed.",
          60,
          "duelist_blade"
        );
        return;
      }

      if (campaign.rank < 3) {
        this.addLog(`${archetype.name}: Locked. Reach Coliseum rank 3 first.`);
        this.setPrompt("Gate remains closed.");
        return;
      }

      if (!this.state.flags.observerContractSeen) {
        this.addLog(`${archetype.name}: You need contract clearance from the notice board.`);
        this.setPrompt("Missing contract clearance.");
        return;
      }
      this.state.flags.observerContractAccepted = true;
      this.addLog(`${archetype.name}: Contract accepted. Military observer route unlocked.`);
      this.setPrompt("Observer contract accepted.");
      this.emitMapState();
      return;
    }

    if (archetype.id === "battle_registrar" && campaign.nationId === "cindrel" && this.state.flags.cindrel_contract_accepted && !this.state.flags.cindrel_contract_complete) {
      this.completeContract(
        "cindrel_contract_accepted",
        "cindrel_contract_complete",
        "Cindrel dispatch returned to the registrar.",
        "Cindrel contract completed.",
        55,
        "iron_longsword"
      );
      return;
    }

    object.opened = true;
    this.addLog(`${archetype.name}: ${archetype.interactionText}`);
    this.setPrompt(`Interacted with ${archetype.name}.`);
  }

  setPrompt(text) {
    this.elements.prompt.textContent = text;
  }

  addLog(text) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `<li>[${timestamp}] ${text}</li>`;
    if (this.elements.historyList) {
      this.elements.historyList.innerHTML = entry + this.elements.historyList.innerHTML;
    }
  }

  showDialog(speaker, text) {
    if (!this.elements.dialogBox) {
      return;
    }
    this.elements.dialogSpeaker.textContent = speaker;
    this.elements.dialogText.textContent = text;
    this.elements.dialogBox.classList.add("is-visible");
  }

  hideDialog() {
    if (!this.elements.dialogBox) {
      return;
    }
    this.elements.dialogBox.classList.remove("is-visible");
  }

  getCamera() {
    const halfW = Math.floor(VIEWPORT_TILES.width / 2);
    const halfH = Math.floor(VIEWPORT_TILES.height / 2);

    const maxX = this.state.width - VIEWPORT_TILES.width;
    const maxY = this.state.height - VIEWPORT_TILES.height;

    return {
      x: clamp(this.state.player.x - halfW, 0, Math.max(0, maxX)),
      y: clamp(this.state.player.y - halfH, 0, Math.max(0, maxY))
    };
  }

  render() {
    const ctx = this.elements.canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const cam = this.getCamera();
    const startX = cam.x;
    const startY = cam.y;

    ctx.clearRect(0, 0, this.elements.canvas.width, this.elements.canvas.height);

    for (let vy = 0; vy < VIEWPORT_TILES.height; vy += 1) {
      for (let vx = 0; vx < VIEWPORT_TILES.width; vx += 1) {
        const mapX = startX + vx;
        const mapY = startY + vy;
        const tile = this.state.tiles[mapY]?.[mapX] || "floor";

        const px = vx * TILE_SIZE;
        const py = vy * TILE_SIZE;

        if (tile === "wall") {
          ctx.fillStyle = TILE_COLORS.wall;
        } else if (tile === "water") {
          ctx.fillStyle = TILE_COLORS.water;
        } else {
          ctx.fillStyle = TILE_COLORS.floor;
        }

        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        ctx.strokeStyle = TILE_COLORS.grid;
        ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }

    this.state.objects.forEach((object) => {
      const screenX = (object.x - startX) * TILE_SIZE;
      const screenY = (object.y - startY) * TILE_SIZE;

      if (
        screenX < 0 ||
        screenY < 0 ||
        screenX >= this.elements.canvas.width ||
        screenY >= this.elements.canvas.height
      ) {
        return;
      }

      ctx.fillStyle = object.opened ? "#8d7e64" : TILE_COLORS.object;
      ctx.fillRect(screenX + 6, screenY + 6, TILE_SIZE - 12, TILE_SIZE - 12);
    });

    this.state.portals.forEach((portal) => {
      const screenX = (portal.x - startX) * TILE_SIZE;
      const screenY = (portal.y - startY) * TILE_SIZE;

      if (
        screenX < 0 ||
        screenY < 0 ||
        screenX >= this.elements.canvas.width ||
        screenY >= this.elements.canvas.height
      ) {
        return;
      }

      ctx.fillStyle = TILE_COLORS.portal;
      ctx.fillRect(screenX + 10, screenY + 10, TILE_SIZE - 20, TILE_SIZE - 20);
    });

    this.state.npcs.forEach((npc) => {
      if (!this.isNpcActive(npc)) {
        return;
      }

      const screenX = (npc.x - startX) * TILE_SIZE;
      const screenY = (npc.y - startY) * TILE_SIZE;

      if (
        screenX < 0 ||
        screenY < 0 ||
        screenX >= this.elements.canvas.width ||
        screenY >= this.elements.canvas.height
      ) {
        return;
      }

      ctx.fillStyle = TILE_COLORS.npc;
      ctx.beginPath();
      ctx.arc(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
      ctx.fill();
    });

    const playerX = (this.state.player.x - startX) * TILE_SIZE;
    const playerY = (this.state.player.y - startY) * TILE_SIZE;

    ctx.fillStyle = TILE_COLORS.player;
    ctx.fillRect(playerX + 7, playerY + 7, TILE_SIZE - 14, TILE_SIZE - 14);

    ctx.fillStyle = TILE_COLORS.shadow;
    if (this.state.player.facing === "up") {
      ctx.fillRect(playerX + 12, playerY + 2, TILE_SIZE - 24, 6);
    } else if (this.state.player.facing === "down") {
      ctx.fillRect(playerX + 12, playerY + TILE_SIZE - 8, TILE_SIZE - 24, 6);
    } else if (this.state.player.facing === "left") {
      ctx.fillRect(playerX + 2, playerY + 12, 6, TILE_SIZE - 24);
    } else {
      ctx.fillRect(playerX + TILE_SIZE - 8, playerY + 12, 6, TILE_SIZE - 24);
    }

    this.updateLocationText();
  }
}

globalObject.JRPG.systems.map.WorldMapController = WorldMapController;
})(window);
