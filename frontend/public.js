// v16 additions, loaded BEFORE app.js (everything here only runs after app.js has started, so it can use its globals: $, esc, avatar, api ...)
//   1. the public page (shown without login): app features, captain, coach, photos, news
//   2. the "Open in app / Continue in web" question
//   3. the menu cross (✕) and the cross on pages opened from the menu
//   5. the personal card + feature shortcuts on the Home page after login

const gid = (id) => document.getElementById(id);
let NAMES = {},
  TEAM = { captain: {}, vice: {}, coach: {} },
  MYPID = "",
  PUB = null,
  pubBusy = false,
  pubErr = "";
const DEFNAME = {
  captain: "Captain",
  vice: "Vice-captain",
  coach: "Kiran Chaudhary",
};
const nameOf2 = (k) => ((TEAM && TEAM[k]) || {}).name || DEFNAME[k];

// ---------------------------------------------------------------- public page
const FEATURES = [
  [
    "✅",
    "Attendance",
    "Your attendance % out of all working days, month by month, with charts.",
  ],
  [
    "📅",
    "Playing days",
    "Calendar of practice days. Tell the captain if you can come or are injured.",
  ],
  [
    "⏰",
    "Weekly schedule",
    "Timings and the focus of every practice, for the team and goalkeepers.",
  ],
  [
    "📖",
    "Rules & signals",
    "Hockey rules, umpire signals with pictures and whistle sounds.",
  ],
  [
    "🔥",
    "Warm-up",
    "Warm-up and stretching routines to do before and after practice.",
  ],
  [
    "⏱",
    "Training & health",
    "Timer, match clock, and a log of your steps, distance, sleep, calories, height and weight.",
  ],
  ["🖼️", "Team gallery", "Share and view team photos."],
  [
    "🔔",
    "Reminders",
    "Alerts when a playing day is scheduled or cancelled, and 15 minutes before it starts.",
  ],
];
function teamBlock(team) {
  const t = team || {},
    row = (k, role) => {
      const x = t[k] || {},
        n = x.name || DEFNAME[k];
      return `<div class="tm">${avatar(n, x.photo, 64)}<b>${esc(n)}</b><span class="mute">${role}</span></div>`;
    };
  return `<div class="tms">${row("captain", "Captain")}${row("vice", "Vice-captain")}${row("coach", "Coach")}</div>`;
}
async function fetchPublic() {
  if (pubBusy) return;
  pubBusy = true;
  pubErr = "";
  try {
    const r = await fetch(API + "/api/public");
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Error " + r.status);
    PUB = j;
    TEAM = j.team || TEAM;
  } catch (e) {
    pubErr =
      e.message && !/fetch|network/i.test(e.message)
        ? e.message
        : "Cannot reach the server. Check your connection and try again.";
  }
  pubBusy = false;
  if (!gid("pub").hidden) drawPublic();
}
function pubMatches() {
  const src =
    (PUB && PUB.matches) || DEFM.map((x) => ({ d: x[0], t: x[1], v: x[2] }));
  return src
    .filter((m) => m.d >= today())
    .sort((a, b) => a.d.localeCompare(b.d))
    .slice(0, 5);
}
function drawPublic() {
  const p = PUB,
    inst = !standalone();
  const news = (a) =>
    !p
      ? '<p class="mute">Loading…</p>'
      : a && a.length
        ? newsRows(a.slice(0, 4))
        : '<p class="mute">No news found right now.</p>';
  const fx = pubMatches()
    .map((m) => {
      const dt = new Date(m.d + "T00:00");
      return `<div class="fx"><div class="dbx"><b>${dt.getDate()}</b><span>${dt.toLocaleDateString("en-IN", { month: "short" })}</span></div><div class="fxi"><b>${esc(m.t)}</b>${m.v ? `<span class="mute">${esc(m.v)}</span>` : ""}</div><span class="pill ${dlabel(m.d) === "Today" || dlabel(m.d) === "Tomorrow" ? "g" : ""}">${dlabel(m.d)}</span></div>`;
    })
    .join("");
  const photos =
    p && (p.groupPhoto || (p.gallery || []).length)
      ? `${p.groupPhoto ? `<img class="gph" id="pgph" src="${p.groupPhoto}" alt="Team group photo">` : ""}${(p.gallery || []).length ? `<div class="pstrip">${p.gallery.map((t, i) => `<img src="${t}" alt="" data-pg="${i}" loading="lazy">`).join("")}</div>` : ""}`
      : empty("📸", p ? "Team photos will appear here." : "Loading photos…");
  gid("pview").innerHTML =
    `<div class="card hero phero"><img src="icons/icon-192.png" alt="" width="72" height="72" class="plogo"><div class="ph2"><h2>Inter IIT Hockey</h2><span class="mute">Attendance · Schedule · Rules · Photos · News</span></div>
    <div class="ctl phb"><button class="pri big" data-plog>Log in to your account</button>${inst ? '<button class="big pghost" id="pinst">📲 Get the app</button>' : ""}</div></div>
  ${pubErr ? `<div class="note">${esc(pubErr)} <button id="ptry">Try again</button></div>` : ""}
  <div class="card"><h2>What you can do in the app</h2><div class="fts">${FEATURES.map((f) => `<button type="button" class="ft" data-plog><span class="ic">${f[0]}</span><b>${f[1]}</b><span class="mute">${f[2]}</span></button>`).join("")}</div><p class="mute" style="margin:10px 0 0">🔒 Personal details and attendance are shown only after you log in.</p></div>
  <div class="card"><h2>Our team</h2>${teamBlock(TEAM)}${p && p.playersCount ? `<p class="mute" style="text-align:center;margin:10px 0 0">${p.playersCount} players on the squad</p>` : ""}</div>
  <div class="card"><h2>Photos</h2>${photos}</div>
  <div class="grid"><div class="card"><h2>Upcoming Indian hockey</h2>${fx || empty("🗓️", "No upcoming matches in the list.")}</div>
  <div class="card"><h2>Latest hockey news</h2>${news(p && p.latest)}</div></div>
  <div class="card pcta"><h2>Part of the team?</h2><p class="mute">Log in with your roll number to see your own attendance, schedule and training.</p><div class="ctl" style="justify-content:center"><button class="pri big" data-plog style="max-width:320px">Log in</button></div></div>`;
  document
    .querySelectorAll("#pview [data-plog]")
    .forEach((b) => (b.onclick = showLogin));
  if (gid("pinst")) gid("pinst").onclick = openInApp;
  if (gid("ptry")) gid("ptry").onclick = () => fetchPublic();
  if (gid("pgph")) gid("pgph").onclick = () => openImg(p.groupPhoto);
  document
    .querySelectorAll("#pview [data-pg]")
    .forEach((i) => (i.onclick = () => openImg(i.src)));
}
function showPublic() {
  gid("app").hidden = true;
  gid("login").hidden = true;
  gid("pub").hidden = false;
  gid("menu").hidden = true;
  document.title = "Inter IIT Hockey · Team app";
  drawPublic();
  if (!PUB && !pubBusy) fetchPublic();
  else if (Date.now() - pubAt > 60000) fetchPublic();
  syncInstall();
}
let pubAt = Date.now();
function pubMenu() {
  const m = gid("menu");
  menuActs = [];
  const mi = (ic, label, fn) => {
    menuActs.push(fn);
    return `<button class="mi" data-k="${menuActs.length - 1}"><span class="i">${ic}</span><span class="t">${label}</span></button>`;
  };
  let h = menuHead("Menu") + mi("🔑", "Log in", showLogin);
  if (!standalone()) h += mi("📲", "Open in app / install", openInApp);
  h += mi("📲", "Share this app", shareApp);
  const g = (PUB && PUB.group) || window.WA_GROUP || "";
  if (g)
    h += mi("💬", "Join WhatsApp group", () =>
      window.open(g, "_blank", "noopener"),
    );
  m.innerHTML = h;
  wireMenu(m);
}
gid("pmb").onclick = (e) => {
  e.stopPropagation();
  const m = gid("menu");
  if (!m.hidden) {
    m.hidden = true;
    return;
  }
  pubMenu();
  m.hidden = false;
};
gid("pli").onclick = () => showLogin();

// ---------------------------------------------------------------- menu cross
const menuHead = (t) =>
  `<div class="mh"><b>${t}</b><button type="button" class="mx" data-mx aria-label="Close menu">✕</button></div>`;
function wireMenu(m) {
  const x = m.querySelector("[data-mx]");
  if (x)
    x.onclick = (e) => {
      e.stopPropagation();
      m.hidden = true;
    };
  m.querySelectorAll(".mi").forEach(
    (b) =>
      (b.onclick = () => {
        const k = +b.dataset.k,
          keep = b.hasAttribute("role");
        if (!keep) m.hidden = true;
        menuActs[k]();
      }),
  );
}
// the ⋮ button turns into ✕ while the menu is open (any way of opening or closing it)
new MutationObserver(() => {
  const o = !gid("menu").hidden;
  document.querySelectorAll(".mbtn").forEach((b) => {
    b.textContent = o ? "✕" : "⋮";
    b.classList.toggle("open", o);
    b.setAttribute("aria-expanded", String(o));
    b.setAttribute("aria-label", o ? "Close menu" : "Menu");
  });
}).observe(gid("menu"), { attributes: true, attributeFilter: ["hidden"] });
// ✕ on the login page goes back to the public page; ✕ in the header goes from any menu page back to Home
gid("lgx").onclick = () => showPublic();
gid("xb").onclick = () => {
  gid("menu").hidden = true;
  go("me");
};

// ---------------------------------------------------------------- open in app / continue in web
const oiaSeen = () => {
  try {
    return sessionStorage.getItem("hk_oia");
  } catch (e) {
    return "";
  }
};
const oiaSet = (v) => {
  try {
    sessionStorage.setItem("hk_oia", v);
  } catch (e) {}
};
function askOpenInApp() {
  if (standalone() || oiaSeen()) return;
  const d = gid("oia");
  if (d.open) return;
  gid("oiam").hidden = true;
  d.showModal();
}
async function openInApp() {
  // A website cannot force-launch an installed app. We install it when the browser allows, otherwise explain the one tap that does it.
  const m = gid("oiam");
  if (deferred) {
    gid("oia").open && gid("oia").close();
    oiaSet("app");
    await installApp();
    return;
  }
  const txt = isIOS
    ? "On iPhone / iPad: tap the Share button in Safari, choose “Add to Home Screen”, then open “Hockey” from your home screen."
    : "If the app is already installed, open “Hockey” from your home screen or app list (this page cannot start it for you). If it is not installed yet, open the browser menu ⋮ and choose “Install app” or “Add to Home screen”.";
  if (gid("oia").open) {
    m.textContent = txt;
    m.hidden = false;
    oiaSet("app");
  } else alert(txt);
}
gid("oiaa").onclick = openInApp;
gid("oiaw").onclick = () => {
  oiaSet("web");
  gid("oia").close();
};
gid("oiax").onclick = () => {
  oiaSet("web");
  gid("oia").close();
};
gid("oia").addEventListener("cancel", () => oiaSet("web"));

// ---------------------------------------------------------------- Home after login: personal card + feature shortcuts + team
function myInfoCard() {
  const kvp = (a, b) =>
    b ? `<div class="kv"><span>${a}</span><b>${b}</b></div>` : "";
  const lp =
    role === "player"
      ? P.find((x) => x.id === me)
      : MYPID && P.find((x) => x.id === MYPID);
  if (role === "player" || lp) {
    const p = lp;
    if (!p) return "";
    const a = statsFor(p, "all"),
      mo = today().slice(0, 7),
      mm = statsFor(p, mo);
    const jersey = [
      p.jerseyNo ? "#" + esc(p.jerseyNo) : "",
      esc(p.jerseyName || ""),
      p.size ? "size " + esc(p.size) : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return `<div class="card"><h2>My details</h2>
    <div class="stats"><div><b>${a.pct}%</b>Attendance</div><div><b>${a.pr}/${a.t}</b>Days present</div><div><b>${mm.t ? mm.pct + "%" : "–"}</b>This month</div></div>
    ${role !== "player" ? kvp("Role", roleLabel()) : ""}${kvp("Roll number", esc(p.roll))}${kvp("Position", esc(p.position))}${kvp("Jersey", jersey)}${kvp("E-mail", p.email ? esc(p.email) : "")}${kvp("Joined", p.joined ? fmt(p.joined) : "")}
    <div class="chips"><button id="myp">👤 Open my profile</button><button id="mye">✏️ Edit details</button><button data-go="stats">📊 My attendance</button></div></div>`;
  }
  const st = stats("all").filter((x) => x.t),
    tp = st.reduce((a, x) => a + x.t, 0),
    tr = tp ? Math.round((st.reduce((a, x) => a + x.pr, 0) * 100) / tp) : 0;
  return `<div class="card"><h2>My details</h2><div class="stats"><div><b>${P.length}</b>Players</div><div><b>${rdays("all")}</b>Working days</div><div><b>${tr}%</b>Team turnout</div></div>
  ${kvp("Name", esc(WHO))}${kvp("Role", role === "captain" ? "Captain" : role === "vice" ? "Vice-captain" : "Admin")}${kvp("Access", role === "admin" ? "Attendance and team editing" : "Full: attendance, players, admins")}
  <div class="chips"><button id="myp">👤 Open my profile</button><button data-go="take">✅ Take attendance</button></div></div>`;
}
function featTiles() {
  const t = tabsFor().filter((x) => x[0] !== "me" && x[0] !== "bugs");
  return `<div class="card"><h2>Features</h2><div class="fts fts2">${t.map((x) => `<button type="button" class="ft" data-go="${x[0]}"><span class="ic">${x[1]}</span><b>${x[2]}</b></button>`).join("")}</div></div>`;
}
function teamCard() {
  return `<div class="card"><h2>Our team</h2>${teamBlock(TEAM)}</div>`;
}
function bindHome() {
  document
    .querySelectorAll("#view [data-go]")
    .forEach((b) => (b.onclick = () => go(b.dataset.go)));
  if (gid("myp")) gid("myp").onclick = openMyProfile;
  if (gid("mye"))
    gid("mye").onclick = () => {
      const p = P.find((x) => x.id === me);
      if (p) openEdit(p, true);
    };
}
// captain / vice-captain: names shown on the public page, and which player record is theirs
function openNames() {
  const d = ensureDlg("nmdlg"),
    f = (k, l) =>
      `<label class="fl">${l}<input id="nm-${k}" maxlength="40" value="${esc(NAMES[k] || "")}" placeholder="${esc(DEFNAME[k])}"></label>`;
  const lk = NAMES.links || {},
    sel = (k, l) =>
      `<label class="fl">${l} is also this player<select id="lk-${k}"><option value="">Not linked</option>${P.map((x) => `<option value="${esc(x.id)}" ${lk[k] === x.id ? "selected" : ""}>${esc(x.name)}${x.roll ? " · " + esc(x.roll) : ""}</option>`).join("")}</select></label>`;
  d.innerHTML = `<h2>Captain, vice-captain and coach</h2><p class="mute">Names appear on the public page and on Home. Leave empty to use the player's name or the default.</p>${f("captain", "Captain")}${f("vice", "Vice-captain")}${f("coach", "Coach")}
  <h3 class="chh">Captain and vice-captain are players too</h3><p class="mute">Link each to their player record so they get the same profile (roll number, position, jersey, attendance) as any player.</p>${sel("captain", "Captain")}${sel("vice", "Vice-captain")}
  <div class="ctl"><button class="pri" id="nm-s">Save</button><button id="nm-c">Cancel</button></div>`;
  gid("nm-c").onclick = () => d.close();
  gid("nm-s").onclick = () =>
    run(async () => {
      await api("/api/staff-names", {
        method: "PUT",
        body: {
          captain: gid("nm-captain").value,
          vice: gid("nm-vice").value,
          coach: gid("nm-coach").value,
          links: {
            captain: gid("lk-captain").value,
            vice: gid("lk-vice").value,
          },
        },
      });
      d.close();
      await load(true);
    });
  d.showModal();
}
const roleLabel = () =>
  role === "captain"
    ? "Captain"
    : role === "vice"
      ? "Vice-captain"
      : role === "admin"
        ? "Admin"
        : "Player";

// ---------------------------------------------------------------- photo cropper
// cropFile(file,{title,ars:[[label,ratio]],out,q,cap,skip}) -> Promise<JPEG data URL | null>. ratio 0 = the picture's own shape.
// Drag to move, pinch / slider / wheel to zoom. "Use original" keeps the whole picture.
async function cropFile(file, o) {
  let bm = null;
  try {
    bm = await createImageBitmap(file);
  } catch (e) {
    bm = await new Promise((r) => {
      const im = new Image();
      im.onload = () => r(im);
      im.onerror = () => r(null);
      im.src = URL.createObjectURL(file);
    });
  }
  if (!bm) {
    alert("That file is not a picture.");
    return null;
  }
  const iw = bm.width,
    ih = bm.height,
    d = ensureDlg("crdlg"),
    ars = o.ars || [["Square", 1]];
  let ai = 0,
    zoom = 1,
    ox = 0,
    oy = 0,
    bw = 0,
    bh = 0,
    done = false;
  const ratio = () => {
    const r = ars[ai][1] || iw / ih;
    return Math.max(0.4, Math.min(4, r));
  };
  d.innerHTML = `<button type="button" class="dx" id="cr-xx" aria-label="Cancel">✕</button><h2>${esc(o.title || "Crop photo")}</h2>
  <div class="crv"><canvas id="crc"></canvas></div>
  ${ars.length > 1 ? `<div class="chips crar" style="justify-content:center">${ars.map((a, i) => `<button type="button" data-ar="${i}" class="${i === 0 ? "pri" : ""}">${esc(a[0])}</button>`).join("")}</div>` : ""}
  <label class="crz"><span>🔍</span><input type="range" id="crs" min="1" max="4" step="0.01" value="1" aria-label="Zoom"></label>
  <p class="mute" style="text-align:center;margin:2px 0 10px">Drag to move · pinch or slide to zoom</p>
  <div class="ctl"><button class="pri" id="cr-ok">✔ Use photo</button>${o.skip ? '<button id="cr-sk">Use original</button>' : ""}<button id="cr-x">Cancel</button></div>`;
  const cv = d.querySelector("#crc"),
    cx = cv.getContext("2d");
  const base = () => Math.max(bw / iw, bh / ih),
    sc = () => base() * zoom;
  const clamp = () => {
    const mx = Math.max(0, (iw * sc() - bw) / 2),
      my = Math.max(0, (ih * sc() - bh) / 2);
    ox = Math.max(-mx, Math.min(mx, ox));
    oy = Math.max(-my, Math.min(my, oy));
  };
  const draw = () => {
    clamp();
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.fillStyle = "#000";
    cx.fillRect(0, 0, bw, bh);
    const s2 = sc();
    cx.drawImage(
      bm,
      bw / 2 + ox - (iw * s2) / 2,
      bh / 2 + oy - (ih * s2) / 2,
      iw * s2,
      ih * s2,
    );
  };
  let dpr = Math.min(2, window.devicePixelRatio || 1);
  const layout = () => {
    const W = Math.min(360, innerWidth * 0.94 - 44),
      r = ratio();
    bw = W;
    bh = W / r;
    if (bh > 340) {
      bh = 340;
      bw = 340 * r;
    }
    cv.style.width = bw + "px";
    cv.style.height = bh + "px";
    cv.width = Math.round(bw * dpr);
    cv.height = Math.round(bh * dpr);
    zoom = 1;
    ox = oy = 0;
    d.querySelector("#crs").value = 1;
    draw();
  };
  const pts = new Map();
  let last = 0;
  cv.onpointerdown = (e) => {
    cv.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    last = 0;
  };
  cv.onpointermove = (e) => {
    if (!pts.has(e.pointerId)) return;
    const p = pts.get(e.pointerId);
    if (pts.size === 1) {
      ox += e.clientX - p[0];
      oy += e.clientY - p[1];
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      draw();
    } else {
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      const [a, b] = [...pts.values()],
        dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (last) {
        zoom = Math.max(1, Math.min(4, (zoom * dist) / last));
        d.querySelector("#crs").value = zoom;
        draw();
      }
      last = dist;
    }
  };
  cv.onpointerup = cv.onpointercancel = (e) => {
    pts.delete(e.pointerId);
    last = 0;
  };
  cv.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoom = Math.max(1, Math.min(4, zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
      d.querySelector("#crs").value = zoom;
      draw();
    },
    { passive: false },
  );
  d.querySelector("#crs").oninput = (e) => {
    zoom = +e.target.value;
    draw();
  };
  d.querySelectorAll("[data-ar]").forEach(
    (b) =>
      (b.onclick = () => {
        ai = +b.dataset.ar;
        d.querySelectorAll("[data-ar]").forEach((x) =>
          x.classList.toggle("pri", x === b),
        );
        layout();
      }),
  );
  const render = (whole) => {
    let r = whole ? iw / ih : ratio(),
      W = o.out || 1024,
      H = W,
      s2 = sc(),
      sx,
      sy,
      sw,
      sh;
    if (whole) {
      sx = 0;
      sy = 0;
      sw = iw;
      sh = ih;
    } else {
      sw = bw / s2;
      sh = bh / s2;
      sx = iw / 2 - ox / s2 - sw / 2;
      sy = ih / 2 - oy / s2 - sh / 2;
    }
    r = sw / sh;
    if (r >= 1) {
      W = o.out || 1024;
      H = W / r;
    } else {
      H = o.out || 1024;
      W = H * r;
    }
    let q = o.q || 0.8,
      out = "";
    for (let i = 0; i < 7; i++) {
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(W));
      c.height = Math.max(1, Math.round(H));
      const x = c.getContext("2d");
      x.fillStyle = "#fff";
      x.fillRect(0, 0, c.width, c.height);
      x.drawImage(bm, sx, sy, sw, sh, 0, 0, c.width, c.height);
      out = c.toDataURL("image/jpeg", q);
      if (!o.cap || out.length < o.cap) return out;
      W *= 0.85;
      H *= 0.85;
      q = Math.max(0.5, q - 0.05);
    }
    return out;
  };
  return new Promise((ok) => {
    const fin = (v) => {
      if (done) return;
      done = true;
      if (d.open) d.close();
      ok(v);
    };
    d.querySelector("#cr-ok").onclick = () => {
      const v = render(false);
      if (o.cap && v.length >= o.cap) {
        alert("That photo is too big. Zoom in a little and try again.");
        done = false;
        return;
      }
      fin(v);
    };
    if (o.skip)
      d.querySelector("#cr-sk").onclick = () => {
        const v = render(true);
        if (o.cap && v.length >= o.cap) {
          alert("That photo is too big. Use the crop and zoom in a little.");
          return;
        }
        fin(v);
      };
    d.querySelector("#cr-x").onclick = d.querySelector("#cr-xx").onclick = () =>
      fin(null);
    d.addEventListener("close", () => fin(null), { once: true });
    d.showModal();
    layout();
  });
}
const dataToBlob = async (u) => (await fetch(u)).blob();

// ---------------------------------------------------------------- profile cover (background) pictures
const COV = {};
const covKey = (k, id) => k + "_" + id;
async function loadCover(k, id) {
  const key = covKey(k, id);
  if (COV[key] !== undefined) return COV[key];
  try {
    const r = await api("/api/cover/" + k + "/" + encodeURIComponent(id));
    COV[key] = r.img || "";
  } catch (e) {
    COV[key] = "";
  }
  return COV[key];
}
function paintCover(el, img) {
  if (!el) return;
  el.style.backgroundImage = img
    ? `linear-gradient(#0000,#0b1f3366),url(${img})`
    : "";
  el.classList.toggle("has", !!img);
}
async function applyCover(k, id) {
  const img = await loadCover(k, id);
  if (!prof || (prof.id !== id && !(k === "s"))) return;
  paintCover(document.querySelector("#view .cover"), img);
  const rm = document.querySelector('[data-cv="x"]');
  if (rm) rm.hidden = !img;
}
async function setCover(k, id, file) {
  const img = await cropFile(file, {
    title: "Crop cover picture",
    ars: [
      ["Wide 3:1", 3],
      ["16:9", 16 / 9],
      ["4:3", 4 / 3],
    ],
    out: 900,
    q: 0.78,
    cap: 150000,
  });
  if (img === null) return;
  run(async () => {
    await api("/api/cover/" + k + "/" + encodeURIComponent(id), {
      method: "PUT",
      body: { img },
    });
    COV[covKey(k, id)] = img;
    render();
  });
}
function removeCover(k, id) {
  if (confirm("Remove the cover picture?"))
    run(async () => {
      await api("/api/cover/" + k + "/" + encodeURIComponent(id), {
        method: "PUT",
        body: { img: "" },
      });
      COV[covKey(k, id)] = "";
      render();
    });
}
const ownCoverKey = () =>
  role === "player"
    ? ["p", me]
    : MYPID
      ? ["p", MYPID]
      : role === "admin"
        ? ["a", ADMID]
        : ["s", role];

// ---------------------------------------------------------------- welcome hero (Home)
const QUOTES = [
  "Show up. The rest follows.",
  "Every practice counts.",
  "Small gains, every single day.",
  "Train hard, play smart, play together.",
  "Be the teammate you want beside you.",
  "Fitness wins the fourth quarter.",
  "Discipline beats motivation.",
];
function welcomeHero() {
  const hr = new Date().getHours(),
    g =
      hr < 5
        ? "Late night"
        : hr < 12
          ? "Good morning"
          : hr < 17
            ? "Good afternoon"
            : "Good evening";
  const first = esc((WHO || "").split(" ")[0] || "there"),
    lp =
      role === "player"
        ? P.find((x) => x.id === me)
        : MYPID && P.find((x) => x.id === MYPID);
  const sub = lp
    ? [
        roleLabel() !== "Player" ? roleLabel() : "",
        lp.position || "Hockey player",
        lp.roll,
      ]
        .filter(Boolean)
        .join(" · ")
    : role === "admin"
      ? "Admin" +
        (ADM.find((a) => a.id === ADMID) &&
        ADM.find((a) => a.id === ADMID).kind === "instructor"
          ? " · Instructor"
          : "")
      : roleLabel();
  const nx = Object.keys(PL)
      .sort()
      .find((x) => x >= today() && PL[x].status !== "cancelled"),
    pn = nx && PL[nx],
    r = nx && SCH.team[dayIdx(nx)];
  const nextTxt = nx
      ? `<b>${dlabel(nx)}</b> · ${esc(dlong(nx))}`
      : "<b>No playing day fixed yet</b>",
    nextSub = nx
      ? [
          pn.time || (r && r[3]) || "Time to be announced",
          pn.venue ? "📍 " + pn.venue : "",
        ]
          .filter(Boolean)
          .map(esc)
          .join(" · ")
      : "The captain will schedule the next one.";
  let stat;
  if (lp) {
    const a = statsFor(lp, "all"),
      ds = dates().filter((d) => SS[d] && SS[d][lp.id] !== undefined);
    let st = 0;
    for (let i = ds.length - 1; i >= 0 && SS[ds[i]][lp.id]; i--) st++;
    stat = `<div><b>${a.pct}%</b>Attendance</div><div><b>${a.pr}/${a.t}</b>Days present</div><div><b>${st}</b>Day streak</div>`;
  } else {
    const q = stats("all").filter((x) => x.t),
      t = q.reduce((a, x) => a + x.t, 0);
    stat = `<div><b>${P.length}</b>Players</div><div><b>${rdays("all")}</b>Working days</div><div><b>${t ? Math.round((q.reduce((a, x) => a + x.pr, 0) * 100) / t) : 0}%</b>Team turnout</div>`;
  }
  const day = Math.floor(Date.now() / 864e5);
  return `<div class="card hero wel" id="wel"><div class="wtop">${avatar(WHO, MYPH, 64)}<div class="wtx"><span class="wg">${g} 👋</span><h2>${first}</h2><span class="mute">${esc(sub)}</span></div></div>
  <div class="wnext"><span class="wl">🏑 Next practice</span><div>${nextTxt}</div><small>${nextSub}</small></div>
  <div class="stats wst">${stat}</div><p class="wq">“${QUOTES[day % QUOTES.length]}”</p></div>`;
}
async function heroCover() {
  const [k, id] = ownCoverKey();
  if (!id) return;
  const img = await loadCover(k, id);
  const el = gid("wel");
  if (el && img) {
    el.style.backgroundImage = `linear-gradient(135deg,#071a2ecc,#0f3f8f99),url(${img})`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
  }
}

// ---------------------------------------------------------------- push notifications: setup guide for the captain
async function openPushHelp() {
  const d = ensureDlg("pshdlg");
  let st = null;
  const draw = (keys) => {
    d.innerHTML = `<button type="button" class="dx" id="ps-xx" aria-label="Close">✕</button><h2>Set up push notifications</h2>
    <p class="mute">Push sends everyone a message when a playing day is scheduled or cancelled, even when the app is closed. It is free. You do this <b>once</b>.</p>
    <p class="note">${!st ? "Checking the server…" : st.configured ? `✅ The server is ready. ${st.devices} device${st.devices === 1 ? "" : "s"} subscribed.` : `⚠️ Not set up yet: the server has no push keys${st.hasPublic || st.hasPrivate ? " (one of the two is missing)" : ""}.`}</p>
    <ol class="steps"><li><b>Make the keys.</b> Press the button. You get a public key and a private key.<div class="chips"><button class="pri" id="ps-g">🔑 Generate keys</button></div>
    ${keys ? `<label class="fl">VAPID_PUBLIC_KEY<span class="cp"><input readonly id="k1" value="${esc(keys.publicKey)}"><button type="button" data-cp="k1">Copy</button></span></label><label class="fl">VAPID_PRIVATE_KEY (secret, never share it)<span class="cp"><input readonly id="k2" value="${esc(keys.privateKey)}"><button type="button" data-cp="k2">Copy</button></span></label>` : ""}</li>
    <li><b>Add them in Vercel.</b> Open vercel.com → your project → <i>Settings</i> → <i>Environment Variables</i>. Add three variables (all environments):<br><code>VAPID_PUBLIC_KEY</code> = the public key<br><code>VAPID_PRIVATE_KEY</code> = the private key<br><code>VAPID_SUBJECT</code> = <code>mailto:your-email@example.com</code></li>
    <li><b>Redeploy.</b> Vercel → <i>Deployments</i> → the latest one → <i>⋯</i> → <i>Redeploy</i>. Wait until it finishes, then reopen this app.</li>
    <li><b>Turn it on, on every phone.</b> Menu → <i>Push: day scheduled / cancelled</i> → ON → tap <i>Allow</i>. On iPhone first use Share → <i>Add to Home Screen</i> and open the app from the home screen (iOS 16.4 or newer).</li>
    <li><b>Test.</b> After step 4 on this phone, press the button.<div class="chips"><button id="ps-t">🔔 Send me a test</button></div><p id="ps-m" class="mute" role="status"></p></li></ol>
    <p class="mute" style="font-size:.82rem">If you generate new keys later, everyone must switch Push off and on again.</p>
    <div class="ctl"><button id="ps-c">Close</button></div>`;
    gid("ps-xx").onclick = gid("ps-c").onclick = () => d.close();
    gid("ps-g").onclick = async () => {
      try {
        draw(await api("/api/push/generate", { method: "POST" }));
      } catch (e) {
        alert("Could not make keys: " + e.message);
      }
    };
    d.querySelectorAll("[data-cp]").forEach(
      (b) =>
        (b.onclick = async () => {
          const ok = await copyText(gid(b.dataset.cp).value);
          b.textContent = ok ? "Copied ✓" : "Select + copy";
        }),
    );
    gid("ps-t").onclick = async () => {
      const m = gid("ps-m");
      m.textContent = "Sending…";
      try {
        const r = await api("/api/push/test", { method: "POST" });
        m.textContent = r.sent
          ? "Sent. Check your notifications."
          : "Nothing was delivered. Turn Push off and on again in the menu.";
      } catch (e) {
        m.textContent = e.message;
      }
    };
  };
  draw(null);
  d.showModal();
  try {
    st = await api("/api/push/setup");
    if (d.open) {
      const k = gid("k1")
        ? { publicKey: gid("k1").value, privateKey: gid("k2").value }
        : null;
      draw(k);
    }
  } catch (e) {}
}
