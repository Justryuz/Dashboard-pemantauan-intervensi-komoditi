const path=require('path');const puppeteer=require(path.resolve('.agents/tasks/bt/node_modules/puppeteer-core'));
const sl=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:'new',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const errs=[];
for(const w of [1440,800]){const pg=await b.newPage();await pg.setViewport({width:w,height:1000});
pg.on('console',m=>{if(m.type()==='error')errs.push(w+' '+m.text())});pg.on('pageerror',e=>errs.push(w+' '+e.message));
await pg.goto('file:///'+path.resolve('Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html').replace(/\\/g,'/'));await pg.waitForSelector('.po-marker');await sl(2500);
const T=f=>pg.evaluate(f);
const m=async tag=>{const r=await T(()=>{const g=document.querySelector('.bottom-grid');const gb=g.getBoundingClientRect();return {grid:[Math.round(gb.top+scrollY),Math.round(gb.height)],panels:[...g.children].map(p=>{const r=p.getBoundingClientRect();return [Math.round(r.top+scrollY),Math.round(r.bottom+scrollY),Math.round(r.height),p.scrollHeight>p.clientHeight+1?'scrolls':'fit']}),pageX:document.documentElement.scrollWidth>innerWidth,page:document.getElementById('amsPanel').dataset.page}});console.log(w,tag,JSON.stringify(r));
const el=await pg.$('.bottom-grid');await el.screenshot({path:`.agents/tasks/page-${w}-${tag}.png`});};
await m('p1');
await pg.click('.ams-card[data-sid="S01"]');await sl(1200);await m('p2-S01');
await pg.click('.ams-chip[data-sid="S03"]');await sl(1000);await m('p2-S03');
await pg.click('.ams-po-row[data-po="kelantan"]');await sl(800);await m('p2-S03-drawer');
await pg.keyboard.press('Escape');await sl(200);await pg.keyboard.press('Escape');await sl(900);await m('back-p1');
}
console.log('errors',JSON.stringify(errs));await b.close();})();
