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
      db.getAppConfig("schedule"),
    ]);
    const today = new Date(Date.now() + 5.5 * 3600e3)
      .toISOString()
      .slice(0, 10);

    const upcoming = [];
    for (const [date, p] of Object.entries(plans)) {
      if (date >= today && p.status !== "cancelled") {
        upcoming.push(
          `${date}: ${p.time || "Time TBD"} at ${p.venue || "Sports Complex"} (${p.note || "Practice"})`,
        );
      }
    }

    const weekly = [];
    if (config && Array.isArray(config.team)) {
      config.team.forEach((r) => {
        if (r.t) weekly.push(`${r.d}: ${r.t} - ${r.x || "Team session"}`);
      });
    }

    return {
      todayDateIST: today,
      upcomingPlannedDays:
        upcoming.length > 0
          ? upcoming
          : "No specific upcoming playing days scheduled right now.",
      weeklyPracticeTimings: weekly,
    };
  } catch (e) {
    return { error: "Schedule data currently unavailable" };
  }
}

async function getTeamSessionsSummary() {
  try {
    const [sessions, legacy] = await Promise.all([
      db.getSessions(),
      db.getLegacy(),
    ]);
    const dates = Object.keys(sessions).sort();
    const legacyDays = Object.keys(legacy).reduce(
      (acc, k) => acc + (legacy[k].days || 0),
      0,
    );
    const uniqueDates = new Set(dates.map((d) => d.slice(0, 10)));
    const totalPlayingDays = uniqueDates.size + legacyDays;
    const totalSessions = dates.length + legacyDays;

    const byMonth = {};
    for (const d of dates) {
      const m = d.slice(0, 7);
      byMonth[m] = (byMonth[m] || 0) + 1;
    }
    for (const m in legacy) {
      byMonth[m] = (byMonth[m] || 0) + (legacy[m].days || 0);
    }

    return {
      totalRecordedSessions: totalSessions,
      totalPlayingDays: totalPlayingDays,
      monthlyBreakdown: byMonth,
      notes:
        `Total recorded sessions is ${totalSessions} across ${totalPlayingDays} playing days. Total playing days is 1 less than total sessions because on 29 Jan 2026 the team held 2 sessions (Session 1 and Session 2).`,
    };
  } catch (e) {
    return { error: "Team sessions data unavailable" };
  }
}

async function getPlayerAttendanceSummary(rollNumber) {
  if (!rollNumber) return null;
  try {
    const [sessions, legacy, player] = await Promise.all([
      db.getSessions(),
      db.getLegacy(),
      db.getPlayer(rollNumber),
    ]);

    const sortedDates = Object.keys(sessions).sort().reverse();
    const legacyDays = Object.keys(legacy).reduce(
      (acc, k) => acc + (legacy[k].days || 0),
      0,
    );
    // In IITP Hockey attendance rules: total working days is identical for all players in the team
    const totalWorkingDays = sortedDates.length + legacyDays;
    let presentDays = 0;
    const recent = [];

    for (const date of sortedDates) {
      const r = sessions[date];
      const isPresent = Boolean(r && r[rollNumber]);
      if (isPresent) presentDays++;
      if (recent.length < 5) {
        recent.push(`${date}: ${isPresent ? "Present" : "Absent"}`);
      }
    }

    for (const month in legacy) {
      const l = legacy[month];
      if (l && l.att && l.att[rollNumber]) {
        presentDays += l.att[rollNumber];
      }
    }

    const pct =
      totalWorkingDays > 0
        ? ((presentDays / totalWorkingDays) * 100).toFixed(1)
        : "0.0";

    return {
      roll: rollNumber,
      name: player ? player.name : rollNumber,
      position: player ? player.position : "",
      attendedDays: presentDays,
      totalDays: totalWorkingDays,
      percentage: pct + "%",
      recentSessions: recent,
    };
  } catch (e) {
    return null;
  }
}

async function getRelevantRulesAndWarmup(query) {
  try {
    const q = query.toLowerCase();
    const isWarmup = /warm|stretch|drill|exercise|fitness|run|cooldown/i.test(
      q,
    );

    if (isWarmup) {
      const warmup = await db.getWarmupDrills();
      return {
        warmupRoutines: warmup.map((w) => ({
          title: w.title,
          drills: (w.items || []).map((i) => `${i.h}: ${i.b}`),
        })),
      };
    }

    const rules = await db.getHockeyRules();
    // Filter matching sections if specific keywords exist
    let matched = [];
    if (/card|green|yellow|red|suspension/i.test(q)) {
      matched = rules.filter((r) => /card|foul|conduct|signal/i.test(r.title));
    } else if (/penalty corner|short corner|stroke/i.test(q)) {
      matched = rules.filter((r) => /corner|stroke|foul/i.test(r.title));
    } else if (/shootout|overtime|tie/i.test(q)) {
      matched = rules.filter((r) => /shootout|overtime|time/i.test(r.title));
    } else if (/whistle|signal|umpire/i.test(q)) {
      matched = rules.filter((r) => /signal|umpire|whistle/i.test(r.title));
    }

    if (matched.length === 0) {
      // Return top sections or summary
      matched = rules.slice(0, 4);
    }

    return {
      hockeyRules: matched.map((r) => ({
        topic: r.title,
        points: (r.items || []).slice(0, 6).map((i) => `${i.h}: ${i.b}`),
      })),
    };
  } catch (e) {
    return { rules: "Rules data unavailable" };
  }
}

// -------------------------------------------------------------
// Chat Execution
// -------------------------------------------------------------

async function chat({ message, user, userProfile, history = [] }) {
  const client = getAiClient();
  if (!client) {
    throw new Error(
      "Gemini AI is not configured. GEMINI_API_KEY is missing on the server.",
    );
  }
  if (!message || typeof message !== "string" || !message.trim()) {
    throw new Error("Message text is required.");
  }

  const query = message.trim();
  const qLower = query.toLowerCase();

  const isAskingAttendance =
    /attendance|present|absent|percentage|attended|my record|stats/i.test(
      qLower,
    );
  const isAskingSchedule =
    /schedule|practice|timing|when|today|tomorrow|playing day|match/i.test(
      qLower,
    );
  const isAskingRules =
    /rule|card|penalty|corner|stroke|foul|signal|umpire|warm|stretch|drill/i.test(
      qLower,
    );
  const isAskingTeamStats =
    /how many days|total days|playing days|sessions|played|history|records|twice|november|january/i.test(
      qLower,
    );
  const isAskingDietOrFitness =
    /diet|nutrition|food|protein|carb|meal|eat|breakfast|lunch|dinner|calorie|weight|hydration|water|supplement|electrolyte|mess|hostel|recovery|stamina|fatigue/i.test(
      qLower,
    );

  // Targeted grounding collection (Free-tier friendly & fast)
  const context = {};

  if (isAskingTeamStats || isAskingAttendance) {
    context.teamSessions = await getTeamSessionsSummary();
  }

  if (
    isAskingSchedule ||
    (!isAskingAttendance &&
      !isAskingRules &&
      !isAskingTeamStats &&
      !isAskingDietOrFitness)
  ) {
    context.schedules = await getRelevantSchedules();
  }

  if (
    isAskingRules ||
    (!isAskingAttendance &&
      !isAskingSchedule &&
      !isAskingTeamStats &&
      !isAskingDietOrFitness)
  ) {
    context.rulesAndDrills = await getRelevantRulesAndWarmup(query);
  }

  if (isAskingDietOrFitness) {
    context.sportsNutritionGuidelines = {
      focus: "Field Hockey Athletic Nutrition & Performance Recovery",
      macronutrients:
        "High complex carbohydrates (glycogen replenishment for high-intensity repeat sprints), moderate lean protein (1.4-1.8g/kg body weight for muscular repair), healthy fats.",
      timing:
        "Pre-practice meal 2-3 hours prior (carbs + light protein); pre-game snack 30-45 min prior (banana/dates/electrolytes); post-training recovery within 30-45 min (3:1 carb to protein ratio).",
      hydration:
        "Start well hydrated; 150-250ml electrolyte/water sips during quarterly/practice breaks; rehydrate 1.25x fluid lost after turf sessions.",
      campusHostelOptions:
        "Boiled eggs, sattu drink, bananas, curd/buttermilk, oats, peanut butter, roasted chana, paneer, mess dal & sprouted pulses.",
    };
  }

  if (isAskingAttendance) {
    const targetRoll =
      user && user.role === "player" ? user.id : user && user.playerId;
    if (targetRoll) {
      context.playerAttendance = await getPlayerAttendanceSummary(targetRoll);
    } else {
      context.authNotice =
        "USER IS NOT LOGGED IN AS A PLAYER. Explain: 'Please log in with your student roll number to view your personal attendance.' Never show or guess attendance.";
    }
  }

  const roleDesc = userProfile
    ? userProfile.role === "admin"
      ? userProfile.adminType === "instructor"
        ? `Instructor (${userProfile.name})`
        : `Player Admin (${userProfile.name})`
      : userProfile.role === "player"
        ? `Team Player (${userProfile.name}${userProfile.position ? ", Position: " + userProfile.position : ""}${userProfile.roll ? ", Roll: " + userProfile.roll : ""})`
        : userProfile.role === "captain"
          ? `Team Captain (${userProfile.name || "Captain"})`
          : userProfile.role === "vice"
            ? `Team Vice-Captain (${userProfile.name || "Vice-Captain"})`
            : "Guest / Visitor (Not in team)"
    : "Guest / Visitor (Not in team)";

  const prompt = `You are the official IIT Patna Hockey Team AI Assistant.
Answer the user's question clearly, concisely, warmly, and helpfully in GitHub Markdown.

CURRENT USER IDENTITY & PROFILE:
- Authenticated Status: ${userProfile && userProfile.role !== "guest" ? "Logged In Team Member" : "Guest / Public Visitor (Not in team)"}
- Role & Title: ${roleDesc}
${userProfile && userProfile.position ? `- Playing Position: ${userProfile.position}` : ""}
${userProfile && userProfile.roll ? `- Student Roll Number: ${userProfile.roll}` : ""}

PROFILE PERSONALIZATION:
1. Always be conscious of who is asking:
   - If Instructor: Address them respectfully as Instructor (e.g. "Instructor ${userProfile && userProfile.name ? userProfile.name : "Aryan"}"). You can assist with team session overviews, training load, drill ideas, and squad fitness.
   - If Player: Address them by name. Personalize training, drills, tactical tips, and diet to their playing position (${userProfile && userProfile.position ? userProfile.position : "field player"}).
   - If Guest / Not in team: Be welcoming and helpful with hockey rules, general training tips, and public schedules. If they ask about private team records or personal attendance, politely explain that attendance records are only visible to logged-in team players and instructors.

TOPIC GUIDANCE:
1. SPORTS NUTRITION, DIET & FITNESS:
   - You ARE FULLY EMPOWERED and encouraged to provide rich, practical, evidence-based athletic diet plans, pre-match and post-practice nutrition, hydration, and recovery guidelines.
   - Suggest collegiate & Indian hostel-friendly options (e.g. eggs, sattu, paneer, oats, chana, milk, bananas, campus mess foods) and tailor tips to their playing position:
     * Forwards & Midfielders: High glycogen capacity, endurance, sustained energy, electrolyte replenishment.
     * Defenders: Core strength, explosive power, muscle recovery protein.
     * Goalkeepers: Lean mobility, reaction alertness, joint health.
2. RULES & WARM-UP DRILLS:
   - Explain FIH hockey rules, card penalties (Green = 2 min suspension, Yellow = 5-10 min suspension, Red = permanent ejection), penalty corners, shootouts, and umpire signals accurately.
   - Share dynamic warm-ups and injury prevention routines.
3. GROUNDING FOR SCHEDULES & ATTENDANCE:
   - For IIT Patna Hockey specific data, strictly follow the verified Supabase data below:
     * For total team sessions and playing days, refer strictly to teamSessions below. Clarify the total sessions count and total playing days, noting that playing days is 1 less than total sessions because on 29 Jan 2026 the team held 2 sessions.
     * For upcoming practice days, refer ONLY to upcomingPlannedDays or weeklyPracticeTimings below. Never guess unannounced dates.
     * For individual player attendance, use ONLY verified playerAttendance. If not logged in, tell them to log in. Players can only see their own attendance.

VERIFIED GROUNDING DATA FROM SUPABASE:
${JSON.stringify(context, null, 2)}

USER MESSAGE:
${query}`;

  // Prioritize available Gemini Flash and Flash-Lite models with fallback on quota limits
  const candidateModels = [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.5-flash",
  ];
  let replyText = null;
  let lastError = null;

  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await Promise.race([
          client.models.generateContent({
            model,
            contents: prompt,
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`Timeout with model ${model}`)),
              25000,
            ),
          ),
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
        : "AI service currently unavailable. Please try again.",
    );
  }

  return {
    reply: replyText,
    userRole: user ? user.role : "public",
    playerId: user && user.role === "player" ? user.id : null,
    userProfile,
  };
}

module.exports = {
  chat,
  getRelevantSchedules,
  getPlayerAttendanceSummary,
};
