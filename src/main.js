import * as Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 960,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  roundPixels: true,
  antialias: true,
  scene: [GameScene, UIScene],
};

const game = new Phaser.Game(config);

export default game;
