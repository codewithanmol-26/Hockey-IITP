/**
 * IIT Patna Hockey - AI Chatbot UI Component
 * Provides a floating assistant button, modal chat dialog, quick suggestion chips,
 * role/profile awareness (Instructor, Player, Guest), reset on open,
 * two-way voice communication (Speech-to-Text & Text-to-Speech), and touch-friendly controls.
 */

(function () {
  let isListening = false;
  let recognition = null;
  let activeUtterance = null;
  let activeSpeakBtn = null;
  let autoVoiceEnabled = false;

  function getUserContext() {
    try {
      if (typeof window.getHockeyUserContext === "function") {
        return window.getHockeyUserContext();
      }
    } catch (_) {}
    return { role: "guest", title: "Guest / Visitor (Not in team)", name: "Guest" };
  }

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
          <button type="button" class="chat-tool-btn" id="chat-voice-toggle" aria-label="Toggle Voice Read-aloud" title="Voice Read-aloud (Off)">🔇</button>
        </div>
        <div class="chat-header-info">
          <div class="chat-title-row">
            <h2 id="chat-title">Hockey AI Assistant</h2>
            <span class="status-dot" title="AI active"></span>
          </div>
          <div class="chat-badge-row">
            <span id="chat-user-badge" class="chat-user-badge" title="Your current profile status">👤 Checking profile…</span>
          </div>
        </div>
      </div>
      <div class="chat-body" id="chat-msgs" role="log" aria-live="polite"></div>
      <div class="chat-chips" id="chat-chips"></div>
      <form class="chat-form" id="chat-form" autocomplete="off">
        <button type="button" id="chat-mic" class="chat-mic-btn" aria-label="Voice input" title="Voice Input (Tap to speak)">🎙️</button>
        <input type="text" id="chat-input" placeholder="Ask about diet, rules, or schedule…" maxlength="300" required />
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

    // 5. Header voice toggle
    const voiceToggleBtn = document.getElementById("chat-voice-toggle");
    if (voiceToggleBtn) {
      voiceToggleBtn.onclick = () => {
        autoVoiceEnabled = !autoVoiceEnabled;
        voiceToggleBtn.classList.toggle("on", autoVoiceEnabled);
        voiceToggleBtn.textContent = autoVoiceEnabled ? "🔊" : "🔇";
        voiceToggleBtn.title = autoVoiceEnabled
          ? "Voice Read-aloud is ON (Replies will be spoken)"
          : "Voice Read-aloud is OFF";
        if (!autoVoiceEnabled && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          if (activeSpeakBtn) {
            activeSpeakBtn.textContent = "🔊";
            activeSpeakBtn = null;
          }
        }
      };
    }

    // 6. Mic button click
    const micBtn = document.getElementById("chat-mic");
    if (micBtn) {
      micBtn.onclick = toggleMic;
    }

    // 7. Form Submission
    const form = document.getElementById("chat-form");
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const input = document.getElementById("chat-input");
        const val = input ? input.value.trim() : "";
        if (val) {
          sendMessage(val, { fromVoice: false });
          if (input) input.value = "";
        }
      };
    }
  }

  function resetChat() {
    stopSpeaking();
    stopListening();

    const prof = getUserContext();
    updateUserBadge(prof);

    // 1. Reset messages with personalized greeting
    const msgs = document.getElementById("chat-msgs");
    if (msgs) {
      msgs.innerHTML = "";
      const botDiv = document.createElement("div");
      botDiv.className = "chat-msg bot";

      const nameDisplay = prof.name && prof.name !== "Guest" ? prof.name : "there";
      const rolePill = prof.title ? `<span class="bubble-role-pill">${escapeHtml(prof.title)}</span>` : "";

      let attendanceLine = `<li>🔒 <b>Attendance:</b> <i>Log in with student roll number to view personal records</i></li>`;
      if (prof.role === "player" || (prof.role === "admin" && prof.playerId) || prof.role === "captain" || prof.role === "vice") {
        attendanceLine = `<li>📊 <b>Your Attendance:</b> e.g. <i>"What is my attendance percentage?"</i></li>`;
      } else if (prof.role === "admin") {
        attendanceLine = `<li>📊 <b>Team Sessions:</b> e.g. <i>"How many total sessions have we played?"</i></li>`;
      }

      botDiv.innerHTML = `
        <div class="msg-bubble">
          👋 <b>Hi ${escapeHtml(nameDisplay)}!</b> ${rolePill}<br><br>
          I am the official <b>IIT Patna Hockey Team AI Assistant</b> powered by Gemini & Supabase.<br><br>
          Feel free to ask me about:
          <ul>
            <li>🥗 <b>Diet & Fitness:</b> e.g. <i>"How to plan diet for hockey?"</i> or <i>"What should I eat before practice?"</i></li>
            <li>📅 <b>Practice Schedules:</b> e.g. <i>"When is the next practice scheduled?"</i></li>
            <li>🏑 <b>Rules & Warm-ups:</b> e.g. <i>"Explain penalty corner rules"</i> or <i>"Show warm-up drills"</i></li>
            ${attendanceLine}
          </ul>
          <span style="font-size:0.75rem;color:var(--mute)">🎙️ Tap the mic to talk with your voice, or 🔊 to hear any answer read aloud.</span>
        </div>
        <button type="button" class="bubble-speak-btn" aria-label="Listen to message" title="Listen">🔊</button>
      `;

      const speakBtn = botDiv.querySelector(".bubble-speak-btn");
      if (speakBtn) {
        speakBtn.onclick = () => {
          const bubble = botDiv.querySelector(".msg-bubble");
          if (bubble) speakText(bubble.textContent || "", speakBtn);
        };
      }

      msgs.appendChild(botDiv);
    }

    // 2. Reset suggestion chips
    const chipsContainer = document.getElementById("chat-chips");
    if (chipsContainer) {
      chipsContainer.innerHTML = "";
      const chipList = [
        { label: "🥗 Plan Hockey Diet", q: "How should I plan my diet for hockey practice and matches?" },
        { label: "📅 Next Practice", q: "When is the next practice scheduled?" },
        { label: "🏑 Penalty Corner Rules", q: "Explain the rules of penalty corner in field hockey" },
        { label: "📊 My Attendance", q: "What is my attendance percentage?" },
        { label: "🔥 Warm-up Routine", q: "What are the team warm-up drills?" }
      ];

      chipList.forEach(item => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip";
        btn.setAttribute("data-q", item.q);
        btn.textContent = item.label;
        btn.onclick = () => sendMessage(item.q, { fromVoice: false });
        chipsContainer.appendChild(btn);
      });
    }

    // 3. Clear input
    const input = document.getElementById("chat-input");
    if (input) {
      input.value = "";
    }
  }

  function updateUserBadge(prof) {
    const badge = document.getElementById("chat-user-badge");
    if (!badge) return;

    if (!prof || prof.role === "guest") {
      badge.className = "chat-user-badge guest";
      badge.innerHTML = `👥 Guest / Visitor (Not in team)`;
      badge.title = "You are currently browsing as a guest. Personal attendance is private to team players.";
      return;
    }

    if (prof.role === "admin") {
      const isInst = prof.adminType === "instructor";
      badge.className = isInst ? "chat-user-badge instructor" : "chat-user-badge";
      badge.innerHTML = isInst
        ? `🛡️ Instructor: ${escapeHtml(prof.name || "Admin")}`
        : `🛡️ Player Admin: ${escapeHtml(prof.name || "Admin")}`;
      badge.title = isInst ? "Signed in as Instructor" : "Signed in as Player Admin";
      return;
    }

    if (prof.role === "captain" || prof.role === "vice") {
      badge.className = "chat-user-badge";
      badge.innerHTML = `⭐ ${escapeHtml(prof.title || "Captain")}: ${escapeHtml(prof.name || "")}`;
      badge.title = `Signed in as ${prof.title || "Captain"}`;
      return;
    }

    if (prof.role === "player") {
      badge.className = "chat-user-badge";
      badge.innerHTML = `🏑 ${escapeHtml(prof.name || "Player")}${prof.position ? ` (${escapeHtml(prof.position)})` : ""}`;
      badge.title = `Signed in as Player (Roll: ${escapeHtml(prof.roll || prof.id || "")})`;
      return;
    }

    badge.className = "chat-user-badge";
    badge.innerHTML = `👤 ${escapeHtml(prof.name || "Team Member")}`;
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

    // Reset chat on every open as requested
    resetChat();

    if (typeof dlg.showModal === "function") {
      if (!dlg.open) dlg.showModal();
    } else {
      dlg.setAttribute("open", "");
    }

    // Only focus input on fine pointer (desktop), never on mobile touchscreens to avoid jumping keyboard
    if (window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      setTimeout(() => {
        const inp = document.getElementById("chat-input");
        if (inp) inp.focus();
      }, 100);
    }
    scrollToBottom();
  }

  function closeChat() {
    stopSpeaking();
    stopListening();
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

  function escapeHtml(text) {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderMarkdown(text) {
    if (!text) return "";
    let s = escapeHtml(text);

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

  // -------------------------------------------------------------
  // Voice Communication: Speech-to-Text & Text-to-Speech
  // -------------------------------------------------------------

  function toggleMic() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Voice recognition is not supported in this browser. Please type your question.");
      return;
    }
    if (isListening) {
      stopListening();
      return;
    }
    startListening(SpeechRec);
  }

  function startListening(SpeechRec) {
    try {
      recognition = new SpeechRec();
      recognition.lang = "en-IN";
      recognition.interimResults = true;
      recognition.continuous = false;

      const micBtn = document.getElementById("chat-mic");
      const input = document.getElementById("chat-input");

      recognition.onstart = () => {
        isListening = true;
        if (micBtn) {
          micBtn.classList.add("listening");
          micBtn.title = "Listening… tap to cancel";
        }
        if (input) input.placeholder = "Listening… speak now";
      };

      recognition.onresult = (e) => {
        let interim = "";
        let final = "";
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) {
            final += e.results[i][0].transcript;
          } else {
            interim += e.results[i][0].transcript;
          }
        }
        if (input) {
          input.value = final || interim;
        }
        if (final && final.trim()) {
          stopListening();
          sendMessage(final.trim(), { fromVoice: true });
        }
      };

      recognition.onerror = (e) => {
        console.warn("Speech recognition error:", e.error);
        stopListening();
        if (e.error === "not-allowed") {
          alert("Microphone permission was denied. Please allow microphone access to talk to the assistant.");
        }
      };

      recognition.onend = () => {
        stopListening();
      };

      recognition.start();
    } catch (err) {
      console.error("Mic start failed:", err);
      stopListening();
    }
  }

  function stopListening() {
    isListening = false;
    const micBtn = document.getElementById("chat-mic");
    const input = document.getElementById("chat-input");
    if (micBtn) {
      micBtn.classList.remove("listening");
      micBtn.title = "Voice Input (Tap to speak)";
    }
    if (input) input.placeholder = "Ask about diet, rules, or schedule…";
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
      recognition = null;
    }
  }

  function speakText(text, btn) {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech audio is not supported in this browser.");
      return;
    }

    if (window.speechSynthesis.speaking && activeSpeakBtn === btn) {
      stopSpeaking();
      return;
    }

    stopSpeaking();

    // Strip HTML & markdown for clean audio voice
    const clean = String(text)
      .replace(/<[^>]+>/g, " ")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/#{1,6}\s+/g, "")
      .replace(/`{1,3}[^`]*`{1,3}/g, "")
      .replace(/>\s+/g, "")
      .replace(/[-*•]\s+/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) return;

    const utt = new SpeechSynthesisUtterance(clean);
    utt.rate = 1.0;
    utt.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith("en-IN") || v.lang.startsWith("en-GB") || v.lang.startsWith("en-US"));
    if (voice) utt.voice = voice;

    if (btn) {
      btn.textContent = "⏹️";
      btn.title = "Stop audio";
      activeSpeakBtn = btn;
    }

    utt.onend = () => {
      if (btn) {
        btn.textContent = "🔊";
        btn.title = "Listen";
      }
      if (activeSpeakBtn === btn) activeSpeakBtn = null;
    };

    utt.onerror = () => {
      if (btn) {
        btn.textContent = "🔊";
        btn.title = "Listen";
      }
      if (activeSpeakBtn === btn) activeSpeakBtn = null;
    };

    activeUtterance = utt;
    window.speechSynthesis.speak(utt);
  }

  function stopSpeaking() {
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
    if (activeSpeakBtn) {
      activeSpeakBtn.textContent = "🔊";
      activeSpeakBtn.title = "Listen";
      activeSpeakBtn = null;
    }
    activeUtterance = null;
  }

  // -------------------------------------------------------------
  // Send Message Execution
  // -------------------------------------------------------------

  async function sendMessage(text, options = {}) {
    const fromVoice = Boolean(options && options.fromVoice);
    const msgs = document.getElementById("chat-msgs");
    const sendBtn = document.getElementById("chat-send");
    const input = document.getElementById("chat-input");
    if (!msgs || !text) return;

    stopSpeaking();

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
      if (data.userProfile) {
        updateUserBadge(data.userProfile);
      }

      const botReply = data.reply || data.error || "No response received.";
      const botDiv = document.createElement("div");
      botDiv.className = "chat-msg bot";
      botDiv.innerHTML = `
        <div class="msg-bubble">${renderMarkdown(botReply)}</div>
        <button type="button" class="bubble-speak-btn" aria-label="Listen to message" title="Listen">🔊</button>
      `;

      const speakBtn = botDiv.querySelector(".bubble-speak-btn");
      if (speakBtn) {
        speakBtn.onclick = () => speakText(botReply, speakBtn);
      }

      msgs.appendChild(botDiv);

      // If user queried via mic OR autoVoice is on, read reply aloud automatically
      if (fromVoice || autoVoiceEnabled) {
        speakText(botReply, speakBtn);
      }

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
        // DO NOT call input.focus() here: prevents mobile keyboard from abruptly opening after every bot answer!
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
  window.resetHockeyChat = resetChat;
})();
