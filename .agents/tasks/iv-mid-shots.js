// Run: cd .agents/tasks/bt; node ../iv-mid-shots.js <tag> [widths]
// Clipped screenshots of .iv-grid-mid (never fullPage, max 1600x1600) + metrics.
const path=require('path');const puppeteer=require('./bt/node_modules/puppeteer-core');
const T=__dirname,ROOT=path.resolve(T,'..','..');
const URL='file:///'+path.join(ROOT,'Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html').replace(/\\/g,'/');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tag=process.argv[2]||'cur';
(async()=>{
 const br=await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:'new',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const states=[
  ['a-awal','pengeluar',null,null],
  ['b-sr','pengeluar','simpangrenggam',null],
  ['c-jb','pengguna','johor',null],
  ['d-infeasible','pengeluar','simpangrenggam','inf'],
  ['f-bukti','pengeluar',null,'ev'],
  ['e-kosong','pengeluar',null,'empty']];
 for(const w of (process.argv[3]?process.argv[3].split(','):[1440,1024,390]).map(Number)){
  const pg=await br.newPage();await pg.setViewport({width:w,height:900});
  pg.on('pageerror',e=>console.log('PAGEERR',e.message));
  await pg.goto(URL);await sleep(2500);await pg.click('#ivTabIv');await sleep(2500);
  for(const [n,mode,po,x] of states){
   await pg.evaluate((mode,po)=>{IV_TEST.dispatch('resetFilters');IV_TEST.dispatch('setMode',mode);if(po)IV_TEST.dispatch('selectPO',po)},mode,po);await sleep(1500);await pg.evaluate(()=>{const b=document.querySelector('[data-iv-arg=now]');if(b)b.click()});await sleep(300);
   if(x==='inf'){await pg.evaluate(()=>{const e=document.getElementById('ivMTarget');e.value='95';e.dispatchEvent(new Event('input',{bubbles:true}))});await sleep(500)}
   if(x==='empty'){for(let i=0;i<12;i++){const d=await pg.evaluate(()=>{const b=document.querySelector('[data-iv-arg=prev]');if(!b||b.disabled)return true;b.click();return false});if(d)break;await sleep(150)}await sleep(400)}
   if(x==='ev'){await pg.evaluate(()=>{const c=document.querySelector('.iv-muse-card');if(c)c.click()});await sleep(400);await pg.evaluate(()=>{const b=document.querySelector('[data-iv-act=museEv]');if(b)b.click()});await sleep(400)}
   const m=await pg.evaluate(()=>{const R=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {t:Math.round(b.top+scrollY),b:Math.round(b.bottom+scrollY),l:Math.round(b.left),r:Math.round(b.right),w:Math.round(b.width),h:Math.round(b.height)}};
    return {mob:R('#ivMobPanel'),mar:R('#ivMarPanel'),muse:R('#ivMusePanel'),mid:R('.iv-grid-mid'),sw:document.documentElement.scrollWidth,iw:innerWidth}});
   console.log(w,n,JSON.stringify(m));
   const el=await pg.$('.iv-grid-mid');await el.scrollIntoView();await sleep(200);
   const b=await el.boundingBox();const sx=await pg.evaluate(()=>scrollX),sy=await pg.evaluate(()=>scrollY);
   await pg.screenshot({path:path.join(T,`mid-${tag}-${w}-${n}.png`),captureBeyondViewport:true,clip:{x:b.x+sx,y:b.y+sy,width:Math.min(b.width,1600),height:Math.min(b.height,1600)}});
  }
  await pg.close();
 }
 await br.close();
})();
