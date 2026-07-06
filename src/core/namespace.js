(function bootstrapNamespace(globalObject) {
  const root = globalObject.JRPG || {};

  root.core = root.core || {};
  root.systems = root.systems || {};
  root.systems.character = root.systems.character || {};
  root.systems.creator = root.systems.creator || {};
  root.systems.extractor = root.systems.extractor || {};
  root.systems.game = root.systems.game || {};
  root.systems.map = root.systems.map || {};
  root.rendering = root.rendering || {};

  globalObject.JRPG = root;
})(window);
