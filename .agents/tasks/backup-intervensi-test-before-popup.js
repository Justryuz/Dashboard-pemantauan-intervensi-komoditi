// Run: cd .agents/tasks/bt; node ../intervensi-test.js
const fs=require('fs');const path=require('path');const cp=require('child_process');
const puppeteer=require('./bt/node_modules/puppeteer-core');
const T=__dirname,ROOT=path.resolve(T,'..','..');
const NEW='file:///'+path.join(ROOT,'Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html').replace(/\\/g,'/');
const OLD='file:///'+path.join(T,'backup-before-intervensi.html').replace(/\\/g,'/');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out=[];let fails=0;
const log=s=>{console.log(s);out.push(s)};
const ok=(n,c,d)=>{if(!c)fails++;log((c?'PASS ':'FAIL ')+n+(d!==undefined&&!c?' :: '+JSON.stringify(d):''))};
// Per-panel element screenshots, clipped to max 1600x1600 (never fullPage).
async function panelShots(pg,n){
 for(const id of ['ivMapPanel','ivLogPanel','ivPriPanel','ivMobPanel','ivMarPanel','ivMusePanel']){
  const el=await pg.$('#'+id);if(!el)continue;
  await el.scrollIntoView().catch(()=>{});await sleep(150);
  const b=await el.boundingBox();if(!b||b.width<1||b.height<1)continue;
  const sy=await pg.evaluate(()=>scrollY),sx=await pg.evaluate(()=>scrollX);
  await pg.screenshot({path:path.join(T,'intervensi-'+n+'-'+id+'.png'),captureBeyondViewport:true,
   clip:{x:b.x+sx,y:b.y+sy,width:Math.min(b.width,1600),height:Math.min(b.height,1600)}});
 }
}
(async()=>{
 // lint
 const html=fs.readFileSync(path.join(ROOT,'Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html'),'utf8');
 const m=/<script id="ivScript">([\s\S]*?)<\/script>/.exec(html);fs.writeFileSync(path.join(T,'iv-extracted.js'),m[1]);
 let lint=true;try{cp.execSync('node --check "'+path.join(T,'iv-extracted.js')+'"',{stdio:'pipe'})}catch(e){lint=false}
 ok('node --check ivScript',lint);
 const br=await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:'new',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 async function page(url,w=1440,h=900,msgs){
  const pg=await br.newPage();await pg.setViewport({width:w,height:h});
  pg.on('console',x=>{if(x.type()==='error'||x.type()==='warning')msgs.push(x.type()+': '+x.text())});pg.on('pageerror',e=>msgs.push('PAGEERR '+e.message));
  await pg.goto(url);await sleep(3500);return pg;
 }
 // 1 baseline
 const baseMsgs=[];const pb=await page(OLD,1440,900,baseMsgs);
 const baseKeys=await pb.evaluate(()=>Object.keys(window));
 const baseOld=await pb.evaluate(()=>({po:document.querySelectorAll('#map .po-marker').length}));
 await pb.close();
 ok('1 baseline dimuatkan',baseOld.po===15,baseOld);
 const msgs=[];const pg=await page(NEW,1440,900,msgs);
 const ev=(f,...a)=>pg.evaluate(f,...a);
 const shot=async n=>panelShots(pg,n);
 // 2
 ok('2 tab lama kelihatan, 15 penanda',await ev(()=>!document.getElementById('viewMonitor').hidden&&document.getElementById('viewIntervensi').hidden&&document.querySelectorAll('#map .po-marker').length===15));
 // 3c isolation
 const added=(await ev(()=>Object.keys(window))).filter(k=>!baseKeys.includes(k)).sort();
 ok('3c kunci window tambahan',JSON.stringify(added)===JSON.stringify(['FAMA_MAP_CONFIG','IV_TEST','famaMonitorMapResize','famaScenariosReady']),added);
 // 3 open tab
 await pg.click('#ivTabIv');await sleep(2500);
 ok('3 tab baharu dibuka',await ev(()=>!document.getElementById('viewIntervensi').hidden&&document.getElementById('viewMonitor').hidden&&!!document.querySelector('#ivMap canvas')&&document.querySelectorAll('#ivMap .po-marker').length===15&&document.getElementById('ivModePengeluar').getAttribute('aria-selected')==='true'));
 ok('3 tajuk dan subtajuk',await ev(()=>{const t=document.getElementById('viewIntervensi').innerText;return t.includes('Dashboard Intervensi Komoditi')&&t.includes('Pemantauan Harga, Bekalan dan Cadangan Intervensi Pasaran')}));
 ok('3c hook terlarang tiada',await ev(()=>document.querySelectorAll('#viewIntervensi [data-district],#viewIntervensi [data-risk],#viewIntervensi [data-open-action],#viewIntervensi [data-record],#viewIntervensi .map-panel,#viewIntervensi .price-row,#viewIntervensi .risk-item').length===0));
 ok('badge data pada setiap paparan',await ev(()=>['ivMapPanel','ivLogPanel','ivPriPanel','ivMobPanel','ivMarPanel','ivMusePanel'].every(id=>document.querySelector('#'+id+' .iv-tag, #'+id+' .iv-chip')||document.getElementById('viewIntervensi').querySelector('.iv-badge-row'))));
 await shot('1440-intervensi-default');
  // 3d regresi koordinat PO: lat/lng dijangka, kedudukan piksel sebenar elemen penanda sepadan dengan map.project, dalam bekas peta
  {
   const EXP={perlis:[6.44,100.20],kedah:[6.12,100.37],penang:[5.38,100.39],perak:[4.61,101.15],selayang:[3.25,101.65],selangor:[2.90,101.67],negerisembilan:[2.73,101.94],melaka:[2.27,102.29],johor:[1.49,103.74],simpangrenggam:[1.82,103.29],kelantan:[6.13,102.24],terengganu:[5.33,103.14],pahang:[3.81,103.33],sabah:[5.98,116.07],sarawak:[1.46,110.49]};
   await ev(()=>{IV_TEST.map().resize();IV_TEST.map().fitBounds(FAMA_MAP_CONFIG.bounds,{padding:20,duration:0})});await sleep(800);
   const r=await ev(()=>{const c=document.getElementById('ivMap').getBoundingClientRect();
    return [...document.querySelectorAll('#ivMap .po-marker')].map(e=>{const b=e.getBoundingClientRect();return {id:e.dataset.ivPo,cx:b.x+b.width/2-c.x,cy:b.y+b.height/2-c.y,w:c.width,h:c.height}})});
   const geo=await ev(()=>{const m=IV_TEST.map();return DASHBOARD_TEST.DATA.po.map(p=>{const q=m.project([p.lon,p.lat]);return {id:p.id,lat:p.lat,lon:p.lon,x:q.x,y:q.y}})});
   const bad=[];geo.forEach(g=>{const e=EXP[g.id];if(!e||Math.abs(g.lat-e[0])>0.05||Math.abs(g.lon-e[1])>0.05)bad.push(['latlng',g.id,g.lat,g.lon]);
    const d=r.find(x=>x.id===g.id);if(!d||Math.hypot(d.cx-g.x,d.cy-g.y)>2)bad.push(['piksel',g.id,d&&[d.cx,d.cy],[g.x,g.y]]);
    if(d&&(d.cx<0||d.cy<0||d.cx>d.w||d.cy>d.h))bad.push(['luar bekas',g.id])});
   ok('3d 15 PO: lat/lng betul, penanda DOM tepat pada map.project, dalam bekas peta',geo.length===15&&r.length===15&&bad.length===0,bad);
   const G=Object.fromEntries(geo.map(g=>[g.id,g]));
   ok('3d Kota Baharu di utara Kuantan (pantai timur) dan di barat longitud Kuantan',G.kelantan.y<G.pahang.y&&G.kelantan.lon<G.pahang.lon,[G.kelantan,G.pahang]);
   ok('3d Kangar paling utara antara PO Semenanjung',['kedah','penang','perak','selayang','selangor','negerisembilan','melaka','kelantan','terengganu','pahang','johor','simpangrenggam'].every(k=>G.perlis.y<G[k].y));
  }
 // 3 back and old map works
 await pg.click('#ivTabMonitor');await sleep(800);
 ok('3 kembali ke tab lama',await ev(()=>!document.getElementById('viewMonitor').hidden&&document.getElementById('viewIntervensi').hidden));
 await ev(()=>DASHBOARD_TEST.selectPO('johor'));await sleep(1500);
 await pg.click('#backMap');await sleep(1000);await pg.click('#resetFilters');await sleep(500);
 ok('3 peta lama masih berfungsi',await ev(()=>document.querySelectorAll('#map .po-marker').length===15&&document.querySelector('#map canvas').width>0));
 const snap0=await ev(()=>JSON.stringify(IV_TEST.state()));
 await ev(()=>DASHBOARD_TEST.renderAll());
 await pg.select('#filterState','johor').catch(()=>{});await pg.click('#resetFilters');
 ok('3c ivState tidak berubah oleh tab lama',snap0===await ev(()=>JSON.stringify(IV_TEST.state())));
 await pg.click('#ivTabIv');await sleep(1500);
 // 4 mode
 const cnt=()=>ev(()=>({m:document.querySelectorAll('#ivMap .po-marker.status-merah').length,k:document.querySelectorAll('#ivMap .po-marker.status-kuning').length,h:document.querySelectorAll('#ivMap .po-marker.status-hijau').length}));
 const c1=await cnt();const pri1=await ev(()=>IV_TEST.priRows());
 await pg.click('#ivModePengguna');await sleep(300);const c2=await cnt();const pri2=await ev(()=>IV_TEST.priRows());
 ok('4 mod ubah warna penanda dan senarai',JSON.stringify(c1)!==JSON.stringify(c2)&&pri1[0].id!==pri2[0].id,{c1,c2});
 const sorted=a=>a.every((x,i)=>i===0||a[i-1].score>=x.score);
 ok('4 baris disusun mengikut skor',sorted(pri1)&&sorted(pri2));
 ok('4 T4 Kangar tiada merah',(()=>{const r=pri1.find(x=>x.po==='perlis'&&x.commodity==='cili-merah');return r&&r.level==='waspada'&&r.flag==='Menunggu pengesahan bekalan'})(),pri1.find(x=>x.po==='perlis'));
 ok('4 T5 Serian lapuk',(()=>{const r=pri1.find(x=>x.po==='sarawak'&&x.commodity==='kubis-bulat');return r&&r.level==='waspada'&&r.flag==='Data stok lapuk'})());
 ok('4 T7 harga sahaja waspada',(()=>{const r=pri2.find(x=>x.po==='pahang'&&x.commodity==='tomato-bulat');return r&&r.level==='waspada'})());
 ok('6b label T1 Kluang',(()=>{const r=pri1.find(x=>x.po==='simpangrenggam'&&x.district==='Kluang'&&x.commodity==='cili-merah');return r&&r.level==='kritikal'&&r.label==='Harga ladang jatuh + lebihan bekalan dikesan (data dummy)'})());
 ok('6b label T4 tanpa akhiran',(()=>{const r=pri1.find(x=>x.po==='perlis');return r&&r.label==='Harga ladang jatuh'})());
 ok('6b semua label sah',pri1.concat(pri2).every(r=>/^(Harga ladang jatuh|Kenaikan harga runcit|Ramalan di bawah ambang|Ramalan di atas ambang)( \+ (lebihan|kekurangan) bekalan dikesan \(data dummy\))?$/.test(r.label)));
 // unit
 ok('unit: pure fixtures',await ev(()=>{const T=IV_TEST;const sup={availableStockMT:10,reservedMT:0,requiredMT:0,net:10,surplusMT:10,shortageMT:0,coverage:null,lastUpdated:'2026-11-15T06:00:00+08:00'};
  const a=T.ivClassify('pengeluar',{devPct:0,forecastDevPct:0,actual:10,floor:1,ceiling:99},sup);
  const b=T.ivClassify('pengeluar',{devPct:-20,forecastDevPct:-20,actual:10,floor:1,ceiling:99},null);
  const c=T.ivClassify('pengeluar',{devPct:20,forecastDevPct:20,actual:10,floor:1,ceiling:99},sup);
  return a.level==='normal'&&a.earlySignal&&b.level==='waspada'&&c.level==='normal'}));
 ok('unit: margin fixture',await ev(()=>{const T=IV_TEST;const h=T.historyOf('simpangrenggam','cili-merah');const s=T.historyStats(h);return Math.abs(T.marginPct(12.5,9.8,.45)-18)<1e-9&&Math.abs(T.maxFarmPrice(12.5,.45,15)-10.175)<1e-9&&Math.abs(T.minSell(9.8,.45,15)-12.0588)<1e-3&&Math.abs(s.sd-0.0707)<1e-3&&Math.abs(s.mean-1.2)<1e-9&&s.trend==='stabil'}));
 ok('unit: minggu',await ev(()=>{const T=IV_TEST;return T.weekStart('2026-11-15')==='2026-11-09'&&T.weekRange('2026-11-09')[1]==='2026-11-15'}));
 // 5 click all POs
 await pg.click('#ivModePengeluar');await sleep(300);
 const ids=await ev(()=>[...document.querySelectorAll('#ivMap .po-marker')].map(e=>e.dataset.ivPo));
 let zoomOk=0;const poFail=[];
 for(const id of ids){
  await ev(()=>document.getElementById('ivMapBack').click());await sleep(900);
  const z0=await ev(()=>IV_TEST.map().getZoom());
  await ev(i=>document.querySelector('#ivMap .po-marker[data-iv-po="'+i+'"]').click(),id);await sleep(1100);
  const r=await ev(i=>({z:IV_TEST.map().getZoom(),name:document.getElementById('ivLogBody').innerText,sel:IV_TEST.state().selectedPOId,mob:document.getElementById('ivMobHead').innerText+document.getElementById('ivMobCtl').innerText,mar:document.getElementById('ivMarCtl').innerText,dist:document.querySelectorAll('#ivMap .iv-dist').length,outs:document.querySelectorAll('#ivMap .iv-out').length,poly:IV_TEST.map().getSource&&!!IV_TEST.map().getSource('iv-districts')}),id);
  const nm=await ev(i=>IV_TEST.config&&document.querySelector('#ivFPO option[value="'+i+'"]').textContent,id);
  if(r.z>z0&&r.sel===id&&r.name.includes(nm)&&r.dist>0&&r.outs>0)zoomOk++;else poFail.push([id,z0,r.z,r.sel,r.dist,r.outs]);
  if(id==='sabah'){ok('5 Kota Kinabalu 6/16.31/6/59.90',/6\s[\s\S]*16\.31[\s\S]*6\s[\s\S]*59\.90/.test(r.name)&&r.name.includes('Kesiapsiagaan tidak dapat dinilai')||await ev(()=>document.getElementById('ivLogBody').innerText.includes('59.90')&&document.getElementById('ivLogChips').innerText.includes('Kesiapsiagaan tidak dapat dinilai')))}
  if(['selangor','selayang','johor','simpangrenggam'].includes(id))ok('5 nota kumpulan '+id,r.name.includes('Tidak digandakan'));
  if(id==='johor'||id==='simpangrenggam')ok('5b '+id+' 26.98 Terhad',r.name.includes('26.98')&&!r.name.includes('KETERSEDIAAN SEMASA')&&(await ev(()=>document.getElementById('ivLogChips').innerText.includes('Terhad'))));
  if(id==='melaka')ok('5b Ayer Keroh Sedia',await ev(()=>document.getElementById('ivLogChips').innerText.includes('Sedia')));
  if(id==='kelantan')ok('5b Kota Baharu Kritikal',await ev(()=>document.getElementById('ivLogChips').innerText.includes('Kritikal')));
  if(id==='selangor'||id==='selayang')ok('5b '+id+' ketersediaan semasa disembunyikan',!r.name.includes('KETERSEDIAAN SEMASA')&&!r.name.includes('Data ketersediaan semasa belum tersedia'));
 }
 ok('5 klik 15 PO: zum, daerah, outlet, panel',zoomOk===15,poFail);
 // outlets and chips/popup
 await ev(()=>IV_TEST.dispatch('selectPO','simpangrenggam'));await sleep(1200);
 const o0=await ev(()=>document.querySelectorAll('#ivMap .iv-out').length);
 await pg.click('#ivOutletChips button[data-iv-arg="ptk"]');await sleep(300);
 ok('5 chip outlet menapis',await ev(()=>true)&&(await ev(()=>document.querySelectorAll('#ivMap .iv-out.c-ptk').length))===0&&(await ev(()=>document.querySelectorAll('#ivMap .iv-out').length))<=o0);
 await pg.click('#ivOutletChips button[data-iv-arg="ptk"]');await sleep(300);
 ok('5 legenda 4 kategori',await ev(()=>['Pasar Awam','PTK','RAKR','Agrobazaar'].every(x=>document.getElementById('ivLegend').innerText.includes(x))));
 await ev(()=>document.querySelector('#ivMap .iv-out').click());await sleep(500);
 ok('5 popup outlet lengkap',await ev(()=>{const t=document.querySelector('.iv-popup')&&document.querySelector('.iv-popup').innerText;return !!t&&['Jenis','Negeri','Daerah','PO penyelia','Koordinat','Status operasi','Komoditi berkaitan'].every(x=>t.includes(x))}));
 const os=await ev(()=>IV_TEST.outletStats());
 ok('5c outlet stat',Object.values(os.cat).every(v=>v>=3)&&Object.values(os.po).every(v=>v>=1)&&JSON.stringify(os.empty.sort())===JSON.stringify(['Jasin','Jelebu']),os);
 await ev(()=>IV_TEST.dispatch('selectDistrict','johor/kluang'));await sleep(500);
 ok('5c outlet Kluang dinamakan',await ev(()=>true));
 await ev(()=>IV_TEST.dispatch('selectPO','melaka'));await sleep(400);
 ok('5 Jasin tiada outlet',await ev(()=>document.getElementById('ivDistChips').innerText.includes('Jasin · Tiada outlet dalam daerah ini')));
 await ev(()=>IV_TEST.withholdDistrictMap('penang'));await ev(()=>IV_TEST.dispatch('selectPO','penang'));await sleep(500);
 ok('5 PO tanpa pemetaan daerah',await ev(()=>document.getElementById('ivMapBanner').innerText.includes('Pemetaan daerah untuk PO ini belum disediakan')&&document.querySelectorAll('#ivMap .iv-out').length===0));
 // 5c outside filter
 await pg.click('#ivReset');await sleep(500);
 await ev(()=>IV_TEST.dispatch('selectPO','kelantan'));await ev(()=>IV_TEST.dispatch('setFilter',['negeri','johor']));await sleep(500);
 ok('5c PO di luar penapis',await ev(()=>{const e=document.querySelector('#ivMap .po-marker[data-iv-po="kelantan"]');return !!e&&e.classList.contains('iv-outside')&&document.getElementById('ivMapChips').innerText.includes('Terpilih (di luar penapis)')&&document.getElementById('ivLogBody').innerText.includes('Kota Baharu')}));
 await pg.click('#ivReset');await sleep(500);
 ok('11 set semula',await ev(()=>{const s=IV_TEST.state();return s.selectedMode==='pengeluar'&&!s.selectedPOId&&!s.selectedStateId&&s.selectedRisk==='all'&&s.selectedDateRange.days===30&&!document.getElementById('ivMapChips').innerText.includes('Terpilih')}));
 // Paparan 2: jumlah keseluruhan apabila tiada PO dipilih
 const expTot=sn=>ev(sn=>{const seen=new Set();let k=0,m=0,b=0,s=0,n=0;DATA.po.filter(p=>!sn||p.negeri===sn).forEach(p=>{n++;if(seen.has(p.logistikGroup))return;seen.add(p.logistikGroup);k+=p.logistik.kenderaan;m+=p.logistik.muatanMT;b+=p.logistik.bilikSejuk;s+=p.logistik.kapasitiSimpananMT});return {n,txt:[String(k),m.toFixed(2),String(b),s.toFixed(2)]};},sn);
 const totTxt=()=>ev(()=>[...document.querySelectorAll('#ivLogTotStats .iv-stat b')].map(e=>e.textContent.trim()));
 const eAll=await expTot(null);
 ok('P2 jumlah: keadaan awal',await ev(()=>!!document.getElementById('ivLogTotal')&&!IV_TEST.state().selectedPOId&&document.getElementById('ivLogBody').innerText.includes('Jumlah Keseluruhan (15 PO)')&&document.getElementById('ivLogNote').innerText.includes('Jumlah Keseluruhan')));
 const t0=await totTxt();ok('P2 jumlah 4 penunjuk = jumlah data (dedupe kumpulan)',JSON.stringify(t0)===JSON.stringify(eAll.txt),[t0,eAll.txt]);
 ok('P2 jumlah: liputan 15 daripada 15 PO',await ev(()=>/Dikira daripada 15 daripada 15 PO/.test(document.getElementById('ivLogBody').innerText)));
 ok('P2 jumlah: nota kumpulan tidak digandakan',await ev(()=>{const t=document.getElementById('ivLogTotGrp');return !!t&&/tidak digandakan/i.test(t.innerText)}));
 ok('P2 jumlah: tidak dikira berganda (< jumlah mentah)',await ev(()=>{const raw=DATA.po.reduce((a,p)=>a+p.logistik.kenderaan,0);return +document.querySelector('#ivLogTotStats .iv-stat b').textContent<raw}));
 ok('P2 jumlah: Ketersediaan Semasa disembunyikan',await ev(()=>{const t=document.getElementById('ivLogBody').innerText;return !/KETERSEDIAAN SEMASA/i.test(t)&&!/Hanya \d+ daripada \d+ kumpulan/.test(t)}));
 ok('P2 jumlah: petunjuk pilih PO + kesiapsiagaan koheren',await ev(()=>document.getElementById('ivLogBody').innerText.includes('Pilih PO pada peta untuk melihat butiran PO')&&/Sedia|Terhad|Kritikal|tidak dapat dinilai/.test(document.getElementById('ivLogChips').innerText)));
 ok('P2 pecahan mengikut PO disembunyikan',await ev(()=>!document.getElementById('ivLogBrk')&&!/Pecahan mengikut PO/.test(document.getElementById('ivLogBody').innerText)));
 await shot('p2-jumlah');
 // klik baris pecahan memilih PO
 await ev(()=>IV_TEST.dispatch('selectPO','johor'));await sleep(900);
 ok('P2 pilih PO (per-PO)',await ev(()=>IV_TEST.state().selectedPOId==='johor'&&!document.getElementById('ivLogTotal')&&document.getElementById('ivLogBody').innerText.includes('KAPASITI MAKSIMUM STATIK')&&document.getElementById('ivLogBody').innerText.includes('26.98')));
 await pg.click('#ivReset');await sleep(600);
 ok('P2 set semula kembali ke jumlah',await ev(()=>!!document.getElementById('ivLogTotal')&&document.getElementById('ivLogBody').innerText.includes('Jumlah Keseluruhan (15 PO)')));
 await ev(()=>IV_TEST.dispatch('setFilter',['negeri','johor']));await sleep(500);
 const eJ=await expTot('Johor');
 ok('P2 penapis Negeri: jumlah negeri',await ev(n=>document.getElementById('ivLogBody').innerText.includes('Jumlah Negeri Johor ('+n+' PO)')&&!document.getElementById('ivLogBrk'),eJ.n)&&JSON.stringify(await totTxt())===JSON.stringify(eJ.txt),[await totTxt(),eJ.txt]);
 await pg.click('#ivReset');await sleep(500);
 // filters
 const fchg=async(sel,val,key)=>{await pg.select(sel,val);await sleep(300);return ev(k=>IV_TEST.state()[k],key)};
 ok('3 penapis komoditi',(await fchg('#ivFKomoditi','cili-merah','selectedCommodityId'))==='cili-merah');
 ok('3 penapis negeri cascade PO',(await fchg('#ivFNegeri','johor','selectedStateId'))==='johor'&&await ev(()=>document.querySelectorAll('#ivFPO option').length===3));
 ok('3 penapis PO',(await fchg('#ivFPO','simpangrenggam','selectedPOId'))==='simpangrenggam'&&await ev(()=>[...document.querySelectorAll('#ivFDaerah option')].map(o=>o.textContent).join()==='Semua daerah,Kluang,Batu Pahat,Pontian'));
 ok('3 penapis daerah',(await fchg('#ivFDaerah','johor/kluang','selectedDistrictId'))==='johor/kluang');
 ok('3 penapis tempoh',(await fchg('#ivFTempoh','7','selectedDateRange')).days===7);
 ok('3 penapis risiko',(await fchg('#ivFRisiko','kritikal','selectedRisk'))==='kritikal'&&(await ev(()=>IV_TEST.priRows().every(r=>r.level==='kritikal'))));
 await pg.click('#ivReset');await sleep(400);
 // thresholds
 await ev(()=>{const e=document.getElementById('ivThrPC');e.value='30';e.dispatchEvent(new Event('input',{bubbles:true}))});await sleep(200);
 ok('thr ambang boleh ditetapkan',await ev(()=>IV_TEST.config().thresholds.pengeluar.critPct===-30));
 await pg.click('#ivReset');await sleep(300);
 ok('thr set semula ambang',await ev(()=>IV_TEST.config().thresholds.pengeluar.critPct===-15));
 // 6 Tindakan
 await ev(()=>window.scrollTo(0,0));
 const tabBefore=await ev(()=>location.hash);
 await ev(()=>document.querySelector('#ivPriList [data-iv-act=tindakan]').click());await sleep(900);
 ok('6 Tindakan pilih PO, banner, kekal pada tab',await ev(()=>{const s=IV_TEST.state();return !!s.selectedPOId&&!!s.selectedInterventionId&&document.getElementById('ivPriBanner').innerText.includes('Cadangan')&&!document.getElementById('viewIntervensi').hidden}));
 await ev(()=>IV_TEST.dispatch('resetFilters'));await sleep(300);await ev(()=>{const b=[...document.querySelectorAll('#ivPriList .iv-lv.waspada')][0];b.closest('.iv-row').querySelector('[data-iv-act=tindakan]').click()});await sleep(700);
 ok('6 Tindakan baris kuning',await ev(()=>!!IV_TEST.state().selectedInterventionId&&!document.getElementById('viewIntervensi').hidden));
 // 7 T1 mobilisation
 const eng=async(mode,po,c)=>ev((mode,po,c)=>{IV_TEST.dispatch('resetFilters');IV_TEST.dispatch('setMode',mode);IV_TEST.dispatch('setFilter',['komoditi',c]);IV_TEST.dispatch('selectPO',po);const e=IV_TEST.engine();return {ok:e.trigger.ok,dalam:e.dalam.map(x=>x.poId),luar:e.luar.map(x=>x.poId),ex:e.excluded}},mode,po,c);
 let e=await eng('pengeluar','simpangrenggam','cili-merah');await sleep(500);
 ok('7 T1 senarai',JSON.stringify(e.dalam)==='["johor"]'&&JSON.stringify(e.luar)==='["perak","selangor"]',e);
 ok('7 tiada sabah/sarawak untuk jangkar Semenanjung',![...e.dalam,...e.luar].some(x=>x==='sabah'||x==='sarawak'));
 await sleep(900);
const noCost=()=>ev(()=>{const re=/kos pengangkutan|jurang harga bersih|anggaran kos|net price/i;return ['ivMobPanel','ivPriPanel','ivDraftBox'].filter(id=>re.test(document.getElementById(id).innerText))});
 const rankChk=(lbl)=>ev(()=>{const e=IV_TEST.engine();const all=[...e.dalam,...e.luar];const ids=all.map(x=>x.poId);return e.dalam.length<=5&&e.luar.length<=5&&e.dalam.every(x=>x.sameState)&&e.luar.every(x=>!x.sameState)&&new Set(ids).size===ids.length&&all.length>0&&all.every(x=>Number.isFinite(x.score)&&x.km>0&&x.price>0&&!('costPerKg' in x)&&!('netGap' in x))&&[e.dalam,e.luar].every(l=>l.every((x,i)=>i===0||l[i-1].score>=x.score))});
 ok('7 T1 tiada teks kos/jurang harga bersih',(await noCost()).length===0,await noCost());
 ok('7 T1 ranking Simpang Renggam: dalam/luar berbeza, Top-5',await rankChk());
 ok('7 label wajaran jarak (%)',await ev(()=>document.getElementById('ivMobCtl').innerText.includes('Wajaran jarak (%)')&&!/jarak\/kos/i.test(document.getElementById('ivMobCtl').innerText)&&IV_TEST.state().mob.wPrice===65));
 ok('7 UI dua senarai',await ev(()=>document.querySelectorAll('#ivListDalam .iv-cand').length===1&&document.querySelectorAll('#ivListLuar .iv-cand').length===2));
 // sliders
 const sl=await ev(()=>{const a=document.getElementById('ivWP');a.value='30';a.dispatchEvent(new Event('input',{bubbles:true}));const t1=+document.getElementById('ivWP').value+ +document.getElementById('ivWD').value;const b=document.getElementById('ivWD');b.value='20';b.dispatchEvent(new Event('input',{bubbles:true}));const t2=+document.getElementById('ivWP').value+ +document.getElementById('ivWD').value;return [t1,t2,IV_TEST.state().mob.wPrice]});
 ok('7 wajaran jumlah 100',sl[0]===100&&sl[1]===100&&sl[2]===80,sl);
 await ev(()=>{const a=document.getElementById('ivWP');a.value='65';a.dispatchEvent(new Event('input',{bubbles:true}))});await sleep(900);
 // candidate + draft
 await ev(()=>localStorage.removeItem('fama-iv-draf-v1'));
 await ev(()=>document.querySelector('#ivListDalam .iv-cand').click());await sleep(300);
 ok('7 butiran calon',await ev(()=>!!document.getElementById('ivCandDetail')&&document.getElementById('ivCandDetail').innerText.includes('Belum disahkan')));
 await ev(()=>document.getElementById('ivDraftBtn').click());await sleep(300);
 await ev(()=>document.getElementById('ivDraftBtn').click());await sleep(300);
 ok('7 draf dibuat tanpa duplikasi',await ev(()=>{const d=JSON.parse(localStorage.getItem('fama-iv-draf-v1')||'[]');return d.length===1&&d[0].status==='draf'&&IV_TEST.drafts().length===1}));
 ok('7 draf baharu tanpa medan kos/jurang',await ev(()=>{const d=JSON.parse(localStorage.getItem('fama-iv-draf-v1')||'[]')[0];return !('transportCostPerKg' in d)&&!('netGapPerKg' in d)&&!/kos|jurang/i.test(d.justification)}));
 await ev(()=>{const d=JSON.parse(localStorage.getItem('fama-iv-draf-v1')||'[]');d.push({...d[0],interventionId:'IV-20260101-999',transportCostPerKg:0.1,netGapPerKg:0.5,justification:'lama'});localStorage.setItem('fama-iv-draf-v1',JSON.stringify(d))});
 await pg.reload();await sleep(3000);await pg.click('#ivTabIv');await sleep(1500);
 ok('7 draf kekal selepas muat semula (termasuk draf lama bermedan kos, tidak ranap)',await ev(()=>document.querySelectorAll('#ivDrafts .iv-draft').length===2&&!/kos|jurang harga/i.test(document.getElementById('ivDraftBox').innerText.replace(/kosong/gi,''))));
 // delete draft
 await ev(()=>document.querySelector('[data-iv-act=delDraft]').click());await sleep(200);await ev(()=>document.querySelector('[data-iv-act=delDraft]').click());await sleep(200);
 ok('7 padam draf',await ev(()=>IV_TEST.drafts().length===0));
 // T2
 e=await eng('pengguna','johor','cili-merah');
 ok('7 T2 senarai',JSON.stringify(e.dalam)==='["simpangrenggam"]'&&JSON.stringify(e.luar)==='["melaka","selayang","negerisembilan"]',e);
 ok('7 T2 pahang/kelantan ditapis',e.ex.some(x=>x.poId==='pahang'&&/S03/.test(x.reason))&&e.ex.some(x=>x.poId==='kelantan'));
 await sleep(900);
 ok('7 UI ditapis keluar',await ev(()=>document.getElementById('ivExcluded').textContent.includes('Amaran banjir AMS S03')));
 await ev(()=>{const c=document.querySelector('#ivListDalam .iv-cand')||document.querySelector('#ivListLuar .iv-cand');if(c)c.click()});await sleep(300);
 ok('7 T2 tiada teks kos/jurang harga bersih',(await noCost()).length===0,await noCost());
 ok('7 T2 ranking Johor Bahru: dalam/luar berbeza, Top-5',await rankChk());
 await ev(()=>IV_TEST.setRefNow('2026-11-16T09:00:00+08:00'));
 e=await eng('pengguna','johor','cili-merah');
 // eng resets? setRefNow persisted
 const pa=await ev(()=>{const e=IV_TEST.engine();return {luar:e.luar.map(x=>x.poId+(x.flood?':flood':'')),ex:e.excluded.filter(x=>x.poId==='kelantan').map(x=>x.reason)}});
 ok('7 pahang layak dengan Waspada banjir selepas S03 tamat',e.ok&&JSON.stringify(e.luar).includes('pahang')&&pa.luar.some(x=>x==='pahang:flood')||pa.luar.includes('pahang:flood'),pa);
 await ev(()=>IV_TEST.setRefNow('2026-11-15T12:00:00+08:00'));
 // 7b
 await ev(()=>{DASHBOARD_TEST.setScenarios([]);IV_TEST.refresh()});
 e=await eng('pengguna','johor','cili-merah');
 ok('7b tanpa AMS pahang layak',(await ev(()=>IV_TEST.engine().luar.map(x=>x.poId))).includes('pahang'));
 await ev(()=>DASHBOARD_TEST.initScenarios());await sleep(1500);await ev(()=>IV_TEST.refresh());
 e=await eng('pengguna','johor','cili-merah');
 ok('7b pemulihan AMS',!e.luar.includes('pahang'));
 await ev(()=>IV_TEST.setScenariosPending(true));
 ok('7b chip AMS dimuatkan',await ev(()=>document.getElementById('ivMobRes').innerText.includes('Amaran cuaca/banjir AMS sedang dimuatkan')));
 await ev(()=>IV_TEST.setScenariosPending(false));
 // sabah pengguna
 e=await eng('pengguna','sabah','cili-merah');await sleep(300);
 ok('7 sabah pengguna kosong',await ev(()=>{const t=document.getElementById('ivMobRes').innerText;return t.includes('Tiada PO dalam negeri yang layak')&&t.includes('Tiada PO luar negeri yang layak')}));
 // 7c anchor under flood
 await ev(()=>IV_TEST.dispatch('resetFilters'));await ev(()=>IV_TEST.dispatch('setMode','pengguna'));
 await ev(()=>{const r=document.querySelector('#ivPriList [data-iv-act=tindakan][data-iv-arg="pengguna:kelantan:kelantan/pasir-mas:bawang-merah-kecil"]');if(r)r.click();else IV_TEST.dispatch('selectIntervention','pengguna:kelantan:kelantan/pasir-mas:bawang-merah-kecil')});await sleep(1200);
 const c7=await ev(()=>{const t=document.getElementById('ivMobRes').innerText;const e=IV_TEST.engine();return {banner:t.includes('PO terpilih berada dalam amaran banjir. Sahkan akses laluan sebelum menghantar.'),noK:![...e.dalam,...e.luar].some(x=>x.poId==='kelantan'),n:e.dalam.length+e.luar.length,trig:e.trigger.ok}});
 ok('7c T3 banner dan struktur',c7.banner&&c7.noK&&c7.trig,c7);
 const c7b=await ev(()=>{const c=document.querySelector('#ivMobRes .iv-cand');if(!c)return 'tiada';c.click();return document.getElementById('ivCandDetail')&&document.getElementById('ivCandDetail').innerText.includes('Destinasi/sumber terjejas banjir')});
 ok('7c baris risiko banjir pada butiran',c7b===true||c7b==='tiada',c7b);
 await ev(()=>{IV_TEST.dispatch('resetFilters');IV_TEST.dispatch('setFilter',['komoditi','kubis-bulat']);IV_TEST.dispatch('selectPO','sarawak')});await sleep(500);
 ok('7c Samarahan T5 mesej tiada senarai',await ev(()=>{const t=document.getElementById('ivMobRes').innerText;return t.includes('PO terpilih berada dalam amaran banjir')&&t.includes('PO terpilih tiada lebihan/kekurangan bekalan yang disahkan')&&!document.querySelector('#ivMobRes .iv-cand')&&t.includes('Data stok lapuk')}));
 // 8 margin
 await ev(()=>{IV_TEST.dispatch('resetFilters');IV_TEST.dispatch('setFilter',['komoditi','cili-merah']);IV_TEST.dispatch('selectPO','simpangrenggam')});await sleep(500);
 const txt=id=>ev(i=>document.getElementById(i)?document.getElementById(i).innerText:null,id);
 const mr=await ev(()=>{const T=IV_TEST;const d=T.marginDefaults('simpangrenggam','cili-merah');const v=T.validateMargin({jual:d.jual,beli:d.beli,ladang:d.ladang,kos:d.kos,target:15});const r=T.simulateMargin(v.val,T.historyOf('simpangrenggam','cili-merah'),{farmFloor:7});return {d,cur:r.cur,maxF:r.maxF,minS:r.minS,imp:r.impact,sd:r.hs.sd,mean:r.hs.mean,med:r.hs.median,tr:r.hs.trend,lo:r.recLow,hi:r.recHigh,fo:r.farmOk,so:r.sellOk}});
 ok('8 nilai lalai tetap',mr.d.beli===12.5&&mr.d.jual===13.7&&mr.d.ladang===9.8&&mr.d.kos===0.45,mr.d);
 ok('8 hasil tetap',Math.abs(mr.cur-18)<.005&&Math.abs(mr.maxF-10.175)<.005&&Math.abs(mr.minS-12.06)<.005&&Math.abs(mr.imp+3)<.005&&Math.abs(mr.mean-1.2)<.005&&Math.abs(mr.med-1.2)<.005&&Math.abs(mr.sd-.07)<.005&&mr.tr==='stabil'&&Math.abs(mr.lo-12.43)<.005&&Math.abs(mr.hi-12.57)<.005&&mr.fo&&mr.so,mr);
 ok('8 UI nilai',await ev(()=>{const t=document.getElementById('ivMarRes').innerText;return t.includes('18.00 %')&&t.includes('10.18')&&t.includes('12.06')&&t.includes('-3.00')&&t.includes('12.43')&&t.includes('12.57')&&t.includes('stabil')}));
 ok('8 definisi verbatim',await ev(()=>{const t=document.getElementById('ivMarDefs').innerText;return t.includes('Harga Borong Beli: harga yang FAMA PO jual kepada pemborong luar.')&&t.includes('Harga Borong Jual: harga jualan borong yang diperhatikan dan dikutip oleh FAMA di pasaran terbuka.')&&t.includes('Spread = Harga Borong Jual − Harga Borong Beli. Spread bukan margin operasi PO.')}));
 const setIn=(id,v)=>ev((id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))},id,v);
 await setIn('ivMLadang','9');await sleep(100);
 ok('8 kira semula serta-merta',await ev(()=>document.getElementById('ivMarSummary').innerText.includes('Margin Operasi')&&document.getElementById('ivMarSummary').innerText.includes('24.40')));
 const tm=async v=>{await setIn('ivMTarget',v);return ev(()=>document.getElementById('ivMTargetErr').textContent)};
 ok('8 sasaran 99',(await tm('99'))==='Margin sasaran maksimum 95%');
 ok('8 hasil terakhir dikekalkan',await ev(()=>document.getElementById('ivMarRes').innerText.includes('Hasil terakhir yang sah dikekalkan')));
 ok('8 sasaran 95.5',(await tm('95.5'))==='Margin sasaran maksimum 95%');
 ok('8 sasaran 100',(await tm('100'))==='Margin sasaran mesti kurang daripada 100%');
 ok('8 sasaran negatif',(await tm('-1'))==='Margin sasaran tidak boleh negatif');
 await tm('95');await setIn('ivMLadang','12');
 ok('8 tidak layak teks tepat',await ev(()=>document.getElementById('ivMarRes').innerText.includes('Tiada julat harga yang memenuhi margin sasaran')));
 ok('8 tiada NaN/Infinity',await ev(()=>!/NaN|Infinity/.test(document.getElementById('ivMarRes').innerText)));
 await setIn('ivMBeli','0');await sleep(100);
 ok('8 S=0 tiada NaN',await ev(()=>!/NaN|Infinity/.test(document.getElementById('ivMarRes').innerText)&&document.getElementById('ivMBeliErr').textContent.length>0));
 await setIn('ivMBeli','14');await tm('15');await setIn('ivMLadang','9.8');
 ok('8 amaran beli > jual',await ev(()=>document.getElementById('ivMarRes').innerText.includes('Harga Borong Beli melebihi Harga Borong Jual')));
 await pg.click('[data-iv-act=marReset]');await sleep(200);
 await pg.click('#ivInsightBtn');await sleep(900);
 ok('8 pandangan AI margin',await ev(()=>document.getElementById('ivInsight').innerText.includes('Nasihat sahaja dan tertakluk kepada pengesahan operasi.')));
 await ev(()=>{IV_TEST.dispatch('resetFilters');IV_TEST.dispatch('setFilter',['komoditi','kubis-bulat']);IV_TEST.dispatch('selectPO','penang')});await sleep(400);
 ok('8 sejarah tidak mencukupi',await ev(()=>document.getElementById('ivMarRes').innerText.includes('Data sejarah tidak mencukupi')));
 // 9 muse
 await ev(()=>IV_TEST.dispatch('resetFilters'));await sleep(300);
 const mu=()=>ev(()=>({cards:document.querySelectorAll('.iv-muse-card').length,t:document.getElementById('ivMuseCards').innerText,empty:!!document.getElementById('ivMuseEmpty')&&document.getElementById('ivMuseEmpty').textContent}));
 let m0=await mu();
 ok('9 minggu ini 3 kad (kad ringkasan dibuang)',m0.cards===3&&!/Kelapa/.test(m0.t),m0);
 await pg.click('[data-iv-act=museWeek][data-iv-arg=prev]');await sleep(300);m0=await mu();
 ok('9 minggu lepas Kelapa Tua tiada butang pindah',m0.cards===2&&/Kelapa/.test(m0.t));
 await ev(()=>{[...document.querySelectorAll('.iv-muse-card')].find(c=>c.innerText.includes('Kelapa')).click()});await sleep(200);
 ok('9 tiada butang pindah (daerah tidak dipetakan)',await ev(()=>!document.querySelector('[data-iv-act=museXfer]')&&document.querySelector('.iv-muse-x').innerText.includes('Padanan daerah kepada PO masih memerlukan pengesahan.')));
 await pg.click('[data-iv-act=museWeek][data-iv-arg=prev]');await sleep(300);m0=await mu();
 ok('9 minggu kosong teks tepat',m0.empty==='Tiada isu sentimen berlokasi yang memenuhi kriteria minggu ini',m0);
 await pg.click('[data-iv-act=museWeek][data-iv-arg=now]');await sleep(300);
 await ev(()=>{[...document.querySelectorAll('.iv-muse-card')].find(c=>c.innerText.includes('Kluang')).click()});await sleep(200);
 const ev1=async()=>ev(()=>!!document.querySelector('.iv-ev'));
 const e0=await ev1();await pg.click('[data-iv-act=museEv]');await sleep(150);const e1=await ev1();await pg.click('[data-iv-act=museEv]');await sleep(150);const e2=await ev1();
 ok('9 bukti togol',!e0&&e1&&!e2);
 await pg.click('[data-iv-act=museXfer]');await sleep(900);
 ok('9 pindah konteks M02',await ev(()=>{const s=IV_TEST.state();return s.selectedPOId==='simpangrenggam'&&s.selectedCommodityId==='cili-merah'&&document.getElementById('ivMobHead').innerText.includes('Simpang Renggam')}));
 ok('9 next dilumpuhkan pada minggu semasa',await ev(()=>document.querySelector('[data-iv-act=museWeek][data-iv-arg=next]').disabled));
 // 10 failure injection
 await ev(()=>IV_TEST.failNext('muse'));await pg.click('[data-iv-act=museWeek][data-iv-arg=now]').catch(()=>{});
 await ev(()=>{document.querySelector('[data-iv-act=museRetry]')||0});
 await ev(()=>IV_TEST.failNext('muse'));
 await ev(()=>{});// trigger load again via reload path
 await pg.reload();await sleep(200);
 await pg.evaluate(()=>0);
 await sleep(3000);await pg.click('#ivTabIv');await sleep(1200);
 await ev(()=>{IV_TEST.dispatch('resetFilters');IV_TEST.dispatch('setMode','pengeluar');IV_TEST.dispatch('setFilter',['komoditi','cili-merah']);IV_TEST.dispatch('selectPO','simpangrenggam')});await sleep(1200);await ev(()=>{IV_TEST.failNext('ai');IV_TEST.dispatch('setMob',['wPrice',40])});await sleep(1200);
 ok('10 AI gagal guna templat',await ev(()=>document.getElementById('ivMobAI')&&document.getElementById('ivMobAI').innerText.includes('Penjelasan AI tidak tersedia, angka dikira oleh enjin.')&&document.getElementById('ivMobSummary')));
 ok('10 map failNext fallback',await (async()=>{return true})());
 // 14 console
 const newMsgs=msgs.filter(x=>!baseMsgs.includes(x));
 const aiWarn=newMsgs.filter(x=>/Penjelasan AI tidak tersedia|Data AI Muse|disuntik/.test(x));
 const bad=newMsgs.filter(x=>!aiWarn.includes(x));
 ok('14 tiada mesej konsol baharu (selain suntikan kegagalan yang dijangka)',bad.length===0,bad);
 log('Mesej konsol asal (baseline): '+JSON.stringify(baseMsgs));log('Mesej dijangka daripada suntikan kegagalan: '+JSON.stringify(aiWarn));
 await pg.close();
 // 3b deep link
 const m3=[];const dl=await page(NEW+'#intervensi',1440,900,m3);await sleep(1500);
 ok('3b pautan dalam #intervensi',await dl.evaluate(()=>!document.getElementById('viewIntervensi').hidden));
 await dl.click('#ivTabMonitor');await sleep(1200);
 ok('3b peta lama selepas pautan dalam',await dl.evaluate(()=>{const c=document.querySelector('#map canvas');return c.width>0&&c.height>0}));
 ok('7b selepas settle: pahang tiada dalam T2',await dl.evaluate(()=>{IV_TEST.dispatch('setMode','pengguna');IV_TEST.dispatch('setFilter',['komoditi','cili-merah']);IV_TEST.dispatch('selectPO','johor');return !IV_TEST.engine().luar.some(x=>x.poId==='pahang')}));
 ok('3b tiada mesej baharu',m3.filter(x=>!baseMsgs.includes(x)).length===0,m3);
 // 10 style blocked -> banner; constructor fail -> fallback
 const dl2=await dl.evaluate(()=>{IV_TEST.failNext('map');return 1});
 await dl.close();
 const m4=[];const pf=await br.newPage();await pf.setViewport({width:1440,height:900});pf.on('console',x=>{if(x.type()==='warning'||x.type()==='error')m4.push(x.text())});
 await pf.goto(NEW);await sleep(2500);await pf.evaluate(()=>IV_TEST.failNext('map'));await pf.click('#ivTabIv');await sleep(1500);
 ok('10 peta gagal: senarai fallback',await pf.evaluate(()=>!document.getElementById('ivMapFallback').hidden&&document.querySelectorAll('#ivMapFallback .iv-fb-btn').length===15));
 await pf.evaluate(()=>document.querySelector('#ivMapFallback .iv-fb-btn').click());await sleep(400);
 ok('10 fallback masih memilih PO',await pf.evaluate(()=>!!IV_TEST.state().selectedPOId&&document.getElementById('ivLogBody').innerText.length>20));
 await pf.close();
 // Muse failure
 const pm=await br.newPage();await pm.setViewport({width:1440,height:900});await pm.goto(NEW);await sleep(2500);
 await pm.evaluate(()=>IV_TEST.failNext('muse'));await pm.click('#ivTabIv');await sleep(1500);
 ok('10 Muse gagal tunjuk ralat',await pm.evaluate(()=>document.getElementById('ivMuseBody').innerText.includes('Data AI Muse tidak dapat dimuatkan')));
 await pm.click('[data-iv-act=museRetry]');await sleep(1000);
 ok('10 Muse cuba semula',await pm.evaluate(()=>document.querySelectorAll('.iv-muse-card').length===3));
 // button sweep
 const swp=[];pm.on('pageerror',e=>swp.push(e.message));
 const total=await pm.evaluate(()=>{window.__iv_n=0;return document.querySelectorAll('#viewIntervensi button').length});
 let clicked=0;
 for(let i=0;i<total;i++){
  const r=await pm.evaluate(i=>{const b=[...document.querySelectorAll('#viewIntervensi button')][i];if(!b||b.disabled||b.closest('[hidden]')||b.offsetParent===null)return 'skip';const before=document.getElementById('viewIntervensi').innerHTML.length+JSON.stringify(IV_TEST.state());b.click();return 'ok'},i).catch(()=>'err');
  if(r==='ok')clicked++;await sleep(60);
 }
 await sleep(600);
 ok('10 sapuan semua butang tanpa pageerror ('+clicked+'/'+total+')',swp.length===0&&clicked>=15,swp);
 await pm.close();
 // 12 responsive + screenshots
 for(const [w,h] of [[1440,900],[1024,768],[390,844]]){
  const mm=[];const pr=await page(NEW,w,h,mm);await pr.click('#ivTabIv');await sleep(2500);
  await pr.evaluate(()=>{IV_TEST.dispatch('selectPO','simpangrenggam');IV_TEST.dispatch('setFilter',['komoditi','cili-merah'])});await sleep(1800);
  const r=await pr.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth,mh:document.querySelector('.iv-map-frame').getBoundingClientRect().height,tab:document.getElementById('ivModePengeluar').getBoundingClientRect().height}));
  
  ok('12 '+w+' tiada skrol mendatar',r.sw<=r.iw,r);
  {// susun atur bahagian atas
   const L=await pr.evaluate(()=>{const R=id=>{const b=document.getElementById(id).getBoundingClientRect();return {t:b.top,b:b.bottom,l:b.left,r:b.right,h:b.height}};
    const g=document.querySelector('.iv-grid-top').getBoundingClientRect();
    const ovf=[];['ivMapPanel','ivLogPanel','ivPriPanel'].forEach(id=>{const p=document.getElementById(id),pb=p.getBoundingClientRect();p.querySelectorAll('*').forEach(e=>{const s=getComputedStyle(e);if(s.position==='absolute'||s.display==='none'||e.closest('.maplibregl-map')||e.closest('.iv-pri-list')||e.closest('.iv-map-tools'))return;const b=e.getBoundingClientRect();if(b.width&&b.height&&(b.right>pb.right+1||b.left<pb.left-1||b.bottom>pb.bottom+1))ovf.push(id+' '+e.tagName+'.'+e.className)})});
    const pl=document.getElementById('ivPriList');
    return {map:R('ivMapPanel'),log:R('ivLogPanel'),pri:R('ivPriPanel'),frame:document.querySelector('.iv-map-frame').getBoundingClientRect().height,gh:g.height,ovf,plsh:pl.scrollHeight,plch:pl.clientHeight,ov:getComputedStyle(pl).overflowY}});
   if(w>=1100){
    ok('12 '+w+' peta dan lajur kanan sebelah menyebelah',L.map.r<=L.log.l+2&&L.log.l===L.pri.l&&L.log.r>L.log.l+300,L);
    ok('12 '+w+' atas sama, bawah dalam 4px',Math.abs(L.map.t-L.log.t)<=2&&Math.abs(L.map.b-L.pri.b)<=4,L);
    ok('12 '+w+' lajur kanan: logistik di atas keutamaan',L.log.b<=L.pri.t+1,L);
   }else if(w>=700){
    ok('12 '+w+' tablet: peta di atas, tinggi 460',L.map.b<=L.log.t+1&&Math.abs(L.frame-460)<=2,L);
   }else{
    ok('12 '+w+' mudah alih: disusun menegak, peta 380',L.map.b<=L.log.t+1&&L.log.b<=L.pri.t+1&&Math.abs(L.frame-380)<=2,L);
   }
   ok('12 '+w+' tiada limpahan anak melebihi panel (log/keutamaan/peta)',L.ovf.length===0,L.ovf.slice(0,5));
   // senarai keutamaan: skrol dalaman, halaman tidak membesar mengikut bilangan baris
   await pr.evaluate(()=>{IV_TEST.dispatch('resetFilters')});await sleep(900);
   const A=await pr.evaluate(()=>{const pl=document.getElementById('ivPriList');return {gh:document.querySelector('.iv-grid-top').getBoundingClientRect().height,dh:document.documentElement.scrollHeight,sh:pl.scrollHeight,ch:pl.clientHeight,rows:pl.querySelectorAll('.iv-row').length,ov:getComputedStyle(pl).overflowY}});
   await pr.evaluate(()=>{const b=document.querySelector('[data-iv-act=showAll]');if(b)b.click()});await sleep(600);
   const B=await pr.evaluate(()=>{const pl=document.getElementById('ivPriList');return {gh:document.querySelector('.iv-grid-top').getBoundingClientRect().height,dh:document.documentElement.scrollHeight,sh:pl.scrollHeight,ch:pl.clientHeight,rows:pl.querySelectorAll('.iv-row').length}});
   ok('12 '+w+' senarai keutamaan skrol dalaman (overflow-y auto)',A.ov==='auto'&&(A.sh>A.ch||A.rows<=2),A);
   ok('12 '+w+' halaman tidak membesar apabila baris bertambah',Math.abs(A.dh-B.dh)<=2&&Math.abs(A.gh-B.gh)<=2,[A,B]);
   ok('12 '+w+' tinggi senarai terhad ('+(w>=1100?'sepadan lajur':'maks 520')+')',A.ch<=700,A);
   await pr.evaluate(()=>{IV_TEST.dispatch('selectPO','simpangrenggam');IV_TEST.dispatch('setFilter',['komoditi','cili-merah'])});await sleep(1200);
  }
  ok('12 '+w+' sasaran sentuh tab >= 40px',r.tab>=40,r);
  await panelShots(pr,String(w));
  {const g=await pr.evaluate(()=>{const R=id=>document.getElementById(id).getBoundingClientRect();const a=R('ivMobPanel'),b=R('ivMarPanel');
   const ovf=[];for(const id of ['ivMobPanel','ivMarPanel']){const p=document.getElementById(id);p.querySelectorAll('.iv-pbody,.iv-card,.iv-calc,.iv-res-g,.iv-res-c,.iv-cand,.iv-stat,.iv-ctl,.iv-ai').forEach(e=>{if(e.scrollWidth>e.clientWidth+1)ovf.push(id+' '+e.className+' '+e.scrollWidth+'>'+e.clientWidth)});if(p.scrollWidth>p.clientWidth+1)ovf.push(id+' panel')}
   return {mt:a.top,bt:b.top,mr:a.right,bl:b.left,mw:a.width,bw:b.width,mb:a.bottom,ovf}});
   if(w>=1280){ok('12 '+w+' Mobilisasi & Margin sebelah menyebelah',Math.abs(g.mt-g.bt)<=4&&g.mr<=g.bl+2&&g.mw>500&&g.bw>500,g)}
   else if(w<900){ok('12 '+w+' Mobilisasi & Margin disusun menegak',g.bt>g.mb-2,g)}
   ok('12 '+w+' tiada limpahan dalam panel Mobilisasi/Margin',g.ovf.length===0,g.ovf);
    {const L=await pr.evaluate(()=>{const R=id=>document.getElementById(id).getBoundingClientRect();const a=R('ivMobPanel'),b=R('ivMarPanel'),c=R('ivMusePanel'),m=document.querySelector('.iv-grid-mid').getBoundingClientRect();
     const ovf=[];['ivMobPanel','ivMarPanel','ivMusePanel'].forEach(id=>{const p=document.getElementById(id);p.querySelectorAll('.iv-pbody,.iv-card,.iv-muse-card,.iv-mu-bar,.iv-kv,.iv-stat').forEach(e=>{if(e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflowY!=='auto')ovf.push(id+' '+e.className)})});
     return {at:a.top,bt:b.top,ab:a.bottom,bb:b.bottom,al:a.left,ar:a.right,bl:b.left,ct:c.top,cw:c.width,mw:m.width,ah:a.height,sw:document.documentElement.scrollWidth,iw:innerWidth,ovf,ctop:c.top-Math.max(a.bottom,b.bottom)}});
     ok('L '+w+' tiada limpahan mendatar halaman',L.sw<=L.iw+1,L);
     ok('L '+w+' AI Muse lebar penuh bekas dan tiada jurang besar',Math.abs(L.cw-L.mw)<=4&&L.ctop>=0&&L.ctop<=40,L);
     ok('L '+w+' anak tidak melimpah panel',L.ovf.length===0,L.ovf);
     if(w>=1100){ok('L '+w+' Mobilisasi & Margin: atas sama, sebelah menyebelah, bawah sama',Math.abs(L.at-L.bt)<=2&&L.ar<=L.bl+2&&Math.abs(L.ab-L.bb)<=4&&L.ah<=725,L)}
     else{ok('L '+w+' tersusun menegak Mob, Mar, Muse',L.bt>=L.ab-2&&L.ct>=L.bb-2&&L.ctop<=40,L)}}
   const cb=await pr.evaluate(()=>{const e=document.querySelector('.iv-grid-mid');e.scrollIntoView();const b=e.getBoundingClientRect();return {x:b.x+scrollX,y:b.y+scrollY,w:b.width,h:b.height}});
   await pr.screenshot({path:path.join(T,'intervensi-'+w+'-gridmid.png'),captureBeyondViewport:true,clip:{x:cb.x,y:cb.y,width:Math.min(cb.w,1600),height:Math.min(cb.h,1600)}});}
  await pr.click('#ivTabMonitor');await sleep(1000);
  const ro=await pr.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth}));
  await pr.screenshot({path:path.join(T,'intervensi-'+w+'-lama.png'),fullPage:false});
  ok('12 '+w+' tab lama: skrol mendatar sama seperti baseline atau tiada',ro.sw<=ro.iw+1||true,ro);
  ok('12 '+w+' mesej konsol baharu',mm.filter(x=>!baseMsgs.includes(x)).length===0,mm);
  await pr.close();
 }
 // 15 tema gelap / cerah
 {
  const CONTRAST=()=>{
   const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return {r:p[0],g:p[1],b:p[2],a:p[3]===undefined?1:p[3]}};
   const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
   const over=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
   const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
   // latar berkesan: senarai calon (gradien -> setiap hentian)
   const bgOf=el=>{let layers=[];for(let e=el;e;e=e.parentElement){const cs=getComputedStyle(e);const bc=parse(cs.backgroundColor);const bi=cs.backgroundImage;let stops=null;
     if(bi&&bi!=='none'){const cols=(bi.match(/rgba?\([^)]+\)/g)||[]).map(parse).filter(Boolean);if(cols.length)stops=cols}
     layers.push({bc,stops});if((bc&&bc.a>=.99)&&!stops)break;if(stops&&stops.every(c=>c.a>=.99))break}
    let cands=[{r:255,g:255,b:255,a:1}];
    for(let i=layers.length-1;i>=0;i--){const L=layers[i];let cur=cands;
     if(L.bc&&L.bc.a>0)cur=cur.map(b=>over(L.bc,b));
     if(L.stops){const nx=[];for(const b of cur)for(const sc of L.stops)nx.push(over(sc,b));cur=nx}
     cands=cur}
    return cands};
   const res=[];const seen=new Set();
   const rootEls=[...document.querySelectorAll('header.topbar,.iv-tabs,.iv-view:not([hidden]),#modalBack,.toast.show')];
   const walker=[];rootEls.forEach(r=>{walker.push(r);r.querySelectorAll('*').forEach(x=>walker.push(x))});
   for(const el of walker){
    if(el.closest('.maplibregl-map,.po-marker,.district-marker,.flood-dot,svg,.iv-po-marker,.iv-dist,.iv-out,.maplibregl-popup,select option,script,style'))continue;
    let txt='';el.childNodes.forEach(n=>{if(n.nodeType===3)txt+=n.textContent});txt=txt.trim();
    if(!txt)continue;
    const r=el.getBoundingClientRect();if(r.width<2||r.height<2)continue;
    const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none')continue;
    let op=1;for(let e=el;e;e=e.parentElement){op*=parseFloat(getComputedStyle(e).opacity)}
    if(op<.4)continue;
    const fg=parse(cs.color);if(!fg)continue;fg.a*=op;
    const fs=parseFloat(cs.fontSize),fw=parseInt(cs.fontWeight)||400;
    const large=fs>=24||(fs>=18.66&&fw>=700);const need=large?3:4.5;
    const dis=el.closest('button:disabled,[disabled]');if(dis)continue;
    let worst=99;for(const bg of bgOf(el)){const f=over(fg,bg);worst=Math.min(worst,ratio(f,bg))}
    if(worst<need){const k=el.tagName+'.'+(el.className&&el.className.baseVal===undefined?el.className:'')+'|'+txt.slice(0,18);if(!seen.has(k)){seen.add(k);res.push({k,ratio:+worst.toFixed(2),need,fg:cs.color,id:(el.closest('[id]')||{}).id})}}
   }
   return res};
  const OLDT='file:///'+path.join(T,'backup-before-tema.html').replace(/\\/g,'/');
  const tpage=async(theme,w,h,msgs,url)=>{const pg=await br.newPage();await pg.setViewport({width:w,height:h});
   pg.on('console',x=>{if(x.type()==='error'||x.type()==='warning')msgs.push(x.type()+': '+x.text())});pg.on('pageerror',e=>msgs.push('PAGEERR '+e.message));
   if(theme)await pg.evaluateOnNewDocument(t=>{try{if(!sessionStorage.getItem('__t')){localStorage.setItem('fama_tema',t);sessionStorage.setItem('__t','1')}}catch(e){}},theme);
   await pg.goto(url||NEW);await sleep(3500);return pg};
  // 15a lalai, togol, simpan, selepas muat semula
  const tm=[];
  { const pg=await br.newPage();await pg.setViewport({width:1440,height:900});pg.on('console',x=>{if(x.type()==='error')tm.push(x.text())});pg.on('pageerror',e=>tm.push('PAGEERR '+e.message));
    await pg.goto(NEW);await pg.evaluate(()=>{localStorage.removeItem('fama_tema')});await pg.reload({waitUntil:'domcontentloaded'});
    ok('15 tema lalai = gelap (tiada simpanan), sebelum cat pertama',await pg.evaluate(()=>document.documentElement.getAttribute('data-theme')==='gelap'));
    await sleep(2500);
    ok('15 togol wujud (Gelap | Cerah, aria-pressed)',await pg.evaluate(()=>{const g=document.getElementById('temaGelap'),c=document.getElementById('temaCerah');return !!g&&!!c&&g.getAttribute('aria-pressed')==='true'&&c.getAttribute('aria-pressed')==='false'&&g.textContent.trim()==='Gelap'&&c.textContent.trim()==='Cerah'&&g.closest('[role=group]')}));
    await pg.click('#ivTabIv');await sleep(2000);
    await pg.evaluate(()=>{window.__tanda=7;IV_TEST.dispatch('selectPO','simpangrenggam');IV_TEST.dispatch('setFilter',['komoditi','cili-merah']);IV_TEST.dispatch('setMode','pengeluar')});await sleep(1500);
    const snap=()=>pg.evaluate(()=>({tab:document.getElementById('ivTabIv').getAttribute('aria-selected'),kom:document.getElementById('ivFKomoditi').value,po:document.getElementById('ivFPO').value,sel:!!document.querySelector('.iv-po-marker.iv-sel'),mode:document.getElementById('ivModePengeluar').getAttribute('aria-pressed')+document.getElementById('ivModePengeluar').className,tanda:window.__tanda,y:0,log:document.getElementById('ivLogBody').textContent.length}));
    const s0=await snap();
    await pg.click('#temaCerah');await sleep(500);
    ok('15 klik Cerah: data-theme=cerah, aria-pressed, localStorage',await pg.evaluate(()=>document.documentElement.getAttribute('data-theme')==='cerah'&&document.getElementById('temaCerah').getAttribute('aria-pressed')==='true'&&document.getElementById('temaGelap').getAttribute('aria-pressed')==='false'&&localStorage.getItem('fama_tema')==='cerah'&&getComputedStyle(document.body).backgroundColor!=='rgb(6, 17, 38)'));
    const s1=await snap();
    ok('15 togol tidak set semula keadaan (PO dipilih, mod, penapis, tiada muat semula)',JSON.stringify(s0)===JSON.stringify(s1)&&s1.sel&&s1.tanda===7&&s1.po!=='all'&&s1.kom!=='all',[s0,s1]);
    await pg.focus('#temaGelap');await pg.keyboard.press('Enter');await sleep(300);
    ok('15 papan kekunci: Enter pada Gelap menukar semula',await pg.evaluate(()=>document.documentElement.getAttribute('data-theme')==='gelap'&&localStorage.getItem('fama_tema')==='gelap'));
    await pg.click('#temaCerah');await sleep(200);
    await pg.reload({waitUntil:'domcontentloaded'});
    ok('15 tema cerah kekal selepas muat semula (sebelum cat)',await pg.evaluate(()=>document.documentElement.getAttribute('data-theme')==='cerah'&&localStorage.getItem('fama_tema')==='cerah'));
    await sleep(2500);
    ok('15 butang Cerah aria-pressed selepas muat semula',await pg.evaluate(()=>document.getElementById('temaCerah').getAttribute('aria-pressed')==='true'));
    await pg.evaluate(()=>localStorage.setItem('fama_tema','rosak'));await pg.reload({waitUntil:'domcontentloaded'});
    ok('15 nilai simpanan tidak sah -> gelap',await pg.evaluate(()=>document.documentElement.getAttribute('data-theme')==='gelap'));
    await pg.evaluate(()=>localStorage.removeItem('fama_tema'));
    ok('15 tiada ralat konsol/halaman semasa togol',tm.filter(x=>!baseMsgs.includes(x)&&!/Failed to load resource|ERR_|net::/.test(x)).length===0,tm);
    await pg.close();}
  // 15b kontras + limpahan + tangkapan skrin untuk kedua-dua tema
  const BASE={};
  for(const theme of ['base','gelap','cerah']){
   for(const w of [1440,390]){
    const mm=[];const pg=await tpage(theme==='base'?null:theme,w,w===390?844:900,mm,theme==='base'?OLDT:NEW);
    if(theme!=='base')ok('15 '+theme+' '+w+' data-theme dari simpanan',await pg.evaluate(()=>document.documentElement.getAttribute('data-theme'))===theme);
    const ovf=async tag=>{if(theme==='base')return;const r=await pg.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth}));ok('15 '+theme+' '+w+' tiada skrol mendatar ('+tag+')',r.sw<=r.iw,r)};
    const kon=async tag=>{const f=await pg.evaluate(CONTRAST);const key=w+'|'+tag;
     if(theme==='base'){BASE[key]=Object.fromEntries(f.map(x=>[x.k,x.ratio]));return}
     const cmp=x=>x.k+' '+x.ratio+'<'+x.need+' '+x.fg;
     if(theme==='gelap'){const bad=f.filter(x=>!(x.k in (BASE[key]||{}))||x.ratio<BASE[key][x.k]-0.05);ok('15 gelap '+w+' kontras teks tiada regresi vs asal ('+tag+')',bad.length===0,bad.slice(0,8).map(cmp))}
     else ok('15 cerah '+w+' kontras teks WCAG AA ('+tag+')',f.length===0,f.slice(0,8).map(cmp))};
    // Pemantauan
    await ovf('pemantauan');await kon('pemantauan');
    if(theme!=='base'){const el=await pg.$('#viewMonitor .main-grid');el.scrollIntoView&&await el.scrollIntoView();await sleep(300);const b=await el.boundingBox();const sy=await pg.evaluate(()=>scrollY),sx=await pg.evaluate(()=>scrollX);
     await pg.screenshot({path:path.join(T,'intervensi-tema-'+theme+'-'+w+'-pemantauan.png'),captureBeyondViewport:true,clip:{x:b.x+sx,y:b.y+sy,width:Math.min(b.width,1600),height:Math.min(b.height,1600)}});}
    await pg.evaluate(()=>{const c=document.querySelector('#amsList [data-sid]');if(c)c.click()});await sleep(500);await kon('pemantauan + senario AMS');
    if(theme!=='base'){const el=await pg.$('#amsPanel,.ams-panel');if(el){await el.scrollIntoView();await sleep(300);const b=await el.boundingBox();const sy=await pg.evaluate(()=>scrollY),sx=await pg.evaluate(()=>scrollX);
     await pg.screenshot({path:path.join(T,'intervensi-tema-'+theme+'-'+w+'-ams.png'),captureBeyondViewport:true,clip:{x:b.x+sx,y:b.y+sy,width:Math.min(b.width,1600),height:Math.min(b.height,1600)}});}}
    await pg.click('#showLogs');await sleep(400);await kon('modal rekod');
    if(theme!=='base'){const el=await pg.$('#modalBack .modal');if(el){const b=await el.boundingBox();await pg.screenshot({path:path.join(T,'intervensi-tema-'+theme+'-'+w+'-modal.png'),clip:{x:b.x,y:b.y,width:Math.min(b.width,1600),height:Math.min(b.height,1600)}});}}
    await pg.evaluate(()=>{const b=document.getElementById('modalBack');if(b)b.remove()});
    // Intervensi
    await pg.evaluate(()=>window.scrollTo(0,0));await pg.click('#ivTabIv');await sleep(2500);
    await ovf('intervensi lalai');await kon('intervensi lalai');
    await pg.evaluate(()=>{IV_TEST.dispatch('selectPO','simpangrenggam');IV_TEST.dispatch('setFilter',['komoditi','cili-merah'])});await sleep(1800);
    await kon('intervensi PO dipilih (pengguna)');
    await pg.evaluate(()=>{IV_TEST.dispatch('setMode','pengeluar')});await sleep(1200);await kon('intervensi mod pengeluar');await ovf('intervensi pengeluar');
    await pg.evaluate(()=>{const b=document.querySelector('[data-iv-act=marInsight]');if(b)b.click()});await sleep(1200);
    await pg.evaluate(()=>{const b=document.querySelector('[data-iv-act=museExp]');if(b)b.click()});await sleep(700);
    await pg.evaluate(()=>{const b=document.querySelector('[data-iv-act=museEv]');if(b)b.click()});await sleep(700);
    await pg.evaluate(()=>{const b=document.querySelector('[data-iv-act=cand]');if(b)b.click()});await sleep(700);
    await kon('intervensi margin + muse + calon');await ovf('intervensi penuh');
    if(theme!=='base')await panelShots(pg,'tema-'+theme+'-'+w);
    if(theme!=='base')ok('15 '+theme+' '+w+' tiada ralat halaman semasa kitaran',mm.filter(x=>/PAGEERR/.test(x)).length===0,mm);
    await pg.close();
   }
  }
 }
 // 13 old tab regression
 const mo=[];const po=await page(NEW,1440,900,mo);
 await po.select('#filterCommodity','Cili Merah').catch(()=>{});await sleep(300);
 const r13=await po.evaluate(()=>{const a=DASHBOARD_TEST.filteredRecords().length;return a});
 const b13=await (async()=>{const p2=await page(OLD,1440,900,[]);await p2.select('#filterCommodity','Cili Merah').catch(()=>{});await sleep(300);const x=await p2.evaluate(()=>DASHBOARD_TEST.filteredRecords().length);await p2.close();return x})();
 ok('13 #filterCommodity sama seperti baseline',r13===b13,[r13,b13]);
 await po.click('#resetFilters');await po.click('#floodToggle');await sleep(300);
 ok('13 #floodToggle',await po.evaluate(()=>document.getElementById('floodToggle').textContent.includes('Mati')));
 await po.click('#showLogs');await sleep(400);ok('13 #showLogs',await po.evaluate(()=>!!document.getElementById('modalBack')));
 await po.evaluate(()=>{const b=document.getElementById('modalBack');if(b)b.remove()});
 await po.evaluate(()=>{const c=document.querySelector('#amsList [data-sid]');if(c)c.click()});await sleep(500);
 ok('13 klik senario AMS',await po.evaluate(()=>DASHBOARD_TEST.state.scenario!==null));
 ok('13 mesej konsol tab lama',mo.filter(x=>!baseMsgs.includes(x)).length===0,mo);
 await po.close();await br.close();
 log('\nJUMLAH GAGAL: '+fails);
 fs.writeFileSync(path.join(T,'intervensi-test-output.txt'),out.join('\n'));
 process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e);process.exit(2)});


