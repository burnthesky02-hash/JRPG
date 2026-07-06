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
  baseStats: {
    maxHp: 125,
    attack: 23,
    defense: 14,
    speed: 14
  },
  jobId: "vanguard",
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
    baseStats: { maxHp: 102, attack: 20, defense: 11, speed: 18 },
    jobId: "ranger",
    recruited: false,
    inParty: false
  },
  {
    id: "recruit_dren",
    name: "Dren",
    portraitUrl: "",
    lore: "Former siege engineer turned arena brawler.",
    level: 1,
    baseStats: { maxHp: 118, attack: 21, defense: 15, speed: 12 },
    jobId: "tactician",
    recruited: false,
    inParty: false
  },
  {
    id: "recruit_mira",
    name: "Mira",
    portraitUrl: "",
    lore: "Fire-channeling scholar chased from a war college.",
    level: 1,
    baseStats: { maxHp: 94, attack: 24, defense: 10, speed: 15 },
    jobId: "arcanist",
    recruited: false,
    inParty: false
  }
];

const SAVE_KEY = "jrpg_coliseum_save_v1";

globalObject.JRPG.systems.game.data = {
  JOBS,
  NATIONS,
  MAIN_CHARACTER,
  RECRUITABLES,
  SAVE_KEY
};
})(window);
