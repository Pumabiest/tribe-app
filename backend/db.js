// Zero-dependency database layer using Node's built-in SQLite module
// (available in Node 22.5+). No `npm install` required.
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DB_PATH lets a hosting platform point this at a persistent volume
// (e.g. Railway: DB_PATH=/data/dating.db) so the database survives restarts
// and redeploys instead of living inside the throwaway app folder.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "dating.db");
const db = new DatabaseSync(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  birthdate TEXT NOT NULL,
  bio TEXT DEFAULT '',
  photo_url TEXT,
  location TEXT DEFAULT '',
  premium_until TEXT,
  seek_age_min INTEGER NOT NULL DEFAULT 18,
  seek_age_max INTEGER NOT NULL DEFAULT 99,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  emoji TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  cta_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'style'
);

-- how a user identifies / presents themselves
CREATE TABLE IF NOT EXISTS user_identity_tags (
  user_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, category_id)
);

-- what a user is searching for
CREATE TABLE IF NOT EXISTS user_seeking_tags (
  user_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, category_id)
);

CREATE TABLE IF NOT EXISTS swipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  swiper_id INTEGER NOT NULL,
  target_id INTEGER NOT NULL,
  liked INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(swiper_id, target_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a_id INTEGER NOT NULL,
  user_b_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_a_id, user_b_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  reply TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Report/Block system (required by Play Store policy for dating apps).
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL,
  reported_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  message TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER NOT NULL,
  blocked_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blocker_id, blocked_id)
);
`);

// Gender identity, sexual orientation and style/subculture tags. These are
// three separate *types* purely for grouping the picker UI — matching logic
// treats every tag the same regardless of type.
const CATEGORIES = [
  // ---- gender identity ----
  ["Frau", "gender"], ["Mann", "gender"], ["Trans Frau", "gender"], ["Trans Mann", "gender"],
  ["Nicht-binär", "gender"], ["Genderqueer", "gender"], ["Genderfluid", "gender"],
  ["Agender", "gender"], ["Bigender", "gender"], ["Pangender", "gender"], ["Demigender", "gender"],
  ["Androgyn", "gender"], ["Two-Spirit", "gender"], ["Intersex", "gender"], ["Cross-Dresser", "gender"],
  ["Drag Queen", "gender"], ["Drag King", "gender"], ["Femme", "gender"], ["Butch", "gender"],
  ["Femboy", "gender"], ["Tomboy", "gender"], ["Erkunde ich noch (Gender)", "gender"],
  // ---- sexual orientation ----
  ["Heterosexuell", "orientation"], ["Homosexuell", "orientation"], ["Lesbisch", "orientation"],
  ["Bisexuell", "orientation"], ["Pansexuell", "orientation"], ["Asexuell", "orientation"],
  ["Demisexuell", "orientation"], ["Queer", "orientation"], ["Unsicher (Orientierung)", "orientation"],
  // ---- style / subculture ----
  ["Emo", "style"], ["Gothic", "style"], ["Soft Boy", "style"], ["E-Boy", "style"], ["E-Girl", "style"],
  ["Punk", "style"], ["Scene", "style"], ["Grunge", "style"], ["Metalhead", "style"],
  ["Cyberpunk", "style"], ["Techwear", "style"],
];

const insertCategory = db.prepare("INSERT OR IGNORE INTO categories (name, type) VALUES (?, ?)");
for (const [name, type] of CATEGORIES) insertCategory.run(name, type);

// Defensive migrations in case an older dating.db (from before these columns
// existed) is reused.
for (const stmt of [
  "ALTER TABLE users ADD COLUMN premium_until TEXT",
  "ALTER TABLE users ADD COLUMN location TEXT DEFAULT ''",
  "ALTER TABLE users ADD COLUMN seek_age_min INTEGER NOT NULL DEFAULT 18",
  "ALTER TABLE users ADD COLUMN seek_age_max INTEGER NOT NULL DEFAULT 99",
  "ALTER TABLE categories ADD COLUMN type TEXT NOT NULL DEFAULT 'style'",
  "ALTER TABLE users ADD COLUMN stripe_customer_id TEXT",
  "ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT",
  "ALTER TABLE ads ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
  "ALTER TABLE ads ADD COLUMN advertiser_email TEXT",
  "ALTER TABLE ads ADD COLUMN expires_at TEXT",
  "ALTER TABLE ads ADD COLUMN stripe_payment_id TEXT",
]) {
  try {
    db.exec(stmt);
  } catch {
    // column already exists — fine
  }
}

const AD_COUNT = db.prepare("SELECT COUNT(*) as n FROM ads").get().n;
if (AD_COUNT === 0) {
  const insertAd = db.prepare(
    "INSERT INTO ads (emoji, title, body, cta_label) VALUES (?, ?, ?, ?)"
  );
  const sampleAds = [
    ["🛍️", "Blackout Threads", "Alternative Mode & Accessoires – 15% Rabatt für Neukund:innen.", "Shop ansehen"],
    ["🎸", "Local Gig Guide", "Punk-, Emo- & Metal-Konzerte in deiner Stadt finden.", "Konzerte finden"],
    ["🖤", "Inkwell Studio", "Tattoo- & Piercing-Studio, Termine diese Woche frei.", "Termin buchen"],
    ["💿", "Neon Static Records", "Vinyl & Merch von unabhängigen Bands.", "Stöbern"],
  ];
  for (const ad of sampleAds) insertAd.run(...ad);
}

export default db;
