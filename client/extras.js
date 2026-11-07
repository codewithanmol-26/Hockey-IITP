// v18 additions, loaded BEFORE app.js (like public.js, everything here runs after app.js has started, so it can use its globals).
//   1. day / night (light / dark) toggle
//   2. tags: tag players or groups (@Everyone, @Goalkeepers ...) on announcements and on schedule days
//   3. announcements on the Home tab
//   4. schedule safety: a damaged or partly saved schedule can no longer blank the Schedule tab

// ---------------------------------------------------------------- 1. day / night
const THEME_KEY = "hk_theme";
const themePref = () => {
  try {
    return localStorage.getItem(THEME_KEY) || "";
  } catch (e) {
    return "";
  }
};
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
};
function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  paintTheme();
}
function paintTheme() {
  const dk = isDark();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dk ? "#07131f" : "#0b2a4a");
  ["thm", "pthm"].forEach((id) => {
    const b = document.getElementById(id);
    if (!b) return;
    b.innerHTML = ico(dk ? "sun" : "moon");
    b.setAttribute(
      "aria-label",
      dk
        ? "Night mode is active. Tap to switch to day mode"
        : "Day mode is active. Tap to switch to night mode",
    );
    b.title = dk ? "Switch to day mode" : "Switch to night mode";
  });
}
function setTheme(t) {
  try {
    if (t) localStorage.setItem(THEME_KEY, t);
    else localStorage.removeItem(THEME_KEY);
  } catch (e) {}
  applyTheme(t);
}
function toggleTheme() {
  setTheme(isDark() ? "light" : "dark");
}
function wireThemeButtons() {
  ["thm", "pthm"].forEach((id) => {
    const b = document.getElementById(id);
    if (b && !b._wired) {
      b._wired = true;
      b.onclick = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        toggleTheme();
        if (
          document.getElementById("menu") &&
          !document.getElementById("menu").hidden &&
          typeof drawMenu === "function"
        )
          drawMenu();
      };
    }
  });
  paintTheme();
}
wireThemeButtons();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireThemeButtons);
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (!themePref()) paintTheme();
});

// ---------------------------------------------------------------- 2. tags
// A tag is { k: 'p:<player id>' | 'g:all|gk|fwd|mid|def', n: label }. The same rules are on the server (for push notifications).
let ANN = [],
  annAll = false;
const TAGGROUPS = [
  ["g:all", "Everyone", "👥"],
  ["g:gk", "Goalkeepers", "🧤"],
  ["g:fwd", "Forwards", "⚡"],
  ["g:mid", "Midfielders", "🎯"],
  ["g:def", "Defenders", "🛡️"],
];
const GRX = {
  gk: /goal|keeper|\bgk\b/i,
  fwd: /forward|wing|striker/i,
  mid: /mid|half/i,
  def: /back|defen/i,
};
const myTagId = () => (pl ? me : typeof MYPID === "string" ? MYPID : "");
function tagMine(tags) {
  if (!Array.isArray(tags) || !tags.length) return false;
  const id = myTagId(),
    pp = id ? P.find((x) => x.id === id) : null,
    pos = (pp && pp.position) || "";
  return tags.some(
    (t) =>
      t.k === "g:all" ||
      (!!id && t.k === "p:" + id) ||
      (t.k.startsWith("g:") &&
        GRX[t.k.slice(2)] &&
        GRX[t.k.slice(2)].test(pos)),
  );
}
const tagChips = (tags, max) => {
  const a = Array.isArray(tags) ? tags : [];
  if (!a.length) return "";
  const id = myTagId(),
    shown = max ? a.slice(0, max) : a;
  return `<span class="tgs">${shown.map((t) => `<span class="tg ${(t.k === "p:" + id && id) || t.k === "g:all" ? "me" : ""}">@${esc(t.n)}</span>`).join("")}${max && a.length > max ? `<span class="tg">+${a.length - max}</span>` : ""}</span>`;
};

// Opens a picker. cur = current tags, cb(newTags) is called on Done.
function pickTags(cur, cb) {
  const sel = new Map((cur || []).map((t) => [t.k, t.n]));
  let d = document.getElementById("tgdlg");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "tgdlg";
    document.body.appendChild(d);
  }
  const people = P.slice().sort((a, b) =>
    String(a.name).localeCompare(String(b.name)),
  );
  d.innerHTML = `<button type="button" class="dx" id="tgx" aria-label="Close">✕</button><h2>🏷️ Tag people</h2>
  <p class="mute">Tagged players see it highlighted and get a notification (if they turned push on).</p>
  <div class="chips tgg" id="tgg"></div><div id="tgsel" class="tgsel"></div>
  <input id="tgq" type="search" placeholder="Search a player" aria-label="Search a player" autocomplete="off">
  <div id="tgl" class="tgl"></div>
  <div class="ctl"><button class="pri" id="tgok">Done</button><button id="tgclr">Clear</button></div>`;
  const paint = () => {
    d.querySelector("#tgg").innerHTML = TAGGROUPS.map(
      (g) =>
        `<button type="button" class="${sel.has(g[0]) ? "pri" : ""}" data-k="${g[0]}" data-n="${g[1]}" aria-pressed="${sel.has(g[0])}">${g[2]} ${g[1]}</button>`,
    ).join("");
    d.querySelector("#tgsel").innerHTML = sel.size
      ? [...sel]
          .map(([k, n]) => `<span class="tg me">@${esc(n)}</span>`)
          .join("")
      : '<span class="mute">Nobody tagged</span>';
    const q = d.querySelector("#tgq").value.trim().toLowerCase();
    const rows = people.filter(
      (p) =>
        !q ||
        (p.name + " " + (p.roll || "") + " " + (p.position || ""))
          .toLowerCase()
          .includes(q),
    );
    d.querySelector("#tgl").innerHTML = rows.length
      ? rows
          .map(
            (p) =>
              `<button type="button" class="tgp ${sel.has("p:" + p.id) ? "on" : ""}" data-k="p:${esc(p.id)}" data-n="${esc(p.name)}" aria-pressed="${sel.has("p:" + p.id)}"><span class="ck">${sel.has("p:" + p.id) ? "✓" : ""}</span><span><b>${esc(p.name)}</b><small>${esc([p.roll, p.position].filter(Boolean).join(" · "))}</small></span></button>`,
          )
          .join("")
      : '<p class="mute">No player found.</p>';
    d.querySelectorAll("[data-k]").forEach(
      (b) =>
        (b.onclick = () => {
          const k = b.dataset.k;
          if (sel.has(k)) sel.delete(k);
          else sel.set(k, b.dataset.n);
          paint();
        }),
    );
  };
  d.querySelector("#tgq").oninput = paint;
  d.querySelector("#tgclr").onclick = () => {
    sel.clear();
    paint();
  };
  d.querySelector("#tgx").onclick = () => d.close();
  d.querySelector("#tgok").onclick = () => {
    d.close();
    cb([...sel].map(([k, n]) => ({ k, n })));
  };
  paint();
  d.showModal();
}

// ---------------------------------------------------------------- 3. announcements
const annWhen = (at) => {
  const x = new Date(at || 0);
  return (
    x.toLocaleDateString(undefined, { day: "numeric", month: "short" }) +
    ", " +
    x.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  );
};
// deadline: after "until" the announcement disappears for players (admins still see it, marked Expired, so they can repost or delete it)
const annActive = (a) => !a.until || a.until > Date.now();
const annLocal = (ms) => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};
const annUntil = (a) =>
  a.until
    ? new Date(a.until).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      }) +
      ", " +
      new Date(a.until).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
function annItem(a) {
  const mine = tagMine(a.tags);
  return `<article class="an ${mine ? "mine" : ""} ${a.pinned ? "pin" : ""}">
    <div class="anh">${a.pinned ? '<span class="pill">📌 Pinned</span>' : ""}${a.until ? (annActive(a) ? `<span class="pill">⏳ Until ${esc(annUntil(a))}</span>` : '<span class="pill r">Expired</span>') : ""}${mine ? '<span class="pill g">You are tagged</span>' : ""}</div>
    ${a.title ? `<h3>${esc(a.title)}</h3>` : ""}<p class="ant">${esc(a.text)}</p>
    ${tagChips(a.tags)}
    <div class="anm mute">${esc(a.by || "Admin")} · ${annWhen(a.at)}${a.edited ? " · edited" : ""}</div>
    ${admin ? `<div class="chips"><button data-ae="${esc(a.id)}">✏️ Edit</button><button data-ad="${esc(a.id)}">🗑 Delete</button></div>` : ""}
  </article>`;
}
function annCard() {
  const list = ANN.filter((a) => admin || annActive(a)).sort(
    (a, b) =>
      (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
      (tagMine(b.tags) ? 1 : 0) - (tagMine(a.tags) ? 1 : 0) ||
      (b.at || 0) - (a.at || 0),
  );
  const shown = annAll ? list : list.slice(0, 3);
  return `<div class="card ann" id="anncard"><h2>📢 Announcements${admin ? ` <button class="pri sm" id="annnew">＋ New</button>` : ""}</h2>
  ${shown.length ? shown.map(annItem).join("") : empty("📢", "No announcements yet." + (admin ? " Press “New” to post one." : ""))}
  ${list.length > 3 ? `<div class="ctl"><button id="annmore">${annAll ? "Show less" : "Show all (" + list.length + ")"}</button></div>` : ""}</div>`;
}
function bindAnn() {
  const nb = document.getElementById("annnew");
  if (nb) nb.onclick = () => openAnn();
  const mb = document.getElementById("annmore");
  if (mb)
    mb.onclick = () => {
      annAll = !annAll;
      render();
    };
  document
    .querySelectorAll("[data-ae]")
    .forEach(
      (b) =>
        (b.onclick = () => openAnn(ANN.find((x) => x.id === b.dataset.ae))),
    );
  document.querySelectorAll("[data-ad]").forEach(
    (b) =>
      (b.onclick = () => {
        if (confirm("Delete this announcement?"))
          run(async () => {
            await api(
              "/api/announcements/" + encodeURIComponent(b.dataset.ad),
              { method: "DELETE" },
            );
            await load(true);
          });
      }),
  );
}
function openAnn(a) {
  let d = document.getElementById("andlg");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "andlg";
    document.body.appendChild(d);
  }
  let tags = a && a.tags ? a.tags.slice() : [];
  d.innerHTML = `<button type="button" class="dx" id="anx" aria-label="Close">✕</button><h2>${a ? "Edit announcement" : "New announcement"}</h2>
  <label class="fl">Title (optional)<input id="ant" maxlength="80" value="${esc(a ? a.title : "")}" placeholder="e.g. Practice moved"></label>
  <label class="fl">Message<textarea id="anb" rows="5" maxlength="1500" placeholder="Write the announcement" style="width:100%">${esc(a ? a.text : "")}</textarea></label>
  <div class="fl">Tag<div id="antg" class="tgsel"></div><button type="button" id="antb">🏷️ Tag people</button></div>
  <label class="fl">Show until (optional)<input type="datetime-local" id="anu" value="${a && a.until ? annLocal(a.until) : ""}"><span class="mute">After this date and time the announcement disappears for everyone except admins. Leave empty to keep it.</span></label>
  <label class="chk"><input type="checkbox" id="anp" ${a && a.pinned ? "checked" : ""}> 📌 Pin to the top</label>
  <p id="anerr" class="err" role="alert"></p>
  <div class="ctl"><button class="pri" id="ansv">${a ? "Save" : "Post"}</button><button id="ancx">Cancel</button></div>`;
  const paint = () => {
    d.querySelector("#antg").innerHTML = tags.length
      ? tagChips(tags)
      : '<span class="mute">Nobody tagged. Everyone still sees it.</span>';
  };
  d.querySelector("#antb").onclick = () =>
    pickTags(tags, (t) => {
      tags = t;
      paint();
    });
  d.querySelector("#anx").onclick = d.querySelector("#ancx").onclick = () =>
    d.close();
  d.querySelector("#ansv").onclick = () => {
    const text = d.querySelector("#anb").value.trim();
    if (!text) {
      d.querySelector("#anerr").textContent = "Write the message first.";
      return;
    }
    const uv = d.querySelector("#anu").value,
      um = uv ? new Date(uv).getTime() : 0;
    if (uv && um <= Date.now()) {
      d.querySelector("#anerr").textContent =
        "The deadline must be in the future.";
      return;
    }
    const body = {
      title: d.querySelector("#ant").value.trim(),
      text,
      tags,
      pinned: d.querySelector("#anp").checked,
      until: um,
    };
    d.close();
    run(async () => {
      await (a
        ? api("/api/announcements/" + encodeURIComponent(a.id), {
            method: "PUT",
            body,
          })
        : api("/api/announcements", { method: "POST", body }));
      await load(true);
    });
  };
  paint();
  d.showModal();
}

// ---------------------------------------------------------------- 4. schedule safety
// Every row is rebuilt as [day, session, details, timing, tags], so missing or damaged rows fall back to the built-in week.
function normSch(s) {
  const def = JSON.parse(SCH0),
    out = {};
  ["team", "gk"].forEach((k) => {
    const src = s && Array.isArray(s[k]) ? s[k] : [];
    out[k] = def[k].map((dr, i) => {
      const r = src[i];
      if (!Array.isArray(r)) return [...dr, []];
      const sx = (v) => (v == null ? "" : String(v));
      return [
        sx(r[0]) || dr[0],
        sx(r[1]),
        sx(r[2]),
        sx(r[3]),
        Array.isArray(r[4])
          ? r[4].filter((t) => t && typeof t.k === "string")
          : [],
      ];
    });
  });
  return out;
}

if (document.getElementById("netr"))
  document.getElementById("netr").onclick = () => {
    setNet("📡 Trying again…");
    load(true);
  };

// ---------------------------------------------------------------- 5. health log (typed in by hand, private to each person)
let HL = [],
  hlLoaded = false,
  hlBusy = false,
  hlErr = "",
  hlDate = "",
  hlMsg = "";
const HLF = [
  ["steps", "Steps", "steps", "1", 100000],
  ["km", "Distance", "km", "0.1", 200],
  ["sleep", "Sleep", "hours", "0.1", 24],
  ["kcal", "Calories", "kcal", "1", 10000],
  ["height", "Height", "cm", "0.1", 250],
  ["weight", "Weight", "kg", "0.1", 300],
];
async function loadHl() {
  hlBusy = true;
  hlErr = "";
  try {
    const r = await api("/api/health-log");
    HL = r.items || [];
    hlLoaded = true;
  } catch (e) {
    hlErr =
      "Could not load your health log: " +
      (e.status ? e.message : "check your connection");
  }
  hlBusy = false;
  if (tab === "train" && !prof) render();
}
const hlNum = (v, dp) =>
  dp ? (Math.round(v * 10) / 10).toString() : Math.round(v).toLocaleString();
function healthCard() {
  if (!hlLoaded && !hlBusy && !hlErr) loadHl();
  const d = hlDate || today(),
    cur = HL.find((x) => x.date === d) || {},
    from = addDays(today(), -6);
  const wk = HL.filter((x) => x.date >= from && x.date <= today());
  const avg = (k) => {
    const v = wk.filter((x) => x[k] > 0).map((x) => x[k]);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  };
  const last = (k) => {
    const x = HL.find((y) => y[k] > 0);
    return x ? x[k] : 0;
  };
  const hgt = last("height"),
    wgt = last("weight"),
    bmi = hgt && wgt ? wgt / ((hgt / 100) * (hgt / 100)) : 0;
  const tile = (v, lab) => `<div><b>${v || "–"}</b>${lab}</div>`;
  const tiles = `<div class="stats">${tile(avg("steps") ? hlNum(avg("steps")) : 0, "Steps / day")}${tile(avg("km") ? hlNum(avg("km"), 1) : 0, "km / day")}${tile(avg("sleep") ? hlNum(avg("sleep"), 1) + " h" : 0, "Sleep / night")}${tile(avg("kcal") ? hlNum(avg("kcal")) : 0, "kcal / day")}</div>
    <div class="stats" style="margin-top:8px">${tile(wgt ? hlNum(wgt, 1) + " kg" : 0, "Weight")}${tile(hgt ? hlNum(hgt, 1) + " cm" : 0, "Height")}${tile(bmi ? hlNum(bmi, 1) : 0, "BMI")}</div>
    <p class="mute" style="margin:6px 0 0;font-size:.82rem">Averages are for the last 7 days, using only the days you filled in. BMI is only a rough guide for athletes.</p>`;
  const inputs = HLF.map(
    (f) =>
      `<label class="fl" style="flex:1 1 44%;margin:0">${f[1]} <small class="mute">(${f[2]})</small><input id="hl_${f[0]}" type="number" inputmode="${f[3] === "1" ? "numeric" : "decimal"}" step="${f[3]}" min="0" max="${f[4]}" value="${cur[f[0]] || ""}" placeholder="–"></label>`,
  ).join("");
  const part = (x) =>
    [
      x.steps ? hlNum(x.steps) + " steps" : "",
      x.km ? x.km + " km" : "",
      x.sleep ? x.sleep + " h sleep" : "",
      x.kcal ? hlNum(x.kcal) + " kcal" : "",
      x.weight ? x.weight + " kg" : "",
      x.height ? x.height + " cm" : "",
    ]
      .filter(Boolean)
      .join(" · ");
  const rows = HL.slice(0, 14)
    .map(
      (x) =>
        `<div class="wr"><div class="wi"><b>${fmt(x.date)}</b><span class="mute">${esc(part(x))}</span></div><button data-hle="${x.date}" aria-label="Edit ${fmt(x.date)}">✏️</button><button class="x" data-hld="${x.date}" aria-label="Delete ${fmt(x.date)}">🗑</button></div>`,
    )
    .join("");
  return `<div class="card" id="hlcard"><h2>❤️ My health log</h2><p class="mute" style="margin:0 0 8px">Type in your numbers from your watch or phone. Only you can see them. Fill only what you know.</p>
  ${hlLoaded ? tiles : ""}
  <h3 style="margin:14px 0 6px;font-size:1rem">${d === today() ? "Today" : fmt(d)}</h3>
  <label class="fl" style="margin-bottom:8px">Date<input id="hl_date" type="date" value="${d}" max="${today()}"></label>
  <div class="ctl" style="align-items:flex-end">${inputs}</div>
  <p id="hl_msg" class="${hlMsg.startsWith("Saved") || hlMsg.startsWith("Deleted") ? "mute" : "err"}" role="status" style="margin:8px 0 0">${esc(hlMsg)}</p>
  <div class="ctl"><button class="pri" id="hl_save">Save</button>${cur.date ? '<button id="hl_del">Delete this day</button>' : ""}</div>
  ${rows ? `<h3 style="margin:14px 0 4px;font-size:1rem">Recent days</h3>${rows}` : hlErr ? `<p class="err">${esc(hlErr)}</p><button id="hl_try">Try again</button>` : empty("❤️", hlLoaded ? "Nothing saved yet. Add today's numbers above." : "Loading…")}</div>`;
}
function bindHealth() {
  hlMsg = "";
  const sv = document.getElementById("hl_save");
  if (!sv) return;
  const msg = (t, ok) => {
    const m = document.getElementById("hl_msg");
    if (m) {
      m.textContent = t;
      m.className = ok ? "mute" : "err";
    }
  };
  document.getElementById("hl_date").onchange = (e) => {
    hlDate = e.target.value || today();
    vTrain();
  };
  sv.onclick = () => {
    const d = document.getElementById("hl_date").value || today(),
      body = {};
    for (const f of HLF) {
      const v = document.getElementById("hl_" + f[0]).value.trim();
      if (v === "") continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > f[4])
        return msg(f[1] + " must be a number from 0 to " + f[4] + ".");
      if (n > 0) body[f[0]] = n;
    }
    if (!Object.keys(body).length) return msg("Enter at least one value.");
    sv.disabled = true;
    sv.textContent = "Saving…";
    run(async () => {
      await api("/api/health-log/" + d, { method: "PUT", body });
      hlDate = d;
      hlMsg = "Saved for " + fmt(d) + ".";
      await loadHl();
    }).finally(() => {
      const b = document.getElementById("hl_save");
      if (b) {
        b.disabled = false;
        b.textContent = "Save";
      }
    });
  };
  const dl = document.getElementById("hl_del");
  if (dl)
    dl.onclick = () => {
      const d = document.getElementById("hl_date").value;
      if (confirm("Delete the numbers for " + fmt(d) + "?"))
        run(async () => {
          await api("/api/health-log/" + d, { method: "DELETE" });
          hlMsg = "Deleted " + fmt(d) + ".";
          await loadHl();
        });
    };
  document.querySelectorAll("[data-hle]").forEach(
    (b) =>
      (b.onclick = () => {
        hlDate = b.dataset.hle;
        vTrain();
        const c = document.getElementById("hlcard");
        if (c) c.scrollIntoView({ behavior: "smooth", block: "start" });
      }),
  );
  document.querySelectorAll("[data-hld]").forEach(
    (b) =>
      (b.onclick = () => {
        if (confirm("Delete the numbers for " + fmt(b.dataset.hld) + "?"))
          run(async () => {
            await api("/api/health-log/" + b.dataset.hld, { method: "DELETE" });
            hlMsg = "Deleted " + fmt(b.dataset.hld) + ".";
            await loadHl();
          });
      }),
  );
  const tr = document.getElementById("hl_try");
  if (tr)
    tr.onclick = () => {
      hlErr = "";
      hlLoaded = false;
      render();
    };
}

// ----------------------------------------------------------------
// 5. IIT Patna Academic Calendar & Institute Holidays 2026-27
// ----------------------------------------------------------------
const IITP_ACAD = {
  holidays: [
    { d: "2026-01-26", name: "Republic Day", day: "Monday" },
    { d: "2026-03-04", name: "Holi", day: "Wednesday" },
    { d: "2026-03-21", name: "Idul Fitr*", day: "Saturday", note: "Subject to moon visibility" },
    { d: "2026-03-31", name: "Mahavir Jayanti", day: "Tuesday" },
    { d: "2026-04-03", name: "Good Friday", day: "Friday" },
    { d: "2026-05-01", name: "Buddha Purnima", day: "Friday" },
    { d: "2026-05-27", name: "Idul Zuha (Bakrid)*", day: "Wednesday", note: "Subject to moon visibility" },
    { d: "2026-06-26", name: "Muharram*", day: "Friday", note: "Subject to moon visibility" },
    { d: "2026-08-15", name: "Independence Day", day: "Saturday" },
    { d: "2026-08-26", name: "Prophet Mohammad's Birthday (Id-E-Milad)*", day: "Wednesday", note: "Subject to moon visibility" },
    { d: "2026-10-02", name: "Mahatma Gandhi's Birthday", day: "Friday" },
    { d: "2026-10-19", name: "Dussehra (Mahasthami)", day: "Monday" },
    { d: "2026-10-20", name: "Dussehra (Mahanavmi / Vijay Dashmi)", day: "Tuesday" },
    { d: "2026-11-08", name: "Diwali (Deepavali)", day: "Sunday" },
    { d: "2026-11-16", name: "Chhath Puja (Pratihar / Surya Saptami)", day: "Monday" },
    { d: "2026-11-24", name: "Guru Nanak's Birthday", day: "Tuesday" },
    { d: "2026-12-25", name: "Christmas Day", day: "Friday" },
  ],
  exams: [
    {
      id: "mse",
      name: "Mid Semester Examination (MSE)",
      short: "Mid-Sem Exam",
      start: "2026-09-20",
      end: "2026-09-28",
      type: "exam",
      desc: "Mid Semester Exams for B.Tech 2nd yr onwards, M.Tech, M.Sc & PhD"
    },
    {
      id: "mse-makeup",
      name: "Make-up Exam (Mid Sem)",
      short: "MSE Make-up",
      start: "2026-10-04",
      end: "2026-10-05",
      type: "exam",
      desc: "Make-up examinations for approved missed Mid Sem papers"
    },
    {
      id: "ese",
      name: "End Semester Examination (ESE)",
      short: "End-Sem Exam",
      start: "2026-11-21",
      end: "2026-11-30",
      type: "exam",
      desc: "End Semester Exams for B.Tech, M.Tech, M.Sc & PhD"
    },
    {
      id: "ese-makeup",
      name: "Make-up Exam (End Sem)",
      short: "ESE Make-up",
      start: "2026-12-05",
      end: "2026-12-06",
      type: "exam",
      desc: "Make-up examinations for approved missed End Sem papers"
    },
    {
      id: "phd-written",
      name: "PhD Admissions Written Test & Interview",
      short: "PhD Admissions",
      start: "2026-12-01",
      end: "2026-12-08",
      type: "exam",
      desc: "Written test and interviews by departments for Ph.D. admissions"
    },
    {
      id: "phd-comp",
      name: "Comprehensive Exam for PhD Students",
      short: "PhD Comprehensive",
      start: "2026-12-15",
      end: "2027-01-08",
      type: "exam",
      desc: "Comprehensive examination window for PhD research scholars"
    }
  ],
  breaks: [
    {
      id: "mid-break",
      name: "Mid-Sem Autumn Break",
      short: "Mid-Sem Break",
      start: "2026-09-29",
      end: "2026-10-03",
      type: "break",
      desc: "Official Mid-Semester recess (Tuesday – Saturday)"
    },
    {
      id: "ug-vacation",
      name: "Winter Vacation / Semester Break (UG)",
      short: "Winter Vacation",
      start: "2026-12-01",
      end: "2027-01-01",
      type: "break",
      desc: "Official Winter Vacation / Semester Break for all Undergraduate students"
    },
    {
      id: "fac-vacation",
      name: "Vacation Period (Faculty members)",
      short: "Faculty Vacation",
      start: "2026-12-13",
      end: "2026-12-31",
      type: "break",
      desc: "Official annual vacation period for faculty members"
    }
  ],
  events: [
    {
      d: "2026-08-06",
      name: "Foundation Day & Convocation",
      type: "event",
      tentative: true,
      desc: "IIT Patna Foundation Day and Annual Convocation"
    },
    {
      start: "2026-08-29",
      end: "2026-08-30",
      name: "Nebula 2026 (Fresher's Welcome)",
      type: "event",
      tentative: true,
      desc: "Annual Fresher's Welcome Festival"
    },
    {
      start: "2026-09-12",
      end: "2026-09-13",
      name: "TedX IIT Patna",
      type: "event",
      tentative: true,
      desc: "TedX IIT Patna Annual Conference"
    },
    {
      start: "2026-10-09",
      end: "2026-10-11",
      name: "Infinito 2026 (Annual Sports Fest)",
      short: "Infinito 2026 🏆",
      type: "sports",
      tentative: true,
      desc: "IIT Patna's Flagship Annual Inter-Collegiate Sports Fest (Infinito)"
    },
    {
      start: "2026-10-30",
      end: "2026-11-01",
      name: "Celesta 2026 (Techno-Management Fest)",
      short: "Celesta 2026 🚀",
      type: "event",
      tentative: true,
      desc: "IIT Patna Annual Techno-Management Festival"
    },
    {
      d: "2026-11-08",
      name: "Reverberance (Diwali Cultural Celebration)",
      type: "event",
      desc: "IIT Patna Diwali Cultural Celebration"
    },
    {
      d: "2026-11-21",
      name: "Last Day of Instructions / Classes",
      type: "acad",
      desc: "Last teaching day for Autumn Semester 2026"
    },
    {
      d: "2026-12-14",
      name: "Declaration of End Semester Exam Results",
      type: "acad",
      desc: "Official announcement of End Semester results on Grade portal"
    },
    {
      d: "2027-01-04",
      name: "Registration for Spring Semester 2026-27",
      type: "acad",
      desc: "Registration opens for Spring Semester 2026-27"
    }
  ]
};

let acadTab = "holidays";

function getAcadEvent(d) {
  if (!d) return {};
  const holiday = IITP_ACAD.holidays.find((h) => h.d === d);
  const exam = IITP_ACAD.exams.find((e) => d >= e.start && d <= e.end);
  const brk = IITP_ACAD.breaks.find((b) => d >= b.start && d <= b.end);
  const evt = IITP_ACAD.events.find(
    (ev) => (ev.d && ev.d === d) || (ev.start && d >= ev.start && d <= ev.end)
  );
  return { holiday, exam, break: brk, event: evt };
}

function acadBanner(d) {
  const acad = getAcadEvent(d);
  if (!acad.holiday && !acad.exam && !acad.break && !acad.event) return "";
  const parts = [];
  if (acad.holiday) {
    parts.push(`
      <div class="acad-banner holiday">
        <span class="ab-ic">🎉</span>
        <div class="ab-tx">
          <b>Institute Holiday · ${esc(acad.holiday.name)}</b>
          <small>Official IIT Patna Holiday (${acad.holiday.day}${acad.holiday.note ? " · " + esc(acad.holiday.note) : ""}) · No regular classes</small>
        </div>
      </div>
    `);
  }
  if (acad.exam) {
    parts.push(`
      <div class="acad-banner exam">
        <span class="ab-ic">📝</span>
        <div class="ab-tx">
          <b>Academic Examination · ${esc(acad.exam.name)}</b>
          <small>${esc(acad.exam.desc)} · Window: ${fmt(acad.exam.start)} to ${fmt(acad.exam.end)}</small>
        </div>
      </div>
    `);
  }
  if (acad.break) {
    parts.push(`
      <div class="acad-banner break">
        <span class="ab-ic">🏖️</span>
        <div class="ab-tx">
          <b>Academic Break · ${esc(acad.break.name)}</b>
          <small>${esc(acad.break.desc)} · Period: ${fmt(acad.break.start)} to ${fmt(acad.break.end)}</small>
        </div>
      </div>
    `);
  }
  if (acad.event) {
    parts.push(`
      <div class="acad-banner event">
        <span class="ab-ic">${acad.event.type === "sports" ? "🏆" : "🎪"}</span>
        <div class="ab-tx">
          <b>Campus Event · ${esc(acad.event.name)}</b>
          <small>${esc(acad.event.desc)}${acad.event.tentative ? " (Tentative)" : ""}</small>
        </div>
      </div>
    `);
  }
  return `<div class="acad-banners-wrap">${parts.join("")}</div>`;
}

function acadReferenceCard() {
  const td = typeof today === "function" ? today() : new Date().toISOString().slice(0, 10);
  
  const renderTabContent = () => {
    if (acadTab === "holidays") {
      return `
        <div class="acad-list-grid">
          ${IITP_ACAD.holidays
            .map((h) => {
              const dt = new Date(h.d + "T00:00");
              const isPast = h.d < td;
              const isToday = h.d === td;
              const pillClass = isToday ? "g" : isPast ? "" : "blue";
              const pillText = isToday ? "Today" : isPast ? "Passed" : "Upcoming";
              return `
                <div class="acad-item-card ${isToday ? 'is-today' : ''}" data-goto-date="${h.d}" title="Click to view on calendar">
                  <div class="acad-item-date">
                    <b>${dt.getDate()}</b>
                    <span>${dt.toLocaleDateString("en-IN", { month: "short" })}</span>
                  </div>
                  <div class="acad-item-info">
                    <div class="acad-item-title">${esc(h.name)}</div>
                    <div class="acad-item-sub">📅 ${h.day}${h.note ? " · " + esc(h.note) : ""}</div>
                  </div>
                  <span class="pill ${pillClass}">${pillText}</span>
                </div>
              `;
            })
            .join("")}
        </div>
      `;
    }

    if (acadTab === "exams") {
      return `
        <div class="acad-list-grid">
          ${[...IITP_ACAD.exams, ...IITP_ACAD.breaks]
            .sort((a, b) => a.start.localeCompare(b.start))
            .map((e) => {
              const dtS = new Date(e.start + "T00:00");
              const dtE = new Date(e.end + "T00:00");
              const isActive = td >= e.start && td <= e.end;
              const isPast = td > e.end;
              const pillClass = isActive ? "g" : isPast ? "" : "gold";
              const pillText = isActive ? "Active Now" : isPast ? "Completed" : "Scheduled";
              const ic = e.type === "break" ? "🏖️" : "📝";
              return `
                <div class="acad-item-card ${isActive ? 'is-today' : ''}" data-goto-date="${e.start}" title="Click to view start date on calendar">
                  <div class="acad-item-date">
                    <b>${dtS.getDate()}</b>
                    <span>${dtS.toLocaleDateString("en-IN", { month: "short" })}</span>
                  </div>
                  <div class="acad-item-info">
                    <div class="acad-item-title">${ic} ${esc(e.name)}</div>
                    <div class="acad-item-sub">⏱️ ${fmt(e.start)} to ${fmt(e.end)}</div>
                  </div>
                  <span class="pill ${pillClass}">${pillText}</span>
                </div>
              `;
            })
            .join("")}
        </div>
      `;
    }

    // events tab
    return `
      <div class="acad-list-grid">
        ${IITP_ACAD.events
          .map((ev) => {
            const startD = ev.d || ev.start;
            const dt = new Date(startD + "T00:00");
            const isPast = (ev.end || startD) < td;
            const isToday = td >= startD && td <= (ev.end || startD);
            const pillClass = isToday ? "g" : isPast ? "" : "teal";
            const pillText = isToday ? "Happening Now" : isPast ? "Completed" : "Upcoming";
            const ic = ev.type === "sports" ? "🏆" : ev.type === "acad" ? "🎓" : "🎪";
            return `
              <div class="acad-item-card ${isToday ? 'is-today' : ''}" data-goto-date="${startD}" title="Click to view on calendar">
                <div class="acad-item-date">
                  <b>${dt.getDate()}</b>
                  <span>${dt.toLocaleDateString("en-IN", { month: "short" })}</span>
                </div>
                <div class="acad-item-info">
                  <div class="acad-item-title">${ic} ${esc(ev.name)}</div>
                  <div class="acad-item-sub">${ev.end ? fmt(ev.start) + " – " + fmt(ev.end) : fmt(ev.d)}${ev.tentative ? " · Tentative" : ""}</div>
                </div>
                <span class="pill ${pillClass}">${pillText}</span>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  };

  return `
    <div class="card acad-ref-card" id="acad-ref-card">
      <div class="acad-ref-header">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:1.6rem">🏛️</span>
          <div>
            <h2 style="margin:0;font-size:1.12rem">IIT Patna Academic Calendar &amp; Holidays</h2>
            <p class="mute" style="margin:2px 0 0;font-size:0.82rem">Official 2026 Institute Holidays, Autumn 2026-27 Exams &amp; Breaks</p>
          </div>
        </div>
        <div class="acad-tab-pills" role="tablist">
          <button type="button" class="acad-tab-btn ${acadTab === 'holidays' ? 'active' : ''}" data-atab="holidays">🎉 Holidays (${IITP_ACAD.holidays.length})</button>
          <button type="button" class="acad-tab-btn ${acadTab === 'exams' ? 'active' : ''}" data-atab="exams">📝 Exams &amp; Breaks</button>
          <button type="button" class="acad-tab-btn ${acadTab === 'events' ? 'active' : ''}" data-atab="events">🏆 Campus Fests</button>
        </div>
      </div>
      <div class="acad-ref-body">
        ${renderTabContent()}
      </div>
      <p class="mute" style="font-size:0.75rem;margin:12px 0 0;text-align:right">💡 Tap any holiday or exam to jump the calendar straight to that date.</p>
    </div>
  `;
}

function bindAcadCard() {
  document.querySelectorAll("[data-atab]").forEach((b) => {
    b.onclick = () => {
      acadTab = b.dataset.atab;
      if (typeof vPlan === "function") vPlan();
    };
  });
  document.querySelectorAll("[data-goto-date]").forEach((b) => {
    b.onclick = () => {
      const targetDate = b.dataset.gotoDate;
      if (!targetDate) return;
      if (typeof planSel !== "undefined") planSel = targetDate;
      if (typeof planMon !== "undefined") planMon = targetDate.slice(0, 7);
      if (typeof vPlan === "function") {
        vPlan();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
  });
}

// ---------------------------------------------------------------- 7. Inter-IIT Sports Meet 2026 Student Fixtures
let fixtureTab = "hockey";

const INTER_IIT_2026 = {
  title: "57th Inter-IIT Sports Meet 2026",
  sub: "Official Student Preliminary League & Knockout Fixtures",
  dates: "December 13 – 21, 2026",
  host: "Tata Steel Sports Complex, Kalaikonda & SERSA Railways",
  contingent: "Indian Institute of Technology Patna",
  sports: {
    hockey: {
      name: "Hockey (Men)",
      icon: "🏑",
      color: "#2563eb",
      pool: "Pool A",
      poolTeams: [
        { code: "KGP", name: "IIT Kharagpur", seed: "Top Seed" },
        { code: "KAN", name: "IIT Kanpur", seed: "Challenger" },
        { code: "PAT", name: "IIT Patna", seed: "Our Squad", isUs: true },
        { code: "MAN", name: "IIT Mandi", seed: "Contender" },
      ],
      ourMatches: [
        {
          matchNo: 9,
          date: "2026-12-16",
          dayName: "Wednesday, 16 Dec 2026",
          time: "11:00 AM",
          ground: "Ground 1 · Tata Steel Complex",
          opponent: "IIT Kanpur",
          oppCode: "KAN",
          stage: "Preliminary League · Pool A",
          status: "Scheduled",
        },
        {
          matchNo: 14,
          date: "2026-12-17",
          dayName: "Thursday, 17 Dec 2026",
          time: "11:00 AM",
          ground: "Ground 1 · Tata Steel Complex",
          opponent: "IIT Mandi",
          oppCode: "MAN",
          stage: "Preliminary League · Pool A",
          status: "Scheduled",
        },
      ],
      knockouts: [
        { stage: "Quarter-Final (QF 1 / QF 4)", date: "19 Dec 2026", time: "07:00 AM / 01:00 PM", venue: "Ground 1 & 2", condition: "Top 2 qualify from Pool A" },
        { stage: "Semi-Final (SF 1 / SF 2)", date: "20 Dec 2026", time: "09:00 AM / 11:00 AM", venue: "Ground 1 · Tata Steel", condition: "Winners of QF 1 vs QF 3 & QF 2 vs QF 4" },
        { stage: "3rd Place Playoff", date: "21 Dec 2026", time: "07:00 AM", venue: "Ground 1", condition: "Semi-Final Runners-up" },
        { stage: "Championship Final 🏆", date: "21 Dec 2026", time: "09:00 AM", venue: "Ground 1 · Tata Steel Complex", condition: "Grand Inter-IIT Men's Hockey Final" },
      ],
      rulesNote: "Official FIH 4 quarters of 15 mins. Tied knockout ties proceed directly to FIH 8-second penalty shoot-out. Reporting time: 30 mins before push-off.",
    },
    football: {
      name: "Football (Men)",
      icon: "⚽",
      color: "#059669",
      pool: "Pool B",
      poolTeams: [
        { code: "IND", name: "IIT Indore", seed: "Top Seed" },
        { code: "PAT", name: "IIT Patna", seed: "Our Squad", isUs: true },
        { code: "HYD", name: "IIT Hyderabad", seed: "Contender" },
      ],
      ourMatches: [
        {
          matchNo: 2,
          date: "2026-12-15",
          dayName: "Monday, 15 Dec 2026",
          time: "08:00 AM",
          ground: "Ground 1 · Tata Steel Stadium",
          opponent: "IIT Indore",
          oppCode: "IND",
          stage: "Preliminary League · Pool B",
          status: "Scheduled",
        },
        {
          matchNo: 10,
          date: "2026-12-16",
          dayName: "Tuesday, 16 Dec 2026",
          time: "08:00 AM",
          ground: "Ground 2 · Sports Arena",
          opponent: "IIT Hyderabad",
          oppCode: "HYD",
          stage: "Preliminary League · Pool B",
          status: "Scheduled",
        },
      ],
      knockouts: [
        { stage: "Quarter-Finals", date: "19 Dec 2026", time: "08:00 AM / 02:30 PM", venue: "Ground 1 & 2", condition: "Top 2 from Pool B" },
        { stage: "Semi-Finals", date: "20 Dec 2026", time: "08:00 AM / 02:30 PM", venue: "Ground 1", condition: "Winners of QF" },
        { stage: "Championship Final 🏆", date: "21 Dec 2026", time: "03:00 PM", venue: "Ground 1 · Main Arena", condition: "Inter-IIT Football Gold" },
      ],
      rulesNote: "Matches played in two 45-min halves. Standard FIFA/AIFF tie-breaker rules.",
    },
    cricket: {
      name: "Cricket (Men)",
      icon: "🏏",
      color: "#d97706",
      pool: "Pool E",
      poolTeams: [
        { code: "DEL", name: "IIT Delhi", seed: "Top Seed" },
        { code: "PAT", name: "IIT Patna", seed: "Our Squad", isUs: true },
        { code: "GOA", name: "IIT Goa", seed: "Contender" },
      ],
      ourMatches: [
        {
          matchNo: 6,
          date: "2026-12-13",
          dayName: "Saturday, 13 Dec 2026",
          time: "01:00 PM",
          ground: "GR-3 · SERSA Railways Ground",
          opponent: "IIT Delhi",
          oppCode: "DEL",
          stage: "Preliminary League · Pool E",
          status: "Scheduled",
        },
        {
          matchNo: 11,
          date: "2026-12-15",
          dayName: "Monday, 15 Dec 2026",
          time: "08:00 AM",
          ground: "GR-2 · Tata Steel Ground",
          opponent: "IIT Goa",
          oppCode: "GOA",
          stage: "Preliminary League · Pool E",
          status: "Scheduled",
        },
      ],
      knockouts: [
        { stage: "Pre-Quarter & QF", date: "17 & 18 Dec 2026", time: "08:00 AM / 01:00 PM", venue: "GR-1 & GR-2", condition: "Pool Stage Qualifiers" },
        { stage: "Semi-Finals", date: "20 Dec 2026", time: "08:00 AM / 01:00 PM", venue: "GR-1 Tata Steel", condition: "Winners of Quarter-Finals" },
        { stage: "Championship Final 🏆", date: "21 Dec 2026", time: "09:00 AM", venue: "GR-1 · Main Stadium", condition: "Inter-IIT Cricket Championship" },
      ],
      rulesNote: "T20 format under standard BCCI/ICC playing conditions. White ball, coloured team kit.",
    },
    basketball_m: {
      name: "Basketball (Men)",
      icon: "🏀",
      color: "#ea580c",
      pool: "Pool G",
      poolTeams: [
        { code: "BHU", name: "IIT (BHU) Varanasi", seed: "Top Seed" },
        { code: "PAT", name: "IIT Patna", seed: "Our Squad", isUs: true },
        { code: "JAM", name: "IIT Jammu", seed: "Contender" },
      ],
      ourMatches: [
        {
          matchNo: 1,
          date: "2026-12-15",
          dayName: "Monday, 15 Dec 2026",
          time: "07:30 AM",
          ground: "Court 1 · Indoor Stadium",
          opponent: "IIT (BHU) Varanasi",
          oppCode: "BHU",
          stage: "Preliminary League · Pool G",
          status: "Scheduled",
        },
        {
          matchNo: 15,
          date: "2026-12-17",
          dayName: "Wednesday, 17 Dec 2026",
          time: "07:30 AM",
          ground: "Court 1 · Indoor Stadium",
          opponent: "IIT Jammu",
          oppCode: "JAM",
          stage: "Preliminary League · Pool G",
          status: "Scheduled",
        },
      ],
      knockouts: [
        { stage: "Quarter-Finals", date: "19 Dec 2026", time: "07:30 AM / 04:30 PM", venue: "Court 1 & 2", condition: "Pool G Qualifiers" },
        { stage: "Semi-Finals", date: "20 Dec 2026", time: "07:30 AM / 06:00 PM", venue: "Court 1", condition: "Winners of QF" },
        { stage: "Championship Final 🏆", date: "21 Dec 2026", time: "04:30 PM", venue: "Court 1 · Main Arena", condition: "Inter-IIT Men's Basketball Final" },
      ],
      rulesNote: "FIBA 4x10 min quarters, 24-second shot clock, official game clock.",
    },
    basketball_w: {
      name: "Basketball (Women)",
      icon: "🏀",
      color: "#db2777",
      pool: "Pool G",
      poolTeams: [
        { code: "DHA", name: "IIT Dharwad", seed: "Top Seed" },
        { code: "BHU", name: "IIT (BHU) Varanasi", seed: "Contender" },
        { code: "PAT", name: "IIT Patna", seed: "Our Squad", isUs: true },
      ],
      ourMatches: [
        {
          matchNo: 7,
          date: "2026-12-15",
          dayName: "Monday, 15 Dec 2026",
          time: "07:30 PM",
          ground: "Court 2 · Indoor Hall",
          opponent: "IIT Dharwad",
          oppCode: "DHA",
          stage: "Preliminary League · Pool G",
          status: "Scheduled",
        },
        {
          matchNo: 13,
          date: "2026-12-16",
          dayName: "Tuesday, 16 Dec 2026",
          time: "06:00 PM",
          ground: "Court 2 · Indoor Hall",
          opponent: "IIT (BHU) Varanasi",
          oppCode: "BHU",
          stage: "Preliminary League · Pool G",
          status: "Scheduled",
        },
      ],
      knockouts: [
        { stage: "Quarter-Finals", date: "18 Dec 2026", time: "06:00 PM", venue: "Court 1 & 2", condition: "Pool G Qualifiers" },
        { stage: "Semi-Finals", date: "20 Dec 2026", time: "07:30 AM / 06:00 PM", venue: "Court 2", condition: "Winners of QF" },
        { stage: "Championship Final 🏆", date: "21 Dec 2026", time: "03:00 PM", venue: "Court 1", condition: "Inter-IIT Women's Basketball Final" },
      ],
      rulesNote: "FIBA Women's standard ball (Size 6), 4x10 min quarters.",
    },
    athletics: {
      name: "Athletics & Weightlifting",
      icon: "🏃",
      color: "#7c3aed",
      pool: "Track, Field & Lifting Hall",
      eventsList: [
        { sport: "Weightlifting (Men)", date: "16 – 18 Dec 2026", time: "09:00 AM onwards", venue: "Tata Steel Indoor Sports Hall", details: "Snatch and Clean & Jerk across 56kg, 62kg, 69kg, 77kg, 85kg & +85kg categories." },
        { sport: "Sprints & Relays (M & W)", date: "14 – 17 Dec 2026", time: "Morning 07:00 AM & Evening 03:30 PM", venue: "Synthetic Track Stadium", details: "100m, 200m, 400m preliminary heats & finals; 4x100m & 4x400m team relays." },
        { sport: "Middle & Long Distance", date: "15 – 19 Dec 2026", time: "06:30 AM early morning sessions", venue: "Main Athletic Arena", details: "800m, 1500m tactical runs and 5000m endurance championship." },
        { sport: "Jumps & Field Throws", date: "16 – 20 Dec 2026", time: "08:00 AM & 02:30 PM", venue: "Field Pits & Throw Circles", details: "Long Jump, High Jump, Triple Jump, Shot Put, Discus & Javelin Throw." },
        { sport: "Valedictory & March Past 🏆", date: "21 Dec 2026", time: "05:30 PM", venue: "Main Athletic Stadium", details: "General Championship Trophy, Contingent March Past, and Closing Ceremony." },
      ],
      rulesNote: "World Athletics rules apply. Synthetic track spikes maximum 9mm. Athletes must report with official ID cards 45 mins prior to call room.",
    },
  },
};

function studentFixtureCard() {
  const spKey = fixtureTab || "hockey";
  const sp = INTER_IIT_2026.sports[spKey] || INTER_IIT_2026.sports.hockey;

  const renderTabs = () => {
    const tabs = [
      ["hockey", "🏑", "Hockey Men"],
      ["football", "⚽", "Football"],
      ["cricket", "🏏", "Cricket"],
      ["basketball_m", "🏀", "Basketball (M)"],
      ["basketball_w", "🏀", "Basketball (W)"],
      ["athletics", "🏃", "Athletics & Weights"],
    ];
    return tabs
      .map(
        ([k, ic, lbl]) =>
          `<button type="button" class="fixture-tab-pill ${spKey === k ? "active" : ""}" data-ftab="${k}" role="tab" aria-selected="${spKey === k}">${ic} ${lbl}</button>`,
      )
      .join("");
  };

  const renderPoolStrip = () => {
    if (!sp.poolTeams) return "";
    return `
      <div class="fixture-pool-banner">
        <div class="fixture-pool-title">
          <span class="pool-tag">${esc(sp.pool)}</span>
          <span class="pool-desc">Group Allocation &amp; Competitors</span>
        </div>
        <div class="fixture-teams-row">
          ${sp.poolTeams
            .map(
              (t) => `
              <div class="fixture-team-chip ${t.isUs ? "is-us" : ""}">
                <span class="team-chip-code">${esc(t.code)}</span>
                <span class="team-chip-name">${esc(t.name)}</span>
                <span class="team-chip-badge">${t.isUs ? "★ IIT Patna" : esc(t.seed)}</span>
              </div>
            `,
            )
            .join("")}
        </div>
      </div>
    `;
  };

  const renderMatches = () => {
    if (sp.ourMatches && sp.ourMatches.length) {
      return `
        <div class="fixture-matches-grid">
          ${sp.ourMatches
            .map(
              (m) => `
              <div class="fixture-match-card">
                <div class="fmc-header">
                  <div class="fmc-meta-left">
                    <span class="fmc-num-pill">Match #${m.matchNo}</span>
                    <span class="fmc-stage-pill">${esc(m.stage)}</span>
                  </div>
                  <div class="fmc-time-pill">
                    <span>📅 ${esc(m.dayName)}</span>
                    <b>⏰ ${esc(m.time)}</b>
                  </div>
                </div>

                <div class="fmc-vs-strip">
                  <div class="fmc-team fmc-opp">
                    <div class="fmc-avatar">${esc(m.oppCode)}</div>
                    <div class="fmc-team-info">
                      <b class="fmc-team-name">${esc(m.opponent)}</b>
                      <span class="fmc-team-sub">Opponent</span>
                    </div>
                  </div>

                  <div class="fmc-center">
                    <div class="fmc-vs-circle">VS</div>
                    <span class="fmc-venue-tag">📍 ${esc(m.ground)}</span>
                  </div>

                  <div class="fmc-team fmc-pat is-us">
                    <div class="fmc-avatar pat">PAT</div>
                    <div class="fmc-team-info">
                      <b class="fmc-team-name">IIT Patna</b>
                      <span class="fmc-team-sub">Our Squad 🏑</span>
                    </div>
                  </div>
                </div>

                <div class="fmc-footer">
                  <div class="fmc-status-note">
                    <span class="status-dot green"></span>
                    <span>Official Inter-IIT Draw · Tata Steel Sports Complex</span>
                  </div>
                  <button type="button" class="btn-match-sheet" data-open-fixture-modal="${spKey}" title="View detailed match sheet and instructions">
                    ${ico("scan")} Match Sheet
                  </button>
                </div>
              </div>
            `,
            )
            .join("")}
        </div>
      `;
    }

    // athletics & weights list
    if (sp.eventsList && sp.eventsList.length) {
      return `
        <div class="fixture-athletics-grid">
          ${sp.eventsList
            .map(
              (ev) => `
              <div class="fixture-ath-item">
                <div class="fai-date-box">
                  <span class="fai-icon">🏆</span>
                  <b>${esc(ev.date.split("–")[0].trim())}</b>
                  <small>Dec 2026</small>
                </div>
                <div class="fai-content">
                  <div class="fai-top-row">
                    <h3 class="fai-title">${esc(ev.sport)}</h3>
                    <span class="fai-time">⏰ ${esc(ev.time)}</span>
                  </div>
                  <p class="fai-venue">📍 ${esc(ev.venue)}</p>
                  <p class="fai-details">${esc(ev.details)}</p>
                </div>
              </div>
            `,
            )
            .join("")}
        </div>
      `;
    }

    return `<p class="mute" style="padding:16px;">Schedule being updated.</p>`;
  };

  const renderKnockouts = () => {
    if (!sp.knockouts || !sp.knockouts.length) return "";
    return `
      <div class="fixture-knockouts-section">
        <div class="fks-header">
          <span class="fks-kicker">KNOCKOUT PROGRESSION</span>
          <h3 class="fks-title">🏆 Road to the Championship Podium</h3>
        </div>
        <div class="fks-roadmap">
          ${sp.knockouts
            .map(
              (k, idx) => `
              <div class="fks-node ${idx === sp.knockouts.length - 1 ? "is-final" : ""}">
                <div class="fks-badge">${idx === sp.knockouts.length - 1 ? "🥇 Final" : `Stage ${idx + 1}`}</div>
                <div class="fks-info">
                  <b class="fks-stage">${esc(k.stage)}</b>
                  <span class="fks-timing">📅 ${esc(k.date)} · ${esc(k.time)}</span>
                  <span class="fks-venue">📍 ${esc(k.venue)}</span>
                  <small class="fks-cond">${esc(k.condition)}</small>
                </div>
              </div>
            `,
            )
            .join("")}
        </div>
      </div>
    `;
  };

  return `
    <div class="student-fixtures-container">
      <div class="card fixture-card" id="student-fixtures-card">
        <div class="fixture-card-header">
          <div class="fixture-title-group">
            <div class="fixture-kicker-strip">
              <span class="fixture-kicker-pill">🏆 OFFICIAL SCHEDULE · 57th INTER-IIT</span>
              <span class="fixture-dates-pill">Dec 13–21, 2026</span>
              <span class="fixture-host-pill">📍 Tata Steel Sports Complex</span>
            </div>
            <h2 class="fixture-heading">Inter-IIT Student Fixtures (IIT Patna)</h2>
            <p class="mute fixture-subhead">
              Official preliminary league draw, pitch allocations, match timings, and knockout roadmap for IIT Patna contingents.
            </p>
          </div>
          <div class="fixture-action-group">
            <button type="button" class="btn-fixture-scan" id="btn-fixtures-modal" title="Open Complete Multi-Sport Fixture Guide &amp; Rules">
              ${ico("scan")} <span>Full Guide</span>
            </button>
            <button type="button" class="btn-fixture-settings" id="btn-fixtures-settings" title="Notification Preferences &amp; Match Alerts">
              ${ico("settings")} <span>Settings</span>
            </button>
          </div>
        </div>

        <div class="fixture-tabs-strip" role="tablist" aria-label="Inter-IIT Sports">
          ${renderTabs()}
        </div>

        <div class="fixture-body">
          ${renderPoolStrip()}
          ${renderMatches()}
          ${renderKnockouts()}

          <div class="fixture-notice-strip">
            <span class="notice-ic">📋</span>
            <div class="notice-tx">
              <b>Official Participant Guidelines:</b> ${esc(sp.rulesNote || "All contingent members must carry their official institute ID card.")}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindStudentFixtureCard() {
  document.querySelectorAll("[data-ftab]").forEach((b) => {
    b.onclick = () => {
      fixtureTab = b.dataset.ftab;
      document.querySelectorAll(".student-fixtures-container").forEach((el) => {
        el.outerHTML = studentFixtureCard();
      });
      bindStudentFixtureCard();
    };
  });

  document.querySelectorAll(".btn-fixture-scan, [data-open-fixture-modal]").forEach((b) => {
    b.onclick = () => {
      const sp = b.dataset.openFixtureModal || fixtureTab || "hockey";
      openFixtureModal(sp);
    };
  });

  document.querySelectorAll(".btn-fixture-settings, [data-open-settings-modal]").forEach((b) => {
    b.onclick = () => {
      openSettingsModal();
    };
  });
}

function openFixtureModal(sportKey) {
  const d = (typeof ensureDlg === "function" ? ensureDlg("fixturedlg") : null) || document.getElementById("fixturedlg") || (() => {
    const el = document.createElement("dialog");
    el.id = "fixturedlg";
    document.body.appendChild(el);
    return el;
  })();

  const sp = INTER_IIT_2026.sports[sportKey] || INTER_IIT_2026.sports.hockey;

  d.innerHTML = `
    <div class="dlg-content-wrap">
      <div class="dlg-header-strip" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;border-bottom:1px solid var(--line);padding-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:var(--brand-soft);color:var(--brand)">${ico("scan")}</span>
          <div>
            <h2 style="margin:0;font-size:1.15rem">Inter-IIT 2026 Student Fixture Guide</h2>
            <p class="mute" style="margin:2px 0 0;font-size:0.8rem">57th Inter-IIT Sports Meet · Tata Steel Sports Complex</p>
          </div>
        </div>
        <button type="button" class="ib" id="btn-dlg-fx-close" title="Close">${ico("close")}</button>
      </div>

      <div class="modal-sport-selector" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:10px;margin-bottom:14px">
        <button type="button" class="pill ${sportKey === 'hockey' ? 'pri' : ''}" data-modtab="hockey">🏑 Hockey Men</button>
        <button type="button" class="pill ${sportKey === 'football' ? 'pri' : ''}" data-modtab="football">⚽ Football</button>
        <button type="button" class="pill ${sportKey === 'cricket' ? 'pri' : ''}" data-modtab="cricket">🏏 Cricket</button>
        <button type="button" class="pill ${sportKey === 'basketball_m' ? 'pri' : ''}" data-modtab="basketball_m">🏀 Basketball (M)</button>
        <button type="button" class="pill ${sportKey === 'basketball_w' ? 'pri' : ''}" data-modtab="basketball_w">🏀 Basketball (W)</button>
        <button type="button" class="pill ${sportKey === 'athletics' ? 'pri' : ''}" data-modtab="athletics">🏃 Athletics &amp; Weights</button>
      </div>

      <div style="max-height:60vh;overflow-y:auto;padding-right:4px;">
        <div class="card" style="margin:0 0 14px;background:var(--soft);border:1px solid var(--line)">
          <h3 style="margin:0 0 6px;font-size:1rem;color:var(--brand)">📍 Venue &amp; Facility Information</h3>
          <p style="margin:0;font-size:0.86rem;line-height:1.5;color:var(--ink)">
            <b>Tata Steel Sports Complex:</b> Main Hockey Astroturf (Ground 1), Football Stadium, Synthetic Athletics Track &amp; Indoor Arena.<br>
            <b>SERSA Railways Ground:</b> Cricket Ground 3 (Railway Colony).<br>
            <b>Kalaikonda / Air Force Base:</b> Reserve backup pitches.
          </p>
        </div>

        <div class="card" style="margin:0 0 14px;background:var(--soft);border:1px solid var(--line)">
          <h3 style="margin:0 0 6px;font-size:1rem;color:var(--ink)">🎽 Kit &amp; Identification Rules</h3>
          <ul style="margin:0;padding-left:18px;font-size:0.86rem;line-height:1.6;color:var(--ink)">
            <li>Every player must carry their valid Institute Identity Card for verification by match commissaires before entering the pitch.</li>
            <li>In case of color clashes, the team mentioned second in the fixture shall wear an alternate jersey.</li>
            <li>Shin guards and mouth guards are mandatory for all hockey players.</li>
            <li>Medical stations with physiotherapists and ambulance services are stationed at Ground 1 and Indoor Arena.</li>
          </ul>
        </div>

        <div class="card" style="margin:0;background:var(--card);border:1px solid var(--line)">
          <h3 style="margin:0 0 10px;font-size:1rem;color:var(--ink)">🏆 ${esc(sp.name)} Matches for IIT Patna</h3>
          ${(sp.ourMatches || []).map((m) => `
            <div style="padding:10px 12px;background:var(--soft);border-radius:10px;margin-bottom:8px;border:1px solid var(--line)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <span class="pill pri" style="font-size:0.75rem">Match #${m.matchNo}</span>
                <span style="font-size:0.82rem;font-weight:700;color:var(--ink)">${esc(m.time)} · ${esc(m.dayName)}</span>
              </div>
              <div style="font-size:0.95rem;font-weight:800;color:var(--ink)">
                IIT Patna vs ${esc(m.opponent)}
              </div>
              <div class="mute" style="font-size:0.8rem;margin-top:2px">
                📍 ${esc(m.ground)} · ${esc(m.stage)}
              </div>
            </div>
          `).join("") || '<p class="mute" style="margin:0">See detailed athletics timetable in card.</p>'}
        </div>
      </div>

      <div class="ctl" style="margin-top:16px;display:flex;justify-content:flex-end">
        <button type="button" class="pri" id="btn-dlg-fx-ok">Done</button>
      </div>
    </div>
  `;

  if (typeof d.showModal === "function") d.showModal();

  const closeFx = () => d.close();
  const bClose = d.querySelector("#btn-dlg-fx-close");
  const bOk = d.querySelector("#btn-dlg-fx-ok");
  if (bClose) bClose.onclick = closeFx;
  if (bOk) bOk.onclick = closeFx;

  d.querySelectorAll("[data-modtab]").forEach((btn) => {
    btn.onclick = () => {
      d.close();
      openFixtureModal(btn.dataset.modtab);
    };
  });
}

function openSettingsModal() {
  const d = (typeof ensureDlg === "function" ? ensureDlg("settingsdlg") : null) || document.getElementById("settingsdlg") || (() => {
    const el = document.createElement("dialog");
    el.id = "settingsdlg";
    document.body.appendChild(el);
    return el;
  })();

  const isDk = typeof isDark === "function" ? isDark() : false;

  d.innerHTML = `
    <div class="dlg-content-wrap">
      <div class="dlg-header-strip" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;border-bottom:1px solid var(--line);padding-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:var(--brand-soft);color:var(--brand)">${ico("settings")}</span>
          <div>
            <h2 style="margin:0;font-size:1.15rem">Preferences &amp; System Settings</h2>
            <p class="mute" style="margin:2px 0 0;font-size:0.8rem">Manage notifications, display theme, and offline storage</p>
          </div>
        </div>
        <button type="button" class="ib" id="btn-dlg-set-close" title="Close">${ico("close")}</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="setting-row" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--soft);border-radius:12px;border:1px solid var(--line)">
          <div>
            <b style="display:block;font-size:0.95rem;color:var(--ink)">Appearance Theme</b>
            <span class="mute" style="font-size:0.8rem">Switch between Day (Light) and Night (Dark) mode</span>
          </div>
          <button type="button" class="pill" id="btn-set-theme-toggle" style="display:inline-flex;align-items:center;gap:6px">
            ${ico(isDk ? "sun" : "moon")} <span>${isDk ? "Night Mode" : "Day Mode"}</span>
          </button>
        </div>

        <div class="setting-row" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--soft);border-radius:12px;border:1px solid var(--line)">
          <div>
            <b style="display:block;font-size:0.95rem;color:var(--ink)">Attendance Confirmations</b>
            <span class="mute" style="font-size:0.8rem">Instant notification sent to player when attendance is marked Present or Absent</span>
          </div>
          <span class="pill g" style="font-weight:700">Active ✅</span>
        </div>

        <div class="setting-row" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--soft);border-radius:12px;border:1px solid var(--line)">
          <div>
            <b style="display:block;font-size:0.95rem;color:var(--ink)">Inter-IIT Match Alerts</b>
            <span class="mute" style="font-size:0.8rem">Upcoming fixture countdown and match morning reminders</span>
          </div>
          <span class="pill teal" style="font-weight:700">Enabled 🔔</span>
        </div>

        <div class="setting-row" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--soft);border-radius:12px;border:1px solid var(--line)">
          <div>
            <b style="display:block;font-size:0.95rem;color:var(--ink)">High-DPI &amp; WebP Images</b>
            <span class="mute" style="font-size:0.8rem">Crisp retina photo loading with zero distortion</span>
          </div>
          <span class="pill" style="font-weight:700;color:var(--brand)">Active 🔍</span>
        </div>
      </div>

      <div class="ctl" style="margin-top:18px;display:flex;justify-content:flex-end">
        <button type="button" class="pri" id="btn-dlg-set-ok">Done</button>
      </div>
    </div>
  `;

  if (typeof d.showModal === "function") d.showModal();

  const closeSet = () => d.close();
  const bClose = d.querySelector("#btn-dlg-set-close");
  const bOk = d.querySelector("#btn-dlg-set-ok");
  if (bClose) bClose.onclick = closeSet;
  if (bOk) bOk.onclick = closeSet;

  const bThm = d.querySelector("#btn-set-theme-toggle");
  if (bThm) {
    bThm.onclick = () => {
      if (typeof toggleTheme === "function") toggleTheme();
      d.close();
      openSettingsModal();
    };
  }
}

// ---------------------------------------------------------------- 8. Hockey Skill Practice Video Player
let currentSkillVideoId = "-iVUhQIC1m0";
let skillVideoCategory = "all";

const HOCKEY_SKILL_VIDEOS = [
  {
    id: "-iVUhQIC1m0",
    title: "Perfect Hockey Hit Kaise Karein? 8 Important Basics for Beginners",
    author: "Shekhar Hockey",
    channelUrl: "https://www.youtube.com/@shekhar_hockey",
    category: "hitting",
    categoryLabel: "Hitting & Basics",
    duration: "Shorts",
    thumb: "https://i.ytimg.com/vi/-iVUhQIC1m0/hqdefault.jpg",
    desc: "Detailed coaching on proper stick stance, grip alignment, head positioning, backswing, body weight transfer, and clean follow-through.",
    coachingPoints: [
      "Keep hands together near the top of the stick handle for maximum swing leverage.",
      "Position the ball level with your front left foot, knees bent in an athletic athletic posture.",
      "Keep eyes focused firmly on the ball through the moment of contact.",
      "Transfer body weight smoothly from back foot to front foot during strike.",
    ],
    isFeatured: true,
  },
  {
    id: "bN0bQhKswRg",
    title: "Dodging Skills for Beginners | Ball Control & Beat Defenders",
    author: "Shekhar Hockey",
    channelUrl: "https://www.youtube.com/@shekhar_hockey",
    category: "dodging",
    categoryLabel: "Dodging & Control",
    duration: "Shorts",
    thumb: "https://i.ytimg.com/vi/bN0bQhKswRg/hqdefault.jpg",
    desc: "Essential open-field and tight-space dodging techniques to beat aggressive defenders with rapid stick agility.",
    coachingPoints: [
      "Use your body and non-stick shoulder to shield the ball from tacklers.",
      "Accelerate immediately after executing the change of direction.",
      "Keep the ball within your comfortable stick reach zone.",
    ],
  },
  {
    id: "VOgiKTqr_E0",
    title: "Wall Passing Drill for Beginners | Center, Left & Right Side Practice",
    author: "Shekhar Hockey",
    channelUrl: "https://www.youtube.com/@shekhar_hockey",
    category: "passing",
    categoryLabel: "Passing & Reception",
    duration: "Shorts",
    thumb: "https://i.ytimg.com/vi/VOgiKTqr_E0/hqdefault.jpg",
    desc: "Solo wall drill routine for high-tempo push passing, soft ball trapping, and multi-angle stick reception.",
    coachingPoints: [
      "Cushion the ball on contact with relaxed wrists ('soft hands').",
      "Alternate push-passing from left foot forward and square stance.",
      "Count consecutive clean returns to build reaction speed.",
    ],
  },
  {
    id: "37BHSKMTqnw",
    title: "One-Handed Ball Lifting Skill | Important Hockey Basic for Beginners",
    author: "Shekhar Hockey",
    channelUrl: "https://www.youtube.com/@shekhar_hockey",
    category: "3d",
    categoryLabel: "Aerial & 3D Skills",
    duration: "Shorts",
    thumb: "https://i.ytimg.com/vi/37BHSKMTqnw/hqdefault.jpg",
    desc: "Step-by-step guidance on lifting the ball safely over flat sticks using controlled single-hand lever action.",
    coachingPoints: [
      "Angle the toe of your stick head slightly underneath the ball's center line.",
      "Flick upward using wrist extension while keeping ball height below knee level in traffic.",
    ],
  },
  {
    id: "gx_-ABTzc-k",
    title: "Beat Any Defender with This Drag Lift Dodge! | Beginner Hockey Tips",
    author: "Shekhar Hockey",
    channelUrl: "https://www.youtube.com/@shekhar_hockey",
    category: "dodging",
    categoryLabel: "Dodging & 3D Skills",
    duration: "Shorts",
    thumb: "https://i.ytimg.com/vi/gx_-ABTzc-k/hqdefault.jpg",
    desc: "Execute the drag-and-lift combination to eliminate tacklers in 1v1 situations inside the attacking 23m.",
    coachingPoints: [
      "Drag the ball laterally across the defender's reach, then lift on the return stroke.",
      "Keep your head up to scan for supporting teammates in the circle.",
    ],
  },
  {
    id: "YwE__exrT7A",
    title: "Backhand Slider Pass Skill! | Quick Passing for Faster Attacks",
    author: "Shekhar Hockey",
    channelUrl: "https://www.youtube.com/@shekhar_hockey",
    category: "passing",
    categoryLabel: "Passing & Reverse Stick",
    duration: "Shorts",
    thumb: "https://i.ytimg.com/vi/YwE__exrT7A/hqdefault.jpg",
    desc: "Fast and low reverse-stick slider pass across the midfield into attacking forward runners.",
    coachingPoints: [
      "Rotate stick grip so the flat face faces the target on the reverse side.",
      "Stay low with bent knees to maintain ball contact throughout the slide.",
    ],
  },
  {
    id: "tiL1FR8qlS0",
    title: "Forward Players! Stop Making This Mistake! | Smart Movement",
    author: "Shekhar Hockey",
    channelUrl: "https://www.youtube.com/@shekhar_hockey",
    category: "tactics",
    categoryLabel: "Tactical Movement",
    duration: "Shorts",
    thumb: "https://i.ytimg.com/vi/tiL1FR8qlS0/hqdefault.jpg",
    desc: "Critical positional advice for strikers and wingers: cutting runs, creating passing lanes, and posting up.",
    coachingPoints: [
      "Never stand still behind defenders; make double-leads to create clear passing channels.",
      "Angle runs towards the near post for deflections and rebound opportunities.",
    ],
  },
  {
    id: "dIfD6YBaHww",
    title: "Beat the Defender with This Smart Pass! | Hockey Passing Tips",
    author: "Shekhar Hockey",
    channelUrl: "https://www.youtube.com/@shekhar_hockey",
    category: "passing",
    categoryLabel: "Passing & Vision",
    duration: "Shorts",
    thumb: "https://i.ytimg.com/vi/dIfD6YBaHww/hqdefault.jpg",
    desc: "Vision and through-pass timing to split defensive lines and put teammates directly into scoring positions.",
    coachingPoints: [
      "Disguise your pass by keeping your body shape neutral until release.",
      "Pass into the space in front of the runner rather than directly to their feet.",
    ],
  },
  {
    id: "A_dpqhY8nug",
    title: "2 Smart Moves Every Hockey Forward Must Know! | Attacking Skills",
    author: "Shekhar Hockey",
    channelUrl: "https://www.youtube.com/@shekhar_hockey",
    category: "tactics",
    categoryLabel: "Attacking Skills",
    duration: "Shorts",
    thumb: "https://i.ytimg.com/vi/A_dpqhY8nug/hqdefault.jpg",
    desc: "Two quick tactical moves to deceive defenders at the circle edge and create clear shooting windows.",
    coachingPoints: [
      "Use sudden decelerations to force the defender to commit their stick prematurely.",
      "Quick release snapshot towards the far bottom corner.",
    ],
  },
];

function parseYouTubeId(input) {
  if (!input) return null;
  input = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  const match = input.match(/(?:shorts\/|v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : null;
}

function skillsVideoCard(opts = {}) {
  const curVid = HOCKEY_SKILL_VIDEOS.find((v) => v.id === currentSkillVideoId) || HOCKEY_SKILL_VIDEOS[0];
  const list = skillVideoCategory === "all"
    ? HOCKEY_SKILL_VIDEOS
    : HOCKEY_SKILL_VIDEOS.filter((v) => v.category === skillVideoCategory);

  const categories = [
    ["all", "All Drills"],
    ["hitting", "Hitting & Basics"],
    ["dodging", "Dodging & Control"],
    ["passing", "Passing & Reception"],
    ["3d", "Aerial & 3D Skills"],
    ["tactics", "Attacking Tactics"],
  ];

  const renderCategoryChips = () => {
    return categories
      .map(
        ([k, lbl]) =>
          `<button type="button" class="hsk-cat-pill ${skillVideoCategory === k ? "active" : ""}" data-vcat="${k}">${lbl}</button>`,
      )
      .join("");
  };

  const renderDrillCards = () => {
    return list
      .map((v) => {
        const isCurrent = v.id === currentSkillVideoId;
        return `
          <div class="hsk-thumb-card ${isCurrent ? "active" : ""}" data-play-video="${esc(v.id)}" role="button" tabindex="0" title="Play: ${esc(v.title)}">
            <div class="hsk-thumb-wrap">
              <img src="${esc(v.thumb)}" alt="${esc(v.title)}" loading="lazy" decoding="async">
              <div class="hsk-play-overlay">
                <span class="hsk-play-badge">${isCurrent ? "▶" : "▶"}</span>
              </div>
              <span class="hsk-duration-tag">${esc(v.duration || "Shorts")}</span>
              ${isCurrent ? '<span class="hsk-now-playing-pill">Now Playing</span>' : ""}
            </div>
            <div class="hsk-thumb-info">
              <span class="hsk-cat-tag">${esc(v.categoryLabel)}</span>
              <b class="hsk-thumb-title">${esc(v.title)}</b>
              <span class="hsk-channel-name">📺 ${esc(v.author)}</span>
            </div>
          </div>
        `;
      })
      .join("");
  };

  const curIdx = HOCKEY_SKILL_VIDEOS.findIndex((v) => v.id === currentSkillVideoId);
  const prevVid = curIdx > 0 ? HOCKEY_SKILL_VIDEOS[curIdx - 1] : null;
  const nextVid = curIdx < HOCKEY_SKILL_VIDEOS.length - 1 ? HOCKEY_SKILL_VIDEOS[curIdx + 1] : HOCKEY_SKILL_VIDEOS[0];

  return `
    <div class="skills-video-container" id="hockey-skills-video-container">
      <div class="card hsk-card" id="hsk-card">
        <div class="hsk-header">
          <div class="hsk-title-group">
            <div class="hsk-kicker-strip">
              <span class="hsk-kicker-pill">🏑 HOCKEY SKILLS &amp; DRILLS</span>
              <a href="https://www.youtube.com/@shekhar_hockey" target="_blank" rel="noopener noreferrer" class="hsk-channel-badge" title="Visit Shekhar Hockey YouTube Channel (opens in new tab)">
                <span class="yt-play-icon">▶</span>
                <span>shekhar hockey 🏑 (@shekhar_hockey)</span>
                <span class="verified-check">✓</span>
              </a>
            </div>
            <h2 class="hsk-heading">Field Hockey Skill Practice &amp; Video Tutorials</h2>
            <p class="mute hsk-subhead">
              Watch and master hitting, dodging, wall passing drills, ball lifting, and attacking tactics directly on the portal.
            </p>
          </div>
          <div class="hsk-header-actions">
            <a href="https://www.youtube.com/@shekhar_hockey" target="_blank" rel="noopener noreferrer" class="btn-channel-link">
              <span>Channel Videos ↗</span>
            </a>
          </div>
        </div>

        <!-- Main Video Showcase Player -->
        <div class="hsk-main-showcase">
          <div class="hsk-player-wrap">
            <iframe
              id="hsk-main-iframe"
              src="https://www.youtube-nocookie.com/embed/${currentSkillVideoId}?autoplay=1&rel=0&playsinline=1&modestbranding=1"
              title="${esc(curVid.title)}"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
              class="hsk-iframe"
            ></iframe>
          </div>

          <div class="hsk-info-box">
            <div class="hsk-info-top">
              <span class="pill pri" id="hsk-active-cat">${esc(curVid.categoryLabel)}</span>
              <span class="pill" style="background:var(--soft);color:var(--mute)">Shekhar Hockey #shorts</span>
            </div>
            <h3 class="hsk-active-title" id="hsk-active-title">${esc(curVid.title)}</h3>
            <p class="hsk-active-desc" id="hsk-active-desc">${esc(curVid.desc)}</p>

            ${curVid.coachingPoints && curVid.coachingPoints.length ? `
              <div class="hsk-coaching-points">
                <b style="display:block;margin-bottom:6px;color:var(--brand)">🎯 Key Coaching Points:</b>
                <ul style="margin:0;padding-left:18px;color:var(--ink)" id="hsk-coaching-list">
                  ${curVid.coachingPoints.map((pt) => `<li>${esc(pt)}</li>`).join("")}
                </ul>
              </div>
            ` : '<div class="hsk-coaching-points" id="hsk-coaching-list" style="display:none"></div>'}

            <div class="hsk-controls-row">
              ${prevVid ? `<button type="button" class="btn-drill-nav" data-play-video="${esc(prevVid.id)}">⏮ Previous Drill</button>` : ""}
              <button type="button" class="btn-drill-nav pri" data-play-video="${esc(nextVid.id)}">Next Skill Drill ⏭</button>
              <a href="https://youtube.com/shorts/${currentSkillVideoId}" target="_blank" rel="noopener noreferrer" class="btn-drill-nav" id="hsk-yt-link">Watch on YouTube ↗</a>
            </div>

            <!-- Custom YouTube URL Input -->
            <div class="hsk-custom-input-bar">
              <input type="text" id="input-custom-yt" placeholder="Paste any YouTube Video / Short URL (e.g. https://youtube.com/shorts/...)" class="hsk-yt-input">
              <button type="button" class="pri" id="btn-play-custom-yt">Direct Play ▶</button>
            </div>
            <span class="mute" id="hsk-custom-err" style="font-size:0.75rem;margin-top:2px;">Tip: Paste any hockey tutorial URL from YouTube to play it directly inside this player.</span>
          </div>
        </div>

        <!-- Categories & Video List -->
        <div class="hsk-filter-strip" role="tablist">
          ${renderCategoryChips()}
        </div>

        <div class="hsk-gallery-grid">
          ${renderDrillCards()}
        </div>
      </div>
    </div>
  `;
}

function bindSkillsVideoCard() {
  document.querySelectorAll("[data-vcat]").forEach((btn) => {
    btn.onclick = () => {
      skillVideoCategory = btn.dataset.vcat;
      document.querySelectorAll(".skills-video-container").forEach((el) => {
        el.outerHTML = skillsVideoCard();
      });
      bindSkillsVideoCard();
    };
  });

  document.querySelectorAll("[data-play-video]").forEach((card) => {
    card.onclick = () => {
      const vidId = card.dataset.playVideo;
      if (!vidId) return;
      currentSkillVideoId = vidId;

      const vid = HOCKEY_SKILL_VIDEOS.find((v) => v.id === vidId) || {
        id: vidId,
        title: "Hockey Skill Practice",
        categoryLabel: "Custom Practice",
        desc: "Watch and practice this field hockey tutorial drill.",
        coachingPoints: ["Focus on stick technique, body balance, and regular repetition."],
      };

      const iframe = document.getElementById("hsk-main-iframe");
      if (iframe) {
        iframe.src = `https://www.youtube-nocookie.com/embed/${vidId}?autoplay=1&rel=0&playsinline=1&modestbranding=1`;
      }
      const titleEl = document.getElementById("hsk-active-title");
      if (titleEl) titleEl.textContent = vid.title;
      const catEl = document.getElementById("hsk-active-cat");
      if (catEl) catEl.textContent = vid.categoryLabel || "Skill Drill";
      const descEl = document.getElementById("hsk-active-desc");
      if (descEl) descEl.textContent = vid.desc || "";
      const ytLink = document.getElementById("hsk-yt-link");
      if (ytLink) ytLink.href = `https://youtube.com/shorts/${vidId}`;

      const listEl = document.getElementById("hsk-coaching-list");
      if (listEl) {
        if (vid.coachingPoints && vid.coachingPoints.length) {
          listEl.parentElement.style.display = "block";
          listEl.innerHTML = vid.coachingPoints.map((pt) => `<li>${esc(pt)}</li>`).join("");
        } else {
          listEl.parentElement.style.display = "none";
        }
      }

      // Update active card styling
      document.querySelectorAll(".hsk-thumb-card").forEach((c) => {
        const isThis = c.dataset.playVideo === vidId;
        c.classList.toggle("active", isThis);
        const npPill = c.querySelector(".hsk-now-playing-pill");
        if (isThis && !npPill) {
          const wrap = c.querySelector(".hsk-thumb-wrap");
          if (wrap) wrap.insertAdjacentHTML("beforeend", '<span class="hsk-now-playing-pill">Now Playing</span>');
        } else if (!isThis && npPill) {
          npPill.remove();
        }
      });

      const playerContainer = document.getElementById("hsk-card");
      if (playerContainer && window.innerWidth < 768) {
        playerContainer.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
  });

  const btnCustom = document.getElementById("btn-play-custom-yt");
  const inputCustom = document.getElementById("input-custom-yt");
  const errCustom = document.getElementById("hsk-custom-err");

  const handleCustomPlay = () => {
    if (!inputCustom) return;
    const val = inputCustom.value.trim();
    if (!val) return;
    const parsedId = parseYouTubeId(val);
    if (!parsedId) {
      if (errCustom) {
        errCustom.textContent = "⚠️ Please enter a valid YouTube video or short URL (e.g. https://youtube.com/shorts/-iVUhQIC1m0)";
        errCustom.style.color = "#dc2626";
      }
      return;
    }

    if (errCustom) {
      errCustom.textContent = "Loading video directly in player…";
      errCustom.style.color = "var(--brand)";
    }

    currentSkillVideoId = parsedId;
    const iframe = document.getElementById("hsk-main-iframe");
    if (iframe) {
      iframe.src = `https://www.youtube-nocookie.com/embed/${parsedId}?autoplay=1&rel=0&playsinline=1&modestbranding=1`;
    }
    const titleEl = document.getElementById("hsk-active-title");
    if (titleEl) titleEl.textContent = `Custom Practice Video (${parsedId})`;
    const descEl = document.getElementById("hsk-active-desc");
    if (descEl) descEl.textContent = "Playing directly from YouTube. Practice and follow the stick drills.";
    const ytLink = document.getElementById("hsk-yt-link");
    if (ytLink) ytLink.href = `https://www.youtube.com/watch?v=${parsedId}`;

    inputCustom.value = "";
    const playerContainer = document.getElementById("hsk-card");
    if (playerContainer) {
      playerContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (btnCustom) btnCustom.onclick = handleCustomPlay;
  if (inputCustom) {
    inputCustom.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCustomPlay();
      }
    };
  }
}



