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

    // Callbacks
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onGameStart = null;
    this.onGameState = null;
    this.onPlayerInput = null;
    this.onPlayerListUpdate = null;
  }

  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
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

  _handleHostMessage(conn, data) {
    switch (data.type) {
      case 'join': {
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
        if (this.onPlayerInput) this.onPlayerInput(conn.peer, data);
        break;
      }
    }
  }

  _handleDisconnect(peerId) {
    this.connections.delete(peerId);
    const player = this.players.get(peerId);
    this.players.delete(peerId);

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
        case 'game-state':
          if (this.onGameState) this.onGameState(data);
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
  startGame() {
    if (!this.isHost) return;
    const startData = {
      type: 'game-start',
      players: Array.from(this.players.values()),
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
