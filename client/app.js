/* safety net: if icons.js is stale/missing, don't crash the whole app */
if (typeof eic === "undefined") {
  window.eic = (e) => e;
}
if (typeof ico === "undefined") {
  window.ico = () => "";
}
// Extra UI pieces: avatars, umpire whistle + signal pictures, chart, sharing (any app), reports.
// Loaded before app.js. Everything here is only called after app.js has started, so it can use its globals (P, SS, esc, fmt ...).

// ---------- avatars & photos ----------
const AVC = [
  "#1459d9",
  "#13a05d",
  "#d6409f",
  "#7a5af8",
  "#e08a00",
  "#0f9ea8",
  "#c2410c",
];
function avatar(name, photo, size, cls) {
  size = size || 40;
  const s = String(name || "?").trim(),
    c = AVC[[...s].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVC.length];
  return photo
    ? `<img class="avi ${cls || ""}" src="${photo}" alt="${esc(s)}" width="${size}" height="${size}" loading="lazy" decoding="async" style="width:${size}px;height:${size}px">`
    : `<span class="avi ${cls || ""}" role="img" aria-label="${esc(s)}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px;background:${c}">${esc((s[0] || "?").toUpperCase())}</span>`;
}
function toast(msg) {
  let t = document.getElementById("hk-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "hk-toast";
    t.style.cssText =
      "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.92);color:#fff;padding:10px 18px;border-radius:24px;font-size:0.88rem;font-weight:600;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,0.3);transition:opacity .25s ease;pointer-events:none;backdrop-filter:blur(6px);";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(t._tm);
  t._tm = setTimeout(() => {
    t.style.opacity = "0";
  }, 2800);
}
window.toast = toast;

// choose a photo, centre-crop to a small square and give back a JPEG data URL
function pickPhoto(cb) {
  const f = document.createElement("input");
  f.type = "file";
  f.accept = "image/*";
  f.onchange = async () => {
    const fl = f.files[0];
    if (!fl) return;
    const out = await cropFile(fl, {
      title: "Crop profile photo",
      ars: [["Square", 1]],
      out: 240,
      q: 0.82,
      cap: 55000,
    });
    if (out) cb(out);
  };
  f.click();
}
async function editCurrentPhoto(currentPh, cb) {
  if (currentPh) {
    const out = await cropFile(currentPh, {
      title: "Edit profile photo",
      ars: [["Square", 1]],
      out: 240,
      q: 0.82,
      cap: 55000,
    });
    if (out) cb(out);
  } else {
    pickPhoto(cb);
  }
}

// ---------- umpire whistle (synthesised, no audio files) ----------
let ACX = null;
const volume = () => {
  try {
    const v = localStorage.getItem("hk_vol");
    return v === null ? 0.7 : Math.max(0, Math.min(1, +v || 0));
  } catch (e) {
    return 0.7;
  }
};
const setVol = (v) => {
  try {
    localStorage.setItem("hk_vol", String(Math.max(0, Math.min(1, v))));
  } catch (e) {}
};
function audio() {
  ACX = ACX || new (window.AudioContext || window.webkitAudioContext)();
  if (ACX.state === "suspended") ACX.resume();
  return ACX;
}
// no sound on button taps. playClick is only the timer countdown beep and the volume preview. The whistle is NOT used anywhere except the Rules page.
function playClick() {
  // a soft, glassy "pop": two quiet sine notes with a smooth fade
  if (!volume()) return;
  try {
    const c = audio(),
      t = c.currentTime,
      v = volume(),
      out = c.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.22 * v, t + 0.008);
    out.gain.exponentialRampToValueAtTime(0.0008, t + 0.16);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;
    out.connect(lp);
    lp.connect(c.destination);
    [
      [880, 1],
      [1318.5, 0.45],
    ].forEach(([f, a]) => {
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.02, t + 0.05);
      g.gain.value = a;
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + 0.18);
    });
  } catch (e) {}
}
function playWhistle(kind) {
  const vol = volume();
  if (!vol) return;
  try {
    const c = audio(),
      pk = 0.46 * vol;
    const pat = {
        short: [[0, 0.3]],
        long: [[0, 1]],
        double: [
          [0, 0.24],
          [0.36, 0.24],
        ],
        final: [
          [0, 0.24],
          [0.36, 0.24],
          [0.72, 0.9],
        ],
      }[kind || "short"],
      t0 = c.currentTime + 0.02;
    pat.forEach(([s, d]) => {
      const o = c.createOscillator(),
        o2 = c.createOscillator(),
        l = c.createOscillator(),
        lg = c.createGain(),
        g = c.createGain();
      o.frequency.value = 2850;
      o2.frequency.value = 3130;
      l.frequency.value = 36;
      lg.gain.value = 170; // the "pea" trill
      l.connect(lg);
      lg.connect(o.frequency);
      lg.connect(o2.frequency);
      g.gain.setValueAtTime(0, t0 + s);
      g.gain.linearRampToValueAtTime(pk, t0 + s + 0.03);
      g.gain.setValueAtTime(pk, t0 + s + d - 0.06);
      g.gain.linearRampToValueAtTime(0, t0 + s + d);
      o.connect(g);
      o2.connect(g);
      g.connect(c.destination);
      [o, o2, l].forEach((x) => {
        x.start(t0 + s);
        x.stop(t0 + s + d + 0.05);
      });
    });
  } catch (e) {}
}
function bindVol(id, out, preview) {
  const e = document.getElementById(id);
  if (!e) return;
  e.oninput = () => {
    setVol(e.value / 100);
    document.getElementById(out).textContent = e.value + "%";
  };
  e.onchange = preview;
}
function whistleSvg(sz) {
  return `<svg class="whs" width="${sz || 28}" height="${sz || 28}" viewBox="0 0 64 64" aria-hidden="true"><path d="M12 14c0-5 8-5 8 0v8" fill="none" stroke="#9aa7b4" stroke-width="3" stroke-linecap="round"/>
  <rect x="31" y="22" width="30" height="14" rx="4" fill="#f5b50a"/><rect x="31" y="22" width="30" height="5" rx="2.5" fill="#ffd45c"/>
  <circle cx="26" cy="40" r="17" fill="#f5b50a"/><circle cx="26" cy="40" r="17" fill="none" stroke="#c98d00" stroke-width="2"/>
  <circle cx="26" cy="40" r="9" fill="#fff3c9" stroke="#c98d00" stroke-width="2"/><circle cx="26" cy="40" r="4" fill="#e5484d"/>
  <rect x="34" y="23" width="10" height="3" rx="1.5" fill="#7a5500" opacity=".55"/></svg>`;
}

// ---------- umpire signal pictures (drawn by the app: a simple umpire figure per signal) ----------
// arm = [upper-arm angle, fore-arm angle] in degrees: 0 = hanging down, 90 = sideways, 180 = straight up, negative = across the body
const POSE = [
  [/^start time/i, { R: [180, 180], L: [8, 2] }],
  [/^stop time/i, { L: [150, 205], R: [150, 205] }],
  [/^two minutes/i, { L: [150, 175], R: [150, 175], t: "2" }],
  [/^one minute/i, { R: [160, 175], L: [8, 2], t: "1" }],
  [/^bully/i, { L: [40, 125], R: [35, 50] }],
  [/^goal$/i, { L: [90, 92], R: [90, 92], t: "🥅" }],
  [/back-line by attacker/i, { L: [90, 90], R: [90, 90], t: "ATT" }],
  [/back-line by defender/i, { R: [55, 55], L: [8, 2], t: "DEF" }],
  [/side-line/i, { R: [90, 90], L: [8, 2] }],
  [/^dangerous/i, { R: [20, -115], L: [8, 2] }],
  [/^misconduct/i, { L: [70, 82], R: [70, 82] }],
  [/^kick/i, { R: [25, 10], L: [8, 2], leg: 1 }],
  [/^raised ball/i, { L: [15, -55], R: [15, -55] }],
  [/third party/i, { L: [10, -100], R: [10, -100], t: "↔" }],
  [/stick obstruction/i, { R: [50, 50], L: [15, -85] }],
  [/^obstruction/i, { L: [10, -100], R: [10, -100] }],
  [/^5 metres/i, { R: [180, 180], L: [8, 2], t: "5 m" }],
  [/^advantage/i, { R: [140, 140], L: [8, 2], t: "➜" }],
  [/^free hit$/i, { R: [90, 90], L: [8, 2], t: "🏑" }],
  [/^penalty corner$/i, { L: [90, 90], R: [90, 90], t: "🚩" }],
  [/^penalty stroke$/i, { R: [40, 40], L: [180, 180], t: "🎯" }],
];
const CARDS = [
  [/^green card/i, "#1fa75a"],
  [/^yellow card/i, "#f5c400"],
  [/^red card/i, "#e5484d"],
];
function sigSvg(h) {
  const cd = CARDS.find((x) => x[0].test(h));
  if (cd)
    return `<svg class="sigsvg" viewBox="0 0 64 80" role="img" aria-label="${esc(h)}"><rect x="19" y="14" width="28" height="42" rx="4" fill="${cd[1]}" transform="rotate(8 33 35)" stroke="#0003"/><rect x="21" y="16" width="6" height="38" rx="3" fill="#fff" opacity=".22" transform="rotate(8 33 35)"/></svg>`;
  const po = POSE.find((x) => x[0].test(h));
  if (!po) return "";
  const p = po[1];
  const sx = 22,
    sy = 27,
    L1 = 17,
    L2 = 15,
    sk = "#f1c7a0",
    sh = "var(--brand)";
  const arm = (side, a) => {
    const x = side === 1 ? 42 : sx,
      rad = (d) => (d * Math.PI) / 180,
      ex = x + side * L1 * Math.sin(rad(a[0])),
      ey = sy + L1 * Math.cos(rad(a[0])),
      hx = ex + side * L2 * Math.sin(rad(a[1])),
      hy = ey + L2 * Math.cos(rad(a[1]));
    return `<path d="M${x} ${sy}L${ex.toFixed(1)} ${ey.toFixed(1)}L${hx.toFixed(1)} ${hy.toFixed(1)}" fill="none" stroke="${sh}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="3.6" fill="${sk}"/>`;
  };
  const leg = p.leg
    ? `<path d="M38 50L52 62L56 74" fill="none" stroke="#1d2b3c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="M38 50L40 76" stroke="#1d2b3c" stroke-width="7" stroke-linecap="round"/>`;
  const bt = p.t
    ? `<text x="8" y="76" font-size="${p.t.length > 2 ? 9 : 12}" font-weight="700" style="fill:var(--ink)">${p.t}</text>`
    : "";
  return `<svg class="sigsvg" viewBox="0 0 64 80" role="img" aria-label="${esc(h)}"><path d="M26 50L24 76" stroke="#1d2b3c" stroke-width="7" stroke-linecap="round"/>${leg}
  <rect x="22" y="22" width="20" height="30" rx="8" fill="${sh}"/>${arm(-1, p.L)}${arm(1, p.R)}
  <circle cx="32" cy="12" r="8.5" fill="${sk}"/><path d="M23.5 11a8.5 8.5 0 0117 0z" fill="#1d2b3c"/><circle cx="29" cy="13" r="1" fill="#1d2b3c"/><circle cx="35" cy="13" r="1" fill="#1d2b3c"/>
  <rect x="34.5" y="15.2" width="6.5" height="3.2" rx="1.4" fill="#f5b50a"/><circle cx="36" cy="16.8" r="1.5" fill="#c98d00"/>${bt}</svg>`;
}
const SIGSEC = /^Umpire signals|^Personal penalties/;

// ---------- chart: smooth area, hover read-out, average line, best / lowest labels ----------
const CH = {};
function chartInto(id, pts, o) {
  CH[id] = { pts, o: o || {} };
  drawChart(id);
}
function drawChart(id) {
  const el = $(id),
    c = CH[id];
  if (!el || !c) return;
  const pts = c.pts;
  if (!pts.length) {
    el.innerHTML = "";
    return;
  }
  const W = Math.max(260, el.clientWidth || 320),
    H = 230,
    L = 38,
    R = 14,
    T = 16,
    B = 28,
    iw = W - L - R,
    ih = H - T - B;
  const x = (i) => L + (pts.length > 1 ? (i * iw) / (pts.length - 1) : iw / 2),
    y = (v) => T + ih * (1 - Math.max(0, Math.min(100, v)) / 100);
  const avg = pts.reduce((a, p) => a + p.pct, 0) / pts.length;
  const xy = pts.map((p, i) => [x(i), y(p.pct)]);
  // smooth curve (monotone-ish Catmull-Rom with the control points clamped so it never overshoots the data)
  let d = "M" + xy[0][0] + " " + xy[0][1];
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[i - 1] || xy[i],
      p1 = xy[i],
      p2 = xy[i + 1],
      p3 = xy[i + 2] || p2,
      t = 0.18;
    const c1 = [
        p1[0] + (p2[0] - p0[0]) * t,
        Math.max(T, Math.min(T + ih, p1[1] + (p2[1] - p0[1]) * t)),
      ],
      c2 = [
        p2[0] - (p3[0] - p1[0]) * t,
        Math.max(T, Math.min(T + ih, p2[1] - (p3[1] - p1[1]) * t)),
      ];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  const area = d + `L${xy[xy.length - 1][0]} ${T + ih}L${xy[0][0]} ${T + ih}Z`;
  const mx = pts.reduce((a, p, i) => (p.pct > pts[a].pct ? i : a), 0),
    mn = pts.reduce((a, p, i) => (p.pct < pts[a].pct ? i : a), 0),
    step = Math.ceil(pts.length / Math.max(2, Math.floor(iw / 54)));
  const lab = (i, cl, dy) =>
    `<text x="${xy[i][0]}" y="${xy[i][1] + dy}" text-anchor="${i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}" class="cl ${cl}">${Math.round(pts[i].pct)}%</text>`;
  const gid = "g" + id;
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="chs" role="img" aria-label="${esc(c.o.title || "Attendance chart")}">
  <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--brand)" stop-opacity=".32"/><stop offset="1" stop-color="var(--brand)" stop-opacity="0"/></linearGradient></defs>
  ${[0, 25, 50, 75, 100].map((g) => `<line x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}" class="gl${g === 0 ? " base" : ""}"/><text x="${L - 6}" y="${y(g) + 4}" text-anchor="end">${g}</text>`).join("")}
  <line x1="${L}" x2="${W - R}" y1="${y(avg)}" y2="${y(avg)}" class="avg"/><text x="${W - R}" y="${y(avg) - 5}" text-anchor="end" class="avgt">avg ${Math.round(avg)}%</text>
  <path d="${area}" fill="url(#${gid})"/><path d="${d}" class="ln" pathLength="1"/>
  ${pts.length <= 36 ? xy.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.6" class="dt"/>`).join("") : ""}
  ${pts.length > 1 ? lab(mx, "hi", -9) + (mn !== mx ? lab(mn, "lo", 17) : "") : ""}
  ${pts.map((p, i) => (i % step === 0 || i === pts.length - 1 ? `<text x="${x(i)}" y="${H - 8}" text-anchor="${i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}">${esc(p.l)}</text>` : "")).join("")}
  <line class="xh" y1="${T}" y2="${T + ih}" x1="0" x2="0" hidden/><circle class="hd" r="6" hidden/>
  <rect x="${L - 6}" y="${T}" width="${iw + 12}" height="${ih + 6}" fill="transparent" class="hit"/></svg><div class="tip" hidden></div>`;
  const svg = el.firstChild,
    tip = el.lastChild,
    xh = svg.querySelector(".xh"),
    hd = svg.querySelector(".hd");
  const move = (e) => {
    const r = svg.getBoundingClientRect(),
      px = (e.clientX - r.left) * (W / r.width);
    let i = Math.round((px - L) / (iw / Math.max(1, pts.length - 1)));
    i = Math.max(0, Math.min(pts.length - 1, i));
    xh.setAttribute("x1", xy[i][0]);
    xh.setAttribute("x2", xy[i][0]);
    hd.setAttribute("cx", xy[i][0]);
    hd.setAttribute("cy", xy[i][1]);
    xh.hidden = hd.hidden = false;
    tip.innerHTML = `<b>${esc(pts[i].tip)}</b>`;
    tip.hidden = false;
    const tw = tip.offsetWidth,
      left = Math.max(0, Math.min(W - tw, xy[i][0] * (r.width / W) - tw / 2));
    tip.style.left = left + "px";
    tip.style.top = Math.max(0, xy[i][1] * (r.height / H) - 44) + "px";
  };
  const hide = () => {
    xh.hidden = hd.hidden = tip.hidden = true;
  };
  const hit = svg.querySelector(".hit");
  hit.addEventListener("pointermove", move);
  hit.addEventListener("pointerdown", move);
  hit.addEventListener("pointerleave", hide);
}
let _rz;
window.addEventListener("resize", () => {
  clearTimeout(_rz);
  _rz = setTimeout(() => Object.keys(CH).forEach(drawChart), 120);
});

// ---------- sharing: any app (system share sheet), with a fallback list of common apps ----------
const to91 = (p) => {
  const n = String(p || "").replace(/\D/g, "");
  return n.length === 10 ? "91" + n : n;
};
function shareLinks(text, title, phone) {
  const t = encodeURIComponent(text),
    ph = to91(phone);
  return [
    ["💬", "WhatsApp", "https://wa.me/?text=" + t],
    ...(ph
      ? [["📲", "WhatsApp to " + phone, "https://wa.me/" + ph + "?text=" + t]]
      : []),
    ["✈️", "Telegram", "https://t.me/share/url?url=%20&text=" + t],
    [
      "✉️",
      "Email",
      "mailto:?subject=" +
        encodeURIComponent(title || "IITP Hockey") +
        "&body=" +
        t,
    ],
    [
      "📱",
      "SMS (text message)",
      "sms:" +
        (phone ? String(phone).replace(/[^0-9+]/g, "") : "") +
        "?&body=" +
        t,
    ],
  ];
}
function shareDlg() {
  let d = $("shdlg");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "shdlg";
    document.body.appendChild(d);
  }
  return d;
}
async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch (e) {
    const a = document.createElement("textarea");
    a.value = t;
    document.body.appendChild(a);
    a.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (x) {}
    a.remove();
    return ok;
  }
}
// body of a share dialog: editable text + native share + other apps + copy
function shareBody(d, text, title, phone, head) {
  d.innerHTML = `${head || `<h2>Share</h2>`}<p><textarea id="shx" rows="9"></textarea></p><div class="shl" id="shl"></div><div class="ctl"><button class="pri" id="shn" ${navigator.share ? "" : "hidden"}>⤴ Share to any app…</button><button id="shc">📋 Copy</button><button id="shz">Close</button></div><p id="shm" class="mute" role="status"></p>`;
  $("shx").value = text;
  const cur = () => $("shx").value;
  const draw = () => {
    $("shl").innerHTML = shareLinks(cur(), title, phone)
      .map(
        (l, i) =>
          `<a class="shb" href="${l[2]}" target="_blank" rel="noopener"><span>${l[0]}</span>${esc(l[1])}</a>`,
      )
      .join("");
  };
  draw();
  $("shx").oninput = draw;
  $("shn").onclick = async () => {
    try {
      await navigator.share({ title: title || "IITP Hockey", text: cur() });
    } catch (e) {}
  };
  $("shc").onclick = async () => {
    $("shm").textContent = (await copyText(cur()))
      ? "Copied. Paste it in any app."
      : "Could not copy. Select the text and copy it.";
  };
  $("shz").onclick = () => d.close();
}
async function shareText(text, title, phone) {
  if (navigator.share) {
    try {
      await navigator.share({ title: title || "IITP Hockey", text });
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
  }
  const d = shareDlg();
  shareBody(d, text, title, phone);
  d.showModal();
}
function appShareText() {
  return (
    "🏑 *IITP Hockey: Attendance app*\nSchedule, attendance and rules for the team.\nOpen: " +
    location.origin +
    location.pathname.replace(/index\.html$/, "") +
    '\nLog in with your roll number. Tip: tap "Install app" or "Add to Home Screen" to use it like an app.'
  );
}
const shareApp = () => shareText(appShareText(), "IITP Hockey app");

// ---------- attendance reports: whole team, a month, a date or one person -> any app ----------
const pbar = (p) =>
  "▓".repeat(Math.round(p / 10)) + "░".repeat(10 - Math.round(p / 10));
function reportText(sc, v) {
  const td = dlong(today());
  if (sc === "date") return attMsg(v);
  if (sc === "person") {
    const pl = [...P, ...RM].find((x) => x.id === v);
    if (!pl) return "";
    const a = statsFor(pl, "all");
    const ms = months()
      .map((m) => {
        const s = statsFor(pl, m);
        return s.t ? `• ${mfmt(m)}: ${s.pr}/${s.t} (${s.pct}%)` : "";
      })
      .filter(Boolean);
    const rec = dates()
      .reverse()
      .filter((d) => SS[d][v] !== undefined)
      .slice(0, 12)
      .map((d) => `${SS[d][v] ? "✅" : "❌"} ${dlong(d)}`);
    return `🏑 *IITP Hockey: Attendance of ${pl.name}*\n${pl.roll ? "Roll no: " + pl.roll + "\n" : ""}📅 Till ${td}\n\n*Overall: ${a.pr}/${a.t} sessions (${a.pct}%)*\n${pbar(a.pct)}\n\n*Month by month*\n${ms.join("\n") || "-"}\n\n*Recent days*\n${rec.join("\n") || "-"}`;
  }
  const m = sc === "month" ? v : "all",
    st = stats(m)
      .filter((x) => x.t)
      .sort((a, b) => b.pct - a.pct || b.pr - a.pr),
    tp = st.reduce((a, x) => a + x.t, 0),
    tr = tp ? Math.round((st.reduce((a, x) => a + x.pr, 0) * 100) / tp) : 0;
  const live = dates().filter((d) => m === "all" || d.startsWith(m));
  const dl =
    m === "all"
      ? ""
      : "\n\n*Day by day*\n" +
        live
          .map((d) => {
            const q = P.filter((p) => SS[d][p.id] !== undefined),
              pr = q.filter((p) => SS[d][p.id]).length;
            return `${fmt(d)}: ${pr}/${q.length} present`;
          })
          .join("\n");
  const medal = ["🥇", "🥈", "🥉"];
  return (
    `🏑 *IITP Hockey: Attendance report*\n📅 ${m === "all" ? "Overall, till " + td : mfmt(m)}\n🏑 Total Sessions: ${rsess(m)}\n📈 Team turnout: ${tr}%\n\n` +
    st
      .map(
        (x, i) =>
          `${medal[i] || i + 1 + "."} ${x.p.name} ${x.pr}/${x.t} (${x.pct}%) ${pbar(x.pct)}`,
      )
      .join("\n") +
    dl
  );
}
// Percentage = sessions present / TOTAL SESSIONS. The total is the same for every player: a session the player
// missed, or has no mark for, counts as absent. Present sessions never exceed the total.
function statsFor(p, m) {
  const t = rsess(m);
  let pr = 0;
  for (const k in L) if (m === "all" || k === m) pr += L[k].att[p.id] || 0;
  for (const d in SS) if ((m === "all" || d.startsWith(m)) && SS[d][p.id]) pr++;
  pr = Math.min(pr, t);
  return { p, pr, t, pct: t ? Math.round((pr * 100) / t) : 0 };
}
function openReport(pre) {
  const d = shareDlg(),
    adm = admin;
  const scopes = adm
    ? [
        ["team", "Whole team, overall"],
        ["month", "A month"],
        ["date", "A playing day"],
        ["person", "One person"],
      ]
    : [["person", "My attendance"]];
  const head = `<h2>Share attendance report</h2><div class="ctl"><label class="fl" style="flex:1;margin:0">What to send<select id="rsc">${scopes.map((s) => `<option value="${s[0]}">${s[1]}</option>`).join("")}</select></label><label class="fl" id="rvw" style="flex:1;margin:0"><span id="rvl"></span><select id="rv"></select></label></div>`;
  shareBody(d, "", "Attendance report", "", head);
  let phn = "";
  const links = () => {
    $("shl").innerHTML = shareLinks($("shx").value, "Attendance report", phn)
      .map(
        (l) =>
          `<a class="shb" href="${l[2]}" target="_blank" rel="noopener"><span>${l[0]}</span>${esc(l[1])}</a>`,
      )
      .join("");
  };
  const upd = () => {
    const sc = $("rsc").value,
      v = $("rv").value,
      pl = sc === "person" ? P.find((p) => p.id === v) : null;
    phn = "";
    $("shx").value = reportText(sc, v);
    links();
  };
  const fill = () => {
    const sc = $("rsc").value,
      rv = $("rv");
    $("rvw").hidden = sc === "team";
    if (sc === "month") {
      $("rvl").textContent = "Month";
      rv.innerHTML = months()
        .slice()
        .reverse()
        .map((m) => `<option value="${m}">${mfmt(m)}</option>`)
        .join("");
    } else if (sc === "date") {
      $("rvl").textContent = "Date";
      rv.innerHTML = dates()
        .slice()
        .reverse()
        .map((x) => `<option value="${x}">${dlong(x)}</option>`)
        .join("");
    } else if (sc === "person") {
      $("rvl").textContent = "Person";
      rv.innerHTML = (adm ? P : P.filter((p) => p.id === me))
        .map(
          (p) =>
            `<option value="${p.id}">${esc(p.name)}${p.roll ? " · " + esc(p.roll) : ""}</option>`,
        )
        .join("");
    }
    if (pre && pre.sc === sc && pre.v) rv.value = pre.v;
    upd();
  };
  if (pre && scopes.some((s) => s[0] === pre.sc)) $("rsc").value = pre.sc;
  $("rsc").onchange = fill;
  $("rv").onchange = upd;
  $("shx").oninput = links;
  fill();
  d.showModal();
}

const API = (window.API_URL || "").replace(/\/$/, "");
let token = "";
try {
  token = localStorage.getItem("hk_token") || "";
} catch (e) {}
const netWait = (ms) => new Promise((r) => setTimeout(r, ms));
// Every request has a time limit and (when safe) retries by itself, so a slow connection never leaves the app hanging.
async function api(path, o = {}) {
  const m = o.method || "GET";
  if (m !== "GET") window.__wrote = Date.now(); // after a save, the next data load skips the server's 10 second cache
  const body = o.body ? JSON.stringify(o.body) : undefined;
  const tmo = o.timeout || (body && body.length > 200000 ? 90000 : 25000);
  const tries = m === "GET" ? 3 : m === "POST" ? 1 : 2; // POST is never repeated, it could be saved twice
  let last;
  for (let i = 0; i < tries; i++) {
    const ac = new AbortController(),
      tm = setTimeout(() => ac.abort(), tmo);
    try {
      const r = await fetch(API + path, {
        method: m,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body,
        signal: ac.signal,
      });
      const j = await r.json().catch(() => ({}));
      clearTimeout(tm);
      if (!r.ok) {
        const e = new Error(j.error || "Error " + r.status);
        e.status = r.status;
        if ([502, 503, 504].includes(r.status) && i < tries - 1) {
          last = e;
          await netWait(1200 * (i + 1));
          continue;
        }
        throw e;
      }
      return j;
    } catch (e) {
      clearTimeout(tm);
      if (e.status) throw e;
      last = new Error(
        e.name === "AbortError"
          ? "The connection is too slow. Please try again."
          : "No internet connection. Please try again.",
      );
      last.network = true;
      if (i < tries - 1) {
        await netWait(1200 * (i + 1));
        continue;
      }
      throw last;
    }
  }
  throw last;
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
const dateBase = (d) => String(d || "").slice(0, 10);
const sessionNum = (d) => {
  const str = String(d || "");
  if (str.length <= 10) return 1;
  const suffix = str.slice(10);
  const m = suffix.match(/^[_-](\d+)/);
  return m ? parseInt(m[1], 10) : 1;
};
const sessionLabel = (d) => "Session " + sessionNum(d);
const sessionsForDate = (b) => {
  const base = dateBase(b);
  const keys =
    typeof SS !== "undefined" && SS
      ? Object.keys(SS).filter(
          (k) =>
            k === base ||
            (k.startsWith(base) &&
              k.length > 10 &&
              /^[_-]\d+/.test(k.slice(10))),
        )
      : [];
  keys.sort((x, y) => sessionNum(x) - sessionNum(y));
  return keys;
};
const sessionGlobalIndex = (d) => {
  const ds = dates();
  const idx = ds.indexOf(d);
  if (idx === -1) return null;
  const legacyOffset =
    typeof L !== "undefined" && L
      ? Object.keys(L).reduce((a, k) => a + (L[k].days || 0), 0)
      : 0;
  return idx + 1 + legacyOffset;
};
const fmt = (d) => {
  const base = dateBase(d);
  const num = sessionNum(d);
  const multi =
    typeof SS !== "undefined" && SS && sessionsForDate(base).length > 1;
  const sfx = multi || num > 1 ? ` (Session ${num})` : "";
  const dt = new Date(base + "T00:00");
  return (
    (isNaN(dt.getTime())
      ? d
      : dt.toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })) + sfx
  );
};
const fmtDateOnly = (d) => {
  const base = dateBase(d);
  const dt = new Date(base + "T00:00");
  return isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};
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
// Sessions = every saved attendance record (a second session on the same day counts again).
// Playing days = different calendar dates only, so 82 playing days can hold 83 sessions.
const inMonth = (m) => (d) => m === "all" || d.startsWith(m);
const rsess = (m) =>
  (m === "all"
    ? Object.keys(L).reduce((a, k) => a + L[k].days, 0)
    : L[m]
      ? L[m].days
      : 0) + dates().filter(inMonth(m)).length;
const rdays = (m) =>
  (m === "all"
    ? Object.keys(L).reduce((a, k) => a + L[k].days, 0)
    : L[m]
      ? L[m].days
      : 0) +
  new Set(
    dates()
      .filter(inMonth(m))
      .map((d) => dateBase(d)),
  ).size;
async function run(fn) {
  try {
    await fn();
  } catch (e) {
    if (e.status === 401) {
      alert("Your login expired or was switched off. Please log in again.");
      load(true);
    } else
      alert(
        e.network
          ? "Not saved: " +
              e.message +
              " Your screen is unchanged, so press the button again when the connection is better."
          : "Could not save: " + e.message,
      );
  }
}

function stats(m) {
  return P.map((p) => statsFor(p, m));
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
  ["leaderboard", "🏆", "Leaderboard", "", "Leaderboard"],
  ["take", "✅", "Take attendance", "a", "Take"],
  ["plan", "📅", "Playing days", "", "Days"],
  ["stats", "📊", "Attendance", "", "Stats"],
  ["schedule", "⏰", "Schedule", "", "Schedule"],
  ["rules", "📖", "Rules", "", ""],
  ["warmup", "🔥", "Warm-up", "", ""],
  ["gallery", "🖼️", "Gallery", "", ""],
  ["train", "⌚", "Training & health", "", ""],
  ["players", "👥", "Players", "a", ""],
  ["removed", "🗑️", "Removed students", "a", ""],
  ["admins", "🛡️", "Admins", "o", ""],
  ["helpbox", "💬", "Help messages", "a", ""],
];
const PRIMARY = ["me", "leaderboard", "take", "plan", "stats", "schedule"];
const tabsFor = () =>
  TABS.filter(
    (t) => !t[3] || (t[3] === "a" && admin) || (t[3] === "o" && owner),
  );
const go = (t) => {
  tab = t;
  prof = null;
  if (t === "gallery") {
    galLoaded = false;
    galErr = "";
  }
  if (t === "train") {
    wkLoaded = false;
    wkErr = "";
  }
  if (t === "bugs") {
    bgLoaded = false;
    bgErr = "";
  }
  render();
  window.scrollTo(0, 0);
};
const empty = (e, t) =>
  `<div class="empty"><span class="e">${e}</span>${t}</div>`;

// ---- screens: public page by default, login popup on demand, then the app ----
function showLogin() {
  const appEl = $("app");
  if (appEl) {
    appEl.hidden = true;
    appEl.style.setProperty("display", "none", "important");
  }
  const pubEl = $("pub");
  if (pubEl) {
    pubEl.hidden = false;
    pubEl.style.display = "";
  }
  const lgEl = $("login");
  if (lgEl) {
    lgEl.hidden = false;
    lgEl.style.display = "grid";
  }
  const m = $("menu");
  if (m) m.hidden = true;
  const pd = $("pub-drawer");
  if (pd) pd.hidden = true;

  $("pr").value = "";
  $("pa").innerHTML = "";
  $("pgo").hidden = false;
  $("pe").textContent = "";
  $("er").textContent = "";
  $("pw").value = "";
  $("an").value = "";
  pStep = "roll";
  loginTab("player");
  document.title = "IIT Patna Hockey · Member Login";
  syncInstall();
  setTimeout(() => {
    const pr = $("pr");
    if (pr && !$("pf").hidden) pr.focus();
  }, 100);
}

function closeLogin() {
  const lgEl = $("login");
  if (lgEl) {
    lgEl.hidden = true;
    lgEl.style.display = "none";
  }
  if (!token) {
    showPublic();
  }
}

function showApp() {
  const lgEl = $("login");
  if (lgEl) {
    lgEl.hidden = true;
    lgEl.style.display = "none";
  }
  const pubEl = $("pub");
  if (pubEl) pubEl.hidden = true;
  const appEl = $("app");
  if (appEl) {
    appEl.hidden = false;
    appEl.style.display = ""; // Clear inline override so CSS flex handles layout
  }
  document.title = "IITP Hockey Attendance";
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
  pushDrop(token);
  token = "";
  cacheDrop();
  setNet("");
  try {
    localStorage.removeItem("hk_token");
    localStorage.removeItem(CK);
    sessionStorage.clear();
  } catch (e) {}
  loaded = false;
  lastJs = "";
  pushChecked = false;
  WK = [];
  HL = [];
  hlLoaded = false;
  wkLoaded = false;
  wkErr = "";
  BG = [];
  bgLoaded = false;
  admin = false;
  pl = false;
  owner = false;
  me = "";
  WHO = "";
  tab = "me";
  prof = null;
  MYPH = "";
  MYPID = "";
  P = [];
  RM = [];
  SS = {};
  L = {};
  PL = {};
  AVL = {};
  ANN = [];
  annAll = false;
  lbData = null;

  // Close all open dialogs & menus
  document.querySelectorAll("dialog[open]").forEach((d) => {
    try {
      d.close();
    } catch (x) {}
  });
  const m = $("menu");
  if (m) m.hidden = true;
  const pd = $("pub-drawer");
  if (pd) pd.hidden = true;

  // Clear sidebar & main view DOM
  const sb = $("sidebar");
  if (sb) sb.innerHTML = "";
  const v = $("view");
  if (v) v.innerHTML = "";

  // Guaranteed hide of app
  const appEl = $("app");
  if (appEl) {
    appEl.hidden = true;
    appEl.style.setProperty("display", "none", "important");
  }
  const lgEl = $("login");
  if (lgEl) {
    lgEl.hidden = true;
    lgEl.style.display = "none";
  }

  showPublic();
  window.scrollTo(0, 0);
}
function boot() {
  pushAuto();
  if (!token) return showPublic();
  const c = cacheLoad();
  if (c) {
    useData(c, true);
    setNet("📡 Showing saved data. Updating…");
  }
  showApp();
  render();
  load(true);
}

// ---- the last good copy of the data is kept on the phone, so a slow or dead connection never empties the screen ----
const CK = "hk_cache";
function cacheSave(d) {
  try {
    const t = JSON.stringify({ k: token.slice(-20), d });
    if (t.length < 4500000) localStorage.setItem(CK, t);
    else localStorage.removeItem(CK);
  } catch (e) {
    try {
      localStorage.removeItem(CK);
    } catch (x) {}
  }
}
function cacheLoad() {
  try {
    const c = JSON.parse(localStorage.getItem(CK) || "null");
    return c && c.k === token.slice(-20) && c.d && c.d.role ? c.d : null;
  } catch (e) {
    return null;
  }
}
function cacheDrop() {
  try {
    localStorage.removeItem(CK);
  } catch (e) {}
}
function setNet(msg) {
  const n = $("net");
  if (!n) return;
  if (!msg) {
    n.hidden = true;
    return;
  }
  $("netm").textContent = msg;
  n.hidden = false;
}
let retryT = 0;
function useData(d, force) {
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
  SCH = normSch(d.schedule);
  ANN = Array.isArray(d.announcements) ? d.announcements : [];
  GROUP = d.group || window.WA_GROUP || "";
  MATCHES = Array.isArray(d.matches) ? d.matches : null;
  if ((d.groupPhotoAt || 0) !== GPH.at) fetchGph(d.groupPhotoAt || 0);
  STAFF = d.staff || {};
  NAMES = d.names || {};
  ADMID = d.adminId || "";
  MYPH = pl ? (all[0] || {}).photo || "" : d.myPhoto || "";
  MYPID = d.myPlayerId || "";
  TEAM = d.team || TEAM;
  {
    const lp = MYPID && !pl ? all.find((x) => x.id === MYPID) : null;
    if (lp) {
      if (lp.photo) MYPH = lp.photo;
      if (role === "captain" || role === "vice") WHO = lp.name;
    }
  }
  loaded = true;
  err = "";
  showApp();
  render();
  checkAlerts();
  if (!pushChecked) {
    pushChecked = true;
    pushAuto();
  }
}

window.getHockeyUserContext = function () {
  if (!token) {
    return { role: "guest", title: "Guest / Visitor", name: "Guest" };
  }
  if (role === "admin") {
    const isInst = !myKind || myKind === "instructor" || !MYPID;
    return {
      role: "admin",
      adminType: isInst ? "instructor" : "player",
      title: isInst ? "Instructor" : "Player (Admin)",
      name: WHO || "Instructor",
      id: ADMID,
      playerId: MYPID,
    };
  }
  if (role === "captain" || role === "vice") {
    return {
      role: role,
      kind: "player",
      title: role === "captain" ? "Captain" : "Vice-Captain",
      name: WHO || (role === "captain" ? "Captain" : "Vice-Captain"),
      playerId: MYPID,
    };
  }
  if (role === "player") {
    const mine = P && P[0] ? P[0] : null;
    return {
      role: "player",
      title: "Player" + (mine && mine.position ? ` · ${mine.position}` : ""),
      name: (mine && mine.name) || WHO || me,
      roll: (mine && (mine.roll || mine.id)) || me,
      position: (mine && mine.position) || "",
      jersey: (mine && mine.jersey) || "",
    };
  }
  return { role: "guest", title: "Guest / Visitor", name: "Guest" };
};
async function load(force) {
  if (!token) return;
  try {
    const d = await api(
      "/api/data" +
        (Date.now() - (window.__wrote || 0) < 30000 ? "?fresh=1" : ""),
    );
    window.__wrote = 0;
    setNet("");
    cacheSave(d);
    useData(d, force);
  } catch (e) {
    if (e.status === 401) {
      token = "";
      cacheDrop();
      try {
        localStorage.removeItem("hk_token");
      } catch (x) {}
      loaded = false;
      lastJs = "";
      setNet("");
      showLogin();
      return;
    }
    if (loaded) {
      // keep showing what we have, just say so
      setNet(
        e.network
          ? "📡 Slow or no connection. Showing your last saved data."
          : "⚠️ Server is busy. Showing your last saved data.",
      );
    } else {
      err = e.status
        ? e.message
        : "Cannot reach the server. Check your connection and try again.";
      showApp();
      render();
    }
    clearTimeout(retryT);
    retryT = setTimeout(() => load(true), 8000); // keeps trying quietly
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
let pStep = "roll",
  pInfo = {},
  pTimer = 0;
const pErr = (x) => {
  $("pe").textContent =
    x.status === 429 && !x.message
      ? "Too many tries. Wait a minute."
      : x.status || x.network
        ? x.message
        : "Cannot reach the server.";
};
function pCount(sec) {
  // "send again" button counts down
  clearInterval(pTimer);
  let n = sec;
  const tick = () => {
    const b = $("presend");
    if (!b) {
      clearInterval(pTimer);
      return;
    }
    b.disabled = n > 0;
    b.textContent =
      n > 0 ? "Send the code again in " + n + "s" : "Send the code again";
    if (n-- <= 0) clearInterval(pTimer);
  };
  tick();
  pTimer = setInterval(tick, 1000);
}
// ---- security types: alphanumeric, numeric PIN or pattern (the pattern is sent as dot numbers, e.g. 0-1-2-5) ----
let pType = "alnum";
const CTYPES = [
  ["alnum", "Alphanumeric"],
  ["numeric", "Numeric"],
  ["pattern", "Pattern"],
];
function codeInput(type, mode) {
  const nw = mode === "new";
  if (type === "pattern")
    return `<div class="fl">${nw ? "Draw a pattern joining at least 4 dots" : "Draw your pattern"}<div class="pat" id="ppad"></div><button type="button" class="ghost2" id="pclr">Clear pattern</button></div><input id="pc" type="hidden">`;
  if (type === "numeric")
    return `<label class="fl">${nw ? "Choose your PIN (4 to 8 digits)" : "Your PIN"}<input id="pc" type="password" inputmode="numeric" pattern="[0-9]{4,8}" minlength="4" maxlength="8" placeholder="${nw ? "4 to 8 digits" : "Your PIN"}" autocomplete="${nw ? "new-password" : "current-password"}" required></label>`;
  return `<label class="fl">${nw ? "Choose your unique code" : "Your code"}<input id="pc" type="password" placeholder="${nw ? "4 or more characters" : "Your unique code"}" maxlength="30" autocomplete="${nw ? "new-password" : "current-password"}" required></label>`;
}
function bindCode(type) {
  if (type === "pattern") {
    patternPad($("ppad"), (v) => {
      $("pc").value = v;
      $("pe").textContent =
        v || !$("ppad").dataset.n ? "" : "Join at least 4 dots. Try again.";
    });
    $("pclr").onclick = () => {
      $("ppad").clear();
      $("pc").value = "";
      $("pe").textContent = "";
    };
  } else if (type === "numeric")
    $("pc").oninput = (e) =>
      (e.target.value = e.target.value.replace(/\D/g, "").slice(0, 8));
}
function patternPad(el, onDone) {
  const C = [16.67, 50, 83.33],
    ctr = (i) => ({ x: C[i % 3], y: C[Math.floor(i / 3)] });
  el.innerHTML =
    '<svg class="pl" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points=""/></svg>' +
    [...Array(9)].map(() => '<i class="pd"></i>').join("");
  const dots = [...el.querySelectorAll(".pd")],
    line = el.querySelector("polyline");
  let seq = [],
    down = false;
  const pt = (e) => {
    const r = el.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    };
  };
  const draw = (p) =>
    line.setAttribute(
      "points",
      seq
        .map(ctr)
        .concat(p ? [p] : [])
        .map((c) => c.x + "," + c.y)
        .join(" "),
    );
  const add = (p) => {
    for (let i = 0; i < 9; i++) {
      const c = ctr(i);
      if (!seq.includes(i) && Math.hypot(p.x - c.x, p.y - c.y) < 14) {
        seq.push(i);
        dots[i].classList.add("on");
        break;
      }
    }
  };
  el.clear = () => {
    seq = [];
    dots.forEach((d) => d.classList.remove("on"));
    draw();
    el.dataset.n = "";
  };
  el.onpointerdown = (e) => {
    e.preventDefault();
    el.clear();
    down = true;
    el.setPointerCapture(e.pointerId);
    const p = pt(e);
    add(p);
    draw(p);
  };
  el.onpointermove = (e) => {
    if (!down) return;
    const p = pt(e);
    add(p);
    draw(p);
  };
  el.onpointerup = el.onpointercancel = () => {
    if (!down) return;
    down = false;
    draw();
    el.dataset.n = seq.length;
    onDone(seq.length >= 4 ? seq.join("-") : "");
  };
}
function pForm(hasAcc, info) {
  clearInterval(pTimer);
  pInfo = info || {};
  pType = "alnum";
  $("pgo").hidden = true;
  if (hasAcc) {
    pStep = "login";
    $("pa").innerHTML =
      codeInput(pInfo.codeType || "alnum", "login") +
      `<button class="pri big" id="plg">Log in</button><p class="hint">Forgot your code? Ask the captain to press <b>Reset code</b> for you, then sign up again.</p>`;
    $("pe").textContent = "";
    bindCode(pInfo.codeType || "alnum");
    if ($("pc") && $("pc").type !== "hidden") $("pc").focus();
    return;
  }
  pStep = "email";
  $("pa").innerHTML =
    `<p class="note">First time here. We will send a 6 digit code to your e-mail to confirm it is you.</p>` +
    (pInfo.emailHint
      ? `<p>The code goes to the e-mail the captain saved for you: <b>${esc(pInfo.emailHint)}</b></p>`
      : `<label class="fl">Your e-mail${pInfo.domain ? " (@" + esc(pInfo.domain) + ")" : ""}<input id="pm" type="email" inputmode="email" autocomplete="email" placeholder="${pInfo.domain ? "you@" + esc(pInfo.domain) : "you@example.com"}" maxlength="120" required></label>`) +
    `<button class="pri big" id="psend">Send code</button>`;
  $("pe").textContent = "";
  if ($("pm")) $("pm").focus();
}
function pOtp(sentTo, wait) {
  pStep = "otp";
  $("pa").innerHTML =
    `<p class="note">We sent a 6 digit code to <b>${esc(sentTo)}</b>. It works for 10 minutes. Look in spam or junk if you cannot see it.</p>
  <div class="fl">Code from the e-mail${sixBox("po")}</div>
  <div class="fl">Security type<div class="seg" id="pty">${CTYPES.map((t) => `<button type="button" data-t="${t[0]}" class="${t[0] === pType ? "on" : ""}">${t[1]}</button>`).join("")}</div></div>
  <div id="pcw">${codeInput(pType, "new")}</div>
  <button class="pri big" id="plg">Create account &amp; log in</button><button type="button" id="presend" disabled>Send the code again</button>`;
  bindCode(pType);
  $("pty").onclick = (e) => {
    const b = e.target.closest("button[data-t]");
    if (!b) return;
    pType = b.dataset.t;
    $("pty")
      .querySelectorAll("button")
      .forEach((x) => x.classList.toggle("on", x === b));
    $("pcw").innerHTML = codeInput(pType, "new");
    $("pe").textContent = "";
    bindCode(pType);
  };
  $("presend").onclick = async () => {
    $("pe").textContent = "";
    $("presend").disabled = true;
    try {
      const r = await api("/api/player/otp", {
        method: "POST",
        body: { roll: $("pr").value.trim(), email: pInfo.typed || "" },
      });
      $("pe").textContent = "A new code was sent.";
      pCount(r.wait || 60);
    } catch (x) {
      pErr(x);
      pCount(x.status === 429 ? 30 : 0);
    }
  };
  pCount(wait || 60);
  bindSix("po");
  $("po").querySelector("input").focus();
}
$("pf").onsubmit = async (e) => {
  e.preventDefault();
  $("pe").textContent = "";
  const roll = $("pr").value.trim(),
    btn = e.submitter || $("pf").querySelector("button.pri:not([hidden])");
  if (btn) btn.disabled = true;
  try {
    if (pStep === "roll") {
      if (!/^\d{4}[A-Za-z]{2}\d{2}$/.test(roll)) {
        $("pe").textContent =
          "Roll number must be 4 digits, 2 letters, then 2 digits, like 2501ME71.";
        return;
      }
      const r = await api("/api/player/check", {
        method: "POST",
        body: { roll },
      });
      pForm(r.hasAccount, r);
      return;
    }
    if (pStep === "email") {
      const em = $("pm") ? $("pm").value.trim() : "";
      const r = await api("/api/player/otp", {
        method: "POST",
        body: { roll, email: em },
      });
      pInfo.typed = em;
      pOtp(r.sentTo, r.wait);
      return;
    }
    if (pStep === "otp" && $("po").val().length < 6) {
      $("pe").textContent = "Enter all 6 digits of the e-mailed code.";
      return;
    }
    if (
      (pStep === "login" ? pInfo.codeType : pType) === "pattern" &&
      !$("pc").value
    ) {
      $("pe").textContent = "Draw a pattern joining at least 4 dots.";
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
            body: {
              roll,
              otp: $("po").val(),
              code: $("pc").value,
              ctype: pType,
            },
          });
    clearInterval(pTimer);
    saveToken(r.token);
    tab = "me";
    boot();
  } catch (x) {
    pErr(x);
  } finally {
    if (btn) btn.disabled = false;
  }
};
$("pr").oninput = () => {
  if (pStep !== "roll") {
    pStep = "roll";
    clearInterval(pTimer);
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

// ---- professional profile & account drawer: user card, quick actions, settings ----
let menuActs = [];
function drawMenu() {
  menuActs = [];
  const m = $("menu");
  const mi = (ic, label, fn, o = {}) => {
    menuActs.push(fn);
    return `<button class="mi ${o.on ? "on" : ""} ${o.cls || ""}" data-k="${menuActs.length - 1}"${o.sw !== undefined ? ' role="switch" aria-checked="' + o.sw + '"' : ""}><span class="i">${ic}</span><span class="t">${label}</span>${o.sw !== undefined ? `<span class="sw ${o.sw ? "on" : ""}"></span>` : ""}</button>`;
  };

  const myId = role === "player" ? me : MYPID || "";
  const lp = myId ? P.find((x) => x.id === myId) : null;
  const roleName =
    role === "captain"
      ? "Captain"
      : role === "vice"
        ? "Vice-captain"
        : role === "admin"
          ? "Admin"
          : "Player";
  const userSub = lp
    ? [lp.position || "Hockey player", lp.roll].filter(Boolean).join(" · ")
    : roleName === "Admin"
      ? "Team Administrator"
      : roleName;

  let h = `<div class="user-drawer-card">
    <div class="user-drawer-top">
      <div class="user-drawer-avatar">${avatar(WHO, MYPH, 50)}</div>
      <div class="user-drawer-meta">
        <div class="user-drawer-name">${esc(WHO || "Team Member")}</div>
        <div class="user-drawer-badges">
          <span class="user-role-badge ${role}">${roleName}</span>
          ${lp && lp.roll ? `<span class="user-player-pill">${esc(lp.roll)}</span>` : ""}
        </div>
        <div class="user-drawer-sub">${esc(userSub)}</div>
      </div>
      <button type="button" class="mx" data-mx aria-label="Close menu" title="Close menu">${ico("close")}</button>
    </div>
    <div class="user-drawer-actions">
      <button type="button" class="btn-drawer-pri" id="btn-draw-prof">👤 View My Profile</button>
      ${role === "captain" || role === "vice" ? `<button type="button" class="btn-drawer-sec" id="btn-draw-code">🔑 Change Code</button>` : ""}
    </div>
  </div>`;

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
      mi("🔗", "Edit WhatsApp group link", openGroup) +
      mi("📷", "Change team group photo", () =>
        pickFiles((f) => setGroupPhoto(f[0])),
      ) +
      mi("🏑", "Edit Indian hockey fixtures", openMatches) +
      (owner ? mi("🎖️", "Edit captain & coach names", openNames) : "");
  h +=
    `<div class="ms">Share</div>` +
    mi("📊", "Share attendance report", () => openReport()) +
    mi("📲", "Share this app", shareApp);
  h +=
    `<div class="ms">App & Tools</div>` +
    mi("📅", "Add schedule to calendar", icsDownload) +
    mi("🐞", "Report a bug", openBug);
  h +=
    `<div class="ms">Notifications</div>` +
    mi(
      alertOn ? "🔔" : "🔕",
      "Alert 15 min before practice",
      async () => {
        await setAlert(!alertOn);
        drawMenu();
      },
      { sw: alertOn },
    );
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
        doLogout();
      },
      { cls: "out" },
    );
  m.innerHTML = h;
  bindVol("mvol", "mvolv", playClick);
  wireMenu(m);

  // Wire profile card actions
  const profBtn = m.querySelector("#btn-draw-prof");
  if (profBtn)
    profBtn.onclick = () => {
      m.hidden = true;
      openMyProfile();
    };
  const codeBtn = m.querySelector("#btn-draw-code");
  if (codeBtn)
    codeBtn.onclick = () => {
      m.hidden = true;
      openChangeCode();
    };
}

function toggleProfileMenu(e) {
  if (e) e.stopPropagation();
  const m = $("menu");
  if (!m.hidden) {
    m.hidden = true;
    return;
  }
  drawMenu();
  m.hidden = false;
}
if ($("mb")) $("mb").onclick = toggleProfileMenu;
$("hp").onclick = toggleProfileMenu;

document.addEventListener("click", (e) => {
  if (
    !e.composedPath().includes($("menu")) &&
    !e.target.closest("#hp") &&
    !e.target.closest(".mbtn")
  )
    $("menu").hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $("menu").hidden = true;
});

// ---- change login code (captain / vice-captain) ----
function openChangeCode() {
  const dlg = $("codedlg");
  if (!dlg) return;
  $("curcode").value = "";
  $("newcode").value = "";
  $("newcode2").value = "";
  $("codemsg").textContent = "";
  $("codemsg").className = "err";
  dlg.showModal();
}
if ($("codex")) $("codex").onclick = () => $("codedlg").close();
if ($("codeform")) {
  $("codeform").onsubmit = async (e) => {
    e.preventDefault();
    const cur = $("curcode").value.trim();
    const nw = $("newcode").value.trim();
    const nw2 = $("newcode2").value.trim();
    const msg = $("codemsg");
    msg.className = "err";
    msg.textContent = "";

    if (nw.length < 4 || nw.length > 30) {
      msg.textContent = "New code must be between 4 and 30 characters.";
      return;
    }
    if (nw !== nw2) {
      msg.textContent = "New codes do not match.";
      return;
    }
    const btn = $("codebtn");
    btn.disabled = true;
    btn.textContent = "Saving...";
    try {
      const res = await api("/api/auth/change-code", {
        method: "POST",
        body: { currentCode: cur, newCode: nw },
      });
      msg.className = "ok";
      msg.textContent = res.message || "Code updated successfully!";
      setTimeout(() => {
        $("codedlg").close();
        btn.disabled = false;
        btn.textContent = "Save New Code";
        toast(res.message || "Code updated successfully!");
      }, 1200);
    } catch (err) {
      msg.className = "err";
      msg.textContent =
        err.message || "Failed to change code. Check current code.";
      btn.disabled = false;
      btn.textContent = "Save New Code";
    }
  };
}

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
          { name: $("sn").value, roll: $("sr").value, email: $("sc").value },
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
    .map((a) => ({ name: a[0], roll: a[1], email: a[2] }));
  if (!players.length) {
    $("sm").textContent = "Type or paste at least one line.";
    return;
  }
  if (await bulk("/api/players/bulk", { players }, $("sba")))
    $("sb").value = "";
};

// ---- WhatsApp sharing (opens WhatsApp with the text ready; the person picks the group and presses send) ----
let GROUP = window.WA_GROUP || "";
const wa = (t) => shareText(t); // opens the phone's share sheet (any app); on a computer it shows WhatsApp, Telegram, e-mail, SMS and copy
const dlong = (d) => {
  const base = dateBase(d);
  const num = sessionNum(d);
  const multi =
    typeof SS !== "undefined" && SS && sessionsForDate(base).length > 1;
  const sfx = multi || num > 1 ? ` (Session ${num})` : "";
  const dt = new Date(base + "T00:00");
  return (
    (isNaN(dt.getTime())
      ? d
      : dt.toLocaleDateString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })) + sfx
  );
};
const DEFTPL =
  "🏑 *IITP Hockey: Practice*\n📅 {day}, {date}\n⏰ {time}\n📍 {venue}\n🎯 {session}\n📝 {note}\nReport on time!";
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
  return `🏑 *IITP Hockey: Attendance*\n📅 ${dlong(d)}\n\n✅ *Present (${pr.length})*\n${ls(pr)}\n\n❌ *Absent (${ab.length})*\n${ls(ab)}\n\nTurnout: ${ps.length ? Math.round((pr.length * 100) / ps.length) : 0}%`;
}
function weekMsg(k) {
  return (
    `🏑 *IITP Hockey: Weekly schedule${k === "gk" ? " (Goalkeepers)" : ""}*\n\n` +
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
let alertOn = false;
try {
  alertOn = localStorage.getItem("hk_alert") === "1";
} catch (e) {}

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
        (SCH && SCH.team && SCH.team[dayIdx(d)] && SCH.team[dayIdx(d)][1]
          ? SCH.team[dayIdx(d)][1]
          : "Practice") +
          (p.time ? " · " + p.time : "") +
          (p.venue ? " · " + p.venue : ""),
        key,
      );
      try {
        localStorage.setItem("hk_fired", JSON.stringify(fired));
      } catch (e) {}
    }
  }
}
// ---- push: the server sends a notification for new announcements, scheduled / cancelled playing days and day reminders (works with the app closed) ----
// There is no switch in the app. The phone asks for permission once; after that it is managed in the phone's own app settings.
let pushOn = false,
  pushChecked = false;
const pushOk = () =>
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;
const b64u = (k) => {
  const b = (k + "=".repeat((4 - (k.length % 4)) % 4))
      .replace(/-/g, "+")
      .replace(/_/g, "/"),
    r = atob(b);
  return Uint8Array.from([...r].map((c) => c.charCodeAt(0)));
};
async function pushEnsure() {
  // makes sure this phone is subscribed and tied to whoever is logged in
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const k = await api("/api/push/key");
      if (k && k.key) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64u(k.key),
        });
      }
    }
    if (sub) {
      await api("/api/push/subscribe", {
        method: "POST",
        body: { sub: sub.toJSON() },
      });
      pushOn = true;
    }
  } catch (e) {
    console.warn("Push subscription fallback:", e);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      const k = await api("/api/push/key");
      if (k && k.key) {
        const freshSub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64u(k.key),
        });
        await api("/api/push/subscribe", {
          method: "POST",
          body: { sub: freshSub.toJSON() },
        });
        pushOn = true;
      }
    } catch (e2) {
      pushOn = false;
    }
  }
  return pushOn;
}
// ---- immediate push permission & registration at startup (PW / app style) ----
async function requestPushPermissionAndSubscribe() {
  if (!pushOk()) return;
  try {
    const res = await Notification.requestPermission();
    if (res === "granted") {
      await pushEnsure();
      alertOn = true;
      try {
        localStorage.setItem("hk_alert", "1");
      } catch (e) {}
    }
  } catch (e) {
    console.warn("Notification permission error:", e);
  }
}

function pushAuto() {
  if (!pushOk()) return;
  if (Notification.permission === "granted") {
    pushEnsure();
    return;
  }
  if (Notification.permission === "default") {
    // 1. Prompt immediately at startup
    requestPushPermissionAndSubscribe();

    // 2. Also register one-time touch/click handler for mobile browsers requiring user gesture
    const onFirstTouch = () => {
      if (Notification.permission === "default") {
        requestPushPermissionAndSubscribe();
      }
    };
    window.addEventListener("click", onFirstTouch, {
      once: true,
      passive: true,
    });
    window.addEventListener("touchend", onFirstTouch, {
      once: true,
      passive: true,
    });
  }
}
function pushDrop(tk) {
  // on log out: stop this phone getting the previous person's notifications
  if (!pushOk()) return;
  navigator.serviceWorker.ready
    .then((r) => r.pushManager.getSubscription())
    .then((s) => {
      if (!s) return;
      fetch(API + "/api/push/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + tk,
        },
        body: JSON.stringify({ endpoint: s.endpoint }),
      }).catch(() => {});
      s.unsubscribe().catch(() => {});
    })
    .catch(() => {});
  pushOn = false;
}
async function testEmail() {
  const to = (
    prompt(
      "Send a test e-mail to which address?\n(Use an address that is not on your own domain, for example a Gmail, to prove it reaches other people.)",
    ) || ""
  ).trim();
  if (!to) return;
  try {
    const r = await api("/api/email/test", { method: "POST", body: { to } });
    alert(
      "Sent from: " +
        r.from +
        "\n\nCheck the inbox (and spam) of " +
        to +
        "." +
        (r.warn ? "\n\n⚠️ " + r.warn : ""),
    );
  } catch (e) {
    alert("The test e-mail failed.\n\n" + e.message);
  }
}
async function testPush() {
  if (!pushOn) {
    alert(
      "This phone is not subscribed yet. Allow notifications for this app in your phone settings (App info > Notifications), reopen the app, then test again.",
    );
    return;
  }
  try {
    const r = await api("/api/push/test", { method: "POST", body: {} });
    alert(r.msg || (r.ok ? "Sent." : "Not sent."));
  } catch (e) {
    alert("Could not run the test: " + e.message);
  }
}
// ---- calendar file: every fixed playing day with a built-in 15 minute reminder (works in the background on any phone) ----
function icsDownload() {
  const up = Object.keys(PL)
    .sort()
    .filter((d) => planLive(d) && span(PL[d].time));
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

function doLogout() {
  let ok = false;
  try {
    ok = confirm(
      "Log out of this device?\n\nYou will need your roll number and code to log in again.",
    );
  } catch (e) {
    ok = true;
  }
  if (ok) {
    logout();
  }
}

function drawSidebar() {
  const sb = $("sidebar");
  if (!sb) return;
  if (!loaded || !token) {
    sb.innerHTML = "";
    return;
  }
  const rn =
    role === "captain"
      ? "Captain"
      : role === "vice"
        ? "Vice-captain"
        : role === "admin"
          ? "Admin"
          : "Player";

  const allTabs = tabsFor();
  const mainKeys = ["me", "leaderboard", "take", "plan", "stats", "schedule"];
  const mainTabs = allTabs.filter((t) => mainKeys.includes(t[0]));
  const trainKeys = ["rules", "warmup", "gallery", "train"];
  const trainTabs = allTabs.filter((t) => trainKeys.includes(t[0]));
  const mgmtKeys = ["players", "removed", "admins", "helpbox"];
  const mgmtTabs = allTabs.filter((t) => mgmtKeys.includes(t[0]));

  const renderTabBtn = (t) => {
    const isAct = t[0] === tab && !prof;
    return `
      <button type="button" class="sb-nav-item ${isAct ? "active" : ""}" data-st="${t[0]}" ${isAct ? 'aria-current="page"' : ""}>
        <span class="sb-nav-icon">${eic(t[1])}</span>
        <span class="sb-nav-label">${esc(t[2])}</span>
        ${isAct ? '<span class="sb-nav-indicator"></span>' : ""}
      </button>
    `;
  };

  const dk =
    document.documentElement.dataset.theme === "dark" ||
    (!document.documentElement.dataset.theme &&
      typeof window !== "undefined" &&
      window.matchMedia &&
      matchMedia("(prefers-color-scheme: dark)").matches);

  sb.innerHTML = `
    <div class="sb-header">
      <div class="sb-brand">
        <img src="icons/iitp-hockey-crest.svg" alt="IIT Patna Crest" class="sb-crest" width="38" height="38">
        <div class="sb-brand-info">
          <div class="sb-brand-title">IITP Hockey</div>
          <div class="sb-brand-sub">IIT PATNA ATHLETICS</div>
        </div>
      </div>
    </div>

    <div class="sb-profile-box">
      <div class="sb-profile-card" id="sb-prof-click" title="Click to view full profile">
        <div class="sb-profile-avatar">
          ${avatar(WHO, MYPH, 46)}
        </div>
        <div class="sb-profile-meta">
          <div class="sb-profile-name" title="${esc(WHO)}">${esc(WHO)}</div>
          <div class="sb-profile-role-row">
            <span class="sb-role-badge ${role}">${esc(rn)}</span>
            ${me ? `<span class="sb-roll-text">${esc(me)}</span>` : ""}
          </div>
        </div>
      </div>
      <div class="sb-profile-actions">
        <button type="button" class="sb-btn-prof-action pri ${prof ? "active" : ""}" id="sb-btn-view-prof">
          <span>👤 View Profile</span>
        </button>
        ${
          role === "captain" || role === "vice"
            ? `<button type="button" class="sb-btn-prof-action sec" id="sb-btn-code">🔑 Code</button>`
            : ""
        }
      </div>
    </div>

    <div class="sb-scroll-area">
      <div class="sb-nav-group">
        <div class="sb-group-title">MAIN NAVIGATION</div>
        ${mainTabs.map(renderTabBtn).join("")}
      </div>

      <div class="sb-nav-group">
        <div class="sb-group-title">HOCKEY &amp; TRAINING</div>
        ${trainTabs.map(renderTabBtn).join("")}
      </div>

      ${
        mgmtTabs.length
          ? `<div class="sb-nav-group">
              <div class="sb-group-title">TEAM MANAGEMENT</div>
              ${mgmtTabs.map(renderTabBtn).join("")}
            </div>`
          : ""
      }

      ${
        admin
          ? `<div class="sb-nav-group">
              <div class="sb-group-title">ADMIN TOOLS</div>
              <button type="button" class="sb-nav-tool" id="sb-tool-add">
                <span class="sb-nav-icon">➕</span>
                <span class="sb-nav-label">Add Students</span>
              </button>
              <button type="button" class="sb-nav-tool" id="sb-tool-tpl">
                <span class="sb-nav-icon">✉️</span>
                <span class="sb-nav-label">Message Template</span>
              </button>
              <button type="button" class="sb-nav-tool" id="sb-tool-grp">
                <span class="sb-nav-icon">🔗</span>
                <span class="sb-nav-label">WhatsApp Group Link</span>
              </button>
              <button type="button" class="sb-nav-tool" id="sb-tool-photo">
                <span class="sb-nav-icon">📷</span>
                <span class="sb-nav-label">Change Squad Photo</span>
              </button>
              <button type="button" class="sb-nav-tool" id="sb-tool-fix">
                <span class="sb-nav-icon">🏑</span>
                <span class="sb-nav-label">Indian Hockey Fixtures</span>
              </button>
              ${
                owner
                  ? `<button type="button" class="sb-nav-tool" id="sb-tool-names">
                      <span class="sb-nav-icon">🎖️</span>
                      <span class="sb-nav-label">Staff Names</span>
                    </button>`
                  : ""
              }
            </div>`
          : ""
      }
    </div>

    <div class="sb-footer">
      <div class="sb-footer-buttons">
        <button type="button" class="sb-footer-btn" id="sb-thm" title="Toggle Day / Night mode">
          <span class="sb-nav-icon">${dk ? "☀️" : "🌙"}</span>
          <span class="sb-footer-btn-label">${dk ? "Day mode" : "Night mode"}</span>
        </button>
        <button type="button" class="sb-footer-btn" id="sb-cal" title="Add schedule to calendar">
          <span class="sb-nav-icon">📅</span>
          <span class="sb-footer-btn-label">Calendar</span>
        </button>
      </div>
      <button type="button" class="sb-logout-btn" id="sb-logout">
        <span>🚪</span>
        <span>Log out</span>
      </button>
    </div>
  `;

  sb.querySelectorAll("[data-st]").forEach((btn) => {
    btn.onclick = () => go(btn.dataset.st);
  });

  const pCard = sb.querySelector("#sb-prof-click");
  if (pCard) pCard.onclick = () => openMyProfile();

  const pBtn = sb.querySelector("#sb-btn-view-prof");
  if (pBtn) pBtn.onclick = () => openMyProfile();

  const cBtn = sb.querySelector("#sb-btn-code");
  if (cBtn) cBtn.onclick = () => openChangeCode();

  const tAdd = sb.querySelector("#sb-tool-add");
  if (tAdd) tAdd.onclick = () => openAdd();

  const tTpl = sb.querySelector("#sb-tool-tpl");
  if (tTpl) tTpl.onclick = () => openTpl();

  const tGrp = sb.querySelector("#sb-tool-grp");
  if (tGrp) tGrp.onclick = () => openGroup();

  const tPho = sb.querySelector("#sb-tool-photo");
  if (tPho) tPho.onclick = () => pickFiles((f) => setGroupPhoto(f[0]));

  const tFix = sb.querySelector("#sb-tool-fix");
  if (tFix) tFix.onclick = () => openMatches();

  const tNam = sb.querySelector("#sb-tool-names");
  if (tNam) tNam.onclick = () => openNames();

  const thmBtn = sb.querySelector("#sb-thm");
  if (thmBtn)
    thmBtn.onclick = () => {
      if (typeof toggleTheme === "function") toggleTheme();
      drawSidebar();
    };

  const calBtn = sb.querySelector("#sb-cal");
  if (calBtn) calBtn.onclick = () => icsDownload();

  const lgBtn = sb.querySelector("#sb-logout");
  if (lgBtn) lgBtn.onclick = () => doLogout();
}

function render() {
  if (!token) return;
  const tl = tabsFor();
  if (!tl.some((x) => x[0] === tab)) tab = "me";
  $("nav").innerHTML = tl
    .filter((t) => PRIMARY.includes(t[0]))
    .map(
      (x) =>
        `<button class="${x[0] === tab ? "on" : ""}" data-t="${x[0]}" ${x[0] === tab ? 'aria-current="page"' : ""} aria-label="${esc(x[2])}" title="${esc(x[2])}"><span class="i">${eic(x[1])}</span><span class="vh">${x[4] || x[2]}</span></button>`,
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
  $("xb").hidden = !(loaded && !err && !prof && !PRIMARY.includes(tab)); // ✕ on pages that were opened from the menu: goes back to Home
  if (!$("menu").hidden) drawMenu();
  drawSidebar();
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
    drawSidebar();
    vProfile();
    return;
  }
  try {
    ({
      take: vTake,
      me: vMe,
      leaderboard: vLeaderboard,
      plan: vPlan,
      stats: vStats,
      schedule: vSched,
      gallery: vGallery,
      train: vTrain,
      bugs: vBugs,
      rules: vRules,
      warmup: vWarm,
      players: vPlayers,
      removed: vRemoved,
      admins: vAdmins,
      helpbox: vHelpbox,
    })[tab]();
    helpFooter();
  } catch (e) {
    console.error(e);
    $("view").innerHTML =
      `<div class="card">${empty("⚠️", "This page could not be shown: " + esc(e.message))}<div class="ctl" style="justify-content:center"><button class="pri" id="rt">Reload data</button></div></div>`;
    $("rt").onclick = () => {
      lastJs = "";
      load(true);
    };
  }
}
const dayIdx = (d) =>
  (new Date(String(d || "").slice(0, 10) + "T00:00").getDay() + 6) % 7;

let tkQ = "",
  tkUn = false;
function vTake() {
  const baseDate = dateBase(takeDate);
  const existingSessions = sessionsForDate(baseDate);
  const curSessNum = sessionNum(takeDate);
  const maxNum = Math.max(1, ...existingSessions.map(sessionNum), curSessNum);
  const nextNum = maxNum + 1;

  const sessionPills = [];
  if (!existingSessions.length) {
    sessionPills.push({
      key: baseDate,
      num: 1,
      label: "Session 1",
      saved: false,
      present: 0,
      active: true,
    });
  } else {
    existingSessions.forEach((k) => {
      const num = sessionNum(k);
      const gIdx = sessionGlobalIndex(k);
      const sData = SS[k] || {};
      const prCount = (typeof allPs !== "undefined" ? allPs : P).filter((p) => sData[p.id] === true).length;
      sessionPills.push({
        key: k,
        num,
        label: gIdx ? `Session ${num} (#${gIdx})` : `Session ${num}`,
        saved: true,
        present: prCount,
        active: k === takeDate,
      });
    });
    if (!existingSessions.includes(takeDate)) {
      sessionPills.push({
        key: takeDate,
        num: curSessNum,
        label: `Session ${curSessNum}`,
        saved: false,
        present: 0,
        active: true,
      });
    }
  }

  const ex = SS[takeDate] || {};
  if (draftDate !== takeDate) {
    draft = { ...ex };
    draftDate = takeDate;
    tkQ = "";
    tkUn = false;
  }
  const el = P.filter((p) => !p.joined || p.joined <= baseDate),
    pln = SCH.team[dayIdx(baseDate)];
  const av = AVL[baseDate] || {},
    prev = dates()
      .filter((d) => d < takeDate)
      .reverse(),
    cx = PL[baseDate] && PL[baseDate].status === "cancelled";
  const dots = (p) =>
    prev
      .filter((d) => SS[d][p.id] !== undefined)
      .slice(0, 5)
      .reverse()
      .map(
        (d) => `<i class="${SS[d][p.id] ? "d1" : "d0"}" title="${fmt(d)}"></i>`,
      )
      .join("");
  const badge = (p) => {
    const a = av[p.id];
    return a && a.s && a.s !== "active"
      ? `<span class="avb ${a.s}" title="${esc(a.why || "")}">${avLabel(a.s)}${a.why ? ": " + esc(a.why) : ""}</span>`
      : "";
  };
  const blocked = el.filter(
    (p) => av[p.id] && (av[p.id].s === "out" || av[p.id].s === "injured"),
  );
  const delLabel =
    existingSessions.length > 1
      ? `Delete Session ${curSessNum}`
      : `Delete this day`;

  $("view").innerHTML = `<div class="card"><h2>Take attendance</h2>
  <div class="tkh"><button id="dprev" aria-label="Previous day">‹</button><input type="date" id="td" value="${baseDate}" aria-label="Date"><button id="dnext" aria-label="Next day">›</button><button id="dtoday">Today</button></div>
  <div class="session-tabs-bar" role="tablist" aria-label="Sessions on this day">
    <div class="session-tabs-header">
      <span class="session-tabs-label">Sessions for ${fmt(baseDate)}:</span>
      ${sessionPills.length < 4 ? `<button type="button" class="btn-session-add" id="btn-add-session">+ Add Session ${nextNum}</button>` : ""}
    </div>
    <div class="session-pills-row">
      ${sessionPills
        .map(
          (sp) => `
        <button type="button" class="btn-session-pill ${sp.active ? "active pri" : ""}" data-sess-key="${sp.key}">
          <span class="sess-pill-num">${esc(sp.label)}</span>
          <span class="sess-pill-stat">${sp.saved ? `✔ ${sp.present} present` : "✎ Unsaved"}</span>
        </button>
      `,
        )
        .join("")}
    </div>
  </div>
  <div class="tkinfo"><span class="pill ${cx ? "r" : "g"}">${cx ? "Cancelled" : esc(pln[0])}</span><span class="mute">${cx ? "This playing day is cancelled" : pln[3] ? esc(pln[1]) + " · " + esc(pln[3]) : "Rest day on the schedule"}${SS[takeDate] ? ` · Session ${curSessNum} already saved, saving again updates it` : ` · Session ${curSessNum} (not saved yet)`}</span></div>
  <div class="tkq"><input id="tkq" type="search" placeholder="Search name or roll no" value="${esc(tkQ)}" aria-label="Search players"><button id="tkun" aria-pressed="${tkUn}" class="${tkUn ? "pri" : ""}">Unmarked only</button></div>
  <div class="chips" style="margin:6px 0 8px"><button id="allp">✔ All present</button><button id="alla">✘ All absent</button>${blocked.length ? `<button id="blk">Mark “can’t come / injured” absent (${blocked.length})</button>` : ""}<button id="clr">Clear</button></div>
  <div id="tkl">${
    el
      .map(
        (
          p,
        ) => `<div class="tk" data-id="${p.id}" data-q="${esc((p.name + " " + (p.roll || "")).toLowerCase())}">${avatar(p.name, p.photo, 42)}<div class="tki"><b>${esc(p.name)}</b><small>${esc(p.roll || "")}${badge(p)}</small><span class="dots" aria-label="Last 5 practices">${dots(p)}</span></div>
  <span class="tog"><button class="p ${draft[p.id] === true ? "on" : ""}" data-id="${p.id}" data-v="1" aria-label="Present">✔<span> Present</span></button><button class="a ${draft[p.id] === false ? "on" : ""}" data-id="${p.id}" data-v="0" aria-label="Absent">✘<span> Absent</span></button></span></div>`,
      )
      .join("") ||
    '<p class="mute">No players yet. Add students from the ⋮ menu.</p>'
  }<p id="tkn" class="mute" hidden>No players match.</p></div>
  ${SS[takeDate] ? `<div class="chips"><button id="wat">⤴ Share</button><button class="dng" id="del">${delLabel}</button></div>` : ""}</div>
  <div class="tksv"><div class="tks"><div class="tkc"><b id="tkp" class="gp">0</b><small>Present</small></div><div class="tkc"><b id="tka" class="ga">0</b><small>Absent</small></div><div class="tkc"><b id="tkm">0</b><small>Left</small></div></div><div class="tkprog"><i id="tkpb"></i></div><button class="pri big" id="sv">Save Session ${curSessNum} attendance</button></div>`;
  const upd = () => {
    const p = el.filter((x) => draft[x.id] === true).length,
      a = el.filter((x) => draft[x.id] === false).length;
    $("tkp").textContent = p;
    $("tka").textContent = a;
    $("tkm").textContent = el.length - p - a;
    $("tkpb").style.width = (el.length ? ((p + a) * 100) / el.length : 0) + "%";
    const q = tkQ.trim().toLowerCase();
    let shown = 0;
    document.querySelectorAll(".tk").forEach((r) => {
      const hide =
        (q && !r.dataset.q.includes(q)) ||
        (tkUn && draft[r.dataset.id] !== undefined);
      r.hidden = hide;
      if (!hide) shown++;
      const v = draft[r.dataset.id];
      r.classList.toggle("mp", v === true);
      r.classList.toggle("ma", v === false);
      r.querySelector(".p").classList.toggle("on", v === true);
      r.querySelector(".a").classList.toggle("on", v === false);
    });
    $("tkn").hidden = shown > 0 || !el.length;
  };

  document.querySelectorAll(".btn-session-pill").forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.sessKey;
      if (k !== takeDate) {
        takeDate = k;
        vTake();
      }
    };
  });
  if ($("btn-add-session")) {
    $("btn-add-session").onclick = () => {
      takeDate = `${baseDate}_${nextNum}`;
      draft = {};
      draftDate = takeDate;
      vTake();
      toast(`Switched to Session ${nextNum}. Ready to record attendance.`);
    };
  }

  $("td").onchange = (e) => {
    if (e.target.value) {
      const newBase = e.target.value;
      const exS = sessionsForDate(newBase);
      takeDate = exS.length ? exS[0] : newBase;
      vTake();
    }
  };
  $("dprev").onclick = () => {
    const newBase = addDays(baseDate, -1);
    const exS = sessionsForDate(newBase);
    takeDate = exS.length ? exS[0] : newBase;
    vTake();
  };
  $("dnext").onclick = () => {
    const newBase = addDays(baseDate, 1);
    const exS = sessionsForDate(newBase);
    takeDate = exS.length ? exS[0] : newBase;
    vTake();
  };
  $("dtoday").onclick = () => {
    const newBase = today();
    const exS = sessionsForDate(newBase);
    takeDate = exS.length ? exS[0] : newBase;
    vTake();
  };
  document.querySelectorAll(".tog button").forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.id,
          v = b.dataset.v === "1";
        draft[id] = draft[id] === v ? undefined : v;
        if (draft[id] === undefined) delete draft[id];
        upd();
      }),
  );
  $("tkq").oninput = (e) => {
    tkQ = e.target.value;
    upd();
  };
  $("tkun").onclick = () => {
    tkUn = !tkUn;
    $("tkun").classList.toggle("pri", tkUn);
    $("tkun").setAttribute("aria-pressed", String(tkUn));
    upd();
  };
  $("allp").onclick = () => {
    el.forEach((p) => (draft[p.id] = true));
    upd();
  };
  $("alla").onclick = () => {
    el.forEach((p) => (draft[p.id] = false));
    upd();
  };
  $("clr").onclick = () => {
    el.forEach((p) => delete draft[p.id]);
    upd();
  };
  if ($("blk"))
    $("blk").onclick = () => {
      blocked.forEach((p) => (draft[p.id] = false));
      upd();
    };
  $("sv").onclick = () => {
    if (!el.length) return alert("Add players first.");
    const un = el.filter((p) => draft[p.id] === undefined);
    if (un.length) {
      tkUn = true;
      upd();
      return alert(
        "Mark Present or Absent for: " + un.map((p) => p.name).join(", "),
      );
    }
    const r = {};
    el.forEach((p) => (r[p.id] = draft[p.id]));
    run(async () => {
      await api("/api/sessions/" + takeDate, {
        method: "PUT",
        body: { r: { ...ex, ...r } },
      });
      draftDate = null;
      await load();
      toast("Attendance saved for " + fmt(takeDate) + ".");
    });
  };
  if ($("wat")) $("wat").onclick = () => wa(attMsg(takeDate));
  if ($("del"))
    $("del").onclick = () => {
      if (confirm("Delete attendance for " + fmt(takeDate) + "?"))
        run(async () => {
          await api("/api/sessions/" + takeDate, { method: "DELETE" });
          draftDate = null;
          const remaining = sessionsForDate(baseDate).filter(
            (k) => k !== takeDate,
          );
          takeDate = remaining.length ? remaining[0] : baseDate;
          await load();
          toast("Attendance record deleted.");
        });
    };
  upd();
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
  return `<details class="card"><summary><b>Day-wise table</b> <span class="mute">${ps.length} players × ${ds.length} sessions</span></summary><div class="mxw"><table class="mx"><tr><th class="sc"></th>${ms.map((m) => `<th colspan="${ds.filter((d) => d.startsWith(m)).length}" class="mh">${mfmt(m).replace(/ (\d\d)(\d\d)$/, " ’$2")}</th>`).join("")}<th></th></tr>
  <tr><th class="sc">Player</th>${ds
    .map((d) => {
      const dayNum = parseInt(d.slice(8, 10), 10);
      const num = sessionNum(d);
      const sfx =
        num > 1
          ? `<br><small style="font-size:9px;opacity:0.85">S${num}</small>`
          : "";
      return `<th title="${fmt(d)}">${dayNum}${sfx}</th>`;
    })
    .join("")}<th>Total</th></tr>
  ${ps
    .map((p) => {
      let pr = 0;
      const t = ds.length;
      const c = ds
        .map((d) => {
          const v = SS[d][p.id];
          if (v) pr++;
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
    ns = rsess(m),
    live = dates().filter((d) => m === "all" || d.startsWith(m));
  const tp = st.reduce((a, x) => a + x.t, 0),
    tr = tp ? Math.round((st.reduce((a, x) => a + x.pr, 0) * 100) / tp) : 0;
  const medal = medalFn(st),
    mine = st.find((x) => x.p.id === me),
    tier = !admin && mine ? tierMedal(mine.pct) : null;
  let pts, ttl;
  const allPs = [...P, ...(typeof RM !== "undefined" && RM ? RM : [])];
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
      ? "Team turnout per session"
      : "My attendance per session";
    pts = live.map((d) => {
      const v = admin
          ? allPs.filter((p) => SS[d] && SS[d][p.id] !== undefined).map(
              (p) => SS[d][p.id],
            )
          : [Boolean(SS[d] && SS[d][me])],
        pr = v.filter(Boolean).length,
        pct = v.length ? (pr * 100) / v.length : 0;
      return {
        l: d.slice(5),
        pct,
        tip:
          fmt(d) + ": " + (admin ? pr + " present" : pr ? "Present" : "Absent"),
      };
    });
  }
  const selBase = dateBase(selDate);
  const daySessions = sessionsForDate(selBase);
  const sd = SS[selDate];
  let day = '<p class="mute">No hockey recorded on this date.</p>';
  if (!admin) {
    day = sd
      ? `<div class="row"><span>${fmt(selDate)}</span><span class="tag ${sd[me] ? "p" : "a"}">${sd[me] ? "Present" : "Absent"}</span></div>`
      : '<p class="mute">No hockey recorded on this date.</p>';
  } else if (sd) {
    const v = allPs.filter((p) => sd[p.id] !== undefined),
      pr = v.filter((p) => sd[p.id]).length;
    day =
      `<div class="stats"><div><b>${pr}</b>Present</div><div><b>${v.length - pr}</b>Absent</div><div><b>${v.length ? Math.round((pr * 100) / v.length) : 0}%</b>Turnout</div></div>` +
      v
        .map(
          (p) =>
            `<div class="row"><span>${esc(p.name)}${p.removed ? ' <small class="mute">(Removed)</small>' : ""}</span><span class="tag ${sd[p.id] ? "p" : "a"}">${sd[p.id] ? "Present" : "Absent"}</span></div>`,
        )
        .join("");
  }
  const uniqueDates = [...new Set(live.map(dateBase))].sort();

  const curGIdx = sessionGlobalIndex(selDate);
  const curSNum = sessionNum(selDate);
  const sessPickerHtml =
    daySessions.length > 1
      ? `<div class="day-sess-toggle-card">
          <div class="day-sess-toggle-head">
            <span class="day-sess-badge">${daySessions.length} sessions on this day (${daySessions.map((k) => "Session #" + sessionGlobalIndex(k)).join(", ")})</span>
            <span class="mute">Showing: <b>${esc(sessionLabel(selDate))}</b> ${curGIdx ? `(Session #${curGIdx} overall)` : ""}</span>
          </div>
          <div class="day-sess-toggle-pills" role="tablist">
            ${daySessions
              .map((k) => {
                const sNum = sessionNum(k);
                const gIdx = sessionGlobalIndex(k);
                const sData = SS[k] || {};
                const prCount = allPs.filter((p) => sData[p.id] === true).length;
                const totCount = allPs.filter(
                  (p) => sData[p.id] !== undefined,
                ).length;
                const isAct = k === selDate;
                const gText = gIdx ? `Session #${gIdx}` : `Session ${sNum}`;
                const timeHint =
                  dateBase(k) === "2026-01-29"
                    ? sNum === 1
                      ? "Morning (6:30 AM)"
                      : "Evening (4:00 PM)"
                    : "";
                const labelTitle = timeHint
                  ? `Session ${sNum} · ${timeHint} (${gText})`
                  : `Session ${sNum} (${gText})`;
                const subTxt = admin
                  ? totCount
                    ? `✔ ${prCount}/${totCount} present`
                    : "Not recorded"
                  : sData[me] !== undefined
                    ? sData[me]
                      ? "✔ Present"
                      : "✘ Absent"
                    : "Not recorded";
                return `
                  <button type="button" class="btn-day-sess ${isAct ? "active pri" : ""}" data-sess-key="${k}">
                    <b>${labelTitle}</b>
                    <small>${subTxt}</small>
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>`
      : sd && curGIdx
        ? `<div class="single-sess-tag"><span class="pill g">Session #${curGIdx}</span> <span class="mute">${fmt(selDate)}</span></div>`
        : "";

  $("view").innerHTML =
    `<div class="card"><h2>Attendance</h2><div class="ctl">${mSel("gm", gMonth, true)}</div>
  <div class="stats"><div><b>${n}</b>Playing days</div><div><b>${ns}</b>Sessions</div><div><b>${tr}%</b>${admin ? "Team turnout" : "My attendance"}</div></div>
  ${admin ? podium(st, medal) : tier ? `<div class="tier"><span>${tier[0]}</span><div><b>${tier[1]} level</b><br><span class="mute">Gold 90% or more · Silver 75% or more · Bronze 60% or more</span></div></div>` : ""}
  <table><tr><th>Player</th><th class="n">Present</th><th class="n">Sessions</th><th>%</th></tr>${st.map((x) => `<tr><td>${(admin ? medal(x) : tier && tier[0]) || ""} ${admin ? `<button class="lnk" data-pf="${x.p.id}">${esc(x.p.name)}</button>` : esc(x.p.name)}</td><td class="n">${x.pr}</td><td class="n">${x.t}</td><td><div class="bar"><i style="width:${x.pct}%"></i></div>${x.pct}%</td></tr>`).join("")}</table>
  <p class="mute">% = sessions present ÷ total sessions (${ns}). The total is the same for every player; a missed session counts as absent.</p>${L[m] ? '<p class="mute">Includes the imported register totals.</p>' : ""}
  <div class="chips"><button id="shr">⤴ Share report</button></div></div>
  ${chartBlocks(ttl, pts, st, tr, m, vis)}
  ${admin && live.length ? matrix(live) : ""}
  <div class="card"><h2>Day by day</h2><div class="ctl"><input type="date" id="sd" value="${selBase}">${admin && sd ? '<button type="button" id="sdsh">⤴ Share this session</button>' : ""}</div>${sessPickerHtml}${day}
  <details class="dlist"><summary>Show all playing dates (${uniqueDates.length})</summary><div class="chips">${uniqueDates
    .slice()
    .reverse()
    .map((b) => {
      const isSel = selBase === b;
      const sKeys = sessionsForDate(b);
      const sNums = sKeys.map((k) => sessionGlobalIndex(k)).filter(Boolean);
      const sText =
        sNums.length > 1
          ? ` (Sessions ${sNums.join(", ")})`
          : sNums.length === 1
            ? ` (Session ${sNums[0]})`
            : "";
      return `<button type="button" class="btn-date ${isSel ? "pri active" : ""}" data-d="${b}">${fmtDateOnly(b)}${sText}</button>`;
    })
    .join("")}</div></details></div>`;
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
  if ($("sdsh"))
    $("sdsh").onclick = () => openReport({ sc: "date", v: selDate });
  document.querySelectorAll(".btn-day-sess").forEach((b) => {
    b.onclick = () => {
      selDate = b.dataset.sessKey;
      dsel = true;
      vStats();
    };
  });
  $("sd").onchange = (e) => {
    if (e.target.value) {
      const newBase = e.target.value;
      const exS = sessionsForDate(newBase);
      selDate = exS.length ? exS[0] : newBase;
      dsel = true;
      vStats();
    }
  };
  document.querySelectorAll(".chips button[data-d]").forEach(
    (b) =>
      (b.onclick = () => {
        const base = b.dataset.d;
        const exS = sessionsForDate(base);
        selDate = exS.length ? exS[0] : base;
        dsel = true;
        vStats();
      }),
  );
}
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
let schDay = -1;
function vSched() {
  const ti = dayIdx(today());
  if (schDay < 0 || schDay > 6) schDay = ti;
  const rows = SCH[sch],
    i = schDay,
    r = rows[i];
  $("view").innerHTML = `<div class="card sch-container">
    <div class="sch-header-row">
      <div>
        <h2 style="margin:0 0 4px">Weekly practice schedule</h2>
        <span class="mute" style="font-size:0.84rem">Interactive timetable &amp; drill breakdown for turf training</span>
      </div>
      <div class="seg2" style="margin:0">
        <button class="${sch === "team" ? "on" : ""}" data-s="team">Team</button>
        <button class="${sch === "gk" ? "on" : ""}" data-s="gk">Goalkeepers</button>
      </div>
    </div>
    <div class="sch-body-grid">
      <div class="sch-sidebar-pane">
        <div class="week sch-week-pills">${rows
          .map(
            (x, k) =>
              `<button type="button" class="wd ${k === ti ? "today" : ""} ${k === i ? "sel" : ""} ${x[3] ? "" : "rest"}" data-w="${k}" aria-pressed="${k === i}" aria-label="${x[0]}">
            <b>${DAB[k]}</b>
            <span>${x[3] ? "🏑" : "😴"}</span>
            <small class="wd-timing">${x[3] ? esc(x[3].split("–")[0].trim()) : "Rest"}</small>
          </button>`,
          )
          .join("")}</div>
        <div class="sch-quick-actions">
          <button id="wsch" class="sch-act-btn">⤴ Share whole week</button>
          <button id="wcal" class="sch-act-btn">📅 Add to calendar</button>
        </div>
        <p class="mute sch-coach-note">Tap any day to view drills. Report on time. Coach: ${esc(nameOf2("coach"))}. Timings may shift closer to tournaments based on turf availability.</p>
      </div>
      <div class="sch-main-pane">
        <div class="dayc ${r[3] ? "" : "rest"} ${i === ti ? "today" : ""}">
          <div class="dhead">
            <span class="dbadge">${DAB[i]}</span>
            <span class="dm">
              <b>${esc(r[1])}</b>
              <small>${r[3] ? "⏰ " + esc(r[3]) : "Rest day"}</small>
            </span>
            ${i === ti ? '<span class="pill g">Today</span>' : ""}
          </div>
          <div class="db">
            <p class="sch-day-desc">${esc(r[2])}</p>
            <div class="sch-kv-grid">
              <div class="kv"><span>Day</span><b>${r[0]}</b></div>
              <div class="kv"><span>Timing</span><b>${r[3] ? esc(r[3]) : "No session"}</b></div>
              <div class="kv"><span>Next date</span><b>${fmt(nextDateOf(i))}</b></div>
            </div>
            ${
              admin
                ? `<div class="edit sch-edit-box">
                    <label class="fl">Session name<input id="de-t" value="${esc(r[1])}" maxlength="60"></label>
                    <label class="fl">Details<input id="de-x" value="${esc(r[2])}" maxlength="200"></label>
                    <label class="fl">Timing, e.g. 6:30–8:30 PM (empty = rest day)<input id="de-m" value="${esc(r[3])}" maxlength="30"></label>
                  </div>`
                : ""
            }
            <div class="chips" style="margin-top:12px">
              <button data-sh="1">⤴ Share this day</button>
              ${
                admin
                  ? `<button class="pri" data-sv="1">Save changes</button>${
                      r[3]
                        ? `<button data-nx="1">Schedule next ${r[0]}</button>`
                        : ""
                    }`
                  : ""
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
  $("wsch").onclick = () => shareText(weekMsg(sch), "Weekly schedule");
  $("wcal").onclick = icsDownload;
  document.querySelectorAll("[data-s]").forEach(
    (b) =>
      (b.onclick = () => {
        sch = b.dataset.s;
        vSched();
      }),
  );
  document.querySelectorAll("[data-w]").forEach(
    (b) =>
      (b.onclick = () => {
        schDay = +b.dataset.w;
        vSched();
      }),
  );
  document
    .querySelectorAll("[data-sh]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          shareText(
            `🏑 *IITP Hockey: ${r[0]}*\n${r[1]}\n${r[2]}\n⏰ ${r[3] || "Rest day"}`,
            "Practice",
          )),
    );
  document.querySelectorAll("[data-sv]").forEach(
    (b) =>
      (b.onclick = () => {
        SCH[sch][i] = [
          r[0],
          $("de-t").value.trim(),
          $("de-x").value.trim(),
          $("de-m").value.trim(),
          [],
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

// ---------- SQUAD LEADERBOARD (Physics Wallah / PW Style Gamification) ----------
// More practice time = more points = top on the leaderboard!
let lbData = null,
  lbBusy = false,
  lbErr = "",
  lbScope = "all", // "all" | "month" | "streak"
  lbPos = "all",
  lbSearch = "",
  lbHow = false;

async function fetchLeaderboard(fresh) {
  if (lbBusy) return;
  lbBusy = true;
  lbErr = "";
  try {
    lbData = await api("/api/leaderboard" + (fresh ? "?fresh=1" : ""));
  } catch (e) {
    lbErr = e.message || "Failed to load leaderboard data";
  }
  lbBusy = false;
  if (tab === "leaderboard") vLeaderboard();
  else if (tab === "me") {
    const pc = $("home-lb-preview");
    if (pc) pc.outerHTML = lbPreviewCard();
  }
}

function vLeaderboard() {
  if (!lbData && !lbBusy && !lbErr) {
    fetchLeaderboard();
  }
  if (lbBusy && !lbData) {
    $("view").innerHTML = `
      <div class="card lb-container" style="text-align:center;padding:50px 20px">
        <span style="font-size:2.8rem;display:inline-block;animation:lb-float 1.5s infinite">🏆</span>
        <h3 style="margin:14px 0 6px;font-family:var(--font-display);font-size:1.25rem">Loading Squad Leaderboard…</h3>
        <p class="mute" style="margin:0;font-size:0.9rem">Compiling turf practice hours, dedication points, and attendance streaks</p>
      </div>`;
    return;
  }
  if (lbErr && !lbData) {
    $("view").innerHTML = `
      <div class="card lb-container">
        ${empty("⚠️", esc(lbErr))}
        <div class="ctl" style="justify-content:center"><button class="pri" id="lb-retry">Retry</button></div>
      </div>`;
    const rBtn = $("lb-retry");
    if (rBtn) rBtn.onclick = () => fetchLeaderboard(true);
    return;
  }

  const rawList = (lbData && lbData.leaderboard) || [];

  // Filter by position
  let list = rawList.slice();
  if (lbPos !== "all") {
    list = list.filter((p) => {
      const pos = (p.position || "").toLowerCase();
      return pos.includes(lbPos.toLowerCase());
    });
  }

  // Filter by search query
  if (lbSearch.trim()) {
    const q = lbSearch.trim().toLowerCase();
    list = list.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.roll && p.roll.toLowerCase().includes(q)),
    );
  }

  // Sort according to selected scope
  if (lbScope === "month") {
    list.sort(
      (a, b) =>
        b.monthPoints - a.monthPoints ||
        b.monthHours - a.monthHours ||
        b.monthSessions - a.monthSessions ||
        a.name.localeCompare(b.name),
    );
  } else if (lbScope === "streak") {
    list.sort(
      (a, b) =>
        b.streak - a.streak ||
        b.maxStreak - a.maxStreak ||
        b.points - a.points ||
        a.name.localeCompare(b.name),
    );
  } else {
    // "all"
    list.sort(
      (a, b) =>
        b.points - a.points ||
        b.hours - a.hours ||
        b.totalSessions - a.totalSessions ||
        a.name.localeCompare(b.name),
    );
  }

  // Assign scope-specific ranks
  list.forEach((p, idx) => {
    p.displayRank = idx + 1;
  });

  // Find current user's entry
  const myEntry = rawList.find((p) => p.isMe);
  const myRank = myEntry
    ? list.findIndex((p) => p.id === myEntry.id) + 1
    : 0;

  // Split podium (top 3) vs rest (#4 onwards)
  const podium = list.slice(0, 3);
  const rest = list.slice(3);

  const monthName = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const renderPodiumStep = (p, stepNum) => {
    if (!p) {
      return `
        <div class="lb-podium-slot lb-slot-${stepNum}">
          <div class="lb-pedestal">
            <span class="lb-pedestal-rank">${stepNum}</span>
            <span class="lb-pedestal-title">${stepNum === 1 ? "CHAMPION" : stepNum === 2 ? "2ND" : "3RD"}</span>
          </div>
        </div>`;
    }
    const laurel = stepNum === 1 ? "🥇" : stepNum === 2 ? "🥈" : "🥉";
    const pts = lbScope === "month" ? p.monthPoints : p.points;
    const hrs = lbScope === "month" ? p.monthHours : p.hours;
    const sess = lbScope === "month" ? p.monthSessions : p.totalSessions;
    const avSize = stepNum === 1 ? 64 : 52;

    return `
      <div class="lb-podium-slot lb-slot-${stepNum}">
        <div class="lb-slot-avatar-wrap">
          ${stepNum === 1 ? '<span class="lb-slot-crown">👑</span>' : ""}
          ${avatar(p.name, p.photo, avSize)}
          <span class="lb-slot-laurel">${laurel}</span>
        </div>
        <div class="lb-slot-name" title="${esc(p.name)}">${esc(p.name)}</div>
        <div class="lb-slot-roll">${esc(p.roll || p.id)}</div>
        <div class="lb-slot-badge-chips">
          <span class="lb-slot-pts-chip">⭐ ${pts.toLocaleString()} XP</span>
          <span class="lb-slot-hrs-chip">⏱️ ${hrs} hrs · ${sess} sess</span>
          ${p.streak >= 2 ? `<span class="pill" style="font-size:0.68rem;padding:1px 6px;background:#fee2e2;color:#991b1b">🔥 ${p.streak} streak</span>` : ""}
        </div>
        <div class="lb-pedestal">
          <span class="lb-pedestal-rank">${stepNum}</span>
          <span class="lb-pedestal-title">${stepNum === 1 ? "CHAMPION" : stepNum === 2 ? "2ND PLACE" : "3RD PLACE"}</span>
        </div>
      </div>
    `;
  };

  const renderRow = (p) => {
    const pts = lbScope === "month" ? p.monthPoints : p.points;
    const hrs = lbScope === "month" ? p.monthHours : p.hours;
    const sess = lbScope === "month" ? p.monthSessions : p.totalSessions;

    return `
      <div class="lb-row ${p.isMe ? "is-me" : ""}">
        <div class="lb-row-rank">#${p.displayRank}</div>
        <div class="lb-row-avatar">
          ${avatar(p.name, p.photo, 40)}
        </div>
        <div class="lb-row-info">
          <div class="lb-row-name">
            <span>${esc(p.name)}</span>
            ${p.isMe ? '<span class="pill" style="font-size:0.68rem;background:var(--brand);color:#fff;padding:1px 6px">You</span>' : ""}
          </div>
          <div class="lb-row-meta">
            <span style="font-family:monospace">${esc(p.roll || p.id)}</span>
            <span>·</span>
            <span>${esc(p.position || "Player")}</span>
            <span>·</span>
            <span class="mute">${p.rate || 0}% att</span>
          </div>
        </div>
        <div class="lb-row-stats">
          <span class="lb-chip hrs" title="Total Practice Hours">⏱️ ${hrs} hrs</span>
          <span class="lb-chip pts" title="Leaderboard Points">⭐ ${pts.toLocaleString()} XP</span>
          ${p.streak >= 2 ? `<span class="lb-chip strk" title="Active Attendance Streak">🔥 ${p.streak}</span>` : ""}
        </div>
      </div>
    `;
  };

  $("view").innerHTML = `
    <div class="lb-container">
      <!-- 1. Hero Header -->
      <div class="lb-hero">
        <div class="lb-hero-header">
          <div class="lb-hero-title-group">
            <span class="lb-trophy-icon">🏆</span>
            <div>
              <h2 class="lb-hero-title">IITP Hockey Leaderboard</h2>
              <p class="lb-hero-sub">The Wall of Dedication · Practice More, Give More Time, Earn Points &amp; Climb the Board!</p>
            </div>
          </div>
          <button type="button" id="lb-btn-how" class="f-btn" style="background:rgba(255,255,255,0.18);color:#fff;border-radius:10px;padding:6px 14px;font-size:0.82rem;font-weight:700;backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,0.25)">
            ${lbHow ? "✕ Hide Rules" : "ℹ️ How Points Work"}
          </button>
        </div>
        <div class="lb-hero-stats">
          <span class="lb-hero-stat-pill"><b>${lbData.totalSessions || 86}</b> Total Sessions</span>
          <span class="lb-hero-stat-pill"><b>${Math.round((lbData.totalSessions || 86) * 2)} hrs</b> Turf Practice</span>
          <span class="lb-hero-stat-pill"><b>${lbData.totalPlayers || 31}</b> Active Players</span>
          <span class="lb-hero-stat-pill"><b>${lbScope === "month" ? monthName : lbScope === "streak" ? "Streaks" : "All-Time"}</b> Board</span>
        </div>
      </div>

      <!-- 2. "How Points Work" Collapsible Card (PW Gamification Explainer) -->
      ${
        lbHow
          ? `
        <div class="lb-rules-card">
          <div class="lb-rules-title">
            <span>⚡ Physics Wallah Style Gamification: How Points Are Earned</span>
          </div>
          <div class="lb-rules-grid">
            <div class="lb-rule-item">
              <b>⏱️ Time on Field (2 hrs/session)</b>
              <span>Every turf practice session attended earns <b>100 Points</b> (50 base attendance + 25 pts per full hour on turf).</span>
            </div>
            <div class="lb-rule-item">
              <b>🔥 Consistency Streak Bonus</b>
              <span>Attend 3+ consecutive sessions for <b>+60 Bonus XP</b>; maintain a 5+ streak for <b>+150 Bonus XP</b>!</span>
            </div>
            <div class="lb-rule-item">
              <b>⚡ Monthly Sprint</b>
              <span>Switch to "This Month" to see the active monthly race. Fresh chance for any dedicated player to reach #1!</span>
            </div>
            <div class="lb-rule-item">
              <b>🥇 The Top 3 Podium</b>
              <span>The top 3 dedicated players with the highest practice scores stand on the Gold, Silver, and Bronze pedestals!</span>
            </div>
          </div>
        </div>
      `
          : ""
      }

      <!-- 3. "My Standing" Card (Pinned at the Top) -->
      ${
        myEntry
          ? `
        <div class="lb-my-card">
          <div class="lb-my-info">
            <div class="lb-my-rank-badge">
              <span class="lb-my-rank-num">#${myRank > 0 ? myRank : myEntry.rank}</span>
              <span class="lb-my-rank-label">Rank</span>
            </div>
            <div class="lb-my-details">
              <div class="lb-my-name">
                <span>${esc(myEntry.name)}</span>
                <span class="pill" style="font-size:0.75rem;background:var(--brand);color:#fff">You</span>
              </div>
              <div class="lb-my-sub">
                ${esc(myEntry.roll || myEntry.id)} · ${esc(myEntry.position || "Player")} · 
                <b>Top ${Math.max(1, Math.round(((myRank || myEntry.rank) / (lbData.totalPlayers || 31)) * 100))}%</b> of squad
              </div>
            </div>
          </div>
          <div class="lb-my-stats-group">
            <div class="lb-my-stat-item">
              <span class="lb-my-stat-val gold">${(lbScope === "month" ? myEntry.monthPoints : myEntry.points).toLocaleString()} XP</span>
              <span class="lb-my-stat-label">Total Points</span>
            </div>
            <div class="lb-my-stat-item">
              <span class="lb-my-stat-val">${lbScope === "month" ? myEntry.monthHours : myEntry.hours} hrs</span>
              <span class="lb-my-stat-label">Time Dedicated</span>
            </div>
            <div class="lb-my-stat-item">
              <span class="lb-my-stat-val">${lbScope === "month" ? myEntry.monthSessions : myEntry.totalSessions}</span>
              <span class="lb-my-stat-label">Sessions</span>
            </div>
            <div class="lb-my-stat-item">
              <span class="lb-my-stat-val" style="color:#ef4444">🔥 ${myEntry.streak}</span>
              <span class="lb-my-stat-label">Streak</span>
            </div>
          </div>
        </div>
      `
          : `
        <div class="lb-my-card" style="border-color:var(--line);background:var(--card)">
          <div class="lb-my-info">
            <span style="font-size:1.8rem">🛡️</span>
            <div>
              <div class="lb-my-name" style="font-size:1rem">Viewing as Staff / Admin</div>
              <div class="lb-my-sub">Full squad training performance, dedicated hours, and consistency rankings.</div>
            </div>
          </div>
          <button id="lb-refresh-btn" class="f-btn" style="border-radius:10px;padding:6px 12px;background:var(--soft);border:1px solid var(--line);font-size:0.82rem;font-weight:700">↻ Refresh Board</button>
        </div>
      `
      }

      <!-- 4. Controls Card (Tabs & Search/Filter) -->
      <div class="lb-controls-card">
        <div class="lb-scope-tabs">
          <button type="button" class="lb-scope-btn ${lbScope === "all" ? "active" : ""}" data-lbs="all">🏆 All-Time Titans</button>
          <button type="button" class="lb-scope-btn ${lbScope === "month" ? "active" : ""}" data-lbs="month">⚡ This Month (${monthName.split(" ")[0]})</button>
          <button type="button" class="lb-scope-btn ${lbScope === "streak" ? "active" : ""}" data-lbs="streak">🔥 Streak Champions</button>
        </div>
        <div class="lb-filter-row">
          <input type="text" id="lb-search" class="lb-search-input" placeholder="🔍 Search player name or roll number..." value="${esc(lbSearch)}">
          <select id="lb-pos" class="lb-pos-select">
            <option value="all" ${lbPos === "all" ? "selected" : ""}>All Positions</option>
            <option value="Forward" ${lbPos === "Forward" ? "selected" : ""}>Forwards</option>
            <option value="Midfielder" ${lbPos === "Midfielder" ? "selected" : ""}>Midfielders</option>
            <option value="Defender" ${lbPos === "Defender" ? "selected" : ""}>Defenders</option>
            <option value="Goalkeeper" ${lbPos === "Goalkeeper" ? "selected" : ""}>Goalkeepers</option>
          </select>
        </div>
      </div>

      <!-- 5. The Top 3 Podium (PW Signature Gamification) -->
      ${
        list.length >= 1 && !lbSearch.trim() && lbPos === "all"
          ? `
        <div class="lb-podium-card">
          <div class="lb-podium-title">
            <span>🎖️ TOP 3 DEDICATED PLAYERS · PODIUM</span>
          </div>
          <div class="lb-podium">
            ${renderPodiumStep(podium[1], 2)}
            ${renderPodiumStep(podium[0], 1)}
            ${renderPodiumStep(podium[2], 3)}
          </div>
        </div>
      `
          : ""
      }

      <!-- 6. Full Rankings List -->
      <div class="lb-list-card">
        <div class="lb-list-header">
          <h3>${!lbSearch.trim() && lbPos === "all" ? "Squad Rankings (#4 downwards)" : "Rankings Results"}</h3>
          <span class="lb-list-count">${!lbSearch.trim() && lbPos === "all" ? rest.length : list.length} players</span>
        </div>
        <div class="lb-list">
          ${
            (!lbSearch.trim() && lbPos === "all" ? rest : list)
              .map(renderRow)
              .join("") ||
            empty("🔍", "No players match your search filter.")
          }
        </div>
      </div>
    </div>
  `;

  // Bind Events
  const howBtn = $("lb-btn-how");
  if (howBtn) {
    howBtn.onclick = () => {
      lbHow = !lbHow;
      vLeaderboard();
    };
  }

  const refBtn = $("lb-refresh-btn");
  if (refBtn) {
    refBtn.onclick = () => fetchLeaderboard(true);
  }

  document.querySelectorAll("[data-lbs]").forEach((b) => {
    b.onclick = () => {
      lbScope = b.dataset.lbs;
      vLeaderboard();
    };
  });

  const searchInput = $("lb-search");
  if (searchInput) {
    searchInput.oninput = (e) => {
      lbSearch = e.target.value;
      vLeaderboard();
    };
  }

  const posSelect = $("lb-pos");
  if (posSelect) {
    posSelect.onchange = (e) => {
      lbPos = e.target.value;
      vLeaderboard();
    };
  }
}

function lbPreviewCard() {
  const top = (lbData && lbData.leaderboard) || [];
  const top3 = top.slice(0, 3);
  if (!top3.length) {
    return `<div id="home-lb-preview" class="card" style="margin-bottom:14px;cursor:pointer" onclick="go('leaderboard')">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <h2 style="margin:0;display:flex;align-items:center;gap:8px">🏆 Squad Leaderboard</h2>
        <span class="pill" style="font-size:0.78rem;background:var(--brand);color:#fff">Open Leaderboard ↗</span>
      </div>
      <p class="mute" style="margin:6px 0 0;font-size:0.86rem">Track training hours, attendance points, and compete on the podium.</p>
    </div>`;
  }
  return `
    <div id="home-lb-preview" class="card" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <h2 style="margin:0;display:flex;align-items:center;gap:8px">🏆 Squad Leaderboard <span class="pill g" style="font-size:0.75rem">Top Dedicated</span></h2>
        <button class="pri" style="font-size:0.82rem;padding:5px 12px;border-radius:10px" data-go="leaderboard">View Full Board ↗</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:10px">
        ${top3
          .map(
            (p, idx) => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:var(--soft);border:1px solid var(--line)">
            <span style="font-size:1.3rem">${idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>
            ${avatar(p.name, p.photo, 38)}
            <div style="min-width:0;flex:1">
              <b style="display:block;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</b>
              <span class="mute" style="font-size:0.75rem">${p.hours} hrs · ${p.points.toLocaleString()} XP</span>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
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
    `${rules ? whistleCard() : ""}${rules ? '<p class="mute">Summary of the FIH Rules of Hockey effective 1 March 2026. The full rulebook decides any dispute.</p>' : ""}
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
  bindVol("wvol", "wvolv", () => playWhistle("short"));
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
const WSND = [
  [
    "short",
    "Short blast",
    "Stop playing and look to the umpire for the signal. Used for a foul, a ball out of play or any decision.",
  ],
  ["long", "Long blast", "Start of a quarter or of the match."],
  ["double", "Two short blasts", "Goal scored. Play and time stop."],
  ["final", "Final whistle", "End of the match."],
];
const WRULES = [
  "Obey at once|play stops on the whistle. Do not play the ball or move to gain an advantage after it",
  "Start|a match or quarter begins on the umpire's whistle with a pass from the centre",
  "Stop play|the umpire whistles for a foul or breach, then shows the signal and where play restarts",
  "Advantage|while the umpire shows the advantage signal there is no whistle and play carries on",
  "Goal|the umpire whistles and points to the centre. Time and play stop after a goal (2026 rule)",
  "Penalty stroke|the taker may play only after the umpire's whistle",
  "End of a quarter or match|play ends on the umpire's whistle (a penalty corner or stroke already awarded is finished first)",
];
function whistleCard() {
  const v = Math.round(volume() * 100);
  return `<div class="card whc"><div class="whl">${whistleSvg(60)}<div><h2 style="margin:0">Umpire whistle</h2><span class="mute">Tap ▶ to hear each blast. The whistle plays only on this page.</span></div></div>
  <label class="volr"><span>🔈</span><input type="range" id="wvol" min="0" max="100" step="5" value="${v}" aria-label="Volume"><span class="mute" id="wvolv">${v}%</span></label>
  <div class="wsl">${WSND.map((w) => `<div class="wsr"><button type="button" class="wpl" data-wh="${w[0]}" aria-label="Play ${w[1]}">▶</button><span><b>${w[1]}</b><br><span class="mute">${w[2]}</span></span></div>`).join("")}</div></div>
  <details class="card" open><summary>📣 Whistle rules</summary>${lst(WRULES, "ul", "📣")}</details>`;
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
function nextPlan() {
  const d = Object.keys(PL)
    .sort()
    .find((x) => planLive(x));
  return d
    ? `<p class="note">Next playing day: <b>${fmt(d)}</b>${PL[d].time ? ", " + esc(PL[d].time) : ""}${PL[d].venue ? " · 📍 " + esc(PL[d].venue) : ""}${PL[d].note ? " · " + esc(PL[d].note) : ""}</p>`
    : "";
}
let planSel = "",
  planMon = "",
  planTags = [];
const pushMsg = (r) => {
  const p = r && r.push;
  if (!p) return "";
  if (!p.configured)
    return "\n\n⚠️ Push notifications are not configured on the server.";
  if (!p.total)
    return "\n\nNobody has turned on notifications yet, so nobody was notified.";
  return (
    "\n\n🔔 Notified " +
    p.sent +
    " of " +
    p.total +
    " phone" +
    (p.total > 1 ? "s" : "") +
    "." +
    (p.failed ? " " + p.failed + " could not be reached." : "")
  );
};
function wkOpen() {
  const t = new Date(today() + "T00:00"),
    out = [];
  for (let k = 0; k < 7; k++) {
    const d =
      t.getFullYear() +
      "-" +
      String(t.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(t.getDate()).padStart(2, "0");
    if (!PL[d] && SCH.team[dayIdx(d)][3]) out.push(d);
    t.setDate(t.getDate() + 1);
  }
  return out;
}
function vPlan() {
  const td = today(),
    ks = Object.keys(PL).sort();
  if (!planSel) planSel = ks.find((d) => planLive(d)) || td;
  if (!planMon) planMon = planSel.slice(0, 7);
  const [y, mo] = planMon.split("-").map(Number),
    lead = (new Date(y, mo - 1, 1).getDay() + 6) % 7,
    nd = new Date(y, mo, 0).getDate(),
    cells = [];
  for (let k = 0; k < lead; k++) cells.push("<span></span>");
  for (let n = 1; n <= nd; n++) {
    const d = planMon + "-" + String(n).padStart(2, "0"),
      p = PL[d],
      hasAtt = Boolean(SS[d] || Object.keys(SS).some((k) => k.startsWith(d))),
      st = p
        ? p.status === "cancelled"
          ? "cx"
          : SS[d] || hasAtt
            ? "dn"
            : "pl"
        : hasAtt
          ? "dn"
          : "";
    cells.push(
      `<button type="button" class="cd ${st} ${d === td ? "td" : ""} ${d === planSel ? "sel" : ""}" data-cd="${d}" aria-pressed="${d === planSel}" aria-label="${dlong(d)}${p ? (p.status === "cancelled" ? ", cancelled" : ", playing day") : ""}">${(SS[d] || hasAtt) && !p ? '<i class="dn"></i>' : ""}<b>${n}</b>${p ? "<i></i>" + (p.status !== "cancelled" && tagMine(p.tags) ? '<u class="tdot" title="You are tagged"></u>' : "") : !p && d >= td && SCH.team[dayIdx(d)][3] ? '<i class="wk"></i>' : ""}</button>`,
    );
  }
  const dayCard = (d) => {
    const p = PL[d];
    const sKeys = sessionsForDate(d);
    const sNums = sKeys.map((k) => sessionGlobalIndex(k)).filter(Boolean);
    const sessText =
      sNums.length > 1
        ? `Sessions #${sNums.join(", #")}`
        : sNums.length === 1
          ? `Session #${sNums[0]}`
          : "";
    if (!p) {
      if (sKeys.length > 0) {
        const totalPres = sKeys.reduce(
          (acc, k) => acc + Object.values(SS[k] || {}).filter(Boolean).length,
          0,
        );
        const subTxt = sessText ? ` · ${sessText}` : "";
        return `<p style="margin:0"><b style="font-size:1.1rem">${dlong(d)}</b> <span class="pill g">Attendance recorded${subTxt}</span></p>
        <p style="margin:6px 0 10px">🏑 <b>${sKeys.length} session${sKeys.length > 1 ? "s" : ""}</b> played${sessText ? ` (${sessText})` : ""} · <b>${totalPres}</b> attendance marks recorded.</p>
        ${admin ? `<div class="chips"><button data-a="take" data-d="${d}">View / Take attendance</button><button data-a="wa" data-d="${d}">⤴ Share</button></div>` : ""}`;
      }
      const w = SCH.team[dayIdx(d)];
      return `<p class="mute" style="margin:0 0 6px">No playing day is scheduled on ${dlong(d)}.</p>${w[3] ? `<p style="margin:0 0 10px">Weekly timetable: <b>${esc(w[1])}</b> · ⏰ ${esc(w[3])}</p>` : `<p class="mute" style="margin:0 0 10px">${esc(w[0])} is a rest day in the weekly timetable.</p>`}${admin ? `<div class="chips"><button class="pri" data-a="new">Schedule this day</button>${wkOpen().length ? `<button data-a="wk">Schedule the next 7 days</button>` : ""}</div>` : ""}`;
    }
    const c = p.status === "cancelled",
      r = SCH.team[dayIdx(d)];
    return `<p style="margin:0"><b style="font-size:1.1rem">${dlong(d)}</b> ${c ? '<span class="pill r">Cancelled</span>' : planLive(d) ? `<span class="pill g">${dlabel(d)}</span>` : d === td && !sKeys.length ? '<span class="pill">Ended</span>' : ""} ${sKeys.length ? `<span class="pill g">Attendance recorded${sessText ? " · " + sessText : ""}</span>` : ""}</p>
    <p style="margin:4px 0 0">⏰ ${esc(p.time || r[3] || "Time to be announced")}</p>${p.venue ? `<p style="margin:2px 0 0">📍 ${esc(p.venue)}</p>` : ""}<p style="margin:2px 0 0">🎯 ${esc(r[1])}</p>${p.note ? `<p style="margin:2px 0 0">📝 ${esc(p.note)}</p>` : ""}${(p.tags || []).length ? `<p style="margin:6px 0 0">🏷️ ${tagChips(p.tags)}</p>` : ""}${tagMine(p.tags) && !c ? `<p class="note" style="margin:8px 0">📌 You are tagged for this playing day.</p>` : ""}
    ${planLive(d) && !c ? availBlock(d) : ""}
    ${admin ? `<div class="chips"><button data-a="ed" data-d="${d}">✏️ Edit</button><button data-a="take" data-d="${d}">Attendance</button><button data-a="wa" data-d="${d}">⤴ Share</button><button data-a="cx" data-d="${d}">${c ? "Restore" : "Cancel"}</button><button class="dng" data-a="rm" data-d="${d}">Delete</button></div>` : ""}`;
  };
  const fd = PL[planSel] ? td : planSel;
  $("view").innerHTML =
    `${admin ? `<div class="card"><h2>Schedule a playing day</h2><div class="ctl"><input type="date" id="pd" value="${fd}"><input id="pt" placeholder="Time" size="14" value="${esc(SCH.team[dayIdx(fd)][3])}"></div><div class="ctl"><input id="pv" placeholder="Venue" maxlength="80" value="${esc(lastVenue())}" style="flex:1"></div><div class="ctl"><button type="button" id="pltg">🏷️ Tag people</button><span id="pltgs" class="tgsel"></span></div><div class="ctl"><input id="pn" name="hk-plan-note" autocomplete="off" autocorrect="off" placeholder="Note (optional), e.g. practice match" maxlength="80" style="flex:1"><button class="pri" id="pladd">Add</button></div></div>` : ""}
  <div class="card"><h2>Playing days</h2>
  <div class="calh"><button type="button" data-mn="-1" aria-label="Previous month">‹</button><b>${mfmt(planMon)}</b><button type="button" data-mn="1" aria-label="Next month">›</button><button type="button" data-tdy="1">Today</button></div>
  <div class="cal"><span class="cw">M</span><span class="cw">T</span><span class="cw">W</span><span class="cw">T</span><span class="cw">F</span><span class="cw">S</span><span class="cw">S</span>${cells.join("")}</div>
  <p class="mute calk"><span class="k pl"></span>Playing <span class="k dn"></span>Attendance taken <span class="k cx"></span>Cancelled <span class="k wk"></span>Weekly timetable, not scheduled yet</p>
  <div class="daysel">${dayCard(planSel)}</div></div>`;
  document.querySelectorAll("[data-cd]").forEach(
    (b) =>
      (b.onclick = () => {
        planSel = b.dataset.cd;
        planMon = planSel.slice(0, 7);
        vPlan();
      }),
  );
  document.querySelectorAll("[data-mn]").forEach(
    (b) =>
      (b.onclick = () => {
        const t = new Date(y, mo - 1 + +b.dataset.mn, 1);
        planMon =
          t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0");
        vPlan();
      }),
  );
  document.querySelector("[data-tdy]").onclick = () => {
    planSel = td;
    planMon = td.slice(0, 7);
    vPlan();
  };
  if (!admin) return;
  const paintPT = () => {
    $("pltgs").innerHTML = planTags.length
      ? tagChips(planTags)
      : '<span class="mute">Nobody tagged</span>';
  };
  paintPT();
  $("pltg").onclick = () =>
    pickTags(planTags, (t) => {
      planTags = t;
      paintPT();
    });
  $("pd").onchange = (e) => {
    if (e.target.value) $("pt").value = SCH.team[dayIdx(e.target.value)][3];
  };
  $("pladd").onclick = () => {
    const d = $("pd").value;
    if (!d) return;
    const ab = $("pladd");
    ab.disabled = true;
    ab.textContent = "Adding…";
    run(async () => {
      const r = await api("/api/plans/" + d, {
        method: "PUT",
        body: {
          time: $("pt").value.trim(),
          venue: $("pv").value.trim(),
          note: $("pn").value.trim(),
          status: "planned",
          tags: planTags,
        },
      });
      try {
        localStorage.setItem("hk_venue", $("pv").value.trim());
      } catch (e) {}
      planSel = d;
      planMon = d.slice(0, 7);
      planTags = [];
      await load(true);
      alert(fmt(d) + " added as a playing day." + pushMsg(r));
    }).finally(() => {
      if ($("pladd")) {
        $("pladd").disabled = false;
        $("pladd").textContent = "Add";
      }
    });
  };
  document.querySelectorAll("[data-a]").forEach(
    (b) =>
      (b.onclick = () => {
        const d = b.dataset.d,
          a = b.dataset.a;
        if (a === "new") {
          $("pd").value = planSel;
          $("pt").value = SCH.team[dayIdx(planSel)][3];
          window.scrollTo(0, 0);
          $("pt").focus();
        } else if (a === "wk") {
          const ds = wkOpen();
          if (
            !ds.length ||
            !confirm(
              "Schedule " +
                ds.length +
                " playing day(s) from the weekly timetable (" +
                ds.map(fmt).join(", ") +
                ")?",
            )
          )
            return;
          run(async () => {
            let r;
            for (const x of ds)
              r = await api("/api/plans/" + x, {
                method: "PUT",
                body: {
                  time: SCH.team[dayIdx(x)][3],
                  venue: lastVenue(),
                  note: "",
                  status: "planned",
                },
              });
            await load(true);
            alert(ds.length + " playing day(s) scheduled." + pushMsg(r));
          });
        } else if (a === "take") {
          takeDate = d;
          tab = "take";
          render();
        } else if (a === "ed") openPlanEdit(d);
        else if (a === "wa") wa(planMsg(d));
        else if (a === "cx")
          run(async () => {
            const r = await api("/api/plans/" + d, {
              method: "PUT",
              body: {
                ...PL[d],
                status: PL[d].status === "cancelled" ? "planned" : "cancelled",
              },
            });
            await load(true);
            const m = pushMsg(r);
            if (m) alert("Done." + m);
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
const photoBtns = (own, path, ph, extra) =>
  `<div class="chips" style="justify-content:center">${extra || ""}<button data-ph="c">📷 ${ph ? "Upload new" : "Add photo"}</button>${ph ? '<button data-ph="x">Remove photo</button>' : ""}<button data-cv="c">🖼️ Upload cover</button><button data-cv="x" hidden>Remove cover</button></div>`;
function bindCover(k, id) {
  document.querySelectorAll("[data-cv]").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        if (b.dataset.cv === "x") return removeCover(k, id);
        if (b.dataset.cv === "e") return editCurrentCover(k, id);
        pickFiles((f) => setCover(k, id, f[0]));
      }),
  );
  applyCover(k, id);
}
function bindPhoto(own, path, currentPhoto) {
  document.querySelectorAll("[data-ph]").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        const put = (ph) =>
          run(async () => {
            await api(own ? "/api/me/photo" : path, {
              method: "PUT",
              body: { photo: ph },
            });
            await load(true);
          });
        if (b.dataset.ph === "x") put("");
        else if (b.dataset.ph === "e") editCurrentPhoto(currentPhoto, put);
        else pickPhoto(put);
      }),
  );
}
const openProf = (k, id) => {
  if (k === "s" && TEAM[id] && TEAM[id].pid) {
    k = "p";
    id = TEAM[id].pid;
  } // captain / vice-captain who are also players show the player profile
  prof = { k, id };
  render();
  window.scrollTo(0, 0);
};
function openMyProfile() {
  if (role === "player") openProf("p", me);
  else if (MYPID && P.some((x) => x.id === MYPID)) openProf("p", MYPID);
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
  const S = Object.fromEntries(stats("all").map((x) => [x.p.id, x]));
  $("view").innerHTML = `<div class="card"><h2>Players (${P.length})</h2>
  <div class="ctl"><input id="pq" type="search" placeholder="Search name or roll no" aria-label="Search players"><button id="padd">➕ Add students</button></div>
  <p class="mute" style="margin:0 0 8px">Tap a player to open their profile.</p>
  <div class="tiles">${
    P.map((p) => {
      const s = S[p.id] || { pct: 0, pr: 0, t: 0 };
      return `<div class="pt" role="button" tabindex="0" data-pf="${p.id}" data-q="${esc((p.name + " " + p.roll + " " + (p.position || "")).toLowerCase())}">${avatar(p.name, p.photo, 46)}<span class="pi"><b>${esc(p.name)}</b><small>${esc([p.roll, p.position].filter(Boolean).join(" · ")) || "&nbsp;"}</small><span class="bar"><i style="width:${s.pct}%"></i></span></span><span class="pc"><b>${s.t ? s.pct + "%" : "–"}</b><small>${ACC.includes(p.id) ? "✔ signed up" : "not signed up"}</small></span></div>`;
    }).join("") || empty("👥", "No players yet.")
  }</div>
  ${P.length ? "" : '<p class="mute" style="text-align:center">Add students using the ➕ Add students button above.</p>'}</div>`;
  $("padd").onclick = openAdd;
  $("pq").oninput = (e) => {
    const q = e.target.value.trim().toLowerCase();
    document
      .querySelectorAll(".pt")
      .forEach((t) => (t.hidden = !!q && !t.dataset.q.includes(q)));
  };
  bindProfLinks();
}
let rmQ = "",
  rmF = "all",
  rmS = "recent",
  rmSel = new Set();
function rmItems() {
  const q = rmQ.trim().toLowerCase(),
    S = Object.fromEntries(RM.map((p) => [p.id, statsFor(p, "all")]));
  let a = RM.filter(
    (p) =>
      !q ||
      (p.name + " " + (p.roll || "") + " " + (p.position || ""))
        .toLowerCase()
        .includes(q),
  ).filter(
    (p) => rmF === "all" || (rmF === "att" ? S[p.id].t > 0 : S[p.id].t === 0),
  );
  a = a
    .slice()
    .sort(
      rmS === "name"
        ? (x, y) => x.name.localeCompare(y.name)
        : rmS === "att"
          ? (x, y) => S[y.id].pct - S[x.id].pct || x.name.localeCompare(y.name)
          : (x, y) => (y.removedAt || 0) - (x.removedAt || 0),
    );
  return { a, S };
}
function rmList() {
  const { a, S } = rmItems();
  if (!a.length)
    return empty(
      "🗑️",
      RM.length ? "No removed students match." : "No removed students.",
    );
  return `<div class="tiles">${a
    .map((p) => {
      const s = S[p.id],
        on = rmSel.has(p.id);
      return `<div class="pt gone rmc ${on ? "sel" : ""}" role="button" tabindex="0" data-pf="${p.id}">
    <label class="rck" data-stop><input type="checkbox" data-ck="${p.id}" ${on ? "checked" : ""} aria-label="Select ${esc(p.name)}"></label>${avatar(p.name, p.photo, 48)}
    <span class="pi"><b>${esc(p.name)}</b><small>${esc([p.roll, p.position].filter(Boolean).join(" · ")) || "&nbsp;"}</small>
    <small>${p.removedAt ? "Removed " + when(p.removedAt) + (p.removedBy ? " by " + esc(p.removedBy) : "") : "Removed"}</small>
    <span class="bar" style="margin:5px 0 2px"><i style="width:${s.pct}%"></i></span><small>${s.t ? `Attended ${s.pr} of ${s.t} sessions (${s.pct}%)` : "No attendance recorded"}${p.joined ? " · joined " + esc(p.joined.slice(0, 10)) : ""}</small>
    <span class="rca" data-stop><button class="pri" data-rs="${p.id}">↩ Restore</button><button data-re="${p.id}">✏️ Edit</button><button class="dng" data-rx="${p.id}" aria-label="Delete forever">🗑</button></span></span></div>`;
    })
    .join("")}</div>`;
}
function vRemoved() {
  const S = RM.map((p) => statsFor(p, "all")),
    wa2 = S.filter((x) => x.t),
    avg = wa2.length
      ? Math.round(wa2.reduce((a, x) => a + x.pct, 0) / wa2.length)
      : 0,
    mo =
      new Date().getFullYear() +
      "-" +
      String(new Date().getMonth() + 1).padStart(2, "0"),
    thisM = RM.filter((p) => {
      if (!p.removedAt) return false;
      const d = new Date(p.removedAt);
      return (
        d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") === mo
      );
    }).length;
  rmSel = new Set([...rmSel].filter((id) => RM.some((p) => p.id === id)));
  $("view").innerHTML =
    `<div class="card"><h2>Removed students (${RM.length})</h2>
  <p class="mute">They cannot log in and are not counted in team attendance. <b>Nothing is deleted</b>: e-mail, jersey details, joining date and every attendance record are kept until you delete a student forever.</p>
  <div class="stats"><div><b>${RM.length}</b>Removed</div><div><b>${wa2.length ? avg + "%" : "–"}</b>Avg attendance</div><div><b>${thisM}</b>This month</div></div>
  <div class="tkq"><input id="rmq" type="search" placeholder="Search name, roll no or position" value="${esc(rmQ)}" aria-label="Search removed students"></div>
  <div class="ctl" style="margin:8px 0"><label class="fl" style="flex:1;margin:0">Show<select id="rmf"><option value="all" ${rmF === "all" ? "selected" : ""}>Everyone</option><option value="att" ${rmF === "att" ? "selected" : ""}>Has attendance</option><option value="none" ${rmF === "none" ? "selected" : ""}>No attendance</option></select></label><label class="fl" style="flex:1;margin:0">Sort<select id="rms"><option value="recent" ${rmS === "recent" ? "selected" : ""}>Recently removed</option><option value="name" ${rmS === "name" ? "selected" : ""}>Name A to Z</option><option value="att" ${rmS === "att" ? "selected" : ""}>Attendance, high to low</option></select></label></div>
  ${RM.length ? `<div class="rmbar"><label class="rck2"><input type="checkbox" id="rmall"> Select all shown</label><span id="rmn" class="mute"></span><button class="pri" id="rmrs" disabled>↩ Restore selected</button><button class="dng" id="rmdl" disabled>🗑 Delete selected forever</button></div>` : ""}
  <div id="rmlist">${rmList()}</div></div>`;
  const sync = () => {
    const n = rmSel.size;
    if ($("rmn")) $("rmn").textContent = n ? n + " selected" : "";
    if ($("rmrs")) $("rmrs").disabled = $("rmdl").disabled = !n;
    const sh = rmItems().a;
    if ($("rmall"))
      $("rmall").checked = !!sh.length && sh.every((p) => rmSel.has(p.id));
  };
  const bind = () => {
    document
      .querySelectorAll("#rmlist [data-stop]")
      .forEach((e) => (e.onclick = (ev) => ev.stopPropagation()));
    document.querySelectorAll("[data-ck]").forEach(
      (c) =>
        (c.onchange = () => {
          c.checked ? rmSel.add(c.dataset.ck) : rmSel.delete(c.dataset.ck);
          c.closest(".rmc").classList.toggle("sel", c.checked);
          sync();
        }),
    );
    document.querySelectorAll("[data-rs]").forEach(
      (b) =>
        (b.onclick = () =>
          run(async () => {
            await api("/api/players/" + b.dataset.rs + "/restore", {
              method: "POST",
            });
            rmSel.delete(b.dataset.rs);
            await load();
          })),
    );
    document.querySelectorAll("[data-re]").forEach(
      (b) =>
        (b.onclick = () => {
          const p = RM.find((x) => x.id === b.dataset.re);
          if (p) openEdit(p, false);
        }),
    );
    document.querySelectorAll("[data-rx]").forEach(
      (b) =>
        (b.onclick = () => {
          const p = RM.find((x) => x.id === b.dataset.rx);
          if (
            p &&
            confirm(
              "Delete " +
                p.name +
                " forever? Their profile, login and details are erased. Their attendance records stay in the day-wise history. This cannot be undone.",
            )
          )
            run(async () => {
              await api("/api/players/" + p.id + "/permanent", {
                method: "DELETE",
              });
              rmSel.delete(p.id);
              await load();
            });
        }),
    );
    bindProfLinks();
    sync();
  };
  const redraw = () => {
    $("rmlist").innerHTML = rmList();
    bind();
  };
  if ($("rmq"))
    $("rmq").oninput = (e) => {
      rmQ = e.target.value;
      redraw();
    };
  $("rmf").onchange = (e) => {
    rmF = e.target.value;
    redraw();
  };
  $("rms").onchange = (e) => {
    rmS = e.target.value;
    redraw();
  };
  if ($("rmall"))
    $("rmall").onchange = (e) => {
      const sh = rmItems().a;
      sh.forEach((p) =>
        e.target.checked ? rmSel.add(p.id) : rmSel.delete(p.id),
      );
      redraw();
    };
  if ($("rmrs"))
    $("rmrs").onclick = () => {
      const ids = [...rmSel];
      if (
        !ids.length ||
        !confirm(
          "Restore " +
            ids.length +
            " student" +
            (ids.length > 1 ? "s" : "") +
            "? They can log in again and count in team attendance.",
        )
      )
        return;
      run(async () => {
        for (const id of ids) {
          await api("/api/players/" + id + "/restore", { method: "POST" });
        }
        rmSel.clear();
        await load();
      });
    };
  if ($("rmdl"))
    $("rmdl").onclick = () => {
      const ids = [...rmSel];
      if (!ids.length) return;
      const t = prompt(
        "Delete " +
          ids.length +
          " student" +
          (ids.length > 1 ? "s" : "") +
          " forever? Profiles and logins are erased and this cannot be undone.\n\nType DELETE to confirm:",
      );
      if (t !== "DELETE") return;
      run(async () => {
        for (const id of ids) {
          await api("/api/players/" + id + "/permanent", { method: "DELETE" });
        }
        rmSel.clear();
        await load();
      });
    };
  bind();
}
function vAdmins() {
  const st = [
    ["captain", "Captain"],
    ["vice", "Vice-captain"],
  ];
  $("view").innerHTML =
    `<div class="card"><h2>Team staff</h2>${st.map((s) => `<div class="row link" role="button" tabindex="0" data-sf="${s[0]}"><span class="sw-row">${avatar(s[1], STAFF[s[0]], 40)}<span><b>${s[1]}</b><br><span class="mute">Full access</span></span></span><span class="chev">›</span></div>`).join("")}</div>
  <div class="card"><h2>Admins</h2><p class="mute">Admins can take attendance and edit everything except this list. They log in under <b>Captain / Admin</b> → Admin with their name and code. Use the switch to turn an admin's access on or off without deleting them. Tap an admin to open their profile.</p>
  <div class="ctl"><label class="fl" style="flex:1;margin:0">Is this admin a<select id="akind"><option value="">Choose…</option><option value="player">Player</option><option value="instructor">Instructor</option></select></label><label class="fl" id="aplw" style="flex:1;margin:0" hidden>Which player<select id="apl"><option value="">Choose a player…</option>${P.map((x) => `<option value="${esc(x.id)}" data-n="${esc(x.name)}">${esc(x.name)}${x.roll ? " · " + esc(x.roll) : ""}</option>`).join("")}</select></label></div>
  <div class="ctl"><input id="an2" placeholder="Name (used to log in)" maxlength="40"><input id="ac" type="password" placeholder="Login code (4+ characters)" maxlength="30" autocomplete="new-password"><button class="pri" id="aadd">Add admin</button></div>
  ${ADM.map((a) => `<div class="row link" role="button" tabindex="0" data-af="${esc(a.id)}"><span class="sw-row"><button class="sw ${a.disabled ? "" : "on"}" role="switch" aria-checked="${!a.disabled}" aria-label="Access for ${esc(a.name)}" data-tg="${esc(a.id)}"></button>${avatar(a.name, a.photo, 40)}<span>${esc(a.name)}<br><span class="pill ${a.disabled ? "r" : "g"}">${a.disabled ? "Access off" : "Access on"}</span> <span class="pill">${a.kind === "player" ? "Player" : a.kind === "instructor" ? "Instructor" : "Type not set"}</span></span></span><button class="dng" data-adm="${esc(a.id)}">Remove</button></div>`).join("") || empty("🛡️", "No extra admins yet.")}</div>`;
  $("akind").onchange = () => {
    $("aplw").hidden = $("akind").value !== "player";
  };
  $("apl").onchange = () => {
    const o = $("apl").selectedOptions[0];
    if (o && o.dataset.n) $("an2").value = o.dataset.n;
  };
  $("aadd").onclick = () => {
    const kind = $("akind").value,
      pid = $("apl").value,
      name = $("an2").value.trim(),
      code = $("ac").value;
    if (!kind)
      return alert(
        "First choose whether this admin is a Player or an Instructor.",
      );
    if (kind === "player" && !pid)
      return alert("Choose which player this admin is.");
    if (!name || code.length < 4)
      return alert("Enter a name and a code of at least 4 characters.");
    run(async () => {
      await api("/api/admins", {
        method: "POST",
        body: { name, code, kind, playerId: kind === "player" ? pid : "" },
      });
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
    own = (role === "player" && p.id === me) || (MYPID && p.id === MYPID);
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
    h = `${back}<div class="card prof"><div class="cover">${canPh ? `<button type="button" class="cover-edit-btn" data-cv="e" aria-label="Edit cover" title="Edit background">${ico("edit")} <span>Edit cover</span></button>` : ""}</div><div class="pavw">${avatar(p.name, p.photo, 104, "big")}${canPh ? `<button type="button" class="photo-edit-badge" data-ph="e" aria-label="Edit photo" title="Edit photo">${ico("edit")}</button>` : ""}</div>
    <h2 class="pname">${esc(p.name)}</h2><p class="mute pc2">${esc([p.roll, p.position || "Hockey player"].filter(Boolean).join(" · "))}</p>
    <div class="chips" style="justify-content:center;margin:6px 0 10px">${gone ? '<span class="pill r">Removed</span>' : '<span class="pill g">Team member</span>'}${ACC.includes(id) || own ? '<span class="pill g">Signed up</span>' : admin ? '<span class="pill">Not signed up</span>' : ""}${p.jerseyNo ? `<span class="pill">Jersey #${esc(p.jerseyNo)}</span>` : ""}${TEAM.captain && TEAM.captain.pid === id ? '<span class="pill g">🎖️ Captain</span>' : ""}${TEAM.vice && TEAM.vice.pid === id ? '<span class="pill g">🎖️ Vice-captain</span>' : ""}${ADM.some((a) => a.kind === "player" && a.playerId === id) || (role === "admin" && MYPID === id) ? '<span class="pill g">🛡️ Admin</span>' : ""}${role !== "player" && MYPID === id ? '<span class="pill">This is you</span>' : ""}</div>
    ${canPh ? photoBtns(own, photoPath, p.photo, '<button class="pri" id="pedit">✏️ Edit profile</button>') : ""}
    ${gone ? `<div class="note">Removed ${p.removedAt ? when(p.removedAt) : ""}${p.removedBy ? " by " + esc(p.removedBy) : ""}. All details and attendance below are kept.${admin ? " Restore brings them back to the team." : ""}</div>` : ""}</div>
    <div class="grid"><div class="card"><h2>Chart</h2><div class="hero2"><div class="ring" style="--v:${a.pct}"><b>${a.pct}%</b></div>${dots ? `<div style="flex:1;min-width:150px"><p class="mute" style="margin:0 0 4px">Last ${Math.min(42, ds.length)} sessions</p><div class="dots">${dots}</div></div>` : ""}</div></div>
    <div class="card"><h2>Details</h2>${kv("Roll number", esc(p.roll))}${kv("Position", esc(p.position))}${kv("Joined", p.joined ? fmt(p.joined) : "")}
      ${kv("E-mail", p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : "")}${kv("Jersey", jersey)}
      ${admin ? `<div class="chips" style="margin-top:12px">${!gone && ACC.includes(id) ? '<button id="prst">Reset code</button>' : ""}${gone ? '<button class="pri" id="prs">Restore</button><button class="dng" id="ppm">Delete forever</button>' : '<button class="dng" id="prm">Remove from team</button>'}</div>` : ""}</div></div>`;
    $("view").innerHTML = h;
    if ($("pedit")) $("pedit").onclick = () => openEdit(p, own);
    bindCover("p", id);
    if (document.querySelector("[data-ph]")) bindPhoto(own, photoPath, p.photo);
    if ($("prst"))
      $("prst").onclick = () => {
        if (
          confirm(
            "Reset the login code for " +
              p.name +
              "? They will sign up again with a new e-mail code and choose a new code.",
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
      const lpl =
        a.kind === "player" && a.playerId
          ? [...P, ...RM].find((x) => x.id === a.playerId)
          : null;
      acts = `${kv("Role", "Admin")}${kv("Type", a.kind === "player" ? "Player" + (lpl ? " · " + esc(lpl.name) : "") : a.kind === "instructor" ? "Instructor" : "<i>not set</i>")}${lpl ? `<div class="chips"><button id="apv">👤 View player profile</button></div>` : ""}${owner && ADM.some((x) => x.id === id) ? `<div class="edit"><label class="fl">Change type<select id="ak"><option value="">Choose…</option><option value="player" ${a.kind === "player" ? "selected" : ""}>Player</option><option value="instructor" ${a.kind === "instructor" ? "selected" : ""}>Instructor</option></select></label><label class="fl" id="akpw" ${a.kind === "player" ? "" : "hidden"}>Which player<select id="akp">${P.map((x) => `<option value="${esc(x.id)}" ${a.playerId === x.id ? "selected" : ""}>${esc(x.name)}${x.roll ? " · " + esc(x.roll) : ""}</option>`).join("")}</select></label><button id="aks">Save type</button></div>` : ""}${kv("Access", a.disabled ? '<span class="pill r">Off</span>' : '<span class="pill g">On</span>')}${a.created ? kv("Added", when(a.created)) : ""}${owner && ADM.some((x) => x.id === id) ? `<div class="chips" style="margin-top:12px"><button id="atg">${a.disabled ? "Turn access on" : "Turn access off"}</button><button class="dng" id="arm">Remove admin</button></div>` : ""}`;
    } else {
      own = role === id;
      name = id === "captain" ? "Captain" : "Vice-captain";
      ph = own ? MYPH : STAFF[id];
      sub = name;
      photoPath = "";
      canPh = own;
      acts = `${kv("Role", name)}${kv("Access", "Full: attendance, players, admins")}${own && owner ? `<div class="note" style="margin-top:10px">You are not linked to a player record yet. If you also play, link yourself to get the same profile as the other players. <div class="chips"><button class="pri" id="lkme">🔗 Link my player profile</button></div></div>` : ""}`;
    }
    $("view").innerHTML =
      `${back}<div class="card prof"><div class="cover">${canPh ? `<button type="button" class="cover-edit-btn" data-cv="e" aria-label="Edit cover" title="Edit background">${ico("edit")} <span>Edit cover</span></button>` : ""}</div><div class="pavw">${avatar(name, ph, 104, "big")}${canPh ? `<button type="button" class="photo-edit-badge" data-ph="e" aria-label="Edit photo" title="Edit photo">${ico("edit")}</button>` : ""}</div><h2 class="pname">${esc(name)}</h2><p class="mute pc2">${sub}${own ? " · this is you" : ""}</p>${canPh ? photoBtns(own, photoPath, ph) : ""}</div><div class="card"><h2>Details</h2>${acts}</div>`;
    if ($("lkme")) $("lkme").onclick = openNames;
    if (k === "s") bindCover("s", id);
    if ($("apv"))
      $("apv").onclick = () =>
        openProf("p", (ADM.find((x) => x.id === id) || {}).playerId);
    if ($("ak"))
      $("ak").onchange = () => {
        $("akpw").hidden = $("ak").value !== "player";
      };
    if ($("aks"))
      $("aks").onclick = () => {
        const kd = $("ak").value;
        if (!kd) return alert("Choose Player or Instructor.");
        run(async () => {
          await api("/api/admins/" + id, {
            method: "PUT",
            body: { kind: kd, playerId: kd === "player" ? $("akp").value : "" },
          });
          await load(true);
        });
      };
    if (k === "a") bindCover("a", id);
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
  if (document.querySelector("[data-ph]")) bindPhoto(own, photoPath, ph);
}
function openEdit(p, own) {
  let d = $("eddlg");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "eddlg";
    document.body.appendChild(d);
  }
  const f = (id, l, v, o = "") =>
    `<label class="fl">${l}<input id="ed-${id}" value="${esc(v || "")}" ${o}></label>`;
  d.innerHTML = `<h2>${own ? "Edit my profile" : "Edit " + esc(p.name)}</h2>${f("n", "Name", p.name, 'maxlength="40"')}${own ? "" : f("r", "Roll number", p.roll, 'maxlength="12"')}${f("p", "Position", p.position, 'maxlength="40"')}${f("e", "E-mail", p.email, 'type="email" inputmode="email" maxlength="120"')}${f("jn", "Jersey name", p.jerseyName, 'maxlength="40"')}${f("jo", "Jersey number", p.jerseyNo, 'maxlength="4"')}${f("sz", "Jersey size", p.size, 'maxlength="6"')}${own ? "" : f("j", "Joined date", p.joined, 'type="date"')}
  <div class="ctl"><button class="pri" id="eds">Save</button><button id="edc">Cancel</button></div>`;
  $("edc").onclick = () => d.close();
  $("eds").onclick = () => {
    const g = (i) => $("ed-" + i).value.trim();
    if (!g("n")) return alert("Name is required.");
    const body = {
      name: g("n"),
      position: g("p"),
      email: g("e"),
      jerseyName: g("jn"),
      jerseyNo: g("jo"),
      size: g("sz"),
    };
    if (!own) {
      body.roll = g("r");
      body.joined = g("j");
    }
    run(async () => {
      await api(own ? "/api/me/profile" : "/api/players/" + p.id, {
        method: "PUT",
        body,
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
// ---------- medals: gold / silver / bronze for the best attendance ----------
const MEDALS = ["🥇", "🥈", "🥉"];
const medalFn = (st) => {
  const dv = [...new Set(st.map((x) => x.pct))].sort((a, b) => b - a);
  return (x) => {
    const r = dv.indexOf(x.pct);
    return r < 3 && x.pct > 0 ? MEDALS[r] : "";
  };
};
const tierMedal = (p) =>
  p >= 90
    ? ["🥇", "Gold"]
    : p >= 75
      ? ["🥈", "Silver"]
      : p >= 60
        ? ["🥉", "Bronze"]
        : null;
function podium(st, medal) {
  const cols = [1, 0, 2]
    .map((r) => ({ r, g: st.filter((x) => medal(x) === MEDALS[r]) }))
    .filter((c) => c.g.length);
  if (!cols.length) return "";
  return `<div class="pod" aria-label="Top attendance">${cols
    .map(
      (c) =>
        `<div class="pc${c.r}"><span class="pm">${MEDALS[c.r]}</span><b>${c.g
          .slice(0, 2)
          .map((x) => esc(x.p.name.split(" ")[0]))
          .join(
            ", ",
          )}${c.g.length > 2 ? " +" + (c.g.length - 2) : ""}</b><small>${c.g[0].pct}%</small><i></i></div>`,
    )
    .join("")}</div>`;
}
// =====================================================================================
// v12: gallery, team photo, Indian hockey news (home), charts (Attendance tab)
// =====================================================================================

// ---------- images: any photo -> small JPEG under a size cap ----------
function fileToImg(file, max, q, cap) {
  return new Promise((ok, no) => {
    const rd = new FileReader();
    rd.onerror = () => no(new Error("Could not read the file"));
    rd.onload = () => {
      const im = new Image();
      im.onerror = () => no(new Error("That file is not a picture"));
      im.onload = () => {
        let m = max,
          qq = q;
        for (let i = 0; i < 5; i++) {
          const s = Math.min(1, m / Math.max(im.width, im.height)),
            c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(im.width * s));
          c.height = Math.max(1, Math.round(im.height * s));
          const x = c.getContext("2d");
          x.fillStyle = "#fff";
          x.fillRect(0, 0, c.width, c.height);
          x.drawImage(im, 0, 0, c.width, c.height);
          const out = c.toDataURL("image/jpeg", qq);
          if (out.length < cap) return ok(out);
          m = Math.round(m * 0.8);
          qq = Math.max(0.5, qq - 0.06);
        }
        no(new Error("That photo is too big"));
      };
      im.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
}
function pickFiles(cb, multi) {
  const f = document.createElement("input");
  f.type = "file";
  f.accept = "image/*";
  f.multiple = !!multi;
  f.onchange = () => {
    if (f.files.length) cb([...f.files]);
  };
  f.click();
}
function ensureDlg(id) {
  let d = $(id);
  if (!d) {
    d = document.createElement("dialog");
    d.id = id;
    document.body.appendChild(d);
  }
  return d;
}
function openImg(src, title = "") {
  if (!src) return;
  const d = ensureDlg("imdlg");
  d.className = "full-mobile-lightbox";
  d.setAttribute("aria-label", title || "Image preview");
  d.setAttribute("role", "dialog");
  d.setAttribute("aria-modal", "true");
  d.innerHTML = `
    <div class="lightbox-header">
      <div class="lightbox-title">${esc(title || "Image")}</div>
      <div class="lightbox-actions">
        <a href="${src}" download="hockey_image.jpg" class="lightbox-btn" target="_blank" rel="noopener" aria-label="Download full resolution image">⬇ Save</a>
        <button type="button" class="lightbox-btn close" id="imx" aria-label="Close image">✕</button>
      </div>
    </div>
    <div class="lightbox-content">
      <img class="lightbox-img" src="${src}" alt="${esc(title || "Full image")}" decoding="async">
    </div>
  `;
  const x = d.querySelector("#imx");
  if (x) x.onclick = () => d.close();
  d.onclick = (e) => {
    if (e.target === d || e.target.classList.contains("lightbox-content")) {
      d.close();
    }
  };
  d.onkeydown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      d.close();
    }
  };
  if (!d.open) d.showModal();
  if (x) setTimeout(() => x.focus(), 60);
}

// Global click handler: tap any avatar, group photo, referee signal, or profile cover to view in full mobile view
document.addEventListener("click", (e) => {
  const img = e.target.closest(
    "img.avi, img.bigimg, img.sig, .pavw img, .gph img, #gpimg, #pgph, .cover.has",
  );
  if (!img) return;
  if (e.target.closest(".full-mobile-lightbox")) return;

  // Don't intercept if clicking interactive form controls (unless the target itself is an image)
  if (e.target.closest("button, a, input, select")) {
    if (e.target.tagName !== "IMG") return;
  }

  let src = "";
  let title = "";
  if (img.tagName === "IMG") {
    src = img.src;
    title = img.alt || img.getAttribute("title") || "";
  } else if (img.classList.contains("cover") && img.style.backgroundImage) {
    const m = img.style.backgroundImage.match(/url\(["']?([^"']+)["']?\)/);
    if (m && m[1]) {
      src = m[1];
      title = "Background Image";
    }
  }

  if (src && !src.startsWith("data:image/svg")) {
    e.stopPropagation();
    openImg(src, title);
  }
});

// ---------- state ----------
let GPH = { img: "", at: -1 },
  gphBusy = false,
  GAL = [],
  galLoaded = false,
  galBusy = false,
  galErr = "",
  NEWS = null,
  newsAt = 0,
  newsBusy = false,
  MATCHES = null;
const ago = (t) => {
  if (!t) return "";
  const h = Math.round((Date.now() - t) / 36e5);
  return h < 1
    ? "just now"
    : h < 24
      ? h + "h ago"
      : Math.round(h / 24) + "d ago";
};

// ---------- team group photo ----------
async function fetchGph(at) {
  if (gphBusy) return;
  gphBusy = true;
  try {
    if (!at) GPH = { img: "", at: 0 };
    else {
      const r = await api("/api/group-photo");
      GPH = { img: r.img || "", at };
    }
  } catch (e) {}
  gphBusy = false;
  if (tab === "me" && !prof) render();
}
async function setGroupPhoto(file) {
  try {
    const img = await cropFile(file, {
      title: "Crop team photo",
      ars: [
        ["16:9", 16 / 9],
        ["4:3", 4 / 3],
        ["Square", 1],
        ["Original", 0],
      ],
      out: 1280,
      q: 0.8,
      cap: 400000,
    });
    if (!img) return;
    await api("/api/group-photo", { method: "PUT", body: { img } });
    GPH = { img, at: -1 };
    await load(true);
  } catch (e) {
    if (e.status === 401) return load(true);
    alert("Could not save the photo: " + e.message);
  }
}
const clearGroupPhoto = () => {
  if (confirm("Remove the team group photo from the home page?"))
    run(async () => {
      await api("/api/group-photo", { method: "PUT", body: { img: "" } });
      GPH = { img: "", at: -1 };
      await load(true);
    });
};
function gphCard() {
  if (!galLoaded && !galBusy && !galErr) loadGallery();
  const has = !!GPH.img;
  const teamPhotos = (GAL || []).filter(
    (g) => g.cat === "team photo" || g.cat === "team_photo",
  );
  const body = has
    ? `<img class="gph" id="gpimg" src="${GPH.img}" alt="Team group photo">`
    : empty(
        "📸",
        GPH.at === -1
          ? "Loading photo…"
          : admin
            ? "Add the team group photo."
            : "The team group photo will appear here.",
      );
  const thumbs =
    teamPhotos.length > 0
      ? `<div style="margin-top:14px">
          <div style="font-size:0.85rem;font-weight:700;color:var(--mute);margin-bottom:8px">📸 TEAM PHOTOS (${teamPhotos.length})</div>
          <div class="chips" style="display:flex;gap:10px;overflow-x:auto;padding-bottom:6px">
            ${teamPhotos
              .map(
                (g) =>
                  `<button type="button" class="btn-gthumb" data-g="${g.id}" style="border:0;background:none;padding:0;cursor:pointer;flex-shrink:0;border-radius:10px;overflow:hidden" title="${esc(g.desc || "Team photo")}">
                    <img src="${g.thumb}" alt="${esc(g.desc || "Team photo")}" style="width:110px;height:82px;object-fit:cover;border-radius:10px;border:1px solid var(--line);display:block">
                  </button>`,
              )
              .join("")}
          </div>
        </div>`
      : "";
  const btns = admin
    ? `<div class="chips"><button id="gpset">📷 ${has ? "Change group photo" : "Add group photo"}</button>${has ? '<button id="gprm">Remove</button>' : ""}</div>`
    : "";
  return `<div class="card"><h2>Team photo</h2>${body}${thumbs}${btns}</div>`;
}

// ---------- Indian hockey: fixtures + news + history ----------
// Built-in list (from the Hockey India / tournament schedules). Admins can replace it from the menu: Edit hockey fixtures.
const DEFM = [
  [
    "2026-10-27",
    "India vs Bangladesh",
    "Hero Asian Champions Trophy · Jalandhar · 7:00 PM",
    "https://www.hockeyindia.org/",
  ],
  [
    "2026-10-29",
    "India vs China",
    "Asian Champions Trophy · Jalandhar · 7:00 PM",
    "https://www.hockeyindia.org/",
  ],
  [
    "2026-10-30",
    "India vs Japan",
    "Asian Champions Trophy · Jalandhar · 7:00 PM",
    "https://www.hockeyindia.org/",
  ],
  [
    "2026-11-01",
    "India vs Malaysia",
    "Asian Champions Trophy · Jalandhar · 7:00 PM",
    "https://www.hockeyindia.org/",
  ],
  [
    "2026-11-02",
    "India vs South Korea",
    "Asian Champions Trophy · Jalandhar · 7:00 PM",
    "https://www.hockeyindia.org/",
  ],
  [
    "2026-11-04",
    "Asian Champions Trophy semi-finals",
    "Mohali",
    "https://www.hockeyindia.org/",
  ],
  [
    "2026-11-05",
    "Asian Champions Trophy final and medal matches",
    "Mohali",
    "https://www.hockeyindia.org/",
  ],
  [
    "2026-11-19",
    "New Zealand vs India, Test series match 1",
    "Auckland",
    "https://www.fih.hockey/",
  ],
  [
    "2026-11-21",
    "New Zealand vs India, Test series match 2",
    "Auckland",
    "https://www.fih.hockey/",
  ],
  [
    "2026-11-22",
    "New Zealand vs India, Test series match 3",
    "Auckland",
    "https://www.fih.hockey/",
  ],
  [
    "2026-12-14",
    "59th Inter IIT Hockey Championship starts",
    "IIT Kharagpur · till 21 Dec",
    "https://www.interiit.com/",
  ],
];
const matchList = () =>
  (MATCHES || DEFM.map((x) => ({ d: x[0], t: x[1], v: x[2], u: x[3] })))
    .filter((m) => m.d >= today())
    .sort((a, b) => a.d.localeCompare(b.d));
const HIST = [
  [
    "1928",
    "Amsterdam Olympics",
    "India win their first Olympic gold. It starts a run of six straight Olympic titles (1928 to 1956), led by Dhyan Chand.",
  ],
  [
    "1948",
    "London Olympics",
    "First gold as an independent nation, a 4–0 win over Great Britain in the final.",
  ],
  ["1964", "Tokyo Olympics", "Gold again, beating Pakistan in the final."],
  [
    "1975",
    "Kuala Lumpur World Cup",
    "India win their only men’s World Cup, beating Pakistan 2–1 in the final.",
  ],
  ["1980", "Moscow Olympics", "The eighth and latest Olympic gold."],
  [
    "2021",
    "Tokyo Olympics",
    "Bronze, ending a 41-year wait for an Olympic medal (5–4 over Germany).",
  ],
  [
    "2023",
    "Hangzhou Asian Games",
    "Gold, with a 5–1 win over Japan in the final.",
  ],
  ["2024", "Paris Olympics", "Back-to-back bronze medals, beating Spain 2–1."],
  ["2026", "Asian Games, Aichi-Nagoya", "India defend their Asian Games gold."],
];
async function fetchNews(fresh) {
  if (newsBusy || (!fresh && NEWS && Date.now() - newsAt < 300000)) return;
  newsBusy = true;
  try {
    NEWS = await api("/api/news" + (fresh ? "?fresh=1" : ""));
    newsAt = Date.now();
  } catch (e) {
    NEWS = { latest: [], upcoming: [], err: true };
    newsAt = Date.now() - 540000;
  } // on failure try again in a minute
  newsBusy = false;
  if (tab === "me" && !prof) render();
}
const newsRows = (a) =>
  a
    .map(
      (n) =>
        `<a class="nw" href="${esc(n.u)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(n.t)}. Opens the article on ${esc(n.s || "the news site")}"><span class="nwt"><b>${esc(n.t)}</b><span class="mute">${esc(n.s)}${n.s && n.at ? " · " : ""}${ago(n.at)}</span></span><i class="nwa" aria-hidden="true">↗</i></a>`,
    )
    .join("");
const newsBox = (a, txt) =>
  !NEWS
    ? `<p class="mute">Loading news…</p>`
    : a.length
      ? newsRows(a.slice(0, 5))
      : `<p class="mute">${NEWS.err ? "News is not available right now. Check your connection and try again later." : txt}</p>`;
function upCard() {
  const rows = matchList()
    .slice(0, 8)
    .map((m) => {
      const dt = new Date(m.d + "T00:00"),
        dl = dlabel(m.d),
        url = typeof matchUrl === "function" ? matchUrl(m) : (m.u || "https://www.hockeyindia.org/");
      return `<a class="fx fx-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="View details on official portal (opens in new tab)"><div class="dbx"><b>${dt.getDate()}</b><span>${dt.toLocaleDateString("en-IN", { month: "short" })}</span></div><div class="fxi"><div style="display:flex;align-items:center;gap:6px"><b class="fx-title">${esc(m.t)}</b><span class="fx-arrow" style="font-size:0.85rem;color:var(--brand);font-weight:700">↗</span></div>${m.v ? `<span class="mute">${esc(m.v)}</span>` : ""}</div><span class="pill ${dl === "Today" || dl === "Tomorrow" ? "g" : ""}">${dl}</span></a>`;
    })
    .join("");
  return `<div class="card span2"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px"><h2>Upcoming Indian hockey</h2><a href="https://www.hockeyindia.org/" target="_blank" rel="noopener noreferrer" class="lnk" style="font-size:0.85rem;font-weight:700;display:inline-flex;align-items:center;gap:4px">Hockey India Portal ↗</a></div>${rows || empty("🗓️", "No upcoming matches in the list.")}
  <h3 class="chh">Match news</h3>${newsBox((NEWS && NEWS.upcoming) || [], "No match news found right now.")}
  ${admin ? '<div class="chips"><button id="mxe">✏️ Edit fixtures</button></div>' : ""}</div>`;
}
function newsCard() {
  return `<div class="card"><h2>Latest Indian hockey news <button class="ghost2" id="nwr" aria-label="Refresh news">↻</button></h2>${newsBox((NEWS && NEWS.latest) || [], "No recent news found.")}</div>`;
}
function histCard() {
  return `<div class="card"><h2>Indian hockey history</h2><ul class="tl">${HIST.map((h) => `<li><span class="yr">${h[0]}</span> <b>${esc(h[1])}</b><br><span class="mute">${esc(h[2])}</span></li>`).join("")}</ul></div>`;
}
function openMatches() {
  const d = ensureDlg("mxdlg"),
    cur = (MATCHES || DEFM.map((x) => ({ d: x[0], t: x[1], v: x[2], u: x[3] })))
      .slice()
      .sort((a, b) => a.d.localeCompare(b.d));
  d.innerHTML = `<h2>Indian hockey fixtures</h2><p class="mute">One per line: <b>YYYY-MM-DD | Match | Place / time | URL (optional)</b>. Matches whose date has passed are hidden automatically.</p>
  <p><textarea id="mxt" rows="10" style="width:100%">${esc(cur.map((m) => [m.d, m.t, m.v, m.u].filter((x, i) => i < 2 || x).join(" | ")).join("\n"))}</textarea></p>
  <div class="ctl"><button class="pri" id="mxs">Save</button><button id="mxr">Reset to default</button><button id="mxc">Cancel</button></div>`;
  $("mxc").onclick = () => d.close();
  $("mxr").onclick = () => {
    if (confirm("Go back to the built-in fixtures list?"))
      run(async () => {
        await api("/api/matches", { method: "PUT", body: { reset: true } });
        d.close();
        await load(true);
      });
  };
  $("mxs").onclick = () => {
    const items = [];
    for (const ln of $("mxt")
      .value.split("\n")
      .map((x) => x.trim())
      .filter(Boolean)) {
      const parts = ln.split("|").map((x) => x.trim());
      const dt = parts[0];
      const t = parts[1];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dt || "") || !t)
        return alert(
          "Check this line:\n" +
            ln +
            "\n\nUse: YYYY-MM-DD | Match | Place / time | URL (optional)",
        );
      let v = "", u = "";
      if (parts.length >= 4) {
        u = parts[parts.length - 1];
        v = parts.slice(2, -1).join(" | ");
      } else if (parts.length === 3) {
        if (/^https?:\/\//i.test(parts[2])) {
          u = parts[2];
        } else {
          v = parts[2];
        }
      }
      items.push({ d: dt, t, v, ...(u ? { u } : {}) });
    }
    run(async () => {
      await api("/api/matches", { method: "PUT", body: { items } });
      d.close();
      await load(true);
    });
  };
  d.showModal();
}

// ---------- HOME TAB (no attendance figures here; they are on the Attendance tab) ----------
function vMe() {
  fetchNews();
  fetchLeaderboard();
  const first = esc((WHO || "").split(" ")[0] || "there"),
    mine = pl ? P.find((x) => x.id === me) : null;
  const sub = pl
    ? mine
      ? [mine.position || "Hockey player", mine.roll]
          .filter(Boolean)
          .join(" · ")
      : "Hockey player"
    : role === "captain"
      ? "Captain"
      : role === "vice"
        ? "Vice-captain"
        : "Admin";
  $("view").innerHTML = `${welcomeHero()}
  ${annCard()}${featTiles()}${lbPreviewCard()}${teamCard()}
  ${gphCard()}
  <div class="grid home-cards-grid">${upCard()}${newsCard()}${histCard()}</div>`;
  bindHome();
  bindAnn();
  heroCover();
  if ($("gpset"))
    $("gpset").onclick = () => pickFiles((f) => setGroupPhoto(f[0]));
  if ($("gprm")) $("gprm").onclick = clearGroupPhoto;
  if ($("gpimg")) $("gpimg").onclick = () => openImg(GPH.img);
  document
    .querySelectorAll(".btn-gthumb[data-g]")
    .forEach((b) => (b.onclick = () => openPhoto(b.dataset.g)));
  if ($("mxe")) $("mxe").onclick = openMatches;
  if ($("nwr"))
    $("nwr").onclick = () => {
      newsAt = 0;
      NEWS = null;
      fetchNews(true);
      render();
    };
}

// ---------- GALLERY ----------
async function loadGallery() {
  galBusy = true;
  galErr = "";
  try {
    const r = await api("/api/gallery");
    GAL = r.items || [];
    galLoaded = true;
  } catch (e) {
    galErr =
      "Could not load photos: " +
      (e.status ? e.message : "check your connection");
  }
  galBusy = false;
  if (tab === "gallery" && !prof) render();
}
const GCATS = [
  ["match", "🥅", "Match"],
  ["fitness", "🏋️", "Fitness"],
  ["practice", "🏑", "Practice"],
  ["team photo", "📸", "Team photo"],
];
const gcLabel = (k) => {
  const c = GCATS.find((x) => x[0] === k);
  return c ? c[1] + " " + c[2] : "";
};
let galCat = "all";
function vGallery() {
  if (!galLoaded && !galBusy && !galErr) loadGallery();
  const cnt = (k) =>
    k === "all" ? GAL.length : GAL.filter((g) => g.cat === k).length;
  const list = galCat === "all" ? GAL : GAL.filter((g) => g.cat === galCat);
  const tabs = [["all", "🖼️", "All"], ...GCATS]
    .map(
      (c) =>
        `<button type="button" role="tab" aria-selected="${c[0] === galCat}" class="${c[0] === galCat ? "pri" : ""}" data-gc="${c[0]}">${eic(c[1])} ${c[2]} <small>${cnt(c[0])}</small></button>`,
    )
    .join("");
  const folderNote =
    galCat === "team photo"
      ? '<p class="mute" style="margin:8px 0 12px;font-size:0.86rem">🌟 <b>Team Photo Folder</b>: Photos added here are shown on the <b>Public landing page</b> and the <b>Home page</b>.</p>'
      : galCat === "all"
        ? '<p class="mute" style="margin:8px 0 12px;font-size:0.86rem">📁 4 folders: <b>Match</b>, <b>Fitness</b>, <b>Practice</b>, and <b>Team photo</b>. Only Team photos are displayed publicly.</p>'
        : '<p class="mute" style="margin:8px 0 12px;font-size:0.86rem">🔒 Photos in this folder are private to team members only and are not shown publicly.</p>';
  const grid = list.length
    ? `<div class="gal">${list.map((g) => `<figure class="gf"><button class="gi" data-g="${g.id}" aria-label="Open photo${g.desc ? ": " + esc(g.desc) : ""}"><img src="${g.thumb}" alt="${esc(g.desc || "")}" loading="lazy"></button>${g.desc ? `<figcaption>${esc(g.desc)}</figcaption>` : ""}</figure>`).join("")}</div>`
    : empty(
        "🖼️",
        galErr ||
          (galLoaded
            ? galCat === "all"
              ? "No photos yet. Add the first one!"
              : "No " +
                gcLabel(galCat).split(" ").slice(1).join(" ").toLowerCase() +
                " photos yet."
            : "Loading…"),
      );
  $("view").innerHTML =
    `<div class="card"><h2>Gallery</h2><p class="mute">Team gallery organized into 4 folders. Everyone can add photos. Admins can delete any photo; you can edit or delete your own.</p>
  <div class="chips gtabs" role="tablist" aria-label="Gallery folders">${tabs}</div>
  ${folderNote}
  <div class="ctl"><button class="pri" id="gadd">📷 Add photos</button>${galErr ? '<button id="gtry">Try again</button>' : ""}</div><p id="gup" class="mute" role="status"></p>${grid}</div>`;
  $("gadd").onclick = openUpload;
  if ($("gtry"))
    $("gtry").onclick = () => {
      galErr = "";
      galLoaded = false;
      render();
    };
  document.querySelectorAll("[data-gc]").forEach(
    (b) =>
      (b.onclick = () => {
        galCat = b.dataset.gc;
        vGallery();
      }),
  );
  document
    .querySelectorAll("[data-g]")
    .forEach((b) => (b.onclick = () => openPhoto(b.dataset.g)));
}
// section buttons used by both the upload and the edit window
const catBtns = (cur, id) =>
  `<div class="chips" id="${id}" role="radiogroup" aria-label="Folder">${GCATS.map((c) => `<button type="button" role="radio" aria-checked="${c[0] === cur}" class="${c[0] === cur ? "pri" : ""}" data-pc="${c[0]}">${eic(c[1])} ${c[2]}</button>`).join("")}</div>`;
function bindCats(id, get, set) {
  const box = $(id);
  box.querySelectorAll("[data-pc]").forEach(
    (b) =>
      (b.onclick = () => {
        set(b.dataset.pc);
        box.querySelectorAll("[data-pc]").forEach((x) => {
          const on = x.dataset.pc === get();
          x.classList.toggle("pri", on);
          x.setAttribute("aria-checked", on);
        });
      }),
  );
}
function openUpload() {
  const d = ensureDlg("upddlg");
  let cat = galCat === "all" ? "match" : galCat;
  d.innerHTML = `<h2>Add photos</h2><p class="mute" style="margin:0 0 6px">Choose folder</p>${catBtns(cat, "upc")}
  <label class="fl">Short description (optional)<input id="upd" maxlength="120" placeholder="e.g. Penalty corner drill" autocomplete="off"></label>
  <p class="mute" style="margin:0 0 8px">Choose folder: Match, Fitness, Practice, or Team photo. Only photos in "Team photo" are shown on the public landing page and home page.</p>
  <div class="ctl"><button class="pri" id="upgo">Choose photos</button><button id="upx">Cancel</button></div>`;
  bindCats(
    "upc",
    () => cat,
    (v) => (cat = v),
  );
  $("upx").onclick = () => d.close();
  $("upgo").onclick = () => {
    const desc = $("upd").value.trim();
    d.close();
    pickFiles((f) => uploadPhotos(f, cat, desc), true);
  };
  d.showModal();
}
async function uploadPhotos(files, cat, desc) {
  const st = (t) => {
    const e = $("gup");
    if (e) e.textContent = t;
  };
  let ok = 0;
  for (let i = 0; i < files.length; i++) {
    st(`Uploading ${i + 1} of ${files.length}…`);
    try {
      const img = await cropFile(files[i], {
        title:
          files.length > 1
            ? "Crop photo " + (i + 1) + " of " + files.length
            : "Crop photo",
        ars: [
          ["Original", 0],
          ["4:3", 4 / 3],
          ["Square", 1],
          ["16:9", 16 / 9],
        ],
        out: 1280,
        q: 0.8,
        cap: 400000,
        skip: true,
      });
      if (!img) continue;
      const thumb = await fileToImg(await dataToBlob(img), 360, 0.72, 55000);
      await api("/api/gallery", {
        method: "POST",
        body: { img, thumb, cat: cat || "practice", desc: desc || "" },
      });
      ok++;
    } catch (e) {
      if (e.status === 401) {
        load(true);
        return;
      }
      alert("Photo " + (i + 1) + " was not added: " + e.message);
      if (e.status === 429 || e.status === 409) break;
    }
  }
  if (ok) galCat = cat || "practice"; // show the section the photos went to
  st(
    ok
      ? `Added ${ok} photo${ok > 1 ? "s" : ""} to ${gcLabel(cat || "practice")}.`
      : "",
  );
  await loadGallery();
}
async function openPhoto(id) {
  const g = GAL.find((x) => x.id === id);
  if (!g) return;
  const d = ensureDlg("phdlg");
  let full = "";
  const can = admin || g.mine;
  const info = () =>
    `<p class="gmeta"><span class="pill">${esc(gcLabel(g.cat))}</span> <span class="mute">${esc(g.by)}${g.by && g.at ? " · " : ""}${when(g.at)}</span></p>${g.desc ? `<p class="gdesc">${esc(g.desc)}</p>` : can ? '<p class="mute gdesc">No description yet.</p>' : ""}`;
  const draw = () => {
    d.innerHTML = `<img class="bigimg" id="phi" src="${full || g.thumb}" alt="${esc(g.desc || "")}"><div id="phinfo">${info()}</div>
    <div class="ctl"><a class="btn" id="phdl" download="hockey-photo.jpg" ${full ? `href="${full}"` : "hidden"}>⬇ Save</a>${can ? '<button id="phe">✏️ Edit</button>' : ""}${admin ? `<button id="phg" ${full ? "" : "disabled"}>🖼 Use as group photo</button>` : ""}${can ? '<button id="phd" class="dng">🗑 Delete</button>' : ""}<button id="phx">Close</button></div>`;
    $("phx").onclick = () => d.close();
    if ($("phg"))
      $("phg").onclick = () => {
        if (
          full &&
          confirm("Show this photo as the team group photo on the home page?")
        )
          run(async () => {
            await api("/api/group-photo", {
              method: "PUT",
              body: { img: full },
            });
            GPH = { img: full, at: -1 };
            d.close();
            await load(true);
            alert("Done. It now shows on the Home tab.");
          });
      };
    if ($("phd"))
      $("phd").onclick = () => {
        if (confirm("Delete this photo?"))
          run(async () => {
            await api("/api/gallery/" + id, { method: "DELETE" });
            d.close();
            await loadGallery();
          });
      };
    if ($("phe"))
      $("phe").onclick = () => {
        // edit the section and the short description
        let cat = g.cat;
        $("phinfo").innerHTML =
          `<p class="mute" style="margin:8px 0 4px">Section</p>${catBtns(cat, "pec")}<label class="fl">Short description<input id="ped" maxlength="120" value="${esc(g.desc)}" placeholder="e.g. Penalty corner drill" autocomplete="off"></label><div class="ctl"><button class="pri" id="pes">Save</button><button id="pex">Cancel</button></div>`;
        bindCats(
          "pec",
          () => cat,
          (v) => (cat = v),
        );
        $("pex").onclick = draw;
        $("ped").focus();
        $("pes").onclick = () =>
          run(async () => {
            const desc = $("ped").value.trim();
            await api("/api/gallery/" + id, {
              method: "PUT",
              body: { cat, desc },
            });
            g.cat = cat;
            g.desc = desc;
            draw();
            if (tab === "gallery") vGallery();
          });
      };
  };
  draw();
  d.showModal();
  try {
    const r = await api("/api/gallery/" + id);
    full = r.img || "";
    if (full && d.open && !$("pec")) {
      $("phi").src = full;
      const a = $("phdl");
      a.href = full;
      a.hidden = false;
      if ($("phg")) $("phg").disabled = false;
    }
  } catch (e) {}
}

// ---------- CHARTS (Attendance tab): line, grouped bar, horizontal bar, donut ----------
const niceMax = (v) => {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1)))),
    f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
};
const num = (v) => String(+(+v).toFixed(1));
const mshort = (m) =>
  new Date(m + "-01T00:00").toLocaleDateString("en-IN", { month: "short" }) +
  (m.slice(5) === "01" ? " ’" + m.slice(2, 4) : "");
function gbar(cats, series, title) {
  const L = 34,
    R = 8,
    T = 16,
    B = 26,
    H = 220,
    W = Math.max(340, L + R + cats.length * 52),
    iw = W - L - R,
    ih = H - T - B;
  const top = niceMax(Math.max(1, ...series.flatMap((s) => s.v))),
    y = (v) => T + ih * (1 - v / top),
    gw = iw / cats.length,
    bw = Math.min(24, (gw * 0.8) / series.length);
  const grid = [0, top / 2, top]
    .map(
      (g) =>
        `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}"/><text x="${L - 5}" y="${y(g) + 4}" text-anchor="end">${num(g)}</text>`,
    )
    .join("");
  const bars = cats
    .map((c, i) => {
      const cx = L + gw * (i + 0.5),
        x0 = cx - (bw * series.length) / 2;
      return (
        series
          .map((s, j) => {
            const v = s.v[i],
              x = x0 + j * bw,
              h = (ih * v) / top;
            return `<rect class="gb" x="${x + 1}" y="${y(v)}" width="${bw - 2}" height="${Math.max(h, 0)}" rx="3" fill="${s.c}"><title>${esc(c)} · ${esc(s.n)}: ${num(v)}</title></rect>${bw >= 16 ? `<text class="bv" x="${x + bw / 2}" y="${y(v) - 3}" text-anchor="middle">${num(v)}</text>` : ""}`;
          })
          .join("") +
        `<text x="${cx}" y="${H - 8}" text-anchor="middle">${esc(c)}</text>`
      );
    })
    .join("");
  return `<div class="chart scx"><svg class="cs" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="${W > 340 ? "max-width:none" : "width:100%;height:auto"}" role="img" aria-label="${esc(title)}">${grid}${bars}</svg></div><div class="lg">${series.map((s) => `<span><i style="background:${s.c}"></i>${esc(s.n)}</span>`).join("")}</div>`;
}
function hbar(rows, title) {
  const rh = 27,
    L = 104,
    R = 44,
    W = 360,
    H = rows.length * rh + 6,
    iw = W - L - R;
  const col = (v) => (v >= 75 ? "var(--p)" : v >= 50 ? "var(--y)" : "var(--a)");
  const body = rows
    .map((r, i) => {
      const y = i * rh + 4,
        w = Math.max(2, (iw * r.v) / 100),
        nm = r.l.length > 15 ? r.l.slice(0, 14) + "…" : r.l;
      return `<g ${r.id ? `data-pf="${esc(r.id)}" style="cursor:pointer"` : ""}><text x="${L - 6}" y="${y + 16}" text-anchor="end" class="hl">${esc(nm)}</text><rect x="${L}" y="${y + 3}" width="${iw}" height="${rh - 12}" rx="5" fill="var(--soft)"/><rect class="hb" x="${L}" y="${y + 3}" width="${w}" height="${rh - 12}" rx="5" fill="${col(r.v)}"><title>${esc(r.l)}: ${r.v}%</title></rect><text class="bv" x="${L + w + 5}" y="${y + 16}">${r.v}%</text></g>`;
    })
    .join("");
  return `<div class="chart"><svg class="cs" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="${esc(title)}">${body}</svg></div><div class="lg"><span><i style="background:var(--p)"></i>75% or more</span><span><i style="background:var(--y)"></i>50 to 74%</span><span><i style="background:var(--a)"></i>under 50%</span></div>`;
}
function donut(segs, centre, sub, title) {
  const S = 180,
    r = 68,
    sw = 26,
    c = S / 2,
    C = 2 * Math.PI * r,
    tot = segs.reduce((a, s) => a + s.v, 0);
  if (!tot) return '<p class="mute">No data for this period.</p>';
  let off = 0;
  const arcs = segs
    .filter((s) => s.v > 0)
    .map((s) => {
      const len = (C * s.v) / tot,
        gap = segs.filter((x) => x.v > 0).length > 1 ? 2 : 0,
        o = off;
      off += len;
      return `<circle class="da" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${s.c}" stroke-width="${sw}" stroke-dasharray="${Math.max(len - gap, 0.5)} ${C}" stroke-dashoffset="${-o}" transform="rotate(-90 ${c} ${c})"><title>${esc(s.n)}: ${s.v}</title></circle>`;
    })
    .join("");
  return `<div class="dn-wrap"><svg class="cs" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" role="img" aria-label="${esc(title)}"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--soft)" stroke-width="${sw}"/>${arcs}<text x="${c}" y="${c + 4}" text-anchor="middle" class="dn-c">${esc(centre)}</text><text x="${c}" y="${c + 22}" text-anchor="middle" class="dn-s">${esc(sub)}</text></svg>
  <div class="dn-l">${segs.map((s) => `<div><i style="background:${s.c}"></i><span>${esc(s.n)}</span><b>${s.v}</b><span class="mute">${Math.round((s.v * 100) / tot)}%</span></div>`).join("")}</div></div>`;
}
// everything the four charts need, built from the same numbers as the table above them
function chartBlocks(ttl, pts, st, tr, m, vis) {
  const ms = months(),
    per = ms
      .map((k) => {
        const q = stats(k).filter((x) => x.t && vis(x)),
          n = q.length;
        if (!n) return null;
        const pr = q.reduce((a, x) => a + x.pr, 0),
          t = q.reduce((a, x) => a + x.t, 0);
        return {
          k,
          pr: admin ? pr / n : pr,
          ab: admin ? (t - pr) / n : t - pr,
          pct: t ? Math.round((pr * 100) / t) : 0,
        };
      })
      .filter(Boolean);
  const pr = st.reduce((a, x) => a + x.pr, 0),
    tt = st.reduce((a, x) => a + x.t, 0),
    ml = m === "all" ? "" : " · " + mfmt(m);
  const t1 = ttl,
    t2 = admin
      ? "Days attended vs missed by month (average per player)"
      : "My days attended vs missed by month",
    t3 = admin ? "Attendance % by player" + ml : "My attendance % by month",
    t4 = (admin ? "Team" : "My") + " present vs absent" + ml;
  const md = medalFn(st),
    rows = admin
      ? st.map((x) => ({
          l: (md(x) ? md(x) + " " : "") + x.p.name,
          v: x.pct,
          id: x.p.id,
        }))
      : per.map((x) => ({ l: mshort(x.k), v: x.pct }));
  return `<div class="card"><h2>Charts</h2>
  <h3 class="chh">${esc(t1)} <span class="pill">Line</span></h3>${pts.length ? '<div id="ch1" class="chart"></div>' : '<p class="mute">No day-by-day records for this month. Monthly totals only.</p>'}
  <h3 class="chh">${esc(t2)} <span class="pill">Grouped bar</span></h3>${
    per.length
      ? gbar(
          per.map((x) => mshort(x.k)),
          [
            { n: "Attended", c: "var(--p)", v: per.map((x) => x.pr) },
            { n: "Missed", c: "var(--a)", v: per.map((x) => x.ab) },
          ],
          t2,
        )
      : '<p class="mute">No data yet.</p>'
  }
  <h3 class="chh">${esc(t3)} <span class="pill">Horizontal bar</span></h3>${rows.length ? hbar(rows, t3) : '<p class="mute">No data yet.</p>'}
  <h3 class="chh">${esc(t4)} <span class="pill">Donut</span></h3>${donut(
    [
      { n: "Present", c: "var(--p)", v: pr },
      { n: "Absent", c: "var(--a)", v: tt - pr },
    ],
    tr + "%",
    admin ? "team turnout" : "attended",
    t4,
  )}</div>`;
}

// =====================================================================================
// v13: Training tab. Timer (stopwatch / countdown / intervals), a hand-typed health log (steps, distance, sleep, calories, height, weight),
// saved sessions + presets, and tips on how to improve. Training data is private to each person.
// =====================================================================================
const APP_V = "v17",
  ERRS = [];
addEventListener("error", (e) => {
  ERRS.push(
    String(e.message || "error").slice(0, 90) +
      " (" +
      String(e.filename || "")
        .split("/")
        .pop() +
      ":" +
      e.lineno +
      ")",
  );
  ERRS.splice(0, Math.max(0, ERRS.length - 5));
});
addEventListener("unhandledrejection", (e) => {
  ERRS.push(
    "Promise: " +
      String((e.reason && e.reason.message) || e.reason).slice(0, 90),
  );
  ERRS.splice(0, Math.max(0, ERRS.length - 5));
});
const ZC = ["#6ea0ff", "#3fcf86", "#ffb020", "#ff8a3d", "#e5484d"],
  ZN = ["Z1 very light", "Z2 light", "Z3 moderate", "Z4 hard", "Z5 maximum"];
const WKT = ["Practice", "Match", "Fitness / gym", "Run / cardio", "Other"];
let WK = [],
  wkLoaded = false,
  wkBusy = false,
  wkErr = "",
  wakeLock = null;
const lsGet = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? d : JSON.parse(v);
  } catch (e) {
    return d;
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {}
};
let T = Object.assign(
  {
    mode: "sw",
    cfg: { min: 10, work: 30, rest: 30, rounds: 8 },
    run: false,
    start: 0,
    acc: 0,
  },
  lsGet("hk_timer", {}),
);
T.cfg = Object.assign(
  { min: 10, work: 30, rest: 30, rounds: 8, q: 15, brk: 2, half: 10 },
  T.cfg,
);
T.sc = Array.isArray(T.sc) && T.sc.length === 2 ? T.sc : [0, 0];
T.hr = [];
T.lastSec = -1;
T.ph = -2;
T.beep = -1;
const tsave = () =>
  lsSet("hk_timer", {
    mode: T.mode,
    cfg: T.cfg,
    run: T.run,
    start: T.start,
    acc: T.acc,
    sc: T.sc,
  });
const tel = () => T.acc + (T.run ? Date.now() - T.start : 0);
function tplan() {
  const c = T.cfg;
  if (T.mode === "cd") return { total: c.min * 60000 };
  if (T.mode === "iv") {
    const ph = [];
    for (let i = 0; i < c.rounds; i++) {
      ph.push({
        d: c.work * 1000,
        l: "WORK · round " + (i + 1) + " of " + c.rounds,
        w: 1,
      });
      if (i < c.rounds - 1 && c.rest > 0)
        ph.push({
          d: c.rest * 1000,
          l: "REST · round " + (i + 1) + " of " + c.rounds,
          w: 0,
        });
    }
    return { phases: ph, total: ph.reduce((a, p) => a + p.d, 0) };
  }
  if (T.mode === "mt") {
    // FIH: 4 quarters, short break after Q1 and Q3, half-time after Q2
    const ph = [];
    for (let i = 0; i < 4; i++) {
      ph.push({
        d: c.q * 60000,
        l: "Quarter " + (i + 1) + " of 4",
        w: 1,
        qi: i,
      });
      if (i < 3) {
        const hf = i === 1,
          b = hf ? c.half : c.brk;
        if (b > 0)
          ph.push({
            d: b * 60000,
            l: hf ? "Half-time" : "Break after quarter " + (i + 1),
            w: 0,
          });
      }
    }
    return { phases: ph, total: ph.reduce((a, p) => a + p.d, 0) };
  }
  return { total: 0 };
}
const fmtT = (ms, up) => {
  const s = up ? Math.floor(ms / 1000) : Math.ceil(ms / 1000),
    h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60);
  return (
    (h ? h + ":" + String(m).padStart(2, "0") : m) +
    ":" +
    String(s % 60).padStart(2, "0")
  );
};
function tview() {
  const e = tel(),
    p = tplan();
  if (T.mode === "sw")
    return { t: e, txt: fmtT(e, true), lbl: "Elapsed", ph: -1 };
  if (T.mode === "cd")
    return e >= p.total
      ? { t: 0, txt: "0:00", lbl: "Done", ph: 1, fin: true }
      : { t: p.total - e, txt: fmtT(p.total - e), lbl: "Time left", ph: 0 };
  let a = 0;
  for (let i = 0; i < p.phases.length; i++) {
    const f = p.phases[i];
    if (e < a + f.d)
      return {
        t: a + f.d - e,
        txt: fmtT(a + f.d - e),
        lbl: f.l,
        ph: i,
        work: !!f.w,
      };
    a += f.d;
  }
  return {
    t: 0,
    txt: "0:00",
    lbl: T.mode === "mt" ? "Full time" : "Done",
    ph: p.phases.length,
    fin: true,
  };
}
async function wl(on) {
  try {
    if (on && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
    } else if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) {}
}
function ttick() {
  const v = tview();
  if (T.run) {
    if (v.ph !== T.ph) {
      if (T.ph !== -2 && (T.mode === "iv" || T.mode === "mt") && !v.fin) {
        playWhistle(v.work ? "long" : T.mode === "mt" ? "final" : "short");
        if (navigator.vibrate) navigator.vibrate(v.work ? [200] : [80, 60, 80]);
      }
      T.ph = v.ph;
      T.beep = -1;
    }
    if (
      T.mode !== "sw" &&
      !v.fin &&
      v.t <= 3000 &&
      !(T.mode === "mt" && v.work)
    ) {
      const c = Math.ceil(v.t / 1000);
      if (c !== T.beep) {
        T.beep = c;
        playClick();
      }
    }
    if (v.fin) {
      T.run = false;
      T.acc = tplan().total;
      playWhistle("final");
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
      wl(false);
      tsave();
      drawTimerBtns();
    }
  }
  const d = $("tdisp");
  if (d) {
    d.textContent = v.txt;
    $("tlbl").textContent = v.lbl;
    const b = $("tbox");
    if (b)
      b.className =
        "tbox" +
        (T.run && (T.mode === "iv" || T.mode === "mt")
          ? v.work
            ? " wk"
            : " rs"
          : "");
    const q = $("tq");
    if (q && T.mode === "mt") {
      const ps = tplan().phases,
        h = [0, 1, 2, 3]
          .map((n) => {
            const k = ps.findIndex((f) => f.qi === n);
            return `<span class="qc ${v.ph > k ? "done" : v.ph === k ? "cur" : ""}">Q${n + 1}</span>`;
          })
          .join("");
      if (q.dataset.s !== h) {
        q.dataset.s = h;
        q.innerHTML = h;
      }
    }
  }
}
setInterval(ttick, 200);
function tStart() {
  try {
    audio();
  } catch (e) {}
  if (T.mode !== "sw" && tview().fin) tReset(true);
  if ((T.mode === "mt" || T.mode === "iv") && T.acc === 0) playWhistle("long");
  T.start = Date.now();
  T.run = true;
  T.ph = -2;
  wl(true);
  tsave();
  ttick();
  drawTimerBtns();
}
function tPause() {
  T.acc = tel();
  T.run = false;
  wl(false);
  tsave();
  drawTimerBtns();
}
function tReset(quiet) {
  if (
    !quiet &&
    tel() > 5000 &&
    !confirm("Reset the timer? Unsaved time will be lost.")
  )
    return;
  T.run = false;
  T.acc = 0;
  T.hr = [];
  T.lastSec = -1;
  T.ph = -2;
  T.beep = -1;
  T.sc = [0, 0];
  wl(false);
  tsave();
  ttick();
  drawTimerBtns();
  drawScore();
}
const drawScore = () => {
  if ($("s0")) {
    $("s0").textContent = T.sc[0];
    $("s1").textContent = T.sc[1];
  }
};
function goal(i, d) {
  if (d > 0 && T.run) tPause(); // a goal stops the clock; the centre pass starts it again
  T.sc[i] = Math.max(0, T.sc[i] + d);
  tsave();
  drawScore();
}
function drawTimerBtns() {
  const b = $("tgo");
  if (!b) return;
  const m = T.mode === "mt";
  b.textContent = T.run
    ? m
      ? "⏸ Stop clock"
      : "⏸ Pause"
    : tel() > 0 && !tview().fin
      ? m
        ? "▶ Start clock"
        : "▶ Resume"
      : "▶ Start";
  b.className = T.run ? "big" : "pri big";
  if ($("tfin")) $("tfin").hidden = tel() < 10000 || T.run;
}
// ---------- saved sessions + presets ----------
async function loadWk() {
  wkBusy = true;
  wkErr = "";
  try {
    const r = await api("/api/workouts");
    WK = r.items || [];
    wkLoaded = true;
  } catch (e) {
    wkErr =
      "Could not load saved sessions: " +
      (e.status ? e.message : "check your connection");
  }
  wkBusy = false;
  if (tab === "train" && !prof) render();
}
const sessions = () => WK.filter((w) => w.kind !== "preset"),
  presets = () => WK.filter((w) => w.kind === "preset");
const mondayOf = (d) => {
  const t = new Date(d + "T00:00"),
    k = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - k);
  return (
    t.getFullYear() +
    "-" +
    String(t.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(t.getDate()).padStart(2, "0")
  );
};
const addDays = (d, n) => {
  const t = new Date(d + "T00:00");
  t.setDate(t.getDate() + n);
  return (
    t.getFullYear() +
    "-" +
    String(t.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(t.getDate()).padStart(2, "0")
  );
};
const zbar = (z) => {
  const t = (z || []).reduce((a, x) => a + x, 0);
  return t
    ? `<span class="zb" aria-label="Time in heart-rate zones">${z.map((x, i) => (x ? `<i style="width:${(x * 100) / t}%;background:${ZC[i]}" title="${ZN[i]}: ${Math.round(x / 60)} min"></i>` : "")).join("")}</span>`
    : "";
};
function openSave(fromTimer) {
  const d = ensureDlg("wkdlg"),
    dm = fromTimer ? Math.max(1, Math.round(tel() / 60000)) : "";
  d.innerHTML = `<h2>${fromTimer ? "Save this session" : "Add a session"}</h2>
  <label class="fl">Type<select id="wt">${WKT.map((t) => `<option ${fromTimer && T.mode === "mt" && t === "Match" ? "selected" : ""}>${t}</option>`).join("")}</select></label>
  <div class="ctl"><label class="fl" style="flex:1;margin:0">Date<input id="wd" type="date" value="${today()}"></label><label class="fl" style="flex:1;margin:0">Minutes<input id="wm" type="number" inputmode="numeric" min="1" max="720" value="${dm}"></label></div>
  <label class="fl" style="margin-top:12px">How hard was it? (1 easy to 10 maximum)<select id="wr"><option value="">Skip</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option>${n}</option>`).join("")}</select></label>
  <p class="mute" style="margin:0 0 6px">Optional</p>
  <div class="ctl"><input id="wk" type="number" inputmode="numeric" placeholder="Calories (kcal)"><input id="wkm" type="number" inputmode="decimal" step="0.1" placeholder="Distance (km)"></div>
  <p style="margin-top:10px"><input id="wn" maxlength="200" placeholder="Note (e.g. felt tired, tight hamstring)" value="${fromTimer && T.mode === "mt" && (T.sc[0] || T.sc[1]) ? "Score " + T.sc[0] + "–" + T.sc[1] : ""}"></p>
  <div class="ctl"><button class="pri" id="wsv">Save</button><button id="wcx">Cancel</button></div>`;
  $("wcx").onclick = () => d.close();
  $("wsv").onclick = () => {
    const dur = Math.round((+$("wm").value || 0) * 60);
    if (dur < 10) return alert("Enter the minutes trained.");
    const body = {
      kind: "session",
      date: $("wd").value || today(),
      type: $("wt").value,
      dur,
      rpe: +$("wr").value || 0,
      kcal: +$("wk").value || 0,
      km: +$("wkm").value || 0,
      note: $("wn").value.trim(),
      src: "manual",
    };
    run(async () => {
      await api("/api/workouts", { method: "POST", body });
      d.close();
      if (fromTimer) tReset(true);
      await loadWk();
    });
  };
  d.showModal();
}
function savePreset() {
  const name = (
    prompt('Name this timer setup (for example "Sprint 30/30"):') || ""
  )
    .trim()
    .slice(0, 40);
  if (!name) return;
  run(async () => {
    await api("/api/workouts", {
      method: "POST",
      body: { kind: "preset", name, mode: T.mode, cfg: T.cfg },
    });
    await loadWk();
  });
}
// ---------- how to improve: personal tips from your position, focus, attendance, availability and saved sessions ----------
const POSK = (x) => {
  const v = String(x || "").toLowerCase();
  return /goal|gk|keeper/.test(v)
    ? "gk"
    : /def|back|sweep/.test(v)
      ? "def"
      : /mid|half/.test(v)
        ? "mid"
        : /fwd|forw|strik|attack|wing/.test(v)
          ? "fwd"
          : "";
};
const POSTIP = {
  gk: [
    "🧤",
    "Goalkeeper focus",
    "You work in short, explosive bursts: quick dives, fast feet and reaction saves. Train short and sharp with long rests, and keep hips and hamstrings loose.",
    {
      mode: "iv",
      cfg: { work: 20, rest: 40, rounds: 8 },
      lbl: "Load 20 s on / 40 s off × 8",
    },
  ],
  def: [
    "🛡️",
    "Defender focus",
    "Defenders sprint short distances to close down, then recover and tackle. Work on 5 to 10 m acceleration and getting back fast after being beaten.",
    {
      mode: "iv",
      cfg: { work: 15, rest: 45, rounds: 10 },
      lbl: "Load 15 s on / 45 s off × 10",
    },
  ],
  mid: [
    "🔁",
    "Midfielder focus",
    "Midfielders cover the most distance. Build your aerobic base, then add repeated sprints so you can still run hard in the fourth quarter.",
    {
      mode: "iv",
      cfg: { work: 30, rest: 30, rounds: 12 },
      lbl: "Load 30 s on / 30 s off × 12",
    },
  ],
  fwd: [
    "🎯",
    "Forward focus",
    "Forwards need sharp acceleration and finishing when tired. Do 20 to 30 m sprints with good rest, then practise shooting straight after a hard effort.",
    {
      mode: "iv",
      cfg: { work: 20, rest: 40, rounds: 10 },
      lbl: "Load 20 s on / 40 s off × 10",
    },
  ],
};
const GOALS = [
  ["", "Not set"],
  ["stamina", "Stamina"],
  ["speed", "Speed"],
  ["match", "Match fitness"],
  ["recover", "Recovery"],
];
const GOALTIP = {
  stamina: [
    "🫁",
    "Your focus: stamina",
    "Do two easy steady sessions a week of 25 to 40 minutes where you can still talk, and add about 5 minutes each week.",
    { mode: "cd", cfg: { min: 30 }, lbl: "Load 30 min countdown" },
  ],
  speed: [
    "⚡",
    "Your focus: speed",
    "Sprint with full rest so every rep is fast: 6 sprints of 20 seconds with 60 seconds easy between. Stop when speed drops.",
    {
      mode: "iv",
      cfg: { work: 20, rest: 60, rounds: 6 },
      lbl: "Load 20 s on / 60 s off × 6",
    },
  ],
  match: [
    "🏟️",
    "Your focus: match fitness",
    "Play a full practice game on the Match timer (4 quarters of 15 minutes with breaks) and save it. Compare your effort quarter by quarter.",
    { mode: "mt", cfg: {}, lbl: "Load FIH match timer" },
  ],
  recover: [
    "🧘",
    "Your focus: recovery",
    "Keep sessions easy: a 20 minute walk or light jog, mobility work, plenty of water and sleep.",
    { mode: "cd", cfg: { min: 20 }, lbl: "Load 20 min countdown" },
  ],
};
function recs() {
  const ss = sessions(),
    out = [],
    td = today(),
    m0 = mondayOf(td),
    m1 = addDays(m0, -7),
    mm = (x) => x.reduce((a, w) => a + w.dur, 0) / 60;
  const tw = ss.filter((w) => w.date >= m0),
    lw = ss.filter((w) => w.date >= m1 && w.date < m0),
    l7 = ss.filter((w) => w.date > addDays(td, -7)),
    l28 = ss.filter((w) => w.date > addDays(td, -28));
  const mine = pl ? P.find((x) => x.id === me) : null,
    pk = POSK(mine && mine.position);
  // 1. safety first: marked injured for an upcoming playing day
  const injD = Object.keys(AVL)
      .sort()
      .find((d) => d >= td && AVL[d][me] && AVL[d][me].s === "injured"),
    inj = !!injD;
  if (inj)
    out.push([
      "🤕",
      "You are marked injured for " + fmt(injD),
      "Keep training light until you are fit to play: easy walking, mobility and upper-body work. If the pain is sharp or lasts, get it checked before you return to sprinting.",
    ]);
  // 2. your attendance over the last 30 days
  if (pl) {
    const ds = dates().filter(
        (d) => d > addDays(td, -30) && SS[d][me] !== undefined,
      ),
      at = ds.filter((d) => SS[d][me]).length;
    if (ds.length >= 3) {
      const pc = Math.round((at * 100) / ds.length);
      if (pc < 60)
        out.push([
          "📅",
          "Come to more practices",
          "You attended " +
            at +
            " of the last " +
            ds.length +
            " team practices (" +
            pc +
            "%). Regular practice gives the biggest gain in fitness and team play. Aim for at least 75%.",
        ]);
      else if (pc >= 90)
        out.push([
          "🌟",
          "Great attendance",
          "You attended " +
            at +
            " of the last " +
            ds.length +
            " practices (" +
            pc +
            "%). To keep improving, add one short solo session a week focused on your weak spot.",
        ]);
    }
  }
  // 3. your position and your chosen focus (skipped while injured)
  if (!inj) {
    if (pk) out.push(POSTIP[pk]);
    else if (pl)
      out.push([
        "👤",
        "Add your position",
        "Ask the captain to set your position (forward, midfielder, defender or goalkeeper) so the tips can match your role.",
      ]);
    const g = lsGet("hk_goal", "");
    if (g && GOALTIP[g]) out.push(GOALTIP[g]);
  }
  // 4. your saved sessions
  if (!ss.length)
    out.push([
      "⌚",
      "Save your first session",
      "Time a practice with the timer and save it. More tips appear here after a few sessions.",
    ]);
  else {
    const days7 = new Set(l7.map((w) => w.date)).size;
    if (days7 < 2)
      out.push([
        "🏃",
        "Train more often",
        "You trained on " +
          days7 +
          " day" +
          (days7 === 1 ? "" : "s") +
          " in the last 7 days. Aim for 3 to 5 sessions a week, including the team practices.",
      ]);
    else if (days7 >= 6)
      out.push([
        "😴",
        "Take a rest day",
        "You trained on " +
          days7 +
          " of the last 7 days. Keep at least one full rest day a week so your legs recover.",
      ]);
    if (lw.length && tw.length) {
      const a = mm(tw),
        b = mm(lw);
      if (a > b * 1.3)
        out.push([
          "📈",
          "Build up gradually",
          "This week (" +
            Math.round(a) +
            " min) is much more than last week (" +
            Math.round(b) +
            " min). Try not to raise weekly time by more than about 10 to 15% to lower injury risk.",
        ]);
      else if (a < b * 0.6)
        out.push([
          "📉",
          "Volume dropped",
          "This week has " +
            Math.round(a) +
            " min so far against " +
            Math.round(b) +
            " min last week. If it was planned, fine. If not, schedule your next sessions now.",
        ]);
    }
    const z = [0, 0, 0, 0, 0];
    let hrN = 0;
    l28.forEach((w) => {
      if (w.zones && w.zones.length === 5 && w.zones.some((x) => x)) {
        hrN++;
        w.zones.forEach((x, i) => (z[i] += x));
      }
    });
    const zt = z.reduce((a, x) => a + x, 0);
    if (hrN >= 2 && zt) {
      const hard = (z[3] + z[4]) / zt,
        base = z[1] / zt;
      if (hard > 0.4)
        out.push([
          "🔥",
          "Too much hard running",
          "About " +
            Math.round(hard * 100) +
            "% of your tracked time is in Zones 4 and 5. Make most of your work easier and keep hard efforts for planned intervals.",
        ]);
      else if (hard < 0.1 && hrN >= 3 && !inj)
        out.push([
          "⚡",
          "Add some intensity",
          "Under 10% of your tracked time is hard. Once a week try 6 to 8 repeats of 30 seconds fast and 60 seconds easy.",
          {
            mode: "iv",
            cfg: { work: 30, rest: 60, rounds: 8 },
            lbl: "Load 30 s on / 60 s off × 8",
          },
        ]);
      if (base < 0.2)
        out.push([
          "🫁",
          "Build your aerobic base",
          "Little time in Zone 2. Add one easy 20 to 30 minute steady jog where you can still talk. It helps you recover between sprints in a match.",
          { mode: "cd", cfg: { min: 25 }, lbl: "Load 25 min countdown" },
        ]);
    }
    // heart-rate trend in practices: lower average at similar effort = fitter
    const pr = ss.filter((w) => w.type === "Practice" && w.avg > 0);
    if (pr.length >= 6) {
      const a = pr.slice(0, 3).reduce((x, w) => x + w.avg, 0) / 3,
        b = pr.slice(3, 6).reduce((x, w) => x + w.avg, 0) / 3;
      if (b - a >= 3)
        out.push([
          "💪",
          "You are getting fitter",
          "Your average heart rate in your last 3 practices (" +
            Math.round(a) +
            " bpm) is lower than in the 3 before (" +
            Math.round(b) +
            " bpm). Keep the routine going.",
        ]);
      else if (a - b >= 5)
        out.push([
          "🩺",
          "Heart rate is running higher",
          "Your last 3 practices averaged " +
            Math.round(a) +
            " bpm against " +
            Math.round(b) +
            " bpm before. Poor sleep, heat, stress or not being fully recovered can cause this. Take it easier for a few days.",
        ]);
    }
    const r = ss.slice(0, 3).filter((w) => w.rpe);
    if (r.length === 3 && r.reduce((a, w) => a + w.rpe, 0) / 3 >= 8)
      out.push([
        "🛌",
        "You may be run down",
        "Your last 3 sessions felt 8 or more out of 10. Take an easy day or a shorter session before the next hard one.",
      ]);
  }
  const hs = HL.filter((x) => x.sleep > 0 && x.date > addDays(today(), -7));
  if (hs.length >= 3) {
    const a = hs.reduce((t, x) => t + x.sleep, 0) / hs.length;
    if (a < 7)
      out.push([
        "😴",
        "Sleep more",
        "Your sleep averaged " +
          a.toFixed(1) +
          " hours over the last week. Aim for 7 to 9 hours: that is when you recover and get fitter.",
      ]);
  }
  out.push([
    "🏑",
    "Hockey basics",
    "Do the Warm-up tab routine before every session, drink water, and sleep 7 to 9 hours. Recovery is when fitness improves.",
  ]);
  return out;
}
function vTrain() {
  if (!wkLoaded && !wkBusy && !wkErr) loadWk();
  const v = tview(),
    ss = sessions(),
    m0 = mondayOf(today()),
    tw = ss.filter((w) => w.date >= m0);
  const cfgIn =
    T.mode === "mt"
      ? `<label class="fl" style="flex:1;margin:0">Quarter (min)<input id="cq" type="number" min="1" max="60" value="${T.cfg.q}"></label><label class="fl" style="flex:1;margin:0">Break (min)<input id="cbk" type="number" min="0" max="30" value="${T.cfg.brk}"></label><label class="fl" style="flex:1;margin:0">Half-time (min)<input id="chf" type="number" min="0" max="60" value="${T.cfg.half}"></label>`
      : T.mode === "cd"
        ? `<label class="fl" style="flex:1;margin:0">Minutes<input id="cmin" type="number" min="1" max="600" value="${T.cfg.min}"></label>`
        : T.mode === "iv"
          ? `<label class="fl" style="flex:1;margin:0">Work (s)<input id="cwk" type="number" min="5" max="3600" value="${T.cfg.work}"></label><label class="fl" style="flex:1;margin:0">Rest (s)<input id="crs" type="number" min="0" max="3600" value="${T.cfg.rest}"></label><label class="fl" style="flex:1;margin:0">Rounds<input id="crd" type="number" min="1" max="99" value="${T.cfg.rounds}"></label>`
          : "";
  const RC = recs(),
    pre = presets()
      .map(
        (p) =>
          `<span class="pch"><button data-pr="${p.id}">${esc(p.name)}</button><button class="x" data-pd="${p.id}" aria-label="Delete ${esc(p.name)}">×</button></span>`,
      )
      .join("");
  const rows = ss
    .slice(0, 30)
    .map(
      (w) =>
        `<div class="wr"><div class="wi"><b>${fmt(w.date)} · ${esc(w.type)}</b><span class="mute">${Math.round(w.dur / 60)} min${w.avg ? " · avg " + w.avg + " / max " + w.max + " bpm" : ""}${w.rpe ? " · effort " + w.rpe + "/10" : ""}${w.kcal ? " · " + w.kcal + " kcal" : ""}${w.km ? " · " + w.km + " km" : ""}${w.steps ? " · " + w.steps + " steps" : ""}</span>${zbar(w.zones)}${w.note ? `<span class="mute">📝 ${esc(w.note)}</span>` : ""}</div><button class="x" data-wd="${w.id}" aria-label="Delete session">🗑</button></div>`,
    )
    .join("");
  $("view").innerHTML = `<div class="card"><h2>⏱ Timer</h2>
  <div class="seg">${[
    ["sw", "Stopwatch"],
    ["cd", "Countdown"],
    ["iv", "Intervals"],
    ["mt", "Match"],
  ]
    .map(
      (m) =>
        `<button type="button" data-m="${m[0]}" class="${T.mode === m[0] ? "on" : ""}">${m[1]}</button>`,
    )
    .join("")}</div>
  ${cfgIn ? `<div class="ctl">${cfgIn}</div>` : ""}
  ${T.mode === "mt" ? '<div id="tq" class="tq"></div>' : ""}<div id="tbox" class="tbox"><div id="tlbl" class="tl2">${v.lbl}</div><div id="tdisp" class="tdisp" aria-live="off">${v.txt}</div></div>
  <div class="ctl"><button id="tgo"></button><button id="tmrs">Reset</button></div>
  ${T.mode === "mt" ? `<div class="sb"><div><span class="mute">My team</span><b id="s0">${T.sc[0]}</b><span><button data-goal="0">＋ Goal</button><button class="x" data-goalm="0" aria-label="Remove a goal">−</button></span></div><span class="sbc">:</span><div><span class="mute">Opponent</span><b id="s1">${T.sc[1]}</b><span><button data-goal="1">＋ Goal</button><button class="x" data-goalm="1" aria-label="Remove a goal">−</button></span></div></div><p class="mute" style="margin:0 0 8px;text-align:center;font-size:.82rem">Like an official match: 4 quarters of 15 minutes, 2 minute breaks, 10 minute half-time. A goal stops the clock; press Start clock for the centre pass. Stop the clock for injuries or time-outs.</p>` : ""}<div class="ctl"><button class="pri" id="tfin" hidden>💾 Finish and save session</button></div>
  <div class="chips">${pre}${T.mode !== "sw" ? '<button id="tsp">＋ Save this setup</button>' : ""}<button id="tman">✍ Add a session by hand</button></div>
  ${pre ? '<p class="mute" style="margin:6px 0 0">Tap a saved setup to load it.</p>' : ""}</div>
  ${healthCard()}
  <div class="card"><h2>💡 How to improve${pl && WHO ? " · " + esc(WHO.split(" ")[0]) : ""}</h2><label class="fl" style="margin-bottom:6px">My focus<select id="goal">${GOALS.map((g) => `<option value="${g[0]}" ${lsGet("hk_goal", "") === g[0] ? "selected" : ""}>${g[1]}</option>`).join("")}</select></label><p class="mute" style="margin:0 0 6px;font-size:.85rem">Tips use your position, focus, attendance, availability and saved sessions.</p>${RC.map((r, i) => `<div class="rc"><span class="ic">${r[0]}</span><span><b>${esc(r[1])}</b><br><span class="mute">${esc(r[2])}</span>${r[3] ? `<br><button class="tipb" data-act="${i}">⏱ ${esc(r[3].lbl)}</button>` : ""}</span></div>`).join("")}<p class="mute" style="margin:10px 0 0;font-size:.8rem">General fitness tips from your saved data, not medical advice. Stop and rest if you feel dizzy, have chest pain or feel unwell.</p></div>
  <div class="card"><h2>Saved sessions</h2>${ss.length ? `<div class="stats"><div><b>${tw.length}</b>This week</div><div><b>${Math.round(tw.reduce((a, w) => a + w.dur, 0) / 60)}</b>Minutes this week</div><div><b>${ss.length}</b>Total saved</div></div>` : ""}${rows || empty("📋", wkErr || (wkLoaded ? "No saved sessions yet." : "Loading…"))}${wkErr ? '<div class="ctl"><button id="wtry">Try again</button></div>' : ""}<p class="mute" style="margin:8px 0 0;font-size:.8rem">Only you can see your training data.</p></div>`;
  drawTimerBtns();
  ttick();
  document.querySelectorAll("[data-m]").forEach(
    (b) =>
      (b.onclick = () => {
        if (T.run || tel() > 0) {
          if (!confirm("Switching timer type resets the timer. Continue?"))
            return;
          tReset(true);
        }
        T.mode = b.dataset.m;
        tsave();
        vTrain();
      }),
  );
  const bindCfg = (id, k, lo, hi) => {
    const e = $(id);
    if (e)
      e.onchange = () => {
        T.cfg[k] = Math.max(lo, Math.min(hi, Math.round(+e.value) || lo));
        e.value = T.cfg[k];
        tsave();
        ttick();
      };
  };
  bindCfg("cq", "q", 1, 60);
  bindCfg("cbk", "brk", 0, 30);
  bindCfg("chf", "half", 0, 60);
  bindCfg("cmin", "min", 1, 600);
  bindCfg("cwk", "work", 5, 3600);
  bindCfg("crs", "rest", 0, 3600);
  bindCfg("crd", "rounds", 1, 99);
  $("tgo").onclick = () => (T.run ? tPause() : tStart());
  $("tmrs").onclick = () => tReset();
  $("tfin").onclick = () => {
    if (T.run) tPause();
    openSave(true);
  };
  $("tman").onclick = () => openSave(false);
  if ($("tsp")) $("tsp").onclick = savePreset;
  document
    .querySelectorAll("[data-goal]")
    .forEach((b) => (b.onclick = () => goal(+b.dataset.goal, 1)));
  document
    .querySelectorAll("[data-goalm]")
    .forEach((b) => (b.onclick = () => goal(+b.dataset.goalm, -1)));
  $("goal").onchange = (e) => {
    lsSet("hk_goal", e.target.value);
    vTrain();
  };
  document.querySelectorAll("[data-act]").forEach(
    (b) =>
      (b.onclick = () => {
        const a = RC[+b.dataset.act][3];
        if (!a) return;
        if (T.run || tel() > 0) {
          if (!confirm("Load this setup and reset the timer?")) return;
          tReset(true);
        }
        T.mode = a.mode;
        T.cfg = Object.assign({}, T.cfg, a.cfg);
        tsave();
        vTrain();
        window.scrollTo(0, 0);
      }),
  );
  bindHealth();
  document.querySelectorAll("[data-pr]").forEach(
    (b) =>
      (b.onclick = () => {
        const p = WK.find((x) => x.id === b.dataset.pr);
        if (!p) return;
        if (T.run || tel() > 0) {
          if (!confirm("Load this setup and reset the timer?")) return;
          tReset(true);
        }
        T.mode = p.mode;
        T.cfg = Object.assign({}, T.cfg, p.cfg);
        tsave();
        vTrain();
      }),
  );
  document.querySelectorAll("[data-pd]").forEach(
    (b) =>
      (b.onclick = () => {
        if (confirm("Delete this saved setup?"))
          run(async () => {
            await api("/api/workouts/" + b.dataset.pd, { method: "DELETE" });
            await loadWk();
          });
      }),
  );
  document.querySelectorAll("[data-wd]").forEach(
    (b) =>
      (b.onclick = () => {
        if (confirm("Delete this session?"))
          run(async () => {
            await api("/api/workouts/" + b.dataset.wd, { method: "DELETE" });
            await loadWk();
          });
      }),
  );
  if ($("wtry"))
    $("wtry").onclick = () => {
      wkErr = "";
      wkLoaded = false;
      render();
    };
}

// ---------- bug reports ----------
let BG = [],
  bgLoaded = false,
  bgBusy = false,
  bgErr = "";
const bugInfo = () =>
  [
    "App " + APP_V,
    "role " + role,
    "page " + tab,
    "screen " + innerWidth + "x" + innerHeight,
    standalone() ? "installed app" : "browser",
    navigator.onLine ? "online" : "offline",
    (navigator.userAgent.match(
      /(Android [\d.]+|iPhone OS [\d_]+|Windows NT [\d.]+|Mac OS X [\d_]+)/,
    ) || [""])[0],
    (navigator.userAgent.match(/(Chrome|Firefox|Safari|Edg)\/[\d.]+/) || [
      "",
    ])[0],
    ERRS.length ? "errors: " + ERRS.slice(-3).join(" | ") : "",
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 600);
function openBug() {
  const d = ensureDlg("bgdlg");
  let shot = "";
  d.innerHTML = `<h2>🐞 Report a bug</h2><p class="mute">Tell us what went wrong. More detail means a faster fix.</p>
  <label class="fl">Where did it happen?<select id="bgp">${tabsFor()
    .map(
      (t) => `<option ${t[0] === tab ? "selected" : ""}>${esc(t[2])}</option>`,
    )
    .join(
      "",
    )}<option>Login or menu</option><option>Other</option></select></label>
  <label class="fl">What happened?<textarea id="bgt" rows="4" maxlength="1000" placeholder="What I did, what I expected, what happened instead" style="width:100%"></textarea></label>
  <div class="ctl"><button id="bgs">📷 Add screenshot</button></div><p id="bgi" class="mute" role="status"></p>
  <label class="fl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="bgd" checked style="width:auto"> Include app and device details (never passwords)</label>
  <div class="ctl"><button class="pri" id="bgsend">Send report</button><button id="bgx">Cancel</button></div>`;
  $("bgx").onclick = () => d.close();
  $("bgs").onclick = () =>
    pickFiles((f) =>
      fileToImg(f[0], 900, 0.7, 240000)
        .then((x) => {
          shot = x;
          $("bgi").textContent = "Screenshot added.";
        })
        .catch((e) => alert(e.message)),
    );
  $("bgsend").onclick = () => {
    const text = $("bgt").value.trim();
    if (text.length < 5) return alert("Please describe what went wrong.");
    run(async () => {
      await api("/api/bugs", {
        method: "POST",
        body: {
          text,
          page: $("bgp").value,
          info: $("bgd").checked ? bugInfo() : "",
          shot,
        },
      });
      d.close();
      alert("Thank you. Your report was sent.");
    });
  };
  d.showModal();
}
async function loadBugs() {
  bgBusy = true;
  bgErr = "";
  try {
    const r = await api("/api/bugs");
    BG = r.items || [];
    bgLoaded = true;
  } catch (e) {
    bgErr =
      "Could not load reports: " +
      (e.status ? e.message : "check your connection");
  }
  bgBusy = false;
  if (tab === "bugs" && !prof) render();
}
const bugText = (b) =>
  `🐞 *Hockey app bug*\nPage: ${b.page || "-"}\nFrom: ${b.by || "-"} (${b.role})\nDate: ${when(b.at)}\n\n${b.text}${b.info ? "\n\nDetails: " + b.info : ""}`;
function vBugs() {
  if (!bgLoaded && !bgBusy && !bgErr) loadBugs();
  const open = BG.filter((b) => b.status !== "fixed"),
    fixed = BG.filter((b) => b.status === "fixed");
  const row = (
    b,
  ) => `<div class="bgc ${b.status === "fixed" ? "fx2" : ""}"><div class="bgh"><b>${esc(b.page || "Bug")}</b><span class="pill ${b.status === "fixed" ? "g" : "r"}">${b.status === "fixed" ? "Fixed" : "Open"}</span></div><p style="margin:4px 0">${esc(b.text)}</p><span class="mute" style="font-size:.82rem">${esc(b.by || "")} (${esc(b.role)}) · ${when(b.at)}</span>${b.info ? `<details class="hlp"><summary>Device details</summary><p class="mute">${esc(b.info)}</p></details>` : ""}
  <div class="chips">${b.hasShot ? `<button data-bs="${b.id}">🖼 Screenshot</button>` : ""}<button data-bsh="${b.id}">⤴ Share</button><button data-bst="${b.id}">${b.status === "fixed" ? "Reopen" : "✔ Mark fixed"}</button><button class="x" data-bdl="${b.id}">🗑</button></div></div>`;
  $("view").innerHTML =
    `<div class="card"><h2>Bug reports (${open.length} open)</h2><p class="mute">Sent by team members from the menu → Report a bug.</p>${BG.length ? open.map(row).join("") + (fixed.length ? `<h3 class="chh">Fixed (${fixed.length})</h3>` + fixed.map(row).join("") : "") : empty("🎉", bgErr || (bgLoaded ? "No bug reports." : "Loading…"))}${bgErr ? '<div class="ctl"><button id="bgtry">Try again</button></div>' : ""}</div>`;
  if ($("bgtry"))
    $("bgtry").onclick = () => {
      bgErr = "";
      bgLoaded = false;
      render();
    };
  document.querySelectorAll("[data-bs]").forEach(
    (b) =>
      (b.onclick = () =>
        run(async () => {
          const r = await api("/api/bugs/" + b.dataset.bs + "/shot");
          if (r.img) openImg(r.img);
        })),
  );
  document.querySelectorAll("[data-bsh]").forEach(
    (b) =>
      (b.onclick = () => {
        const x = BG.find((y) => y.id === b.dataset.bsh);
        if (x) shareText(bugText(x), "Hockey app bug");
      }),
  );
  document.querySelectorAll("[data-bst]").forEach(
    (b) =>
      (b.onclick = () => {
        const x = BG.find((y) => y.id === b.dataset.bst);
        if (x)
          run(async () => {
            await api("/api/bugs/" + x.id, {
              method: "PUT",
              body: { status: x.status === "fixed" ? "open" : "fixed" },
            });
            await loadBugs();
          });
      }),
  );
  document.querySelectorAll("[data-bdl]").forEach(
    (b) =>
      (b.onclick = () => {
        if (confirm("Delete this report?"))
          run(async () => {
            await api("/api/bugs/" + b.dataset.bdl, { method: "DELETE" });
            await loadBugs();
          });
      }),
  );
}

boot();
setInterval(() => {
  if (token && !document.hidden) {
    load();
    checkAlerts();
  }
}, 20000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    load();
    checkAlerts();
  }
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
const NEEDR = ["injured", "out", "maybe"];
const reasonBox = (d, id, cur, why) =>
  NEEDR.includes(cur)
    ? `<span class="rsn"><input type="text" maxlength="120" placeholder="Reason (e.g. exam, unwell, out of town)" value="${esc(why || "")}" data-rd="${d}" data-rid="${esc(id)}" aria-label="Reason"><button type="button" data-rsv>${why ? "Update" : "Save"}</button></span>`
    : "";
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
  let h = "";
  const myId = role === "player" ? me : MYPID || "";
  if (myId) {
    const cur = ((AVL[d] || {})[myId] || {}).s || "";
    h += `<div class="avb"><div class="mute" style="margin:6px 0 4px">${compact ? "" : "<b>Your availability:</b> "}${cur ? "You marked: <b>" + avLabel(cur) + "</b>. Tap again to clear." : "Mark if you will be on the field."}</div>${avChips(d, myId, cur)}${reasonBox(d, myId, cur, ((AVL[d] || {})[myId] || {}).why)}</div>`;
  }
  if (admin) {
    const { c, none } = avCounts(d);
    h += `<div class="avb" style="${myId ? "margin-top:6px;" : ""}"><span class="avs">${AVS.map((a) => `<span class="${a[0]}">${a[1]} <b>${c[a[0]]}</b></span>`).join("")}<span class="none">⏳ <b>${none}</b> no reply</span></span> <button type="button" data-avd="${d}">Team availability</button></div>`;
  }
  return h;
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
  if (o) {
    openAvail(o.dataset.avd);
    return;
  }
  const sv = e.target.closest && e.target.closest("[data-rsv]");
  if (sv) {
    const inp = sv.parentNode.querySelector("input"),
      d = inp.dataset.rd,
      id = inp.dataset.rid,
      cur = ((AVL[d] || {})[id] || {}).s || "";
    if (!cur) return;
    run(async () => {
      await api("/api/avail/" + d, {
        method: "PUT",
        body: { id, s: cur, reason: inp.value.trim() },
      });
      await load();
      if ($("avdlg").open) drawAvail(d);
    });
  }
});
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Enter" &&
    e.target.matches &&
    e.target.matches("input[data-rd]")
  ) {
    e.preventDefault();
    e.target.parentNode.querySelector("[data-rsv]").click();
  }
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
  <div class="avl">${ps.map((p) => `<div class="avr"><span class="avn">${avatar(p.name, p.photo, 28)} ${esc(p.name)}</span>${avChips(d, p.id, (r[p.id] || {}).s || "")}${reasonBox(d, p.id, (r[p.id] || {}).s || "", (r[p.id] || {}).why)}</div>`).join("")}</div>
  <div class="ctl"><button type="button" class="pri" id="avsh">⤴ Share list</button><button type="button" id="avx">Close</button></div>`;
  $("avx").onclick = () => dg.close();
  $("avsh").onclick = () => {
    const g = (k) =>
      ps
        .filter((p) => ((r[p.id] || {}).s || "") === k)
        .map(
          (p) => "• " + p.name + (r[p.id].why ? " (" + r[p.id].why + ")" : ""),
        )
        .join("\n");
    const part = (k, t) => (g(k) ? `\n${t}\n${g(k)}\n` : "");
    shareText(
      `🏑 *IITP Hockey: Availability*\n📅 ${dlong(d)}${PL[d] && PL[d].venue ? "\n📍 " + PL[d].venue : ""}\n` +
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
    locked = Boolean(SS[d] || sessionsForDate(d).length > 0);
  dg.innerHTML = `<h2>Edit playing day</h2>
  <p><label class="lbl">Date</label><input type="date" id="ed_d" value="${d}" ${locked ? "disabled" : ""}>${locked ? '<span class="mute" style="display:block">Attendance is already saved for this day, so the date is locked.</span>' : ""}</p>
  <p><label class="lbl">Time</label><input id="ed_t" value="${esc(p.time || "")}" placeholder="e.g. 6:30–8:30 PM" maxlength="30"></p>
  <p><label class="lbl">Venue</label><input id="ed_v" value="${esc(p.venue || "")}" placeholder="e.g. Sports Complex" maxlength="80"></p>
  <p><label class="lbl">Note</label><input id="ed_n" value="${esc(p.note || "")}" placeholder="Optional" maxlength="80"></p>
  <div class="fl">Tagged people<div id="ed_g" class="tgsel"></div><button type="button" id="ed_gb">🏷️ Tag people</button></div>
  <div class="ctl"><button class="pri" id="ed_s">Save</button><button id="ed_x">Cancel</button></div>`;
  $("ed_x").onclick = () => dg.close();
  let et = (p.tags || []).slice();
  const paintET = () => {
    $("ed_g").innerHTML = et.length
      ? tagChips(et)
      : '<span class="mute">Nobody tagged</span>';
  };
  paintET();
  $("ed_gb").onclick = () =>
    pickTags(et, (t) => {
      et = t;
      paintET();
    });
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
          tags: et,
        },
      });
      dg.close();
      await load(true);
    });
  dg.showModal();
}
