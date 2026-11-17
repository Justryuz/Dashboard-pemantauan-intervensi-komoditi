// Run: cd .agents/tasks/bt; node ../iv-layout-shots.js <tag>
// Clipped screenshots of .iv-grid-top (never fullPage, max 1600x1600) + metrics.
const path=require('path');const puppeteer=require('./bt/node_modules/puppeteer-core');
const T=__dirname,ROOT=path.resolve(T,'..','..');
const URL='file:///'+path.join(ROOT,'Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html').replace(/\\/g,'/');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tag=process.argv[2]||'cur';
(async()=>{
 const br=await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:'new',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const states=[['jumlah','pengeluar',null],['sr','pengeluar','simpangrenggam'],['kk','pengguna','sabah']];
 for(const w of (process.argv[3]?process.argv[3].split(','):[1440,1024,390]).map(Number)){
  const pg=await br.newPage();await pg.setViewport({width:w,height:900});
  await pg.goto(URL);await sleep(2500);await pg.click('#ivTabIv');await sleep(2500);
  for(const [n,mode,po] of states){
   await pg.evaluate((mode,po)=>{IV_TEST.dispatch('resetFilters');IV_TEST.dispatch('setMode',mode);if(po)IV_TEST.dispatch('selectPO',po)},mode,po);await sleep(1800);
   const m=await pg.evaluate(()=>{const R=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {t:Math.round(b.top+scrollY),b:Math.round(b.bottom+scrollY),l:Math.round(b.left),r:Math.round(b.right),h:Math.round(b.height),w:Math.round(b.width)}};
    const pl=document.getElementById('ivPriList');
    return {map:R('#ivMapPanel'),log:R('#ivLogPanel'),pri:R('#ivPriPanel'),list:{sh:pl.scrollHeight,ch:pl.clientHeight},sw:document.documentElement.scrollWidth,iw:innerWidth}});
   console.log(w,n,JSON.stringify(m));
   const el=await pg.$('.iv-grid-top');await el.scrollIntoView();await sleep(200);
   const b=await el.boundingBox();const sx=await pg.evaluate(()=>scrollX),sy=await pg.evaluate(()=>scrollY);
   await pg.screenshot({path:path.join(T,`lay-${tag}-${w}-${n}.png`),captureBeyondViewport:true,clip:{x:b.x+sx,y:b.y+sy,width:Math.min(b.width,1600),height:Math.min(b.height,1600)}});
  }
  await pg.close();
 }
 await br.close();
})();
