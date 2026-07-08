/* global Phaser, BootScene, MapScene, BattleScene */

// BattleScene is launched from the window jrpg:startBattle event
// via a thin forwarder registered here.

(function () {
  "use strict";

  const config = {
    type: Phaser.AUTO,
    parent: "phaser-container",
    backgroundColor: "#bfc7d0",
    pixelArt: false,
    width: 880,
    height: 480,
    scene: [BootScene, MapScene, BattleScene]
  };

  const game = new Phaser.Game(config);
  window.JRPG_GAME = game;

  // Forward the battle-start event into the running MapScene so it can
  // hand off to BattleScene cleanly.
  window.addEventListener("jrpg:startBattle", e => {
    const mapScene = game.scene.getScene("MapScene");
    if (!mapScene || !mapScene.scene.isActive()) return;
    mapScene.scene.start("BattleScene", e.detail || {});
  });
})();
