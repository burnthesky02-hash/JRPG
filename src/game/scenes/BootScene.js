/* global Phaser */
class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  create() {
    const T = 40;

    const mk = (key, w, h, fn) => {
      const g = this.make.graphics({ add: false });
      fn(g);
      g.generateTexture(key, w, h);
      g.destroy();
    };

    // ── Floor ─────────────────────────────────────────────────────────────────
    mk("tile_floor", T, T, g => {
      g.fillStyle(0xd5c7a6); g.fillRect(0, 0, T, T);
      g.fillStyle(0xc4b492, 0.55); g.fillRect(1, 1, T - 2, T - 2);
      g.fillStyle(0xa89060, 0.2);
      for (let x = 6; x < T; x += 10) for (let y = 6; y < T; y += 10) g.fillRect(x, y, 2, 2);
      g.lineStyle(1, 0xb4a082, 0.35); g.strokeRect(0, 0, T, T);
    });

    // ── Wall ──────────────────────────────────────────────────────────────────
    mk("tile_wall", T, T, g => {
      g.fillStyle(0x384b5c); g.fillRect(0, 0, T, T);
      g.fillStyle(0x4a6070, 1); g.fillRect(2,  2, T / 2 - 3, T / 2 - 3);
      g.fillStyle(0x3d5464, 1); g.fillRect(T / 2 + 1, 2, T / 2 - 3, T / 2 - 3);
      g.fillStyle(0x445a6a, 1); g.fillRect(2, T / 2 + 1, T - 4, T / 2 - 3);
      g.fillStyle(0x6a8fa0, 0.3);
      g.fillRect(4, 4, T / 2 - 7, 4);
      g.fillRect(T / 2 + 3, 4, T / 2 - 7, 4);
      g.lineStyle(1, 0x2a3a48, 0.9); g.strokeRect(0, 0, T, T);
    });

    // ── Water ─────────────────────────────────────────────────────────────────
    mk("tile_water", T, T, g => {
      g.fillStyle(0x3a79b8); g.fillRect(0, 0, T, T);
      g.fillStyle(0x5090cc, 0.65); g.fillRect(2, 5, T - 4, 8);
      g.fillStyle(0x5090cc, 0.5);  g.fillRect(0, 18, T - 3, 7);
      g.fillStyle(0x5090cc, 0.55); g.fillRect(3, 30, T - 5, 6);
      g.fillStyle(0xa8d4f0, 0.45); g.fillRect(5, 9, 12, 2);
      g.fillStyle(0xa8d4f0, 0.4);  g.fillRect(T - 16, 23, 10, 2);
    });

    // ── Player (4 facing directions) ──────────────────────────────────────────
    ["down", "up", "left", "right"].forEach(dir => {
      mk(`player_${dir}`, T, T, g => {
        // shadow
        g.fillStyle(0x000000, 0.15); g.fillEllipse(20, 37, 20, 6);
        // body
        g.fillStyle(0xe35d43); g.fillRoundedRect(11, 16, 18, 20, 5);
        // head
        g.fillStyle(0xffd5a0); g.fillCircle(20, 12, 10);
        // direction arrow
        g.fillStyle(0xc03020);
        if (dir === "down")  g.fillTriangle(14, 33, 26, 33, 20, 40);
        if (dir === "up")    g.fillTriangle(14, 16, 26, 16, 20,  8);
        if (dir === "left")  g.fillTriangle( 9, 20, 17, 14, 17, 26);
        if (dir === "right") g.fillTriangle(31, 20, 23, 14, 23, 26);
      });
    });

    // ── NPC ───────────────────────────────────────────────────────────────────
    mk("npc", T, T, g => {
      g.fillStyle(0x000000, 0.15); g.fillEllipse(20, 37, 18, 5);
      g.fillStyle(0x4a8d53); g.fillRoundedRect(11, 16, 18, 20, 5);
      g.fillStyle(0xffd5a0); g.fillCircle(20, 12, 9);
      g.fillStyle(0x357040); g.fillRect(11, 29, 18, 7);
    });

    // ── Chest / object ────────────────────────────────────────────────────────
    mk("obj_chest", T, T, g => {
      g.fillStyle(0x6b3c20); g.fillRoundedRect(7, 20, 26, 16, 3);
      g.fillStyle(0xa07839); g.fillRect(7, 17, 26, 9);
      g.fillStyle(0xf0c040); g.fillCircle(20, 21, 4);
      g.lineStyle(1, 0x3a1e08, 0.7); g.strokeRoundedRect(7, 17, 26, 19, 3);
    });

    // ── Portal ────────────────────────────────────────────────────────────────
    mk("portal", T, T, g => {
      g.fillStyle(0x7d5db8, 0.3); g.fillCircle(20, 20, 18);
      g.lineStyle(2, 0x9d7dd8, 0.9); g.strokeCircle(20, 20, 18);
      g.fillStyle(0xffffff, 0.5); g.fillCircle(20, 20, 10);
      g.fillStyle(0xb89ae8, 0.8); g.fillCircle(20, 20, 5);
    });

    this.scene.start("MapScene", { sceneId: "district" });
  }
}
