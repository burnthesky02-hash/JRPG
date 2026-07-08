(function registerEntityDatabase(globalObject) {
const gameData = globalObject.JRPG.systems.game.data;
const DB_KEY = "jrpg_entity_db_v2";

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toJobArray(jobsObject) {
  return Object.values(jobsObject || {}).map((job) => deepClone(job));
}

function normalizeSkill(raw) {
  const id = String(raw.id || "").trim();
  return {
    id,
    name: String(raw.name || id || "Skill").trim(),
    power: Number(raw.power || 1.1),
    cost: Math.max(0, Number(raw.cost || 8)),
    iconUrl: String(raw.iconUrl || "").trim()
  };
}

function normalizeJob(raw, fallbackSkillId) {
  const id = String(raw.id || "").trim();
  const skillId = String(raw.skillId || raw.skill?.id || fallbackSkillId || "").trim();
  return {
    id,
    label: String(raw.label || id || "Unnamed Job").trim(),
    iconUrl: String(raw.iconUrl || "").trim(),
    maxHpMod: Number(raw.maxHpMod || 1),
    attackMod: Number(raw.attackMod || 1),
    defenseMod: Number(raw.defenseMod || 1),
    speedMod: Number(raw.speedMod || 1),
    skillId
  };
}

function normalizeCharacter(raw, fallbackJobId) {
  const id = String(raw.id || "").trim();
  const equipment = raw.equipment && typeof raw.equipment === "object" ? raw.equipment : {};
  return {
    id,
    name: String(raw.name || id || "Unnamed").trim(),
    portraitUrl: String(raw.portraitUrl || "").trim(),
    lore: String(raw.lore || "").trim(),
    level: Math.max(1, Number(raw.level || 1)),
    bond: Math.max(0, Number(raw.bond || 0)),
    experience: Math.max(0, Number(raw.experience || 0)),
    baseStats: {
      maxHp: Math.max(1, Number(raw.baseStats?.maxHp || 100)),
      attack: Math.max(1, Number(raw.baseStats?.attack || 12)),
      defense: Math.max(1, Number(raw.baseStats?.defense || 10)),
      speed: Math.max(1, Number(raw.baseStats?.speed || 10))
    },
    jobId: String(raw.jobId || fallbackJobId || "vanguard").trim(),
    equipment: {
      weapon: String(equipment.weapon || "").trim(),
      armor: String(equipment.armor || "").trim(),
      accessory: String(equipment.accessory || "").trim()
    },
    recruited: Boolean(raw.recruited),
    inParty: Boolean(raw.inParty),
    isMain: Boolean(raw.isMain)
  };
}

function buildDefaultSnapshot() {
  const defaultJobs = toJobArray(gameData.JOBS);
  const defaultSkills = defaultJobs
    .map((job) => normalizeSkill(job.skill || {}))
    .filter((skill) => skill.id);

  const jobs = defaultJobs.map((job) => normalizeJob(job, defaultSkills[0]?.id || ""));
  const characters = [
    {
      ...normalizeCharacter(gameData.MAIN_CHARACTER, jobs[0]?.id || "vanguard"),
      isMain: true,
      recruited: true,
      inParty: true
    },
    ...deepClone(gameData.RECRUITABLES).map((entry) => ({
      ...normalizeCharacter(entry, jobs[0]?.id || "vanguard"),
      isMain: false
    }))
  ];

  return {
    skills: defaultSkills,
    jobs,
    characters,
    mainCharacterId: gameData.MAIN_CHARACTER.id
  };
}

function normalizeSnapshot(rawSnapshot) {
  const fallback = buildDefaultSnapshot();
  const rawSkills = Array.isArray(rawSnapshot?.skills) ? rawSnapshot.skills : fallback.skills;
  const skills = rawSkills.map((entry) => normalizeSkill(entry)).filter((entry) => entry.id);
  const normalizedSkills = skills.length > 0 ? skills : fallback.skills;
  const skillIds = new Set(normalizedSkills.map((entry) => entry.id));
  const defaultSkillId = normalizedSkills[0].id;

  const rawJobs = Array.isArray(rawSnapshot?.jobs) ? rawSnapshot.jobs : fallback.jobs;
  const jobs = rawJobs
    .map((entry) => normalizeJob(entry, defaultSkillId))
    .filter((entry) => entry.id)
    .map((entry) => ({
      ...entry,
      skillId: skillIds.has(entry.skillId) ? entry.skillId : defaultSkillId
    }));
  const normalizedJobs = jobs.length > 0 ? jobs : fallback.jobs;
  const jobIds = new Set(normalizedJobs.map((entry) => entry.id));
  const defaultJobId = normalizedJobs[0].id;

  const rawCharacters = Array.isArray(rawSnapshot?.characters) ? rawSnapshot.characters : fallback.characters;
  const characters = rawCharacters
    .map((entry) => normalizeCharacter(entry, defaultJobId))
    .filter((entry) => entry.id)
    .map((entry) => ({
      ...entry,
      jobId: jobIds.has(entry.jobId) ? entry.jobId : defaultJobId
    }));
  const normalizedCharacters = characters.length > 0 ? characters : fallback.characters;

  let mainCharacterId = String(rawSnapshot?.mainCharacterId || "").trim();
  if (!normalizedCharacters.some((entry) => entry.id === mainCharacterId)) {
    const explicitMain = normalizedCharacters.find((entry) => entry.isMain);
    mainCharacterId = explicitMain ? explicitMain.id : normalizedCharacters[0].id;
  }

  return {
    skills: normalizedSkills,
    jobs: normalizedJobs,
    characters: normalizedCharacters.map((entry) => ({
      ...entry,
      isMain: entry.id === mainCharacterId
    })),
    mainCharacterId
  };
}

function overwriteObject(target, source) {
  Object.keys(target).forEach((key) => {
    delete target[key];
  });
  Object.keys(source).forEach((key) => {
    target[key] = source[key];
  });
}

function overwriteArray(target, source) {
  target.splice(0, target.length, ...source);
}

class EntityDatabase {
  constructor() {
    this.state = normalizeSnapshot(null);
  }

  initialize() {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      try {
        this.state = normalizeSnapshot(JSON.parse(raw));
      } catch {
        this.state = normalizeSnapshot(null);
      }
    }

    this.applyToGameData();
    this.emitUpdate();
  }

  persist() {
    localStorage.setItem(DB_KEY, JSON.stringify(this.state));
  }

  applyToGameData() {
    const skillsById = {};
    this.state.skills.forEach((skill) => {
      skillsById[skill.id] = deepClone(skill);
    });

    const jobsObject = {};
    this.state.jobs.forEach((job) => {
      const linkedSkill = skillsById[job.skillId] || this.state.skills[0];
      jobsObject[job.id] = {
        id: job.id,
        label: job.label,
        iconUrl: job.iconUrl,
        maxHpMod: job.maxHpMod,
        attackMod: job.attackMod,
        defenseMod: job.defenseMod,
        speedMod: job.speedMod,
        skill: deepClone(linkedSkill)
      };
    });

    const mainCharacter = this.state.characters.find((entry) => entry.id === this.state.mainCharacterId)
      || this.state.characters[0];

    const recruitables = this.state.characters
      .filter((entry) => entry.id !== mainCharacter.id)
      .map((entry) => ({
        ...deepClone(entry),
        isMain: false,
        recruited: Boolean(entry.recruited),
        inParty: Boolean(entry.inParty)
      }));

    overwriteObject(gameData.JOBS, jobsObject);
    overwriteObject(gameData.MAIN_CHARACTER, {
      ...deepClone(mainCharacter),
      recruited: true,
      inParty: true,
      isMain: true
    });
    overwriteArray(gameData.RECRUITABLES, recruitables);
  }

  emitUpdate() {
    window.dispatchEvent(
      new CustomEvent("jrpg:entityDbUpdated", {
        detail: this.getSnapshot()
      })
    );
  }

  saveAndBroadcast() {
    this.state = normalizeSnapshot(this.state);
    this.applyToGameData();
    this.persist();
    this.emitUpdate();
  }

  getSnapshot() {
    return deepClone(this.state);
  }

  upsertSkill(rawSkill) {
    const skill = normalizeSkill(rawSkill);
    if (!skill.id) {
      return { ok: false, reason: "missing-id" };
    }

    const existing = this.state.skills.find((entry) => entry.id === skill.id);
    if (existing) {
      Object.assign(existing, skill);
    } else {
      this.state.skills.push(skill);
    }

    this.saveAndBroadcast();
    return { ok: true };
  }

  deleteSkill(skillId) {
    const id = String(skillId || "").trim();
    if (!id) {
      return { ok: false, reason: "missing-id" };
    }

    if (this.state.skills.length <= 1) {
      return { ok: false, reason: "last-skill" };
    }

    this.state.skills = this.state.skills.filter((entry) => entry.id !== id);
    const fallbackSkillId = this.state.skills[0].id;
    this.state.jobs.forEach((job) => {
      if (job.skillId === id) {
        job.skillId = fallbackSkillId;
      }
    });

    this.saveAndBroadcast();
    return { ok: true };
  }

  upsertJob(rawJob) {
    const fallbackSkillId = this.state.skills[0]?.id || "";
    const job = normalizeJob(rawJob, fallbackSkillId);
    if (!job.id) {
      return { ok: false, reason: "missing-id" };
    }

    const existing = this.state.jobs.find((entry) => entry.id === job.id);
    if (existing) {
      Object.assign(existing, job);
    } else {
      this.state.jobs.push(job);
    }

    this.saveAndBroadcast();
    return { ok: true };
  }

  deleteJob(jobId) {
    const id = String(jobId || "").trim();
    if (!id) {
      return { ok: false, reason: "missing-id" };
    }

    if (this.state.jobs.length <= 1) {
      return { ok: false, reason: "last-job" };
    }

    this.state.jobs = this.state.jobs.filter((entry) => entry.id !== id);
    const fallbackJobId = this.state.jobs[0].id;
    this.state.characters.forEach((character) => {
      if (character.jobId === id) {
        character.jobId = fallbackJobId;
      }
    });

    this.saveAndBroadcast();
    return { ok: true };
  }

  upsertCharacter(rawCharacter) {
    const fallbackJobId = this.state.jobs[0]?.id || "vanguard";
    const existing = this.state.characters.find((entry) => entry.id === String(rawCharacter.id || "").trim()) || null;
    const character = normalizeCharacter(
      {
        ...existing,
        ...rawCharacter,
        bond: rawCharacter.bond ?? existing?.bond,
        equipment: rawCharacter.equipment ?? existing?.equipment
      },
      fallbackJobId
    );
    if (!character.id) {
      return { ok: false, reason: "missing-id" };
    }

    if (existing) {
      Object.assign(existing, character);
    } else {
      this.state.characters.push(character);
    }

    if (character.isMain) {
      this.state.mainCharacterId = character.id;
    }

    this.saveAndBroadcast();
    return { ok: true };
  }

  deleteCharacter(characterId) {
    const id = String(characterId || "").trim();
    if (!id) {
      return { ok: false, reason: "missing-id" };
    }

    if (this.state.characters.length <= 1) {
      return { ok: false, reason: "last-character" };
    }

    this.state.characters = this.state.characters.filter((entry) => entry.id !== id);
    if (!this.state.characters.some((entry) => entry.id === this.state.mainCharacterId)) {
      this.state.mainCharacterId = this.state.characters[0].id;
    }

    this.saveAndBroadcast();
    return { ok: true };
  }
}

const database = new EntityDatabase();

globalObject.JRPG.systems.game.database = database;
database.initialize();
})(window);
