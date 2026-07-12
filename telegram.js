const crypto = require("crypto");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

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

async function notifyAdminsOfWin(user, prize) {
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.firstName || "Гравець";
  const usernamePart = user.username ? `@${user.username}` : "без юзернейму";
  const text =
    `🎉 <b>Новий виграш у Mystery Box</b>\n` +
    `Користувач: <b>${escapeHtml(displayName)}</b> (${escapeHtml(usernamePart)})\n` +
    `Telegram ID: <code>${user.id}</code>\n` +
    `Виграш: <b>${escapeHtml(prize.name)}</b>`;

  await Promise.all(ADMIN_IDS.map((adminId) => sendTelegramMessage(adminId, text)));
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = {
  ADMIN_IDS,
  verifyInitData,
  isAdmin,
  sendTelegramMessage,
  notifyAdminsOfWin,
};
