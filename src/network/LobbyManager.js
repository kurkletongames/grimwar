import { network } from './NetworkManager.js';
import { validateCosmetics } from '../data/Cosmetics.js';

/**
 * Manages the HTML lobby UI and bridges it to the NetworkManager.
 */
export class LobbyManager {
  constructor(onGameStart) {
    this.onGameStart = onGameStart;
    this.gameMode = 'roguelike'; // 'roguelike' or 'arena'

    // DOM elements
    this.lobby = document.getElementById('lobby');
    this.nameInput = document.getElementById('name-input');
    this.lobbyMenu = document.getElementById('lobby-menu');
    this.joinSection = document.getElementById('join-section');
    this.hostSection = document.getElementById('host-section');
    this.clientSection = document.getElementById('client-section');
    this.joinCodeInput = document.getElementById('join-code-input');
    this.gameCodeDisplay = document.getElementById('game-code-display');
    this.playerList = document.getElementById('player-list');
    this.clientPlayerList = document.getElementById('client-player-list');
    this.btnStart = document.getElementById('btn-start');
    this.lobbyStatus = document.getElementById('lobby-status');

    this._bindEvents();
    this._setupNetworkCallbacks();
  }

  _bindEvents() {
    document.getElementById('btn-host').addEventListener('click', () => this._onHost());
    document.getElementById('btn-join').addEventListener('click', () => this._onShowJoin());
    document.getElementById('btn-join-confirm').addEventListener('click', () => this._onJoin());
    document.getElementById('btn-back').addEventListener('click', () => this._onBack());
    document.getElementById('btn-test').addEventListener('click', () => this._onTestMode());
    this.btnStart.addEventListener('click', () => this._onStart());

    // Character editor toggle + preview
    document.getElementById('btn-customize').addEventListener('click', () => {
      const section = document.getElementById('customize-section');
      section.style.display = section.style.display === 'none' ? 'block' : 'none';
      if (section.style.display !== 'none') this._drawPreview();
    });

    // Update preview when any cosmetic dropdown changes
    ['cosmetic-hat', 'cosmetic-eyes', 'cosmetic-mouth', 'cosmetic-trail', 'cosmetic-aura'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => this._drawPreview());
    });

    // Mode selection
    const btnRoguelike = document.getElementById('btn-mode-roguelike');
    const btnArena = document.getElementById('btn-mode-arena');
    const modeDesc = document.getElementById('mode-description');

    btnRoguelike.addEventListener('click', () => {
      this.gameMode = 'roguelike';
      btnRoguelike.style.background = '#e94560';
      btnRoguelike.style.color = '#fff';
      btnArena.style.background = 'transparent';
      btnArena.style.color = '#e94560';
      modeDesc.textContent = 'Earn upgrades between rounds — losers choose a powerup';
    });

    btnArena.addEventListener('click', () => {
      this.gameMode = 'arena';
      btnArena.style.background = '#e94560';
      btnArena.style.color = '#fff';
      btnRoguelike.style.background = 'transparent';
      btnRoguelike.style.color = '#e94560';
      modeDesc.textContent = 'Buy spells and upgrades from the shop between rounds';
    });

    // Allow enter key in join code input
    this.joinCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._onJoin();
    });
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-host').click();
    });
  }

  _getName() {
    const name = this.nameInput.value.trim();
    return name || `Wizard${Math.floor(Math.random() * 999)}`;
  }

  _getCosmetics() {
    return validateCosmetics({
      hat: document.getElementById('cosmetic-hat')?.value,
      trail: document.getElementById('cosmetic-trail')?.value,
      eyes: document.getElementById('cosmetic-eyes')?.value,
      aura: document.getElementById('cosmetic-aura')?.value,
      mouth: document.getElementById('cosmetic-mouth')?.value,
    });
  }

  async _onHost() {
    const name = this._getName();
    network._cosmetics = this._getCosmetics();
    this.lobbyStatus.textContent = 'Creating game...';

    try {
      const code = await network.hostGame(name);
      this.lobbyMenu.style.display = 'none';
      this.nameInput.style.display = 'none';
      this.hostSection.style.display = 'block';
      this.gameCodeDisplay.textContent = code;
      this.lobbyStatus.textContent = 'Waiting for players...';
      this._updatePlayerList(Array.from(network.players.values()));
    } catch (err) {
      this.lobbyStatus.textContent = `Error: ${err.message}`;
    }
  }

  _onShowJoin() {
    if (!this._getName()) {
      this.lobbyStatus.textContent = 'Enter a name first!';
      return;
    }
    this.lobbyMenu.style.display = 'none';
    this.joinSection.style.display = 'block';
    this.lobbyStatus.textContent = '';
    this.joinCodeInput.focus();
  }

  async _onJoin() {
    const code = this.joinCodeInput.value.trim().toUpperCase();
    if (!code) {
      this.lobbyStatus.textContent = 'Enter a game code!';
      return;
    }
    const name = this._getName();
    network._cosmetics = this._getCosmetics();
    this.lobbyStatus.textContent = 'Connecting...';

    try {
      await network.joinGame(code, name);
      this.joinSection.style.display = 'none';
      this.nameInput.style.display = 'none';
      this.clientSection.style.display = 'block';
      this.lobbyStatus.textContent = 'Connected! Waiting for host...';
    } catch (err) {
      this.lobbyStatus.textContent = `Error: ${err.message}`;
    }
  }

  _onTestMode() {
    const name = this._getName();
    network.isHost = true;
    network.localPlayerId = 'local-player';
    network.testMode = true;

    const cosmetics = this._getCosmetics();
    const players = [
      { peerId: 'local-player', name, isHost: true, cosmetics },
      { peerId: 'bot-1', name: 'Bot Ignis', isHost: false, cosmetics: { hat: 'horns', trail: 'fire', eyes: 'angry', aura: 'flame', mouth: 'fangs' } },
      { peerId: 'bot-2', name: 'Bot Frost', isHost: false, cosmetics: { hat: 'halo', trail: 'ice', eyes: 'normal', aura: 'frost', mouth: 'smile' } },
      { peerId: 'bot-3', name: 'Bot Storm', isHost: false, cosmetics: { hat: 'crown', trail: 'shadow', eyes: 'cyclops', aura: 'dark', mouth: 'grin' } },
    ];

    this.lobby.classList.add('hidden');
    if (this.onGameStart) {
      this.onGameStart({ type: 'game-start', players, testMode: true, gameMode: this.gameMode });
    }
  }

  _onBack() {
    this.joinSection.style.display = 'none';
    this.lobbyMenu.style.display = 'block';
    this.lobbyStatus.textContent = '';
  }

  _onStart() {
    network.startGame(this.gameMode);
  }

  _setupNetworkCallbacks() {
    network.onPlayerListUpdate = (players) => {
      this._updatePlayerList(players);
      this._updateClientPlayerList(players);
      // Enable start button if at least 1 player (for testing solo, normally 2+)
      if (this.btnStart) {
        this.btnStart.disabled = players.length < 1;
      }
    };

    network.onGameStart = (data) => {
      this.lobby.classList.add('hidden');
      const pageContent = document.getElementById('page-content');
      if (pageContent) pageContent.style.display = 'none';
      if (this.onGameStart) this.onGameStart(data);
    };
  }

  _drawPreview() {
    const canvas = document.getElementById('wizard-preview');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2 + 5;
    const r = 18; // wizard radius
    const cos = this._getCosmetics();

    ctx.clearRect(0, 0, w, h);

    // Aura
    const auraColors = { flame: '#ff4400', frost: '#88ddff', dark: '#442266', holy: '#ffdd44', electric: '#ffff44', nature: '#44aa22' };
    if (cos.aura !== 'none' && auraColors[cos.aura]) {
      ctx.fillStyle = auraColors[cos.aura];
      ctx.globalAlpha = 0.12;
      ctx.beginPath(); ctx.arc(cx, cy, r + 20, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.07;
      ctx.beginPath(); ctx.arc(cx, cy, r + 30, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Body
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

    // Hat
    ctx.fillStyle = '#4fc3f7';
    ctx.globalAlpha = 0.8;
    if (cos.hat === 'classic') {
      ctx.beginPath(); ctx.moveTo(cx - 12, cy - 12); ctx.lineTo(cx + 12, cy - 12); ctx.lineTo(cx, cy - 32); ctx.fill();
    } else if (cos.hat === 'crown') {
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(cx - 10, cy - 22, 20, 8);
      ctx.beginPath(); ctx.moveTo(cx - 10, cy - 22); ctx.lineTo(cx - 6, cy - 22); ctx.lineTo(cx - 8, cy - 30); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - 2, cy - 22); ctx.lineTo(cx + 2, cy - 22); ctx.lineTo(cx, cy - 32); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 6, cy - 22); ctx.lineTo(cx + 10, cy - 22); ctx.lineTo(cx + 8, cy - 30); ctx.fill();
    } else if (cos.hat === 'horns') {
      ctx.fillStyle = '#cc2222';
      ctx.beginPath(); ctx.moveTo(cx - 14, cy - 8); ctx.lineTo(cx - 8, cy - 10); ctx.lineTo(cx - 16, cy - 28); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 14, cy - 8); ctx.lineTo(cx + 8, cy - 10); ctx.lineTo(cx + 16, cy - 28); ctx.fill();
    } else if (cos.hat === 'halo') {
      ctx.strokeStyle = '#ffdd44'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy - 24, 11, 4, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (cos.hat === 'tophat') {
      ctx.fillStyle = '#222'; ctx.fillRect(cx - 10, cy - 20, 20, 6); ctx.fillRect(cx - 7, cy - 34, 14, 14);
    } else if (cos.hat === 'beanie') {
      ctx.fillStyle = '#4488cc';
      ctx.beginPath(); ctx.arc(cx, cy - 16, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, cy - 28, 4, 0, Math.PI * 2); ctx.fill();
    } else if (cos.hat === 'antenna') {
      ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy - 16); ctx.lineTo(cx, cy - 34); ctx.stroke();
      ctx.fillStyle = '#44ff44';
      ctx.beginPath(); ctx.arc(cx, cy - 36, 4, 0, Math.PI * 2); ctx.fill();
    } else if (cos.hat === 'mohawk') {
      ctx.fillStyle = '#ff2288';
      for (let i = 0; i < 5; i++) {
        const mx = cx - 6 + i * 3;
        ctx.beginPath(); ctx.moveTo(mx - 2, cy - 14); ctx.lineTo(mx + 2, cy - 14); ctx.lineTo(mx, cy - 28 - i); ctx.fill();
      }
    } else if (cos.hat === 'cat_ears') {
      ctx.fillStyle = '#4fc3f7';
      ctx.beginPath(); ctx.moveTo(cx - 14, cy - 10); ctx.lineTo(cx - 6, cy - 10); ctx.lineTo(cx - 10, cy - 26); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 14, cy - 10); ctx.lineTo(cx + 6, cy - 10); ctx.lineTo(cx + 10, cy - 26); ctx.fill();
      ctx.fillStyle = '#ffaaaa'; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(cx - 12, cy - 12); ctx.lineTo(cx - 8, cy - 12); ctx.lineTo(cx - 10, cy - 22); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 12, cy - 12); ctx.lineTo(cx + 8, cy - 12); ctx.lineTo(cx + 10, cy - 22); ctx.fill();
    } else if (cos.hat === 'pirate') {
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.moveTo(cx - 14, cy - 14); ctx.lineTo(cx + 14, cy - 14); ctx.lineTo(cx, cy - 30); ctx.fill();
      ctx.fillRect(cx - 14, cy - 16, 28, 4);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, cy - 20, 3, 0, Math.PI * 2); ctx.fill();
    } else if (cos.hat === 'chef') {
      ctx.fillStyle = '#eee';
      ctx.beginPath(); ctx.arc(cx, cy - 24, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - 8, cy - 18, 16, 6);
    }
    ctx.globalAlpha = 1;

    // Eyes
    if (cos.eyes === 'normal' || cos.eyes === 'angry') {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - 6, cy - 3, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 6, cy - 3, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(cx - 5, cy - 3, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 7, cy - 3, 2, 0, Math.PI * 2); ctx.fill();
      if (cos.eyes === 'angry') {
        ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx - 10, cy - 8); ctx.lineTo(cx - 2, cy - 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 10, cy - 8); ctx.lineTo(cx + 2, cy - 6); ctx.stroke();
      }
    } else if (cos.eyes === 'cyclops') {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, cy - 3, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(cx + 1, cy - 3, 3, 0, Math.PI * 2); ctx.fill();
    } else if (cos.eyes === 'closed') {
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 9, cy - 3); ctx.lineTo(cx - 3, cy - 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 3, cy - 3); ctx.lineTo(cx + 9, cy - 3); ctx.stroke();
    } else if (cos.eyes === 'glowing') {
      ctx.fillStyle = '#4fc3f7'; ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.arc(cx - 6, cy - 3, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 6, cy - 3, 6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - 6, cy - 3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 6, cy - 3, 3, 0, Math.PI * 2); ctx.fill();
    } else if (cos.eyes === 'x_eyes') {
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 8, cy - 5); ctx.lineTo(cx - 4, cy - 1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 4, cy - 5); ctx.lineTo(cx - 8, cy - 1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 4, cy - 5); ctx.lineTo(cx + 8, cy - 1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 8, cy - 5); ctx.lineTo(cx + 4, cy - 1); ctx.stroke();
    } else if (cos.eyes === 'hearts') {
      ctx.fillStyle = '#ff4488';
      ctx.beginPath(); ctx.arc(cx - 7, cy - 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx - 5, cy - 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - 9, cy - 3); ctx.lineTo(cx - 3, cy - 3); ctx.lineTo(cx - 6, cy + 1); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 5, cy - 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 7, cy - 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 3, cy - 3); ctx.lineTo(cx + 9, cy - 3); ctx.lineTo(cx + 6, cy + 1); ctx.fill();
    } else if (cos.eyes === 'tiny') {
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(cx - 5, cy - 3, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 5, cy - 3, 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (cos.eyes === 'wide') {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - 6, cy - 3, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 6, cy - 3, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(cx - 5, cy - 3, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 7, cy - 3, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    // Mouth
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7;
    if (cos.mouth === 'smile') {
      ctx.beginPath(); ctx.arc(cx, cy + 4, 5, 0.2, Math.PI - 0.2); ctx.stroke();
    } else if (cos.mouth === 'grin') {
      ctx.beginPath(); ctx.arc(cx, cy + 3, 6, 0.1, Math.PI - 0.1); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.6;
      ctx.fillRect(cx - 4, cy + 5, 8, 2);
    } else if (cos.mouth === 'frown') {
      ctx.beginPath(); ctx.arc(cx, cy + 10, 5, Math.PI + 0.2, -0.2); ctx.stroke();
    } else if (cos.mouth === 'fangs') {
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.moveTo(cx - 4, cy + 4); ctx.lineTo(cx - 2, cy + 4); ctx.lineTo(cx - 3, cy + 9); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 2, cy + 4); ctx.lineTo(cx + 4, cy + 4); ctx.lineTo(cx + 3, cy + 9); ctx.fill();
    } else if (cos.mouth === 'tongue') {
      ctx.beginPath(); ctx.moveTo(cx - 4, cy + 5); ctx.lineTo(cx + 4, cy + 5); ctx.stroke();
      ctx.fillStyle = '#ff6688'; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(cx, cy + 9, 3, 0, Math.PI * 2); ctx.fill();
    } else if (cos.mouth === 'mustache') {
      ctx.strokeStyle = '#443322'; ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(cx - 4, cy + 4, 5, Math.PI + 0.3, -0.3); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + 4, cy + 4, 5, Math.PI + 0.3, -0.3); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _updatePlayerList(players) {
    this.playerList.innerHTML = '';
    players.forEach((p) => {
      const li = document.createElement('li');
      li.textContent = p.name;
      if (p.isHost) {
        const badge = document.createElement('span');
        badge.className = 'host-badge';
        badge.textContent = '(HOST)';
        li.appendChild(badge);
      }
      this.playerList.appendChild(li);
    });
  }

  _updateClientPlayerList(players) {
    this.clientPlayerList.innerHTML = '';
    players.forEach((p) => {
      const li = document.createElement('li');
      li.textContent = p.name;
      if (p.isHost) {
        const badge = document.createElement('span');
        badge.className = 'host-badge';
        badge.textContent = '(HOST)';
        li.appendChild(badge);
      }
      this.clientPlayerList.appendChild(li);
    });
  }

  show() {
    this.lobby.classList.remove('hidden');
  }
}
