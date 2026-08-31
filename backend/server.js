// Zero-dependency backend: pure Node.js (http, node:sqlite, node:crypto).
// No `npm install` needed — just run: node server.js
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
// UPLOAD_DIR lets a hosting platform point this at a persistent volume
// (e.g. Railway: UPLOAD_DIR=/data/uploads) so profile photos survive
// restarts and redeploys instead of living inside the throwaway app folder.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const PORT = process.env.PORT || 4000;
const SECRET = process.env.SECRET || crypto.randomBytes(32).toString("hex");
const MAX_BODY = 8 * 1024 * 1024; // 8MB, enough for a compressed profile photo

const ADMIN_KEY = process.env.ADMIN_KEY || crypto.randomBytes(16).toString("hex");
if (!process.env.ADMIN_KEY) {
  console.log(`\nKein ADMIN_KEY gesetzt — temporärer Schlüssel für diese Sitzung:\n  ${ADMIN_KEY}\nÖffne /admin.html und gib diesen Schlüssel ein, um Support-Tickets und Werbebuchungen zu verwalten.\nFür einen dauerhaften Schlüssel: Umgebungsvariable ADMIN_KEY setzen.\n`);
}

function isAdmin(req) {
  const key = req.headers["x-admin-key"];
  if (!key) return false;
  const a = Buffer.from(String(key));
  const b = Buffer.from(ADMIN_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- Stripe (real payments) ----------
// Implemented with plain HTTPS calls to the Stripe REST API — no `stripe`
// npm package needed, so the zero-dependency promise still holds. Stripe is
// entirely OPTIONAL: as long as STRIPE_SECRET_KEY is unset, the app falls
// back to the old simulated /api/subscribe (no real card charged) so it
// keeps working for local testing. Set these env vars to go live:
//   STRIPE_SECRET_KEY     sk_live_... (or sk_test_... while testing)
//   STRIPE_WEBHOOK_SECRET whsec_...   (from the Stripe webhook settings)
//   APP_URL               the public https URL the app is reachable at
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`;
const STRIPE_ENABLED = !!STRIPE_SECRET_KEY;
const AD_PRICE_EUR = Number(process.env.AD_PRICE_EUR || 49);
const AD_DURATION_DAYS = Number(process.env.AD_DURATION_DAYS || 14);

if (!STRIPE_ENABLED) {
  console.log(
    "\nHinweis: STRIPE_SECRET_KEY ist nicht gesetzt — Zahlungen laufen im Demo-Modus (kein echtes Geld). Siehe README für die Einrichtung.\n"
  );
}

function toStripeParams(obj, prefix = "") {
  const params = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const paramKey = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object" && !Array.isArray(value)) {
      params.push(...toStripeParams(value, paramKey));
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === "object") params.push(...toStripeParams(item, `${paramKey}[${i}]`));
        else params.push([`${paramKey}[${i}]`, String(item)]);
      });
    } else {
      params.push([paramKey, String(value)]);
    }
  }
  return params;
}

async function stripeRequest(endpoint, params) {
  const body = new URLSearchParams(toStripeParams(params));
  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(STRIPE_SECRET_KEY + ":").toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error?.message || "Stripe-Fehler"), { status: 400 });
  return data;
}

async function stripeGet(endpoint) {
  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    headers: { Authorization: "Basic " + Buffer.from(STRIPE_SECRET_KEY + ":").toString("base64") },
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error?.message || "Stripe-Fehler"), { status: 400 });
  return data;
}

function verifyStripeSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(signatureHeader.split(",").map((p) => p.split("=")));
  const timestamp = parts.t;
  const sig = parts.v1;
  if (!timestamp || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false; // 5 min tolerance
  const expected = crypto
    .createHmac("sha256", STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- tiny helpers ----------
function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(check, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function signToken(payload) {
  const body = { ...payload, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 };
  const payloadB64 = b64url(JSON.stringify(body));
  const sig = b64url(crypto.createHmac("sha256", SECRET).update(payloadB64).digest());
  return `${payloadB64}.${sig}`;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payloadB64, sig] = token.split(".");
  const expected = b64url(crypto.createHmac("sha256", SECRET).update(payloadB64).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
  if (payload.exp < Date.now()) return null;
  return payload;
}

function age(birthdate) {
  const b = new Date(birthdate);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Payload too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Invalid JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function getUserId(req) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = verifyToken(token);
  return payload ? payload.id : null;
}

// ---------- data helpers ----------
function getTags(userId, table) {
  return db
    .prepare(
      `SELECT c.id, c.name FROM ${table} t JOIN categories c ON c.id = t.category_id WHERE t.user_id = ? ORDER BY c.name`
    )
    .all(userId);
}

function setTags(userId, table, categoryIds) {
  db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
  const ins = db.prepare(`INSERT OR IGNORE INTO ${table} (user_id, category_id) VALUES (?, ?)`);
  for (const id of Array.isArray(categoryIds) ? categoryIds : []) {
    ins.run(userId, Number(id));
  }
}

const PREMIUM_PRICE_EUR = 4.99;
const PREMIUM_DAYS = 30;

function isPremium(u) {
  return !!u.premium_until && new Date(u.premium_until).getTime() > Date.now();
}

function publicUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return {
    ...rest,
    age: age(u.birthdate),
    identity: getTags(u.id, "user_identity_tags"),
    seeking: getTags(u.id, "user_seeking_tags"),
    premium: isPremium(u),
  };
}

function assertParticipant(matchId, userId) {
  const m = db.prepare("SELECT * FROM matches WHERE id = ?").get(matchId);
  if (!m || (m.user_a_id !== userId && m.user_b_id !== userId)) return null;
  return m;
}

// ---------- report / block ----------
const REPORT_REASONS = [
  "Unangemessene Inhalte",
  "Belästigung",
  "Fake-Profil / Betrug",
  "Minderjährig",
  "Sonstiges",
];

function isBlocked(a, b) {
  return !!db
    .prepare(
      "SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)"
    )
    .get(a, b, b, a);
}

// ---------- route handlers ----------
const routes = [];
function route(method, pattern, handler) {
  const keys = [];
  const regex = new RegExp(
    "^" + pattern.replace(/:[^/]+/g, (m) => {
      keys.push(m.slice(1));
      return "([^/]+)";
    }) + "$"
  );
  routes.push({ method, regex, keys, handler });
}

function clampAge(n, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(99, Math.max(18, Math.round(v)));
}

route("POST", "/api/auth/register", async (req, res, params, body) => {
  const { email, password, name, birthdate, identity, seeking, location, seekAgeMin, seekAgeMax } = body;
  if (!email || !password || !name || !birthdate) {
    return send(res, 400, { error: "email, password, name, birthdate required" });
  }
  if (age(birthdate) < 18) {
    return send(res, 400, { error: "Du musst mindestens 18 Jahre alt sein" });
  }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    return send(res, 409, { error: "E-Mail bereits registriert" });
  }
  const password_hash = hashPassword(password);
  const ageMin = clampAge(seekAgeMin, 18);
  const ageMax = clampAge(seekAgeMax, 99);
  const info = db
    .prepare(
      "INSERT INTO users (email, password_hash, name, birthdate, location, seek_age_min, seek_age_max) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(email, password_hash, name, birthdate, location || "", Math.min(ageMin, ageMax), Math.max(ageMin, ageMax));
  const userId = Number(info.lastInsertRowid);
  if (identity) setTags(userId, "user_identity_tags", identity);
  if (seeking) setTags(userId, "user_seeking_tags", seeking);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  send(res, 200, { token: signToken({ id: userId }), user: publicUser(user) });
});

route("POST", "/api/auth/login", async (req, res, params, body) => {
  const { email, password } = body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return send(res, 401, { error: "E-Mail oder Passwort falsch" });
  }
  send(res, 200, { token: signToken({ id: user.id }), user: publicUser(user) });
});

route("GET", "/api/categories", async (req, res) => {
  send(res, 200, db.prepare("SELECT id, name, type FROM categories ORDER BY type, name").all());
});

route("GET", "/api/me", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  send(res, 200, publicUser(user));
});

route("PUT", "/api/me", async (req, res, params, body) => {
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  const { name, bio, location } = body;
  const current = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  db.prepare("UPDATE users SET name = ?, bio = ?, location = ? WHERE id = ?").run(
    name ?? current.name,
    bio ?? current.bio,
    location ?? current.location,
    userId
  );
  send(res, 200, publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(userId)));
});

route("PUT", "/api/me/tags", async (req, res, params, body) => {
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  const { identity, seeking, seekAgeMin, seekAgeMax } = body;
  if (identity !== undefined) setTags(userId, "user_identity_tags", identity);
  if (seeking !== undefined) setTags(userId, "user_seeking_tags", seeking);
  if (seekAgeMin !== undefined || seekAgeMax !== undefined) {
    const current = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const min = clampAge(seekAgeMin, current.seek_age_min);
    const max = clampAge(seekAgeMax, current.seek_age_max);
    db.prepare("UPDATE users SET seek_age_min = ?, seek_age_max = ? WHERE id = ?").run(
      Math.min(min, max),
      Math.max(min, max),
      userId
    );
  }
  send(res, 200, publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(userId)));
});

route("POST", "/api/me/photo", async (req, res, params, body) => {
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  const { dataUrl } = body;
  const match = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/.exec(dataUrl || "");
  if (!match) return send(res, 400, { error: "Ungültiges Bildformat" });
  const ext = match[2] === "jpeg" ? "jpg" : match[2];
  const buf = Buffer.from(match[3], "base64");
  const filename = `user_${userId}_${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
  const url = `/uploads/${filename}`;
  db.prepare("UPDATE users SET photo_url = ? WHERE id = ?").run(url, userId);
  send(res, 200, { photo_url: url });
});

route("GET", "/api/discover", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });

  const me = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  const myAge = age(me.birthdate);
  const mySeeking = getTags(userId, "user_seeking_tags").map((t) => t.id);
  const myIdentity = getTags(userId, "user_identity_tags").map((t) => t.id);
  const overlaps = (a, b) => a.some((x) => b.includes(x));

  let candidates = db
    .prepare(
      `SELECT id, name, birthdate, bio, photo_url, location, seek_age_min, seek_age_max FROM users
       WHERE id != ?
       AND id NOT IN (SELECT target_id FROM swipes WHERE swiper_id = ?)
       AND id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
       AND id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?)`
    )
    .all(userId, userId, userId, userId);

  candidates = candidates
    .map((c) => ({
      ...c,
      age: age(c.birthdate),
      identity: getTags(c.id, "user_identity_tags"),
      seekingIds: getTags(c.id, "user_seeking_tags").map((t) => t.id),
    }))
    .filter((c) => {
      const cIdentityIds = c.identity.map((t) => t.id);
      const passesMyTagFilter = mySeeking.length === 0 || overlaps(mySeeking, cIdentityIds);
      const passesTheirTagFilter = c.seekingIds.length === 0 || overlaps(c.seekingIds, myIdentity);
      // age range is reciprocal too: they must fall in my range, and I must fall in theirs
      const passesMyAgeFilter = c.age >= me.seek_age_min && c.age <= me.seek_age_max;
      const passesTheirAgeFilter = myAge >= c.seek_age_min && myAge <= c.seek_age_max;
      return passesMyTagFilter && passesTheirTagFilter && passesMyAgeFilter && passesTheirAgeFilter;
    })
    .sort(() => Math.random() - 0.5)
    .slice(0, 30)
    .map(({ seekingIds, seek_age_min, seek_age_max, ...c }) => c);

  send(res, 200, candidates);
});

route("POST", "/api/swipe", async (req, res, params, body) => {
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  const targetId = Number(body.targetId);
  const liked = !!body.liked;
  if (!targetId) return send(res, 400, { error: "targetId erforderlich" });
  const target = db.prepare("SELECT id FROM users WHERE id = ?").get(targetId);
  if (!target) return send(res, 404, { error: "Nutzer nicht gefunden" });

  db.prepare(
    "INSERT OR REPLACE INTO swipes (swiper_id, target_id, liked) VALUES (?, ?, ?)"
  ).run(userId, targetId, liked ? 1 : 0);

  let match = null;
  if (liked) {
    const reciprocal = db
      .prepare("SELECT * FROM swipes WHERE swiper_id = ? AND target_id = ? AND liked = 1")
      .get(targetId, userId);
    if (reciprocal) {
      const a = Math.min(userId, targetId);
      const b = Math.max(userId, targetId);
      db.prepare(
        "INSERT OR IGNORE INTO matches (user_a_id, user_b_id) VALUES (?, ?)"
      ).run(a, b);
      match = db.prepare("SELECT * FROM matches WHERE user_a_id = ? AND user_b_id = ?").get(a, b);
    }
  }
  send(res, 200, { match });
});

// Rewind: undo the swipe you just made, as long as it hasn't already turned
// into a match (protects existing matches/conversations from being wiped).
route("DELETE", "/api/swipe/:targetId", async (req, res, params) => {
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  const targetId = Number(params.targetId);

  const a = Math.min(userId, targetId);
  const b = Math.max(userId, targetId);
  const existingMatch = db.prepare("SELECT id FROM matches WHERE user_a_id = ? AND user_b_id = ?").get(a, b);
  if (existingMatch) {
    return send(res, 409, { error: "Ihr seid schon gematcht, das kann nicht rückgängig gemacht werden" });
  }

  db.prepare("DELETE FROM swipes WHERE swiper_id = ? AND target_id = ?").run(userId, targetId);
  send(res, 200, { ok: true });
});

route("GET", "/api/matches", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });

  const rows = db
    .prepare(
      `SELECT m.id as match_id, m.created_at,
              CASE WHEN m.user_a_id = ? THEN m.user_b_id ELSE m.user_a_id END as other_id
       FROM matches m
       WHERE m.user_a_id = ? OR m.user_b_id = ?
       ORDER BY m.created_at DESC`
    )
    .all(userId, userId, userId);

  const result = rows
    .filter((r) => !isBlocked(userId, r.other_id))
    .map((r) => {
      const other = db.prepare("SELECT id, name, photo_url FROM users WHERE id = ?").get(r.other_id);
      const lastMsg = db
        .prepare("SELECT body, created_at FROM messages WHERE match_id = ? ORDER BY created_at DESC LIMIT 1")
        .get(r.match_id);
      return { matchId: r.match_id, createdAt: r.created_at, other, lastMessage: lastMsg || null };
    });
  send(res, 200, result);
});

route("GET", "/api/matches/:id/messages", async (req, res, params) => {
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  const matchId = Number(params.id);
  if (!assertParticipant(matchId, userId)) return send(res, 403, { error: "Kein Zugriff" });
  send(res, 200, db.prepare("SELECT * FROM messages WHERE match_id = ? ORDER BY created_at ASC").all(matchId));
});

route("POST", "/api/matches/:id/messages", async (req, res, params, body) => {
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  const matchId = Number(params.id);
  const m = assertParticipant(matchId, userId);
  if (!m) return send(res, 403, { error: "Kein Zugriff" });
  const otherId = m.user_a_id === userId ? m.user_b_id : m.user_a_id;
  if (isBlocked(userId, otherId)) {
    return send(res, 403, { error: "Nachricht kann nicht gesendet werden" });
  }
  const text = (body.body || "").trim();
  if (!text) return send(res, 400, { error: "Nachricht darf nicht leer sein" });
  const info = db
    .prepare("INSERT INTO messages (match_id, sender_id, body) VALUES (?, ?, ?)")
    .run(matchId, userId, text);
  send(res, 200, db.prepare("SELECT * FROM messages WHERE id = ?").get(Number(info.lastInsertRowid)));
});

// ---------- report / block ----------
route("GET", "/api/report/reasons", async (req, res) => {
  send(res, 200, REPORT_REASONS);
});

route("POST", "/api/report", async (req, res, params, body) => {
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  const targetId = Number(body.targetId);
  const reason = (body.reason || "").trim();
  const message = (body.message || "").trim();
  if (!targetId) return send(res, 400, { error: "targetId erforderlich" });
  if (targetId === userId) return send(res, 400, { error: "Du kannst dich nicht selbst melden" });
  if (!REPORT_REASONS.includes(reason)) return send(res, 400, { error: "Ungültiger Grund" });
  const target = db.prepare("SELECT id FROM users WHERE id = ?").get(targetId);
  if (!target) return send(res, 404, { error: "Nutzer nicht gefunden" });
  db.prepare(
    "INSERT INTO reports (reporter_id, reported_id, reason, message) VALUES (?, ?, ?, ?)"
  ).run(userId, targetId, reason, message.slice(0, 2000));
  send(res, 200, { ok: true });
});

route("POST", "/api/block/:userId", async (req, res, params) => {
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  const targetId = Number(params.userId);
  if (!targetId || targetId === userId) return send(res, 400, { error: "Ungültiger Nutzer" });
  const target = db.prepare("SELECT id FROM users WHERE id = ?").get(targetId);
  if (!target) return send(res, 404, { error: "Nutzer nicht gefunden" });
  db.prepare("INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)").run(userId, targetId);
  send(res, 200, { ok: true });
});

route("DELETE", "/api/block/:userId", async (req, res, params) => {
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  const targetId = Number(params.userId);
  db.prepare("DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?").run(userId, targetId);
  send(res, 200, { ok: true });
});

route("GET", "/api/blocked", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.photo_url FROM blocks b JOIN users u ON u.id = b.blocked_id
       WHERE b.blocker_id = ? ORDER BY b.created_at DESC`
    )
    .all(userId);
  send(res, 200, rows);
});

route("GET", "/api/admin/reports", async (req, res) => {
  if (!isAdmin(req)) return send(res, 401, { error: "Ungültiger Admin-Schlüssel" });
  const rows = db
    .prepare(
      `SELECT r.*, ru.name as reporter_name, ru.email as reporter_email,
              tu.name as reported_name, tu.email as reported_email
       FROM reports r
       JOIN users ru ON ru.id = r.reporter_id
       JOIN users tu ON tu.id = r.reported_id
       ORDER BY r.created_at DESC`
    )
    .all();
  send(res, 200, rows);
});

route("PATCH", "/api/admin/reports/:id", async (req, res, params, body) => {
  if (!isAdmin(req)) return send(res, 401, { error: "Ungültiger Admin-Schlüssel" });
  const id = Number(params.id);
  const current = db.prepare("SELECT * FROM reports WHERE id = ?").get(id);
  if (!current) return send(res, 404, { error: "Meldung nicht gefunden" });
  db.prepare("UPDATE reports SET status = ? WHERE id = ?").run(body.status ?? current.status, id);
  send(res, 200, db.prepare("SELECT * FROM reports WHERE id = ?").get(id));
});

// ---------- support ----------
route("POST", "/api/support", async (req, res, params, body) => {
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  const subject = (body.subject || "").trim();
  const message = (body.message || "").trim();
  if (!subject || !message) return send(res, 400, { error: "Betreff und Nachricht erforderlich" });
  const user = db.prepare("SELECT email FROM users WHERE id = ?").get(userId);
  const info = db
    .prepare("INSERT INTO support_tickets (user_id, email, subject, message) VALUES (?, ?, ?, ?)")
    .run(userId, user.email, subject.slice(0, 200), message.slice(0, 4000));
  send(res, 200, db.prepare("SELECT * FROM support_tickets WHERE id = ?").get(Number(info.lastInsertRowid)));
});

route("GET", "/api/support/mine", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  send(
    res,
    200,
    db.prepare("SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC").all(userId)
  );
});

route("GET", "/api/admin/support", async (req, res) => {
  if (!isAdmin(req)) return send(res, 401, { error: "Ungültiger Admin-Schlüssel" });
  send(res, 200, db.prepare("SELECT * FROM support_tickets ORDER BY created_at DESC").all());
});

route("PATCH", "/api/admin/support/:id", async (req, res, params, body) => {
  if (!isAdmin(req)) return send(res, 401, { error: "Ungültiger Admin-Schlüssel" });
  const id = Number(params.id);
  const current = db.prepare("SELECT * FROM support_tickets WHERE id = ?").get(id);
  if (!current) return send(res, 404, { error: "Ticket nicht gefunden" });
  db.prepare("UPDATE support_tickets SET status = ?, reply = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
    body.status ?? current.status,
    body.reply ?? current.reply,
    id
  );
  send(res, 200, db.prepare("SELECT * FROM support_tickets WHERE id = ?").get(id));
});

// ---------- premium / ads ----------
route("GET", "/api/premium/info", async (req, res) => {
  send(res, 200, { priceEur: STRIPE_ENABLED ? PREMIUM_PRICE_EUR : PREMIUM_PRICE_EUR, days: PREMIUM_DAYS, live: STRIPE_ENABLED });
});

// ---- demo mode (no real card charged) — only meaningful while Stripe isn't configured ----
route("POST", "/api/subscribe", async (req, res) => {
  if (STRIPE_ENABLED) return send(res, 400, { error: "Zahlungen laufen über Stripe — nutze /api/checkout/subscribe" });
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  const base = isPremium(user) ? new Date(user.premium_until) : new Date();
  base.setDate(base.getDate() + PREMIUM_DAYS);
  db.prepare("UPDATE users SET premium_until = ? WHERE id = ?").run(base.toISOString(), userId);
  send(res, 200, publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(userId)));
});

route("POST", "/api/unsubscribe", async (req, res) => {
  if (STRIPE_ENABLED) return send(res, 400, { error: "Zahlungen laufen über Stripe — nutze /api/billing-portal" });
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  db.prepare("UPDATE users SET premium_until = NULL WHERE id = ?").run(userId);
  send(res, 200, publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(userId)));
});

// ---- real payments (Stripe) ----
route("POST", "/api/checkout/subscribe", async (req, res) => {
  if (!STRIPE_ENABLED) return send(res, 400, { error: "Stripe ist nicht konfiguriert" });
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

  const session = await stripeRequest("checkout/sessions", {
    mode: "subscription",
    client_reference_id: String(userId),
    customer: user.stripe_customer_id || undefined,
    customer_email: user.stripe_customer_id ? undefined : user.email,
    success_url: `${APP_URL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/?checkout=cancel`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: Math.round(PREMIUM_PRICE_EUR * 100),
          recurring: { interval: "month" },
          product_data: { name: "TRIBE Premium (werbefrei)" },
        },
      },
    ],
  });
  send(res, 200, { url: session.url });
});

// Fallback confirmation for local/dev setups that don't have a public URL for
// Stripe webhooks yet: when the user lands back on success_url, verify the
// session directly with Stripe and activate premium right away. (In a real
// production deploy the webhook above is the source of truth and this is
// just a nicer, instant UX on top of it.)
route("POST", "/api/checkout/confirm", async (req, res, params, body) => {
  if (!STRIPE_ENABLED) return send(res, 400, { error: "Stripe ist nicht konfiguriert" });
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  const sessionId = body?.sessionId;
  if (!sessionId) return send(res, 400, { error: "session_id fehlt" });

  const session = await stripeGet(`checkout/sessions/${encodeURIComponent(sessionId)}`);
  if (String(session.client_reference_id) !== String(userId)) {
    return send(res, 403, { error: "Diese Session gehört nicht zu deinem Account" });
  }
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return send(res, 200, { premium: false });
  }
  const until = new Date();
  until.setDate(until.getDate() + PREMIUM_DAYS + 5);
  db.prepare(
    "UPDATE users SET stripe_customer_id = ?, stripe_subscription_id = ?, premium_until = ? WHERE id = ?"
  ).run(session.customer, session.subscription, until.toISOString(), userId);
  send(res, 200, { premium: true });
});

route("POST", "/api/billing-portal", async (req, res) => {
  if (!STRIPE_ENABLED) return send(res, 400, { error: "Stripe ist nicht konfiguriert" });
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user.stripe_customer_id) return send(res, 400, { error: "Kein aktives Abo gefunden" });
  const session = await stripeRequest("billing_portal/sessions", {
    customer: user.stripe_customer_id,
    return_url: `${APP_URL}/`,
  });
  send(res, 200, { url: session.url });
});

// Public (no login needed): a company buys an ad slot. The ad goes live only
// after admin approval in /admin.html once payment is confirmed.
route("POST", "/api/ads/purchase", async (req, res, params, body) => {
  if (!STRIPE_ENABLED) return send(res, 400, { error: "Zahlungen sind noch nicht aktiv — bitte später erneut versuchen" });
  const { emoji, title, adBody, ctaLabel, advertiserEmail } = body;
  if (!title || !adBody || !ctaLabel || !advertiserEmail) {
    return send(res, 400, { error: "Titel, Text, Button-Text und E-Mail sind erforderlich" });
  }
  const session = await stripeRequest("checkout/sessions", {
    mode: "payment",
    success_url: `${APP_URL}/advertise.html?purchase=success`,
    cancel_url: `${APP_URL}/advertise.html?purchase=cancel`,
    customer_email: advertiserEmail,
    metadata: {
      kind: "ad_purchase",
      emoji: (emoji || "📢").slice(0, 8),
      title: title.slice(0, 60),
      body: adBody.slice(0, 160),
      ctaLabel: ctaLabel.slice(0, 30),
      advertiserEmail: advertiserEmail.slice(0, 120),
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: Math.round(AD_PRICE_EUR * 100),
          product_data: { name: `TRIBE Werbeanzeige (${AD_DURATION_DAYS} Tage)` },
        },
      },
    ],
  });
  send(res, 200, { url: session.url });
});

route("GET", "/api/ads/price", async (req, res) => {
  send(res, 200, { priceEur: AD_PRICE_EUR, days: AD_DURATION_DAYS, live: STRIPE_ENABLED });
});

route("GET", "/api/admin/ads", async (req, res) => {
  if (!isAdmin(req)) return send(res, 401, { error: "Ungültiger Admin-Schlüssel" });
  send(res, 200, db.prepare("SELECT * FROM ads ORDER BY id DESC").all());
});

route("PATCH", "/api/admin/ads/:id", async (req, res, params, body) => {
  if (!isAdmin(req)) return send(res, 401, { error: "Ungültiger Admin-Schlüssel" });
  const id = Number(params.id);
  const current = db.prepare("SELECT * FROM ads WHERE id = ?").get(id);
  if (!current) return send(res, 404, { error: "Anzeige nicht gefunden" });
  db.prepare("UPDATE ads SET status = ? WHERE id = ?").run(body.status ?? current.status, id);
  send(res, 200, db.prepare("SELECT * FROM ads WHERE id = ?").get(id));
});

route("GET", "/api/ads", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return send(res, 401, { error: "Nicht angemeldet" });
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (isPremium(user)) return send(res, 200, null);
  const ad = db
    .prepare(
      `SELECT * FROM ads WHERE status = 'active' AND (expires_at IS NULL OR expires_at > ?) ORDER BY RANDOM() LIMIT 1`
    )
    .get(new Date().toISOString());
  send(res, 200, ad || null);
});

route("GET", "/api/health", async (req, res) => send(res, 200, { ok: true }));

// ---------- static file serving ----------
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

function serveStatic(req, res, pathname) {
  let rel = pathname === "/" ? "/index.html" : pathname;
  let filePath;
  if (rel.startsWith("/uploads/")) {
    filePath = path.join(UPLOAD_DIR, rel.replace("/uploads/", ""));
  } else {
    filePath = path.join(FRONTEND_DIR, rel);
  }
  const resolvedRoot = rel.startsWith("/uploads/") ? UPLOAD_DIR : FRONTEND_DIR;
  if (!filePath.startsWith(resolvedRoot)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Payload too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handleStripeWebhook(req, res) {
  const raw = await readRawBody(req);
  if (!verifyStripeSignature(raw, req.headers["stripe-signature"])) {
    return send(res, 400, { error: "Ungültige Signatur" });
  }
  const event = JSON.parse(raw);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.mode === "subscription") {
      const userId = Number(session.client_reference_id);
      if (userId) {
        const until = new Date();
        until.setDate(until.getDate() + PREMIUM_DAYS + 5); // buffer until invoice.paid confirms the real period
        db.prepare(
          "UPDATE users SET stripe_customer_id = ?, stripe_subscription_id = ?, premium_until = ? WHERE id = ?"
        ).run(session.customer, session.subscription, until.toISOString(), userId);
      }
    } else if (session.mode === "payment" && session.metadata?.kind === "ad_purchase") {
      const m = session.metadata;
      const expires = new Date();
      expires.setDate(expires.getDate() + AD_DURATION_DAYS);
      db.prepare(
        "INSERT INTO ads (emoji, title, body, cta_label, status, advertiser_email, expires_at, stripe_payment_id) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)"
      ).run(m.emoji, m.title, m.body, m.ctaLabel, m.advertiserEmail, expires.toISOString(), session.payment_intent || null);
    }
  } else if (event.type === "invoice.paid") {
    const invoice = event.data.object;
    const periodEndUnix = invoice.lines?.data?.[0]?.period?.end;
    const until = periodEndUnix ? new Date(periodEndUnix * 1000) : new Date(Date.now() + 31 * 86400000);
    db.prepare("UPDATE users SET premium_until = ? WHERE stripe_subscription_id = ?").run(
      until.toISOString(),
      invoice.subscription
    );
  } else if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    db.prepare("UPDATE users SET premium_until = NULL WHERE stripe_subscription_id = ?").run(sub.id);
  }

  send(res, 200, { received: true });
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname === "/api/webhooks/stripe" && req.method === "POST") {
    try {
      return await handleStripeWebhook(req, res);
    } catch (e) {
      return send(res, e.status || 500, { error: e.message || "Webhook-Fehler" });
    }
  }

  if (pathname.startsWith("/api/")) {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.regex.exec(pathname);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => (params[k] = m[i + 1]));
      try {
        const body = ["POST", "PUT", "PATCH"].includes(req.method) ? await readBody(req) : {};
        await r.handler(req, res, params, body);
      } catch (e) {
        send(res, e.status || 500, { error: e.message || "Serverfehler" });
      }
      return;
    }
    return send(res, 404, { error: "Route nicht gefunden" });
  }

  if (req.method === "GET") return serveStatic(req, res, pathname);
  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`\nApp läuft: http://localhost:${PORT}\n(Zum Beenden: Strg+C)\n`);
});
