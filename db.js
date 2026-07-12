const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const { getCurrentWeekKey } = require("./missions");
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
    missionsWeekKey TEXT,
    missionsSelected TEXT NOT NULL DEFAULT '{}',
    missionsConfirmed TEXT NOT NULL DEFAULT '{}'
  );
`);

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
    INSERT INTO users (id, username, firstName, tickets, rpPoints, forcedPrizeId, history, missionsWeekKey, missionsSelected, missionsConfirmed)
    VALUES (@id, @username, @firstName, @tickets, @rpPoints, @forcedPrizeId, @history, @missionsWeekKey, @missionsSelected, @missionsConfirmed)
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
/* Prepared statements                                                  */
/* ------------------------------------------------------------------ */
const stmts = {
  getById: db.prepare("SELECT * FROM users WHERE id = ?"),
  insertNew: db.prepare(`
    INSERT INTO users (id, username, firstName, tickets, rpPoints, forcedPrizeId, history, missionsWeekKey, missionsSelected, missionsConfirmed)
    VALUES (@id, @username, @firstName, @tickets, @rpPoints, @forcedPrizeId, @history, @missionsWeekKey, @missionsSelected, @missionsConfirmed)
  `),
  updateProfile: db.prepare("UPDATE users SET username = @username, firstName = @firstName WHERE id = @id"),
  updateTickets: db.prepare("UPDATE users SET tickets = @tickets WHERE id = @id"),
  updateForcedPrize: db.prepare("UPDATE users SET forcedPrizeId = @forcedPrizeId WHERE id = @id"),
  updateAfterPrize: db.prepare(
    "UPDATE users SET tickets = @tickets, forcedPrizeId = NULL, rpPoints = @rpPoints, history = @history WHERE id = @id"
  ),
  updateMissions: db.prepare(
    "UPDATE users SET missionsWeekKey = @missionsWeekKey, missionsSelected = @missionsSelected, missionsConfirmed = @missionsConfirmed WHERE id = @id"
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
    history: JSON.parse(row.history),
    missions: {
      weekKey: row.missionsWeekKey,
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
    const weekKey = getCurrentWeekKey();
    stmts.insertNew.run({
      id,
      username: null,
      firstName: null,
      tickets: 0,
      rpPoints: 0,
      forcedPrizeId: null,
      history: "[]",
      missionsWeekKey: weekKey,
      missionsSelected: "{}",
      missionsConfirmed: "{}",
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

function consumeTicketAndRecordPrize(telegramId, prize) {
  const user = getUser(telegramId);
  if (user.tickets <= 0) return { user, ok: false };
  user.tickets -= 1;
  user.forcedPrizeId = null;
  user.rpPoints += prize.rpValue || 0;
  user.history.unshift({ prizeId: prize.id, name: prize.name, date: new Date().toISOString() });
  user.history = user.history.slice(0, 50);
  stmts.updateAfterPrize.run({
    id: user.id,
    tickets: user.tickets,
    rpPoints: user.rpPoints,
    history: JSON.stringify(user.history),
  });
  return { user, ok: true };
}

function ensureCurrentMissionWeek(user) {
  const currentWeek = getCurrentWeekKey();
  if (user.missions.weekKey !== currentWeek) {
    user.missions = { weekKey: currentWeek, selected: {}, confirmed: {} };
  }
  return user;
}

function persistMissions(user) {
  stmts.updateMissions.run({
    id: user.id,
    missionsWeekKey: user.missions.weekKey,
    missionsSelected: JSON.stringify(user.missions.selected),
    missionsConfirmed: JSON.stringify(user.missions.confirmed),
  });
}

function getUserMissions(telegramId) {
  const user = getUser(telegramId);
  ensureCurrentMissionWeek(user);
  persistMissions(user);
  return user.missions;
}

function setMissionSelected(telegramId, missionId, selected) {
  const user = getUser(telegramId);
  ensureCurrentMissionWeek(user);
  if (selected) user.missions.selected[missionId] = true;
  else delete user.missions.selected[missionId];
  persistMissions(user);
  return user.missions;
}

function setMissionConfirmed(telegramId, missionId, confirmed) {
  const user = getUser(telegramId);
  ensureCurrentMissionWeek(user);
  if (confirmed) user.missions.confirmed[missionId] = true;
  else delete user.missions.confirmed[missionId];
  persistMissions(user);
  return user.missions;
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

module.exports = {
  getUser,
  touchUserProfile,
  addTickets,
  setForcedPrize,
  consumeTicketAndRecordPrize,
  getUserMissions,
  setMissionSelected,
  setMissionConfirmed,
  getAllShopItemsFlat,
  getShopSections,
  getShopItem,
  updateShopItem,
};
