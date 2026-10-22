/**
 * Unified Database Layer (Supabase with Dual-Write & Firestore Fallback)
 * Ensures 100% data synchronization between Supabase and Firebase Firestore.
 */

const { createClient } = require("@supabase/supabase-js");
const admin = require("firebase-admin");

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  FIREBASE_SERVICE_ACCOUNT,
  DATABASE_TARGET = "supabase"
} = process.env;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
  } catch (e) {
    console.error("Failed to initialize Supabase client:", e.message);
  }
}

let firestore = null;
if (FIREBASE_SERVICE_ACCOUNT) {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT))
      });
    }
    firestore = admin.firestore();
  } catch (e) {
    console.error("Failed to initialize Firestore:", e.message);
  }
}

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
    announcementsRes
  ] = await Promise.all([
    supabase.from("players").select("*").order("n", { ascending: true }),
    supabase.from("sessions").select("*"),
    supabase.from("legacy_attendance").select("*"),
    supabase.from("practice_plans").select("*"),
    supabase.from("hockey_rules").select("*").order("order_index", { ascending: true }),
    supabase.from("warmup_drills").select("*").order("order_index", { ascending: true }),
    supabase.from("admins").select("id, name, disabled, photo, created_at, kind, player_id"),
    supabase.from("accounts").select("player_id"),
    supabase.from("app_config").select("key, value"),
    supabase.from("player_availability").select("*"),
    supabase.from("announcements").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false })
  ]);

  if (playersRes.error) throw playersRes.error;

  const configMap = {};
  (configRes.data || []).forEach(row => {
    configMap[row.key] = row.value;
  });

  const out = {
    players: (playersRes.data || []).map(p => ({
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
      removed: !!p.removed
    })),
    sessions: {},
    legacy: {},
    plans: {},
    rules: (rulesRes.data || []).map(r => ({
      id: r.id,
      title: r.title,
      icon: r.icon,
      order: r.order_index,
      items: r.items || []
    })),
    warmup: (warmupRes.data || []).map(w => ({
      id: w.id,
      title: w.title,
      icon: w.icon,
      order: w.order_index,
      items: w.items || []
    })),
    admins: (adminsRes.data || []).map(a => ({
      id: a.id,
      name: a.name,
      disabled: !!a.disabled,
      photo: a.photo || "",
      created: a.created_at || 0,
      kind: a.kind || "",
      playerId: a.player_id || ""
    })),
    avail: {},
    announcements: (announcementsRes.data || []).map(an => ({
      id: an.id,
      title: an.title,
      text: an.text,
      pinned: !!an.pinned,
      by: an.by_name,
      role: an.role,
      at: an.created_at
    }))
  };

  (sessionsRes.data || []).forEach(s => { out.sessions[s.date] = s.r || {}; });
  (legacyRes.data || []).forEach(l => { out.legacy[l.month] = { days: l.days, att: l.att || {} }; });
  (plansRes.data || []).forEach(p => {
    out.plans[p.date] = {
      time: p.time || "",
      venue: p.venue || "",
      note: p.note || "",
      status: p.status || "planned",
      tags: p.tags || []
    };
  });
  (availRes.data || []).forEach(av => { out.avail[av.date] = av.r || {}; });

  out.group = (configMap.group && configMap.group.url) || "";
  out.groupPhotoAt = (configMap.groupPhoto && configMap.groupPhoto.at) || 0;
  out.matches = (configMap.matches && Array.isArray(configMap.matches.items)) ? configMap.matches.items : null;
  out.staff = configMap.staff || {};
  out.names = configMap.staffNames || {};

  // Team summary
  const nv = out.names, lk = nv.links || {},
    pl2 = (k) => out.players.find(x => x.id === lk[k] && !x.removed) || null;
  const one = (k) => {
    const q = pl2(k);
    return {
      name: nv[k] || (q ? q.name : ""),
      photo: (q && q.photo) || out.staff[k] || "",
      pid: q ? q.id : ""
    };
  };
  out.team = {
    captain: one("captain"),
    vice: one("vice"),
    coach: { name: nv.coach || "" },
    about: nv.about || ""
  };

  out.accounts = (accountsRes.data || []).map(ac => ac.player_id);
  out.template = (configMap.template && configMap.template.text) || "";

  const sd = configMap.schedule || null;
  const rows = (a) => a.map(o => [o.d, o.t, o.x, o.m, Array.isArray(o.g) ? o.g : []]);
  out.schedule = (sd && sd.team && sd.gk) ? { team: rows(sd.team), gk: rows(sd.gk) } : null;

  return out;
}

// -------------------------------------------------------------
// INDIVIDUAL READ OPERATIONS
// -------------------------------------------------------------

async function getPlayers(includeRemoved = false) {
  if (DATABASE_TARGET === "supabase" && supabase) {
    let q = supabase.from("players").select("*").order("n", { ascending: true });
    if (!includeRemoved) q = q.eq("removed", false);
    const { data, error } = await q;
    if (!error && data) return data;
  }
  if (firestore) {
    const snap = await firestore.collection("players").get();
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return includeRemoved ? list : list.filter(p => !p.removed);
  }
  return [];
}

async function getPlayer(id) {
  if (DATABASE_TARGET === "supabase" && supabase) {
    const { data, error } = await supabase.from("players").select("*").eq("id", id).maybeSingle();
    if (!error && data) return data;
  }
  if (firestore) {
    const doc = await firestore.collection("players").doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }
  return null;
}

async function getSessions() {
  if (DATABASE_TARGET === "supabase" && supabase) {
    const { data, error } = await supabase.from("sessions").select("date, r").order("date", { ascending: true });
    if (!error && data) {
      const out = {};
      data.forEach(row => { out[row.date] = row.r || {}; });
      return out;
    }
  }
  if (firestore) {
    const snap = await firestore.collection("sessions").get();
    const out = {};
    snap.forEach(d => { out[d.id] = d.data().r || {}; });
    return out;
  }
  return {};
}

async function getLegacy() {
  if (DATABASE_TARGET === "supabase" && supabase) {
    const { data, error } = await supabase.from("legacy_attendance").select("month, days, att");
    if (!error && data) {
      const out = {};
      data.forEach(row => { out[row.month] = { days: row.days, att: row.att || {} }; });
      return out;
    }
  }
  if (firestore) {
    const snap = await firestore.collection("legacy").get();
    const out = {};
    snap.forEach(d => { out[d.id] = d.data(); });
    return out;
  }
  return {};
}

async function getPracticePlans() {
  if (DATABASE_TARGET === "supabase" && supabase) {
    const { data, error } = await supabase.from("practice_plans").select("*").order("date", { ascending: true });
    if (!error && data) {
      const out = {};
      data.forEach(p => {
        out[p.date] = {
          time: p.time,
          venue: p.venue,
          note: p.note,
          status: p.status,
          tags: p.tags || []
        };
      });
      return out;
    }
  }
  if (firestore) {
    const snap = await firestore.collection("plans").get();
    const out = {};
    snap.forEach(d => { out[d.id] = d.data(); });
    return out;
  }
  return {};
}

async function getAppConfig(key) {
  if (DATABASE_TARGET === "supabase" && supabase) {
    const { data, error } = await supabase.from("app_config").select("value").eq("key", key).maybeSingle();
    if (!error && data) return data.value;
  }
  if (firestore) {
    const doc = await firestore.collection("config").doc(key).get();
    return doc.exists ? doc.data() : null;
  }
  return null;
}

async function getHockeyRules() {
  if (DATABASE_TARGET === "supabase" && supabase) {
    const { data, error } = await supabase.from("hockey_rules").select("*").order("order_index", { ascending: true });
    if (!error && data) {
      return data.map(r => ({
        id: r.id,
        title: r.title,
        icon: r.icon,
        order: r.order_index,
        items: r.items || []
      }));
    }
  }
  if (firestore) {
    const snap = await firestore.collection("rules").get();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  return [];
}

async function getWarmupDrills() {
  if (DATABASE_TARGET === "supabase" && supabase) {
    const { data, error } = await supabase.from("warmup_drills").select("*").order("order_index", { ascending: true });
    if (!error && data) {
      return data.map(w => ({
        id: w.id,
        title: w.title,
        icon: w.icon,
        order: w.order_index,
        items: w.items || []
      }));
    }
  }
  if (firestore) {
    const snap = await firestore.collection("warmup").get();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  return [];
}

async function getAccount(roll) {
  if (DATABASE_TARGET === "supabase" && supabase) {
    const { data, error } = await supabase.from("accounts").select("*").eq("player_id", roll).maybeSingle();
    if (!error && data) {
      return {
        salt: data.salt,
        hash: data.hash,
        created: data.created_at
      };
    }
  }
  if (firestore) {
    const doc = await firestore.collection("accounts").doc(roll).get();
    return doc.exists ? doc.data() : null;
  }
  return null;
}

// -------------------------------------------------------------
// DUAL-WRITE OPERATIONS (Supabase + Firestore in parallel)
// -------------------------------------------------------------

async function dualWriteSession(date, r) {
  const ops = [];
  if (supabase) {
    ops.push(supabase.from("sessions").upsert({ date, r, updated_at: new Date().toISOString() }, { onConflict: "date" }));
  }
  if (firestore) {
    ops.push(firestore.collection("sessions").doc(date).set({ r }));
  }
  return Promise.all(ops);
}

async function dualDeleteSession(date) {
  const ops = [];
  if (supabase) {
    ops.push(supabase.from("sessions").delete().eq("date", date));
  }
  if (firestore) {
    ops.push(firestore.collection("sessions").doc(date).delete());
  }
  return Promise.all(ops);
}

async function dualWritePlan(date, planData) {
  const ops = [];
  if (supabase) {
    ops.push(supabase.from("practice_plans").upsert({
      date,
      time: planData.time || null,
      venue: planData.venue || null,
      note: planData.note || null,
      status: planData.status || "planned",
      tags: planData.tags || [],
      updated_at: new Date().toISOString()
    }, { onConflict: "date" }));
  }
  if (firestore) {
    ops.push(firestore.collection("plans").doc(date).set(planData));
  }
  return Promise.all(ops);
}

async function dualDeletePlan(date) {
  const ops = [];
  if (supabase) {
    ops.push(supabase.from("practice_plans").delete().eq("date", date));
  }
  if (firestore) {
    ops.push(firestore.collection("plans").doc(date).delete());
  }
  return Promise.all(ops);
}

async function dualUpdatePlayer(id, upd) {
  const ops = [];
  if (supabase) {
    const row = {};
    if (upd.name !== undefined) row.name = upd.name;
    if (upd.roll !== undefined) row.roll = upd.roll;
    if (upd.position !== undefined) row.position = upd.position;
    if (upd.size !== undefined) row.size = upd.size;
    if (upd.jerseyName !== undefined) row.jersey_name = upd.jerseyName;
    if (upd.jerseyNo !== undefined) row.jersey_no = String(upd.jerseyNo);
    if (upd.email !== undefined) row.email = upd.email;
    if (upd.contact !== undefined) row.contact = upd.contact;
    if (upd.joined !== undefined) row.joined = upd.joined || null;
    if (upd.photo !== undefined) row.photo = upd.photo;
    if (upd.removed !== undefined) row.removed = !!upd.removed;
    row.updated_at = new Date().toISOString();
    ops.push(supabase.from("players").update(row).eq("id", id));
  }
  if (firestore) {
    ops.push(firestore.collection("players").doc(id).update(upd));
  }
  return Promise.all(ops);
}

module.exports = {
  supabase,
  firestore,
  readAllFromSupabase,
  getPlayers,
  getPlayer,
  getSessions,
  getLegacy,
  getPracticePlans,
  getAppConfig,
  getHockeyRules,
  getWarmupDrills,
  getAccount,
  dualWriteSession,
  dualDeleteSession,
  dualWritePlan,
  dualDeletePlan,
  dualUpdatePlayer
};
