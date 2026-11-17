const p=require('./bt/node_modules/puppeteer-core');const path=require('path');
(async()=>{
const b=await p.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:'new',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const pg=await b.newPage();await pg.setViewport({width:1440,height:900});
const errs=[];pg.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+': '+m.text())});pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await pg.goto('file:///'+path.resolve(__dirname,'../../Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html').replace(/\\/g,'/'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));await sleep(3500);
await pg.click('#ivTabIv');await sleep(2500);
console.log(await pg.evaluate(()=>{const T=IV_TEST;const r={};
r.mk=document.querySelectorAll('#ivMap .po-marker').length;
const lv={};['perlis','simpangrenggam','johor'].forEach(x=>lv[x]=T.poLevel(x));r.lv=lv;
T.dispatch('selectPO','simpangrenggam');
const e=T.engine();r.t1={ok:e.trigger.ok,dalam:e.dalam.map(x=>x.poId+':'+x.score+':'+x.netGap.toFixed(2)),luar:e.luar.map(x=>x.poId+':'+x.score+':'+x.netGap.toFixed(2)),ex:e.excluded.map(x=>x.poId+'='+x.reason).join('; ')};
T.dispatch('setMode','pengguna');T.dispatch('selectPO','johor');const e2=T.engine();r.t2={ok:e2.trigger.ok,ref:T.resolveMob().ref,dalam:e2.dalam.map(x=>x.poId+':'+x.score+':'+x.netGap.toFixed(2)),luar:e2.luar.map(x=>x.poId+':'+x.score+':'+x.netGap.toFixed(2)),ex:e2.excluded.map(x=>x.poId+'='+x.reason).join('; ')};
r.rows=T.priRows().slice(0,8);
return JSON.stringify(r,null,1)}));
console.log(errs.join('\n'));
await pg.screenshot({path:path.join(__dirname,'iv-smoke.png'),fullPage:false});
await b.close();})().catch(e=>{console.log('FAIL',e);process.exit(1)});

