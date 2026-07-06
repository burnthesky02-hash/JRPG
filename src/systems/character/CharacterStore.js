(function registerCharacterStore(globalObject) {
  class CharacterStore {
    constructor() {
      this.roster = [];
    }

    add(character) {
      this.roster.push(character);
    }

    all() {
      return [...this.roster];
    }

    clear() {
      this.roster = [];
    }
  }

  globalObject.JRPG.systems.character.CharacterStore = CharacterStore;
})(window);
