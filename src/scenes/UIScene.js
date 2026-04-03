import Phaser from 'phaser';
import { WIZARD_COLORS } from '../entities/Wizard.js';
import { UPGRADES } from './GameScene.js';
import { network } from '../network/NetworkManager.js';
import { SPELL_DEFS, SPELL_IDS, GLOBAL_UPGRADES, MAX_SPELL_SLOTS } from '../data/SpellDefinitions.js';

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
    this.scores = {};
    this.playerInfo = [];
    this.winsToWin = 5;
    this.gameMode = 'roguelike';

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

    // ---- Upgrade history panel (Tab toggle) ----
    this.upgradePanel = this.add.container(0, 0).setDepth(50).setVisible(false);
    this.upgradePanelVisible = false;

    this.input.keyboard.on('keydown-TAB', (e) => {
      e.preventDefault();
      this.upgradePanelVisible = !this.upgradePanelVisible;
      if (this.upgradePanelVisible) {
        this._buildUpgradePanel();
      }
      this.upgradePanel.setVisible(this.upgradePanelVisible);
    });

    this.add.text(w - 10, 10, '[TAB] Upgrades  [ESC] Menu', {
      fontSize: '11px', color: '#555',
    }).setOrigin(1, 0).setDepth(20);

    // ---- Escape menu ----
    this.escMenuContainer = this.add.container(w / 2, h / 2).setDepth(80).setVisible(false);
    this.escMenuVisible = false;

    this.input.keyboard.on('keydown-ESC', (e) => {
      e.preventDefault();
      this.escMenuVisible = !this.escMenuVisible;
      if (this.escMenuVisible) {
        this._buildEscMenu();
      } else {
        // Re-show powerup selection if it was active when menu opened
        if (this.powerUpActive) {
          this.powerUpContainer.setVisible(true);
        }
      }
      this.escMenuContainer.setVisible(this.escMenuVisible);
    });

    // ---- Game over container ----
    this.gameOverContainer = this.add.container(w / 2, h / 2).setDepth(60).setVisible(false);

    // ---- Power-up selection ----
    this.powerUpContainer = this.add.container(w / 2, h / 2).setDepth(60).setVisible(false);
    this.powerUpActive = false;

    // ---- Shop container (arena mode) ----
    this.shopContainer = this.add.container(w / 2, h / 2).setDepth(65).setVisible(false);

    // ---- Spell slots HUD (arena mode, bottom center) ----
    this.spellSlotsContainer = this.add.container(w / 2, h - 50).setDepth(25).setVisible(false);
    this.currentSpells = ['fireball'];
    this.activeSpellSlot = 0;

    // ---- Gold display (arena mode, top right) ----
    this.goldText = this.add.text(w - 10, 30, '', {
      fontSize: '14px', color: '#ffa726', fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(20).setVisible(false);

    // ---- Events from GameScene ----
    const gameScene = this.scene.get('GameScene');

    gameScene.events.on('game-started', (data) => {
      this.playerInfo = data.players;
      this.scores = data.scores;
      this.winsToWin = data.winsToWin;
      this.gameMode = data.gameMode || 'roguelike';
      // Reset UI state
      this.powerUpActive = false;
      this.escMenuVisible = false;
      this.powerUpContainer.setVisible(false);
      this.escMenuContainer.setVisible(false);
      this.gameOverContainer.setVisible(false);
      this.shopContainer.setVisible(false);
      this._drawScoreboard();
      // Arena mode: show spell slots and gold
      if (this.gameMode === 'arena') {
        this.spellSlotsContainer.setVisible(true);
        this.goldText.setVisible(true);
        this._drawSpellSlots();
        this._updateGoldDisplay(0);
      }
    });

    gameScene.events.on('round-start', (roundNum) => {
      this.roundText.setText(`Round ${roundNum}`);
      this.roundOverText.setVisible(false);
      this.powerUpContainer.setVisible(false);
      this.gameOverContainer.setVisible(false);
      this.shopContainer.setVisible(false);
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

    gameScene.events.on('upgrade-waiting', (data) => {
      if (data.remaining === 0) {
        // All picked — hide the container (round will start shortly)
        this.powerUpContainer.setVisible(false);
      } else if (this.waitingSubText) {
        this.waitingSubText.setText(`${data.remaining} of ${data.total} players still choosing...`);
      }
    });

    gameScene.events.on('show-powerup-selection', () => {
      this._showPowerUpCards();
    });

    gameScene.events.on('winner-skip-upgrade', () => {
      this._showWinnerWaiting();
    });

    // Arena mode: shop events
    gameScene.events.on('show-shop', (data) => {
      if (this.gameMode === 'arena') {
        this._showShop(data);
      }
    });

    gameScene.events.on('shop-closed', () => {
      this.shopContainer.setVisible(false);
    });

    gameScene.events.on('shop-update', (data) => {
      if (this.gameMode === 'arena' && this.shopContainer.visible) {
        this._shopData = data;
        this._showShop(data);
      }
    });

    gameScene.events.on('spell-switched', (data) => {
      this.currentSpells = data.spells;
      this.activeSpellSlot = data.activeSlot;
      this._drawSpellSlots();
    });

    // Clean up listeners on shutdown to prevent duplicates on reconnect
    this.events.on('shutdown', () => {
      gameScene.events.off('game-started');
      gameScene.events.off('round-start');
      gameScene.events.off('countdown');
      gameScene.events.off('round-over');
      gameScene.events.off('game-over');
      gameScene.events.off('game-extended');
      gameScene.events.off('upgrade-waiting');
      gameScene.events.off('show-powerup-selection');
      gameScene.events.off('winner-skip-upgrade');
      gameScene.events.off('show-shop');
      gameScene.events.off('shop-closed');
      gameScene.events.off('shop-update');
      gameScene.events.off('spell-switched');
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

  // ---- Upgrade History Panel ----

  _buildUpgradePanel() {
    this.upgradePanel.removeAll(true);

    const gameScene = this.scene.get('GameScene');
    const history = gameScene.getUpgradeHistory();
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Dim background
    const dimBg = this.add.graphics();
    dimBg.fillStyle(0x000000, 0.7);
    dimBg.fillRect(0, 0, w, h);
    this.upgradePanel.add(dimBg);

    // Title
    const title = this.add.text(w / 2, 30, 'Player Upgrades', {
      fontSize: '24px', color: '#e94560', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.upgradePanel.add(title);

    const colWidth = Math.min(240, (w - 40) / this.playerInfo.length);
    const startX = (w - colWidth * this.playerInfo.length) / 2;

    this.playerInfo.forEach((player, pIdx) => {
      const cx = startX + pIdx * colWidth + colWidth / 2;
      const colorIndex = pIdx;
      const color = WIZARD_COLORS[colorIndex % WIZARD_COLORS.length];
      const upgrades = history[player.peerId] || [];

      // Player column background
      const colBg = this.add.graphics();
      colBg.fillStyle(0x16213e, 0.8);
      colBg.fillRoundedRect(cx - colWidth / 2 + 4, 55, colWidth - 8, h - 100, 6);
      colBg.lineStyle(1, color, 0.4);
      colBg.strokeRoundedRect(cx - colWidth / 2 + 4, 55, colWidth - 8, h - 100, 6);
      this.upgradePanel.add(colBg);

      // Player name with color dot
      const dot = this.add.graphics();
      dot.fillStyle(color, 1);
      dot.fillCircle(cx - 40, 75, 5);
      this.upgradePanel.add(dot);

      const nameText = this.add.text(cx - 30, 68, player.name, {
        fontSize: '13px', color: '#fff', fontStyle: 'bold',
      });
      this.upgradePanel.add(nameText);

      // List upgrades
      if (upgrades.length === 0) {
        const none = this.add.text(cx, 100, 'No upgrades', {
          fontSize: '11px', color: '#555',
        }).setOrigin(0.5, 0);
        this.upgradePanel.add(none);
      } else {
        upgrades.forEach((uid, i) => {
          const def = UPGRADES.find((u) => u.id === uid);
          if (!def) return;

          const uy = 98 + i * 26;
          const rarityColor = RARITY_COLORS[def.rarity];

          // Rarity dot
          const rdot = this.add.graphics();
          rdot.fillStyle(rarityColor, 1);
          rdot.fillCircle(cx - colWidth / 2 + 16, uy + 7, 3);
          this.upgradePanel.add(rdot);

          const uText = this.add.text(cx - colWidth / 2 + 24, uy, def.title, {
            fontSize: '11px',
            color: '#' + rarityColor.toString(16).padStart(6, '0'),
          });
          this.upgradePanel.add(uText);
        });
      }
    });
  }

  // ---- Escape Menu ----

  _buildEscMenu() {
    this.escMenuContainer.removeAll(true);
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Dim background
    const dimBg = this.add.graphics();
    dimBg.fillStyle(0x000000, 0.7);
    dimBg.fillRect(-w / 2, -h / 2, w, h);
    this.escMenuContainer.add(dimBg);

    // Panel
    const panelW = 280;
    const panelH = 200;
    const panel = this.add.graphics();
    panel.fillStyle(0x16213e, 0.95);
    panel.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
    panel.lineStyle(2, 0xe94560, 0.7);
    panel.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
    this.escMenuContainer.add(panel);

    // Title
    const title = this.add.text(0, -panelH / 2 + 28, 'Menu', {
      fontSize: '24px', color: '#e94560', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.escMenuContainer.add(title);

    // Resume button
    const btnW = 200;
    const btnH = 40;

    const resumeBtn = this.add.graphics();
    resumeBtn.fillStyle(0x0f3460, 0.95);
    resumeBtn.fillRoundedRect(-btnW / 2, -15, btnW, btnH, 8);
    resumeBtn.lineStyle(2, 0x4fc3f7, 0.7);
    resumeBtn.strokeRoundedRect(-btnW / 2, -15, btnW, btnH, 8);
    this.escMenuContainer.add(resumeBtn);

    const resumeLabel = this.add.text(0, 5, 'Resume', {
      fontSize: '15px', color: '#4fc3f7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.escMenuContainer.add(resumeLabel);

    const resumeZone = this.add.zone(0, 5, btnW, btnH).setInteractive({ useHandCursor: true });
    this.escMenuContainer.add(resumeZone);
    resumeZone.on('pointerover', () => {
      resumeBtn.clear();
      resumeBtn.fillStyle(0x163d6e, 0.95); resumeBtn.fillRoundedRect(-btnW / 2, -15, btnW, btnH, 8);
      resumeBtn.lineStyle(3, 0x4fc3f7, 1); resumeBtn.strokeRoundedRect(-btnW / 2, -15, btnW, btnH, 8);
    });
    resumeZone.on('pointerout', () => {
      resumeBtn.clear();
      resumeBtn.fillStyle(0x0f3460, 0.95); resumeBtn.fillRoundedRect(-btnW / 2, -15, btnW, btnH, 8);
      resumeBtn.lineStyle(2, 0x4fc3f7, 0.7); resumeBtn.strokeRoundedRect(-btnW / 2, -15, btnW, btnH, 8);
    });
    resumeZone.on('pointerdown', () => {
      this.escMenuVisible = false;
      this.escMenuContainer.setVisible(false);
    });

    // Main Menu button
    const menuBtn = this.add.graphics();
    menuBtn.fillStyle(0x3b1226, 0.95);
    menuBtn.fillRoundedRect(-btnW / 2, 40, btnW, btnH, 8);
    menuBtn.lineStyle(2, 0xe94560, 0.7);
    menuBtn.strokeRoundedRect(-btnW / 2, 40, btnW, btnH, 8);
    this.escMenuContainer.add(menuBtn);

    const menuLabel = this.add.text(0, 60, 'Return to Main Menu', {
      fontSize: '15px', color: '#e94560', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.escMenuContainer.add(menuLabel);

    const menuZone = this.add.zone(0, 60, btnW, btnH).setInteractive({ useHandCursor: true });
    this.escMenuContainer.add(menuZone);
    menuZone.on('pointerover', () => {
      menuBtn.clear();
      menuBtn.fillStyle(0x4e1830, 0.95); menuBtn.fillRoundedRect(-btnW / 2, 40, btnW, btnH, 8);
      menuBtn.lineStyle(3, 0xe94560, 1); menuBtn.strokeRoundedRect(-btnW / 2, 40, btnW, btnH, 8);
    });
    menuZone.on('pointerout', () => {
      menuBtn.clear();
      menuBtn.fillStyle(0x3b1226, 0.95); menuBtn.fillRoundedRect(-btnW / 2, 40, btnW, btnH, 8);
      menuBtn.lineStyle(2, 0xe94560, 0.7); menuBtn.strokeRoundedRect(-btnW / 2, 40, btnW, btnH, 8);
    });
    menuZone.on('pointerdown', () => {
      window.location.reload();
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
    const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
    const picked = [];

    while (picked.length < count && picked.length < UPGRADES.length) {
      let roll = Math.random() * totalWeight;
      let rarity = 'common';
      for (const [r, w] of Object.entries(RARITY_WEIGHTS)) {
        roll -= w;
        if (roll <= 0) { rarity = r; break; }
      }

      const pool = UPGRADES.filter(
        (u) => u.rarity === rarity && !picked.find((p) => p.id === u.id)
      );

      if (pool.length > 0) {
        picked.push(pool[Math.floor(Math.random() * pool.length)]);
      }
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

      const card = this.add.graphics();
      this._drawCard(card, cx, cy, cardW, cardH, rarityColor, false);
      this.powerUpContainer.add(card);

      const stripe = this.add.graphics();
      stripe.fillStyle(rarityColor, 0.3);
      stripe.fillRect(cx - cardW / 2 + 2, cy - cardH / 2 + 2, cardW - 4, 28);
      this.powerUpContainer.add(stripe);

      const rarityText = this.add.text(cx, cy - cardH / 2 + 16, rarityLabel, {
        fontSize: '10px', color: '#' + rarityColor.toString(16).padStart(6, '0'),
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.powerUpContainer.add(rarityText);

      const icon = this.add.graphics();
      icon.fillStyle(rarityColor, 0.8);
      icon.fillCircle(cx, cy - 40, 22);
      icon.fillStyle(rarityColor, 0.3);
      icon.fillCircle(cx, cy - 40, 30);
      this.powerUpContainer.add(icon);

      const titleText = this.add.text(cx, cy + 10, opt.title, {
        fontSize: '15px', color: '#fff', fontStyle: 'bold',
        align: 'center', wordWrap: { width: cardW - 24 },
      }).setOrigin(0.5);
      this.powerUpContainer.add(titleText);

      const descText = this.add.text(cx, cy + 45, opt.desc, {
        fontSize: '11px', color: '#aaa', align: 'center',
        wordWrap: { width: cardW - 24 }, lineSpacing: 2,
      }).setOrigin(0.5, 0);
      this.powerUpContainer.add(descText);

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

  // ---- Arena Mode: Spell Slots HUD ----

  _drawSpellSlots() {
    this.spellSlotsContainer.removeAll(true);
    const slotSize = 44;
    const gap = 6;
    const totalW = MAX_SPELL_SLOTS * slotSize + (MAX_SPELL_SLOTS - 1) * gap;
    const startX = -totalW / 2 + slotSize / 2;

    for (let i = 0; i < MAX_SPELL_SLOTS; i++) {
      const cx = startX + i * (slotSize + gap);
      const spellId = this.currentSpells[i];
      const def = spellId ? SPELL_DEFS[spellId] : null;
      const isActive = i === this.activeSpellSlot;

      const bg = this.add.graphics();
      bg.fillStyle(def ? 0x16213e : 0x0a0a1e, 0.9);
      bg.fillRoundedRect(cx - slotSize / 2, -slotSize / 2, slotSize, slotSize, 6);
      bg.lineStyle(isActive ? 3 : 1, isActive ? 0xe94560 : 0x333333, isActive ? 1 : 0.5);
      bg.strokeRoundedRect(cx - slotSize / 2, -slotSize / 2, slotSize, slotSize, 6);
      this.spellSlotsContainer.add(bg);

      if (def) {
        const icon = this.add.graphics();
        icon.fillStyle(def.color, 0.8);
        icon.fillCircle(cx, 0, 12);
        icon.fillStyle(def.color, 0.3);
        icon.fillCircle(cx, 0, 16);
        this.spellSlotsContainer.add(icon);
      }

      // Key number label
      const keyText = this.add.text(cx - slotSize / 2 + 4, -slotSize / 2 + 2, `${i + 1}`, {
        fontSize: '9px', color: '#666',
      });
      this.spellSlotsContainer.add(keyText);
    }
  }

  _updateGoldDisplay(gold) {
    this.goldText.setText(`Gold: ${gold}`);
  }

  // ---- Arena Mode: Shop ----

  _showShop(data) {
    this.shopContainer.removeAll(true);
    this.shopContainer.setVisible(true);

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const gameScene = this.scene.get('GameScene');
    const localId = network.localPlayerId || gameScene.localPlayerId;
    const gold = data.gold ? (data.gold[localId] || 0) : 0;
    const spellData = data.playerSpellData ? data.playerSpellData[localId] : null;
    const ownedSpells = spellData ? spellData.spells : ['fireball'];
    const purchased = spellData ? spellData.purchasedUpgrades || [] : [];

    this._updateGoldDisplay(gold);

    // Dim background
    const dimBg = this.add.graphics();
    dimBg.fillStyle(0x000000, 0.7);
    dimBg.fillRect(-w / 2, -h / 2, w, h);
    this.shopContainer.add(dimBg);

    // Title and gold
    const title = this.add.text(0, -h / 2 + 25, 'SHOP', {
      fontSize: '28px', color: '#e94560', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.shopContainer.add(title);

    const goldLabel = this.add.text(0, -h / 2 + 55, `Gold: ${gold}`, {
      fontSize: '16px', color: '#ffa726', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.shopContainer.add(goldLabel);

    // --- Spells section (left side) ---
    const spellsLabel = this.add.text(-w / 2 + 30, -h / 2 + 85, 'SPELLS', {
      fontSize: '14px', color: '#4fc3f7', fontStyle: 'bold',
    });
    this.shopContainer.add(spellsLabel);

    const buyableSpells = SPELL_IDS.filter((id) => id !== 'fireball');
    const cardW = 140;
    const cardH = 150;
    const spellStartX = -w / 2 + 30 + cardW / 2;

    buyableSpells.forEach((spellId, i) => {
      const def = SPELL_DEFS[spellId];
      const cx = spellStartX + i * (cardW + 10) - w / 2 + w / 2;
      const cy = -h / 2 + 180;
      const owned = ownedSpells.includes(spellId);
      const slotsFull = ownedSpells.length >= MAX_SPELL_SLOTS;
      const canBuy = !owned && !slotsFull && gold >= def.shopPrice;

      const card = this.add.graphics();
      card.fillStyle(owned ? 0x1a3a1a : 0x16213e, 0.95);
      card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
      card.lineStyle(2, def.color, owned ? 0.3 : 0.7);
      card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
      this.shopContainer.add(card);

      // Spell icon
      const icon = this.add.graphics();
      icon.fillStyle(def.color, owned ? 0.3 : 0.8);
      icon.fillCircle(cx, cy - 30, 16);
      this.shopContainer.add(icon);

      // Name
      const nameText = this.add.text(cx, cy + 5, def.name, {
        fontSize: '12px', color: owned ? '#555' : '#fff', fontStyle: 'bold',
      }).setOrigin(0.5);
      this.shopContainer.add(nameText);

      // Desc
      const descText = this.add.text(cx, cy + 22, def.desc, {
        fontSize: '9px', color: '#888', align: 'center',
        wordWrap: { width: cardW - 16 },
      }).setOrigin(0.5, 0);
      this.shopContainer.add(descText);

      // Price or OWNED
      const priceText = this.add.text(cx, cy + cardH / 2 - 16, owned ? 'OWNED' : `${def.shopPrice}g`, {
        fontSize: '11px', color: owned ? '#4a4' : (canBuy ? '#ffa726' : '#666'), fontStyle: 'bold',
      }).setOrigin(0.5);
      this.shopContainer.add(priceText);

      if (!owned && !slotsFull) {
        const zone = this.add.zone(cx, cy, cardW, cardH).setInteractive({ useHandCursor: true });
        this.shopContainer.add(zone);
        zone.on('pointerover', () => {
          card.clear();
          card.fillStyle(0x1e2d52, 0.95);
          card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
          card.lineStyle(3, def.color, 1);
          card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
        });
        zone.on('pointerout', () => {
          card.clear();
          card.fillStyle(0x16213e, 0.95);
          card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
          card.lineStyle(2, def.color, 0.7);
          card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
        });
        zone.on('pointerdown', () => {
          if (network.isHost) {
            gameScene.submitShopBuySpell(spellId);
          } else {
            gameScene.sendShopBuySpell(spellId);
          }
        });
      }
    });

    // --- Upgrades section (below spells) ---
    const upgLabel = this.add.text(-w / 2 + 30, -h / 2 + 270, 'UPGRADES', {
      fontSize: '14px', color: '#4fc3f7', fontStyle: 'bold',
    });
    this.shopContainer.add(upgLabel);

    let rowY = -h / 2 + 295;
    const rowH = 28;
    const rowW = w - 80;

    // Per-spell upgrades
    ownedSpells.forEach((spellId) => {
      const def = SPELL_DEFS[spellId];
      if (!def) return;

      const headerText = this.add.text(-w / 2 + 40, rowY, def.name, {
        fontSize: '11px', color: '#' + def.color.toString(16).padStart(6, '0'), fontStyle: 'bold',
      });
      this.shopContainer.add(headerText);
      rowY += 20;

      def.upgrades.forEach((upg) => {
        const count = purchased.filter((id) => id === upg.id).length;
        const maxed = upg.maxStacks && count >= upg.maxStacks;
        const canAfford = gold >= upg.price;

        const rowBg = this.add.graphics();
        rowBg.fillStyle(0x0f1a2e, 0.8);
        rowBg.fillRoundedRect(-w / 2 + 35, rowY, rowW, rowH, 4);
        this.shopContainer.add(rowBg);

        const upgName = this.add.text(-w / 2 + 45, rowY + 6, `${upg.title} — ${upg.desc}`, {
          fontSize: '10px', color: maxed ? '#555' : '#ccc',
        });
        this.shopContainer.add(upgName);

        if (count > 0) {
          const countText = this.add.text(w / 2 - 100, rowY + 6, `x${count}`, {
            fontSize: '10px', color: '#888',
          });
          this.shopContainer.add(countText);
        }

        const priceLabel = this.add.text(w / 2 - 55, rowY + 6, maxed ? 'MAX' : `${upg.price}g`, {
          fontSize: '10px', color: maxed ? '#555' : (canAfford ? '#ffa726' : '#666'), fontStyle: 'bold',
        });
        this.shopContainer.add(priceLabel);

        if (!maxed) {
          const zone = this.add.zone(0, rowY + rowH / 2, rowW, rowH).setInteractive({ useHandCursor: true });
          this.shopContainer.add(zone);
          zone.on('pointerover', () => {
            rowBg.clear(); rowBg.fillStyle(0x1a2640, 0.9); rowBg.fillRoundedRect(-w / 2 + 35, rowY, rowW, rowH, 4);
          });
          zone.on('pointerout', () => {
            rowBg.clear(); rowBg.fillStyle(0x0f1a2e, 0.8); rowBg.fillRoundedRect(-w / 2 + 35, rowY, rowW, rowH, 4);
          });
          zone.on('pointerdown', () => {
            if (network.isHost) {
              gameScene.submitShopBuyUpgrade(upg.id);
            } else {
              gameScene.sendShopBuyUpgrade(upg.id);
            }
          });
        }

        rowY += rowH + 3;
      });

      rowY += 8;
    });

    // Global upgrades
    const globalLabel = this.add.text(-w / 2 + 40, rowY, 'General', {
      fontSize: '11px', color: '#888', fontStyle: 'bold',
    });
    this.shopContainer.add(globalLabel);
    rowY += 20;

    GLOBAL_UPGRADES.forEach((upg) => {
      const count = purchased.filter((id) => id === upg.id).length;
      const maxed = upg.maxStacks && count >= upg.maxStacks;
      const canAfford = gold >= upg.price;

      const rowBg = this.add.graphics();
      rowBg.fillStyle(0x0f1a2e, 0.8);
      rowBg.fillRoundedRect(-w / 2 + 35, rowY, rowW, rowH, 4);
      this.shopContainer.add(rowBg);

      const upgName = this.add.text(-w / 2 + 45, rowY + 6, `${upg.title} — ${upg.desc}`, {
        fontSize: '10px', color: maxed ? '#555' : '#ccc',
      });
      this.shopContainer.add(upgName);

      const priceLabel = this.add.text(w / 2 - 55, rowY + 6, maxed ? 'MAX' : `${upg.price}g`, {
        fontSize: '10px', color: maxed ? '#555' : (canAfford ? '#ffa726' : '#666'), fontStyle: 'bold',
      });
      this.shopContainer.add(priceLabel);

      if (!maxed) {
        const zone = this.add.zone(0, rowY + rowH / 2, rowW, rowH).setInteractive({ useHandCursor: true });
        this.shopContainer.add(zone);
        zone.on('pointerover', () => {
          rowBg.clear(); rowBg.fillStyle(0x1a2640, 0.9); rowBg.fillRoundedRect(-w / 2 + 35, rowY, rowW, rowH, 4);
        });
        zone.on('pointerout', () => {
          rowBg.clear(); rowBg.fillStyle(0x0f1a2e, 0.8); rowBg.fillRoundedRect(-w / 2 + 35, rowY, rowW, rowH, 4);
        });
        zone.on('pointerdown', () => {
          if (network.isHost) {
            gameScene.submitShopBuyUpgrade(upg.id);
          } else {
            gameScene.sendShopBuyUpgrade(upg.id);
          }
        });
      }

      rowY += rowH + 3;
    });
  }

  _showWinnerWaiting() {
    this.powerUpContainer.removeAll(true);
    this.powerUpContainer.setVisible(true);

    const dimBg = this.add.graphics();
    dimBg.fillStyle(0x000000, 0.6);
    dimBg.fillRect(
      -this.cameras.main.width / 2, -this.cameras.main.height / 2,
      this.cameras.main.width, this.cameras.main.height
    );
    this.powerUpContainer.add(dimBg);

    const skipText = this.add.text(0, -20, 'You won the round!', {
      fontSize: '26px', color: '#e94560', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.powerUpContainer.add(skipText);

    this.waitingText = this.add.text(0, 20, 'Others are choosing upgrades...', {
      fontSize: '16px', color: '#888',
    }).setOrigin(0.5);
    this.powerUpContainer.add(this.waitingText);

    this.waitingSubText = this.add.text(0, 48, '', {
      fontSize: '14px', color: '#555',
    }).setOrigin(0.5);
    this.powerUpContainer.add(this.waitingSubText);
  }

  _drawCard(g, cx, cy, w, h, color, hovered) {
    g.fillStyle(hovered ? 0x1e2d52 : 0x16213e, 0.95);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
    g.lineStyle(hovered ? 3 : 2, color, hovered ? 1 : 0.6);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
  }

  _selectUpgrade(upgradeId) {
    if (!this.powerUpActive || this.escMenuVisible) return;
    this.powerUpActive = false;

    const gameScene = this.scene.get('GameScene');

    if (network.isHost) {
      gameScene.submitLocalUpgrade(upgradeId);
    } else {
      gameScene.sendUpgradeChoice(upgradeId);
    }

    // Replace cards with waiting message
    this.powerUpContainer.removeAll(true);

    const dimBg = this.add.graphics();
    dimBg.fillStyle(0x000000, 0.6);
    dimBg.fillRect(
      -this.cameras.main.width / 2, -this.cameras.main.height / 2,
      this.cameras.main.width, this.cameras.main.height
    );
    this.powerUpContainer.add(dimBg);

    this.waitingText = this.add.text(0, -10, 'Waiting for other players...', {
      fontSize: '22px', color: '#888', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.powerUpContainer.add(this.waitingText);

    this.waitingSubText = this.add.text(0, 25, '', {
      fontSize: '14px', color: '#555',
    }).setOrigin(0.5);
    this.powerUpContainer.add(this.waitingSubText);
  }
}
