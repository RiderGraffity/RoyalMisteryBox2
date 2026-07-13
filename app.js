require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const { PRIZE_POOL, getPrizeById, rollRandomPrize } = require("./prizes");
const db = require("./db");
const {
  verifyInitData,
  isAdmin,
  notifyAdminsOfWin,
  notifyAdminsOfPurchase,
  notifyUserKeysCredited,
} = require("./telegram");
const { announceMysteryBoxWin } = require("./announce");

const app = express();

app.use(cors());
app.use(express.json());

/* ------------------------------------------------------------------ */
/* Basic auth / profile sync                                          */
/* ------------------------------------------------------------------ */
app.post("/api/auth", (req, res) => {
  const tgUser = verifyInitData(req.body.initData);
  if (!tgUser) {
    return res.status(401).json({ success: false, error: "invalid_init_data" });
  }

  const user = db.touchUserProfile(tgUser.id, {
    username: tgUser.username || null,
    firstName: tgUser.first_name || null,
  });

  res.json({
    success: true,
    user: {
      id: user.id,
      tickets: user.tickets,
      rpPoints: user.rpPoints,
      history: user.history,
      clubGgId: user.clubGgId,
      displayName: user.displayName,
      boxesOpened: user.boxesOpened,
    },
  });
});

/* ------------------------------------------------------------------ */
/* Verification: ClubGG ID + display name (player facing)             */
/* ------------------------------------------------------------------ */
// Players must submit their ClubGG ID and a display name before they're
// allowed to open the Mystery Box (see /api/open-box below). The ClubGG ID
// lets every win be traced back to a real ClubGG account, and the display
// name is what's shown back to the player everywhere else - the
// leaderboard and the public win announcement - instead of their raw
// Telegram profile name.
app.post("/api/set-clubgg-id", (req, res) => {
  const tgUser = verifyInitData(req.body.initData);
  if (!tgUser) {
    return res.status(401).json({ success: false, error: "invalid_init_data" });
  }

  const clubGgId = String(req.body.clubGgId || "").trim();
  if (!clubGgId) {
    return res.status(400).json({ success: false, error: "missing_clubgg_id" });
  }
  if (clubGgId.length > 40) {
    return res.status(400).json({ success: false, error: "invalid_clubgg_id" });
  }

  const displayName = String(req.body.displayName || "").trim();
  if (!displayName) {
    return res.status(400).json({ success: false, error: "missing_display_name" });
  }
  if (displayName.length > 40) {
    return res.status(400).json({ success: false, error: "invalid_display_name" });
  }

  const user = db.setVerification(tgUser.id, { clubGgId, displayName });
  res.json({ success: true, user: { id: user.id, clubGgId: user.clubGgId, displayName: user.displayName } });
});

/* ------------------------------------------------------------------ */
/* Box opening (player facing)                                        */
/* ------------------------------------------------------------------ */
app.post("/api/open-box", async (req, res) => {
  const tgUser = verifyInitData(req.body.initData);
  if (!tgUser) {
    return res.status(401).json({ success: false, error: "invalid_init_data" });
  }

  const current = db.getUser(tgUser.id);
  if (!current.clubGgId) {
    return res.status(400).json({ success: false, error: "clubgg_required" });
  }
  if (current.tickets <= 0) {
    return res.status(400).json({ success: false, error: "no_tickets" });
  }

  const forced = current.forcedPrizeId ? getPrizeById(current.forcedPrizeId) : null;
  const prize = forced || rollRandomPrize();

  const { user, ok } = db.consumeTicketAndRecordPrize(tgUser.id, prize);
  if (!ok) {
    return res.status(400).json({ success: false, error: "no_tickets" });
  }

  notifyAdminsOfWin(tgUser, prize, user.clubGgId, user.displayName).catch((e) => console.error(e));

  const displayName =
    user.displayName || [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") || "Гравець";
  announceMysteryBoxWin({ displayName, prizeLabel: prize.name }).catch((e) => console.error(e));

  res.json({
    success: true,
    prize,
    user: {
      id: user.id,
      tickets: user.tickets,
      rpPoints: user.rpPoints,
      history: user.history,
      boxesOpened: user.boxesOpened,
    },
  });
});

/* ------------------------------------------------------------------ */
/* Missions (player facing) - selections persist per user and reset    */
/* automatically every Sunday (see missions.js:getCurrentWeekKey).     */
/* ------------------------------------------------------------------ */
app.post("/api/missions/select", (req, res) => {
  const tgUser = verifyInitData(req.body.initData);
  if (!tgUser) {
    return res.status(401).json({ success: false, error: "invalid_init_data" });
  }
  const { missionId, selected } = req.body;
  if (!missionId || !db.isValidMissionId(missionId)) {
    return res.status(400).json({ success: false, error: "unknown_mission" });
  }
  const missions = db.setMissionSelected(tgUser.id, missionId, !!selected);
  res.json({ success: true, missions });
});

app.get("/api/missions/mine", (req, res) => {
  const tgUser = verifyInitData(req.query.initData);
  if (!tgUser) {
    return res.status(401).json({ success: false, error: "invalid_init_data" });
  }
  const missions = db.getUserMissions(tgUser.id);
  res.json({ success: true, missions });
});

/* ------------------------------------------------------------------ */
/* Shop (player facing) - reads the live catalog so admin edits show    */
/* up in the app immediately.                                          */
/* ------------------------------------------------------------------ */
app.get("/api/shop", (req, res) => {
  res.json({ success: true, sections: db.getShopSections({ onlyActive: true }) });
});

app.post("/api/shop/buy", async (req, res) => {
  const tgUser = verifyInitData(req.body.initData);
  if (!tgUser) {
    return res.status(401).json({ success: false, error: "invalid_init_data" });
  }

  const itemId = String(req.body.itemId || "").trim();
  if (!itemId) {
    return res.status(400).json({ success: false, error: "missing_product" });
  }

  const result = db.purchaseShopItem(tgUser.id, itemId);
  if (!result.ok) {
    return res.status(400).json({ success: false, error: result.error, user: result.user });
  }

  notifyAdminsOfPurchase(tgUser, result.item, result.user.clubGgId, result.user.displayName).catch((e) =>
    console.error(e)
  );

  res.json({
    success: true,
    item: result.item,
    user: {
      id: result.user.id,
      rpPoints: result.user.rpPoints,
      tickets: result.user.tickets,
      clubGgId: result.user.clubGgId,
      displayName: result.user.displayName,
      history: result.user.history,
    },
  });
});

app.get("/api/top", (req, res) => {
  res.json({ success: true, leaders: db.getLeaderboard(50) });
});

/* ------------------------------------------------------------------ */
/* Missions catalog (player facing) - reads the live catalog so admin   */
/* edits to mission text/rewards show up in the app immediately.       */
/* ------------------------------------------------------------------ */
app.get("/api/missions", (req, res) => {
  res.json({ success: true, sections: db.getMissionSections({ onlyActive: true }) });
});

/* ------------------------------------------------------------------ */
/* Admin API                                                           */
/* ------------------------------------------------------------------ */
function requireAdmin(req, res, next) {
  const tgUser = verifyInitData((req.body && req.body.initData) || req.query.initData);
  if (!tgUser) {
    return res.status(401).json({ success: false, error: "invalid_init_data" });
  }
  if (!isAdmin(tgUser.id)) {
    return res.status(403).json({ success: false, error: "not_admin" });
  }
  req.tgUser = tgUser;
  next();
}

app.post("/api/admin/verify", requireAdmin, (req, res) => {
  res.json({ success: true, admin: { id: req.tgUser.id } });
});

app.get("/api/admin/prizes", requireAdmin, (req, res) => {
  res.json({ success: true, prizes: PRIZE_POOL });
});

app.get("/api/admin/user", requireAdmin, (req, res) => {
  const targetId = req.query.targetUserId;
  if (!targetId) return res.status(400).json({ success: false, error: "missing_target" });
  const user = db.getUser(targetId);
  res.json({ success: true, user });
});

app.post("/api/admin/give-keys", requireAdmin, (req, res) => {
  const { targetUserId, amount } = req.body;
  if (!targetUserId || !amount) {
    return res.status(400).json({ success: false, error: "missing_fields" });
  }
  const numericAmount = Number(amount);
  const user = db.addTickets(targetUserId, numericAmount);

  // Let the player know in the bot whenever this call actually handed
  // them new keys (not when an admin reduces their balance).
  if (numericAmount > 0) {
    notifyUserKeysCredited(targetUserId, numericAmount, user.tickets).catch((e) => console.error(e));
  }

  res.json({ success: true, user });
});

app.post("/api/admin/set-prize", requireAdmin, (req, res) => {
  const { targetUserId, prizeId } = req.body;
  if (!targetUserId) {
    return res.status(400).json({ success: false, error: "missing_target" });
  }
  if (prizeId && prizeId !== "random" && !getPrizeById(prizeId)) {
    return res.status(400).json({ success: false, error: "unknown_prize" });
  }
  const finalPrizeId = prizeId === "random" ? null : prizeId;
  const user = db.setForcedPrize(targetUserId, finalPrizeId);
  res.json({ success: true, user });
});

app.get("/api/admin/missions", requireAdmin, (req, res) => {
  res.json({ success: true, missions: db.getAllMissionsFlat() });
});

// Full mission catalog, including bonus rows and inactive ones, so the
// admin panel can show and let admins edit everything that already
// exists (mirrors /api/admin/shop-items below).
app.get("/api/admin/mission-items", requireAdmin, (req, res) => {
  res.json({ success: true, items: db.getAllMissionItemsFlat() });
});

// Edit an existing mission. Admins can only change label/reward/active on
// missions that already exist - this endpoint does not create or delete
// missions, nor move a mission between the RP/keys categories.
app.put("/api/admin/mission-items/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const existing = db.getMissionItem(id);
  if (!existing) {
    return res.status(404).json({ success: false, error: "unknown_mission" });
  }

  const { label, rewardAmount, rewardLabel, active } = req.body;

  if (label !== undefined && !String(label).trim()) {
    return res.status(400).json({ success: false, error: "invalid_label" });
  }
  if (rewardAmount !== undefined && (!Number.isFinite(Number(rewardAmount)) || Number(rewardAmount) < 0)) {
    return res.status(400).json({ success: false, error: "invalid_reward_amount" });
  }
  if (rewardLabel !== undefined && !String(rewardLabel).trim()) {
    return res.status(400).json({ success: false, error: "invalid_reward_label" });
  }

  const item = db.updateMissionItem(id, { label, rewardAmount, rewardLabel, active });
  res.json({ success: true, item });
});

app.get("/api/admin/user-missions", requireAdmin, (req, res) => {
  const targetId = req.query.targetUserId;
  if (!targetId) return res.status(400).json({ success: false, error: "missing_target" });
  const missions = db.getUserMissions(targetId);
  res.json({ success: true, missions });
});

// Admin confirms (or un-confirms) that a specific user has completed a
// mission. Confirmed missions light up gold in that user's app and reset
// automatically every Sunday along with everything else mission-related.
app.post("/api/admin/confirm-mission", requireAdmin, (req, res) => {
  const { targetUserId, missionId, confirmed } = req.body;
  if (!targetUserId || !missionId) {
    return res.status(400).json({ success: false, error: "missing_fields" });
  }
  if (!db.isValidMissionId(missionId)) {
    return res.status(400).json({ success: false, error: "unknown_mission" });
  }
  const result = db.setMissionConfirmed(targetUserId, missionId, confirmed !== false);

  // If this confirmation is the one that just credited keys to the user,
  // let them know in the bot.
  if (result.keysCredited > 0) {
    notifyUserKeysCredited(targetUserId, result.keysCredited, result.tickets).catch((e) => console.error(e));
  }

  res.json({
    success: true,
    missions: result.missions,
    tickets: result.tickets,
    rpPoints: result.rpPoints,
  });
});

// Full catalog (including inactive items) so the admin panel can show
// and let admins edit everything that already exists in the shop.
app.get("/api/admin/shop-items", requireAdmin, (req, res) => {
  res.json({ success: true, items: db.getAllShopItemsFlat() });
});

// Edit an existing shop item. Admins can only change label/price/img/
// active on products that already exist - this endpoint does not create
// or delete products.
app.put("/api/admin/shop-items/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const existing = db.getShopItem(id);
  if (!existing) {
    return res.status(404).json({ success: false, error: "unknown_product" });
  }

  const { label, price, img, active } = req.body;

  if (label !== undefined && !String(label).trim()) {
    return res.status(400).json({ success: false, error: "invalid_label" });
  }
  if (price !== undefined && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
    return res.status(400).json({ success: false, error: "invalid_price" });
  }

  const item = db.updateShopItem(id, { label, price, img, active });
  res.json({ success: true, item });
});

/* ------------------------------------------------------------------ */
/* Static front-end                                                   */
/* ------------------------------------------------------------------ */
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// Explicit root handler - so "/" always serves the game, even if static
// serving somehow doesn't pick up index.html on its own.
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Separate admin panel page.
app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

// Health-check for Railway (and generally to verify the service is alive).
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server started on port ${process.env.PORT || 3000}`);
});
