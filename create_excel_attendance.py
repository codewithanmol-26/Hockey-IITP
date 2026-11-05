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

# Filter out removed players (strictly active squad members only)
active_players = [p for p in players if not p.get('removed')]

# Chronological session dates
session_dates = sorted(sessions.keys())
total_sessions_all = len(session_dates)

start_date_raw = session_dates[0].replace('_2', '') if session_dates else ''
end_date_raw = session_dates[-1].replace('_2', '') if session_dates else ''

start_date_fmt = datetime.strptime(start_date_raw, '%Y-%m-%d').strftime('%d %b %Y (%a)') if start_date_raw else '-'
end_date_fmt = datetime.strptime(end_date_raw, '%Y-%m-%d').strftime('%d %b %Y (%a)') if end_date_raw else '-'

# Styles
FONT_TITLE = Font(name="Calibri", size=15, bold=True, color="FACC15")
FONT_SUBTITLE = Font(name="Calibri", size=10, italic=False, color="FFFFFF")
FONT_HEADER = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
FONT_DATA = Font(name="Calibri", size=10, color="0F172A")
FONT_BOLD_DATA = Font(name="Calibri", size=10, bold=True, color="0F172A")
FONT_TOTAL = Font(name="Calibri", size=10, bold=True, color="0B2A4A")

FONT_HIGH = Font(name="Calibri", size=10, bold=True, color="137333") # Green
FONT_MID = Font(name="Calibri", size=10, bold=True, color="0F172A")

FILL_TITLE = PatternFill(start_color="071A2E", end_color="071A2E", fill_type="solid")
FILL_SUBTITLE = PatternFill(start_color="0F4AA8", end_color="0F4AA8", fill_type="solid")
FILL_HEADER = PatternFill(start_color="0B2A4A", end_color="0B2A4A", fill_type="solid")

FILL_ZEBRA = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
FILL_WHITE = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
FILL_TOTAL = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")
FILL_CARD_HEADER = PatternFill(start_color="0B2A4A", end_color="0B2A4A", fill_type="solid")
FILL_CARD_VAL = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

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
ALIGN_BANNER = Alignment(horizontal="centerContinuous", vertical="center")

def format_join_date(d_str):
    if not d_str:
        return "-"
    clean = str(d_str)[:10]
    try:
        dt = datetime.strptime(clean, "%Y-%m-%d")
        return dt.strftime("%d %b %Y")
    except Exception:
        return clean

# Build Player Records
player_rows = []
for p in active_players:
    pid = p.get('id')
    proll = p.get('roll') or pid
    pname = p.get('name') or pid
    raw_joined = (p.get('joined') or '')[:10]
    pjoined = format_join_date(raw_joined)

    # Sessions strictly on or after joined date
    eligible_dates = [d for d in session_dates if not raw_joined or d.replace('_2', '') >= raw_joined]
    eligible_count = len(eligible_dates)

    present_count = 0
    for d in eligible_dates:
        s = sessions.get(d, {})
        if s.get(pid) or (proll and s.get(proll)):
            present_count += 1

    pct = round((present_count / eligible_count * 100), 1) if eligible_count > 0 else 0.0
    pts = round((present_count / eligible_count * 10), 1) if eligible_count > 0 else 0.0

    player_rows.append({
        'roll': proll,
        'name': pname,
        'joined': pjoined,
        'eligible': eligible_count,
        'present': present_count,
        'pct': pct,
        'pts': pts
    })

# Arrange students by percentage in decreasing order
player_rows.sort(key=lambda x: (x['pct'], x['present'], x['name']), reverse=True)

# Create Workbook with a SINGLE TAB
wb = openpyxl.Workbook()
wb.remove(wb.active) # Remove default sheet

ws = wb.create_sheet(title="Regularity & Attendance")
ws.views.sheetView[0].showGridLines = True
ws.freeze_panes = None # All columns freely movable

# Exact Columns Requested:
# Roll No, Full Name, joined date, Total session after joined date, Present, Percentage, Regularity points(out of 10)
headers = [
    "Roll No",
    "Full Name",
    "Joined Date",
    "Total Session After Joined Date",
    "Present",
    "Percentage",
    "Regularity Points (out of 10)"
]
total_cols = len(headers)

# Title Banner (centerContinuous across columns A:G without merging)
ws["A1"] = "INDIAN INSTITUTE OF TECHNOLOGY PATNA"
ws.row_dimensions[1].height = 28
for c in range(1, total_cols + 1):
    cell = ws.cell(row=1, column=c)
    cell.fill = FILL_TITLE
    cell.alignment = ALIGN_BANNER
    if c == 1:
        cell.font = FONT_TITLE

ws["A2"] = "Official Field Hockey Squad - Regularity & Attendance Register"
ws.row_dimensions[2].height = 20
for c in range(1, total_cols + 1):
    cell = ws.cell(row=2, column=c)
    cell.fill = FILL_SUBTITLE
    cell.alignment = ALIGN_BANNER
    if c == 1:
        cell.font = FONT_SUBTITLE

# Header Row
ws.row_dimensions[3].height = 36
for col_idx, h in enumerate(headers, start=1):
    cell = ws.cell(row=3, column=col_idx, value=h)
    cell.font = FONT_HEADER
    cell.fill = FILL_HEADER
    cell.alignment = ALIGN_HEADER
    cell.border = BORDER_THIN

# Data Rows (arranged by percentage descending)
start_row = 4
for i, r in enumerate(player_rows, start=1):
    row_num = start_row + i - 1
    ws.row_dimensions[row_num].height = 22
    row_fill = FILL_ZEBRA if i % 2 == 0 else FILL_WHITE

    # 1. Roll No
    c1 = ws.cell(row=row_num, column=1, value=r['roll'])
    c1.alignment = ALIGN_CENTER
    c1.font = FONT_BOLD_DATA
    c1.fill = row_fill
    c1.border = BORDER_THIN

    # 2. Full Name
    c2 = ws.cell(row=row_num, column=2, value=r['name'])
    c2.alignment = ALIGN_LEFT
    c2.font = FONT_BOLD_DATA
    c2.fill = row_fill
    c2.border = BORDER_THIN

    # 3. Joined Date
    c3 = ws.cell(row=row_num, column=3, value=r['joined'])
    c3.alignment = ALIGN_CENTER
    c3.font = FONT_DATA
    c3.fill = row_fill
    c3.border = BORDER_THIN

    # 4. Total Session After Joined Date
    c4 = ws.cell(row=row_num, column=4, value=r['eligible'])
    c4.alignment = ALIGN_CENTER
    c4.font = FONT_DATA
    c4.fill = row_fill
    c4.border = BORDER_THIN

    # 5. Present
    c5 = ws.cell(row=row_num, column=5, value=r['present'])
    c5.alignment = ALIGN_CENTER
    c5.font = FONT_BOLD_DATA
    c5.fill = row_fill
    c5.border = BORDER_THIN

    # 6. Percentage
    c6 = ws.cell(row=row_num, column=6, value=f"{r['pct']}%")
    c6.alignment = ALIGN_CENTER
    c6.font = FONT_HIGH if r['pct'] >= 75.0 else FONT_BOLD_DATA
    c6.fill = row_fill
    c6.border = BORDER_THIN

    # 7. Regularity Points (out of 10)
    c7 = ws.cell(row=row_num, column=7, value=f"{r['pts']:.1f} / 10")
    c7.alignment = ALIGN_CENTER
    c7.font = FONT_HIGH if r['pts'] >= 7.5 else FONT_BOLD_DATA
    c7.fill = row_fill
    c7.border = BORDER_THIN

# Summary Totals Row
tot_r = start_row + len(player_rows)
ws.row_dimensions[tot_r].height = 24

total_eligible_sum = sum(r['eligible'] for r in player_rows)
total_present_sum = sum(r['present'] for r in player_rows)
team_overall_pct = round((total_present_sum / total_eligible_sum * 100), 1) if total_eligible_sum > 0 else 0.0
team_overall_pts = round((total_present_sum / total_eligible_sum * 10), 1) if total_eligible_sum > 0 else 0.0

ws.cell(row=tot_r, column=1, value="TOTALS / TEAM AVG").font = FONT_TOTAL
ws.cell(row=tot_r, column=1).alignment = ALIGN_CENTER
ws.cell(row=tot_r, column=1).fill = FILL_TOTAL
ws.cell(row=tot_r, column=1).border = BORDER_TOP_THICK

ws.cell(row=tot_r, column=2, value=f"{len(player_rows)} Active Squad Members").font = FONT_TOTAL
ws.cell(row=tot_r, column=2).alignment = ALIGN_LEFT
ws.cell(row=tot_r, column=2).fill = FILL_TOTAL
ws.cell(row=tot_r, column=2).border = BORDER_TOP_THICK

ws.cell(row=tot_r, column=3, value="-").font = FONT_TOTAL
ws.cell(row=tot_r, column=3).alignment = ALIGN_CENTER
ws.cell(row=tot_r, column=3).fill = FILL_TOTAL
ws.cell(row=tot_r, column=3).border = BORDER_TOP_THICK

ws.cell(row=tot_r, column=4, value=total_eligible_sum).font = FONT_TOTAL
ws.cell(row=tot_r, column=4).alignment = ALIGN_CENTER
ws.cell(row=tot_r, column=4).fill = FILL_TOTAL
ws.cell(row=tot_r, column=4).border = BORDER_TOP_THICK

ws.cell(row=tot_r, column=5, value=total_present_sum).font = FONT_TOTAL
ws.cell(row=tot_r, column=5).alignment = ALIGN_CENTER
ws.cell(row=tot_r, column=5).fill = FILL_TOTAL
ws.cell(row=tot_r, column=5).border = BORDER_TOP_THICK

ws.cell(row=tot_r, column=6, value=f"{team_overall_pct}%").font = FONT_TOTAL
ws.cell(row=tot_r, column=6).alignment = ALIGN_CENTER
ws.cell(row=tot_r, column=6).fill = FILL_TOTAL
ws.cell(row=tot_r, column=6).border = BORDER_TOP_THICK

ws.cell(row=tot_r, column=7, value=f"{team_overall_pts:.1f} / 10").font = FONT_TOTAL
ws.cell(row=tot_r, column=7).alignment = ALIGN_CENTER
ws.cell(row=tot_r, column=7).fill = FILL_TOTAL
ws.cell(row=tot_r, column=7).border = BORDER_TOP_THICK

# ------------------------------------------------------------------------------
# BELOW TABLE: Start date, End date, Total session from start to end
# ------------------------------------------------------------------------------
spacer_r = tot_r + 1
ws.row_dimensions[spacer_r].height = 14

info_hdr_r = tot_r + 2
ws.row_dimensions[info_hdr_r].height = 24

info_val_r = tot_r + 3
ws.row_dimensions[info_val_r].height = 26

# Column B: Start date
c_start_h = ws.cell(row=info_hdr_r, column=2, value="START DATE")
c_start_h.font = FONT_HEADER
c_start_h.fill = FILL_CARD_HEADER
c_start_h.alignment = ALIGN_CENTER
c_start_h.border = BORDER_THIN

c_start_v = ws.cell(row=info_val_r, column=2, value=start_date_fmt)
c_start_v.font = FONT_TOTAL
c_start_v.fill = FILL_CARD_VAL
c_start_v.alignment = ALIGN_CENTER
c_start_v.border = BORDER_THIN

# Column C: End date
c_end_h = ws.cell(row=info_hdr_r, column=3, value="END DATE")
c_end_h.font = FONT_HEADER
c_end_h.fill = FILL_CARD_HEADER
c_end_h.alignment = ALIGN_CENTER
c_end_h.border = BORDER_THIN

c_end_v = ws.cell(row=info_val_r, column=3, value=end_date_fmt)
c_end_v.font = FONT_TOTAL
c_end_v.fill = FILL_CARD_VAL
c_end_v.alignment = ALIGN_CENTER
c_end_v.border = BORDER_THIN

# Column D: Total session from start to end
c_tot_h = ws.cell(row=info_hdr_r, column=4, value="TOTAL SESSIONS FROM START TO END")
c_tot_h.font = FONT_HEADER
c_tot_h.fill = FILL_CARD_HEADER
c_tot_h.alignment = ALIGN_CENTER
c_tot_h.border = BORDER_THIN

c_tot_v = ws.cell(row=info_val_r, column=4, value=f"{total_sessions_all} Sessions")
c_tot_v.font = FONT_TOTAL
c_tot_v.fill = FILL_CARD_VAL
c_tot_v.alignment = ALIGN_CENTER
c_tot_v.border = BORDER_THIN

# Column Dimensions
ws.column_dimensions['A'].width = 16 # Roll No
ws.column_dimensions['B'].width = 28 # Full Name
ws.column_dimensions['C'].width = 18 # Joined Date
ws.column_dimensions['D'].width = 34 # Total Session After Joined Date
ws.column_dimensions['E'].width = 14 # Present
ws.column_dimensions['F'].width = 16 # Percentage
ws.column_dimensions['G'].width = 28 # Regularity Points (out of 10)

# Save both primary filenames
filenames = [
    "IITP_Hockey_Monthwise_Attendance.xlsx",
    "IITP_Hockey_Attendance.xlsx"
]

for fname in filenames:
    wb.save(fname)
    print(f"Successfully generated {fname} (Single Tab: '{ws.title}', {len(player_rows)} active students)")
