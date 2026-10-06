const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const admin = require('firebase-admin');
const seed = require('./seed.json');

const { CAPTAIN_CODE, VICE_CODE, TOKEN_SECRET, FIREBASE_SERVICE_ACCOUNT, ALLOWED_ORIGIN = '*', PORT = 3000 } = process.env;
if (!CAPTAIN_CODE || !VICE_CODE || !TOKEN_SECRET) throw new Error('Set CAPTAIN_CODE, VICE_CODE and TOKEN_SECRET');

admin.initializeApp(FIREBASE_SERVICE_ACCOUNT ? { credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) } : undefined);
const db = admin.firestore();
const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: ALLOWED_ORIGIN === '*' ? true : ALLOWED_ORIGIN.split(',') }));
app.use(express.json({ limit: '100kb' }));

// ---- tokens (signed, 7 days) ----
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const mac = b => crypto.createHmac('sha256', TOKEN_SECRET).update(b).digest('base64url');
const sign = p => { const b = Buffer.from(JSON.stringify(p)).toString('base64url'); return b + '.' + mac(b); };
const verify = t => { try { const [b, s] = String(t).split('.'); if (!eq(s, mac(b))) return null; const p = JSON.parse(Buffer.from(b, 'base64url')); return p.exp > Date.now() ? p : null; } catch { return null; } };
const bearer = req => (req.headers.authorization || '').replace(/^Bearer /, '');
const auth = (req, res, next) => verify(bearer(req)) ? next() : res.status(401).json({ error: 'Login required' });
const h = fn => (req, res, next) => fn(req, res).catch(next);

// ---- login (max 5 tries per minute per IP) ----
const tries = new Map();
app.post('/api/login', (req, res) => {
  const now = Date.now();
  let t = tries.get(req.ip);
  if (!t || t.reset < now) t = { n: 0, reset: now + 60000 };
  tries.set(req.ip, t);
  if (++t.n > 5) return res.status(429).json({ error: 'Too many tries' });
  const { role, code } = req.body || {};
  const want = role === 'captain' ? CAPTAIN_CODE : role === 'vice' ? VICE_CODE : null;
  if (!want || !eq(String(code || ''), want)) return res.status(401).json({ error: 'Wrong code' });
  tries.delete(req.ip);
  res.json({ token: sign({ role, exp: now + 7 * 864e5 }) });
});

// ---- reading data ----
let cache = null, cacheAt = 0;
const bust = () => { cache = null; };
async function readAll() {
  if (cache && Date.now() - cacheAt < 10000) return cache;
  const [pl, se, le, pn] = await Promise.all(['players', 'sessions', 'legacy', 'plans'].map(c => db.collection(c).get()));
  const out = { players: pl.docs.map(d => ({ id: d.id, ...d.data() })), sessions: {}, legacy: {}, plans: {} };
  se.forEach(d => out.sessions[d.id] = d.data().r || {});
  le.forEach(d => out.legacy[d.id] = d.data());
  pn.forEach(d => out.plans[d.id] = d.data());
  cache = out; cacheAt = Date.now();
  return out;
}

// Captain/vice get everything. Everyone else only gets the roll-number list plus
// the data of the one player they ask for (?me=<id>).
app.get('/api/data', h(async (req, res) => {
  let role = null;
  if (req.headers.authorization) {
    const p = verify(bearer(req));
    if (!p) return res.status(401).json({ error: 'Login expired' });
    role = p.role;
  }
  const all = await readAll();
  if (role) return res.json({ role, ...all });
  const me = String(req.query.me || '');
  const players = all.players.map(p => p.id === me ? p : { id: p.id, n: p.n, roll: p.roll || p.name });
  const sessions = {};
  for (const d in all.sessions) sessions[d] = all.sessions[d][me] !== undefined ? { [me]: all.sessions[d][me] } : {};
  const legacy = {};
  for (const m in all.legacy) legacy[m] = { days: all.legacy[m].days, att: all.legacy[m].att[me] !== undefined ? { [me]: all.legacy[m].att[me] } : {} };
  res.json({ role: null, players, sessions, legacy, plans: all.plans });
}));

// ---- writing data (captain / vice-captain only) ----
const str = (v, max = 80) => String(v == null ? '' : v).slice(0, max);
const dateOk = (req, res, next) => /^\d{4}-\d{2}-\d{2}$/.test(req.params.date) ? next() : res.status(400).json({ error: 'Bad date' });
const done = res => { bust(); res.json({ ok: true }); };

app.put('/api/sessions/:date', auth, dateOk, h(async (req, res) => {
  const r = {};
  for (const [k, v] of Object.entries((req.body || {}).r || {})) if (typeof v === 'boolean') r[k] = v;
  await db.collection('sessions').doc(req.params.date).set({ r });
  done(res);
}));
app.delete('/api/sessions/:date', auth, dateOk, h(async (req, res) => {
  await db.collection('sessions').doc(req.params.date).delete(); done(res);
}));

app.put('/api/plans/:date', auth, dateOk, h(async (req, res) => {
  const b = req.body || {};
  await db.collection('plans').doc(req.params.date).set({ time: str(b.time, 30), note: str(b.note), status: b.status === 'cancelled' ? 'cancelled' : 'planned' });
  done(res);
}));
app.delete('/api/plans/:date', auth, dateOk, h(async (req, res) => {
  await db.collection('plans').doc(req.params.date).delete(); done(res);
}));

app.post('/api/players', auth, h(async (req, res) => {
  const b = req.body || {};
  if (!str(b.name).trim()) return res.status(400).json({ error: 'Name required' });
  await db.collection('players').add({ n: Number(b.n) || 999, name: str(b.name, 40).trim(), roll: str(b.roll, 12).trim(), position: str(b.position, 40).trim(), joined: str(b.joined, 10) });
  done(res);
}));
app.delete('/api/players/:id', auth, h(async (req, res) => {
  await db.collection('players').doc(req.params.id).delete(); done(res);
}));

// One-time import of the team and past monthly totals from the attendance register
app.post('/api/import', auth, h(async (req, res) => {
  if (!(await db.collection('players').limit(1).get()).empty) return res.status(409).json({ error: 'Players already exist' });
  const b = db.batch();
  seed.players.forEach((p, i) => b.set(db.collection('players').doc('r' + (i + 1)), { n: i + 1, name: p.name, roll: p.roll, position: p.pos, joined: p.joined }));
  for (const m in seed.months) {
    const att = {};
    seed.months[m].att.forEach((v, i) => att['r' + (i + 1)] = v);
    b.set(db.collection('legacy').doc(m), { days: seed.months[m].days, att });
  }
  await b.commit(); done(res);
}));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Server error' }); });
app.listen(PORT, () => console.log('Hockey attendance API on port ' + PORT));
