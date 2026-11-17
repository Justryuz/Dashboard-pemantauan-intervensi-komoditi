const path=require('path');const puppeteer=require(path.join(__dirname,'bt/node_modules/puppeteer-core'));
const FILE=path.resolve('Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:'new',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const w of [1440,1100,800]){const pg=await b.newPage();const errs=[];pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await pg.setViewport({width:w,height:1000});await pg.goto('file:///'+FILE.replace(/\\/g,'/'));await pg.waitForSelector('.po-marker',{timeout:30000});await sleep(2500);
const r=await pg.evaluate(()=>{const R=e=>{const x=e&&e.getBoundingClientRect();return x?{x:Math.round(x.left),w:Math.round(x.width),top:Math.round(x.top+scrollY),bot:Math.round(x.bottom+scrollY)}:null};const q=s=>document.querySelector(s);
const lp=[...document.querySelectorAll('.analytics-col .listpanel')];const ids={};document.querySelectorAll('[id]').forEach(e=>ids[e.id]=(ids[e.id]||0)+1);
return{map:R(q('.map-panel')),left:R(q('.left-col')),right:R(q('.analytics-col')),hdr:R(q('.analytics-header')),low:R(lp[0]),high:R(lp[1]),row:R(q('.triple-row')),cmp:R(q('.compare-panel')),chart:R(q('.chart-panel')),bottom:R(q('.bottom-grid')),
dups:Object.keys(ids).filter(k=>ids[k]>1),lists:lp.map(p=>{const lb=p.querySelector('.listbody');return{sh:lb.scrollHeight,ch:lb.clientHeight,rows:lb.children.length}}),hov:document.documentElement.scrollWidth>innerWidth,
cmpScroll:(()=>{const t=q('.compare-panel .table-scroll');return[t.scrollWidth,t.clientWidth]})(),chartOv:(()=>{const c=q('.chart-panel');return[c.scrollHeight,c.clientHeight]})()}});
console.log(w,JSON.stringify(r),'ERRS',JSON.stringify(errs));await pg.screenshot({path:path.join(__dirname,`harga-${w}.png`),fullPage:true});await pg.close()}
await b.close()})();
