import Peer from 'peerjs';

/**
 * P2P networking using PeerJS (WebRTC wrapper).
 * Host-authoritative: host runs simulation, clients send inputs.
 */
export class NetworkManager {
  constructor() {
    this.peer = null;
    this.connections = new Map(); // peerId -> DataConnection
    this.isHost = false;
    this.hostConnection = null; // client's connection to host
    this.gameCode = '';
    this.localPlayerId = '';
    this.playerName = '';
    this.players = new Map(); // playerId -> { name, peerId }

    this.gameStarted = false;
    this.testMode = false;

    // Disconnected players eligible for reconnection (name -> original peerId)
    this.disconnectedPlayers = new Map();

    // Callbacks
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onPlayerReconnected = null;
    this.onGameStart = null;
    this.onGameState = null;
    this.onPlayerInput = null;
    this.onPlayerListUpdate = null;
    this.onShowShop = null;
    this.onShopClosed = null;
    this.onShopUpdate = null;
    this.onShopReadyUpdate = null;
    this.onShowUpgrades = null;
    this.onUpgradeStatus = null;
    this.onStartRound = null;
    this.onUpgradeApplied = null;
    this.onShowModifierVote = null;
    this.onModifierResult = null;
  }

  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const arr = new Uint8Array(8);
    crypto.getRandomValues(arr);
    return Array.from(arr, (x) => chars[x % chars.length]).join('');
  }

  /**
   * Host a new game. Creates a PeerJS peer with a predictable ID based on game code.
   */
  hostGame(playerName) {
    return new Promise((resolve, reject) => {
      this.isHost = true;
      this.playerName = playerName;
      this.gameCode = this._generateCode();
      const peerId = `grimwar-${this.gameCode}`;

      this.peer = new Peer(peerId);

      this.peer.on('open', (id) => {
        this.localPlayerId = id;
        this.players.set(id, { name: playerName, peerId: id, isHost: true });
        this._setupHostListeners();
        resolve(this.gameCode);
      });

      this.peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          // Code collision, try again
          this.gameCode = this._generateCode();
          this.peer.destroy();
          this.hostGame(playerName).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }

  /**
   * Join an existing game by code.
   */
  joinGame(gameCode, playerName) {
    return new Promise((resolve, reject) => {
      this.isHost = false;
      this.playerName = playerName;
      this.gameCode = gameCode.toUpperCase();
      const hostPeerId = `grimwar-${this.gameCode}`;

      this.peer = new Peer();

      this.peer.on('open', (id) => {
        this.localPlayerId = id;

        const conn = this.peer.connect(hostPeerId, { reliable: true });

        conn.on('open', () => {
          this.hostConnection = conn;
          // Send join request
          conn.send({
            type: 'join',
            name: playerName,
            peerId: id,
          });

          this._setupClientListeners(conn);
          resolve();
        });

        conn.on('error', (err) => reject(err));

        // Timeout if connection doesn't open
        setTimeout(() => {
          if (!this.hostConnection) {
            reject(new Error('Connection timed out. Check the game code.'));
          }
        }, 10000);
      });

      this.peer.on('error', (err) => {
        reject(new Error('Could not connect. Check the game code.'));
      });
    });
  }

  _setupHostListeners() {
    this.peer.on('connection', (conn) => {
      conn.on('open', () => {
        // Wait for join message
        conn.on('data', (data) => {
          this._handleHostMessage(conn, data);
        });
      });

      conn.on('close', () => {
        this._handleDisconnect(conn.peer);
      });

      conn.on('error', () => {
        this._handleDisconnect(conn.peer);
      });
    });
  }

  _sanitizeName(name) {
    if (typeof name !== 'string') return 'Unknown';
    return name.substring(0, 24).replace(/[<>"'&]/g, '');
  }

  _handleHostMessage(conn, data) {
    if (!data || typeof data.type !== 'string') return;
    switch (data.type) {
      case 'join': {
        data.name = this._sanitizeName(data.name);
        // Check if this is a reconnection attempt during an active game
        if (this.gameStarted && this.disconnectedPlayers.has(data.name)) {
          const originalPeerId = this.disconnectedPlayers.get(data.name);
          this.disconnectedPlayers.delete(data.name);

          // Map the new connection under the original peerId
          this.connections.set(originalPeerId, conn);
          // Tag the connection so input routing uses the original peerId
          conn._originalPeerId = originalPeerId;

          // Restore the player entry
          this.players.set(originalPeerId, {
            name: data.name,
            peerId: originalPeerId,
            isHost: false,
          });

          // Tell the reconnecting client their restored peerId and current game state
          conn.send({
            type: 'reconnect',
            originalPeerId,
            players: Array.from(this.players.values()),
            gameMode: this._lastGameMode,
          });

          // Broadcast updated player list
          this.broadcastToClients({
            type: 'player-list',
            players: Array.from(this.players.values()),
          });

          if (this.onPlayerReconnected) this.onPlayerReconnected(originalPeerId, data.name);
          if (this.onPlayerListUpdate) {
            this.onPlayerListUpdate(Array.from(this.players.values()));
          }
          break;
        }

        // Normal join (game hasn't started)
        if (this.gameStarted) {
          conn.send({ type: 'error', message: 'Game already in progress. Use the same name to reconnect.' });
          conn.close();
          return;
        }
        if (this.players.size >= 8) {
          conn.send({ type: 'error', message: 'Game is full (max 8 players).' });
          conn.close();
          return;
        }
        this.connections.set(data.peerId, conn);
        this.players.set(data.peerId, {
          name: data.name,
          peerId: data.peerId,
          isHost: false,
        });

        // Send current player list to new player
        conn.send({
          type: 'player-list',
          players: Array.from(this.players.values()),
        });

        // Broadcast updated player list to all
        this.broadcastToClients({
          type: 'player-list',
          players: Array.from(this.players.values()),
        });

        if (this.onPlayerJoined) this.onPlayerJoined(data);
        if (this.onPlayerListUpdate) {
          this.onPlayerListUpdate(Array.from(this.players.values()));
        }
        break;
      }
      case 'input': {
        // Route input using original peerId if this is a reconnected player
        const peerId = conn._originalPeerId || conn.peer;
        if (this.onPlayerInput) this.onPlayerInput(peerId, data);
        break;
      }
    }
  }

  _handleDisconnect(peerId) {
    this.connections.delete(peerId);
    const player = this.players.get(peerId);

    if (this.gameStarted && player) {
      // Keep the player slot for reconnection, store name -> original peerId
      this.disconnectedPlayers.set(player.name, peerId);
      // Mark them as disconnected but keep in players map
      player.disconnected = true;
      this.players.set(peerId, player);
    } else {
      this.players.delete(peerId);
    }

    this.broadcastToClients({
      type: 'player-list',
      players: Array.from(this.players.values()),
    });

    if (this.onPlayerLeft) this.onPlayerLeft(player);
    if (this.onPlayerListUpdate) {
      this.onPlayerListUpdate(Array.from(this.players.values()));
    }
  }

  _setupClientListeners(conn) {
    conn.on('data', (data) => {
      switch (data.type) {
        case 'player-list':
          this.players.clear();
          data.players.forEach((p) => this.players.set(p.peerId, p));
          if (this.onPlayerListUpdate) this.onPlayerListUpdate(data.players);
          break;
        case 'game-start':
          if (this.onGameStart) this.onGameStart(data);
          break;
        case 'reconnect':
          // Server assigned us our original peerId back
          this.localPlayerId = data.originalPeerId;
          this.players.clear();
          data.players.forEach((p) => this.players.set(p.peerId, p));
          if (this.onPlayerListUpdate) this.onPlayerListUpdate(data.players);
          if (this.onGameStart) this.onGameStart({
            type: 'game-start',
            players: data.players,
            gameMode: data.gameMode,
            reconnect: true,
          });
          break;
        case 'game-state':
          if (this.onGameState) this.onGameState(data);
          break;
        case 'show-upgrades':
          if (this.onShowUpgrades) this.onShowUpgrades(data);
          break;
        case 'upgrade-status':
          if (this.onUpgradeStatus) this.onUpgradeStatus(data);
          break;
        case 'game-start-round':
          if (this.onStartRound) this.onStartRound(data);
          break;
        case 'show-modifier-vote':
          if (this.onShowModifierVote) this.onShowModifierVote(data);
          break;
        case 'modifier-result':
          if (this.onModifierResult) this.onModifierResult(data);
          break;
        case 'upgrade-applied':
          if (this.onUpgradeApplied) this.onUpgradeApplied(data);
          break;
        case 'show-shop':
          if (this.onShowShop) this.onShowShop(data);
          break;
        case 'shop-closed':
          if (this.onShopClosed) this.onShopClosed(data);
          break;
        case 'shop-update':
          if (this.onShopUpdate) this.onShopUpdate(data);
          break;
        case 'shop-ready-update':
          if (this.onShopReadyUpdate) this.onShopReadyUpdate(data);
          break;
        case 'error':
          console.error('Server error:', data.message);
          break;
      }
    });

    conn.on('close', () => {
      console.log('Disconnected from host');
    });
  }

  /**
   * Host broadcasts game state to all clients.
   */
  broadcastToClients(data) {
    this.connections.forEach((conn) => {
      if (conn.open) conn.send(data);
    });
  }

  /**
   * Client sends input to host.
   */
  sendInput(inputData) {
    if (this.isHost) {
      // Host processes own input directly
      if (this.onPlayerInput) this.onPlayerInput(this.localPlayerId, inputData);
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({ type: 'input', ...inputData });
    }
  }

  /**
   * Host starts the game.
   */
  startGame(gameMode) {
    if (!this.isHost) return;
    this.gameStarted = true;
    this._lastGameMode = gameMode || 'roguelike';
    const startData = {
      type: 'game-start',
      players: Array.from(this.players.values()),
      gameMode: this._lastGameMode,
    };
    this.broadcastToClients(startData);
    if (this.onGameStart) this.onGameStart(startData);
  }

  getPlayerCount() {
    return this.players.size;
  }

  destroy() {
    if (this.peer) this.peer.destroy();
  }
}

// Singleton
export const network = new NetworkManager();
