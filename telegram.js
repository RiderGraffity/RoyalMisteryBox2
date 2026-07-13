const crypto = require("crypto");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const WIN_CHAT_ID = process.env.WIN_CHAT_ID || "";

/**
 * Verifies the `initData` string that Telegram.WebApp gives to the front-end.
 * This is the only reliable way to know that a request really comes from the
 * Telegram user it claims to - never trust a plain "telegramId" field sent
 * straight from the client for anything sensitive.
 *
 * Reference: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function verifyInitData(initData) {
  if (!initData || typeof initData !== "string") return null;
  if (!BOT_TOKEN) {
    console.warn("BOT_TOKEN is not set - cannot verify Telegram initData");
    return null;
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computedHash !== hash) return null;

  let user = null;
  try {
    user = JSON.parse(params.get("user"));
  } catch (e) {
    return null;
  }
  if (!user || !user.id) return null;

  return user; // { id, first_name, last_name, username, ... }
}

function isAdmin(telegramId) {
  return ADMIN_IDS.includes(String(telegramId));
}

async function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN) {
    console.warn("BOT_TOKEN is not set - cannot send Telegram message");
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Telegram sendMessage failed:", res.status, body);
    }
  } catch (err) {
    console.error("Telegram sendMessage error:", err);
  }
}

async function sendTelegramPhoto(chatId, photoBuffer, { filename = "photo.png", caption, replyMarkup } = {}) {
  if (!BOT_TOKEN) {
    console.warn("BOT_TOKEN is not set - cannot send Telegram photo");
    return;
  }
  try {
    const form = new FormData();
    form.append("chat_id", chatId);
    if (caption) form.append("caption", caption);
    form.append("parse_mode", "HTML");
    if (replyMarkup) form.append("reply_markup", JSON.stringify(replyMarkup));
    form.append("photo", new Blob([photoBuffer], { type: "image/png" }), filename);

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Telegram sendPhoto failed:", res.status, body);
    }
  } catch (err) {
    console.error("Telegram sendPhoto error:", err);
  }
}

async function notifyAdminsOfWin(user, prize, clubGgId) {
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.firstName || "Гравець";
  const usernamePart = user.username ? `@${user.username}` : "без юзернейму";
  const text =
    `🎉 <b>Новий виграш у Mystery Box</b>\n` +
    `Користувач: <b>${escapeHtml(displayName)}</b> (${escapeHtml(usernamePart)})\n` +
    `Telegram ID: <code>${user.id}</code>\n` +
    `ClubGG ID: <code>${escapeHtml(clubGgId || "не вказано")}</code>\n` +
    `Виграш: <b>${escapeHtml(prize.name)}</b>`;

  // Admins always get notified privately of every win, regardless of prize
  // type. The public channel post (with the winner's nickname baked into
  // the banner graphic) is handled separately by announce.js - this
  // function no longer also drops a plain-text copy into that same
  // channel, to avoid a duplicate/ugly second message there.
  await Promise.all(ADMIN_IDS.map((chatId) => sendTelegramMessage(chatId, text)));
}

async function notifyAdminsOfPurchase(user, item, clubGgId) {
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.firstName || "Гравець";
  const usernamePart = user.username ? `@${user.username}` : "без юзернейму";
  const text =
    `🛒 <b>Нова покупка в магазині</b>\n` +
    `Хто купив: <b>${escapeHtml(displayName)}</b> (${escapeHtml(usernamePart)})\n` +
    `Telegram ID: <code>${user.id}</code>\n` +
    `ClubGG ID: <code>${escapeHtml(clubGgId || "не вказано")}</code>\n` +
    `Що купив: <b>${escapeHtml(item.label)}</b>\n` +
    `Вартість: <b>${item.price} RP</b>`;

  await Promise.all(ADMIN_IDS.map((adminId) => sendTelegramMessage(adminId, text)));
}

// Ukrainian plural form of "ключ" (key) for a given count, e.g.
// 1 -> ключ, 2 -> ключі, 5 -> ключів, 11 -> ключів, 21 -> ключ.
function pluralizeKeys(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "ключ";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "ключі";
  return "ключів";
}

// Lets a player know in the bot that they were just credited Mystery Box
// keys - either manually by an admin, or automatically by confirming a
// mission whose reward is keys.
async function notifyUserKeysCredited(telegramId, amount, totalTickets) {
  const keysWord = pluralizeKeys(amount);
  const text =
    `🔑 Вам нараховано <b>${amount} ${keysWord}</b> для Mystery Box!\n` +
    `Загальний баланс: <b>${totalTickets}</b>.`;
  await sendTelegramMessage(telegramId, text);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = {
  ADMIN_IDS,
  BOT_TOKEN,
  WIN_CHAT_ID,
  verifyInitData,
  isAdmin,
  sendTelegramMessage,
  sendTelegramPhoto,
  notifyAdminsOfWin,
  notifyAdminsOfPurchase,
  notifyUserKeysCredited,
};
