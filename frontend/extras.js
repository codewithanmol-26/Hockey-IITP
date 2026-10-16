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
  ["thm", "pthm"].forEach((id) => {
    const b = document.getElementById(id);
    if (!b) return;
    b.textContent = dk ? "🌙" : "☀️";
    b.setAttribute(
      "aria-label",
      dk
        ? "Night mode is on. Switch to day mode"
        : "Day mode is on. Switch to night mode",
    );
    b.title = dk ? "Switch to day" : "Switch to night";
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
["thm", "pthm"].forEach((id) => {
  const b = document.getElementById(id);
  if (b)
    b.onclick = () => {
      toggleTheme();
      if (
        !document.getElementById("menu").hidden &&
        typeof drawMenu === "function"
      )
        drawMenu();
    };
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (!themePref()) paintTheme();
});
paintTheme();

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
function annItem(a) {
  const mine = tagMine(a.tags);
  return `<article class="an ${mine ? "mine" : ""} ${a.pinned ? "pin" : ""}">
    <div class="anh">${a.pinned ? '<span class="pill">📌 Pinned</span>' : ""}${mine ? '<span class="pill g">You are tagged</span>' : ""}</div>
    ${a.title ? `<h3>${esc(a.title)}</h3>` : ""}<p class="ant">${esc(a.text)}</p>
    ${tagChips(a.tags)}
    <div class="anm mute">${esc(a.by || "Admin")} · ${annWhen(a.at)}${a.edited ? " · edited" : ""}</div>
    ${admin ? `<div class="chips"><button data-ae="${esc(a.id)}">✏️ Edit</button><button data-ad="${esc(a.id)}">🗑 Delete</button></div>` : ""}
  </article>`;
}
function annCard() {
  const list = ANN.slice().sort(
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
    const body = {
      title: d.querySelector("#ant").value.trim(),
      text,
      tags,
      pinned: d.querySelector("#anp").checked,
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
