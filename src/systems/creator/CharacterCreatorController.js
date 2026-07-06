 (function registerCharacterCreatorController(globalObject) {
const { EventBus } = globalObject.JRPG.core;
const { createCharacterFromDraft, validateCharacterDraft } = globalObject.JRPG.systems.character;
const {
  BODY_TYPES,
  CLOTHING_SETS,
  BACKGROUNDS,
  BASE_STATS,
  CLASSES,
  CREATOR_RULES,
  FACE_PRESETS,
  HAIR_STYLES,
  SPECIES
} = globalObject.JRPG.systems.character.data;

function toOptionsMap(dataSet) {
  return Object.values(dataSet).map((item) => ({ value: item.id, label: item.label }));
}

function setSelectOptions(selectElement, options) {
  selectElement.innerHTML = options
    .map((option) => `<option value="${option.value}">${option.label}</option>`)
    .join("");
}

function isOptionCompatibleWithBody(option, bodyTypeId) {
  if (!option) {
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

function getCompatibleOptions(dataSet, bodyTypeId) {
  return Object.values(dataSet)
    .filter((entry) => isOptionCompatibleWithBody(entry, bodyTypeId))
    .map((entry) => ({ value: entry.id, label: entry.label }));
}

function setOptionsAndResolveValue(selectElement, options, currentValue) {
  setSelectOptions(selectElement, options);

  if (options.some((option) => option.value === currentValue)) {
    selectElement.value = currentValue;
    return currentValue;
  }

  const fallbackValue = options[0]?.value || "";
  selectElement.value = fallbackValue;
  return fallbackValue;
}

function buildInitialDraft() {
  return {
    name: "",
    speciesId: Object.keys(SPECIES)[0],
    classId: Object.keys(CLASSES)[0],
    backgroundId: Object.keys(BACKGROUNDS)[0],
    bodyTypeId: Object.keys(BODY_TYPES)[0],
    hairStyleId: Object.keys(HAIR_STYLES)[0],
    facePresetId: Object.keys(FACE_PRESETS)[0],
    clothingSetId: Object.keys(CLOTHING_SETS)[0],
    primaryColor: "#58d68d",
    accentColor: "#f39c12",
    investments: Object.fromEntries(BASE_STATS.map((stat) => [stat, 0]))
  };
}

class CharacterCreatorController {
  constructor({ root, store }) {
    this.root = root;
    this.store = store;
    this.events = new EventBus();
    this.draft = buildInitialDraft();

    this.elements = {
      form: root.querySelector("#creator-form"),
      name: root.querySelector("#name"),
      species: root.querySelector("#species"),
      characterClass: root.querySelector("#characterClass"),
      background: root.querySelector("#background"),
      bodyType: root.querySelector("#bodyType"),
      hairStyle: root.querySelector("#hairStyle"),
      facePreset: root.querySelector("#facePreset"),
      clothingSet: root.querySelector("#clothingSet"),
      primaryColor: root.querySelector("#primaryColor"),
      accentColor: root.querySelector("#accentColor"),
      statsGrid: root.querySelector("#stats-grid"),
      pointsLeft: root.querySelector("#points-left"),
      formError: root.querySelector("#form-error"),
      resetButton: root.querySelector("#reset-form")
    };

    this.statInputs = new Map();
  }

  on(eventName, handler) {
    return this.events.on(eventName, handler);
  }

  initialize() {
    this.populateSelects();
    this.renderStatInputs();
    this.bindBaseInputs();
    this.bindActions();
    this.syncFormFromDraft();
    this.pushDraftUpdate();
  }

  populateSelects() {
    setSelectOptions(this.elements.species, toOptionsMap(SPECIES));
    setSelectOptions(this.elements.characterClass, toOptionsMap(CLASSES));
    setSelectOptions(this.elements.background, toOptionsMap(BACKGROUNDS));
    setSelectOptions(this.elements.bodyType, toOptionsMap(BODY_TYPES));
    this.refreshAppearanceLayerOptions();
  }

  refreshAppearanceLayerOptions() {
    const selectedBodyType = this.draft.bodyTypeId;

    const compatibleHairOptions = getCompatibleOptions(HAIR_STYLES, selectedBodyType);
    this.draft.hairStyleId = setOptionsAndResolveValue(
      this.elements.hairStyle,
      compatibleHairOptions,
      this.draft.hairStyleId
    );

    const compatibleFaceOptions = getCompatibleOptions(FACE_PRESETS, selectedBodyType);
    this.draft.facePresetId = setOptionsAndResolveValue(
      this.elements.facePreset,
      compatibleFaceOptions,
      this.draft.facePresetId
    );

    const compatibleClothingOptions = getCompatibleOptions(CLOTHING_SETS, selectedBodyType);
    this.draft.clothingSetId = setOptionsAndResolveValue(
      this.elements.clothingSet,
      compatibleClothingOptions,
      this.draft.clothingSetId
    );
  }

  renderStatInputs() {
    this.elements.statsGrid.innerHTML = "";

    for (const stat of BASE_STATS) {
      const wrapper = document.createElement("div");
      wrapper.className = "stat-item";

      const label = document.createElement("label");
      label.setAttribute("for", `stat-${stat}`);
      label.textContent = stat.toUpperCase();

      const input = document.createElement("input");
      input.id = `stat-${stat}`;
      input.type = "number";
      input.min = String(CREATOR_RULES.minStatInvestment);
      input.max = String(CREATOR_RULES.maxStatInvestment);
      input.step = "1";
      input.value = "0";

      input.addEventListener("input", () => {
        const previous = this.draft.investments[stat];
        const nextValue = Number(input.value);
        const normalized = Number.isFinite(nextValue) ? Math.max(0, Math.min(5, Math.floor(nextValue))) : 0;

        this.draft.investments[stat] = normalized;

        const validation = validateCharacterDraft(this.draft);
        if (validation.pointsLeft < 0) {
          this.draft.investments[stat] = previous;
          input.value = String(previous);
        } else {
          input.value = String(normalized);
        }

        this.pushDraftUpdate();
      });

      wrapper.append(label, input);
      this.statInputs.set(stat, input);
      this.elements.statsGrid.appendChild(wrapper);
    }
  }

  bindBaseInputs() {
    this.elements.name.addEventListener("input", () => {
      this.draft.name = this.elements.name.value;
      this.pushDraftUpdate();
    });

    this.elements.species.addEventListener("change", () => {
      this.draft.speciesId = this.elements.species.value;
      this.pushDraftUpdate();
    });

    this.elements.characterClass.addEventListener("change", () => {
      this.draft.classId = this.elements.characterClass.value;
      this.pushDraftUpdate();
    });

    this.elements.background.addEventListener("change", () => {
      this.draft.backgroundId = this.elements.background.value;
      this.pushDraftUpdate();
    });

    this.elements.bodyType.addEventListener("change", () => {
      this.draft.bodyTypeId = this.elements.bodyType.value;
      this.refreshAppearanceLayerOptions();
      this.pushDraftUpdate();
    });

    this.elements.hairStyle.addEventListener("change", () => {
      this.draft.hairStyleId = this.elements.hairStyle.value;
      this.pushDraftUpdate();
    });

    this.elements.facePreset.addEventListener("change", () => {
      this.draft.facePresetId = this.elements.facePreset.value;
      this.pushDraftUpdate();
    });

    this.elements.clothingSet.addEventListener("change", () => {
      this.draft.clothingSetId = this.elements.clothingSet.value;
      this.pushDraftUpdate();
    });

    this.elements.primaryColor.addEventListener("input", () => {
      this.draft.primaryColor = this.elements.primaryColor.value;
      this.pushDraftUpdate();
    });

    this.elements.accentColor.addEventListener("input", () => {
      this.draft.accentColor = this.elements.accentColor.value;
      this.pushDraftUpdate();
    });
  }

  bindActions() {
    this.elements.form.addEventListener("submit", (event) => {
      event.preventDefault();

      const result = createCharacterFromDraft(this.draft);
      if (!result.ok) {
        this.showError(result.errors[0]);
        return;
      }

      this.store.add(result.character);
      this.showError("");
      this.events.emit("character:saved", result.character);

      this.draft = buildInitialDraft();
      this.syncFormFromDraft();
      this.pushDraftUpdate();
    });

    this.elements.resetButton.addEventListener("click", () => {
      this.draft = buildInitialDraft();
      this.showError("");
      this.syncFormFromDraft();
      this.pushDraftUpdate();
    });
  }

  syncFormFromDraft() {
    this.elements.name.value = this.draft.name;
    this.elements.species.value = this.draft.speciesId;
    this.elements.characterClass.value = this.draft.classId;
    this.elements.background.value = this.draft.backgroundId;
    this.elements.bodyType.value = this.draft.bodyTypeId;
    this.refreshAppearanceLayerOptions();
    this.elements.primaryColor.value = this.draft.primaryColor;
    this.elements.accentColor.value = this.draft.accentColor;

    for (const stat of BASE_STATS) {
      const input = this.statInputs.get(stat);
      if (input) {
        input.value = String(this.draft.investments[stat]);
      }
    }
  }

  pushDraftUpdate() {
    const validation = validateCharacterDraft(this.draft);
    this.elements.pointsLeft.textContent = String(Math.max(validation.pointsLeft, 0));

    if (validation.pointsLeft < 0) {
      this.showError("You exceeded the point budget.");
    } else if (validation.errors.length > 0 && this.elements.formError.textContent) {
      this.showError(validation.errors[0]);
    } else if (validation.errors.length === 0) {
      this.showError("");
    }

    this.events.emit("draft:changed", {
      draft: JSON.parse(JSON.stringify(this.draft)),
      validation
    });
  }

  showError(message) {
    this.elements.formError.textContent = message;
  }
}

globalObject.JRPG.systems.creator.CharacterCreatorController = CharacterCreatorController;
})(window);
