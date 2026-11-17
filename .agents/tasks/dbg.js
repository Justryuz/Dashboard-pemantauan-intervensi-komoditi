const path=require('path');const puppeteer=require(path.join(__dirname,'bt/node_modules/puppeteer-core'));
const FILE=path.resolve(process.argv[2]);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:'new',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const pg=await b.newPage();await pg.setViewport({width:1440,height:1000});await pg.goto('file:///'+FILE.replace(/\\/g,'/'));await pg.waitForSelector('.po-marker',{timeout:30000});await sleep(3000);
await pg.select('#filterState','selangor');await sleep(800);await pg.evaluate(()=>document.getElementById('backMap').click());await sleep(500);await pg.evaluate(()=>scrollTo(0,0));await sleep(700);
console.log(JSON.stringify(await pg.evaluate(()=>{const m=[...document.querySelectorAll('.po-marker')].find(e=>e.textContent==='Kuantan');const r=m&&m.getBoundingClientRect();const f=document.querySelector('.map-svg-frame').getBoundingClientRect();const c=document.querySelector('#map canvas').getBoundingClientRect();return{m:r&&[r.x,r.y,r.width,r.height],f:[f.x,f.y,f.width,f.height],c:[c.x,c.y,c.width,c.height],n:document.querySelectorAll('.po-marker').length}})));await b.close()})();

