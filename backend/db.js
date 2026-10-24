/**
 * Pure Supabase Database Layer for IIT Patna Hockey
 * Completely replaces Firebase Firestore with a 100% compatible Supabase PostgreSQL adapter.
 */

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  } catch (e) {
    console.error("Failed to initialize Supabase client:", e.message);
  }
}

const genId = () => crypto.randomBytes(10).toString("hex");

const TABLE_MAP = {
  players: { table: "players", pk: "id" },
  accounts: { table: "accounts", pk: "player_id" },
  admins: { table: "admins", pk: "id" },
  sessions: { table: "sessions", pk: "date" },
  legacy: { table: "legacy_attendance", pk: "month" },
  plans: { table: "practice_plans", pk: "date" },
  rules: { table: "hockey_rules", pk: "id" },
  warmup: { table: "warmup_drills", pk: "id" },
  config: { table: "app_config", pk: "key" },
  blobs: { table: "blobs", pk: "id" },
  gallery: { table: "gallery", pk: "id" },
  galleryFull: { table: "gallery", pk: "id" },
  health: { table: "health_logs", pk: "id" },
  pushSubs: { table: "push_subscriptions", pk: "endpoint_hash" },
  announcements: { table: "announcements", pk: "id" },
  bugs: { table: "bug_reports", pk: "id" },
  helpMsgs: { table: "help_messages", pk: "id" },
  workouts: { table: "workouts", pk: "id" },
  avail: { table: "player_availability", pk: "date" },
  signupTries: { table: "signup_tries", pk: "roll" },
  otps: { table: "login_otps", pk: "id" },
};

function rowToDoc(col, row) {
  if (!row) return null;
  const mapping = TABLE_MAP[col] || { table: col, pk: "id" };
  const id = row[mapping.pk] || row.id;

  if (col === "config") {
    return { id, data: () => row.value || {} };
  }
  if (col === "blobs") {
    return { id, data: () => ({ img: row.img || "" }) };
  }
  if (col === "galleryFull") {
    return { id, data: () => ({ img: row.full_img || "" }) };
  }
  if (col === "gallery") {
    return {
      id,
      data: () => ({
        thumb: row.thumb,
        by: row.by_name,
        key: row.user_key,
        cat: row.cat,
        desc: row.description,
        at: row.created_at,
      }),
    };
  }
  if (col === "sessions") {
    return { id, data: () => ({ r: row.r || {} }) };
  }
  if (col === "avail") {
    return { id, data: () => ({ r: row.r || {} }) };
  }
  if (col === "legacy") {
    return { id, data: () => ({ days: row.days, att: row.att || {} }) };
  }
  if (col === "plans") {
    return {
      id,
      data: () => ({
        time: row.time,
        venue: row.venue,
        note: row.note,
        status: row.status,
        tags: row.tags || [],
      }),
    };
  }
  if (col === "rules" || col === "warmup") {
    return {
      id,
      data: () => ({
        title: row.title,
        icon: row.icon,
        order: row.order_index,
        items: row.items || [],
      }),
    };
  }
  if (col === "accounts") {
    return {
      id,
      data: () => ({
        salt: row.salt,
        hash: row.hash,
        created: row.created_at,
      }),
    };
  }
  if (col === "players") {
    return {
      id,
      data: () => ({
        name: row.name,
        roll: row.roll,
        position: row.position,
        joined: row.joined,
        n: row.n,
        size: row.size,
        contact: row.contact,
        jerseyName: row.jersey_name,
        email: row.email,
        jerseyNo: row.jersey_no,
        photo: row.photo,
        removed: !!row.removed,
        emailVerified: !!row.email_verified,
      }),
    };
  }
  if (col === "otps") {
    return {
      id,
      data: () => ({
        h: row.hash,
        email: row.email,
        exp: Number(row.expires_at) || 0,
        n: row.tries || 0,
        at: Number(row.sent_at) || 0,
        hs: Number(row.hour_start) || 0,
        sends: row.sends || 0,
      }),
    };
  }
  if (col === "pushSubs") {
    return {
      id,
      data: () => ({
        sub: row.sub || {},
        role: row.role,
        uid: row.uid,
        at: row.created_at,
      }),
    };
  }
  if (col === "health") {
    return {
      id,
      data: () => ({
        key: row.user_key,
        date: row.log_date,
        steps: row.steps,
        km: row.km,
        sleep: row.sleep,
        kcal: row.kcal,
        height: row.height,
        weight: row.weight,
        at: row.recorded_at,
      }),
    };
  }
  if (col === "announcements") {
    return {
      id,
      data: () => ({
        title: row.title,
        text: row.text,
        pinned: row.pinned,
        by: row.by_name,
        role: row.role,
        at: row.created_at,
      }),
    };
  }
  if (col === "bugs") {
    return {
      id,
      data: () => ({
        desc: row.desc_text,
        shot: row.shot,
        by: row.by_name,
        role: row.role,
        status: row.status,
        at: row.created_at,
      }),
    };
  }
  if (col === "helpMsgs") {
    return {
      id,
      data: () => ({
        name: row.name,
        roll: row.roll,
        contact: row.contact,
        topic: row.topic,
        msg: row.msg,
        done: row.done,
        at: row.created_at,
      }),
    };
  }

  return { id, data: () => row };
}

function docToRow(col, id, data) {
  if (!data) return {};
  const mapping = TABLE_MAP[col] || { table: col, pk: "id" };

  if (col === "config") {
    return { key: id, value: data, updated_at: new Date().toISOString() };
  }
  if (col === "blobs") {
    return { id, img: data.img || "", updated_at: new Date().toISOString() };
  }
  if (col === "galleryFull") {
    return { id, full_img: data.img || "" };
  }
  if (col === "gallery") {
    return {
      id,
      thumb: data.thumb || "",
      by_name: data.by || "",
      user_key: data.key || "",
      cat: data.cat || "practice",
      description: data.desc || "",
      created_at: data.at || Date.now(),
    };
  }
  if (col === "sessions") {
    return { date: id, r: data.r || {}, updated_at: new Date().toISOString() };
  }
  if (col === "avail") {
    return { date: id, r: data.r || {}, updated_at: new Date().toISOString() };
  }
  if (col === "legacy") {
    return { month: id, days: data.days || 0, att: data.att || {} };
  }
  if (col === "plans") {
    return {
      date: id,
      time: data.time || "",
      venue: data.venue || "",
      note: data.note || "",
      status: data.status || "planned",
      tags: data.tags || [],
      updated_at: new Date().toISOString(),
    };
  }
  if (col === "rules" || col === "warmup") {
    return {
      id,
      title: data.title || "",
      icon: data.icon || "",
      order_index: data.order || 0,
      items: data.items || [],
    };
  }
  if (col === "accounts") {
    return {
      player_id: id,
      salt: data.salt,
      hash: data.hash,
      created_at: data.created || Date.now(),
    };
  }
  if (col === "players") {
    const row = { id };
    if (data.name !== undefined) row.name = data.name;
    if (data.roll !== undefined) row.roll = data.roll;
    if (data.position !== undefined) row.position = data.position;
    if (data.joined !== undefined) row.joined = data.joined || null;
    if (data.n !== undefined) row.n = data.n;
    if (data.size !== undefined) row.size = data.size;
    if (data.contact !== undefined) row.contact = data.contact;
    if (data.jerseyName !== undefined) row.jersey_name = data.jerseyName;
    if (data.email !== undefined) row.email = data.email;
    if (data.jerseyNo !== undefined) row.jersey_no = String(data.jerseyNo);
    if (data.photo !== undefined) row.photo = data.photo;
    if (data.removed !== undefined) row.removed = !!data.removed;
    if (data.emailVerified !== undefined)
      row.email_verified = !!data.emailVerified;
    row.updated_at = new Date().toISOString();
    return row;
  }
  if (col === "otps") {
    const row = { id };
    if (data.h !== undefined) row.hash = data.h;
    if (data.email !== undefined) row.email = data.email;
    if (data.exp !== undefined) row.expires_at = data.exp;
    if (data.n !== undefined) row.tries = data.n;
    if (data.at !== undefined) {
      row.sent_at = data.at;
      row.created_at = data.at;
    }
    if (data.hs !== undefined) row.hour_start = data.hs;
    if (data.sends !== undefined) row.sends = data.sends;
    return row;
  }
  if (col === "pushSubs") {
    return {
      endpoint_hash: id,
      sub: data.sub || {},
      role: data.role || "",
      uid: data.uid || "",
      created_at: data.at || Date.now(),
    };
  }
  if (col === "health") {
    return {
      id,
      user_key: data.key || "",
      log_date: data.date || "2026-01-01",
      steps: data.steps,
      km: data.km,
      sleep: data.sleep,
      kcal: data.kcal,
      height: data.height,
      weight: data.weight,
      recorded_at: data.at || Date.now(),
    };
  }
  if (col === "announcements") {
    return {
      id,
      title: data.title || "",
      text: data.text || "",
      pinned: !!data.pinned,
      by_name: data.by || "",
      role: data.role || "",
      created_at: data.at || Date.now(),
    };
  }
  if (col === "bugs") {
    return {
      id,
      desc_text: data.desc || "",
      shot: data.shot || "",
      by_name: data.by || "",
      role: data.role || "",
      status: data.status || "open",
      created_at: data.at || Date.now(),
    };
  }
  if (col === "helpMsgs") {
    return {
      id,
      name: data.name || "",
      roll: data.roll || "",
      contact: data.contact || "",
      topic: data.topic || "",
      msg: data.msg || "",
      done: !!data.done,
      created_at: data.at || Date.now(),
    };
  }

  return { [mapping.pk]: id, ...data };
}

class DocumentReference {
  constructor(col, id) {
    this.col = col;
    this.id = id || genId();
    this.mapping = TABLE_MAP[col] || { table: col, pk: "id" };
  }

  async get() {
    const { data, error } = await supabase
      .from(this.mapping.table)
      .select("*")
      .eq(this.mapping.pk, this.id)
      .maybeSingle();

    const exists = !error && data !== null;
    const doc = exists ? rowToDoc(this.col, data) : null;

    return {
      exists,
      id: this.id,
      data: () => (doc ? doc.data() : {}),
    };
  }

  async set(data, options = {}) {
    const row = docToRow(this.col, this.id, data);
    const { error } = await supabase
      .from(this.mapping.table)
      .upsert(row, { onConflict: this.mapping.pk });
    if (error) throw error;
    return true;
  }

  async update(data) {
    const row = docToRow(this.col, this.id, data);
    delete row[this.mapping.pk];
    const { error } = await supabase
      .from(this.mapping.table)
      .update(row)
      .eq(this.mapping.pk, this.id);
    if (error) throw error;
    return true;
  }

  async delete() {
    const { error } = await supabase
      .from(this.mapping.table)
      .delete()
      .eq(this.mapping.pk, this.id);
    if (error) throw error;
    return true;
  }
}

class CollectionReference {
  constructor(col) {
    this.col = col;
    this.mapping = TABLE_MAP[col] || { table: col, pk: "id" };
    this.filters = [];
    this.orders = [];
    this.limitCount = null;
  }

  doc(id) {
    return new DocumentReference(this.col, id);
  }

  where(field, op, val) {
    const q = new CollectionReference(this.col);
    q.filters = [...this.filters, { field, op, val }];
    q.orders = [...this.orders];
    q.limitCount = this.limitCount;
    return q;
  }

  orderBy(field, dir = "asc") {
    const q = new CollectionReference(this.col);
    q.filters = [...this.filters];
    q.orders = [...this.orders, { field, dir }];
    q.limitCount = this.limitCount;
    return q;
  }

  limit(n) {
    const q = new CollectionReference(this.col);
    q.filters = [...this.filters];
    q.orders = [...this.orders];
    q.limitCount = n;
    return q;
  }

  count() {
    return {
      get: async () => {
        let req = supabase
          .from(this.mapping.table)
          .select("*", { count: "exact", head: true });
        for (const f of this.filters) {
          if (f.op === "==") req = req.eq(f.field, f.val);
        }
        const { count, error } = await req;
        return { data: () => ({ count: count || 0 }) };
      },
    };
  }

  async add(data) {
    const id = genId();
    const docRef = this.doc(id);
    await docRef.set(data);
    return docRef;
  }

  async get() {
    let req = supabase.from(this.mapping.table).select("*");
    for (const f of this.filters) {
      if (f.op === "==") {
        const field =
          f.field === "removed"
            ? "removed"
            : f.field === "uid"
              ? "uid"
              : f.field;
        req = req.eq(field, f.val);
      }
    }
    for (const o of this.orders) {
      const colField =
        o.field === "at"
          ? "created_at"
          : o.field === "order"
            ? "order_index"
            : o.field;
      req = req.order(colField, { ascending: o.dir !== "desc" });
    }
    if (this.limitCount) {
      req = req.limit(this.limitCount);
    }

    const { data, error } = await req;
    if (error) throw error;

    const docs = (data || []).map((row) => {
      const docObj = rowToDoc(this.col, row);
      return {
        id: docObj.id,
        data: docObj.data,
        ref: this.doc(docObj.id),
      };
    });

    return {
      empty: docs.length === 0,
      size: docs.length,
      docs,
      forEach: (fn) => docs.forEach(fn),
    };
  }
}

class Batch {
  constructor() {
    this.ops = [];
  }
  set(docRef, data) {
    this.ops.push(() => docRef.set(data));
    return this;
  }
  update(docRef, data) {
    this.ops.push(() => docRef.update(data));
    return this;
  }
  delete(docRef) {
    this.ops.push(() => docRef.delete());
    return this;
  }
  async commit() {
    await Promise.all(this.ops.map((fn) => fn()));
    return true;
  }
}

const db = {
  collection: (col) => new CollectionReference(col),
  batch: () => new Batch(),
};

// -------------------------------------------------------------
// READ ALL DATA (Powers /api/data)
// -------------------------------------------------------------

async function readAllFromSupabase() {
  if (!supabase) throw new Error("Supabase is not initialized");

  const [
    playersRes,
    sessionsRes,
    legacyRes,
    plansRes,
    rulesRes,
    warmupRes,
    adminsRes,
    accountsRes,
    configRes,
    availRes,
    announcementsRes,
  ] = await Promise.all([
    supabase.from("players").select("*").order("n", { ascending: true }),
    supabase.from("sessions").select("*"),
    supabase.from("legacy_attendance").select("*"),
    supabase.from("practice_plans").select("*"),
    supabase
      .from("hockey_rules")
      .select("*")
      .order("order_index", { ascending: true }),
    supabase
      .from("warmup_drills")
      .select("*")
      .order("order_index", { ascending: true }),
    supabase
      .from("admins")
      .select("id, name, disabled, photo, created_at, kind, player_id"),
    supabase.from("accounts").select("player_id"),
    supabase.from("app_config").select("key, value"),
    supabase.from("player_availability").select("*"),
    supabase
      .from("announcements")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (playersRes.error) throw playersRes.error;

  const configMap = {};
  (configRes.data || []).forEach((row) => {
    configMap[row.key] = row.value;
  });

  const out = {
    players: (playersRes.data || []).map((p) => ({
      id: p.id,
      name: p.name,
      roll: p.roll,
      position: p.position || "",
      joined: p.joined || "",
      n: p.n || 0,
      size: p.size || "",
      contact: p.contact || "",
      jerseyName: p.jersey_name || "",
      email: p.email || "",
      jerseyNo: p.jersey_no || "",
      photo: p.photo || "",
      removed: !!p.removed,
    })),
    sessions: {},
    legacy: {},
    plans: {},
    rules: (rulesRes.data || []).map((r) => ({
      id: r.id,
      title: r.title,
      icon: r.icon,
      order: r.order_index,
      items: r.items || [],
    })),
    warmup: (warmupRes.data || []).map((w) => ({
      id: w.id,
      title: w.title,
      icon: w.icon,
      order: w.order_index,
      items: w.items || [],
    })),
    admins: (adminsRes.data || []).map((a) => ({
      id: a.id,
      name: a.name,
      disabled: !!a.disabled,
      photo: a.photo || "",
      created: a.created_at || 0,
      kind: a.kind || "",
      playerId: a.player_id || "",
    })),
    avail: {},
    announcements: (announcementsRes.data || []).map((an) => ({
      id: an.id,
      title: an.title,
      text: an.text,
      pinned: !!an.pinned,
      by: an.by_name,
      role: an.role,
      at: an.created_at,
    })),
  };

  (sessionsRes.data || []).forEach((s) => {
    out.sessions[s.date] = s.r || {};
  });
  (legacyRes.data || []).forEach((l) => {
    out.legacy[l.month] = { days: l.days, att: l.att || {} };
  });
  (plansRes.data || []).forEach((p) => {
    out.plans[p.date] = {
      time: p.time || "",
      venue: p.venue || "",
      note: p.note || "",
      status: p.status || "planned",
      tags: p.tags || [],
    };
  });
  (availRes.data || []).forEach((av) => {
    out.avail[av.date] = av.r || {};
  });

  out.group = (configMap.group && configMap.group.url) || "";
  out.groupPhotoAt = (configMap.groupPhoto && configMap.groupPhoto.at) || 0;
  out.matches =
    configMap.matches && Array.isArray(configMap.matches.items)
      ? configMap.matches.items
      : null;
  out.staff = configMap.staff || {};
  out.names = configMap.staffNames || {};

  // Team summary
  const nv = out.names,
    lk = nv.links || {},
    pl2 = (k) => out.players.find((x) => x.id === lk[k] && !x.removed) || null;
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
    about: nv.about || "",
  };

  out.accounts = (accountsRes.data || []).map((ac) => ac.player_id);
  out.template = (configMap.template && configMap.template.text) || "";

  const sd = configMap.schedule || null;
  const rows = (a) =>
    a.map((o) => [o.d, o.t, o.x, o.m, Array.isArray(o.g) ? o.g : []]);
  out.schedule =
    sd && sd.team && sd.gk ? { team: rows(sd.team), gk: rows(sd.gk) } : null;

  return out;
}

// Direct data getters
async function getPlayers(includeRemoved = false) {
  let q = supabase.from("players").select("*").order("n", { ascending: true });
  if (!includeRemoved) q = q.eq("removed", false);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function getPlayer(id) {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getSessions() {
  const { data, error } = await supabase
    .from("sessions")
    .select("date, r")
    .order("date", { ascending: true });
  if (error) throw error;
  const out = {};
  (data || []).forEach((row) => {
    out[row.date] = row.r || {};
  });
  return out;
}

async function getLegacy() {
  const { data, error } = await supabase
    .from("legacy_attendance")
    .select("month, days, att");
  if (error) throw error;
  const out = {};
  (data || []).forEach((row) => {
    out[row.month] = { days: row.days, att: row.att || {} };
  });
  return out;
}

async function getPracticePlans() {
  const { data, error } = await supabase
    .from("practice_plans")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw error;
  const out = {};
  (data || []).forEach((p) => {
    out[p.date] = {
      time: p.time,
      venue: p.venue,
      note: p.note,
      status: p.status,
      tags: p.tags || [],
    };
  });
  return out;
}

async function getAppConfig(key) {
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}

async function getHockeyRules() {
  const { data, error } = await supabase
    .from("hockey_rules")
    .select("*")
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    title: r.title,
    icon: r.icon,
    order: r.order_index,
    items: r.items || [],
  }));
}

async function getWarmupDrills() {
  const { data, error } = await supabase
    .from("warmup_drills")
    .select("*")
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data || []).map((w) => ({
    id: w.id,
    title: w.title,
    icon: w.icon,
    order: w.order_index,
    items: w.items || [],
  }));
}

module.exports = {
  supabase,
  db,
  getDb: () => db,
  readAllFromSupabase,
  getPlayers,
  getPlayer,
  getSessions,
  getLegacy,
  getPracticePlans,
  getAppConfig,
  getHockeyRules,
  getWarmupDrills,
};
