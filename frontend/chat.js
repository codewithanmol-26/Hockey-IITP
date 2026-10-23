/**
 * IIT Patna Hockey - AI Chatbot UI Component
 * Modeled after the official Google Gemini interface:
 * Single sleek floating trigger, vertical sheet/modal motion with drag-to-dismiss,
 * modern interactive topic cards, unified prompt pill bar with mic & send,
 * role/profile awareness, and auto-reset on open.
 */

(function () {
  let isListening = false;
  let recognition = null;
  let activeUtterance = null;
  let activeSpeakBtn = null;

  function getUserContext() {
    try {
      if (typeof window.getHockeyUserContext === "function") {
        return window.getHockeyUserContext();
      }
    } catch (_) {}
    return { role: "guest", title: "Guest / Visitor (Not in team)", name: "Guest" };
  }

  function initChatUI() {
    // Clean up any old elements if present
    const existingWrap = document.getElementById("chat-fab-wrap");
    if (existingWrap) existingWrap.remove();
    const existingFab = document.getElementById("chat-fab");
    if (existingFab) existingFab.remove();
    const existingDlg = document.getElementById("chatdlg");
    if (existingDlg) existingDlg.remove();

    // 1. Sleek Floating Action Icon Button (Chatbot Robot Icon)
    const fab = document.createElement("button");
    fab.id = "chat-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Open Hockey AI Assistant");
    fab.title = "Hockey AI Assistant (Drag to move)";
    fab.innerHTML = `<img src="icons/bot-icon.png" alt="Hockey AI Assistant" class="fab-bot-img" width="48" height="48" draggable="false" /><span class="fab-badge">AI</span>`;
    document.body.appendChild(fab);

    // 2. Chat Dialog Modal with Drag Handle & Redesigned Header
    const dlg = document.createElement("dialog");
    dlg.id = "chatdlg";
    dlg.className = "chat-dialog";
    dlg.setAttribute("aria-labelledby", "chat-title");
    dlg.innerHTML = `
      <div class="chat-sheet-handle" id="chat-drag-handle" title="Drag to move or pull down to close">
        <span class="chat-drag-pill"></span>
      </div>
      <div class="chat-header" id="chat-header">
        <div class="chat-header-left">
          <div class="chat-bot-avatar">
            <img src="icons/bot-icon.png" alt="Hockey AI" class="header-bot-img" width="36" height="36" />
            <span class="status-dot" title="AI active"></span>
          </div>
          <div class="chat-header-info">
            <div class="chat-title-row">
              <h2 id="chat-title">Hockey AI</h2>
              <span class="chat-engine-tag">Gemini</span>
            </div>
            <div class="chat-badge-row">
              <span id="chat-user-badge" class="chat-user-badge" title="Your current profile status">👤 Checking profile…</span>
            </div>
          </div>
        </div>
        <div class="chat-header-actions">
          <button type="button" class="chat-act-btn chat-close-btn" id="chat-close" aria-label="Close Assistant" title="Close">✕</button>
        </div>
      </div>
      <div class="chat-body" id="chat-msgs" role="log" aria-live="polite"></div>
      <div class="chat-chips-wrap">
        <div class="chat-chips" id="chat-chips"></div>
      </div>
      <form class="chat-form" id="chat-form" autocomplete="off">
        <div class="chat-input-pill">
          <input type="text" id="chat-input" placeholder="Ask Hockey AI anything…" maxlength="300" required />
          <button type="button" id="chat-mic" class="chat-mic-btn" aria-label="Voice input" title="Tap to speak">🎙️</button>
          <button type="submit" id="chat-send" class="chat-send-btn" aria-label="Send Message" title="Send">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </form>
    `;
    document.body.appendChild(dlg);

    // 3. Attach Draggable + Click handler on FAB button
    makeDraggable(fab);

    // 4. Attach Vertical Motion (Drag down to dismiss / vertical tracking)
    attachVerticalMotion(dlg);

    // 5. Close & Reset handlers
    const closeBtn = document.getElementById("chat-close");
    if (closeBtn) closeBtn.onclick = closeChat;
    const resetBtn = document.getElementById("chat-reset-btn");
    if (resetBtn) resetBtn.onclick = resetChat;

    dlg.addEventListener("cancel", closeChat);
    dlg.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeChat();
      }
    });

    // Click outside dialog (on backdrop) to close
    dlg.addEventListener("click", (e) => {
      if (e.target !== dlg) return;
      if (Date.now() - lastOpenTime < 400) return; // Ignore ghost clicks right after opening
      const rect = dlg.getBoundingClientRect();
      const isInside = (
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom
      );
      if (!isInside) {
        closeChat();
      }
    });

    // Prevent background scrolling only when touching the backdrop
    dlg.addEventListener("touchmove", (e) => {
      if (e.target === dlg) {
        e.preventDefault();
      }
    }, { passive: false });

    // 6. Mic button click (Gemini voice input)
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

    // Populate initial greeting and chips
    resetChat();
  }

  /**
   * Vertical Motion on Chatbot Window:
   * Handles smooth vertical dragging on the handle and header.
   * Pulling down translates the window vertically; releasing past threshold dismisses it.
   */
  function attachVerticalMotion(dlg) {
    const handle = dlg.querySelector("#chat-drag-handle");
    const header = dlg.querySelector("#chat-header");
    if (!handle && !header) return;

    let isDragging = false;
    let startY = 0;
    let currentTranslateY = 0;
    let startTime = 0;

    const dragTargets = [handle, header].filter(Boolean);

    dragTargets.forEach((target) => {
      target.addEventListener("pointerdown", onPointerDown);
    });

    function onPointerDown(e) {
      // Don't drag if clicking buttons, inputs, or interactive controls
      if (e.target.closest("button") || e.target.closest("input") || e.target.closest("a")) {
        return;
      }

      isDragging = true;
      startY = e.clientY;
      currentTranslateY = 0;
      startTime = Date.now();

      dlg.classList.add("chat-dragging");
      dlg.style.transition = "none";

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (_) {}

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerEnd);
      window.addEventListener("pointercancel", onPointerCancel);
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      const dy = e.clientY - startY;

      // Allow vertical motion
      if (dy > 0) {
        currentTranslateY = dy;
      } else {
        // Elastic resistance for upwards drag
        currentTranslateY = dy * 0.25;
      }

      dlg.style.transform = `translateY(${currentTranslateY}px)`;
    }

    function onPointerEnd(e) {
      if (!isDragging) return;
      isDragging = false;
      dlg.classList.remove("chat-dragging");

      try {
        if (e.target && typeof e.target.releasePointerCapture === "function") {
          e.target.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}

      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerCancel);

      const elapsed = Math.max(1, Date.now() - startTime);
      const velocity = currentTranslateY / elapsed;

      // If dragged down past threshold (95px) or swiped down fast (> 0.38px/ms)
      if (currentTranslateY > 95 || (currentTranslateY > 35 && velocity > 0.38)) {
        dlg.style.transition = "transform 0.22s cubic-bezier(0.3, 0, 0.8, 1), opacity 0.2s ease-out";
        dlg.style.transform = "translateY(110%)";
        dlg.style.opacity = "0";
        setTimeout(() => {
          closeChat();
          dlg.style.transform = "";
          dlg.style.opacity = "";
          dlg.style.transition = "";
        }, 220);
      } else {
        // Snap back smoothly
        dlg.style.transition = "transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)";
        dlg.style.transform = "";
        setTimeout(() => {
          dlg.style.transition = "";
        }, 260);
      }
    }

    function onPointerCancel() {
      if (!isDragging) return;
      isDragging = false;
      dlg.classList.remove("chat-dragging");
      dlg.style.transition = "transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)";
      dlg.style.transform = "";
      setTimeout(() => {
        dlg.style.transition = "";
      }, 260);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerCancel);
    }
  }

  function resetChat() {
    stopSpeaking();
    stopListening();

    const prof = getUserContext();
    updateUserBadge(prof);

    // 1. Reset messages with simple personalized greeting
    const msgs = document.getElementById("chat-msgs");
    if (msgs) {
      msgs.innerHTML = "";
      const botDiv = document.createElement("div");
      botDiv.className = "chat-msg bot welcome-msg";

      const nameDisplay = prof.name && prof.name !== "Guest" ? prof.name : "there";
      const rolePill = prof.title ? `<span class="bubble-role-pill">${escapeHtml(prof.title)}</span>` : "";

      botDiv.innerHTML = `
        <div class="msg-bubble welcome-bubble">
          <div class="welcome-header">
            <div class="welcome-avatar">
              <img src="icons/bot-icon.png" alt="Hockey AI" class="welcome-bot-img" width="44" height="44" />
            </div>
            <div class="welcome-heading">
              <div class="welcome-title">Hi ${escapeHtml(nameDisplay)}! 👋 ${rolePill}</div>
              <div class="welcome-sub">Welcome to the official <b>IIT Patna Hockey Assistant</b>. How can I help you today?</div>
            </div>
          </div>
        </div>
      `;

      msgs.appendChild(botDiv);
    }

    // 2. Suggestion chips
    const chipsContainer = document.getElementById("chat-chips");
    if (chipsContainer) {
      chipsContainer.innerHTML = "";
      const chipList = [
        { label: "🥗 Plan Diet", q: "How should I plan my diet for hockey practice and matches?" },
        { label: "📅 Next Practice", q: "When is the next practice scheduled?" },
        { label: "⚡ Penalty Corner", q: "Explain the rules of penalty corner in field hockey" },
        { label: "📊 Attendance", q: "What is my attendance percentage?" },
        { label: "🔥 Warm-up Routine", q: "What are the recommended team warm-up drills?" },
        { label: "🧤 Goalkeeping Tips", q: "What are key field hockey goalkeeping positioning tips?" }
      ];

      chipList.forEach(item => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip";
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
      badge.innerHTML = `👥 Guest • Visitor`;
      badge.title = "Browsing as guest. Team records are private.";
      return;
    }

    if (prof.role === "admin") {
      const isInst = prof.adminType === "instructor";
      badge.className = isInst ? "chat-user-badge instructor" : "chat-user-badge admin";
      badge.innerHTML = isInst
        ? `🛡️ Instructor: ${escapeHtml(prof.name || "Admin")}`
        : `🛡️ Admin: ${escapeHtml(prof.name || "Admin")}`;
      badge.title = isInst ? "Signed in as Instructor" : "Signed in as Admin";
      return;
    }

    if (prof.role === "captain" || prof.role === "vice") {
      badge.className = "chat-user-badge captain";
      badge.innerHTML = `⭐ ${escapeHtml(prof.title || "Captain")}: ${escapeHtml(prof.name || "")}`;
      badge.title = `Signed in as ${prof.title || "Captain"}`;
      return;
    }

    if (prof.role === "player") {
      badge.className = "chat-user-badge player";
      const pos = prof.position ? ` • ${escapeHtml(prof.position)}` : "";
      badge.innerHTML = `🏑 ${escapeHtml(prof.name || "Player")}${pos}`;
      badge.title = `Signed in as Player (Roll: ${escapeHtml(prof.roll || prof.id || "")})`;
      return;
    }

    badge.className = "chat-user-badge";
    badge.innerHTML = `👤 ${escapeHtml(prof.name || "Team Member")}`;
  }

  let lastOpenTime = 0;

  function makeDraggable(fab) {
    let isTracking = false;
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let dragDistance = 0;

    // Restore saved position if valid
    try {
      const saved = JSON.parse(localStorage.getItem("hk_fab_pos") || "null");
      if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
        const maxX = window.innerWidth - 56;
        const maxY = window.innerHeight - 56;
        if (saved.x >= 0 && saved.x <= maxX && saved.y >= 0 && saved.y <= maxY) {
          fab.style.left = saved.x + "px";
          fab.style.top = saved.y + "px";
          fab.style.right = "auto";
          fab.style.bottom = "auto";
        } else {
          localStorage.removeItem("hk_fab_pos");
        }
      }
    } catch (_) {}

    fab.addEventListener("pointerdown", (e) => {
      isTracking = true;
      isDragging = false;
      dragDistance = 0;
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
      if (!isTracking) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      dragDistance = Math.hypot(dx, dy);

      // Only enter drag mode if moved more than 12px (filters out touchscreen finger wobbles)
      if (!isDragging && dragDistance > 12) {
        isDragging = true;
        fab.classList.add("dragging");
      }

      if (isDragging) {
        let newX = initialLeft + dx;
        let newY = initialTop + dy;

        const maxX = window.innerWidth - fab.offsetWidth - 8;
        const maxY = window.innerHeight - fab.offsetHeight - 8;
        newX = Math.max(8, Math.min(newX, maxX));
        newY = Math.max(8, Math.min(newY, maxY));

        fab.style.left = newX + "px";
        fab.style.top = newY + "px";
        fab.style.right = "auto";
        fab.style.bottom = "auto";
      }
    });

    const onPointerEnd = (e) => {
      if (!isTracking) return;
      isTracking = false;
      fab.classList.remove("dragging");

      try {
        if (e.target && typeof e.target.releasePointerCapture === "function") {
          e.target.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}

      if (isDragging) {
        try {
          const rect = fab.getBoundingClientRect();
          localStorage.setItem("hk_fab_pos", JSON.stringify({ x: rect.left, y: rect.top }));
        } catch (_) {}
      } else {
        // It was a tap / click! Open chat immediately
        openChat();
      }
    };

    fab.addEventListener("pointerup", onPointerEnd);
    fab.addEventListener("pointercancel", () => {
      isTracking = false;
      isDragging = false;
      fab.classList.remove("dragging");
    });

    // Native click fallback (in case pointer events were prevented or synthetic)
    fab.addEventListener("click", (e) => {
      e.preventDefault();
      if (!isDragging) {
        openChat();
      }
    });
  }

  let savedScrollY = 0;

  function openChat() {
    const dlg = document.getElementById("chatdlg");
    if (!dlg) return;

    if (dlg.open) return; // Prevent double-trigger from pointerup + click

    lastOpenTime = Date.now();

    // Reset inline motion styles so dialog opens cleanly
    dlg.style.transform = "";
    dlg.style.opacity = "";
    dlg.style.transition = "";

    // Reset chat on every open as requested
    resetChat();

    // Lock background scroll position completely: NO background should move
    savedScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.width = "100%";
    document.body.classList.add("chat-modal-open");
    document.documentElement.classList.add("chat-modal-open");

    try {
      if (typeof dlg.showModal === "function") {
        dlg.showModal();
      } else {
        dlg.setAttribute("open", "");
      }
    } catch (_) {
      dlg.setAttribute("open", "");
    }

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

    // Restore background cleanly without jumping
    const restoreY = savedScrollY;
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    document.body.classList.remove("chat-modal-open");
    document.documentElement.classList.remove("chat-modal-open");
    window.scrollTo(0, restoreY);

    if (dlg) {
      dlg.style.transform = "";
      dlg.style.opacity = "";
      dlg.style.transition = "";
      if (typeof dlg.close === "function") {
        if (dlg.open) dlg.close();
      } else {
        dlg.removeAttribute("open");
      }
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
  // Voice Input (Microphone like original Gemini)
  // -------------------------------------------------------------

  function toggleMic() {
    if (isListening) {
      stopListening();
      return;
    }
    startListening();
  }

  function startListening() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    try {
      stopSpeaking();
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
          micBtn.title = "Listening… tap to stop";
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
          alert("Microphone permission was denied. Please allow microphone access in browser settings.");
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
      micBtn.title = "Tap to speak";
    }
    if (input) input.placeholder = "Ask Hockey AI anything…";

    if (recognition) {
      try { recognition.stop(); } catch (_) {}
      recognition = null;
    }
  }

  // -------------------------------------------------------------
  // Voice Output (Speech Synthesis)
  // -------------------------------------------------------------

  function speakText(text, btn) {
    if (!("speechSynthesis" in window)) {
      return;
    }

    if (window.speechSynthesis.speaking && activeSpeakBtn === btn) {
      stopSpeaking();
      return;
    }

    stopSpeaking();

    // Strip HTML & markdown for clean speech
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
      btn.innerHTML = `<span class="speak-icon">⏹️</span><span class="speak-label">Stop</span>`;
      btn.classList.add("speaking");
      btn.title = "Stop audio";
      activeSpeakBtn = btn;
    }

    const resetBtn = () => {
      if (btn) {
        btn.innerHTML = `<span class="speak-icon">🔊</span><span class="speak-label">Listen</span>`;
        btn.classList.remove("speaking");
        btn.title = "Listen";
      }
      if (activeSpeakBtn === btn) activeSpeakBtn = null;
    };

    utt.onend = resetBtn;
    utt.onerror = resetBtn;

    activeUtterance = utt;
    window.speechSynthesis.speak(utt);
  }

  function stopSpeaking() {
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
    if (activeSpeakBtn) {
      activeSpeakBtn.innerHTML = `<span class="speak-icon">🔊</span><span class="speak-label">Listen</span>`;
      activeSpeakBtn.classList.remove("speaking");
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
    typingDiv.innerHTML = `
      <div class="bot-msg-wrap">
        <div class="msg-bubble">
          <span class="dots"><span>●</span><span>●</span><span>●</span></span>
          <span style="margin-left: 6px; font-weight: 500;">Thinking…</span>
        </div>
      </div>
    `;
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
        <div class="bot-msg-wrap">
          <div class="msg-bubble">${renderMarkdown(botReply)}</div>
          <div class="msg-meta">
            <button type="button" class="bubble-speak-btn" aria-label="Listen to message" title="Listen">
              <span class="speak-icon">🔊</span>
              <span class="speak-label">Listen</span>
            </button>
          </div>
        </div>
      `;

      const speakBtn = botDiv.querySelector(".bubble-speak-btn");
      if (speakBtn) {
        speakBtn.onclick = () => speakText(botReply, speakBtn);
      }

      msgs.appendChild(botDiv);

      // If user spoke the question, read the answer aloud automatically
      if (fromVoice) {
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
        // Never auto-focus input: prevents virtual keyboard from abruptly popping open on mobile
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
