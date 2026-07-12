(function () {
  const root = document.getElementById("adminRoot");
  let ALL_MISSIONS = [];
  let ALL_MISSION_ITEMS = [];
  let ALL_SHOP_ITEMS = [];

  function getInitData() {
    try {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        if (tg.initData) return tg.initData;
      }
    } catch (e) {}
    // Фолбек: якщо перейшли сюди кнопкою "Адмін-панель" з головної
    // сторінки, initData передається явним query-параметром.
    try {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get("tgInitData");
      if (fromQuery) return fromQuery;
    } catch (e) {}
    return "";
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  function renderDenied() {
    root.innerHTML = `<div class="admin-denied">⛔ У вас немає доступу до цієї панелі.<br/>Відкрийте цю сторінку через акаунт адміністратора в Telegram.</div>`;
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function showStatus(el, ok, text) {
    el.textContent = text;
    el.className = "admin-status show " + (ok ? "ok" : "err");
  }

  function groupShopItems(items) {
    const groups = {};
    items.forEach((it) => {
      if (!groups[it.sectionId]) groups[it.sectionId] = { sectionId: it.sectionId, sectionTitle: it.sectionTitle, items: [] };
      groups[it.sectionId].items.push(it);
    });
    return Object.values(groups);
  }

  function groupMissions(missions) {
    const groups = {};
    missions.forEach((m) => {
      const key = `${m.category}::${m.sectionId}`;
      if (!groups[key]) groups[key] = { category: m.category, sectionTitle: m.sectionTitle, items: [] };
      groups[key].items.push(m);
    });
    return Object.values(groups);
  }

  function groupMissionItems(items) {
    const groups = {};
    items.forEach((it) => {
      const key = `${it.category}::${it.sectionId}`;
      if (!groups[key]) groups[key] = { category: it.category, sectionTitle: it.sectionTitle, items: [] };
      groups[key].items.push(it);
    });
    return Object.values(groups);
  }

  function renderMissionItems(items) {
    const groups = groupMissionItems(items);
    return groups
      .map((group) => {
        const rows = group.items
          .map((it) => {
            const rewardLabelField = it.category === "keys"
              ? `<input type="text" class="admin-shop-item-img" data-field="rewardLabel" data-item-id="${it.id}" placeholder="напр. 1 ключ" value="${escapeHtml(it.rewardLabel)}" />`
              : "";
            return `
          <div class="admin-shop-item ${it.active ? "" : "admin-shop-item-inactive"}" data-item-id="${it.id}">
            <div class="admin-shop-item-row">
              <input type="text" class="admin-shop-item-label" data-field="label" data-item-id="${it.id}" value="${escapeHtml(it.label)}" />
              <input type="number" class="admin-shop-item-price" data-field="rewardAmount" data-item-id="${it.id}" min="0" value="${it.rewardAmount}" />
            </div>
            ${rewardLabelField ? `<div class="admin-shop-item-row">${rewardLabelField}
              <label class="admin-shop-item-active">
                <input type="checkbox" data-field="active" data-item-id="${it.id}" ${it.active ? "checked" : ""} />
                Активна
              </label>
            </div>` : `
            <div class="admin-shop-item-row">
              <label class="admin-shop-item-active">
                <input type="checkbox" data-field="active" data-item-id="${it.id}" ${it.active ? "checked" : ""} />
                Активна
              </label>
            </div>`}
            <button class="admin-btn admin-btn-secondary admin-mission-item-save" data-save-mission-id="${it.id}">Зберегти</button>
            <div class="admin-status" data-mission-item-status="${it.id}"></div>
          </div>
        `;
          })
          .join("");
        return `
          <div class="admin-mission-group">
            <div class="admin-mission-group-title">${escapeHtml(group.sectionTitle)} ${group.category === "keys" ? "(ключі)" : "(RP)"}</div>
            ${rows}
          </div>
        `;
      })
      .join("");
  }

  function renderShopItems(items) {
    const groups = groupShopItems(items);
    return groups
      .map((group) => {
        const rows = group.items
          .map(
            (it) => `
          <div class="admin-shop-item ${it.active ? "" : "admin-shop-item-inactive"}" data-item-id="${it.id}">
            <div class="admin-shop-item-row">
              <input type="text" class="admin-shop-item-label" data-field="label" data-item-id="${it.id}" value="${escapeHtml(it.label)}" />
              <input type="number" class="admin-shop-item-price" data-field="price" data-item-id="${it.id}" min="0" value="${it.price}" />
            </div>
            <div class="admin-shop-item-row">
              <input type="text" class="admin-shop-item-img" data-field="img" data-item-id="${it.id}" placeholder="assets/... (необов'язково)" value="${it.img ? escapeHtml(it.img) : ""}" />
              <label class="admin-shop-item-active">
                <input type="checkbox" data-field="active" data-item-id="${it.id}" ${it.active ? "checked" : ""} />
                Активний
              </label>
            </div>
            <button class="admin-btn admin-btn-secondary admin-shop-item-save" data-save-item-id="${it.id}">Зберегти</button>
            <div class="admin-status" data-shop-status="${it.id}"></div>
          </div>
        `
          )
          .join("");
        return `
          <div class="admin-mission-group">
            <div class="admin-mission-group-title">${escapeHtml(group.sectionTitle)}</div>
            ${rows}
          </div>
        `;
      })
      .join("");
  }

  function renderPanel(prizes, missions, missionItems, shopItems) {
    ALL_MISSIONS = missions;
    ALL_MISSION_ITEMS = missionItems;
    ALL_SHOP_ITEMS = shopItems;
    const prizeOptions = prizes
      .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
      .join("");

    const missionGroups = groupMissions(missions);
    const missionsHtml = missionGroups
      .map((group) => {
        const rows = group.items
          .map(
            (m) => `
          <label class="admin-mission-row" data-mission-id="${m.id}">
            <input type="checkbox" class="admin-mission-checkbox" data-mission-id="${m.id}" />
            <span class="admin-mission-label">${escapeHtml(m.label)}</span>
            <span class="admin-mission-reward" data-mission-reward="${m.id}">${escapeHtml(m.reward)}</span>
            <span class="admin-mission-flag" data-mission-flag="${m.id}"></span>
          </label>
        `
          )
          .join("");
        return `
          <div class="admin-mission-group">
            <div class="admin-mission-group-title">${escapeHtml(group.sectionTitle)} ${group.category === "keys" ? "(ключі)" : "(RP)"}</div>
            ${rows}
          </div>
        `;
      })
      .join("");

    root.innerHTML = `
      <div class="admin-title">🛠 Admin Panel</div>

      <div class="admin-card">
        <h3>Користувач</h3>
        <div class="admin-field">
          <label>Telegram ID користувача</label>
          <input type="text" id="targetUserId" placeholder="напр. 123456789" inputmode="numeric" />
        </div>
        <button class="admin-btn admin-btn-secondary" id="lookupUserBtn">Показати інформацію</button>
        <div class="admin-status" id="lookupStatus"></div>
      </div>

      <div class="admin-card">
        <h3>Видати ключі на прокрутку</h3>
        <div class="admin-field">
          <label>Кількість ключів</label>
          <input type="number" id="keysAmount" min="1" value="1" />
        </div>
        <button class="admin-btn" id="giveKeysBtn">Видати ключі</button>
        <div class="admin-status" id="keysStatus"></div>
      </div>

      <div class="admin-card">
        <h3>Приз для наступного відкриття</h3>
        <div class="admin-field">
          <label>Що має випасти користувачу</label>
          <select id="prizeSelect">
            <option value="random">🎲 Випадково (за замовчуванням)</option>
            ${prizeOptions}
          </select>
        </div>
        <button class="admin-btn" id="setPrizeBtn">Встановити приз</button>
        <div class="admin-status" id="prizeStatus"></div>
      </div>

      <div class="admin-card">
        <h3>Товари магазину</h3>
        <p class="admin-hint">Змінюйте назву, ціну, картинку або доступність товарів, які вже є в Royal Store. Зміни одразу зʼявляються в застосунку.</p>
        <div id="shopItemsList">${renderShopItems(shopItems)}</div>
      </div>

      <div class="admin-card">
        <h3>Місії та нагороди</h3>
        <p class="admin-hint">Змінюйте текст місій, розмір нагороди та (для розділу "Ключі") текст нагороди, або вимикайте місію повністю. Зміни одразу зʼявляються в застосунку.</p>
        <div id="missionItemsList">${renderMissionItems(missionItems)}</div>
      </div>

      <div class="admin-card">
        <h3>Підтвердження місій</h3>
        <p class="admin-hint">Відмітьте виконані місії користувача — у нього вони загоряться золотим. Скидається автоматично щонеділі.</p>
        <button class="admin-btn admin-btn-secondary" id="loadMissionsBtn">Завантажити місії користувача</button>
        <div class="admin-status" id="missionsLoadStatus"></div>
        <div id="missionsList">${missionsHtml}</div>
        <div class="admin-status" id="missionsSaveStatus"></div>
      </div>
    `;

    document.getElementById("giveKeysBtn").onclick = onGiveKeys;
    document.getElementById("setPrizeBtn").onclick = onSetPrize;
    document.getElementById("lookupUserBtn").onclick = onLookupUser;
    document.getElementById("loadMissionsBtn").onclick = onLoadUserMissions;
    document.querySelectorAll(".admin-mission-checkbox").forEach((cb) => {
      cb.onchange = () => onToggleMissionConfirmed(cb.dataset.missionId, cb.checked);
    });
    document.querySelectorAll(".admin-shop-item-save").forEach((btn) => {
      btn.onclick = () => onSaveShopItem(btn.dataset.saveItemId);
    });
    document.querySelectorAll(".admin-mission-item-save").forEach((btn) => {
      btn.onclick = () => onSaveMissionItem(btn.dataset.saveMissionId);
    });
  }

  async function onLookupUser() {
    const btn = document.getElementById("lookupUserBtn");
    const statusEl = document.getElementById("lookupStatus");
    const targetUserId = document.getElementById("targetUserId").value.trim();

    if (!targetUserId) return showStatus(statusEl, false, "Вкажіть Telegram ID користувача");

    btn.disabled = true;
    try {
      const initData = getInitData();
      const data = await api(
        `/api/admin/user?initData=${encodeURIComponent(initData)}&targetUserId=${encodeURIComponent(targetUserId)}`
      );
      const u = data.user;
      showStatus(
        statusEl,
        true,
        `ClubGG ID: ${u.clubGgId ? escapeHtml(u.clubGgId) : "не вказано"} · Ключі: ${u.tickets} · RP: ${u.rpPoints}`
      );
    } catch (e) {
      showStatus(statusEl, false, "Помилка: " + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  async function onGiveKeys() {
    const btn = document.getElementById("giveKeysBtn");
    const statusEl = document.getElementById("keysStatus");
    const targetUserId = document.getElementById("targetUserId").value.trim();
    const amount = Number(document.getElementById("keysAmount").value);

    if (!targetUserId) return showStatus(statusEl, false, "Вкажіть Telegram ID користувача");
    if (!amount || amount <= 0) return showStatus(statusEl, false, "Вкажіть коректну кількість ключів");

    btn.disabled = true;
    try {
      const data = await api("/api/admin/give-keys", {
        method: "POST",
        body: { initData: getInitData(), targetUserId, amount },
      });
      showStatus(statusEl, true, `Готово! У користувача тепер ${data.user.tickets} ключів.`);
    } catch (e) {
      showStatus(statusEl, false, "Помилка: " + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  async function onSetPrize() {
    const btn = document.getElementById("setPrizeBtn");
    const statusEl = document.getElementById("prizeStatus");
    const targetUserId = document.getElementById("targetUserId").value.trim();
    const prizeId = document.getElementById("prizeSelect").value;

    if (!targetUserId) return showStatus(statusEl, false, "Вкажіть Telegram ID користувача");

    btn.disabled = true;
    try {
      await api("/api/admin/set-prize", {
        method: "POST",
        body: { initData: getInitData(), targetUserId, prizeId },
      });
      const label = prizeId === "random" ? "випадковий приз (за замовчуванням)" : "обраний приз";
      showStatus(statusEl, true, `Готово! Наступного разу користувач отримає ${label}.`);
    } catch (e) {
      showStatus(statusEl, false, "Помилка: " + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  async function onSaveShopItem(itemId) {
    const statusEl = document.querySelector(`[data-shop-status="${itemId}"]`);
    const btn = document.querySelector(`.admin-shop-item-save[data-save-item-id="${itemId}"]`);
    const labelInput = document.querySelector(`[data-field="label"][data-item-id="${itemId}"]`);
    const priceInput = document.querySelector(`[data-field="price"][data-item-id="${itemId}"]`);
    const imgInput = document.querySelector(`[data-field="img"][data-item-id="${itemId}"]`);
    const activeInput = document.querySelector(`[data-field="active"][data-item-id="${itemId}"]`);

    const label = labelInput.value.trim();
    const price = Number(priceInput.value);
    const img = imgInput.value.trim();
    const active = activeInput.checked;

    if (!label) return showStatus(statusEl, false, "Вкажіть назву товару");
    if (!Number.isFinite(price) || price < 0) return showStatus(statusEl, false, "Вкажіть коректну ціну");

    btn.disabled = true;
    try {
      const data = await api(`/api/admin/shop-items/${encodeURIComponent(itemId)}`, {
        method: "PUT",
        body: { initData: getInitData(), label, price, img: img || null, active },
      });
      const card = document.querySelector(`.admin-shop-item[data-item-id="${itemId}"]`);
      if (card) card.classList.toggle("admin-shop-item-inactive", !data.item.active);
      const idx = ALL_SHOP_ITEMS.findIndex((it) => it.id === itemId);
      if (idx !== -1) ALL_SHOP_ITEMS[idx] = data.item;
      showStatus(statusEl, true, "Товар оновлено.");
    } catch (e) {
      showStatus(statusEl, false, "Помилка: " + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  async function onSaveMissionItem(missionId) {
    const statusEl = document.querySelector(`[data-mission-item-status="${missionId}"]`);
    const btn = document.querySelector(`.admin-mission-item-save[data-save-mission-id="${missionId}"]`);
    const labelInput = document.querySelector(`[data-field="label"][data-item-id="${missionId}"]`);
    const rewardAmountInput = document.querySelector(`[data-field="rewardAmount"][data-item-id="${missionId}"]`);
    const rewardLabelInput = document.querySelector(`[data-field="rewardLabel"][data-item-id="${missionId}"]`);
    const activeInput = document.querySelector(`[data-field="active"][data-item-id="${missionId}"]`);

    const label = labelInput.value.trim();
    const rewardAmount = Number(rewardAmountInput.value);
    const rewardLabel = rewardLabelInput ? rewardLabelInput.value.trim() : undefined;
    const active = activeInput.checked;

    if (!label) return showStatus(statusEl, false, "Вкажіть текст місії");
    if (!Number.isFinite(rewardAmount) || rewardAmount < 0) return showStatus(statusEl, false, "Вкажіть коректну нагороду");
    if (rewardLabelInput && !rewardLabel) return showStatus(statusEl, false, "Вкажіть текст нагороди");

    btn.disabled = true;
    try {
      const body = { initData: getInitData(), label, rewardAmount, active };
      if (rewardLabel !== undefined) body.rewardLabel = rewardLabel;
      const data = await api(`/api/admin/mission-items/${encodeURIComponent(missionId)}`, {
        method: "PUT",
        body,
      });
      const card = document.querySelector(`.admin-shop-item[data-item-id="${missionId}"]`);
      if (card) card.classList.toggle("admin-shop-item-inactive", !data.item.active);
      const idx = ALL_MISSION_ITEMS.findIndex((it) => it.id === missionId);
      if (idx !== -1) ALL_MISSION_ITEMS[idx] = data.item;
      const missionIdx = ALL_MISSIONS.findIndex((m) => m.id === missionId);
      if (missionIdx !== -1) {
        ALL_MISSIONS[missionIdx].label = data.item.label;
        ALL_MISSIONS[missionIdx].reward = data.item.category === "keys" ? data.item.rewardLabel : `${data.item.rewardAmount} RP`;
        const labelSpan = document.querySelector(`.admin-mission-label[data-mission-id="${missionId}"]`) || document.querySelector(`[data-mission-id="${missionId}"] .admin-mission-label`);
        if (labelSpan) labelSpan.textContent = ALL_MISSIONS[missionIdx].label;
        const rewardSpan = document.querySelector(`[data-mission-reward="${missionId}"]`);
        if (rewardSpan) rewardSpan.textContent = ALL_MISSIONS[missionIdx].reward;
      }
      showStatus(statusEl, true, "Місію оновлено.");
    } catch (e) {
      showStatus(statusEl, false, "Помилка: " + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  async function onLoadUserMissions() {
    const btn = document.getElementById("loadMissionsBtn");
    const statusEl = document.getElementById("missionsLoadStatus");
    const targetUserId = document.getElementById("targetUserId").value.trim();

    if (!targetUserId) return showStatus(statusEl, false, "Вкажіть Telegram ID користувача");

    btn.disabled = true;
    try {
      const initData = getInitData();
      const data = await api(
        `/api/admin/user-missions?initData=${encodeURIComponent(initData)}&targetUserId=${encodeURIComponent(targetUserId)}`
      );
      const selected = data.missions.selected || {};
      const confirmed = data.missions.confirmed || {};

      ALL_MISSIONS.forEach((m) => {
        const checkbox = document.querySelector(`.admin-mission-checkbox[data-mission-id="${m.id}"]`);
        const flag = document.querySelector(`[data-mission-flag="${m.id}"]`);
        if (checkbox) checkbox.checked = Boolean(confirmed[m.id]);
        if (flag) flag.textContent = selected[m.id] ? "обрано гравцем" : "";
      });

      showStatus(statusEl, true, `Місії користувача ${targetUserId} завантажено.`);
    } catch (e) {
      showStatus(statusEl, false, "Помилка: " + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  async function onToggleMissionConfirmed(missionId, confirmed) {
    const statusEl = document.getElementById("missionsSaveStatus");
    const targetUserId = document.getElementById("targetUserId").value.trim();
    const checkbox = document.querySelector(`.admin-mission-checkbox[data-mission-id="${missionId}"]`);

    if (!targetUserId) {
      showStatus(statusEl, false, "Спочатку вкажіть Telegram ID користувача");
      if (checkbox) checkbox.checked = !confirmed;
      return;
    }

    try {
      const data = await api("/api/admin/confirm-mission", {
        method: "POST",
        body: { initData: getInitData(), targetUserId, missionId, confirmed },
      });
      const balanceNote = `(Ключі: ${data.tickets}, RP: ${data.rpPoints})`;
      showStatus(
        statusEl,
        true,
        (confirmed
          ? "Місію підтверджено — нагороду нараховано, у користувача вона загориться золотим."
          : "Підтвердження знято — нагороду скасовано.") +
          " " +
          balanceNote
      );
    } catch (e) {
      showStatus(statusEl, false, "Помилка: " + e.message);
      if (checkbox) checkbox.checked = !confirmed;
    }
  }

  async function init() {
    const initData = getInitData();
    try {
      await api("/api/admin/verify", { method: "POST", body: { initData } });
      const { prizes } = await api(`/api/admin/prizes?initData=${encodeURIComponent(initData)}`);
      const { missions } = await api(`/api/admin/missions?initData=${encodeURIComponent(initData)}`);
      const { items: missionItems } = await api(`/api/admin/mission-items?initData=${encodeURIComponent(initData)}`);
      const { items: shopItems } = await api(`/api/admin/shop-items?initData=${encodeURIComponent(initData)}`);
      renderPanel(prizes, missions, missionItems, shopItems);
    } catch (e) {
      renderDenied();
    }
  }

  init();
})();
