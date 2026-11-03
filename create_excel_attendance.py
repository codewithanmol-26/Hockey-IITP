import json
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Load the database dump
with open('attendance_dump.json', 'r', encoding='utf-8') as f:
    raw_data = json.load(f)

players = raw_data.get('players', [])
sessions = raw_data.get('sessions', {})

# Filter out removed players and sort by roll number
active_players = [p for p in players if not p.get('removed')]
active_players.sort(key=lambda p: (p.get('roll') or p.get('id') or ''))

# Sort session dates chronologically
session_dates = sorted(sessions.keys())

# Group dates by month (YYYY-MM)
months_map = {}
for d in session_dates:
    m = d[:7]
    if m not in months_map:
        months_map[m] = []
    months_map[m].append(d)

month_keys = sorted(months_map.keys())

# Styles
FONT_TITLE = Font(name="Calibri", size=15, bold=True, color="FACC15")
FONT_SUBTITLE = Font(name="Calibri", size=10, italic=False, color="FFFFFF")
FONT_HEADER = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
FONT_DATA = Font(name="Calibri", size=10, color="0F172A")
FONT_BOLD_DATA = Font(name="Calibri", size=10, bold=True, color="0F172A")
FONT_TOTAL = Font(name="Calibri", size=10, bold=True, color="0B2A4A")

FONT_P = Font(name="Calibri", size=10, bold=True, color="137333")
FONT_A = Font(name="Calibri", size=10, bold=False, color="C5221F")

FILL_TITLE = PatternFill(start_color="071A2E", end_color="071A2E", fill_type="solid")
FILL_SUBTITLE = PatternFill(start_color="0F4AA8", end_color="0F4AA8", fill_type="solid")
FILL_HEADER = PatternFill(start_color="0B2A4A", end_color="0B2A4A", fill_type="solid")
FILL_MONTH_HEADER = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
FILL_SUMMARY_HEADER = PatternFill(start_color="1E40AF", end_color="1E40AF", fill_type="solid")

FILL_P = PatternFill(start_color="E6F4EA", end_color="E6F4EA", fill_type="solid")
FILL_A = PatternFill(start_color="FCE8E6", end_color="FCE8E6", fill_type="solid")
FILL_ZEBRA = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
FILL_WHITE = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
FILL_TOTAL = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")

BORDER_THIN = Border(
    left=Side(style='thin', color='CBD5E1'),
    right=Side(style='thin', color='CBD5E1'),
    top=Side(style='thin', color='CBD5E1'),
    bottom=Side(style='thin', color='CBD5E1')
)
BORDER_TOP_THICK = Border(
    left=Side(style='thin', color='CBD5E1'),
    right=Side(style='thin', color='CBD5E1'),
    top=Side(style='medium', color='0B2A4A'),
    bottom=Side(style='double', color='0B2A4A')
)

ALIGN_LEFT = Alignment(horizontal="left", vertical="center")
ALIGN_CENTER = Alignment(horizontal="center", vertical="center")
ALIGN_RIGHT = Alignment(horizontal="right", vertical="center")
ALIGN_HEADER = Alignment(horizontal="center", vertical="center", wrap_text=True)

wb = openpyxl.Workbook()
# Remove default sheet
wb.remove(wb.active)

# Helper function to get readable month name
def get_month_name(ym):
    try:
        dt = datetime.strptime(ym, "%Y-%m")
        return dt.strftime("%B %Y")
    except Exception:
        return ym

def get_short_month_name(ym):
    try:
        dt = datetime.strptime(ym, "%Y-%m")
        return dt.strftime("%b %Y")
    except Exception:
        return ym

def format_day_header(d_str):
    is_s2 = '_2' in d_str
    clean = d_str.replace('_2', '')
    try:
        dt = datetime.strptime(clean, "%Y-%m-%d")
        s = dt.strftime("%d %b\n(%a)")
        if is_s2:
            s += "\nS2"
        return s
    except Exception:
        return d_str

# ==============================================================================
# SHEET 1: Full Season Summary Sheet
# ==============================================================================
ws_sum = wb.create_sheet(title="Season Summary")
ws_sum.views.sheetView[0].showGridLines = True

# Title block
ws_sum.merge_cells("A1:U1")
ws_sum["A1"] = "INDIAN INSTITUTE OF TECHNOLOGY PATNA"
ws_sum["A1"].font = FONT_TITLE
ws_sum["A1"].fill = FILL_TITLE
ws_sum["A1"].alignment = ALIGN_CENTER
ws_sum.row_dimensions[1].height = 28

ws_sum.merge_cells("A2:U2")
ws_sum["A2"] = "Official Field Hockey Squad - Overall & Monthwise Attendance Master Register"
ws_sum["A2"].font = FONT_SUBTITLE
ws_sum["A2"].fill = FILL_SUBTITLE
ws_sum["A2"].alignment = ALIGN_CENTER
ws_sum.row_dimensions[2].height = 20

# Header Row
sum_headers = [
    "S.No", "Roll No", "Player Name", "Position", "Jersey", 
    "Total Present", "Total Sessions", "Overall %", "Attendance Tier"
]
for m in month_keys:
    sum_headers.append(f"{get_short_month_name(m)}\n({len(months_map[m])} sess)")

ws_sum.row_dimensions[3].height = 34
for col_idx, h in enumerate(sum_headers, start=1):
    cell = ws_sum.cell(row=3, column=col_idx, value=h)
    cell.font = FONT_HEADER
    cell.fill = FILL_HEADER if col_idx <= 9 else FILL_MONTH_HEADER
    cell.alignment = ALIGN_HEADER
    cell.border = BORDER_THIN

# Calculate stats per player
player_stats = []
total_sessions_count = len(session_dates)

for p in active_players:
    pid = p.get('id')
    proll = p.get('roll') or pid
    pname = p.get('name') or pid
    ppos = p.get('position') or "Player"
    pjersey = f"#{p.get('jersey_no')}" if p.get('jersey_no') else "-"

    overall_present = 0
    month_present = {}

    for m in month_keys:
        m_dates = months_map[m]
        m_p_count = 0
        for d in m_dates:
            sess_data = sessions.get(d, {})
            # check both pid and roll
            if sess_data.get(pid) or (proll and sess_data.get(proll)):
                m_p_count += 1
                overall_present += 1
        month_present[m] = m_p_count

    pct = round((overall_present / total_sessions_count * 100), 1) if total_sessions_count > 0 else 0
    
    if pct >= 80:
        tier = "🏆 Elite (≥80%)"
    elif pct >= 65:
        tier = "⭐ Core Squad (≥65%)"
    elif pct >= 50:
        tier = "Regular (≥50%)"
    else:
        tier = "Developing (<50%)"

    player_stats.append({
        'p': p,
        'pid': pid,
        'roll': proll,
        'name': pname,
        'pos': ppos,
        'jersey': pjersey,
        'present': overall_present,
        'total': total_sessions_count,
        'pct': pct,
        'tier': tier,
        'month_present': month_present
    })

# Write player rows in summary sheet
start_row = 4
for i, ps in enumerate(player_stats, start=1):
    r = start_row + i - 1
    ws_sum.row_dimensions[r].height = 22
    row_fill = FILL_ZEBRA if i % 2 == 0 else FILL_WHITE

    row_data = [
        (i, ALIGN_CENTER, FONT_DATA),
        (ps['roll'], ALIGN_CENTER, FONT_BOLD_DATA),
        (ps['name'], ALIGN_LEFT, FONT_BOLD_DATA),
        (ps['pos'], ALIGN_LEFT, FONT_DATA),
        (ps['jersey'], ALIGN_CENTER, FONT_DATA),
        (ps['present'], ALIGN_CENTER, FONT_BOLD_DATA),
        (ps['total'], ALIGN_CENTER, FONT_DATA),
        (f"{ps['pct']}%", ALIGN_CENTER, FONT_P if ps['pct'] >= 75 else FONT_DATA),
        (ps['tier'], ALIGN_CENTER, FONT_DATA),
    ]

    for m in month_keys:
        m_p = ps['month_present'][m]
        m_tot = len(months_map[m])
        m_pct = round((m_p / m_tot * 100), 1) if m_tot > 0 else 0
        txt = f"{m_p}/{m_tot} ({m_pct}%)"
        row_data.append((txt, ALIGN_CENTER, FONT_P if m_pct >= 75 else FONT_DATA))

    for col_idx, (val, align, font) in enumerate(row_data, start=1):
        cell = ws_sum.cell(row=r, column=col_idx, value=val)
        cell.alignment = align
        cell.font = font
        cell.fill = row_fill
        cell.border = BORDER_THIN

# Summary Total Row
tot_r = start_row + len(player_stats)
ws_sum.row_dimensions[tot_r].height = 24
ws_sum.cell(row=tot_r, column=1, value="").fill = FILL_TOTAL
ws_sum.cell(row=tot_r, column=2, value="TOTALS").font = FONT_TOTAL
ws_sum.cell(row=tot_r, column=2).alignment = ALIGN_CENTER
ws_sum.cell(row=tot_r, column=2).fill = FILL_TOTAL
ws_sum.cell(row=tot_r, column=2).border = BORDER_TOP_THICK

ws_sum.cell(row=tot_r, column=3, value=f"{len(player_stats)} Squad Members").font = FONT_TOTAL
ws_sum.cell(row=tot_r, column=3).alignment = ALIGN_LEFT
ws_sum.cell(row=tot_r, column=3).fill = FILL_TOTAL
ws_sum.cell(row=tot_r, column=3).border = BORDER_TOP_THICK

ws_sum.cell(row=tot_r, column=4, value="Team Average").font = FONT_TOTAL
ws_sum.cell(row=tot_r, column=4).alignment = ALIGN_LEFT
ws_sum.cell(row=tot_r, column=4).fill = FILL_TOTAL
ws_sum.cell(row=tot_r, column=4).border = BORDER_TOP_THICK

ws_sum.cell(row=tot_r, column=5, value="-").font = FONT_TOTAL
ws_sum.cell(row=tot_r, column=5).alignment = ALIGN_CENTER
ws_sum.cell(row=tot_r, column=5).fill = FILL_TOTAL
ws_sum.cell(row=tot_r, column=5).border = BORDER_TOP_THICK

total_att_sum = sum(ps['present'] for ps in player_stats)
possible_att_sum = len(player_stats) * total_sessions_count
overall_team_pct = round((total_att_sum / possible_att_sum * 100), 1) if possible_att_sum > 0 else 0

ws_sum.cell(row=tot_r, column=6, value=total_att_sum).font = FONT_TOTAL
ws_sum.cell(row=tot_r, column=6).alignment = ALIGN_CENTER
ws_sum.cell(row=tot_r, column=6).fill = FILL_TOTAL
ws_sum.cell(row=tot_r, column=6).border = BORDER_TOP_THICK

ws_sum.cell(row=tot_r, column=7, value=possible_att_sum).font = FONT_TOTAL
ws_sum.cell(row=tot_r, column=7).alignment = ALIGN_CENTER
ws_sum.cell(row=tot_r, column=7).fill = FILL_TOTAL
ws_sum.cell(row=tot_r, column=7).border = BORDER_TOP_THICK

ws_sum.cell(row=tot_r, column=8, value=f"{overall_team_pct}%").font = FONT_TOTAL
ws_sum.cell(row=tot_r, column=8).alignment = ALIGN_CENTER
ws_sum.cell(row=tot_r, column=8).fill = FILL_TOTAL
ws_sum.cell(row=tot_r, column=8).border = BORDER_TOP_THICK

ws_sum.cell(row=tot_r, column=9, value="Team Turnout").font = FONT_TOTAL
ws_sum.cell(row=tot_r, column=9).alignment = ALIGN_CENTER
ws_sum.cell(row=tot_r, column=9).fill = FILL_TOTAL
ws_sum.cell(row=tot_r, column=9).border = BORDER_TOP_THICK

for idx, m in enumerate(month_keys, start=10):
    m_tot_sessions = len(months_map[m])
    m_possible = len(player_stats) * m_tot_sessions
    m_actual = sum(ps['month_present'][m] for ps in player_stats)
    m_avg = round((m_actual / m_possible * 100), 1) if m_possible > 0 else 0
    cell = ws_sum.cell(row=tot_r, column=idx, value=f"{m_avg}% Avg")
    cell.font = FONT_TOTAL
    cell.alignment = ALIGN_CENTER
    cell.fill = FILL_TOTAL
    cell.border = BORDER_TOP_THICK

# Freeze panes on summary sheet: keep headers and player name/roll pinned
ws_sum.freeze_panes = "D4"

# Auto-adjust column widths
for col in ws_sum.columns:
    max_len = 0
    col_letter = get_column_letter(col[0].column)
    for cell in col:
        if cell.row in (1, 2):
            continue
        val_str = str(cell.value or "")
        lines = val_str.split("\n")
        line_len = max(len(l) for l in lines) if lines else 0
        if line_len > max_len:
            max_len = line_len
    ws_sum.column_dimensions[col_letter].width = max(max_len + 3, 10)

ws_sum.column_dimensions['A'].width = 6
ws_sum.column_dimensions['B'].width = 13
ws_sum.column_dimensions['C'].width = 24
ws_sum.column_dimensions['D'].width = 26
ws_sum.column_dimensions['E'].width = 9
ws_sum.column_dimensions['F'].width = 13
ws_sum.column_dimensions['G'].width = 13
ws_sum.column_dimensions['H'].width = 12
ws_sum.column_dimensions['I'].width = 20

# ==============================================================================
# SHEETS 2 to N: One Dedicated Sheet Per Month
# ==============================================================================
for m in month_keys:
    m_dates = months_map[m]
    sheet_title = get_short_month_name(m)
    ws = wb.create_sheet(title=sheet_title)
    ws.views.sheetView[0].showGridLines = True

    total_cols = 4 + len(m_dates) + 3 # S.No, Roll, Name, Pos + Dates + Present, Total, %
    end_col_letter = get_column_letter(total_cols)

    # Title block
    ws.merge_cells(f"A1:{end_col_letter}1")
    ws["A1"] = f"IIT PATNA HOCKEY SQUAD - {get_month_name(m).upper()} ATTENDANCE"
    ws["A1"].font = FONT_TITLE
    ws["A1"].fill = FILL_TITLE
    ws["A1"].alignment = ALIGN_CENTER
    ws.row_dimensions[1].height = 28

    ws.merge_cells(f"A2:{end_col_letter}2")
    ws["A2"] = f"Practice Sessions Held: {len(m_dates)} | Squad Members: {len(active_players)}"
    ws["A2"].font = FONT_SUBTITLE
    ws["A2"].fill = FILL_SUBTITLE
    ws["A2"].alignment = ALIGN_CENTER
    ws.row_dimensions[2].height = 20

    # Header Row
    headers = ["S.No", "Roll No", "Player Name", "Position"]
    for d in m_dates:
        headers.append(format_day_header(d))
    headers.extend(["Present", "Total", "Month %"])

    ws.row_dimensions[3].height = 36
    for col_idx, h in enumerate(headers, start=1):
        cell = ws.cell(row=3, column=col_idx, value=h)
        cell.font = FONT_HEADER
        cell.fill = FILL_HEADER
        cell.alignment = ALIGN_HEADER
        cell.border = BORDER_THIN

    # Write player rows
    m_start_row = 4
    for i, p in enumerate(active_players, start=1):
        r = m_start_row + i - 1
        ws.row_dimensions[r].height = 20
        row_fill = FILL_ZEBRA if i % 2 == 0 else FILL_WHITE

        pid = p.get('id')
        proll = p.get('roll') or pid
        pname = p.get('name') or pid
        ppos = p.get('position') or "Player"

        ws.cell(row=r, column=1, value=i).alignment = ALIGN_CENTER
        ws.cell(row=r, column=1).font = FONT_DATA
        ws.cell(row=r, column=1).fill = row_fill
        ws.cell(row=r, column=1).border = BORDER_THIN

        ws.cell(row=r, column=2, value=proll).alignment = ALIGN_CENTER
        ws.cell(row=r, column=2).font = FONT_BOLD_DATA
        ws.cell(row=r, column=2).fill = row_fill
        ws.cell(row=r, column=2).border = BORDER_THIN

        ws.cell(row=r, column=3, value=pname).alignment = ALIGN_LEFT
        ws.cell(row=r, column=3).font = FONT_BOLD_DATA
        ws.cell(row=r, column=3).fill = row_fill
        ws.cell(row=r, column=3).border = BORDER_THIN

        ws.cell(row=r, column=4, value=ppos).alignment = ALIGN_LEFT
        ws.cell(row=r, column=4).font = FONT_DATA
        ws.cell(row=r, column=4).fill = row_fill
        ws.cell(row=r, column=4).border = BORDER_THIN

        p_month_count = 0
        for date_idx, d in enumerate(m_dates, start=5):
            sess_data = sessions.get(d, {})
            is_present = bool(sess_data.get(pid) or (proll and sess_data.get(proll)))

            d_cell = ws.cell(row=r, column=date_idx)
            if is_present:
                p_month_count += 1
                d_cell.value = "P"
                d_cell.font = FONT_P
                d_cell.fill = FILL_P
            else:
                d_cell.value = "A"
                d_cell.font = FONT_A
                d_cell.fill = FILL_A
            d_cell.alignment = ALIGN_CENTER
            d_cell.border = BORDER_THIN

        # Present, Total, %
        c_p = ws.cell(row=r, column=5 + len(m_dates), value=p_month_count)
        c_p.font = FONT_BOLD_DATA
        c_p.alignment = ALIGN_CENTER
        c_p.fill = row_fill
        c_p.border = BORDER_THIN

        c_tot = ws.cell(row=r, column=6 + len(m_dates), value=len(m_dates))
        c_tot.font = FONT_DATA
        c_tot.alignment = ALIGN_CENTER
        c_tot.fill = row_fill
        c_tot.border = BORDER_THIN

        m_pct = round((p_month_count / len(m_dates) * 100), 1) if len(m_dates) > 0 else 0
        c_pct = ws.cell(row=r, column=7 + len(m_dates), value=f"{m_pct}%")
        c_pct.font = FONT_P if m_pct >= 75 else FONT_BOLD_DATA
        c_pct.alignment = ALIGN_CENTER
        c_pct.fill = row_fill
        c_pct.border = BORDER_THIN

    # Daily Turnout Summary Row
    summary_row = m_start_row + len(active_players)
    ws.row_dimensions[summary_row].height = 22
    
    ws.cell(row=summary_row, column=1, value="").fill = FILL_TOTAL
    ws.cell(row=summary_row, column=1).border = BORDER_TOP_THICK

    ws.cell(row=summary_row, column=2, value="TURNOUT").font = FONT_TOTAL
    ws.cell(row=summary_row, column=2).alignment = ALIGN_CENTER
    ws.cell(row=summary_row, column=2).fill = FILL_TOTAL
    ws.cell(row=summary_row, column=2).border = BORDER_TOP_THICK

    ws.cell(row=summary_row, column=3, value=f"{len(active_players)} Registered").font = FONT_TOTAL
    ws.cell(row=summary_row, column=3).alignment = ALIGN_LEFT
    ws.cell(row=summary_row, column=3).fill = FILL_TOTAL
    ws.cell(row=summary_row, column=3).border = BORDER_TOP_THICK

    ws.cell(row=summary_row, column=4, value="Daily Count").font = FONT_TOTAL
    ws.cell(row=summary_row, column=4).alignment = ALIGN_LEFT
    ws.cell(row=summary_row, column=4).fill = FILL_TOTAL
    ws.cell(row=summary_row, column=4).border = BORDER_TOP_THICK

    total_month_presences = 0
    for date_idx, d in enumerate(m_dates, start=5):
        sess_data = sessions.get(d, {})
        day_p = sum(1 for p in active_players if sess_data.get(p.get('id')) or (p.get('roll') and sess_data.get(p.get('roll'))))
        total_month_presences += day_p
        
        c = ws.cell(row=summary_row, column=date_idx, value=day_p)
        c.font = FONT_TOTAL
        c.alignment = ALIGN_CENTER
        c.fill = FILL_TOTAL
        c.border = BORDER_TOP_THICK

    # Total cell in summary row
    c_tot_p = ws.cell(row=summary_row, column=5 + len(m_dates), value=total_month_presences)
    c_tot_p.font = FONT_TOTAL
    c_tot_p.alignment = ALIGN_CENTER
    c_tot_p.fill = FILL_TOTAL
    c_tot_p.border = BORDER_TOP_THICK

    month_capacity = len(active_players) * len(m_dates)
    c_tot_cap = ws.cell(row=summary_row, column=6 + len(m_dates), value=month_capacity)
    c_tot_cap.font = FONT_TOTAL
    c_tot_cap.alignment = ALIGN_CENTER
    c_tot_cap.fill = FILL_TOTAL
    c_tot_cap.border = BORDER_TOP_THICK

    m_team_avg = round((total_month_presences / month_capacity * 100), 1) if month_capacity > 0 else 0
    c_tot_pct = ws.cell(row=summary_row, column=7 + len(m_dates), value=f"{m_team_avg}%")
    c_tot_pct.font = FONT_TOTAL
    c_tot_pct.alignment = ALIGN_CENTER
    c_tot_pct.fill = FILL_TOTAL
    c_tot_pct.border = BORDER_TOP_THICK

    # Turnout % row
    pct_row = summary_row + 1
    ws.row_dimensions[pct_row].height = 22

    ws.cell(row=pct_row, column=1, value="").fill = FILL_TOTAL
    ws.cell(row=pct_row, column=1).border = BORDER_THIN

    ws.cell(row=pct_row, column=2, value="TURNOUT %").font = FONT_TOTAL
    ws.cell(row=pct_row, column=2).alignment = ALIGN_CENTER
    ws.cell(row=pct_row, column=2).fill = FILL_TOTAL
    ws.cell(row=pct_row, column=2).border = BORDER_THIN

    ws.cell(row=pct_row, column=3, value="Percentage of squad present").font = FONT_TOTAL
    ws.cell(row=pct_row, column=3).alignment = ALIGN_LEFT
    ws.cell(row=pct_row, column=3).fill = FILL_TOTAL
    ws.cell(row=pct_row, column=3).border = BORDER_THIN

    ws.cell(row=pct_row, column=4, value="Turnout Rate").font = FONT_TOTAL
    ws.cell(row=pct_row, column=4).alignment = ALIGN_LEFT
    ws.cell(row=pct_row, column=4).fill = FILL_TOTAL
    ws.cell(row=pct_row, column=4).border = BORDER_THIN

    for date_idx, d in enumerate(m_dates, start=5):
        sess_data = sessions.get(d, {})
        day_p = sum(1 for p in active_players if sess_data.get(p.get('id')) or (p.get('roll') and sess_data.get(p.get('roll'))))
        day_pct = round((day_p / len(active_players) * 100), 1) if active_players else 0
        c = ws.cell(row=pct_row, column=date_idx, value=f"{day_pct}%")
        c.font = FONT_TOTAL
        c.alignment = ALIGN_CENTER
        c.fill = FILL_TOTAL
        c.border = BORDER_THIN

    ws.cell(row=pct_row, column=5 + len(m_dates), value="-").fill = FILL_TOTAL
    ws.cell(row=pct_row, column=5 + len(m_dates)).border = BORDER_THIN
    ws.cell(row=pct_row, column=6 + len(m_dates), value="-").fill = FILL_TOTAL
    ws.cell(row=pct_row, column=6 + len(m_dates)).border = BORDER_THIN
    c_avg_final = ws.cell(row=pct_row, column=7 + len(m_dates), value=f"{m_team_avg}%")
    c_avg_final.font = FONT_TOTAL
    c_avg_final.alignment = ALIGN_CENTER
    c_avg_final.fill = FILL_TOTAL
    c_avg_final.border = BORDER_THIN

    # Freeze panes on monthly sheets
    ws.freeze_panes = "E4"

    # Set column widths
    ws.column_dimensions['A'].width = 6
    ws.column_dimensions['B'].width = 13
    ws.column_dimensions['C'].width = 24
    ws.column_dimensions['D'].width = 26
    for date_idx in range(5, 5 + len(m_dates)):
        ws.column_dimensions[get_column_letter(date_idx)].width = 11
    ws.column_dimensions[get_column_letter(5 + len(m_dates))].width = 10
    ws.column_dimensions[get_column_letter(6 + len(m_dates))].width = 10
    ws.column_dimensions[get_column_letter(7 + len(m_dates))].width = 11

output_filename = "IITP_Hockey_Monthwise_Attendance.xlsx"
wb.save(output_filename)
print(f"Successfully generated {output_filename} with {len(wb.sheetnames)} sheets:")
for s in wb.sheetnames:
    print(f" - {s}")
