// Canonical prize pool. Keep the ids stable - the admin panel references
// prizes by id when an admin wants to force a specific outcome for a user.
const PRIZE_POOL = [
  { id: "p1", name: "💰 Турнірний квиток до 100 фішок", rarity: "veryOften", icon: "ticket", rpValue: 100 },
  { id: "p2", name: "💰 75 фішок", rarity: "veryOften", icon: "coins", rpValue: 75 },
  { id: "p3", name: "💰 100 фішок", rarity: "veryOften", icon: "coins", rpValue: 100 },
  { id: "p4", name: "💰 250 фішок", rarity: "veryOften", icon: "coins", rpValue: 250 },
  { id: "p5", name: "💰 500 фішок", rarity: "rare", icon: "gem", rpValue: 500 },
  { id: "p6", name: "💰 1 000 фішок", rarity: "veryRare", icon: "gem", rpValue: 1000 },
  { id: "p7", name: "🎟 Турнірний квиток 300/500 фішок", rarity: "rare", icon: "award", rpValue: 500 },
  { id: "p8", name: "🎁 +50 RP point", rarity: "medium", icon: "gift", rpValue: 50 },
  { id: "p9", name: "👑 +100 RP point", rarity: "medium", icon: "crown", rpValue: 100 },
];

// Odds used when the admin does NOT force a specific prize.
const WEIGHTS = { veryOften: 60, medium: 25, rare: 12, veryRare: 3 };

function getPrizeById(id) {
  return PRIZE_POOL.find((p) => p.id === id) || null;
}

function rollRandomPrize() {
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  let chosenRarity = "veryOften";
  for (const [rarity, w] of Object.entries(WEIGHTS)) {
    if (roll < w) {
      chosenRarity = rarity;
      break;
    }
    roll -= w;
  }
  const pool = PRIZE_POOL.filter((p) => p.rarity === chosenRarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = { PRIZE_POOL, WEIGHTS, getPrizeById, rollRandomPrize };
