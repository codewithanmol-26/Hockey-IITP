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

// ---------------------------------------------------------------- 7. Inter-IIT Sports Meet 2026 Student Fixtures (HOCKEY MEN ONLY)
let fixtureHockeyView = "patna"; // "patna", "all", "pools", "knockouts"

const IIT_LOGO_FILES = {
  PAT: "icons/iitp-sports-crest.png",
  KAN: "icons/iit-logos/kan.png",
  MAN: "icons/iit-logos/man.png",
  ROO: "icons/iit-logos/roo.png",
  BOM: "icons/iit-logos/bom.png",
  ROP: "icons/iit-logos/rop.png",
  DHN: "icons/iit-logos/ism.png",
  ISM: "icons/iit-logos/ism.png",
  DEL: "icons/iit-logos/del.png",
  GUW: "icons/iit-logos/guw.png",
  HYD: "icons/iit-logos/hyd.png",
  KGP: "icons/iit-logos/kgp.png",
  MAD: "icons/iit-logos/mad.png",
  BHU: "icons/iit-logos/bhu.png",
  JOD: "icons/iit-logos/jod.png",
  IND: "icons/iit-logos/ind.png",
  TIR: "icons/iit-logos/tir.png",
  GOA: "icons/iit-logos/goa.png",
  JAM: "icons/iit-logos/jam.png",
  BHI: "icons/iit-logos/bhi.png",
  BBS: "icons/iit-logos/bbs.png",
  PAL: "icons/iit-logos/pal.png",
  IISC: "icons/iit-logos/iisc.png",
};

const IIT_DIRECTORY = {
  PAT: { name: "IIT Patna", short: "Patna", pool: "A", isUs: true, bg: "#0b2a4a", accent: "#38bdf8", text: "#ffffff", motif: "crest" },
  KAN: { name: "IIT Kanpur", short: "Kanpur", pool: "A", bg: "#1e3a8a", accent: "#fbbf24", text: "#ffffff", motif: "atom" },
  MAN: { name: "IIT Mandi", short: "Mandi", pool: "A", bg: "#14532d", accent: "#86efac", text: "#ffffff", motif: "mountain" },
  ROO: { name: "IIT Roorkee", short: "Roorkee", pool: "B", bg: "#7f1d1d", accent: "#fde047", text: "#ffffff", motif: "pillar" },
  BOM: { name: "IIT Bombay", short: "Bombay", pool: "B", bg: "#0f2a5c", accent: "#f59e0b", text: "#ffffff", motif: "gear" },
  ROP: { name: "IIT Ropar", short: "Ropar", pool: "B", bg: "#1d4ed8", accent: "#fdba74", text: "#ffffff", motif: "flame" },
  DHN: { name: "IIT ISM Dhanbad", short: "Dhanbad", pool: "B", bg: "#713f12", accent: "#facc15", text: "#ffffff", motif: "pickaxe" },
  ISM: { name: "IIT ISM Dhanbad", short: "Dhanbad", pool: "B", bg: "#713f12", accent: "#facc15", text: "#ffffff", motif: "pickaxe" },
  DEL: { name: "IIT Delhi", short: "Delhi", pool: "C", bg: "#1e40af", accent: "#fb923c", text: "#ffffff", motif: "chakra" },
  GUW: { name: "IIT Guwahati", short: "Guwahati", pool: "C", bg: "#134e4a", accent: "#fef08a", text: "#ffffff", motif: "river" },
  HYD: { name: "IIT Hyderabad", short: "Hyderabad", pool: "C", bg: "#3730a3", accent: "#67e8f9", text: "#ffffff", motif: "nodes" },
  KGP: { name: "IIT Kharagpur", short: "Kharagpur", pool: "C", bg: "#881337", accent: "#fde047", text: "#ffffff", motif: "torch" },
  MAD: { name: "IIT Madras", short: "Madras", pool: "D", bg: "#581c87", accent: "#facc15", text: "#ffffff", motif: "banyan" },
  BHU: { name: "IIT (BHU) Varanasi", short: "BHU", pool: "D", bg: "#9a3412", accent: "#ffedd5", text: "#ffffff", motif: "temple" },
  JOD: { name: "IIT Jodhpur", short: "Jodhpur", pool: "D", bg: "#7c2d12", accent: "#7dd3fc", text: "#ffffff", motif: "sun" },
  IND: { name: "IIT Indore", short: "Indore", pool: "D", bg: "#0369a1", accent: "#fde047", text: "#ffffff", motif: "star" },
  TIR: { name: "IIT Tirupati", short: "Tirupati", pool: "Other", bg: "#881337", accent: "#fda4af", text: "#ffffff", motif: "pillar" },
  GOA: { name: "IIT Goa", short: "Goa", pool: "Other", bg: "#1e3a8a", accent: "#93c5fd", text: "#ffffff", motif: "chakra" },
  JAM: { name: "IIT Jammu", short: "Jammu", pool: "Other", bg: "#047857", accent: "#6ee7b7", text: "#ffffff", motif: "mountain" },
  BHI: { name: "IIT Bhilai", short: "Bhilai", pool: "Other", bg: "#4c1d95", accent: "#c4b5fd", text: "#ffffff", motif: "atom" },
  BBS: { name: "IIT Bhubaneswar", short: "Bhubaneswar", pool: "Other", bg: "#0369a1", accent: "#7dd3fc", text: "#ffffff", motif: "chakra" },
  PAL: { name: "IIT Palakkad", short: "Palakkad", pool: "Other", bg: "#b45309", accent: "#fde68a", text: "#ffffff", motif: "sun" },
  IISC: { name: "IISc Bangalore", short: "IISc", pool: "Other", bg: "#0f172a", accent: "#94a3b8", text: "#ffffff", motif: "pillar" },
};

function getMotifSvg(motif, acc) {
  switch (motif) {
    case "atom":
      return `<ellipse cx="22" cy="14" rx="6" ry="2.2" fill="none" stroke="${acc}" stroke-width="1.2" transform="rotate(30 22 14)"/><ellipse cx="22" cy="14" rx="6" ry="2.2" fill="none" stroke="${acc}" stroke-width="1.2" transform="rotate(-30 22 14)"/><circle cx="22" cy="14" r="1.5" fill="${acc}"/>`;
    case "mountain":
      return `<path d="M16 18l4-6 2.5 3.5 2-2.5 3.5 5z" fill="none" stroke="${acc}" stroke-width="1.3" stroke-linejoin="round"/>`;
    case "gear":
      return `<circle cx="22" cy="14" r="3" fill="none" stroke="${acc}" stroke-width="1.3"/><path d="M22 9.5v2M22 16.5v2M17.5 14h2M24.5 14h2" stroke="${acc}" stroke-width="1.4"/>`;
    case "torch":
      return `<path d="M20 18h4v-3h-4zM22 10c-1.5 2-1 3.5 0 4.5 1-1 1.5-2.5 0-4.5z" fill="${acc}"/>`;
    case "flame":
      return `<path d="M22 9c-2 3-1 4.5 0 6 1-1.5 2-3 0-6z" fill="${acc}"/>`;
    case "pillar":
      return `<path d="M18 10h8M19 10v7M25 10v7M17 17h10" stroke="${acc}" stroke-width="1.3"/>`;
    case "sun":
      return `<circle cx="22" cy="14" r="3" fill="${acc}"/><path d="M22 9.5v1M22 17.5v1M17.5 14h1M25.5 14h1" stroke="${acc}" stroke-width="1.2"/>`;
    case "nodes":
      return `<circle cx="18" cy="13" r="1.5" fill="${acc}"/><circle cx="26" cy="13" r="1.5" fill="${acc}"/><circle cx="22" cy="16.5" r="1.5" fill="${acc}"/><path d="M18 13l4 3.5 4-3.5" stroke="${acc}" stroke-width="1"/>`;
    case "pickaxe":
      return `<path d="M18 11c3 1.5 5 1.5 8 0M22 12v6" stroke="${acc}" stroke-width="1.3" fill="none"/>`;
    case "chakra":
      return `<circle cx="22" cy="14" r="4.5" fill="none" stroke="${acc}" stroke-width="1.2"/><circle cx="22" cy="14" r="1.2" fill="${acc}"/>`;
    case "river":
      return `<path d="M17 13c2.5-1.5 3.5 1.5 5 0s2.5 1.5 5 0" stroke="${acc}" stroke-width="1.3" fill="none"/>`;
    case "banyan":
      return `<path d="M22 17v-4M22 13c-2-2-4 0-4 1.5s2 1.5 4 0c2 1.5 4 0 4-1.5s-2-3.5-4-1.5" stroke="${acc}" stroke-width="1.2" fill="none"/>`;
    case "temple":
      return `<path d="M18 17h8l-4-7zM22 7v3" stroke="${acc}" stroke-width="1.2" fill="none"/>`;
    case "star":
      return `<polygon points="22,9 23.5,13 27,13.5 24.5,15.5 25.5,19 22,17 18.5,19 19.5,15.5 17,13.5 20.5,13" fill="${acc}"/>`;
    default:
      return `<circle cx="22" cy="14" r="3" fill="${acc}"/>`;
  }
}

function renderIitLogo(code, name, size = 38) {
  const normCode = String(code || "").toUpperCase().trim();
  const titleText = esc(name || (IIT_DIRECTORY[normCode] && IIT_DIRECTORY[normCode].name) || normCode);

  if (normCode === "PAT") {
    return `<img src="icons/iitp-sports-crest.png" alt="${titleText} Sports Crest" title="${titleText}" class="iit-crest-img is-patna" width="${size}" height="${size}" style="width:${size}px;height:${size}px;object-fit:contain;border-radius:50%;box-shadow:0 3px 10px rgba(11,42,74,0.45);flex-shrink:0;" loading="lazy" decoding="async">`;
  }

  const logoFile = IIT_LOGO_FILES[normCode];
  if (logoFile) {
    const pad = Math.max(2, Math.round(size * 0.08));
    return `
      <div class="iit-logo-badge" title="${titleText}" aria-label="${titleText}" style="width:${size}px;height:${size}px;border-radius:50%;background:#ffffff;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.22);flex-shrink:0;overflow:hidden;padding:${pad}px;border:1.5px solid rgba(255,255,255,0.4);box-sizing:border-box;">
        <img src="${logoFile}" alt="${titleText} Official Emblem" width="${size}" height="${size}" class="iit-crest-img" style="max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;image-rendering:auto;" loading="lazy" decoding="async">
      </div>
    `;
  }

  const m = IIT_DIRECTORY[normCode] || {
    bg: "#0f2b48",
    accent: "#38bdf8",
    text: "#ffffff",
    motif: "star",
    name: name || normCode,
  };
  return `
    <svg class="iit-crest-svg" width="${size}" height="${size}" viewBox="0 0 44 44" aria-label="${titleText}" title="${titleText}" style="width:${size}px;height:${size}px;flex-shrink:0;border-radius:50%;box-shadow:0 3px 10px rgba(0,0,0,0.3);shape-rendering:geometricPrecision">
      <circle cx="22" cy="22" r="21" fill="${m.bg}" stroke="${m.accent}" stroke-width="2"/>
      <circle cx="22" cy="22" r="18" fill="none" stroke="${m.accent}" stroke-width="0.8" stroke-dasharray="2 2" opacity="0.6"/>
      ${getMotifSvg(m.motif, m.accent)}
      <text x="22" y="${m.motif ? '33' : '26'}" text-anchor="middle" fill="${m.text}" font-size="${m.motif ? '9.5' : '11'}" font-weight="900" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" letter-spacing="0.5">${esc(normCode)}</text>
    </svg>
  `;
}

const HOCKEY_POOLS = {
  A: {
    name: "Pool A",
    teams: [
      { code: "KAN", name: "IIT Kanpur", seed: "Top Seed" },
      { code: "MAN", name: "IIT Mandi", seed: "Contender" },
      { code: "PAT", name: "IIT Patna", seed: "Our Squad", isUs: true },
    ],
  },
  B: {
    name: "Pool B",
    teams: [
      { code: "ROO", name: "IIT Roorkee", seed: "Top Seed" },
      { code: "BOM", name: "IIT Bombay", seed: "Contender" },
      { code: "ROP", name: "IIT Ropar", seed: "Contender" },
      { code: "DHN", name: "IIT ISM Dhanbad", seed: "Contender" },
    ],
  },
  C: {
    name: "Pool C",
    teams: [
      { code: "DEL", name: "IIT Delhi", seed: "Top Seed" },
      { code: "GUW", name: "IIT Guwahati", seed: "Contender" },
      { code: "HYD", name: "IIT Hyderabad", seed: "Contender" },
      { code: "KGP", name: "IIT Kharagpur", seed: "Challenger" },
    ],
  },
  D: {
    name: "Pool D",
    teams: [
      { code: "MAD", name: "IIT Madras", seed: "Top Seed" },
      { code: "BHU", name: "IIT (BHU) Varanasi", seed: "Contender" },
      { code: "JOD", name: "IIT Jodhpur", seed: "Contender" },
      { code: "IND", name: "IIT Indore", seed: "Contender" },
    ],
  },
};

const HOCKEY_LEAGUE_MATCHES = [
  { matchNo: 1, pool: "B", date: "2026-12-15", day: "Tuesday, 15 Dec 2026", time: "6:00 AM", ground: "Ground 1 (Astroturf)", t1: "ROO", team1: "IIT Roorkee", t2: "BOM", team2: "IIT Bombay" },
  { matchNo: 2, pool: "B", date: "2026-12-15", day: "Tuesday, 15 Dec 2026", time: "8:00 AM", ground: "Ground 1 (Astroturf)", t1: "ROP", team1: "IIT Ropar", t2: "DHN", team2: "IIT ISM Dhanbad" },
  { matchNo: 3, pool: "A", date: "2026-12-15", day: "Tuesday, 15 Dec 2026", time: "10:00 AM", ground: "Ground 1 (Astroturf)", t1: "KAN", team1: "IIT Kanpur", t2: "MAN", team2: "IIT Mandi" },
  { matchNo: 4, pool: "D", date: "2026-12-15", day: "Tuesday, 15 Dec 2026", time: "12:30 PM", ground: "Ground 1 (Astroturf)", t1: "MAD", team1: "IIT Madras", t2: "JOD", team2: "IIT Jodhpur" },
  { matchNo: 5, pool: "C", date: "2026-12-15", day: "Tuesday, 15 Dec 2026", time: "2:30 PM", ground: "Ground 1 (Astroturf)", t1: "DEL", team1: "IIT Delhi", t2: "GUW", team2: "IIT Guwahati" },
  { matchNo: 6, pool: "C", date: "2026-12-15", day: "Tuesday, 15 Dec 2026", time: "4:30 PM", ground: "Ground 1 (Astroturf)", t1: "HYD", team1: "IIT Hyderabad", t2: "KGP", team2: "IIT Kharagpur" },
  { matchNo: 7, pool: "B", date: "2026-12-16", day: "Wednesday, 16 Dec 2026", time: "7:00 AM", ground: "Ground 1 (Astroturf)", t1: "BOM", team1: "IIT Bombay", t2: "ROP", team2: "IIT Ropar" },
  { matchNo: 8, pool: "D", date: "2026-12-16", day: "Wednesday, 16 Dec 2026", time: "9:00 AM", ground: "Ground 1 (Astroturf)", t1: "BHU", team1: "IIT (BHU) Varanasi", t2: "IND", team2: "IIT Indore" },
  { matchNo: 9, pool: "A", date: "2026-12-16", day: "Wednesday, 16 Dec 2026", time: "11:00 AM", ground: "Ground 1 (Astroturf)", t1: "KAN", team1: "IIT Kanpur", t2: "PAT", team2: "IIT Patna", isPatna: true },
  { matchNo: 10, pool: "C", date: "2026-12-16", day: "Wednesday, 16 Dec 2026", time: "2:00 PM", ground: "Ground 1 (Astroturf)", t1: "DEL", team1: "IIT Delhi", t2: "HYD", team2: "IIT Hyderabad" },
  { matchNo: 11, pool: "C", date: "2026-12-16", day: "Wednesday, 16 Dec 2026", time: "4:00 PM", ground: "Ground 1 (Astroturf)", t1: "GUW", team1: "IIT Guwahati", t2: "KGP", team2: "IIT Kharagpur" },
  { matchNo: 12, pool: "B", date: "2026-12-17", day: "Thursday, 17 Dec 2026", time: "7:00 AM", ground: "Ground 1 (Astroturf)", t1: "ROO", team1: "IIT Roorkee", t2: "DHN", team2: "IIT ISM Dhanbad" },
  { matchNo: 13, pool: "D", date: "2026-12-17", day: "Thursday, 17 Dec 2026", time: "9:00 AM", ground: "Ground 1 (Astroturf)", t1: "MAD", team1: "IIT Madras", t2: "IND", team2: "IIT Indore" },
  { matchNo: 14, pool: "A", date: "2026-12-17", day: "Thursday, 17 Dec 2026", time: "11:00 AM", ground: "Ground 1 (Astroturf)", t1: "MAN", team1: "IIT Mandi", t2: "PAT", team2: "IIT Patna", isPatna: true },
  { matchNo: 15, pool: "D", date: "2026-12-17", day: "Thursday, 17 Dec 2026", time: "2:00 PM", ground: "Ground 1 (Astroturf)", t1: "BHU", team1: "IIT (BHU) Varanasi", t2: "JOD", team2: "IIT Jodhpur" },
  { matchNo: 16, pool: "C", date: "2026-12-17", day: "Thursday, 17 Dec 2026", time: "4:00 PM", ground: "Ground 1 (Astroturf)", t1: "DEL", team1: "IIT Delhi", t2: "KGP", team2: "IIT Kharagpur" },
  { matchNo: 17, pool: "B", date: "2026-12-18", day: "Friday, 18 Dec 2026", time: "7:00 AM", ground: "Ground 1 (Astroturf)", t1: "ROO", team1: "IIT Roorkee", t2: "ROP", team2: "IIT Ropar" },
  { matchNo: 18, pool: "B", date: "2026-12-18", day: "Friday, 18 Dec 2026", time: "9:00 AM", ground: "Ground 1 (Astroturf)", t1: "BOM", team1: "IIT Bombay", t2: "DHN", team2: "IIT ISM Dhanbad" },
  { matchNo: 19, pool: "D", date: "2026-12-18", day: "Friday, 18 Dec 2026", time: "11:00 AM", ground: "Ground 1 (Astroturf)", t1: "JOD", team1: "IIT Jodhpur", t2: "IND", team2: "IIT Indore" },
  { matchNo: 20, pool: "C", date: "2026-12-18", day: "Friday, 18 Dec 2026", time: "2:00 PM", ground: "Ground 1 (Astroturf)", t1: "GUW", team1: "IIT Guwahati", t2: "HYD", team2: "IIT Hyderabad" },
  { matchNo: 21, pool: "D", date: "2026-12-18", day: "Friday, 18 Dec 2026", time: "4:00 PM", ground: "Ground 1 (Astroturf)", t1: "MAD", team1: "IIT Madras", t2: "BHU", team2: "IIT (BHU) Varanasi" },
];

const HOCKEY_KNOCKOUT_MATCHES = [
  { matchNo: 22, stage: "Q-1 (Quarter-Final 1)", date: "19-Dec-2026", day: "Saturday, 19 Dec 2026", time: "7:00 AM", ground: "Ground 1 (Astroturf)", t1Name: "Winner Pool A", t1Code: "Winner A", t2Name: "Runner Pool C", t2Code: "Runner C", note: "Winner qualifies for Semi-Final 1" },
  { matchNo: 23, stage: "Q-2 (Quarter-Final 2)", date: "19-Dec-2026", day: "Saturday, 19 Dec 2026", time: "9:00 AM", ground: "Ground 1 (Astroturf)", t1Name: "Winner Pool B", t1Code: "Winner B", t2Name: "Runner Pool D", t2Code: "Runner D", note: "Winner qualifies for Semi-Final 2" },
  { matchNo: 24, stage: "Q-3 (Quarter-Final 3)", date: "19-Dec-2026", day: "Saturday, 19 Dec 2026", time: "1:00 PM", ground: "Ground 1 (Astroturf)", t1Name: "Winner Pool C", t1Code: "Winner C", t2Name: "Runner Pool A", t2Code: "Runner A", note: "Winner qualifies for Semi-Final 2" },
  { matchNo: 25, stage: "Q-4 (Quarter-Final 4)", date: "19-Dec-2026", day: "Saturday, 19 Dec 2026", time: "3:00 PM", ground: "Ground 1 (Astroturf)", t1Name: "Winner Pool D", t1Code: "Winner D", t2Name: "Runner Pool B", t2Code: "Runner B", note: "Winner qualifies for Semi-Final 1" },
  { matchNo: 26, stage: "SF-1 (Semi-Final 1)", date: "20-Dec-2026", day: "Sunday, 20 Dec 2026", time: "9:00 AM", ground: "Ground 1 (Astroturf)", t1Name: "Winner QF-1", t1Code: "QF1 Win", t2Name: "Winner QF-4", t2Code: "QF4 Win", note: "Winner advances to Championship Final" },
  { matchNo: 27, stage: "SF-2 (Semi-Final 2)", date: "20-Dec-2026", day: "Sunday, 20 Dec 2026", time: "11:00 AM", ground: "Ground 1 (Astroturf)", t1Name: "Winner QF-2", t1Code: "QF2 Win", t2Name: "Winner QF-3", t2Code: "QF3 Win", note: "Winner advances to Championship Final" },
  { matchNo: 28, stage: "3rd Place Podium Match", date: "21-Dec-2026", day: "Monday, 21 Dec 2026", time: "7:00 AM", ground: "Ground 1 (Astroturf)", t1Name: "Loser SF-1", t1Code: "SF1 Run", t2Name: "Loser SF-2", t2Code: "SF2 Run", note: "Bronze Medal Playoff 🥉" },
  { matchNo: 29, stage: "Championship Final 🏆", date: "21-Dec-2026", day: "Monday, 21 Dec 2026", time: "9:00 AM", ground: "Ground 1 (Astroturf)", t1Name: "Winner SF-1", t1Code: "Finalist 1", t2Name: "Winner SF-2", t2Code: "Finalist 2", note: "59th Inter-IIT Gold Medal Match 🥇" },
];

function studentFixtureCard(opts = {}) {
  const isPublic = !!(opts && opts.isPublic);
  const isHub = !!(opts && opts.isHub);
  const currentView = fixtureHockeyView || "patna";

  const renderTabs = () => {
    const tabs = [
      ["patna", "🏑", "IIT Patna Matches"],
      ["all", "📋", "All 21 League Fixtures"],
      ["pools", "🛡️", "Pools A, B, C, D"],
      ["knockouts", "🏆", "Knockouts & Finals"],
    ];
    return tabs
      .map(
        ([k, ic, lbl]) =>
          `<button type="button" class="fixture-tab-pill ${currentView === k ? "active" : ""}" data-hview="${k}" role="tab" aria-selected="${currentView === k}">${ic} ${lbl}</button>`,
      )
      .join("");
  };

  const renderPatnaView = () => {
    const patnaMatches = HOCKEY_LEAGUE_MATCHES.filter((m) => m.isPatna);
    return `
      <!-- Patna Squad Pool Banner -->
      <div class="fixture-pool-banner">
        <div class="fixture-pool-title">
          <span class="pool-tag">Pool A · Men's Hockey</span>
          <span class="pool-desc">Group Allocation &amp; Preliminary Competitors</span>
        </div>
        <div class="fixture-teams-row">
          ${HOCKEY_POOLS.A.teams
            .map(
              (t) => `
              <div class="fixture-team-chip ${t.isUs ? "is-us" : ""}">
                ${renderIitLogo(t.code, t.name, 26)}
                <span class="team-chip-name">${esc(t.name)}</span>
                <span class="team-chip-badge">${t.isUs ? "★ Our Squad" : esc(t.seed)}</span>
              </div>
            `,
            )
            .join("")}
        </div>
      </div>

      <!-- Match Cards for Patna -->
      <div class="fixture-matches-grid">
        ${patnaMatches
          .map(
            (m) => `
            <div class="fixture-match-card is-patna-card">
              <div class="fmc-header">
                <div class="fmc-meta-left">
                  <span class="fmc-num-pill">Match #${m.matchNo}</span>
                  <span class="fmc-stage-pill">Pool A · Preliminary League</span>
                </div>
                <div class="fmc-time-pill">
                  <span>📅 ${esc(m.day)}</span>
                  <b>⏰ ${esc(m.time)}</b>
                </div>
              </div>

              <div class="fmc-vs-strip">
                <div class="fmc-team ${m.t1 === 'PAT' ? 'is-us' : ''}">
                  ${renderIitLogo(m.t1, m.team1, 36)}
                  <div class="fmc-team-info">
                    <b class="fmc-team-name">${esc(m.team1)}</b>
                    <span class="fmc-team-sub">${m.t1 === 'PAT' ? '★ IIT Patna Squad' : 'Pool A Opponent'}</span>
                  </div>
                </div>

                <div class="fmc-center">
                  <div class="fmc-vs-circle">VS</div>
                </div>

                <div class="fmc-team is-right ${m.t2 === 'PAT' ? 'is-us' : ''}">
                  <div class="fmc-team-info" style="text-align:right;">
                    <b class="fmc-team-name">${esc(m.team2)}</b>
                    <span class="fmc-team-sub">${m.t2 === 'PAT' ? '★ IIT Patna Squad' : 'Pool A Opponent'}</span>
                  </div>
                  ${renderIitLogo(m.t2, m.team2, 36)}
                </div>
              </div>

              <div class="fmc-footer">
                <div class="fmc-status-note">
                  <span class="status-dot green"></span>
                  <span>Official Inter-IIT Draw · Tata Steel Sports Complex Astroturf</span>
                </div>
                <button type="button" class="btn-match-sheet" data-open-fixture-modal="hockey" title="View detailed match sheet and instructions">
                  ${ico("scan")} Match Sheet
                </button>
              </div>
            </div>
          `,
          )
          .join("")}
      </div>

      <!-- Patna Qualification Roadmap -->
      <div class="fixture-knockouts-section" style="margin-top:16px;">
        <div class="fks-header">
          <span class="fks-kicker">IIT PATNA ADVANCEMENT PATHWAY</span>
          <h3 class="fks-title">🏆 Road to the Inter-IIT Hockey Podium</h3>
        </div>
        <div class="fks-roadmap">
          <div class="fks-node">
            <div class="fks-badge">Stage 1 · Pool A</div>
            <div class="fks-info">
              <b class="fks-stage">Top 2 Pool Finish</b>
              <span class="fks-timing">16 &amp; 17 Dec 2026 · Ground 1</span>
              <small class="fks-cond">Finish 1st or 2nd in Pool A against IIT Kanpur and IIT Mandi</small>
            </div>
          </div>
          <div class="fks-node">
            <div class="fks-badge">Stage 2 · Quarter-Final</div>
            <div class="fks-info">
              <b class="fks-stage">QF-1 (7:00 AM) or QF-3 (1:00 PM)</b>
              <span class="fks-timing">19 Dec 2026 · Ground 1</span>
              <small class="fks-cond">If Pool A Winner: plays Runner Pool C (QF-1) · If Pool A Runner: plays Winner Pool C (QF-3)</small>
            </div>
          </div>
          <div class="fks-node">
            <div class="fks-badge">Stage 3 · Semi-Final</div>
            <div class="fks-info">
              <b class="fks-stage">SF-1 or SF-2</b>
              <span class="fks-timing">20 Dec 2026 · 9:00 AM / 11:00 AM</span>
              <small class="fks-cond">Winners of Quarter-Finals advance to Medal Rounds</small>
            </div>
          </div>
          <div class="fks-node is-final">
            <div class="fks-badge">🥇 Grand Final</div>
            <div class="fks-info">
              <b class="fks-stage">Championship Final 🏆</b>
              <span class="fks-timing">21 Dec 2026 · 9:00 AM</span>
              <small class="fks-cond">Tata Steel Sports Complex · Gold Medal Presentation</small>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const renderAllLeagueView = () => {
    return `
      <div class="fixture-pool-banner">
        <div class="fixture-pool-title">
          <span class="pool-tag">Inter-IIT 2026 · Men's Hockey</span>
          <span class="pool-desc">All 21 Group League Matches (Dec 15–18, 2026 · Ground 1 Astroturf)</span>
        </div>
      </div>

      <div class="fixture-matches-grid">
        ${HOCKEY_LEAGUE_MATCHES.map(
          (m) => `
          <div class="fixture-match-card ${m.isPatna ? "is-patna-card" : ""}">
            <div class="fmc-header">
              <div class="fmc-meta-left">
                <span class="fmc-num-pill">Match #${m.matchNo}</span>
                <span class="fmc-stage-pill">Pool ${esc(m.pool)} League</span>
                ${m.isPatna ? '<span class="pill pri" style="font-size:0.7rem;padding:2px 8px;">★ IIT Patna Match</span>' : ''}
              </div>
              <div class="fmc-time-pill">
                <span>📅 ${esc(m.day)}</span>
                <b>⏰ ${esc(m.time)}</b>
              </div>
            </div>

            <div class="fmc-vs-strip">
              <div class="fmc-team ${m.t1 === 'PAT' ? 'is-us' : ''}">
                ${renderIitLogo(m.t1, m.team1, 36)}
                <div class="fmc-team-info">
                  <b class="fmc-team-name">${esc(m.team1)}</b>
                  <span class="fmc-team-sub">${m.t1 === 'PAT' ? '★ Our Squad' : 'Pool ' + m.pool}</span>
                </div>
              </div>

              <div class="fmc-center">
                <div class="fmc-vs-circle">VS</div>
              </div>

              <div class="fmc-team is-right ${m.t2 === 'PAT' ? 'is-us' : ''}">
                <div class="fmc-team-info" style="text-align:right;">
                  <b class="fmc-team-name">${esc(m.team2)}</b>
                  <span class="fmc-team-sub">${m.t2 === 'PAT' ? '★ Our Squad' : 'Pool ' + m.pool}</span>
                </div>
                ${renderIitLogo(m.t2, m.team2, 36)}
              </div>
            </div>

            <div class="fmc-footer">
              <div class="fmc-status-note">
                <span class="status-dot green"></span>
                <span>Scheduled · Tata Steel Sports Complex Astroturf</span>
              </div>
              <button type="button" class="btn-match-sheet" data-open-fixture-modal="hockey" title="View detailed match sheet and instructions">
                ${ico("scan")} Match Sheet
              </button>
            </div>
          </div>
        `,
        ).join("")}
      </div>
    `;
  };

  const renderPoolsView = () => {
    const pools = ["A", "B", "C", "D"];
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;">
        ${pools
          .map((pKey) => {
            const p = HOCKEY_POOLS[pKey];
            const isOurPool = pKey === "A";
            return `
            <div class="card" style="margin:0;padding:16px;background:var(--soft);border:1px solid ${isOurPool ? "var(--brand)" : "var(--line)"};border-radius:14px;box-shadow:${isOurPool ? "0 4px 18px rgba(37,99,235,0.2)" : "none"}">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:10px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span class="pill pri" style="font-weight:800;font-size:0.85rem">POOL ${pKey}</span>
                  <b style="color:var(--ink);font-size:1rem">${esc(p.name)}</b>
                </div>
                ${isOurPool ? '<span class="pill" style="background:#059669;color:#fff;font-weight:700;font-size:0.75rem;">★ IIT Patna Pool</span>' : `<span class="mute" style="font-size:0.8rem">${p.teams.length} Teams</span>`}
              </div>
              <div style="display:flex;flex-direction:column;gap:10px;">
                ${p.teams
                  .map(
                    (t) => `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--card);border-radius:10px;border:1px solid ${t.isUs ? "var(--brand)" : "var(--line)"}">
                      <div style="display:flex;align-items:center;gap:10px;">
                        ${renderIitLogo(t.code, t.name, 32)}
                        <div>
                          <b style="display:block;font-size:0.92rem;color:var(--ink)">${esc(t.name)}</b>
                          <span class="mute" style="font-size:0.75rem">Code: ${esc(t.code)}</span>
                        </div>
                      </div>
                      <span class="pill ${t.isUs ? "pri" : ""}" style="font-size:0.72rem">${t.isUs ? "★ Our Squad" : esc(t.seed)}</span>
                    </div>
                  `,
                  )
                  .join("")}
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    `;
  };

  const renderKnockoutsView = () => {
    return `
      <div class="fixture-pool-banner">
        <div class="fixture-pool-title">
          <span class="pool-tag">Championship Knockouts</span>
          <span class="pool-desc">Quarter-Finals, Semi-Finals, 3rd Place &amp; Grand Final (Dec 19–21, 2026)</span>
        </div>
      </div>

      <div class="fixture-matches-grid">
        ${HOCKEY_KNOCKOUT_MATCHES.map(
          (m) => `
          <div class="fixture-match-card ${m.matchNo === 29 ? "is-final-match-card" : ""}">
            <div class="fmc-header">
              <div class="fmc-meta-left">
                <span class="fmc-num-pill">Match #${m.matchNo}</span>
                <span class="fmc-stage-pill" style="${m.matchNo === 29 ? 'background:#eab308;color:#000;font-weight:800;' : ''}">${esc(m.stage)}</span>
              </div>
              <div class="fmc-time-pill">
                <span>📅 ${esc(m.day)}</span>
                <b>⏰ ${esc(m.time)}</b>
              </div>
            </div>

            <div class="fmc-vs-strip">
              <div class="fmc-team">
                ${renderIitLogo(m.t1Code, m.t1Name, 36)}
                <div class="fmc-team-info">
                  <b class="fmc-team-name">${esc(m.t1Name)}</b>
                  <span class="fmc-team-sub">Knockout Competitor</span>
                </div>
              </div>

              <div class="fmc-center">
                <div class="fmc-vs-circle">VS</div>
              </div>

              <div class="fmc-team is-right">
                <div class="fmc-team-info" style="text-align:right;">
                  <b class="fmc-team-name">${esc(m.t2Name)}</b>
                  <span class="fmc-team-sub">Knockout Competitor</span>
                </div>
                ${renderIitLogo(m.t2Code, m.t2Name, 36)}
              </div>
            </div>

            <div class="fmc-footer">
              <div class="fmc-status-note">
                <span class="status-dot ${m.matchNo === 29 ? 'amber' : 'green'}"></span>
                <span>${esc(m.note)}</span>
              </div>
              <button type="button" class="btn-match-sheet" data-open-fixture-modal="hockey" title="View tournament rules and guidelines">
                ${ico("scan")} Match Sheet
              </button>
            </div>
          </div>
        `,
        ).join("")}
      </div>
    `;
  };

  return `
    <div class="student-fixtures-container">
      <div class="card fixture-card" id="student-fixtures-card">
        ${
          isPublic
            ? `
          <div class="fixture-card-header is-public-header" style="padding:10px 14px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:1.15rem">🏑</span>
              <div>
                <b style="font-size:0.96rem;color:var(--ink);display:block;line-height:1.2">IIT Patna Men's Hockey Matches</b>
                <span class="mute" style="font-size:0.75rem">59th Inter-IIT Sports Meet · Dec 15–21, 2026 · Ground 1 Turf</span>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <button type="button" class="btn-fixture-scan" data-open-interiit-hub title="Open Complete 59th Inter IIT Sports Meet Hub" style="padding:6px 12px;font-size:0.8rem;border-radius:10px;background:var(--soft);border:1px solid var(--line);font-weight:700;color:var(--ink);display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
                ${ico("award")} <span>59th Inter-IIT Hub ↗</span>
              </button>
            </div>
          </div>
        `
            : isHub
              ? `
          <div class="fixture-card-header is-hub-header" style="padding:4px 0 8px;margin-bottom:8px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:1rem;font-weight:800;color:var(--ink);">🏑 Men's Hockey Tournament Fixtures</span>
              <span class="pill" style="font-size:0.7rem;padding:2px 8px;">Ground 1 Turf</span>
            </div>
            <button type="button" class="btn-fixture-scan" id="btn-fixtures-modal" title="Open Complete Men's Hockey Tournament Guide & Rules" style="padding:5px 12px;font-size:0.78rem;border-radius:8px;">
              ${ico("scan")} <span>Tournament Guide</span>
            </button>
          </div>
        `
              : `
          <div class="fixture-card-header">
            <div class="fixture-title-group">
              <div class="fixture-kicker-strip">
                <span class="fixture-kicker-pill">🏑 59th INTER-IIT SPORTS MEET · HOCKEY MEN</span>
                <span class="fixture-dates-pill">Dec 15–21, 2026</span>
                <span class="fixture-host-pill">📍 Ground 1 Astroturf</span>
              </div>
              <h2 class="fixture-heading" style="margin:2px 0 0;font-size:1.15rem">59th Inter-IIT Men's Hockey Fixtures</h2>
            </div>
            <div class="fixture-action-group">
              <button type="button" class="btn-fixture-scan" id="btn-fixtures-modal" title="Open Complete Men's Hockey Tournament Guide &amp; Rules">
                ${ico("scan")} <span>Guide</span>
              </button>
            </div>
          </div>
        `
        }

        <div class="fixture-tabs-strip" role="tablist" aria-label="Men's Hockey Views">
          ${renderTabs()}
        </div>

        <div class="fixture-body">
          ${
            currentView === "patna"
              ? renderPatnaView()
              : currentView === "all"
                ? renderAllLeagueView()
                : currentView === "pools"
                  ? renderPoolsView()
                  : renderKnockoutsView()
          }

          <div class="fixture-notice-strip">
            <span class="notice-ic">📋</span>
            <div class="notice-tx">
              <b>Official FIH Regulations:</b> Matches played across 4 quarters of 15 minutes each. Tied knockout ties proceed directly to official FIH 8-second penalty shoot-outs. All contingent players must carry their Institute Identity Card.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindStudentFixtureCard() {
  document.querySelectorAll("[data-hview]").forEach((b) => {
    b.onclick = () => {
      fixtureHockeyView = b.dataset.hview;
      document.querySelectorAll(".student-fixtures-container").forEach((el) => {
        el.outerHTML = studentFixtureCard();
      });
      bindStudentFixtureCard();
    };
  });

  document.querySelectorAll(".btn-fixture-scan, [data-open-fixture-modal]").forEach((b) => {
    b.onclick = () => {
      openFixtureModal("hockey");
    };
  });

  document.querySelectorAll("[data-open-interiit-hub]").forEach((b) => {
    b.onclick = () => {
      showInterIITMeetInfo();
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

  d.innerHTML = `
    <div class="dlg-content-wrap">
      <div class="dlg-header-strip" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;border-bottom:1px solid var(--line);padding-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:var(--brand-soft);color:var(--brand)">${ico("scan")}</span>
          <div>
            <h2 style="margin:0;font-size:1.15rem">Inter-IIT 2026 Men's Hockey Tournament Guide</h2>
            <p class="mute" style="margin:2px 0 0;font-size:0.8rem">59th Inter-IIT Sports Meet · Ground 1 Astroturf · Tata Steel Complex</p>
          </div>
        </div>
        <button type="button" class="ib" id="btn-dlg-fx-close" title="Close">${ico("close")}</button>
      </div>

      <div style="max-height:65vh;overflow-y:auto;padding-right:4px;">
        <div class="card" style="margin:0 0 14px;background:var(--soft);border:1px solid var(--line)">
          <h3 style="margin:0 0 6px;font-size:1rem;color:var(--brand)">📍 Ground 1 Hockey Astroturf &amp; Facility Specs</h3>
          <p style="margin:0;font-size:0.86rem;line-height:1.5;color:var(--ink)">
            <b>Astroturf Ground 1:</b> Water-based synthetic hockey pitch with modern floodlighting, warm-up zones, electronic scoreboard, and dual team dugouts.<br>
            <b>Medical &amp; Physio Station:</b> Immediate sports medicine, ice baths, and ambulance response stationed directly trackside.<br>
            <b>Reporting Protocol:</b> Contingents must report to the Technical Table at Ground 1 at least 30 minutes before push-off.
          </p>
        </div>

        <div class="card" style="margin:0 0 14px;background:var(--soft);border:1px solid var(--line)">
          <h3 style="margin:0 0 6px;font-size:1rem;color:var(--ink)">🎽 FIH Playing Conditions &amp; Rules</h3>
          <ul style="margin:0;padding-left:18px;font-size:0.86rem;line-height:1.6;color:var(--ink)">
            <li><b>Match Duration:</b> 4 quarters of 15 minutes each (total 60 minutes). 2-minute break between Q1-Q2 &amp; Q3-Q4; 10-minute halftime break.</li>
            <li><b>Tied Knockout Ties:</b> No extra time. Matches tied at the end of regulation proceed directly to an official FIH 8-second penalty shoot-out (5 attackers per side, followed by sudden death).</li>
            <li><b>Kit &amp; Protection:</b> Shin guards and mouth guards are mandatory for all outfield players. Face masks required during defensive penalty corners.</li>
            <li><b>Color Clashes:</b> In case of jersey color clashes between teams, the team mentioned second in the fixture shall wear an alternate kit.</li>
            <li><b>Identity Verification:</b> Every student athlete must present their official Institute ID card before signing the match sheet.</li>
          </ul>
        </div>

        <div class="card" style="margin:0;background:var(--card);border:1px solid var(--line)">
          <h3 style="margin:0 0 10px;font-size:1rem;color:var(--ink)">🏆 IIT Patna Men's Hockey Matches (Pool A)</h3>
          <div style="padding:10px 12px;background:var(--soft);border-radius:10px;margin-bottom:8px;border:1px solid var(--line)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span class="pill pri" style="font-size:0.75rem">Match #9</span>
              <span style="font-size:0.82rem;font-weight:700;color:var(--ink)">11:00 AM · Wednesday, 16 Dec 2026</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;font-size:0.95rem;font-weight:800;color:var(--ink)">
              ${renderIitLogo("KAN", "IIT Kanpur", 28)}
              <span>IIT Kanpur vs IIT Patna</span>
              ${renderIitLogo("PAT", "IIT Patna", 28)}
            </div>
            <div class="mute" style="font-size:0.8rem;margin-top:2px">
              📍 Ground 1 (Astroturf) · Pool A Preliminary League
            </div>
          </div>

          <div style="padding:10px 12px;background:var(--soft);border-radius:10px;margin-bottom:8px;border:1px solid var(--line)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span class="pill pri" style="font-size:0.75rem">Match #14</span>
              <span style="font-size:0.82rem;font-weight:700;color:var(--ink)">11:00 AM · Thursday, 17 Dec 2026</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;font-size:0.95rem;font-weight:800;color:var(--ink)">
              ${renderIitLogo("MAN", "IIT Mandi", 28)}
              <span>IIT Mandi vs IIT Patna</span>
              ${renderIitLogo("PAT", "IIT Patna", 28)}
            </div>
            <div class="mute" style="font-size:0.8rem;margin-top:2px">
              📍 Ground 1 (Astroturf) · Pool A Preliminary League
            </div>
          </div>
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
}

function openSettingsModal() {
  const d = (typeof ensureDlg === "function" ? ensureDlg("settingsdlg") : null) || document.getElementById("settingsdlg") || (() => {
    const el = document.createElement("dialog");
    el.id = "settingsdlg";
    document.body.appendChild(el);
    return el;
  })();

  d.className = "full-mobile-lightbox";
  d.setAttribute("aria-label", "Settings");
  d.innerHTML = `
    <div class="lightbox-header">
      <div class="lightbox-title">⚙️ App Preferences &amp; Settings</div>
      <div class="lightbox-actions">
        <button type="button" class="lightbox-btn close" id="settings-dlg-close" aria-label="Close">✕</button>
      </div>
    </div>
    <div class="lightbox-content" style="padding:14px 18px;overflow-y:auto;display:block;">
      ${renderSettingsPage()}
    </div>
  `;

  bindSettingsPage();
  const cBtn = d.querySelector("#settings-dlg-close");
  if (cBtn) cBtn.onclick = () => d.close();
  const bBack = d.querySelector("#btn-settings-back");
  if (bBack) bBack.onclick = () => d.close();
  if (typeof d.showModal === "function") d.showModal();
}

function renderSettingsPage() {
  const isDk = typeof isDark === "function" ? isDark() : false;
  const currentVol = typeof volume === "function" ? Math.round(volume() * 100) : 70;
  const isAlert = typeof alertOn !== "undefined" ? alertOn : false;

  return `
    <div class="settings-page" style="width:100%;max-width:100%;padding-bottom:24px;">
      <!-- Top Bar -->
      <div class="settings-top-bar" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <button type="button" class="btn-settings-back" id="btn-settings-back" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:10px;background:var(--card);border:1px solid var(--line);font-size:0.84rem;font-weight:700;color:var(--ink);cursor:pointer;">
            ${ico("back")} <span>Back</span>
          </button>
          <span class="pill pri" style="font-size:0.75rem;font-weight:800;letter-spacing:0.04em">⚙️ SYSTEM SETTINGS</span>
          <span class="pill" style="font-size:0.75rem;font-weight:700;background:var(--soft);color:var(--ink);border:1px solid var(--line)">App Build hk-v130 · Mobile &amp; Desktop Optimized</span>
        </div>
      </div>

      <!-- Settings Header Banner (Full Width) -->
      <div class="card settings-hero-card" style="margin-bottom:14px;padding:16px 20px;border-radius:14px;background:linear-gradient(135deg, rgba(11,42,74,0.96), rgba(7,26,46,0.98)), radial-gradient(circle at top right, rgba(56,189,248,0.22), transparent 70%);border:1px solid rgba(56,189,248,0.35);color:#fff;box-shadow:0 6px 20px rgba(0,0,0,0.25);">
        <div style="display:flex;align-items:center;gap:14px;">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:14px;background:rgba(56,189,248,0.18);color:#38bdf8;font-size:1.6rem;flex-shrink:0;">⚙️</span>
          <div>
            <h1 style="margin:0 0 4px;font-size:clamp(1.2rem, 3.5vw, 1.45rem);font-family:var(--font-display);font-weight:900;letter-spacing:-0.02em;color:#fff;">
              App Preferences &amp; Settings
            </h1>
            <p style="margin:0;font-size:0.84rem;line-height:1.45;color:rgba(255,255,255,0.85);">
              Configure visual appearance, practice &amp; match notifications, whistle sound effects volume, and offline cache storage.
            </p>
          </div>
        </div>
      </div>

      <!-- Responsive Multi-Column Desktop Grid -->
      <div class="settings-cards-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(360px, 1fr));gap:14px;width:100%;">
        <!-- 1. Visual Appearance & Theme Card -->
        <div class="card" style="margin:0;padding:16px 18px;border-radius:14px;background:var(--card);border:1px solid var(--line);display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:10px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:1.15rem;">🎨</span>
              <b style="font-size:0.96rem;color:var(--ink)">Appearance &amp; Visual Theme</b>
            </div>
            <span class="pill" style="font-size:0.72rem;font-weight:700;">Display</span>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--soft);border-radius:10px;border:1px solid var(--line);gap:10px;">
            <div>
              <b style="display:block;font-size:0.88rem;color:var(--ink)">Color Theme</b>
              <span class="mute" style="font-size:0.78rem">Switch between Day (Light) and Night (Dark) mode</span>
            </div>
            <button type="button" class="pill" id="btn-page-set-theme" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;font-size:0.82rem;font-weight:700;cursor:pointer;background:var(--card);color:var(--ink);border:1px solid var(--line);white-space:nowrap;">
              ${ico(isDk ? "sun" : "moon")} <span>${isDk ? "Night Mode 🌙" : "Day Mode ☀️"}</span>
            </button>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--soft);border-radius:10px;border:1px solid var(--line);gap:10px;">
            <div>
              <b style="display:block;font-size:0.88rem;color:var(--ink)">High-DPI Retina Media</b>
              <span class="mute" style="font-size:0.78rem">Lossless WebP image decoding for high resolution monitors</span>
            </div>
            <span class="pill" style="font-weight:700;color:var(--brand);font-size:0.78rem;">Active 🔍</span>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--soft);border-radius:10px;border:1px solid var(--line);gap:10px;">
            <div>
              <b style="display:block;font-size:0.88rem;color:var(--ink)">Widescreen Desktop Density</b>
              <span class="mute" style="font-size:0.78rem">Optimized responsive grid layout with zero side voids</span>
            </div>
            <span class="pill g" style="font-weight:700;font-size:0.78rem;">Full Width 🖥️</span>
          </div>
        </div>

        <!-- 2. Notifications & Alerts Card -->
        <div class="card" style="margin:0;padding:16px 18px;border-radius:14px;background:var(--card);border:1px solid var(--line);display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:10px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:1.15rem;">🔔</span>
              <b style="font-size:0.96rem;color:var(--ink)">Notification &amp; Alert Preferences</b>
            </div>
            <span class="pill pri" style="font-size:0.72rem;font-weight:700;">Alerts</span>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--soft);border-radius:10px;border:1px solid var(--line);gap:10px;">
            <div>
              <b style="display:block;font-size:0.88rem;color:var(--ink)">Practice Reminders (15 min prior)</b>
              <span class="mute" style="font-size:0.78rem">Automated morning reminder and pre-practice alerts</span>
            </div>
            <button type="button" class="pill ${isAlert ? "g" : ""}" id="btn-page-set-alert" style="font-weight:700;cursor:pointer;white-space:nowrap;">
              ${isAlert ? "Active 🔔" : "Enable 🔕"}
            </button>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--soft);border-radius:10px;border:1px solid var(--line);gap:10px;">
            <div>
              <b style="display:block;font-size:0.88rem;color:var(--ink)">Attendance Confirmations</b>
              <span class="mute" style="font-size:0.78rem">Instant notification sent when attendance is marked Present</span>
            </div>
            <span class="pill g" style="font-weight:700;font-size:0.78rem;">Active ✅</span>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--soft);border-radius:10px;border:1px solid var(--line);gap:10px;">
            <div>
              <b style="display:block;font-size:0.88rem;color:var(--ink)">59th Inter-IIT Match Alerts</b>
              <span class="mute" style="font-size:0.78rem">Match day schedule, live turf updates, and push-off count</span>
            </div>
            <span class="pill teal" style="font-weight:700;font-size:0.78rem;">Enabled 🏑</span>
          </div>
        </div>

        <!-- 3. Whistle & Timer Sound Card -->
        <div class="card" style="margin:0;padding:16px 18px;border-radius:14px;background:var(--card);border:1px solid var(--line);display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:10px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:1.15rem;">📢</span>
              <b style="font-size:0.96rem;color:var(--ink)">Umpire Whistle &amp; Audio Controls</b>
            </div>
            <span class="pill" style="font-size:0.72rem;font-weight:700;">Sound FX</span>
          </div>

          <div style="padding:10px 14px;background:var(--soft);border-radius:10px;border:1px solid var(--line);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <b style="font-size:0.88rem;color:var(--ink)">Master Audio Volume</b>
              <span id="settings-vol-val" style="font-size:0.86rem;font-weight:800;color:var(--brand);">${currentVol}%</span>
            </div>
            <input type="range" id="settings-vol-slider" min="0" max="1" step="0.05" value="${typeof volume === "function" ? volume() : 0.7}" style="width:100%;accent-color:var(--brand);cursor:pointer;">
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--soft);border-radius:10px;border:1px solid var(--line);gap:8px;flex-wrap:wrap;">
            <div>
              <b style="display:block;font-size:0.88rem;color:var(--ink)">Test Umpire Blast</b>
              <span class="mute" style="font-size:0.78rem">Synthesized FIH match whistle</span>
            </div>
            <div style="display:flex;gap:6px;">
              <button type="button" class="btn-sec" id="btn-test-short" style="padding:5px 11px;font-size:0.78rem;font-weight:700;">Short</button>
              <button type="button" class="btn-sec" id="btn-test-long" style="padding:5px 11px;font-size:0.78rem;font-weight:700;">Long</button>
              <button type="button" class="btn-sec" id="btn-test-goal" style="padding:5px 11px;font-size:0.78rem;font-weight:700;">Goal</button>
            </div>
          </div>
        </div>

        <!-- 4. Storage & Application Cache Card -->
        <div class="card" style="margin:0;padding:16px 18px;border-radius:14px;background:var(--card);border:1px solid var(--line);display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:10px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:1.15rem;">⚡</span>
              <b style="font-size:0.96rem;color:var(--ink)">PWA Cache &amp; Storage</b>
            </div>
            <span class="pill pri" style="font-size:0.72rem;font-weight:700;">Build System</span>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--soft);border-radius:10px;border:1px solid var(--line);gap:10px;">
            <div>
              <b style="display:block;font-size:0.88rem;color:var(--ink)">Production Version</b>
              <span class="mute" style="font-size:0.78rem">Active service worker shell</span>
            </div>
            <span class="pill" style="font-weight:800;color:var(--brand);font-size:0.78rem;">hk-v130</span>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--soft);border-radius:10px;border:1px solid var(--line);gap:10px;">
            <div>
              <b style="display:block;font-size:0.88rem;color:var(--ink)">Purge &amp; Re-Sync Cache</b>
              <span class="mute" style="font-size:0.78rem">Clear cached bundles and force download latest release</span>
            </div>
            <button type="button" class="btn-sec" id="btn-settings-refresh-cache" style="padding:6px 14px;font-size:0.8rem;font-weight:700;white-space:nowrap;">
              🔄 Refresh Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindSettingsPage() {
  const bBack = document.getElementById("btn-settings-back");
  if (bBack) {
    bBack.onclick = () => {
      if (typeof go === "function") go(prevTab || "me");
    };
  }

  const bThm = document.getElementById("btn-page-set-theme");
  if (bThm) {
    bThm.onclick = () => {
      if (typeof toggleTheme === "function") toggleTheme();
      vSettings();
    };
  }

  const bAlert = document.getElementById("btn-page-set-alert");
  if (bAlert) {
    bAlert.onclick = async () => {
      if (typeof setAlert === "function" && typeof alertOn !== "undefined") {
        await setAlert(!alertOn);
        vSettings();
      }
    };
  }

  const volSlider = document.getElementById("settings-vol-slider");
  const volVal = document.getElementById("settings-vol-val");
  if (volSlider && volVal) {
    volSlider.oninput = () => {
      const v = +volSlider.value;
      if (typeof setVol === "function") setVol(v);
      volVal.textContent = Math.round(v * 100) + "%";
    };
  }

  const bShort = document.getElementById("btn-test-short");
  if (bShort) {
    bShort.onclick = () => {
      if (typeof playWhistle === "function") playWhistle("short");
      else if (typeof playClick === "function") playClick();
    };
  }

  const bLong = document.getElementById("btn-test-long");
  if (bLong) {
    bLong.onclick = () => {
      if (typeof playWhistle === "function") playWhistle("long");
      else if (typeof playClick === "function") playClick();
    };
  }

  const bGoal = document.getElementById("btn-test-goal");
  if (bGoal) {
    bGoal.onclick = () => {
      if (typeof playWhistle === "function") playWhistle("double");
      else if (typeof playClick === "function") playClick();
    };
  }

  const doRefreshCache = async () => {
    try {
      if (window.caches) {
        const ks = await caches.keys();
        await Promise.all(ks.map((k) => caches.delete(k)));
      }
      localStorage.removeItem("hk_cache");
    } catch (e) {}
    location.reload();
  };

  const bRefTop = document.getElementById("btn-settings-refresh-cache-top");
  if (bRefTop) bRefTop.onclick = doRefreshCache;

  const bRef = document.getElementById("btn-settings-refresh-cache");
  if (bRef) bRef.onclick = doRefreshCache;
}

function vSettings() {
  const v = document.getElementById("view");
  if (!v) return;
  v.innerHTML = renderSettingsPage();
  bindSettingsPage();
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- 8. Hockey Skill Practice Video Player
let currentSkillVideoId = "-iVUhQIC1m0";
let skillVideoCategory = "all";

const HOCKEY_SKILL_VIDEOS = [
  {
    id: "U1EX7tUj2aA",
    title: "Hockey Warm Up + Pre-Game Stretches 🏑",
    author: "Hockey Training",
    channelUrl: "https://www.youtube.com/@hockeytraining",
    category: "warmup",
    categoryLabel: "Warm-Up & Stretches",
    duration: "Full Video",
    thumb: "https://i.ytimg.com/vi/U1EX7tUj2aA/hqdefault.jpg",
    desc: "Complete pre-game dynamic warm-up and mobility routine tailored specifically for field hockey players to prevent injuries and optimize performance.",
    coachingPoints: [
      "Perform dynamic mobility drills before stepping onto the turf.",
      "Activate hip flexors, hamstrings, and groin muscles to prepare for low hockey posture.",
      "Gradually increase cardiovascular intensity from light jog to high knees and build-up sprints.",
      "Save static stretches for post-match or post-practice cool-down.",
    ],
    isFeatured: true,
  },
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
  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 861;
  const isFolderOpen = typeof window !== "undefined" && (window._hskFolderOpen !== undefined ? window._hskFolderOpen : isDesktop);

  const curVid = HOCKEY_SKILL_VIDEOS.find((v) => v.id === currentSkillVideoId) || HOCKEY_SKILL_VIDEOS[0];
  const list = skillVideoCategory === "all"
    ? HOCKEY_SKILL_VIDEOS
    : HOCKEY_SKILL_VIDEOS.filter((v) => v.category === skillVideoCategory);

  const categories = [
    ["all", "📁 All Drills", HOCKEY_SKILL_VIDEOS.length],
    ["warmup", "🔥 Warm-Up", HOCKEY_SKILL_VIDEOS.filter((v) => v.category === "warmup").length],
    ["hitting", "🏑 Hitting", HOCKEY_SKILL_VIDEOS.filter((v) => v.category === "hitting").length],
    ["dodging", "⚡ Dodging", HOCKEY_SKILL_VIDEOS.filter((v) => v.category === "dodging").length],
    ["passing", "🎯 Passing", HOCKEY_SKILL_VIDEOS.filter((v) => v.category === "passing").length],
    ["3d", "✨ Aerial 3D", HOCKEY_SKILL_VIDEOS.filter((v) => v.category === "3d").length],
    ["tactics", "🛡️ Tactics", HOCKEY_SKILL_VIDEOS.filter((v) => v.category === "tactics").length],
  ];

  const activeCategoryObj = categories.find(([k]) => k === skillVideoCategory) || categories[0];
  const activeCategoryLabel = activeCategoryObj[1];

  const renderCategoryChips = () => {
    return categories
      .map(
        ([k, lbl, count]) =>
          `<button type="button" class="hsk-cat-pill ${skillVideoCategory === k ? "active" : ""}" data-vcat="${k}">
            <span>${lbl}</span> <span class="hsk-cat-count" style="font-size:0.72rem;opacity:0.85;margin-left:3px;font-weight:700;">(${count})</span>
          </button>`,
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
                <span class="hsk-play-badge">▶</span>
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

  const activeNavList = list.some((v) => v.id === curVid.id) ? list : HOCKEY_SKILL_VIDEOS;
  let curIdx = activeNavList.findIndex((v) => v.id === curVid.id);
  if (curIdx === -1) curIdx = 0;
  const totalDrills = activeNavList.length;
  const prevIdx = (curIdx - 1 + totalDrills) % totalDrills;
  const nextIdx = (curIdx + 1) % totalDrills;
  const prevVid = activeNavList[prevIdx];
  const nextVid = activeNavList[nextIdx];

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
          <div class="hsk-player-wrap" id="hsk-player-wrap">
            <iframe
              id="hsk-main-iframe"
              data-video-id="${currentSkillVideoId}"
              data-src="https://www.youtube-nocookie.com/embed/${currentSkillVideoId}?autoplay=1&mute=1&enablejsapi=1&rel=0&playsinline=1&modestbranding=1"
              src=""
              title="${esc(curVid.title)}"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
              class="hsk-iframe"
            ></iframe>
            <div class="hsk-poster-cover" id="hsk-poster-cover" style="background-image:url('${esc(curVid.thumb)}');">
              <button type="button" class="hsk-poster-play-btn" id="hsk-btn-start-play" aria-label="Play video">▶</button>
              <span class="hsk-poster-hint">Auto-plays when visible on screen</span>
            </div>
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
              <button type="button" class="btn-drill-nav" id="hsk-btn-prev" data-target-id="${esc(prevVid.id)}" title="Previous drill: ${esc(prevVid.title)}">
                <span class="nav-sym">${ico("prev")}</span>
                <span>Previous</span>
              </button>
              <span class="hsk-drill-counter" id="hsk-drill-counter">Drill ${curIdx + 1} of ${totalDrills}</span>
              <button type="button" class="btn-drill-nav pri" id="hsk-btn-next" data-target-id="${esc(nextVid.id)}" title="Next drill: ${esc(nextVid.title)}">
                <span>Next Drill</span>
                <span class="nav-sym">${ico("next")}</span>
              </button>
              <a href="https://youtube.com/shorts/${currentSkillVideoId}" target="_blank" rel="noopener noreferrer" class="btn-drill-nav" id="hsk-yt-link" title="Open drill in YouTube">
                <span class="nav-sym">${ico("external")}</span>
                <span>YouTube ↗</span>
              </a>
            </div>

            <!-- Custom YouTube URL Input (Hidden on mobile) -->
            <div class="hsk-custom-input-bar">
              <input type="text" id="input-custom-yt" placeholder="Paste any YouTube Video / Short URL (e.g. https://youtube.com/shorts/...)" class="hsk-yt-input">
              <button type="button" class="pri" id="btn-play-custom-yt">Direct Play ▶</button>
            </div>
            <span class="mute" id="hsk-custom-err" style="font-size:0.75rem;margin-top:2px;">Tip: Paste any hockey tutorial URL from YouTube to play it directly inside this player.</span>
          </div>
        </div>

        <!-- Drill Video Folders Drawer & Mobile-Optimized Library -->
        <details class="hsk-folders-drawer" id="hsk-folders-drawer" ${isFolderOpen ? "open" : ""}>
          <summary class="hsk-folder-summary">
            <div class="hsk-folder-summary-left">
              <span class="hsk-folder-icon">📁</span>
              <div>
                <b class="hsk-folder-title">Hockey Drill Video Folders</b>
                <span class="mute hsk-folder-sub">${HOCKEY_SKILL_VIDEOS.length} drills organized in 6 skill folders · ${esc(activeCategoryLabel)}</span>
              </div>
            </div>
            <div class="hsk-folder-summary-right">
              <span class="pill pri hsk-folder-pill">📁 Folders (${list.length}) ▾</span>
            </div>
          </summary>

          <div class="hsk-folder-contents">
            <!-- Folder Selection Tabs / Chips -->
            <div class="hsk-filter-strip" role="tablist" aria-label="Drill Video Folders">
              ${renderCategoryChips()}
            </div>

            <!-- Video Cards in Active Folder -->
            <div class="hsk-gallery-grid">
              ${renderDrillCards()}
            </div>
          </div>
        </details>
      </div>
    </div>
  `;
}

function getSkillVideoNavigation(vidId) {
  const curCatList = skillVideoCategory === "all"
    ? HOCKEY_SKILL_VIDEOS
    : HOCKEY_SKILL_VIDEOS.filter((v) => v.category === skillVideoCategory);
  const activeNavList = curCatList.some((v) => v.id === vidId) ? curCatList : HOCKEY_SKILL_VIDEOS;
  let curIdx = activeNavList.findIndex((v) => v.id === vidId);
  if (curIdx === -1) curIdx = HOCKEY_SKILL_VIDEOS.findIndex((v) => v.id === vidId);
  if (curIdx === -1) curIdx = 0;
  const total = activeNavList.length;
  const prevIdx = (curIdx - 1 + total) % total;
  const nextIdx = (curIdx + 1) % total;
  return {
    curIndex: curIdx,
    total: total,
    prevVid: activeNavList[prevIdx],
    nextVid: activeNavList[nextIdx],
  };
}

function updateSkillVideoNavButtons(vidId) {
  const nav = getSkillVideoNavigation(vidId);
  const btnPrev = document.getElementById("hsk-btn-prev");
  const btnNext = document.getElementById("hsk-btn-next");
  const counterEl = document.getElementById("hsk-drill-counter");

  if (btnPrev && nav.prevVid) {
    btnPrev.dataset.targetId = nav.prevVid.id;
    btnPrev.title = `Previous drill: ${nav.prevVid.title}`;
  }
  if (btnNext && nav.nextVid) {
    btnNext.dataset.targetId = nav.nextVid.id;
    btnNext.title = `Next drill: ${nav.nextVid.title}`;
  }
  if (counterEl) {
    counterEl.textContent = `Drill ${nav.curIndex + 1} of ${nav.total}`;
  }
}

function playSkillVideo(vidId, opts = {}) {
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
    iframe.dataset.videoId = vidId;
    const originParam = window.location.origin ? `&origin=${encodeURIComponent(window.location.origin)}` : "";
    iframe.src = `https://www.youtube-nocookie.com/embed/${vidId}?autoplay=1&enablejsapi=1&rel=0&playsinline=1&modestbranding=1${originParam}`;
  }
  const poster = document.getElementById("hsk-poster-cover");
  if (poster) {
    poster.style.opacity = "0";
    poster.style.pointerEvents = "none";
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
      if (listEl.parentElement) listEl.parentElement.style.display = "block";
      listEl.innerHTML = vid.coachingPoints.map((pt) => `<li>${esc(pt)}</li>`).join("");
    } else {
      if (listEl.parentElement) listEl.parentElement.style.display = "none";
    }
  }

  // Update navigation buttons and counter dynamically
  updateSkillVideoNavButtons(vidId);

  // Update active thumbnail card styling
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
  if (opts.scroll && playerContainer && window.innerWidth < 768) {
    playerContainer.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function bindSkillsVideoCard() {
  const fDrawer = document.getElementById("hsk-folders-drawer");
  if (fDrawer) {
    fDrawer.ontoggle = () => {
      window._hskFolderOpen = fDrawer.open;
    };
  }

  document.querySelectorAll("[data-vcat]").forEach((btn) => {
    btn.onclick = () => {
      skillVideoCategory = btn.dataset.vcat;
      window._hskFolderOpen = true; // keep folder open when switching folders
      document.querySelectorAll(".skills-video-container").forEach((el) => {
        el.outerHTML = skillsVideoCard();
      });
      bindSkillsVideoCard();
    };
  });

  // Dedicated previous and next button handlers
  const btnPrev = document.getElementById("hsk-btn-prev");
  if (btnPrev) {
    btnPrev.onclick = (e) => {
      e.preventDefault();
      const targetId = btnPrev.dataset.targetId;
      if (targetId) playSkillVideo(targetId, { scroll: false });
    };
  }

  const btnNext = document.getElementById("hsk-btn-next");
  if (btnNext) {
    btnNext.onclick = (e) => {
      e.preventDefault();
      const targetId = btnNext.dataset.targetId;
      if (targetId) playSkillVideo(targetId, { scroll: false });
    };
  }

  // Thumbnail cards in gallery
  document.querySelectorAll(".hsk-thumb-card[data-play-video]").forEach((card) => {
    card.onclick = (e) => {
      e.preventDefault();
      const vidId = card.dataset.playVideo;
      if (vidId) playSkillVideo(vidId, { scroll: true });
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

    playSkillVideo(parsedId, { scroll: true });
    inputCustom.value = "";
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

  // Smart Viewport Autoplay and Autopause:
  // "Videos play start when videos will come on their screen. i mean dont play videos when someone is not showing video."
  if (window._hskVideoObserver) {
    try { window._hskVideoObserver.disconnect(); } catch (e) {}
    window._hskVideoObserver = null;
  }

  const pWrap = document.getElementById("hsk-player-wrap") || document.querySelector(".hsk-player-wrap");
  const mainIframe = document.getElementById("hsk-main-iframe");
  const posterCover = document.getElementById("hsk-poster-cover");
  const btnStartPlay = document.getElementById("hsk-btn-start-play");

  const activateVideo = (forceUnmute = false) => {
    if (!mainIframe) return;
    const vidId = mainIframe.dataset.videoId || currentSkillVideoId;
    const originParam = window.location.origin ? `&origin=${encodeURIComponent(window.location.origin)}` : "";
    const muteParam = forceUnmute ? "&mute=0" : "&mute=1";
    const embedUrl = `https://www.youtube-nocookie.com/embed/${vidId}?autoplay=1${muteParam}&enablejsapi=1&rel=0&playsinline=1&modestbranding=1${originParam}`;

    if (!mainIframe.src || mainIframe.src === "about:blank" || !mainIframe.src.includes(vidId)) {
      mainIframe.src = embedUrl;
    } else {
      try {
        mainIframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      } catch (e) {}
    }
    if (posterCover) {
      posterCover.style.opacity = "0";
      posterCover.style.pointerEvents = "none";
    }
  };

  const pauseVideo = () => {
    if (!mainIframe || !mainIframe.src || mainIframe.src === "about:blank") return;
    try {
      mainIframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
    } catch (e) {}
  };

  if (btnStartPlay) {
    btnStartPlay.onclick = (e) => {
      e.stopPropagation();
      activateVideo(true);
    };
  }
  if (posterCover) {
    posterCover.onclick = () => activateVideo(true);
  }

  if (pWrap && "IntersectionObserver" in window) {
    window._hskVideoObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
            // Video has scrolled onto screen -> start playback!
            activateVideo(false);
          } else {
            // Video is off-screen / user scrolled away -> stop playback immediately!
            pauseVideo();
          }
        });
      },
      { threshold: [0, 0.35, 0.7] }
    );
    window._hskVideoObserver.observe(pWrap);
  }
}

// =====================================================================================
// 9. INTER IIT SPORTS MEET — COMPLETE TOURNAMENT, LIVE STREAMS & HERITAGE HUB
// =====================================================================================

function renderInterIITPage() {
  return `
    <div class="interiit-hub-page">
      <!-- Unified Compact Header Bar -->
      <div class="interiit-top-bar" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
        <button type="button" class="btn-interiit-back" id="btn-interiit-back" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:10px;background:var(--card);border:1px solid var(--line);font-size:0.84rem;font-weight:700;color:var(--ink);cursor:pointer;">
          ${ico("back")} <span>Back</span>
        </button>
        <span class="pill pri" style="font-size:0.72rem;font-weight:800;letter-spacing:0.04em">59th ANNUAL EDITION</span>
        <span class="pill" style="font-size:0.72rem;font-weight:700;background:var(--soft);color:var(--ink);border:1px solid var(--line)">Dec 15–21, 2026</span>
        <span class="pill" style="font-size:0.72rem;font-weight:700;background:var(--soft);color:var(--ink);border:1px solid var(--line)">EST. 1961</span>
      </div>

      <!-- Compact Championship Hero Card -->
      <div class="card interiit-hero-card" style="margin-bottom:8px;padding:10px 14px;border-radius:12px;background:linear-gradient(135deg, rgba(11,42,74,0.96), rgba(7,26,46,0.98)), radial-gradient(circle at top right, rgba(56,189,248,0.22), transparent 70%);border:1px solid rgba(56,189,248,0.35);color:#fff;box-shadow:0 6px 20px rgba(0,0,0,0.25);position:relative;overflow:hidden;">
        <div style="position:relative;z-index:2">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
            <span class="pill" style="background:rgba(245,158,11,0.2);color:#fbbf24;border:1px solid rgba(245,158,11,0.4);font-weight:800;font-size:0.7rem">🏆 ALL 23 IITs CHAMPIONSHIP</span>
            <span style="font-size:0.74rem;color:rgba(255,255,255,0.75)">General Championship (GC) Trophy</span>
            <a href="https://www.youtube.com/@interiit_sportsmeet/streams" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:7px;background:#ef4444;color:#fff;text-decoration:none;font-size:0.72rem;font-weight:800;">
              <span style="width:6px;height:6px;border-radius:50%;background:#fff;animation:pulse-red 1.2s infinite"></span>
              Live Broadcasts ↗
            </a>
          </div>

          <h1 style="margin:0 0 4px;font-size:clamp(1.2rem, 3.5vw, 1.5rem);font-family:var(--font-display);font-weight:900;letter-spacing:-0.02em;color:#fff;line-height:1.2;">
            59th Inter IIT Sports Meet
          </h1>
          <p style="margin:0 0 10px;font-size:0.84rem;line-height:1.45;color:rgba(255,255,255,0.88);">
            India's oldest and longest-running multi-sport inter-university athletic tournament (Est. 1961), contested annually across all 23 IITs.
          </p>

          <!-- Compact Quick-Links Strip (Desktop Fluid) -->
          <div class="interiit-links-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:10px;">
            <a href="https://www.instagram.com/hockey_iitp/" target="_blank" rel="noopener noreferrer" class="interiit-link-btn ig-iitp" style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;background:linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);color:#fff;text-decoration:none;font-weight:700;box-shadow:0 3px 10px rgba(225,48,108,0.3);">
              <span style="font-size:1rem;flex-shrink:0;">📸</span>
              <div style="overflow:hidden;">
                <div style="font-size:0.78rem;line-height:1.15;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">IIT Patna Hockey</div>
                <div style="font-size:0.65rem;opacity:0.95;font-weight:600;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">@hockey_iitp ↗</div>
              </div>
            </a>
            <a href="https://www.youtube.com/@interiit_sportsmeet/streams" target="_blank" rel="noopener noreferrer" class="interiit-link-btn yt" style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;background:#ef4444;color:#fff;text-decoration:none;font-weight:700;">
              <span style="font-size:1rem;flex-shrink:0;">▶</span>
              <div style="overflow:hidden;">
                <div style="font-size:0.78rem;line-height:1.15;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">YouTube Streams</div>
                <div style="font-size:0.65rem;opacity:0.9;font-weight:500;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">@interiit_sportsmeet ↗</div>
              </div>
            </a>
            <a href="https://www.instagram.com/interiit_sportsmeet/" target="_blank" rel="noopener noreferrer" class="interiit-link-btn ig" style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;background:linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);color:#fff;text-decoration:none;font-weight:700;">
              <span style="font-size:1rem;flex-shrink:0;">📸</span>
              <div style="overflow:hidden;">
                <div style="font-size:0.78rem;line-height:1.15;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">Meet Instagram</div>
                <div style="font-size:0.65rem;opacity:0.9;font-weight:500;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">@interiit_sportsmeet ↗</div>
              </div>
            </a>
            <a href="https://en.wikipedia.org/wiki/Inter_IIT_Sports_Meet" target="_blank" rel="noopener noreferrer" class="interiit-link-btn wiki" style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;background:#1e293b;border:1px solid rgba(255,255,255,0.25);color:#fff;text-decoration:none;font-weight:700;">
              <span style="font-size:1rem;flex-shrink:0;">📖</span>
              <div style="overflow:hidden;">
                <div style="font-size:0.78rem;line-height:1.15;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">Wikipedia Archives</div>
                <div style="font-size:0.65rem;opacity:0.9;font-weight:500;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">History &amp; Records ↗</div>
              </div>
            </a>
          </div>
        </div>
      </div>

      <!-- Men's Hockey Tournament Fixtures Explorer (Student Fixtures) - Front and Center! -->
      <div style="margin-bottom:10px;">
        ${studentFixtureCard({ isHub: true })}
      </div>

      <!-- Participating IITs Showcase -->
      <div class="card interiit-campuses-card" style="padding:18px;border-radius:16px;background:var(--card);border:1px solid var(--line);">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
          <div>
            <h3 style="margin:0 0 4px;font-size:1.1rem;color:var(--ink);">Participating IIT Campuses (Men's Hockey 2026)</h3>
            <p class="mute" style="margin:0;font-size:0.82rem">15 competing contingents drawn into Pools A, B, C, and D</p>
          </div>
          <span class="pill pri" style="font-size:0.75rem;font-weight:800;">Competing Contingents</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:10px;">
          ${[
            ["PAT", "IIT Patna", "Pool A", "#0ea5e9"],
            ["KAN", "IIT Kanpur", "Pool A", "#dc2626"],
            ["MAN", "IIT Mandi", "Pool A", "#7c3aed"],
            ["ROO", "IIT Roorkee", "Pool B", "#16a34a"],
            ["BOM", "IIT Bombay", "Pool B", "#0284c7"],
            ["ROP", "IIT Ropar", "Pool B", "#d97706"],
            ["DHN", "IIT ISM Dhanbad", "Pool B", "#eab308"],
            ["DEL", "IIT Delhi", "Pool C", "#ea580c"],
            ["GUW", "IIT Guwahati", "Pool C", "#059669"],
            ["HYD", "IIT Hyderabad", "Pool C", "#6366f1"],
            ["KGP", "IIT Kharagpur", "Pool C", "#ca8a04"],
            ["MAD", "IIT Madras", "Pool D", "#9333ea"],
            ["BHU", "IIT (BHU) Varanasi", "Pool D", "#b91c1c"],
            ["JOD", "IIT Jodhpur", "Pool D", "#0d9488"],
            ["IND", "IIT Indore", "Pool D", "#2563eb"],
          ].map(([code, name, pool, col]) => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;background:var(--soft);border:1px solid var(--line);transition:transform 0.15s ease;">
              ${renderIitLogo(code, name, 34)}
              <div style="min-width:0;overflow:hidden">
                <b style="display:block;font-size:0.86rem;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;color:var(--ink)">${name}</b>
                <span style="font-size:0.72rem;font-weight:700;color:${col}">${pool}</span>
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- Historical Wikipedia Archives (Compact Collapsible) -->
      <details class="card interiit-history-details" style="margin-top:12px;padding:12px 14px;border-radius:14px;background:var(--card);border:1px solid var(--line);cursor:pointer;">
        <summary style="font-weight:700;font-size:0.88rem;color:var(--ink);display:flex;align-items:center;justify-content:space-between;list-style:none;">
          <span style="display:inline-flex;align-items:center;gap:8px;">
            <span>🏛️</span> <b>Tournament Heritage &amp; General Championship Records (Est. 1961)</b>
          </span>
          <span style="font-size:0.75rem;color:var(--brand);font-weight:700;">Read History ▾</span>
        </summary>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:10px;margin-top:12px;font-size:0.82rem;line-height:1.45;color:var(--ink);cursor:default;">
          <div style="padding:10px 12px;background:var(--soft);border-radius:10px;border:1px solid var(--line)">
            <b style="color:var(--brand);display:block;margin-bottom:3px">Inception &amp; Legacy (Est. 1961)</b>
            Founded in 1961 with the inaugural edition hosted at <b>IIT Bombay</b> (Bombay, Madras, Kharagpur, Kanpur, Delhi). Today, it unites all 23 IIT campuses and thousands of student-athletes in December every year.
          </div>
          <div style="padding:10px 12px;background:var(--soft);border-radius:10px;border:1px solid var(--line)">
            <b style="color:var(--brand);display:block;margin-bottom:3px">The General Championship Trophy</b>
            The coveted <b>GC Trophy</b> is awarded based on cumulative weighted points across sports. Historically, powerhouses like <b>IIT Madras</b> (24+ titles), <b>IIT Bombay</b>, and <b>IIT Kharagpur</b> have led the standings.
          </div>
          <div style="padding:10px 12px;background:var(--soft);border-radius:10px;border:1px solid var(--line)">
            <b style="color:var(--brand);display:block;margin-bottom:3px">Field Hockey's Critical Weight</b>
            Men's Field Hockey is one of the founding marquee team events. Team sports award substantial GC points, making every group clash and knockout encounter fiercely contested.
          </div>
          <div style="padding:10px 12px;background:var(--soft);border-radius:10px;border:1px solid var(--line)">
            <b style="color:var(--brand);display:block;margin-bottom:3px">Host Campus Rotation &amp; Aquatics</b>
            While the main multi-sport meet is hosted every December on rotation by member IITs, the <b>Aquatics Championship</b> (Swimming and Water Polo) is hosted separately in October prior to the main games.
          </div>
        </div>
      </details>
    </div>
  `;
}

function bindInterIITPage() {
  bindStudentFixtureCard();
  const bBack = document.getElementById("btn-interiit-back");
  if (bBack) {
    bBack.onclick = () => {
      if (typeof go === "function") {
        go(typeof prevTab !== "undefined" && prevTab ? prevTab : "me");
      } else if (typeof showSection === "function") {
        showSection("pub-hero");
      }
    };
  }
}

function vInterIIT() {
  const v = document.getElementById("view");
  if (!v) return;
  v.innerHTML = renderInterIITPage();
  bindInterIITPage();
  window.scrollTo(0, 0);
}

function openInterIITModal() {
  const d = (typeof ensureDlg === "function" ? ensureDlg("interiitdlg") : null) || document.getElementById("interiitdlg") || (() => {
    const el = document.createElement("dialog");
    el.id = "interiitdlg";
    document.body.appendChild(el);
    return el;
  })();
  d.className = "full-mobile-lightbox";
  d.setAttribute("aria-label", "Inter IIT Sports Meet Hub");
  d.innerHTML = `
    <div class="lightbox-header">
      <div class="lightbox-title">🏆 59th Inter IIT Sports Meet</div>
      <div class="lightbox-actions">
        <button type="button" class="lightbox-btn close" id="interiit-dlg-close" aria-label="Close">✕</button>
      </div>
    </div>
    <div class="lightbox-content" style="padding:10px 12px;overflow-y:auto;display:block;">
      ${renderInterIITPage()}
    </div>
  `;
  bindInterIITPage();
  const cBtn = d.querySelector("#interiit-dlg-close");
  if (cBtn) cBtn.onclick = () => d.close();
  const bBack = d.querySelector("#btn-interiit-back");
  if (bBack) bBack.onclick = () => d.close();
  if (typeof d.showModal === "function") d.showModal();
}

function showInterIITMeetInfo() {
  if (typeof token !== "undefined" && token && document.getElementById("app") && !document.getElementById("app").hidden) {
    if (typeof go === "function") go("interiit");
  } else {
    openInterIITModal();
  }
}

window.renderInterIITPage = renderInterIITPage;
window.bindInterIITPage = bindInterIITPage;
window.vInterIIT = vInterIIT;
window.openInterIITModal = openInterIITModal;
window.showInterIITMeetInfo = showInterIITMeetInfo;
window.renderSettingsPage = renderSettingsPage;
window.bindSettingsPage = bindSettingsPage;
window.vSettings = vSettings;
window.openSettingsModal = openSettingsModal;




