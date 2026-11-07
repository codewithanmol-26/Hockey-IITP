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

