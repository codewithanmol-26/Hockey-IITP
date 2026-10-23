/**
 * IIT Patna Hockey - AI Chatbot UI Component
 * Provides a floating assistant button, modal chat dialog, quick suggestion chips,
 * and seamless Bearer token authentication to query Gemini & Supabase.
 */

(function () {
  function initChatUI() {
    if (document.getElementById("chat-fab")) return;

    // 1. Floating Action Button
    const fab = document.createElement("button");
    fab.id = "chat-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Open Hockey AI Assistant");
    fab.title = "Hockey AI Assistant (Drag to move)";
    fab.innerHTML = `<span class="fab-icon">🏑</span><span class="fab-label">AI Chat</span>`;
    document.body.appendChild(fab);

    // 2. Chat Dialog Modal
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

    // 3. Attach Draggable + Click handler
    makeDraggable(fab);

    // 4. Close handlers
    const closeBtn = document.getElementById("chat-close");
    if (closeBtn) closeBtn.onclick = closeChat;
    dlg.addEventListener("cancel", closeChat);
    dlg.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeChat();
      }
    });

    // Click outside dialog to close
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) {
        closeChat();
      }
    });

    // 5. Suggestion Chips
    dlg.querySelectorAll(".chip").forEach((c) => {
      c.onclick = () => {
        const q = c.getAttribute("data-q");
        if (q) sendMessage(q);
      };
    });

    // 6. Form Submission
    const form = document.getElementById("chat-form");
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const input = document.getElementById("chat-input");
        const val = input ? input.value.trim() : "";
        if (val) {
          sendMessage(val);
          if (input) input.value = "";
        }
      };
    }
  }

  function makeDraggable(fab) {
    let isPointerDown = false;
    let hasDragged = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

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

    fab.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      isPointerDown = true;
      hasDragged = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = fab.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      try {
        fab.setPointerCapture(e.pointerId);
      } catch (_) {}
    });

    fab.addEventListener("pointermove", (e) => {
      if (!isPointerDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const dist = Math.hypot(dx, dy);

      // Drag threshold: must move at least 8px to count as a drag
      if (!hasDragged && dist > 8) {
        hasDragged = true;
        fab.classList.add("dragging");
      }

      if (hasDragged) {
        const maxX = window.innerWidth - fab.offsetWidth - 10;
        const maxY = window.innerHeight - fab.offsetHeight - 10;
        const newX = Math.min(maxX, Math.max(10, initialLeft + dx));
        const newY = Math.min(maxY, Math.max(10, initialTop + dy));

        fab.style.left = `${newX}px`;
        fab.style.top = `${newY}px`;
        fab.style.bottom = "auto";
        fab.style.right = "auto";
      }
    });

    const onPointerEnd = (e) => {
      if (!isPointerDown) return;
      isPointerDown = false;
      fab.classList.remove("dragging");
      try {
        fab.releasePointerCapture(e.pointerId);
      } catch (_) {}

      if (hasDragged) {
        try {
          const rect = fab.getBoundingClientRect();
          localStorage.setItem("hk_fab_pos", JSON.stringify({ x: rect.left, y: rect.top }));
        } catch (_) {}
      } else {
        openChat();
      }
    };

    fab.addEventListener("pointerup", onPointerEnd);
    fab.addEventListener("pointercancel", () => {
      isPointerDown = false;
      fab.classList.remove("dragging");
    });

    // Direct click fallback
    fab.addEventListener("click", (e) => {
      e.preventDefault();
      if (!hasDragged) openChat();
    });
  }

  function openChat() {
    const dlg = document.getElementById("chatdlg");
    if (!dlg) return;
    if (typeof dlg.showModal === "function") {
      if (!dlg.open) dlg.showModal();
    } else {
      dlg.setAttribute("open", "");
    }
    setTimeout(() => {
      const inp = document.getElementById("chat-input");
      if (inp) inp.focus();
    }, 120);
    scrollToBottom();
  }

  function closeChat() {
    const dlg = document.getElementById("chatdlg");
    if (!dlg) return;
    if (typeof dlg.close === "function") {
      if (dlg.open) dlg.close();
    } else {
      dlg.removeAttribute("open");
    }
    const fab = document.getElementById("chat-fab");
    if (fab) fab.focus();
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
      botDiv.innerHTML = `<div class="msg-bubble">${renderMarkdown(data.reply || data.error || "No response received.")}</div>`;
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

  // Expose global helper
  window.openHockeyChat = openChat;
})();
