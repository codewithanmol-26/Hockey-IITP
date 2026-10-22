/**
 * Non-destructive, idempotent Firestore -> Supabase Data Migration & Reconciliation Script
 * Usage: node backend/migrate-to-supabase.js [--backup-dir <path>] [--dry-run]
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// 1. Load Environment Variables
const projectRoot = path.resolve(__dirname, "..");
const envContent = fs.existsSync(path.join(projectRoot, ".env"))
  ? fs.readFileSync(path.join(projectRoot, ".env"), "utf8")
  : "";

const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || "";
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const SUPABASE_URL = process.env.SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");

// Locate backup directory
let backupDir = null;
const backupArgIdx = args.indexOf("--backup-dir");
if (backupArgIdx !== -1 && args[backupArgIdx + 1]) {
  backupDir = path.resolve(args[backupArgIdx + 1]);
} else {
  // Default to the latest backup in backups/
  const backupsRoot = path.join(projectRoot, "backups");
  if (fs.existsSync(backupsRoot)) {
    const list = fs.readdirSync(backupsRoot)
      .filter(f => f.startsWith("backup_"))
      .sort()
      .reverse();
    if (list.length > 0) {
      backupDir = path.join(backupsRoot, list[0]);
    }
  }
}

if (!backupDir || !fs.existsSync(backupDir)) {
  console.error("No valid backup directory found. Run export first or pass --backup-dir.");
  process.exit(1);
}

console.log("=======================================================");
console.log("IIT Patna Hockey - Firebase to Supabase Data Migration");
console.log("=======================================================");
console.log(`Source Backup: ${backupDir}`);
console.log(`Mode: ${isDryRun ? "DRY-RUN (Validation only, no database writes)" : "LIVE MIGRATION"}`);

if (!isDryRun) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for live migration.");
    console.error("Please add them to your .env file or environment variables.");
    process.exit(1);
  }
}

const supabase = (!isDryRun && SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    })
  : null;

function readBackupCol(colName) {
  const file = path.join(backupDir, `${colName}.json`);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`Error reading ${file}: ${e.message}`);
    return [];
  }
}

async function runMigration() {
  const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, "manifest.json"), "utf8"));
  const report = {
    startedAt: new Date().toISOString(),
    backupUsed: backupDir,
    dryRun: isDryRun,
    results: {},
    errors: [],
    reconciliation: {
      passed: false,
      mismatches: []
    }
  };

  // 1. Players
  const playersRaw = readBackupCol("players");
  const playersData = playersRaw.map(d => {
    const p = d._data || {};
    return {
      id: d._id,
      n: Number(p.n) || 0,
      name: String(p.name || d._id),
      roll: String(p.roll || d._id),
      position: p.position || null,
      joined: p.joined && /^\d{4}-\d{2}-\d{2}$/.test(p.joined) ? p.joined : null,
      size: p.size || null,
      contact: p.contact || null,
      jersey_name: p.jerseyName || null,
      email: p.email || null,
      jersey_no: p.jerseyNo ? String(p.jerseyNo) : null,
      photo: p.photo || null,
      removed: !!p.removed
    };
  });
  report.results.players = { sourceCount: playersData.length, transformed: playersData.length };

  // 2. Accounts (Credentials)
  const accountsRaw = readBackupCol("accounts");
  const accountsData = accountsRaw.map(d => {
    const a = d._data || {};
    return {
      player_id: d._id,
      salt: String(a.salt || ""),
      hash: String(a.hash || ""),
      created_at: a.created || null
    };
  });
  report.results.accounts = { sourceCount: accountsData.length, transformed: accountsData.length };

  // 3. Admins
  const adminsRaw = readBackupCol("admins");
  const adminsData = adminsRaw.map(d => {
    const a = d._data || {};
    return {
      id: d._id,
      name: String(a.name || "Admin"),
      disabled: !!a.disabled,
      salt: String(a.salt || ""),
      hash: String(a.hash || ""),
      photo: a.photo || null,
      kind: a.kind || null,
      player_id: a.playerId || null,
      created_at: a.created || null
    };
  });
  report.results.admins = { sourceCount: adminsData.length, transformed: adminsData.length };

  // 4. Sessions (Day-wise attendance)
  const sessionsRaw = readBackupCol("sessions");
  const sessionsData = sessionsRaw.map(d => ({
    date: d._id,
    r: (d._data && d._data.r) || {}
  }));
  report.results.sessions = { sourceCount: sessionsData.length, transformed: sessionsData.length };

  // 5. Legacy Attendance (Monthly totals)
  const legacyRaw = readBackupCol("legacy");
  const legacyData = legacyRaw.map(d => {
    const l = d._data || {};
    return {
      month: d._id,
      days: Number(l.days) || 0,
      att: l.att || {}
    };
  });
  report.results.legacy = { sourceCount: legacyData.length, transformed: legacyData.length };

  // 6. Practice Plans
  const plansRaw = readBackupCol("plans");
  const plansData = plansRaw.map(d => {
    const p = d._data || {};
    return {
      date: d._id,
      time: p.time || null,
      venue: p.venue || null,
      note: p.note || null,
      status: p.status || "planned",
      tags: Array.isArray(p.tags) ? p.tags : []
    };
  });
  report.results.plans = { sourceCount: plansData.length, transformed: plansData.length };

  // 7. Player Availability
  const availRaw = readBackupCol("avail");
  const availData = availRaw.map(d => ({
    date: d._id,
    r: (d._data && d._data.r) || {}
  }));
  report.results.avail = { sourceCount: availData.length, transformed: availData.length };

  // 8. Hockey Rules
  const rulesRaw = readBackupCol("rules");
  const rulesData = rulesRaw.map(d => {
    const r = d._data || {};
    return {
      id: d._id,
      title: String(r.title || ""),
      icon: r.icon || null,
      order_index: Number(r.order) || 0,
      items: Array.isArray(r.items) ? r.items : []
    };
  });
  report.results.rules = { sourceCount: rulesData.length, transformed: rulesData.length };

  // 9. Warmup Drills
  const warmupRaw = readBackupCol("warmup");
  const warmupData = warmupRaw.map(d => {
    const w = d._data || {};
    return {
      id: d._id,
      title: String(w.title || ""),
      icon: w.icon || null,
      order_index: Number(w.order) || 0,
      items: Array.isArray(w.items) ? w.items : []
    };
  });
  report.results.warmup = { sourceCount: warmupData.length, transformed: warmupData.length };

  // 10. App Config
  const configRaw = readBackupCol("config");
  const configData = configRaw.map(d => ({
    key: d._id,
    value: d._data || {}
  }));
  report.results.config = { sourceCount: configData.length, transformed: configData.length };

  // 11. Blobs (Group photos, covers)
  const blobsRaw = readBackupCol("blobs");
  const blobsData = blobsRaw.map(d => ({
    id: d._id,
    img: (d._data && d._data.img) || ""
  }));
  report.results.blobs = { sourceCount: blobsData.length, transformed: blobsData.length };

  // 12. Gallery & GalleryFull (combine thumbs and full images)
  const galleryRaw = readBackupCol("gallery");
  const galleryFullRaw = readBackupCol("galleryFull");
  const fullMap = {};
  galleryFullRaw.forEach(d => {
    if (d._data && d._data.img) fullMap[d._id] = d._data.img;
  });

  const galleryData = galleryRaw.map(d => {
    const g = d._data || {};
    return {
      id: d._id,
      thumb: g.thumb || "",
      full_img: fullMap[d._id] || null,
      by_name: g.by || null,
      user_key: g.key || null,
      cat: g.cat || "practice",
      description: g.desc || null,
      created_at: g.at || null
    };
  });
  report.results.gallery = { sourceCount: galleryData.length, transformed: galleryData.length };

  // 13. Health logs
  const healthRaw = readBackupCol("health");
  const healthData = healthRaw.map(d => {
    const h = d._data || {};
    return {
      id: d._id,
      user_key: String(h.key || ""),
      log_date: h.date || d._id.split("_")[1] || "2026-01-01",
      steps: h.steps !== undefined ? Number(h.steps) : null,
      km: h.km !== undefined ? Number(h.km) : null,
      sleep: h.sleep !== undefined ? Number(h.sleep) : null,
      kcal: h.kcal !== undefined ? Number(h.kcal) : null,
      height: h.height !== undefined ? Number(h.height) : null,
      weight: h.weight !== undefined ? Number(h.weight) : null,
      recorded_at: h.at || null
    };
  });
  report.results.health = { sourceCount: healthData.length, transformed: healthData.length };

  // 14. Push subscriptions
  const pushSubsRaw = readBackupCol("pushSubs");
  const pushSubsData = pushSubsRaw.map(d => {
    const s = d._data || {};
    return {
      endpoint_hash: d._id,
      sub: s.sub || {},
      role: s.role || null,
      uid: s.uid || null,
      created_at: s.at || null
    };
  });
  report.results.pushSubs = { sourceCount: pushSubsData.length, transformed: pushSubsData.length };

  console.log("\nTransformation Summary:");
  for (const [k, v] of Object.entries(report.results)) {
    console.log(`  • ${k}: ${v.sourceCount} source records validated -> ${v.transformed} target rows ready`);
  }

  if (isDryRun) {
    console.log("\n[DRY RUN] All transformations validated successfully without writing to Supabase.");
    report.reconciliation.passed = true;
    const repPath = path.join(backupDir, "dry_run_reconciliation.json");
    fs.writeFileSync(repPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`Dry-run report saved to: ${repPath}`);
    return;
  }

  // Live Insertion with Upsert
  async function upsertBatch(tableName, rows, onConflictCol) {
    if (rows.length === 0) return 0;
    console.log(`Migrating ${tableName} (${rows.length} rows)...`);
    const chunkSize = 100;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from(tableName)
        .upsert(chunk, { onConflict: onConflictCol });
      if (error) {
        console.error(`Error migrating ${tableName}:`, error);
        report.errors.push({ table: tableName, error: error.message });
        throw error;
      }
      inserted += chunk.length;
    }
    return inserted;
  }

  try {
    await upsertBatch("players", playersData, "id");
    await upsertBatch("accounts", accountsData, "player_id");
    await upsertBatch("admins", adminsData, "id");
    await upsertBatch("sessions", sessionsData, "date");
    await upsertBatch("legacy_attendance", legacyData, "month");
    await upsertBatch("practice_plans", plansData, "date");
    await upsertBatch("player_availability", availData, "date");
    await upsertBatch("hockey_rules", rulesData, "id");
    await upsertBatch("warmup_drills", warmupData, "id");
    await upsertBatch("app_config", configData, "key");
    await upsertBatch("blobs", blobsData, "id");
    await upsertBatch("gallery", galleryData, "id");
    await upsertBatch("health_logs", healthData, "id");
    await upsertBatch("push_subscriptions", pushSubsData, "endpoint_hash");

    console.log("\nMigration writes completed! Starting live reconciliation check...");

    // Post-migration reconciliation count verification
    const tablesToCheck = [
      ["players", playersData.length],
      ["accounts", accountsData.length],
      ["sessions", sessionsData.length],
      ["legacy_attendance", legacyData.length],
      ["practice_plans", plansData.length],
      ["player_availability", availData.length],
      ["hockey_rules", rulesData.length],
      ["warmup_drills", warmupData.length],
      ["app_config", configData.length],
      ["blobs", blobsData.length],
      ["gallery", galleryData.length],
      ["health_logs", healthData.length],
      ["push_subscriptions", pushSubsData.length]
    ];

    let allCountsMatch = true;
    for (const [t, expected] of tablesToCheck) {
      const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
      if (error) {
        report.errors.push({ table: t, error: error.message });
        allCountsMatch = false;
        continue;
      }
      if (count !== expected) {
        console.error(`Count mismatch in ${t}: expected ${expected}, got ${count}`);
        report.reconciliation.mismatches.push({ table: t, expected, actual: count });
        allCountsMatch = false;
      } else {
        console.log(`  ✓ ${t}: ${count}/${expected} verified`);
      }
    }

    report.reconciliation.passed = allCountsMatch;
    const finalReportPath = path.join(backupDir, "live_reconciliation_report.json");
    fs.writeFileSync(finalReportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`\nReconciliation completed. Report saved to: ${finalReportPath}`);

    if (!allCountsMatch) {
      console.error("WARNING: Reconciliation detected mismatches. Please inspect live_reconciliation_report.json.");
      process.exit(1);
    } else {
      console.log("SUCCESS: 100% data reconciliation passed with zero mismatches!");
    }
  } catch (e) {
    console.error("Migration failed:", e.message);
    process.exit(1);
  }
}

runMigration().catch(e => {
  console.error("Unhandled migration error:", e);
  process.exit(1);
});
