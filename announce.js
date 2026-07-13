const path = require("path");
const sharp = require("sharp");

const { sendTelegramPhoto } = require("./telegram");

// Public group(s) the "successful opening" post goes to, and the bot the
// inline button should hand the player off to. Both can be overridden via
// env vars without touching code.
//
// ANNOUNCE_CHAT_IDS supports multiple chats separated by commas, e.g.:
//   ANNOUNCE_CHAT_IDS=@ROYAL_POKER1,@ROYAL_POKER2,-1001234567890
// ANNOUNCE_CHAT_ID (singular) is still read for backwards compatibility if
// ANNOUNCE_CHAT_IDS isn't set.
const ANNOUNCE_CHAT_IDS = (
  process.env.ANNOUNCE_CHAT_IDS ||
  process.env.ANNOUNCE_CHAT_ID ||
  "@ROYAL_POKER1"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ANNOUNCE_BOT_USERNAME = process.env.ANNOUNCE_BOT_USERNAME || "ROYAL_Admin3_bot";

const TEMPLATE_PATH = path.join(__dirname, "public/assets/announce-template.png");

// Coordinates of the empty neon window in announce-template.png (1280x853),
// where the winner's nickname gets drawn in.
const WINDOW = { x: 530, y: 530, width: 590, height: 160 };

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Renders the template with the winner's nickname drawn inside the neon
// window, returning a PNG buffer ready to be posted.
async function renderAnnouncementImage(displayName) {
  const centerX = WINDOW.x + WINDOW.width / 2;
  const centerY = WINDOW.y + WINDOW.height / 2;
  const safeName = escapeXml(displayName).slice(0, 40);
  const nickFontSize = safeName.length > 16 ? 40 : 54;

  const svg = `
    <svg width="1280" height="853" xmlns="http://www.w3.org/2000/svg">
      <style>
        .lbl { font-family: Arial, sans-serif; font-weight: 700; font-size: 22px; fill: #C9A6FF; letter-spacing: 2px; }
        .nick { font-family: Arial, sans-serif; font-weight: 800; font-size: ${nickFontSize}px; fill: #FFDE7A; }
      </style>
      <text x="${centerX}" y="${centerY - 8}" text-anchor="middle" class="lbl">ПЕРЕМОЖЕЦЬ</text>
      <text x="${centerX}" y="${centerY + 45}" text-anchor="middle" class="nick">${safeName}</text>
    </svg>
  `;

  return sharp(TEMPLATE_PATH)
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toBuffer();
}

function buildCaption(displayName, prizeLabel) {
  return (
    `🔑 УСПІШНЕ ВІДКРИТТЯ ⭐️⭐️⭐️⭐️⭐️\n\n` +
    `Вітаємо: ${escapeHtml(displayName)}\n\n` +
    `Твій Золотий Ключ відкрив Mystery Box, а удача сьогодні обрала саме тебе!\n\n` +
    `🎁 Приз: ${escapeHtml(prizeLabel)}\n\n` +
    `Бажаємо ще більше вдалих відкриттів, цінних нагород та великих перемог за столами Royal Online Poker! 🎁`
  );
}

// Posts the "successful opening" announcement to the public group with the
// winner's nickname baked into the mystery-box graphic and an inline
// button that hands the player off to the admin bot.
async function announceMysteryBoxWin({ displayName, prizeLabel }) {
  const imageBuffer = await renderAnnouncementImage(displayName);
  const caption = buildCaption(displayName, prizeLabel);
  const replyMarkup = {
    inline_keyboard: [
      [{ text: "🎁 Mystery Box", url: `https://t.me/${ANNOUNCE_BOT_USERNAME}` }],
    ],
  };

  await Promise.all(
    ANNOUNCE_CHAT_IDS.map((chatId) =>
      sendTelegramPhoto(chatId, imageBuffer, {
        filename: "mystery-box-win.png",
        caption,
        replyMarkup,
      })
    )
  );
}

module.exports = {
  announceMysteryBoxWin,
};
