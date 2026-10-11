const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const admin = require("firebase-admin");
const seed = require("./seed.json");

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
  if (
    p.role === "admin" &&
    !(await db.collection("admins").doc(p.id).get()).exists
  )
    return null; // removed admins lose access at once
  return p;
}
const auth = async (req, res, next) => {
  try {
    const p = await who(req);
    if (!p) return res.status(401).json({ error: "Login required" });
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
    const { role, code } = req.body || {};
    const c = String(code || "");
    let payload = null;
    if (role === "captain" && eq(c, CAPTAIN_CODE)) payload = { role };
    else if (role === "vice" && eq(c, VICE_CODE)) payload = { role };
    else if (typeof role === "string" && /^a:[A-Za-z0-9]{1,30}$/.test(role)) {
      const d = await db.collection("admins").doc(role.slice(2)).get();
      if (
        d.exists &&
        eq(
          crypto.scryptSync(c, d.data().salt, 32).toString("hex"),
          d.data().hash,
        )
      )
        payload = { role: "admin", id: d.id, name: d.data().name };
    }
    if (!payload) return res.status(401).json({ error: "Wrong code" });
    tries.delete(req.ip);
    res.json({ token: sign({ ...payload, exp: now + 7 * 864e5 }) });
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
  const [pl, se, le, pn, rl, wl, ad, sc] = await Promise.all([
    ...[
      "players",
      "sessions",
      "legacy",
      "plans",
      "rules",
      "warmup",
      "admins",
    ].map((c) => db.collection(c).get()),
    db.collection("config").doc("schedule").get(),
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
  const byOrder = (d) =>
    d.docs
      .map((x) => ({ id: x.id, ...x.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  out.rules = byOrder(rl);
  out.warmup = byOrder(wl);
  out.admins = ad.docs.map((d) => ({ id: d.id, name: d.data().name })); // names only, never codes
  const sd = sc.exists ? sc.data() : null;
  const rows = (a) => a.map((o) => [o.d, o.t, o.x, o.m]);
  out.schedule =
    sd && sd.team && sd.gk ? { team: rows(sd.team), gk: rows(sd.gk) } : null;
  cache = out;
  cacheAt = Date.now();
  return out;
}

// Captain/vice get everything. Everyone else only gets the roll-number list plus
// the data of the one player they ask for (?me=<id>).
app.get(
  "/api/data",
  h(async (req, res) => {
    let role = null;
    if (req.headers.authorization) {
      const p = await who(req);
      if (!p) return res.status(401).json({ error: "Login expired" });
      role = p.role;
    }
    const all = await readAll();
    if (role) return res.json({ role, ...all });
    const me = String(req.query.me || "");
    const players = all.players.map((p) =>
      p.id === me ? p : { id: p.id, n: p.n, roll: p.roll || p.name },
    );
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
    res.json({
      role: null,
      players,
      sessions,
      legacy,
      plans: all.plans,
      rules: all.rules,
      warmup: all.warmup,
      admins: all.admins,
      schedule: all.schedule,
    });
  }),
);

// ---- writing data (captain / vice-captain only) ----
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
    const b = req.body || {};
    await db
      .collection("plans")
      .doc(req.params.date)
      .set({
        time: str(b.time, 30),
        note: str(b.note),
        status: b.status === "cancelled" ? "cancelled" : "planned",
      });
    done(res);
  }),
);
app.delete(
  "/api/plans/:date",
  auth,
  dateOk,
  h(async (req, res) => {
    await db.collection("plans").doc(req.params.date).delete();
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
    if (rid && (await ref.get()).exists)
      return res.status(409).json({ error: "That roll number already exists" });
    await ref.set({
      n: Number(b.n) || 999,
      name: str(b.name, 40).trim(),
      roll,
      position: str(b.position, 40).trim(),
      joined: str(b.joined, 10),
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
    await db
      .collection("players")
      .doc(req.params.id)
      .update({
        name: str(b.name, 40).trim(),
        roll: str(b.roll, 12).trim(),
        position: str(b.position, 40).trim(),
        joined: /^\d{4}-\d{2}-\d{2}$/.test(b.joined || "") ? b.joined : "",
      });
    done(res);
  }),
);
app.delete(
  "/api/players/:id",
  auth,
  h(async (req, res) => {
    await db.collection("players").doc(req.params.id).delete();
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
    const salt = crypto.randomBytes(16).toString("hex");
    await db
      .collection("admins")
      .add({
        name,
        salt,
        hash: crypto.scryptSync(code, salt, 32).toString("hex"),
      });
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
