(function bootstrapDatabasePage(globalObject) {
const { database } = globalObject.JRPG.systems.game;

function asNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function byId(id) {
  return document.getElementById(id);
}

function initialize() {
  const elements = {
    status: byId("db-page-status"),
    skillSelect: byId("db-skill-select"),
    skillId: byId("db-skill-id"),
    skillName: byId("db-skill-name"),
    skillPower: byId("db-skill-power"),
    skillCost: byId("db-skill-cost"),
    skillIcon: byId("db-skill-icon"),
    skillNew: byId("db-skill-new"),
    skillSave: byId("db-skill-save"),
    skillDelete: byId("db-skill-delete"),
    jobSelect: byId("db-job-select"),
    jobId: byId("db-job-id"),
    jobLabel: byId("db-job-label"),
    jobSkillId: byId("db-job-skill-id"),
    jobMaxHpMod: byId("db-job-max-hp-mod"),
    jobAttackMod: byId("db-job-attack-mod"),
    jobDefenseMod: byId("db-job-defense-mod"),
    jobSpeedMod: byId("db-job-speed-mod"),
    jobIcon: byId("db-job-icon"),
    jobNew: byId("db-job-new"),
    jobSave: byId("db-job-save"),
    jobDelete: byId("db-job-delete"),
    charSelect: byId("db-char-select"),
    charId: byId("db-char-id"),
    charName: byId("db-char-name"),
    charLore: byId("db-char-lore"),
    charJobId: byId("db-char-job-id"),
    charPortrait: byId("db-char-portrait"),
    charHp: byId("db-char-hp"),
    charAttack: byId("db-char-attack"),
    charDefense: byId("db-char-defense"),
    charSpeed: byId("db-char-speed"),
    charLevel: byId("db-char-level"),
    charExperience: byId("db-char-experience"),
    charMain: byId("db-char-main"),
    charRecruited: byId("db-char-recruited"),
    charInParty: byId("db-char-in-party"),
    charNew: byId("db-char-new"),
    charSave: byId("db-char-save"),
    charDelete: byId("db-char-delete"),
    backToGame: byId("db-back-to-game")
  };

  if (!database || !elements.status) {
    return;
  }

  if (elements.backToGame) {
    elements.backToGame.addEventListener("click", () => {
      const modal = document.getElementById("database-modal");
      if (modal) {
        modal.classList.add("is-hidden");
        return;
      }

      elements.status.textContent = "Open index.html directly in a new editor tab.";
    });
  }

  const uiState = {
    snapshot: database.getSnapshot(),
    selectedSkillId: "",
    selectedJobId: "",
    selectedCharacterId: "",
    creatingSkill: false,
    creatingJob: false,
    creatingCharacter: false
  };

  const setStatus = (text) => {
    elements.status.textContent = text;
  };

  const getSelected = (list, selectedId) => {
    if (!Array.isArray(list) || list.length === 0) {
      return null;
    }

    const selected = list.find((entry) => entry.id === selectedId);
    return selected || list[0];
  };

  const render = () => {
    const snapshot = uiState.snapshot;
    if (!snapshot) {
      return;
    }

    elements.skillSelect.innerHTML = snapshot.skills
      .map((skill) => `<option value="${skill.id}">${skill.name} (${skill.id})</option>`)
      .join("");

    elements.jobSelect.innerHTML = snapshot.jobs
      .map((job) => `<option value="${job.id}">${job.label} (${job.id})</option>`)
      .join("");

    elements.charSelect.innerHTML = snapshot.characters
      .map((character) => `<option value="${character.id}">${character.name} (${character.id})</option>`)
      .join("");

    elements.jobSkillId.innerHTML = snapshot.skills
      .map((skill) => `<option value="${skill.id}">${skill.name}</option>`)
      .join("");

    elements.charJobId.innerHTML = snapshot.jobs
      .map((job) => `<option value="${job.id}">${job.label}</option>`)
      .join("");

    const skill = getSelected(snapshot.skills, uiState.selectedSkillId);
    const job = getSelected(snapshot.jobs, uiState.selectedJobId);
    const character = getSelected(snapshot.characters, uiState.selectedCharacterId);

    if (uiState.creatingSkill) {
      elements.skillSelect.value = "";
      elements.skillId.value = "";
      elements.skillName.value = "";
      elements.skillPower.value = "1.1";
      elements.skillCost.value = "8";
      elements.skillIcon.value = "";
    } else if (skill) {
      uiState.selectedSkillId = skill.id;
      elements.skillSelect.value = skill.id;
      elements.skillId.value = skill.id;
      elements.skillName.value = skill.name;
      elements.skillPower.value = String(skill.power);
      elements.skillCost.value = String(skill.cost);
      elements.skillIcon.value = skill.iconUrl || "";
    }

    if (uiState.creatingJob) {
      elements.jobSelect.value = "";
      elements.jobId.value = "";
      elements.jobLabel.value = "";
      elements.jobSkillId.value = snapshot.skills[0]?.id || "";
      elements.jobMaxHpMod.value = "1";
      elements.jobAttackMod.value = "1";
      elements.jobDefenseMod.value = "1";
      elements.jobSpeedMod.value = "1";
      elements.jobIcon.value = "";
    } else if (job) {
      uiState.selectedJobId = job.id;
      elements.jobSelect.value = job.id;
      elements.jobId.value = job.id;
      elements.jobLabel.value = job.label;
      elements.jobSkillId.value = job.skillId;
      elements.jobMaxHpMod.value = String(job.maxHpMod);
      elements.jobAttackMod.value = String(job.attackMod);
      elements.jobDefenseMod.value = String(job.defenseMod);
      elements.jobSpeedMod.value = String(job.speedMod);
      elements.jobIcon.value = job.iconUrl || "";
    }

    if (uiState.creatingCharacter) {
      elements.charSelect.value = "";
      elements.charId.value = "";
      elements.charName.value = "";
      elements.charLore.value = "";
      elements.charJobId.value = snapshot.jobs[0]?.id || "";
      elements.charPortrait.value = "";
      elements.charHp.value = "100";
      elements.charAttack.value = "12";
      elements.charDefense.value = "10";
      elements.charSpeed.value = "10";
      elements.charLevel.value = "1";
      elements.charExperience.value = "0";
      elements.charMain.checked = false;
      elements.charRecruited.checked = false;
      elements.charInParty.checked = false;
    } else if (character) {
      uiState.selectedCharacterId = character.id;
      elements.charSelect.value = character.id;
      elements.charId.value = character.id;
      elements.charName.value = character.name;
      elements.charLore.value = character.lore || "";
      elements.charJobId.value = character.jobId;
      elements.charPortrait.value = character.portraitUrl || "";
      elements.charHp.value = String(character.baseStats.maxHp);
      elements.charAttack.value = String(character.baseStats.attack);
      elements.charDefense.value = String(character.baseStats.defense);
      elements.charSpeed.value = String(character.baseStats.speed);
      elements.charLevel.value = String(character.level);
      elements.charExperience.value = String(character.experience || 0);
      elements.charMain.checked = character.id === snapshot.mainCharacterId;
      elements.charRecruited.checked = Boolean(character.recruited);
      elements.charInParty.checked = Boolean(character.inParty);
    }
  };

  elements.skillSelect.addEventListener("change", () => {
    uiState.creatingSkill = false;
    uiState.selectedSkillId = elements.skillSelect.value;
    render();
  });

  elements.jobSelect.addEventListener("change", () => {
    uiState.creatingJob = false;
    uiState.selectedJobId = elements.jobSelect.value;
    render();
  });

  elements.charSelect.addEventListener("change", () => {
    uiState.creatingCharacter = false;
    uiState.selectedCharacterId = elements.charSelect.value;
    render();
  });

  elements.skillNew.addEventListener("click", () => {
    uiState.creatingSkill = true;
    uiState.selectedSkillId = "";
    render();
    elements.skillId.focus();
    setStatus("Creating a new skill. Enter a new Skill Id, then Save Skill.");
  });

  elements.jobNew.addEventListener("click", () => {
    uiState.creatingJob = true;
    uiState.selectedJobId = "";
    render();
    elements.jobId.focus();
    setStatus("Creating a new job. Enter a new Job Id, then Save Job.");
  });

  elements.charNew.addEventListener("click", () => {
    uiState.creatingCharacter = true;
    uiState.selectedCharacterId = "";
    render();
    elements.charId.focus();
    setStatus("Creating a new character. Enter a new Character Id, then Save Character.");
  });

  elements.skillSave.addEventListener("click", () => {
    const skillId = String(elements.skillId.value || "").trim();
    if (!skillId) {
      setStatus("Skill id is required.");
      return;
    }

    const result = database.upsertSkill({
      id: skillId,
      name: String(elements.skillName.value || skillId).trim(),
      power: asNumber(elements.skillPower.value, 1.1),
      cost: Math.max(0, Math.floor(asNumber(elements.skillCost.value, 8))),
      iconUrl: String(elements.skillIcon.value || "").trim()
    });

    if (!result.ok) {
      setStatus(`Could not save skill: ${result.reason}.`);
      return;
    }

    uiState.selectedSkillId = skillId;
    uiState.creatingSkill = false;
    setStatus(`Skill ${skillId} saved.`);
  });

  elements.skillDelete.addEventListener("click", () => {
    const skillId = String(elements.skillId.value || "").trim();
    const result = database.deleteSkill(skillId);
    if (!result.ok) {
      setStatus(`Could not delete skill: ${result.reason}.`);
      return;
    }

    setStatus(`Skill ${skillId} deleted.`);
  });

  elements.jobSave.addEventListener("click", () => {
    const jobId = String(elements.jobId.value || "").trim();
    if (!jobId) {
      setStatus("Job id is required.");
      return;
    }

    const result = database.upsertJob({
      id: jobId,
      label: String(elements.jobLabel.value || jobId).trim(),
      skillId: String(elements.jobSkillId.value || "").trim(),
      iconUrl: String(elements.jobIcon.value || "").trim(),
      maxHpMod: asNumber(elements.jobMaxHpMod.value, 1),
      attackMod: asNumber(elements.jobAttackMod.value, 1),
      defenseMod: asNumber(elements.jobDefenseMod.value, 1),
      speedMod: asNumber(elements.jobSpeedMod.value, 1)
    });

    if (!result.ok) {
      setStatus(`Could not save job: ${result.reason}.`);
      return;
    }

    uiState.selectedJobId = jobId;
    uiState.creatingJob = false;
    setStatus(`Job ${jobId} saved.`);
  });

  elements.jobDelete.addEventListener("click", () => {
    const jobId = String(elements.jobId.value || "").trim();
    const result = database.deleteJob(jobId);
    if (!result.ok) {
      setStatus(`Could not delete job: ${result.reason}.`);
      return;
    }

    setStatus(`Job ${jobId} deleted.`);
  });

  elements.charSave.addEventListener("click", () => {
    const characterId = String(elements.charId.value || "").trim();
    if (!characterId) {
      setStatus("Character id is required.");
      return;
    }

    const result = database.upsertCharacter({
      id: characterId,
      name: String(elements.charName.value || characterId).trim(),
      lore: String(elements.charLore.value || "").trim(),
      portraitUrl: String(elements.charPortrait.value || "").trim(),
      jobId: String(elements.charJobId.value || "").trim(),
      level: Math.max(1, Math.floor(asNumber(elements.charLevel.value, 1))),
      experience: Math.max(0, Math.floor(asNumber(elements.charExperience.value, 0))),
      baseStats: {
        maxHp: Math.max(1, Math.floor(asNumber(elements.charHp.value, 100))),
        attack: Math.max(1, Math.floor(asNumber(elements.charAttack.value, 12))),
        defense: Math.max(1, Math.floor(asNumber(elements.charDefense.value, 10))),
        speed: Math.max(1, Math.floor(asNumber(elements.charSpeed.value, 10)))
      },
      recruited: Boolean(elements.charRecruited.checked),
      inParty: Boolean(elements.charInParty.checked),
      isMain: Boolean(elements.charMain.checked)
    });

    if (!result.ok) {
      setStatus(`Could not save character: ${result.reason}.`);
      return;
    }

    uiState.selectedCharacterId = characterId;
    uiState.creatingCharacter = false;
    setStatus(`Character ${characterId} saved.`);
  });

  elements.charDelete.addEventListener("click", () => {
    const characterId = String(elements.charId.value || "").trim();
    const result = database.deleteCharacter(characterId);
    if (!result.ok) {
      setStatus(`Could not delete character: ${result.reason}.`);
      return;
    }

    setStatus(`Character ${characterId} deleted.`);
  });

  window.addEventListener("jrpg:entityDbUpdated", (event) => {
    uiState.snapshot = event.detail || database.getSnapshot();

    if (!uiState.creatingSkill && !uiState.snapshot.skills.some((entry) => entry.id === uiState.selectedSkillId)) {
      uiState.selectedSkillId = uiState.snapshot.skills[0]?.id || "";
    }
    if (!uiState.creatingJob && !uiState.snapshot.jobs.some((entry) => entry.id === uiState.selectedJobId)) {
      uiState.selectedJobId = uiState.snapshot.jobs[0]?.id || "";
    }
    if (!uiState.creatingCharacter && !uiState.snapshot.characters.some((entry) => entry.id === uiState.selectedCharacterId)) {
      uiState.selectedCharacterId = uiState.snapshot.characters[0]?.id || "";
    }

    render();
  });

  uiState.snapshot = database.getSnapshot();
  setStatus("Database loaded.");
  render();
}

initialize();
})(window);
