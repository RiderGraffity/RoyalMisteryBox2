const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const {
  getCurrentDayKey,
  getCurrentWeekKey,
  getCurrentMonthKey,
  getNextDailyReset,
  getNextWeeklyReset,
  getNextMonthlyReset,
  MISSION_SEED,
} = require("./missions");
const { SHOP_SEED } = require("./products");

const DB_PATH = path.join(__dirname, "db.sqlite");
const OLD_JSON_PATH = path.join(__dirname, "db.json");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT,
    firstName TEXT,
    tickets INTEGER NOT NULL DEFAULT 0,
    rpPoints INTEGER NOT NULL DEFAULT 0,
    forcedPrizeId TEXT,
    history TEXT NOT NULL DEFAULT '[]',
    missionsDailyKey TEXT,
    missionsWeekKey TEXT,
    missionsSelected TEXT NOT NULL DEFAULT '{}',
    missionsConfirmed TEXT NOT NULL DEFAULT '{}',
    clubGgId TEXT,
    boxesOpened INTEGER NOT NULL DEFAULT 0,
    totalRpEarned INTEGER NOT NULL DEFAULT 0,
    displayName TEXT
  );
`);

// Older databases created before ClubGG verification existed won't have this
// column yet - add it in place so existing installs don't need a fresh DB.
function ensureClubGgIdColumn() {
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const hasColumn = columns.some((c) => c.name === "clubGgId");
  if (!hasColumn) {
    db.exec("ALTER TABLE users ADD COLUMN clubGgId TEXT");
    console.log("[db] Added clubGgId column to users table");
  }
}

ensureClubGgIdColumn();

function ensureMissionsDailyKeyColumn() {
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const hasColumn = columns.some((c) => c.name === "missionsDailyKey");
  if (!hasColumn) {
    db.exec("ALTER TABLE users ADD COLUMN missionsDailyKey TEXT");
    console.log("[db] Added missionsDailyKey column to users table");
  }
}

ensureMissionsDailyKeyColumn();

// Older databases created before monthly missions ("Активність" / "streak"
// sections) existed won't have this column yet - add it in place so
// existing installs don't need a fresh DB.
function ensureMissionsMonthKeyColumn() {
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const hasColumn = columns.some((c) => c.name === "missionsMonthKey");
  if (!hasColumn) {
    db.exec("ALTER TABLE users ADD COLUMN missionsMonthKey TEXT");
    console.log("[db] Added missionsMonthKey column to users table");
  }
}

ensureMissionsMonthKeyColumn();

// Older databases created before ranks were based on box-opening counts
// won't have this column yet - add it in place so existing installs don't
// need a fresh DB. Existing users start at 0 (their past spins are still
// visible in "history", they just won't retroactively count toward rank).
function ensureBoxesOpenedColumn() {
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const hasColumn = columns.some((c) => c.name === "boxesOpened");
  if (!hasColumn) {
    db.exec("ALTER TABLE users ADD COLUMN boxesOpened INTEGER NOT NULL DEFAULT 0");
    console.log("[db] Added boxesOpened column to users table");
  }
}

ensureBoxesOpenedColumn();

// Older databases won't have this column yet. The leaderboard now ranks by
// lifetime RP earned (so spending RP in the shop doesn't hurt your rank)
// instead of the spendable rpPoints balance. Back-fill it from each user's
// current rpPoints so existing players don't drop to the bottom of the top.
function ensureTotalRpEarnedColumn() {
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const hasColumn = columns.some((c) => c.name === "totalRpEarned");
  if (!hasColumn) {
    db.exec("ALTER TABLE users ADD COLUMN totalRpEarned INTEGER NOT NULL DEFAULT 0");
    db.exec("UPDATE users SET totalRpEarned = rpPoints WHERE totalRpEarned = 0");
    console.log("[db] Added totalRpEarned column to users table (back-filled from rpPoints)");
  }
}

ensureTotalRpEarnedColumn();

// Older databases created before players could enter their own in-game
// name (see the ClubGG verification step) won't have this column yet -
// add it in place so existing installs don't need a fresh DB.
function ensureDisplayNameColumn() {
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const hasColumn = columns.some((c) => c.name === "displayName");
  if (!hasColumn) {
    db.exec("ALTER TABLE users ADD COLUMN displayName TEXT");
    console.log("[db] Added displayName column to users table");
  }
}

ensureDisplayNameColumn();

db.exec(`
  CREATE TABLE IF NOT EXISTS shop_items (
    id TEXT PRIMARY KEY,
    sectionId TEXT NOT NULL,
    sectionTitle TEXT NOT NULL,
    sectionIcon TEXT,
    sectionSubtitle TEXT,
    sectionOrder INTEGER NOT NULL DEFAULT 0,
    itemOrder INTEGER NOT NULL DEFAULT 0,
    label TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    img TEXT,
    active INTEGER NOT NULL DEFAULT 1
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS mission_items (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    sectionId TEXT NOT NULL,
    sectionTitle TEXT NOT NULL,
    sectionIcon TEXT,
    sectionOrder INTEGER NOT NULL DEFAULT 0,
    itemOrder INTEGER NOT NULL DEFAULT 0,
    isBonus INTEGER NOT NULL DEFAULT 0,
    label TEXT NOT NULL,
    rewardAmount INTEGER NOT NULL DEFAULT 0,
    rewardLabel TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );
`);

/* ------------------------------------------------------------------ */
/* One-time migration from the old db.json file, if present            */
/* ------------------------------------------------------------------ */
function migrateFromJsonIfNeeded() {
  const alreadyHasRows = db.prepare("SELECT COUNT(*) AS c FROM users").get().c > 0;
  if (alreadyHasRows) return;
  if (!fs.existsSync(OLD_JSON_PATH)) return;

  let oldData;
  try {
    oldData = JSON.parse(fs.readFileSync(OLD_JSON_PATH, "utf8"));
  } catch (e) {
    return;
  }
  const users = (oldData && oldData.users) || {};
  const ids = Object.keys(users);
  if (ids.length === 0) return;

  const insert = db.prepare(`
    INSERT INTO users (id, username, firstName, tickets, rpPoints, forcedPrizeId, history, missionsWeekKey, missionsMonthKey, missionsSelected, missionsConfirmed)
    VALUES (@id, @username, @firstName, @tickets, @rpPoints, @forcedPrizeId, @history, @missionsWeekKey, @missionsMonthKey, @missionsSelected, @missionsConfirmed)
  `);

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });

  const rows = ids.map((id) => {
    const u = users[id];
    const missions = u.missions || { weekKey: getCurrentWeekKey(), selected: {}, confirmed: {} };
    return {
      id: String(u.id || id),
      username: u.username ?? null,
      firstName: u.firstName ?? null,
      tickets: Number.isFinite(u.tickets) ? u.tickets : 0,
      rpPoints: Number.isFinite(u.rpPoints) ? u.rpPoints : 0,
      forcedPrizeId: u.forcedPrizeId ?? null,
      history: JSON.stringify(u.history || []),
      missionsWeekKey: missions.weekKey || getCurrentWeekKey(),
      missionsMonthKey: missions.monthKey || getCurrentMonthKey(),
      missionsSelected: JSON.stringify(missions.selected || {}),
      missionsConfirmed: JSON.stringify(missions.confirmed || {}),
    };
  });

  insertMany(rows);
  console.log(`[db] Migrated ${rows.length} user(s) from db.json into db.sqlite`);
}

migrateFromJsonIfNeeded();

/* ------------------------------------------------------------------ */
/* One-time seed of the shop catalog, if the table is empty            */
/* ------------------------------------------------------------------ */
function seedShopItemsIfNeeded() {
  const alreadyHasRows = db.prepare("SELECT COUNT(*) AS c FROM shop_items").get().c > 0;
  if (alreadyHasRows) return;

  const insert = db.prepare(`
    INSERT INTO shop_items (id, sectionId, sectionTitle, sectionIcon, sectionSubtitle, sectionOrder, itemOrder, label, price, img, active)
    VALUES (@id, @sectionId, @sectionTitle, @sectionIcon, @sectionSubtitle, @sectionOrder, @itemOrder, @label, @price, @img, 1)
  `);
  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(SHOP_SEED);
  console.log(`[db] Seeded ${SHOP_SEED.length} shop item(s) into db.sqlite`);
}

seedShopItemsIfNeeded();

/* ------------------------------------------------------------------ */
/* One-time seed of the mission catalog, if the table is empty         */
/* ------------------------------------------------------------------ */
function seedMissionItemsIfNeeded() {
  const alreadyHasRows = db.prepare("SELECT COUNT(*) AS c FROM mission_items").get().c > 0;
  if (alreadyHasRows) return;

  const insert = db.prepare(`
    INSERT INTO mission_items (id, category, sectionId, sectionTitle, sectionIcon, sectionOrder, itemOrder, isBonus, label, rewardAmount, rewardLabel, active)
    VALUES (@id, @category, @sectionId, @sectionTitle, @sectionIcon, @sectionOrder, @itemOrder, @isBonus, @label, @rewardAmount, @rewardLabel, 1)
  `);
  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(MISSION_SEED);
  console.log(`[db] Seeded ${MISSION_SEED.length} mission item(s) into db.sqlite`);
}

seedMissionItemsIfNeeded();

function syncMissionSeedItems() {
  const insert = db.prepare(`
    INSERT INTO mission_items (id, category, sectionId, sectionTitle, sectionIcon, sectionOrder, itemOrder, isBonus, label, rewardAmount, rewardLabel, active)
    VALUES (@id, @category, @sectionId, @sectionTitle, @sectionIcon, @sectionOrder, @itemOrder, @isBonus, @label, @rewardAmount, @rewardLabel, 1)
  `);
  const existing = db.prepare("SELECT id FROM mission_items WHERE id = ?");
  const insertMissing = db.transaction((rows) => {
    for (const row of rows) {
      if (!existing.get(row.id)) insert.run(row);
    }
  });
  insertMissing(MISSION_SEED);
}

syncMissionSeedItems();

/* ------------------------------------------------------------------ */
/* Prepared statements                                                  */
/* ------------------------------------------------------------------ */
const stmts = {
  getById: db.prepare("SELECT * FROM users WHERE id = ?"),
  insertNew: db.prepare(`
    INSERT INTO users (id, username, firstName, tickets, rpPoints, forcedPrizeId, history, missionsDailyKey, missionsWeekKey, missionsMonthKey, missionsSelected, missionsConfirmed, clubGgId, boxesOpened, totalRpEarned)
    VALUES (@id, @username, @firstName, @tickets, @rpPoints, @forcedPrizeId, @history, @missionsDailyKey, @missionsWeekKey, @missionsMonthKey, @missionsSelected, @missionsConfirmed, @clubGgId, @boxesOpened, @totalRpEarned)
  `),
  updateProfile: db.prepare("UPDATE users SET username = @username, firstName = @firstName WHERE id = @id"),
  updateTickets: db.prepare("UPDATE users SET tickets = @tickets WHERE id = @id"),
  updateRp: db.prepare("UPDATE users SET rpPoints = @rpPoints WHERE id = @id"),
  updateRpAndTotal: db.prepare(
    "UPDATE users SET rpPoints = @rpPoints, totalRpEarned = @totalRpEarned WHERE id = @id"
  ),
  updateForcedPrize: db.prepare("UPDATE users SET forcedPrizeId = @forcedPrizeId WHERE id = @id"),
  updateAfterPrize: db.prepare(
    "UPDATE users SET tickets = @tickets, forcedPrizeId = NULL, rpPoints = @rpPoints, history = @history, boxesOpened = @boxesOpened, totalRpEarned = @totalRpEarned WHERE id = @id"
  ),
  updateAfterPurchase: db.prepare(
    "UPDATE users SET rpPoints = @rpPoints, history = @history WHERE id = @id"
  ),
  updateMissions: db.prepare(
    "UPDATE users SET missionsDailyKey = @missionsDailyKey, missionsWeekKey = @missionsWeekKey, missionsMonthKey = @missionsMonthKey, missionsSelected = @missionsSelected, missionsConfirmed = @missionsConfirmed WHERE id = @id"
  ),
  updateClubGgId: db.prepare(
    "UPDATE users SET clubGgId = @clubGgId, displayName = @displayName WHERE id = @id"
  ),
  getAllShopItems: db.prepare(
    "SELECT * FROM shop_items ORDER BY sectionOrder ASC, itemOrder ASC"
  ),
  getActiveShopItems: db.prepare(
    "SELECT * FROM shop_items WHERE active = 1 ORDER BY sectionOrder ASC, itemOrder ASC"
  ),
  getShopItemById: db.prepare("SELECT * FROM shop_items WHERE id = ?"),
  updateShopItem: db.prepare(`
    UPDATE shop_items
    SET label = @label, price = @price, img = @img, active = @active
    WHERE id = @id
  `),
  getAllMissionItems: db.prepare(
    "SELECT * FROM mission_items ORDER BY category ASC, sectionOrder ASC, itemOrder ASC"
  ),
  getActiveMissionItems: db.prepare(
    "SELECT * FROM mission_items WHERE active = 1 ORDER BY category ASC, sectionOrder ASC, itemOrder ASC"
  ),
  getMissionItemById: db.prepare("SELECT * FROM mission_items WHERE id = ?"),
  updateMissionItem: db.prepare(`
    UPDATE mission_items
    SET label = @label, rewardAmount = @rewardAmount, rewardLabel = @rewardLabel, active = @active
    WHERE id = @id
  `),
  getLeaderboard: db.prepare(`
    SELECT id, username, firstName, displayName, rpPoints, totalRpEarned, clubGgId
    FROM users
    ORDER BY totalRpEarned DESC, id ASC
    LIMIT ?
  `),
};

/* ------------------------------------------------------------------ */
/* Row <-> app object mapping                                          */
/* ------------------------------------------------------------------ */
function rowToUser(row) {
  return {
    id: row.id,
    username: row.username,
    firstName: row.firstName,
    tickets: row.tickets,
    rpPoints: row.rpPoints,
    forcedPrizeId: row.forcedPrizeId,
    clubGgId: row.clubGgId || null,
    displayName: row.displayName || null,
    boxesOpened: row.boxesOpened || 0,
    totalRpEarned: row.totalRpEarned || 0,
    history: JSON.parse(row.history),
    missions: {
      dailyKey: row.missionsDailyKey || null,
      weekKey: row.missionsWeekKey,
      monthKey: row.missionsMonthKey || null,
      selected: JSON.parse(row.missionsSelected),
      confirmed: JSON.parse(row.missionsConfirmed),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Public API - same signatures as the old file-based db.js            */
/* ------------------------------------------------------------------ */
function getUser(telegramId) {
  const id = String(telegramId);
  let row = stmts.getById.get(id);
  if (!row) {
    const dayKey = getCurrentDayKey();
    const weekKey = getCurrentWeekKey();
    const monthKey = getCurrentMonthKey();
    stmts.insertNew.run({
      id,
      username: null,
      firstName: null,
      tickets: 0,
      rpPoints: 0,
      forcedPrizeId: null,
      history: "[]",
      missionsDailyKey: dayKey,
      missionsWeekKey: weekKey,
      missionsMonthKey: monthKey,
      missionsSelected: "{}",
      missionsConfirmed: "{}",
      clubGgId: null,
      boxesOpened: 0,
      totalRpEarned: 0,
    });
    row = stmts.getById.get(id);
  }
  return rowToUser(row);
}

function touchUserProfile(telegramId, { username, firstName } = {}) {
  const user = getUser(telegramId);
  if (username !== undefined) user.username = username;
  if (firstName !== undefined) user.firstName = firstName;
  stmts.updateProfile.run({ id: user.id, username: user.username, firstName: user.firstName });
  return user;
}

function addTickets(telegramId, amount) {
  const user = getUser(telegramId);
  user.tickets = Math.max(0, user.tickets + Number(amount));
  stmts.updateTickets.run({ id: user.id, tickets: user.tickets });
  return user;
}

function setForcedPrize(telegramId, prizeId) {
  const user = getUser(telegramId);
  user.forcedPrizeId = prizeId || null;
  stmts.updateForcedPrize.run({ id: user.id, forcedPrizeId: user.forcedPrizeId });
  return user;
}

// Stores the player's self-reported ClubGG ID and their chosen display
// name. Both are collected together during the one-time verification step
// and are required before a user is allowed to open the Mystery Box (see
// app.js:/api/open-box), so admins always know which ClubGG account a win
// belongs to, and the name the player entered here is what's shown back to
// them everywhere else (leaderboard, public win announcements).
function setVerification(telegramId, { clubGgId, displayName } = {}) {
  const user = getUser(telegramId);
  user.clubGgId = clubGgId || null;
  user.displayName = displayName || null;
  stmts.updateClubGgId.run({ id: user.id, clubGgId: user.clubGgId, displayName: user.displayName });
  return user;
}

function consumeTicketAndRecordPrize(telegramId, prize) {
  const user = getUser(telegramId);
  if (user.tickets <= 0) return { user, ok: false };
  user.tickets -= 1;
  user.forcedPrizeId = null;
  user.rpPoints += prize.rpValue || 0;
  user.totalRpEarned += prize.rpValue || 0;
  user.history.unshift({ type: "prize", prizeId: prize.id, name: prize.name, date: new Date().toISOString() });
  user.history = user.history.slice(0, 50);
  user.boxesOpened += 1;
  stmts.updateAfterPrize.run({
    id: user.id,
    tickets: user.tickets,
    rpPoints: user.rpPoints,
    history: JSON.stringify(user.history),
    boxesOpened: user.boxesOpened,
    totalRpEarned: user.totalRpEarned,
  });
  return { user, ok: true };
}

function getMissionPeriod(mission) {
  if (!mission) return "weekly";
  if (mission.sectionId === "daily" || String(mission.id).startsWith("daily-")) return "daily";
  if (mission.sectionId === "weekly" || String(mission.id).startsWith("weekly-")) return "weekly";
  // "Активність" sections - RP tab uses sectionId "activity", Keys tab uses
  // sectionId "streak" - reset once a month instead of weekly.
  if (mission.sectionId === "activity" || mission.sectionId === "streak") return "monthly";
  return "weekly";
}

function filterMissionsByPeriod(source, periodToDrop) {
  const next = {};
  for (const [missionId, value] of Object.entries(source || {})) {
    const mission = getMissionItem(missionId);
    if (getMissionPeriod(mission) !== periodToDrop) next[missionId] = value;
  }
  return next;
}

function ensureCurrentMissionPeriods(user) {
  const currentDay = getCurrentDayKey();
  const currentWeek = getCurrentWeekKey();
  const currentMonth = getCurrentMonthKey();
  if (user.missions.dailyKey !== currentDay) {
    user.missions.selected = filterMissionsByPeriod(user.missions.selected, "daily");
    user.missions.confirmed = filterMissionsByPeriod(user.missions.confirmed, "daily");
    user.missions.dailyKey = currentDay;
  }
  if (user.missions.weekKey !== currentWeek) {
    user.missions.selected = filterMissionsByPeriod(user.missions.selected, "weekly");
    user.missions.confirmed = filterMissionsByPeriod(user.missions.confirmed, "weekly");
    user.missions.weekKey = currentWeek;
  }
  if (user.missions.monthKey !== currentMonth) {
    user.missions.selected = filterMissionsByPeriod(user.missions.selected, "monthly");
    user.missions.confirmed = filterMissionsByPeriod(user.missions.confirmed, "monthly");
    user.missions.monthKey = currentMonth;
  }
  return user;
}

function persistMissions(user) {
  stmts.updateMissions.run({
    id: user.id,
    missionsDailyKey: user.missions.dailyKey || getCurrentDayKey(),
    missionsWeekKey: user.missions.weekKey,
    missionsMonthKey: user.missions.monthKey || getCurrentMonthKey(),
    missionsSelected: JSON.stringify(user.missions.selected),
    missionsConfirmed: JSON.stringify(user.missions.confirmed),
  });
}

function getUserMissions(telegramId) {
  const user = getUser(telegramId);
  ensureCurrentMissionPeriods(user);
  persistMissions(user);
  return {
    ...user.missions,
    resetAt: {
      daily: getNextDailyReset().toISOString(),
      weekly: getNextWeeklyReset().toISOString(),
      monthly: getNextMonthlyReset().toISOString(),
    },
  };
}

function setMissionSelected(telegramId, missionId, selected) {
  const user = getUser(telegramId);
  ensureCurrentMissionPeriods(user);
  if (selected) user.missions.selected[missionId] = true;
  else delete user.missions.selected[missionId];
  persistMissions(user);
  return user.missions;
}

// Admin confirms (or un-confirms) that a user completed a mission. The
// first time a mission is confirmed for the current week it credits the
// reward - keys for category "keys", RP for category "rp" - onto the
// user's balance. Un-confirming reverses that same amount so toggling
// the checkbox by mistake doesn't leave a permanent credit.
//
// Returns keysCredited > 0 whenever this call is the one that actually
// handed the user new keys, so the caller (app.js) knows when to notify
// them in the bot.
function setMissionConfirmed(telegramId, missionId, confirmed) {
  const user = getUser(telegramId);
  ensureCurrentMissionPeriods(user);
  const wasConfirmed = !!user.missions.confirmed[missionId];
  const mission = getMissionItem(missionId);
  const amount = mission ? mission.rewardAmount : 0;
  let keysCredited = 0;

  if (confirmed && !wasConfirmed) {
    user.missions.confirmed[missionId] = true;
    if (amount > 0) {
      if (mission.category === "keys") {
        user.tickets += amount;
        stmts.updateTickets.run({ id: user.id, tickets: user.tickets });
        keysCredited = amount;
      } else {
        user.rpPoints += amount;
        user.totalRpEarned += amount;
        stmts.updateRpAndTotal.run({ id: user.id, rpPoints: user.rpPoints, totalRpEarned: user.totalRpEarned });
      }
    }
  } else if (!confirmed && wasConfirmed) {
    delete user.missions.confirmed[missionId];
    if (amount > 0) {
      if (mission.category === "keys") {
        user.tickets = Math.max(0, user.tickets - amount);
        stmts.updateTickets.run({ id: user.id, tickets: user.tickets });
      } else {
        user.rpPoints = Math.max(0, user.rpPoints - amount);
        user.totalRpEarned = Math.max(0, user.totalRpEarned - amount);
        stmts.updateRpAndTotal.run({ id: user.id, rpPoints: user.rpPoints, totalRpEarned: user.totalRpEarned });
      }
    }
  }

  persistMissions(user);
  return { missions: user.missions, tickets: user.tickets, rpPoints: user.rpPoints, keysCredited };
}

/* ------------------------------------------------------------------ */
/* Mission catalog                                                     */
/* ------------------------------------------------------------------ */
function rowToMissionItem(row) {
  return {
    id: row.id,
    category: row.category, // "rp" | "keys"
    sectionId: row.sectionId,
    sectionTitle: row.sectionTitle,
    sectionIcon: row.sectionIcon,
    sectionOrder: row.sectionOrder,
    itemOrder: row.itemOrder,
    isBonus: !!row.isBonus,
    label: row.label,
    rewardAmount: row.rewardAmount,
    rewardLabel: row.rewardLabel,
    active: !!row.active,
  };
}

function getMissionItem(id) {
  const row = stmts.getMissionItemById.get(id);
  return row ? rowToMissionItem(row) : null;
}

// A mission id is a real, selectable/confirmable mission only if it exists,
// is active, and isn't a purely-decorative "bonus" row.
function isValidMissionId(id) {
  const mission = getMissionItem(id);
  return Boolean(mission && mission.active && !mission.isBonus);
}

// Flat list of every non-bonus mission (including inactive ones) - used by
// the admin panel to build the per-user confirmation checklist.
function getAllMissionsFlat() {
  return stmts.getAllMissionItems
    .all()
    .map(rowToMissionItem)
    .filter((m) => !m.isBonus);
}

// Flat list of every mission row, including bonus rows and inactive ones -
// used by the admin panel's "edit missions" screen so admins can see and
// edit everything that exists.
function getAllMissionItemsFlat() {
  return stmts.getAllMissionItems.all().map(rowToMissionItem);
}

// Missions grouped into sections the way the front-end missions page
// expects, split by category, e.g. { rp: [{id,title,icon,items,bonus}],
// keys: [...] }. Only active items are included by default.
function getMissionSections({ onlyActive = true } = {}) {
  const rows = (onlyActive ? stmts.getActiveMissionItems : stmts.getAllMissionItems).all();
  const result = { rp: [], keys: [] };
  const sectionsById = { rp: {}, keys: {} };
  for (const row of rows) {
    const item = rowToMissionItem(row);
    const bucket = result[item.category];
    if (!bucket) continue;
    if (!sectionsById[item.category][item.sectionId]) {
      sectionsById[item.category][item.sectionId] = {
        id: item.sectionId,
        title: item.sectionTitle,
        icon: item.sectionIcon,
        items: [],
      };
      bucket.push(sectionsById[item.category][item.sectionId]);
    }
    const section = sectionsById[item.category][item.sectionId];
    if (item.isBonus) {
      section.bonus = { label: item.label, reward: item.rewardAmount };
    } else {
      section.items.push({
        id: item.id,
        label: item.label,
        reward: item.category === "rp" ? item.rewardAmount : item.rewardLabel,
      });
    }
  }
  return result;
}

// Edits an existing mission. Only label / rewardAmount / rewardLabel /
// active can be changed - admins tweak missions that already exist, they
// don't restructure sections or move rewards between categories through
// this endpoint (mirrors updateShopItem below).
function updateMissionItem(id, { label, rewardAmount, rewardLabel, active }) {
  const existing = stmts.getMissionItemById.get(id);
  if (!existing) return null;

  const next = {
    id,
    label: label !== undefined ? String(label) : existing.label,
    rewardAmount: rewardAmount !== undefined ? Number(rewardAmount) : existing.rewardAmount,
    rewardLabel: rewardLabel !== undefined ? String(rewardLabel) : existing.rewardLabel,
    active: active !== undefined ? (active ? 1 : 0) : existing.active,
  };
  stmts.updateMissionItem.run(next);
  return getMissionItem(id);
}

/* ------------------------------------------------------------------ */
/* Shop catalog                                                        */
/* ------------------------------------------------------------------ */
function rowToShopItem(row) {
  return {
    id: row.id,
    sectionId: row.sectionId,
    sectionTitle: row.sectionTitle,
    sectionIcon: row.sectionIcon,
    sectionSubtitle: row.sectionSubtitle,
    sectionOrder: row.sectionOrder,
    itemOrder: row.itemOrder,
    label: row.label,
    price: row.price,
    img: row.img,
    active: !!row.active,
  };
}

// Flat list of every product (including inactive ones) - used by the
// admin panel so admins can see and edit everything that exists.
function getAllShopItemsFlat() {
  return stmts.getAllShopItems.all().map(rowToShopItem);
}

// Products grouped into sections the way the front-end shop expects,
// e.g. [{ id, title, subtitle, icon, items: [...] }]. Only active items
// are included by default.
function getShopSections({ onlyActive = true } = {}) {
  const rows = (onlyActive ? stmts.getActiveShopItems : stmts.getAllShopItems).all();
  const sections = [];
  const sectionsById = {};
  for (const row of rows) {
    const item = rowToShopItem(row);
    if (!sectionsById[item.sectionId]) {
      sectionsById[item.sectionId] = {
        id: item.sectionId,
        title: item.sectionTitle,
        subtitle: item.sectionSubtitle,
        icon: item.sectionIcon,
        items: [],
      };
      sections.push(sectionsById[item.sectionId]);
    }
    sectionsById[item.sectionId].items.push({
      id: item.id,
      label: item.label,
      price: item.price,
      img: item.img,
    });
  }
  return sections;
}

function getShopItem(id) {
  const row = stmts.getShopItemById.get(id);
  return row ? rowToShopItem(row) : null;
}

// Edits an existing product. Only label / price / img / active can be
// changed - admins modify products that already exist, they don't
// restructure the shop's sections through this endpoint.
function updateShopItem(id, { label, price, img, active }) {
  const existing = stmts.getShopItemById.get(id);
  if (!existing) return null;

  const next = {
    id,
    label: label !== undefined ? String(label) : existing.label,
    price: price !== undefined ? Number(price) : existing.price,
    img: img !== undefined ? (img || null) : existing.img,
    active: active !== undefined ? (active ? 1 : 0) : existing.active,
  };
  stmts.updateShopItem.run(next);
  return getShopItem(id);
}

const purchaseShopItemTx = db.transaction((telegramId, itemId) => {
  const user = getUser(telegramId);
  const item = getShopItem(itemId);
  if (!item || !item.active) return { ok: false, error: "unknown_product", user, item: null };
  if (user.rpPoints < item.price) return { ok: false, error: "insufficient_points", user, item };

  user.rpPoints -= item.price;
  user.history.unshift({
    type: "purchase",
    itemId: item.id,
    name: item.label,
    price: item.price,
    date: new Date().toISOString(),
  });
  user.history = user.history.slice(0, 50);
  stmts.updateAfterPurchase.run({ id: user.id, rpPoints: user.rpPoints, history: JSON.stringify(user.history) });
  return { ok: true, user, item };
});

function purchaseShopItem(telegramId, itemId) {
  return purchaseShopItemTx(String(telegramId), String(itemId));
}

function getLeaderboard(limit = 20) {
  return stmts.getLeaderboard.all(Math.max(1, Math.min(100, Number(limit) || 20))).map((row, index) => ({
    rank: index + 1,
    id: row.id,
    // Prefer the name the player entered during verification - that's the
    // one they chose to be known by, and it's what wins get announced
    // under. Fall back to their Telegram first name, then a placeholder,
    // for accounts that verified before this field existed.
    name: row.displayName || row.firstName || `Гравець ${row.id.slice(-4)}`,
    clubGgId: row.clubGgId || null,
    score: row.totalRpEarned,
    balance: row.rpPoints,
  }));
}

module.exports = {
  getUser,
  touchUserProfile,
  addTickets,
  setForcedPrize,
  setVerification,
  consumeTicketAndRecordPrize,
  getUserMissions,
  setMissionSelected,
  setMissionConfirmed,
  getAllShopItemsFlat,
  getShopSections,
  getShopItem,
  updateShopItem,
  purchaseShopItem,
  getLeaderboard,
  isValidMissionId,
  getMissionItem,
  getAllMissionsFlat,
  getAllMissionItemsFlat,
  getMissionSections,
  updateMissionItem,
};
