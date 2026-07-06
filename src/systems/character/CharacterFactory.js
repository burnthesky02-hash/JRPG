 (function registerCharacterFactory(globalObject) {
const {
  BACKGROUNDS,
  BASE_STATLINE,
  BASE_STATS,
  BODY_TYPES,
  CLASSES,
  CLOTHING_SETS,
  FACE_PRESETS,
  HAIR_STYLES,
  SPECIES
} = globalObject.JRPG.systems.character.data;
const { validateCharacterDraft } = globalObject.JRPG.systems.character;

function combineStats(...parts) {
  const output = {};
  for (const stat of BASE_STATS) {
    output[stat] = 0;
  }

  for (const part of parts) {
    for (const stat of BASE_STATS) {
      output[stat] += Number(part?.[stat] ?? 0);
    }
  }

  return output;
}

function buildGrowthProfile(characterClass) {
  const growth = {};
  for (const stat of BASE_STATS) {
    growth[stat] = Number(characterClass.growth?.[stat] ?? 1);
  }
  return growth;
}

function createCharacterFromDraft(draft) {
  const validation = validateCharacterDraft(draft);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  const species = SPECIES[draft.speciesId];
  const characterClass = CLASSES[draft.classId];
  const background = BACKGROUNDS[draft.backgroundId];
  const bodyType = BODY_TYPES[draft.bodyTypeId];
  const hairStyle = HAIR_STYLES[draft.hairStyleId];
  const facePreset = FACE_PRESETS[draft.facePresetId];
  const clothingSet = CLOTHING_SETS[draft.clothingSetId];

  const stats = combineStats(
    BASE_STATLINE,
    species.statMods,
    characterClass.statMods,
    background.statMods,
    draft.investments
  );

  const createdCharacter = {
    id: `char_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: draft.name.trim(),
    level: 1,
    species,
    class: characterClass,
    background,
    appearance: {
      bodyType,
      primaryColor: draft.primaryColor,
      accentColor: draft.accentColor,
      layers: {
        hair: hairStyle,
        face: facePreset,
        clothing: clothingSet
      }
    },
    stats,
    growth: buildGrowthProfile(characterClass),
    resources: {
      hp: stats.hp,
      mp: stats.mp
    },
    skills: [characterClass.starterSkill],
    tags: [species.id, characterClass.id, background.id]
  };

  return { ok: true, character: createdCharacter };
}

globalObject.JRPG.systems.character.createCharacterFromDraft = createCharacterFromDraft;
})(window);
