const path=require('path');
const puppeteer=require(path.join(__dirname,'bt/node_modules/puppeteer-core'));
const FILE=path.resolve('Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const b=await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:'new',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const w of [1440,1100,800]){
 const pg=await b.newPage();await pg.setViewport({width:w,height:1000});
 const errs=[];pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await pg.goto('file:///'+FILE.replace(/\\/g,'/'));await pg.waitForSelector('.po-marker',{timeout:30000});await sleep(2500);
 const meas=async tag=>{const r=await pg.evaluate(()=>{const g=document.querySelector('.bottom-grid');const gb=g.getBoundingClientRect();
  const ps=[...g.children].map(p=>{const r=p.getBoundingClientRect();return {t:Math.round(r.top+scrollY),b:Math.round(r.bottom+scrollY),l:Math.round(r.left),r:Math.round(r.right),sw:p.scrollWidth,cw:p.clientWidth}});
  const wc=[...document.querySelectorAll('.weather-card')].filter(c=>c.scrollWidth>c.clientWidth+1||c.scrollHeight>c.clientHeight+1).length;
  return {box:{t:Math.round(gb.top+scrollY),b:Math.round(gb.bottom+scrollY),r:Math.round(gb.right)},ps,weatherClip:wc,hscroll:document.documentElement.scrollWidth>innerWidth,ams:document.getElementById('amsPanel').parentElement===g}});
  console.log(w,tag,JSON.stringify(r));};
 await meas('overview');
 await pg.evaluate(()=>document.querySelector('.bottom-grid').scrollIntoView({block:'center'}));await sleep(400);
 await pg.screenshot({path:`.agents/tasks/move-${w}-overview.png`});
 await pg.click('.ams-card[data-sid="S03"]');await sleep(1200);
 const po=await pg.$('.ams-po-row');if(po){await po.click();await sleep(600);}
 await meas('S03+drawer');
 console.log(w,'scrollY',await pg.evaluate(()=>scrollY));
 await pg.screenshot({path:`.agents/tasks/move-${w}-s03.png`,fullPage:true});
 console.log(w,'errors',JSON.stringify(errs));await pg.close();}
await b.close();})();
