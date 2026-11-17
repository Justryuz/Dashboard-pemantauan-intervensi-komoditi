const fs=require('fs');
const F='c:/Users/User/Documents/2026/intervensi bencana/Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html';
let raw=fs.readFileSync(F,'utf8');const crlf=raw.includes('\r\n');let t=raw.replace(/\r\n/g,'\n');
function die(m){console.error('GAGAL',m);process.exit(1)}
// ---- CSS ----
let s=t.indexOf('#ivMuseCards{display:grid');let e=t.indexOf('@media(max-width:539px){.iv-mx');
let e2=t.indexOf('\n',e);
if(s<0||e<0)die('css');
const css=`#ivMuseCards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px!important;align-items:stretch}
#ivMuseCards>.iv-empty{grid-column:1/-1}
.iv-muse-card{--sev:var(--green);display:flex;flex-direction:column;gap:10px;min-width:0;margin:0;padding:12px 14px 12px 16px;box-sizing:border-box;background:var(--panel2);border:1px solid var(--line);border-left:5px solid var(--sev);border-radius:14px;color:var(--white);cursor:default}
.iv-muse-card[data-band=merah]{--sev:var(--red)}
.iv-muse-card[data-band=kuning]{--sev:var(--yellow)}
.iv-muse-card[data-open=true]{border-color:var(--sev)}
.iv-mc-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;width:100%;margin:0;padding:0;background:transparent;border:0;color:inherit;text-align:left;cursor:pointer;font:inherit}
.iv-mc-head .iv-mc-t{font-size:16px;font-weight:800;color:var(--white)}
.iv-mc-head .iv-chip{font-size:12px}
.iv-mc-head .iv-mc-date{margin-left:auto;font-size:12px;color:var(--muted);white-space:nowrap}
.iv-tr{font-weight:800;margin-left:2px}
.iv-tr.up{color:var(--red)}.iv-tr.down{color:var(--green)}.iv-tr.flat{color:var(--muted)}
.iv-mc-ins{margin:0;font-size:15px;line-height:1.45;font-weight:600;color:var(--white);flex:1 0 auto}
.iv-mc-act{padding:10px 12px;border:1px solid var(--cyan);border-radius:12px;background:var(--panel3);display:flex;flex-direction:column;gap:6px}
.iv-mc-act h4{margin:0;font-size:12.5px;font-weight:800;color:var(--cyan)}
.iv-mc-act ul{margin:0;padding-left:18px;font-size:13.5px;line-height:1.4;color:var(--white)}
.iv-mc-act ul li+li{margin-top:2px}
.iv-mc-po{font-size:12.5px;color:var(--muted)}
.iv-mc-po b{color:var(--white)}
.iv-mc-btns{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:2px}
.iv-mc-btns .button{min-height:36px;font-size:12.5px}
.iv-mc-btns .iv-mc-more{margin-left:auto}
.iv-muse-x{padding:10px 0 0;border-top:1px dashed var(--line2);display:flex;flex-direction:column;gap:8px}
.iv-muse-x .iv-kv{margin-top:0;font-size:12px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr))}
.iv-muse-x .iv-kv b{font-size:13px;overflow-wrap:anywhere}
.iv-muse-x .iv-sec{margin:4px 0 0}
.iv-mu-n{font-size:13px;font-weight:800;color:var(--white)}
details.iv-crit{margin-top:12px;font-size:12px;color:var(--muted)}
details.iv-crit summary{cursor:pointer;color:var(--cyan);font-weight:700}
details.iv-crit p{margin:6px 0 0;line-height:1.4}
@media(max-width:1099px){#ivMuseCards{grid-template-columns:minmax(0,1fr)}}
@media(max-width:539px){#ivMusePanel .iv-ptitle{padding:12px 12px 8px}#ivMusePanel .iv-pbody{padding:0 12px 12px}.iv-mc-head .iv-mc-date{margin-left:0;flex-basis:100%}.iv-muse-card{padding:12px 12px 12px 14px}}`;
t=t.slice(0,s)+css+t.slice(e2);
// ---- JS ----
const a=t.indexOf("function ivRenderMuse(){");const b=t.indexOf("/* ===== Render ===== */");
if(a<0||b<0)die('js');
let fn=t.slice(a,b);
// toolbar: tidy
const bs=fn.indexOf(' let h=`');
const nw=`function museInsightText(i){
 let x=String(i.summary||'');const lb=i.commodityLabel?i.commodityLabel+': ':'';
 if(lb&&x.startsWith(lb))x=x.slice(lb.length);
 x=x.replace(/^[^:.;]{1,40}:\\s+/,'');
 let dt='';
 x=x.replace(/(^|\\s)pada\\s+(\\d{1,2})\\s+(Januari|Februari|Mac|April|Mei|Jun|Julai|Ogos|September|Oktober|November|Disember)(?:\\s+(\\d{4}))?/i,(m,p,d,mn,y)=>{dt=d+' '+mn.slice(0,3)+(y?' '+y:'');return p});
 x=x.replace(/\\s{2,}/g,' ').replace(/\\s+([,.;:])/g,'$1').replace(/[\\s;:,.]+$/,'').trim();
 if(!x)x=i.analystNote||'';
 x=x.charAt(0).toUpperCase()+x.slice(1);
 return x+(dt?' ('+dt+')':'')+'.';
}
function museShortDate(ds){const [y,m,d]=ds.split('-').map(Number);return d+' '+MY_MONTHS[m-1].slice(0,3)}
function museSentLbl(v){return v<-0.15?'Negatif':v>0.15?'Positif':'Neutral'}
`;
fn=nw+fn;
// sort + counts
fn=fn.replace(/ const locs=new Set[^\n]*\n/," list=list.slice().sort((p,q)=>({merah:0,kuning:1,hijau:2}[p.riskBand]-{merah:0,kuning:1,hijau:2}[q.riskBand])||((q.riskCurrent-q.riskBefore)-(p.riskCurrent-p.riskBefore)));\n const nCrit=list.filter(i=>i.riskBand==='merah').length;\n");
fn=fn.replace('<span class="iv-note">Isnin hingga Ahad, waktu Malaysia (UTC+8)</span></div>','</div>');
fn=fn.replace('<div class="iv-mu-last"><span>Tarikh data terakhir</span>','<div class="iv-mu-last">${list.length?`<span class="iv-mu-n" id="ivMuseCount">${list.length} isu${nCrit?` · ${nCrit} kritikal`:\'\'}</span><span aria-hidden="true">|</span>`:\'\'}<span title="Minggu Isnin hingga Ahad, waktu Malaysia (UTC+8)">Tarikh data terakhir</span>');
// cards
const cs=fn.indexOf(' list.forEach(i=>{');const ce=fn.indexOf(" h+='</div><div class=\"iv-note\">Isu dimasukkan");
if(cs<0||ce<0)die('cards');
const cards=` list.forEach(i=>{
  const open=ms.expandedId===i.insightId,ev=!!ms.evidenceOpen[i.insightId],id=E(i.insightId);
  const bc=i.riskBand==='merah'?'bad':i.riskBand==='kuning'?'warn':'ok';const ch=i.riskCurrent-i.riskBefore;
  const bandL=i.riskBand==='merah'?'Merah':i.riskBand==='kuning'?'Kuning':'Hijau';
  const dir=ch>0?'up':ch<0?'down':'flat',arr=ch>0?'↑':ch<0?'↓':'→';
  const ltl={disahkan:'Lokasi acara disahkan',disebut:'Lokasi hanya disebut',belum:'Lokasi belum disahkan'}[i.locationType];
  const canX=!!(i.matchedPOId&&i.commodityId&&IV_COMMBY[i.commodityId]);
  const dummy=/dummy/i.test(i.sourceName||'')||i.source==='dummy';
  h+=\`<article class="iv-muse-card" data-band="\${i.riskBand}" data-open="\${open}" data-id="\${id}" aria-label="\${E(i.commodityLabel)}, Risiko \${bandL}">
  <button type="button" class="iv-mc-head" aria-expanded="\${open}" data-iv-act="museExp" data-iv-arg="\${id}"><span class="iv-mc-t">\${E(i.commodityLabel)}</span>\${chip(i.location.label)}<span class="iv-chip \${bc}">Risiko \${bandL} <span class="iv-tr \${dir}">\${i.riskCurrent} \${arr} \${sgn(ch,0)}</span></span><span class="iv-mc-date">tarikh acara \${museShortDate(i.eventDate)}</span></button>
  <p class="iv-mc-ins">\${E(museInsightText(i))}</p>
  <div class="iv-mc-act"><h4>Tindakan disyorkan</h4><ul>\${i.suggestedActions.slice(0,2).map(a=>\`<li>\${E(a)}</li>\`).join('')}</ul><div class="iv-mc-po">\${canX?\`PO berkaitan: <b>\${E(poName(i.matchedPOId))}</b>\`:'PO belum disahkan'}</div>
  <div class="iv-mc-btns">\${canX?\`<button type="button" class="button" data-iv-act="museXfer" data-iv-arg="\${id}">Buka Tindakan Intervensi</button>\`:''}<button type="button" class="button tiny ghost iv-mc-more" data-iv-act="museExp" data-iv-arg="\${id}" aria-expanded="\${open}">\${open?'Tutup butiran':'Butiran'}</button></div></div>\`;
  if(open){
   h+=\`<div class="iv-muse-x"><div class="iv-kv"><span>Risiko sebelum → semasa<b>\${i.riskBefore} → \${i.riskCurrent} (\${sgn(ch,0)})</b></span><span>Indeks sentimen<b>\${f2(i.sentimentIndex)} (\${museSentLbl(i.sentimentIndex)})</b></span><span>Bilangan sampel<b>\${i.sampleCount}</b></span><span>Jenis lokasi<b>\${ltl} (\${Math.round(i.locationConfidence*100)}%)</b></span><span>Sumber<b>\${E(i.sourceName)}</b></span><span>PO berkaitan<b>\${i.matchedPOId?E(poName(i.matchedPOId)):'Belum disahkan'}</b></span></div>
   \${dummy?tagD:''}<div class="iv-note">\${E(i.explanation)}</div><div class="iv-sec">TREND RISIKO</div>\${sparkline(i)}
   <div class="iv-fix"><button type="button" class="button tiny ghost" data-iv-act="museEv" data-iv-arg="\${id}" aria-expanded="\${ev}">Lihat Butiran Bukti</button>\${canX?'':\`<span class="iv-note">Padanan daerah kepada PO masih memerlukan pengesahan.</span>\`}</div>
   \${ev?\`<div class="iv-sec">BUKTI SUMBER</div>\${i.evidence.map(e=>\`<div class="iv-ev">“\${E(e.quote)}”<br><small>\${E(e.sourceName)} · \${fmtDate(e.date)}</small></div>\`).join('')}\`:''}</div>\`;
  }
  h+='</article>';
 });
`;
fn=fn.slice(0,cs)+cards+fn.slice(ce);
fn=fn.replace(/ h\+='<\/div><div class="iv-note">Isu dimasukkan[^\n]*\n/," h+='</div><details class=\"iv-crit\" id=\"ivMuseCrit\"><summary>Kriteria isu</summary><p>Isu dipaparkan jika komoditi dan lokasi acara disahkan, tarikh acara (bukan tarikh rekod) dalam minggu dipilih, berkaitan bekalan atau harga, dan bukan pendua. Sentimen negatif sahaja bukan kekurangan bekalan.</p></details>';\n");
t=t.slice(0,a)+fn+t.slice(b);
fs.writeFileSync(F,crlf?t.replace(/\n/g,'\r\n'):t);console.log('OK');
