import json, sys
import os as _os
B = _os.path.dirname(_os.path.abspath(__file__)) + '/'
state = json.load(open(sys.argv[1] if len(sys.argv) > 1 else B + 'state.json'))
T = {
 "head": '<title>Quince Matrix</title><meta name="claude:viewport-fit-sides" content="cover">'
         '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">',
 "body": '<header class="top"><div class="wrap"><div class="brand"><div class="mark" aria-hidden="true">Q</div><div><h1>Quince Matrix</h1><p id="asof">Loading…</p></div></div><div class="actions" id="actions"></div></div></header>'
         '<main class="wrap"><section class="kpis" id="kpis" aria-label="Shop totals"></section>'
         '<div class="bar"><div class="tabs" role="tablist" aria-label="Views">'
         '<button class="tab" role="tab" data-tab="shop" type="button">Shop</button>'
         '<button class="tab" role="tab" data-tab="po" type="button">PO ledger</button>'
         '<button class="tab" role="tab" data-tab="analytics" type="button">Analytics</button>'
         '<button class="tab" role="tab" data-tab="activity" type="button">Activity</button></div>'
         '<div class="rules" id="rules"></div></div>'
         '<div id="view"></div>'
         '<footer class="foot">Stock = inspected qty − pieces sold, per SKU. Sales are taken from the oldest inspected PO first. Customer names and addresses are not stored on this page.</footer></main>',
 "lib": '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>',
}
css = open(B + 'app.css').read()
tj = json.dumps(T).replace('</', '<\\/')
js = open(B + 'app.js').read().replace('/*@@T@@*/', 'var T = ' + tj + ';')
sj = json.dumps(state, separators=(',', ':')).replace('<', '\\u003c')
page = (T['head'] + '<style id="qm-css">' + css + '</style>' + T['body'] +
        '<script type="application/json" id="qm-state">' + sj + '</script>' + T['lib'] +
        '<script id="qm-js">' + js + '</script>')
out = sys.argv[2] if len(sys.argv) > 2 else B + 'quince-matrix.html'
open(out, 'w').write(page)
print(out, len(page))
