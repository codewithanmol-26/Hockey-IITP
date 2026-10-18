// v21: one set of outline icons (rounded, 24px grid, drawn in the current text colour), used instead of text and emoji on buttons.
//  - ico(name)       -> SVG markup.   eic(emoji) -> the icon that replaces an emoji (or the emoji itself if there is none).
//  - Buttons with a short action word (Save, Edit, Delete, Share, Copy, Cancel, Retry ...) become icon-only automatically; the word stays as the
//    accessible name and the tooltip. Buttons that start with an emoji get the matching icon in front of their text.
//  - Every dialog gets a ← back button (no crosses). The only cross left is the one that closes the menu panel.
// Loaded first, so everything else can call ico().
const _P = {
  home: '<path d="M3.5 11 12 3.8 20.5 11"/><path d="M5.5 9.6V20h13V9.6"/><path d="M10 20v-5.5h4V20"/>',
  back: '<path d="M20 12H4.5"/><path d="m10.5 5.5-6.5 6.5 6.5 6.5"/>',
  fwd: '<path d="M4 12h15.5"/><path d="m13.5 5.5 6.5 6.5-6.5 6.5"/>',
  "chev-l": '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
  "chev-r": '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  dots: '<circle cx="12" cy="5.5" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="18.5" r="1.7" fill="currentColor" stroke="none"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  "check-circle":
    '<circle cx="12" cy="12" r="8.8"/><path d="m8 12.4 3 3 5.2-6"/>',
  clear: '<circle cx="12" cy="12" r="8.8"/><path d="m9 9 6 6M15 9l-6 6"/>',
  calendar:
    '<rect x="3.8" y="5" width="16.4" height="15.2" rx="2.6"/><path d="M3.8 9.8h16.4M8.2 3v4M15.8 3v4"/>',
  chart: '<path d="M5.5 20v-8M12 20V4.5M18.5 20v-9"/>',
  clock: '<circle cx="12" cy="12" r="8.8"/><path d="M12 7v5.2l3.4 2"/>',
  timer:
    '<circle cx="12" cy="13.2" r="7.4"/><path d="M12 9.2v4.4l2.6 1.6M9.5 3h5M12 3v2.8"/>',
  edit: '<path d="M4 20l1.1-4.3L16.4 4.4a2.1 2.1 0 0 1 3 0l.2.2a2.1 2.1 0 0 1 0 3L8.3 18.9z"/><path d="m14.5 6.4 3.1 3.1"/>',
  trash:
    '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7M10 11v5.5M14 11v5.5"/>',
  share:
    '<path d="M12 15V3.8M7.8 8 12 3.8 16.2 8"/><path d="M5 12.5v7h14v-7"/>',
  refresh:
    '<path d="M19.5 10.5A7.8 7.8 0 0 0 5.8 7"/><path d="M5 3.8V8h4.2"/><path d="M4.5 13.5A7.8 7.8 0 0 0 18.2 17"/><path d="M19 20.2V16h-4.2"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v4.7H9.2"/>',
  undo: '<path d="M8.5 6.5 4 11l4.5 4.5"/><path d="M4.5 11H15a4.5 4.5 0 0 1 0 9h-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  tag: '<path d="M3.8 12.3V4.8h7.5l8.9 8.9-7.5 7.5z"/><circle cx="8.3" cy="9.3" r="1.3"/>',
  camera:
    '<path d="M4 8.5a2 2 0 0 1 2-2h2l1.4-2h5.2l1.4 2h2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.6"/>',
  image:
    '<rect x="3.8" y="4.8" width="16.4" height="14.4" rx="2.6"/><circle cx="9" cy="10" r="1.7"/><path d="m4.5 17 4.8-4.4 3.5 3.2 2.6-2.4 4.6 4"/>',
  download: '<path d="M12 4v11.5M7.8 11.5l4.2 4.2 4.2-4.2M5 20h14"/>',
  "rotate-l":
    '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v4.7H9.2"/>',
  "rotate-r":
    '<g transform="matrix(-1 0 0 1 24 0)"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v4.7H9.2"/></g>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.8 2.2H4.2z"/><path d="M10 21a2.2 2.2 0 0 0 4 0"/>',
  "bell-off":
    '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.8 2.2H4.2z"/><path d="M10 21a2.2 2.2 0 0 0 4 0M3.5 3.5l17 17"/>',
  megaphone:
    '<path d="M3.8 10v4.2h3.4l8.3 4.3V5.7L7.2 10z"/><path d="M18.4 9.3a4.2 4.2 0 0 1 0 5.4M7.4 14.2l1.2 5.3h2.6l-1-4.5"/>',
  pin: '<path d="M12 21v-6.3M8.3 3.8h7.4l-1 6 3.3 3.5H6l3.3-3.5z"/>',
  "pin-map":
    '<path d="M12 21s6.5-5.8 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.2 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  save: '<path d="M5 3.8h11.2l3.8 3.8V20H5z"/><path d="M8 3.8v5h7.2v-5M8 20v-6.5h8V20"/>',
  send: '<path d="M3.8 11.5 20 4l-4.4 16-3.4-6.4z"/><path d="M12.2 13.6 20 4"/>',
  moon: '<path d="M20 14.6A8.2 8.2 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.6"/><path d="m15.8 15.8 4.4 4.4"/>',
  users:
    '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 20c.4-3.6 2.9-5.8 6-5.8s5.6 2.2 6 5.8"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.6c2 .7 3.2 2.5 3.5 5.4"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.5-4 3.5-6.3 7.5-6.3s7 2.3 7.5 6.3"/>',
  "user-minus":
    '<circle cx="9.5" cy="8" r="3.6"/><path d="M2.8 20c.5-3.8 3.2-5.9 6.7-5.9s6.2 2.1 6.7 5.9M17.5 9.5h5"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.6"/><path d="m4.5 7.5 7.5 6 7.5-6"/>',
  tool: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  book: '<path d="M4.5 5.5c2.8-.8 5.3-.5 7.5 1v13c-2.2-1.5-4.7-1.8-7.5-1zM19.5 5.5c-2.8-.8-5.3-.5-7.5 1v13c2.2-1.5 4.7-1.8 7.5-1z"/>',
  flame:
    '<path d="M12 3c.5 3.2-2.2 4.8-3.6 7C7 12 6 13.6 6 15.4 6 18.6 8.7 21 12 21s6-2.4 6-5.6c0-2.6-1.4-4.2-2.6-5.6-.4 1-1 1.8-1.9 2.2.6-3.2-.5-6.7-1.5-9z"/>',
  shield:
    '<path d="M12 3.5 19 6v5.6c0 4.4-2.9 7.7-7 9-4.1-1.3-7-4.6-7-9V6z"/><path d="m8.8 12 2.4 2.4 4-4.4"/>',
  bug: '<path d="M9 7.5a3 3 0 0 1 6 0M7.5 11.5h9M7.5 11.5v3.2a4.5 4.5 0 0 0 9 0v-3.2a2 2 0 0 0-2-2h-5a2 2 0 0 0-2 2zM12 12v8M3.8 9.5l3.2 1.6M20.2 9.5 17 11.1M3.8 17l3.5-1.4M20.2 17l-3.5-1.4"/>',
  heart:
    '<path d="M12 20.5s-7.7-4.5-7.7-10.4A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 7.7 2.7c0 5.9-7.7 10.4-7.7 10.4z"/>',
  copy: '<rect x="8.5" y="8.5" width="11.7" height="11.7" rx="2.4"/><path d="M15.5 8.5V6.2a2.4 2.4 0 0 0-2.4-2.4H6.2a2.4 2.4 0 0 0-2.4 2.4v6.9a2.4 2.4 0 0 0 2.4 2.4h2.3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
  key: '<circle cx="8" cy="15.5" r="3.8"/><path d="m10.8 12.7 8.4-8.4M15.5 8l2.7 2.7"/>',
  logout: '<path d="M10 4H5.5v16H10M15 8l4 4-4 4M19 12H9.5"/>',
  login: '<path d="M14 4h4.5v16H14"/><path d="M4.5 12H14M10.5 8l4 4-4 4"/>',
  chat: '<path d="M20.5 11.5c0 3.9-3.8 7-8.5 7-1 0-2-.1-2.9-.4L4.5 20l1.4-3.6C4.4 15.3 3.5 13.5 3.5 11.5c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7z"/>',
  award:
    '<circle cx="12" cy="9" r="5.3"/><path d="m8.6 13.6-1.4 6.9 4.8-2.4 4.8 2.4-1.4-6.9"/>',
  sound:
    '<path d="M4 9.8v4.4h3.6l4.9 3.8V6L7.6 9.8z"/><path d="M16 9.2a4 4 0 0 1 0 5.6M18.4 6.8a7.5 7.5 0 0 1 0 10.4"/>',
  pointer: '<path d="m6 3.5 12 8.7-5.2 1.1 3 5.4-2.3 1.3-3-5.4-4.5 3.3z"/>',
  phone:
    '<rect x="7" y="3" width="10" height="18" rx="2.6"/><path d="M11 18h2"/>',
  target:
    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>',
  bulb: '<path d="M9.2 17.5h5.6M10 20.5h4M12 3.5a6 6 0 0 0-3.6 10.8c.7.6 1.2 1.4 1.2 2.2h4.8c0-.8.5-1.6 1.2-2.2A6 6 0 0 0 12 3.5z"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  hockey:
    '<path d="M8 3.5 6.2 14.2c-.3 1.6.7 3 2.2 3.2l4.6.7"/><circle cx="17" cy="17.4" r="2.3"/>',
  external:
    '<path d="M13.5 4.5h6v6M19.5 4.5 11 13M17 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 18.5v-9A1.5 1.5 0 0 1 6.5 8H10"/>',
  dumbbell: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
};
function ico(n, c) {
  const p = _P[n];
  return p
    ? '<svg class="svgi' +
        (c ? " " + c : "") +
        '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        p +
        "</svg>"
    : "";
}

// emoji -> icon (keys are written without the invisible "emoji" marker U+FE0F)
const _EMO = {
  "🏠": "home",
  "✅": "check-circle",
  "📅": "calendar",
  "📆": "calendar",
  "🗓": "calendar",
  "📊": "chart",
  "⏰": "clock",
  "🖼": "image",
  "⏱": "timer",
  "⌚": "timer",
  "📖": "book",
  "🔥": "flame",
  "👥": "users",
  "👤": "user",
  "🛡": "shield",
  "🐞": "bug",
  "📢": "megaphone",
  "🏷": "tag",
  "📌": "pin",
  "📍": "pin-map",
  "❤": "heart",
  "🔔": "bell",
  "🔕": "bell-off",
  "✏": "edit",
  "🗑": "trash",
  "⤴": "share",
  "📷": "camera",
  "📋": "copy",
  "↩": "undo",
  "🔗": "link",
  "🔑": "key",
  "💾": "save",
  "⬇": "download",
  "📲": "download",
  "➕": "plus",
  "＋": "plus",
  "+": "plus",
  "✔": "check",
  "✘": "close",
  "↻": "refresh",
  "‹": "chev-l",
  "›": "chev-r",
  "🌙": "moon",
  "☀": "sun",
  "📱": "phone",
  "🚪": "logout",
  "💬": "chat",
  "📨": "mail",
  "✉": "mail",
  "🛠": "tool",
  "🎖": "award",
  "🔈": "sound",
  "🖱": "pointer",
  "🎯": "target",
  "💡": "bulb",
  "🏑": "hockey",
  "🏋": "dumbbell",
  "🥅": "target",
  "😴": "moon",
  "🌐": "external",
  "×": "trash",
  "−": "minus",
  "📝": "edit",
};
const _EKEYS = Object.keys(_EMO).sort((a, b) => b.length - a.length);
const _noV = (s) => String(s).replace(/\uFE0F/g, "");
function eic(e) {
  const n = _EMO[_noV(e).trim()];
  return n ? ico(n) : e;
}
function _lead(raw) {
  for (const k of _EKEYS)
    if (raw.startsWith(k)) return { name: _EMO[k], len: k.length };
  return null;
}

// short action words that become an icon-only button
const _ONLY = {
  cancel: "back",
  close: "back",
  back: "back",
  "not now": "back",
  done: "check",
  ok: "check",
  "use photo": "check",
  save: "save",
  "save changes": "save",
  update: "save",
  edit: "edit",
  "edit profile": "edit",
  "edit details": "edit",
  "edit fixtures": "edit",
  delete: "trash",
  remove: "trash",
  "remove photo": "trash",
  "remove cover": "trash",
  "delete this day": "trash",
  share: "share",
  copy: "copy",
  "try again": "refresh",
  retry: "refresh",
  "reload data": "refresh",
  refresh: "refresh",
  "tag people": "tag",
  clear: "clear",
  reset: "reset",
  add: "plus",
  new: "plus",
  "add student": "plus",
  "add all": "plus",
  "add admin": "plus",
  "add item": "plus",
  "add section": "plus",
  post: "send",
  restore: "undo",
  "use original": "expand",
  "choose photos": "image",
  "use as group photo": "users",
  "add photos": "camera",
  "add photo": "camera",
  "change photo": "camera",
  "add group photo": "camera",
  "change group photo": "camera",
  "cover picture": "image",
};
const _DEFLBL = {
  trash: "Delete",
  edit: "Edit",
  share: "Share",
  camera: "Add photo",
  refresh: "Try again",
  tag: "Tag people",
  plus: "Add",
  save: "Save",
  check: "Done",
  back: "Back",
  "chev-l": "Previous",
  "chev-r": "Next",
  minus: "Less",
  moon: "Night mode",
  sun: "Day mode",
  close: "Close",
};
const _normKey = (raw) =>
  raw
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[….!:]+$/u, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
const _escH = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

function _fixBtn(b) {
  if (b.dataset.noico !== undefined) return;
  if (b.dataset.ico === "1" && b.querySelector(":scope > svg")) return;
  if (b.children.length) return; // only plain text buttons
  const raw = _noV(b.textContent || "").trim();
  if (!raw) return;
  const key = _normKey(raw),
    only = _ONLY[key];
  const label = raw.replace(/^[^\p{L}\p{N}]+/u, "").replace(/…$/, "") || raw;
  if (only) {
    if (!b.hasAttribute("aria-label")) b.setAttribute("aria-label", label);
    if (!b.title) b.title = b.getAttribute("aria-label");
    b.innerHTML = ico(only);
    b.classList.add("ib");
    b.dataset.ico = "1";
    return;
  }
  const ld = _lead(raw);
  if (!ld) return;
  const rest = raw.slice(ld.len).trim();
  if (!rest) {
    // an emoji on its own
    if (!b.hasAttribute("aria-label"))
      b.setAttribute("aria-label", _DEFLBL[ld.name] || ld.name);
    if (!b.title) b.title = b.getAttribute("aria-label");
    b.innerHTML = ico(ld.name);
    b.classList.add("ib");
    b.dataset.ico = "1";
    return;
  }
  b.innerHTML =
    ico(ld.name, "lead") + '<span class="bt">' + _escH(rest) + "</span>";
  b.classList.add("bi");
  b.dataset.ico = "1";
}
function _fixHead(el) {
  if (el.dataset.ico === "1") return;
  if (el.classList.contains("i")) {
    const n = _EMO[_noV(el.textContent).trim()];
    if (n) {
      el.innerHTML = ico(n);
      el.dataset.ico = "1";
    }
    return;
  }
  const f = el.firstChild;
  if (!f || f.nodeType !== 3) return;
  const t = _noV(f.nodeValue).replace(/^\s+/, ""),
    ld = _lead(t);
  if (!ld) return;
  f.nodeValue = t.slice(ld.len).replace(/^\s*/, " ");
  el.insertAdjacentHTML("afterbegin", ico(ld.name, "hi"));
  el.dataset.ico = "1";
}
function _scan(n) {
  if (!n.isConnected) return;
  const bt = n.closest && n.closest("button,a.btn");
  if (bt) _fixBtn(bt);
  if (n.matches && n.matches("button,a.btn")) _fixBtn(n);
  if (n.matches && n.matches("h2,h3,.i")) _fixHead(n);
  if (n.querySelectorAll) {
    n.querySelectorAll("button,a.btn").forEach(_fixBtn);
    n.querySelectorAll("h2,h3,.mi .i,.mrow .i").forEach(_fixHead);
  }
}
// every open dialog has a back arrow at its top-left (so nothing needs a cross or a Cancel button)
function _backBtn(d) {
  let b = d.querySelector(":scope > .dx");
  if (!b) {
    b = document.createElement("button");
    b.type = "button";
    b.className = "dx";
    b.onclick = () => d.close();
    d.prepend(b);
  }
  if (b.dataset.ico !== "1") {
    b.innerHTML = ico("back");
    b.dataset.ico = "1";
    b.classList.add("back");
    b.setAttribute("aria-label", "Back");
    b.title = "Back";
  }
}
const _q = new Set();
let _raf = 0;
function _enqueue(n) {
  const e = n.nodeType === 1 ? n : n.parentElement;
  if (e) _q.add(e);
  if (!_raf)
    _raf = requestAnimationFrame(() => {
      _raf = 0;
      const a = [..._q];
      _q.clear();
      a.forEach(_scan);
      document.querySelectorAll("dialog[open]").forEach(_backBtn);
    });
}
function paintIcons(root) {
  (root || document).querySelectorAll("[data-ic]").forEach((e) => {
    e.innerHTML = ico(e.dataset.ic);
  });
}
// the first time a dialog opens, plain "Cancel" / "Close" buttons are dropped (the back arrow does it)
(function () {
  const sm = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () {
    this.querySelectorAll(".ctl > button").forEach((b) => {
      if (
        !b.children.length &&
        ["cancel", "close", "not now"].includes(_normKey(_noV(b.textContent)))
      )
        b.remove();
    });
    this.querySelectorAll(".ctl:empty").forEach((c) => c.remove());
    _backBtn(this);
    return sm.call(this);
  };
})();
new MutationObserver((ms) => {
  for (const m of ms) {
    if (m.type === "characterData") _enqueue(m.target);
    else m.addedNodes.forEach(_enqueue);
  }
}).observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
});
document.addEventListener("DOMContentLoaded", () => {
  paintIcons();
  _enqueue(document.body);
});
