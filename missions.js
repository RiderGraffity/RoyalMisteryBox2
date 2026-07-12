// This mirrors the mission sections defined in front/index.js
// (RP_MISSION_SECTIONS / KEY_MISSION_SECTIONS). Ids are generated the same
// way on both sides (`${section.id}-${itemIndex}`), so they always line up -
// if you add/reorder missions in the front-end, mirror the change here too.

const RP_MISSION_SECTIONS = [
  {
    id: "daily",
    title: "Щоденні місії",
    items: [
      { label: "Зіграти 100 кеш-рук", reward: "5 RP" },
      { label: "Зіграти 300 кеш-рук", reward: "10 RP" },
      { label: "Зіграти 2 MTT", reward: "5 RP" },
      { label: "Потрапити в ITM", reward: "5 RP" },
    ],
  },
  {
    id: "weekly",
    title: "Тижневі місії",
    items: [
      { label: "Зіграти 1500 кеш-рук", reward: "30 RP" },
      { label: "Зіграти 12 MTT", reward: "30 RP" },
      { label: "Потрапити в ITM 5 разів", reward: "30 RP" },
    ],
  },
  {
    id: "deposits",
    title: "Депозити",
    items: [
      { label: "Перший депозит дня", reward: "5 RP" },
      { label: "Кожен 3-й депозит", reward: "10 RP" },
      { label: "Кожен 5-й депозит", reward: "20 RP" },
    ],
  },
  {
    id: "activity",
    title: "Активність",
    items: [
      { label: "7 активних днів", reward: "25 RP" },
      { label: "30 активних днів", reward: "100 RP" },
    ],
  },
];

const KEY_MISSION_SECTIONS = [
  {
    id: "cash",
    title: "Кеш",
    items: [
      { label: "1000 рук", reward: "1 ключ" },
      { label: "3000 рук за тиждень", reward: "+1 ключ" },
    ],
  },
  {
    id: "mtt",
    title: "MTT",
    items: [
      { label: "5 ITM", reward: "1 ключ" },
      { label: "Перемога в турнірі", reward: "1 ключ" },
    ],
  },
  {
    id: "missions",
    title: "Місії",
    items: [
      { label: "Виконати всі щоденні місії", reward: "1 ключ" },
      { label: "Виконати всі тижневі місії", reward: "2 ключі" },
    ],
  },
  {
    id: "streak",
    title: "Активність",
    items: [
      { label: "14 активних днів поспіль", reward: "1 ключ" },
      { label: "30 активних днів поспіль", reward: "2 ключі" },
    ],
  },
];

function buildMissionIndex() {
  const index = {};
  function add(sections, category) {
    sections.forEach((section) => {
      section.items.forEach((item, i) => {
        const id = `${section.id}-${i}`;
        index[id] = {
          id,
          category, // "rp" | "keys"
          sectionId: section.id,
          sectionTitle: section.title,
          label: item.label,
          reward: item.reward,
        };
      });
    });
  }
  add(RP_MISSION_SECTIONS, "rp");
  add(KEY_MISSION_SECTIONS, "keys");
  return index;
}

const MISSION_INDEX = buildMissionIndex();

function isValidMissionId(id) {
  return Boolean(MISSION_INDEX[id]);
}

function getAllMissionsFlat() {
  return Object.values(MISSION_INDEX);
}

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
  RP_MISSION_SECTIONS,
  KEY_MISSION_SECTIONS,
  MISSION_INDEX,
  isValidMissionId,
  getAllMissionsFlat,
  getCurrentWeekKey,
};
