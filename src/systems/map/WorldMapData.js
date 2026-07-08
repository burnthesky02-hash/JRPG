(function registerWorldMapData(globalObject) {
const TILE_SIZE = 40;
const VIEWPORT_TILES = { width: 22, height: 12 };
const MAP_SAVE_KEY = "jrpg_map_save_v1";

const WORLD_SCENES = {
  district: {
    id: "district",
    label: "Mercenary District",
    template: [
      "########################################",
      "#.................#....1............####",
      "#..@..............#....................#",
      "#.............#####....~~~~~...........#",
      "#.................#....~~~~~...........#",
      "#....####.........#....................#",
      "#....#..#....a....#...........o...u....#",
      "#....#..#.........#....................#",
      "#....####.........###########..........#",
      "#......................................#",
      "#..........s...............b....l...3..#",
      "#......................................#",
      "#####.#####.............##..##.........#",
      "#......................................#",
      "#....................c.................#",
      "#..............###.###.................#",
      "#....o.........#.....#.................#",
      "#..............#..2..#.................#",
      "#..............#.....#.................#",
      "########################################"
    ],
    spawns: {
      from_guild: { x: 23, y: 2, facing: "down" },
      from_training: { x: 17, y: 16, facing: "up" }
    }
  },
  guild_hall: {
    id: "guild_hall",
    label: "Free Company Hall",
    template: [
      "####################",
      "#..................#",
      "#....e.......m.....#",
      "#..................#",
      "#.........o........#",
      "#..................#",
      "#..................#",
      "#....4....1........#",
      "#..................#",
      "####################"
    ],
    spawns: {
      entry: { x: 9, y: 6, facing: "up" }
    }
  },
  harbor_ward: {
    id: "harbor_ward",
    label: "Harbor Ward",
    template: [
      "######################",
      "#....................#",
      "#....h...........o...#",
      "#....................#",
      "#.........~~~~.......#",
      "#.........~~~~.......#",
      "#....................#",
      "#...........3........#",
      "#....................#",
      "######################"
    ],
    spawns: {
      entry: { x: 9, y: 6, facing: "up" }
    }
  },
  barracks_interior: {
    id: "barracks_interior",
    label: "Barracks Interior",
    template: [
      "######################",
      "#....................#",
      "#....k...............#",
      "#....................#",
      "#.........d..........#",
      "#....................#",
      "#...........o........#",
      "#...........4........#",
      "#....................#",
      "######################"
    ],
    spawns: {
      entry: { x: 10, y: 6, facing: "up" }
    }
  },
  training_yard: {
    id: "training_yard",
    label: "Training Yard",
    template: [
      "########################",
      "#......................#",
      "#.....~~~~.............#",
      "#.....~~~~.............#",
      "#......................#",
      "#..........d......r....#",
      "#......................#",
      "#..............a.......#",
      "#..........2...........#",
      "########################"
    ],
    spawns: {
      entry: { x: 10, y: 7, facing: "up" }
    }
  }
};

const PORTAL_LINKS = {
  "1": {
    from: "district",
    toSceneId: "guild_hall",
    toSpawnId: "entry",
    label: "Enter Free Company Hall"
  },
  "2": {
    from: "district",
    toSceneId: "training_yard",
    toSpawnId: "entry",
    label: "Enter Training Yard"
  },
  "1_guild_hall": {
    from: "guild_hall",
    toSceneId: "district",
    toSpawnId: "from_guild",
    label: "Return to District"
  },
  "3_district": {
    from: "district",
    toSceneId: "harbor_ward",
    toSpawnId: "entry",
    label: "Enter Harbor Ward"
  },
  "3_harbor_ward": {
    from: "harbor_ward",
    toSceneId: "district",
    toSpawnId: "from_harbor",
    label: "Return to District"
  },
  "4_guild_hall": {
    from: "guild_hall",
    toSceneId: "barracks_interior",
    toSpawnId: "entry",
    label: "Enter Barracks Interior"
  },
  "4_barracks_interior": {
    from: "barracks_interior",
    toSceneId: "guild_hall",
    toSpawnId: "entry",
    label: "Return to Guild Hall"
  },
  "2_training_yard": {
    from: "training_yard",
    toSceneId: "district",
    toSpawnId: "from_training",
    label: "Return to District"
  }
};

const NPC_ARCHETYPES = {
  a: {
    id: "arena_scout",
    name: "Arena Scout",
    schedule: ["day", "night"],
    dialogues: [
      "Every contract changes the city. Keep your blade clean.",
      "The war has no saints. Only survivors and storytellers.",
      "The coliseum watches who you spare, not only who you beat."
    ]
  },
  b: {
    id: "supply_broker",
    name: "Supply Broker",
    schedule: ["day"],
    dialogues: [
      "I sell to all banners. Food does not care about politics.",
      "Valmere steel lasts longer, Cindrel pays faster, Orinth pays in full.",
      "Bring arena marks and I can open better stock for your crew."
    ]
  },
  c: {
    id: "retired_captain",
    name: "Retired Captain",
    schedule: ["night"],
    dialogues: [
      "I watched three nations burn villages for the same bridge.",
      "Pick a side, but keep your own code."
    ]
  },
  e: {
    id: "guild_quartermaster",
    name: "Quartermaster Sel",
    schedule: ["day", "night"],
    dialogues: [
      "Guild bunks are packed. War makes mercenaries of everyone.",
      "If your contract turns sour, this hall still honors debt and shelter."
    ]
  },
  l: {
    id: "recruit_liora",
    name: "Liora",
    schedule: ["day", "night"],
    recruitId: "recruit_liora",
    dialogues: [
      "I read enemy formations better than maps. Need a scout?",
      "Keep me supplied and I will keep your party alive."
    ]
  },
  m: {
    id: "recruit_mira",
    name: "Mira",
    schedule: ["day", "night"],
    recruitId: "recruit_mira",
    dialogues: [
      "My fire casting is controlled. Mostly.",
      "If your crew can handle heat, I can end fights fast."
    ]
  },
  r: {
    id: "recruit_dren",
    name: "Dren",
    schedule: ["day", "night"],
    recruitId: "recruit_dren",
    dialogues: [
      "Put me where the line breaks and it will not break twice.",
      "I worked siege crews. The coliseum is calmer by comparison."
    ]
  },
  u: {
    id: "battle_registrar",
    name: "Registrar Vonn",
    schedule: ["day", "night"],
    registrar: true,
    dialogues: [
      "Sign your squad in and pick an unlocked rank bracket.",
      "We run sanctioned bouts only. Select your tier and we will queue the match."
    ]
  },
  h: {
    id: "harbor_clerk",
    name: "Harbor Clerk",
    schedule: ["day", "night"],
    recruitId: "recruit_sera",
    dialogues: [
      "The docks pay in rumors, coins, and overtime.",
      "Sera keeps the freight lanes moving even when the banners change."
    ]
  },
  k: {
    id: "barracks_veteran",
    name: "Barracks Veteran",
    schedule: ["day", "night"],
    recruitId: "recruit_kael",
    dialogues: [
      "The barracks remember every supply shortfall.",
      "Kael can hold a line long enough for a plan to become a victory."
    ]
  }
};

const OBJECT_ARCHETYPES = {
  o: {
    id: "supply_cache",
    name: "Supply Cache",
    oneTime: true,
    interactionText: "You found dried rations, a field kit, and 20 credits worth of salvage."
  },
  s: {
    id: "notice_board",
    name: "Notice Board",
    oneTime: false,
    interactionText: "Notice: Coliseum rank 3 required for military observer contracts."
  },
  d: {
    id: "training_gate",
    name: "Training Gate",
    oneTime: false,
    interactionText: "The gate leads to advanced drills. It is locked for now."
  }
};

const ENCOUNTER_ZONES = [
  {
    id: "market_skirmish",
    sceneId: "district",
    x1: 16,
    y1: 2,
    x2: 36,
    y2: 11,
    chancePerStep: 0.18,
    encounter: {
      label: "Market District Skirmish",
      rankOffset: 0,
      rewardBonus: 10,
      enemyPrefix: "District Raider"
    }
  },
  {
    id: "outer_wall_patrol",
    sceneId: "district",
    x1: 20,
    y1: 13,
    x2: 36,
    y2: 18,
    chancePerStep: 0.12,
    encounter: {
      label: "Outer Wall Patrol Clash",
      rankOffset: 1,
      rewardBonus: 18,
      enemyPrefix: "Patrol Lancer"
    }
  }
];

const QUEST_LABELS = {
  captainWarningHeard: "Speak with the retired captain",
  observerContractSeen: "Read the district notice board",
  observerContractAccepted: "Secure observer contract clearance",
  cindrel_contract_accepted: "Accept the Cindrel dispatch",
  cindrel_contract_complete: "Report to the registrar and close the Cindrel dispatch",
  valmere_contract_accepted: "Accept the Valmere salvage request",
  valmere_contract_complete: "Recover the Valmere field cache",
  orinth_contract_accepted: "Accept the Orinth cargo route",
  orinth_contract_complete: "Secure the Orinth cargo cache",
  recruit_liora: "Recruit Liora in the district",
  recruit_mira: "Recruit Mira in the guild hall",
  recruit_dren: "Recruit Dren in the training yard",
  recruit_sera: "Recruit Sera at the harbor ward",
  recruit_kael: "Recruit Kael at the barracks",
  spoke_registrar: "Speak with Registrar Vonn for ranked battle sign-up"
};

const TILE_COLORS = {
  floor: "#d5c7a6",
  wall: "#384b5c",
  water: "#3a79b8",
  portal: "#7d5db8",
  shadow: "rgba(0, 0, 0, 0.15)",
  grid: "rgba(0, 0, 0, 0.06)",
  player: "#e35d43",
  npc: "#4a8d53",
  object: "#a07839"
};

globalObject.JRPG.systems.map.data = {
  TILE_SIZE,
  VIEWPORT_TILES,
  MAP_SAVE_KEY,
  WORLD_SCENES,
  PORTAL_LINKS,
  NPC_ARCHETYPES,
  OBJECT_ARCHETYPES,
  ENCOUNTER_ZONES,
  QUEST_LABELS,
  TILE_COLORS
};
})(window);
