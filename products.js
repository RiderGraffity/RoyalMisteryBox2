// Canonical shop catalog seed. This is only used to populate the
// `shop_items` table the very first time the server runs - after that,
// the database is the single source of truth and can be edited by admins
// through the admin panel (see app.js -> /api/admin/shop-items).
//
// Ids are stable and referenced by the front-end / admin panel, so avoid
// changing them once the app has real data.
const SHOP_SEED = [
  // --- Брендовий мерч -----------------------------------------------
  { id: "merch-set", sectionId: "merch", sectionTitle: "Брендовий мерч", sectionIcon: "crown", sectionSubtitle: null, sectionOrder: 1, itemOrder: 1, label: "Set Royal Poker", price: 3200, img: "assets/set.png" },
  { id: "merch-mug", sectionId: "merch", sectionTitle: "Брендовий мерч", sectionIcon: "crown", sectionSubtitle: null, sectionOrder: 1, itemOrder: 2, label: "Royal Poker кружка", price: 850, img: "assets/mug.png" },
  { id: "merch-cap", sectionId: "merch", sectionTitle: "Брендовий мерч", sectionIcon: "crown", sectionSubtitle: null, sectionOrder: 1, itemOrder: 3, label: "Royal Poker кепка", price: 1100, img: "assets/cap.png" },
  { id: "merch-thermos", sectionId: "merch", sectionTitle: "Брендовий мерч", sectionIcon: "crown", sectionSubtitle: null, sectionOrder: 1, itemOrder: 4, label: "Royal Poker термос", price: 2100, img: "assets/thermos.png" },

  // --- Ваучери 3 доби -------------------------------------------------
  { id: "voucher-50", sectionId: "vouchers", sectionTitle: "Ваучери 3 доби", sectionIcon: "ticket", sectionSubtitle: "Ваучер", sectionOrder: 2, itemOrder: 1, label: "50", price: 80, img: null },
  { id: "voucher-100", sectionId: "vouchers", sectionTitle: "Ваучери 3 доби", sectionIcon: "ticket", sectionSubtitle: "Ваучер", sectionOrder: 2, itemOrder: 2, label: "100", price: 150, img: null },
  { id: "voucher-150", sectionId: "vouchers", sectionTitle: "Ваучери 3 доби", sectionIcon: "ticket", sectionSubtitle: "Ваучер", sectionOrder: 2, itemOrder: 3, label: "150", price: 220, img: null },
  { id: "voucher-200", sectionId: "vouchers", sectionTitle: "Ваучери 3 доби", sectionIcon: "ticket", sectionSubtitle: "Ваучер", sectionOrder: 2, itemOrder: 4, label: "200", price: 290, img: null },
  { id: "voucher-300", sectionId: "vouchers", sectionTitle: "Ваучери 3 доби", sectionIcon: "ticket", sectionSubtitle: "Ваучер", sectionOrder: 2, itemOrder: 5, label: "300", price: 420, img: null },

  // --- Квитки 50/50 -----------------------------------------------
  { id: "fifty-350", sectionId: "fifty-fifty", sectionTitle: "Квитки 50/50", sectionIcon: "handshake", sectionSubtitle: "Квиток", sectionOrder: 3, itemOrder: 1, label: "До 350", price: 180, img: null },
  { id: "fifty-550", sectionId: "fifty-fifty", sectionTitle: "Квитки 50/50", sectionIcon: "handshake", sectionSubtitle: "Квиток", sectionOrder: 3, itemOrder: 2, label: "До 550", price: 290, img: null },
  { id: "fifty-1000", sectionId: "fifty-fifty", sectionTitle: "Квитки 50/50", sectionIcon: "handshake", sectionSubtitle: "Квиток", sectionOrder: 3, itemOrder: 3, label: "До 1000", price: 500, img: null },
  { id: "fifty-2000", sectionId: "fifty-fifty", sectionTitle: "Квитки 50/50", sectionIcon: "handshake", sectionSubtitle: "Квиток", sectionOrder: 3, itemOrder: 4, label: "До 2000", price: 900, img: null },

  // --- Турнірні квитки ----------------------------------------------
  { id: "tournament-250", sectionId: "tournament", sectionTitle: "Турнірні квитки", sectionIcon: "award", sectionSubtitle: "Квиток", sectionOrder: 4, itemOrder: 1, label: "До 250", price: 250, img: null },
  { id: "tournament-350", sectionId: "tournament", sectionTitle: "Турнірні квитки", sectionIcon: "award", sectionSubtitle: "Квиток", sectionOrder: 4, itemOrder: 2, label: "До 350", price: 350, img: null },
  { id: "tournament-550", sectionId: "tournament", sectionTitle: "Турнірні квитки", sectionIcon: "award", sectionSubtitle: "Квиток", sectionOrder: 4, itemOrder: 3, label: "До 550", price: 520, img: null },
  { id: "tournament-900", sectionId: "tournament", sectionTitle: "Турнірні квитки", sectionIcon: "award", sectionSubtitle: "Квиток", sectionOrder: 4, itemOrder: 4, label: "До 900", price: 780, img: null },

  // --- Фішки ------------------------------------------------------
  { id: "chips-250", sectionId: "chips", sectionTitle: "Фішки", sectionIcon: "disc", sectionSubtitle: "Фішки", sectionOrder: 5, itemOrder: 1, label: "250", price: 340, img: null },
  { id: "chips-500", sectionId: "chips", sectionTitle: "Фішки", sectionIcon: "disc", sectionSubtitle: "Фішки", sectionOrder: 5, itemOrder: 2, label: "500", price: 650, img: null },
  { id: "chips-1000", sectionId: "chips", sectionTitle: "Фішки", sectionIcon: "disc", sectionSubtitle: "Фішки", sectionOrder: 5, itemOrder: 3, label: "1000", price: 1250, img: null },
];

module.exports = { SHOP_SEED };
