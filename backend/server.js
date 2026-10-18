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

// ---- player accounts: roll number + personal code (first signup checked with an e-mail code) ----
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

// ---- first-time signup: roll number -> a 6 digit code e-mailed through Resend -> choose your own code ----
// Needs RESEND_API_KEY (and RESEND_FROM, an address on a domain verified in Resend). Optional SIGNUP_EMAIL_DOMAIN (e.g. iitp.ac.in) limits which e-mails may be used.
// Sign-up e-mails can be from any domain (Gmail, institute, etc.) by default. Set SIGNUP_EMAIL_DOMAIN (e.g. iitp.ac.in) to limit sign-ups to one domain.
const SIGNUP_DOMAIN = (() => {
  const v = (
    process.env.SIGNUP_EMAIL_DOMAIN === undefined
      ? "any"
      : process.env.SIGNUP_EMAIL_DOMAIN
  )
    .trim()
    .toLowerCase()
    .replace(/^@/, "");
  return v === "any" || v === "none" ? "" : v;
})();
const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,200}\.[A-Za-z]{2,24}$/;
const maskEmail = (e) => {
  const [u, d] = String(e).split("@");
  return u.slice(0, 1) + "***" + (u.length > 3 ? u.slice(-1) : "") + "@" + d;
};
class PublicError extends Error {
  constructor(status, msg) {
    super(msg);
    this.status = status;
    this.public = msg;
  }
}
async function sendEmail(to, subject, text, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key)
    throw new PublicError(
      503,
      "E-mail is not set up on the server yet. The captain must add RESEND_API_KEY in Vercel and redeploy.",
    );
  const from =
    process.env.RESEND_FROM || "Inter IIT Hockey <onboarding@resend.dev>";
  let r;
  try {
    r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(9000),
    });
  } catch (e) {
    throw new PublicError(
      503,
      "Could not reach the e-mail service. Please try again.",
    );
  }
  if (r.ok) return;
  const j = await r.json().catch(() => ({})),
    m = String(j.message || "");
  console.error("resend", r.status, m);
  if (r.status === 429)
    throw new PublicError(
      429,
      "Too many e-mails right now. Wait a minute and try again.",
    );
  if (r.status === 401 || /api key/i.test(m))
    throw new PublicError(
      503,
      "The e-mail key on the server is wrong. The captain must check RESEND_API_KEY.",
    );
  if (r.status === 403 || /verify|testing emails|domain/i.test(m))
    throw new PublicError(
      503,
      "E-mail is limited until a domain is verified in Resend. The captain must verify a domain and set RESEND_FROM.",
    );
  if (r.status === 422 || r.status === 400)
    throw new PublicError(
      400,
      "That e-mail address was not accepted. Check it and try again.",
    );
  throw new PublicError(502, "Could not send the e-mail. Please try again.");
}
const otpHash = (id, email, code) =>
  crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(id + "|" + email.toLowerCase() + "|" + code)
    .digest("hex");

// Roll number -> tells the page what to show (does not reveal anything private; a saved e-mail is shown masked)
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
    res.json({
      hasAccount: acc.exists,
      emailHint:
        !acc.exists && EMAIL_RE.test(pl.email || "") ? maskEmail(pl.email) : "",
      domain: SIGNUP_DOMAIN,
    });
  }),
);
// Step 1: send the code. If the captain already saved an e-mail for you, the code goes there. Otherwise you type your own e-mail.
app.post(
  "/api/player/otp",
  h(async (req, res) => {
    if (limited("otpip" + req.ip, 12, 3600e3))
      return res
        .status(429)
        .json({ error: "Too many tries. Please wait a while." });
    const pl = await findPlayer((req.body || {}).roll);
    if (!pl)
      return res
        .status(404)
        .json({
          error:
            "This roll number is not on the team list. Ask the captain to add you.",
        });
    if ((await db.collection("accounts").doc(pl.id).get()).exists)
      return res
        .status(409)
        .json({
          error:
            "Already signed up. Log in with your code. Forgot it? Ask the captain to reset it.",
        });
    const saved = EMAIL_RE.test(pl.email || "") ? pl.email.trim() : "",
      typed = str((req.body || {}).email, 120).trim();
    const email = saved || typed;
    if (!EMAIL_RE.test(email))
      return res.status(400).json({ error: "Enter a valid e-mail address." });
    const dom = SIGNUP_DOMAIN;
    if (!saved && dom && !email.toLowerCase().endsWith("@" + dom))
      return res
        .status(400)
        .json({ error: "Use your @" + dom + " e-mail address." });
    const ref = db.collection("otps").doc(pl.id),
      cur = await ref.get(),
      now = Date.now(),
      c = cur.exists ? cur.data() : {};
    if (c.at && now - c.at < 60000)
      return res
        .status(429)
        .json({
          error:
            "Wait " +
            Math.ceil((60000 - (now - c.at)) / 1000) +
            " seconds before asking for another code.",
          wait: Math.ceil((60000 - (now - c.at)) / 1000),
        });
    const hourStart = c.hs && now - c.hs < 3600e3 ? c.hs : now,
      sends = c.hs && now - c.hs < 3600e3 ? c.sends || 0 : 0;
    if (sends >= 5)
      return res
        .status(429)
        .json({
          error:
            "Too many codes asked for this roll number. Try again in an hour.",
        });
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    await sendEmail(
      email,
      "Your Inter IIT Hockey code: " + code,
      "Your sign-up code is " +
        code +
        ". It works for 10 minutes. If you did not ask for it, ignore this e-mail.",
      '<div style="font-family:Arial,sans-serif;max-width:420px"><h2 style="margin:0 0 8px">Inter IIT Hockey</h2><p>Your sign-up code is</p><p style="font-size:32px;letter-spacing:6px;font-weight:700;margin:8px 0">' +
        code +
        '</p><p style="color:#555">It works for 10 minutes. If you did not ask for it, ignore this e-mail.</p></div>',
    );
    await ref.set({
      h: otpHash(pl.id, email, code),
      email,
      exp: now + 600e3,
      n: 0,
      at: now,
      hs: hourStart,
      sends: sends + 1,
    });
    res.json({ ok: true, sentTo: maskEmail(email), wait: 60 });
  }),
);
// Captain / vice-captain: send a test e-mail to check the Resend + domain setup before the team signs up.
app.post(
  "/api/email/test",
  auth,
  owner,
  h(async (req, res) => {
    const to = str((req.body || {}).to, 120).trim();
    if (!EMAIL_RE.test(to))
      return res.status(400).json({ error: "Enter a valid e-mail address." });
    if (limited("emt" + req.user.role, 6, 3600e3))
      return res
        .status(429)
        .json({ error: "Too many test e-mails. Try again in an hour." });
    const from =
      process.env.RESEND_FROM || "Inter IIT Hockey <onboarding@resend.dev>";
    await sendEmail(
      to,
      "Inter IIT Hockey: test e-mail",
      "This is a test. E-mail sending works, so sign-up codes will reach your players.",
      '<div style="font-family:Arial,sans-serif"><h2>Inter IIT Hockey</h2><p>This is a test. E-mail sending works, so sign-up codes will reach your players.</p></div>',
    );
    res.json({
      ok: true,
      from,
      warn: process.env.RESEND_FROM
        ? ""
        : "RESEND_FROM is not set, so the shared test sender was used. Resend delivers that only to your own Resend account e-mail.",
    });
  }),
);
// Step 2: the code from the e-mail + the personal code you choose. 5 wrong tries cancel that e-mail code.
app.post(
  "/api/player/signup",
  h(async (req, res) => {
    const { roll, otp, code } = req.body || {};
    if (limited("su" + req.ip, 12))
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
    const ref = db.collection("otps").doc(pl.id),
      o = await ref.get();
    if (!o.exists || o.data().exp < Date.now())
      return res
        .status(400)
        .json({
          error: "That e-mail code has expired. Press Send code again.",
        });
    const d = o.data();
    if (d.n >= 5)
      return res
        .status(423)
        .json({
          error: "Too many wrong codes. Press Send code to get a new one.",
        });
    if (
      !/^\d{6}$/.test(String(otp || "")) ||
      !eq(otpHash(pl.id, d.email, String(otp)), d.h)
    ) {
      await ref.update({ n: d.n + 1 });
      return res
        .status(401)
        .json({ error: "Wrong e-mail code. " + (4 - d.n) + " tries left." });
    }
    const salt = crypto.randomBytes(16).toString("hex");
    await db
      .collection("accounts")
      .doc(pl.id)
      .set({ salt, hash: hashCode(c, salt), created: Date.now() });
    await db
      .collection("players")
      .doc(pl.id)
      .update({ email: d.email, emailVerified: true });
    await ref.delete();
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
  pubCache = null;
};
let lastGood = null;
async function readAll(fresh) {
  try {
    return await readAllRaw(fresh);
  } catch (e) {
    if (lastGood) {
      console.error("readAll failed, serving the last good copy:", e.message);
      return lastGood;
    }
    throw e;
  }
}
async function readAllRaw(fresh) {
  if (!fresh && cache && Date.now() - cacheAt < 10000) return cache;
  const [
    pl,
    se,
    le,
    pn,
    rl,
    wl,
    ad,
    ac,
    sc,
    tp,
    gp,
    stf,
    av,
    gph,
    mt,
    nmd,
    an,
  ] = await Promise.all([
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
    db.collection("config").doc("groupPhoto").get(),
    db.collection("config").doc("matches").get(),
    db.collection("config").doc("staffNames").get(),
    db.collection("announcements").get(),
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
    kind: d.data().kind || "",
    playerId: d.data().playerId || "",
  })); // names only, never codes
  out.group = gp.exists ? gp.data().url || "" : "";
  out.groupPhotoAt = gph.exists ? gph.data().at || 0 : 0; // only a stamp; the picture itself is fetched separately
  out.matches =
    mt.exists && Array.isArray(mt.data().items) ? mt.data().items : null; // null = never edited, the app shows its built-in list
  out.staff = stf.exists ? stf.data() : {}; // captain / vice profile photos
  out.names = nmd.exists ? nmd.data() : {}; // captain / vice / coach display names (shown on the public page)
  {
    const nv = out.names,
      lk = nv.links || {},
      pl2 = (k) =>
        out.players.find((x) => x.id === lk[k] && !x.removed) || null;
    const one = (k) => {
      const q = pl2(k);
      return {
        name: nv[k] || (q ? q.name : ""),
        photo: (q && q.photo) || out.staff[k] || "",
        pid: q ? q.id : "",
      };
    };
    out.team = {
      captain: one("captain"),
      vice: one("vice"),
      coach: { name: nv.coach || "" },
    };
  } // captain / vice-captain can also be players: their name + photo come from the player record
  out.accounts = ac.docs.map((d) => d.id); // which players have signed up (ids only)
  out.template = tp.exists ? tp.data().text : "";
  const sd = sc.exists ? sc.data() : null;
  out.announcements = an.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort(
      (a, b) =>
        (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.at || 0) - (a.at || 0),
    )
    .slice(0, 60);
  const rows = (a) =>
    a.map((o) => [o.d, o.t, o.x, o.m, Array.isArray(o.g) ? o.g : []]); // 5th item = tagged people / groups
  out.schedule =
    sd && sd.team && sd.gk ? { team: rows(sd.team), gk: rows(sd.gk) } : null;
  cache = out;
  cacheAt = Date.now();
  lastGood = out;
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
    const all = await readAll(req.query.fresh === "1");
    if (p.role !== "player") {
      const myPhoto =
        p.role === "admin"
          ? (all.admins.find((x) => x.id === p.id) || {}).photo || ""
          : (all.staff || {})[p.role] || "";
      const lk = (all.names || {}).links || {},
        myAd =
          p.role === "admin"
            ? all.admins.find((x) => x.id === p.id) || {}
            : null;
      const myPlayerId =
        p.role === "admin"
          ? myAd.kind === "player"
            ? myAd.playerId
            : ""
          : lk[p.role] || "";
      const myKind = p.role === "admin" ? myAd.kind || "" : "player";
      const full = {
        role: p.role,
        name: p.name || "",
        adminId: p.id || "",
        myPhoto,
        myPlayerId,
        myKind,
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
      groupPhotoAt: all.groupPhotoAt,
      matches: all.matches,
      names: all.names,
      team: all.team,
      announcements: all.announcements,
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

// ---- push notifications (Web Push, free). Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY; without them everything else still works. ----
let wp = null;
function webpush() {
  if (wp !== null) return wp || null;
  try {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      wp = false;
      return null;
    }
    const w = require("web-push");
    w.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:hockey@example.com",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    wp = w;
    return w;
  } catch (e) {
    console.error("push disabled:", e.message);
    wp = false;
    return null;
  }
}
const subId = (ep) =>
  crypto.createHash("sha256").update(String(ep)).digest("hex").slice(0, 40);
const todayIST = () =>
  new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
app.get(
  "/api/push/key",
  h(async (req, res) => {
    if (!(await who(req)))
      return res.status(401).json({ error: "Login required" });
    if (!webpush())
      return res
        .status(503)
        .json({
          error:
            "Push notifications are not set up on the server yet (VAPID keys missing).",
        });
    res.json({ key: process.env.VAPID_PUBLIC_KEY });
  }),
);
app.post(
  "/api/push/subscribe",
  h(async (req, res) => {
    const u = await who(req);
    if (!u) return res.status(401).json({ error: "Login required" });
    const sub = (req.body || {}).sub || {},
      k = sub.keys || {};
    if (
      !/^https:\/\/\S{10,600}$/.test(String(sub.endpoint || "")) ||
      typeof k.p256dh !== "string" ||
      typeof k.auth !== "string"
    )
      return res.status(400).json({ error: "Bad subscription" });
    await db
      .collection("pushSubs")
      .doc(subId(sub.endpoint))
      .set({
        sub: {
          endpoint: sub.endpoint,
          keys: { p256dh: k.p256dh.slice(0, 200), auth: k.auth.slice(0, 100) },
        },
        role: u.role,
        uid: u.id || u.role,
        at: Date.now(),
      });
    res.json({ ok: true });
  }),
);
app.post(
  "/api/push/unsubscribe",
  h(async (req, res) => {
    if (!(await who(req)))
      return res.status(401).json({ error: "Login required" });
    const ep = (req.body || {}).endpoint;
    if (ep) await db.collection("pushSubs").doc(subId(ep)).delete();
    res.json({ ok: true });
  }),
);
// Sends one notification to every saved phone. only = Set of player ids to reach (staff are skipped); exclude = Set of player ids to leave out.
// Returns { configured, total, sent, failed, codes } so the admin can see what really happened.
async function pushAll(payload, only, exclude) {
  const w = webpush();
  if (!w) return { configured: false, total: 0, sent: 0, failed: 0, codes: [] };
  const [snap, gone] = await Promise.all([
    db.collection("pushSubs").get(),
    db.collection("players").where("removed", "==", true).get(),
  ]);
  const removed = new Set(gone.docs.map((d) => d.id)),
    body = JSON.stringify(payload),
    st = { configured: true, total: 0, sent: 0, failed: 0, codes: [] };
  await Promise.all(
    snap.docs.map(async (d) => {
      const x = d.data();
      if (x.role === "player" && removed.has(x.uid)) return;
      if (only && !(x.role === "player" && only.has(x.uid))) return;
      if (exclude && x.role === "player" && exclude.has(x.uid)) return;
      st.total++;
      try {
        await w.sendNotification(x.sub, body, { TTL: 86400, timeout: 3000 });
        st.sent++;
      } catch (e) {
        st.failed++;
        st.codes.push(e.statusCode || String(e.message).slice(0, 40));
        if (e.statusCode === 404 || e.statusCode === 410)
          await d.ref.delete().catch(() => {});
        else console.error("push failed", e.statusCode || e.message);
      }
    }),
  );
  return st;
}
const addStats = (a, b) => ({
  configured: a.configured && b.configured,
  total: a.total + b.total,
  sent: a.sent + b.sent,
  failed: a.failed + b.failed,
  codes: a.codes.concat(b.codes),
});
// ev: 'new' | 'cancel' | 'back'. People tagged on the playing day get their own "you are tagged" notification. A failed push never breaks saving.
async function pushPlan(ev, date, p) {
  try {
    const when = new Date(date + "T00:00:00Z").toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    const bits = [when, p.time, p.venue ? "📍 " + p.venue : "", p.note]
      .filter(Boolean)
      .join(" · ");
    const title =
      ev === "cancel"
        ? "❌ Playing day cancelled"
        : ev === "back"
          ? "🏑 Playing day is back on"
          : ev === "today"
            ? "⏰ Playing day today"
            : ev === "tomorrow"
              ? "⏰ Playing day tomorrow"
              : "🏑 Playing day scheduled";
    const body = ev === "cancel" ? bits + " is cancelled." : bits,
      base = { tag: "hk-plan-" + date, url: "./" };
    const tags = Array.isArray(p.tags) ? p.tags : [],
      tg = tags.length ? await tagTargets(tags) : new Set();
    if (tg === null)
      return await pushAll({
        title: "📌 You are tagged · " + title,
        body,
        ...base,
      }); // "Everyone" tagged
    if (!tg.size) return await pushAll({ title, body, ...base });
    const [r1, r2] = [
      await pushAll({ title, body, ...base }, undefined, tg),
      await pushAll(
        { title: "📌 You are tagged · " + title, body, ...base },
        tg,
      ),
    ];
    return addStats(r1, r2);
  } catch (e) {
    console.error("pushPlan", e.message);
    return null;
  }
}
// Reminders for the next playing day. Vercel Cron calls this twice a day (see vercel.json) and sends "Authorization: Bearer <CRON_SECRET>".
//  when=tomorrow (7 pm IST): reminds about tomorrow's morning sessions.   when=today (7 am IST): reminds about today's evening sessions.
function startHour(t) {
  const k = [
    ...String(t || "").matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi),
  ];
  if (!k.length || +k[0][1] > 23) return null;
  const mer = (k[0][3] || (k[1] && k[1][3]) || "").toLowerCase();
  let hr = +k[0][1];
  if (mer === "pm" && hr < 12) hr += 12;
  if (mer === "am" && hr === 12) hr = 0;
  return hr;
}
app.get(
  "/api/cron/remind",
  h(async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret)
      return res
        .status(503)
        .json({ error: "CRON_SECRET is not set in Vercel" });
    if (!eq(String(req.headers.authorization || ""), "Bearer " + secret))
      return res.status(401).json({ error: "Not allowed" });
    const when = req.query.when === "today" ? "today" : "tomorrow";
    const t0 = todayIST(),
      date =
        when === "today"
          ? t0
          : new Date(new Date(t0 + "T00:00:00Z").getTime() + 864e5)
              .toISOString()
              .slice(0, 10);
    const d = await db.collection("plans").doc(date).get();
    if (!d.exists || d.data().status === "cancelled")
      return res.json({
        ok: true,
        sent: 0,
        reason: "no playing day on " + date,
      });
    const hr = startHour(d.data().time),
      evening = hr !== null && hr >= 12;
    if ((when === "today") !== evening)
      return res.json({
        ok: true,
        sent: 0,
        reason: "this session is reminded in the other run",
      });
    const push = await pushPlan(when, date, d.data());
    res.json({ ok: true, date, push });
  }),
);
// "Send me a test": tells the person exactly why notifications do or do not reach this phone.
app.post(
  "/api/push/test",
  h(async (req, res) => {
    const u = await who(req);
    if (!u) return res.status(401).json({ error: "Login required" });
    const w = webpush();
    if (!w)
      return res.json({
        ok: false,
        why: "novapid",
        msg: "Push is not set up on the server. The captain must add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel > Settings > Environment Variables, then redeploy.",
      });
    const uid = u.id || u.role,
      snap = await db.collection("pushSubs").get();
    const mine = snap.docs.filter(
      (d) => d.data().uid === uid && d.data().role === u.role,
    );
    if (!mine.length)
      return res.json({
        ok: false,
        why: "nosub",
        total: snap.size,
        msg: "This phone is not subscribed yet. Turn notifications on first (menu > Push), then test again.",
      });
    const body = JSON.stringify({
      title: "🏑 Test notification",
      body: "Notifications are working on this phone.",
      tag: "hk-test",
      url: "./",
    });
    let sent = 0;
    const codes = [];
    await Promise.all(
      mine.map(async (d) => {
        try {
          await w.sendNotification(d.data().sub, body, {
            TTL: 600,
            timeout: 5000,
          });
          sent++;
        } catch (e) {
          codes.push(e.statusCode || String(e.message).slice(0, 40));
          if (e.statusCode === 404 || e.statusCode === 410)
            await d.ref.delete().catch(() => {});
        }
      }),
    );
    res.json({
      ok: sent > 0,
      sent,
      codes,
      total: snap.size,
      msg: sent
        ? "Sent. It should arrive in a few seconds. If it does not, check that notifications are allowed for this app in your phone settings."
        : "The push service refused it (" +
          codes.join(", ") +
          "). Turn notifications off and on again in the menu.",
    });
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
    const prevSnap = await db.collection("plans").doc(from).get(),
      prev = prevSnap.exists ? prevSnap.data() : null;
    const plan = {
      time: str(b.time, 30),
      venue: str(b.venue, 80),
      note: str(b.note),
      status: b.status === "cancelled" ? "cancelled" : "planned",
      tags: cleanTags(b.tags),
    };
    await db.collection("plans").doc(to).set(plan);
    if (to !== from) {
      // moved to another date: carry the availability answers along
      const old = await db.collection("avail").doc(from).get();
      if (old.exists) {
        await db.collection("avail").doc(to).set(old.data());
        await db.collection("avail").doc(from).delete();
      }
      await db.collection("plans").doc(from).delete();
    }
    // tell everyone who turned on push: a new playing day, a cancelled one, or a cancelled one that is back on (only for today or later)
    let ev = null;
    const now = plan.status === "cancelled";
    if (to === from) {
      if (!prev && !now) ev = "new";
      else if (prev && prev.status !== "cancelled" && now) ev = "cancel";
      else if (prev && prev.status === "cancelled" && !now) ev = "back";
    }
    let push = null;
    if (ev && to >= todayIST())
      push = await Promise.race([
        pushPlan(ev, to, plan),
        new Promise((r) => setTimeout(() => r(null), 4500)),
      ]); // a slow push service must never block saving
    bust();
    res.json({ ok: true, push });
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
    if (b.reason !== undefined && typeof b.reason !== "string")
      return res.status(400).json({ error: "Bad reason" });
    const id = u.role === "player" ? u.id : String(b.id || "");
    const pl = await db.collection("players").doc(id).get();
    if (!pl.exists || pl.data().removed)
      return res.status(404).json({ error: "Player not found" });
    if (!(await db.collection("plans").doc(req.params.date).get()).exists)
      return res.status(404).json({ error: "No playing day on that date" });
    const ref = db.collection("avail").doc(req.params.date),
      cur = await ref.get(),
      r = cur.exists ? cur.data().r || {} : {};
    const prevA = r[id];
    if (s === "") delete r[id];
    else
      r[id] = {
        s,
        why:
          s === "active"
            ? ""
            : b.reason !== undefined
              ? str(b.reason, 120).trim()
              : (prevA && prevA.why) || "",
        at: Date.now(),
      }; // the reason is kept when only the status changes, cleared for "active"
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
      ...(EMAIL_RE.test(str(b.email, 120).trim())
        ? { email: str(b.email, 120).trim() }
        : {}),
    });
    done(res);
  }),
);
// A player edits their own details (not roll number or joining date, those stay with the captain/admins)
app.put(
  "/api/me/profile",
  h(async (req, res) => {
    const u = await who(req);
    if (!u || u.role !== "player")
      return res.status(401).json({ error: "Login required" });
    const b = req.body || {},
      name = str(b.name, 40).trim();
    if (!name) return res.status(400).json({ error: "Name required" });
    const upd = { name, position: str(b.position, 40).trim() };
    for (const k of ["size", "jerseyName", "jerseyNo"])
      if (b[k] !== undefined) upd[k] = str(b[k], 40).trim();
    if (b.email !== undefined) {
      const e = str(b.email, 120).trim();
      if (e && !EMAIL_RE.test(e))
        return res.status(400).json({ error: "Enter a valid e-mail address." });
      upd.email = e;
    }
    await db.collection("players").doc(u.id).update(upd);
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
      joined: /^\d{4}-\d{2}-\d{2}$/.test(b.joined || "") ? b.joined : "",
    };
    for (const k of ["size", "jerseyName", "jerseyNo"])
      if (b[k] !== undefined) upd[k] = str(b[k], 40).trim();
    if (b.email !== undefined) {
      const e = str(b.email, 120).trim();
      if (e && !EMAIL_RE.test(e))
        return res.status(400).json({ error: "Enter a valid e-mail address." });
      upd.email = e;
    }
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
      if (k === "contact") continue;
      const v = str(s[k], k === "email" ? 120 : 40).trim();
      if (v && (k !== "email" || EMAIL_RE.test(v))) extra[k] = v;
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
          g: cleanTags((r || [])[4]),
        }));
    const team = fix((req.body || {}).team),
      gk = fix((req.body || {}).gk);
    if (team.length !== 7 || gk.length !== 7)
      return res.status(400).json({ error: "Need 7 days" });
    await db.collection("config").doc("schedule").set({ team, gk });
    done(res);
  }),
);

// ---- tags: a tag is { k: 'p:<player id>' or 'g:all|gk|fwd|mid|def', n: label } ----
const GROUPS = {
  all: "Everyone",
  gk: "Goalkeepers",
  fwd: "Forwards",
  mid: "Midfielders",
  def: "Defenders",
};
const GROUP_RE = {
  gk: /goal|keeper|\bgk\b/i,
  fwd: /forward|wing|striker/i,
  mid: /mid|half/i,
  def: /back|defen/i,
};
function cleanTags(a) {
  const seen = new Set();
  return (Array.isArray(a) ? a : [])
    .slice(0, 40)
    .map((t) => ({ k: str(t && t.k, 60), n: str(t && t.n, 60) }))
    .filter(
      (t) =>
        /^(p:[^\s/]{1,40}|g:(all|gk|fwd|mid|def))$/.test(t.k) &&
        !seen.has(t.k) &&
        seen.add(t.k),
    )
    .map((t) => ({
      k: t.k,
      n: t.k.startsWith("g:") ? GROUPS[t.k.slice(2)] : t.n || t.k.slice(2),
    }));
}
// ids of the players a tag list points at (null = everyone)
async function tagTargets(tags) {
  if (!tags.length) return new Set();
  if (tags.some((t) => t.k === "g:all")) return null;
  const ids = new Set(
    tags.filter((t) => t.k.startsWith("p:")).map((t) => t.k.slice(2)),
  );
  const gs = tags.filter((t) => t.k.startsWith("g:")).map((t) => t.k.slice(2));
  if (gs.length)
    (await db.collection("players").get()).docs.forEach((d) => {
      const x = d.data();
      if (
        !x.removed &&
        gs.some((g) => GROUP_RE[g].test(x.pos || x.position || ""))
      )
        ids.add(d.id);
    });
  return ids;
}

// ---- announcements (admins write, everybody reads through /api/data) ----
const annBody = (b) => ({
  title: str(b.title, 80).trim(),
  text: str(b.text, 1500).trim(),
  tags: cleanTags(b.tags),
  pinned: !!b.pinned,
});
app.post(
  "/api/announcements",
  auth,
  h(async (req, res) => {
    const a = annBody(req.body || {});
    if (!a.text)
      return res
        .status(400)
        .json({ error: "Write the announcement text first" });
    a.at = Date.now();
    a.by = str(req.user.name || req.user.role, 40);
    a.byId = str(req.user.id || req.user.role, 40);
    await db.collection("announcements").add(a);
    const ids = a.tags.length
      ? await tagTargets(a.tags).catch(() => new Set())
      : null; // no tags = for everybody
    pushAll(
      {
        title: "📢 " + (a.title || "New announcement"),
        body: a.text.slice(0, 140),
        tag: "hk-ann-" + a.at,
        url: "./",
      },
      ids === null ? undefined : ids,
    ).catch(() => {});
    done(res);
  }),
);
app.put(
  "/api/announcements/:id",
  auth,
  h(async (req, res) => {
    const ref = db.collection("announcements").doc(req.params.id),
      cur = await ref.get();
    if (!cur.exists)
      return res.status(404).json({ error: "Announcement not found" });
    const a = annBody(req.body || {});
    if (!a.text)
      return res
        .status(400)
        .json({ error: "Write the announcement text first" });
    await ref.set({ ...cur.data(), ...a, edited: Date.now() });
    done(res);
  }),
);
app.delete(
  "/api/announcements/:id",
  auth,
  h(async (req, res) => {
    await db.collection("announcements").doc(req.params.id).delete();
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
    const kind =
        b.kind === "player"
          ? "player"
          : b.kind === "instructor"
            ? "instructor"
            : "",
      playerId = kind === "player" ? str(b.playerId, 40) : "";
    if (!kind)
      return res.status(400).json({ error: "Choose Player or Instructor" });
    if (
      kind === "player" &&
      !(playerId && (await db.collection("players").doc(playerId).get()).exists)
    )
      return res
        .status(400)
        .json({ error: "Choose which player this admin is" });
    const salt = crypto.randomBytes(16).toString("hex");
    await db
      .collection("admins")
      .add({
        name,
        disabled: false,
        kind,
        playerId,
        created: Date.now(),
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
    const b = req.body || {},
      upd = {};
    if (b.disabled !== undefined) upd.disabled = !!b.disabled;
    if (b.kind !== undefined) {
      if (!["player", "instructor"].includes(b.kind))
        return res.status(400).json({ error: "Choose Player or Instructor" });
      upd.kind = b.kind;
      upd.playerId = b.kind === "player" ? str(b.playerId, 40) : "";
      if (
        b.kind === "player" &&
        !(
          upd.playerId &&
          (await db.collection("players").doc(upd.playerId).get()).exists
        )
      )
        return res
          .status(400)
          .json({ error: "Choose which player this admin is" });
    }
    await ref.update(upd);
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

// ---- team group photo (home page) ----
// Any logged-in person can read it; only captain / vice / admins change it. The picture lives in its own document so that
// the 20-second data refresh stays small: /api/data only carries a time stamp (groupPhotoAt).
const bigImgOk = (v, max) =>
  typeof v === "string" &&
  /^data:image\/(jpeg|png|webp);base64,/.test(v) &&
  v.length < max;
app.get(
  "/api/group-photo",
  h(async (req, res) => {
    if (!(await who(req)))
      return res.status(401).json({ error: "Login required" });
    const [m, b] = await Promise.all([
      db.collection("config").doc("groupPhoto").get(),
      db.collection("blobs").doc("groupPhoto").get(),
    ]);
    res.json({
      img: b.exists ? b.data().img || "" : "",
      at: m.exists ? m.data().at || 0 : 0,
    });
  }),
);
app.put(
  "/api/group-photo",
  auth,
  h(async (req, res) => {
    const img = (req.body || {}).img;
    if (img === "") {
      await Promise.all([
        db.collection("blobs").doc("groupPhoto").delete(),
        db.collection("config").doc("groupPhoto").set({ at: 0 }),
      ]);
      return done(res);
    }
    if (!bigImgOk(img, 420000))
      return res.status(400).json({ error: "Photo too large or not an image" });
    await db.collection("blobs").doc("groupPhoto").set({ img });
    await db
      .collection("config")
      .doc("groupPhoto")
      .set({ at: Date.now(), by: str(req.user.name || req.user.role, 40) });
    done(res);
  }),
);

// ---- gallery: everyone logged in can look and add; staff can delete any photo, others only their own ----
// A small thumbnail (listed together) and the full picture (loaded when opened) are kept in two collections.
const ukey = (u) =>
  u.role === "player" ? "p:" + u.id : u.role === "admin" ? "a:" + u.id : u.role;
async function nameOf(u) {
  if (u.role === "player") {
    const d = await db.collection("players").doc(u.id).get();
    return d.exists ? d.data().name : "Player";
  }
  return (
    u.name || { captain: "Captain", vice: "Vice-captain" }[u.role] || "Admin"
  );
}
const GAL_MAX = 200,
  GAL_CATS = ["fitness", "practice", "match"];
const galCat = (v) => (GAL_CATS.includes(v) ? v : "practice"),
  galDesc = (v) => str(v, 120).replace(/\s+/g, " ").trim();
app.get(
  "/api/gallery",
  h(async (req, res) => {
    const u = await who(req);
    if (!u) return res.status(401).json({ error: "Login required" });
    const snap = await db
        .collection("gallery")
        .orderBy("at", "desc")
        .limit(90)
        .get(),
      k = ukey(u);
    res.json({
      items: snap.docs.map((d) => ({
        id: d.id,
        thumb: d.data().thumb,
        by: d.data().by || "",
        at: d.data().at || 0,
        mine: d.data().key === k,
        cat: galCat(d.data().cat),
        desc: d.data().desc || "",
      })),
    });
  }),
);
app.get(
  "/api/gallery/:id",
  h(async (req, res) => {
    if (!(await who(req)))
      return res.status(401).json({ error: "Login required" });
    const d = await db.collection("galleryFull").doc(req.params.id).get();
    if (!d.exists) return res.status(404).json({ error: "Photo not found" });
    res.json({ img: d.data().img });
  }),
);
app.post(
  "/api/gallery",
  h(async (req, res) => {
    const u = await who(req);
    if (!u) return res.status(401).json({ error: "Login required" });
    if (limited("gal" + ukey(u), 30))
      return res
        .status(429)
        .json({ error: "Too many uploads. Wait a minute." });
    const { img, thumb } = req.body || {},
      cat = galCat((req.body || {}).cat),
      desc = galDesc((req.body || {}).desc);
    if (!bigImgOk(img, 420000) || !bigImgOk(thumb, 60000))
      return res.status(400).json({ error: "Photo too large or not an image" });
    const n = (await db.collection("gallery").count().get()).data().count;
    if (n >= GAL_MAX)
      return res
        .status(409)
        .json({
          error: "The gallery is full. Ask an admin to delete old photos.",
        });
    const ref = db.collection("gallery").doc();
    await Promise.all([
      ref.set({
        thumb,
        by: await nameOf(u),
        key: ukey(u),
        at: Date.now(),
        cat,
        desc,
      }),
      db.collection("galleryFull").doc(ref.id).set({ img }),
    ]);
    res.json({ ok: true, id: ref.id });
  }),
);
// change the section or the short description of a photo (staff: any photo, players: their own)
app.put(
  "/api/gallery/:id",
  h(async (req, res) => {
    const u = await who(req);
    if (!u) return res.status(401).json({ error: "Login required" });
    const ref = db.collection("gallery").doc(req.params.id),
      d = await ref.get();
    if (!d.exists) return res.status(404).json({ error: "Photo not found" });
    if (u.role === "player" && d.data().key !== ukey(u))
      return res
        .status(403)
        .json({ error: "You can edit only your own photos" });
    const b = req.body || {},
      upd = {};
    if (b.cat !== undefined) upd.cat = galCat(b.cat);
    if (b.desc !== undefined) upd.desc = galDesc(b.desc);
    await ref.update(upd);
    res.json({ ok: true });
  }),
);
app.delete(
  "/api/gallery/:id",
  h(async (req, res) => {
    const u = await who(req);
    if (!u) return res.status(401).json({ error: "Login required" });
    const ref = db.collection("gallery").doc(req.params.id),
      d = await ref.get();
    if (!d.exists) return res.status(404).json({ error: "Photo not found" });
    if (u.role === "player" && d.data().key !== ukey(u))
      return res
        .status(403)
        .json({ error: "You can delete only your own photos" });
    await Promise.all([
      ref.delete(),
      db.collection("galleryFull").doc(req.params.id).delete(),
    ]);
    res.json({ ok: true });
  }),
);

// ---- Indian hockey: fixtures list (edited by admins) + live headlines (Google News feed, no key needed) ----
app.put(
  "/api/matches",
  auth,
  h(async (req, res) => {
    const b = req.body || {};
    if (b.reset) {
      await db.collection("config").doc("matches").delete();
      return done(res);
    }
    const items = (Array.isArray(b.items) ? b.items : [])
      .slice(0, 40)
      .map((i) => ({
        d: str((i || {}).d, 10),
        t: str((i || {}).t, 100).trim(),
        v: str((i || {}).v, 100).trim(),
      }))
      .filter((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.d) && i.t);
    await db.collection("config").doc("matches").set({ items });
    done(res);
  }),
);
const NEWS_Q = {
  latest: [
    "India hockey",
    "Hockey India",
    "Indian hockey team FIH",
    "Harmanpreet Singh hockey",
  ],
  upcoming: ["India hockey upcoming match schedule", "India hockey fixtures"],
};
const newsCache = {};
const unesc = (s) =>
  String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .trim();
const tagOf = (b, t) => {
  const x = b.match(
    new RegExp("<" + t + "[^>]*>([\\s\\S]*?)</" + t + ">", "i"),
  );
  return x ? unesc(x[1]) : "";
};
// Bing News links look like http://www.bing.com/news/apiclick.aspx?...&url=<the real article>. We open the real article directly.
function realUrl(link) {
  try {
    const u = new URL(link);
    if (/bing\.com$/i.test(u.hostname)) {
      const r = u.searchParams.get("url");
      if (r && /^https?:\/\//i.test(r)) return r;
    }
  } catch (e) {}
  return link;
}
function parseNews(xml, kind) {
  const out = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    let title = tagOf(b, "title");
    const src = tagOf(b, "News:Source") || tagOf(b, "source"),
      link = realUrl(tagOf(b, "link"));
    if (src && title.endsWith(" - " + src))
      title = title.slice(0, -(src.length + 3));
    if (!/^https?:\/\/\S+$/.test(link) || !title) continue;
    out.push({
      t: title.slice(0, 200),
      u: link.slice(0, 800),
      s: src.slice(0, 60),
      at: Date.parse(tagOf(b, "pubDate")) || 0,
    });
  }
  return out;
}
const feedGet = async (url) => {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(6000),
    headers: { "user-agent": "Mozilla/5.0 (hockey-attendance)" },
  });
  if (!r.ok) throw new Error("news " + r.status);
  return r.text();
};
async function fetchNews(kind, fresh) {
  const c = newsCache[kind];
  if (!fresh && c && Date.now() - c.at < 8 * 60e3) return c.items;
  const jobs = [];
  for (const q of NEWS_Q[kind]) {
    jobs.push(
      feedGet(
        "https://www.bing.com/news/search?q=" +
          encodeURIComponent(q) +
          "&format=rss&setmkt=en-IN&qft=sortbydate%3d%221%22",
      ).then((x) => parseNews(x, kind)),
    );
    jobs.push(
      feedGet(
        "https://news.google.com/rss/search?q=" +
          encodeURIComponent(q + " when:7d") +
          "&hl=en-IN&gl=IN&ceid=IN:en",
      ).then((x) => parseNews(x, kind)),
    );
  }
  const res = await Promise.allSettled(jobs),
    seen = new Set(),
    items = [],
    now = Date.now();
  for (const r of res)
    if (r.status === "fulfilled")
      for (const it of r.value) {
        const key = it.t
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim()
          .slice(0, 60);
        if (seen.has(key) || (it.at && it.at > now + 36e5)) continue; // no duplicates, no wrong future dates
        seen.add(key);
        items.push(it);
      }
  if (!items.length) throw new Error("no news");
  const recent = items.filter((i) => !i.at || now - i.at < 30 * 864e5); // nothing older than a month
  const out = (
    kind === "latest" ? recent.sort((a, b) => b.at - a.at) : recent
  ).slice(0, 10);
  newsCache[kind] = { at: Date.now(), items: out };
  return out;
}
app.get(
  "/api/news",
  h(async (req, res) => {
    if (!(await who(req)))
      return res.status(401).json({ error: "Login required" });
    const out = { latest: [], upcoming: [] },
      fresh = req.query.fresh === "1";
    await Promise.all(
      Object.keys(NEWS_Q).map(async (k) => {
        try {
          out[k] = await fetchNews(k, fresh);
        } catch (e) {
          if (newsCache[k]) out[k] = newsCache[k].items;
          else out.err = true;
        }
      }),
    );
    res.json(out);
  }),
);

// ---- public page (no login): app features, captain, coach, team photos and hockey news ----
// Only team-level, non-personal information is sent: names and photos of the captain / vice-captain / coach,
// the team group photo, a few recent gallery thumbnails, fixtures, news and the WhatsApp group link.
// Players' names, roll numbers, contact details and attendance are NEVER part of this reply.
let pubCache = null,
  pubAt = 0;
app.get(
  "/api/public",
  h(async (req, res) => {
    if (limited("pub" + req.ip, 60))
      return res
        .status(429)
        .json({ error: "Too many requests. Wait a minute." });
    if (pubCache && Date.now() - pubAt < 60000) return res.json(pubCache);
    const [all, gb, gs] = await Promise.all([
      readAll(),
      db.collection("blobs").doc("groupPhoto").get(),
      db.collection("gallery").orderBy("at", "desc").limit(8).get(),
    ]);
    const out = {
      team: all.team,
      group: all.group || "",
      matches: all.matches,
      groupPhoto: gb.exists ? gb.data().img || "" : "",
      gallery: gs.docs.map((d) => d.data().thumb).filter(Boolean),
      latest: [],
      upcoming: [],
      playersCount: all.players.filter((p) => !p.removed).length,
    };
    await Promise.all(
      Object.keys(NEWS_Q).map(async (k) => {
        try {
          out[k] = await fetchNews(k);
        } catch (e) {
          if (newsCache[k]) out[k] = newsCache[k].items;
          else out.err = true;
        }
      }),
    );
    pubCache = out;
    pubAt = Date.now();
    res.json(out);
  }),
);
// Captain / vice-captain set the names shown on the public page, and which player record is the captain's / vice-captain's own
app.put(
  "/api/staff-names",
  auth,
  owner,
  h(async (req, res) => {
    const b = req.body || {},
      o = {};
    for (const k of ["captain", "vice", "coach"])
      if (b[k] !== undefined) o[k] = str(b[k], 40).trim();
    if (b.links && typeof b.links === "object") {
      const links = {};
      for (const k of ["captain", "vice"])
        if (b.links[k] !== undefined) {
          const id = str(b.links[k], 40);
          if (id && !(await db.collection("players").doc(id).get()).exists)
            return res.status(400).json({ error: "That player was not found" });
          links[k] = id;
        }
      o.links = links;
    }
    await db.collection("config").doc("staffNames").set(o, { merge: true });
    pubCache = null;
    done(res);
  }),
);

// ---- profile cover (background) pictures. Kept apart from the main data so the 20-second refresh stays small. ----
// k: p = player, a = admin, s = captain / vice-captain.  Anyone logged in can look; only the owner of the profile or staff can change it.
app.get(
  "/api/cover/:k/:id",
  h(async (req, res) => {
    if (!(await who(req)))
      return res.status(401).json({ error: "Login required" });
    const d = await db
      .collection("blobs")
      .doc("cover_" + req.params.k + "_" + req.params.id)
      .get();
    res.json({ img: d.exists ? d.data().img || "" : "" });
  }),
);
app.put(
  "/api/cover/:k/:id",
  h(async (req, res) => {
    const u = await who(req);
    if (!u) return res.status(401).json({ error: "Login required" });
    const { k, id } = req.params,
      staff = u.role !== "player";
    const ok =
      k === "p"
        ? staff || u.id === id
        : k === "a"
          ? (u.role === "admin" && u.id === id) ||
            ["captain", "vice"].includes(u.role)
          : k === "s"
            ? u.role === id
            : false;
    if (!ok || !/^[\w-]{1,40}$/.test(id))
      return res.status(403).json({ error: "You cannot change this cover" });
    const img = (req.body || {}).img;
    const ref = db.collection("blobs").doc("cover_" + k + "_" + id);
    if (img === "") {
      await ref.delete();
      return done(res);
    }
    if (!bigImgOk(img, 160000))
      return res
        .status(400)
        .json({ error: "Picture too large or not an image" });
    await ref.set({ img });
    done(res);
  }),
);

// ---- push notifications: setup help for the captain ----
app.get(
  "/api/push/setup",
  auth,
  owner,
  h(async (req, res) => {
    const n = (await db.collection("pushSubs").count().get()).data().count;
    res.json({
      configured: !!webpush(),
      devices: n,
      hasPublic: !!process.env.VAPID_PUBLIC_KEY,
      hasPrivate: !!process.env.VAPID_PRIVATE_KEY,
      hasSubject: !!process.env.VAPID_SUBJECT,
    });
  }),
);
// makes a fresh VAPID key pair (nothing is stored). The captain copies both values into Vercel > Environment Variables.
app.post(
  "/api/push/generate",
  auth,
  owner,
  h(async (req, res) => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const pub = publicKey.export({ format: "jwk" }),
      prv = privateKey.export({ format: "jwk" });
    const raw = Buffer.concat([
      Buffer.from([4]),
      Buffer.from(pub.x, "base64url"),
      Buffer.from(pub.y, "base64url"),
    ]);
    res.json({ publicKey: raw.toString("base64url"), privateKey: prv.d });
  }),
);
app.post(
  "/api/push/test",
  auth,
  owner,
  h(async (req, res) => {
    const w = webpush();
    if (!w)
      return res
        .status(503)
        .json({
          error:
            "Push notifications are not set up on the server yet (VAPID keys missing).",
        });
    const snap = await db
      .collection("pushSubs")
      .where("uid", "==", req.user.id || req.user.role)
      .get();
    if (snap.empty)
      return res
        .status(409)
        .json({
          error:
            "This device is not subscribed yet. Turn on “Push” in the menu first.",
        });
    let sent = 0;
    await Promise.all(
      snap.docs.map(async (d) => {
        try {
          await w.sendNotification(
            d.data().sub,
            JSON.stringify({
              title: "🏑 Test notification",
              body: "Push notifications are working.",
              tag: "hk-test",
              url: "./",
            }),
            { TTL: 600 },
          );
          sent++;
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410)
            await d.ref.delete().catch(() => {});
        }
      }),
    );
    res.json({ ok: true, sent });
  }),
);

// ---- training: saved sessions (timer / smartwatch data) and timer presets. Private: each person only ever sees their own. ----
const WK_TYPES = [
  "Practice",
  "Match",
  "Fitness / gym",
  "Run / cardio",
  "Other",
];
const nm = (v, lo, hi) => {
  v = +v;
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0;
};
app.get(
  "/api/workouts",
  h(async (req, res) => {
    const u = await who(req);
    if (!u) return res.status(401).json({ error: "Login required" });
    const snap = await db
      .collection("workouts")
      .where("key", "==", ukey(u))
      .get(); // sorted here, so no Firestore index is needed
    const items = snap.docs
      .map((d) => {
        const x = d.data();
        delete x.key;
        return { id: d.id, ...x };
      })
      .sort((a, b) => (b.at || 0) - (a.at || 0))
      .slice(0, 300);
    res.json({ items });
  }),
);
app.post(
  "/api/workouts",
  h(async (req, res) => {
    const u = await who(req);
    if (!u) return res.status(401).json({ error: "Login required" });
    if (limited("wk" + ukey(u), 30))
      return res.status(429).json({ error: "Too many saves. Wait a minute." });
    const b = req.body || {},
      k = ukey(u);
    if (
      (await db.collection("workouts").where("key", "==", k).get()).size >= 600
    )
      return res
        .status(409)
        .json({ error: "Too many saved items. Delete some old ones." });
    let doc;
    if (b.kind === "preset") {
      const name = str(b.name, 40).trim(),
        c = b.cfg || {};
      if (!name || !["sw", "cd", "iv", "mt"].includes(b.mode))
        return res
          .status(400)
          .json({ error: "A name and a timer type are needed" });
      doc = {
        kind: "preset",
        name,
        mode: b.mode,
        cfg: {
          min: nm(c.min, 1, 600) || 10,
          work: nm(c.work, 5, 3600) || 30,
          rest: nm(c.rest, 0, 3600),
          rounds: nm(c.rounds, 1, 99) || 8,
          q: nm(c.q, 1, 60) || 15,
          brk: c.brk === undefined ? 2 : nm(c.brk, 0, 30),
          half: c.half === undefined ? 10 : nm(c.half, 0, 60),
        },
      };
    } else {
      const dur = Math.round(nm(b.dur, 0, 43200));
      if (dur < 10)
        return res
          .status(400)
          .json({ error: "The session is too short to save" });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || ""))
        return res.status(400).json({ error: "Bad date" });
      const z = (Array.isArray(b.zones) ? b.zones : [])
        .slice(0, 5)
        .map((x) => Math.round(nm(x, 0, 43200)));
      doc = {
        kind: "session",
        date: b.date,
        type: WK_TYPES.includes(b.type) ? b.type : "Other",
        dur,
        avg: Math.round(nm(b.avg, 0, 250)),
        max: Math.round(nm(b.max, 0, 250)),
        min: Math.round(nm(b.min, 0, 250)),
        zones: z.length === 5 ? z : [],
        rpe: Math.round(nm(b.rpe, 0, 10)),
        kcal: Math.round(nm(b.kcal, 0, 6000)),
        km: Math.round(nm(b.km, 0, 200) * 10) / 10,
        note: str(b.note, 200).trim(),
        steps: Math.round(nm(b.steps, 0, 100000)),
        dev: str(b.dev, 30).trim(),
        src: ["watch", "manual"].includes(b.src) ? b.src : "manual",
      };
    }
    doc.key = k;
    doc.at = Date.now();
    const ref = await db.collection("workouts").add(doc);
    res.json({ ok: true, id: ref.id });
  }),
);
// ---- health log: steps, distance, sleep, calories, height, weight, typed in by hand. One entry per person per day, private. ----
const HL_FIELDS = {
  steps: [0, 100000, 0, "Steps"],
  km: [0, 200, 1, "Distance"],
  sleep: [0, 24, 1, "Sleep"],
  kcal: [0, 10000, 0, "Calories"],
  height: [50, 250, 1, "Height"],
  weight: [20, 300, 1, "Weight"],
};
const hlId = (u, date) => ukey(u) + "_" + date;
app.get(
  "/api/health-log",
  h(async (req, res) => {
    const u = await who(req);
    if (!u) return res.status(401).json({ error: "Login required" });
    const snap = await db
      .collection("health")
      .where("key", "==", ukey(u))
      .get();
    res.json({
      items: snap.docs
        .map((d) => {
          const x = d.data();
          delete x.key;
          return x;
        })
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 400),
    });
  }),
);
app.put(
  "/api/health-log/:date",
  h(async (req, res) => {
    const u = await who(req);
    if (!u) return res.status(401).json({ error: "Login required" });
    const date = req.params.date;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      date < "2020-01-01" ||
      date >
        new Date(Date.now() + 5.5 * 3600e3 + 864e5).toISOString().slice(0, 10)
    )
      return res
        .status(400)
        .json({ error: "Pick a valid date (not in the future)." });
    if (limited("hl" + ukey(u), 60))
      return res.status(429).json({ error: "Too many saves. Wait a minute." });
    const b = req.body || {},
      doc = { key: ukey(u), date, at: Date.now() };
    for (const [k, [lo, hi, dp, label]] of Object.entries(HL_FIELDS)) {
      if (b[k] === undefined || b[k] === null || b[k] === "") continue;
      const v = Number(b[k]);
      if (!Number.isFinite(v) || v < lo || v > hi)
        return res
          .status(400)
          .json({
            error: label + " must be between " + lo + " and " + hi + ".",
          });
      if (v > 0) doc[k] = dp ? Math.round(v * 10) / 10 : Math.round(v);
    }
    if (!Object.keys(HL_FIELDS).some((k) => doc[k] > 0))
      return res.status(400).json({ error: "Enter at least one value." });
    await db.collection("health").doc(hlId(u, date)).set(doc); // replaces that day's entry
    res.json({ ok: true });
  }),
);
app.delete(
  "/api/health-log/:date",
  h(async (req, res) => {
    const u = await who(req);
    if (!u) return res.status(401).json({ error: "Login required" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.date))
      return res.status(400).json({ error: "Bad date" });
    await db.collection("health").doc(hlId(u, req.params.date)).delete();
    res.json({ ok: true });
  }),
);
app.delete(
  "/api/workouts/:id",
  h(async (req, res) => {
    const u = await who(req);
    if (!u) return res.status(401).json({ error: "Login required" });
    const ref = db.collection("workouts").doc(req.params.id),
      d = await ref.get();
    if (!d.exists || d.data().key !== ukey(u))
      return res.status(404).json({ error: "Not found" });
    await ref.delete();
    res.json({ ok: true });
  }),
);

// ---- bug reports: anyone logged in can send one; the captain / vice-captain read, share, mark fixed or delete ----
app.post(
  "/api/bugs",
  h(async (req, res) => {
    const u = await who(req);
    if (!u) return res.status(401).json({ error: "Login required" });
    if (limited("bug" + ukey(u), 5))
      return res
        .status(429)
        .json({ error: "Too many reports. Wait a minute." });
    const b = req.body || {},
      text = str(b.text, 1000).trim();
    if (text.length < 5)
      return res.status(400).json({ error: "Please describe what went wrong" });
    if (b.shot && !bigImgOk(b.shot, 260000))
      return res
        .status(400)
        .json({ error: "Screenshot too large or not an image" });
    if ((await db.collection("bugs").count().get()).data().count >= 300)
      return res
        .status(409)
        .json({
          error: "Too many open reports. Ask the captain to clear old ones.",
        });
    await db
      .collection("bugs")
      .add({
        text,
        page: str(b.page, 40),
        info: str(b.info, 600),
        shot: b.shot || "",
        by: await nameOf(u),
        role: u.role,
        at: Date.now(),
        status: "open",
      });
    res.json({ ok: true });
  }),
);
app.get(
  "/api/bugs",
  auth,
  owner,
  h(async (req, res) => {
    const snap = await db
      .collection("bugs")
      .orderBy("at", "desc")
      .limit(100)
      .get();
    res.json({
      items: snap.docs.map((d) => {
        const x = d.data();
        const hasShot = !!x.shot;
        delete x.shot;
        return { id: d.id, hasShot, ...x };
      }),
    });
  }),
);
app.get(
  "/api/bugs/:id/shot",
  auth,
  owner,
  h(async (req, res) => {
    const d = await db.collection("bugs").doc(req.params.id).get();
    if (!d.exists) return res.status(404).json({ error: "Not found" });
    res.json({ img: d.data().shot || "" });
  }),
);
app.put(
  "/api/bugs/:id",
  auth,
  owner,
  h(async (req, res) => {
    const st = (req.body || {}).status;
    if (!["open", "fixed"].includes(st))
      return res.status(400).json({ error: "Bad status" });
    await db.collection("bugs").doc(req.params.id).update({ status: st });
    res.json({ ok: true });
  }),
);
app.delete(
  "/api/bugs/:id",
  auth,
  owner,
  h(async (req, res) => {
    await db.collection("bugs").doc(req.params.id).delete();
    res.json({ ok: true });
  }),
);

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use((err, req, res, next) => {
  console.error(err);
  if (err && err.public)
    return res.status(err.status || 500).json({ error: err.public });
  const m = String((err && err.message) || ""),
    code = err && err.code;
  if (err && err.type === "entity.too.large")
    return res
      .status(413)
      .json({ error: "That file is too large. Use a smaller photo." });
  if (err && err.type === "entity.parse.failed")
    return res.status(400).json({ error: "Bad request. Please try again." });
  if (code === 8 || /RESOURCE_EXHAUSTED|quota/i.test(m))
    return res
      .status(503)
      .json({
        error:
          "The database daily limit is used up. It resets every day, please try again later.",
      });
  if (
    code === 4 ||
    code === 14 ||
    /DEADLINE_EXCEEDED|UNAVAILABLE|ECONNRESET|ETIMEDOUT/i.test(m)
  )
    return res
      .status(503)
      .json({ error: "The database is slow right now. Please try again." });
  res.status(500).json({ error: "Server error. Please try again." });
});
if (require.main === module)
  app.listen(PORT, () =>
    console.log("Hockey attendance running on http://localhost:" + PORT),
  );
module.exports = app;
