import * as Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  roundPixels: true,
  antialias: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: 1280,
    height: 960,
  },
  scene: [GameScene, UIScene],
};

const game = new Phaser.Game(config);

export default game;
