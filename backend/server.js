const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const admin = require("firebase-admin");
const seed = require("./seed.json");
const jersey = require("./jersey.json");

const {
  CAPTAIN_CODE,
  VICE_CODE,
  TOKEN_SECRET,
  FIREBASE_SERVICE_ACCOUNT,
  ALLOWED_ORIGIN = "*",
  PORT = 3000,
} = process.env;
let initError = null;
try {
  const missing = [
    "CAPTAIN_CODE",
    "VICE_CODE",
    "TOKEN_SECRET",
    "FIREBASE_SERVICE_ACCOUNT",
  ].filter((k) => !process.env[k]);
  if (missing.length)
    throw new Error("missing environment variables: " + missing.join(", "));
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)),
  });
} catch (e) {
  initError = e.message;
}
const db = initError ? null : admin.firestore();
const app = express();
app.set("trust proxy", 1);
app.use(
  cors({ origin: ALLOWED_ORIGIN === "*" ? true : ALLOWED_ORIGIN.split(",") }),
);
app.use(express.static(require("path").join(__dirname, "../frontend"))); // used when running locally; Vercel serves the frontend itself
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) =>
  initError
    ? res.status(500).json({ error: "Backend not configured: " + initError })
    : next(),
);

// ---- tokens (signed, 7 days) ----
const eq = (a, b) => {
  const x = Buffer.from(String(a)),
    y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const mac = (b) =>
  crypto.createHmac("sha256", TOKEN_SECRET).update(b).digest("base64url");
const sign = (p) => {
  const b = Buffer.from(JSON.stringify(p)).toString("base64url");
  return b + "." + mac(b);
};
const verify = (t) => {
  try {
    const [b, s] = String(t).split(".");
    if (!eq(s, mac(b))) return null;
    const p = JSON.parse(Buffer.from(b, "base64url"));
    return p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
};
const bearer = (req) =>
  (req.headers.authorization || "").replace(/^Bearer /, "");
async function who(req) {
  const p = verify(bearer(req));
  if (!p) return null;
  if (p.role === "admin") {
    const a = await db.collection("admins").doc(p.id).get();
    if (!a.exists || a.data().disabled) return null;
  } // removed or switched-off admins lose access at once
  if (p.role === "player") {
    const [a, pl] = await Promise.all([
      db.collection("accounts").doc(p.id).get(),
      db.collection("players").doc(p.id).get(),
    ]);
    if (!a.exists || !pl.exists || pl.data().removed) return null; // removed students are logged out at once
  }
  return p;
}
// auth = captain / vice-captain / admin only. A player token is valid for reading their own data but never passes this.
const auth = async (req, res, next) => {
  try {
    const p = await who(req);
    if (!p || p.role === "player")
      return res.status(401).json({ error: "Login required" });
    req.user = p;
    next();
  } catch (e) {
    next(e);
  }
};
const owner = (req, res, next) =>
  ["captain", "vice"].includes(req.user.role)
    ? next()
    : res
        .status(403)
        .json({ error: "Only the captain or vice-captain can do this" });
const h = (fn) => (req, res, next) => fn(req, res).catch(next);

// ---- login (max 5 tries per minute per IP) ----
const tries = new Map();
app.post(
  "/api/login",
  h(async (req, res) => {
    const now = Date.now();
    let t = tries.get(req.ip);
    if (!t || t.reset < now) t = { n: 0, reset: now + 60000 };
    tries.set(req.ip, t);
    if (++t.n > 5) return res.status(429).json({ error: "Too many tries" });
    const { role, code, name } = req.body || {};
    const c = String(code || "");
    let payload = null;
    if (role === "captain" && eq(c, CAPTAIN_CODE)) payload = { role };
    else if (role === "vice" && eq(c, VICE_CODE)) payload = { role };
    else if (role === "admin") {
      // extra admins log in with the name the captain gave them + their code
      const want = String(name || "")
        .trim()
        .toLowerCase();
      const ad = want
        ? (await db.collection("admins").get()).docs.filter(
            (d) =>
              String(d.data().name).trim().toLowerCase() === want &&
              !d.data().disabled,
          )
        : [];
      const hit = ad.find((d) =>
        eq(
          crypto.scryptSync(c, d.data().salt, 32).toString("hex"),
          d.data().hash,
        ),
      );
      if (hit) payload = { role: "admin", id: hit.id, name: hit.data().name };
    }
    if (!payload) return res.status(401).json({ error: "Wrong name or code" });
    tries.delete(req.ip);
    res.json({ token: sign({ ...payload, exp: now + 7 * 864e5 }) });
  }),
);

// ---- player accounts: roll number + personal code (first signup checked against the saved contact number) ----
const normRoll = (v) =>
  String(v || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 12);
async function findPlayer(roll) {
  const r = normRoll(roll);
  if (!r) return null;
  return (
    (await readAll()).players.find(
      (p) => !p.removed && (p.id.toUpperCase() === r || normRoll(p.roll) === r),
    ) || null
  );
}
const hashCode = (code, salt) =>
  crypto.scryptSync(String(code), salt, 32).toString("hex");
const limited = (key, max, ms = 60000) => {
  // small in-memory brute-force limiter
  const now = Date.now();
  let t = tries.get(key);
  if (!t || t.reset < now) t = { n: 0, reset: now + ms };
  tries.set(key, t);
  return ++t.n > max;
};
const playerToken = (pl, now) =>
  sign({ role: "player", id: pl.id, exp: now + 30 * 864e5 });

// Roll number -> tells the page what to show (does not reveal anything private)
app.post(
  "/api/player/check",
  h(async (req, res) => {
    if (limited("chk" + req.ip, 20))
      return res.status(429).json({ error: "Too many tries" });
    const pl = await findPlayer((req.body || {}).roll);
    if (!pl)
      return res
        .status(404)
        .json({
          error:
            "This roll number is not on the team list. Ask the captain to add you.",
        });
    const acc = await db.collection("accounts").doc(pl.id).get();
    res.json({ hasAccount: acc.exists }); // nothing about the person is revealed before login
  }),
);

// First-time signup: roll number + the contact number the captain saved for you, then choose your own code.
// (No SMS/OTP provider needed.) 10 wrong contact numbers lock that roll number until the captain presses "Reset code".
const last10 = (v) =>
  String(v || "")
    .replace(/\D/g, "")
    .slice(-10);
app.post(
  "/api/player/signup",
  h(async (req, res) => {
    const { roll, contact, code } = req.body || {};
    if (limited("su" + req.ip, 8))
      return res.status(429).json({ error: "Too many tries" });
    const pl = await findPlayer(roll);
    if (!pl)
      return res
        .status(404)
        .json({
          error:
            "This roll number is not on the team list. Ask the captain to add you.",
        });
    const c = String(code || "");
    if (c.length < 4 || c.length > 30)
      return res
        .status(400)
        .json({ error: "Your code must be 4 to 30 characters" });
    if ((await db.collection("accounts").doc(pl.id).get()).exists)
      return res
        .status(409)
        .json({
          error:
            "Already signed up. Log in with your code. Forgot it? Ask the captain to reset it.",
        });
    if (last10(pl.contact).length < 10)
      return res
        .status(400)
        .json({
          error:
            "The captain has not saved your contact number yet. Ask them to add it.",
        });
    const tr = db.collection("signupTries").doc(pl.id),
      t = await tr.get(),
      n = t.exists ? t.data().n : 0;
    if (n >= 10)
      return res
        .status(423)
        .json({
          error:
            "Locked after too many wrong tries. Ask the captain to reset your signup.",
        });
    if (last10(contact) !== last10(pl.contact)) {
      await tr.set({ n: n + 1 });
      return res
        .status(401)
        .json({
          error: "That is not the contact number saved for this roll number",
        });
    }
    const salt = crypto.randomBytes(16).toString("hex");
    await db
      .collection("accounts")
      .doc(pl.id)
      .set({ salt, hash: hashCode(c, salt), created: Date.now() });
    await tr.delete();
    bust();
    res.json({ token: playerToken(pl, Date.now()), id: pl.id });
  }),
);

app.post(
  "/api/player/login",
  h(async (req, res) => {
    const { roll, code } = req.body || {};
    const pl = await findPlayer(roll);
    if (limited("pl" + req.ip, 8) || (pl && limited("pr" + pl.id, 10)))
      return res.status(429).json({ error: "Too many tries" });
    const acc = pl && (await db.collection("accounts").doc(pl.id).get());
    if (
      !acc ||
      !acc.exists ||
      !eq(hashCode(String(code || ""), acc.data().salt), acc.data().hash)
    )
      return res.status(401).json({ error: "Wrong roll number or code" });
    tries.delete("pr" + pl.id);
    res.json({ token: playerToken(pl, Date.now()), id: pl.id });
  }),
);

// Captain / admin: forgot code or locked out. Removes the account so the player can sign up again.
app.delete(
  "/api/players/:id/account",
  auth,
  h(async (req, res) => {
    await db.collection("accounts").doc(req.params.id).delete();
    await db.collection("signupTries").doc(req.params.id).delete();
    done(res);
  }),
);

// ---- reading data ----
let cache = null,
  cacheAt = 0;
const bust = () => {
  cache = null;
};
async function readAll() {
  if (cache && Date.now() - cacheAt < 10000) return cache;
  const [pl, se, le, pn, rl, wl, ad, ac, sc, tp, gp, stf, av] =
    await Promise.all([
      ...[
        "players",
        "sessions",
        "legacy",
        "plans",
        "rules",
        "warmup",
        "admins",
        "accounts",
      ].map((c) => db.collection(c).get()),
      db.collection("config").doc("schedule").get(),
      db.collection("config").doc("template").get(),
      db.collection("config").doc("group").get(),
      db.collection("config").doc("staff").get(),
      db.collection("avail").get(),
    ]);
  const out = {
    players: pl.docs.map((d) => ({ id: d.id, ...d.data() })),
    sessions: {},
    legacy: {},
    plans: {},
    rules: [],
  };
  se.forEach((d) => (out.sessions[d.id] = d.data().r || {}));
  le.forEach((d) => (out.legacy[d.id] = d.data()));
  pn.forEach((d) => (out.plans[d.id] = d.data()));
  out.avail = {};
  av.forEach((d) => (out.avail[d.id] = d.data().r || {}));
  const byOrder = (d) =>
    d.docs
      .map((x) => ({ id: x.id, ...x.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  out.rules = byOrder(rl);
  out.warmup = byOrder(wl);
  out.admins = ad.docs.map((d) => ({
    id: d.id,
    name: d.data().name,
    disabled: !!d.data().disabled,
    photo: d.data().photo || "",
    created: d.data().created || 0,
  })); // names only, never codes
  out.group = gp.exists ? gp.data().url || "" : "";
  out.staff = stf.exists ? stf.data() : {}; // captain / vice profile photos
  out.accounts = ac.docs.map((d) => d.id); // which players have signed up (ids only)
  out.template = tp.exists ? tp.data().text : "";
  const sd = sc.exists ? sc.data() : null;
  const rows = (a) => a.map((o) => [o.d, o.t, o.x, o.m]);
  out.schedule =
    sd && sd.team && sd.gk ? { team: rows(sd.team), gk: rows(sd.gk) } : null;
  cache = out;
  cacheAt = Date.now();
  return out;
}

// Nothing is sent without a login.
// Captain / vice / admins get everything. A player gets the shared info (days, schedule, rules, warm-up)
// plus only their own record and attendance. Contact, e-mail and jersey details never go to other players.
app.get(
  "/api/data",
  h(async (req, res) => {
    const p = await who(req);
    if (!p) return res.status(401).json({ error: "Login required" });
    const all = await readAll();
    if (p.role !== "player") {
      const myPhoto =
        p.role === "admin"
          ? (all.admins.find((x) => x.id === p.id) || {}).photo || ""
          : (all.staff || {})[p.role] || "";
      const full = {
        role: p.role,
        name: p.name || "",
        adminId: p.id || "",
        myPhoto,
        ...all,
      };
      if (!["captain", "vice"].includes(p.role)) delete full.admins; // only captain / vice manage the admin list
      return res.json(full);
    }
    const me = p.id,
      mine = all.players.find((x) => x.id === me);
    const sessions = {};
    for (const d in all.sessions)
      sessions[d] =
        all.sessions[d][me] !== undefined ? { [me]: all.sessions[d][me] } : {};
    const legacy = {};
    for (const m in all.legacy)
      legacy[m] = {
        days: all.legacy[m].days,
        att:
          all.legacy[m].att[me] !== undefined
            ? { [me]: all.legacy[m].att[me] }
            : {},
      };
    const avail = {};
    for (const d in all.avail)
      if (all.avail[d][me]) avail[d] = { [me]: all.avail[d][me] };
    res.json({
      role: "player",
      me,
      name: mine ? mine.name : "",
      players: mine ? [mine] : [],
      sessions,
      legacy,
      plans: all.plans,
      avail,
      rules: all.rules,
      warmup: all.warmup,
      schedule: all.schedule,
      group: all.group,
    });
  }),
);

// ---- writing data (captain / vice-captain only) ----
const phone = (v) =>
  String(v || "")
    .replace(/[^0-9+]/g, "")
    .slice(0, 15);
const PRIVATE = ["contact", "email", "size", "jerseyName", "jerseyNo"];
const str = (v, max = 80) => String(v == null ? "" : v).slice(0, max);
const dateOk = (req, res, next) =>
  /^\d{4}-\d{2}-\d{2}$/.test(req.params.date)
    ? next()
    : res.status(400).json({ error: "Bad date" });
const done = (res) => {
  bust();
  res.json({ ok: true });
};

app.put(
  "/api/sessions/:date",
  auth,
  dateOk,
  h(async (req, res) => {
    const r = {};
    for (const [k, v] of Object.entries((req.body || {}).r || {}))
      if (typeof v === "boolean") r[k] = v;
    await db.collection("sessions").doc(req.params.date).set({ r });
    done(res);
  }),
);
app.delete(
  "/api/sessions/:date",
  auth,
  dateOk,
  h(async (req, res) => {
    await db.collection("sessions").doc(req.params.date).delete();
    done(res);
  }),
);

app.put(
  "/api/plans/:date",
  auth,
  dateOk,
  h(async (req, res) => {
    const b = req.body || {},
      from = req.params.date,
      to = b.newDate && b.newDate !== from ? String(b.newDate) : from;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(to))
      return res.status(400).json({ error: "Bad date" });
    if (to !== from && (await db.collection("plans").doc(to).get()).exists)
      return res
        .status(409)
        .json({ error: "A playing day already exists on that date" });
    await db
      .collection("plans")
      .doc(to)
      .set({
        time: str(b.time, 30),
        venue: str(b.venue, 80),
        note: str(b.note),
        status: b.status === "cancelled" ? "cancelled" : "planned",
      });
    if (to !== from) {
      // moved to another date: carry the availability answers along
      const old = await db.collection("avail").doc(from).get();
      if (old.exists) {
        await db.collection("avail").doc(to).set(old.data());
        await db.collection("avail").doc(from).delete();
      }
      await db.collection("plans").doc(from).delete();
    }
    done(res);
  }),
);
app.delete(
  "/api/plans/:date",
  auth,
  dateOk,
  h(async (req, res) => {
    await db.collection("plans").doc(req.params.date).delete();
    await db.collection("avail").doc(req.params.date).delete();
    done(res);
  }),
);

// Availability for a playing day: active / injured / out (cannot come) / maybe. A player sets their own; staff can set anyone's.
const AV = ["active", "injured", "out", "maybe"];
app.put(
  "/api/avail/:date",
  dateOk,
  h(async (req, res) => {
    const u = await who(req);
    if (!u) return res.status(401).json({ error: "Login required" });
    const b = req.body || {},
      s = b.s === "" ? "" : b.s;
    if (s !== "" && !AV.includes(s))
      return res.status(400).json({ error: "Bad status" });
    const id = u.role === "player" ? u.id : String(b.id || "");
    const pl = await db.collection("players").doc(id).get();
    if (!pl.exists || pl.data().removed)
      return res.status(404).json({ error: "Player not found" });
    if (!(await db.collection("plans").doc(req.params.date).get()).exists)
      return res.status(404).json({ error: "No playing day on that date" });
    const ref = db.collection("avail").doc(req.params.date),
      cur = await ref.get(),
      r = cur.exists ? cur.data().r || {} : {};
    if (s === "") delete r[id];
    else r[id] = { s, at: Date.now() };
    await ref.set({ r });
    done(res);
  }),
);

app.post(
  "/api/players",
  auth,
  h(async (req, res) => {
    const b = req.body || {};
    if (!str(b.name).trim())
      return res.status(400).json({ error: "Name required" });
    const roll = str(b.roll, 12).trim(),
      rid = roll.replace(/[^A-Za-z0-9_-]/g, "");
    const ref = rid
      ? db.collection("players").doc(rid)
      : db.collection("players").doc();
    const ex = rid && (await ref.get());
    if (ex && ex.exists)
      return res
        .status(409)
        .json({
          error: ex.data().removed
            ? "That student is in Removed students. Restore them there."
            : "That roll number already exists",
        });
    await ref.set({
      n: Number(b.n) || 999,
      name: str(b.name, 40).trim(),
      roll,
      position: str(b.position, 40).trim(),
      joined: str(b.joined, 10),
      contact: phone(b.contact),
    });
    done(res);
  }),
);
app.put(
  "/api/players/:id",
  auth,
  h(async (req, res) => {
    const b = req.body || {};
    if (!str(b.name).trim())
      return res.status(400).json({ error: "Name required" });
    const upd = {
      name: str(b.name, 40).trim(),
      roll: str(b.roll, 12).trim(),
      position: str(b.position, 40).trim(),
      contact: phone(b.contact),
      joined: /^\d{4}-\d{2}-\d{2}$/.test(b.joined || "") ? b.joined : "",
    };
    for (const k of ["email", "size", "jerseyName", "jerseyNo"])
      if (b[k] !== undefined) upd[k] = str(b[k], 40).trim();
    await db.collection("players").doc(req.params.id).update(upd); // works for removed students too: their details are kept
    done(res);
  }),
);
// Add many students at once (also used by the jersey-form import). Existing roll numbers are not duplicated;
// their missing contact / jersey details are filled in instead.
async function addStudents(list) {
  const all = (await db.collection("players").get()).docs;
  const have = new Map(all.map((d) => [d.id.toUpperCase(), d]));
  let next = Math.max(0, ...all.map((d) => d.data().n || 0)) + 1,
    added = 0,
    updated = 0,
    skipped = [];
  const b = db.batch(),
    now = new Date(),
    joined =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0");
  for (const s of list.slice(0, 200)) {
    const rid = normRoll(s.roll),
      name = str(s.name, 40).trim();
    if (!rid || !name) {
      skipped.push(name || s.roll || "(blank)");
      continue;
    }
    const extra = {}; // only non-empty private details
    for (const k of PRIVATE) {
      const v = k === "contact" ? phone(s[k]) : str(s[k], 40).trim();
      if (v) extra[k] = v;
    }
    const old = have.get(rid);
    if (old && old.data && old.data().removed) {
      skipped.push(name + " (in Removed students)");
      continue;
    }
    if (old) {
      if (old.ref && Object.keys(extra).length) {
        b.update(old.ref, extra);
        updated++;
      }
      continue;
    }
    b.set(db.collection("players").doc(rid), {
      n: next++,
      name,
      roll: rid,
      position: str(s.position, 40).trim(),
      joined,
      ...extra,
    });
    have.set(rid, { ref: null });
    added++;
  }
  if (added || updated) await b.commit();
  return { added, updated, skipped };
}
app.post(
  "/api/players/bulk",
  auth,
  h(async (req, res) => {
    const r = await addStudents(
      Array.isArray((req.body || {}).players) ? req.body.players : [],
    );
    bust();
    res.json({ ok: true, ...r });
  }),
);
app.post(
  "/api/players/import-jersey",
  auth,
  h(async (req, res) => {
    const r = await addStudents(jersey);
    bust();
    res.json({ ok: true, ...r });
  }),
);
// Removing only hides the student (attendance history is kept). They are logged out at once and can be restored from the Removed tab.
app.delete(
  "/api/players/:id",
  auth,
  h(async (req, res) => {
    await db
      .collection("players")
      .doc(req.params.id)
      .update({
        removed: true,
        removedAt: Date.now(),
        removedBy: str(
          req.user.name ||
            { captain: "Captain", vice: "Vice-captain" }[req.user.role] ||
            "Admin",
          40,
        ),
      });
    done(res); // every other detail (contact, jersey, joined, attendance) is kept as it is
  }),
);
app.post(
  "/api/players/:id/restore",
  auth,
  h(async (req, res) => {
    await db
      .collection("players")
      .doc(req.params.id)
      .update({ removed: false, removedAt: 0, removedBy: "" });
    done(res);
  }),
);
app.delete(
  "/api/players/:id/permanent",
  auth,
  h(async (req, res) => {
    const ref = db.collection("players").doc(req.params.id);
    const d = await ref.get();
    if (!d.exists || !d.data().removed)
      return res.status(400).json({ error: "Remove the student first" });
    await ref.delete();
    await db.collection("accounts").doc(req.params.id).delete();
    await db.collection("signupTries").doc(req.params.id).delete();
    done(res);
  }),
);

// One-time import of the team and past monthly totals from the attendance register
app.post(
  "/api/import",
  auth,
  h(async (req, res) => {
    if (!(await db.collection("players").limit(1).get()).empty)
      return res.status(409).json({ error: "Players already exist" });
    const b = db.batch();
    const ids = seed.players.map(
      (p, i) => p.roll.replace(/[^A-Za-z0-9_-]/g, "") || "r" + (i + 1),
    ); // document id = roll number, easy to find in the Firebase console
    seed.players.forEach((p, i) =>
      b.set(db.collection("players").doc(ids[i]), {
        n: i + 1,
        name: p.name,
        roll: p.roll,
        position: p.pos,
        joined: p.joined,
      }),
    );
    for (const m in seed.months) {
      const att = {};
      seed.months[m].att.forEach((v, i) => (att[ids[i]] = v));
      b.set(db.collection("legacy").doc(m), { days: seed.months[m].days, att });
    }
    for (const d in seed.sessions || {})
      b.set(db.collection("sessions").doc(d), { r: seed.sessions[d] });
    (seed.removedPlayers || []).forEach((p, i) =>
      b.set(db.collection("players").doc(p.id), {
        n: 100 + i,
        name: p.name,
        roll: p.roll,
        position: "",
        joined: p.joined,
        removed: true,
        removedAt: Date.now(),
      }),
    );
    (seed.newPlayers || []).forEach((p, i) =>
      b.set(db.collection("players").doc(p.id), {
        n: 200 + i,
        name: p.name,
        roll: p.roll,
        position: p.pos,
        joined: p.joined,
      }),
    );
    await b.commit();
    done(res);
  }),
);

// Replace the old monthly totals (Nov 2025, Jan 2026, Feb 2026) with the day-wise attendance from the WhatsApp group.
// Safe to press more than once. Other months, players and accounts are not touched.
app.post(
  "/api/import-daywise",
  auth,
  h(async (req, res) => {
    const ids = seed.players.map(
      (p, i) => p.roll.replace(/[^A-Za-z0-9_-]/g, "") || "r" + (i + 1),
    );
    const b = db.batch();
    for (const d in seed.sessions || {})
      b.set(db.collection("sessions").doc(d), { r: seed.sessions[d] });
    for (const m of seed.replaced || [])
      b.delete(db.collection("legacy").doc(m));
    // months only partly available day-wise keep a small monthly total for the days not yet entered
    for (const m of seed.partial || []) {
      const att = {};
      seed.months[m].att.forEach((v, i) => (att[ids[i]] = v));
      b.set(db.collection("legacy").doc(m), { days: seed.months[m].days, att });
    }
    // people who attended but left the team go to Removed students (existing records are never overwritten)
    const rp = seed.removedPlayers || [];
    const have = await Promise.all(
      rp.map((p) => db.collection("players").doc(p.id).get()),
    );
    rp.forEach((p, i) => {
      if (!have[i].exists)
        b.set(db.collection("players").doc(p.id), {
          n: 100 + i,
          name: p.name,
          roll: p.roll,
          position: "",
          joined: p.joined,
          removed: true,
          removedAt: Date.now(),
        });
    });
    // students recorded twice under different names are merged into one (only removed students are ever dropped)
    for (const id of seed.dropPlayers || []) {
      const d = await db.collection("players").doc(id).get();
      if (d.exists && d.data().removed) b.delete(d.ref);
    }
    // new team members who joined after the register was made (added as current players if not already there)
    const np = seed.newPlayers || [];
    const haveNew = await Promise.all(
      np.map((p) => db.collection("players").doc(p.id).get()),
    );
    np.forEach((p, i) => {
      if (!haveNew[i].exists)
        b.set(db.collection("players").doc(p.id), {
          n: 200 + i,
          name: p.name,
          roll: p.roll,
          position: p.pos,
          joined: p.joined,
        });
    });
    await b.commit();
    done(res);
  }),
);

// Rules and warm-up sections: editable text, small pictures and video links
const imgOk = (v) =>
  typeof v === "string" &&
  /^data:image\/(jpeg|png|webp);base64,/.test(v) &&
  v.length < 45000;
const ytOk = (v) => typeof v === "string" && /^https?:\/\/\S{3,300}$/.test(v);
for (const col of ["rules", "warmup"]) {
  app.put(
    "/api/" + col + "/:id",
    auth,
    h(async (req, res) => {
      if (!/^[a-z0-9]{1,20}$/.test(req.params.id))
        return res.status(400).json({ error: "Bad id" });
      const b = req.body || {};
      const items = (Array.isArray(b.items) ? b.items : [])
        .slice(0, 40)
        .map((i) => ({
          h: str(i.h, 80),
          b: str(i.b, 400),
          img: imgOk(i.img) ? i.img : "",
          yt: ytOk(i.yt) ? i.yt : "",
        }));
      if (items.reduce((n, i) => n + i.img.length, 0) > 800000)
        return res
          .status(413)
          .json({ error: "Too many pictures in one section" });
      await db
        .collection(col)
        .doc(req.params.id)
        .set({
          title: str(b.title, 80),
          icon: str(b.icon, 8),
          order: Number(b.order) || 0,
          items,
        });
      done(res);
    }),
  );
  app.delete(
    "/api/" + col + "/:id",
    auth,
    h(async (req, res) => {
      await db.collection(col).doc(req.params.id).delete();
      done(res);
    }),
  );
}

// Profile photos: small JPEG (resized in the browser). A photo is a data URL under ~60 KB; empty string clears it.
const photoOk = (v) =>
  v === "" ||
  (typeof v === "string" &&
    /^data:image\/(jpeg|png|webp);base64,/.test(v) &&
    v.length < 60000);
app.put(
  "/api/players/:id/photo",
  auth,
  h(async (req, res) => {
    const ph = (req.body || {}).photo;
    if (!photoOk(ph))
      return res.status(400).json({ error: "Photo too large or not an image" });
    await db.collection("players").doc(req.params.id).update({ photo: ph });
    done(res);
  }),
);
// Anyone logged in can set their own photo (player, admin, captain, vice-captain)
app.put(
  "/api/me/photo",
  h(async (req, res) => {
    const p = await who(req);
    if (!p) return res.status(401).json({ error: "Login required" });
    const ph = (req.body || {}).photo;
    if (!photoOk(ph))
      return res.status(400).json({ error: "Photo too large or not an image" });
    if (p.role === "player")
      await db.collection("players").doc(p.id).update({ photo: ph });
    else if (p.role === "admin")
      await db.collection("admins").doc(p.id).update({ photo: ph });
    else
      await db
        .collection("config")
        .doc("staff")
        .set({ [p.role]: ph }, { merge: true });
    done(res);
  }),
);
app.put(
  "/api/admins/:id/photo",
  auth,
  owner,
  h(async (req, res) => {
    const ph = (req.body || {}).photo;
    if (!photoOk(ph))
      return res.status(400).json({ error: "Photo too large or not an image" });
    await db.collection("admins").doc(req.params.id).update({ photo: ph });
    done(res);
  }),
);
// Hockey WhatsApp group link, editable by any admin (empty = use the built-in default)
app.put(
  "/api/group",
  auth,
  h(async (req, res) => {
    const u = String((req.body || {}).url || "").trim();
    if (u && !/^https:\/\/\S{6,300}$/.test(u))
      return res
        .status(400)
        .json({ error: "The link must start with https://" });
    await db.collection("config").doc("group").set({ url: u });
    done(res);
  }),
);

// Weekly practice schedule (stored as objects because Firestore does not allow arrays inside arrays)
app.put(
  "/api/schedule",
  auth,
  h(async (req, res) => {
    const fix = (a) =>
      (Array.isArray(a) ? a : [])
        .slice(0, 7)
        .map((r) => ({
          d: str((r || [])[0], 20),
          t: str((r || [])[1], 60),
          x: str((r || [])[2], 200),
          m: str((r || [])[3], 30),
        }));
    const team = fix((req.body || {}).team),
      gk = fix((req.body || {}).gk);
    if (team.length !== 7 || gk.length !== 7)
      return res.status(400).json({ error: "Need 7 days" });
    await db.collection("config").doc("schedule").set({ team, gk });
    done(res);
  }),
);

// Extra admins (only the captain or vice-captain can add or remove them). Codes are stored hashed.
app.post(
  "/api/admins",
  auth,
  owner,
  h(async (req, res) => {
    const b = req.body || {},
      name = str(b.name, 40).trim(),
      code = String(b.code || "");
    if (!name || code.length < 4 || code.length > 30)
      return res
        .status(400)
        .json({ error: "A name and a code of 4 to 30 characters are needed" });
    if (
      (await db.collection("admins").get()).docs.some(
        (d) =>
          String(d.data().name).trim().toLowerCase() === name.toLowerCase(),
      )
    )
      return res
        .status(409)
        .json({
          error:
            "An admin with that name already exists. Use a different name.",
        });
    const salt = crypto.randomBytes(16).toString("hex");
    await db
      .collection("admins")
      .add({
        name,
        disabled: false,
        salt,
        hash: crypto.scryptSync(code, salt, 32).toString("hex"),
      });
    done(res);
  }),
);
app.put(
  "/api/admins/:id",
  auth,
  owner,
  h(async (req, res) => {
    // switch an admin on / off without deleting them
    const ref = db.collection("admins").doc(req.params.id);
    if (!(await ref.get()).exists)
      return res.status(404).json({ error: "No such admin" });
    await ref.update({ disabled: !!(req.body || {}).disabled });
    done(res);
  }),
);
app.delete(
  "/api/admins/:id",
  auth,
  owner,
  h(async (req, res) => {
    await db.collection("admins").doc(req.params.id).delete();
    done(res);
  }),
);

// WhatsApp message template for playing-day announcements (shared by all admins)
app.put(
  "/api/template",
  auth,
  h(async (req, res) => {
    await db
      .collection("config")
      .doc("template")
      .set({ text: str((req.body || {}).text, 1500) });
    done(res);
  }),
);

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});
if (require.main === module)
  app.listen(PORT, () =>
    console.log("Hockey attendance running on http://localhost:" + PORT),
  );
module.exports = app;
