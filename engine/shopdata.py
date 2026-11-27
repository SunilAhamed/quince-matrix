# Quince Matrix: stock data for the shop preview page (site/shop.json).
# Per design + shade + size: inspected (shop only), sold, stock, sales in the last 7 order days.
# No customer details, order numbers or AWBs.
import json, os, sys, collections

B = os.path.dirname(os.path.abspath(__file__)) + '/'
st = json.load(open(sys.argv[1] if len(sys.argv) > 1 else B + 'state.json'))
out = sys.argv[2] if len(sys.argv) > 2 else B + 'site/shop.json'

DESIGNS = ['Waffle Bed Blanket', 'Waffle Throw']           # duvets and shams later
SIZES = ['TWIN', 'FULL/QUEEN', 'KING/CAL KING', 'THROW']
SHADES = ['Dove', 'White', 'Espresso', 'Mist', 'Undyed', 'Mineral', 'Dried Sage']
red = st['settings'].get('red', 20); yellow = st['settings'].get('yellow', 100)
b2b = set((st.get('b2b') or {}).get('pos', []))

insp = collections.Counter(); sold = collections.Counter(); s7 = collections.Counter(); last = collections.Counter()
for l in st['insp']:
    if l['po'] not in b2b: insp[l['s']] += l['q']
days = sorted({s[0] for s in st['sales']})
d7 = set(days[-7:]); dl = days[-1] if days else ''
for s in st['sales']:
    sold[s[2]] += s[3]
    if s[0] in d7: s7[s[2]] += s[3]
    if s[0] == dl: last[s[2]] += s[3]

def status(n):
    return 'empty' if n <= 0 else 'red' if n <= red else 'yellow' if n <= yellow else 'green'

items = {}
for c in st['catalog']:
    if c['product'] not in DESIGNS or not c.get('pos'): continue
    k = (c['product'], c['colour'])
    it = items.setdefault(k, {'design': c['product'], 'shade': c['colour'], 'sizes': []})
    stock = max(insp[c['sku']] - sold[c['sku']], 0)
    pace = s7[c['sku']] / max(len(d7), 1)
    it['sizes'].append({'sku': c['sku'], 'cls': c['cls'], 'size': c['size'], 'po_qty': sum(p['qty'] for p in c['pos']),
                        'inspected': insp[c['sku']], 'sold': sold[c['sku']], 'stock': stock, 'status': status(stock),
                        'sold7': s7[c['sku']], 'sold_last': last[c['sku']],
                        'days_left': round(stock / pace, 1) if pace > 0 and stock > 0 else None})
res = []
for (d, sh), it in items.items():
    it['sizes'].sort(key=lambda z: SIZES.index(z['cls']) if z['cls'] in SIZES else 9)
    it['stock'] = sum(z['stock'] for z in it['sizes']); it['sold7'] = sum(z['sold7'] for z in it['sizes'])
    res.append(it)
res.sort(key=lambda it: (DESIGNS.index(it['design']), SHADES.index(it['shade']) if it['shade'] in SHADES else 9))
json.dump({'updated': st['updated'], 'last_day': dl, 'last_day_pcs': sum(last.values()), 'last_day_orders': len({s[1] for s in st['sales'] if s[0] == dl}),
           'days7': sorted(d7), 'red': red, 'yellow': yellow, 'items': res}, open(out, 'w'), separators=(',', ':'))
print('shop.json', len(res), 'cards')
