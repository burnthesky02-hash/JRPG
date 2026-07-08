(function registerColiseumData(globalObject) {
const JOBS = {
  vanguard: {
    id: "vanguard",
    label: "Vanguard",
    iconUrl: "",
    maxHpMod: 1.25,
    attackMod: 1.15,
    defenseMod: 1.1,
    speedMod: 0.9,
    skill: {
      id: "shield_break",
      name: "Shield Break",
      iconUrl: "",
      power: 1.35,
      cost: 12
    }
  },
  ranger: {
    id: "ranger",
    label: "Ranger",
    iconUrl: "",
    maxHpMod: 1,
    attackMod: 1.05,
    defenseMod: 0.95,
    speedMod: 1.2,
    skill: {
      id: "rapid_shot",
      name: "Rapid Shot",
      iconUrl: "",
      power: 1.2,
      cost: 10
    }
  },
  arcanist: {
    id: "arcanist",
    label: "Arcanist",
    iconUrl: "",
    maxHpMod: 0.92,
    attackMod: 1.28,
    defenseMod: 0.9,
    speedMod: 1.05,
    skill: {
      id: "ember_lance",
      name: "Ember Lance",
      iconUrl: "",
      power: 1.45,
      cost: 14
    }
  },
  tactician: {
    id: "tactician",
    label: "Tactician",
    iconUrl: "",
    maxHpMod: 1.08,
    attackMod: 1,
    defenseMod: 1,
    speedMod: 1.1,
    skill: {
      id: "tempo_order",
      name: "Tempo Order",
      iconUrl: "",
      power: 1.1,
      cost: 8
    }
  }
};

const EQUIPMENT = {
  iron_longsword: {
    id: "iron_longsword",
    label: "Iron Longsword",
    slot: "weapon",
    statMods: {
      attack: 4,
      speed: 1
    }
  },
  field_shield: {
    id: "field_shield",
    label: "Field Shield",
    slot: "armor",
    statMods: {
      maxHp: 14,
      defense: 4
    }
  },
  signal_charm: {
    id: "signal_charm",
    label: "Signal Charm",
    slot: "accessory",
    statMods: {
      attack: 2,
      speed: 3
    }
  },
  focus_rod: {
    id: "focus_rod",
    label: "Focus Rod",
    slot: "weapon",
    statMods: {
      attack: 5,
      speed: 1
    }
  },
  duelist_blade: {
    id: "duelist_blade",
    label: "Duelist Blade",
    slot: "weapon",
    statMods: {
      attack: 3,
      speed: 4
    }
  }
};

const NATIONS = {
  cindrel: {
    id: "cindrel",
    label: "Cindrel League",
    values: "Order, contracts, centralized command",
    framing: "They claim discipline prevents endless civil bloodshed."
  },
  valmere: {
    id: "valmere",
    label: "Valmere Clans",
    values: "Autonomy, kin-loyalty, local rule",
    framing: "They argue empires only rename oppression."
  },
  orinth: {
    id: "orinth",
    label: "Orinth Republic",
    values: "Trade, diplomacy, maritime power",
    framing: "They insist markets and treaties save more lives than armies."
  }
};

const MAIN_CHARACTER = {
  id: "hero_kade",
  name: "Kade",
  portraitUrl: "",
  lore: "Independent pit fighter with no fixed banner.",
  level: 1,
  bond: 1,
  baseStats: {
    maxHp: 125,
    attack: 23,
    defense: 14,
    speed: 14
  },
  jobId: "vanguard",
  equipment: {
    weapon: "iron_longsword",
    armor: "field_shield",
    accessory: "signal_charm"
  },
  recruited: true,
  inParty: true
};

const RECRUITABLES = [
  {
    id: "recruit_liora",
    name: "Liora",
    portraitUrl: "",
    lore: "Scout archer who studies officer formations.",
    level: 1,
    bond: 0,
    baseStats: { maxHp: 102, attack: 20, defense: 11, speed: 18 },
    jobId: "ranger",
    equipment: {
      weapon: "duelist_blade",
      armor: "",
      accessory: "signal_charm"
    },
    recruited: false,
    inParty: false
  },
  {
    id: "recruit_dren",
    name: "Dren",
    portraitUrl: "",
    lore: "Former siege engineer turned arena brawler.",
    level: 1,
    bond: 0,
    baseStats: { maxHp: 118, attack: 21, defense: 15, speed: 12 },
    jobId: "tactician",
    equipment: {
      weapon: "field_shield",
      armor: "iron_longsword",
      accessory: ""
    },
    recruited: false,
    inParty: false
  },
  {
    id: "recruit_mira",
    name: "Mira",
    portraitUrl: "",
    lore: "Fire-channeling scholar chased from a war college.",
    level: 1,
    bond: 0,
    baseStats: { maxHp: 94, attack: 24, defense: 10, speed: 15 },
    jobId: "arcanist",
    equipment: {
      weapon: "focus_rod",
      armor: "",
      accessory: "signal_charm"
    },
    recruited: false,
    inParty: false
  },
  {
    id: "recruit_sera",
    name: "Sera",
    portraitUrl: "",
    lore: "Dock runner who maps supply lanes faster than clerks.",
    level: 1,
    bond: 0,
    baseStats: { maxHp: 98, attack: 18, defense: 12, speed: 19 },
    jobId: "ranger",
    equipment: {
      weapon: "duelist_blade",
      armor: "",
      accessory: "signal_charm"
    },
    recruited: false,
    inParty: false
  },
  {
    id: "recruit_kael",
    name: "Kael",
    portraitUrl: "",
    lore: "Barracks veteran who never stopped drilling after the war.",
    level: 1,
    bond: 0,
    baseStats: { maxHp: 130, attack: 22, defense: 16, speed: 11 },
    jobId: "vanguard",
    equipment: {
      weapon: "iron_longsword",
      armor: "field_shield",
      accessory: ""
    },
    recruited: false,
    inParty: false
  }
];

const SAVE_KEY = "jrpg_coliseum_save_v1";

globalObject.JRPG.systems.game.data = {
  JOBS,
  EQUIPMENT,
  NATIONS,
  MAIN_CHARACTER,
  RECRUITABLES,
  SAVE_KEY
};
})(window);
