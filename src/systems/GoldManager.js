/**
 * Per-player gold tracking for arena mode shop.
 */

const BASE_ROUND_GOLD = 150;
const WIN_BONUS_GOLD = 75;
const KILL_BONUS_GOLD = 50;

export class GoldManager {
  constructor() {
    this.gold = new Map(); // playerId -> gold amount
  }

  init(playerIds) {
    playerIds.forEach((id) => this.gold.set(id, 0));
  }

  awardRoundGold(winnerId) {
    for (const [playerId, current] of this.gold) {
      const bonus = playerId === winnerId ? WIN_BONUS_GOLD : 0;
      this.gold.set(playerId, current + BASE_ROUND_GOLD + bonus);
    }
  }

  awardKillGold(playerId) {
    const current = this.gold.get(playerId) || 0;
    this.gold.set(playerId, current + KILL_BONUS_GOLD);
  }

  getGold(playerId) {
    return this.gold.get(playerId) || 0;
  }

  spend(playerId, amount) {
    const current = this.gold.get(playerId) || 0;
    if (current < amount) return false;
    this.gold.set(playerId, current - amount);
    return true;
  }

  serialize() {
    return Object.fromEntries(this.gold);
  }

  applyState(data) {
    for (const [pid, amount] of Object.entries(data)) {
      this.gold.set(pid, amount);
    }
  }
}
