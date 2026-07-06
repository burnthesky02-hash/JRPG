 (function registerCharacterValidator(globalObject) {
const {
  BASE_STATS,
  BACKGROUNDS,
  BODY_TYPES,
  CLASSES,
  CLOTHING_SETS,
  CREATOR_RULES,
  FACE_PRESETS,
  HAIR_STYLES,
  SPECIES
} = globalObject.JRPG.systems.character.data;

function isOptionCompatibleWithBody(option, bodyTypeId) {
  if (!option || !bodyTypeId) {
    return false;
  }

  if (Array.isArray(option.compatibleBodyTypes) && option.compatibleBodyTypes.length > 0) {
    return option.compatibleBodyTypes.includes(bodyTypeId);
  }

  if (option.assetPathByBodyType) {
    return Boolean(option.assetPathByBodyType[bodyTypeId]);
  }

  return true;
}

function validateCharacterDraft(draft) {
  const errors = [];

  const trimmedName = (draft.name || "").trim();
  if (
    trimmedName.length < CREATOR_RULES.minNameLength ||
    trimmedName.length > CREATOR_RULES.maxNameLength
  ) {
    errors.push("Name must be between 2 and 18 characters.");
  }

  if (!SPECIES[draft.speciesId]) {
    errors.push("Choose a valid species.");
  }

  if (!CLASSES[draft.classId]) {
    errors.push("Choose a valid class.");
  }

  if (!BACKGROUNDS[draft.backgroundId]) {
    errors.push("Choose a valid background.");
  }

  if (!BODY_TYPES[draft.bodyTypeId]) {
    errors.push("Choose a valid body type.");
  }

  if (!HAIR_STYLES[draft.hairStyleId]) {
    errors.push("Choose a valid hair style.");
  }

  if (!FACE_PRESETS[draft.facePresetId]) {
    errors.push("Choose a valid face preset.");
  }

  if (!CLOTHING_SETS[draft.clothingSetId]) {
    errors.push("Choose a valid clothing set.");
  }

  if (BODY_TYPES[draft.bodyTypeId] && HAIR_STYLES[draft.hairStyleId]) {
    if (!isOptionCompatibleWithBody(HAIR_STYLES[draft.hairStyleId], draft.bodyTypeId)) {
      errors.push("Selected hair style is not compatible with this body type.");
    }
  }

  if (BODY_TYPES[draft.bodyTypeId] && FACE_PRESETS[draft.facePresetId]) {
    if (!isOptionCompatibleWithBody(FACE_PRESETS[draft.facePresetId], draft.bodyTypeId)) {
      errors.push("Selected face preset is not compatible with this body type.");
    }
  }

  if (BODY_TYPES[draft.bodyTypeId] && CLOTHING_SETS[draft.clothingSetId]) {
    if (!isOptionCompatibleWithBody(CLOTHING_SETS[draft.clothingSetId], draft.bodyTypeId)) {
      errors.push("Selected clothing set is not compatible with this body type.");
    }
  }

  let pointsSpent = 0;
  for (const stat of BASE_STATS) {
    const amount = Number(draft.investments?.[stat] ?? 0);
    if (!Number.isInteger(amount)) {
      errors.push(`Stat ${stat.toUpperCase()} must be a whole number.`);
      continue;
    }

    if (amount < CREATOR_RULES.minStatInvestment || amount > CREATOR_RULES.maxStatInvestment) {
      errors.push(`Stat ${stat.toUpperCase()} must be between 0 and 5.`);
    }

    pointsSpent += amount;
  }

  if (pointsSpent > CREATOR_RULES.statBudget) {
    errors.push(`Stat point budget exceeded by ${pointsSpent - CREATOR_RULES.statBudget}.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    pointsSpent,
    pointsLeft: CREATOR_RULES.statBudget - pointsSpent
  };
}

globalObject.JRPG.systems.character.validateCharacterDraft = validateCharacterDraft;
})(window);
