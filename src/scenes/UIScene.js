import Phaser from 'phaser';
import { FIREBALL_COOLDOWN } from '../entities/Fireball.js';
import { WIZARD_COLORS } from '../entities/Wizard.js';
import { UPGRADES } from './GameScene.js';

const BLINK_COOLDOWN = 8000; // must match GameScene

const RARITY_COLORS = {
  common:    0x888888,
  rare:      0x4fc3f7,
  epic:      0xab47bc,
  legendary: 0xffa726,
};

const RARITY_LABELS = {
  common:    'Common',
  rare:      'Rare',
  epic:      'Epic',
  legendary: 'Legendary',
};

const RARITY_WEIGHTS = {
  common: 60,
  rare: 25,
  epic: 12,
  legendary: 3,
};

const DOT_RADIUS = 5;
const DOT_GAP = 4;
const ROW_HEIGHT = 24;
const SCOREBOARD_X = 14;
const SCOREBOARD_Y = 14;

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    this.lastCastTime = 0;
    this.scores = {};
    this.playerInfo = [];
    this.winsToWin = 5;

    // ---- Spell cooldown icon ----
    const iconSize = 48;
    const iconX = w / 2;
    const iconY = h - 50;

    this.spellBg = this.add.graphics();
    this.spellBg.fillStyle(0x1a1a3e, 0.8);
    this.spellBg.fillRoundedRect(iconX - iconSize / 2 - 4, iconY - iconSize / 2 - 4, iconSize + 8, iconSize + 8, 8);
    this.spellBg.lineStyle(2, 0xe94560, 0.6);
    this.spellBg.strokeRoundedRect(iconX - iconSize / 2 - 4, iconY - iconSize / 2 - 4, iconSize + 8, iconSize + 8, 8);

    this.spellIcon = this.add.graphics();
    this._drawFireballIcon(iconX, iconY, iconSize);

    this.cooldownOverlay = this.add.graphics().setDepth(10);
    this.cooldownText = this.add.text(iconX, iconY, '', {
      fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(11);

    this.add.text(iconX, iconY + iconSize / 2 + 12, 'Fireball', {
      fontSize: '11px', color: '#aaa',
    }).setOrigin(0.5);
    this.add.text(iconX, iconY - iconSize / 2 - 14, 'LMB', {
      fontSize: '10px', color: '#666',
    }).setOrigin(0.5);

    this.iconX = iconX;
    this.iconY = iconY;
    this.iconSize = iconSize;

    // ---- Blink spell icon (right of fireball) ----
    const blinkIconX = iconX + iconSize + 24;
    const blinkIconY = iconY;

    this.blinkBg = this.add.graphics();
    this.blinkBg.fillStyle(0x1a1a3e, 0.8);
    this.blinkBg.fillRoundedRect(blinkIconX - iconSize / 2 - 4, blinkIconY - iconSize / 2 - 4, iconSize + 8, iconSize + 8, 8);
    this.blinkBg.lineStyle(2, 0x4fc3f7, 0.6);
    this.blinkBg.strokeRoundedRect(blinkIconX - iconSize / 2 - 4, blinkIconY - iconSize / 2 - 4, iconSize + 8, iconSize + 8, 8);

    this.blinkIcon = this.add.graphics();
    this._drawBlinkIcon(blinkIconX, blinkIconY, iconSize);

    this.blinkCooldownOverlay = this.add.graphics().setDepth(10);
    this.blinkCooldownText = this.add.text(blinkIconX, blinkIconY, '', {
      fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(11);

    this.add.text(blinkIconX, blinkIconY + iconSize / 2 + 12, 'Blink', {
      fontSize: '11px', color: '#aaa',
    }).setOrigin(0.5);
    this.add.text(blinkIconX, blinkIconY - iconSize / 2 - 14, 'SPACE', {
      fontSize: '10px', color: '#666',
    }).setOrigin(0.5);

    this.blinkIconX = blinkIconX;
    this.blinkIconY = blinkIconY;
    this.lastBlinkCastTime = 0;

    // ---- Round text ----
    this.roundText = this.add.text(w / 2, 20, '', {
      fontSize: '18px', color: '#888', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(20);

    // ---- Countdown text ----
    this.countdownText = this.add.text(w / 2, h / 2, '', {
      fontSize: '72px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(30).setVisible(false);

    // ---- Round over text ----
    this.roundOverText = this.add.text(w / 2, h / 2 - 50, '', {
      fontSize: '36px', color: '#e94560', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // ---- Scoreboard (always visible, top-left) ----
    this.scoreboardGraphics = this.add.graphics().setDepth(40);
    this.scoreboardTexts = [];

    // ---- Game over container ----
    this.gameOverContainer = this.add.container(w / 2, h / 2).setDepth(60).setVisible(false);

    // ---- Power-up selection ----
    this.powerUpContainer = this.add.container(w / 2, h / 2).setDepth(60).setVisible(false);
    this.powerUpActive = false;

    // ---- Events from GameScene ----
    const gameScene = this.scene.get('GameScene');

    gameScene.events.on('game-started', (data) => {
      this.playerInfo = data.players;
      this.scores = data.scores;
      this.winsToWin = data.winsToWin;
      this._drawScoreboard();
    });

    gameScene.events.on('fireball-cast', (castTime) => {
      this.lastCastTime = castTime;
    });

    gameScene.events.on('blink-cast', (castTime) => {
      this.lastBlinkCastTime = castTime;
    });

    gameScene.events.on('round-start', (roundNum) => {
      this.roundText.setText(`Round ${roundNum}`);
      this.roundOverText.setVisible(false);
      this.powerUpContainer.setVisible(false);
      this.gameOverContainer.setVisible(false);
      this.powerUpActive = false;
    });

    gameScene.events.on('countdown', (num) => {
      if (num > 0) {
        this.countdownText.setText(num.toString());
        this.countdownText.setVisible(true);
        this.countdownText.setScale(1.5);
        this.countdownText.setAlpha(1);
        this.tweens.add({
          targets: this.countdownText,
          scale: 1, alpha: 0.3,
          duration: 800, ease: 'Power2',
        });
      } else {
        this.countdownText.setText('FIGHT!');
        this.countdownText.setVisible(true);
        this.countdownText.setScale(1.5);
        this.countdownText.setAlpha(1);
        this.tweens.add({
          targets: this.countdownText,
          scale: 0.8, alpha: 0,
          duration: 600, ease: 'Power2',
          onComplete: () => this.countdownText.setVisible(false),
        });
      }
    });

    gameScene.events.on('round-over', (data) => {
      this.roundOverText.setText(`${data.winnerName} wins the round!`);
      this.roundOverText.setVisible(true);
      this.scores = data.scores;
      this.winsToWin = data.winsToWin;
      this._drawScoreboard();
    });

    gameScene.events.on('game-over', (data) => {
      this._showGameOver(data);
    });

    gameScene.events.on('game-extended', (data) => {
      this.winsToWin = data.winsToWin;
      this._drawScoreboard();
    });

    gameScene.events.on('show-powerup-selection', () => {
      this._showPowerUpCards();
    });
  }

  // ---- Scoreboard ----

  _drawScoreboard() {
    this.scoreboardGraphics.clear();
    this.scoreboardTexts.forEach((t) => t.destroy());
    this.scoreboardTexts = [];

    const x = SCOREBOARD_X;
    let y = SCOREBOARD_Y;

    const nameColW = 100;
    const dotsColW = this.winsToWin * (DOT_RADIUS * 2 + DOT_GAP) + 10;
    const panelW = nameColW + dotsColW + 20;
    const panelH = this.playerInfo.length * ROW_HEIGHT + 12;

    this.scoreboardGraphics.fillStyle(0x0a0a1e, 0.75);
    this.scoreboardGraphics.fillRoundedRect(x - 6, y - 6, panelW, panelH, 6);

    const sorted = [...this.playerInfo].sort((a, b) =>
      (this.scores[b.peerId] || 0) - (this.scores[a.peerId] || 0)
    );

    sorted.forEach((player, i) => {
      const rowY = y + i * ROW_HEIGHT;
      const wins = this.scores[player.peerId] || 0;
      const colorIndex = this.playerInfo.indexOf(player);
      const color = WIZARD_COLORS[colorIndex % WIZARD_COLORS.length];

      this.scoreboardGraphics.fillStyle(color, 1);
      this.scoreboardGraphics.fillCircle(x + 4, rowY + 7, 4);

      const nameText = this.add.text(x + 14, rowY, player.name, {
        fontSize: '12px', color: '#ccc',
      }).setDepth(41);
      this.scoreboardTexts.push(nameText);

      const dotsStartX = x + nameColW;
      for (let d = 0; d < this.winsToWin; d++) {
        const dotX = dotsStartX + d * (DOT_RADIUS * 2 + DOT_GAP) + DOT_RADIUS;
        const dotY = rowY + 7;

        if (d < wins) {
          this.scoreboardGraphics.fillStyle(color, 1);
          this.scoreboardGraphics.fillCircle(dotX, dotY, DOT_RADIUS);
        } else {
          this.scoreboardGraphics.lineStyle(1.5, 0x555555, 0.6);
          this.scoreboardGraphics.strokeCircle(dotX, dotY, DOT_RADIUS);
        }
      }
    });
  }

  // ---- Game Over ----

  _showGameOver(data) {
    this.gameOverContainer.removeAll(true);
    this.gameOverContainer.setVisible(true);

    const dimBg = this.add.graphics();
    dimBg.fillStyle(0x000000, 0.7);
    dimBg.fillRect(
      -this.cameras.main.width / 2, -this.cameras.main.height / 2,
      this.cameras.main.width, this.cameras.main.height
    );
    this.gameOverContainer.add(dimBg);

    const winText = this.add.text(0, -80, `${data.winnerName} wins the game!`, {
      fontSize: '36px', color: '#e94560', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.gameOverContainer.add(winText);

    const subText = this.add.text(0, -30, `First to ${data.winsToWin} round wins`, {
      fontSize: '16px', color: '#888',
    }).setOrigin(0.5);
    this.gameOverContainer.add(subText);

    // Extend button
    const extBtnW = 200;
    const extBtnH = 44;
    const extBtn = this.add.graphics();
    extBtn.fillStyle(0x0f3460, 0.95);
    extBtn.fillRoundedRect(-extBtnW / 2, 20, extBtnW, extBtnH, 8);
    extBtn.lineStyle(2, 0x4fc3f7, 0.7);
    extBtn.strokeRoundedRect(-extBtnW / 2, 20, extBtnW, extBtnH, 8);
    this.gameOverContainer.add(extBtn);

    const extLabel = this.add.text(0, 42, `Extend to ${data.winsToWin + 2} wins`, {
      fontSize: '15px', color: '#4fc3f7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.gameOverContainer.add(extLabel);

    const extZone = this.add.zone(0, 42, extBtnW, extBtnH).setInteractive({ useHandCursor: true });
    this.gameOverContainer.add(extZone);
    extZone.on('pointerover', () => {
      extBtn.clear();
      extBtn.fillStyle(0x163d6e, 0.95); extBtn.fillRoundedRect(-extBtnW / 2, 20, extBtnW, extBtnH, 8);
      extBtn.lineStyle(3, 0x4fc3f7, 1); extBtn.strokeRoundedRect(-extBtnW / 2, 20, extBtnW, extBtnH, 8);
    });
    extZone.on('pointerout', () => {
      extBtn.clear();
      extBtn.fillStyle(0x0f3460, 0.95); extBtn.fillRoundedRect(-extBtnW / 2, 20, extBtnW, extBtnH, 8);
      extBtn.lineStyle(2, 0x4fc3f7, 0.7); extBtn.strokeRoundedRect(-extBtnW / 2, 20, extBtnW, extBtnH, 8);
    });
    extZone.on('pointerdown', () => {
      this.gameOverContainer.setVisible(false);
      this.roundOverText.setVisible(false);
      this.scene.get('GameScene').extendGame();
    });

    // Back to lobby
    const newBtnW = 200;
    const newBtnH = 44;
    const newBtn = this.add.graphics();
    newBtn.fillStyle(0x3b1226, 0.95);
    newBtn.fillRoundedRect(-newBtnW / 2, 80, newBtnW, newBtnH, 8);
    newBtn.lineStyle(2, 0xe94560, 0.7);
    newBtn.strokeRoundedRect(-newBtnW / 2, 80, newBtnW, newBtnH, 8);
    this.gameOverContainer.add(newBtn);

    const newLabel = this.add.text(0, 102, 'Back to Lobby', {
      fontSize: '15px', color: '#e94560', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.gameOverContainer.add(newLabel);

    const newZone = this.add.zone(0, 102, newBtnW, newBtnH).setInteractive({ useHandCursor: true });
    this.gameOverContainer.add(newZone);
    newZone.on('pointerover', () => {
      newBtn.clear();
      newBtn.fillStyle(0x4e1830, 0.95); newBtn.fillRoundedRect(-newBtnW / 2, 80, newBtnW, newBtnH, 8);
      newBtn.lineStyle(3, 0xe94560, 1); newBtn.strokeRoundedRect(-newBtnW / 2, 80, newBtnW, newBtnH, 8);
    });
    newZone.on('pointerout', () => {
      newBtn.clear();
      newBtn.fillStyle(0x3b1226, 0.95); newBtn.fillRoundedRect(-newBtnW / 2, 80, newBtnW, newBtnH, 8);
      newBtn.lineStyle(2, 0xe94560, 0.7); newBtn.strokeRoundedRect(-newBtnW / 2, 80, newBtnW, newBtnH, 8);
    });
    newZone.on('pointerdown', () => window.location.reload());
  }

  // ---- Power-up cards with rarity ----

  _rollUpgrades(count) {
    // Weighted random selection of upgrades by rarity
    const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
    const picked = [];

    while (picked.length < count && picked.length < UPGRADES.length) {
      // Roll a rarity
      let roll = Math.random() * totalWeight;
      let rarity = 'common';
      for (const [r, w] of Object.entries(RARITY_WEIGHTS)) {
        roll -= w;
        if (roll <= 0) { rarity = r; break; }
      }

      // Get upgrades of this rarity that aren't already picked
      const pool = UPGRADES.filter(
        (u) => u.rarity === rarity && !picked.find((p) => p.id === u.id)
      );

      if (pool.length > 0) {
        picked.push(pool[Math.floor(Math.random() * pool.length)]);
      }
      // If no upgrades left in that rarity, re-roll (loop continues)
    }

    return picked;
  }

  _showPowerUpCards() {
    this.powerUpContainer.removeAll(true);
    this.powerUpActive = true;
    this.powerUpContainer.setVisible(true);

    const options = this._rollUpgrades(4);

    const dimBg = this.add.graphics();
    dimBg.fillStyle(0x000000, 0.6);
    dimBg.fillRect(
      -this.cameras.main.width / 2, -this.cameras.main.height / 2,
      this.cameras.main.width, this.cameras.main.height
    );
    this.powerUpContainer.add(dimBg);

    const title = this.add.text(0, -180, 'Choose an Upgrade', {
      fontSize: '28px', color: '#e94560', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.powerUpContainer.add(title);

    const cardW = 190;
    const cardH = 230;
    const gap = 24;
    const totalW = options.length * cardW + (options.length - 1) * gap;
    const startX = -totalW / 2 + cardW / 2;

    options.forEach((opt, i) => {
      const cx = startX + i * (cardW + gap);
      const cy = 10;
      const rarityColor = RARITY_COLORS[opt.rarity];
      const rarityLabel = RARITY_LABELS[opt.rarity];

      // Card background
      const card = this.add.graphics();
      this._drawCard(card, cx, cy, cardW, cardH, rarityColor, false);
      this.powerUpContainer.add(card);

      // Rarity stripe at top
      const stripe = this.add.graphics();
      stripe.fillStyle(rarityColor, 0.3);
      stripe.fillRect(cx - cardW / 2 + 2, cy - cardH / 2 + 2, cardW - 4, 28);
      this.powerUpContainer.add(stripe);

      // Rarity label
      const rarityText = this.add.text(cx, cy - cardH / 2 + 16, rarityLabel, {
        fontSize: '10px', color: '#' + rarityColor.toString(16).padStart(6, '0'),
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.powerUpContainer.add(rarityText);

      // Icon glow
      const icon = this.add.graphics();
      icon.fillStyle(rarityColor, 0.8);
      icon.fillCircle(cx, cy - 40, 22);
      icon.fillStyle(rarityColor, 0.3);
      icon.fillCircle(cx, cy - 40, 30);
      this.powerUpContainer.add(icon);

      // Title
      const titleText = this.add.text(cx, cy + 10, opt.title, {
        fontSize: '15px', color: '#fff', fontStyle: 'bold',
        align: 'center', wordWrap: { width: cardW - 24 },
      }).setOrigin(0.5);
      this.powerUpContainer.add(titleText);

      // Description
      const descText = this.add.text(cx, cy + 45, opt.desc, {
        fontSize: '11px', color: '#aaa', align: 'center',
        wordWrap: { width: cardW - 24 }, lineSpacing: 2,
      }).setOrigin(0.5, 0);
      this.powerUpContainer.add(descText);

      // Clickable zone
      const hitZone = this.add.zone(cx, cy, cardW, cardH).setInteractive({ useHandCursor: true });
      this.powerUpContainer.add(hitZone);

      hitZone.on('pointerover', () => {
        card.clear();
        this._drawCard(card, cx, cy, cardW, cardH, rarityColor, true);
      });
      hitZone.on('pointerout', () => {
        card.clear();
        this._drawCard(card, cx, cy, cardW, cardH, rarityColor, false);
      });
      hitZone.on('pointerdown', () => {
        this._selectUpgrade(opt.id);
      });
    });
  }

  _drawCard(g, cx, cy, w, h, color, hovered) {
    g.fillStyle(hovered ? 0x1e2d52 : 0x16213e, 0.95);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
    g.lineStyle(hovered ? 3 : 2, color, hovered ? 1 : 0.6);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
  }

  _selectUpgrade(upgradeId) {
    if (!this.powerUpActive) return;
    this.powerUpActive = false;

    const gameScene = this.scene.get('GameScene');
    gameScene.applyUpgrade(gameScene.localPlayerId, upgradeId);

    this.powerUpContainer.setVisible(false);
    gameScene.startNextRound();
  }

  // ---- Icons ----

  _drawBlinkIcon(x, y, size) {
    this.blinkIcon.fillStyle(0x4fc3f7, 0.3);
    this.blinkIcon.fillCircle(x, y, size * 0.35);
    this.blinkIcon.fillStyle(0x4fc3f7, 0.9);
    this.blinkIcon.fillTriangle(
      x, y - size * 0.3,
      x - size * 0.2, y + size * 0.1,
      x + size * 0.2, y + size * 0.1
    );
    this.blinkIcon.lineStyle(2, 0x4fc3f7, 0.5);
    this.blinkIcon.lineBetween(x - 4, y + size * 0.2, x - 4, y + size * 0.3);
    this.blinkIcon.lineBetween(x + 4, y + size * 0.2, x + 4, y + size * 0.3);
  }

  _drawFireballIcon(x, y, size) {
    this.spellIcon.fillStyle(0xff4400, 0.6);
    this.spellIcon.fillCircle(x, y, size * 0.35);
    this.spellIcon.fillStyle(0xff6600, 0.9);
    this.spellIcon.fillCircle(x, y, size * 0.25);
    this.spellIcon.fillStyle(0xffaa00, 1);
    this.spellIcon.fillCircle(x, y, size * 0.12);
  }

  update() {
    const now = Date.now();

    // Fireball cooldown (use per-player CD from GameScene)
    const gameScene = this.scene.get('GameScene');
    const localCd = gameScene._getFireballCooldown
      ? gameScene._getFireballCooldown(gameScene.localPlayerId)
      : FIREBALL_COOLDOWN;

    const elapsed = now - this.lastCastTime;
    const remaining = localCd - elapsed;

    this.cooldownOverlay.clear();

    if (remaining > 0 && this.lastCastTime > 0) {
      const pct = remaining / localCd;
      const halfSize = this.iconSize / 2 + 4;

      this.cooldownOverlay.fillStyle(0x000000, 0.6);
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + pct * Math.PI * 2;
      this.cooldownOverlay.beginPath();
      this.cooldownOverlay.moveTo(this.iconX, this.iconY);
      this.cooldownOverlay.arc(this.iconX, this.iconY, halfSize, startAngle, endAngle, false);
      this.cooldownOverlay.closePath();
      this.cooldownOverlay.fillPath();

      this.cooldownText.setText((remaining / 1000).toFixed(1));
    } else {
      this.cooldownText.setText('');
    }

    // Blink cooldown
    const blinkElapsed = now - this.lastBlinkCastTime;
    const blinkRemaining = BLINK_COOLDOWN - blinkElapsed;

    this.blinkCooldownOverlay.clear();

    if (blinkRemaining > 0 && this.lastBlinkCastTime > 0) {
      const pct = blinkRemaining / BLINK_COOLDOWN;
      const halfSize = this.iconSize / 2 + 4;

      this.blinkCooldownOverlay.fillStyle(0x000000, 0.6);
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + pct * Math.PI * 2;
      this.blinkCooldownOverlay.beginPath();
      this.blinkCooldownOverlay.moveTo(this.blinkIconX, this.blinkIconY);
      this.blinkCooldownOverlay.arc(this.blinkIconX, this.blinkIconY, halfSize, startAngle, endAngle, false);
      this.blinkCooldownOverlay.closePath();
      this.blinkCooldownOverlay.fillPath();

      this.blinkCooldownText.setText((blinkRemaining / 1000).toFixed(1));
    } else {
      this.blinkCooldownText.setText('');
    }
  }
}
