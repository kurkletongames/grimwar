import * as Phaser from 'phaser';
import { WIZARD_COLORS } from '../entities/Wizard.js';
import { UPGRADES } from './GameScene.js';
import { network } from '../network/NetworkManager.js';
import { SPELL_DEFS, BLINK_DEFS, GLOBAL_UPGRADES, SPELL_CATEGORIES, SLOT_KEYS, SPELLS_BY_CATEGORY, BLINK_IDS, MAX_SPELL_SLOTS, MAX_TIER, ULTIMATE_IDS } from '../data/SpellDefinitions.js';

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

const SPELL_ICON_IDS = [
  'fireball', 'homing_missile', 'ricochet', 'color_spray',
  'tether', 'mirror_image', 'vortex_wall',
  'meteor', 'gravity_sphere', 'lightning_bolt',
  'supernova', 'meteor_storm', 'arcane_barrage', 'black_hole',
  'default_blink', 'rush', 'extended_blink', 'swap',
];

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  preload() {
    SPELL_ICON_IDS.forEach((id) => {
      this.load.svg(`icon-${id}`, `icons/${id}.svg`, { width: 64, height: 64 });
    });
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

    this._hintText = this.add.text(w - 10, 10, '[TAB] Upgrades  [ESC] Menu', {
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

    // ---- Swap confirmation modal (sits above shop) ----
    this.swapConfirmContainer = this.add.container(w / 2, h / 2).setDepth(70).setVisible(false);

    // ---- Spell slots HUD (arena mode, bottom center) ----
    this.spellSlotsContainer = this.add.container(w / 2, h - 50).setDepth(25).setVisible(false);
    this.currentSlots = { fixed: 'fireball', bread_butter: null, tricky: null, power: null };
    this.activeSpellSlot = 'fixed';

    // ---- Bounty data storage ----
    this.bountyData = {};

    // ---- Gold display (arena mode, top right) ----
    this.goldText = this.add.text(w - 10, 30, '', {
      fontSize: '14px', color: '#ffa726', fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(20).setVisible(false);

    // ---- Events from GameScene ----
    const gameScene = this.scene.get('GameScene');

    this._onGameStarted = (data) => {
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
    };
    gameScene.events.on('game-started', this._onGameStarted);

    this._onRoundStart = (roundNum) => {
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
      // Redraw spell slots to show updated ultimate state
      if (this.gameMode === 'arena') {
        if (this.goldText) this.goldText.setVisible(true);
        this._drawSpellSlots();
      }
    };
    gameScene.events.on('round-start', this._onRoundStart);

    this._onCountdown = (num) => {
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
    };
    gameScene.events.on('countdown', this._onCountdown);

    this._onRoundOver = (data) => {
      this.roundOverText.setText(`${data.winnerName} wins the round!`);
      this.roundOverText.setVisible(true);
      this.scores = data.scores;
      this.winsToWin = data.winsToWin;
      this._drawScoreboard();
    };
    gameScene.events.on('round-over', this._onRoundOver);

    this._onGameOver = (data) => {
      this._showGameOver(data);
    };
    gameScene.events.on('game-over', this._onGameOver);

    this._onGameExtended = (data) => {
      this.winsToWin = data.winsToWin;
      this._drawScoreboard();
    };
    gameScene.events.on('game-extended', this._onGameExtended);

    this._onUpgradeWaiting = (data) => {
      if (data.remaining === 0) {
        // All picked — hide the container (round will start shortly)
        this.powerUpContainer.setVisible(false);
      } else if (this.waitingSubText) {
        this.waitingSubText.setText(`${data.remaining} of ${data.total} players still choosing...`);
      }
    };
    gameScene.events.on('upgrade-waiting', this._onUpgradeWaiting);

    this._onShowPowerupSelection = () => {
      this._showPowerUpCards();
    };
    gameScene.events.on('show-powerup-selection', this._onShowPowerupSelection);

    this._onWinnerSkipUpgrade = () => {
      this._showWinnerWaiting();
    };
    gameScene.events.on('winner-skip-upgrade', this._onWinnerSkipUpgrade);

    // Arena mode: shop events
    this._onShowShop = (data) => {
      if (this.gameMode === 'arena') {
        this._localReady = false;
        this._shopReadyCount = { ready: 0, total: 0 };
        this._shopStartTime = Date.now();
        this._showShop(data);
      }
    };
    gameScene.events.on('show-shop', this._onShowShop);

    this._onShopClosed = () => {
      this.shopContainer.setVisible(false);
      this._hideSwapConfirm();
      if (this.goldText) this.goldText.setVisible(true);
      this._shopStartTime = null;
      if (this._shopTimerEvent) {
        this._shopTimerEvent.remove();
        this._shopTimerEvent = null;
      }
    };
    gameScene.events.on('shop-closed', this._onShopClosed);

    this._onShopUpdate = (data) => {
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
    };
    gameScene.events.on('shop-update', this._onShopUpdate);

    this._onShopReadyUpdate = (data) => {
      this._shopReadyCount = data;
      if (this._shopReadyText) {
        this._shopReadyText.setText(`${data.ready}/${data.total} Ready`);
      }
    };
    gameScene.events.on('shop-ready-update', this._onShopReadyUpdate);

    // Kill feed
    this._onPlayerKill = (data) => {
      this._addKillFeedEntry(data.killerName, data.victimName);
    };
    gameScene.events.on('player-kill', this._onPlayerKill);

    this._onSpellSwitched = (data) => {
      this.currentSlots = data.slots;
      this.activeSpellSlot = data.activeSlot;
      this._drawSpellSlots();
    };
    gameScene.events.on('spell-switched', this._onSpellSwitched);

    // Round modifier vote (roguelike)
    this._onShowModifierVote = (data) => {
      this._showModifierVote(data);
    };
    gameScene.events.on('show-modifier-vote', this._onShowModifierVote);
    this._onModifierResult = (data) => {
      this._showModifierResult(data);
    };
    gameScene.events.on('modifier-result', this._onModifierResult);

    // Bounty updates (arena mode)
    this._onBountyUpdate = (data) => {
      this.bountyData = data.bounties; // Map of playerId -> bountyLevel
      this._drawScoreboard();
    };
    gameScene.events.on('bounty-update', this._onBountyUpdate);

    // Reposition HUD elements when the canvas resizes
    this.scale.on('resize', this._applyHudLayout, this);

    // Clean up listeners and timers on shutdown
    this.events.on('shutdown', () => {
      if (this._shopTimerEvent) { this._shopTimerEvent.remove(); this._shopTimerEvent = null; }
      this._slotCooldownGraphics = [];
      this._killFeedTexts.forEach((t) => t.destroy());
      this._killFeedTexts = [];
      this.scale.off('resize', this._applyHudLayout, this);
      gameScene.events.off('game-started', this._onGameStarted);
      gameScene.events.off('round-start', this._onRoundStart);
      gameScene.events.off('countdown', this._onCountdown);
      gameScene.events.off('round-over', this._onRoundOver);
      gameScene.events.off('game-over', this._onGameOver);
      gameScene.events.off('game-extended', this._onGameExtended);
      gameScene.events.off('upgrade-waiting', this._onUpgradeWaiting);
      gameScene.events.off('show-powerup-selection', this._onShowPowerupSelection);
      gameScene.events.off('winner-skip-upgrade', this._onWinnerSkipUpgrade);
      gameScene.events.off('show-shop', this._onShowShop);
      gameScene.events.off('shop-closed', this._onShopClosed);
      gameScene.events.off('shop-update', this._onShopUpdate);
      gameScene.events.off('shop-ready-update', this._onShopReadyUpdate);
      gameScene.events.off('spell-switched', this._onSpellSwitched);
      gameScene.events.off('show-modifier-vote', this._onShowModifierVote);
      gameScene.events.off('modifier-result', this._onModifierResult);
      gameScene.events.off('player-kill', this._onPlayerKill);
      gameScene.events.off('bounty-update', this._onBountyUpdate);
    });
  }

  // Reposition HUD elements that were anchored to the viewport at create()
  // time. Modal panels (shop, esc, upgrades, game over, modifier vote) are
  // rebuilt on each show event, so only their container position needs to
  // track the viewport — contents inside the container are drawn relative
  // to (0,0) and ride along for free.
  _applyHudLayout() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    if (this.roundText) this.roundText.setPosition(w / 2, 22);
    if (this.countdownText) this.countdownText.setPosition(w / 2, h / 2);
    if (this.roundOverText) this.roundOverText.setPosition(w / 2, h / 2 - 50);
    if (this._hintText) this._hintText.setPosition(w - 10, 10);
    if (this.goldText) this.goldText.setPosition(w - 10, 30);
    if (this.escMenuContainer) this.escMenuContainer.setPosition(w / 2, h / 2);
    if (this.gameOverContainer) this.gameOverContainer.setPosition(w / 2, h / 2);
    if (this.powerUpContainer) this.powerUpContainer.setPosition(w / 2, h / 2);
    if (this.shopContainer) this.shopContainer.setPosition(w / 2, h / 2);
    if (this.swapConfirmContainer) this.swapConfirmContainer.setPosition(w / 2, h / 2);
    if (this.spellSlotsContainer) this.spellSlotsContainer.setPosition(w / 2, h - 50);

    if (this._killFeedTexts) {
      this._killFeedTexts.forEach((t, i) => t.setPosition(w - 15, 50 + i * 16));
    }

    // Rebuild any modal currently on screen so its dim-bg fills the new size
    // and its content re-anchors. Cheap because rebuild is what a show-event
    // would do anyway.
    if (this.upgradePanelVisible) this._buildUpgradePanel();
    if (this.escMenuVisible) this._buildEscMenu();
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

      // Bounty indicator
      const bountyLevel = this.bountyData ? this.bountyData[player.peerId] : 0;
      if (bountyLevel && bountyLevel > 0) {
        const bountyColors = { 1: 0xcd7f32, 2: 0xc0c0c0, 3: 0xffd700 }; // bronze, silver, gold
        const bountyColor = bountyColors[Math.min(bountyLevel, 3)] || 0xffd700;
        this.scoreboardGraphics.fillStyle(bountyColor, 1);
        this.scoreboardGraphics.fillCircle(x + nameColW - 10, rowY + 7, 3);
        if (bountyLevel >= 3) {
          const bountyText = this.add.text(x + nameColW - 6, rowY - 1, 'BOUNTY', {
            fontSize: '8px', color: '#ffd700', fontStyle: 'bold',
          }).setDepth(41);
          this.scoreboardTexts.push(bountyText);
        }
      }

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

    const gameScene = this.scene.get('GameScene');
    const localId = gameScene?.localPlayerId;
    const spellData = localId ? gameScene?.playerSpellData?.get(localId) : null;
    const hasUlt = spellData?.ultimateId;

    const slotCount = hasUlt ? 5 : MAX_SPELL_SLOTS;
    const slotSize = 44;
    const gap = 6;
    const totalW = slotCount * slotSize + (slotCount - 1) * gap;
    const startX = -totalW / 2 + slotSize / 2;

    // Draw regular 4 slots
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
        const halo = this.add.graphics();
        halo.fillStyle(def.color, 0.22);
        halo.fillCircle(cx, 0, 18);
        this.spellSlotsContainer.add(halo);
        const iconKey = `icon-${def.id}`;
        if (this.textures.exists(iconKey)) {
          const img = this.add.image(cx, 0, iconKey).setDisplaySize(28, 28);
          img.setTint(def.color);
          this.spellSlotsContainer.add(img);
        } else {
          const fallback = this.add.graphics();
          fallback.fillStyle(def.color, 0.8);
          fallback.fillCircle(cx, 0, 12);
          this.spellSlotsContainer.add(fallback);
        }
      }

      // Cooldown overlay (drawn per-frame)
      const cdGraphics = this.add.graphics();
      this.spellSlotsContainer.add(cdGraphics);
      this._slotCooldownGraphics.push({ graphics: cdGraphics, cx, cy: 0, size: slotSize, cat, spellId, isUltimate: false });

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

    // Draw ultimate slot (5th)
    if (hasUlt) {
      const i = 4;
      const cx = startX + i * (slotSize + gap);
      const ultId = spellData.ultimateId;
      const def = SPELL_DEFS[ultId];
      const isActive = this.activeSpellSlot === 'ultimate';
      const charge = gameScene?.ultCharges?.get(localId) || 0;
      const usedThisRound = gameScene?.ultUsedThisRound?.get(localId) || false;

      const bg = this.add.graphics();
      bg.fillStyle(usedThisRound ? 0x0a0a1e : 0x16213e, 0.9);
      bg.fillRoundedRect(cx - slotSize / 2, -slotSize / 2, slotSize, slotSize, 6);
      bg.lineStyle(isActive ? 3 : 1, isActive ? 0xffdd00 : 0x333333, isActive ? 1 : 0.5);
      bg.strokeRoundedRect(cx - slotSize / 2, -slotSize / 2, slotSize, slotSize, 6);
      this.spellSlotsContainer.add(bg);

      if (def) {
        const halo = this.add.graphics();
        halo.fillStyle(def.color, usedThisRound ? 0.08 : 0.22);
        halo.fillCircle(cx, 0, 18);
        this.spellSlotsContainer.add(halo);
        const iconKey = `icon-${def.id}`;
        if (this.textures.exists(iconKey)) {
          const img = this.add.image(cx, 0, iconKey).setDisplaySize(28, 28);
          img.setTint(def.color);
          img.setAlpha(usedThisRound ? 0.3 : 1);
          this.spellSlotsContainer.add(img);
        } else {
          const fallback = this.add.graphics();
          fallback.fillStyle(def.color, usedThisRound ? 0.2 : 0.8);
          fallback.fillCircle(cx, 0, 12);
          this.spellSlotsContainer.add(fallback);
        }
      }

      // Charge overlay (drawn per-frame)
      const chargeGraphics = this.add.graphics();
      this.spellSlotsContainer.add(chargeGraphics);
      this._slotCooldownGraphics.push({
        graphics: chargeGraphics, cx, cy: 0, size: slotSize,
        cat: 'ultimate', spellId: ultId, isUltimate: true,
      });

      // Key label
      const keyText = this.add.text(cx - slotSize / 2 + 4, -slotSize / 2 + 2, '5', {
        fontSize: '9px', color: '#666',
      });
      this.spellSlotsContainer.add(keyText);

      // Label below
      const catLabel = this.add.text(cx, slotSize / 2 + 4, 'Ultimate', {
        fontSize: '7px', color: '#aa8800',
      }).setOrigin(0.5, 0);
      this.spellSlotsContainer.add(catLabel);
    }
  }

  update() {
    // Update spell slot cooldown overlays each frame
    if (this.gameMode !== 'arena' || !this._slotCooldownGraphics) return;
    const gameScene = this.scene.get('GameScene');
    if (!gameScene || !gameScene.gameStarted) return;
    const localId = gameScene.localPlayerId;
    const now = Date.now();

    this._slotCooldownGraphics.forEach(({ graphics, cx, cy, size, cat, spellId, isUltimate }) => {
      graphics.clear();

      if (isUltimate) {
        // Ultimate charge overlay — fills from bottom up
        const charge = gameScene.ultCharges?.get(localId) || 0;
        const usedThisRound = gameScene.ultUsedThisRound?.get(localId) || false;
        const pct = Math.min(charge / 100, 1);

        if (usedThisRound) {
          // Dark "used" overlay
          graphics.fillStyle(0x000000, 0.6);
          graphics.fillRoundedRect(cx - size / 2 + 1, cy - size / 2 + 1, size - 2, size - 2, 5);
        } else if (pct < 1) {
          // Dark uncharged portion (top part)
          const unchargedH = (size - 2) * (1 - pct);
          graphics.fillStyle(0x000000, 0.5);
          graphics.fillRoundedRect(cx - size / 2 + 1, cy - size / 2 + 1, size - 2, unchargedH, 3);
        } else {
          // Fully charged — golden glow pulse
          const pulse = 0.3 + Math.sin(Date.now() * 0.006) * 0.15;
          graphics.fillStyle(0xffdd00, pulse);
          graphics.fillRoundedRect(cx - size / 2 + 1, cy - size / 2 + 1, size - 2, size - 2, 5);
        }
        return;
      }

      const slotSpellId = this.currentSlots[cat];
      if (!slotSpellId) return;

      const castKey = gameScene._getSpellCastTimeKey(localId, slotSpellId);
      const lastCast = gameScene.spellCastTimes.get(castKey) || 0;
      const cd = gameScene._getSpellCooldown(localId, slotSpellId);
      const elapsed = now - lastCast;
      const pct = lastCast === 0 ? 0 : Math.max(0, 1 - elapsed / cd);

      if (pct > 0) {
        // Dark overlay
        graphics.fillStyle(0x000000, 0.55);
        graphics.fillRoundedRect(cx - size / 2 + 1, cy - size / 2 + 1, size - 2, size - 2, 5);

        // Cooldown sweep arc (fills clockwise from top)
        const readyPct = 1 - pct;
        if (readyPct > 0 && readyPct < 1) {
          const def = SPELL_DEFS[slotSpellId];
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
      this.tweens.killTweensOf(old);
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

    this.shopContainer.add(this.add.text(rowX + 10, rowY + 4, label, {
      fontSize: '12px', color: '#ccc',
    }));

    this.shopContainer.add(this.add.text(rowX + rowW - 10, rowY + 4, priceStr, {
      fontSize: '12px', color: canAfford ? '#ffa726' : '#666', fontStyle: 'bold',
    }).setOrigin(1, 0));

    const zone = this.add.zone(rowX + rowW / 2, rowY + rowH / 2, rowW, rowH).setInteractive({ useHandCursor: true });
    this.shopContainer.add(zone);
    zone.on('pointerover', () => draw('hover'));
    zone.on('pointerout', () => draw('normal'));
    zone.on('pointerdown', () => { draw('click'); onClick(); });
  }

  _hideSwapConfirm() {
    if (this.swapConfirmContainer) {
      this.swapConfirmContainer.removeAll(true);
      this.swapConfirmContainer.setVisible(false);
    }
  }

  _showSwapConfirm({ currentDef, newDef, currentTier, onConfirm }) {
    this.swapConfirmContainer.removeAll(true);
    this.swapConfirmContainer.setVisible(true);

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Compute gold invested in current tiers (for warning)
    let goldInvested = 0;
    if (currentTier > 0 && currentDef.tiers) {
      for (let t = 1; t <= currentTier; t++) {
        const td = currentDef.tiers[t];
        if (td && typeof td.price === 'number') goldInvested += td.price;
      }
    }
    const hasUpgrades = currentTier > 0;

    // Dim backdrop (click outside to cancel)
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.75);
    dim.fillRect(-w / 2, -h / 2, w, h);
    this.swapConfirmContainer.add(dim);
    const dimZone = this.add.zone(0, 0, w, h).setInteractive();
    dimZone.on('pointerdown', () => this._hideSwapConfirm());
    this.swapConfirmContainer.add(dimZone);

    // Card — taller when warning is shown
    const cardW = 560;
    const cardH = hasUpgrades ? 340 : 270;
    const card = this.add.graphics();
    card.fillStyle(0x0f1a2e, 0.98);
    card.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
    card.lineStyle(3, hasUpgrades ? 0xff6b35 : 0xe94560, 0.9);
    card.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
    this.swapConfirmContainer.add(card);
    const cardZone = this.add.zone(0, 0, cardW, cardH).setInteractive();
    cardZone.on('pointerdown', () => {});
    this.swapConfirmContainer.add(cardZone);

    // Title
    const titleY = -cardH / 2 + 26;
    this.swapConfirmContainer.add(this.add.text(0, titleY, 'REPLACE ABILITY?', {
      fontSize: '22px', color: hasUpgrades ? '#ff6b35' : '#e94560', fontStyle: 'bold',
    }).setOrigin(0.5));

    // Current -> new layout
    const slotY = titleY + 74;
    const iconSize = 58;
    const leftX = -130;
    const rightX = 130;

    this._drawIconOnContainer(this.swapConfirmContainer, leftX, slotY, iconSize, currentDef, 0.25);
    this.swapConfirmContainer.add(this.add.text(leftX, slotY + 50, currentDef.name, {
      fontSize: '16px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5));
    const tierLabel = currentTier > 0 ? `Level ${currentTier}` : 'Base (no upgrades)';
    this.swapConfirmContainer.add(this.add.text(leftX, slotY + 70, tierLabel, {
      fontSize: '13px', color: currentTier > 0 ? '#ffd77a' : '#9fb4d6', fontStyle: currentTier > 0 ? 'bold' : 'normal',
    }).setOrigin(0.5));

    // Arrow
    const arrow = this.add.graphics();
    arrow.fillStyle(hasUpgrades ? 0xff6b35 : 0xe94560, 0.9);
    arrow.fillTriangle(-14, slotY - 12, -14, slotY + 12, 14, slotY);
    this.swapConfirmContainer.add(arrow);

    this._drawIconOnContainer(this.swapConfirmContainer, rightX, slotY, iconSize, newDef, 0.25);
    this.swapConfirmContainer.add(this.add.text(rightX, slotY + 50, newDef.name, {
      fontSize: '16px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5));
    this.swapConfirmContainer.add(this.add.text(rightX, slotY + 70, `${newDef.shopPrice}g`, {
      fontSize: '14px', color: '#ffa726', fontStyle: 'bold',
    }).setOrigin(0.5));

    // Warning banner — prominent when tier progress is being lost
    if (hasUpgrades) {
      const bannerY = slotY + 100;
      const bannerW = cardW - 44;
      const bannerH = 62;
      const banner = this.add.graphics();
      banner.fillStyle(0x3a1808, 0.95);
      banner.fillRoundedRect(-bannerW / 2, bannerY, bannerW, bannerH, 8);
      banner.lineStyle(2, 0xff6b35, 0.9);
      banner.strokeRoundedRect(-bannerW / 2, bannerY, bannerW, bannerH, 8);
      this.swapConfirmContainer.add(banner);

      // Warning triangle icon
      const warnTri = this.add.graphics();
      const triX = -bannerW / 2 + 24;
      const triY = bannerY + bannerH / 2;
      warnTri.fillStyle(0xff6b35, 1);
      warnTri.fillTriangle(triX - 11, triY + 10, triX + 11, triY + 10, triX, triY - 12);
      warnTri.fillStyle(0x0f1a2e, 1);
      warnTri.fillRect(triX - 1.5, triY - 5, 3, 8);
      warnTri.fillRect(triX - 1.5, triY + 5, 3, 3);
      this.swapConfirmContainer.add(warnTri);

      this.swapConfirmContainer.add(this.add.text(triX + 20, bannerY + 10, 'UPGRADES WILL BE LOST', {
        fontSize: '15px', color: '#ff9966', fontStyle: 'bold',
      }));
      const detail = `Level ${currentTier} progress (${goldInvested}g invested) will not be refunded.`;
      this.swapConfirmContainer.add(this.add.text(triX + 20, bannerY + 32, detail, {
        fontSize: '12px', color: '#ffccaa',
      }));
    }

    // Buttons
    const btnY = cardH / 2 - 54;
    const btnW = 200, btnH = 44;
    const gap = 20;

    const cancelBg = this.add.graphics();
    const drawCancel = (hover) => {
      cancelBg.clear();
      cancelBg.fillStyle(hover ? 0x3a3a4a : 0x242430, 0.95);
      cancelBg.fillRoundedRect(-gap / 2 - btnW, btnY, btnW, btnH, 8);
      cancelBg.lineStyle(hover ? 2 : 1.5, 0x888899, hover ? 1 : 0.6);
      cancelBg.strokeRoundedRect(-gap / 2 - btnW, btnY, btnW, btnH, 8);
    };
    drawCancel(false);
    this.swapConfirmContainer.add(cancelBg);
    this.swapConfirmContainer.add(this.add.text(-gap / 2 - btnW / 2, btnY + btnH / 2, 'CANCEL', {
      fontSize: '17px', color: '#ddd', fontStyle: 'bold',
    }).setOrigin(0.5));
    const cancelZone = this.add.zone(-gap / 2 - btnW / 2, btnY + btnH / 2, btnW, btnH).setInteractive({ useHandCursor: true });
    this.swapConfirmContainer.add(cancelZone);
    cancelZone.on('pointerover', () => drawCancel(true));
    cancelZone.on('pointerout', () => drawCancel(false));
    cancelZone.on('pointerdown', () => this._hideSwapConfirm());

    const confirmBg = this.add.graphics();
    const confirmBase = hasUpgrades ? 0x6a2010 : 0x5a1428;
    const confirmHover = hasUpgrades ? 0x9a3418 : 0x8a2040;
    const confirmStroke = hasUpgrades ? 0xff6b35 : 0xe94560;
    const drawConfirm = (hover) => {
      confirmBg.clear();
      confirmBg.fillStyle(hover ? confirmHover : confirmBase, 0.95);
      confirmBg.fillRoundedRect(gap / 2, btnY, btnW, btnH, 8);
      confirmBg.lineStyle(hover ? 2.5 : 2, confirmStroke, hover ? 1 : 0.85);
      confirmBg.strokeRoundedRect(gap / 2, btnY, btnW, btnH, 8);
    };
    drawConfirm(false);
    this.swapConfirmContainer.add(confirmBg);
    const confirmLabel = hasUpgrades ? 'REPLACE & LOSE UPGRADES' : 'REPLACE';
    this.swapConfirmContainer.add(this.add.text(gap / 2 + btnW / 2, btnY + btnH / 2, confirmLabel, {
      fontSize: hasUpgrades ? '13px' : '17px', color: '#ffdddd', fontStyle: 'bold',
    }).setOrigin(0.5));
    const confirmZone = this.add.zone(gap / 2 + btnW / 2, btnY + btnH / 2, btnW, btnH).setInteractive({ useHandCursor: true });
    this.swapConfirmContainer.add(confirmZone);
    confirmZone.on('pointerover', () => drawConfirm(true));
    confirmZone.on('pointerout', () => drawConfirm(false));
    confirmZone.on('pointerdown', () => {
      confirmZone.disableInteractive();
      this._hideSwapConfirm();
      onConfirm();
    });
  }

  _drawIconOnContainer(container, cx, cy, size, def, haloAlpha = 0.2) {
    const halo = this.add.graphics();
    halo.fillStyle(def.color, haloAlpha);
    halo.fillCircle(cx, cy, size / 2 + 4);
    container.add(halo);
    const iconKey = `icon-${def.id}`;
    if (this.textures.exists(iconKey)) {
      const img = this.add.image(cx, cy, iconKey).setDisplaySize(size, size);
      img.setTint(def.color);
      container.add(img);
    } else {
      const fb = this.add.graphics();
      fb.fillStyle(def.color, 0.85);
      fb.fillCircle(cx, cy, size / 2);
      container.add(fb);
    }
  }

  _drawSpellIcon(cx, cy, size, def, opts = {}) {
    const alpha = opts.alpha != null ? opts.alpha : 1;
    const haloAlpha = opts.halo != null ? opts.halo : 0.18;
    if (haloAlpha > 0) {
      const halo = this.add.graphics();
      halo.fillStyle(def.color, haloAlpha);
      halo.fillCircle(cx, cy, size / 2 + 3);
      this.shopContainer.add(halo);
    }
    const iconKey = `icon-${def.id}`;
    if (this.textures.exists(iconKey)) {
      const img = this.add.image(cx, cy, iconKey).setDisplaySize(size, size);
      img.setTint(def.color);
      img.setAlpha(alpha);
      this.shopContainer.add(img);
      return img;
    }
    const fallback = this.add.graphics();
    fallback.fillStyle(def.color, alpha);
    fallback.fillCircle(cx, cy, size / 2);
    this.shopContainer.add(fallback);
    return fallback;
  }

  _drawTierPips(x, y, count, max, color) {
    const gap = 14;
    for (let t = 1; t <= max; t++) {
      const px = x + (t - 1) * gap;
      const g = this.add.graphics();
      if (t <= count) {
        g.fillStyle(color, 1);
        g.fillCircle(px, y, 5);
        g.lineStyle(1.5, 0xffffff, 0.9);
        g.strokeCircle(px, y, 5);
      } else {
        g.lineStyle(1.5, color, 0.4);
        g.strokeCircle(px, y, 5);
      }
      this.shopContainer.add(g);
    }
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
    const purchased = sd ? sd.purchasedUpgrades || [] : [];
    const hasUlt = sd && sd.ultimateId;

    this._updateGoldDisplay(gold);
    if (this.goldText) this.goldText.setVisible(false);

    // ---- Dim background ----
    const dimBg = this.add.graphics();
    dimBg.fillStyle(0x000000, 0.88);
    dimBg.fillRect(-w / 2, -h / 2, w, h);
    this.shopContainer.add(dimBg);

    // ---- Header bar (Gold | Title | Timer) ----
    const headerY = -h / 2 + 40;

    const goldPillW = 180, goldPillH = 36;
    const goldPillX = -w / 2 + 24;
    const goldBg = this.add.graphics();
    goldBg.fillStyle(0x2a1f0a, 0.95);
    goldBg.fillRoundedRect(goldPillX, headerY - goldPillH / 2, goldPillW, goldPillH, 18);
    goldBg.lineStyle(2, 0xffa726, 0.7);
    goldBg.strokeRoundedRect(goldPillX, headerY - goldPillH / 2, goldPillW, goldPillH, 18);
    this.shopContainer.add(goldBg);
    const coin = this.add.graphics();
    coin.fillStyle(0xffc84d, 1);
    coin.fillCircle(goldPillX + 20, headerY, 10);
    coin.lineStyle(1.5, 0x8a5a10, 1);
    coin.strokeCircle(goldPillX + 20, headerY, 10);
    this.shopContainer.add(coin);
    this.shopContainer.add(this.add.text(goldPillX + 38, headerY, `${gold} GOLD`, {
      fontSize: '20px', color: '#ffd77a', fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    this.shopContainer.add(this.add.text(0, headerY, 'SHOP', {
      fontSize: '32px', color: '#e94560', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5));

    const timerPillW = 90, timerPillH = 36;
    const timerPillX = w / 2 - 24 - timerPillW;
    const timerBg = this.add.graphics();
    timerBg.fillStyle(0x1a1a2e, 0.95);
    timerBg.fillRoundedRect(timerPillX, headerY - timerPillH / 2, timerPillW, timerPillH, 18);
    timerBg.lineStyle(2, 0x888888, 0.5);
    timerBg.strokeRoundedRect(timerPillX, headerY - timerPillH / 2, timerPillW, timerPillH, 18);
    this.shopContainer.add(timerBg);
    const shopDuration = data.shopDuration || 30000;
    if (!this._shopStartTime) this._shopStartTime = Date.now();
    const startTime = this._shopStartTime;
    const timerText = this.add.text(timerPillX + timerPillW / 2, headerY, '30s', {
      fontSize: '20px', color: '#ccc', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.shopContainer.add(timerText);
    if (this._shopTimerEvent) this._shopTimerEvent.remove();
    this._shopTimerEvent = this.time.addEvent({ delay: 250, loop: true, callback: () => {
      const rem = Math.max(0, Math.ceil((shopDuration - (Date.now() - startTime)) / 1000));
      timerText.setText(`${rem}s`);
      timerText.setColor(rem <= 5 ? '#ff6666' : '#ccc');
      if (rem <= 0 && this._shopTimerEvent) { this._shopTimerEvent.remove(); this._shopTimerEvent = null; }
    }});

    // ---- Slot columns (1 / 2 / 3 / 4 / Blink) ----
    const columns = [
      { kind: 'spell', slotKey: 'fixed',        slotNum: 1, keyLabel: '1' },
      { kind: 'spell', slotKey: 'bread_butter', slotNum: 2, keyLabel: '2' },
      { kind: 'spell', slotKey: 'tricky',       slotNum: 3, keyLabel: '3' },
      { kind: 'spell', slotKey: 'power',        slotNum: 4, keyLabel: '4' },
      { kind: 'blink', slotKey: null,           slotNum: null, keyLabel: 'SPC' },
    ];

    const contentTop = headerY + 32;
    const sideMargin = 18;
    const colGap = 10;
    const colCount = columns.length;
    const totalColW = w - 2 * sideMargin - (colCount - 1) * colGap;
    const colW = totalColW / colCount;

    const headerBoxH = 52;
    const equippedCardH = 168;
    const swapSectionH = 136;

    columns.forEach((entry, ci) => {
      const colX = -w / 2 + sideMargin + ci * (colW + colGap);
      const cx = colX + colW / 2;
      const catColor = entry.kind === 'spell'
        ? SPELL_CATEGORIES[entry.slotKey].color
        : 0x4fc3f7;
      const colorHex = '#' + catColor.toString(16).padStart(6, '0');

      // --- Column header ---
      const hdr = this.add.graphics();
      hdr.fillStyle(0x0c1528, 0.95);
      hdr.fillRoundedRect(colX, contentTop, colW, headerBoxH, 8);
      hdr.lineStyle(2, catColor, 0.45);
      hdr.strokeRoundedRect(colX, contentTop, colW, headerBoxH, 8);
      this.shopContainer.add(hdr);

      const titleText = entry.kind === 'spell' ? `SLOT ${entry.slotNum}` : 'BLINK';
      const subText = entry.kind === 'spell'
        ? SPELL_CATEGORIES[entry.slotKey].label
        : 'Movement';

      this.shopContainer.add(this.add.text(colX + 14, contentTop + 10, titleText, {
        fontSize: '17px', color: '#fff', fontStyle: 'bold',
      }));
      this.shopContainer.add(this.add.text(colX + 14, contentTop + 30, subText, {
        fontSize: '13px', color: colorHex, fontStyle: 'bold',
      }));

      const badgeW = entry.keyLabel.length > 1 ? 36 : 26;
      const badgeH = 26;
      const badgeX = colX + colW - 14 - badgeW;
      const badgeY = contentTop + (headerBoxH - badgeH) / 2;
      const badge = this.add.graphics();
      badge.fillStyle(0x1a2544, 1);
      badge.fillRoundedRect(badgeX, badgeY, badgeW, badgeH, 5);
      badge.lineStyle(1.5, catColor, 0.85);
      badge.strokeRoundedRect(badgeX, badgeY, badgeW, badgeH, 5);
      this.shopContainer.add(badge);
      this.shopContainer.add(this.add.text(badgeX + badgeW / 2, badgeY + badgeH / 2, entry.keyLabel, {
        fontSize: entry.keyLabel.length > 1 ? '12px' : '15px', color: '#fff', fontStyle: 'bold',
      }).setOrigin(0.5));

      // --- Equipped card ---
      const eqTop = contentTop + headerBoxH + 10;
      const eqId = entry.kind === 'blink' ? blinkId : slots[entry.slotKey];
      const eqDef = entry.kind === 'blink'
        ? (eqId ? BLINK_DEFS[eqId] : null)
        : (eqId ? SPELL_DEFS[eqId] : null);
      const eqTier = entry.kind === 'blink' ? blinkTier : (tiers[eqId] || 0);

      const eqBg = this.add.graphics();
      eqBg.fillStyle(0x12203b, 0.95);
      eqBg.fillRoundedRect(colX, eqTop, colW, equippedCardH, 8);
      eqBg.lineStyle(2, eqDef ? eqDef.color : 0x333333, eqDef ? 0.6 : 0.25);
      eqBg.strokeRoundedRect(colX, eqTop, colW, equippedCardH, 8);
      this.shopContainer.add(eqBg);

      if (eqDef) {
        const iconSize = 56;
        const iconX = colX + 18 + iconSize / 2;
        const iconY = eqTop + 18 + iconSize / 2;
        this._drawSpellIcon(iconX, iconY, iconSize, eqDef, { halo: 0.2 });

        this.shopContainer.add(this.add.text(iconX + iconSize / 2 + 12, eqTop + 22, eqDef.name, {
          fontSize: '17px', color: '#fff', fontStyle: 'bold',
        }));
        const tierTxt = eqTier >= MAX_TIER ? 'MAX LEVEL' : `Level ${eqTier}`;
        this.shopContainer.add(this.add.text(iconX + iconSize / 2 + 12, eqTop + 44, tierTxt, {
          fontSize: '12px', color: '#9fb4d6', fontStyle: 'bold',
        }));

        const hasTiers = eqDef.tiers && Object.keys(eqDef.tiers).length > 0;
        if (hasTiers) {
          this._drawTierPips(colX + 18, eqTop + 92, eqTier, MAX_TIER, eqDef.color);
        }

        const nextT = eqTier + 1;
        const maxed = !hasTiers || nextT > MAX_TIER;
        const tierDef = maxed ? null : eqDef.tiers[nextT];
        const upBtnX = colX + 10;
        const upBtnY = eqTop + 110;
        const upBtnW = colW - 20;
        const upBtnH = 48;

        if (maxed) {
          const maxBg = this.add.graphics();
          maxBg.fillStyle(0x1a3a1a, 0.85);
          maxBg.fillRoundedRect(upBtnX, upBtnY, upBtnW, upBtnH, 6);
          maxBg.lineStyle(1.5, 0x4a8a4a, 0.55);
          maxBg.strokeRoundedRect(upBtnX, upBtnY, upBtnW, upBtnH, 6);
          this.shopContainer.add(maxBg);
          const maxLabel = hasTiers ? 'FULLY UPGRADED' : 'NO UPGRADES';
          this.shopContainer.add(this.add.text(upBtnX + upBtnW / 2, upBtnY + upBtnH / 2, maxLabel, {
            fontSize: '13px', color: '#88cc88', fontStyle: 'bold',
          }).setOrigin(0.5));
        } else {
          const canAfford = gold >= tierDef.price;
          const upBg = this.add.graphics();
          const drawUp = (hover) => {
            upBg.clear();
            const fill = canAfford ? (hover ? 0x2a4a20 : 0x1a2e14) : 0x2a1818;
            upBg.fillStyle(fill, 0.95);
            upBg.fillRoundedRect(upBtnX, upBtnY, upBtnW, upBtnH, 6);
            upBg.lineStyle(hover && canAfford ? 2.5 : 1.5, canAfford ? 0xffa726 : 0x555555, canAfford ? (hover ? 1 : 0.75) : 0.4);
            upBg.strokeRoundedRect(upBtnX, upBtnY, upBtnW, upBtnH, 6);
          };
          drawUp(false);
          this.shopContainer.add(upBg);

          this.shopContainer.add(this.add.text(upBtnX + 10, upBtnY + 6, `UPGRADE to Lv${nextT}`, {
            fontSize: '12px', color: canAfford ? '#ffa726' : '#666', fontStyle: 'bold',
          }));
          this.shopContainer.add(this.add.text(upBtnX + upBtnW - 10, upBtnY + 6, `${tierDef.price}g`, {
            fontSize: '14px', color: canAfford ? '#ffd77a' : '#666', fontStyle: 'bold',
          }).setOrigin(1, 0));
          this.shopContainer.add(this.add.text(upBtnX + 10, upBtnY + 24, tierDef.desc, {
            fontSize: '11px', color: canAfford ? '#ddd' : '#666',
            wordWrap: { width: upBtnW - 20 },
          }));

          if (canAfford) {
            const zone = this.add.zone(upBtnX + upBtnW / 2, upBtnY + upBtnH / 2, upBtnW, upBtnH).setInteractive({ useHandCursor: true });
            this.shopContainer.add(zone);
            zone.on('pointerover', () => drawUp(true));
            zone.on('pointerout', () => drawUp(false));
            zone.on('pointerdown', () => {
              zone.disableInteractive();
              if (network.isHost) gameScene.submitShopBuyTier(eqDef.id);
              else gameScene.sendShopBuyTier(eqDef.id);
            });
          }
        }
      } else {
        this.shopContainer.add(this.add.text(cx, eqTop + equippedCardH / 2, 'Pick an ability\nfrom below', {
          fontSize: '13px', color: '#667', fontStyle: 'italic', align: 'center',
        }).setOrigin(0.5));
      }

      // --- Swap / equip section ---
      const swapTop = eqTop + equippedCardH + 12;
      const swapLabel = entry.kind === 'blink' ? 'SWAP BLINK' : (eqDef ? 'SWAP FOR' : 'EQUIP');
      this.shopContainer.add(this.add.text(colX + 14, swapTop, swapLabel, {
        fontSize: '10px', color: '#778', fontStyle: 'bold',
      }));

      let options = [];
      if (entry.kind === 'blink') {
        options = BLINK_IDS.map((id) => BLINK_DEFS[id]).filter((d) => d && d.id !== blinkId);
      } else if (entry.slotKey === 'fixed') {
        options = [];
      } else {
        options = (SPELLS_BY_CATEGORY[entry.slotKey] || [])
          .map((id) => SPELL_DEFS[id])
          .filter((d) => d && d.id !== eqId);
      }

      const swRowH = 32;
      const swGap = 4;
      options.forEach((def, i) => {
        const ry = swapTop + 14 + i * (swRowH + swGap);
        if (ry + swRowH > swapTop + swapSectionH) return;
        const canBuy = gold >= def.shopPrice;

        const rowBg = this.add.graphics();
        const drawRow = (hover) => {
          rowBg.clear();
          rowBg.fillStyle(hover && canBuy ? 0x1e2d52 : 0x0c1528, 0.95);
          rowBg.fillRoundedRect(colX + 6, ry, colW - 12, swRowH, 5);
          rowBg.lineStyle(1.5, def.color, hover && canBuy ? 0.95 : 0.35);
          rowBg.strokeRoundedRect(colX + 6, ry, colW - 12, swRowH, 5);
        };
        drawRow(false);
        this.shopContainer.add(rowBg);

        this._drawSpellIcon(colX + 22, ry + swRowH / 2, 22, def, { halo: 0.15 });
        this.shopContainer.add(this.add.text(colX + 40, ry + swRowH / 2, def.name, {
          fontSize: '13px', color: canBuy ? '#fff' : '#777', fontStyle: 'bold',
        }).setOrigin(0, 0.5));
        this.shopContainer.add(this.add.text(colX + colW - 14, ry + swRowH / 2, `${def.shopPrice}g`, {
          fontSize: '13px', color: canBuy ? '#ffa726' : '#666', fontStyle: 'bold',
        }).setOrigin(1, 0.5));

        if (canBuy) {
          const zone = this.add.zone(colX + 6 + (colW - 12) / 2, ry + swRowH / 2, colW - 12, swRowH).setInteractive({ useHandCursor: true });
          this.shopContainer.add(zone);
          zone.on('pointerover', () => drawRow(true));
          zone.on('pointerout', () => drawRow(false));
          zone.on('pointerdown', () => {
            const doPurchase = () => {
              zone.disableInteractive();
              if (entry.kind === 'blink') {
                if (network.isHost) gameScene.submitShopBuyBlink(def.id);
                else gameScene.sendShopBuyBlink(def.id);
              } else {
                if (network.isHost) gameScene.submitShopBuySpell(def.id);
                else gameScene.sendShopBuySpell(def.id);
              }
            };
            // Confirm only when replacing an existing ability (not empty slots)
            if (eqDef) {
              this._showSwapConfirm({
                currentDef: eqDef,
                newDef: def,
                currentTier: eqTier,
                onConfirm: doPurchase,
              });
            } else {
              doPurchase();
            }
          });
        }
      });
    });

    // ---- Ultimate strip ----
    const stripTop = contentTop + headerBoxH + 10 + equippedCardH + 12 + swapSectionH + 16;

    this.shopContainer.add(this.add.text(-w / 2 + 24, stripTop, 'ULTIMATE', {
      fontSize: '15px', color: '#ffdd00', fontStyle: 'bold',
    }));
    const uBadgeX = -w / 2 + 110;
    const uBadge = this.add.graphics();
    uBadge.fillStyle(0x2a2a10, 1);
    uBadge.fillRoundedRect(uBadgeX, stripTop - 2, 26, 22, 4);
    uBadge.lineStyle(1.5, 0xffdd00, 0.85);
    uBadge.strokeRoundedRect(uBadgeX, stripTop - 2, 26, 22, 4);
    this.shopContainer.add(uBadge);
    this.shopContainer.add(this.add.text(uBadgeX + 13, stripTop + 9, '5', {
      fontSize: '14px', color: '#ffdd00', fontStyle: 'bold',
    }).setOrigin(0.5));
    if (hasUlt) {
      this.shopContainer.add(this.add.text(uBadgeX + 36, stripTop + 9, '(one per game)', {
        fontSize: '11px', color: '#666', fontStyle: 'italic',
      }).setOrigin(0, 0.5));
    }

    const ultCardY = stripTop + 24;
    const ultCardH = 64;
    const ultCount = ULTIMATE_IDS.length;
    const ultAvailW = w - 2 * sideMargin;
    const ultCardW = Math.min(260, (ultAvailW - (ultCount - 1) * 10) / ultCount);
    const ultTotalW = ultCardW * ultCount + (ultCount - 1) * 10;
    const ultStartX = -ultTotalW / 2;

    const currentUltDef = hasUlt ? SPELL_DEFS[sd.ultimateId] : null;

    ULTIMATE_IDS.forEach((uid, i) => {
      const def = SPELL_DEFS[uid];
      if (!def) return;
      const ux = ultStartX + i * (ultCardW + 10);
      const isEquipped = hasUlt && sd.ultimateId === uid;
      const canAfford = gold >= def.shopPrice;
      const canBuy = !isEquipped && canAfford;

      const card = this.add.graphics();
      const drawCard = (hover) => {
        card.clear();
        const fill = isEquipped ? 0x1a3a1a : (hover && canBuy ? 0x1e2d52 : 0x12203b);
        card.fillStyle(fill, 0.95);
        card.fillRoundedRect(ux, ultCardY, ultCardW, ultCardH, 6);
        card.lineStyle(hover && canBuy ? 3 : 2, def.color, isEquipped ? 0.9 : (hover && canBuy ? 1 : 0.5));
        card.strokeRoundedRect(ux, ultCardY, ultCardW, ultCardH, 6);
      };
      drawCard(false);
      this.shopContainer.add(card);

      this._drawSpellIcon(ux + 28, ultCardY + ultCardH / 2, 38, def, { halo: 0.22 });

      this.shopContainer.add(this.add.text(ux + 54, ultCardY + 8, def.name, {
        fontSize: '14px', color: '#fff', fontStyle: 'bold',
      }));
      const priceLabel = isEquipped ? 'EQUIPPED' : `${def.shopPrice}g`;
      this.shopContainer.add(this.add.text(ux + 54, ultCardY + 26, priceLabel, {
        fontSize: '13px',
        color: isEquipped ? '#6af06a' : (canAfford ? '#ffa726' : '#888'),
        fontStyle: 'bold',
      }));
      const descTxt = def.desc && def.desc.length > 46 ? def.desc.slice(0, 43) + '...' : (def.desc || '');
      this.shopContainer.add(this.add.text(ux + 54, ultCardY + 44, descTxt, {
        fontSize: '10px', color: '#99a',
      }));

      if (canBuy) {
        const zone = this.add.zone(ux + ultCardW / 2, ultCardY + ultCardH / 2, ultCardW, ultCardH).setInteractive({ useHandCursor: true });
        this.shopContainer.add(zone);
        zone.on('pointerover', () => drawCard(true));
        zone.on('pointerout', () => drawCard(false));
        zone.on('pointerdown', () => {
          const doPurchase = () => {
            zone.disableInteractive();
            if (network.isHost) gameScene.submitShopBuyUltimate(uid);
            else gameScene.sendShopBuyUltimate(uid);
          };
          if (currentUltDef) {
            this._showSwapConfirm({
              currentDef: currentUltDef,
              newDef: def,
              currentTier: 0,
              onConfirm: doPurchase,
            });
          } else {
            doPurchase();
          }
        });
      }
    });

    // ---- Passive upgrades strip ----
    const gupTop = ultCardY + ultCardH + 16;
    this.shopContainer.add(this.add.text(-w / 2 + 24, gupTop, 'PASSIVE UPGRADES', {
      fontSize: '15px', color: '#4fc3f7', fontStyle: 'bold',
    }));

    const gupCardsY = gupTop + 24;
    const gupCount = GLOBAL_UPGRADES.length;
    const gupCardH = 50;
    const gupCardW = Math.min(300, (ultAvailW - (gupCount - 1) * 10) / gupCount);
    const gupTotalW = gupCardW * gupCount + (gupCount - 1) * 10;
    const gupStartX = -gupTotalW / 2;

    GLOBAL_UPGRADES.forEach((upg, i) => {
      const gx = gupStartX + i * (gupCardW + 10);
      const timesBought = purchased.filter((id) => id === upg.id).length;
      const actualPrice = upg.price + (upg.priceIncrease || 0) * timesBought;
      const canAfford = gold >= actualPrice;

      const gbg = this.add.graphics();
      const drawG = (hover) => {
        gbg.clear();
        gbg.fillStyle(hover && canAfford ? 0x1e2d52 : 0x0f1a2e, 0.95);
        gbg.fillRoundedRect(gx, gupCardsY, gupCardW, gupCardH, 5);
        gbg.lineStyle(hover && canAfford ? 2 : 1.5, canAfford ? 0x4fc3f7 : 0x555555, hover && canAfford ? 1 : 0.5);
        gbg.strokeRoundedRect(gx, gupCardsY, gupCardW, gupCardH, 5);
      };
      drawG(false);
      this.shopContainer.add(gbg);

      this.shopContainer.add(this.add.text(gx + 12, gupCardsY + 7, upg.title, {
        fontSize: '14px', color: '#fff', fontStyle: 'bold',
      }));
      this.shopContainer.add(this.add.text(gx + 12, gupCardsY + 27, upg.desc, {
        fontSize: '11px', color: '#99a',
      }));
      this.shopContainer.add(this.add.text(gx + gupCardW - 12, gupCardsY + gupCardH / 2, `${actualPrice}g`, {
        fontSize: '16px', color: canAfford ? '#ffa726' : '#666', fontStyle: 'bold',
      }).setOrigin(1, 0.5));

      if (canAfford) {
        const zone = this.add.zone(gx + gupCardW / 2, gupCardsY + gupCardH / 2, gupCardW, gupCardH).setInteractive({ useHandCursor: true });
        this.shopContainer.add(zone);
        zone.on('pointerover', () => drawG(true));
        zone.on('pointerout', () => drawG(false));
        zone.on('pointerdown', () => {
          zone.disableInteractive();
          if (network.isHost) gameScene.submitShopBuyGlobal(upg.id);
          else gameScene.sendShopBuyGlobal(upg.id);
        });
      }
    });

    // ---- Ready button ----
    const readyBandY = gupCardsY + gupCardH + 24;
    const finalReadyY = Math.min(readyBandY, h / 2 - 70);
    const rc = this._shopReadyCount;
    this._shopReadyText = this.add.text(0, finalReadyY, `${rc.ready || 0}/${rc.total || '?'} Players Ready`, {
      fontSize: '12px', color: '#888',
    }).setOrigin(0.5);
    this.shopContainer.add(this._shopReadyText);

    const btnW = 220, btnH = 44;
    const btnY = finalReadyY + 14;
    const readyBtn = this.add.graphics();
    const alreadyReady = this._localReady;
    const drawReady = (hover) => {
      readyBtn.clear();
      const fill = alreadyReady ? 0x0f3f0f : (hover ? 0x2a8a2a : 0x1a6a1a);
      readyBtn.fillStyle(fill, 0.95);
      readyBtn.fillRoundedRect(-btnW / 2, btnY, btnW, btnH, 8);
      readyBtn.lineStyle(hover && !alreadyReady ? 3 : 2, 0x44ff44, alreadyReady ? 0.4 : (hover ? 1 : 0.75));
      readyBtn.strokeRoundedRect(-btnW / 2, btnY, btnW, btnH, 8);
    };
    drawReady(false);
    this.shopContainer.add(readyBtn);

    const readyLabel = this.add.text(0, btnY + btnH / 2, alreadyReady ? 'READY!' : 'READY', {
      fontSize: '20px', color: alreadyReady ? '#aaffaa' : '#44ff44', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.shopContainer.add(readyLabel);

    if (!alreadyReady) {
      const readyZone = this.add.zone(0, btnY + btnH / 2, btnW, btnH).setInteractive({ useHandCursor: true });
      this.shopContainer.add(readyZone);
      readyZone.on('pointerover', () => drawReady(true));
      readyZone.on('pointerout', () => drawReady(false));
      readyZone.on('pointerdown', () => {
        this._localReady = true;
        gameScene.submitShopReady();
        readyLabel.setText('READY!');
        readyLabel.setColor('#aaffaa');
        readyZone.disableInteractive();
        drawReady(false);
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
