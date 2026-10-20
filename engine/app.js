(function(){
"use strict";
/*@@T@@*/
var STATE = JSON.parse(document.getElementById("qm-state").textContent);
var SWATCH = {"Espresso":"#4A3328","Mist":"#A7B6C1","Dove":"#BAB4AC","Undyed":"#E4DAC5","Dried Sage":"#9AA785","Mineral":"#788A91","White":"#F7F7F3"};
var PRODUCT_ORDER = ["Waffle Throw","Waffle Bed Blanket","Duvet Cover","Duvet Cover Set","Sham Set"];
var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var ui = { tab: "shop", product: "All", status: "All", q: "", poAll: false };
var CAN_EDIT = false, ARTIFACT = null, DOWNLOADS = null;
var $ = function(s, r){ return (r||document).querySelector(s); };
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function fmt(n){ return Number(n||0).toLocaleString("en-IN"); }
function dshort(d){ if(!d) return "–"; var p=d.split("-"); return (+p[2])+" "+MON[+p[1]-1]; }
function dlong(d){ return d ? dshort(d)+" "+d.slice(0,4) : "–"; }
function todayISO(){ var t=new Date(); t.setMinutes(t.getMinutes()-t.getTimezoneOffset()); return t.toISOString().slice(0,10); }
function sw(c){ return '<span class="sw" style="background:'+(SWATCH[c]||"#999")+'" aria-hidden="true"></span>'; }
function status(bal){ var s=STATE.settings; if(bal<=0) return "empty"; if(bal<=s.red) return "red"; if(bal<=s.yellow) return "yellow"; return "green"; }
function statusLabel(st){ return {red:"Red · Low", yellow:"Yellow · Medium", green:"Green · Healthy", empty:"Empty"}[st]; }

/* ---------- engine ---------- */
function normSize(s){
  s = String(s||"").toUpperCase().replace(/\//g," ").replace(/\s+/g," ").trim();
  if((s.indexOf("50")>-1 && s.indexOf("70")>-1) || s.indexOf("THROW")>-1) return "THROW";
  if(s.indexOf("TWIN")>-1) return "TWIN";
  if(s.indexOf("QUEEN")>-1 || s.indexOf("FULL")>-1) return "FULL/QUEEN";
  if(s.indexOf("KING")>-1) return "KING/CAL KING";
  return s;
}
function titleCase(s){ return String(s||"").trim().toLowerCase().replace(/\b\w/g,function(c){return c.toUpperCase();}); }
function compute(st){
  var cat = {}; st.catalog.forEach(function(c){ cat[c.sku] = {sku:c.sku, product:c.product, colour:c.colour, size:c.size, cls:c.cls, pos:c.pos, insp:0, sold:0, over:0, lots:[], lastSale:null, firstSale:null, recent:0}; });
  var lots = st.insp.map(function(l,i){ return {d:l.d,f:l.f,po:l.po,s:l.s,q:l.q,n:l.n,i:i,left:l.q,sold:0}; })
    .sort(function(a,b){ return a.d<b.d?-1:a.d>b.d?1:a.i-b.i; });
  lots.forEach(function(l){ var c=cat[l.s]; if(!c) return; c.insp+=l.q; c.lots.push(l); });
  var sales = st.sales.map(function(s,i){ return {d:s[0],o:s[1],s:s[2],q:s[3],a:s[4],c:s[5],i:i}; })
    .sort(function(a,b){ return a.d<b.d?-1:a.d>b.d?1:a.i-b.i; });
  var days = {}, lastDay = null;
  sales.forEach(function(x){ days[x.d]=(days[x.d]||0)+x.q; if(!lastDay||x.d>lastDay) lastDay=x.d; });
  var dayList = Object.keys(days).sort();
  var recentDays = dayList.slice(-7);
  sales.forEach(function(x){
    var c=cat[x.s]; if(!c) return;
    c.sold+=x.q; if(!c.firstSale||x.d<c.firstSale) c.firstSale=x.d; if(!c.lastSale||x.d>c.lastSale) c.lastSale=x.d;
    if(recentDays.indexOf(x.d)>-1) c.recent+=x.q;
    var rem=x.q;
    for(var k=0;k<c.lots.length && rem>0;k++){ var l=c.lots[k]; var take=Math.min(l.left,rem); l.left-=take; l.sold+=take; rem-=take; }
    c.over+=rem;
  });
  var skus = Object.keys(cat).map(function(k){ var c=cat[k]; c.bal=c.insp-c.sold; c.st=status(c.bal); c.poQty=c.pos.reduce(function(a,p){return a+p.qty;},0); c.cover = c.recent>0 ? c.bal/(c.recent/recentDays.length) : null; return c; });
  return {cat:cat, skus:skus, lots:lots, sales:sales, days:days, dayList:dayList, lastDay:lastDay, recentDays:recentDays};
}

/* ---------- rendering ---------- */
var M;
function render(){
  M = compute(STATE);
  renderHeader(); renderKpis(); renderRules(); renderTabs();
  var v = $("#view");
  v.innerHTML = ui.tab==="shop" ? viewShop() : ui.tab==="po" ? viewPO() : ui.tab==="analytics" ? viewAnalytics() : viewActivity();
  bindView();
}
function renderHeader(){
  $("#asof").textContent = "JDA Texworld · Vendor JTPL004 · Last order day " + dlong(M.lastDay) + " · Updated " + new Date(STATE.updated).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
  var a = $("#actions");
  var h = '';
  if(CAN_EDIT){
    h += '<button class="btn primary" data-open="insp" type="button">'+ico("plus")+'Add inspection</button>';
    h += '<button class="btn primary" data-open="orders" type="button">'+ico("box")+'Add daily orders</button>';
    h += '<button class="btn" data-open="rules" type="button">'+ico("sliders")+'Colour rules</button>';
  } else {
    h += '<span class="viewonly">View only</span>';
  }
  if(DOWNLOADS) h += '<button class="btn" id="dl" type="button">'+ico("down")+'Download summary</button>';
  a.innerHTML = h;
}
function ico(n){
  var p = {plus:'<path d="M12 5v14M5 12h14"/>', box:'<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/>', sliders:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>', down:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', x:'<path d="M6 6l12 12M18 6L6 18"/>'}[n];
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
}
function renderKpis(){
  var insp=0, sold=0, bal=0, live=0, empty=0;
  M.skus.forEach(function(c){ insp+=c.insp; sold+=c.sold; if(c.bal>0){ bal+=c.bal; live++; } else empty++; });
  var nInsp = {}; STATE.insp.forEach(function(l){ nInsp[l.d]=1; });
  var lastPcs = M.days[M.lastDay]||0;
  var lastOrders = {}; M.sales.forEach(function(x){ if(x.d===M.lastDay) lastOrders[x.o]=1; });
  var orders = {}; M.sales.forEach(function(x){ orders[x.o]=1; });
  var k = [
    ["Inspected", fmt(insp), "pcs across "+Object.keys(nInsp).length+" inspections"],
    ["Sold", fmt(sold), "pcs · "+fmt(Object.keys(orders).length)+" orders · "+M.dayList.length+" days"],
    ["In stock", fmt(bal), "pcs · "+Math.round(sold/Math.max(insp,1)*100)+"% sold through"],
    ["Last order day", fmt(lastPcs), "pcs on "+dlong(M.lastDay)+" · "+Object.keys(lastOrders).length+" orders"],
    ["Live SKUs", fmt(live), "with stock on the portal"],
    ["Empty bucket", fmt(empty), "sold out or awaiting inspection"]
  ];
  $("#kpis").innerHTML = k.map(function(x){ return '<div class="kpi"><div class="l">'+x[0]+'</div><div class="v">'+x[1]+'</div><div class="s">'+esc(x[2])+'</div></div>'; }).join("");
}
function renderRules(){
  var s=STATE.settings;
  $("#rules").innerHTML = '<span>Colour rules</span><span class="tag red">≤ '+s.red+' pcs</span><span class="tag yellow">'+(s.red+1)+'–'+s.yellow+' pcs</span><span class="tag green">&gt; '+s.yellow+' pcs</span>';
}
function renderTabs(){
  document.querySelectorAll(".tab").forEach(function(t){ t.setAttribute("aria-selected", t.dataset.tab===ui.tab ? "true":"false"); });
}
function card(c){
  var pct = c.insp ? Math.round(c.sold/c.insp*100) : 0;
  var cur = null; for(var i=0;i<c.lots.length;i++){ if(c.lots[i].left>0){ cur=c.lots[i]; break; } }
  var poLeft = {}; c.lots.forEach(function(l){ if(l.left>0) poLeft[l.po]=(poLeft[l.po]||0)+l.left; });
  var lotTxt = Object.keys(poLeft).map(function(p){ return 'PO '+p+': <b>'+poLeft[p]+'</b>'; }).join(" · ");
  var cover = c.cover!=null ? (c.cover<1 ? "under 1 day" : "~"+Math.round(c.cover)+" order days") : "no recent sales";
  return '<article class="card" aria-label="'+esc(c.sku+" "+c.colour+" "+c.size)+'">'+
    '<div class="row"><span class="chip">'+c.sku+'</span><span class="tag '+c.st+'">'+statusLabel(c.st)+'</span></div>'+
    '<div class="name">'+sw(c.colour)+'<div><b>'+esc(c.colour)+'</b><span>'+esc(c.product)+' · '+esc(c.size)+'</span></div></div>'+
    '<div class="big '+c.st+'">'+fmt(c.bal)+'<small>pcs in stock</small></div>'+
    '<div class="meter '+c.st+'" title="'+pct+'% sold"><i style="width:'+(100-pct)+'%"></i></div>'+
    '<div class="facts"><div>Inspected<b>'+fmt(c.insp)+'</b></div><div>Sold<b>'+fmt(c.sold)+'</b></div><div>Sold %<b>'+pct+'%</b></div></div>'+
    '<div class="lot">Selling from (FIFO): '+(lotTxt||'–')+'<br>Last sale '+dshort(c.lastSale)+' · Stock lasts '+cover+'</div>'+
  '</article>';
}
function viewShop(){
  var live = M.skus.filter(function(c){ return c.bal>0; });
  var products = PRODUCT_ORDER.filter(function(p){ return live.some(function(c){ return c.product===p; }); });
  var q = ui.q.trim().toLowerCase();
  var shown = live.filter(function(c){
    return (ui.product==="All"||c.product===ui.product) && (ui.status==="All"||c.st===ui.status) &&
      (!q || (c.sku+" "+c.colour+" "+c.size+" "+c.product).toLowerCase().indexOf(q)>-1);
  });
  var h = '<div class="filters" role="toolbar" aria-label="Shop filters">'+
    '<div class="seg" data-f="product">'+["All"].concat(products).map(function(p){ return '<button type="button" aria-pressed="'+(ui.product===p)+'" data-v="'+esc(p)+'">'+esc(p)+'</button>'; }).join("")+'</div>'+
    '<div class="seg" data-f="status">'+[["All","All colours"],["red","Red"],["yellow","Yellow"],["green","Green"]].map(function(s){ return '<button type="button" aria-pressed="'+(ui.status===s[0])+'" data-v="'+s[0]+'">'+s[1]+'</button>'; }).join("")+'</div>'+
    '<input id="q" class="search" type="search" placeholder="Search SKU, colour or size" value="'+esc(ui.q)+'" aria-label="Search SKUs">'+
  '</div>';
  var groups = PRODUCT_ORDER.filter(function(p){ return shown.some(function(c){ return c.product===p; }); });
  if(!groups.length) h += '<div class="note">No live SKUs match these filters.</div>';
  groups.forEach(function(p){
    var g = shown.filter(function(c){ return c.product===p; }).sort(function(a,b){ return a.bal-b.bal; });
    var pcs = g.reduce(function(a,c){ return a+c.bal; },0);
    h += '<section class="sec"><div class="sec-h"><h2>'+esc(p)+'</h2><span class="c">'+g.length+' SKUs · '+fmt(pcs)+' pcs in stock</span></div><div class="grid">'+g.map(card).join("")+'</div></section>';
  });
  var soldOut = M.skus.filter(function(c){ return c.bal<=0 && c.insp>0; }).sort(function(a,b){ return a.product===b.product ? a.sku<b.sku?-1:1 : PRODUCT_ORDER.indexOf(a.product)-PRODUCT_ORDER.indexOf(b.product); });
  var waiting = M.skus.filter(function(c){ return c.insp===0; }).sort(function(a,b){ return a.product===b.product ? a.sku<b.sku?-1:1 : PRODUCT_ORDER.indexOf(a.product)-PRODUCT_ORDER.indexOf(b.product); });
  h += '<section class="sec"><div class="sec-h"><h2>Empty bucket</h2><span class="c">'+(soldOut.length+waiting.length)+' SKUs · these open in the shop as soon as a new inspection adds stock</span></div>';
  h += '<div class="bucket"><h3><span class="tag empty">Sold out</span>'+soldOut.length+' SKUs · inspected stock fully sold</h3><div class="pills">'+
    (soldOut.length ? soldOut.map(function(c){ return '<span class="ep">'+sw(c.colour)+'<span class="chip">'+c.sku+'</span>'+esc(c.colour)+' <em>'+esc(c.product.replace("Waffle ",""))+' · '+esc(c.size)+' · sold '+fmt(c.sold)+(c.over? ' · <b style="color:var(--red)">over by '+c.over+'</b>':'')+'</em></span>'; }).join("") : '<span class="c">None</span>')+'</div></div>';
  h += '<div class="bucket"><h3><span class="tag empty">Awaiting inspection</span>'+waiting.length+' SKUs · on PO, not inspected yet</h3><div class="pills">'+
    waiting.map(function(c){ return '<span class="ep">'+sw(c.colour)+'<span class="chip">'+c.sku+'</span>'+esc(c.colour)+' <em>'+esc(c.product.replace("Waffle ",""))+' · '+esc(c.size)+' · PO qty '+fmt(c.poQty)+'</em></span>'; }).join("")+'</div></div></section>';
  return h;
}
function viewPO(){
  var rows = {};
  M.skus.forEach(function(c){ c.pos.forEach(function(p){ var k=p.po+"|"+c.sku; rows[k]={po:p.po, c:c, qty:p.qty, rev:p.rev, insp:0, sold:0, left:0}; }); });
  M.lots.forEach(function(l){ var k=l.po+"|"+l.s; if(!rows[k]) rows[k]={po:l.po,c:M.cat[l.s],qty:0,rev:"",insp:0,sold:0,left:0}; rows[k].insp+=l.q; rows[k].sold+=l.sold; rows[k].left+=l.left; });
  var byPo = {};
  Object.keys(rows).forEach(function(k){ var r=rows[k]; (byPo[r.po]=byPo[r.po]||[]).push(r); });
  var pos = Object.keys(byPo).filter(function(p){ return ui.poAll || byPo[p].some(function(r){ return r.insp>0; }); })
    .sort(function(a,b){ var ia=byPo[a].some(function(r){return r.insp>0;}), ib=byPo[b].some(function(r){return r.insp>0;}); return ia!==ib ? (ia?-1:1) : a-b; });
  var h = '<div class="filters"><div class="seg" data-f="poAll"><button type="button" aria-pressed="'+(!ui.poAll)+'" data-v="0">Inspected POs</button><button type="button" aria-pressed="'+ui.poAll+'" data-v="1">All POs</button></div><span class="c" style="color:var(--muted);font-size:12.5px">Sales are taken from the oldest inspected PO first (FIFO).</span></div>';
  h += '<div class="tbl-wrap"><table><thead><tr><th>PO / SKU</th><th>Item</th><th class="r">PO qty</th><th class="r">Inspected</th><th class="r">Sold</th><th class="r">In stock</th><th class="r">Not yet inspected</th><th>Revised date</th><th>Status</th></tr></thead><tbody>';
  pos.forEach(function(p){
    var rs = byPo[p].sort(function(a,b){ return b.insp-a.insp || (a.c.sku<b.c.sku?-1:1); });
    var t = rs.reduce(function(a,r){ a.qty+=r.qty; a.insp+=r.insp; a.sold+=r.sold; a.left+=r.left; return a; },{qty:0,insp:0,sold:0,left:0});
    h += '<tr class="po-h"><td class="mono">PO '+p+'</td><td>'+rs.length+' SKUs</td><td class="r">'+fmt(t.qty)+'</td><td class="r">'+fmt(t.insp)+'</td><td class="r">'+fmt(t.sold)+'</td><td class="r">'+fmt(t.left)+'</td><td class="r">'+fmt(Math.max(t.qty-t.insp,0))+'</td><td>'+esc(rs[0].rev)+'</td><td></td></tr>';
    rs.forEach(function(r){
      var st = r.insp ? status(r.left) : "empty";
      h += '<tr><td><span class="chip">'+r.c.sku+'</span></td><td><span style="display:inline-flex;gap:8px;align-items:center">'+sw(r.c.colour).replace('class="sw"','class="sw" style="width:12px;height:12px;background:'+(SWATCH[r.c.colour]||"#999")+'"')+esc(r.c.colour)+' · '+esc(r.c.product)+' · '+esc(r.c.size)+'</span></td><td class="r">'+fmt(r.qty)+'</td><td class="r">'+(r.insp?fmt(r.insp):'–')+'</td><td class="r">'+(r.insp?fmt(r.sold):'–')+'</td><td class="r">'+(r.insp?fmt(r.left):'–')+'</td><td class="r">'+fmt(Math.max(r.qty-r.insp,0))+'</td><td>'+esc(r.rev)+'</td><td>'+(r.insp?'<span class="tag '+st+'">'+(st==="empty"?"Sold out":statusLabel(st).split(" · ")[0])+'</span>':'<span class="tag empty">Awaiting</span>')+'</td></tr>';
    });
  });
  return h + '</tbody></table></div>';
}
function viewAnalytics(){
  var days = M.dayList, vals = days.map(function(d){ return M.days[d]; });
  var total = vals.reduce(function(a,b){return a+b;},0), max = Math.max.apply(null, vals.concat([1]));
  var best = days[vals.indexOf(max)];
  var last7 = M.recentDays.reduce(function(a,d){ return a+M.days[d]; },0);
  var W = Math.max(days.length*26+48, (($("#view")||{}).clientWidth||900)-34), H = 220, pl=40, pb=34, pt=10, cw=W-pl-8, ch=H-pb-pt, bw=cw/days.length;
  var step = max>150?50:max>60?20:10, ticks=[]; for(var t=0;t<=max;t+=step) ticks.push(t);
  var ymax = Math.max(ticks[ticks.length-1], max);
  var y = function(v){ return pt+ch-(v/ymax)*ch; };
  var svg = '<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Pieces sold per order day">';
  ticks.forEach(function(t){ svg += '<line class="grid-l" x1="'+pl+'" x2="'+(W-8)+'" y1="'+y(t)+'" y2="'+y(t)+'"/><text x="'+(pl-6)+'" y="'+(y(t)+4)+'" text-anchor="end">'+t+'</text>'; });
  days.forEach(function(d,i){
    var v=vals[i], x=pl+i*bw+bw*0.18, w=bw*0.64, h=Math.max(ch*(v/ymax),1);
    svg += '<rect class="bar-m" tabindex="0" data-tip="'+dlong(d)+': '+v+' pcs" x="'+x.toFixed(1)+'" y="'+y(v).toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="3"/>';
    if(i%2===0 || days.length<16) svg += '<text x="'+(x+w/2).toFixed(1)+'" y="'+(H-pb+16)+'" text-anchor="middle">'+dshort(d)+'</text>';
  });
  svg += '</svg>';
  var byCol = {}, bySize = {}, byProd = {}, ctry = {US:0,CA:0,"":0};
  M.sales.forEach(function(x){ var c=M.cat[x.s]; if(!c) return; byCol[c.colour]=(byCol[c.colour]||0)+x.q; var sz=c.product.replace("Waffle ","")+" · "+c.cls.replace("KING/CAL KING","King/Cal King").replace("FULL/QUEEN","Full/Queen").replace("TWIN","Twin").replace("THROW","50x70"); bySize[sz]=(bySize[sz]||0)+x.q; ctry[x.c||""]+=x.q; });
  function hbars(obj, swatch){
    var ks = Object.keys(obj).sort(function(a,b){ return obj[b]-obj[a]; }), m = Math.max.apply(null, ks.map(function(k){return obj[k];}).concat([1]));
    return '<div class="hb">'+ks.map(function(k){ return '<div class="lbl">'+(swatch?sw(k):'')+esc(k)+'</div><div class="tr"><i style="width:'+(obj[k]/m*100).toFixed(1)+'%" data-tip="'+esc(k)+': '+obj[k]+' pcs"></i></div><div class="v">'+fmt(obj[k])+'</div>'; }).join("")+'</div>';
  }
  var ct = ctry.US+ctry.CA+ctry[""];
  var split = '<div class="split" role="img" aria-label="US '+ctry.US+', Canada '+ctry.CA+', not recorded '+ctry[""]+'"><i style="width:'+(ctry.US/ct*100)+'%;background:var(--accent)" data-tip="US: '+ctry.US+' pcs"></i><i style="width:'+(ctry.CA/ct*100)+'%;background:var(--yellow)" data-tip="Canada: '+ctry.CA+' pcs"></i><i style="width:'+(ctry[""]/ct*100)+'%;background:var(--line)" data-tip="Not recorded: '+ctry[""]+' pcs"></i></div>'+
    '<div class="legend"><span style="--c:var(--accent)">US · '+fmt(ctry.US)+' pcs</span><span style="--c:var(--yellow)">Canada · '+fmt(ctry.CA)+' pcs</span><span style="--c:var(--line)">Not recorded · '+fmt(ctry[""])+' pcs</span></div>';
  var st = M.skus.filter(function(c){ return c.insp>0; }).sort(function(a,b){ return b.sold/b.insp - a.sold/a.insp || b.sold-a.sold; });
  var tbl = '<div class="tbl-wrap"><table><thead><tr><th>SKU</th><th>Item</th><th class="r">Inspected</th><th class="r">Sold</th><th class="r">Sold %</th><th class="r">Last 7 order days</th><th class="r">In stock</th><th>Stock lasts</th><th>Status</th></tr></thead><tbody>'+
    st.map(function(c){ return '<tr><td><span class="chip">'+c.sku+'</span></td><td>'+esc(c.colour+" · "+c.product+" · "+c.size)+'</td><td class="r">'+fmt(c.insp)+'</td><td class="r">'+fmt(c.sold)+'</td><td class="r">'+Math.round(c.sold/c.insp*100)+'%</td><td class="r">'+fmt(c.recent)+'</td><td class="r">'+fmt(c.bal)+'</td><td>'+(c.bal<=0?'–':c.cover!=null?(c.cover<1?'under 1 day':'~'+Math.round(c.cover)+' order days'):'no recent sales')+'</td><td><span class="tag '+c.st+'">'+(c.st==="empty"?"Sold out":statusLabel(c.st).split(" · ")[0])+'</span></td></tr>'; }).join("")+'</tbody></table></div>';
  return '<div class="an">'+
    '<div class="panel wide"><h3>Pieces sold per order day</h3><p class="sub">'+days.length+' order days · '+fmt(total)+' pcs · average '+(total/Math.max(days.length,1)).toFixed(1)+' pcs/day · best day '+dlong(best)+' ('+max+' pcs) · last 7 order days '+fmt(last7)+' pcs</p><div class="chart">'+svg+'</div></div>'+
    '<div class="panel"><h3>Sales by colour</h3><p class="sub">Pieces sold since 9 Sep</p>'+hbars(byCol,true)+'</div>'+
    '<div class="panel"><h3>Sales by product and size</h3><p class="sub">Pieces sold since 9 Sep</p>'+hbars(bySize,false)+'</div>'+
    '<div class="panel wide"><h3>US vs Canada</h3><p class="sub">Country is recorded from 11 Sep onwards</p>'+split+'</div>'+
    '<div class="panel wide"><h3>Sell-through by SKU</h3><p class="sub">Stock lasts = stock ÷ average daily sales over the last 7 order days</p>'+tbl+'</div>'+
  '</div>';
}
function viewActivity(){
  var items = STATE.log.slice().reverse();
  return '<div class="log">'+items.map(function(l){
    var kind = l.kind==="inspection" ? "Inspection" : l.kind==="orders" ? "Daily orders" : l.kind==="rules" ? "Colour rules" : "History";
    return '<div class="log-i"><div class="k">'+kind+'</div><div><b>'+esc(l.f)+'</b><p>'+esc(l.n||"")+'</p></div><div class="num" style="color:var(--muted);font-size:12.5px">'+esc(l.at)+(l.pcs!=null?' · '+(l.kind==="orders"?"−":"+")+fmt(l.pcs)+' pcs':'')+'</div></div>';
  }).join("")+'</div>';
}
function bindView(){
  document.querySelectorAll(".seg").forEach(function(s){
    s.addEventListener("click", function(e){ var b=e.target.closest("button"); if(!b) return; var f=s.dataset.f; if(f==="poAll") ui.poAll = b.dataset.v==="1"; else ui[f]=b.dataset.v; render(); });
  });
  var q=$("#q"); if(q) q.addEventListener("input", function(){ ui.q=q.value; var pos=q.selectionStart; render(); var n=$("#q"); n.focus(); try{ n.setSelectionRange(pos,pos); }catch(e){} });
}

/* tooltip */
var tip = document.createElement("div"); tip.id="tip"; tip.hidden=true; document.body.appendChild(tip);
function showTip(el, x, y){ tip.textContent = el.getAttribute("data-tip"); tip.hidden=false; var w=tip.offsetWidth; tip.style.left=Math.min(Math.max(8,x-w/2), innerWidth-w-8)+"px"; tip.style.top=Math.max(8,y-36)+"px"; }
document.addEventListener("mousemove", function(e){ var el=e.target.closest && e.target.closest("[data-tip]"); if(el) showTip(el,e.clientX,e.clientY); else tip.hidden=true; });
document.addEventListener("focusin", function(e){ var el=e.target.closest && e.target.closest("[data-tip]"); if(el){ var r=el.getBoundingClientRect(); showTip(el,r.left+r.width/2,r.top); } });
document.addEventListener("focusout", function(){ tip.hidden=true; });

/* ---------- upload & settings drawer ---------- */
var pending = null;
function openDrawer(kind){
  pending = null;
  var h = '<div class="scrim" id="scrim"><div class="drawer" role="dialog" aria-modal="true" aria-labelledby="dh">';
  var title = kind==="insp" ? "Add inspection form" : kind==="orders" ? "Add daily orders" : "Colour rules";
  h += '<div class="drawer-h"><h2 id="dh">'+title+'</h2><button class="btn" type="button" id="dclose" aria-label="Close">'+ico("x")+'</button></div>';
  if(kind==="rules"){
    var s=STATE.settings;
    h += '<p class="note">Stock at or below the red limit shows red. Stock above red and at or below the yellow limit shows yellow. Anything above the yellow limit shows green.</p>'+
      '<div class="field"><label for="r-red">Red: at or below (pcs)</label><input id="r-red" type="number" min="0" step="1" value="'+s.red+'"></div>'+
      '<div class="field"><label for="r-yellow">Yellow: at or below (pcs)</label><input id="r-yellow" type="number" min="1" step="1" value="'+s.yellow+'"></div>'+
      '<div class="rule-prev" id="r-prev"></div><div id="r-msg"></div>'+
      '<div><button class="btn primary" id="r-save" type="button">Save rules</button></div>';
  } else {
    h += '<p class="note">'+(kind==="insp"
      ? "Upload the inspection request form (.xlsx). Each line is matched by PO + colour + size against the PO sheet, and its qty is added to the shop."
      : "Upload the raw bulk export (Export Pending Dispatch, .xlsx). Lines already in the shop are skipped by AWB number, so yesterday's orders never count twice. The LIVE ODR QTY sheet format also works.")+'</p>'+
      '<label class="drop" id="drop" for="file"><b>Choose a file</b> or drop it here<br><span style="font-size:12.5px">.xlsx, .xls or .csv</span></label><input id="file" type="file" accept=".xlsx,.xls,.csv" hidden>'+
      '<div class="field"><label for="ud">'+(kind==="insp"?"Inspection date":"Order day (date the orders were confirmed)")+'</label><input id="ud" type="date" value="'+todayISO()+'"></div>'+
      '<div id="prev"></div>';
  }
  h += '</div></div>';
  var host = document.createElement("div"); host.id="drawer-host"; host.innerHTML=h; document.body.appendChild(host);
  $("#dclose").addEventListener("click", closeDrawer);
  $("#scrim").addEventListener("click", function(e){ if(e.target.id==="scrim") closeDrawer(); });
  document.addEventListener("keydown", escClose);
  if(kind==="rules"){ bindRules(); return; }
  var drop=$("#drop"), file=$("#file");
  file.addEventListener("change", function(){ if(file.files[0]) readFile(file.files[0], kind); });
  ["dragenter","dragover"].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.add("on"); }); });
  ["dragleave","drop"].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.remove("on"); }); });
  drop.addEventListener("drop", function(e){ var f=e.dataTransfer.files[0]; if(f) readFile(f, kind); });
  $("#ud").addEventListener("change", function(){ if(pending) { pending.date=$("#ud").value; showPreview(); } });
  $("#dclose").focus();
}
function escClose(e){ if(e.key==="Escape") closeDrawer(); }
function closeDrawer(){ var h=$("#drawer-host"); if(h) h.remove(); document.removeEventListener("keydown", escClose); pending=null; }
function bindRules(){
  function prev(){
    var r=parseInt($("#r-red").value,10), y=parseInt($("#r-yellow").value,10), ok = r>=0 && y>r;
    var c={red:0,yellow:0,green:0}; M.skus.forEach(function(s){ if(s.bal<=0) return; if(s.bal<=r) c.red++; else if(s.bal<=y) c.yellow++; else c.green++; });
    $("#r-prev").innerHTML = ok ? '<span class="tag red">≤ '+r+' · '+c.red+' SKUs</span><span class="tag yellow">'+(r+1)+'–'+y+' · '+c.yellow+' SKUs</span><span class="tag green">&gt; '+y+' · '+c.green+' SKUs</span>' : '';
    $("#r-msg").innerHTML = ok ? '' : '<div class="note err">The yellow limit must be higher than the red limit.</div>';
    $("#r-save").disabled = !ok; return ok;
  }
  $("#r-red").addEventListener("input", prev); $("#r-yellow").addEventListener("input", prev); prev();
  $("#r-save").addEventListener("click", function(){
    if(!prev()) return;
    var r=parseInt($("#r-red").value,10), y=parseInt($("#r-yellow").value,10);
    var next = clone(STATE); next.settings={red:r,yellow:y};
    next.log.push({at:todayISO(),kind:"rules",f:"Red ≤ "+r+" · Yellow "+(r+1)+"–"+y+" · Green > "+y,n:"Colour limits changed"});
    save(next, $("#r-msg"));
  });
}
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function readFile(f, kind){
  var prevEl=$("#prev"); prevEl.innerHTML='<div class="note">Reading '+esc(f.name)+'…</div>';
  if(!window.XLSX){ prevEl.innerHTML='<div class="note err">The spreadsheet reader did not load. Check your connection and reopen the page.</div>'; return; }
  var r=new FileReader();
  r.onload=function(){
    try{
      var wb=XLSX.read(new Uint8Array(r.result),{type:"array",cellDates:false});
      var m = f.name.match(/(20\d\d)-(\d\d)-(\d\d)/), m2 = f.name.match(/(\d{1,2})\.(\d{1,2})/);
      if(kind==="orders" && m) $("#ud").value = m[1]+"-"+m[2]+"-"+m[3];
      if(kind==="insp" && m2) $("#ud").value = "2026-"+("0"+m2[2]).slice(-2)+"-"+("0"+m2[1]).slice(-2);
      pending = kind==="insp" ? parseInspection(wb, f.name) : parseOrders(wb, f.name);
      pending.kind=kind; pending.date=$("#ud").value;
      showPreview();
    }catch(err){ prevEl.innerHTML='<div class="note err">Could not read this file: '+esc(err.message)+'. Make sure it is the original .xlsx from the portal or the inspection form.</div>'; }
  };
  r.readAsArrayBuffer(f);
}
function rowsOf(ws){ return XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true}); }
function findCol(hdr, res){ for(var j=0;j<res.length;j++){ for(var i=0;i<hdr.length;i++){ if(hdr[i]!=null && res[j].test(String(hdr[i]).trim())) return i; } } return -1; }
function matchInsp(po, colour, size, skuCol, pname){
  colour = titleCase(colour); var cl = normSize(size);
  var cands = STATE.catalog.filter(function(c){ return c.colour.toUpperCase()===colour.toUpperCase() && c.cls===cl && c.pos.some(function(p){ return p.po===po; }); });
  if(skuCol) skuCol = String(skuCol).toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(cands.length>1){
    if(skuCol && cands.some(function(c){ return c.sku===skuCol; })) return {sku:skuCol,note:""};
    var pn=String(pname||"").toLowerCase(), keys=[["sham","Sham Set"],["duvet cover set","Duvet Cover Set"],["duvet","Duvet Cover"],["throw","Waffle Throw"],["blanket","Waffle Bed Blanket"]];
    for(var k=0;k<keys.length;k++){ if(pn.indexOf(keys[k][0])>-1){ var f=cands.filter(function(c){ return c.product===keys[k][1]; }); if(f.length){ cands=f; break; } } }
  }
  if(cands.length===1){ var s=cands[0].sku; return {sku:s, note: skuCol && skuCol!==s ? "Form SKU "+skuCol+" is not on PO "+po+" for "+colour+" "+cl+"; matched "+s+" by PO" : ""}; }
  if(!cands.length && skuCol && STATE.catalog.some(function(c){ return c.sku===skuCol; })) return {sku:null, note:"PO "+po+" + "+colour+" + "+cl+" is not on the PO sheet (form says "+skuCol+")"};
  return {sku:null, note: cands.length ? "More than one SKU fits PO "+po+" + "+colour+" + "+cl : "PO "+po+" + "+colour+" + "+cl+" is not on the PO sheet"};
}
function parseInspection(wb, name){
  var lines=[], bad=[];
  wb.SheetNames.forEach(function(sn){
    var rows=rowsOf(wb.Sheets[sn]), hi=-1;
    for(var i=0;i<Math.min(rows.length,15);i++){ var r=rows[i].map(function(x){return String(x||"");}).join("|"); if(/po/i.test(r) && /colou?r/i.test(r) && /size/i.test(r)){ hi=i; break; } }
    if(hi<0) return;
    var hdr=rows[hi], cPo=findCol(hdr,[/^po/i]), cCol=findCol(hdr,[/^colou?r/i]), cSize=findCol(hdr,[/^size/i]), cSku=findCol(hdr,[/^sku/i]), cProd=findCol(hdr,[/product/i]), cQty=findCol(hdr,[/inspection\s*qty/i,/^total$/i,/qty/i]);
    for(var j=hi+1;j<rows.length;j++){
      var r=rows[j]; var po=parseInt(String(r[cPo]||"").replace(/\D/g,""),10), col=r[cCol], q=parseInt(r[cQty],10);
      if(!po || !col || !q) continue;
      var m=matchInsp(po,col,r[cSize],cSku>-1?r[cSku]:null,cProd>-1?r[cProd]:"");
      var line={po:po,colour:titleCase(col),size:String(r[cSize]),q:q,s:m.sku,n:m.note};
      (m.sku?lines:bad).push(line);
    }
  });
  return {file:name, lines:lines, bad:bad, dupFile: STATE.insp.some(function(l){ return l.f===name; })};
}
function parseOrders(wb, name){
  var known={}; STATE.sales.forEach(function(s){ if(s[4]) known[s[4]]=1; });
  var lines=[], skipped=0, bad=[], inFile={}, fmtName="";
  var inspected={}; STATE.insp.forEach(function(l){ var c=STATE.catalog.find(function(x){return x.sku===l.s;}); if(c){ var k=c.colour.toUpperCase()+"|"+c.cls; (inspected[k]=inspected[k]||{})[c.sku]=1; } });
  var skuSet={}; STATE.catalog.forEach(function(c){ skuSet[c.sku]=1; });
  wb.SheetNames.forEach(function(sn){
    var rows=rowsOf(wb.Sheets[sn]); if(!rows.length) return;
    var hi=-1; for(var i=0;i<Math.min(rows.length,10);i++){ var t=rows[i].map(function(x){return String(x||"").trim();}); if(t.indexOf("SKU")>-1 && (t.indexOf("lastMileTrackingNumber")>-1||t.indexOf("orderNumber")>-1)){hi=i;fmtName="export";break;} if(t.indexOf("S NO.")>-1 && t.indexOf("COLOUR")>-1){hi=i;fmtName="live";break;} }
    if(hi<0) return;
    var hdr=rows[hi].map(function(x){return String(x||"").trim();});
    var country="";
    for(var j=hi+1;j<rows.length;j++){
      var r=rows[j], x={}; hdr.forEach(function(h,k){ x[h]=r[k]; });
      var line;
      if(fmtName==="export"){
        if(!x.SKU) continue;
        var dest=String(x["Shipping Destination"]||"").split(",").pop().trim().toUpperCase();
        line={o:String(x.orderNumber||String(x.Tracking||"").split("-")[0]||""), s:String(x.SKU).trim().toUpperCase(), q:parseInt(x.Qty,10)||1, a:String(x.lastMileTrackingNumber||"").trim(), c:dest==="CA"?"CA":dest==="US"?"US":"", label:x.Variant||""};
      } else {
        if(typeof r[0]==="string"){ var u=r[0].toUpperCase(); if(u.indexOf("CANADA")>-1) country="CA"; else if(u.indexOf("USA")>-1) country="US"; continue; }
        if(typeof r[0]!=="number") continue;
        var q=parseInt(x["QTY (PCS)"],10); if(!q) continue;
        var k=String(x.COLOUR||"").trim().toUpperCase()+"|"+normSize(x.SIZE);
        var opts=Object.keys(inspected[k]||{});
        line={o:String(x["ORDER NO."]||""), s:opts.length===1?opts[0]:null, q:q, a:String(x["AWB NO."]||"").trim(), c:country, label:titleCase(x.COLOUR)+" / "+x.SIZE};
        if(!line.s){ bad.push({o:line.o,label:line.label,why:opts.length?"More than one SKU fits":"No inspected SKU for this colour and size"}); continue; }
      }
      if(!skuSet[line.s]){ bad.push({o:line.o,label:line.s+" "+line.label,why:"SKU not on the PO sheet"}); continue; }
      var key=line.a || (line.o+"|"+line.s+"|"+j);
      if(known[line.a] || inFile[key]){ skipped++; continue; }
      inFile[key]=1; lines.push(line);
    }
  });
  if(!fmtName) throw new Error("no order columns found (expected SKU and lastMileTrackingNumber, or S NO. and COLOUR)");
  return {file:name, lines:lines, skipped:skipped, bad:bad, format:fmtName};
}
function showPreview(){
  var p=pending, el=$("#prev"), h="";
  if(p.kind==="insp"){
    var pcs=p.lines.reduce(function(a,l){return a+l.q;},0), by={};
    p.lines.forEach(function(l){ by[l.s]=(by[l.s]||0)+l.q; });
    h += '<div class="sumrow"><span class="chip">'+p.lines.length+' lines matched</span><span class="chip">+'+fmt(pcs)+' pcs</span><span class="chip">'+Object.keys(by).length+' SKUs</span>'+(p.bad.length?'<span class="chip" style="color:var(--red)">'+p.bad.length+' not matched</span>':'')+'</div>';
    if(p.dupFile) h += '<div class="note warn">A file named '+esc(p.file)+' was already added. Add it again only if this is a new inspection.</div>';
    p.lines.filter(function(l){return l.n;}).forEach(function(l){ h+='<div class="note warn">'+esc(l.n)+'</div>'; });
    if(p.bad.length) h += '<div class="note err"><b>Not matched, will be left out:</b><br>'+p.bad.map(function(b){ return esc("PO "+b.po+" · "+b.colour+" · "+b.size+" · "+b.q+" pcs: "+b.n); }).join("<br>")+'</div>';
    h += impactTable(by, +1);
  } else {
    var pcs2=p.lines.reduce(function(a,l){return a+l.q;},0), by2={}, ords={};
    p.lines.forEach(function(l){ by2[l.s]=(by2[l.s]||0)+l.q; ords[l.o]=1; });
    h += '<div class="sumrow"><span class="chip">'+p.lines.length+' new lines</span><span class="chip">'+Object.keys(ords).length+' orders</span><span class="chip">−'+fmt(pcs2)+' pcs</span><span class="chip">'+p.skipped+' already counted, skipped</span>'+(p.bad.length?'<span class="chip" style="color:var(--red)">'+p.bad.length+' not matched</span>':'')+'</div>';
    if(!p.lines.length) h += '<div class="note ok">Nothing new in this file. Every line is already in the shop.</div>';
    if(p.bad.length) h += '<div class="note err"><b>Not matched, will be left out:</b><br>'+p.bad.map(function(b){ return esc("Order "+b.o+" · "+b.label+": "+b.why); }).join("<br>")+'</div>';
    h += impactTable(by2, -1);
  }
  var n = p.lines.length;
  h += '<div id="save-msg"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="commit" type="button"'+(n?'':' disabled')+'>'+(p.kind==="insp"?"Add to shop stock":"Deliver from shop")+'</button><button class="btn" type="button" id="cancel">Cancel</button></div>';
  el.innerHTML = h;
  $("#cancel").addEventListener("click", closeDrawer);
  $("#commit").addEventListener("click", commit);
}
function impactTable(by, sign){
  var ks=Object.keys(by); if(!ks.length) return "";
  var rows = ks.map(function(s){ var c=M.cat[s]; var before=c?c.bal:0, after=before+sign*by[s]; return {s:s,c:c,before:before,after:after,d:by[s]}; }).sort(function(a,b){ return a.after-b.after; });
  var neg = rows.filter(function(r){ return r.after<0; });
  var h = neg.length ? '<div class="note err">'+neg.length+' SKU(s) would go below 0. Check the inspection forms for these SKUs before adding.</div>' : '';
  h += '<div class="tbl-wrap"><table><thead><tr><th>SKU</th><th>Item</th><th class="r">Now</th><th class="r">'+(sign>0?"Adding":"Selling")+'</th><th class="r">After</th><th>Status after</th></tr></thead><tbody>'+
    rows.map(function(r){ var st=status(r.after); return '<tr><td><span class="chip">'+r.s+'</span></td><td>'+(r.c?esc(r.c.colour+" · "+r.c.product+" · "+r.c.size):"")+'</td><td class="r">'+fmt(r.before)+'</td><td class="r">'+(sign>0?"+":"−")+fmt(r.d)+'</td><td class="r"><b>'+fmt(r.after)+'</b></td><td><span class="tag '+st+'">'+(st==="empty"?(r.after<0?"Below 0":"Moves to empty bucket"):statusLabel(st))+'</span></td></tr>'; }).join("")+'</tbody></table></div>';
  return h;
}
function commit(){
  var p=pending; if(!p||!p.lines.length) return;
  var date=$("#ud").value; if(!date){ $("#save-msg").innerHTML='<div class="note err">Pick a date first.</div>'; return; }
  var next=clone(STATE);
  if(p.kind==="insp"){
    p.lines.forEach(function(l){ next.insp.push({d:date,f:p.file,po:l.po,s:l.s,q:l.q,n:l.n||""}); });
    var pcs=p.lines.reduce(function(a,l){return a+l.q;},0);
    next.log.push({at:todayISO(),kind:"inspection",f:p.file,pcs:pcs,n:p.lines.length+" lines, inspection date "+dlong(date)+(p.bad.length?", "+p.bad.length+" lines not matched":"")});
  } else {
    p.lines.forEach(function(l){ next.sales.push([date,l.o,l.s,l.q,l.a,l.c]); });
    var pcs2=p.lines.reduce(function(a,l){return a+l.q;},0);
    next.log.push({at:todayISO(),kind:"orders",f:p.file,pcs:pcs2,n:p.lines.length+" new lines for "+dlong(date)+", "+p.skipped+" already counted"+(p.bad.length?", "+p.bad.length+" not matched":"")});
  }
  save(next, $("#save-msg"));
}
function buildDoc(st){
  var reset = (document.head.querySelector("style")||{}).textContent || ":root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}";
  var json = JSON.stringify(st).replace(/</g,"\\u003c");
  var css = document.getElementById("qm-css").textContent, js = document.getElementById("qm-js").textContent;
  return '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>'+reset+'</style></head><body>'+
    T.head + '<style id="qm-css">'+css+'</style>' + T.body +
    '<script type="application/json" id="qm-state">'+json+'<\/script>' + T.lib + '<script id="qm-js">'+js+'<\/script></body></html>';
}
function save(next, msgEl){
  if(!ARTIFACT){ msgEl.innerHTML='<div class="note err">Saving is not available in this view. Open the dashboard from your Claude account to make changes.</div>'; return; }
  next.updated = new Date().toISOString();
  var btns=document.querySelectorAll("#commit,#r-save"); btns.forEach(function(b){ b.disabled=true; });
  msgEl.innerHTML='<div class="note">Saving… everyone with the link will see the update.</div>';
  ARTIFACT.publish(buildDoc(next)).then(function(){
    msgEl.innerHTML='<div class="note ok">Saved. The dashboard is reloading with the update.</div>';
  }).catch(function(e){
    var code=e&&e.code;
    var t = code==="conflict" ? "Someone else saved a change at the same time. The page is reloading with the latest version; upload again after it loads."
      : (code==="not_writer"||code==="not_granted") ? "This view is read-only, so changes cannot be saved."
      : code==="rate_limited" ? "Too many saves in a short time. Wait a minute and try again."
      : "Could not save ("+(code||"error")+"). Try again in a moment.";
    msgEl.innerHTML='<div class="note err">'+esc(t)+'</div>';
    if(code==="not_writer"||code==="not_granted"){ CAN_EDIT=false; renderHeader(); }
    else btns.forEach(function(b){ b.disabled=false; });
  });
}
function downloadSummary(){
  var rows=[["SKU","Product","Colour","Size","PO qty","Inspected","Sold","In stock","Status","Last sale"]];
  M.skus.slice().sort(function(a,b){ return PRODUCT_ORDER.indexOf(a.product)-PRODUCT_ORDER.indexOf(b.product) || (a.sku<b.sku?-1:1); }).forEach(function(c){
    rows.push([c.sku,c.product,c.colour,c.size,c.poQty,c.insp,c.sold,c.bal,c.insp?(c.st==="empty"?"Sold out":statusLabel(c.st)):"Awaiting inspection",c.lastSale||""]);
  });
  var csv=rows.map(function(r){ return r.map(function(v){ v=String(v); return /[",]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }).join(","); }).join("\r\n");
  DOWNLOADS.save({filename:"Quince-shop-summary-"+(M.lastDay||todayISO())+".csv", data:"﻿"+csv}).catch(function(){});
}

/* ---------- boot ---------- */
document.querySelector(".tabs").addEventListener("click", function(e){ var b=e.target.closest(".tab"); if(!b) return; ui.tab=b.dataset.tab; try{ history.replaceState(null,"","#"+ui.tab); }catch(err){} render(); });
document.addEventListener("click", function(e){
  var o=e.target.closest("[data-open]"); if(o){ openDrawer(o.dataset.open); return; }
  if(e.target.closest("#dl")) downloadSummary();
});
var hash=(location.hash||"").slice(1); if(["shop","po","analytics","activity"].indexOf(hash)>-1) ui.tab=hash;
render();
if(window.claude && window.claude.use){
  Promise.all([window.claude.use("artifact").catch(function(){return null;}), window.claude.use("user").catch(function(){return null;}), window.claude.use("downloads").catch(function(){return null;})]).then(function(r){
    ARTIFACT=r[0]; DOWNLOADS=r[2];
    var u=r[1];
    var p = (ARTIFACT && u) ? u.canEdit() : Promise.resolve(false);
    return Promise.resolve(p).then(function(ok){ CAN_EDIT=!!ok; renderHeader(); });
  }).catch(function(){ renderHeader(); });
}
})();
