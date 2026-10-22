/**
 * Unified Database Layer (Supabase with Firebase Fallback)
 * Provides clean asynchronous data access for the IIT Patna Hockey backend and AI Chatbot.
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
// READ OPERATIONS
// -------------------------------------------------------------

async function getPlayers(includeRemoved = false) {
  if (DATABASE_TARGET === "supabase" && supabase) {
    let q = supabase.from("players").select("*").order("n", { ascending: true });
    if (!includeRemoved) q = q.eq("removed", false);
    const { data, error } = await q;
    if (!error && data) return data;
    console.warn("Supabase getPlayers error, falling back to Firestore:", error && error.message);
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

module.exports = {
  supabase,
  firestore,
  getPlayers,
  getPlayer,
  getSessions,
  getLegacy,
  getPracticePlans,
  getAppConfig,
  getHockeyRules,
  getWarmupDrills,
  getAccount
};
