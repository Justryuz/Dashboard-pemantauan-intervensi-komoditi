const puppeteer=require('puppeteer-core');const path=require('path');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const URL='file:///'+path.resolve(__dirname,'..','..','..','Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html').replace(/\\/g,'/');
(async()=>{
 const br=await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:'new',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 for(const w of [1440,390]){
  const pg=await br.newPage();await pg.setViewport({width:w,height:900});
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(URL);await sleep(3000);await pg.click('#ivTabIv');await sleep(2000);
  for(const th of ['gelap','cerah']){
   await pg.click('#tema'+(th==='gelap'?'Gelap':'Cerah'));await sleep(400);
   const shot=async n=>{const el=await pg.$('#ivMusePanel');await el.scrollIntoView();await sleep(250);const b=await el.boundingBox();const sy=await pg.evaluate(()=>scrollY),sx=await pg.evaluate(()=>scrollX);
    await pg.screenshot({path:path.join(__dirname,'..',`muse-${w}-${th}-${n}.png`),captureBeyondViewport:true,clip:{x:b.x+sx,y:b.y+sy,width:Math.min(b.width,1600),height:Math.min(b.height,1600)}});console.log(n,w,th,Math.round(b.width),Math.round(b.height))};
   await pg.click('[data-iv-act=museWeek][data-iv-arg=now]');await sleep(400);
   await shot('tutup');
   await pg.evaluate(()=>{[...document.querySelectorAll('.iv-muse-card')].find(c=>c.innerText.includes('Kluang')).querySelector('.iv-mc-head').click()});await sleep(300);
   await pg.click('[data-iv-act=museEv]');await sleep(200);
   await shot('buka');
   await pg.click('[data-iv-act=museWeek][data-iv-arg=prev]');await sleep(300);await shot('minggu-lepas');
   await pg.click('[data-iv-act=museWeek][data-iv-arg=prev]');await sleep(300);await shot('kosong');
  }
  console.log('errs',errs);await pg.close();
 }
 await br.close();
})();
