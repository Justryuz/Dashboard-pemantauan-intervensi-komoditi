const path=require('path');const puppeteer=require(path.join(__dirname,'bt/node_modules/puppeteer-core'));
const FILE=path.resolve('Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:'new',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const w of [1440,1100,800]){const pg=await b.newPage();const errs=[];pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await pg.setViewport({width:w,height:1000});await pg.goto('file:///'+FILE.replace(/\\/g,'/'));await pg.waitForSelector('.po-marker',{timeout:30000});await sleep(2500);
const r=await pg.evaluate(()=>{const R=e=>{const x=e&&e.getBoundingClientRect();return x?{x:Math.round(x.left),y:Math.round(x.top+scrollY),w:Math.round(x.width),h:Math.round(x.height)}:null};const q=s=>document.querySelector(s);
const ids={};document.querySelectorAll('[id]').forEach(e=>ids[e.id]=(ids[e.id]||0)+1);
const ts=q('.compare-panel .table-scroll');const cp=q('.chart-panel');
return{map:R(q('.map-panel')),cmp:R(q('.compare-panel')),chart:R(cp),svg:R(q('#priceChart')),legend:R(q('.chart-legend')),bottom:R(q('.bottom-grid')),rows:document.querySelectorAll('#compareBody tr').length,
dups:Object.keys(ids).filter(k=>ids[k]>1),hov:document.documentElement.scrollWidth>innerWidth,tableScroll:[ts.scrollWidth,ts.clientWidth],chartOv:[cp.scrollHeight,cp.clientHeight]}});
console.log(w,JSON.stringify(r),'ERRS',JSON.stringify(errs));await pg.screenshot({path:path.join(__dirname,`trend-${w}.png`),fullPage:true});await pg.close()}
await b.close()})();
