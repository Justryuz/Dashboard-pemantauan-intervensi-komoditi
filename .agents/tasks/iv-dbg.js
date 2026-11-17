const p=require('./bt/node_modules/puppeteer-core');const path=require('path');
(async()=>{const b=await p.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:'new',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const pg=await b.newPage();await pg.goto('file:///'+path.resolve(__dirname,'../../Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html').replace(/\\/g,'/'));await new Promise(r=>setTimeout(r,3000));
await pg.click('#ivTabIv');await new Promise(r=>setTimeout(r,1500));
console.log(await pg.evaluate(()=>{IV_TEST.dispatch('selectPO','melaka');return JSON.stringify(document.getElementById('ivDistChips').innerText)}));await b.close()})();
