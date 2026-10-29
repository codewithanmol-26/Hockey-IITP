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
    "Turnout Analytics",
    "Monthly attendance %, practice history, and visual turnout charts.",
  ],
  [
    "📅",
    "Practice Scheduling",
    "Live schedule of playing days with real-time status and cancellations.",
  ],
  [
    "⏰",
    "Weekly Routine",
    "Morning sprint conditioning & evening turf drills for squad and goalkeepers.",
  ],
  [
    "📖",
    "FIH Rules & Whistle",
    "Official 2026 hockey rules, umpire signals, and synthesised umpire whistle.",
  ],
  [
    "🔥",
    "Warm-Up Drills",
    "Cardio, dynamic flexibility, dynamic stretching routines, and post-session cool-downs.",
  ],
  [
    "⏱",
    "Training & Health Log",
    "Match clock, interval timers, fitness records, distance, and hydration logs.",
  ],
  [
    "🖼️",
    "Squad Action Gallery",
    "High-resolution photos from Inter-IIT tournaments and training camps.",
  ],
  [
    "🔔",
    "Match & Practice Alerts",
    "Instant push notifications for practice updates and schedule changes.",
  ],
];

function initFontSizer() {
  const SIZES = [14, 15, 16, 17, 18, 20];
  let cur = 16;
  try {
    const saved = parseInt(localStorage.getItem("hk_fs") || "16", 10);
    if (saved && SIZES.includes(saved)) cur = saved;
  } catch (e) {}
  const apply = (sz) => {
    cur = sz;
    document.documentElement.style.setProperty("--app-fs", sz + "px");
    try {
      localStorage.setItem("hk_fs", sz);
    } catch (e) {}
  };
  apply(cur);
  const up = () => {
    const idx = SIZES.indexOf(cur);
    if (idx < SIZES.length - 1) apply(SIZES[idx + 1]);
  };
  const down = () => {
    const idx = SIZES.indexOf(cur);
    if (idx > 0) apply(SIZES[idx - 1]);
  };
  ["pfs-up", "afs-up"].forEach((id) => {
    const b = gid(id);
    if (b) b.onclick = up;
  });
  ["pfs-down", "afs-down"].forEach((id) => {
    const b = gid(id);
    if (b) b.onclick = down;
  });
}

function pubPlayWhistle(kind) {
  if (typeof playWhistle === "function") {
    playWhistle(kind);
  } else {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const c = new AudioCtx();
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = 2850;
      g.gain.value = 0.3;
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + 0.3);
    } catch (e) {}
  }
}

function teamBlock(team) {
  const t = team || {};
  const coachName = (t.coach && t.coach.name) || DEFNAME.coach;
  const captName = (t.captain && t.captain.name) || DEFNAME.captain;
  const viceName = (t.vice && t.vice.name) || DEFNAME.vice;

  return `<div class="leadership-cards">
    <div class="leader-card featured">
      <div class="user-drawer-avatar">${avatar(coachName, (t.coach && t.coach.photo) || "", 68)}</div>
      <div class="leader-meta">
        <span class="leader-role-badge">Head Coach & Director</span>
        <h3 class="leader-name">${esc(coachName)}</h3>
        <p class="leader-bio">Leading IIT Patna Field Hockey with elite tactical training, circle penetration strategies, and conditioning.</p>
      </div>
    </div>
    <div class="leader-card">
      <div class="user-drawer-avatar">${avatar(captName, (t.captain && t.captain.photo) || "", 60)}</div>
      <div class="leader-meta">
        <span class="leader-role-badge" style="background:#f59e0b22;color:#d97706">Team Captain</span>
        <h3 class="leader-name">${esc(captName)}</h3>
        <p class="leader-bio">On-field commander, midfield distributor & squad coordination.</p>
      </div>
    </div>
    <div class="leader-card">
      <div class="user-drawer-avatar">${avatar(viceName, (t.vice && t.vice.photo) || "", 60)}</div>
      <div class="leader-meta">
        <span class="leader-role-badge" style="background:#3b82f622;color:#2563eb">Vice-Captain</span>
        <h3 class="leader-name">${esc(viceName)}</h3>
        <p class="leader-bio">Defense anchor & squad fitness coordinator.</p>
      </div>
    </div>
  </div>
  ${t.about ? `<div class="note" style="margin-top:14px;background:var(--soft);border-left:4px solid var(--accent);padding:14px 18px;border-radius:10px;font-size:0.92rem;line-height:1.55;color:var(--ink)"><b>About our Squad:</b><br>${esc(t.about).replace(/\n/g, "<br>")}</div>` : ""}`;
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

const DEF_MATCHES = [
  {
    d: "2026-11-15",
    t: "IIT Patna vs IIT BHU",
    v: "Sports Complex Main Turf",
    u: "https://www.hockeyindia.org/",
  },
  {
    d: "2026-11-28",
    t: "Patna Inter-Collegiate Hockey Cup",
    v: "IIT Patna Ground",
    u: "https://www.hockeyindia.org/",
  },
  {
    d: "2026-12-18",
    t: "Inter-IIT Sports Meet 2026",
    v: "IIT Delhi Stadium",
    u: "https://www.interiit.com/",
  },
];

function matchUrl(m) {
  if (m && m.u && /^https?:\/\//i.test(m.u)) return m.u;
  const t = ((m && m.t) || "").toLowerCase();
  const v = ((m && m.v) || "").toLowerCase();
  if (t.includes("inter iit") || v.includes("inter iit") || t.includes("inter-iit")) {
    return "https://www.interiit.com/";
  }
  if (
    t.includes("new zealand") ||
    t.includes("australia") ||
    t.includes("olympic") ||
    t.includes("pro league") ||
    t.includes("world cup") ||
    t.includes("fih")
  ) {
    return "https://www.fih.hockey/";
  }
  return "https://www.hockeyindia.org/";
}

const getDLabel = (d) => {
  if (typeof dlabel === "function") return dlabel(d);
  if (!d) return "";
  const td =
    typeof today === "function"
      ? today()
      : new Date().toISOString().slice(0, 10);
  const n = Math.round(
    (new Date(d + "T00:00") - new Date(td + "T00:00")) / 864e5,
  );
  return n === 0 ? "Today" : n === 1 ? "Tomorrow" : "In " + n + " days";
};

function pubMatches() {
  const src =
    PUB && PUB.matches && PUB.matches.length
      ? PUB.matches
      : typeof DEFM !== "undefined" && DEFM && DEFM.length
        ? DEFM.map((x) => ({ d: x[0], t: x[1], v: x[2], u: x[3] }))
        : DEF_MATCHES;
  const td =
    typeof today === "function"
      ? today()
      : new Date().toISOString().slice(0, 10);
  return src
    .filter((m) => m && m.d && m.d >= td)
    .sort((a, b) => a.d.localeCompare(b.d))
    .slice(0, 5);
}

function drawPublic() {
  const p = PUB;
  const inst = !standalone();
  const nextMatch = pubMatches()[0];

  const news = (a) =>
    !p
      ? '<p class="mute">Loading latest updates…</p>'
      : a && a.length
        ? newsRows(a.slice(0, 4))
        : '<p class="mute">No news found right now.</p>';

  const fx = pubMatches()
    .map((m) => {
      const dt = new Date(m.d + "T00:00");
      const url = matchUrl(m);
      return `<a class="fx fx-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="View details on official portal (opens in new tab)" style="border-radius:14px;background:var(--soft);border:1px solid var(--line);padding:12px;margin-bottom:8px;text-decoration:none">
        <div class="dbx" style="background:var(--navy);color:#fff;border-radius:10px;min-width:48px;padding:6px;text-align:center">
          <b style="font-size:1.15rem;display:block;line-height:1">${dt.getDate()}</b>
          <span style="font-size:0.75rem;text-transform:uppercase;color:#fde68a">${dt.toLocaleDateString("en-IN", { month: "short" })}</span>
        </div>
        <div class="fxi" style="flex:1">
          <div style="display:flex;align-items:center;gap:6px">
            <b class="fx-title" style="font-size:0.95rem;color:var(--ink)">${esc(m.t)}</b>
            <span class="fx-arrow" style="font-size:0.85rem;color:var(--brand);font-weight:700">↗</span>
          </div>
          ${m.v ? `<span class="mute" style="display:block;font-size:0.8rem;margin-top:2px">📍 ${esc(m.v)}</span>` : ""}
        </div>
        <span class="pill ${getDLabel(m.d) === "Today" || getDLabel(m.d) === "Tomorrow" ? "g" : "y"}">${getDLabel(m.d)}</span>
      </a>`;
    })
    .join("");

  const photos =
    p && p.groupPhoto
      ? `<div class="group-photo-container" id="pgph">
          <img class="gph" src="${p.groupPhoto}" alt="IIT Patna Hockey Team Squad Group Photo" loading="lazy">
          <div class="group-photo-overlay">
            <div>
              <div class="gpo-title">IIT Patna Hockey Squad</div>
              <div class="gpo-sub">Main Hockey Turf · IIT Patna Sports Complex</div>
            </div>
            <span class="pill" style="background:rgba(255,255,255,0.2);color:#fff;backdrop-filter:blur(6px)">Tap to view full screen 🔍</span>
          </div>
        </div>`
      : empty(
          "📸",
          p ? "The team photo will appear here." : "Loading squad photo…",
        );

  const thumbs =
    p && p.gallery && p.gallery.length
      ? `<div class="gallery-thumbs-grid">${p.gallery.map((src, i) => `<div class="g-thumb-item" data-gthumb="${esc(src)}" title="Open photo"><img src="${esc(src)}" alt="IIT Patna Hockey Team Photo ${i + 1}" loading="lazy"></div>`).join("")}</div>`
      : "";

  gid("pview").innerHTML = `
    <!-- 1. Hero Section -->
    <section class="pub-hero" id="pub-hero">
      <div class="hero-crest-badge">
        <img src="icons/iitp-hockey-crest.svg" alt="IIT Patna Crest">
        Official Collegiate Portal · IIT Patna Athletics
      </div>
      <h1 class="hero-title">IIT PATNA <span class="accent-text">HOCKEY</span></h1>
      <p class="hero-tagline">Tradition · Precision · Speed on Turf. Representing the Indian Institute of Technology Patna with pride and competitive fire.</p>

      <div class="next-session-live-card">
        <div class="nsl-left">
          <div class="pulse-indicator">
            <div class="ring"></div>
            <div class="dot"></div>
          </div>
          <div class="nsl-meta">
            <span class="nsl-tag">Next Regular Session</span>
            <span class="nsl-title">${nextMatch ? esc(nextMatch.t) : "Field Practice & Tactical Drills"}</span>
            <span class="nsl-venue">📍 ${nextMatch && nextMatch.v ? esc(nextMatch.v) : "Main Turf Pitch, IIT Patna Sports Complex"}</span>
          </div>
        </div>
        <div class="nsl-countdown">${nextMatch ? getDLabel(nextMatch.d) + " · " + nextMatch.d : "Today · 5:30 PM - 7:30 PM"}</div>
      </div>

      <div class="hero-cta-group">
        <button class="btn-hero-primary" data-plog>
          <span>Member Login &amp; Attendance</span> →
        </button>
        <a href="#pub-schedule" class="btn-hero-secondary">
          <span>📅 View Schedule</span>
        </a>
        <a href="#pub-progress" class="btn-hero-secondary">
          <span>📊 Check My Progress</span>
        </a>
      </div>

      <div class="hero-metrics-strip">
        <div class="metric-box">
          <span class="metric-val">${(p && p.playersCount) || "30+"}</span>
          <span class="metric-lbl">Active Squad Athletes</span>
        </div>
        <div class="metric-box">
          <span class="metric-val">Inter-IIT</span>
          <span class="metric-lbl">Championship Preparation</span>
        </div>
        <div class="metric-box">
          <span class="metric-val">Main Turf</span>
          <span class="metric-lbl">IITP Sports Complex</span>
        </div>
        <div class="metric-box">
          <span class="metric-val">FIH 2026</span>
          <span class="metric-lbl">Official Rules Standard</span>
        </div>
      </div>
    </section>

    ${pubErr ? `<div class="note err" style="margin-bottom:24px">${esc(pubErr)} <button id="ptry">Retry</button></div>` : ""}

    <!-- 2. About Section -->
    <section class="pub-sec" id="pub-about">
      <div class="sec-header">
        <span class="sec-kicker">HERITAGE &amp; EXCELLENCE</span>
        <h2 class="sec-title">About the Team</h2>
        <p class="sec-lead">A tradition of grit, strategic field play, and brotherhood at the Indian Institute of Technology Patna.</p>
      </div>
      <div class="about-grid">
        <div class="about-story-card">
          <p>The IIT Patna Field Hockey program combines high-intensity physical conditioning, stick mastery, and tactical coordination. Squad members train multiple times weekly at the IIT Patna Sports Complex, balancing academic rigor with athletic dedication.</p>
          <p>Our focus spans technical ball-handling, structured zonal press defense, quick penalty corner execution, and Inter-IIT Championship readiness.</p>
          <div class="about-pillars">
            <div class="pillar-item">
              <span class="ic-tile">🏑</span>
              <b>Tactical Precision</b>
              <span>Ball distribution, circle penetration, and defensive set pieces.</span>
            </div>
            <div class="pillar-item">
              <span class="ic-tile">⚡</span>
              <b>Peak Conditioning</b>
              <span>Sprint intervals, endurance, and high-intensity agility drills.</span>
            </div>
            <div class="pillar-item">
              <span class="ic-tile">🤝</span>
              <b>Team Brotherhood</b>
              <span>Mutual respect, accountability, and sportsmanship on and off the turf.</span>
            </div>
          </div>
        </div>
        <div class="about-leadership">
          ${teamBlock(TEAM)}
        </div>
      </div>
    </section>

    <!-- 3. Practice Schedule Section -->
    <section class="pub-sec" id="pub-schedule">
      <div class="sec-header">
        <span class="sec-kicker">TRAINING TIMETABLE</span>
        <h2 class="sec-title">Next Session &amp; Weekly Schedule</h2>
        <p class="sec-lead">Squad attendance is tracked for official Inter-IIT tournament selection and athletic grading.</p>
      </div>
      <div class="schedule-grid">
        <div class="weekly-schedule-card">
          <h3 style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:var(--ink);margin:0 0 4px">Weekly Practice Program</h3>
          <p class="mute" style="margin:0 0 12px;font-size:0.84rem">Held at Main Turf Pitch, IIT Patna Sports Complex</p>
          <div class="weekly-table">
            <div class="weekly-row">
              <div class="weekly-day-box">
                <span class="weekly-day">Monday</span>
                <span class="weekly-focus">Stickwork, Receiving &amp; Accurate Passing Channels</span>
              </div>
              <span class="weekly-time-badge">5:30 PM – 7:30 PM</span>
            </div>
            <div class="weekly-row">
              <div class="weekly-day-box">
                <span class="weekly-day">Wednesday</span>
                <span class="weekly-focus">Penalty Corner Variations, Drag-flicks &amp; Deflections</span>
              </div>
              <span class="weekly-time-badge">5:30 PM – 7:30 PM</span>
            </div>
            <div class="weekly-row">
              <div class="weekly-day-box">
                <span class="weekly-day">Friday</span>
                <span class="weekly-focus">11v11 Full Pitch Tactical Match Simulation</span>
              </div>
              <span class="weekly-time-badge">5:30 PM – 7:30 PM</span>
            </div>
            <div class="weekly-row">
              <div class="weekly-day-box">
                <span class="weekly-day">Saturday</span>
                <span class="weekly-focus">Morning Conditioning, Sprint Sets &amp; Goalkeeper Clinic</span>
              </div>
              <span class="weekly-time-badge">6:30 AM – 8:30 AM</span>
            </div>
            <div class="weekly-row">
              <div class="weekly-day-box">
                <span class="weekly-day">Sunday</span>
                <span class="weekly-focus">Recovery, Stretching &amp; Tactical Video Review</span>
              </div>
              <span class="weekly-time-badge">Optional Recovery</span>
            </div>
          </div>
        </div>

        <div class="avail-advisory-card">
          <span class="advisory-badge">⚡ Player Practice Protocol</span>
          <h3 style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:var(--ink);margin:0">Squad Participation Rules</h3>
          <p style="font-size:0.9rem;line-height:1.55;color:var(--ink);margin:0">
            Attendance is mandatory for all team players. If you are unable to attend a scheduled practice session due to labs, exams, or injury, follow the squad procedure:
          </p>
          <div class="avail-steps">
            <div class="avail-step">
              <span class="avail-step-num">1</span>
              <span><b>Notify in Advance:</b> Submit your availability status (Active, Injured, Out, or Maybe) in the Playing Days section at least 4 hours before session start.</span>
            </div>
            <div class="avail-step">
              <span class="avail-step-num">2</span>
              <span><b>State Reason:</b> Clearly note reason (e.g. academic clash, shin splint, fever) so Captain &amp; Coach can calibrate drills.</span>
            </div>
            <div class="avail-step">
              <span class="avail-step-num">3</span>
              <span><b>Track Eligibility:</b> Minimum 75% recorded turnout required for tournament travel squad consideration.</span>
            </div>
          </div>
          <button class="pri" style="margin-top:10px" data-plog>Log In to Submit Availability</button>
        </div>
      </div>
    </section>

    <!-- 4. "My Progress" Roll-Number Lookup Section -->
    <section class="pub-sec" id="pub-progress">
      <div class="sec-header">
        <span class="sec-kicker">INDIVIDUAL TURNOUT</span>
        <h2 class="sec-title">Check My Progress</h2>
        <p class="sec-lead">Verify your registered squad status and access your personal attendance records.</p>
      </div>
      <div class="progress-card">
        <div class="progress-privacy-badge">
          🔒 Private &amp; Secure · Records revealed only after roll-number verification
        </div>
        <p style="font-size:0.95rem;line-height:1.55;color:var(--ink);margin:0">
          Enter your institute roll number below to check your squad status and launch your personal attendance breakdown.
        </p>
        <div class="progress-search-row">
          <input type="text" id="pub-roll-input" placeholder="Enter Roll Number (e.g. 2501ME71)" maxlength="8" autocapitalize="characters" autocomplete="username">
          <button class="pri" id="btn-check-progress">Check Progress</button>
        </div>
        <div id="pub-lookup-result" hidden></div>
      </div>
    </section>

    <!-- 5. Announcements & Fixtures Section -->
    <section class="pub-sec" id="pub-announcements">
      <div class="sec-header">
        <span class="sec-kicker">TEAM BULLETIN</span>
        <h2 class="sec-title">Announcements &amp; Fixtures</h2>
        <p class="sec-lead">Upcoming match fixtures, practice notices, and national hockey news updates.</p>
      </div>
      <div class="ann-fixtures-grid">
        <div class="card" style="margin:0">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
            <h3 style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:var(--ink);margin:0">Upcoming Indian Hockey Fixtures</h3>
            <a href="https://www.hockeyindia.org/" target="_blank" rel="noopener noreferrer" style="font-size:0.82rem;font-weight:700;color:var(--brand);text-decoration:none;display:inline-flex;align-items:center;gap:4px">Official portal ↗</a>
          </div>
          ${fx || empty("🗓️", "No upcoming fixtures scheduled right now.")}
        </div>
        <div class="card" style="margin:0">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h3 style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:var(--ink);margin:0">Hockey News Feed</h3>
            <button id="pub-news-ref" class="f-btn" style="color:var(--mute);background:var(--soft);border-radius:6px;padding:4px 8px" title="Refresh news">↻ Refresh</button>
          </div>
          ${news(p && p.latest)}
        </div>
      </div>
    </section>

    <!-- 6. Team Photos Section -->
    <section class="pub-sec" id="pub-gallery">
      <div class="sec-header">
        <span class="sec-kicker">TEAM ACTION &amp; MOMENTS</span>
        <h2 class="sec-title">Team Photo</h2>
        <p class="sec-lead">Captured memories from practice camps, Inter-IIT encounters, and squad milestones.</p>
      </div>
      <div class="gallery-showcase-box">
        ${photos}
        ${thumbs}
      </div>
    </section>

    <!-- 7. Rules & Umpire Signals Preview Section -->
    <section class="pub-sec" id="pub-rules">
      <div class="sec-header">
        <span class="sec-kicker">OFFICIAL FIH STANDARDS</span>
        <h2 class="sec-title">Rules &amp; Umpire Signals</h2>
        <p class="sec-lead">Test your hockey knowledge, learn official umpire signals, and listen to synthesised umpire whistle calls.</p>
      </div>
      <div class="rules-container-grid">
        <div class="whistle-board-card">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <span class="ic-tile">📯</span>
            <div>
              <h3 style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:var(--ink);margin:0">Interactive Umpire Whistle</h3>
              <span class="mute" style="font-size:0.8rem">Tap each blast to trigger audio synthesizer</span>
            </div>
          </div>
          <div class="whistle-buttons-grid">
            <button type="button" class="btn-whistle-blast" data-pub-whistle="short">
              <span class="wb-ic">🔊</span>
              <span class="wb-name">Short Blast</span>
              <span class="wb-desc">Stop play · Ordinary foul / free hit restart</span>
            </button>
            <button type="button" class="btn-whistle-blast" data-pub-whistle="long">
              <span class="wb-ic">📢</span>
              <span class="wb-name">Long Blast</span>
              <span class="wb-desc">Serious breach · Penalty stroke or danger</span>
            </button>
            <button type="button" class="btn-whistle-blast" data-pub-whistle="double">
              <span class="wb-ic">🔔</span>
              <span class="wb-name">Double Blast</span>
              <span class="wb-desc">Goal awarded · Time-out call</span>
            </button>
            <button type="button" class="btn-whistle-blast" data-pub-whistle="final">
              <span class="wb-ic">🏁</span>
              <span class="wb-name">Final Whistle</span>
              <span class="wb-desc">End of quarter or match completion</span>
            </button>
          </div>
          <div class="whistle-vol-row">
            <span style="font-size:0.85rem;font-weight:700;color:var(--ink)">Whistle Volume:</span>
            <input type="range" id="pub-wvol" min="0" max="100" value="80" aria-label="Whistle volume">
            <span id="pub-wvolv" style="font-size:0.82rem;font-weight:800;color:var(--accent);min-width:34px">80%</span>
          </div>

          <h4 style="font-family:var(--font-display);font-size:0.98rem;font-weight:800;color:var(--ink);margin:18px 0 6px">FIH Penalty Cards Guide</h4>
          <div class="penalty-cards-guide">
            <div class="penalty-card-item green">
              <div class="card-shape g"></div>
              <b style="font-size:0.88rem;color:#059669">Green Card</b>
              <span style="font-size:0.76rem;color:var(--ink)"><b>2-Min Suspension</b><br>Player temporarily leaves pitch; team plays short-handed.</span>
            </div>
            <div class="penalty-card-item yellow">
              <div class="card-shape y"></div>
              <b style="font-size:0.88rem;color:#d97706">Yellow Card</b>
              <span style="font-size:0.76rem;color:var(--ink)"><b>5–10 Min Suspension</b><br>Major technical foul, deliberate breakdown or harsh tackle.</span>
            </div>
            <div class="penalty-card-item red">
              <div class="card-shape r"></div>
              <b style="font-size:0.88rem;color:#dc2626">Red Card</b>
              <span style="font-size:0.76rem;color:var(--ink)"><b>Permanent Expulsion</b><br>Violent conduct or dangerous challenge. Ejected for full game.</span>
            </div>
          </div>
        </div>

        <div class="whistle-board-card">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
            <span class="ic-tile">🚩</span>
            <div>
              <h3 style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:var(--ink);margin:0">Key Umpire Signals</h3>
              <span class="mute" style="font-size:0.8rem">Official hand gestures used in collegiate matches</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div class="weekly-row" style="background:var(--soft)">
              <div style="font-size:1.4rem">👉</div>
              <div style="flex:1"><b style="font-size:0.9rem;color:var(--ink)">Free Hit</b><span class="mute" style="display:block;font-size:0.78rem">Arm extended horizontally pointing in attacking direction.</span></div>
              <span class="pill">Restart</span>
            </div>
            <div class="weekly-row" style="background:var(--soft)">
              <div style="font-size:1.4rem">🏃</div>
              <div style="flex:1"><b style="font-size:0.9rem;color:var(--ink)">Advantage</b><span class="mute" style="display:block;font-size:0.78rem">Arm raised in line with shoulder pointing in direction of play.</span></div>
              <span class="pill g">Play On</span>
            </div>
            <div class="weekly-row" style="background:var(--soft)">
              <div style="font-size:1.4rem">🥅</div>
              <div style="flex:1"><b style="font-size:0.9rem;color:var(--ink)">Penalty Corner</b><span class="mute" style="display:block;font-size:0.78rem">Both arms extended horizontally pointing towards the goal.</span></div>
              <span class="pill y">Set Piece</span>
            </div>
            <div class="weekly-row" style="background:var(--soft)">
              <div style="font-size:1.4rem">🎯</div>
              <div style="flex:1"><b style="font-size:0.9rem;color:var(--ink)">Penalty Stroke</b><span class="mute" style="display:block;font-size:0.78rem">One arm pointing to spot, other arm raised vertically.</span></div>
              <span class="pill r">Direct Shot</span>
            </div>
            <div class="weekly-row" style="background:var(--soft)">
              <div style="font-size:1.4rem">🙅</div>
              <div style="flex:1"><b style="font-size:0.9rem;color:var(--ink)">Obstruction / Third-Party</b><span class="mute" style="display:block;font-size:0.78rem">Crossed forearms in front of chest indicating blocked path.</span></div>
              <span class="pill">Foul</span>
            </div>
            <div class="weekly-row" style="background:var(--soft)">
              <div style="font-size:1.4rem">🦶</div>
              <div style="flex:1"><b style="font-size:0.9rem;color:var(--ink)">Ball Off Foot</b><span class="mute" style="display:block;font-size:0.78rem">Hand touches raised foot indicating illegal foot-ball contact.</span></div>
              <span class="pill">Violation</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 8. FAQ & Help Desk Section -->
    <section class="pub-sec" id="pub-faq">
      <div class="sec-header">
        <span class="sec-kicker">QUESTIONS &amp; INQUIRIES</span>
        <h2 class="sec-title">FAQ &amp; Visitor Help Desk</h2>
        <p class="sec-lead">Common questions for squad members, newcomers, and campus visitors.</p>
      </div>
      <div class="pub-faq-grid">
        ${helpCard("public")}
      </div>
    </section>

    <!-- 9. Collegiate Footer -->
    <footer class="pub-footer" id="pub-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <div class="footer-brand-title">
            <img src="icons/iitp-hockey-crest.svg" alt="IIT Patna Crest" width="48" height="48">
            <div>
              <div style="font-size:1.25rem;line-height:1">IIT PATNA</div>
              <div style="font-size:0.72rem;letter-spacing:0.12em;color:var(--accent)">FIELD HOCKEY TEAM</div>
            </div>
          </div>
          <p class="footer-desc">
            Official web portal of the Indian Institute of Technology Patna Field Hockey Team. Practice tracking, turnout records, official rules, and squad coordination.
          </p>
          <div style="margin-top:6px">
            <a href="${(PUB && PUB.group) || window.WA_GROUP || "#"}" target="_blank" rel="noopener" class="btn-wa-footer" id="btn-join-wa">
              💬 Join Squad WhatsApp Group
            </a>
          </div>
        </div>

        <div class="footer-col">
          <h4>Venue &amp; Campus</h4>
          <p style="font-size:0.85rem;line-height:1.6;color:rgba(255,255,255,0.78);margin:0 0 10px">
            <b>Main Hockey Turf Ground</b><br>
            Sports Complex, IIT Patna<br>
            Bihta, Patna, Bihar – 801106<br>
            India
          </p>
          <p style="font-size:0.85rem;color:rgba(255,255,255,0.78);margin:0">
            <b>Practice Hours:</b><br>
            Mon · Wed · Fri · Sat (5:30 PM)
          </p>
        </div>

        <div class="footer-col">
          <h4>Team Leadership</h4>
          <p style="font-size:0.85rem;line-height:1.6;color:rgba(255,255,255,0.78);margin:0 0 10px">
            <b>Head Coach:</b> Kiran Chaudhary<br>
            <b>Captain:</b> ${esc(nameOf2("captain"))}<br>
            <b>Vice-Captain:</b> ${esc(nameOf2("vice"))}
          </p>
          <div style="margin-top:12px">
            ${inst ? '<button type="button" class="btn-login-gold" id="pinst-footer" style="padding:6px 14px;font-size:0.82rem">📲 Install App to Home Screen</button>' : ""}
          </div>
        </div>
      </div>

      <div class="footer-bottom">
        <div>© ${new Date().getFullYear()} IIT Patna Field Hockey Team · All Rights Reserved.</div>
        <div>Compliant with FIH Rules of Hockey · Built for Athletes</div>
      </div>
    </footer>
  `;

  bindPublic();
}

function bindPublic() {
  // Login buttons
  document
    .querySelectorAll("#pub [data-plog]")
    .forEach((b) => (b.onclick = showLogin));

  // Help Desk
  bindHelp();

  // Install app buttons
  if (gid("pinst")) gid("pinst").onclick = openInApp;
  if (gid("pinst-footer")) gid("pinst-footer").onclick = openInApp;

  // Try again for public error
  if (gid("ptry")) gid("ptry").onclick = () => fetchPublic();

  // News refresh
  if (gid("pub-news-ref")) {
    gid("pub-news-ref").onclick = () => {
      fetchPublic();
    };
  }

  // Group photo click lightbox
  if (gid("pgph")) {
    gid("pgph").onclick = () => {
      if (PUB && PUB.groupPhoto) openImg(PUB.groupPhoto);
    };
  }

  // Gallery thumbs click
  document.querySelectorAll("#pub [data-gthumb]").forEach((el) => {
    el.onclick = () => openImg(el.dataset.gthumb);
  });

  // Whistle Synthesizer buttons
  document.querySelectorAll("#pub [data-pub-whistle]").forEach((b) => {
    b.onclick = () => pubPlayWhistle(b.dataset.pubWhistle);
  });

  // Whistle volume slider
  const wvol = gid("pub-wvol");
  const wvolv = gid("pub-wvolv");
  if (wvol && wvolv) {
    wvol.oninput = () => {
      const v = wvol.value;
      wvolv.textContent = v + "%";
      try {
        localStorage.setItem("hk_vol", v);
      } catch (e) {}
    };
  }

  // Font sizer buttons
  initFontSizer();

  // Mobile Drawer Toggle
  const pmb = gid("pmb");
  const pdr = gid("pub-drawer");
  if (pmb && pdr) {
    pmb.onclick = (e) => {
      e.stopPropagation();
      const open = !pdr.hidden;
      pdr.hidden = open;
      pmb.setAttribute("aria-expanded", String(!open));
    };
    pdr.querySelectorAll(".pub-drawer-link").forEach((a) => {
      a.onclick = () => {
        pdr.hidden = true;
        pmb.setAttribute("aria-expanded", "false");
      };
    });
    document.addEventListener("click", (e) => {
      if (!pdr.hidden && !pdr.contains(e.target) && e.target !== pmb) {
        pdr.hidden = true;
        pmb.setAttribute("aria-expanded", "false");
      }
    });
  }

  // "My Progress" Roll-Number Lookup
  const btnChk = gid("btn-check-progress");
  const rollInp = gid("pub-roll-input");
  if (btnChk && rollInp) {
    btnChk.onclick = () => checkPublicProgress();
    rollInp.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        checkPublicProgress();
      }
    };
  }
}

async function checkPublicProgress() {
  const inp = gid("pub-roll-input");
  const res = gid("pub-lookup-result");
  if (!inp || !res) return;
  const roll = inp.value.trim().toUpperCase();
  if (!/^\d{4}[A-Z]{2}\d{2}$/.test(roll)) {
    res.hidden = false;
    res.innerHTML =
      '<p class="err" style="margin:6px 0 0">Roll number must be 4 digits, 2 letters, then 2 digits, like 2501ME71.</p>';
    return;
  }
  res.hidden = false;
  res.innerHTML =
    '<p class="mute" style="margin:6px 0 0">Checking squad database…</p>';
  try {
    const r = await fetch(API + "/api/player/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roll }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      res.innerHTML = `<div class="note err" style="margin-top:10px;background:#ef444415;border:1px solid #ef444440;border-radius:12px;padding:14px">
        <b>Not Found:</b> ${esc(j.error || "Roll number not registered on the active team list.")}
        <p class="mute" style="margin:6px 0 0">Ask Coach Kiran Chaudhary or the Captain to add you to the squad.</p>
      </div>`;
      return;
    }
    // Found on team
    res.innerHTML = `<div class="lookup-result">
      <div class="lookup-result-header">
        <div>
          <span class="leader-role-badge" style="background:#10b98122;color:#059669;border:1px solid #10b98155">Verified Squad Player</span>
          <div class="lookup-name">${esc(roll)}</div>
        </div>
        <span class="pill g">Active Roster</span>
      </div>
      <p style="margin:0 0 14px;font-size:0.92rem;color:var(--ink);line-height:1.5">
        ${j.hasAccount ? "Your player account is active. Click below to enter your PIN and view your full attendance analytics, month-by-month charts &amp; training log." : "You are registered on the squad list! Complete quick roll-number sign-up to start tracking your attendance."}
      </p>
      <button class="btn-hero-primary" id="btn-lookup-continue" style="width:100%;justify-content:center">
        ${j.hasAccount ? "Log In to View My Attendance →" : "Sign Up with Roll Number →"}
      </button>
    </div>`;
    const btn = gid("btn-lookup-continue");
    if (btn) {
      btn.onclick = () => {
        showLogin();
        const pr = gid("pr");
        if (pr) {
          pr.value = roll;
          gid("pgo") && gid("pgo").click();
        }
      };
    }
  } catch (e) {
    res.innerHTML = `<p class="err" style="margin-top:8px">${esc(e.message || "Network error. Check connection.")}</p>`;
  }
}

function showPublic() {
  if (typeof pushAuto === "function") pushAuto();
  gid("app").hidden = true;
  gid("login").hidden = true;
  gid("pub").hidden = false;
  gid("menu").hidden = true;
  document.title = "IIT Patna Hockey · Official Team Portal";
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
  let h = menuHead("Menu");
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
if (gid("pmb")) {
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
}
gid("pli").onclick = () => showLogin();

// ---------------------------------------------------------------- menu cross
const menuHead = (t) =>
  `<div class="mh"><b>${t}</b><button type="button" class="mx" data-mx aria-label="Close menu" title="Close menu">${ico("close")}</button></div>`;
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
    b.innerHTML = ico(o ? "close" : "dots");
    b.classList.toggle("open", o);
    b.setAttribute("aria-expanded", String(o));
    b.setAttribute("aria-label", o ? "Close menu" : "Menu");
  });
}).observe(gid("menu"), { attributes: true, attributeFilter: ["hidden"] });
// the back arrow on the login page goes to the public page; the back arrow in the header goes from any menu page back to Home
gid("lgx").onclick = () => showPublic();
if (matchMedia("(display-mode: standalone)").matches || navigator.standalone)
  gid("lgx").hidden = true; // installed app: no public page, so no back arrow
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
    <div class="stats"><div><b>${a.pct}%</b>Attendance</div><div><b>${a.pr}/${a.t}</b>Sessions present</div><div><b>${mm.t ? mm.pct + "%" : "–"}</b>This month</div></div>
    ${role !== "player" ? kvp("Role", roleLabel()) : ""}${kvp("Roll number", esc(p.roll))}${kvp("Position", esc(p.position))}${kvp("Jersey", jersey)}${kvp("E-mail", p.email ? esc(p.email) : "")}${kvp("Joined", p.joined ? fmt(p.joined) : "")}
    <div class="chips"><button id="myp">👤 Open my profile</button><button id="mye">✏️ Edit details</button><button data-go="stats">📊 My attendance</button></div></div>`;
  }
  const st = stats("all").filter((x) => x.t),
    tp = st.reduce((a, x) => a + x.t, 0),
    tr = tp ? Math.round((st.reduce((a, x) => a + x.pr, 0) * 100) / tp) : 0;
  return `<div class="card"><h2>My details</h2><div class="stats"><div><b>${P.length}</b>Players</div><div><b>${rsess("all")}</b>Sessions</div><div><b>${tr}%</b>Team turnout</div></div>
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
      const myId = role === "player" ? me : MYPID || "";
      const p = P.find((x) => x.id === myId);
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
  d.innerHTML = `<h2>Team, captain, vice-captain and coach</h2><p class="mute">Names and the team description appear on the public page and on Home. Leave empty to use the player's name or the default.</p>${f("captain", "Captain")}${f("vice", "Vice-captain")}${f("coach", "Coach")}
  <label class="fl">About the team: short description or achievements<textarea id="nm-about" rows="3" maxlength="400" placeholder="e.g. Inter IIT 2025 quarter-finalists. Practice every weekday.">${esc(NAMES.about || "")}</textarea></label>
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
          about: gid("nm-about").value,
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
// Drag to move, turn left / right with the two rotate buttons. No zoom. The whole-photo button keeps the full picture.
async function cropFile(file, o) {
  let bm = null;
  if (typeof file === "string") {
    bm = await new Promise((r) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => r(im);
      im.onerror = () => r(null);
      im.src = file;
    });
  } else {
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
  }
  if (!bm) {
    alert("That file is not a picture.");
    return null;
  }
  let iw = bm.width,
    ih = bm.height;
  const big = Math.max(iw, ih);
  if (big > 2600) {
    const k = 2600 / big,
      c = document.createElement("canvas");
    c.width = Math.round(iw * k);
    c.height = Math.round(ih * k);
    c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
    bm = c;
    iw = c.width;
    ih = c.height;
  } // the saved photo is never bigger than about 1300 px, so a huge original is shrunk once to keep phones quick
  const d = ensureDlg("crdlg"),
    ars = o.ars || [["Square", 1]];
  let ai = 0,
    ox = 0,
    oy = 0,
    bw = 0,
    bh = 0,
    zoom = 1.0,
    done = false;
  const ratio = () => {
    const r = ars[ai][1] || iw / ih;
    return Math.max(0.4, Math.min(4, r));
  };
  d.innerHTML = `<button type="button" class="dx" id="cr-xx" aria-label="Back">✕</button><h2>${esc(o.title || "Crop photo")}</h2>
  <div class="crv"><canvas id="crc"></canvas></div>
  <div class="crrot">
    <button type="button" class="ib" id="cr-zi" aria-label="Zoom in" title="Zoom in">${ico("zoom-in")}</button>
    <button type="button" class="ib" id="cr-zo" aria-label="Zoom out" title="Zoom out">${ico("zoom-out")}</button>
    <button type="button" class="ib" id="cr-rl" aria-label="Rotate left" title="Rotate left">${ico("rotate-l")}</button>
    <button type="button" class="ib" id="cr-rr" aria-label="Rotate right" title="Rotate right">${ico("rotate-r")}</button>
  </div>
  ${ars.length > 1 ? `<div class="chips crar" style="justify-content:center;margin-top:8px">${ars.map((a, i) => `<button type="button" data-ar="${i}" class="${i === 0 ? "pri" : ""}">${esc(a[0])}</button>`).join("")}</div>` : ""}
  <p class="mute" style="text-align:center;margin:6px 0 10px">Drag or pinch to reposition & zoom</p>
  <div class="ctl"><button class="pri ib" id="cr-ok" aria-label="Use photo" title="Use photo">${ico("check")}</button>${o.skip ? `<button class="ib" id="cr-sk" aria-label="Use the whole photo" title="Use the whole photo">${ico("expand")}</button>` : ""}</div>`;
  const cv = d.querySelector("#crc"),
    cx = cv.getContext("2d");
  const sc = () => Math.max(bw / iw, bh / ih) * zoom;
  const clamp = () => {
    const mx = Math.max(0, (iw * sc() - bw) / 2),
      my = Math.max(0, (ih * sc() - bh) / 2);
    ox = Math.max(-mx, Math.min(mx, ox));
    oy = Math.max(-my, Math.min(my, oy));
  };
  let dpr = Math.min(2, window.devicePixelRatio || 1);
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
    ox = oy = 0;
    zoom = 1.0;
    draw();
  };
  let drag = null;
  let pointers = new Map();
  let prevDist = -1;
  cv.onpointerdown = (e) => {
    cv.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) drag = [e.clientX, e.clientY];
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      prevDist = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
    }
  };
  cv.onpointermove = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      if (prevDist > 0) {
        const factor = dist / prevDist;
        zoom = Math.max(1.0, Math.min(4.0, +(zoom * factor).toFixed(2)));
        draw();
      }
      prevDist = dist;
      return;
    }
    if (!drag) return;
    ox += e.clientX - drag[0];
    oy += e.clientY - drag[1];
    drag = [e.clientX, e.clientY];
    draw();
  };
  cv.onpointerup = cv.onpointercancel = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) prevDist = -1;
    if (pointers.size === 1) drag = [...pointers.values()][0];
    else drag = null;
  };
  cv.onwheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    zoom = Math.max(1.0, Math.min(4.0, +(zoom * factor).toFixed(2)));
    draw();
  };
  // turn the picture a quarter turn; the crop frame is reset because the picture's shape changed
  const turn = (dir) => {
    const c = document.createElement("canvas");
    c.width = ih;
    c.height = iw;
    const x = c.getContext("2d");
    x.translate(c.width / 2, c.height / 2);
    x.rotate((dir * Math.PI) / 2);
    x.drawImage(bm, -iw / 2, -ih / 2);
    bm = c;
    [iw, ih] = [ih, iw];
    zoom = 1.0;
    layout();
  };
  d.querySelector("#cr-rl").onclick = () => turn(-1);
  d.querySelector("#cr-rr").onclick = () => turn(1);
  d.querySelector("#cr-zi").onclick = () => {
    zoom = Math.min(4.0, +(zoom * 1.25).toFixed(2));
    draw();
  };
  d.querySelector("#cr-zo").onclick = () => {
    zoom = Math.max(1.0, +(zoom / 1.25).toFixed(2));
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
        alert("That photo is too big. Try a different picture.");
        done = false;
        return;
      }
      fin(v);
    };
    if (o.skip)
      d.querySelector("#cr-sk").onclick = () => {
        const v = render(true);
        if (o.cap && v.length >= o.cap) {
          alert("That photo is too big. Use the crop instead.");
          return;
        }
        fin(v);
      };
    d.querySelector("#cr-xx").onclick = () => fin(null);
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
async function setCover(k, id, fileOrImg) {
  const img = await cropFile(fileOrImg, {
    title: "Edit cover picture",
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
async function editCurrentCover(k, id) {
  let img = COV[covKey(k, id)];
  if (!img) {
    img = await loadCover(k, id);
  }
  if (img) {
    await setCover(k, id, img);
  } else {
    pickFiles((f) => setCover(k, id, f[0]));
  }
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
      .find((x) => planLive(x)),
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
    stat = `<div><b>${a.pct}%</b>Attendance</div><div><b>${a.pr}/${a.t}</b>Sessions present</div><div><b>${st}</b>Day streak</div>`;
  } else {
    const q = stats("all").filter((x) => x.t),
      t = q.reduce((a, x) => a + x.t, 0);
    stat = `<div><b>${P.length}</b>Players</div><div><b>${rsess("all")}</b>Sessions</div><div><b>${t ? Math.round((q.reduce((a, x) => a + x.pr, 0) * 100) / t) : 0}%</b>Team turnout</div>`;
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
