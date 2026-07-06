 (function registerCharacterData(globalObject) {
const BASE_STATS = ["hp", "mp", "atk", "def", "mag", "res", "agi", "luk"];

const BASE_STATLINE = {
  hp: 12,
  mp: 8,
  atk: 7,
  def: 7,
  mag: 7,
  res: 7,
  agi: 7,
  luk: 6
};

const SPECIES = {
  human: {
    id: "human",
    label: "Human",
    statMods: { hp: 1, luk: 1 },
    lore: "Balanced and adaptable."
  },
  drakyn: {
    id: "drakyn",
    label: "Drakyn",
    statMods: { hp: 2, atk: 2, mag: -1 },
    lore: "Scaled fighters with fierce vitality."
  },
  sylph: {
    id: "sylph",
    label: "Sylph",
    statMods: { agi: 2, mag: 1, def: -1 },
    lore: "Wind-touched and quick-footed."
  },
  automa: {
    id: "automa",
    label: "Automa",
    statMods: { def: 2, res: 1, luk: -1 },
    lore: "Construct lineage with reinforced frames."
  }
};

const CLASSES = {
  vanguard: {
    id: "vanguard",
    label: "Vanguard",
    statMods: { hp: 3, atk: 2, def: 1, mp: -1 },
    growth: { hp: 1.3, atk: 1.15, def: 1.1, agi: 0.95, mag: 0.85, res: 1, luk: 1, mp: 0.9 },
    starterSkill: "Guard Break"
  },
  arcanist: {
    id: "arcanist",
    label: "Arcanist",
    statMods: { mp: 4, mag: 3, hp: -2, atk: -1 },
    growth: { hp: 0.9, mp: 1.35, atk: 0.9, def: 0.95, mag: 1.25, res: 1.1, agi: 1, luk: 1.05 },
    starterSkill: "Flare Sigil"
  },
  ranger: {
    id: "ranger",
    label: "Ranger",
    statMods: { agi: 3, atk: 1, luk: 1, def: -1 },
    growth: { hp: 1, mp: 1, atk: 1.1, def: 0.95, mag: 1, res: 1, agi: 1.25, luk: 1.15 },
    starterSkill: "Twin Shot"
  },
  tactician: {
    id: "tactician",
    label: "Tactician",
    statMods: { res: 2, mag: 1, hp: 1, atk: -1 },
    growth: { hp: 1.05, mp: 1.1, atk: 0.95, def: 1, mag: 1.15, res: 1.2, agi: 1, luk: 1.05 },
    starterSkill: "Tempo Shift"
  }
};

const BACKGROUNDS = {
  streetborn: {
    id: "streetborn",
    label: "Streetborn",
    statMods: { agi: 1, luk: 2 },
    perk: "Bonus loot chance"
  },
  scholar: {
    id: "scholar",
    label: "Scholar",
    statMods: { mp: 1, mag: 1, luk: -1 },
    perk: "Identify enemy weakness"
  },
  sentinel: {
    id: "sentinel",
    label: "Sentinel",
    statMods: { hp: 1, def: 1 },
    perk: "Reduced opening-turn damage"
  },
  envoy: {
    id: "envoy",
    label: "Envoy",
    statMods: { res: 1, luk: 1 },
    perk: "Cheaper shop prices"
  }
};

const BODY_TYPES = {
  female: {
    id: "female",
    label: "Female",
    assetPath: "assets/BodyType/female.webp"
  },
  male: {
    id: "male",
    label: "Male",
    assetPath: "assets/BodyType/male.webp"
  }
};

const HAIR_STYLES = {
  pony: {
    id: "pony",
    label: "Ponytail",
    assetPath: "assets/Hairstyle/pony.webp",
    compatibleBodyTypes: ["female", "male"],
    colorable: false
  },
  slickedBack: {
    id: "slickedBack",
    label: "Slicked Back",
    assetPath: "assets/Hairstyle/slickedBack.webp",
    compatibleBodyTypes: ["female", "male"],
    colorable: false
  },
  short: {
    id: "short",
    label: "Short Crop",
    assetPath: null,
    compatibleBodyTypes: ["female", "male"],
    colorable: true
  }
};

const FACE_PRESETS = {
  calm: {
    id: "calm",
    label: "Calm",
    compatibleBodyTypes: ["female", "male"],
    assetPath: null
  },
  fierce: {
    id: "fierce",
    label: "Fierce",
    compatibleBodyTypes: ["female", "male"],
    assetPath: null
  },
  cheerful: {
    id: "cheerful",
    label: "Cheerful",
    compatibleBodyTypes: ["female", "male"],
    assetPath: null
  }
};

const CLOTHING_SETS = {
  soldier: {
    id: "soldier",
    label: "Soldier",
    compatibleBodyTypes: ["female", "male"],
    assetPathByBodyType: {
      female: "assets/femaleClothing/FemaleSoldier.webp",
      male: "assets/maleClothing/Soldier.webp"
    }
  },
  traveler: {
    id: "traveler",
    label: "Traveler",
    compatibleBodyTypes: ["female", "male"],
    assetPath: null
  },
  mystic: {
    id: "mystic",
    label: "Mystic",
    compatibleBodyTypes: ["female", "male"],
    assetPath: null
  }
};

const CREATOR_RULES = {
  statBudget: 10,
  minStatInvestment: 0,
  maxStatInvestment: 5,
  minNameLength: 2,
  maxNameLength: 18
};

globalObject.JRPG.systems.character.data = {
  BASE_STATS,
  BASE_STATLINE,
  SPECIES,
  CLASSES,
  BACKGROUNDS,
  BODY_TYPES,
  HAIR_STYLES,
  FACE_PRESETS,
  CLOTHING_SETS,
  CREATOR_RULES
};
})(window);
