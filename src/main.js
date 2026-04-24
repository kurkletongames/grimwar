import * as Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 960;
const DPR = Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  render: {
    antialias: true,
    antialiasGL: true,
    pixelArt: false,
    roundPixels: true,
    powerPreference: 'high-performance',
  },
  scene: [GameScene, UIScene],
};

// HiDPI crisp text: Phaser renders text to an internal canvas and uses that
// as a texture. The canvas is sized at 1x by default, so on Retina / HiDPI
// displays the text looks fuzzy. Wrapping the text factory to auto-call
// setResolution(DPR) renders the text canvas at display resolution.
if (DPR > 1 && Phaser.GameObjects && Phaser.GameObjects.GameObjectFactory) {
  const proto = Phaser.GameObjects.GameObjectFactory.prototype;
  const origText = proto.text;
  if (typeof origText === 'function') {
    proto.text = function wrappedText(x, y, text, style) {
      const obj = origText.call(this, x, y, text, style);
      if (obj && typeof obj.setResolution === 'function') obj.setResolution(DPR);
      return obj;
    };
  }
}

const game = new Phaser.Game(config);

export default game;
