(function bootstrapApp(globalObject) {
const { ColiseumGameController, database } = globalObject.JRPG.systems.game;
const { WorldMapController } = globalObject.JRPG.systems.map;

function asNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function initializeApp() {
  const root = document;
  const mapPanel  = document.getElementById("map-panel");   // may be null with Phaser
  const gamePanel = document.getElementById("game-panel");  // may be null with Phaser
  const sceneTransition = document.getElementById("scene-transition");
  const sidebar = {
    panel: document.getElementById("sidebar-panel"),
    nation: document.getElementById("sidebar-nation"),
    rank: document.getElementById("sidebar-rank"),
    credits: document.getElementById("sidebar-credits"),
    partyList: document.getElementById("sidebar-party-list"),
    reserveList: document.getElementById("sidebar-reserve-list"),
    questList: document.getElementById("sidebar-quest-list"),
    inventoryList: document.getElementById("sidebar-inventory-list"),
    dbStatus: document.getElementById("db-status"),
    dbJobSelect: document.getElementById("db-job-select"),
    dbJobId: document.getElementById("db-job-id"),
    dbJobLabel: document.getElementById("db-job-label"),
    dbJobSkillId: document.getElementById("db-job-skill-id"),
    dbJobMaxHpMod: document.getElementById("db-job-max-hp-mod"),
    dbJobAttackMod: document.getElementById("db-job-attack-mod"),
    dbJobDefenseMod: document.getElementById("db-job-defense-mod"),
    dbJobSpeedMod: document.getElementById("db-job-speed-mod"),
    dbJobSave: document.getElementById("db-job-save"),
    dbJobDelete: document.getElementById("db-job-delete"),
    dbCharSelect: document.getElementById("db-char-select"),
    dbCharId: document.getElementById("db-char-id"),
    dbCharName: document.getElementById("db-char-name"),
    dbCharLore: document.getElementById("db-char-lore"),
    dbCharJobId: document.getElementById("db-char-job-id"),
    dbCharHp: document.getElementById("db-char-hp"),
    dbCharAttack: document.getElementById("db-char-attack"),
    dbCharDefense: document.getElementById("db-char-defense"),
    dbCharSpeed: document.getElementById("db-char-speed"),
    dbCharLevel: document.getElementById("db-char-level"),
    dbCharExperience: document.getElementById("db-char-experience"),
    dbCharMain: document.getElementById("db-char-main"),
    dbCharSave: document.getElementById("db-char-save"),
    dbCharDelete: document.getElementById("db-char-delete")
  };
  const battleResult = {
    panel: document.getElementById("battle-result-modal"),
    summary: document.getElementById("battle-result-summary"),
    details: document.getElementById("battle-result-details"),
    continueButton: document.getElementById("battle-result-continue")
  };
  const openDatabasePageButton = document.getElementById("open-database-page");
  const databaseModal = document.getElementById("database-modal");
  const closeDatabaseButton = document.getElementById("db-back-to-game");
  const characterStatus = {
    modal: document.getElementById("character-status-modal"),
    name: document.getElementById("character-status-name"),
    subtitle: document.getElementById("character-status-subtitle"),
    body: document.getElementById("character-status-body"),
    closeButton: document.getElementById("character-status-close")
  };
  const hudCollapseState = {
    party: false,
    reserve: false,
    quests: false,
    inventory: false,
    database: true
  };

  const formatItemLabel = (itemId) => String(itemId || "").replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());

  if (!mapPanel && !document.getElementById("phaser-container")) {
    return;
  }

  if (openDatabasePageButton) {
    openDatabasePageButton.addEventListener("click", () => {
      if (databaseModal) {
        databaseModal.classList.remove("is-hidden");
      }
    });
  }

  if (closeDatabaseButton) {
    closeDatabaseButton.addEventListener("click", () => {
      if (databaseModal) {
        databaseModal.classList.add("is-hidden");
      }
    });
  }

  if (databaseModal) {
    databaseModal.addEventListener("click", (event) => {
      if (event.target === databaseModal) {
        databaseModal.classList.add("is-hidden");
      }
    });
  }

  const hudState = {
    campaign: {
      nationId: null,
      nationLabel: "Unaligned",
      rank: 1,
      credits: 0,
      roster: []
    },
    map: {
      flags: {},
      quests: {}
    }
  };
  const battleGate = {
    pending: false,
    detail: null
  };
  const dbUiState = {
    snapshot: null,
    selectedJobId: "",
    selectedCharacterId: ""
  };
  const databaseControlsEnabled = Boolean(sidebar.dbStatus);

  const getInitials = (name) => String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";

  const renderPortraitMarkup = (member) => {
    const initials = getInitials(member.name);
    return member.portraitUrl
      ? `<img class="party-portrait" src="${member.portraitUrl}" alt="${member.name} portrait">`
      : `<div class="party-portrait fallback" aria-label="${member.name} portrait placeholder">${initials}</div>`;
  };

  const hideCharacterStatus = () => {
    if (!characterStatus.modal) {
      return;
    }

    characterStatus.modal.classList.add("is-hidden");
  };

  const showCharacterStatus = (memberId) => {
    if (!characterStatus.modal || !characterStatus.name || !characterStatus.subtitle || !characterStatus.body) {
      return;
    }

    const roster = Array.isArray(hudState.campaign.roster) ? hudState.campaign.roster : [];
    const member = roster.find((entry) => entry.id === memberId);
    if (!member) {
      return;
    }

    const stats = member.stats || {};
    const xpCurrent = Number(member.experience || 0);
    const xpNext = Number(member.nextLevelXp || 0);
    const xpPercent = xpNext > 0 ? Math.max(0, Math.min(100, Math.round((xpCurrent / xpNext) * 100))) : 0;
    const equipment = member.equipment || {};
    const equippedItems = Object.entries(equipment)
      .filter(([, itemId]) => Boolean(itemId))
      .map(([slot, itemId]) => `<p><strong>${slot}</strong> ${formatItemLabel(itemId)}</p>`)
      .join("");
    const portraitMarkup = member.portraitUrl
      ? `<img class="character-status-portrait" src="${member.portraitUrl}" alt="${member.name} portrait">`
      : `<div class="character-status-portrait fallback" aria-label="${member.name} portrait placeholder">${getInitials(member.name)}</div>`;

    characterStatus.name.textContent = member.name;
    characterStatus.subtitle.textContent = `${member.jobLabel || member.jobId} | Lv ${member.level}`;
    characterStatus.body.innerHTML = `<div class="character-status-grid">
      ${portraitMarkup}
      <div class="character-status-lines">
        <p><strong>HP</strong> ${stats.maxHp || "-"}</p>
        <p><strong>ATK</strong> ${stats.attack || "-"}</p>
        <p><strong>DEF</strong> ${stats.defense || "-"}</p>
        <p><strong>SPD</strong> ${stats.speed || "-"}</p>
        <p><strong>Bond</strong> ${member.bond || 0}</p>
        <p><strong>XP</strong> ${xpCurrent}/${xpNext || "-"} (${xpPercent}%)</p>
        <p><strong>Status</strong> ${member.inParty ? "In Party" : "Reserve"}</p>
        ${equippedItems || "<p><strong>Equipment</strong> None</p>"}
      </div>
    </div>
    <p>${member.lore || "No lore recorded."}</p>`;

    characterStatus.modal.classList.remove("is-hidden");
  };

  const renderHud = () => {
    if (!sidebar.panel) {
      return;
    }

    const campaign = hudState.campaign;
    const mapState = hudState.map;
    const roster = Array.isArray(campaign.roster) ? campaign.roster : [];
    const party = roster.filter((member) => member.inParty);
    const reserve = roster.filter((member) => member.recruited && !member.inParty);

    if (sidebar.nation) {
      sidebar.nation.textContent = `Nation: ${campaign.nationLabel || "Unaligned"}`;
    }
    if (sidebar.rank) {
      sidebar.rank.textContent = String(campaign.rank || 1);
    }
    if (sidebar.credits) {
      sidebar.credits.textContent = String(campaign.credits || 0);
    }

    if (sidebar.partyList) {
      if (party.length === 0) {
        sidebar.partyList.innerHTML = "<li>No active party members.</li>";
      } else {
        sidebar.partyList.innerHTML = party
          .map((member) => {
            const xpText = typeof member.experience === "number" && typeof member.nextLevelXp === "number"
              ? ` | XP ${member.experience}/${member.nextLevelXp}`
              : "";
            const currentMainId = globalObject.JRPG.systems.game.data.MAIN_CHARACTER.id;
            const removeButton = member.id === currentMainId
              ? ""
              : `<div class=\"mini-actions\"><button type=\"button\" data-action=\"remove\" data-member-id=\"${member.id}\">Remove</button></div>`;
            return `<li class="character-open" data-action="status" data-member-id="${member.id}">
              ${renderPortraitMarkup(member)}
              <strong>${member.name}</strong> Lv ${member.level} ${member.jobLabel || member.jobId}${xpText}<br>
              ${member.lore || "Ready for deployment."}
              ${removeButton}
            </li>`;
          })
          .join("");
      }
    }

    if (sidebar.reserveList) {
      if (reserve.length === 0) {
        sidebar.reserveList.innerHTML = "<li>No reserve members.</li>";
      } else {
        sidebar.reserveList.innerHTML = reserve
          .map((member) => {
            return `<li class="character-open" data-action="status" data-member-id="${member.id}">
              ${renderPortraitMarkup(member)}
              <strong>${member.name}</strong> Lv ${member.level} ${member.jobLabel || member.jobId} | XP ${member.experience || 0}/${member.nextLevelXp || "-"}<br>
              ${member.lore}
              <div class=\"mini-actions\"><button type=\"button\" data-action=\"add\" data-member-id=\"${member.id}\">Add To Party</button></div>
            </li>`;
          })
          .join("");
      }
    }

    if (sidebar.questList) {
      const questEntries = Object.entries(mapState.quests || {});
      if (questEntries.length === 0) {
        sidebar.questList.innerHTML = "<li>No active quest notes.</li>";
      } else {
        sidebar.questList.innerHTML = questEntries
          .map(([questKey, label]) => {
            const doneFromFlags = Boolean(mapState.flags?.[questKey]);
            const doneFromRoster = questKey.startsWith("recruit_")
              ? roster.some((member) => member.id === questKey && member.recruited)
              : false;
            const done = doneFromFlags || doneFromRoster;
            return `<li>${done ? "[Done]" : "[Open]"} ${label}</li>`;
          })
          .join("");
      }
    }

    if (sidebar.inventoryList) {
      const inventory = Array.isArray(campaign.inventory) ? campaign.inventory : [];
      if (inventory.length === 0) {
        sidebar.inventoryList.innerHTML = "<li>No stored supplies yet.</li>";
      } else {
        const counts = inventory.reduce((summary, itemId) => {
          const key = String(itemId || "");
          summary[key] = (summary[key] || 0) + 1;
          return summary;
        }, {});

        sidebar.inventoryList.innerHTML = Object.entries(counts)
          .map(([itemId, quantity]) => `<li><strong>${formatItemLabel(itemId)}</strong> x${quantity}</li>`)
          .join("");
      }
    }
  };

  const renderHudCollapse = () => {
    if (!sidebar.panel) {
      return;
    }

    Object.keys(hudCollapseState).forEach((sectionKey) => {
      const isCollapsed = Boolean(hudCollapseState[sectionKey]);
      const section = sidebar.panel.querySelector(`[data-hud-section="${sectionKey}"]`);
      const toggle = sidebar.panel.querySelector(`[data-hud-toggle="${sectionKey}"]`);

      if (section) {
        section.classList.toggle("collapsed", isCollapsed);
      }
      if (toggle) {
        toggle.setAttribute("aria-expanded", String(!isCollapsed));
      }
    });
  };

  const setDbStatus = (text) => {
    if (sidebar.dbStatus) {
      sidebar.dbStatus.textContent = text;
    }
  };

  const renderBattleResult = (detail) => {
    if (!battleResult.panel || !battleResult.summary || !battleResult.details) {
      return;
    }

    if (!detail) {
      battleResult.summary.textContent = "Result pending.";
      battleResult.details.innerHTML = "<li>No details.</li>";
      return;
    }

    const summaryText = detail.victory
      ? `Victory in ${detail.label}`
      : `Defeat in ${detail.label}`;
    battleResult.summary.textContent = summaryText;

    const rows = [];
    if (typeof detail.rank === "number") {
      rows.push(`<li>Current Rank: ${detail.rank}</li>`);
    }
    if (typeof detail.creditReward === "number") {
      rows.push(`<li>Credits Gained: ${detail.creditReward}</li>`);
    }
    if (typeof detail.xpReward === "number") {
      rows.push(`<li>XP Per Deployed Ally: ${detail.xpReward}</li>`);
    }
    if (Array.isArray(detail.levelUps) && detail.levelUps.length > 0) {
      rows.push(`<li>Party Levels: ${detail.levelUps.map((entry) => `${entry.name} Lv ${entry.level}`).join(" | ")}</li>`);
    }
    if (rows.length === 0) {
      rows.push("<li>No rewards earned this match.</li>");
    }

    battleResult.details.innerHTML = rows.join("");
  };

  const showBattleResult = (detail) => {
    if (!battleResult.panel) {
      return;
    }

    renderBattleResult(detail);
    battleResult.panel.classList.remove("is-hidden");
  };

  const hideBattleResult = () => {
    if (!battleResult.panel) {
      return;
    }

    battleResult.panel.classList.add("is-hidden");
  };

  const getSelectedJobFromSnapshot = () => {
    const snapshot = dbUiState.snapshot;
    if (!snapshot || !Array.isArray(snapshot.jobs) || snapshot.jobs.length === 0) {
      return null;
    }

    const selected = snapshot.jobs.find((entry) => entry.id === dbUiState.selectedJobId);
    return selected || snapshot.jobs[0];
  };

  const getSelectedCharacterFromSnapshot = () => {
    const snapshot = dbUiState.snapshot;
    if (!snapshot || !Array.isArray(snapshot.characters) || snapshot.characters.length === 0) {
      return null;
    }

    const selected = snapshot.characters.find((entry) => entry.id === dbUiState.selectedCharacterId);
    return selected || snapshot.characters[0];
  };

  const renderDatabaseEditor = () => {
    const snapshot = dbUiState.snapshot;
    if (!snapshot) {
      return;
    }

    if (sidebar.dbJobSelect) {
      sidebar.dbJobSelect.innerHTML = snapshot.jobs
        .map((job) => `<option value="${job.id}">${job.label} (${job.id})</option>`)
        .join("");
    }

    if (sidebar.dbJobSkillId) {
      sidebar.dbJobSkillId.innerHTML = snapshot.skills
        .map((skill) => `<option value="${skill.id}">${skill.name} (${skill.id})</option>`)
        .join("");
    }

    if (sidebar.dbCharSelect) {
      sidebar.dbCharSelect.innerHTML = snapshot.characters
        .map((character) => `<option value="${character.id}">${character.name} (${character.id})</option>`)
        .join("");
    }

    if (sidebar.dbCharJobId) {
      sidebar.dbCharJobId.innerHTML = snapshot.jobs
        .map((job) => `<option value="${job.id}">${job.label}</option>`)
        .join("");
    }

    const selectedJob = getSelectedJobFromSnapshot();
    if (selectedJob) {
      dbUiState.selectedJobId = selectedJob.id;
      if (sidebar.dbJobSelect) sidebar.dbJobSelect.value = selectedJob.id;
      if (sidebar.dbJobId) sidebar.dbJobId.value = selectedJob.id;
      if (sidebar.dbJobLabel) sidebar.dbJobLabel.value = selectedJob.label;
      if (sidebar.dbJobSkillId) sidebar.dbJobSkillId.value = selectedJob.skillId || snapshot.skills[0]?.id || "";
      if (sidebar.dbJobMaxHpMod) sidebar.dbJobMaxHpMod.value = String(selectedJob.maxHpMod);
      if (sidebar.dbJobAttackMod) sidebar.dbJobAttackMod.value = String(selectedJob.attackMod);
      if (sidebar.dbJobDefenseMod) sidebar.dbJobDefenseMod.value = String(selectedJob.defenseMod);
      if (sidebar.dbJobSpeedMod) sidebar.dbJobSpeedMod.value = String(selectedJob.speedMod);
    }

    const selectedCharacter = getSelectedCharacterFromSnapshot();
    if (selectedCharacter) {
      dbUiState.selectedCharacterId = selectedCharacter.id;
      if (sidebar.dbCharSelect) sidebar.dbCharSelect.value = selectedCharacter.id;
      if (sidebar.dbCharId) sidebar.dbCharId.value = selectedCharacter.id;
      if (sidebar.dbCharName) sidebar.dbCharName.value = selectedCharacter.name;
      if (sidebar.dbCharLore) sidebar.dbCharLore.value = selectedCharacter.lore || "";
      if (sidebar.dbCharJobId) sidebar.dbCharJobId.value = selectedCharacter.jobId;
      if (sidebar.dbCharHp) sidebar.dbCharHp.value = String(selectedCharacter.baseStats?.maxHp || 100);
      if (sidebar.dbCharAttack) sidebar.dbCharAttack.value = String(selectedCharacter.baseStats?.attack || 12);
      if (sidebar.dbCharDefense) sidebar.dbCharDefense.value = String(selectedCharacter.baseStats?.defense || 10);
      if (sidebar.dbCharSpeed) sidebar.dbCharSpeed.value = String(selectedCharacter.baseStats?.speed || 10);
      if (sidebar.dbCharLevel) sidebar.dbCharLevel.value = String(selectedCharacter.level || 1);
      if (sidebar.dbCharExperience) sidebar.dbCharExperience.value = String(selectedCharacter.experience || 0);
      if (sidebar.dbCharMain) sidebar.dbCharMain.checked = selectedCharacter.id === snapshot.mainCharacterId;
    }
  };

  const updateDatabaseSnapshot = (snapshot) => {
    dbUiState.snapshot = snapshot;

    if (!dbUiState.selectedJobId && Array.isArray(snapshot.jobs) && snapshot.jobs.length > 0) {
      dbUiState.selectedJobId = snapshot.jobs[0].id;
    }
    if (!dbUiState.selectedCharacterId && Array.isArray(snapshot.characters) && snapshot.characters.length > 0) {
      dbUiState.selectedCharacterId = snapshot.characters[0].id;
    }

    renderDatabaseEditor();
  };

  if (sidebar.panel) {
    sidebar.panel.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const actionSource = target.closest("[data-action][data-member-id]");
      const action = actionSource?.getAttribute("data-action") || "";
      const memberId = actionSource?.getAttribute("data-member-id") || "";

      const toggleSection = target.getAttribute("data-hud-toggle");
      if (toggleSection && Object.prototype.hasOwnProperty.call(hudCollapseState, toggleSection)) {
        hudCollapseState[toggleSection] = !hudCollapseState[toggleSection];
        renderHudCollapse();
        return;
      }

      if (!action || !memberId) {
        return;
      }

      if (action === "status") {
        showCharacterStatus(memberId);
      } else if (action === "remove") {
        window.dispatchEvent(new CustomEvent("jrpg:partyRemoveRequest", { detail: { memberId } }));
      } else if (action === "add") {
        window.dispatchEvent(new CustomEvent("jrpg:partyAddRequest", { detail: { memberId } }));
      }
    });
  }

  if (characterStatus.closeButton) {
    characterStatus.closeButton.addEventListener("click", () => {
      hideCharacterStatus();
    });
  }

  if (characterStatus.modal) {
    characterStatus.modal.addEventListener("click", (event) => {
      if (event.target === characterStatus.modal) {
        hideCharacterStatus();
      }
    });
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideCharacterStatus();
    }
  });

  if (battleResult.continueButton) {
    battleResult.continueButton.addEventListener("click", () => {
      if (!battleGate.pending) {
        return;
      }

      battleGate.pending = false;
      battleGate.detail = null;
      hideBattleResult();
      window.dispatchEvent(new CustomEvent("jrpg:battleState", { detail: { active: false } }));
    });
  }

  if (sidebar.dbJobSelect && databaseControlsEnabled) {
    sidebar.dbJobSelect.addEventListener("change", () => {
      dbUiState.selectedJobId = sidebar.dbJobSelect.value;
      renderDatabaseEditor();
    });
  }

  if (sidebar.dbCharSelect && databaseControlsEnabled) {
    sidebar.dbCharSelect.addEventListener("change", () => {
      dbUiState.selectedCharacterId = sidebar.dbCharSelect.value;
      renderDatabaseEditor();
    });
  }

  if (sidebar.dbJobSave && database && databaseControlsEnabled) {
    sidebar.dbJobSave.addEventListener("click", () => {
      const jobId = String(sidebar.dbJobId?.value || "").trim();
      if (!jobId) {
        setDbStatus("Job id is required.");
        return;
      }

      const result = database.upsertJob({
        id: jobId,
        label: String(sidebar.dbJobLabel?.value || jobId).trim(),
        maxHpMod: asNumber(sidebar.dbJobMaxHpMod?.value, 1),
        attackMod: asNumber(sidebar.dbJobAttackMod?.value, 1),
        defenseMod: asNumber(sidebar.dbJobDefenseMod?.value, 1),
        speedMod: asNumber(sidebar.dbJobSpeedMod?.value, 1),
        skill: (() => {
          const selectedSkillId = String(sidebar.dbJobSkillId?.value || "").trim();
          const selectedSkill = dbUiState.snapshot?.skills?.find((skill) => skill.id === selectedSkillId)
            || dbUiState.snapshot?.skills?.[0]
            || null;

          return {
            id: selectedSkill?.id || `${jobId}_skill`,
            name: selectedSkill?.name || "Skill",
            power: Number(selectedSkill?.power || 1.1),
            cost: Math.max(0, Math.floor(Number(selectedSkill?.cost || 8))),
            iconUrl: String(selectedSkill?.iconUrl || "").trim()
          };
        })()
      });

      if (!result.ok) {
        setDbStatus(`Could not save job: ${result.reason}.`);
        return;
      }

      dbUiState.selectedJobId = jobId;
      setDbStatus(`Job ${jobId} saved.`);
    });
  }

  if (sidebar.dbJobDelete && database && databaseControlsEnabled) {
    sidebar.dbJobDelete.addEventListener("click", () => {
      const jobId = String(sidebar.dbJobId?.value || "").trim();
      const result = database.deleteJob(jobId);
      if (!result.ok) {
        setDbStatus(`Could not delete job: ${result.reason}.`);
        return;
      }

      setDbStatus(`Job ${jobId} deleted.`);
    });
  }

  if (sidebar.dbCharSave && database && databaseControlsEnabled) {
    sidebar.dbCharSave.addEventListener("click", () => {
      const characterId = String(sidebar.dbCharId?.value || "").trim();
      if (!characterId) {
        setDbStatus("Character id is required.");
        return;
      }

      const existingCharacter = dbUiState.snapshot?.characters?.find((entry) => entry.id === characterId) || null;
      const isMainSelection = Boolean(sidebar.dbCharMain?.checked);

      const result = database.upsertCharacter({
        id: characterId,
        name: String(sidebar.dbCharName?.value || characterId).trim(),
        lore: String(sidebar.dbCharLore?.value || "").trim(),
        jobId: String(sidebar.dbCharJobId?.value || "vanguard").trim(),
        level: Math.max(1, Math.floor(asNumber(sidebar.dbCharLevel?.value, 1))),
        experience: Math.max(0, Math.floor(asNumber(sidebar.dbCharExperience?.value, 0))),
        baseStats: {
          maxHp: Math.max(1, Math.floor(asNumber(sidebar.dbCharHp?.value, 100))),
          attack: Math.max(1, Math.floor(asNumber(sidebar.dbCharAttack?.value, 12))),
          defense: Math.max(1, Math.floor(asNumber(sidebar.dbCharDefense?.value, 10))),
          speed: Math.max(1, Math.floor(asNumber(sidebar.dbCharSpeed?.value, 10)))
        },
        recruited: isMainSelection ? true : Boolean(existingCharacter?.recruited),
        inParty: isMainSelection ? true : Boolean(existingCharacter?.inParty),
        isMain: isMainSelection
      });

      if (!result.ok) {
        setDbStatus(`Could not save character: ${result.reason}.`);
        return;
      }

      dbUiState.selectedCharacterId = characterId;
      setDbStatus(`Character ${characterId} saved.`);
    });
  }

  if (sidebar.dbCharDelete && database && databaseControlsEnabled) {
    sidebar.dbCharDelete.addEventListener("click", () => {
      const characterId = String(sidebar.dbCharId?.value || "").trim();
      const result = database.deleteCharacter(characterId);
      if (!result.ok) {
        setDbStatus(`Could not delete character: ${result.reason}.`);
        return;
      }

      setDbStatus(`Character ${characterId} deleted.`);
    });
  }

  if (ColiseumGameController) {
    // ColiseumGameController is superseded by CampaignService + Phaser scenes.
  }

  if (WorldMapController) {
    // WorldMapController is superseded by MapScene (Phaser).
  }

  // Initialise campaign service
  const { CampaignService } = window.JRPG.systems.campaign;
  const campaignService = new CampaignService();
  campaignService.initialize();
  window.JRPG.systems.activeCampaign = campaignService;

  window.addEventListener("jrpg:battleFinished", (event) => {
    const detail = event.detail || {};
    battleGate.pending = true;
    battleGate.detail  = detail;
    showBattleResult(detail);
  });

  window.addEventListener("jrpg:battleState", (event) => {
    const detail = event.detail || {};
    if (!detail.active && battleGate.pending) {
      // battle ended — result shown by BattleScene; hide result overlay if still open
    }
  });

  window.addEventListener("jrpg:campaignState", (event) => {
    const detail = event.detail || {};
    hudState.campaign = {
      nationId: detail.nationId || null,
      nationLabel: detail.nationLabel || "Unaligned",
      rank: Number(detail.rank || 1),
      credits: Number(detail.credits || 0),
      inventory: Array.isArray(detail.inventory) ? detail.inventory : [],
      roster: Array.isArray(detail.roster) ? detail.roster : []
    };
    renderHud();
  });

  window.addEventListener("jrpg:mapState", (event) => {
    const detail = event.detail || {};
    hudState.map = {
      flags: detail.flags || {},
      quests: detail.quests || {}
    };
    renderHud();
  });

  window.addEventListener("jrpg:entityDbUpdated", (event) => {
    const detail = event.detail || null;
    if (detail && databaseControlsEnabled) {
      updateDatabaseSnapshot(detail);
    }
  });

  renderHud();
  renderHudCollapse();

  if (databaseControlsEnabled && database && typeof database.getSnapshot === "function") {
    updateDatabaseSnapshot(database.getSnapshot());
    setDbStatus("Database loaded.");
  }
}

initializeApp();
})(window);
