/**
 * IIT Patna Hockey - Attendance MS File (Excel / CSV) Exporter
 * Generates Microsoft Excel-compatible files (.csv with UTF-8 BOM, and styled Excel HTML .xls)
 * for monthwise squad attendance, full-season matrices, and individual player logs.
 */

const MONTH_NAMES = {
  "01": "January",
  "02": "February",
  "03": "March",
  "04": "April",
  "05": "May",
  "06": "June",
  "07": "July",
  "08": "August",
  "09": "September",
  "10": "October",
  "11": "November",
  "12": "December",
};

function formatMonthLabel(m) {
  if (!m || m === "all") return "All Months (Full Season)";
  const [year, month] = m.split("-");
  return `${MONTH_NAMES[month] || month} ${year}`;
}

function escCsv(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Generate CSV for a specific month (with UTF-8 BOM for Microsoft Excel)
 */
function generateMonthCsv({ month, sessions, legacy, players }) {
  const dates = Object.keys(sessions)
    .filter((d) => d.startsWith(month))
    .sort();

  const legacyDays = (legacy[month] && legacy[month].days) || 0;
  const totalMonthSessions = dates.length + legacyDays;
  const monthLabel = formatMonthLabel(month);
  const nowStr = new Date(Date.now() + 5.5 * 3600e3).toISOString().replace("T", " ").slice(0, 19) + " IST";

  // UTF-8 BOM so Microsoft Excel opens it directly without character encoding issues
  let csv = "\uFEFF";
  csv += `${escCsv("IIT PATNA FIELD HOCKEY - OFFICIAL MONTHWISE ATTENDANCE REPORT")}\n`;
  csv += `${escCsv("Month:")},${escCsv(monthLabel)}\n`;
  csv += `${escCsv("Generated At:")},${escCsv(nowStr)}\n`;
  csv += `${escCsv("Total Squad Members:")},${escCsv(players.length)}\n`;
  csv += `${escCsv("Total Sessions in Month:")},${escCsv(totalMonthSessions)}\n\n`;

  // Header row
  const headers = [
    "Roll Number",
    "Player Name",
    "Position",
    "Jersey No",
    ...dates,
    "Total Sessions",
    "Attended",
    "Absent",
    "Turnout (%)",
  ];
  csv += headers.map(escCsv).join(",") + "\n";

  // Day counters for summary
  const dayPresentCounts = {};
  dates.forEach((d) => (dayPresentCounts[d] = 0));
  let squadTotalAttended = 0;

  // Player rows
  for (const p of players) {
    let attended = 0;
    const dayCells = dates.map((d) => {
      const isP = Boolean(sessions[d] && sessions[d][p.id]);
      if (isP) {
        attended++;
        dayPresentCounts[d]++;
      }
      return isP ? "P" : "A";
    });

    if (legacy[month] && legacy[month].att && legacy[month].att[p.id]) {
      attended += legacy[month].att[p.id];
    }
    squadTotalAttended += attended;

    const absent = Math.max(0, totalMonthSessions - attended);
    const pct = totalMonthSessions > 0 ? ((attended / totalMonthSessions) * 100).toFixed(1) + "%" : "0.0%";

    const row = [
      p.roll || p.id,
      p.name,
      p.position || "Field Player",
      p.jersey_no || p.jerseyNo || "–",
      ...dayCells,
      totalMonthSessions,
      attended,
      absent,
      pct,
    ];
    csv += row.map(escCsv).join(",") + "\n";
  }

  // Summary rows
  csv += "\n";
  const turnoutCountRow = [
    "TURNOUT COUNT (PER SESSION):",
    "",
    "",
    "",
    ...dates.map((d) => dayPresentCounts[d]),
    players.length > 0 ? (squadTotalAttended / players.length).toFixed(1) : 0,
    squadTotalAttended,
    "-",
    "-",
  ];
  csv += turnoutCountRow.map(escCsv).join(",") + "\n";

  const turnoutPctRow = [
    "TURNOUT PERCENTAGE (%):",
    "",
    "",
    "",
    ...dates.map((d) => (players.length ? ((dayPresentCounts[d] / players.length) * 100).toFixed(1) + "%" : "0.0%")),
    "-",
    "-",
    "-",
    players.length && totalMonthSessions
      ? ((squadTotalAttended / (players.length * totalMonthSessions)) * 100).toFixed(1) + "%"
      : "0.0%",
  ];
  csv += turnoutPctRow.map(escCsv).join(",") + "\n";

  return csv;
}

/**
 * Generate CSV for all months (full season month-by-month attendance matrix)
 */
function generateAllMonthsCsv({ sessions, legacy, players }) {
  const dates = Object.keys(sessions).sort();
  const monthMap = {};

  for (const d of dates) {
    const m = d.slice(0, 7);
    monthMap[m] = (monthMap[m] || 0) + 1;
  }
  for (const m in legacy) {
    monthMap[m] = (monthMap[m] || 0) + (legacy[m].days || 0);
  }

  const months = Object.keys(monthMap).sort();
  const totalAllSessions = months.reduce((acc, m) => acc + monthMap[m], 0);
  const nowStr = new Date(Date.now() + 5.5 * 3600e3).toISOString().replace("T", " ").slice(0, 19) + " IST";

  let csv = "\uFEFF";
  csv += `${escCsv("IIT PATNA FIELD HOCKEY - COMPREHENSIVE SEASON ATTENDANCE REPORT")}\n`;
  csv += `${escCsv("Report Type:")},${escCsv("Full Season Monthwise Attendance Matrix (Microsoft Excel Compatible)")}\n`;
  csv += `${escCsv("Generated At:")},${escCsv(nowStr)}\n`;
  csv += `${escCsv("Total Squad Members:")},${escCsv(players.length)}\n`;
  csv += `${escCsv("Total Recorded Sessions Across Season:")},${escCsv(totalAllSessions)}\n\n`;

  // Header row
  const monthHeaders = months.map((m) => `${formatMonthLabel(m)} (${monthMap[m]} sess)`);
  const headers = [
    "Roll Number",
    "Player Name",
    "Position",
    "Jersey No",
    ...monthHeaders,
    "Season Attended",
    "Season Total",
    "Season Turnout (%)",
  ];
  csv += headers.map(escCsv).join(",") + "\n";

  // Player rows
  for (const p of players) {
    let playerOverallAtt = 0;
    const monthCells = months.map((m) => {
      let mAtt = 0;
      for (const d of dates) {
        if (d.startsWith(m) && sessions[d] && sessions[d][p.id]) mAtt++;
      }
      if (legacy[m] && legacy[m].att && legacy[m].att[p.id]) {
        mAtt += legacy[m].att[p.id];
      }
      playerOverallAtt += mAtt;
      const mTot = monthMap[m];
      const mPct = mTot > 0 ? ((mAtt / mTot) * 100).toFixed(0) : "0";
      return `${mAtt}/${mTot} (${mPct}%)`;
    });

    const overallPct = totalAllSessions > 0 ? ((playerOverallAtt / totalAllSessions) * 100).toFixed(1) + "%" : "0.0%";

    const row = [
      p.roll || p.id,
      p.name,
      p.position || "Field Player",
      p.jersey_no || p.jerseyNo || "–",
      ...monthCells,
      playerOverallAtt,
      totalAllSessions,
      overallPct,
    ];
    csv += row.map(escCsv).join(",") + "\n";
  }

  return csv;
}

/**
 * Generate rich styled HTML table (.xls) for Microsoft Excel
 */
function generateMonthExcelHtml({ month, sessions, legacy, players }) {
  const dates = Object.keys(sessions)
    .filter((d) => d.startsWith(month))
    .sort();

  const legacyDays = (legacy[month] && legacy[month].days) || 0;
  const totalMonthSessions = dates.length + legacyDays;
  const monthLabel = formatMonthLabel(month);
  const nowStr = new Date(Date.now() + 5.5 * 3600e3).toISOString().replace("T", " ").slice(0, 19) + " IST";

  let html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${monthLabel}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
  table { border-collapse: collapse; }
  .title { font-size: 16pt; font-weight: bold; color: #0b2a4a; }
  .meta { color: #555555; }
  th { background-color: #0b2a4a; color: #ffffff; font-weight: bold; border: 1px solid #999999; padding: 6px 10px; text-align: center; }
  td { border: 1px solid #cccccc; padding: 5px 8px; text-align: center; }
  td.name { text-align: left; font-weight: 600; }
  td.roll { text-align: center; font-family: Consolas, monospace; }
  td.p { background-color: #dcfce7; color: #166534; font-weight: bold; }
  td.a { background-color: #fee2e2; color: #991b1b; }
  tr.summary { background-color: #f1f5f9; font-weight: bold; }
</style>
</head>
<body>
<table>
  <tr><td colspan="${dates.length + 8}" class="title">IIT PATNA FIELD HOCKEY - MONTHWISE ATTENDANCE REPORT</td></tr>
  <tr><td colspan="${dates.length + 8}" class="meta"><b>Month:</b> ${monthLabel} &nbsp;|&nbsp; <b>Total Sessions:</b> ${totalMonthSessions} &nbsp;|&nbsp; <b>Athletes:</b> ${players.length} &nbsp;|&nbsp; <b>Generated:</b> ${nowStr}</td></tr>
  <tr><td colspan="${dates.length + 8}"></td></tr>
  <tr>
    <th>Roll Number</th>
    <th>Player Name</th>
    <th>Position</th>
    <th>Jersey</th>
    ${dates.map((d) => `<th>${d.slice(5)}</th>`).join("")}
    <th>Total</th>
    <th>Attended</th>
    <th>Absent</th>
    <th>Turnout %</th>
  </tr>
  `;

  for (const p of players) {
    let attended = 0;
    const dayCells = dates
      .map((d) => {
        const isP = Boolean(sessions[d] && sessions[d][p.id]);
        if (isP) attended++;
        return `<td class="${isP ? "p" : "a"}">${isP ? "P" : "A"}</td>`;
      })
      .join("");

    if (legacy[month] && legacy[month].att && legacy[month].att[p.id]) {
      attended += legacy[month].att[p.id];
    }
    const absent = Math.max(0, totalMonthSessions - attended);
    const pct = totalMonthSessions > 0 ? ((attended / totalMonthSessions) * 100).toFixed(1) + "%" : "0.0%";

    html += `
    <tr>
      <td class="roll">${p.roll || p.id}</td>
      <td class="name">${p.name}</td>
      <td>${p.position || "Field Player"}</td>
      <td>${p.jersey_no || p.jerseyNo || "–"}</td>
      ${dayCells}
      <td>${totalMonthSessions}</td>
      <td><b>${attended}</b></td>
      <td>${absent}</td>
      <td><b>${pct}</b></td>
    </tr>`;
  }

  html += `
</table>
</body>
</html>`;
  return html;
}

/**
 * Generate rich styled HTML table (.xls) for all months in Microsoft Excel
 */
function generateAllMonthsExcelHtml({ sessions, legacy, players }) {
  const dates = Object.keys(sessions).sort();
  const monthMap = {};

  for (const d of dates) {
    const m = d.slice(0, 7);
    monthMap[m] = (monthMap[m] || 0) + 1;
  }
  for (const m in legacy) {
    monthMap[m] = (monthMap[m] || 0) + (legacy[m].days || 0);
  }

  const months = Object.keys(monthMap).sort();
  const totalAllSessions = months.reduce((acc, m) => acc + monthMap[m], 0);
  const nowStr = new Date(Date.now() + 5.5 * 3600e3).toISOString().replace("T", " ").slice(0, 19) + " IST";

  let html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Season_Matrix</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
  table { border-collapse: collapse; }
  .title { font-size: 16pt; font-weight: bold; color: #0b2a4a; }
  .meta { color: #555555; }
  th { background-color: #0b2a4a; color: #ffffff; font-weight: bold; border: 1px solid #999999; padding: 6px 10px; text-align: center; }
  td { border: 1px solid #cccccc; padding: 5px 8px; text-align: center; }
  td.name { text-align: left; font-weight: 600; }
  td.roll { text-align: center; font-family: Consolas, monospace; }
  td.high { background-color: #dcfce7; color: #166534; font-weight: bold; }
  td.mid { background-color: #fef9c3; color: #854d0e; }
  td.low { background-color: #fee2e2; color: #991b1b; }
</style>
</head>
<body>
<table>
  <tr><td colspan="${months.length + 7}" class="title">IIT PATNA FIELD HOCKEY - COMPREHENSIVE SEASON ATTENDANCE REPORT</td></tr>
  <tr><td colspan="${months.length + 7}" class="meta"><b>Full Season Matrix</b> &nbsp;|&nbsp; <b>Total Sessions:</b> ${totalAllSessions} &nbsp;|&nbsp; <b>Athletes:</b> ${players.length} &nbsp;|&nbsp; <b>Generated:</b> ${nowStr}</td></tr>
  <tr><td colspan="${months.length + 7}"></td></tr>
  <tr>
    <th>Roll Number</th>
    <th>Player Name</th>
    <th>Position</th>
    <th>Jersey</th>
    ${months.map((m) => `<th>${formatMonthLabel(m)}<br><small>(${monthMap[m]} sess)</small></th>`).join("")}
    <th>Attended</th>
    <th>Total</th>
    <th>Season %</th>
  </tr>
  `;

  for (const p of players) {
    let playerOverallAtt = 0;
    const monthCells = months
      .map((m) => {
        let mAtt = 0;
        for (const d of dates) {
          if (d.startsWith(m) && sessions[d] && sessions[d][p.id]) mAtt++;
        }
        if (legacy[m] && legacy[m].att && legacy[m].att[p.id]) {
          mAtt += legacy[m].att[p.id];
        }
        playerOverallAtt += mAtt;
        const mTot = monthMap[m];
        const mPct = mTot > 0 ? Math.round((mAtt / mTot) * 100) : 0;
        const cls = mPct >= 75 ? "high" : mPct >= 50 ? "mid" : "low";
        return `<td class="${cls}">${mAtt}/${mTot} (${mPct}%)</td>`;
      })
      .join("");

    const overallPct = totalAllSessions > 0 ? ((playerOverallAtt / totalAllSessions) * 100).toFixed(1) + "%" : "0.0%";

    html += `
    <tr>
      <td class="roll">${p.roll || p.id}</td>
      <td class="name">${p.name}</td>
      <td>${p.position || "Field Player"}</td>
      <td>${p.jersey_no || p.jerseyNo || "–"}</td>
      ${monthCells}
      <td><b>${playerOverallAtt}</b></td>
      <td>${totalAllSessions}</td>
      <td><b>${overallPct}</b></td>
    </tr>`;
  }

  html += `
</table>
</body>
</html>`;
  return html;
}

module.exports = {
  formatMonthLabel,
  generateMonthCsv,
  generateAllMonthsCsv,
  generateMonthExcelHtml,
  generateAllMonthsExcelHtml,
};
