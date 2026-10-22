/**
 * IIT Patna Hockey - AI Chatbot UI Component
 * Provides a floating assistant button, modal chat dialog, quick suggestion chips,
 * and seamless Bearer token authentication to query Gemini & Supabase.
 */

(function () {
  // 1. Inject Floating Action Button (FAB) and Dialog into DOM
  function initChatUI() {
    if (document.getElementById("chat-fab")) return;

    // Floating Button
    const fab = document.createElement("button");
    fab.id = "chat-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Open Hockey AI Assistant");
    fab.title = "Hockey AI Assistant (Drag to move)";
    fab.innerHTML = `<span class="fab-icon">🏑</span><span class="fab-label">AI Chat</span>`;
    document.body.appendChild(fab);

    // Chat Dialog
    const dlg = document.createElement("dialog");
    dlg.id = "chatdlg";
    dlg.className = "chat-dialog";
    dlg.setAttribute("aria-labelledby", "chat-title");
    dlg.innerHTML = `
      <div class="chat-header">
        <div class="chat-header-actions">
          <button type="button" class="dx" id="chat-close" aria-label="Close Assistant" title="Close">✕</button>
        </div>
        <div class="chat-header-info">
          <h2 id="chat-title">Hockey AI Assistant</h2>
          <span class="chat-sub">Rules · Practice Schedules · Attendance</span>
        </div>
        <div class="chat-header-status">
          <span class="status-dot"></span>
        </div>
      </div>
      <div class="chat-body" id="chat-msgs" role="log" aria-live="polite">
        <div class="chat-msg bot">
          <div class="msg-bubble">
            👋 <b>Hi there!</b> I am the IIT Patna Hockey Team AI Assistant powered by <b>Gemini & Supabase</b>.<br><br>
            You can ask me about:
            <ul>
              <li><b>Rules & Cards:</b> e.g. <i>"What are penalty corner rules?"</i> or <i>"What is a green card?"</i></li>
              <li><b>Practice Schedules:</b> e.g. <i>"When is the next practice?"</i></li>
              <li><b>Your Attendance:</b> e.g. <i>"What is my attendance?"</i> (signed-in players)</li>
              <li><b>Warm-up:</b> e.g. <i>"Show me warm-up drills"</i></li>
            </ul>
          </div>
        </div>
      </div>
      <div class="chat-chips" id="chat-chips">
        <button type="button" class="chip" data-q="When is the next practice scheduled?">📅 Next Practice</button>
        <button type="button" class="chip" data-q="What is my attendance percentage?">📊 My Attendance</button>
        <button type="button" class="chip" data-q="Explain the rules of penalty corner">🏑 Penalty Corner Rules</button>
        <button type="button" class="chip" data-q="What are the team warm-up drills?">🔥 Warm-up Routine</button>
      </div>
      <form class="chat-form" id="chat-form" autocomplete="off">
        <input type="text" id="chat-input" placeholder="Ask about hockey, schedule, or attendance..." maxlength="300" required />
        <button type="submit" id="chat-send" class="pri" aria-label="Send Message">Send</button>
      </form>
    `;
    document.body.appendChild(dlg);

    // Movable / Draggable functionality for FAB
    makeDraggable(fab);

    document.getElementById("chat-close").onclick = closeChat;
    dlg.addEventListener("cancel", closeChat);

    // Chip click listeners
    const chips = dlg.querySelectorAll(".chip");
    chips.forEach(c => {
      c.onclick = () => {
        const q = c.getAttribute("data-q");
        if (q) sendMessage(q);
      };
    });

    // Form submit listener
    document.getElementById("chat-form").onsubmit = (e) => {
      e.preventDefault();
      const input = document.getElementById("chat-input");
      const val = input.value.trim();
      if (val) {
        sendMessage(val);
        input.value = "";
      }
    };
  }

  function makeDraggable(fab) {
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let hasMoved = false;

    // Restore saved position if valid
    try {
      const saved = JSON.parse(localStorage.getItem("hk_fab_pos") || "null");
      if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
        const maxX = window.innerWidth - 65;
        const maxY = window.innerHeight - 65;
        const curX = Math.min(maxX, Math.max(10, saved.x));
        const curY = Math.min(maxY, Math.max(10, saved.y));
        fab.style.left = `${curX}px`;
        fab.style.top = `${curY}px`;
        fab.style.bottom = "auto";
        fab.style.right = "auto";
      }
    } catch (e) {}

    function onStart(clientX, clientY) {
      isDragging = true;
      hasMoved = false;
      startX = clientX;
      startY = clientY;
      const rect = fab.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      fab.classList.add("dragging");
    }

    function onMove(clientX, clientY) {
      if (!isDragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasMoved = true;
      }
      const maxX = window.innerWidth - fab.offsetWidth - 10;
      const maxY = window.innerHeight - fab.offsetHeight - 10;
      const newX = Math.min(maxX, Math.max(10, initialLeft + dx));
      const newY = Math.min(maxY, Math.max(10, initialTop + dy));

      fab.style.left = `${newX}px`;
      fab.style.top = `${newY}px`;
      fab.style.bottom = "auto";
      fab.style.right = "auto";
    }

    function onEnd() {
      if (!isDragging) return;
      isDragging = false;
      fab.classList.remove("dragging");
      if (hasMoved) {
        try {
          const rect = fab.getBoundingClientRect();
          localStorage.setItem("hk_fab_pos", JSON.stringify({ x: rect.left, y: rect.top }));
        } catch (e) {}
      }
    }

    // Mouse drag support
    fab.addEventListener("mousedown", (e) => {
      onStart(e.clientX, e.clientY);
      const moveHandler = (ev) => onMove(ev.clientX, ev.clientY);
      const upHandler = () => {
        onEnd();
        window.removeEventListener("mousemove", moveHandler);
        window.removeEventListener("mouseup", upHandler);
      };
      window.addEventListener("mousemove", moveHandler);
      window.addEventListener("mouseup", upHandler);
    });

    // Touch drag support (mobile)
    fab.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      onStart(t.clientX, t.clientY);
    }, { passive: true });

    fab.addEventListener("touchmove", (e) => {
      if (!isDragging) return;
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
    }, { passive: true });

    fab.addEventListener("touchend", () => {
      onEnd();
    });

    // Click handler: opens popup only if not dragged
    fab.onclick = (e) => {
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      openChat();
    };
  }

  function openChat() {
    const dlg = document.getElementById("chatdlg");
    if (dlg) {
      if (typeof dlg.showModal === "function") {
        dlg.showModal();
      } else {
        dlg.setAttribute("open", "");
      }
      setTimeout(() => {
        const inp = document.getElementById("chat-input");
        if (inp) inp.focus();
      }, 100);
      scrollToBottom();
    }
  }

  function closeChat() {
    const dlg = document.getElementById("chatdlg");
    if (dlg) {
      if (typeof dlg.close === "function") {
        dlg.close();
      } else {
        dlg.removeAttribute("open");
      }
    }
  }

  function scrollToBottom() {
    const msgs = document.getElementById("chat-msgs");
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  function renderMarkdown(text) {
    if (!text) return "";
    let s = String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Bold **text**
    s = s.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
    // Italic *text*
    s = s.replace(/\*(.*?)\*/g, "<i>$1</i>");
    // Bullet lists
    s = s.replace(/^\s*[\*\-]\s+(.*)$/gm, "<li>$1</li>");
    s = s.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");
    // Blockquotes
    s = s.replace(/^>\s+(.*)$/gm, "<blockquote>$1</blockquote>");
    // Line breaks
    s = s.replace(/\n\n+/g, "<br><br>").replace(/\n/g, "<br>");
    return s;
  }

  async function sendMessage(text) {
    const msgs = document.getElementById("chat-msgs");
    const sendBtn = document.getElementById("chat-send");
    const input = document.getElementById("chat-input");
    if (!msgs || !text) return;

    // Append user message
    const userDiv = document.createElement("div");
    userDiv.className = "chat-msg user";
    userDiv.innerHTML = `<div class="msg-bubble">${renderMarkdown(text)}</div>`;
    msgs.appendChild(userDiv);
    scrollToBottom();

    // Append typing indicator
    const typingDiv = document.createElement("div");
    typingDiv.className = "chat-msg bot typing";
    typingDiv.innerHTML = `<div class="msg-bubble"><span class="dots"><span>.</span><span>.</span><span>.</span></span> Thinking…</div>`;
    msgs.appendChild(typingDiv);
    scrollToBottom();

    if (sendBtn) sendBtn.disabled = true;
    if (input) input.disabled = true;

    // Get auth token if present
    let token = "";
    try {
      token = localStorage.getItem("hk_token") || "";
    } catch (e) {}

    const apiUrl = (window.API_URL || "") + "/api/chat";

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {})
        },
        body: JSON.stringify({ message: text })
      });

      typingDiv.remove();

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Server returned " + res.status);
      }

      const data = await res.json();
      const botDiv = document.createElement("div");
      botDiv.className = "chat-msg bot";
      botDiv.innerHTML = `<div class="msg-bubble">${renderMarkdown(data.reply)}</div>`;
      msgs.appendChild(botDiv);
    } catch (err) {
      if (typingDiv) typingDiv.remove();
      const errDiv = document.createElement("div");
      errDiv.className = "chat-msg bot err";
      errDiv.innerHTML = `<div class="msg-bubble">⚠️ <b>Could not reach assistant:</b> ${renderMarkdown(err.message)}</div>`;
      msgs.appendChild(errDiv);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      if (input) {
        input.disabled = false;
        input.focus();
      }
      scrollToBottom();
    }
  }

  // Initialize once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initChatUI);
  } else {
    initChatUI();
  }

  // Expose global helper if needed
  window.openHockeyChat = openChat;
})();
