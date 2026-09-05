// TRIBE — vanilla JS single-page app, zero build step.
"use strict";

const API = ""; // same origin as the backend serving this file
const $app = document.getElementById("app");
const PREMIUM_PRICE = 4.99;

// Picked once per page load, so the tagline changes on every reload.
const TAGLINES = [
  "Finde Leute, die dasselbe suchen wie du.",
  "Finde Leute aus deiner Bubble.",
  "Finde Leute, die du sonst nirgends triffst.",
];
const TAGLINE = TAGLINES[Math.floor(Math.random() * TAGLINES.length)];

// ---------- PWA install prompt ----------
// Chrome/Android fire this before showing their own install UI; we capture
// it so we can trigger the native install dialog from our own button.
let deferredInstallPrompt = null;
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById("install-app-btn");
  if (btn) btn.style.display = "";
});

async function handleInstallClick() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    const btn = document.getElementById("install-app-btn");
    if (btn) btn.style.display = "none";
  } else if (isIos()) {
    alert(
      "So installierst du TRIBE auf dem iPhone:\n\n1. Tippe unten auf das Teilen-Symbol (Quadrat mit Pfeil nach oben)\n2. Wähle „Zum Home-Bildschirm“\n3. Tippe auf „Hinzufügen“"
    );
  } else {
    alert(
      "Öffne das Menü deines Browsers (meist drei Punkte oben rechts) und wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“."
    );
  }
}

function renderInstallButton() {
  if (isStandalone()) return ""; // already installed, no need to show it
  return `<button type="button" id="install-app-btn" class="btn-secondary" style="width:100%; margin-top:14px; ${deferredInstallPrompt || isIos() ? "" : "display:none;"}">📲 App installieren</button>`;
}

const state = {
  token: localStorage.getItem("tribe_token") || null,
  user: null,
  categories: [],
  tab: "discover",
  deck: [],
  lastSwiped: null,
  matches: [],
  matchSearch: "",
  activeChat: null, // {matchId, other}
  chatMessages: [],
  authMode: "login",
};

// ---------- API helper ----------
async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && state.token) headers["Authorization"] = "Bearer " + state.token;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Etwas ist schiefgelaufen");
  return data;
}

function catName(id) {
  const c = state.categories.find((c) => c.id === id);
  return c ? c.name : "?";
}

// ---------- render root ----------
function render() {
  if (!state.token || !state.user) {
    $app.innerHTML = "";
    $app.appendChild(renderAuth());
    return;
  }
  $app.innerHTML = "";
  $app.appendChild(renderAppShell());
}

// ================= AUTH =================
function renderAuth() {
  const wrap = document.createElement("div");
  wrap.className = "auth-screen";

  const mode = state.authMode;
  wrap.innerHTML = `
    <div>
      <h1 class="brand">TRIBE</h1>
      <p class="tagline">${TAGLINE}</p>
      ${renderInstallButton()}
    </div>
    <div class="beta-notice">
      🚧 TRIBE steckt noch in einer frühen Phase. Es kann zu Bugs oder Änderungen kommen, und wir bringen laufend Updates. Vorschläge und Feedback sind jederzeit herzlich willkommen unter
      <a href="mailto:tribeapp.support@gmail.com" style="color:var(--accent2);">tribeapp.support@gmail.com</a>.
    </div>
    <div class="beta-notice">
      🌱 TRIBE ist gerade erst gestartet, deshalb sind aktuell noch nicht viele Leute angemeldet. Hol dir die App trotzdem schon jetzt und hab ein bisschen Geduld — je mehr Leute dabei sind, desto mehr Matches gibt's auch für dich.
    </div>
    <div class="tabs">
      <button data-mode="login" class="${mode === "login" ? "active" : ""}">Login</button>
      <button data-mode="register" class="${mode === "register" ? "active" : ""}">Registrieren</button>
    </div>
    <div id="auth-error"></div>
    <form id="auth-form" class="field" style="gap:14px;"></form>
    <p style="text-align:center; font-size:12px; color:var(--text-dim); margin-top:8px;">
      Mit der Registrierung akzeptierst du unsere
      <a href="/privacy.html" target="_blank" style="color:var(--accent2);">Datenschutzerklärung</a>
      und unsere
      <a href="/child-safety.html" target="_blank" style="color:var(--accent2);">Kinderschutzrichtlinie</a>.
      Du musst mindestens 18 Jahre alt sein.
    </p>
    <p style="text-align:center; font-size:12px; color:var(--text-dim); margin-top:4px;">
      Du willst deine Marke bei uns bewerben?
      <a href="/advertise.html" target="_blank" style="color:var(--accent2);">Werbung auf TRIBE schalten</a>
    </p>
  `;

  const installBtn = wrap.querySelector("#install-app-btn");
  if (installBtn) installBtn.onclick = handleInstallClick;

  wrap.querySelectorAll(".tabs button").forEach((btn) => {
    btn.onclick = () => {
      state.authMode = btn.dataset.mode;
      render();
    };
  });

  const form = wrap.querySelector("#auth-form");
  if (mode === "login") {
    form.innerHTML = `
      <div class="field"><label>E-Mail</label><input type="email" name="email" required /></div>
      <div class="field">
        <label>Passwort</label>
        <div class="password-wrap">
          <input type="password" name="password" required />
          <button type="button" class="toggle-password" tabindex="-1">👁️</button>
        </div>
      </div>
      <button class="btn-primary" type="submit">Einloggen</button>
    `;
  } else {
    form.innerHTML = `
      <div class="field"><label>Name</label><input type="text" name="name" required /></div>
      <div class="field"><label>E-Mail</label><input type="email" name="email" required /></div>
      <div class="field">
        <label>Passwort</label>
        <div class="password-wrap">
          <input type="password" name="password" minlength="6" required />
          <button type="button" class="toggle-password" tabindex="-1">👁️</button>
        </div>
      </div>
      <div class="field">
        <label>Geburtsdatum (du musst 18+ sein)</label>
        <div style="display:flex; gap:8px;">
          <select name="birthDay" required style="flex:1;"><option value="">Tag</option></select>
          <select name="birthMonth" required style="flex:1.4;"><option value="">Monat</option></select>
          <select name="birthYear" required style="flex:1.2;"><option value="">Jahr</option></select>
        </div>
      </div>
      <div class="field"><label>Stadt / Region / Land</label><input type="text" name="location" placeholder="z.B. Wien, Österreich" /></div>
      <div class="field">
        <label>Wie präsentierst / identifizierst du dich? (mehrere möglich)</label>
        <div id="identity-picker"></div>
      </div>
      <div class="field">
        <label>Wonach suchst du?</label>
        <div id="seeking-picker"></div>
      </div>
      <div class="field">
        <label>Altersspanne, die du sehen willst</label>
        <div style="display:flex; gap:10px; align-items:center;">
          <input type="number" name="ageMin" min="18" max="99" value="18" style="width:90px;" /> bis
          <input type="number" name="ageMax" min="18" max="99" value="99" style="width:90px;" />
        </div>
      </div>
      <button class="btn-primary" type="submit">Account erstellen</button>
    `;
    const identitySel = new Set();
    const seekingSel = new Set();
    renderGroupedTagPicker(form.querySelector("#identity-picker"), identitySel);
    renderGroupedTagPicker(form.querySelector("#seeking-picker"), seekingSel, { seekingMode: true });
    form._identitySel = identitySel;
    form._seekingSel = seekingSel;
  }

  populateBirthdateSelects(form);

  form.querySelectorAll(".toggle-password").forEach((btn) => {
    btn.onclick = () => {
      const input = btn.previousElementSibling;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.textContent = showing ? "👁️" : "🙈";
    };
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const errEl = wrap.querySelector("#auth-error");
    errEl.innerHTML = "";
    try {
      let data;
      if (mode === "login") {
        data = await api("/api/auth/login", {
          method: "POST",
          auth: false,
          body: { email: fd.get("email"), password: fd.get("password") },
        });
      } else {
        data = await api("/api/auth/register", {
          method: "POST",
          auth: false,
          body: {
            name: fd.get("name"),
            email: fd.get("email"),
            password: fd.get("password"),
            birthdate: `${fd.get("birthYear")}-${String(fd.get("birthMonth")).padStart(2, "0")}-${String(fd.get("birthDay")).padStart(2, "0")}`,
            location: fd.get("location") || "",
            identity: [...form._identitySel],
            seeking: [...form._seekingSel],
            seekAgeMin: fd.get("ageMin"),
            seekAgeMax: fd.get("ageMax"),
          },
        });
      }
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem("tribe_token", data.token);
      state.tab = "discover";
      await loadDeck();
      render();
    } catch (err) {
      errEl.innerHTML = `<div class="error-msg">${escapeHtml(err.message)}</div>`;
    }
  };

  return wrap;
}

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

// Fills the day/month/year birthdate dropdowns, if present in the form.
// Using plain <select> elements instead of a native date input avoids the
// painfully slow month-by-month calendar swipe some mobile browsers show.
function populateBirthdateSelects(form) {
  const daySel = form.querySelector('select[name="birthDay"]');
  const monthSel = form.querySelector('select[name="birthMonth"]');
  const yearSel = form.querySelector('select[name="birthYear"]');
  if (!daySel || !monthSel || !yearSel) return;
  if (daySel.dataset.filled) return; // avoid re-filling on re-render

  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement("option");
    opt.value = String(d);
    opt.textContent = String(d);
    daySel.appendChild(opt);
  }
  MONTH_NAMES.forEach((name, i) => {
    const opt = document.createElement("option");
    opt.value = String(i + 1);
    opt.textContent = name;
    monthSel.appendChild(opt);
  });
  const currentYear = new Date().getFullYear();
  // Most recent eligible birth year (18+) first, so the common case
  // (younger adults signing up) needs the least scrolling.
  for (let y = currentYear - 18; y >= currentYear - 100; y--) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    yearSel.appendChild(opt);
  }
  daySel.dataset.filled = "1";
}

const GROUP_LABELS = {
  gender: "Geschlecht / Identität",
  orientation: "Sexuelle Orientierung",
  style: "Style / Szene",
};

// Renders category chips grouped into sections (gender / orientation /
// style). In seekingMode, adds an "alle Geschlechter / alles gemixt" chip
// that clears gender+orientation selections in one click — for people who
// don't want to filter by gender/orientation at all.
function renderGroupedTagPicker(container, selectedSet, { seekingMode = false } = {}) {
  container.innerHTML = "";

  if (seekingMode) {
    const genderOrientationIds = state.categories
      .filter((c) => c.type === "gender" || c.type === "orientation")
      .map((c) => c.id);
    const allChip = document.createElement("button");
    allChip.type = "button";
    const isAllActive = !genderOrientationIds.some((id) => selectedSet.has(id));
    allChip.className = "tag-chip" + (isAllActive ? " selected" : "");
    allChip.style.marginBottom = "12px";
    allChip.textContent = "🌈 Alle Geschlechter / alles gemixt";
    allChip.onclick = () => {
      genderOrientationIds.forEach((id) => selectedSet.delete(id));
      renderGroupedTagPicker(container, selectedSet, { seekingMode });
    };
    container.appendChild(allChip);
  }

  ["gender", "orientation", "style"].forEach((type) => {
    const cats = state.categories.filter((c) => c.type === type);
    if (cats.length === 0) return;
    const heading = document.createElement("div");
    heading.className = "section-title";
    heading.style.margin = "10px 0 6px";
    heading.textContent = GROUP_LABELS[type] || type;
    container.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "tag-grid";
    cats.forEach((cat) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag-chip" + (selectedSet.has(cat.id) ? " selected" : "");
      chip.textContent = cat.name;
      chip.onclick = () => {
        if (selectedSet.has(cat.id)) selectedSet.delete(cat.id);
        else selectedSet.add(cat.id);
        renderGroupedTagPicker(container, selectedSet, { seekingMode });
      };
      grid.appendChild(chip);
    });
    container.appendChild(grid);
  });
}

// ================= APP SHELL =================
function renderAppShell() {
  const wrap = document.createElement("div");
  wrap.className = "app-shell";

  const topbar = document.createElement("div");
  topbar.className = "topbar";
  topbar.innerHTML = `<span class="brand">TRIBE</span>`;
  const logoutBtn = document.createElement("button");
  logoutBtn.className = "btn-ghost";
  logoutBtn.textContent = "Abmelden";
  logoutBtn.onclick = () => {
    localStorage.removeItem("tribe_token");
    state.token = null;
    state.user = null;
    render();
  };
  topbar.appendChild(logoutBtn);
  wrap.appendChild(topbar);

  const view = document.createElement("div");
  view.className = "view";
  view.id = "view";
  wrap.appendChild(view);

  if (state.tab !== "chat") {
    const nav = document.createElement("div");
    nav.className = "bottom-nav";
    nav.innerHTML = `
      <button data-tab="discover"><span class="icon">✨</span>Entdecken</button>
      <button data-tab="matches"><span class="icon">💬</span>Matches</button>
      <button data-tab="profile"><span class="icon">👤</span>Profil</button>
    `;
    nav.querySelectorAll("button").forEach((btn) => {
      if (btn.dataset.tab === state.tab) btn.classList.add("active");
      btn.onclick = async () => {
        state.tab = btn.dataset.tab;
        if (state.tab === "matches") await loadMatches();
        render();
      };
    });
    wrap.appendChild(nav);
  }

  renderTabContent(view);
  return wrap;
}

function renderTabContent(view) {
  if (state.tab === "discover") return renderDiscover(view);
  if (state.tab === "matches") return renderMatches(view);
  if (state.tab === "profile") return renderProfile(view);
  if (state.tab === "chat") return renderChat(view);
}

// ================= DISCOVER =================
function interleaveAds(deck, ad) {
  if (!ad) return deck;
  const out = [];
  deck.forEach((p, i) => {
    out.push(p);
    if ((i + 1) % 6 === 0) out.push({ _ad: true, ...ad, id: `ad-${i}-${Math.random()}` });
  });
  return out;
}

async function loadDeck() {
  const deck = await api("/api/discover");
  if (!state.user.premium) {
    try {
      const ad = await api("/api/ads");
      state.deck = interleaveAds(deck, ad);
    } catch {
      state.deck = deck;
    }
  } else {
    state.deck = deck;
  }
}

function renderDiscover(view) {
  if (!state.user.premium) {
    const banner = document.createElement("div");
    banner.className = "info-msg";
    banner.style.marginBottom = "12px";
    banner.style.display = "flex";
    banner.style.justifyContent = "space-between";
    banner.style.alignItems = "center";
    banner.style.gap = "10px";
    banner.innerHTML = `<span>Werbefrei mit TRIBE Premium – ${PREMIUM_PRICE.toFixed(2)} €/Monat</span>`;
    const goBtn = document.createElement("button");
    goBtn.className = "btn-ghost";
    goBtn.style.whiteSpace = "nowrap";
    goBtn.textContent = "Ansehen";
    goBtn.onclick = () => {
      state.tab = "profile";
      render();
    };
    banner.appendChild(goBtn);
    view.appendChild(banner);
  }

  if (state.deck.length === 0) {
    view.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🌱</div>
        <h3>Keine neuen Leute gerade</h3>
        <p>Schau später nochmal vorbei oder passe deine Kategorien im Profil an.</p>
        <p style="margin-top:10px;">TRIBE ist noch ganz neu, deshalb sind aktuell erst wenige Leute angemeldet. Bleib dran — je mehr Leute sich anmelden, desto mehr Matches gibt's auch für dich. Erzähl gern auch Freund:innen aus deiner Szene davon! 🌱</p>
      </div>
    `;
    const btn = document.createElement("button");
    btn.className = "btn-secondary";
    btn.style.marginTop = "12px";
    btn.textContent = "Neu laden";
    btn.onclick = async () => {
      await loadDeck();
      render();
    };
    view.appendChild(btn);
    return;
  }

  const stack = document.createElement("div");
  stack.className = "card-stack";
  // render up to 3 cards, topmost is last swiped index 0
  state.deck.slice(0, 3).reverse().forEach((person, i, arr) => {
    const isTop = i === arr.length - 1;
    const card = buildSwipeCard(person, isTop);
    stack.appendChild(card);
  });
  view.appendChild(stack);

  const topIsAd = !!state.deck[0]._ad;
  if (!topIsAd) {
    const actions = document.createElement("div");
    actions.className = "swipe-actions";
    actions.innerHTML = `
      <button class="undo-btn" id="undo-btn" title="Letzten Swipe rückgängig machen" ${state.lastSwiped ? "" : "disabled"}>↺</button>
      <button class="nope-btn" id="nope-btn">✕</button>
      <button class="like-btn" id="like-btn">♥</button>
    `;
    view.appendChild(actions);
    actions.querySelector("#nope-btn").onclick = () => swipeTop(false);
    actions.querySelector("#like-btn").onclick = () => swipeTop(true);
    actions.querySelector("#undo-btn").onclick = () => undoSwipe();
  } else {
    const actions = document.createElement("div");
    actions.className = "swipe-actions";
    actions.innerHTML = `<button class="btn-secondary" id="ad-continue-btn" style="width:100%; border-radius:12px;">Weiter →</button>`;
    view.appendChild(actions);
    actions.querySelector("#ad-continue-btn").onclick = () => dismissAd();
  }
}

function buildSwipeCard(person, isTop) {
  const card = document.createElement("div");
  card.className = "swipe-card";
  card.dataset.userId = person.id;

  if (person._ad) {
    card.innerHTML = `
      <div class="photo">${person.emoji || "📢"}</div>
      <div class="info">
        <div class="name-age">${escapeHtml(person.title)}</div>
        <div class="bio">${escapeHtml(person.body)}</div>
        <div class="tag-grid"><span class="tag-chip readonly">Anzeige</span></div>
        <button class="btn-secondary" style="margin-top:14px; width:100%;">${escapeHtml(person.cta_label || "Mehr erfahren")}</button>
      </div>
    `;
    if (isTop) attachDrag(card, document.createElement("div"), document.createElement("div"), true);
    return card;
  }

  const photo = document.createElement("div");
  photo.className = "photo";
  if (person.photo_url) {
    photo.style.backgroundImage = `url(${person.photo_url})`;
  } else {
    photo.textContent = "🙂";
  }
  card.appendChild(photo);

  const info = document.createElement("div");
  info.className = "info";
  info.innerHTML = `
    <div class="name-age">${escapeHtml(person.name)}, ${person.age}</div>
    ${person.location ? `<div class="bio">📍 ${escapeHtml(person.location)}</div>` : ""}
    <div class="bio">${escapeHtml(person.bio || "Noch keine Bio.")}</div>
    <div class="tag-grid">
      ${person.identity.map((t) => `<span class="tag-chip readonly">${escapeHtml(t.name)}</span>`).join("")}
    </div>
  `;
  card.appendChild(info);

  const likeBadge = document.createElement("div");
  likeBadge.className = "swipe-badge like";
  likeBadge.textContent = "LIKE";
  const nopeBadge = document.createElement("div");
  nopeBadge.className = "swipe-badge nope";
  nopeBadge.textContent = "NOPE";
  card.appendChild(likeBadge);
  card.appendChild(nopeBadge);

  const menuBtn = document.createElement("button");
  menuBtn.type = "button";
  menuBtn.className = "card-menu-btn";
  menuBtn.title = "Melden oder blockieren";
  menuBtn.textContent = "⋯";
  menuBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  menuBtn.onclick = (e) => {
    e.stopPropagation();
    showReportBlockMenu(person, {
      onBlocked: () => {
        state.deck = state.deck.filter((p) => p.id !== person.id);
        render();
      },
    });
  };
  card.appendChild(menuBtn);

  if (isTop) attachDrag(card, likeBadge, nopeBadge);
  return card;
}

function dismissAd() {
  if (swiping || state.deck.length === 0) return;
  state.deck.shift();
  render();
}

function attachDrag(card, likeBadge, nopeBadge, isAd = false) {
  let startX = 0, startY = 0, dx = 0, dragging = false;

  const onDown = (x, y) => {
    dragging = true;
    startX = x;
    startY = y;
    card.style.transition = "none";
  };
  const onMove = (x, y) => {
    if (!dragging) return;
    dx = x - startX;
    const dy = y - startY;
    const rot = dx / 12;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    likeBadge.style.opacity = Math.min(Math.max(dx / 80, 0), 1);
    nopeBadge.style.opacity = Math.min(Math.max(-dx / 80, 0), 1);
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    card.style.transition = "transform 0.3s ease";
    if (dx > 100) {
      flyOut(card, 1);
      isAd ? dismissAd() : swipeTop(true);
    } else if (dx < -100) {
      flyOut(card, -1);
      isAd ? dismissAd() : swipeTop(false);
    } else {
      card.style.transform = "";
      likeBadge.style.opacity = 0;
      nopeBadge.style.opacity = 0;
    }
    dx = 0;
  };

  card.addEventListener("pointerdown", (e) => {
    card.setPointerCapture(e.pointerId);
    onDown(e.clientX, e.clientY);
  });
  card.addEventListener("pointermove", (e) => onMove(e.clientX, e.clientY));
  card.addEventListener("pointerup", onUp);
  card.addEventListener("pointercancel", onUp);
}

function flyOut(card, dir) {
  card.style.transition = "transform 0.4s ease";
  card.style.transform = `translate(${dir * 600}px, -40px) rotate(${dir * 30}deg)`;
}

let swiping = false;
async function swipeTop(liked) {
  if (swiping || state.deck.length === 0 || state.deck[0]._ad) return;
  swiping = true;
  const person = state.deck.shift();
  try {
    const res = await api("/api/swipe", { method: "POST", body: { targetId: person.id, liked } });
    if (res.match) {
      state.lastSwiped = null; // can't undo a swipe that just created a match
      showMatchToast(person);
    } else {
      state.lastSwiped = { person, liked };
      render();
    }
  } catch (err) {
    render();
  }
  swiping = false;
}

async function undoSwipe() {
  if (!state.lastSwiped || swiping) return;
  swiping = true;
  const { person } = state.lastSwiped;
  try {
    await api(`/api/swipe/${person.id}`, { method: "DELETE" });
    state.deck.unshift(person);
    state.lastSwiped = null;
  } catch (err) {
    // most likely: a match already formed in the meantime, can't undo
  }
  swiping = false;
  render();
}

function showMatchToast(person) {
  const toast = document.createElement("div");
  toast.className = "match-toast";
  toast.innerHTML = `
    <h1 class="brand">MATCH!</h1>
    <div class="avatars">
      <div class="avatar" style="${state.user.photo_url ? `background-image:url(${state.user.photo_url})` : ""}">${state.user.photo_url ? "" : "🙂"}</div>
      <div class="avatar" style="${person.photo_url ? `background-image:url(${person.photo_url})` : ""}">${person.photo_url ? "" : "🙂"}</div>
    </div>
    <p>Du und ${escapeHtml(person.name)} habt euch gematcht.</p>
    <button class="btn-primary" id="say-hi">Schreib was</button>
    <button class="btn-ghost" id="keep-swiping">Weiterswipen</button>
  `;
  document.body.appendChild(toast);
  toast.querySelector("#keep-swiping").onclick = () => {
    toast.remove();
    render();
  };
  toast.querySelector("#say-hi").onclick = async () => {
    toast.remove();
    await loadMatches();
    const m = state.matches.find((m) => m.other.id === person.id);
    if (m) openChat(m);
    else render();
  };
}

// ================= MELDEN / BLOCKIEREN =================
let reportReasonsCache = null;
async function getReportReasons() {
  if (reportReasonsCache) return reportReasonsCache;
  try {
    reportReasonsCache = await api("/api/report/reasons", { auth: false });
  } catch {
    reportReasonsCache = [
      "Unangemessene Inhalte",
      "Belästigung",
      "Fake-Profil / Betrug",
      "Minderjährig",
      "Sonstiges",
    ];
  }
  return reportReasonsCache;
}

async function showReportBlockMenu(person, { onBlocked } = {}) {
  const reasons = await getReportReasons();
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  const close = () => overlay.remove();

  function renderMenu() {
    overlay.innerHTML = `
      <div class="sheet-box">
        <h3>${escapeHtml(person.name || "Nutzer:in")}</h3>
        <button class="btn-secondary" id="report-btn">🚩 Melden</button>
        <button class="btn-secondary" id="block-btn" style="color: var(--danger); border-color: var(--danger);">🚫 Blockieren</button>
        <button class="btn-ghost" id="cancel-btn">Abbrechen</button>
      </div>
    `;
    overlay.querySelector("#cancel-btn").onclick = close;
    overlay.querySelector("#report-btn").onclick = renderReportForm;
    overlay.querySelector("#block-btn").onclick = async () => {
      if (!confirm(`${person.name || "Diese Person"} wirklich blockieren? Ihr seht euch danach gegenseitig nicht mehr.`)) return;
      try {
        await api(`/api/block/${person.id}`, { method: "POST" });
        close();
        if (onBlocked) onBlocked();
      } catch (err) {
        alert(err.message);
      }
    };
  }

  function renderReportForm() {
    overlay.innerHTML = `
      <div class="sheet-box">
        <h3>${escapeHtml(person.name || "Nutzer:in")} melden</h3>
        <div class="field">
          <label>Grund</label>
          <select id="report-reason">
            ${reasons.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Zusätzliche Infos (optional)</label>
          <textarea id="report-message" rows="3"></textarea>
        </div>
        <div id="report-error"></div>
        <button class="btn-primary" id="submit-report-btn">Meldung senden</button>
        <button class="btn-ghost" id="back-btn">Zurück</button>
      </div>
    `;
    overlay.querySelector("#back-btn").onclick = renderMenu;
    overlay.querySelector("#submit-report-btn").onclick = async () => {
      const errEl = overlay.querySelector("#report-error");
      errEl.innerHTML = "";
      try {
        await api("/api/report", {
          method: "POST",
          body: {
            targetId: person.id,
            reason: overlay.querySelector("#report-reason").value,
            message: overlay.querySelector("#report-message").value.trim(),
          },
        });
        overlay.innerHTML = `
          <div class="sheet-box">
            <p class="info-msg">Danke, deine Meldung wurde gesendet ✓</p>
            <button class="btn-secondary" id="done-btn">Schließen</button>
          </div>
        `;
        overlay.querySelector("#done-btn").onclick = close;
      } catch (err) {
        errEl.innerHTML = `<div class="error-msg">${escapeHtml(err.message)}</div>`;
      }
    };
  }

  renderMenu();
  document.body.appendChild(overlay);
}

// ================= MATCHES =================
async function loadMatches() {
  state.matches = await api("/api/matches");
}

function renderMatches(view) {
  if (state.matches.length === 0) {
    view.innerHTML = `
      <div class="empty-state">
        <div class="emoji">💌</div>
        <h3>Noch keine Matches</h3>
        <p>Geh zu "Entdecken" und finde deine Leute.</p>
      </div>
    `;
    return;
  }

  const searchWrap = document.createElement("div");
  searchWrap.style.marginBottom = "14px";
  searchWrap.innerHTML = `<input type="text" id="match-search" placeholder="Nach Namen suchen…" value="${escapeHtml(state.matchSearch)}" />`;
  view.appendChild(searchWrap);

  const listContainer = document.createElement("div");
  view.appendChild(listContainer);
  renderMatchList(listContainer);

  searchWrap.querySelector("#match-search").oninput = (e) => {
    state.matchSearch = e.target.value;
    renderMatchList(listContainer);
  };
}

function renderMatchList(list) {
  list.innerHTML = "";
  const q = state.matchSearch.trim().toLowerCase();
  const filtered = q
    ? state.matches.filter((m) => m.other.name.toLowerCase().includes(q))
    : state.matches;

  if (filtered.length === 0) {
    list.innerHTML = `<p style="color: var(--text-dim); font-size: 14px;">Keine Matches mit diesem Namen gefunden.</p>`;
    return;
  }

  filtered.forEach((m) => {
    const row = document.createElement("div");
    row.className = "match-row";
    row.innerHTML = `
      <div class="avatar" style="${m.other.photo_url ? `background-image:url(${m.other.photo_url})` : ""}">${m.other.photo_url ? "" : "🙂"}</div>
      <div>
        <div class="name">${escapeHtml(m.other.name)}</div>
        <div class="preview">${m.lastMessage ? escapeHtml(m.lastMessage.body) : "Sag Hallo 👋"}</div>
      </div>
    `;
    row.onclick = () => openChat(m);
    list.appendChild(row);
  });
  view.appendChild(list);
}

function openChat(m) {
  state.activeChat = { matchId: m.matchId, other: m.other };
  state.tab = "chat";
  render();
  loadChatMessages();
}

// ================= CHAT =================
let chatPoll = null;

async function loadChatMessages() {
  if (!state.activeChat) return;
  state.chatMessages = await api(`/api/matches/${state.activeChat.matchId}/messages`);
  const list = document.getElementById("chat-messages");
  if (list) {
    list.innerHTML = state.chatMessages
      .map(
        (msg) =>
          `<div class="msg ${msg.sender_id === state.user.id ? "mine" : "theirs"}">${escapeHtml(msg.body)}</div>`
      )
      .join("");
    list.scrollTop = list.scrollHeight;
  }
}

function renderChat(view) {
  view.style.padding = "0";
  clearInterval(chatPoll);
  const other = state.activeChat.other;
  view.innerHTML = `
    <div class="chat-view">
      <div class="chat-header">
        <button class="btn-ghost" id="back-btn">←</button>
        <div class="avatar" style="${other.photo_url ? `background-image:url(${other.photo_url})` : ""}">${other.photo_url ? "" : "🙂"}</div>
        <div class="name">${escapeHtml(other.name)}</div>
        <button class="btn-ghost" id="chat-menu-btn" style="margin-left:auto; font-size:20px; padding:4px 10px;">⋯</button>
      </div>
      <div class="chat-messages" id="chat-messages"><div class="loading">Lädt…</div></div>
      <form class="chat-input" id="chat-form">
        <input type="text" id="chat-text" placeholder="Nachricht…" autocomplete="off" />
        <button type="submit">Senden</button>
      </form>
    </div>
  `;
  view.querySelector("#back-btn").onclick = () => {
    clearInterval(chatPoll);
    state.tab = "matches";
    render();
  };
  view.querySelector("#chat-menu-btn").onclick = () => {
    showReportBlockMenu(other, {
      onBlocked: () => {
        clearInterval(chatPoll);
        state.tab = "matches";
        render();
      },
    });
  };
  view.querySelector("#chat-form").onsubmit = async (e) => {
    e.preventDefault();
    const input = view.querySelector("#chat-text");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    await api(`/api/matches/${state.activeChat.matchId}/messages`, {
      method: "POST",
      body: { body: text },
    });
    await loadChatMessages();
  };
  loadChatMessages();
  chatPoll = setInterval(loadChatMessages, 3000);
}

// ================= PROFILE =================
function renderProfile(view) {
  const u = state.user;
  view.innerHTML = `
    <div class="beta-notice">
      🚧 TRIBE ist noch am Anfang — es kann zu Bugs oder Änderungen kommen, und es gibt laufend Updates. Vorschläge und Feedback sind jederzeit herzlich willkommen unter
      <a href="mailto:tribeapp.support@gmail.com" style="color:var(--accent2);">tribeapp.support@gmail.com</a>.
    </div>
    <div class="profile-photo-upload" id="photo-upload" style="${u.photo_url ? `background-image:url(${u.photo_url})` : ""}">
      ${u.photo_url ? "" : "📷"}
    </div>
    <input type="file" id="photo-input-camera" accept="image/*" capture="environment" style="display:none" />
    <input type="file" id="photo-input-gallery" accept="image/*" style="display:none" />

    <div id="premium-box"></div>

    <div class="field"><label>Name</label><input type="text" id="name-input" value="${escapeHtml(u.name)}" /></div>
    <div class="field" style="margin-top:12px;"><label>Stadt / Region / Land</label><input type="text" id="location-input" value="${escapeHtml(u.location || "")}" placeholder="z.B. Wien, Österreich" /></div>
    <div class="field" style="margin-top:12px;"><label>Bio</label><textarea id="bio-input" rows="3">${escapeHtml(u.bio || "")}</textarea></div>

    <div class="section-title">Wie du dich präsentierst</div>
    <div id="identity-picker"></div>

    <div class="section-title">Wonach du suchst</div>
    <div id="seeking-picker"></div>

    <button type="button" id="open-to-new-btn" class="tag-chip${u.open_to_new ? " selected" : ""}" style="margin-top:8px; width:100%; text-align:left;">
      🌈 Offen für Neues ${u.open_to_new ? "✓" : ""}
    </button>
    <p style="font-size:12px; color:var(--text-dim); margin:6px 0 0;">
      Noch unsicher, was dir gefällt? Aktivier das, damit dir beim Entdecken auch Leute außerhalb deiner Auswahl oben gezeigt werden — zum Ausprobieren.
    </p>

    <div class="section-title">Altersspanne, die du sehen willst</div>
    <div style="display:flex; gap:10px; align-items:center;">
      <input type="number" id="age-min-input" min="18" max="99" value="${u.seek_age_min ?? 18}" style="width:90px;" /> bis
      <input type="number" id="age-max-input" min="18" max="99" value="${u.seek_age_max ?? 99}" style="width:90px;" />
    </div>

    <button class="btn-primary" id="save-btn" style="margin-top:24px; width:100%;">Speichern</button>
    <div id="profile-msg" style="margin-top:12px;"></div>

    <div class="section-title">Blockierte Nutzer:innen</div>
    <div id="blocked-box"></div>

    <div class="section-title">Hilfe & Support</div>
    <div id="support-box"></div>
  `;

  renderPremiumBox(view.querySelector("#premium-box"));
  renderBlockedBox(view.querySelector("#blocked-box"));
  renderSupportBox(view.querySelector("#support-box"));

  const identitySel = new Set(u.identity.map((t) => t.id));
  const seekingSel = new Set(u.seeking.map((t) => t.id));
  renderGroupedTagPicker(view.querySelector("#identity-picker"), identitySel);
  renderGroupedTagPicker(view.querySelector("#seeking-picker"), seekingSel, { seekingMode: true });

  let openToNew = !!u.open_to_new;
  const openToNewBtn = view.querySelector("#open-to-new-btn");
  openToNewBtn.onclick = () => {
    openToNew = !openToNew;
    openToNewBtn.classList.toggle("selected", openToNew);
    openToNewBtn.innerHTML = `🌈 Offen für Neues ${openToNew ? "✓" : ""}`;
  };

  const handlePhotoFile = async (file) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    const msg = view.querySelector("#profile-msg");
    try {
      const res = await api("/api/me/photo", { method: "POST", body: { dataUrl } });
      state.user.photo_url = res.photo_url;
      render();
    } catch (err) {
      msg.innerHTML = `<div class="error-msg">${escapeHtml(err.message)}</div>`;
    }
  };
  view.querySelector("#photo-input-camera").onchange = (e) => handlePhotoFile(e.target.files[0]);
  view.querySelector("#photo-input-gallery").onchange = (e) => handlePhotoFile(e.target.files[0]);
  view.querySelector("#photo-upload").onclick = () => {
    const overlay = document.createElement("div");
    overlay.className = "sheet-overlay";
    overlay.innerHTML = `
      <div class="sheet-box">
        <h3>Profilfoto</h3>
        <button class="btn-secondary" id="take-photo-btn">📷 Foto aufnehmen</button>
        <button class="btn-secondary" id="choose-photo-btn">🖼️ Aus Galerie wählen</button>
        <button class="btn-ghost" id="cancel-photo-btn">Abbrechen</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#cancel-photo-btn").onclick = () => overlay.remove();
    overlay.querySelector("#take-photo-btn").onclick = () => {
      overlay.remove();
      view.querySelector("#photo-input-camera").click();
    };
    overlay.querySelector("#choose-photo-btn").onclick = () => {
      overlay.remove();
      view.querySelector("#photo-input-gallery").click();
    };
  };

  view.querySelector("#save-btn").onclick = async () => {
    const msg = view.querySelector("#profile-msg");
    msg.innerHTML = "";
    try {
      await api("/api/me", {
        method: "PUT",
        body: {
          name: view.querySelector("#name-input").value.trim(),
          bio: view.querySelector("#bio-input").value.trim(),
          location: view.querySelector("#location-input").value.trim(),
        },
      });
      const updated = await api("/api/me/tags", {
        method: "PUT",
        body: {
          identity: [...identitySel],
          seeking: [...seekingSel],
          openToNew,
          seekAgeMin: view.querySelector("#age-min-input").value,
          seekAgeMax: view.querySelector("#age-max-input").value,
        },
      });
      state.user = updated;
      state.deck = []; // force refresh next time discover is opened
      msg.innerHTML = `<div class="info-msg">Gespeichert ✓</div>`;
    } catch (err) {
      msg.innerHTML = `<div class="error-msg">${escapeHtml(err.message)}</div>`;
    }
  };
}

async function renderPremiumBox(box) {
  const u = state.user;
  box.style.background = "var(--card)";
  box.style.border = "1px solid var(--border)";
  box.style.borderRadius = "16px";
  box.style.padding = "16px";
  box.style.marginBottom = "20px";

  let live = false;
  try {
    const info = await api("/api/premium/info", { auth: false });
    live = !!info.live;
  } catch {}

  if (u.premium) {
    const until = u.premium_until ? new Date(u.premium_until).toLocaleDateString("de-DE") : "";
    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong style="color: var(--accent3);">✓ TRIBE Premium aktiv</strong>
          <div class="preview">Werbefrei bis ${until}${live ? "" : " (Demo, kein echtes Geld)"}</div>
        </div>
        <button class="btn-ghost" id="cancel-premium">Kündigen</button>
      </div>
    `;
    box.querySelector("#cancel-premium").onclick = async () => {
      const msg = box;
      try {
        if (live) {
          const { url } = await api("/api/billing-portal", { method: "POST" });
          window.location.href = url;
        } else {
          state.user = await api("/api/unsubscribe", { method: "POST" });
          state.deck = [];
          render();
        }
      } catch (err) {
        alert(err.message);
      }
    };
  } else {
    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
        <div>
          <strong>TRIBE Premium</strong>
          <div class="preview">Werbefrei, ${PREMIUM_PRICE.toFixed(2)} €/Monat${live ? "" : " (Demo, kein echtes Geld)"}</div>
        </div>
        <button class="btn-primary" id="buy-premium" style="white-space:nowrap;">Upgraden</button>
      </div>
    `;
    box.querySelector("#buy-premium").onclick = async () => {
      try {
        if (live) {
          const { url } = await api("/api/checkout/subscribe", { method: "POST" });
          window.location.href = url;
        } else {
          state.user = await api("/api/subscribe", { method: "POST" });
          state.deck = [];
          render();
        }
      } catch (err) {
        alert(err.message);
      }
    };
  }
}

async function renderBlockedBox(box) {
  box.innerHTML = `<div class="loading">Lädt…</div>`;
  try {
    const blocked = await api("/api/blocked");
    if (blocked.length === 0) {
      box.innerHTML = `<p class="preview">Du hast niemanden blockiert.</p>`;
      return;
    }
    box.innerHTML = blocked
      .map(
        (u) => `
      <div class="match-row" data-id="${u.id}">
        <div class="avatar" style="${u.photo_url ? `background-image:url(${u.photo_url})` : ""}">${u.photo_url ? "" : "🙂"}</div>
        <div style="flex:1;"><div class="name">${escapeHtml(u.name)}</div></div>
        <button class="btn-ghost unblock-btn">Entblocken</button>
      </div>
    `
      )
      .join("");
    box.querySelectorAll(".unblock-btn").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.closest(".match-row").dataset.id;
        await api(`/api/block/${id}`, { method: "DELETE" });
        renderBlockedBox(box);
      };
    });
  } catch {
    box.innerHTML = `<p class="preview">Blockierte Nutzer konnten nicht geladen werden.</p>`;
  }
}

async function renderSupportBox(box) {
  box.innerHTML = `
    <form id="support-form" class="field" style="gap:10px;">
      <input type="text" id="support-subject" placeholder="Betreff" required />
      <textarea id="support-message" rows="3" placeholder="Wie können wir helfen?" required></textarea>
      <button class="btn-secondary" type="submit">Ticket senden</button>
    </form>
    <div id="support-msg" style="margin:10px 0;"></div>
    <div id="support-tickets"></div>
  `;

  box.querySelector("#support-form").onsubmit = async (e) => {
    e.preventDefault();
    const msg = box.querySelector("#support-msg");
    msg.innerHTML = "";
    try {
      await api("/api/support", {
        method: "POST",
        body: {
          subject: box.querySelector("#support-subject").value.trim(),
          message: box.querySelector("#support-message").value.trim(),
        },
      });
      box.querySelector("#support-form").reset();
      msg.innerHTML = `<div class="info-msg">Ticket gesendet ✓ – wir melden uns per E-Mail.</div>`;
      await loadAndRenderTickets(box);
    } catch (err) {
      msg.innerHTML = `<div class="error-msg">${escapeHtml(err.message)}</div>`;
    }
  };

  await loadAndRenderTickets(box);
}

async function loadAndRenderTickets(box) {
  const ticketsEl = box.querySelector("#support-tickets");
  try {
    const tickets = await api("/api/support/mine");
    if (tickets.length === 0) {
      ticketsEl.innerHTML = "";
      return;
    }
    ticketsEl.innerHTML =
      `<div class="section-title">Deine Tickets</div>` +
      tickets
        .map(
          (t) => `
        <div class="match-row" style="align-items:flex-start;">
          <div style="flex:1;">
            <div class="name">${escapeHtml(t.subject)} <span class="preview">(${t.status === "open" ? "offen" : "geschlossen"})</span></div>
            <div class="preview">${escapeHtml(t.message)}</div>
            ${t.reply ? `<div class="info-msg" style="margin-top:6px;">Antwort: ${escapeHtml(t.reply)}</div>` : ""}
          </div>
        </div>
      `
        )
        .join("");
  } catch {
    ticketsEl.innerHTML = "";
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- utils ----------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------- boot ----------
async function boot() {
  $app.innerHTML = `<div class="loading">Lädt…</div>`;
  try {
    state.categories = await api("/api/categories", { auth: false });
  } catch (e) {
    $app.innerHTML = `<div class="loading">Backend nicht erreichbar. Läuft der Server?</div>`;
    return;
  }
  if (state.token) {
    try {
      state.user = await api("/api/me");
      await loadDeck();
      await confirmCheckoutIfReturning();
    } catch (e) {
      state.token = null;
      state.user = null;
      localStorage.removeItem("tribe_token");
    }
  }
  render();
}

// After Stripe Checkout redirects back with ?checkout=success&session_id=...,
// confirm the payment right away instead of waiting for a webhook (handy for
// local setups without a public URL). Cleans the params off the address bar either way.
async function confirmCheckoutIfReturning() {
  const params = new URLSearchParams(window.location.search);
  const checkout = params.get("checkout");
  const sessionId = params.get("session_id");
  if (checkout === "success" && sessionId) {
    try {
      const result = await api("/api/checkout/confirm", { method: "POST", body: { sessionId } });
      if (result.premium) {
        state.user = await api("/api/me");
      }
    } catch (e) {
      // fall through — user just won't see the instant confirmation
    }
  }
  if (checkout) {
    window.history.replaceState({}, "", window.location.pathname);
  }
}

boot();
