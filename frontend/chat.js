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
    fab.title = "Hockey AI Assistant";
    fab.innerHTML = `<span class="fab-icon">🏑</span><span class="fab-label">AI Chat</span>`;
    document.body.appendChild(fab);

    // Chat Dialog
    const dlg = document.createElement("dialog");
    dlg.id = "chatdlg";
    dlg.className = "chat-dialog";
    dlg.setAttribute("aria-labelledby", "chat-title");
    dlg.innerHTML = `
      <div class="chat-header">
        <button type="button" class="dx" id="chat-close" aria-label="Close Assistant">✕</button>
        <div class="chat-header-info">
          <h2 id="chat-title">Hockey AI Assistant</h2>
          <span class="chat-sub">Rules · Practice Schedules · Attendance</span>
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

    // Event Listeners
    fab.onclick = openChat;
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
