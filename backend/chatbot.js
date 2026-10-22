/**
 * IIT Patna Hockey - AI Chatbot Service
 * Uses Google Gemini API with Supabase Grounding & Row Level Security.
 * Free-tier friendly: Only injects targeted grounding data relevant to the user's question.
 */

const { GoogleGenAI } = require("@google/genai");
const db = require("./db");

let ai = null;
let currentKey = null;

function getAiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!ai || currentKey !== key) {
    try {
      ai = new GoogleGenAI({ apiKey: key });
      currentKey = key;
    } catch (e) {
      console.error("Failed to initialize Google Gen AI SDK:", e.message);
      return null;
    }
  }
  return ai;
}

// -------------------------------------------------------------
// Targeted Supabase Grounding Functions
// -------------------------------------------------------------

async function getRelevantSchedules() {
  try {
    const [plans, config] = await Promise.all([
      db.getPracticePlans(),
      db.getAppConfig("schedule")
    ]);
    const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

    const upcoming = [];
    for (const [date, p] of Object.entries(plans)) {
      if (date >= today && p.status !== "cancelled") {
        upcoming.push(`${date}: ${p.time || "Time TBD"} at ${p.venue || "Sports Complex"} (${p.note || "Practice"})`);
      }
    }

    const weekly = [];
    if (config && Array.isArray(config.team)) {
      config.team.forEach(r => {
        if (r.t) weekly.push(`${r.d}: ${r.t} - ${r.x || "Team session"}`);
      });
    }

    return {
      todayDateIST: today,
      upcomingPlannedDays: upcoming.length > 0 ? upcoming : "No specific upcoming playing days scheduled right now.",
      weeklyPracticeTimings: weekly
    };
  } catch (e) {
    return { error: "Schedule data currently unavailable" };
  }
}

async function getPlayerAttendanceSummary(rollNumber) {
  if (!rollNumber) return null;
  try {
    const [sessions, legacy, player] = await Promise.all([
      db.getSessions(),
      db.getLegacy(),
      db.getPlayer(rollNumber)
    ]);

    let totalWorkingDays = 0;
    let presentDays = 0;
    const recent = [];

    const sortedDates = Object.keys(sessions).sort().reverse();
    for (const date of sortedDates) {
      const r = sessions[date];
      if (r && r[rollNumber] !== undefined) {
        totalWorkingDays++;
        if (r[rollNumber]) presentDays++;
        if (recent.length < 5) {
          recent.push(`${date}: ${r[rollNumber] ? "Present" : "Absent"}`);
        }
      }
    }

    for (const month in legacy) {
      const l = legacy[month];
      if (l && l.att && l.att[rollNumber] !== undefined) {
        totalWorkingDays += (l.days || 0);
        presentDays += l.att[rollNumber];
      }
    }

    const pct = totalWorkingDays > 0 ? ((presentDays / totalWorkingDays) * 100).toFixed(1) : "0.0";

    return {
      roll: rollNumber,
      name: player ? player.name : rollNumber,
      position: player ? player.position : "",
      attendedDays: presentDays,
      totalDays: totalWorkingDays,
      percentage: pct + "%",
      recentSessions: recent
    };
  } catch (e) {
    return null;
  }
}

async function getRelevantRulesAndWarmup(query) {
  try {
    const q = query.toLowerCase();
    const isWarmup = /warm|stretch|drill|exercise|fitness|run|cooldown/i.test(q);

    if (isWarmup) {
      const warmup = await db.getWarmupDrills();
      return {
        warmupRoutines: warmup.map(w => ({
          title: w.title,
          drills: (w.items || []).map(i => `${i.h}: ${i.b}`)
        }))
      };
    }

    const rules = await db.getHockeyRules();
    // Filter matching sections if specific keywords exist
    let matched = [];
    if (/card|green|yellow|red|suspension/i.test(q)) {
      matched = rules.filter(r => /card|foul|conduct|signal/i.test(r.title));
    } else if (/penalty corner|short corner|stroke/i.test(q)) {
      matched = rules.filter(r => /corner|stroke|foul/i.test(r.title));
    } else if (/shootout|overtime|tie/i.test(q)) {
      matched = rules.filter(r => /shootout|overtime|time/i.test(r.title));
    } else if (/whistle|signal|umpire/i.test(q)) {
      matched = rules.filter(r => /signal|umpire|whistle/i.test(r.title));
    }

    if (matched.length === 0) {
      // Return top sections or summary
      matched = rules.slice(0, 4);
    }

    return {
      hockeyRules: matched.map(r => ({
        topic: r.title,
        points: (r.items || []).slice(0, 6).map(i => `${i.h}: ${i.b}`)
      }))
    };
  } catch (e) {
    return { rules: "Rules data unavailable" };
  }
}

// -------------------------------------------------------------
// Chat Execution
// -------------------------------------------------------------

async function chat({ message, user, history = [] }) {
  const client = getAiClient();
  if (!client) {
    throw new Error("Gemini AI is not configured. GEMINI_API_KEY is missing on the server.");
  }
  if (!message || typeof message !== "string" || !message.trim()) {
    throw new Error("Message text is required.");
  }

  const query = message.trim();
  const qLower = query.toLowerCase();

  const isAskingAttendance = /attendance|present|absent|percentage|attended|my record|stats/i.test(qLower);
  const isAskingSchedule = /schedule|practice|timing|when|today|tomorrow|playing day|match/i.test(qLower);
  const isAskingRules = /rule|card|penalty|corner|stroke|foul|signal|umpire|warm|stretch|drill/i.test(qLower);

  // Targeted grounding collection (Free-tier friendly & fast)
  const context = {};

  if (isAskingSchedule || (!isAskingAttendance && !isAskingRules)) {
    context.schedules = await getRelevantSchedules();
  }

  if (isAskingRules || (!isAskingAttendance && !isAskingSchedule)) {
    context.rulesAndDrills = await getRelevantRulesAndWarmup(query);
  }

  if (isAskingAttendance) {
    const targetRoll = (user && user.role === "player") ? user.id : (user && user.playerId);
    if (targetRoll) {
      context.playerAttendance = await getPlayerAttendanceSummary(targetRoll);
    } else {
      context.authNotice = "USER IS NOT LOGGED IN AS A PLAYER. Explain: 'Please log in with your student roll number to view your personal attendance.' Never show or guess attendance.";
    }
  }

  const prompt = `You are the official IIT Patna Hockey Team AI Assistant.
Answer the user's question clearly, concisely, and helpfully in GitHub Markdown.

STRICT GROUNDING RULES:
1. NEVER INVENT OR GUESS practice dates, times, venues, or attendance figures.
2. If asked about schedules, use ONLY the schedules provided below. If none exist for a specific date, say so.
3. If asked about attendance, use ONLY the verified player attendance provided below. If the user is not logged in, tell them to log in.
4. Players can only see their own attendance. Attendance of other players is confidential.
5. For rules, explain standard FIH rules accurately.

VERIFIED GROUNDING DATA FROM SUPABASE:
${JSON.stringify(context, null, 2)}

USER MESSAGE:
${query}`;

  // Prioritize gemini-3.8-flash as primary model with gemini-3.5-flash fallback if quota is exceeded
  const candidateModels = ["gemini-3.8-flash", "gemini-3.5-flash"];
  let replyText = null;
  let lastError = null;

  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await Promise.race([
          client.models.generateContent({
            model,
            contents: prompt
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout with model ${model}`)), 25000)
          )
        ]);

        if (res && res.text) {
          replyText = res.text.trim();
          break;
        }
      } catch (e) {
        lastError = e;
        const is503 = /503|UNAVAILABLE|high demand/i.test(e.message);
        if (is503 && attempt === 0) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        break;
      }
    }
    if (replyText) break;
  }

  if (!replyText) {
    throw new Error(
      lastError
        ? `AI service temporary error: ${lastError.message}`
        : "AI service currently unavailable. Please try again."
    );
  }

  return {
    reply: replyText,
    userRole: user ? user.role : "public",
    playerId: user && user.role === "player" ? user.id : null
  };
}

module.exports = {
  chat,
  getRelevantSchedules,
  getPlayerAttendanceSummary
};
