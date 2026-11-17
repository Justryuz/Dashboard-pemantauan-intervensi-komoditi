const puppeteer=require('./node_modules/puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const br=await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:'new',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const pg=await br.newPage();await pg.setViewport({width:1440,height:900});pg.on('pageerror',e=>console.log('PE',e.message));pg.on('console',m=>{if(m.type()==='error')console.log('CE',m.text())});
await pg.goto('file:///C:/Users/User/Documents/2026/intervensi bencana/Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html');await sleep(3000);await pg.click('#ivTabIv');await sleep(2000);
console.log(await pg.evaluate(()=>{const b=document.getElementById('ivMd');const r=[];for(const [x,y] of [[720,450],[40,40],[1410,870],[720,8],[60,450]]){const e=document.elementFromPoint(x,y);r.push([x,y,e&&e.tagName+'#'+e.id+'.'+e.className])}return {r,anc:[...(function*(){for(let e=b.parentElement;e;e=e.parentElement)yield e.tagName+'#'+e.id+' '+getComputedStyle(e).transform+' '+getComputedStyle(e).filter+' '+getComputedStyle(e).contain}())]}}));
await pg.evaluate(()=>document.querySelector('#ivPriList [data-iv-act=tindakan]').click());await sleep(900);
console.log(await pg.evaluate(()=>{const b=document.getElementById('ivMd');const r=[];for(const [x,y] of [[720,450],[40,40],[1410,870],[720,8],[60,450]]){const e=document.elementFromPoint(x,y);r.push([x,y,e&&e.tagName+'#'+e.id+'.'+e.className])}return r}));
await br.close()})()
