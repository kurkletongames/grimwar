import Phaser from 'phaser';
import { WIZARD_COLORS } from '../entities/Wizard.js';
import { UPGRADES } from './GameScene.js';
import { network } from '../network/NetworkManager.js';
import { SPELL_DEFS, BLINK_DEFS, GLOBAL_UPGRADES, SPELL_CATEGORIES, SLOT_KEYS, SPELLS_BY_CATEGORY, BLINK_IDS, MAX_SPELL_SLOTS, MAX_TIER } from '../data/SpellDefinitions.js';

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
    this.roundText = this.add.text(w / 2, 22, '', {
      fontSize: '26px', color: '#888', fontStyle: 'bold',
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

    // ---- Kill feed (top right) ----
    this._killFeed = [];
    this._killFeedTexts = [];

    // ---- KD Scoreboard (shown on TAB alongside upgrades) ----
    this._kdTexts = [];

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
    this._localReady = false;
    this._shopReadyCount = { ready: 0, total: 0 };

    // ---- Spell slots HUD (arena mode, bottom center) ----
    this.spellSlotsContainer = this.add.container(w / 2, h - 50).setDepth(25).setVisible(false);
    this.currentSlots = { fixed: 'fireball', bread_butter: null, tricky: null, power: null };
    this.activeSpellSlot = 'fixed';

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
      const modLabel = this._activeModifierName && this._activeModifierName !== 'No Modifier'
        ? ` — ${this._activeModifierName}` : '';
      this.roundText.setText(`Round ${roundNum}${modLabel}`);
      if (this._activeModifierColor && modLabel) {
        this.roundText.setColor(this._activeModifierColor);
      } else {
        this.roundText.setColor('#888');
      }
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
        this._localReady = false;
        this._shopReadyCount = { ready: 0, total: 0 };
        this._showShop(data);
      }
    });

    gameScene.events.on('shop-closed', () => {
      this.shopContainer.setVisible(false);
      if (this._shopTimerEvent) {
        this._shopTimerEvent.remove();
        this._shopTimerEvent = null;
      }
    });

    gameScene.events.on('shop-update', (data) => {
      if (this.gameMode === 'arena') {
        // Update local slot data from shop purchases
        const localId = network.localPlayerId || gameScene.localPlayerId;
        const sd = data.playerSpellData ? data.playerSpellData[localId] : null;
        if (sd && sd.slots) {
          this.currentSlots = sd.slots;
          this._drawSpellSlots();
        }
        if (this.shopContainer.visible) {
          this._shopData = data;
          this._showShop(data);
        }
      }
    });

    gameScene.events.on('shop-ready-update', (data) => {
      this._shopReadyCount = data;
      if (this._shopReadyText) {
        this._shopReadyText.setText(`${data.ready}/${data.total} Ready`);
      }
    });

    // Kill feed
    gameScene.events.on('player-kill', (data) => {
      this._addKillFeedEntry(data.killerName, data.victimName);
    });

    gameScene.events.on('spell-switched', (data) => {
      this.currentSlots = data.slots;
      this.activeSpellSlot = data.activeSlot;
      this._drawSpellSlots();
    });

    // Round modifier vote (roguelike)
    gameScene.events.on('show-modifier-vote', (data) => {
      this._showModifierVote(data);
    });
    gameScene.events.on('modifier-result', (data) => {
      this._showModifierResult(data);
    });

    // Clean up listeners and timers on shutdown
    this.events.on('shutdown', () => {
      if (this._shopTimerEvent) { this._shopTimerEvent.remove(); this._shopTimerEvent = null; }
      this._slotCooldownGraphics = [];
      this._killFeedTexts.forEach((t) => t.destroy());
      this._killFeedTexts = [];
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
      gameScene.events.off('shop-ready-update');
      gameScene.events.off('spell-switched');
      gameScene.events.off('show-modifier-vote');
      gameScene.events.off('modifier-result');
      gameScene.events.off('player-kill');
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

    // KD Scoreboard section at the bottom of upgrade panel
    const kdEntries = this._buildKDSection();
    if (kdEntries.length > 0) {
      const kdTitle = this.add.text(w / 2, h - 30 - kdEntries.length * 20, 'Kills / Deaths', {
        fontSize: '13px', color: '#e94560', fontStyle: 'bold',
      }).setOrigin(0.5);
      this.upgradePanel.add(kdTitle);

      kdEntries.forEach((e, i) => {
        const y = h - 15 - (kdEntries.length - 1 - i) * 20;
        const color = WIZARD_COLORS[e.idx % WIZARD_COLORS.length];
        const colorHex = '#' + color.toString(16).padStart(6, '0');
        const streakText = e.streak >= 3 ? ` 🔥${e.streak}` : '';
        const kdText = this.add.text(w / 2, y, `${e.name}  ${e.kills}K / ${e.deaths}D${streakText}`, {
          fontSize: '11px', color: colorHex,
        }).setOrigin(0.5);
        this.upgradePanel.add(kdText);
      });
    }
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
    this._slotCooldownGraphics = [];
    const slotSize = 44;
    const gap = 6;
    const totalW = MAX_SPELL_SLOTS * slotSize + (MAX_SPELL_SLOTS - 1) * gap;
    const startX = -totalW / 2 + slotSize / 2;

    SLOT_KEYS.forEach((cat, i) => {
      const cx = startX + i * (slotSize + gap);
      const spellId = this.currentSlots[cat];
      const def = spellId ? SPELL_DEFS[spellId] : null;
      const isActive = cat === this.activeSpellSlot;
      const catDef = SPELL_CATEGORIES[cat];

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

      // Cooldown overlay (drawn per-frame)
      const cdGraphics = this.add.graphics();
      this.spellSlotsContainer.add(cdGraphics);
      this._slotCooldownGraphics.push({ graphics: cdGraphics, cx, cy: 0, size: slotSize, cat, spellId });

      // Key number label
      const keyText = this.add.text(cx - slotSize / 2 + 4, -slotSize / 2 + 2, `${i + 1}`, {
        fontSize: '9px', color: '#666',
      });
      this.spellSlotsContainer.add(keyText);

      // Category label below slot
      const catLabel = this.add.text(cx, slotSize / 2 + 4, cat === 'fixed' ? '' : catDef.label, {
        fontSize: '7px', color: '#555',
      }).setOrigin(0.5, 0);
      this.spellSlotsContainer.add(catLabel);
    });
  }

  update() {
    // Update spell slot cooldown overlays each frame
    if (this.gameMode !== 'arena' || !this._slotCooldownGraphics) return;
    const gameScene = this.scene.get('GameScene');
    if (!gameScene || !gameScene.gameStarted) return;
    const localId = gameScene.localPlayerId;
    const now = Date.now();

    this._slotCooldownGraphics.forEach(({ graphics, cx, cy, size, cat }) => {
      graphics.clear();
      const spellId = this.currentSlots[cat];
      if (!spellId) return;

      const castKey = gameScene._getSpellCastTimeKey(localId, spellId);
      const lastCast = gameScene.spellCastTimes.get(castKey) || 0;
      const cd = gameScene._getSpellCooldown(localId, spellId);
      const elapsed = now - lastCast;
      const pct = lastCast === 0 ? 0 : Math.max(0, 1 - elapsed / cd);

      if (pct > 0) {
        // Dark overlay
        graphics.fillStyle(0x000000, 0.55);
        graphics.fillRoundedRect(cx - size / 2 + 1, cy - size / 2 + 1, size - 2, size - 2, 5);

        // Cooldown sweep arc (fills clockwise from top)
        const readyPct = 1 - pct;
        if (readyPct > 0 && readyPct < 1) {
          const def = SPELL_DEFS[spellId];
          const color = def ? def.color : 0xffffff;
          graphics.lineStyle(2, color, 0.7);
          graphics.beginPath();
          const startAngle = -Math.PI / 2;
          const endAngle = startAngle + readyPct * Math.PI * 2;
          graphics.arc(cx, cy, size / 2 - 4, startAngle, endAngle, false);
          graphics.strokePath();
        }
      }
    });
  }

  _updateGoldDisplay(gold) {
    this.goldText.setText(`Gold: ${gold}`);
  }

  // ---- Round Modifier Vote (roguelike) ----

  _showModifierVote(data) {
    this.powerUpContainer.removeAll(true);
    this.powerUpContainer.setVisible(true);

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const gameScene = this.scene.get('GameScene');
    const options = data.options || [];

    // Dim background
    const dimBg = this.add.graphics();
    dimBg.fillStyle(0x000000, 0.65);
    dimBg.fillRect(-w / 2, -h / 2, w, h);
    this.powerUpContainer.add(dimBg);

    // Title
    this.powerUpContainer.add(this.add.text(0, -150, 'VOTE: Round Modifier', {
      fontSize: '22px', color: '#e94560', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5));

    // Timer
    const timerText = this.add.text(0, -120, '10s', { fontSize: '14px', color: '#888' }).setOrigin(0.5);
    this.powerUpContainer.add(timerText);
    const startTime = Date.now();
    if (this._modifierTimerEvent) this._modifierTimerEvent.remove();
    this._modifierTimerEvent = this.time.addEvent({ delay: 500, loop: true, callback: () => {
      if (!timerText || !timerText.active) { this._modifierTimerEvent.remove(); return; }
      const rem = Math.max(0, 10 - Math.floor((Date.now() - startTime) / 1000));
      timerText.setText(`${rem}s`);
      if (rem <= 0) { this._modifierTimerEvent.remove(); this._modifierTimerEvent = null; }
    }});

    // Cards
    const cardW = 170;
    const cardH = 120;
    const gap = 16;
    const totalW = options.length * cardW + (options.length - 1) * gap;
    const startX = -totalW / 2 + cardW / 2;

    options.forEach((opt, i) => {
      const cx = startX + i * (cardW + gap);
      const cy = 0;
      const color = opt.color || 0x888888;

      const card = this.add.graphics();
      card.fillStyle(0x16213e, 0.95);
      card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
      card.lineStyle(2, color, 0.7);
      card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
      this.powerUpContainer.add(card);

      // Icon
      this.powerUpContainer.add(this.add.text(cx, cy - 30, opt.icon || '?', {
        fontSize: '24px',
      }).setOrigin(0.5));

      // Name
      this.powerUpContainer.add(this.add.text(cx, cy + 5, opt.name, {
        fontSize: '13px', color: '#fff', fontStyle: 'bold',
      }).setOrigin(0.5));

      // Desc
      this.powerUpContainer.add(this.add.text(cx, cy + 22, opt.desc, {
        fontSize: '9px', color: '#aaa', align: 'center', wordWrap: { width: cardW - 16 },
      }).setOrigin(0.5, 0));

      // Click to vote
      const zone = this.add.zone(cx, cy, cardW, cardH).setInteractive({ useHandCursor: true });
      this.powerUpContainer.add(zone);
      zone.on('pointerover', () => {
        card.clear();
        card.fillStyle(0x1e2d52, 0.95); card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
        card.lineStyle(3, color, 1); card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
      });
      zone.on('pointerout', () => {
        card.clear();
        card.fillStyle(0x16213e, 0.95); card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
        card.lineStyle(2, color, 0.7); card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
      });
      zone.on('pointerdown', () => {
        gameScene.submitModifierVote(opt.id);
        // Flash selection
        card.clear();
        card.fillStyle(0x1a3a1a, 0.95); card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
        card.lineStyle(3, 0x44ff44, 1); card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
      });
    });
  }

  _showModifierResult(data) {
    // Kill the vote timer before destroying its text target
    if (this._modifierTimerEvent) { this._modifierTimerEvent.remove(); this._modifierTimerEvent = null; }
    this.powerUpContainer.removeAll(true);
    this.powerUpContainer.setVisible(true);

    const mod = data.modifier || {};

    // Dim background
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const dimBg = this.add.graphics();
    dimBg.fillStyle(0x000000, 0.6);
    dimBg.fillRect(-w / 2, -h / 2, w, h);
    this.powerUpContainer.add(dimBg);

    // Announcement
    this.powerUpContainer.add(this.add.text(0, -30, mod.icon || '', {
      fontSize: '48px',
    }).setOrigin(0.5));

    const colorHex = mod.color ? '#' + mod.color.toString(16).padStart(6, '0') : '#fff';
    this.powerUpContainer.add(this.add.text(0, 20, mod.name || 'No Modifier', {
      fontSize: '28px', color: colorHex, fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5));

    this.powerUpContainer.add(this.add.text(0, 50, mod.desc || '', {
      fontSize: '14px', color: '#aaa',
    }).setOrigin(0.5));

    // Also set a banner text that persists during the round
    this._activeModifierName = mod.name;
    this._activeModifierColor = colorHex;
  }

  // ---- Kill Feed ----

  _addKillFeedEntry(killerName, victimName) {
    const w = this.cameras.main.width;
    const text = this.add.text(w - 15, 50 + this._killFeedTexts.length * 16, `${killerName} → ${victimName}`, {
      fontSize: '10px', color: '#e94560', fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(30).setAlpha(1);
    this._killFeedTexts.push(text);

    // Fade out after 3s
    this.tweens.add({
      targets: text, alpha: 0, duration: 1000, delay: 3000,
      onComplete: () => {
        text.destroy();
        this._killFeedTexts = this._killFeedTexts.filter((t) => t !== text);
        // Reposition remaining
        this._killFeedTexts.forEach((t, i) => t.setY(50 + i * 16));
      },
    });

    // Max 5 visible
    if (this._killFeedTexts.length > 5) {
      const old = this._killFeedTexts.shift();
      old.destroy();
      this._killFeedTexts.forEach((t, i) => t.setY(50 + i * 16));
    }
  }

  // ---- KD Scoreboard (in upgrade panel) ----

  _buildKDSection() {
    const gameScene = this.scene.get('GameScene');
    if (!gameScene || !gameScene.killStats) return [];
    const entries = [];
    this.playerInfo.forEach((player, idx) => {
      const stats = gameScene.killStats.get(player.peerId);
      if (!stats) return;
      entries.push({ name: player.name, kills: stats.kills, deaths: stats.deaths, streak: stats.streak, idx });
    });
    return entries.sort((a, b) => b.kills - a.kills);
  }

  // ---- Arena Mode: Shop ----

  _makeShopRow(rowX, rowY, rowW, rowH, label, priceStr, canAfford, onClick) {
    const rowBg = this.add.graphics();
    const draw = (state) => {
      rowBg.clear();
      if (state === 'hover') {
        rowBg.fillStyle(0x1e2d52, 0.95);
        rowBg.fillRoundedRect(rowX, rowY, rowW, rowH, 4);
        rowBg.lineStyle(1, canAfford ? 0xffa726 : 0x555555, 0.6);
        rowBg.strokeRoundedRect(rowX, rowY, rowW, rowH, 4);
      } else if (state === 'click') {
        rowBg.fillStyle(canAfford ? 0x2a3a20 : 0x3a2020, 1);
        rowBg.fillRoundedRect(rowX, rowY, rowW, rowH, 4);
      } else {
        rowBg.fillStyle(0x0f1a2e, 0.8);
        rowBg.fillRoundedRect(rowX, rowY, rowW, rowH, 4);
      }
    };
    draw('normal');
    this.shopContainer.add(rowBg);

    this.shopContainer.add(this.add.text(rowX + 10, rowY + 5, label, {
      fontSize: '10px', color: '#ccc',
    }));

    this.shopContainer.add(this.add.text(rowX + rowW - 10, rowY + 5, priceStr, {
      fontSize: '10px', color: canAfford ? '#ffa726' : '#666', fontStyle: 'bold',
    }).setOrigin(1, 0));

    const zone = this.add.zone(rowX + rowW / 2, rowY + rowH / 2, rowW, rowH).setInteractive({ useHandCursor: true });
    this.shopContainer.add(zone);
    zone.on('pointerover', () => draw('hover'));
    zone.on('pointerout', () => draw('normal'));
    zone.on('pointerdown', () => { draw('click'); onClick(); });
  }

  _showShop(data) {
    this.shopContainer.removeAll(true);
    this.shopContainer.setVisible(true);

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const gameScene = this.scene.get('GameScene');
    const localId = network.localPlayerId || gameScene.localPlayerId;
    const gold = data.gold ? (data.gold[localId] || 0) : 0;
    const sd = data.playerSpellData ? data.playerSpellData[localId] : null;
    const slots = sd ? sd.slots : { fixed: 'fireball', bread_butter: null, tricky: null, power: null };
    const tiers = sd ? sd.spellTiers || {} : {};
    const blinkId = sd ? sd.blinkId : 'default_blink';
    const blinkTier = sd ? sd.blinkTier || 0 : 0;

    this._updateGoldDisplay(gold);

    // Dim background
    const dimBg = this.add.graphics();
    dimBg.fillStyle(0x000000, 0.75);
    dimBg.fillRect(-w / 2, -h / 2, w, h);
    this.shopContainer.add(dimBg);

    // Timer + Title + Gold header
    const shopDuration = data.shopDuration || 30000;
    const startTime = Date.now();
    const timerText = this.add.text(w / 2 - 20, -h / 2 + 12, '30s', { fontSize: '12px', color: '#888' }).setOrigin(1, 0);
    this.shopContainer.add(timerText);
    if (this._shopTimerEvent) this._shopTimerEvent.remove();
    this._shopTimerEvent = this.time.addEvent({ delay: 500, loop: true, callback: () => {
      const rem = Math.max(0, Math.ceil((shopDuration - (Date.now() - startTime)) / 1000));
      timerText.setText(`${rem}s`);
      if (rem <= 0 && this._shopTimerEvent) { this._shopTimerEvent.remove(); this._shopTimerEvent = null; }
    }});

    this.shopContainer.add(this.add.text(0, -h / 2 + 12, 'SHOP', {
      fontSize: '20px', color: '#e94560', fontStyle: 'bold', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5));
    this.shopContainer.add(this.add.text(0, -h / 2 + 36, `Gold: ${gold}`, {
      fontSize: '13px', color: '#ffa726', fontStyle: 'bold',
    }).setOrigin(0.5));

    // ---- Spell category columns (compact) ----
    const categories = ['bread_butter', 'tricky', 'power'];
    const colW = (w - 40) / 3;
    const cardW = Math.min(colW - 8, 120);
    const cardH = 75;
    const colStartX = -w / 2 + 20;
    const spellTopY = -h / 2 + 54;

    categories.forEach((cat, ci) => {
      const catDef = SPELL_CATEGORIES[cat];
      const colX = colStartX + ci * colW;
      const colorHex = '#' + catDef.color.toString(16).padStart(6, '0');

      this.shopContainer.add(this.add.text(colX + colW / 2, spellTopY, catDef.label, {
        fontSize: '10px', color: colorHex, fontStyle: 'bold',
      }).setOrigin(0.5));

      const spellIds = SPELLS_BY_CATEGORY[cat];
      const equipped = slots[cat];

      spellIds.forEach((spellId, si) => {
        const def = SPELL_DEFS[spellId];
        const cx = colX + colW / 2;
        const cy = spellTopY + 16 + si * (cardH + 4) + cardH / 2;
        const isEquipped = equipped === spellId;
        const canBuy = !isEquipped && gold >= def.shopPrice;

        const card = this.add.graphics();
        const drawCard = (hover) => {
          card.clear();
          card.fillStyle(isEquipped ? 0x1a3a1a : (hover ? 0x1e2d52 : 0x16213e), 0.95);
          card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 5);
          card.lineStyle(hover ? 3 : 2, def.color, isEquipped ? 0.8 : (hover ? 1 : 0.4));
          card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 5);
        };
        drawCard(false);
        this.shopContainer.add(card);

        const icon = this.add.graphics();
        icon.fillStyle(def.color, isEquipped ? 0.9 : 0.6);
        icon.fillCircle(cx, cy - 16, 10);
        this.shopContainer.add(icon);

        this.shopContainer.add(this.add.text(cx, cy + 4, def.name, {
          fontSize: '10px', color: '#fff', fontStyle: 'bold',
        }).setOrigin(0.5));

        const priceLabel = isEquipped ? 'EQUIPPED' : `${def.shopPrice}g`;
        this.shopContainer.add(this.add.text(cx, cy + cardH / 2 - 10, priceLabel, {
          fontSize: '9px', color: isEquipped ? '#4a4' : (canBuy ? '#ffa726' : '#666'), fontStyle: 'bold',
        }).setOrigin(0.5));

        if (!isEquipped) {
          const zone = this.add.zone(cx, cy, cardW, cardH).setInteractive({ useHandCursor: true });
          this.shopContainer.add(zone);
          zone.on('pointerover', () => drawCard(true));
          zone.on('pointerout', () => drawCard(false));
          zone.on('pointerdown', () => {
            // Immediate visual feedback
            card.clear();
            card.fillStyle(0x1a3a1a, 0.95);
            card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 5);
            card.lineStyle(2, 0x44ff44, 0.8);
            card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 5);
            zone.disableInteractive();
            if (network.isHost) gameScene.submitShopBuySpell(spellId);
            else gameScene.sendShopBuySpell(spellId);
          });
        }
      });
    });

    // ---- Blink variants (compact row) ----
    const blinkTopY = spellTopY + 16 + 3 * (cardH + 4) + 10;
    this.shopContainer.add(this.add.text(0, blinkTopY, 'BLINK (Space)', {
      fontSize: '10px', color: '#4fc3f7', fontStyle: 'bold',
    }).setOrigin(0.5));

    const blinkCardW = Math.min(120, (w - 60) / 3);
    const blinkCardH = 50;
    const blinkStartX = -(BLINK_IDS.length * blinkCardW + (BLINK_IDS.length - 1) * 8) / 2 + blinkCardW / 2;

    BLINK_IDS.forEach((bid, i) => {
      const def = BLINK_DEFS[bid];
      const cx = blinkStartX + i * (blinkCardW + 8);
      const cy = blinkTopY + 14 + blinkCardH / 2;
      const isEquipped = blinkId === bid;
      const canBuy = !isEquipped && gold >= def.shopPrice;

      const card = this.add.graphics();
      const drawBCard = (hover) => {
        card.clear();
        card.fillStyle(isEquipped ? 0x1a3a1a : (hover ? 0x1e2d52 : 0x16213e), 0.95);
        card.fillRoundedRect(cx - blinkCardW / 2, cy - blinkCardH / 2, blinkCardW, blinkCardH, 5);
        card.lineStyle(hover ? 3 : 2, def.color, isEquipped ? 0.8 : (hover ? 1 : 0.4));
        card.strokeRoundedRect(cx - blinkCardW / 2, cy - blinkCardH / 2, blinkCardW, blinkCardH, 5);
      };
      drawBCard(false);
      this.shopContainer.add(card);

      this.shopContainer.add(this.add.text(cx, cy - 8, def.name, {
        fontSize: '9px', color: '#fff', fontStyle: 'bold',
      }).setOrigin(0.5));

      const label = isEquipped ? 'EQUIPPED' : `${def.shopPrice}g`;
      this.shopContainer.add(this.add.text(cx, cy + 10, label, {
        fontSize: '8px', color: isEquipped ? '#4a4' : (canBuy ? '#ffa726' : '#666'), fontStyle: 'bold',
      }).setOrigin(0.5));

      if (!isEquipped) {
        const zone = this.add.zone(cx, cy, blinkCardW, blinkCardH).setInteractive({ useHandCursor: true });
        this.shopContainer.add(zone);
        zone.on('pointerover', () => drawBCard(true));
        zone.on('pointerout', () => drawBCard(false));
        zone.on('pointerdown', () => {
          card.clear();
          card.fillStyle(0x1a3a1a, 0.95);
          card.fillRoundedRect(cx - blinkCardW / 2, cy - blinkCardH / 2, blinkCardW, blinkCardH, 5);
          card.lineStyle(2, 0x44ff44, 0.8);
          card.strokeRoundedRect(cx - blinkCardW / 2, cy - blinkCardH / 2, blinkCardW, blinkCardH, 5);
          zone.disableInteractive();
          if (network.isHost) gameScene.submitShopBuyBlink(bid);
          else gameScene.sendShopBuyBlink(bid);
        });
      }
    });

    // ---- Upgrades section (compact rows) ----
    const upgTopY = blinkTopY + 14 + blinkCardH + 8;
    this.shopContainer.add(this.add.text(-w / 2 + 20, upgTopY, 'UPGRADES', {
      fontSize: '10px', color: '#4fc3f7', fontStyle: 'bold',
    }));

    let rowY = upgTopY + 16;
    const rowH = 22;
    const rowW = w - 50;
    const rowX = -w / 2 + 20;

    // Spell tier upgrades
    const ownedSpells = Object.values(slots).filter(Boolean);
    ownedSpells.forEach((spellId) => {
      const def = SPELL_DEFS[spellId];
      if (!def || !def.tiers) return;
      const currentTier = tiers[spellId] || 0;
      const nextTier = currentTier + 1;
      const maxed = nextTier > MAX_TIER;
      const tierDef = maxed ? null : def.tiers[nextTier];
      const canAfford = tierDef && gold >= tierDef.price;
      const colorHex = '#' + def.color.toString(16).padStart(6, '0');

      // Tier dots inline with name
      let label = `${def.name} `;
      for (let t = 1; t <= MAX_TIER; t++) label += t <= currentTier ? '\u25CF' : '\u25CB';
      label += maxed ? '  MAX' : `  Lv${nextTier}: ${tierDef.desc}`;
      const price = maxed ? '' : `${tierDef.price}g`;

      this._makeShopRow(rowX, rowY, rowW, rowH, label, price, canAfford && !maxed, () => {
        if (!maxed) {
          if (network.isHost) gameScene.submitShopBuyTier(spellId);
          else gameScene.sendShopBuyTier(spellId);
        }
      });
      rowY += rowH + 2;
    });

    // Blink tier upgrade
    if (blinkId !== 'default_blink') {
      const bDef = BLINK_DEFS[blinkId];
      if (bDef && bDef.tiers) {
        const nextBT = blinkTier + 1;
        const bMaxed = nextBT > MAX_TIER;
        const bTierDef = bMaxed ? null : bDef.tiers[nextBT];
        const bCanAfford = bTierDef && gold >= bTierDef.price;

        let label = `${bDef.name} `;
        for (let t = 1; t <= MAX_TIER; t++) label += t <= blinkTier ? '\u25CF' : '\u25CB';
        label += bMaxed ? '  MAX' : `  Lv${nextBT}: ${bTierDef.desc}`;
        const price = bMaxed ? '' : `${bTierDef.price}g`;

        this._makeShopRow(rowX, rowY, rowW, rowH, label, price, bCanAfford && !bMaxed, () => {
          if (!bMaxed) {
            if (network.isHost) gameScene.submitShopBuyTier(blinkId);
            else gameScene.sendShopBuyTier(blinkId);
          }
        });
        rowY += rowH + 2;
      }
    }

    // Global upgrades
    const purchased = sd ? sd.purchasedUpgrades || [] : [];
    GLOBAL_UPGRADES.forEach((upg) => {
      const timesBought = purchased.filter((id) => id === upg.id).length;
      const actualPrice = upg.price + (upg.priceIncrease || 0) * timesBought;
      this._makeShopRow(rowX, rowY, rowW, rowH, `${upg.title} — ${upg.desc}`, `${actualPrice}g`, gold >= actualPrice, () => {
        if (network.isHost) gameScene.submitShopBuyGlobal(upg.id);
        else gameScene.sendShopBuyGlobal(upg.id);
      });
      rowY += rowH + 2;
    });

    // ---- Ready button ----
    const readyY = Math.max(rowY + 10, h / 2 - 50);

    const rc = this._shopReadyCount;
    this._shopReadyText = this.add.text(0, readyY, `${rc.ready || 0}/${rc.total || '?'} Ready`, {
      fontSize: '10px', color: '#888',
    }).setOrigin(0.5);
    this.shopContainer.add(this._shopReadyText);

    const btnW = 140;
    const btnH = 30;
    const btnY = readyY + 14;
    const readyBtn = this.add.graphics();
    const alreadyReady = this._localReady;

    if (alreadyReady) {
      readyBtn.fillStyle(0x0f3f0f, 0.95);
      readyBtn.fillRoundedRect(-btnW / 2, btnY, btnW, btnH, 6);
      readyBtn.lineStyle(2, 0x44ff44, 0.4);
      readyBtn.strokeRoundedRect(-btnW / 2, btnY, btnW, btnH, 6);
    } else {
      readyBtn.fillStyle(0x1a6a1a, 0.95);
      readyBtn.fillRoundedRect(-btnW / 2, btnY, btnW, btnH, 6);
      readyBtn.lineStyle(2, 0x44ff44, 0.7);
      readyBtn.strokeRoundedRect(-btnW / 2, btnY, btnW, btnH, 6);
    }
    this.shopContainer.add(readyBtn);

    const readyLabel = this.add.text(0, btnY + btnH / 2, alreadyReady ? 'READY!' : 'READY', {
      fontSize: '12px', color: alreadyReady ? '#aaffaa' : '#44ff44', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.shopContainer.add(readyLabel);

    if (!alreadyReady) {
      const readyZone = this.add.zone(0, btnY + btnH / 2, btnW, btnH).setInteractive({ useHandCursor: true });
      this.shopContainer.add(readyZone);
      readyZone.on('pointerover', () => {
        readyBtn.clear();
        readyBtn.fillStyle(0x228a22, 0.95); readyBtn.fillRoundedRect(-btnW / 2, btnY, btnW, btnH, 6);
        readyBtn.lineStyle(3, 0x44ff44, 1); readyBtn.strokeRoundedRect(-btnW / 2, btnY, btnW, btnH, 6);
      });
      readyZone.on('pointerout', () => {
        readyBtn.clear();
        readyBtn.fillStyle(0x1a6a1a, 0.95); readyBtn.fillRoundedRect(-btnW / 2, btnY, btnW, btnH, 6);
        readyBtn.lineStyle(2, 0x44ff44, 0.7); readyBtn.strokeRoundedRect(-btnW / 2, btnY, btnW, btnH, 6);
      });
      readyZone.on('pointerdown', () => {
        this._localReady = true;
        gameScene.submitShopReady();
        readyLabel.setText('READY!');
        readyLabel.setColor('#aaffaa');
        readyZone.disableInteractive();
        readyBtn.clear();
        readyBtn.fillStyle(0x0f3f0f, 0.95); readyBtn.fillRoundedRect(-btnW / 2, btnY, btnW, btnH, 6);
        readyBtn.lineStyle(2, 0x44ff44, 0.4); readyBtn.strokeRoundedRect(-btnW / 2, btnY, btnW, btnH, 6);
      });
    }
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
      // Apply locally so client has correct stats
      gameScene.applyUpgrade(network.localPlayerId, upgradeId);
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
