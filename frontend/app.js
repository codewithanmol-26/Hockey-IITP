const API = (window.API_URL || "").replace(/\/$/, "");
let token = "";
try {
  token = localStorage.getItem("hk_token") || "";
} catch (e) {}
async function api(path, o = {}) {
  const r = await fetch(API + path, {
    method: o.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: o.body ? JSON.stringify(o.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.error || "Error " + r.status);
    e.status = r.status;
    throw e;
  }
  return j;
}
let SCH = {
  team: [
    ["Monday", "Rest day", "Recovery, no scheduled session", ""],
    [
      "Tuesday",
      "Ball control & passing",
      "Dribbling, trapping, passing triangles, pressure receiving, 1v1s",
      "6:30–8:30 PM",
    ],
    [
      "Wednesday",
      "Set pieces + fitness",
      "Penalty corners, free hits, agility",
      "6:30–8:30 PM",
    ],
    [
      "Thursday",
      "Tactical & defense",
      "Team shape, press, transitions, tackling & covering",
      "6:30–8:30 PM",
    ],
    [
      "Friday",
      "Shooting + match simulation",
      "Circle entries, finishing drills, full-pitch scrimmage at game speed",
      "6:30–8:30 PM",
    ],
    [
      "Saturday",
      "Position-specific work",
      "FWD circle entries, DEF tackling, GK reflexes",
      "5:30–7:30 AM",
    ],
    [
      "Sunday",
      "Full match",
      "Stretching and warm-up, then full match play",
      "5:30–7:30 AM",
    ],
  ],
  gk: [
    ["Monday", "Rest day", "Recovery, no scheduled session", ""],
    [
      "Tuesday",
      "Reflex & shot-stopping",
      "Close-range reaction saves, low/high ball drills, hand-eye reflex work",
      "6:30–8:30 PM",
    ],
    [
      "Wednesday",
      "PC defense + fitness",
      "Penalty corner stopping, rushing angles, explosive power & agility",
      "6:30–8:30 PM",
    ],
    [
      "Thursday",
      "Footwork & positioning",
      "Angle play, narrowing shots, lateral movement, communication with defense",
      "6:30–8:30 PM",
    ],
    [
      "Friday",
      "Aerial saves + match simulation",
      "High ball handling, rebound control, live match-speed scenarios",
      "6:30–8:30 PM",
    ],
    [
      "Saturday",
      "1v1 & rebound control",
      "Breakaway defending, second-save reactions, distribution after saves",
      "5:30–7:30 AM",
    ],
    [
      "Sunday",
      "Full match",
      "Stretching and warm-up, then full match play",
      "5:30–7:30 AM",
    ],
  ],
};
const SCH0 = JSON.stringify(SCH);
let P = [],
  RM = [],
  me = "",
  WHO = "",
  role = "",
  SS = {},
  L = {},
  PL = {},
  AVL = {},
  admin = false,
  loaded = false,
  err = "",
  tab = "me",
  selDate = today(),
  takeDate = today(),
  selMonth = "",
  gMonth = "all",
  draft = {},
  draftDate = null,
  sch = "team",
  prof = null,
  STAFF = {},
  ADMID = "",
  MYPH = "";
function today() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (d) =>
  new Date(d + "T00:00").toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const mfmt = (m) =>
  new Date(m + "-01T00:00").toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
const dates = () => Object.keys(SS).sort();
const months = () =>
  [
    ...new Set([...Object.keys(L), ...dates().map((d) => d.slice(0, 7))]),
  ].sort();
const rdays = (m) =>
  m === "all"
    ? Object.keys(L).reduce((a, k) => a + L[k].days, 0) + dates().length
    : (L[m] ? L[m].days : 0) + dates().filter((d) => d.startsWith(m)).length;
async function run(fn) {
  try {
    await fn();
  } catch (e) {
    if (e.status === 401) {
      alert("Your login expired or was switched off. Please log in again.");
      load(true);
    } else alert("Could not save: " + e.message);
  }
}

function stats(m) {
  return P.map((p) => {
    let t = 0,
      pr = 0;
    const j = (p.joined || "0000-00").slice(0, 7);
    for (const k in L)
      if ((m === "all" || k === m) && j <= k) {
        t += L[k].days;
        pr += L[k].att[p.id] || 0;
      }
    for (const d in SS)
      if (m === "all" || d.startsWith(m)) {
        const r = SS[d][p.id];
        if (r !== undefined) {
          t++;
          if (r) pr++;
        }
      }
    return { p, pr, t, pct: t ? Math.round((pr * 100) / t) : 0 };
  });
}

let RL = [],
  WL = [],
  ADM = [],
  ACC = [],
  TPL = "",
  pl = false,
  owner = false,
  openS = { rules: new Set([0]), warmup: new Set([0]) },
  lastJs = "";

// ---- all tabs. [id, icon, full name, who sees it (a = admins, o = captain/vice only), short name for the bar] ----
const TABS = [
  ["me", "🏠", "Home", "", "Home"],
  ["take", "✅", "Take attendance", "a", "Take"],
  ["plan", "📅", "Playing days", "", "Days"],
  ["stats", "📊", "Attendance", "", "Stats"],
  ["schedule", "⏰", "Schedule", "", "Schedule"],
  ["rules", "📖", "Rules", "", ""],
  ["warmup", "🔥", "Warm-up", "", ""],
  ["players", "👥", "Players", "a", ""],
  ["removed", "🗑️", "Removed students", "a", ""],
  ["admins", "🛡️", "Admins", "o", ""],
];
const PRIMARY = ["me", "take", "plan", "stats", "schedule"];
const tabsFor = () =>
  TABS.filter(
    (t) => !t[3] || (t[3] === "a" && admin) || (t[3] === "o" && owner),
  );
const go = (t) => {
  tab = t;
  prof = null;
  render();
  window.scrollTo(0, 0);
};
const empty = (e, t) =>
  `<div class="empty"><span class="e">${e}</span>${t}</div>`;

// ---- screens: login page first, then the app ----
function showLogin() {
  $("app").hidden = true;
  $("login").hidden = false;
  $("menu").hidden = true;
  $("pr").value = "";
  $("pa").innerHTML = "";
  $("pgo").hidden = false;
  $("pe").textContent = "";
  $("er").textContent = "";
  $("pw").value = "";
  $("an").value = "";
  pStep = "roll";
  loginTab("player");
  document.title = "Hockey Attendance · Log in";
  syncInstall();
}
function showApp() {
  $("login").hidden = true;
  $("app").hidden = false;
  document.title = "Hockey Attendance";
}
function loginTab(m) {
  const pm = m !== "admin";
  $("pf").hidden = !pm;
  $("lf").hidden = pm;
  $("t1").classList.toggle("on", pm);
  $("t2").classList.toggle("on", !pm);
}
$("t1").onclick = () => loginTab("player");
$("t2").onclick = () => loginTab("admin");
$("em").onchange = () => {
  $("anw").hidden = $("em").value !== "admin";
};
function saveToken(t) {
  token = t;
  try {
    localStorage.setItem("hk_token", t);
  } catch (x) {}
}
function logout() {
  token = "";
  try {
    localStorage.removeItem("hk_token");
  } catch (e) {}
  loaded = false;
  lastJs = "";
  admin = false;
  pl = false;
  owner = false;
  me = "";
  tab = "me";
  prof = null;
  MYPH = "";
  P = [];
  RM = [];
  SS = {};
  L = {};
  PL = {};
  AVL = {};
  showLogin();
}
function boot() {
  if (!token) return showLogin();
  showApp();
  render();
  load(true);
}

async function load(force) {
  if (!token) return;
  try {
    const d = await api("/api/data");
    const key = JSON.stringify(d);
    if (!force && key === lastJs && loaded && !err) return;
    lastJs = key;
    role = d.role;
    admin = ["captain", "vice", "admin"].includes(role);
    pl = role === "player";
    me = d.me || "";
    owner = role === "captain" || role === "vice";
    WHO =
      d.name ||
      (role === "captain"
        ? "Captain"
        : role === "vice"
          ? "Vice-captain"
          : "Admin");
    const by = (a, b) =>
        (a.n || 999) - (b.n || 999) ||
        String(a.name).localeCompare(String(b.name)),
      all = d.players || [];
    P = all.filter((p) => !p.removed).sort(by);
    RM = all
      .filter((p) => p.removed)
      .sort((a, b) => (b.removedAt || 0) - (a.removedAt || 0));
    SS = d.sessions;
    L = d.legacy;
    PL = d.plans;
    AVL = d.avail || {};
    RL = d.rules || [];
    WL = d.warmup || [];
    ADM = d.admins || [];
    ACC = d.accounts || [];
    TPL = d.template || "";
    SCH = d.schedule && d.schedule.team ? d.schedule : JSON.parse(SCH0);
    GROUP = d.group || window.WA_GROUP || "";
    STAFF = d.staff || {};
    ADMID = d.adminId || "";
    MYPH = pl ? (all[0] || {}).photo || "" : d.myPhoto || "";
    loaded = true;
    err = "";
    showApp();
    render();
    checkAlerts();
  } catch (e) {
    if (e.status === 401) {
      token = "";
      try {
        localStorage.removeItem("hk_token");
      } catch (x) {}
      loaded = false;
      lastJs = "";
      showLogin();
      return;
    }
    err = e.status
      ? "The server replied: " + e.message
      : "Cannot reach the server. Check your connection and try again.";
    showApp();
    render();
  }
}

// ---- staff login ----
$("lf").onsubmit = async (e) => {
  e.preventDefault();
  $("er").textContent = "";
  try {
    const r = await api("/api/login", {
      method: "POST",
      body: {
        role: $("em").value,
        name: $("an").value.trim(),
        code: $("pw").value.trim(),
      },
    });
    saveToken(r.token);
    tab = "me";
    blow("short");
    boot();
  } catch (x) {
    $("er").textContent =
      x.status === 429
        ? "Too many tries. Wait a minute."
        : x.status === 401
          ? "Wrong name or code."
          : "Cannot reach the server.";
  }
};

// ---- player login / first-time signup ----
let pStep = "roll";
const pErr = (x) => {
  $("pe").textContent =
    x.status === 429
      ? "Too many tries. Wait a minute."
      : x.status
        ? x.message
        : "Cannot reach the server.";
};
function pForm(hasAcc) {
  pStep = hasAcc ? "login" : "signup";
  $("pgo").hidden = true;
  $("pa").innerHTML = hasAcc
    ? `<label class="fl">Your code<input id="pc" type="password" placeholder="Your unique code" autocomplete="current-password" required></label><button class="pri big" id="plg">Log in</button><p class="hint">Forgot your code? Ask the captain to press <b>Reset code</b> for you, then sign up again.</p>`
    : `<p class="note">First time here. Confirm the contact number you gave the captain, then choose your own unique code. You will use it to log in next time.</p><label class="fl">Contact number<input id="po" inputmode="tel" placeholder="Your contact number" autocomplete="tel" maxlength="15" required></label><label class="fl">Choose your unique code<input id="pc" type="password" placeholder="4 or more characters" maxlength="30" autocomplete="new-password" required></label><button class="pri big" id="plg">Create account &amp; log in</button>`;
  $("pe").textContent = "";
  ($("po") || $("pc")).focus();
}
$("pf").onsubmit = async (e) => {
  e.preventDefault();
  $("pe").textContent = "";
  const roll = $("pr").value.trim();
  try {
    if (pStep === "roll") {
      const r = await api("/api/player/check", {
        method: "POST",
        body: { roll },
      });
      pForm(r.hasAccount);
      return;
    }
    const r =
      pStep === "login"
        ? await api("/api/player/login", {
            method: "POST",
            body: { roll, code: $("pc").value },
          })
        : await api("/api/player/signup", {
            method: "POST",
            body: { roll, contact: $("po").value.trim(), code: $("pc").value },
          });
    saveToken(r.token);
    tab = "me";
    blow("short");
    boot();
  } catch (x) {
    pErr(x);
  }
};
$("pr").oninput = () => {
  if (pStep !== "roll") {
    pStep = "roll";
    $("pa").innerHTML = "";
    $("pgo").hidden = false;
  }
};

// ---- install as an app ----
let deferred = null;
const standalone = () =>
  matchMedia("(display-mode: standalone)").matches ||
  navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
function syncInstall() {
  $("inst").hidden = standalone();
}
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e;
  syncInstall();
});
window.addEventListener("appinstalled", () => {
  deferred = null;
  syncInstall();
  $("menu").hidden = true;
});
async function installApp() {
  if (deferred) {
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch (e) {}
    deferred = null;
    syncInstall();
    return;
  }
  alert(
    isIOS
      ? 'To install on iPhone/iPad: open this page in Safari, tap the Share button, then "Add to Home Screen".'
      : 'To install: open your browser menu (⋮ or the install icon in the address bar) and choose "Install app" or "Add to Home screen".',
  );
}
$("inst").onclick = installApp;

// ---- the 3-dot menu: every tab, tools and settings, each option once ----
let menuActs = [];
function drawMenu() {
  menuActs = [];
  const m = $("menu");
  const mi = (ic, label, fn, o = {}) => {
    menuActs.push(fn);
    return `<button class="mi ${o.on ? "on" : ""} ${o.cls || ""}" data-k="${menuActs.length - 1}"${o.sw !== undefined ? ' role="switch" aria-checked="' + o.sw + '"' : ""}><span class="i">${ic}</span><span class="t">${label}</span>${o.sw !== undefined ? `<span class="sw ${o.sw ? "on" : ""}"></span>` : ""}</button>`;
  };
  const roleName =
    role === "captain"
      ? "Captain"
      : role === "vice"
        ? "Vice-captain"
        : role === "admin"
          ? "Admin"
          : "Player";
  let h = `<button class="mu" id="mup" aria-label="Open my profile">${avatar(WHO, MYPH, 40)}<span style="flex:1;text-align:left"><b>${esc(WHO)}</b><span class="mute">${roleName} · view my profile</span></span><span class="chev">›</span></button>`;
  const more = tabsFor().filter((t) => !PRIMARY.includes(t[0])); // tabs already on the bottom bar / top bar are not repeated here
  if (more.length)
    h +=
      `<div class="ms">More pages</div>` +
      more
        .map((t) => mi(t[1], t[2], () => go(t[0]), { on: t[0] === tab }))
        .join("");
  if (admin)
    h +=
      `<div class="ms">Admin tools</div>` +
      mi("➕", "Add students", openAdd) +
      mi("✉️", "Edit message template", openTpl) +
      mi("🔗", "Edit WhatsApp group link", openGroup);
  h +=
    `<div class="ms">Share</div>` +
    mi("📊", "Share attendance report", () => openReport()) +
    mi("📲", "Share this app", shareApp);
  h +=
    `<div class="ms">App</div>` +
    mi(
      "🔊",
      "Whistle sound",
      () => {
        try {
          localStorage.setItem("hk_sound", soundOn() ? "0" : "1");
        } catch (e) {}
        if (soundOn()) playWhistle("short");
        drawMenu();
      },
      { sw: soundOn() },
    ) +
    mi(
      alertOn ? "🔔" : "🔕",
      "Alerts 15 min before practice",
      async () => {
        await setAlert(!alertOn);
        drawMenu();
      },
      { sw: alertOn },
    ) +
    mi("📅", "Add schedule to calendar", icsDownload);
  if (!standalone()) h += mi("⬇️", "Install app", installApp);
  if (GROUP)
    h += mi("💬", "Join WhatsApp group", () =>
      window.open(GROUP, "_blank", "noopener"),
    );
  h +=
    `<div class="ms"></div>` +
    mi(
      "🚪",
      "Log out",
      () => {
        if (
          confirm(
            "Log out of this device?\n\nYou will need your roll number and code to log in again.",
          )
        )
          logout();
      },
      { cls: "out" },
    );
  m.innerHTML = h;
  if ($("mup"))
    $("mup").onclick = () => {
      m.hidden = true;
      openMyProfile();
    };
  m.querySelectorAll(".mi").forEach(
    (b) =>
      (b.onclick = () => {
        const k = +b.dataset.k,
          keep = b.hasAttribute("role");
        if (!keep) m.hidden = true;
        $("mb").setAttribute("aria-expanded", String(keep));
        menuActs[k]();
      }),
  );
}
$("mb").onclick = (e) => {
  e.stopPropagation();
  const m = $("menu");
  if (!m.hidden) {
    m.hidden = true;
    return;
  }
  drawMenu();
  m.hidden = false;
  $("mb").setAttribute("aria-expanded", "true");
};
document.addEventListener("click", (e) => {
  if (
    !e.composedPath().includes($("menu")) &&
    !e.composedPath().includes($("mb"))
  )
    $("menu").hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $("menu").hidden = true;
});

// ---- add students (captain / admin) ----
function openAdd() {
  $("sm").textContent = "";
  $("sdlg").showModal();
}
$("sx").onclick = () => $("sdlg").close();
const bulk = async (path, body, btn) => {
  btn.disabled = true;
  $("sm").textContent = "Working…";
  try {
    const r = await api(path, { method: "POST", body });
    $("sm").textContent =
      `Added ${r.added} new, updated ${r.updated} existing` +
      (r.skipped.length
        ? `, skipped ${r.skipped.length}: ${r.skipped.join(", ")}`
        : "") +
      ".";
    await load(true);
    return true;
  } catch (x) {
    $("sm").textContent =
      x.status === 401
        ? "Please log in again as captain or admin."
        : "Could not save: " + x.message;
    return false;
  } finally {
    btn.disabled = false;
  }
};
$("sf").onsubmit = async (e) => {
  e.preventDefault();
  if (
    await bulk(
      "/api/players/bulk",
      {
        players: [
          { name: $("sn").value, roll: $("sr").value, contact: $("sc").value },
        ],
      },
      $("sf").querySelector("button"),
    )
  ) {
    $("sn").value = $("sr").value = $("sc").value = "";
    $("sn").focus();
  }
};
$("sba").onclick = async () => {
  const players = $("sb")
    .value.split("\n")
    .map((l) => l.split(/\t|,/).map((x) => x.trim()))
    .filter((a) => a.some(Boolean))
    .map((a) => ({ name: a[0], roll: a[1], contact: a[2] }));
  if (!players.length) {
    $("sm").textContent = "Type or paste at least one line.";
    return;
  }
  if (await bulk("/api/players/bulk", { players }, $("sba")))
    $("sb").value = "";
};
$("sj").onclick = () => bulk("/api/players/import-jersey", {}, $("sj"));

// ---- WhatsApp sharing (opens WhatsApp with the text ready; the person picks the group and presses send) ----
let GROUP = window.WA_GROUP || "";
const wa = (t) => shareText(t); // opens the phone's share sheet (any app); on a computer it shows WhatsApp, Telegram, e-mail, SMS and copy
const dlong = (d) =>
  new Date(d + "T00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const DEFTPL =
  "🏑 *Inter IIT Hockey: Practice*\n📅 {day}, {date}\n⏰ {time}\n📍 {venue}\n🎯 {session}\n📝 {note}\nReport on time!";
function planMsg(d) {
  const p = PL[d] || {},
    r = SCH.team[dayIdx(d)],
    v = {
      date: fmt(d),
      day: r[0],
      time: p.time || r[3],
      session: r[1],
      note: p.note,
      venue: p.venue,
    };
  const tp = TPL || DEFTPL,
    extra = p.venue && !tp.includes("{venue}") ? "\n📍 " + p.venue : "";
  return (
    tp
      .split("\n")
      .filter(
        (l) =>
          ![...l.matchAll(/\{(\w+)\}/g)].some((m) => m[1] in v && !v[m[1]]),
      )
      .join("\n")
      .replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) +
    extra +
    (p.status === "cancelled" ? "\n\n❌ *CANCELLED*" : "")
  );
}
function attMsg(d) {
  const r = SS[d] || {},
    ps = P.filter((p) => r[p.id] !== undefined),
    pr = ps.filter((p) => r[p.id]),
    ab = ps.filter((p) => !r[p.id]),
    ls = (a) =>
      a.length ? a.map((p, i) => i + 1 + ". " + p.name).join("\n") : "-";
  return `🏑 *Inter IIT Hockey: Attendance*\n📅 ${dlong(d)}\n\n✅ *Present (${pr.length})*\n${ls(pr)}\n\n❌ *Absent (${ab.length})*\n${ls(ab)}\n\nTurnout: ${ps.length ? Math.round((pr.length * 100) / ps.length) : 0}%`;
}
function weekMsg(k) {
  return (
    `🏑 *Inter IIT Hockey: Weekly schedule${k === "gk" ? " (Goalkeepers)" : ""}*\n\n` +
    SCH[k]
      .map((r) => (r[3] ? `*${r[0]}*: ${r[1]}, ${r[3]}` : `*${r[0]}*: ${r[1]}`))
      .join("\n") +
    "\n\nReport on time. Timings may shift based on turf availability and the coach's call."
  );
}
function openTpl() {
  $("tt").value = TPL || DEFTPL;
  $("tdlg").showModal();
}
$("tcx").onclick = () => $("tdlg").close();
$("trs").onclick = () => {
  $("tt").value = DEFTPL;
};
$("tsv").onclick = () =>
  run(async () => {
    await api("/api/template", {
      method: "PUT",
      body: { text: $("tt").value.trim() === DEFTPL ? "" : $("tt").value },
    });
    $("tdlg").close();
    await load(true);
  });

// ---- alerts: a notification 15 minutes before each fixed playing day (works while the app is open or in the background tab) ----
let alertOn = false;
try {
  alertOn = localStorage.getItem("hk_alert") === "1";
} catch (e) {}
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("sw.js").catch(() => {});
function span(t) {
  // "6:30–8:30 PM" -> start/end in minutes after midnight
  const k = [
    ...String(t || "").matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi),
  ];
  if (!k.length || +k[0][1] > 23) return null;
  const mer = (k[0][3] || (k[1] && k[1][3]) || "").toLowerCase();
  const cv = (x) => {
    let h = +x[1];
    const e = (x[3] || mer).toLowerCase();
    if (e === "pm" && h < 12) h += 12;
    if (e === "am" && h === 12) h = 0;
    return h * 60 + (+x[2] || 0);
  };
  const a = cv(k[0]);
  let b = k[1] ? cv(k[1]) : a + 120;
  if (b <= a) b = a + 120;
  return { a, b };
}
async function notify(title, body, tag) {
  try {
    const r = await navigator.serviceWorker.getRegistration();
    if (r) {
      await r.showNotification(title, { body, tag });
      return;
    }
  } catch (e) {}
  try {
    new Notification(title, { body, tag });
  } catch (e) {}
}
async function setAlert(on) {
  if (on) {
    if (!("Notification" in window))
      return alert(
        'This browser cannot show alerts. On iPhone: Share > Add to Home Screen, then open the app from the home screen. You can also use "Add schedule to calendar".',
      );
    if ((await Notification.requestPermission()) !== "granted")
      return alert(
        "Alerts are blocked. Allow notifications for this site in your browser settings, then try again.",
      );
  }
  alertOn = on;
  try {
    localStorage.setItem("hk_alert", on ? "1" : "0");
  } catch (e) {}
  alert(
    on
      ? 'Alerts are ON. You get a reminder 15 minutes before each fixed playing day. Keep the app open or in the background. For a reminder that always works, also use "Add schedule to calendar".'
      : "Alerts are OFF.",
  );
  if (on) checkAlerts();
}
function checkAlerts() {
  if (
    !alertOn ||
    !loaded ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  )
    return;
  let fired = {};
  try {
    fired = JSON.parse(localStorage.getItem("hk_fired") || "{}");
  } catch (e) {}
  const now = Date.now();
  for (const d of Object.keys(PL)) {
    const p = PL[d];
    if (p.status === "cancelled") continue;
    const sp = span(p.time);
    if (!sp) continue;
    const left = new Date(d + "T00:00").getTime() + sp.a * 60000 - now,
      key = d + "|" + p.time;
    if (left > 0 && left <= 15 * 60000 && !fired[key]) {
      fired[key] = 1;
      notify(
        "🏑 Hockey in " + Math.max(1, Math.round(left / 60000)) + " min",
        (SCH.team[dayIdx(d)][1] || "Practice") +
          (p.time ? " · " + p.time : "") +
          (p.venue ? " · 📍 " + p.venue : "") +
          (p.note ? " · " + p.note : ""),
        "hk-" + d,
      );
    }
  }
  for (const k in fired) if (k.slice(0, 10) < today()) delete fired[k];
  try {
    localStorage.setItem("hk_fired", JSON.stringify(fired));
  } catch (e) {}
}
setInterval(checkAlerts, 30000);
document.addEventListener("visibilitychange", checkAlerts);

// ---- calendar file: every fixed playing day with a built-in 15 minute reminder (works in the background on any phone) ----
function icsDownload() {
  const up = Object.keys(PL)
    .sort()
    .filter(
      (d) => d >= today() && PL[d].status !== "cancelled" && span(PL[d].time),
    );
  if (!up.length)
    return alert(
      "No upcoming playing day with a time is fixed yet. Try again once the captain schedules one.",
    );
  const z = (n) => String(n).padStart(2, "0"),
    ts = (d, m) =>
      d.replace(/-/g, "") + "T" + z(Math.floor(m / 60) % 24) + z(m % 60) + "00",
    stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, ""),
    cl = (t) =>
      String(t || "")
        .replace(/[\;,]/g, " ")
        .replace(/\n/g, " ");
  const ev = up.flatMap((d) => {
    const sp = span(PL[d].time);
    return [
      "BEGIN:VEVENT",
      "UID:hockey-" + d + "@attendance",
      "DTSTAMP:" + stamp,
      "DTSTART:" + ts(d, sp.a),
      "DTEND:" + ts(d, sp.b),
      "SUMMARY:Hockey: " + cl(SCH.team[dayIdx(d)][1]),
      "DESCRIPTION:" + cl(PL[d].note || "Hockey practice"),
      ...(PL[d].venue ? ["LOCATION:" + cl(PL[d].venue)] : []),
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Hockey starts in 15 minutes",
      "TRIGGER:-PT15M",
      "END:VALARM",
      "END:VEVENT",
    ];
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob(
      [
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Hockey Attendance//EN\r\n" +
          ev.join("\r\n") +
          "\r\nEND:VCALENDAR\r\n",
      ],
      { type: "text/calendar" },
    ),
  );
  a.download = "hockey-schedule.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function render() {
  if (!token) return;
  const tl = tabsFor();
  if (!tl.some((x) => x[0] === tab)) tab = "me";
  $("nav").innerHTML = tl
    .filter((t) => PRIMARY.includes(t[0]))
    .map(
      (x) =>
        `<button class="${x[0] === tab ? "on" : ""}" data-t="${x[0]}" ${x[0] === tab ? 'aria-current="page"' : ""}><span class="i">${x[1]}</span><span class="l">${x[4] || x[2]}</span></button>`,
    )
    .join("");
  $("nav")
    .querySelectorAll("button")
    .forEach((b) => (b.onclick = () => go(b.dataset.t)));
  const rn =
    role === "captain"
      ? "Captain"
      : role === "vice"
        ? "Vice-captain"
        : role === "admin"
          ? "Admin"
          : "Player";
  $("who").textContent = loaded ? (WHO === rn ? rn : WHO + " · " + rn) : "";
  $("hp").innerHTML = loaded ? avatar(WHO, MYPH, 34) : "";
  if (!$("menu").hidden) drawMenu();
  if (err) {
    $("view").innerHTML =
      `<div class="card">${empty("📡", esc(err))}<div class="ctl" style="justify-content:center"><button class="pri" id="rt">Try again</button></div></div>`;
    $("rt").onclick = () => load(true);
    return;
  }
  if (!loaded) {
    $("view").innerHTML = empty("🏑", "Loading…");
    return;
  }
  if (prof) {
    vProfile();
    return;
  }
  ({
    take: vTake,
    me: vMe,
    plan: vPlan,
    stats: vStats,
    schedule: vSched,
    rules: vRules,
    warmup: vWarm,
    players: vPlayers,
    removed: vRemoved,
    admins: vAdmins,
  })[tab]();
}
const dayIdx = (d) => (new Date(d + "T00:00").getDay() + 6) % 7;

function vTake() {
  const ex = SS[takeDate] || {};
  if (draftDate !== takeDate) {
    draft = { ...ex };
    draftDate = takeDate;
  }
  const el = P.filter((p) => !p.joined || p.joined <= takeDate),
    pl = SCH.team[dayIdx(takeDate)],
    pend = Object.keys(PL)
      .sort()
      .filter((d) => !SS[d] && PL[d].status !== "cancelled" && d <= today());
  $("view").innerHTML = `<div class="card"><h2>Take attendance</h2>
  <div class="ctl"><label>Date <input type="date" id="td" value="${takeDate}"></label><button id="allp">All present</button></div>${pend.length ? `<p class="mute">Planned days waiting for attendance:</p><div class="chips" style="margin:0 0 10px">${pend.map((d) => `<button data-pd="${d}">${fmt(d)}</button>`).join("")}</div>` : ""}
  <p class="mute">${pl[0]}: ${pl[3] ? esc(pl[1]) + ", " + pl[3] : "rest day on the schedule"}${SS[takeDate] ? " · already saved, saving again updates it" : ""}</p>
  ${
    el
      .map(
        (
          p,
        ) => `<div class="row"><span>${esc(p.name)}<br><span class="mute">${esc(p.roll)}</span></span><span class="tog">
  <button class="p ${draft[p.id] === true ? "on" : ""}" data-id="${p.id}" data-v="1">Present</button>
  <button class="a ${draft[p.id] === false ? "on" : ""}" data-id="${p.id}" data-v="0">Absent</button></span></div>`,
      )
      .join("") ||
    '<p class="mute">No players yet. Add students from the ⋮ menu.</p>'
  }
  <div class="ctl" style="margin-top:12px"><button class="pri" id="sv">Save attendance</button>${SS[takeDate] ? '<button id="wat">⤴ Share</button><button class="dng" id="del">Delete this day</button>' : ""}</div></div>`;
  $("td").onchange = (e) => {
    if (e.target.value) {
      takeDate = e.target.value;
      vTake();
    }
  };
  document.querySelectorAll(".tog button").forEach(
    (b) =>
      (b.onclick = () => {
        draft[b.dataset.id] = b.dataset.v === "1";
        const r = b.parentNode;
        r.querySelector(".p").classList.toggle(
          "on",
          draft[b.dataset.id] === true,
        );
        r.querySelector(".a").classList.toggle(
          "on",
          draft[b.dataset.id] === false,
        );
      }),
  );
  document.querySelectorAll("[data-pd]").forEach(
    (b) =>
      (b.onclick = () => {
        takeDate = b.dataset.pd;
        vTake();
      }),
  );
  $("allp").onclick = () => {
    el.forEach((p) => (draft[p.id] = true));
    vTake();
  };
  $("sv").onclick = () => {
    if (!el.length) return alert("Add players first.");
    const un = el.filter((p) => draft[p.id] === undefined);
    if (un.length)
      return alert(
        "Tick Present or Absent for: " + un.map((p) => p.name).join(", "),
      );
    const r = {};
    el.forEach((p) => (r[p.id] = draft[p.id]));
    run(async () => {
      await api("/api/sessions/" + takeDate, {
        method: "PUT",
        body: { r: { ...ex, ...r } },
      });
      draftDate = null;
      blow("double");
      await load();
      if (confirm("Saved for " + fmt(takeDate) + ". Share the attendance now?"))
        wa(attMsg(takeDate));
    });
  };
  if ($("wat")) $("wat").onclick = () => wa(attMsg(takeDate));
  if ($("del"))
    $("del").onclick = () => {
      if (confirm("Delete attendance for " + fmt(takeDate) + "?"))
        run(async () => {
          await api("/api/sessions/" + takeDate, { method: "DELETE" });
          draftDate = null;
          await load();
        });
    };
}

function mSel(id, cur, all) {
  return `<select id="${id}">${all ? `<option value="all">All time</option>` : ""}${months()
    .map(
      (m) =>
        `<option value="${m}" ${m === cur ? "selected" : ""}>${mfmt(m)}</option>`,
    )
    .join("")}</select>`;
}

function matrix(ds) {
  const ps = P.filter((p) => ds.some((d) => SS[d][p.id] !== undefined)),
    ms = [...new Set(ds.map((d) => d.slice(0, 7)))];
  return `<details class="card"><summary><b>Day-wise table</b> <span class="mute">${ps.length} players × ${ds.length} days</span></summary><div class="mxw"><table class="mx"><tr><th class="sc"></th>${ms.map((m) => `<th colspan="${ds.filter((d) => d.startsWith(m)).length}" class="mh">${mfmt(m).replace(/ (\d\d)(\d\d)$/, " ’$2")}</th>`).join("")}<th></th></tr>
  <tr><th class="sc">Player</th>${ds.map((d) => `<th title="${fmt(d)}">${+d.slice(8)}</th>`).join("")}<th>Total</th></tr>
  ${ps
    .map((p) => {
      let pr = 0,
        t = 0;
      const c = ds
        .map((d) => {
          const v = SS[d][p.id];
          if (v !== undefined) {
            t++;
            if (v) pr++;
          }
          return `<td class="${v === true ? "y" : v === false ? "x" : "o"}" title="${esc(p.name)} · ${fmt(d)}">${v === true ? "✔" : v === false ? "✘" : ""}</td>`;
        })
        .join("");
      return `<tr><td class="sc"><button class="lnk" data-pf="${p.id}">${esc(p.name.split(" ")[0])}</button></td>${c}<td class="tt">${pr}/${t}</td></tr>`;
    })
    .join("")}</table></div></details>`;
}

let dsel = false;
function vStats() {
  if (!months().length) {
    $("view").innerHTML =
      '<div class="card"><h2>Attendance</h2><p class="mute">No attendance recorded yet.</p></div>';
    return;
  }
  if (!dsel && dates().length) selDate = dates()[dates().length - 1];
  if (!admin && !P.some((p) => p.id === me)) {
    $("view").innerHTML =
      '<div class="card"><h2>Attendance</h2><p class="mute">Your record was not found. Ask the captain.</p></div>';
    return;
  }
  const vis = (x) => admin || x.p.id === me;
  const m = gMonth,
    st = stats(m)
      .filter((x) => x.t && vis(x))
      .sort((a, b) => b.pct - a.pct),
    n = rdays(m),
    live = dates().filter((d) => m === "all" || d.startsWith(m));
  const tp = st.reduce((a, x) => a + x.t, 0),
    tr = tp ? Math.round((st.reduce((a, x) => a + x.pr, 0) * 100) / tp) : 0;
  let pts, ttl;
  if (m === "all") {
    ttl = admin ? "Team turnout by month" : "My attendance by month";
    pts = months().map((k) => {
      const q = stats(k).filter(vis),
        t = q.reduce((a, x) => a + x.t, 0),
        pr = q.reduce((a, x) => a + x.pr, 0),
        pct = t ? (pr * 100) / t : 0;
      return {
        l: k.slice(2),
        pct,
        tip: mfmt(k) + ": " + Math.round(pct) + "%",
      };
    });
  } else {
    ttl = admin
      ? "Team turnout per playing day"
      : "My attendance per playing day";
    pts = (admin ? live : live.filter((d) => SS[d][me] !== undefined)).map(
      (d) => {
        const v = admin
            ? P.filter((p) => SS[d][p.id] !== undefined).map((p) => SS[d][p.id])
            : [SS[d][me]],
          pr = v.filter(Boolean).length,
          pct = v.length ? (pr * 100) / v.length : 0;
        return {
          l: d.slice(5),
          pct,
          tip:
            fmt(d) +
            ": " +
            (admin ? pr + " present" : pr ? "Present" : "Absent"),
        };
      },
    );
  }
  const sd = SS[selDate];
  let day = '<p class="mute">No hockey recorded on this date.</p>';
  if (!admin) {
    day =
      sd && sd[me] !== undefined
        ? `<div class="row"><span>${fmt(selDate)}</span><span class="tag ${sd[me] ? "p" : "a"}">${sd[me] ? "Present" : "Absent"}</span></div>`
        : '<p class="mute">No record for you on this date.</p>';
  } else if (sd) {
    const v = P.filter((p) => sd[p.id] !== undefined),
      pr = v.filter((p) => sd[p.id]).length;
    day =
      `<div class="stats"><div><b>${pr}</b>Present</div><div><b>${v.length - pr}</b>Absent</div><div><b>${v.length ? Math.round((pr * 100) / v.length) : 0}%</b>Turnout</div></div>` +
      v
        .map(
          (p) =>
            `<div class="row"><span>${esc(p.name)}</span><span class="tag ${sd[p.id] ? "p" : "a"}">${sd[p.id] ? "Present" : "Absent"}</span></div>`,
        )
        .join("");
  }
  $("view").innerHTML =
    `<div class="card"><h2>Attendance</h2><div class="ctl">${mSel("gm", gMonth, true)}</div>
  <div class="stats"><div><b>${n}</b>Playing days</div><div><b>${tr}%</b>${admin ? "Team turnout" : "My attendance"}</div></div>
  <table><tr><th>Player</th><th class="n">Present</th><th class="n">Days</th><th>%</th></tr>${st.map((x) => `<tr><td>${admin ? `<button class="lnk" data-pf="${x.p.id}">${esc(x.p.name)}</button>` : esc(x.p.name)}</td><td class="n">${x.pr}</td><td class="n">${x.t}</td><td><div class="bar"><i style="width:${x.pct}%"></i></div>${x.pct}%</td></tr>`).join("")}</table>
  ${L[m] ? '<p class="mute">Includes the imported register totals. Players who joined mid-month show a lower %.</p>' : ""}
  <h2 style="margin-top:18px">${ttl}</h2>${pts.length ? '<div id="ch1" class="chart"></div>' : '<p class="mute">No day-by-day records for this month. Monthly totals only.</p>'}
  <div class="chips"><button id="shr">⤴ Share report</button></div></div>
  ${admin && live.length ? matrix(live) : ""}
  <div class="card"><h2>Day by day</h2><div class="ctl"><input type="date" id="sd" value="${selDate}"></div>${day}
  <div class="chips">${live
    .filter((d) => admin || SS[d][me] !== undefined)
    .reverse()
    .map((d) => `<button data-d="${d}">${fmt(d)}</button>`)
    .join("")}</div></div>`;
  $("gm").onchange = (e) => {
    gMonth = e.target.value;
    vStats();
  };
  if (pts.length) chartInto("ch1", pts, { title: ttl });
  $("shr").onclick = () =>
    openReport(
      admin
        ? { sc: m === "all" ? "team" : "month", v: m }
        : { sc: "person", v: me },
    );
  bindProfLinks();
  $("sd").onchange = (e) => {
    if (e.target.value) {
      selDate = e.target.value;
      dsel = true;
      vStats();
    }
  };
  document.querySelectorAll(".chips button").forEach(
    (b) =>
      (b.onclick = () => {
        selDate = b.dataset.d;
        dsel = true;
        vStats();
      }),
  );
}
let openDay = null;
const DAB = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function nextDateOf(i) {
  const t = new Date(today() + "T00:00");
  while (
    dayIdx(
      t.getFullYear() +
        "-" +
        String(t.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(t.getDate()).padStart(2, "0"),
    ) !== i
  )
    t.setDate(t.getDate() + 1);
  return (
    t.getFullYear() +
    "-" +
    String(t.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(t.getDate()).padStart(2, "0")
  );
}
function vSched() {
  const ti = dayIdx(today());
  if (!openDay) openDay = new Set([ti]);
  const rows = SCH[sch];
  $("view").innerHTML = `<div class="card"><h2>Weekly practice schedule</h2>
  <div class="seg2"><button class="${sch === "team" ? "on" : ""}" data-s="team">Team</button><button class="${sch === "gk" ? "on" : ""}" data-s="gk">Goalkeepers</button></div>
  <div class="week">${rows.map((r, i) => `<button class="wd ${i === ti ? "today" : ""} ${r[3] ? "" : "rest"}" data-w="${i}" aria-label="${r[0]}"><b>${DAB[i]}</b><span>${r[3] ? "🏑" : "😴"}</span></button>`).join("")}</div>
  <p class="mute" style="margin:0 0 8px">Tap a day to see the details${admin ? " and edit it" : ""}.</p>
  ${rows
    .map(
      (
        r,
        i,
      ) => `<details class="day ${r[3] ? "" : "rest"} ${i === ti ? "today" : ""}" id="dy${i}" data-di="${i}" ${openDay.has(i) ? "open" : ""}>
    <summary><span class="dbadge">${DAB[i]}</span><span class="dm"><b>${esc(r[1])}</b><small>${r[3] ? "⏰ " + esc(r[3]) : "Rest day"}</small></span>${i === ti ? '<span class="pill g">Today</span>' : ""}<span class="chev">›</span></summary>
    <div class="db"><p>${esc(r[2])}</p>
      <div class="kv"><span>Day</span><b>${r[0]}</b></div><div class="kv"><span>Timing</span><b>${r[3] ? esc(r[3]) : "No session"}</b></div><div class="kv"><span>Next date</span><b>${fmt(nextDateOf(i))}</b></div>
      ${admin ? `<div class="edit"><label class="fl">Session name<input id="de-t${i}" value="${esc(r[1])}" maxlength="60"></label><label class="fl">Details<input id="de-x${i}" value="${esc(r[2])}" maxlength="200"></label><label class="fl">Timing, e.g. 6:30–8:30 PM (empty = rest day)<input id="de-m${i}" value="${esc(r[3])}" maxlength="30"></label></div>` : ""}
      <div class="chips"><button data-sh="${i}">⤴ Share this day</button>${admin ? `<button class="pri" data-sv="${i}">Save changes</button>${r[3] ? `<button data-nx="${i}">Schedule next ${r[0]}</button>` : ""}` : ""}</div></div></details>`,
    )
    .join("")}
  <p class="mute">Report on time. Timings may shift closer to the tournament based on turf availability and the coach's call. Coach: Kiran Chaudhary.</p>
  <div class="chips"><button id="wsch">⤴ Share whole week</button><button id="wcal">📅 Add to calendar</button></div></div>`;
  $("wsch").onclick = () => shareText(weekMsg(sch), "Weekly schedule");
  $("wcal").onclick = icsDownload;
  document.querySelectorAll("[data-s]").forEach(
    (b) =>
      (b.onclick = () => {
        sch = b.dataset.s;
        vSched();
      }),
  );
  document.querySelectorAll("details.day").forEach(
    (d) =>
      (d.ontoggle = () => {
        const i = +d.dataset.di;
        d.open ? openDay.add(i) : openDay.delete(i);
      }),
  );
  document.querySelectorAll("[data-w]").forEach(
    (b) =>
      (b.onclick = () => {
        const e = $("dy" + b.dataset.w);
        e.open = true;
        e.scrollIntoView({ behavior: "smooth", block: "center" });
      }),
  );
  document.querySelectorAll("[data-sh]").forEach(
    (b) =>
      (b.onclick = () => {
        const r = rows[+b.dataset.sh];
        shareText(
          `🏑 *Inter IIT Hockey: ${r[0]}*\n${r[1]}\n${r[2]}\n⏰ ${r[3] || "Rest day"}`,
          "Practice",
        );
      }),
  );
  document.querySelectorAll("[data-sv]").forEach(
    (b) =>
      (b.onclick = () => {
        const i = +b.dataset.sv,
          r = rows[i];
        SCH[sch][i] = [
          r[0],
          $("de-t" + i).value.trim(),
          $("de-x" + i).value.trim(),
          $("de-m" + i).value.trim(),
        ];
        run(async () => {
          await api("/api/schedule", {
            method: "PUT",
            body: { team: SCH.team, gk: SCH.gk },
          });
          await load(true);
        });
      }),
  );
  document.querySelectorAll("[data-nx]").forEach((b) => {
    const i = +b.dataset.nx;
    b.onclick = () => {
      const d = nextDateOf(i);
      if (PL[d] && !confirm(fmt(d) + " is already scheduled. Replace it?"))
        return;
      run(async () => {
        await api("/api/plans/" + d, {
          method: "PUT",
          body: { time: SCH.team[i][3], note: "", status: "planned" },
        });
        await load(true);
        alert(fmt(d) + " is now a playing day.");
      });
    };
  });
}

const RULES = [
  [
    "Umpire signals: time and restarts",
    [
      "Start time|turn to the other umpire, one arm straight up",
      "Stop time|cross fully extended arms at the wrists above the head",
      "Two minutes left|both hands up, index fingers pointing",
      "One minute left|one hand up, index finger pointing",
      "Bully|hands move alternately up and down, palms facing each other",
      "Goal|both arms horizontal, pointing to the centre of the field",
      "Ball out over side-line|one arm raised horizontally in the direction of play",
      "Ball out over back-line by attacker|both arms extended horizontally sideways",
      "Ball out over back-line by defender (unintentional)|one arm, below shoulder level, draws a line from where the ball crossed to the restart spot on the 23 m line",
    ],
  ],
  [
    "Umpire signals: conduct of play",
    [
      "Dangerous play|one forearm diagonally across the chest",
      "Misconduct or bad temper|calming movement, both hands slowly up and down, palms down",
      "Kick (foot)|slightly raise a leg and touch near the foot or ankle",
      "Raised ball|palms face each other horizontally, about 150 mm apart",
      "Obstruction|forearms crossed in front of the chest",
      "Third party (shadow) obstruction|crossed forearms alternately opened and closed",
      "Stick obstruction|one arm held out and down, touch that forearm with the other hand",
      "5 metres distance|one arm straight up, open hand, fingers extended",
    ],
  ],
  [
    "Umpire signals: penalties",
    [
      "Advantage|one arm extended high in the direction the benefiting team is playing",
      "Free hit|one arm raised horizontally in the direction of the free hit",
      "Penalty corner|both arms horizontal, pointing at the goal",
      "Penalty stroke|one arm points at the stroke mark, the other straight up (also means time stopped)",
    ],
  ],
  [
    "Match penalties: when each is given",
    [
      "Free hit|any offence between the 23 m areas, an attacker's offence in the 23 m area, or an unintentional defender offence outside the circle in their own 23 m area",
      "Penalty corner|a defender's offence in the circle that does not stop a probable goal, an intentional offence in the circle against a player without the ball, an intentional offence outside the circle in their 23 m area, ball intentionally played over the back-line by a defender, or ball lodged in a defender's clothing or equipment in the circle",
      "Penalty stroke|a defender's offence in the circle that prevents a probable goal, or an intentional offence in the circle against a player with the ball or a chance to play it",
      "Ball over the back-line|attacker: free hit up to 15 m out. Defender, unintentional: free hit on the 23 m line. Defender, intentional: penalty corner",
      "Free hit rules|ball stationary, opponents at least 5 m away, no intentional raised hit. An attacking free hit in the 23 m area can enter the circle only after the ball travels 5 m or a defender touches it",
      "Penalty stroke taking|ball on the penalty spot, defender on the goal line, taker waits for the whistle, push, flick or scoop only (no dragging), plays the ball once",
    ],
  ],
  [
    "Personal penalties (cards)",
    [
      "Caution|spoken warning",
      "Green card|warning and 2 minutes suspension",
      "Yellow card|at least 5 minutes suspension",
      "Red card|permanently out of the match",
      "Team effect|the team plays one player short for the length of any suspension",
      "Captain|a yellow card must be given if having too many players on the field materially affects the match",
    ],
  ],
  [
    "Dress and equipment",
    [
      "Uniform|field players of a team wear the same clothing. Shorts, skort or skirt are allowed if the same colour and design",
      "Safety|nothing dangerous may be worn. Shin, ankle and mouth protection are recommended",
      "Hand protection|must fit into a box of 290 x 180 x 110 mm without compressing",
      "Face masks|only for defending a penalty corner or stroke (or medical reasons, worn throughout). No other headgear for field players",
      "Knee pads|allowed at penalty corners, outside the socks only if the same colour as the socks or black. Remove penalty corner gear safely once it is over",
      "Captain|wears a distinctive arm-band",
      "Stick|J or U shaped head, flat on the left side only, smooth, no metal. Must pass through a 51 mm ring, bow no more than 25 mm, weight up to 737 g, length up to 105 cm",
      "Ball|hard, white (or a contrasting colour), circumference 224 to 235 mm, weight 156 to 163 g",
    ],
  ],
  [
    "Goalkeeper rules and gear",
    [
      "Gear|at least headgear, leg guards and kickers. Headgear and hand protectors may come off for a penalty stroke",
      "Shirt|different colour from both teams, worn over upper body protection",
      "Size limits|hand protector up to 365 x 228 mm, leg guards up to 300 mm wide, nothing that significantly adds to body size",
      "Where they play|inside their own 23 m area only (except taking a penalty stroke)",
      "Playing the ball|inside the circle with the stick in hand, may use stick and body to deflect or play the ball. Outside the circle, stick only",
      "Not allowed|lying on the ball, or using the equipment in a dangerous way",
    ],
  ],
  [
    "Key conduct rules",
    [
      "Stick|hold it at all times, never lift it over other players' heads, never play with the back of the stick",
      "Hitting|no hard forehand hit with the edge of the stick. No intentional raised hit except a shot at goal",
      "Flick or scoop|dangerous if aimed at an opponent within 5 metres",
      "Aerial ball|opponents stay 5 m away until the receiver touches the ball (new in 2026)",
      "Body|field players must not stop, kick or carry the ball with the body to gain advantage",
      "Obstruction|no backing into, shielding with the stick or body, or running in front of an opponent",
      "Tackling|only when able to play the ball without body contact. Reckless sliding tackles are penalised",
      "Other|no entering or running behind the goals, no throwing equipment, no time wasting, no touching or intimidating players",
    ],
  ],
  [
    "Match basics and substitutions",
    [
      "Length|four quarters of 15 min, 2 min breaks after Q1 and Q3, 10 min half-time",
      "Team|up to 11 on the field and up to 5 substitutes (16 total)",
      "Substitution|any time except from the award of a penalty corner until it is finished (unless the defending goalkeeper is injured or suspended)",
      "Where to swap|within 3 m of the centre line on the agreed side. A player must leave before the replacement enters",
      "Goals|time and play stop after a goal and restart when teams are ready",
    ],
  ],
  [
    "Penalty corner basics",
    [
      "Taker|ball on the back-line at least 10 m from the post, push or hit with no intentional raise, one foot outside the field",
      "Attackers|all others outside the circle, 5 m from the ball, until it is played",
      "Defenders|up to 5 behind the back-line including the goalkeeper, the rest beyond the centre line",
      "Scoring|no goal until the ball has left the circle. A first hit must be no higher than 460 mm at the goal-line",
      "Taker restriction|cannot touch the ball again until another player plays it",
      "Gear|defenders remove masks and pads safely afterwards. Throwing equipment that strikes someone on or above the knee is a yellow card",
    ],
  ],
  [
    "What changed in the 2026 rulebook",
    [
      "Half-time|now 10 minutes",
      "Goals|time and play stop after a goal",
      "Aerial balls|opponents may approach once the receiver has touched the ball, after the first 5 m of space",
      "Goalkeepers|clarified that stick and body can be used inside the circle",
      "Umpire deflection|ball hitting an umpire that gives one team an advantage restarts with a bully",
      "Too many players|yellow card for the captain if it materially affects the match",
      "Goalkeeper glove|maximum length raised from 355 mm to 365 mm",
    ],
  ],
];
const WARM = [
  [
    "Warm-up: about 12 minutes before practice",
    [
      "Easy jog|3 minutes around the pitch, building pace gradually",
      "Leg swings|10 forward and back, 10 side to side per leg, holding a stick for balance",
      "High knees and heel flicks|2 x 20 m each",
      "Walking lunge with twist|10 per leg, chest tall",
      "Side shuffles and carioca|2 x 20 m each way, stay low in hockey posture",
      "Stick-handling jog|2 minutes of dribbling in a tight pattern, then a few passes with a partner",
      "Build-up runs|3 x 20 m at about 70%, then 80%, finishing with a quick change of direction",
    ],
  ],
  [
    "Stretching: about 10 minutes after practice",
    [
      "Hamstring|seated or standing, reach toward the toes with a flat back",
      "Quadriceps|standing, heel toward the glute, knees together",
      "Hip flexor|kneeling lunge, tuck the hips forward (important in the bent hockey posture)",
      "Groin|wide-leg seated stretch or side lunge",
      "Calf|hands on a wall, back heel pressed down",
      "Glutes|lying on the back, ankle on the opposite knee, pull the leg toward the chest",
      "Lower back|child's pose with arms long",
      "Shoulders and wrists|cross-body arm stretch, then gentle wrist flexor and extensor stretches for the stick grip",
    ],
  ],
];
const DEF = ["🧑‍⚖️", "🧑‍⚖️", "🧑‍⚖️", "🚩", "🟨", "👕", "🧤", "📋", "⏱️", "🏑", "🆕"];
const IC = [
  [/^start time/i, "▶️"],
  [/^stop time/i, "⏹️"],
  [/minute/i, "⏱️"],
  [/bully/i, "🤝"],
  [/^goals?$/i, "🥅"],
  [/ball out/i, "↗️"],
  [/dangerous/i, "⚠️"],
  [/misconduct/i, "✋"],
  [/kick/i, "🦶"],
  [/raised ball|aerial|flick/i, "⤴️"],
  [/obstruct/i, "🚧"],
  [/5 metres/i, "📏"],
  [/advantage/i, "👍"],
  [/free hit/i, "🏑"],
  [/penalty corner/i, "🚩"],
  [/penalty stroke/i, "🎯"],
  [/green card/i, "🟩"],
  [/yellow card/i, "🟨"],
  [/red card/i, "🟥"],
  [/caution/i, "🗣️"],
  [/captain/i, "🎖️"],
  [/stick/i, "🏑"],
  [/ball/i, "⚪"],
  [/knee|safety|mask|hand protect/i, "🛡️"],
  [/uniform/i, "👕"],
  [/glove|gear|shirt|size/i, "🧤"],
  [/tackl/i, "🏃"],
  [/substitut|where to swap/i, "🔁"],
  [/length|half-time/i, "⏱️"],
  [/^team$/i, "👥"],
  [/taker|attackers|defenders/i, "👥"],
  [/scoring/i, "🥅"],
  [/umpire/i, "🧑‍⚖️"],
  [/where they play/i, "📍"],
];
const ic = (h, d) => {
  const f = IC.find((r) => r[0].test(h));
  return f ? f[1] : d;
};
const lst = (a, tag, d) =>
  `<${tag}${d ? ' class="ico"' : ""}>${a
    .map((x) => {
      const [h, b] = x.split("|"),
        i = d ? `<span class="ic">${ic(h, d)}</span>` : "";
      return b
        ? `<li>${i}<span><b>${h}</b>: ${b}</span></li>`
        : `<li>${i}<span>${x}</span></li>`;
    })
    .join("")}</${tag}>`;
const emptyItem = (x) => {
  const [h, ...b] = x.split("|");
  return { h, b: b.join("|"), img: "", yt: "" };
};
const defRules = () =>
  RULES.map((r, i) => ({
    id: "s" + String(i + 1).padStart(2, "0"),
    order: i + 1,
    title: r[0],
    icon: DEF[i],
    items: r[1].map(emptyItem),
  }));
const defWarm = () =>
  WARM.map((r, i) => ({
    id: "w" + (i + 1),
    order: i + 1,
    title: r[0],
    icon: i ? "🧘" : "🏃",
    items: [
      ...r[1].map(emptyItem),
      {
        h: "Tip",
        b: i
          ? "Hold each stretch 20 to 30 seconds per side, breathe normally, no bouncing. Ease off if you feel pain."
          : "Do dynamic moves like these before play and save static stretching for after.",
        img: "",
        yt: "",
      },
    ],
  }));
const saveSec = (col, sec) =>
  run(async () => {
    await api("/api/" + col + "/" + sec.id, {
      method: "PUT",
      body: {
        title: sec.title,
        icon: sec.icon,
        order: sec.order,
        items: sec.items,
      },
    });
    await load();
  });
function pickImg(cb) {
  const f = document.createElement("input");
  f.type = "file";
  f.accept = "image/*";
  f.onchange = () => {
    const rd = new FileReader();
    rd.onload = () => {
      const im = new Image();
      im.onload = () => {
        const w = Math.min(200, im.width),
          h = Math.round((im.height * w) / im.width),
          c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d").drawImage(im, 0, 0, w, h);
        cb(c.toDataURL("image/jpeg", 0.7));
      };
      im.src = rd.result;
    };
    if (f.files[0]) rd.readAsDataURL(f.files[0]);
  };
  f.click();
}
const okYt = (v) => !v || /^https?:\/\/\S+$/i.test(v);
function vSections(col) {
  const rules = col === "rules",
    list = rules ? RL : WL,
    secs = list.length ? list : rules ? defRules() : defWarm(),
    ed = admin && list.length > 0,
    open = openS[col];
  $("view").innerHTML =
    `${rules ? `<div class="card whc"><div class="whl">${whistleSvg(60)}<div><h2 style="margin:0">Umpire whistle</h2><span class="mute">Tap to hear it. Typical use: a short blast stops play for a foul or decision, a long blast starts or ends a period.</span></div></div><div class="chips"><button data-wh="short">Short blast</button><button data-wh="double">Two blasts</button><button data-wh="long">Long blast</button><button data-wh="final">Final whistle</button></div></div>` : ""}${rules ? '<p class="mute">Summary of the FIH Rules of Hockey effective 1 March 2026. The full rulebook decides any dispute.</p>' : ""}
  ${admin && !list.length ? `<div class="note">Admin tools: <button class="pri" id="rl-on">Enable editing${rules ? " and signal photos" : ", photos and video links"}</button></div>` : ""}
  ${ed ? '<div class="ctl"><button id="rl-add">+ Add section</button></div>' : ""}` +
    secs
      .map(
        (
          r,
          si,
        ) => `<details class="card" data-si="${si}" ${open.has(si) ? "open" : ""}><summary>${esc(r.icon)} ${esc(r.title)}</summary>
  <ul class="ico">${r.items.map((it, ii) => `<li>${it.img ? `<img class="sig" src="${it.img}" alt="">` : (rules && SIGSEC.test(r.title) && sigSvg(it.h)) || `<span class="ic">${rules ? ic(it.h, r.icon) : esc(r.icon)}</span>`}<span><b>${esc(it.h)}</b>${it.b ? ": " + esc(it.b) : ""}${it.yt ? ` <a href="${esc(it.yt)}" target="_blank" rel="noopener noreferrer">▶ Watch video</a>` : ""}${ed ? `<span class="chips" style="margin:4px 0 0"><button class="mini" data-a="e" data-s="${si}" data-i="${ii}">Edit</button><button class="mini" data-a="p" data-s="${si}" data-i="${ii}">${it.img ? "Change photo" : "Add photo"}</button>${it.img ? `<button class="mini" data-a="x" data-s="${si}" data-i="${ii}">Remove photo</button>` : ""}<button class="mini dng" data-a="d" data-s="${si}" data-i="${ii}">Delete</button></span>` : ""}</span></li>`).join("")}</ul>
  ${ed ? `<div class="chips"><button class="mini" data-a="+" data-s="${si}">+ Add item</button><button class="mini" data-a="r" data-s="${si}">Rename section</button><button class="mini dng" data-a="ds" data-s="${si}">Delete section</button></div>` : ""}</details>`,
      )
      .join("");
  document
    .querySelectorAll("[data-wh]")
    .forEach((b) => (b.onclick = () => playWhistle(b.dataset.wh)));
  document.querySelectorAll("details[data-si]").forEach(
    (d) =>
      (d.ontoggle = () => {
        const i = +d.dataset.si;
        d.open ? open.add(i) : open.delete(i);
      }),
  );
  if (!admin) return;
  if ($("rl-on"))
    $("rl-on").onclick = () =>
      run(async () => {
        for (const s of rules ? defRules() : defWarm())
          await api("/api/" + col + "/" + s.id, {
            method: "PUT",
            body: {
              title: s.title,
              icon: s.icon,
              order: s.order,
              items: s.items,
            },
          });
        await load();
      });
  if ($("rl-add"))
    $("rl-add").onclick = () => {
      const t = prompt("Section name");
      if (t && t.trim())
        saveSec(col, {
          id: "s" + Date.now().toString(36),
          order: Math.max(0, ...list.map((x) => x.order || 0)) + 1,
          title: t.trim(),
          icon: "📌",
          items: [],
        });
    };
  document.querySelectorAll("[data-a]").forEach(
    (b) =>
      (b.onclick = () => {
        const sec = list[+b.dataset.s],
          i = +b.dataset.i,
          a = b.dataset.a,
          it = sec.items[i];
        if (a === "e") {
          const h = prompt("Title", it.h);
          if (h === null) return;
          const t = prompt("Description", it.b);
          if (t === null) return;
          const y = prompt(
            "YouTube link (optional, leave empty for none)",
            it.yt || "",
          );
          if (y === null) return;
          if (!okYt(y.trim()))
            return alert("The link must start with http:// or https://");
          it.h = h.trim();
          it.b = t.trim();
          it.yt = y.trim();
          saveSec(col, sec);
        } else if (a === "p")
          pickImg((d) => {
            it.img = d;
            saveSec(col, sec);
          });
        else if (a === "x") {
          it.img = "";
          saveSec(col, sec);
        } else if (a === "d") {
          if (confirm('Delete "' + it.h + '"?')) {
            sec.items.splice(i, 1);
            saveSec(col, sec);
          }
        } else if (a === "+") {
          const h = prompt("Title");
          if (!h || !h.trim()) return;
          const t = prompt("Description (optional)") || "";
          const y = prompt("YouTube link (optional)") || "";
          if (!okYt(y.trim()))
            return alert("The link must start with http:// or https://");
          sec.items.push({ h: h.trim(), b: t.trim(), img: "", yt: y.trim() });
          saveSec(col, sec);
        } else if (a === "r") {
          const t = prompt("Section name", sec.title);
          if (t && t.trim()) {
            sec.title = t.trim();
            saveSec(col, sec);
          }
        } else if (a === "ds") {
          if (
            confirm('Delete the section "' + sec.title + '" and all its items?')
          )
            run(async () => {
              await api("/api/" + col + "/" + sec.id, { method: "DELETE" });
              await load();
            });
        }
      }),
  );
}
function vRules() {
  vSections("rules");
}
function vWarm() {
  vSections("warmup");
}
const dlabel = (d) => {
  const n = Math.round(
    (new Date(d + "T00:00") - new Date(today() + "T00:00")) / 864e5,
  );
  return n === 0 ? "Today" : n === 1 ? "Tomorrow" : "In " + n + " days";
};
function nextCard() {
  const d = Object.keys(PL)
      .sort()
      .find((x) => x >= today() && PL[x].status !== "cancelled"),
    c = Object.keys(PL)
      .sort()
      .find(
        (x) => x >= today() && PL[x].status === "cancelled" && (!d || x < d),
      );
  if (!d)
    return `<div class="card"><h2>Next playing day</h2>${empty("🗓️", "No playing day is fixed yet.")}</div>`;
  const p = PL[d],
    r = SCH.team[dayIdx(d)];
  return `<div class="card"><h2>Next playing day <span class="pill g">${dlabel(d)}</span></h2><p style="margin:0"><b style="font-size:1.15rem">${dlong(d)}</b></p>
  <p style="margin:4px 0 0">⏰ ${esc(p.time || r[3] || "Time to be announced")}</p>${p.venue ? `<p style="margin:2px 0 0">📍 ${esc(p.venue)}</p>` : ""}<p style="margin:2px 0 0">🎯 ${esc(r[1])}</p>${p.note ? `<p style="margin:2px 0 0">📝 ${esc(p.note)}</p>` : ""}
  ${availBlock(d)}${c ? `<p class="mute" style="margin:8px 0 0">${fmt(c)} is cancelled.</p>` : ""}</div>`;
}
function vMe() {
  admin ? homeAdmin() : homePlayer();
}
function homePlayer() {
  const a = stats("all").find((x) => x.p.id === me);
  if (!a) {
    $("view").innerHTML =
      `<div class="card">${empty("🏑", "Your record was not found. Ask the captain.")}</div>`;
    return;
  }
  const rows = months()
    .map((m) => {
      const s = stats(m).find((x) => x.p.id === me);
      return s && s.t
        ? `<tr><td>${mfmt(m)}</td><td class="n">${s.pr}/${s.t}</td><td><div class="bar"><i style="width:${s.pct}%"></i></div>${s.pct}%</td></tr>`
        : "";
    })
    .join("");
  const recent = dates()
    .reverse()
    .filter((d) => SS[d][me] !== undefined)
    .slice(0, 10)
    .map(
      (d) =>
        `<div class="row"><span>${fmt(d)}</span><span class="tag ${SS[d][me] ? "p" : "a"}">${SS[d][me] ? "Present" : "Absent"}</span></div>`,
    )
    .join("");
  $("view").innerHTML =
    `<div class="card hero"><div class="ring" style="--v:${a.pct}"><b>${a.pct}%</b></div><div class="hi"><h2>Hi, ${esc(a.p.name.split(" ")[0])} 👋</h2><span class="mute">${esc(a.p.position || "Hockey player")} · ${esc(a.p.roll)}</span></div>
  <div class="stats" style="width:100%;margin:0"><div><b>${a.pr}</b>Days attended</div><div><b>${a.t}</b>Playing days</div><div><b>${a.t - a.pr}</b>Missed</div></div></div>
  <div class="grid">${nextCard()}<div class="card"><h2>Recent days</h2>${recent || empty("📋", "No day-by-day records yet.")}</div>
  <div class="card span2"><h2>Month by month</h2>${rows ? `<table><tr><th>Month</th><th class="n">Present</th><th>%</th></tr>${rows}</table>` : empty("📊", "No attendance recorded yet.")}</div></div>`;
}
function homeAdmin() {
  const st = stats("all").filter((x) => x.t),
    tp = st.reduce((a, x) => a + x.t, 0),
    all = tp ? Math.round((st.reduce((a, x) => a + x.pr, 0) * 100) / tp) : 0;
  const last = dates().pop(),
    lv = last
      ? P.filter((p) => SS[last][p.id] !== undefined).map((p) => SS[last][p.id])
      : [],
    lt = lv.length
      ? Math.round((lv.filter(Boolean).length * 100) / lv.length)
      : 0;
  const pend = Object.keys(PL)
    .sort()
    .filter((d) => !SS[d] && PL[d].status !== "cancelled" && d <= today());
  const lo = [...st]
      .filter((x) => x.t >= 3 && x.pct < 75)
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 5),
    hi = [...st]
      .filter((x) => x.t >= 3)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  const list = (a) =>
    a.length
      ? a
          .map(
            (x) =>
              `<div class="row"><span>${esc(x.p.name)}</span><span class="tag ${x.pct >= 75 ? "p" : x.pct < 50 ? "a" : ""}">${x.pct}%</span></div>`,
          )
          .join("")
      : empty("📊", "Not enough data yet.");
  $("view").innerHTML =
    `<div class="card hero"><div class="ring" style="--v:${lt}"><b>${lt}%</b></div><div class="hi"><h2>Welcome, ${esc(WHO.split(" ")[0])} 🏑</h2><span class="mute">${last ? "Last session " + fmt(last) + " turnout" : "No attendance taken yet"}</span></div>
  <div class="stats" style="width:100%;margin:0"><div><b>${P.length}</b>Players</div><div><b>${rdays("all")}</b>Playing days</div><div><b>${all}%</b>Overall turnout</div><div><b>${pend.length}</b>Waiting for attendance</div></div></div>
  <div class="grid">${nextCard()}<div class="card"><h2>Attendance waiting</h2>${pend.length ? `<p class="mute">Tap a day to take attendance.</p><div class="chips" style="margin:0">${pend.map((d) => `<button class="pri" data-pd="${d}">${fmt(d)}</button>`).join("")}</div>` : empty("✅", "All planned days are done.")}</div>
  <div class="card"><h2>Best attendance</h2>${list(hi)}</div><div class="card"><h2>Needs a nudge</h2>${lo.length ? list(lo) : empty("🎉", "Everyone is above 75%.")}</div></div>`;
  document.querySelectorAll("[data-pd]").forEach(
    (b) =>
      (b.onclick = () => {
        takeDate = b.dataset.pd;
        go("take");
      }),
  );
}
function nextPlan() {
  const d = Object.keys(PL)
    .sort()
    .find((x) => x >= today() && PL[x].status !== "cancelled");
  return d
    ? `<p class="note">Next playing day: <b>${fmt(d)}</b>${PL[d].time ? ", " + esc(PL[d].time) : ""}${PL[d].venue ? " · 📍 " + esc(PL[d].venue) : ""}${PL[d].note ? " · " + esc(PL[d].note) : ""}</p>`
    : "";
}
function vPlan() {
  const td = today(),
    ks = Object.keys(PL).sort(),
    up = ks.filter((d) => d >= td),
    past = ks
      .filter((d) => d < td)
      .reverse()
      .slice(0, 5);
  const row = (d) => {
    const p = PL[d],
      c = p.status === "cancelled";
    return `<div class="row"><span><b>${fmt(d)}</b> · ${SCH.team[dayIdx(d)][0]}${p.time ? " · " + esc(p.time) : ""}${p.venue ? " · 📍 " + esc(p.venue) : ""}${c ? ' · <span class="tag a">Cancelled</span>' : ""}${SS[d] ? ' · <span class="tag p">Attendance recorded</span>' : ""}${p.note ? '<br><span class="mute">' + esc(p.note) + "</span>" : ""}${d >= td && !c ? "<br>" + availBlock(d, 1) : ""}</span>${admin ? `<span class="chips" style="margin:0"><button data-a="ed" data-d="${d}">✏️ Edit</button><button data-a="take" data-d="${d}">Attendance</button><button data-a="wa" data-d="${d}">⤴ Share</button><button data-a="cx" data-d="${d}">${c ? "Restore" : "Cancel"}</button><button class="dng" data-a="rm" data-d="${d}">Delete</button></span>` : ""}</div>`;
  };
  $("view").innerHTML =
    `${admin ? `<div class="card"><h2>Schedule a playing day</h2><div class="ctl"><input type="date" id="pd" value="${td}"><input id="pt" placeholder="Time" size="14" value="${esc(SCH.team[dayIdx(td)][3])}"></div><div class="ctl"><input id="pv" placeholder="Venue" maxlength="80" value="${esc(lastVenue())}" style="flex:1"></div><div class="ctl"><input id="pn" placeholder="Note (optional), e.g. practice match" maxlength="80" style="flex:1"><button class="pri" id="pa">Add</button></div></div>` : ""}
  <div class="card"><h2>Upcoming playing days</h2>${up.map(row).join("") || '<p class="mute">No playing days scheduled yet.</p>'}</div>
  ${past.length ? `<div class="card"><h2>Recent</h2>${past.map(row).join("")}</div>` : ""}`;
  if (!admin) return;
  $("pd").onchange = (e) => {
    if (e.target.value) $("pt").value = SCH.team[dayIdx(e.target.value)][3];
  };
  $("pa").onclick = () => {
    const d = $("pd").value;
    if (!d) return;
    run(async () => {
      await api("/api/plans/" + d, {
        method: "PUT",
        body: {
          time: $("pt").value.trim(),
          venue: $("pv").value.trim(),
          note: $("pn").value.trim(),
          status: "planned",
        },
      });
      try {
        localStorage.setItem("hk_venue", $("pv").value.trim());
      } catch (e) {}
      await load();
    });
  };
  document.querySelectorAll("[data-a]").forEach(
    (b) =>
      (b.onclick = () => {
        const d = b.dataset.d,
          a = b.dataset.a;
        if (a === "take") {
          takeDate = d;
          tab = "take";
          render();
        } else if (a === "ed") openPlanEdit(d);
        else if (a === "av") openAvail(d);
        else if (a === "wa") wa(planMsg(d));
        else if (a === "cx")
          run(async () => {
            await api("/api/plans/" + d, {
              method: "PUT",
              body: {
                ...PL[d],
                status: PL[d].status === "cancelled" ? "planned" : "cancelled",
              },
            });
            await load();
          });
        else if (confirm("Delete the plan for " + fmt(d) + "?"))
          run(async () => {
            await api("/api/plans/" + d, { method: "DELETE" });
            await load();
          });
      }),
  );
}
const when = (t) =>
  t
    ? new Date(t).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
// ---- profile photo + shared helpers ----
const photoBtns = (own, path, ph) =>
  `<div class="chips" style="justify-content:center"><button data-ph="c">📷 ${ph ? "Change photo" : "Add photo"}</button>${ph ? '<button data-ph="x">Remove photo</button>' : ""}</div>`;
function bindPhoto(own, path) {
  document.querySelectorAll("[data-ph]").forEach(
    (b) =>
      (b.onclick = () => {
        const put = (ph) =>
          run(async () => {
            await api(own ? "/api/me/photo" : path, {
              method: "PUT",
              body: { photo: ph },
            });
            await load(true);
          });
        if (b.dataset.ph === "x") put("");
        else pickPhoto(put);
      }),
  );
}
const openProf = (k, id) => {
  prof = { k, id };
  render();
  window.scrollTo(0, 0);
};
function openMyProfile() {
  if (role === "player") openProf("p", me);
  else if (role === "admin") openProf("a", ADMID);
  else openProf("s", role);
}
function bindProfLinks() {
  document
    .querySelectorAll("[data-pf]")
    .forEach((e) => (e.onclick = () => openProf("p", e.dataset.pf)));
}
const kv = (a, b) =>
  b ? `<div class="kv"><span>${a}</span><b>${b}</b></div>` : "";

function vPlayers() {
  const imp = !P.length && !RM.length,
    S = Object.fromEntries(stats("all").map((x) => [x.p.id, x]));
  $("view").innerHTML = `<div class="card"><h2>Players (${P.length})</h2>
  ${!imp ? `<div class="note">${["2025-11", "2026-01", "2026-02", "2026-03", "2026-04", "2026-07", "2026-09"].some((m) => L[m]) ? "Attendance for Nov 2025 to Sep 2026 is still monthly totals. " : "Attendance from the WhatsApp register (to 13 Oct 2026) is loaded. "}<button id="dw">${["2025-11", "2026-01", "2026-02", "2026-03", "2026-04", "2026-07", "2026-09"].some((m) => L[m]) ? "Replace with day-wise attendance" : "Re-apply register data"}</button></div>` : ""}
  ${imp ? '<div class="note">Team list is empty. <button id="imp">Import team and past attendance from the register</button></div>' : ""}
  <div class="ctl"><input id="pq" type="search" placeholder="Search name or roll no" aria-label="Search players"><button id="padd">➕ Add students</button></div>
  <p class="mute" style="margin:0 0 8px">Tap a player to open their profile.</p>
  <div class="tiles">${
    P.map((p) => {
      const s = S[p.id] || { pct: 0, pr: 0, t: 0 };
      return `<div class="pt" role="button" tabindex="0" data-pf="${p.id}" data-q="${esc((p.name + " " + p.roll + " " + (p.position || "")).toLowerCase())}">${avatar(p.name, p.photo, 46)}<span class="pi"><b>${esc(p.name)}</b><small>${esc([p.roll, p.position].filter(Boolean).join(" · ")) || "&nbsp;"}</small><span class="bar"><i style="width:${s.pct}%"></i></span></span><span class="pc"><b>${s.t ? s.pct + "%" : "–"}</b><small>${ACC.includes(p.id) ? "✔ signed up" : "not signed up"}</small></span></div>`;
    }).join("") || (imp ? "" : empty("👥", "No players yet."))
  }</div>
  ${P.length ? "" : '<p class="mute" style="text-align:center">Add students from the ⋮ menu → Add students.</p>'}</div>`;
  if ($("dw"))
    $("dw").onclick = () => {
      if (
        confirm(
          "Load the day-wise attendance from the register? This overwrites attendance saved for those dates (up to 13 Oct 2026).",
        )
      )
        run(async () => {
          await api("/api/import-daywise", { method: "POST" });
          await load();
        });
    };
  if ($("imp"))
    $("imp").onclick = () =>
      run(async () => {
        await api("/api/import", { method: "POST" });
        await load();
      });
  $("padd").onclick = openAdd;
  $("pq").oninput = (e) => {
    const q = e.target.value.trim().toLowerCase();
    document
      .querySelectorAll(".pt")
      .forEach((t) => (t.hidden = !!q && !t.dataset.q.includes(q)));
  };
  bindProfLinks();
}
function vRemoved() {
  const S = Object.fromEntries(RM.map((p) => [p.id, statsFor(p, "all")]));
  $("view").innerHTML =
    `<div class="card"><h2>Removed students (${RM.length})</h2><p class="mute">Removed students cannot log in and are not counted in team attendance. <b>Nothing is deleted</b>: contact, jersey details, joining date and every attendance record are kept. Tap a student to see all of it, or press Restore to bring them back.</p>
  <div class="tiles">${
    RM.map((p) => {
      const s = S[p.id];
      return `<div class="pt gone" role="button" tabindex="0" data-pf="${p.id}">${avatar(p.name, p.photo, 46)}<span class="pi"><b>${esc(p.name)}</b><small>${esc([p.roll, p.removedAt ? "removed " + when(p.removedAt) + (p.removedBy ? " by " + p.removedBy : "") : ""].filter(Boolean).join(" · ")) || "&nbsp;"}</small><small>${s.t ? `Attended ${s.pr} of ${s.t} days (${s.pct}%)` : "No attendance recorded"}${p.contact ? " · 📞 " + esc(p.contact) : ""}</small></span><span class="pc"><button class="pri" data-rs="${p.id}">Restore</button></span></div>`;
    }).join("") || empty("🗑️", "No removed students.")
  }</div></div>`;
  document.querySelectorAll("[data-rs]").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        run(async () => {
          await api("/api/players/" + b.dataset.rs + "/restore", {
            method: "POST",
          });
          await load();
        });
      }),
  );
  bindProfLinks();
}
function vAdmins() {
  const st = [
    ["captain", "Captain"],
    ["vice", "Vice-captain"],
  ];
  $("view").innerHTML =
    `<div class="card"><h2>Team staff</h2>${st.map((s) => `<div class="row link" role="button" tabindex="0" data-sf="${s[0]}"><span class="sw-row">${avatar(s[1], STAFF[s[0]], 40)}<span><b>${s[1]}</b><br><span class="mute">Full access</span></span></span><span class="chev">›</span></div>`).join("")}</div>
  <div class="card"><h2>Admins</h2><p class="mute">Admins can take attendance and edit everything except this list. They log in under <b>Captain / Admin</b> → Admin with their name and code. Use the switch to turn an admin's access on or off without deleting them. Tap an admin to open their profile.</p>
  <div class="ctl"><input id="an2" placeholder="Name" maxlength="40"><input id="ac" type="password" placeholder="Login code (4+ characters)" maxlength="30" autocomplete="new-password"><button class="pri" id="aadd">Add admin</button></div>
  ${ADM.map((a) => `<div class="row link" role="button" tabindex="0" data-af="${esc(a.id)}"><span class="sw-row"><button class="sw ${a.disabled ? "" : "on"}" role="switch" aria-checked="${!a.disabled}" aria-label="Access for ${esc(a.name)}" data-tg="${esc(a.id)}"></button>${avatar(a.name, a.photo, 40)}<span>${esc(a.name)}<br><span class="pill ${a.disabled ? "r" : "g"}">${a.disabled ? "Access off" : "Access on"}</span></span></span><button class="dng" data-adm="${esc(a.id)}">Remove</button></div>`).join("") || empty("🛡️", "No extra admins yet.")}</div>`;
  $("aadd").onclick = () => {
    const name = $("an2").value.trim(),
      code = $("ac").value;
    if (!name || code.length < 4)
      return alert("Enter a name and a code of at least 4 characters.");
    run(async () => {
      await api("/api/admins", { method: "POST", body: { name, code } });
      await load();
    });
  };
  document.querySelectorAll("[data-tg]").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        const a = ADM.find((x) => x.id === b.dataset.tg);
        run(async () => {
          await api("/api/admins/" + a.id, {
            method: "PUT",
            body: { disabled: !a.disabled },
          });
          await load(true);
        });
      }),
  );
  document.querySelectorAll("[data-adm]").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        const a = ADM.find((x) => x.id === b.dataset.adm);
        if (
          confirm(
            'Remove admin "' + a.name + '"? They will be logged out at once.',
          )
        )
          run(async () => {
            await api("/api/admins/" + a.id, { method: "DELETE" });
            await load(true);
          });
      }),
  );
  document
    .querySelectorAll("[data-af]")
    .forEach((r) => (r.onclick = () => openProf("a", r.dataset.af)));
  document
    .querySelectorAll("[data-sf]")
    .forEach((r) => (r.onclick = () => openProf("s", r.dataset.sf)));
}

// ---- profile detail page ----
function vProfile() {
  const k = prof.k,
    id = prof.id,
    back = '<button class="back" id="pb">‹ Back</button>';
  let h = "",
    photoPath = "",
    own = false;
  if (k === "p") {
    const p = [...P, ...RM].find((x) => x.id === id);
    if (!p) {
      prof = null;
      return render();
    }
    own = role === "player" && p.id === me;
    const gone = !!p.removed,
      a = statsFor(p, "all"),
      canPh = admin || own;
    photoPath = "/api/players/" + id + "/photo";
    const ms = months()
      .map((m) => ({ m, s: statsFor(p, m) }))
      .filter((x) => x.s.t);
    const ds = dates().filter((d) => SS[d][id] !== undefined),
      dots = ds
        .slice(-42)
        .map(
          (d) =>
            `<i class="dd ${SS[d][id] ? "p" : "a"}" title="${fmt(d)}: ${SS[d][id] ? "Present" : "Absent"}"></i>`,
        )
        .join("");
    let streak = 0;
    for (let i = ds.length - 1; i >= 0 && SS[ds[i]][id]; i--) streak++;
    const jersey = [
      p.jerseyNo ? "#" + esc(p.jerseyNo) : "",
      esc(p.jerseyName || ""),
      p.size ? "size " + esc(p.size) : "",
    ]
      .filter(Boolean)
      .join(" · ");
    h = `${back}<div class="card prof"><div class="cover"></div><div class="pavw">${avatar(p.name, p.photo, 104, "big")}</div>
    <h2 class="pname">${esc(p.name)}</h2><p class="mute pc2">${esc([p.roll, p.position || "Hockey player"].filter(Boolean).join(" · "))}</p>
    <div class="chips" style="justify-content:center;margin:6px 0 10px">${gone ? '<span class="pill r">Removed</span>' : '<span class="pill g">Team member</span>'}${ACC.includes(id) || own ? '<span class="pill g">Signed up</span>' : admin ? '<span class="pill">Not signed up</span>' : ""}${p.jerseyNo ? `<span class="pill">Jersey #${esc(p.jerseyNo)}</span>` : ""}</div>
    ${canPh ? photoBtns(own, photoPath, p.photo) : ""}
    ${gone ? `<div class="note">Removed ${p.removedAt ? when(p.removedAt) : ""}${p.removedBy ? " by " + esc(p.removedBy) : ""}. All details and attendance below are kept.${admin ? " Restore brings them back to the team." : ""}</div>` : ""}</div>
    <div class="grid"><div class="card"><h2>Attendance</h2><div class="hero2"><div class="ring" style="--v:${a.pct}"><b>${a.pct}%</b></div><div class="stats" style="flex:1;margin:0"><div><b>${a.pr}</b>Present</div><div><b>${a.t - a.pr}</b>Missed</div><div><b>${streak}</b>Current streak</div></div></div>
      ${dots ? `<p class="mute" style="margin:12px 0 4px">Last ${Math.min(42, ds.length)} playing days</p><div class="dots">${dots}</div>` : ""}
      ${ms.length ? `<table style="margin-top:10px"><tr><th>Month</th><th class="n">Present</th><th>%</th></tr>${ms.map((x) => `<tr><td>${mfmt(x.m)}</td><td class="n">${x.s.pr}/${x.s.t}</td><td><div class="bar"><i style="width:${x.s.pct}%"></i></div>${x.s.pct}%</td></tr>`).join("")}</table>` : ""}
      <div class="chips"><button id="pshr">⤴ Share attendance</button></div></div>
    <div class="card"><h2>Details</h2>${kv("Roll number", esc(p.roll))}${kv("Position", esc(p.position))}${kv("Joined", p.joined ? fmt(p.joined) : "")}
      ${p.contact ? `<div class="kv"><span>Contact</span><b><a href="tel:${esc(p.contact)}">${esc(p.contact)}</a> · <a href="https://wa.me/${to91(p.contact)}" target="_blank" rel="noopener">WhatsApp</a></b></div>` : admin || own ? kv("Contact", "<i>not saved</i>") : ""}
      ${kv("E-mail", p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : "")}${kv("Jersey", jersey)}
      ${admin ? `<div class="chips" style="margin-top:12px"><button id="pedit">✏️ Edit details</button>${!gone && ACC.includes(id) ? '<button id="prst">Reset code</button>' : ""}${gone ? '<button class="pri" id="prs">Restore</button><button class="dng" id="ppm">Delete forever</button>' : '<button class="dng" id="prm">Remove from team</button>'}</div>` : ""}</div></div>`;
    $("view").innerHTML = h;
    $("pshr").onclick = () => openReport({ sc: "person", v: id });
    if ($("pedit")) $("pedit").onclick = () => openEdit(p);
    if ($("prst"))
      $("prst").onclick = () => {
        if (
          confirm(
            "Reset the login code for " +
              p.name +
              "? They will sign up again with roll number + contact number and choose a new code.",
          )
        )
          run(async () => {
            await api("/api/players/" + id + "/account", { method: "DELETE" });
            await load(true);
          });
      };
    if ($("prm"))
      $("prm").onclick = () => {
        if (
          confirm(
            "Remove " +
              p.name +
              " from the team? They are logged out and hidden, but every detail and attendance record is kept. You can restore them from Removed students.",
          )
        )
          run(async () => {
            await api("/api/players/" + id, { method: "DELETE" });
            await load(true);
          });
      };
    if ($("prs"))
      $("prs").onclick = () =>
        run(async () => {
          await api("/api/players/" + id + "/restore", { method: "POST" });
          await load(true);
        });
    if ($("ppm"))
      $("ppm").onclick = () => {
        if (
          confirm(
            "Delete " +
              p.name +
              " forever? Their profile and login are erased. This cannot be undone.",
          )
        )
          run(async () => {
            await api("/api/players/" + id + "/permanent", {
              method: "DELETE",
            });
            prof = null;
            tab = "removed";
            await load(true);
          });
      };
  } else {
    let name,
      ph,
      sub,
      acts = "",
      canPh = false;
    if (k === "a") {
      const a =
        ADM.find((x) => x.id === id) ||
        (role === "admin" && id === ADMID
          ? { id, name: WHO, photo: MYPH, disabled: false }
          : null);
      if (!a) {
        prof = null;
        return render();
      }
      own = role === "admin" && id === ADMID;
      name = a.name;
      ph = a.photo;
      sub = "Admin";
      photoPath = "/api/admins/" + id + "/photo";
      canPh = own || owner;
      acts = `${kv("Role", "Admin")}${kv("Access", a.disabled ? '<span class="pill r">Off</span>' : '<span class="pill g">On</span>')}${a.created ? kv("Added", when(a.created)) : ""}${owner && ADM.some((x) => x.id === id) ? `<div class="chips" style="margin-top:12px"><button id="atg">${a.disabled ? "Turn access on" : "Turn access off"}</button><button class="dng" id="arm">Remove admin</button></div>` : ""}`;
    } else {
      own = role === id;
      name = id === "captain" ? "Captain" : "Vice-captain";
      ph = own ? MYPH : STAFF[id];
      sub = name;
      photoPath = "";
      canPh = own;
      acts = `${kv("Role", name)}${kv("Access", "Full: attendance, players, admins")}`;
    }
    $("view").innerHTML =
      `${back}<div class="card prof"><div class="cover"></div><div class="pavw">${avatar(name, ph, 104, "big")}</div><h2 class="pname">${esc(name)}</h2><p class="mute pc2">${sub}${own ? " · this is you" : ""}</p>${canPh ? photoBtns(own, photoPath, ph) : ""}</div><div class="card"><h2>Details</h2>${acts}</div>`;
    if ($("atg"))
      $("atg").onclick = () => {
        const a = ADM.find((x) => x.id === id);
        run(async () => {
          await api("/api/admins/" + id, {
            method: "PUT",
            body: { disabled: !a.disabled },
          });
          await load(true);
        });
      };
    if ($("arm"))
      $("arm").onclick = () => {
        if (confirm("Remove this admin? They will be logged out at once."))
          run(async () => {
            await api("/api/admins/" + id, { method: "DELETE" });
            prof = null;
            tab = "admins";
            await load(true);
          });
      };
  }
  $("pb").onclick = () => {
    prof = null;
    render();
    window.scrollTo(0, 0);
  };
  if (document.querySelector("[data-ph]")) bindPhoto(own, photoPath);
}
function openEdit(p) {
  let d = $("eddlg");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "eddlg";
    document.body.appendChild(d);
  }
  const f = (id, l, v, o = "") =>
    `<label class="fl">${l}<input id="ed-${id}" value="${esc(v || "")}" ${o}></label>`;
  d.innerHTML = `<h2>Edit ${esc(p.name)}</h2>${f("n", "Name", p.name, 'maxlength="40"')}${f("r", "Roll number", p.roll, 'maxlength="12"')}${f("p", "Position", p.position, 'maxlength="40"')}${f("c", "Contact number", p.contact, 'inputmode="tel" maxlength="15"')}${f("e", "E-mail", p.email, 'maxlength="40"')}${f("jn", "Jersey name", p.jerseyName, 'maxlength="40"')}${f("jo", "Jersey number", p.jerseyNo, 'maxlength="4"')}${f("sz", "Jersey size", p.size, 'maxlength="6"')}${f("j", "Joined date", p.joined, 'type="date"')}
  <div class="ctl"><button class="pri" id="eds">Save</button><button id="edc">Cancel</button></div>`;
  $("edc").onclick = () => d.close();
  $("eds").onclick = () => {
    const g = (i) => $("ed-" + i).value.trim();
    if (!g("n")) return alert("Name is required.");
    run(async () => {
      await api("/api/players/" + p.id, {
        method: "PUT",
        body: {
          name: g("n"),
          roll: g("r"),
          position: g("p"),
          contact: g("c"),
          email: g("e"),
          jerseyName: g("jn"),
          jerseyNo: g("jo"),
          size: g("sz"),
          joined: g("j"),
        },
      });
      d.close();
      await load(true);
    });
  };
  d.showModal();
}
function openGroup() {
  let d = $("gpdlg");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "gpdlg";
    document.body.appendChild(d);
  }
  d.innerHTML = `<h2>Hockey WhatsApp group link</h2><p class="mute">Everyone sees this link in their menu under <b>Join WhatsApp group</b>. In WhatsApp: open the group → Group info → Invite via link → Copy link, then paste it here.</p>
  <label class="fl">Invite link<input id="gpu" type="url" value="${esc(GROUP)}" placeholder="https://chat.whatsapp.com/…"></label>
  <div class="ctl"><button class="pri" id="gps">Save</button><button id="gpt">Test link</button><button id="gpr">Use default</button><button id="gpc">Cancel</button></div>`;
  $("gpc").onclick = () => d.close();
  $("gpt").onclick = () => {
    if ($("gpu").value.trim())
      window.open($("gpu").value.trim(), "_blank", "noopener");
  };
  const save = (u) =>
    run(async () => {
      await api("/api/group", { method: "PUT", body: { url: u } });
      d.close();
      await load(true);
    });
  $("gps").onclick = () => {
    const u = $("gpu").value.trim();
    if (u && !/^https:\/\/\S+$/.test(u))
      return alert("The link must start with https://");
    save(u);
  };
  $("gpr").onclick = () => save("");
  d.showModal();
}
$("wh").innerHTML = whistleSvg(26);
$("wh").onclick = () => playWhistle("short");
$("hp").onclick = openMyProfile;
boot();
setInterval(() => {
  if (token && !document.hidden) load();
}, 20000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) load();
});

// ---- availability for a playing day (active / injured / can't come / maybe) ----
const AVS = [
  ["active", "✅", "Active"],
  ["injured", "🤕", "Injured"],
  ["out", "❌", "Can't come"],
  ["maybe", "🤔", "Maybe"],
];
const avLabel = (k) => {
  const x = AVS.find((a) => a[0] === k);
  return x ? x[1] + " " + x[2] : "";
};
function lastVenue() {
  let v = "";
  try {
    v = localStorage.getItem("hk_venue") || "";
  } catch (e) {}
  return v || "Sports Complex";
}
const avChips = (d, id, cur) =>
  `<span class="avc">${AVS.map((a) => `<button type="button" class="${cur === a[0] ? "on " + a[0] : ""}" data-av="${a[0]}" data-d="${d}" data-id="${esc(id)}" aria-pressed="${cur === a[0]}">${a[1]} ${a[2]}</button>`).join("")}</span>`;
function avCounts(d) {
  const r = AVL[d] || {},
    c = { active: 0, injured: 0, out: 0, maybe: 0 };
  let n = 0;
  P.forEach((p) => {
    const x = r[p.id];
    if (x && c[x.s] !== undefined) {
      c[x.s]++;
      n++;
    }
  });
  return { c, none: P.length - n };
}
// players answer for themselves; staff see the counts and a button to open the full list
function availBlock(d, compact) {
  if (!d || !PL[d] || PL[d].status === "cancelled") return "";
  if (role === "player") {
    const cur = ((AVL[d] || {})[me] || {}).s || "";
    return `<div class="avb"><div class="mute" style="margin:6px 0 4px">${compact ? "" : "<b>Will you be there?</b> "}${cur ? "You said: <b>" + avLabel(cur) + "</b>. Tap again to clear." : "Tell the captain if you can come."}</div>${avChips(d, me, cur)}</div>`;
  }
  if (!admin) return "";
  const { c, none } = avCounts(d);
  return `<div class="avb"><span class="avs">${AVS.map((a) => `<span class="${a[0]}">${a[1]} <b>${c[a[0]]}</b></span>`).join("")}<span class="none">⏳ <b>${none}</b> no reply</span></span> <button type="button" data-avd="${d}">Availability</button></div>`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-av]");
  if (b) {
    const d = b.dataset.d,
      id = b.dataset.id,
      cur = ((AVL[d] || {})[id] || {}).s || "",
      s = cur === b.dataset.av ? "" : b.dataset.av;
    run(async () => {
      await api("/api/avail/" + d, { method: "PUT", body: { id, s } });
      await load();
      if ($("avdlg").open) drawAvail(d);
    });
    return;
  }
  const o = e.target.closest && e.target.closest("[data-avd]");
  if (o) openAvail(o.dataset.avd);
});
function drawAvail(d) {
  const r = AVL[d] || {},
    { c, none } = avCounts(d),
    dg = $("avdlg");
  const order = { injured: 0, out: 1, maybe: 2, active: 3, "": 4 };
  const ps = [...P].sort(
    (a, b) =>
      order[(r[a.id] || {}).s || ""] - order[(r[b.id] || {}).s || ""] ||
      a.name.localeCompare(b.name),
  );
  dg.innerHTML = `<h2>Availability</h2><p class="mute" style="margin-top:-6px"><b>${dlong(d)}</b>${PL[d] && PL[d].venue ? " · 📍 " + esc(PL[d].venue) : ""}</p>
  <div class="avs" style="margin-bottom:8px">${AVS.map((a) => `<span class="${a[0]}">${a[1]} ${a[2]} <b>${c[a[0]]}</b></span>`).join("")}<span class="none">⏳ No reply <b>${none}</b></span></div>
  <div class="avl">${ps.map((p) => `<div class="avr"><span class="avn">${avatar(p.name, p.photo, 28)} ${esc(p.name)}</span>${avChips(d, p.id, (r[p.id] || {}).s || "")}</div>`).join("")}</div>
  <div class="ctl"><button type="button" class="pri" id="avsh">⤴ Share list</button><button type="button" id="avx">Close</button></div>`;
  $("avx").onclick = () => dg.close();
  $("avsh").onclick = () => {
    const g = (k) =>
      ps
        .filter((p) => ((r[p.id] || {}).s || "") === k)
        .map((p) => "• " + p.name)
        .join("\n");
    const part = (k, t) => (g(k) ? `\n${t}\n${g(k)}\n` : "");
    shareText(
      `🏑 *Inter IIT Hockey: Availability*\n📅 ${dlong(d)}${PL[d] && PL[d].venue ? "\n📍 " + PL[d].venue : ""}\n` +
        part("active", "✅ *Active*") +
        part("injured", "🤕 *Injured*") +
        part("out", "❌ *Can't come*") +
        part("maybe", "🤔 *Maybe*") +
        (none
          ? `\n⏳ No reply: ${ps
              .filter((p) => !(r[p.id] || {}).s)
              .map((p) => p.name)
              .join(", ")}`
          : ""),
    );
  };
}
function openAvail(d) {
  drawAvail(d);
  $("avdlg").showModal();
}

// ---- edit a playing day: date, time, venue, note ----
function openPlanEdit(d) {
  const p = PL[d] || {},
    dg = $("pdlg"),
    locked = !!SS[d];
  dg.innerHTML = `<h2>Edit playing day</h2>
  <p><label class="lbl">Date</label><input type="date" id="ed_d" value="${d}" ${locked ? "disabled" : ""}>${locked ? '<span class="mute" style="display:block">Attendance is already saved for this day, so the date is locked.</span>' : ""}</p>
  <p><label class="lbl">Time</label><input id="ed_t" value="${esc(p.time || "")}" placeholder="e.g. 6:30–8:30 PM" maxlength="30"></p>
  <p><label class="lbl">Venue</label><input id="ed_v" value="${esc(p.venue || "")}" placeholder="e.g. Sports Complex" maxlength="80"></p>
  <p><label class="lbl">Note</label><input id="ed_n" value="${esc(p.note || "")}" placeholder="Optional" maxlength="80"></p>
  <div class="ctl"><button class="pri" id="ed_s">Save</button><button id="ed_x">Cancel</button></div>`;
  $("ed_x").onclick = () => dg.close();
  $("ed_s").onclick = () =>
    run(async () => {
      const nd = $("ed_d").value || d;
      await api("/api/plans/" + d, {
        method: "PUT",
        body: {
          newDate: nd,
          time: $("ed_t").value.trim(),
          venue: $("ed_v").value.trim(),
          note: $("ed_n").value.trim(),
          status: p.status || "planned",
        },
      });
      dg.close();
      await load();
    });
  dg.showModal();
}
