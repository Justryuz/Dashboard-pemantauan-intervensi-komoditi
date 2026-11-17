const fs=require('fs');
const F='c:/Users/User/Documents/2026/intervensi bencana/Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html';
let t=fs.readFileSync(F,'utf8').replace(/\r\n/g,'\n');
let L=t.split('\n');
const die=m=>{console.error('GAGAL:',m);process.exit(1)};

/* ---- CSS ---- */
// 1) buang blok .iv-grid-mid lama (baris 325-354)
let a=L.findIndex(x=>x.startsWith('.iv-grid-mid{display:grid;gap:14px;grid-template-columns:repeat(2'));
if(a<0)die('css1');
let b=L.findIndex((x,i)=>i>a&&x.startsWith('@media(max-width:539px){.iv-grid-mid .iv-ctl'));
if(b<0||b-a!==29)die('css1b '+(b-a));
L.splice(a,b-a+1);
// 2) blok tengah baharu
a=L.findIndex(x=>x.startsWith('/* ===== Susun atur bahagian tengah'));
if(a<0)die('css2');
b=L.findIndex((x,i)=>i>a&&x.startsWith('#ivMarDefs .iv-defs{'));
if(b<0)die('css2b');
const museCss=fs.readFileSync('c:/Users/User/Documents/2026/intervensi bencana/.agents/tasks/popup.css','utf8').replace(/\r\n/g,'\n').trimEnd().split('\n');
// simpan baris :has (a..b) yang berkaitan selain .iv-grid-mid / #ivMobPanel
const keep=L.slice(a+1,b).filter(x=>/^#ivMobCtl/.test(x));
L.splice(a,b-a,...museCss.filter(x=>x!=='/*KEEP*/'),...keep);
// 3) media 539px
const i3=L.findIndex(x=>x.startsWith('@media(max-width:539px){.iv-mx{'));
if(i3<0)die('css3');
L[i3]='@media(max-width:539px){.iv-mx{grid-template-columns:repeat(2,minmax(0,1fr))!important}#ivMusePanel .iv-ptitle{padding:12px 12px 8px}#ivMusePanel .iv-pbody{padding:0 12px 12px}}';
t=L.join('\n');

/* ---- HTML ---- */
const modal=fs.readFileSync('c:/Users/User/Documents/2026/intervensi bencana/.agents/tasks/popup.html','utf8').replace(/\r\n/g,'\n').trimEnd();
const s0=t.indexOf(' <div class="iv-grid-mid">\n <section class="panel iv-panel" id="ivMobPanel"');
const s1=t.indexOf(' <section class="panel iv-panel" id="ivMusePanel"');
if(s0<0||s1<0)die('html1');
t=t.slice(0,s0)+t.slice(s1);
const endMuse='  <div class="iv-pbody" id="ivMuseBody" aria-live="polite"></div>\n </section>\n</div>\n';
if(!t.includes(endMuse))die('html2');
t=t.replace(endMuse,'  <div class="iv-pbody" id="ivMuseBody" aria-live="polite"></div>\n </section>\n'+modal+'\n');

/* ---- JS ---- */
const js=fs.readFileSync('c:/Users/User/Documents/2026/intervensi bencana/.agents/tasks/popup.js','utf8').replace(/\r\n/g,'\n').trimEnd();
const rep=(from,to)=>{if(!t.includes(from))die('js:'+from.slice(0,50));t=t.replace(from,()=>to)};
rep('const root=$i(\'viewIntervensi\');\nfunction mobField',js+'\nconst root=$i(\'viewIntervensi\');\nfunction mobField');
rep(`<button type="button" class="button tiny ghost" data-iv-act="jumpP4">Lompat ke Paparan 4</button>`,`<button type="button" class="button tiny ghost" data-iv-act="openMob">Buka Mobilisasi Stok</button>`);
rep(`case 'tindakan':ivDispatch('selectIntervention',arg);{const b=$i('ivPriBannerBox');if(b)b.focus({preventScroll:true})}break;`,`case 'tindakan':if(ivDispatch('selectIntervention',arg)===true)mdOpen('mob',el);break;`);
rep(`case 'jumpP4':$i('ivMobPanel').scrollIntoView({behavior:'smooth',block:'start'});break;`,`case 'openMob':mdOpen('mob',el);break;`);
rep(`case 'museXfer':ivDispatch('museTransfer',arg);break;`,`case 'museXfer':if(ivDispatch('museTransfer',arg)===true)mdOpen('mob',el);break;`);
rep(`Pertimbangkan mobilisasi bekalan melalui Paparan 4`,`Pertimbangkan mobilisasi bekalan melalui Mobilisasi Stok Pintar AI`);
rep(`>Hantar Konteks ke Senarai Keutamaan dan Mobilisasi</button>`,`>Hantar Konteks dan Buka Mobilisasi Stok</button>`);
rep('\n}\nfunction ivRenderAll(){','\n try{mdCtx()}catch(e){console.error(e)}\n}\nfunction ivRenderAll(){');
fs.writeFileSync(F,t.replace(/\n/g,'\r\n'));
console.log('OK');

