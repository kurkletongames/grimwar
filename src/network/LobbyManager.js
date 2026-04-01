import { network } from './NetworkManager.js';

/**
 * Manages the HTML lobby UI and bridges it to the NetworkManager.
 */
export class LobbyManager {
  constructor(onGameStart) {
    this.onGameStart = onGameStart;

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

  async _onHost() {
    const name = this._getName();
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

    const players = [
      { peerId: 'local-player', name, isHost: true },
      { peerId: 'bot-1', name: 'Bot Ignis', isHost: false },
      { peerId: 'bot-2', name: 'Bot Frost', isHost: false },
      { peerId: 'bot-3', name: 'Bot Storm', isHost: false },
    ];

    this.lobby.classList.add('hidden');
    if (this.onGameStart) {
      this.onGameStart({ type: 'game-start', players, testMode: true });
    }
  }

  _onBack() {
    this.joinSection.style.display = 'none';
    this.lobbyMenu.style.display = 'block';
    this.lobbyStatus.textContent = '';
  }

  _onStart() {
    network.startGame();
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
      if (this.onGameStart) this.onGameStart(data);
    };
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
