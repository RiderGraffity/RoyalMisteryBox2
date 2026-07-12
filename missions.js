// Canonical mission catalog seed. This is only used to populate the
// `mission_items` table the very first time the server runs - after that,
// the database is the single source of truth and can be edited by admins
// through the admin panel (see app.js -> /api/admin/mission-items).
//
// Ids are stable and referenced by user progress records (selected/confirmed
// maps) and by the front-end, so avoid changing them once the app has real
// data - editing label/reward through the admin panel is safe, changing the
// `id` of an existing row is not.
//
// category "rp"   -> reward is credited as RP Points, displayed as "N RP".
// category "keys" -> reward is credited as Mystery Box keys, displayed using
//                     rewardLabel as-is (e.g. "1 ключ", "+1 ключ", "2 ключі").
//
// `isBonus` rows are the "complete all missions" bonus card shown at the end
// of a section. They are purely informational (same as in the original
// front-end) - they are not selectable/confirmable missions themselves, but
// admins can still edit their label/reward text here.
const MISSION_SEED = [
  // --- RP: Щоденні місії ---------------------------------------------
  { id: "daily-0", category: "rp", sectionId: "daily", sectionTitle: "Щоденні місії", sectionIcon: "target", sectionOrder: 1, itemOrder: 0, isBonus: 0, label: "Зіграти 100 кеш-рук", rewardAmount: 5, rewardLabel: "RP" },
  { id: "daily-1", category: "rp", sectionId: "daily", sectionTitle: "Щоденні місії", sectionIcon: "target", sectionOrder: 1, itemOrder: 1, isBonus: 0, label: "Зіграти 300 кеш-рук", rewardAmount: 10, rewardLabel: "RP" },
  { id: "daily-2", category: "rp", sectionId: "daily", sectionTitle: "Щоденні місії", sectionIcon: "target", sectionOrder: 1, itemOrder: 2, isBonus: 0, label: "Зіграти 2 MTT", rewardAmount: 5, rewardLabel: "RP" },
  { id: "daily-3", category: "rp", sectionId: "daily", sectionTitle: "Щоденні місії", sectionIcon: "target", sectionOrder: 1, itemOrder: 3, isBonus: 0, label: "Потрапити в ITM", rewardAmount: 5, rewardLabel: "RP" },
  { id: "daily-bonus", category: "rp", sectionId: "daily", sectionTitle: "Щоденні місії", sectionIcon: "target", sectionOrder: 1, itemOrder: 999, isBonus: 1, label: "Виконати всі місії", rewardAmount: 10, rewardLabel: "RP" },

  // --- RP: Тижневі місії ----------------------------------------------
  { id: "weekly-0", category: "rp", sectionId: "weekly", sectionTitle: "Тижневі місії", sectionIcon: "calendar-days", sectionOrder: 2, itemOrder: 0, isBonus: 0, label: "Зіграти 1500 кеш-рук", rewardAmount: 30, rewardLabel: "RP" },
  { id: "weekly-1", category: "rp", sectionId: "weekly", sectionTitle: "Тижневі місії", sectionIcon: "calendar-days", sectionOrder: 2, itemOrder: 1, isBonus: 0, label: "Зіграти 12 MTT", rewardAmount: 30, rewardLabel: "RP" },
  { id: "weekly-2", category: "rp", sectionId: "weekly", sectionTitle: "Тижневі місії", sectionIcon: "calendar-days", sectionOrder: 2, itemOrder: 2, isBonus: 0, label: "Потрапити в ITM 5 разів", rewardAmount: 30, rewardLabel: "RP" },
  { id: "weekly-bonus", category: "rp", sectionId: "weekly", sectionTitle: "Тижневі місії", sectionIcon: "calendar-days", sectionOrder: 2, itemOrder: 999, isBonus: 1, label: "Виконати всі місії", rewardAmount: 40, rewardLabel: "RP" },

  // --- RP: Депозити -----------------------------------------------------
  { id: "deposits-0", category: "rp", sectionId: "deposits", sectionTitle: "Депозити", sectionIcon: "credit-card", sectionOrder: 3, itemOrder: 0, isBonus: 0, label: "Перший депозит дня", rewardAmount: 5, rewardLabel: "RP" },
  { id: "deposits-1", category: "rp", sectionId: "deposits", sectionTitle: "Депозити", sectionIcon: "credit-card", sectionOrder: 3, itemOrder: 1, isBonus: 0, label: "Кожен 3-й депозит", rewardAmount: 10, rewardLabel: "RP" },
  { id: "deposits-2", category: "rp", sectionId: "deposits", sectionTitle: "Депозити", sectionIcon: "credit-card", sectionOrder: 3, itemOrder: 2, isBonus: 0, label: "Кожен 5-й депозит", rewardAmount: 20, rewardLabel: "RP" },

  // --- RP: Активність -----------------------------------------------------
  { id: "activity-0", category: "rp", sectionId: "activity", sectionTitle: "Активність", sectionIcon: "zap", sectionOrder: 4, itemOrder: 0, isBonus: 0, label: "7 активних днів", rewardAmount: 25, rewardLabel: "RP" },
  { id: "activity-1", category: "rp", sectionId: "activity", sectionTitle: "Активність", sectionIcon: "zap", sectionOrder: 4, itemOrder: 1, isBonus: 0, label: "30 активних днів", rewardAmount: 100, rewardLabel: "RP" },

  // --- Keys: Кеш ----------------------------------------------------------
  { id: "cash-0", category: "keys", sectionId: "cash", sectionTitle: "Кеш", sectionIcon: "spade", sectionOrder: 1, itemOrder: 0, isBonus: 0, label: "1000 рук", rewardAmount: 1, rewardLabel: "1 ключ" },
  { id: "cash-1", category: "keys", sectionId: "cash", sectionTitle: "Кеш", sectionIcon: "spade", sectionOrder: 1, itemOrder: 1, isBonus: 0, label: "3000 рук за тиждень", rewardAmount: 1, rewardLabel: "+1 ключ" },

  // --- Keys: MTT ------------------------------------------------------
  { id: "mtt-0", category: "keys", sectionId: "mtt", sectionTitle: "MTT", sectionIcon: "trophy", sectionOrder: 2, itemOrder: 0, isBonus: 0, label: "5 ITM", rewardAmount: 1, rewardLabel: "1 ключ" },
  { id: "mtt-1", category: "keys", sectionId: "mtt", sectionTitle: "MTT", sectionIcon: "trophy", sectionOrder: 2, itemOrder: 1, isBonus: 0, label: "Перемога в турнірі", rewardAmount: 1, rewardLabel: "1 ключ" },

  // --- Keys: Місії ------------------------------------------------------
  { id: "missions-0", category: "keys", sectionId: "missions", sectionTitle: "Місії", sectionIcon: "target", sectionOrder: 3, itemOrder: 0, isBonus: 0, label: "Виконати всі щоденні місії", rewardAmount: 1, rewardLabel: "1 ключ" },
  { id: "missions-1", category: "keys", sectionId: "missions", sectionTitle: "Місії", sectionIcon: "target", sectionOrder: 3, itemOrder: 1, isBonus: 0, label: "Виконати всі тижневі місії", rewardAmount: 2, rewardLabel: "2 ключі" },

  // --- Keys: Активність -----------------------------------------------
  { id: "streak-0", category: "keys", sectionId: "streak", sectionTitle: "Активність", sectionIcon: "flame", sectionOrder: 4, itemOrder: 0, isBonus: 0, label: "14 активних днів поспіль", rewardAmount: 1, rewardLabel: "1 ключ" },
  { id: "streak-1", category: "keys", sectionId: "streak", sectionTitle: "Активність", sectionIcon: "flame", sectionOrder: 4, itemOrder: 1, isBonus: 0, label: "30 активних днів поспіль", rewardAmount: 2, rewardLabel: "2 ключі" },
];

/**
 * Missions reset every week, starting Sunday. We key each user's mission
 * progress by the date (UTC, YYYY-MM-DD) of the most recent Sunday, so the
 * very first read/write after a new Sunday starts automatically wipes the
 * previous week's selections and confirmations.
 */
function getCurrentWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  MISSION_SEED,
  getCurrentWeekKey,
};
