import json, datetime, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.formatting.rule import FormulaRule, CellIsRule, DataBarRule
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.chart import BarChart, DoughnutChart, Reference
from openpyxl.chart.series import DataPoint
from openpyxl.chart.label import DataLabelList
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment

import os as _os
B = _os.path.dirname(_os.path.abspath(__file__)) + '/'
st = json.load(open(B + 'state.json'))
OUT = sys.argv[1] if len(sys.argv) > 1 else B + 'Quince_Matrix_Shop.xlsx'
LASTS = '[<1]"<1";0'
B2B_POS = list((st.get('b2b') or {}).get('pos', []))
B2B_SHIP = (st.get('b2b') or {}).get('ship', {})
B2B_RANGE = "'B2B Dispatch'!$L$6:$L$25"
PORDER = ["Waffle Throw", "Waffle Bed Blanket", "Duvet Cover", "Duvet Cover Set", "Sham Set"]
F = 'Arial'
PINE, PINE2, INK, MUTED, LINE, BG = '1E5B4F', '2C7A6A', '16201B', '6B7871', 'D9DFDA', 'F2F4F1'
RED, RED_BG, RED_TX = 'C2362B', 'FBE7E4', '8E2119'
YEL, YEL_BG, YEL_TX = 'E2B007', 'FDF3CF', '7A5A00'
GRN, GRN_BG, GRN_TX = '2F8A57', 'DFF1E6', '1C5E39'
EMP_BG, EMP_TX = 'ECEFEC', '6B7871'
fill = lambda c: PatternFill('solid', fgColor=c)
font = lambda size=10, bold=False, color=INK, italic=False, u=None: Font(name=F, size=size, bold=bold, color=color, italic=italic, underline=u)
thin = Side(style='thin', color=LINE)
box = Border(left=thin, right=thin, top=thin, bottom=thin)
bottom = Border(bottom=thin)
CENTER = Alignment(horizontal='center', vertical='center')
LEFT = Alignment(horizontal='left', vertical='center', indent=1)

# row layout
I_H, I0, I_N = 4, 5, 1000           # Inspections header row, first data row, capacity
I1 = I0 + I_N - 1
O_H, O0, O_N = 3, 4, 5000           # Orders
O1 = O0 + O_N - 1
S_H, S0 = 5, 6                      # Shop
P_H, P0 = 5, 6                      # PO Ledger

wb = Workbook()
db = wb.active; db.title = 'Dashboard'
sh = wb.create_sheet('Shop')
po = wb.create_sheet('PO Ledger')
bb = wb.create_sheet('B2B Dispatch')
fx = wb.create_sheet('Fabric Reco')
ins = wb.create_sheet('Add Inspection')
od = wb.create_sheet('Add Orders')
cat = wb.create_sheet('Catalog')
dy = wb.create_sheet('Daily')
cc = wb.create_sheet('Calc')

NAV = [('Dashboard', 'Dashboard'), ('Shop', 'Shop'), ('PO Ledger', 'PO Ledger'), ('B2B Dispatch', 'B2B dispatch'), ('Fabric Reco', 'Fabric reco'), ('Add Inspection', '+ Add inspection'), ('Add Orders', '+ Add orders')]

def navbar(ws, current, row=1, start_col=2, span=2):
    ws.row_dimensions[row].height = 24
    col = start_col
    for sheet, label in NAV:
        if span > 1:
            ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col + span - 1)
        c = ws.cell(row=row, column=col)
        if sheet == current:
            c.value = label; c.fill = fill(INK); c.font = font(10, True, 'FFFFFF')
        else:
            c.value = f'=HYPERLINK("#\'{sheet}\'!A1","{label}")'
            c.fill = fill(PINE if label.startswith('+') else 'E3E9E5'); c.font = font(10, True, 'FFFFFF' if label.startswith('+') else PINE)
        c.alignment = CENTER
        col += span + (1 if span > 1 else 0)
    return col

def title_band(ws, row, text, subtitle, c1, c2):
    ws.merge_cells(start_row=row, start_column=c1, end_row=row, end_column=c2)
    t = ws.cell(row=row, column=c1, value=text); t.font = font(18, True, INK); t.alignment = Alignment(vertical='center')
    ws.row_dimensions[row].height = 30
    ws.merge_cells(start_row=row + 1, start_column=c1, end_row=row + 1, end_column=c2)
    s = ws.cell(row=row + 1, column=c1, value=subtitle); s.font = font(9.5, False, MUTED)

def header(ws, row, cols, c0=1, kinds=None):
    for i, h in enumerate(cols):
        c = ws.cell(row=row, column=c0 + i, value=h)
        k = kinds[i] if kinds else 'h'
        c.fill = fill(YEL_BG if k == 'in' else ('5E6B65' if k == 'calc' else PINE))
        c.font = font(9.5, True, YEL_TX if k == 'in' else 'FFFFFF')
        c.alignment = Alignment(vertical='center', wrap_text=True, horizontal='center')
        c.border = box
    ws.row_dimensions[row].height = 32

def widths(ws, w):
    for k, v in w.items(): ws.column_dimensions[k].width = v

def status_cf(ws, rng):
    for val, bg, tx in [('"Red"', RED_BG, RED_TX), ('"Yellow"', YEL_BG, YEL_TX), ('"Green"', GRN_BG, GRN_TX),
                        ('"Sold out"', EMP_BG, EMP_TX), ('"Awaiting inspection"', EMP_BG, EMP_TX), ('"Below 0 - check"', RED, 'FFFFFF')]:
        ws.conditional_formatting.add(rng, CellIsRule(operator='equal', formula=[val], fill=fill(bg), font=Font(name=F, bold=True, color=tx)))

# ======================= Catalog (hidden) =======================
cat_rows = []
for c in st['catalog']:
    for p in c['pos']:
        cat_rows.append((p['po'], c['sku'], c['product'], c['colour'], c['size'], c['cls'], p['qty'], p['rev']))
cat_rows.sort(key=lambda r: (PORDER.index(r[2]), r[1], r[0]))
header(cat, 1, ['PO', 'SKU', 'Product', 'Colour', 'Size', 'Size class', 'PO qty', 'Revised date', 'Match key', 'Type'], 1, ['in'] * 8 + ['calc'] * 2)
for i, r in enumerate(cat_rows, 2):
    for j, v in enumerate(r, 1): cat.cell(row=i, column=j, value=v).font = font()
    cat.cell(row=i, column=9, value=f'=A{i}&"|"&UPPER(D{i})&"|"&F{i}').font = font()
CAT_END = 400  # room for new PO lines
for i in range(2, CAT_END + 1):
    cat.cell(row=i, column=10, value=f'=IF(A{i}="","",IF(COUNTIF({B2B_RANGE},A{i})>0,"B2B","Shop"))')
for i in range(len(cat_rows) + 2, CAT_END + 1):
    cat.cell(row=i, column=9, value=f'=IF(A{i}="","",A{i}&"|"&UPPER(D{i})&"|"&F{i})')
cat.freeze_panes = 'A2'
widths(cat, {'A': 9, 'B': 12, 'C': 20, 'D': 12, 'E': 14, 'F': 15, 'G': 9, 'H': 13, 'I': 34})
cat['K1'] = 'Source: SKU WISE PCS QTY.xlsx, shared 18 Oct 2026. New PO lines go at the bottom. Size class: THROW, TWIN, FULL/QUEEN, KING/CAL KING, STANDARD SHAM or KING SHAM.'
cat['K1'].font = font(9, False, MUTED)
CR = lambda col: f'Catalog!${col}$2:${col}${CAT_END}'

# ======================= Add Inspection =======================
navbar(ins, 'Add Inspection')
ins.merge_cells('B2:N2')
ins['B2'] = 'Add inspection: stock in'; ins['B2'].font = font(16, True)
ins.merge_cells('B3:N3')
ins['B3'] = 'Type one row per form line in the first empty row, oldest inspection first. Fill the yellow columns only; grey columns work by themselves. If Matched SKU says CHECK, type the SKU in Override SKU.'
ins['B3'].font = font(9.5, False, MUTED)
cols = ['Inspection date', 'Form file', 'PO', 'Colour', 'Size (as on form)', 'Form SKU', 'Qty', 'Override SKU',
        'Size class', 'Matched SKU', 'Note', 'Earlier lots', 'Sold from lot (FIFO)', 'Left in lot', 'Open-lot no.', 'Selling-now key', 'Type']
header(ins, I_H, cols, 2, ['in'] * 8 + ['calc'] * 9)
# columns: B date C file D PO E colour F size G formSKU H qty I override J class K matched L note M earlier N sold O left P open Q key
cat_by = {c['sku']: c for c in st['catalog']}
for k, l in enumerate(st['insp']):
    r = I0 + k; it = cat_by[l['s']]
    sizeform = {'THROW': 'Throw', 'TWIN': 'Twin', 'FULL/QUEEN': 'Full/Queen', 'KING/CAL KING': 'King/Cal King'}[it['cls']]
    form_sku = 'LB121644' if l['n'] else ('' if l['f'].startswith('Sample Plan 02.09') else l['s'])
    for j, v in enumerate([datetime.date.fromisoformat(l['d']), l['f'], l['po'], it['colour'], sizeform, form_sku, l['q'], ''], 2):
        ins.cell(row=r, column=j, value=v)
OQ = f'\'Add Orders\'!$AG${O0}:$AG${O1}'
OS = f'\'Add Orders\'!$B${O0}:$B${O1}'
OD = f'\'Add Orders\'!$AE${O0}:$AE${O1}'
OC = f'\'Add Orders\'!$AF${O0}:$AF${O1}'
OST = f'\'Add Orders\'!$AH${O0}:$AH${O1}'
for r in range(I0, I1 + 1):
    ins[f'J{r}'] = (f'=IF(D{r}="","",IF(OR(ISNUMBER(SEARCH("THROW",F{r})),ISNUMBER(SEARCH("50",F{r}))),"THROW",'
                    f'IF(ISNUMBER(SEARCH("TWIN",F{r})),"TWIN",IF(OR(ISNUMBER(SEARCH("QUEEN",F{r})),ISNUMBER(SEARCH("FULL",F{r}))),"FULL/QUEEN",'
                    f'IF(ISNUMBER(SEARCH("KING",F{r})),"KING/CAL KING","?")))))')
    ins[f'K{r}'] = (f'=IF(D{r}="","",IF(I{r}<>"",UPPER(TRIM(I{r})),IFERROR(INDEX({CR("B")},'
                    f'MATCH(D{r}&"|"&UPPER(TRIM(E{r}))&"|"&J{r},{CR("I")},0)),"CHECK")))')
    ins[f'L{r}'] = (f'=IF(D{r}="","",IF(K{r}="CHECK","No PO + colour + size match: type the SKU in Override SKU",'
                    f'IF(AND(G{r}<>"",UPPER(TRIM(G{r}))<>K{r}),"Form SKU "&G{r}&" is not on PO "&D{r}&"; counted as "&K{r},"")))')
    ins[f'R{r}'] = f'=IF(D{r}="","",IF(COUNTIF({B2B_RANGE},D{r})>0,"B2B","Shop"))'
    ins[f'M{r}'] = f'=IF(OR(K{r}="",R{r}="B2B"),"",SUMIFS($H${I_H}:H{r-1},$K${I_H}:K{r-1},K{r},$R${I_H}:R{r-1},"Shop"))'
    ins[f'N{r}'] = f'=IF(OR(K{r}="",K{r}="CHECK",R{r}="B2B"),"",MIN(H{r},MAX(0,SUMIFS({OQ},{OS},K{r})-M{r})))'
    ins[f'O{r}'] = f'=IF(N{r}="","",H{r}-N{r})'
    ins[f'P{r}'] = f'=IF(O{r}="","",IF(O{r}>0,COUNTIFS($K${I0}:K{r},K{r},$O${I0}:O{r},">0"),""))'
    ins[f'Q{r}'] = f'=IF(P{r}=1,K{r},"")'
    for col in 'BCDEFGHIJKLMNOPQ':
        ins[f'{col}{r}'].font = font()
    ins[f'B{r}'].number_format = 'dd-mmm-yyyy'
    for col in 'BCDEFGHI': ins[f'{col}{r}'].fill = fill('FFFDF2')
ins.freeze_panes = f'B{I0}'; ins.auto_filter.ref = f'B{I_H}:Q{I1}'
widths(ins, {'A': 2, 'B': 13, 'C': 28, 'D': 9, 'E': 12, 'F': 15, 'G': 12, 'H': 7, 'I': 12, 'J': 14, 'K': 12, 'L': 48, 'M': 9, 'N': 11, 'O': 9, 'P': 8, 'Q': 11})
ins.column_dimensions.group('P', 'Q', hidden=True)
ins.conditional_formatting.add(f'K{I0}:K{I1}', CellIsRule(operator='equal', formula=['"CHECK"'], fill=fill(RED_BG), font=Font(name=F, color=RED_TX, bold=True)))
ins.conditional_formatting.add(f'L{I0}:L{I1}', FormulaRule(formula=[f'LEN(L{I0})>0'], fill=fill(YEL_BG), font=Font(name=F, color=YEL_TX)))
ins.conditional_formatting.add(f'O{I0}:O{I1}', FormulaRule(formula=[f'AND(ISNUMBER(O{I0}),O{I0}=0)'], font=Font(name=F, color='8A948F')))
IK = f"'Add Inspection'!$K${I0}:$K${I1}"
IH = f"'Add Inspection'!$H${I0}:$H${I1}"
ID = f"'Add Inspection'!$D${I0}:$D${I1}"
IR = f"'Add Inspection'!$R${I0}:$R${I1}"

# ======================= Add Orders =======================
navbar(od, 'Add Orders', start_col=2, span=1)
od['A2'] = 'Add orders: paste the Export Pending Dispatch data rows (without the header) in the first empty row, column A. Yesterday\'s orders can stay in: any AWB already here counts as 0.'
od['A2'].font = font(10, True, PINE)
EXP = ['OrderId', 'SKU', 'Child SKUs', 'Product', 'Variant', 'Qty', 'OrderType', 'Status', 'Fullfillment Location', 'Carrier', 'Sort Code',
       'Tracking', 'Ordered At', 'Updated At', 'Customer', 'Email', 'Phone', 'Shipping Destination', 'Address 1', 'Address 2', 'City',
       'State/Province', 'Zip Code', 'labelUrl', 'invoiceUrl', 'lastMileTrackingNumber', 'orderNumber', 'Card Message', 'Delivery Date']
HELP = ['', 'Order day', 'Country', 'Counted qty', 'Line status']   # AB spacer, AC.. AF
header(od, O_H, EXP, 1, ['in'] * 29)
header(od, O_H, HELP[1:], 31, ['calc'] * 4)
od.column_dimensions['AD'].width = 2
for k, (d, o, sku, q, awb, ctry) in enumerate(st['sales']):
    r = O0 + k; c = cat_by[sku]
    od.cell(row=r, column=2, value=sku); od.cell(row=r, column=4, value='Organic ' + c['product'])
    od.cell(row=r, column=5, value=f"{c['colour']} / {c['size']}"); od.cell(row=r, column=6, value=q)
    od.cell(row=r, column=8, value='HISTORY'); od.cell(row=r, column=13, value=d + ' 00:00:00')
    od.cell(row=r, column=18, value={'US': 'US', 'CA': 'CA', '': 'Not recorded'}[ctry])
    od.cell(row=r, column=26, value=awb); od.cell(row=r, column=27, value=o)
for r in range(O0, O1 + 1):
    od[f'AE{r}'] = f'=IF(B{r}="","",IF(ISNUMBER(M{r}),INT(M{r}),DATEVALUE(LEFT(M{r},10))))'
    od[f'AF{r}'] = f'=IF(B{r}="","",IF(RIGHT(TRIM(R{r}),2)="CA","CA",IF(RIGHT(TRIM(R{r}),2)="US","US","-")))'
    od[f'AG{r}'] = f'=IF(B{r}="","",IF(AND(Z{r}<>"",COUNTIF(Z${O_H}:Z{r-1},Z{r})>0),0,VALUE(F{r})))'
    od[f'AH{r}'] = f'=IF(B{r}="","",IF(AG{r}=0,"Duplicate, skipped",IF(ISNA(MATCH(B{r},{CR("B")},0)),"SKU not in Catalog","Counted")))'
    for col in ('B', 'E', 'F', 'M', 'R', 'Z', 'AA', 'AE', 'AF', 'AG', 'AH'): od[f'{col}{r}'].font = font()
    od[f'Z{r}'].number_format = '@'; od[f'AA{r}'].number_format = '@'; od[f'AE{r}'].number_format = 'dd-mmm-yy'
od.freeze_panes = f'C{O0}'; od.auto_filter.ref = f'A{O_H}:AH{O1}'
widths(od, {'A': 15, 'B': 11, 'E': 24, 'F': 6, 'M': 19, 'R': 24, 'Z': 16, 'AA': 11, 'AE': 11, 'AF': 8, 'AG': 9, 'AH': 18})
for a, b in [('C', 'D'), ('G', 'L'), ('N', 'Q'), ('S', 'W'), ('X', 'Y'), ('AB', 'AC')]:
    od.column_dimensions.group(a, b, hidden=True)
od.conditional_formatting.add(f'AH{O0}:AH{O1}', CellIsRule(operator='equal', formula=['"Duplicate, skipped"'], fill=fill(EMP_BG), font=Font(name=F, color=EMP_TX)))
od.conditional_formatting.add(f'AH{O0}:AH{O1}', CellIsRule(operator='equal', formula=['"SKU not in Catalog"'], fill=fill(RED_BG), font=Font(name=F, color=RED_TX, bold=True)))
od.conditional_formatting.add(f'AH{O0}:AH{O1}', CellIsRule(operator='equal', formula=['"Counted"'], font=Font(name=F, color=GRN_TX)))
od['AG2'] = 'Hidden columns (+ buttons above) still take the paste.'; od['AG2'].font = font(8.5, False, MUTED)

# ======================= Daily (hidden) =======================
header(dy, 1, ['Date', 'Pcs sold', 'Order-day rank (1 = latest)', 'Lines'], 1, ['calc'] * 4)
d0 = datetime.date(2026, 9, 1); r = 2
while d0 <= datetime.date(2027, 6, 30):
    if d0.weekday() != 6:
        dy.cell(row=r, column=1, value=d0).number_format = 'dd-mmm-yy'; r += 1
    d0 += datetime.timedelta(days=1)
DY = r - 1
for r in range(2, DY + 1):
    dy[f'B{r}'] = f'=SUMIFS({OQ},{OD},A{r})'
    dy[f'C{r}'] = f'=IF(B{r}>0,COUNTIFS(A{r}:$A${DY},">="&A{r},B{r}:$B${DY},">0"),"")'
    dy[f'D{r}'] = f'=COUNTIFS({OD},A{r},{OQ},">0")'

# ======================= Shop =======================
navbar(sh, 'Shop')
title_band(sh, 2, 'Shop: stock by SKU', 'In stock = inspected − sold. Click an SKU to open its PO lots. Use the filter arrows on Status or Bucket to see the live shop or the empty bucket.', 2, 16)
cols = ['SKU', 'Product', 'Colour', 'Size', 'PO qty', 'Inspected', 'Sold', 'In stock', 'Status', 'Sold %', 'Last sale', 'Last 7 order days', 'Stock lasts (order days)', 'Selling from PO', 'Bucket']
header(sh, S_H, cols, 2)
skus = sorted(st['catalog'], key=lambda c: (PORDER.index(c['product']), c['sku']))
S1 = S0 + len(skus) - 1
prow = sorted([r for r in cat_rows if r[0] not in B2B_POS], key=lambda r: (r[0], PORDER.index(r[2]), r[1]))
b2b_rows = sorted([r for r in cat_rows if r[0] in B2B_POS], key=lambda r: (B2B_POS.index(r[0]), r[1]))
po_first_row = {}
for k, rr in enumerate(prow):
    po_first_row.setdefault(rr[1], P0 + k)
for k, c in enumerate(skus):
    r = S0 + k
    sh[f'B{r}'] = f'=HYPERLINK("#\'PO Ledger\'!B{po_first_row[c["sku"]]}","{c["sku"]}")'
    sh[f'C{r}'] = c['product']; sh[f'D{r}'] = c['colour']; sh[f'E{r}'] = c['size']
    sh[f'F{r}'] = f'=SUMIFS({CR("G")},{CR("B")},"{c["sku"]}",{CR("J")},"Shop")'
    sh[f'G{r}'] = f'=SUMIFS({IH},{IK},"{c["sku"]}",{IR},"Shop")'
    sh[f'H{r}'] = f'=SUMIFS({OQ},{OS},"{c["sku"]}")'
    sh[f'I{r}'] = f'=G{r}-H{r}'
    sh[f'J{r}'] = f'=IF(G{r}=0,"Awaiting inspection",IF(I{r}<0,"Below 0 - check",IF(I{r}=0,"Sold out",IF(I{r}<=RedLimit,"Red",IF(I{r}<=YellowLimit,"Yellow","Green")))))'
    sh[f'K{r}'] = f'=IF(G{r}=0,"",H{r}/G{r})'
    sh[f'L{r}'] = f'=IF(H{r}=0,"",_xlfn.MAXIFS({OD},{OS},"{c["sku"]}",{OQ},">0"))'
    sh[f'M{r}'] = f'=IF(Cutoff7=0,H{r},SUMIFS({OQ},{OS},"{c["sku"]}",{OD},">="&Cutoff7))'
    sh[f'N{r}'] = f'=IF(OR(I{r}<=0,M{r}=0),"",I{r}/(M{r}/Days7))'
    sh[f'N{r}'].number_format = LASTS
    sh[f'O{r}'] = f'=IF(I{r}<=0,"",IFERROR("PO "&INDEX(\'Add Inspection\'!$D${I0}:$D${I1},MATCH("{c["sku"]}",\'Add Inspection\'!$Q${I0}:$Q${I1},0)),""))'
    sh[f'P{r}'] = f'=IF(I{r}>0,"Live shop","Empty bucket")'
    for col in 'BCDEFGHIJKLMNOP':
        cl = sh[f'{col}{r}']; cl.font = font(); cl.border = bottom; cl.alignment = Alignment(vertical='center')
    sh[f'B{r}'].font = font(10, True, PINE, u='single')
    sh[f'I{r}'].font = font(11, True); sh[f'I{r}'].alignment = CENTER
    sh[f'J{r}'].alignment = CENTER
    sh[f'K{r}'].number_format = '0%'; sh[f'L{r}'].number_format = 'dd-mmm'
    for col in 'FGHM': sh[f'{col}{r}'].number_format = '#,##0'
    sh.row_dimensions[r].height = 19
T = S1 + 1
sh[f'B{T}'] = 'Total'
for col in 'FGH': sh[f'{col}{T}'] = f'=SUM({col}{S0}:{col}{S1})'
sh[f'I{T}'] = f'=SUMIF(I{S0}:I{S1},">0")'
for col in 'BFGHI':
    sh[f'{col}{T}'].font = font(10, True); sh[f'{col}{T}'].fill = fill(BG); sh[f'{col}{T}'].number_format = '#,##0'
sh.freeze_panes = f'C{S0}'; sh.auto_filter.ref = f'B{S_H}:P{S1}'
widths(sh, {'A': 2, 'B': 11, 'C': 19, 'D': 11, 'E': 13, 'F': 8, 'G': 10, 'H': 8, 'I': 10, 'J': 19, 'K': 8, 'L': 9, 'M': 10, 'N': 11, 'O': 13, 'P': 13})
status_cf(sh, f'J{S0}:J{S1}')
sh.conditional_formatting.add(f'I{S0}:I{S1}', FormulaRule(formula=[f'AND(I{S0}>0,I{S0}<=RedLimit)'], font=Font(name=F, bold=True, color=RED)))
sh.conditional_formatting.add(f'I{S0}:I{S1}', FormulaRule(formula=[f'AND(I{S0}>RedLimit,I{S0}<=YellowLimit)'], font=Font(name=F, bold=True, color=YEL_TX)))
sh.conditional_formatting.add(f'I{S0}:I{S1}', FormulaRule(formula=[f'I{S0}>YellowLimit'], font=Font(name=F, bold=True, color=GRN)))
sh.conditional_formatting.add(f'K{S0}:K{S1}', DataBarRule(start_type='num', start_value=0, end_type='num', end_value=1, color='7FB5A8', showValue=True))
sh.conditional_formatting.add(f'C{S0}:H{S1}', FormulaRule(formula=[f'$I{S0}<=0'], font=Font(name=F, color='9AA39F')))
sh.conditional_formatting.add(f'P{S0}:P{S1}', CellIsRule(operator='equal', formula=['"Live shop"'], font=Font(name=F, bold=True, color=PINE)))

# ======================= PO Ledger =======================
navbar(po, 'PO Ledger')
title_band(po, 2, 'PO ledger (FIFO)', 'For each PO and SKU: inspected, sold out of it (oldest inspected lot first), left, and still to be inspected. Click an SKU to go back to the Shop.', 2, 14)
header(po, P_H, ['PO', 'SKU', 'Product', 'Colour', 'Size', 'PO qty', 'Inspected', 'Sold (FIFO)', 'In stock', 'Not yet inspected', 'Revised date', 'Status'], 2)
sku_row = {c['sku']: S0 + k for k, c in enumerate(skus)}
prev = None
for k, rr in enumerate(prow):
    r = P0 + k
    po[f'B{r}'] = rr[0]
    po[f'C{r}'] = f'=HYPERLINK("#Shop!B{sku_row[rr[1]]}","{rr[1]}")'
    po[f'D{r}'] = rr[2]; po[f'E{r}'] = rr[3]; po[f'F{r}'] = rr[4]; po[f'G{r}'] = rr[6]
    po[f'H{r}'] = f'=SUMIFS({IH},{ID},B{r},{IK},"{rr[1]}")'
    po[f'I{r}'] = f"=SUMIFS('Add Inspection'!$N${I0}:$N${I1},{ID},B{r},{IK},\"{rr[1]}\")"
    po[f'J{r}'] = f"=SUMIFS('Add Inspection'!$O${I0}:$O${I1},{ID},B{r},{IK},\"{rr[1]}\")"
    po[f'K{r}'] = f'=MAX(0,G{r}-H{r})'
    po[f'L{r}'] = rr[7]
    po[f'M{r}'] = f'=IF(H{r}=0,"Awaiting inspection",IF(J{r}<=0,"Sold out",IF(J{r}<=RedLimit,"Red",IF(J{r}<=YellowLimit,"Yellow","Green"))))'
    for col in 'BCDEFGHIJKLM':
        cl = po[f'{col}{r}']; cl.font = font(); cl.border = bottom
        if rr[0] != prev and k: cl.border = Border(top=Side(style='medium', color=PINE), bottom=thin)
    po[f'C{r}'].font = font(10, True, PINE, u='single')
    po[f'M{r}'].alignment = CENTER
    for col in 'GHIJK': po[f'{col}{r}'].number_format = '#,##0'
    prev = rr[0]
P1 = P0 + len(prow) - 1
status_cf(po, f'M{P0}:M{P1}')
po.conditional_formatting.add(f'B{P0}:L{P1}', FormulaRule(formula=[f'$H{P0}=0'], font=Font(name=F, color='9AA39F')))
po.freeze_panes = f'D{P0}'; po.auto_filter.ref = f'B{P_H}:M{P1}'
widths(po, {'A': 2, 'B': 9, 'C': 11, 'D': 19, 'E': 11, 'F': 13, 'G': 8, 'H': 10, 'I': 10, 'J': 9, 'K': 11, 'L': 12, 'M': 19})

# ======================= B2B Dispatch =======================
navbar(bb, 'B2B Dispatch')
title_band(bb, 2, 'B2B dispatch', 'B2B POs ship in one go: once inspected, the whole inspected qty is dispatched together on the day the buyer confirms. Type the dispatch date in the yellow cell on the PO row. B2B qty never counts as portal shop stock.', 2, 12)
bb['G5'] = '=SUMIFS(I8:I400,B8:B400,"PO *")'; bb['H5'] = '=COUNTIFS(K8:K400,"Inspected - waiting for buyer")&" PO(s) inspected, waiting for buyer"'
bb['G5'].font = font(14, True, PINE); bb['H5'].font = font(9, False, MUTED); bb['B5'] = 'Pcs to dispatch'; bb['B5'].font = font(9, True, MUTED)
# B2B PO list (feeds the Type columns): B6:B25
bb['L5'] = 'B2B PO list'; bb['L5'].font = font(9, True, MUTED)
for i in range(20):
    c = bb.cell(row=6 + i, column=12, value=B2B_POS[i] if i < len(B2B_POS) else None)
    c.fill = fill(YEL_BG); c.font = font(10, True, YEL_TX); c.border = box; c.alignment = CENTER
bb['L27'] = 'Add a new B2B PO number in an empty yellow cell, and its lines to the hidden Catalog sheet.'; bb['L27'].font = font(8.5, False, MUTED)
header(bb, 7, ['PO / SKU', 'Item', 'Ship date', 'PO qty', 'Inspected', 'Dispatched on', 'Dispatched qty', 'To dispatch', 'Status'], 2)
r = 8
for po_no in B2B_POS:
    lines = [x for x in b2b_rows if x[0] == po_no]
    hr = r; first, last = hr + 1, hr + len(lines)
    bb[f'B{hr}'] = f'PO {po_no}'; bb[f'D{hr}'] = B2B_SHIP.get(str(po_no), lines[0][7] if lines else '')
    bb[f'E{hr}'] = f'=SUM(E{first}:E{last})'; bb[f'F{hr}'] = f'=SUM(F{first}:F{last})'
    disp = [d for d in (st.get('b2b') or {}).get('dispatch', []) if d['po'] == po_no]
    bb[f'G{hr}'] = datetime.date.fromisoformat(disp[-1]['d']) if disp else None
    bb[f'G{hr}'].fill = fill('FFFF00'); bb[f'G{hr}'].font = font(10, True, '0000FF'); bb[f'G{hr}'].number_format = 'dd-mmm-yyyy'
    bb[f'H{hr}'] = f'=SUM(H{first}:H{last})'; bb[f'I{hr}'] = f'=SUM(I{first}:I{last})'
    bb[f'J{hr}'] = f'=IF(F{hr}=0,"Awaiting inspection",IF(G{hr}<>"","Dispatched","Inspected - waiting for buyer"))'
    for col in 'BCDEFGHIJ':
        bb[f'{col}{hr}'].border = Border(top=Side(style='medium', color=PINE), bottom=thin)
        if col != 'G': bb[f'{col}{hr}'].font = font(10, True); bb[f'{col}{hr}'].fill = fill(BG)
    for k, x in enumerate(lines):
        rr = hr + 1 + k
        bb[f'B{rr}'] = f'=HYPERLINK("#Shop!B{sku_row[x[1]]}","{x[1]}")'; bb[f'B{rr}'].font = font(10, True, PINE, u='single')
        bb[f'C{rr}'] = f'{x[3]} · {x[2]} · {x[4]}'
        bb[f'E{rr}'] = x[6]
        bb[f'F{rr}'] = f'=SUMIFS({IH},{ID},{po_no},{IK},"{x[1]}")'
        bb[f'H{rr}'] = f'=IF($G${hr}<>"",F{rr},0)'
        bb[f'I{rr}'] = f'=F{rr}-H{rr}'
        for col in 'BCDEFGHIJ': bb[f'{col}{rr}'].border = bottom
        for col in 'CEFHI': bb[f'{col}{rr}'].font = font()
    r = last + 2
bb['K8'] = None
# status column K (one per PO header) for the counter in K3
for row in range(8, r):
    if str(bb[f'B{row}'].value or '').startswith('PO '): bb[f'K{row}'] = f'=J{row}'; bb[f'K{row}'].font = font(1, False, 'FFFFFF')
status_cf(bb, f'J8:J{r}')
for val, bg, tx in [('"Inspected - waiting for buyer"', YEL_BG, YEL_TX), ('"Dispatched"', GRN_BG, GRN_TX)]:
    bb.conditional_formatting.add(f'J8:J{r}', CellIsRule(operator='equal', formula=[val], fill=fill(bg), font=Font(name=F, bold=True, color=tx)))
for row in range(8, r):
    for col in 'EFHI': bb[f'{col}{row}'].number_format = '#,##0'
widths(bb, {'A': 2, 'B': 12, 'C': 30, 'D': 11, 'E': 9, 'F': 10, 'G': 14, 'H': 12, 'I': 11, 'J': 26, 'K': 2, 'L': 14})
bb.freeze_panes = 'C8'
# ======================= Calc (hidden) =======================
header(cc, 1, ['SKU list', 'Live sort key', 'k', 'k-th key', 'Shop row'], 1, ['calc'] * 5)
for k, c in enumerate(skus):
    r = 2 + k; srow = S0 + k
    cc[f'A{r}'] = c['sku']
    cc[f'B{r}'] = f'=IF(Shop!I{srow}>0,Shop!I{srow}+ROW()/100000,"")'
LIVE_ROWS = 14
for k in range(1, LIVE_ROWS + 1):
    r = 1 + k
    cc[f'C{r}'] = k
    cc[f'D{r}'] = f'=IFERROR(SMALL($B$2:$B${1+len(skus)},C{r}),"")'
    cc[f'E{r}'] = f'=IF(D{r}="","",MATCH(D{r},$B$2:$B${1+len(skus)},0)+{S0-1})'
# 30-day series
cc['G1'] = 'Day'; cc['H1'] = 'Pcs'
for i in range(30):
    r = 2 + i
    cc[f'G{r}'] = f'=LastDay-{29 - i}'; cc[f'G{r}'].number_format = 'dd-mmm'
    cc[f'H{r}'] = f'=SUMIFS({OQ},{OD},G{r})'
colours = ['Espresso', 'Mist', 'Undyed', 'Dove', 'Dried Sage', 'Mineral', 'White']
cc['J1'] = 'Colour'; cc['K1'] = 'Sold'
for i, col in enumerate(colours):
    r = 2 + i
    cc[f'J{r}'] = col; cc[f'K{r}'] = f'=SUMIFS(Shop!$H${S0}:$H${S1},Shop!$D${S0}:$D${S1},J{r})'
cc['M1'] = 'Status'; cc['N1'] = 'Live SKUs'
for i, s in enumerate(['Red', 'Yellow', 'Green']):
    cc[f'M{2+i}'] = s; cc[f'N{2+i}'] = f'=COUNTIF(Shop!$J${S0}:$J${S1},M{2+i})'
cc['P1'] = '7th latest order day'; cc['P2'] = f'=IFERROR(INDEX(Daily!$A$2:$A${DY},MATCH(7,Daily!$C$2:$C${DY},0)),0)'; cc['P2'].number_format = 'dd-mmm-yy'
cc['Q1'] = 'Order days in window'; cc['Q2'] = f'=MIN(7,COUNTIF(Daily!$B$2:$B${DY},">0"))'
cc['R1'] = '14th latest'; cc['R2'] = f'=IFERROR(INDEX(Daily!$A$2:$A${DY},MATCH(14,Daily!$C$2:$C${DY},0)),0)'
cc['S1'] = 'Pcs last 7 order days'; cc['S2'] = f'=IF(P2=0,SUM({OQ}),SUMIFS({OQ},{OD},">="&P2))'
cc['T1'] = 'Pcs previous 7'; cc['T2'] = f'=IF(R2=0,0,SUMIFS({OQ},{OD},">="&R2,{OD},"<"&P2))'

# ======================= Dashboard =======================
db.sheet_view.showGridLines = False
db.sheet_view.zoomScale = 90
for col in range(1, 19):
    db.column_dimensions[chr(64 + col)].width = 11.5
db.column_dimensions['A'].width = 2; db.column_dimensions['J'].width = 3
navbar(db, 'Dashboard')
# header band rows 2-3
for r in (2, 3):
    for c in range(2, 18): db.cell(row=r, column=c).fill = fill(INK)
db.merge_cells('B2:K2'); db['B2'] = 'Quince Matrix'; db['B2'].font = font(22, True, 'FFFFFF'); db['B2'].alignment = Alignment(vertical='center', indent=1)
db.merge_cells('B3:K3'); db['B3'] = '="JDA Texworld  ·  Vendor JTPL004  ·  Last order day "&TEXT(LastDay,"dd mmm yyyy")&"  ·  "&TEXT(LastDayPcs,"0")&" pcs, "&TEXT(LastDayLines,"0")&" lines"'
db['B3'].font = font(10, False, 'C9D3CE'); db['B3'].alignment = Alignment(vertical='top', indent=1)
db.merge_cells('L2:Q2'); db['L2'] = 'Colour rules (type to change)'; db['L2'].font = font(9, True, 'C9D3CE'); db['L2'].alignment = Alignment(horizontal='right', vertical='bottom')
db.merge_cells('L3:M3'); db['L3'] = 'Red ≤'; db['L3'].font = font(10, True, 'FFB4AC'); db['L3'].alignment = Alignment(horizontal='right')
db['N3'] = st['settings']['red']; db['O3'] = 'Yellow ≤'; db['P3'] = st['settings']['yellow']
db['O3'].font = font(10, True, 'F7DC8A'); db['O3'].alignment = Alignment(horizontal='right')
for a in ('N3', 'P3'):
    db[a].fill = fill('FFFF00'); db[a].font = font(11, True, '0000FF'); db[a].alignment = CENTER
db['Q3'] = '="Green > "&YellowLimit'; db['Q3'].font = font(10, True, '9FE3B9')
db['N3'].comment = Comment('Red limit: stock at or below this shows red. Set by the MD, 18 Oct 2026.', 'Quince Matrix')
db['P3'].comment = Comment('Yellow limit: stock above red and at or below this shows yellow. Above it is green.', 'Quince Matrix')
db.row_dimensions[2].height = 34; db.row_dimensions[3].height = 22

wb.defined_names['RedLimit'] = DefinedName('RedLimit', attr_text='Dashboard!$N$3')
wb.defined_names['YellowLimit'] = DefinedName('YellowLimit', attr_text='Dashboard!$P$3')
wb.defined_names['Cutoff7'] = DefinedName('Cutoff7', attr_text='Calc!$P$2')
wb.defined_names['Days7'] = DefinedName('Days7', attr_text='Calc!$Q$2')
wb.defined_names['LastDay'] = DefinedName('LastDay', attr_text=f"_xlfn.MAXIFS({OD},{OQ},\">0\")".replace('_xlfn.', '') if False else 'Calc!$V$2')
wb.defined_names['LastDayPcs'] = DefinedName('LastDayPcs', attr_text='Calc!$W$2')
wb.defined_names['LastDayLines'] = DefinedName('LastDayLines', attr_text='Calc!$X$2')
cc['V1'] = 'Last order day'; cc['V2'] = f'=MAX({OD})'; cc['V2'].number_format = 'dd-mmm-yy'
cc['W1'] = 'Pcs that day'; cc['W2'] = f'=SUMIFS({OQ},{OD},V2)'
cc['X1'] = 'Lines that day'; cc['X2'] = f'=COUNTIFS({OD},V2,{OQ},">0")'

# KPI tiles rows 5-7 (6 tiles, each 2 columns + gap columns between handled by width)
tiles = [
    ('B', 'C', 'INSPECTED', f'=Shop!G{T}+SUMIFS(\'B2B Dispatch\'!$F$8:$F$400,\'B2B Dispatch\'!$B$8:$B$400,"PO *")', f'="pcs across "&SUMPRODUCT(({ID}<>"")/COUNTIFS({ID},{ID}&"",\'Add Inspection\'!$B${I0}:$B${I1},\'Add Inspection\'!$B${I0}:$B${I1}&""))&" lot lines"', 'Add Inspection'),
    ('D', 'E', 'SOLD + DISPATCHED', f'=Shop!H{T}+SUMIFS(\'B2B Dispatch\'!$H$8:$H$400,\'B2B Dispatch\'!$B$8:$B$400,"PO *")', f'=TEXT(Shop!H{T},"#,##0")&" shop + "&TEXT(SUMIFS(\'B2B Dispatch\'!$H$8:$H$400,\'B2B Dispatch\'!$B$8:$B$400,"PO *"),"#,##0")&" B2B"', 'Add Orders'),
    ('F', 'G', 'IN STOCK', f'=Shop!I{T}', f'="pcs  ·  "&TEXT(IF(Shop!G{T}=0,0,Shop!H{T}/Shop!G{T}),"0%")&" sold through"', 'Shop'),
    ('H', 'I', 'LAST 7 ORDER DAYS', '=Calc!S2', '=IF(Calc!T2=0,"pcs",TEXT(Calc!S2/Calc!T2-1,"+0%;-0%")&" vs previous 7")', 'Shop'),
    ('K', 'L', 'LIVE SKUs', f'=COUNTIF(Shop!$P${S0}:$P${S1},"Live shop")', '="with stock on the portal"', 'Shop'),
    ('M', 'N', 'B2B DISPATCHED', "=SUMIFS('B2B Dispatch'!$H$8:$H$400,'B2B Dispatch'!$B$8:$B$400,\"PO *\")", "=IF('B2B Dispatch'!$G$5>0,TEXT('B2B Dispatch'!$G$5,\"#,##0\")&\" pcs still to dispatch\",\"B2B complete\")", 'B2B Dispatch'),
    ('O', 'Q', 'SELLING FAST', f'=COUNTIFS(Shop!$N${S0}:$N${S1},"<=5")', '="live SKUs with ≤ 5 order days left"', 'Shop'),
]
for c1, c2, lab, val, subf, link in tiles:
    for rr in (5, 6, 7):
        db.merge_cells(f'{c1}{rr}:{c2}{rr}')
        for col in range(ord(c1), ord(c2) + 1):
            cell = db[f'{chr(col)}{rr}']; cell.fill = fill(BG)
            cell.border = Border(left=thin if chr(col) == c1 else None, right=thin if chr(col) == c2 else None,
                                 top=thin if rr == 5 else None, bottom=thin if rr == 7 else None)
    db[f'{c1}5'] = f'=HYPERLINK("#\'{link}\'!A1","{lab}  ›")'; db[f'{c1}5'].font = font(8.5, True, MUTED); db[f'{c1}5'].alignment = LEFT
    db[f'{c1}6'] = val; db[f'{c1}6'].font = font(22, True, INK); db[f'{c1}6'].alignment = LEFT; db[f'{c1}6'].number_format = '#,##0'
    db[f'{c1}7'] = subf; db[f'{c1}7'].font = font(8.5, False, '47544D'); db[f'{c1}7'].alignment = LEFT
db.row_dimensions[5].height = 18; db.row_dimensions[6].height = 34; db.row_dimensions[7].height = 18
db.conditional_formatting.add('O6', CellIsRule(operator='greaterThan', formula=['0'], font=Font(name=F, size=22, bold=True, color=RED)))
# inspection tile sub: simpler & robust
db['B7'] = f'="pcs across "&SUMPRODUCT(1/COUNTIF(\'Add Inspection\'!$B${I0}:$B${I0+len(st["insp"])+200},\'Add Inspection\'!$B${I0}:$B${I0+len(st["insp"])+200}&""))-1&" inspections  ·  incl. "&TEXT(SUMIFS(\'B2B Dispatch\'!$F$8:$F$400,\'B2B Dispatch\'!$B$8:$B$400,"PO *"),"#,##0")&" B2B"'

# Live shop panel rows 9-24 (B..I)
db.merge_cells('B9:I9'); db['B9'] = 'LIVE SHOP  ·  lowest stock first  ·  click an SKU to open it'; db['B9'].font = font(10, True, PINE)
db['B9'].border = Border(bottom=Side(style='medium', color=PINE))
for c in 'CDEFGHI': db[f'{c}9'].border = Border(bottom=Side(style='medium', color=PINE))
heads = [('B', 'SKU'), ('C', 'Colour'), ('D', 'Product · size'), ('F', 'In stock'), ('G', 'Status'), ('H', 'Sold %'), ('I', 'Lasts (days)')]
db.merge_cells('D10:E10')
for c, h in heads:
    db[f'{c}10'] = h; db[f'{c}10'].font = font(8.5, True, MUTED); db[f'{c}10'].alignment = Alignment(horizontal='left' if c in 'BCD' else 'center')
for k in range(1, LIVE_ROWS + 1):
    r = 10 + k; e = f'Calc!$E${1+k}'
    db.merge_cells(f'D{r}:E{r}')
    db[f'B{r}'] = f'=IF({e}="","",HYPERLINK("#Shop!B"&{e},INDEX(Shop!$C:$C,{e})&""&INDEX(Calc!$A:$A,{e}-{S0-2})))'
    db[f'B{r}'] = f'=IF({e}="","",HYPERLINK("#Shop!B"&{e},INDEX(Calc!$A:$A,{e}-{S0-2})))'
    db[f'C{r}'] = f'=IF({e}="","",INDEX(Shop!$D:$D,{e}))'
    db[f'D{r}'] = f'=IF({e}="","",SUBSTITUTE(SUBSTITUTE(INDEX(Shop!$C:$C,{e}),"Waffle Bed ",""),"Waffle ","")&" · "&INDEX(Shop!$E:$E,{e}))'
    db[f'F{r}'] = f'=IF({e}="","",INDEX(Shop!$I:$I,{e}))'
    db[f'G{r}'] = f'=IF({e}="","",INDEX(Shop!$J:$J,{e}))'
    db[f'H{r}'] = f'=IF({e}="","",INDEX(Shop!$K:$K,{e}))'
    db[f'I{r}'] = f'=IF({e}="","",IF(INDEX(Shop!$N:$N,{e})="","–",INDEX(Shop!$N:$N,{e})))'
    for c in 'BCDEFGHI':
        db[f'{c}{r}'].font = font(); db[f'{c}{r}'].border = bottom; db[f'{c}{r}'].alignment = Alignment(vertical='center', horizontal='left' if c in 'BCDE' else 'center')
    db[f'B{r}'].font = font(10, True, PINE, u='single')
    db[f'F{r}'].font = font(12, True)
    db[f'H{r}'].number_format = '0%'; db[f'I{r}'].number_format = LASTS
    db.row_dimensions[r].height = 19
LV1 = 10 + LIVE_ROWS
status_cf(db, f'G11:G{LV1}')
db.conditional_formatting.add(f'F11:F{LV1}', FormulaRule(formula=['AND(ISNUMBER(F11),F11<=RedLimit)'], font=Font(name=F, size=12, bold=True, color=RED)))
db.conditional_formatting.add(f'F11:F{LV1}', FormulaRule(formula=['AND(ISNUMBER(F11),F11>RedLimit,F11<=YellowLimit)'], font=Font(name=F, size=12, bold=True, color=YEL_TX)))
db.conditional_formatting.add(f'F11:F{LV1}', FormulaRule(formula=['AND(ISNUMBER(F11),F11>YellowLimit)'], font=Font(name=F, size=12, bold=True, color=GRN)))
db.conditional_formatting.add(f'H11:H{LV1}', DataBarRule(start_type='num', start_value=0, end_type='num', end_value=1, color='7FB5A8', showValue=True))
db[f'B{LV1+1}'] = f'=IF(COUNTIF(Shop!$P${S0}:$P${S1},"Live shop")>{LIVE_ROWS},"+ "&(COUNTIF(Shop!$P${S0}:$P${S1},"Live shop")-{LIVE_ROWS})&" more live SKUs on the Shop sheet","")'
db[f'B{LV1+1}'].font = font(9, False, MUTED, italic=True)

# Right column K..Q : SKU finder (rows 9-18), checks (20-25)
db.merge_cells('K9:Q9'); db['K9'] = 'SKU FINDER  ·  pick an SKU in the yellow cell'; db['K9'].font = font(10, True, PINE)
for c in 'KLMNOPQ': db[f'{c}9'].border = Border(bottom=Side(style='medium', color=PINE))
db['K11'] = 'SKU'; db['K11'].font = font(9, True, MUTED)
db.merge_cells('L11:M11'); db['L11'] = 'LB120099'; db['L11'].fill = fill('FFFF00'); db['L11'].font = font(12, True, '0000FF'); db['L11'].alignment = CENTER; db['L11'].border = box
dv = DataValidation(type='list', formula1=f'=Calc!$A$2:$A${1+len(skus)}', allow_blank=False, showDropDown=False)
dv.error = 'Pick an SKU from the list.'; dv.errorTitle = 'Unknown SKU'
db.add_data_validation(dv); dv.add('L11')
fr = f'MATCH($L$11,Calc!$A$2:$A${1+len(skus)},0)+{S0-1}'
db.merge_cells('N11:Q11'); db['N11'] = f'=IFERROR(INDEX(Shop!$D:$D,{fr})&" · "&INDEX(Shop!$C:$C,{fr})&" · "&INDEX(Shop!$E:$E,{fr}),"Not in the catalog")'; db['N11'].font = font(10, True)
fields = [('PO qty', 'F', '#,##0'), ('Inspected', 'G', '#,##0'), ('Sold', 'H', '#,##0'), ('In stock', 'I', '#,##0'),
          ('Status', 'J', None), ('Sold %', 'K', '0%'), ('Last sale', 'L', 'dd-mmm-yy'), ('Last 7 order days', 'M', '#,##0'),
          ('Stock lasts (days)', 'N', LASTS), ('Selling from', 'O', None)]
for i, (lab, col, fmt) in enumerate(fields):
    r = 12 + (i // 2); c_lab = 'K' if i % 2 == 0 else 'O'; c_val = 'M' if i % 2 == 0 else 'Q'
    if c_lab == 'K': db.merge_cells(f'K{r}:L{r}')
    else: db.merge_cells(f'O{r}:P{r}')
    db[f'{c_lab}{r}'] = lab; db[f'{c_lab}{r}'].font = font(9, False, MUTED)
    db[f'{c_val}{r}'] = f'=IFERROR(INDEX(Shop!${col}:${col},{fr}),"")'; db[f'{c_val}{r}'].font = font(10, True)
    db[f'{c_val}{r}'].alignment = Alignment(horizontal='right')
    if fmt: db[f'{c_val}{r}'].number_format = fmt
    for c in ('K', 'L', 'M', 'N', 'O', 'P', 'Q'): db[f'{c}{r}'].border = bottom
db['M12'].alignment = Alignment(horizontal='right')
status_cf(db, 'Q13')
db.merge_cells('K17:Q17'); db['K17'] = f'=IFERROR(HYPERLINK("#Shop!B"&{fr},"Open this SKU on the Shop sheet  ›"),"")'; db['K17'].font = font(9.5, True, PINE, u='single')

db.merge_cells('K19:Q19'); db['K19'] = 'CHECKS  ·  all should be 0'; db['K19'].font = font(10, True, PINE)
for c in 'KLMNOPQ': db[f'{c}19'].border = Border(bottom=Side(style='medium', color=PINE))
checks = [('Inspection lines needing an SKU', f'=COUNTIF({IK},"CHECK")', 'Add Inspection'),
          ('SKUs below 0 stock', f'=COUNTIF(Shop!$I${S0}:$I${S1},"<0")', 'Shop'),
          ('Order lines with an unknown SKU', f'=COUNTIF({OST},"SKU not in Catalog")', 'Add Orders')]
for i, (lab, f, link) in enumerate(checks):
    r = 20 + i
    db.merge_cells(f'K{r}:P{r}')
    db[f'K{r}'] = f'=HYPERLINK("#\'{link}\'!A1","{lab}")'; db[f'K{r}'].font = font(10, False, INK)
    db[f'Q{r}'] = f; db[f'Q{r}'].font = font(10, True); db[f'Q{r}'].alignment = CENTER
    for c in 'KLMNOPQ': db[f'{c}{r}'].border = bottom
db.conditional_formatting.add('Q20:Q22', CellIsRule(operator='greaterThan', formula=['0'], fill=fill(RED_BG), font=Font(name=F, bold=True, color=RED_TX)))
db.conditional_formatting.add('Q20:Q22', CellIsRule(operator='equal', formula=['0'], fill=fill(GRN_BG), font=Font(name=F, bold=True, color=GRN_TX)))
db.merge_cells('K23:P23'); db['K23'] = 'Duplicate order lines skipped (normal)'; db['K23'].font = font(10, False, MUTED)
db['Q23'] = f'=COUNTIF({OST},"Duplicate, skipped")'; db['Q23'].font = font(10, True, MUTED); db['Q23'].alignment = CENTER

# status legend row 24
db['K24'] = 'Live SKUs:'; db['K24'].font = font(9, True, MUTED)
for (c, lbl, bg, tx, row) in [('L', 'Red', RED_BG, RED_TX, 2), ('N', 'Yellow', YEL_BG, YEL_TX, 3), ('P', 'Green', GRN_BG, GRN_TX, 4)]:
    db[f'{c}24'] = f'="{lbl} "&Calc!N{row}'; db[f'{c}24'].fill = fill(bg); db[f'{c}24'].font = font(9.5, True, tx); db[f'{c}24'].alignment = CENTER
    db.merge_cells(f'{c}24:{chr(ord(c)+1)}24')

# charts row 27+
db.merge_cells('B27:I27'); db['B27'] = 'SALES TREND  ·  pcs per day, last 30 days'; db['B27'].font = font(10, True, PINE)
db.merge_cells('K27:Q27'); db['K27'] = 'SALES BY COLOUR  ·  pcs since 9 Sep'; db['K27'].font = font(10, True, PINE)
for c in 'BCDEFGHIKLMNOPQ': db[f'{c}27'].border = Border(bottom=Side(style='medium', color=PINE))
ch = BarChart(); ch.type = 'col'; ch.style = 2; ch.title = None
ch.add_data(Reference(cc, min_col=8, min_row=1, max_row=31), titles_from_data=True)
ch.set_categories(Reference(cc, min_col=7, min_row=2, max_row=31))
ch.legend = None; ch.height = 7.2; ch.width = 19.5; ch.gapWidth = 40
ch.y_axis.majorGridlines = None; ch.y_axis.delete = False; ch.x_axis.delete = False
ch.series[0].graphicalProperties.solidFill = PINE; ch.series[0].graphicalProperties.line.solidFill = PINE
db.add_chart(ch, 'B28')
ch2 = BarChart(); ch2.type = 'bar'; ch2.style = 2
ch2.add_data(Reference(cc, min_col=11, min_row=1, max_row=8), titles_from_data=True)
ch2.set_categories(Reference(cc, min_col=10, min_row=2, max_row=8))
ch2.legend = None; ch2.height = 7.2; ch2.width = 16; ch2.gapWidth = 50
ch2.y_axis.majorGridlines = None; ch2.x_axis.scaling.orientation = 'maxMin'; ch2.y_axis.delete = False; ch2.x_axis.delete = False
ch2.series[0].graphicalProperties.solidFill = PINE2; ch2.series[0].graphicalProperties.line.solidFill = PINE2
ch2.dataLabels = DataLabelList(); ch2.dataLabels.showVal = True; ch2.dataLabels.showSerName = False; ch2.dataLabels.showCatName = False; ch2.dataLabels.showLegendKey = False
db.add_chart(ch2, 'K28')

# how-to strip row 44+
r0 = 44
db.merge_cells(f'B{r0}:Q{r0}'); db[f'B{r0}'] = 'HOW TO UPDATE'; db[f'B{r0}'].font = font(10, True, PINE)
for c in 'BCDEFGHIJKLMNOPQ': db[f'{c}{r0}'].border = Border(bottom=Side(style='medium', color=PINE))
steps = [
    ('B', 'I', 'Every day after 11:30', ['1. Export Pending Dispatch from the portal.', '2. Copy the data rows (no header).', '3. Paste in Add Orders, first empty row, column A.', '4. Done. Old AWBs are skipped automatically.'], 'Add Orders', 'Go to Add orders  ›'),
    ('K', 'Q', 'When an inspection form arrives', ['1. Open Add Inspection, first empty row.', '2. One row per form line: date, file, PO, colour, size, form SKU, qty.', '3. If Matched SKU says CHECK, type the SKU in Override SKU.', '4. Keep inspections in date order (FIFO by PO).'], 'Add Inspection', 'Go to Add inspection  ›'),
]
for c1, c2, head, lines, link, ltxt in steps:
    db.merge_cells(f'{c1}{r0+1}:{c2}{r0+1}'); db[f'{c1}{r0+1}'] = head; db[f'{c1}{r0+1}'].font = font(10, True)
    for i, t in enumerate(lines):
        db.merge_cells(f'{c1}{r0+2+i}:{c2}{r0+2+i}'); db[f'{c1}{r0+2+i}'] = t; db[f'{c1}{r0+2+i}'].font = font(9.5, False, '47544D')
    rr = r0 + 2 + len(lines)
    db.merge_cells(f'{c1}{rr}:{c2}{rr}'); db[f'{c1}{rr}'] = f'=HYPERLINK("#\'{link}\'!A1","{ltxt}")'; db[f'{c1}{rr}'].font = font(10, True, PINE, u='single')
db.merge_cells(f'B{r0+8}:Q{r0+8}')
db[f'B{r0+8}'] = 'Rules: stock = inspected − sold per SKU · sales come out of the oldest inspected PO first · no orders on Sundays or government holidays · new PO? right-click any tab › Unhide › Catalog and add its lines at the bottom. History: inspections 2 Sep, 25 Sep, 9 Oct 2026; orders 9 Sep – 17 Oct 2026.'
db[f'B{r0+8}'].font = font(8.5, False, MUTED); db[f'B{r0+8}'].alignment = Alignment(wrap_text=True, vertical='top')
db.row_dimensions[r0 + 8].height = 26
db.merge_cells(f'B{r0+9}:Q{r0+9}')
db[f'B{r0+9}'] = 'Data note: the 9 Oct form lists PO 68504 Undyed King as LB121644; that SKU is not on PO 68504, so it is counted as LB121612.'
db[f'B{r0+9}'].font = font(8.5, False, MUTED)

# finish
for ws in (cat, dy, cc): ws.sheet_state = 'hidden'

# ======================= Fabric Reco =======================
# live lots come from fabric.json (snapshot of the website's Fabric Reco page, taken in the daily run); history from state.json
navbar(fx, 'Fabric Reco')
FJ = None
try: FJ = json.load(open(B + 'fabric.json'))
except Exception: FJ = None
KPM = (FJ or {}).get('kgPerMtr', 0.66)
title_band(fx, 2, 'Fabric reco', ('Snapshot of the website Fabric Reco page, ' + FJ['asof'][:10] + '. ' if FJ else 'No live snapshot yet. ') +
           f'Used kg = cut qty x cut size x 0.0254 m x {KPM} kg/m (Cutting entries only). Diff = Inward - Used; Bal OK/REJ kg count as used once entered. Live page: sunilahamed.github.io/quince-matrix/fabric.html', 2, 17)
FH = ['Design', 'Shade', 'Size', 'Cut qty', 'Cut size (inch)', 'Average (mtr/pc)', 'Used mtr', 'Used kg', 'Bal OK kg', 'Bal REJ kg', 'Fabric sent kg', 'Total used kg', 'Inward kg', 'Diff kg', 'Diff mtr', 'Lot']
header(fx, 5, FH, 2)
NAVY = '1F3864'
for i in range(len(FH)): fx.cell(row=5, column=2 + i).fill = fill(NAVY)
r = 6
STL = {'running': 'Running', 'hold': 'On hold', 'done': 'Done'}
lots = (FJ or {}).get('lots', [])
if not lots:
    fx.cell(row=r, column=2, value='No fabric inward entered yet on the website.').font = font(10, False, MUTED); r += 1
first_rows = []
for L in lots:
    rows = L['rows'] or [{'product': '', 'shade': L['shade'], 'size': '', 'qty': 0, 'cutIn': None, 'avg': None, 'mtr': 0, 'kg': 0}]
    a = r
    for R in rows:
        vals = [R['product'], R['shade'].upper(), (R['size'] or '').upper(), R['qty'], R['cutIn'], R['avg']]
        for j, v in enumerate(vals): fx.cell(row=r, column=2 + j, value=v)
        fx.cell(row=r, column=8, value=f'=E{r}*G{r}' if R['avg'] is not None else 0)
        fx.cell(row=r, column=9, value=f'=H{r}*{KPM}')
        r += 1
    b = r - 1
    lotv = [(10, L['balOk']), (11, L['balRej']), (12, L['sent'] or None), (13, f'=SUM(I{a}:I{b})+N(J{a})+N(K{a})'), (14, L['kg']),
            (15, f'=N{a}-M{a}'), (16, f'=O{a}/{KPM}'), (17, f"{STL.get(L['status'], L['status'])} · inward {L['date']}" + (f" · {L['note']}" if L.get('note') else ''))]
    for col, v in lotv:
        if b > a: fx.merge_cells(start_row=a, start_column=col, end_row=b, end_column=col)
        c = fx.cell(row=a, column=col, value=v); c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True); c.font = font(10, True)
    for col in (10, 11): fx.cell(row=a, column=col).fill = fill(YEL_BG)
    for rr in range(a, b + 1):
        for col in range(2, 18):
            fx.cell(row=rr, column=col).border = Border(left=thin, right=thin, bottom=thin, top=Side(style='medium', color=NAVY) if rr == a else thin)
    first_rows.append(a)
if lots:
    fx.cell(row=r, column=2, value='TOTAL')
    last = r - 1
    for col in 'EHI': fx[f'{col}{r}'] = f'=SUM({col}6:{col}{last})'
    for col in 'JKLMNOP': fx[f'{col}{r}'] = f'=SUM({col}6:{col}{last})'
    for col in range(2, 18):
        c = fx.cell(row=r, column=col); c.font = font(10, True); c.fill = fill('DDEBF7'); c.border = box
    r += 1
for row in range(6, r):
    fx.cell(row=row, column=7).number_format = '0.0000'
    for col in range(8, 17): fx.cell(row=row, column=col).number_format = '#,##0.00;[Red]-#,##0.00'
fx.conditional_formatting.add(f'O6:P{max(r, 7)}', CellIsRule(operator='lessThan', formula=['0'], font=Font(name=F, bold=True, color=RED)))
un = (FJ or {}).get('unlinked', [])
if un:
    r += 1
    fx.cell(row=r, column=2, value='Cutting with no running inward for that shade (not in any lot)').font = font(10, True, RED); r += 1
    for R in un:
        for j, v in enumerate([R['product'], R['shade'].upper(), R['size'].upper(), R['qty']]): fx.cell(row=r, column=2 + j, value=v)
        fx.cell(row=r, column=9, value=R['kg']).number_format = '#,##0.00'; r += 1

# history (owner's sheet, before live fabric reco)
H = st.get('fabric_history')
if H:
    r += 2
    fx.merge_cells(start_row=r, start_column=2, end_row=r, end_column=17)
    fx.cell(row=r, column=2, value='HISTORY · ' + H['title'].upper()).font = font(12, True, NAVY); r += 1
    fx.merge_cells(start_row=r, start_column=2, end_row=r, end_column=17)
    fx.cell(row=r, column=2, value=H['note']).font = font(9, False, MUTED); r += 1
    HH = ['Colour', 'Size', 'Inspected qty', 'OK qty', 'Cut size (inch)', 'Average (mtr/pc)', 'Bal REJ mtr', 'Used mtr', 'Bal OK kg', 'Bal REJ kg', 'Fabric sent kg', 'Used kg', 'Inward kg', 'Inward mtr', 'Diff kg', 'Diff mtr']
    header(fx, r, HH, 2)
    for i in range(len(HH)): fx.cell(row=r, column=2 + i).fill = fill(NAVY)
    r += 1; h0 = r
    for L in H['lots']:
        rs = [x for x in H['rows'] if x['colour'] == L['colour']]; a = r
        for x in rs:
            for j, v in enumerate([x['colour'].upper(), x['size'].upper(), x['insp'], x['ok'] or None, x['cutIn'], round(x['cutIn'] * 0.0254, 4)]):
                fx.cell(row=r, column=2 + j, value=v)
            r += 1
        for k, key in enumerate(['balRejMtr', 'usedMtr', 'balOkKg', 'balRejKg', 'sentKg', 'usedKg', 'inKg', 'inMtr', 'diffKg', 'diffMtr']):
            col = 8 + k
            if r - 1 > a: fx.merge_cells(start_row=a, start_column=col, end_row=r - 1, end_column=col)
            c = fx.cell(row=a, column=col, value=L[key]); c.alignment = CENTER; c.number_format = '#,##0.00;[Red]-#,##0.00'
        for rr in range(a, r):
            for col in range(2, 18): fx.cell(row=rr, column=col).border = box
    fx.cell(row=r, column=2, value='TOTAL')
    for col in 'DEIL': pass
    for col in ['D', 'E', 'I', 'L', 'M', 'N', 'O', 'P', 'Q']: fx[f'{col}{r}'] = f'=SUM({col}{h0}:{col}{r - 1})'
    for col in range(2, 18):
        c = fx.cell(row=r, column=col); c.font = font(10, True); c.fill = fill('DDEBF7'); c.border = box
        if col >= 8: c.number_format = '#,##0;[Red]-#,##0'
    for rr in range(h0, r): fx.cell(row=rr, column=7).number_format = '0.0000'
widths(fx, {'A': 2, 'B': 20, 'C': 12, 'D': 13, 'E': 9, 'F': 10, 'G': 11, 'H': 11, 'I': 11, 'J': 10, 'K': 10, 'L': 11, 'M': 12, 'N': 11, 'O': 11, 'P': 11, 'Q': 26})
fx.freeze_panes = 'B6'

tabc = {'Dashboard': INK, 'Shop': PINE, 'PO Ledger': PINE, 'B2B Dispatch': PINE, 'Fabric Reco': '1F3864', 'Add Inspection': YEL, 'Add Orders': YEL}
for ws in wb.worksheets: ws.sheet_properties.tabColor = tabc.get(ws.title, 'B5C1BB')
for ws in (sh, po, bb, ins, od):
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 90
db.freeze_panes = 'A4'
wb.active = 0
wb.save(OUT)
print('saved', OUT)
