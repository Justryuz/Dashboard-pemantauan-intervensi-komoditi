/* ===== Keadaan ternamaruang dan dispatch ===== */
const ivState={
 selectedMode:'pengeluar',selectedCommodityId:null,selectedStateId:null,selectedDistrictId:null,selectedPOId:null,selectedOutletId:null,
 selectedDateRange:{days:30},selectedRisk:'all',selectedInterventionId:null,selectedSourcePOId:null,selectedDestinationPOId:null,
 outletCats:{'pasar-awam':true,'ptk':true,'rakr':true,'agrobazaar':true},
 mob:{needMT:null,refPrice:null,wPrice:65,distLimitKm:550,candidateKey:null},
 margin:{jual:'',beli:'',ladang:'',kos:'',target:'15',touched:false,ctx:null},
 muse:{weekStart:'2026-11-09',expandedId:null,evidenceOpen:{},status:'loading'},
 ui:{mapReady:false,mapError:null,loading:{},errors:{},scenPending:false,priBanner:null,showAll:false,marInsight:false}
};
const failFlags={ai:false,muse:false,map:false};
let ivDrafts=[];const DRAFT_KEY='fama-iv-draf-v1';
function loadDrafts(){try{const a=JSON.parse(localStorage.getItem(DRAFT_KEY)||'[]');if(!Array.isArray(a))return [];return a.filter(d=>d&&d.status==='draf'&&typeof d.interventionId==='string'&&typeof d.sourcePOId==='string'&&typeof d.destinationPOId==='string'&&fin(d.quantityMT))}catch(_){return []}}
function saveDrafts(){try{localStorage.setItem(DRAFT_KEY,JSON.stringify(ivDrafts));return true}catch(err){console.warn('Draf tidak dapat disimpan',err);return false}}
ivDrafts=loadDrafts();

const thr=()=>IV_CONFIG.thresholds[ivState.selectedMode];
const modeLbl=m=>m==='pengeluar'?'Pengeluar':'Pengguna';
function effPO(){if(ivState.selectedPOId)return ivState.selectedPOId;if(ivState.selectedInterventionId){const x=ivState.selectedInterventionId.split(':')[1];if(IV_POBY[x])return x}return null}
function effCommodity(){if(ivState.selectedCommodityId)return {id:ivState.selectedCommodityId,def:false};if(ivState.selectedInterventionId){const x=ivState.selectedInterventionId.split(':')[3];if(IV_COMMBY[x])return {id:x,def:false}}return {id:'cili-merah',def:true}}
const poName=id=>IV_POBY[id]?IV_POBY[id].name:'—';
const commName=id=>IV_COMMBY[id]?IV_COMMBY[id].name:'—';

/* ===== Penyesuai AI (simulasi, deterministik) ===== */
const aiAdapter=(function(){
 const model='mock-deterministik-v1';const delay=ms=>new Promise(r=>setTimeout(r,ms));
 async function run(kind,fn,lat=true){
  if(failFlags[kind]){failFlags[kind]=false;throw new Error('Kegagalan AI disuntik (ujian)')}
  if(lat)await delay(200+Math.floor(Math.random()*200));
  return {ok:true,text:fn(),model,generatedAt:new Date().toISOString()};
 }
 return Object.freeze({
  model,
  explainMobilisation:f=>run('ai',()=>f.text),
  explainMargin:f=>run('ai',()=>f.text),
  recommendPriority:f=>run('ai',()=>f.text),
  summariseMuse:f=>run('ai',()=>f.text),
  extractMuseIssue:async raw=>({ok:true,data:extractMuseIssue(raw),model,generatedAt:new Date().toISOString()})
 });
})();
function ivValidateAi(r){return !!(r&&r.ok===true&&typeof r.text==='string'&&r.text.length>=1&&r.text.length<=1200)}
async function callAI(method,facts,fallback){
 try{
  const r=await Promise.race([aiAdapter[method](facts),new Promise((_,rej)=>setTimeout(()=>rej(new Error('Tamat masa AI')),4000))]);
  if(ivValidateAi(r))return {text:r.text,ai:true};
  throw new Error('Respons AI tidak sah');
 }catch(err){console.warn('Penjelasan AI tidak tersedia',err&&err.message);return {text:fallback,ai:false}}
}

/* ===== Penyaringan dan tahap ===== */
function recsNow(){return computeRecs(ivState.selectedMode,ivState.selectedDateRange.days)}
function recsForPO(poId,commOnly=true){return recsNow().filter(r=>r.poId===poId&&(!commOnly||!ivState.selectedCommodityId||r.commodityId===ivState.selectedCommodityId))}
function poLevel(poId){let l='normal';recsForPO(poId).forEach(r=>{l=worst(l,r.cls.level)});return l}
function districtLevel(did){let l='normal',any=false;recsNow().forEach(r=>{if(r.districtId===did&&(!ivState.selectedCommodityId||r.commodityId===ivState.selectedCommodityId)){any=true;l=worst(l,r.cls.level)}});return any?l:'tiada'}
const STATUS_CLS={normal:'hijau',waspada:'kuning',kritikal:'merah'};
function poPasses(p,lvl){const s=ivState;return (!s.selectedStateId||p.stateId===s.selectedStateId)&&(s.selectedRisk==='all'||lvl===s.selectedRisk)}
function priRows(){
 const s=ivState;
 return recsNow().filter(r=>r.cls.level!=='normal'&&(s.selectedRisk==='all'||r.cls.level===s.selectedRisk)&&(!s.selectedCommodityId||r.commodityId===s.selectedCommodityId)&&(!s.selectedStateId||r.stateId===s.selectedStateId)&&(!s.selectedPOId||r.poId===s.selectedPOId)&&(!s.selectedDistrictId||r.districtId===s.selectedDistrictId))
  .sort((a,b)=>b.score-a.score||LV_W[b.cls.level]-LV_W[a.cls.level]||b.comp.S-a.comp.S||a.poName.localeCompare(b.poName)||a.district.localeCompare(b.district));
}
function issueLabel(r){
 const m=r.mode;const base=r.cls.priceLevel!=='normal'?(m==='pengeluar'?'Harga ladang jatuh':'Kenaikan harga runcit'):(m==='pengeluar'?'Ramalan di bawah ambang':'Ramalan di atas ambang');
 const suf=r.cls.supply.state==='disahkan'?(m==='pengeluar'?' + lebihan bekalan dikesan (data dummy)':' + kekurangan bekalan dikesan (data dummy)'):'';
 return base+suf;
}
function intervType(r){const k=r.cls.level==='kritikal';return r.mode==='pengeluar'?(k?'Pengumpulan dan pengedaran semula bekalan':'Pantau dan sedia pembelian lebihan'):(k?'Mobilisasi stok tambahan':'Pantau bekalan dan sedia stok sokongan')}
const tagD='<span class="iv-tag dummy">DATA DUMMY</span>',tagR='<span class="iv-tag real">Data sedia ada</span>';
const chip=(t,c='')=>`<span class="iv-chip ${c}">${E(t)}</span>`;

/* ===== Dispatch ===== */
const ALL_PANELS=['filters','map','log','pri','mob','draft','mar','muse'];
function resetMobSel(){ivState.mob.needMT=null;ivState.mob.refPrice=null;ivState.mob.candidateKey=null;ivState.selectedSourcePOId=null;ivState.selectedDestinationPOId=null}
function applyRoles(){const s=ivState;if(s.selectedMode==='pengeluar'){s.selectedSourcePOId=s.selectedPOId;s.selectedDestinationPOId=null}else{s.selectedDestinationPOId=s.selectedPOId;s.selectedSourcePOId=null}}
function toastSafe(m){try{toast(m)}catch(_){}}
function ivDispatch(type,payload){
 const s=ivState;let dirty=ALL_PANELS,focus=false;
 switch(type){
  case 'setMode':{if(payload!=='pengeluar'&&payload!=='pengguna')return;s.selectedMode=payload;s.selectedInterventionId=null;s.selectedOutletId=null;resetMobSel();applyRoles();s.ui.priBanner=null;break}
  case 'setFilter':{
   const [k,v]=payload;
   if(k==='komoditi'){s.selectedCommodityId=v==='all'||!IV_COMMBY[v]?null:v;s.selectedInterventionId=null;s.mob.candidateKey=null;s.mob.needMT=null;s.mob.refPrice=null}
   else if(k==='negeri'){s.selectedStateId=v==='all'||!IV_STATES.some(x=>x.id===v)?null:v;if(s.selectedDistrictId&&!(s.selectedDistrictId.startsWith(s.selectedStateId+'/')))s.selectedDistrictId=null}
   else if(k==='po'){if(v==='all'||!IV_POBY[v]){s.selectedPOId=null;s.selectedDistrictId=null;s.selectedOutletId=null;s.selectedInterventionId=null;resetMobSel();focus=true}else{return ivDispatch('selectPO',v)}}
   else if(k==='daerah'){return ivDispatch('selectDistrict',v==='all'?null:v)}
   else if(k==='tempoh'){const d=+v;s.selectedDateRange.days=[7,14,30].includes(d)?d:30}
   else if(k==='risiko'){s.selectedRisk=['kritikal','waspada','normal'].includes(v)?v:'all'}
   break}
  case 'resetFilters':{
   Object.assign(s,{selectedMode:'pengeluar',selectedCommodityId:null,selectedStateId:null,selectedDistrictId:null,selectedPOId:null,selectedOutletId:null,selectedRisk:'all',selectedInterventionId:null,selectedSourcePOId:null,selectedDestinationPOId:null});
   s.selectedDateRange={days:30};s.outletCats={'pasar-awam':true,'ptk':true,'rakr':true,'agrobazaar':true};s.mob={needMT:null,refPrice:null,wPrice:65,distLimitKm:550,candidateKey:null};s.ui.priBanner=null;s.ui.showAll=false;
   s.margin.touched=false;s.margin.ctx=null;IV_CONFIG.thresholds=JSON.parse(JSON.stringify(IV_THR_DEFAULT));focus=true;break}
  case 'selectPO':{
   const p=IV_POBY[payload];if(!p){toastSafe('Pilihan tidak sah, penapis diset semula');console.warn('PO tidak sah',payload);return}
   s.selectedPOId=p.id;s.selectedStateId=p.stateId;s.selectedDistrictId=null;s.selectedOutletId=null;s.selectedInterventionId=null;resetMobSel();applyRoles();s.ui.priBanner=null;focus=true;break}
  case 'selectDistrict':{
   if(payload===null||payload===s.selectedDistrictId){s.selectedDistrictId=null;focus=true;break}
   const d=IV_DISTBY[payload];if(!d)return;
   s.selectedDistrictId=d.districtId;
   if(!ivWithheld[d.poId]&&s.selectedPOId!==d.poId){s.selectedPOId=d.poId;s.selectedStateId=d.stateId;s.selectedOutletId=null;s.selectedInterventionId=null;resetMobSel();applyRoles()}
   focus=true;break}
  case 'toggleOutletCat':{if(IV_CATBY[payload])s.outletCats[payload]=!s.outletCats[payload];dirty=['map'];break}
  case 'selectOutlet':{s.selectedOutletId=payload;dirty=['map'];break}
  case 'selectIntervention':{
   const r=recsNow().find(x=>x.id===payload);if(!r)return;
   s.selectedInterventionId=r.id;s.selectedPOId=r.poId;s.selectedStateId=r.stateId;s.selectedDistrictId=r.districtId;s.selectedCommodityId=r.commodityId;s.selectedOutletId=null;resetMobSel();applyRoles();s.margin.touched=false;focus=true;
   s.ui.priBanner={id:r.id,text:null,loading:true};ivRecommendBanner(r);toastSafe('Intervensi dipilih: '+r.commodity+' · '+r.district+' · '+r.poName);break}
  case 'setMob':{const [k,v]=payload;
   if(k==='need')s.mob.needMT=v;else if(k==='ref')s.mob.refPrice=v;else if(k==='limit')s.mob.distLimitKm=v;else if(k==='wPrice')s.mob.wPrice=clamp(Math.round(v/5)*5,0,100);else if(k==='resetNeed')s.mob.needMT=null;else if(k==='resetRef')s.mob.refPrice=null;
   dirty=(k==='resetNeed'||k==='resetRef')?['mob']:['mobres'];break}
  case 'selectCandidate':{s.mob.candidateKey=s.mob.candidateKey===payload?null:payload;
   const eng=curEngine();if(s.mob.candidateKey){if(s.selectedMode==='pengeluar')s.selectedDestinationPOId=payload;else s.selectedSourcePOId=payload}else applyRoles();dirty=['mobres'];break}
  case 'createDraft':{return createDraft()}
  case 'deleteDraft':{ivDrafts=ivDrafts.filter(d=>d.interventionId!==payload);saveDrafts();dirty=['draft'];break}
  case 'setMargin':{const [k,v]=payload;s.margin[k]=v;s.margin.touched=true;dirty=['marres'];break}
  case 'resetMargin':{s.margin.touched=false;s.margin.ctx=null;dirty=['mar'];break}
  case 'museWeek':{
   const cur=weekStart(myDate(refNow));let ws=s.muse.weekStart;
   if(payload==='prev'){const min=addDays(weekStart(addDays(museEarliest(),-14)),0);if(addDays(ws,-7)>=min)ws=addDays(ws,-7)}
   else if(payload==='next'){if(ws<cur)ws=addDays(ws,7)}else ws=cur;
   s.muse.weekStart=ws;s.muse.expandedId=null;dirty=['muse'];break}
  case 'museExpand':{s.muse.expandedId=s.muse.expandedId===payload?null:payload;dirty=['muse'];break}
  case 'museEvidence':{s.muse.evidenceOpen[payload]=!s.muse.evidenceOpen[payload];dirty=['muse'];break}
  case 'museTransfer':{
   const ins=museAll.find(i=>i.insightId===payload);if(!ins||!ins.matchedPOId||!ins.commodityId||!IV_COMMBY[ins.commodityId])return;
   const p=IV_POBY[ins.matchedPOId];s.selectedCommodityId=ins.commodityId;s.selectedPOId=p.id;s.selectedStateId=p.stateId;s.selectedDistrictId=ins.districtId;s.selectedInterventionId=null;s.selectedOutletId=null;resetMobSel();applyRoles();focus=true;
   toastSafe('Konteks dipindahkan: '+ins.commodityLabel+' · '+p.name);break}
  case 'setThreshold':{const [m,k,v]=payload;const o=IV_CONFIG.thresholds[m];const w=Math.abs(o.warnPct),c=Math.abs(o.critPct);let nw=w,nc=c;if(k==='warn')nw=v;else nc=v;
   if(!(nw>=1&&nw<=50&&nc>nw&&nc<=90))return false;const sg=m==='pengeluar'?-1:1;o.warnPct=sg*nw;o.critPct=sg*nc;break}
  default:return;
 }
 if(focus)ivFocusMap();
 ivRender(dirty);
 return true;
}
function museEarliest(){return museAll.length?museAll.map(i=>i.recordDate).sort()[0]:'2026-11-01'}

/* ===== Peta ===== */
const MY_BOUNDS=(typeof FAMA_MAP_CONFIG!=='undefined'&&FAMA_MAP_CONFIG.bounds)||[[99.5,0.8],[119.5,7.5]];
let ivMap=null,ivMapLoaded=false,ivMapTimer=null,ivMapWarned=false,ivPoMk=[],ivDistMk=[],ivOutMk=[],ivPopup=null;
function ivMapBox(){return $i('ivMap')}
function ivInitMap(){
 if(ivMap)return;
 const sk=$i('ivMapSkel'),fb=$i('ivMapFallback');
 if(typeof maplibregl==='undefined'||failFlags.map){
  const injected=failFlags.map;failFlags.map=false;
  if(!ivMapWarned){ivMapWarned=true;console.warn('Peta intervensi tidak dapat dimulakan',injected?'(disuntik)':'MapLibre tiada')}
  ivState.ui.mapError='fallback';sk.hidden=true;ivRenderMapFallback();return;
 }
 try{
  fb.hidden=true;sk.hidden=false;ivState.ui.mapError=null;
  const cfg=window.FAMA_MAP_CONFIG||{};
  ivMap=new maplibregl.Map({container:'ivMap',style:cfg.style||'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',bounds:MY_BOUNDS,fitBoundsOptions:{padding:20},attributionControl:true,cooperativeGestures:true,dragRotate:false,pitchWithRotate:false,locale:{'CooperativeGesturesHandler.WindowsHelpText':'Tekan Ctrl + skrol untuk zum peta','CooperativeGesturesHandler.MacHelpText':'Tekan ⌘ + skrol untuk zum peta','CooperativeGesturesHandler.MobileHelpText':'Guna dua jari untuk gerakkan peta'}});
  ivMap.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
  ivMap.on('load',()=>{ivMapLoaded=true;ivState.ui.mapReady=true;ivState.ui.mapError=null;clearTimeout(ivMapTimer);sk.hidden=true;ivDrawDistrictLayer();ivRenderMapBanner()});
  ivMap.on('error',()=>{if(!ivMapLoaded&&!ivState.ui.mapError){ivState.ui.mapError='style';sk.hidden=true;if(!ivMapWarned){ivMapWarned=true;console.warn('Peta asas intervensi tidak dapat dimuatkan')}ivRenderMapBanner()}});
  ivMapTimer=setTimeout(()=>{if(!ivMapLoaded){ivState.ui.mapError='style';sk.hidden=true;if(!ivMapWarned){ivMapWarned=true;console.warn('Peta asas intervensi lambat dimuatkan')}ivRenderMapBanner()}},10000);
 }catch(err){
  if(!ivMapWarned){ivMapWarned=true;console.warn('Peta intervensi tidak dapat dimulakan',err)}
  ivMap=null;ivState.ui.mapError='fallback';sk.hidden=true;ivRenderMapFallback();
 }
 ivRenderMap();
}
function ivRetryMap(){
 try{if(ivMap){ivMap.remove()}}catch(_){}
 ivMap=null;ivMapLoaded=false;ivMapWarned=false;ivPoMk=[];ivDistMk=[];ivOutMk=[];ivState.ui.mapError=null;$i('ivMapFallback').hidden=true;ivInitMap();
}
function ivFocusMap(){
 if(!ivMap)return;const s=ivState;
 try{
  const d=s.selectedDistrictId&&IV_DISTBY[s.selectedDistrictId];
  if(d&&!ivWithheld[d.poId]){ivMap.flyTo({center:[d.lon,d.lat],zoom:10.5,duration:700});return}
  const p=s.selectedPOId&&IV_POBY[s.selectedPOId];
  if(p){const b=new maplibregl.LngLatBounds([p.lon,p.lat],[p.lon,p.lat]);if(!ivWithheld[p.id])p.districts.forEach(x=>b.extend([x[2],x[1]]));ivMap.fitBounds(b,{padding:60,maxZoom:10,duration:700});return}
  ivMap.fitBounds(MY_BOUNDS,{padding:20,duration:700});
 }catch(err){console.warn('Gerakan peta gagal',err)}
}
function mkEl(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function ivRenderMapFallback(){
 const fb=$i('ivMapFallback');fb.hidden=false;
 fb.innerHTML=`<div class="iv-banner bad">Peta tidak dapat dimuatkan. Pilihan PO melalui senarai masih berfungsi.</div><button type="button" class="button" data-iv-act="mapRetry">Cuba Semula</button><div class="iv-fb-grid">${IV_PO.map(p=>{const l=poLevel(p.id);return `<button type="button" class="iv-fb-btn status-${STATUS_CLS[l]}" data-iv-act="selPO" data-iv-arg="${E(p.id)}">${E(p.name)}<br><small>${LV_LABEL[l]}</small></button>`}).join('')}</div>`;
}
function ivRenderMapBanner(){
 const b=$i('ivMapBanner');const s=ivState;let h='';
 if(s.ui.mapError==='style')h+=`<div class="iv-banner">Peta asas tidak dapat dimuatkan. Penanda PO tetap berfungsi. <button type="button" class="button tiny ghost" data-iv-act="mapRetry">Cuba Semula</button></div>`;
 if(s.selectedPOId&&ivWithheld[s.selectedPOId])h+=`<div class="iv-banner info">Pemetaan daerah untuk PO ini belum disediakan. Daerah dan outlet tidak dipaparkan.</div>`;
 b.innerHTML=h;
}
function circlePoly(lon,lat,rKm,n=24){const pts=[];for(let i=0;i<=n;i++){const a=i/n*2*Math.PI;pts.push([lon+(rKm/111.32/Math.cos(lat*Math.PI/180))*Math.cos(a),lat+(rKm/110.57)*Math.sin(a)])}return pts}
function ivDrawDistrictLayer(){
 if(!ivMap||!ivMapLoaded)return;
 try{
  const s=ivState,p=s.selectedPOId&&IV_POBY[s.selectedPOId];
  const feats=p&&!ivWithheld[p.id]?IV_DISTRICTS.filter(d=>d.poId===p.id).map(d=>({type:'Feature',properties:{name:d.name+' (anggaran)',lvl:districtLevel(d.districtId),sel:d.districtId===s.selectedDistrictId?1:0},geometry:{type:'Polygon',coordinates:[circlePoly(d.lon,d.lat,10)]}})):[];
  const data={type:'FeatureCollection',features:feats};
  const src=ivMap.getSource('iv-districts');
  if(src){src.setData(data);return}
  ivMap.addSource('iv-districts',{type:'geojson',data});
  const col=['match',['get','lvl'],'kritikal','#ff4e63','waspada','#ffbd43','normal','#22d88a','#7f9bb8'];
  ivMap.addLayer({id:'iv-districts-fill',type:'fill',source:'iv-districts',paint:{'fill-color':col,'fill-opacity':0.16}});
  ivMap.addLayer({id:'iv-districts-line',type:'line',source:'iv-districts',paint:{'line-color':col,'line-width':['case',['==',['get','sel'],1],3,1.5],'line-dasharray':[2,2]}});
 }catch(err){console.warn('Lapisan kawasan daerah gagal',err)}
}
function outletPopupNode(o){
 const n=mkEl('div','');n.append(mkEl('strong','',o.nama));
 const dl=mkEl('dl');const row=(k,v)=>{dl.append(mkEl('dt','',k),mkEl('dd','',v))};
 row('Jenis',IV_CATBY[o.kategori].label);row('Negeri',o.negeri);row('Daerah',o.districtName);row('PO penyelia',o.supervisingPOId?poName(o.supervisingPOId):'Belum disahkan');
 row('Koordinat (anggaran)',o.lat.toFixed(3)+', '+o.lon.toFixed(3));row('Status operasi',o.status);row('Komoditi berkaitan',o.komoditiBerkaitan.map(commName).join(', '));row('Data','DATA DUMMY');
 n.append(dl);return n;
}
function visibleOutlets(){
 const s=ivState,p=s.selectedPOId;if(!p||ivWithheld[p])return [];
 let l=outletsOfPO(p);if(s.selectedDistrictId)l=l.filter(o=>o.districtId===s.selectedDistrictId);return l;
}
function ivRenderMapMarkers(){
 ivPoMk.forEach(m=>m.remove());ivDistMk.forEach(m=>m.remove());ivOutMk.forEach(m=>m.remove());ivPoMk=[];ivDistMk=[];ivOutMk=[];
 if(ivPopup){ivPopup.remove();ivPopup=null}
 if(!ivMap)return;
 const s=ivState;
 IV_PO.forEach(p=>{
  const lvl=poLevel(p.id),sel=s.selectedPOId===p.id,pass=poPasses(p,lvl);
  const show=s.selectedPOId?(s.selectedRisk==='all'||lvl===s.selectedRisk):pass;
  if(!show&&!sel)return;
  const el=mkEl('div',`po-marker iv-po-marker status-${STATUS_CLS[lvl]}${sel?' iv-sel':''}${!pass?' iv-outside':''}${s.selectedPOId&&!sel?' compact':''}`);
  el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label',`${p.name}, ${LV_LABEL[lvl]}`);el.title=`${p.name} · ${LV_LABEL[lvl]} (lokasi anggaran bandar)`;el.dataset.ivPo=p.id;
  el.append(mkEl('span','halo'),mkEl('span','core'));
  if(!s.selectedPOId){const [dx,dy]=IV_CONFIG.labelShift[p.id]||[9,-10];const t=mkEl('span','iv-lbl',p.label);t.style.left=`calc(50% + ${dx}px)`;t.style.top=`calc(50% + ${dy}px)`;el.append(t)}
  const go=()=>ivDispatch('selectPO',p.id);
  el.addEventListener('click',ev=>{ev.stopPropagation();go()});el.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();go()}});
  ivPoMk.push(new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([p.lon,p.lat]).addTo(ivMap));
 });
 const p=s.selectedPOId&&IV_POBY[s.selectedPOId];
 if(p&&!ivWithheld[p.id]){
  IV_DISTRICTS.filter(d=>d.poId===p.id).forEach(d=>{
   const lv=districtLevel(d.districtId);const el=mkEl('div',`iv-dist status-${lv==='tiada'?'tiada':STATUS_CLS[lv]}${s.selectedDistrictId===d.districtId?' iv-sel':''}`);
   el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label',`Daerah ${d.name} (kawasan anggaran)`);el.dataset.ivDist=d.districtId;el.append(mkEl('span','dot-core'),mkEl('span','map-label',d.name));
   const go=()=>ivDispatch('selectDistrict',d.districtId);el.addEventListener('click',ev=>{ev.stopPropagation();go()});el.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();go()}});
   ivDistMk.push(new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([d.lon,d.lat]).addTo(ivMap));
  });
  visibleOutlets().filter(o=>s.outletCats[o.kategori]).forEach(o=>{
   const el=mkEl('button','iv-out c-'+o.kategori+(s.selectedOutletId===o.outletId?' iv-sel':''));el.type='button';el.append(mkEl('span','',IV_CATBY[o.kategori].glyph));el.setAttribute('aria-label',`${o.nama}, ${IV_CATBY[o.kategori].label}`);el.title=o.nama;el.dataset.ivOutlet=o.outletId;
   el.addEventListener('click',ev=>{ev.stopPropagation();s.selectedOutletId=o.outletId;if(ivPopup)ivPopup.remove();ivPopup=new maplibregl.Popup({offset:16,maxWidth:'260px',className:'iv-popup'}).setLngLat([o.lon,o.lat]).setDOMContent(outletPopupNode(o)).addTo(ivMap)});
   ivOutMk.push(new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([o.lon,o.lat]).addTo(ivMap));
  });
 }
}
function ivRenderMap(){
 const s=ivState;
 $i('ivModePengeluar').setAttribute('aria-selected',String(s.selectedMode==='pengeluar'));$i('ivModePengguna').setAttribute('aria-selected',String(s.selectedMode==='pengguna'));
 $i('ivMapHint').textContent=s.selectedMode==='pengeluar'?'Penunjuk: Harga Ladang · amaran apabila harga turun':'Penunjuk: Harga Runcit · amaran apabila harga naik';
 $i('ivMapBack').hidden=!s.selectedPOId;
 const cnt={normal:0,waspada:0,kritikal:0};IV_PO.forEach(p=>cnt[poLevel(p.id)]++);
 const sel=s.selectedPOId?IV_POBY[s.selectedPOId]:null;const outside=sel&&!poPasses(sel,poLevel(sel.id));
 $i('ivMapChips').innerHTML=chip('Kritikal '+cnt.kritikal,'bad')+chip('Waspada '+cnt.waspada,'warn')+chip('Normal '+cnt.normal,'ok')+(outside?chip('Terpilih (di luar penapis)','info'):'')+(sel?chip(sel.name,'info'):'')+notApplicable('map');
 const outs=sel&&!ivWithheld[sel.id]?outletsOfPO(sel.id).filter(o=>!s.selectedDistrictId||o.districtId===s.selectedDistrictId):[];
 $i('ivOutletChips').innerHTML=IV_CATS.map(c=>`<button type="button" class="iv-chip" aria-pressed="${s.outletCats[c.id]}" data-iv-act="outCat" data-iv-arg="${c.id}"><i class="iv-leg-i c-${c.id}"></i>${c.label} (${outs.filter(o=>o.kategori===c.id).length})</button>`).join('');
 $i('ivLegend').innerHTML=IV_CATS.map(c=>`<span><i class="iv-leg-i c-${c.id}"></i>${c.label}</span>`).join('')+`<span><i class="iv-dot g"></i>Normal</span><span><i class="iv-dot y"></i>Waspada</span><span><i class="iv-dot r"></i>Merah berkelip: kritikal disahkan bekalan</span>`;
 let dc='';
 if(sel&&!ivWithheld[sel.id]){dc=IV_DISTRICTS.filter(d=>d.poId===sel.id).map(d=>{const n=IV_OUTLETS.filter(o=>o.districtId===d.districtId).length;return `<button type="button" class="iv-chip" aria-pressed="${s.selectedDistrictId===d.districtId}" data-iv-act="district" data-iv-arg="${E(d.districtId)}">${E(d.name)} · ${n?n+' outlet':'Tiada outlet dalam daerah ini'}</button>`}).join('')}
 $i('ivDistChips').innerHTML=dc;
 $i('ivUnmappedList').innerHTML=IV_OUTLETS.filter(o=>!o.supervisingPOId).map(o=>`${E(o.nama)} · ${E(o.districtName)}, ${E(o.negeri)} ${tagD}`).join('<br>');
 ivRenderMapBanner();
 if(ivMap){ivRenderMapMarkers();ivDrawDistrictLayer()}else if(s.ui.mapError==='fallback')ivRenderMapFallback();
}

/* ===== Penapis (toolbar) ===== */
function notApplicable(panel){
 const s=ivState;const act=[];
 const f=(n,on)=>{if(on)act.push(n)};
 if(panel==='log'||panel==='map'&&false){f('Komoditi',!!s.selectedCommodityId);f('Negeri',!!s.selectedStateId);f('Daerah',!!s.selectedDistrictId);f('Tempoh',s.selectedDateRange.days!==30);f('Tahap Risiko',s.selectedRisk!=='all')}
 if(panel==='mob'||panel==='mar'){f('Negeri',!!s.selectedStateId);f('Daerah',!!s.selectedDistrictId);f('Tahap Risiko',s.selectedRisk!=='all')}
 if(panel==='muse'){f('Tempoh',s.selectedDateRange.days!==30)}
 return act.length?chip('Penapis tidak terpakai: '+act.join(', '),'grey'):'';
}
function fillSel(id,opts,val){const e=$i(id);const h=opts.map(([v,l])=>`<option value="${E(v)}"${v===val?' selected':''}>${E(l)}</option>`).join('');if(e.dataset.sig!==h){e.innerHTML=h;e.dataset.sig=h}e.value=val}
function ivRenderFilters(){
 const s=ivState;
 fillSel('ivFKomoditi',[['all','Semua komoditi'],...IV_COMM.map(c=>[c.id,c.name])],s.selectedCommodityId||'all');
 fillSel('ivFNegeri',[['all','Semua negeri'],...IV_STATES.map(x=>[x.id,x.name])],s.selectedStateId||'all');
 let pos=IV_PO.filter(p=>!s.selectedStateId||p.stateId===s.selectedStateId);
 const out=s.selectedPOId&&!pos.some(p=>p.id===s.selectedPOId)?IV_POBY[s.selectedPOId]:null;
 fillSel('ivFPO',[['all','Semua PO'],...pos.map(p=>[p.id,p.name]),...(out?[[out.id,out.name+' (di luar penapis)']]:[])],s.selectedPOId||'all');
 let ds=IV_DISTRICTS.filter(d=>s.selectedPOId?d.poId===s.selectedPOId:(!s.selectedStateId||d.stateId===s.selectedStateId));
 if(s.selectedDistrictId&&!ds.some(d=>d.districtId===s.selectedDistrictId)&&IV_DISTBY[s.selectedDistrictId])ds=[...ds,IV_DISTBY[s.selectedDistrictId]];
 fillSel('ivFDaerah',[['all','Semua daerah'],...ds.map(d=>[d.districtId,d.name])],s.selectedDistrictId||'all');
 $i('ivFTempoh').value=String(s.selectedDateRange.days);$i('ivFRisiko').value=s.selectedRisk;
 const t=IV_CONFIG.thresholds;
 [['ivThrPW',Math.abs(t.pengeluar.warnPct)],['ivThrPC',Math.abs(t.pengeluar.critPct)],['ivThrGW',Math.abs(t.pengguna.warnPct)],['ivThrGC',Math.abs(t.pengguna.critPct)]].forEach(([id,v])=>{const e=$i(id);if(document.activeElement!==e){e.value=v;e.removeAttribute('aria-invalid')}});
}

/* ===== Paparan 2 ===== */
const ICON_TRUCK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 6h11v9H2zM13 9h4l3 3v3h-7z"/><circle cx="6.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/></svg>';
const ICON_SNOW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 2v20M4 7l16 10M20 7L4 17M9 3l3 3 3-3M9 21l3-3 3 3"/></svg>';
const ICON_WH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 10l9-6 9 6v10H3z"/><path d="M8 20v-6h8v6"/></svg>';
function ivRenderLog(){
 const id=effPO(),body=$i('ivLogBody'),ch=$i('ivLogChips');
 if(!id){ch.innerHTML=notApplicable('log');body.innerHTML='<div class="iv-empty">Pilih Pusat Operasi pada peta untuk melihat kesiapsiagaan logistik</div>';return}
 const p=IV_POBY[id],lg=logisticsOf(id),rd=readiness(lg);
 const rc=rd.state==='sedia'?'ok':rd.state==='terhad'?'warn':rd.state==='kritikal'?'bad':'grey';
 ch.innerHTML=chip(rd.label,rc)+notApplicable('log');
 const names=lg.groupMemberPOIds.map(poName);
 const tile=(ico,v,l)=>`<div class="iv-stat">${ico}<div><b>${v}</b><span>${l}</span></div></div>`;
 let h=`<div class="iv-chips"><b>${E(p.name)}</b>${chip(p.negeri)}${chip('lokasi anggaran bandar','grey')}${tagR}</div>
 <div class="iv-sec">KAPASITI MAKSIMUM STATIK</div><div class="iv-stats">${tile(ICON_TRUCK,lg.kenderaanMax,'Bilangan Kenderaan')}${tile(ICON_TRUCK,f2(lg.muatanMaxMT),'Kapasiti Muatan (MT)')}${tile(ICON_SNOW,lg.bilikSejukMax,'Bilangan Bilik Sejuk')}${tile(ICON_WH,f2(lg.simpananMaxMT),'Kapasiti Simpanan (MT)')}</div>`;
 if(lg.groupShared)h+=`<div class="iv-banner info">Angka gabungan ${E(names.join(' dan '))}. Tidak digandakan. ${lg.groupMemberPOIds.filter(x=>x!==id).map(x=>`<button type="button" class="iv-chip info" data-iv-act="selPO" data-iv-arg="${E(x)}">Lihat ${E(poName(x))}</button>`).join(' ')}</div>`;
 h+=`<div class="iv-sec">KETERSEDIAAN SEMASA ${tagD}</div>`;
 if(lg.availableVehicleCount==null&&lg.availableCapacityMT==null)h+=`<div class="iv-empty" id="ivLogNull">Data ketersediaan semasa belum tersedia</div>`;
 else h+=`<div class="iv-stats">${tile(ICON_TRUCK,lg.availableVehicleCount,'Kenderaan tersedia (daripada '+lg.kenderaanMax+')')}${tile(ICON_WH,lg.availableCapacityMT.toFixed(1),'Ruang simpanan kosong (MT)')}${tile(ICON_WH,lg.actualStockMT.toFixed(1),'Stok sebenar disimpan (MT)')}${tile(ICON_SNOW,lg.simpananMaxMT.toFixed(1),'Simpanan maksimum (MT)')}</div><div class="iv-note">Dikemas kini ${E(myDate(lg.availabilityUpdated))} (dummy). Ketersediaan tidak pernah disimpulkan daripada kapasiti maksimum.</div>`;
 body.innerHTML=h;
}

/* ===== Paparan 3 ===== */
let _priBannerSeq=0;
async function ivRecommendBanner(r){
 const seq=++_priBannerSeq;
 const fb=`Cadangan: ${r.cls.level==='kritikal'?'utamakan':'pantau'} ${r.commodity} di ${r.district} (${r.poName}). ${intervType(r)}.`;
 const res=await callAI('recommendPriority',{text:fb},fb);
 if(seq!==_priBannerSeq||!ivState.ui.priBanner||ivState.ui.priBanner.id!==r.id)return;
 ivState.ui.priBanner={id:r.id,text:res.text,loading:false,ai:res.ai};ivRender(['pri']);
}
function ivRenderPri(){
 const s=ivState,rows=priRows();const list=$i('ivPriList');
 const shown=s.ui.showAll?rows:rows.slice(0,12);
 $i('ivPriChips').innerHTML=chip('Mod: '+modeLbl(s.selectedMode),'info')+chip('Harga '+(s.selectedMode==='pengeluar'?'Ladang':'Runcit'),'grey')+chip(rows.length+' isu',rows.length?'warn':'ok')+tagD;
 const bn=s.ui.priBanner;let bh='';
 if(bn){bh=`<div class="iv-banner info" id="ivPriBannerBox" tabindex="-1">${bn.loading?'Menyediakan cadangan…':E(bn.text)} <button type="button" class="button tiny ghost" data-iv-act="jumpP4">Lompat ke Paparan 4</button></div>`}
 $i('ivPriBanner').innerHTML=bh;
 if(!rows.length){list.innerHTML='<div class="iv-empty">Tiada isu keutamaan untuk penapis ini</div>'}
 else list.innerHTML=shown.map(r=>{
  const lv=r.cls.level;const tel=!isKg(r.commodityId);
  return `<div class="iv-row" role="button" tabindex="0" aria-pressed="${s.selectedInterventionId===r.id}" data-iv-act="selRow" data-iv-arg="${E(r.id)}">
   <div class="iv-row-main"><div class="iv-row-t"><span class="iv-lv ${lv}">${LV_LABEL[lv]}</span> · ${E(r.commodity)}</div>
   <div class="iv-row-s">${E(r.district)}, ${E(r.negeri)} · ${E(r.poName)}</div>
   <div class="iv-row-s"><b>Jenis isu:</b> ${E(issueLabel(r))}</div>
   <div class="iv-row-s">Harga semasa ${rmAny(r.price.actual)} · forecast ${rmAny(r.price.forecast)} · sisihan ${sgn(r.price.devPct,1)}%</div>
   <div class="iv-row-s"><b>Intervensi:</b> ${E(intervType(r))}</div>
   ${r.cls.flag?`<div class="iv-row-s">${chip(r.cls.flag,'warn')}</div>`:''}${tel?`<div class="iv-row-s">${chip('Telur: bekalan dalam unit lain, tidak dinilai','grey')}</div>`:''}</div>
   <div class="iv-row-side"><span title="Komponen skor: harga ${(r.comp.P*100).toFixed(0)}%, bekalan ${(r.comp.S*100).toFixed(0)}%, forecast ${(r.comp.F*100).toFixed(0)}%, pengesahan ${(r.comp.C*100).toFixed(0)}%"><b>Skor ${r.score}</b></span>${r.price.overlay?`<span class="iv-chip warn" title="${E(r.price.overlay.note)}">Senario ujian (dummy)</span>`:''}<button type="button" class="button tiny iv-act" data-iv-act="tindakan" data-iv-arg="${E(r.id)}">Tindakan</button></div></div>`}).join('');
 const pend=rows.filter(r=>r.cls.flag==='Menunggu pengesahan bekalan').length;
 let foot='';
 if(rows.length>12)foot+=`<button type="button" class="button tiny ghost" data-iv-act="showAll">${s.ui.showAll?'Papar 12 teratas':'Papar semua ('+rows.length+')'}</button> `;
 if(pend)foot+=`${pend} isu harga menunggu pengesahan bekalan. `;
 foot+='Skor ialah indeks keutamaan prototaip, bukan kebarangkalian.';
 $i('ivPriFoot').innerHTML=foot;
}

/* ===== Paparan 4 ===== */
function mobResolve(){
 const s=ivState,po=effPO(),cm=effCommodity(),mode=s.selectedMode;
 const row=po&&isKg(cm.id)?supplyRow(po,cm.id):null;
 const defNeed=row?(mode==='pengeluar'?row.surplusMT:row.shortageMT):0;
 const ap=po?ivPrice(po,cm.id,'Borong'):null;
 const need=s.mob.needMT!=null?s.mob.needMT:(defNeed>0?+defNeed.toFixed(1):1);
 const ref=s.mob.refPrice!=null?s.mob.refPrice:(ap?+ap.actual.toFixed(2):null);
 return {po,cm,mode,row,defNeed,need,ref,anchorPrice:ap,needDefault:s.mob.needMT==null,refDefault:s.mob.refPrice==null};
}
function curEngine(){
 const r=mobResolve();if(!r.po||!isKg(r.cm.id)||r.ref==null)return null;
 return mobilisationEngine({mode:r.mode,anchorPOId:r.po,commodityId:r.cm.id,needMT:r.need,refPrice:r.ref,wPrice:ivState.mob.wPrice,distLimitKm:ivState.mob.distLimitKm,days:ivState.selectedDateRange.days,now:nowMs()});
}
function ivRenderMobCtl(){
 const s=ivState,r=mobResolve();const box=$i('ivMobCtl'),head=$i('ivMobHead');
 $i('ivMobChips').innerHTML=chip('Mod: '+modeLbl(s.mode||s.selectedMode),'info')+tagD+notApplicable('mob');
 if(!r.po){head.innerHTML='';box.innerHTML='<div class="iv-empty">Pilih Pusat Operasi pada peta atau senarai keutamaan</div>';return}
 const p=IV_POBY[r.po];
 if(!isKg(r.cm.id)){head.innerHTML='';box.innerHTML=`<div class="iv-banner">Unit komoditi (${E(IV_COMMBY[r.cm.id].unit)}) tidak disokong untuk pengiraan MT dan RM/kg. Pilih komoditi RM/kg.</div>`;return}
 const role=r.mode==='pengeluar'?'PO SUMBER (lebihan stok)':'PO DESTINASI (kekurangan stok)';
 const row=r.row;
 head.innerHTML=`<div class="iv-card"><div class="iv-chips"><span class="iv-chip info">${role}</span><b>${E(p.name)}</b>${chip(p.negeri)}${chip(IV_COMMBY[r.cm.id].name)}${chip('Peringkat Borong','grey')}${r.cm.def?chip('Komoditi panel: Cili Merah (lalai, penapis ialah Semua)','warn'):''}</div>
 <div class="iv-kv"><span>Harga Borong PO<b>${rmAny(r.anchorPrice&&r.anchorPrice.actual)}${r.anchorPrice&&r.anchorPrice.overlay?' *':''}</b></span><span>${r.mode==='pengeluar'?'Lebihan stok':'Kekurangan stok'} (dummy)<b>${row?f2(r.defNeed)+' MT':'—'}</b></span><span>Stok tersedia (dummy)<b>${row?f2(row.net)+' MT':'—'}</b></span><span>Keperluan (dummy)<b>${row?f2(row.requiredMT)+' MT':'—'}</b></span></div></div>`;
 const sig=[s.selectedMode,r.po,r.cm.id,s.selectedInterventionId].join('|');
 const hints=()=>{const a=$i('ivNeedHint'),b=$i('ivRefHint');if(a)a.innerHTML=r.needDefault?'dari data dummy':'ditetapkan pengguna <a href="#" data-iv-act="resetNeed">Pulih lalai</a>';if(b)b.innerHTML=r.refDefault?'lalai: harga Borong PO':'ditetapkan pengguna <a href="#" data-iv-act="resetRef">Pulih lalai</a>'};
 if(box.dataset.sig===sig&&box.firstChild){hints();return}
 box.dataset.sig=sig;
 box.innerHTML=`<div class="iv-ctl">
  <label>Keperluan/lebihan (MT)<input class="iv-in" type="number" id="ivNeed" data-iv-in="need" min="0.1" max="500" step="0.1" value="${r.need}"><span class="iv-err" id="ivNeedErr"></span><small id="ivNeedHint"></small></label>
  <label>Harga rujukan pasaran (RM/kg)<input class="iv-in" type="number" id="ivRef" data-iv-in="ref" min="0.01" max="999" step="0.01" value="${r.ref}"><span class="iv-err" id="ivRefErr"></span><small id="ivRefHint"></small></label>
  <label>Wajaran harga <b id="ivWPL">${s.mob.wPrice}%</b><input type="range" id="ivWP" data-iv-in="wp" min="0" max="100" step="5" value="${s.mob.wPrice}" aria-label="Wajaran harga"></label>
  <label>Wajaran jarak/kos <b id="ivWDL">${100-s.mob.wPrice}%</b><input type="range" id="ivWD" data-iv-in="wd" min="0" max="100" step="5" value="${100-s.mob.wPrice}" aria-label="Wajaran jarak dan kos"></label>
  <label>Had jarak (km)<input class="iv-in" type="number" id="ivLimit" data-iv-in="limit" min="50" max="2000" step="10" value="${s.mob.distLimitKm}"><span class="iv-err" id="ivLimitErr"></span></label>
 </div><div class="iv-note" id="ivWTotal">Jumlah wajaran: <b>${s.mob.wPrice}% + ${100-s.mob.wPrice}% = 100%</b></div>`;
 hints();
}
function candCard(c,side,key){
 const s=ivState;const lbl=s.selectedMode==='pengguna'?'Lebihan stok':'Keperluan';
 const chips=[];if(c.sameGroup)chips.push(chip('Kongsi kapasiti logistik (kumpulan gabungan)','info'));if(c.flood)chips.push(chip('Waspada banjir','warn'));
 if(c.overlay)chips.push(chip('Senario ujian (dummy)','warn'));
 return `<button type="button" class="iv-cand" aria-pressed="${s.mob.candidateKey===c.poId}" data-iv-act="cand" data-iv-arg="${E(c.poId)}" data-iv-side="${side}"><div class="iv-cand-h"><span>#${c.rank} ${E(c.name)}</span><span>Skor ${c.score}/100</span></div>
 <div class="iv-row-s">${E(c.negeri)}</div>
 <div class="iv-kv"><span>${lbl}<b>${f2(c.stockMT)} MT</b></span><span>Harga ${s.selectedMode==='pengguna'?'sumber':'destinasi'}<b>${rmAny(c.price)}</b></span><span>Anggaran jarak<b>${Math.round(c.km)} km</b></span><span>Kos pengangkutan<b>${rmAny(c.costPerKg)}/kg</b></span><span>Jurang harga bersih<b>${sgn(c.netGap)} RM/kg</b></span><span>Boleh dihantar<b>${f2(c.qty)} MT</b></span></div>
 <div class="iv-chips" style="margin-top:6px">${chips.join('')}</div></button>`;
}
function ivEngineFacts(r,eng){
 const top=eng.dalam[0]||eng.luar[0];if(!top)return null;
 return {top,inState:!!eng.dalam[0]};
}
let _mobAISeq=0;const _aiCache={};
async function ivFillMobAI(r,eng){
 const host=$i('ivMobAI');if(!host)return;
 const tf=ivEngineFacts(r,eng);if(!tf){host.innerHTML='';return}
 const t=tf.top,m=r.mode;
 const fb=`Berdasarkan pengiraan, ${t.name} (${tf.inState?'dalam negeri':'luar negeri'}) ialah calon utama ${m==='pengguna'?'sumber':'destinasi'} untuk ${commName(r.cm.id)}, dengan kuantiti boleh dihantar ${f2(t.qty)} MT, anggaran jarak ${Math.round(t.km)} km dan jurang harga bersih ${sgn(t.netGap)} RM/kg selepas kos pengangkutan. Cadangan ini perlu disahkan oleh pegawai operasi.`;
 const key=JSON.stringify([fb]);const seq=++_mobAISeq;
 if(_aiCache[key]&&!failFlags.ai){host.innerHTML=aiCard(_aiCache[key]);return}
 host.innerHTML='<div class="iv-ai" aria-busy="true"><h4>Ringkasan AI (simulasi, bukan keputusan)</h4><div class="iv-spin">Menjana ringkasan…</div></div>';
 const res=await callAI('explainMobilisation',{text:fb},fb);
 if(seq!==_mobAISeq)return;const h=$i('ivMobAI');if(!h)return;
 const o={text:res.text,ai:res.ai};if(res.ai)_aiCache[key]=o;h.innerHTML=aiCard(o);
}
const aiCard=o=>`<div class="iv-ai"><h4>Ringkasan AI (simulasi, bukan keputusan)</h4><div>${E(o.text)}</div>${o.ai?'':'<div class="iv-note">Penjelasan AI tidak tersedia, angka dikira oleh enjin.</div>'}<div class="iv-note">Model: ${aiAdapter.model}. Teks ini tidak menambah angka di luar blok pengiraan.</div></div>`;
function ivRenderMobRes(){
 const s=ivState,r=mobResolve(),host=$i('ivMobRes');
 if(!r.po||!isKg(r.cm.id)){host.innerHTML='';return}
 const eng=curEngine();if(!eng){host.innerHTML='';return}
 let h='';
 if(s.ui.scenPending)h+=`<div class="iv-chips">${chip('Amaran cuaca/banjir AMS sedang dimuatkan','warn')}</div>`;
 else if(s.ui.scenError)h+=`<div class="iv-chips">${chip('Data AMS tidak tersedia, hanya DATA.banjir digunakan','warn')}</div>`;
 const ad=disruptionLevel(r.po);
 if(ad)h+=`<div class="iv-banner ${ad.level==='Amaran'?'bad':''}">PO terpilih berada dalam ${ad.level==='Amaran'?'amaran':'waspada'} banjir. Sahkan akses laluan sebelum menghantar. <small>(${E(ad.source)})</small></div>`;
 if(!eng.trigger.ok){
  h+=`<div class="iv-empty">PO terpilih tiada lebihan/kekurangan bekalan yang disahkan<br><small>${E(eng.trigger.text||'')}</small></div>`;
  host.innerHTML=h;return;
 }
 const tf=ivEngineFacts(r,eng);
 const empD='Tiada PO dalam negeri yang layak. Sistem tidak menambah calon yang tidak memenuhi syarat.',empL='Tiada PO luar negeri yang layak. Sistem tidak menambah calon yang tidak memenuhi syarat.';
 if(tf){const t=tf.top;
  h+=`<div class="iv-calc" id="ivMobSummary"><h4>Ringkasan Cadangan Mobilisasi ${tagD}</h4>
  <div class="iv-kv"><span>PO ${r.mode==='pengguna'?'sumber':'destinasi'} dicadangkan<b>${E(t.name)}</b></span><span>Lokasi<b>${tf.inState?'Dalam negeri':'Luar negeri'} (${E(t.negeri)})</b></span><span>Kuantiti<b>${f2(t.qty)} MT</b></span><span>Kos pengangkutan<b>${rmAny(t.costPerKg)}/kg (RM ${Math.round(t.totalCost).toLocaleString('ms-MY')})</b></span><span>Jurang harga bersih<b>${sgn(t.netGap)} RM/kg</b></span><span>Anggaran faedah<b>RM ${Math.round(t.netGap*1000*t.qty).toLocaleString('ms-MY')}</b></span></div>
  <div class="iv-note"><b>Mengapa:</b> skor tertinggi ${t.score}/100 dalam senarai ${tf.inState?'Dalam Negeri':'Luar Negeri'}; jurang harga bersih positif dan jarak ${Math.round(t.km)} km dalam had ${s.mob.distLimitKm} km. <b>Kekangan:</b> ${t.vehicleKnown?'kenderaan tersedia dihadkan kepada '+f2(t.vehicleCapMT)+' MT':'ketersediaan kenderaan semasa tidak diketahui (kapasiti maksimum statik '+f2(t.maxCapMT)+' MT)'}${t.sameGroup?'; kapasiti logistik dikongsi dengan PO terpilih':''}${t.flood?'; waspada banjir':''}. Stok: Belum disahkan.</div></div><div id="ivMobAI"></div>`;
 }
 h+=`<div class="iv-two" style="margin-top:10px"><div><div class="iv-sec">TOP 5 PO DALAM NEGERI ${E(IV_POBY[r.po].negeri)} ${tagD}</div><div id="ivListDalam">${eng.dalam.length?eng.dalam.map(c=>candCard(c,'dalam')).join(''):`<div class="iv-empty">${empD}</div>`}</div></div>
 <div><div class="iv-sec">TOP 5 PO LUAR NEGERI ${tagD}</div><div id="ivListLuar">${eng.luar.length?eng.luar.map(c=>candCard(c,'luar')).join(''):`<div class="iv-empty">${empL}</div>`}</div></div></div>`;
 const all=[...eng.dalam,...eng.luar];const sel=all.find(c=>c.poId===s.mob.candidateKey);
 if(sel){
  const src=r.mode==='pengguna'?sel.name:poName(r.po),dst=r.mode==='pengguna'?poName(r.po):sel.name;
  const risks=[];if(ad&&ad.level==='Amaran')risks.push('Destinasi/sumber terjejas banjir');if(sel.flood)risks.push('Waspada banjir pada '+sel.name);if(sel.sameGroup)risks.push('Kapasiti kenderaan dikongsi dengan PO terpilih');if(!sel.vehicleKnown)risks.push('Ketersediaan kenderaan semasa tidak diketahui. Kapasiti maksimum statik: '+f2(sel.maxCapMT)+' MT');
  h+=`<div class="iv-card" id="ivCandDetail" style="margin-top:10px"><h4>Butiran calon: ${E(sel.name)}</h4>
  <div class="iv-kv"><span>PO sumber<b>${E(src)}</b></span><span>PO destinasi<b>${E(dst)}</b></span><span>Komoditi<b>${E(commName(r.cm.id))}</b></span><span>Kuantiti<b>${f2(sel.qty)} MT</b></span><span>Jarak<b>${Math.round(sel.km)} km (anggaran dummy)</b></span><span>Kos<b>${rmAny(sel.costPerKg)}/kg · RM ${Math.round(sel.totalCost).toLocaleString('ms-MY')}</b></span><span>Status pengesahan stok<b>Belum disahkan</b></span></div>
  <ul class="iv-note"><li>Justifikasi: jurang harga bersih ${sgn(sel.netGap)} RM/kg selepas kos ${rmAny(sel.costPerKg)}/kg.</li><li>Skor harga ${(sel.priceScore*100).toFixed(0)}%, skor jarak ${(sel.distScore*100).toFixed(0)}% (wajaran ${s.mob.wPrice}/${100-s.mob.wPrice}).</li></ul>
  <div class="iv-sec">RISIKO PENGHANTARAN</div><ul class="iv-note">${risks.length?risks.map(x=>`<li>${E(x)}</li>`).join(''):'<li>Tiada risiko tambahan dikesan oleh enjin.</li>'}</ul>
  <button type="button" class="button" id="ivDraftBtn" data-iv-act="draft">Sediakan Cadangan Intervensi</button> <span class="iv-note">Hanya draf (status: draf). Tiada kelulusan atau pelaksanaan automatik.</span></div>`;
 }
 h+=`<details style="margin-top:10px"><summary class="iv-note" style="cursor:pointer">${eng.excluded.length} PO ditapis keluar</summary><ul class="iv-note" id="ivExcluded">${eng.excluded.map(x=>`<li>${E(x.name)}: ${E(x.reason)}</li>`).join('')}</ul></details>`;
 host.innerHTML=h;
 if(tf)ivFillMobAI(r,eng);
}
function createDraft(){
 const s=ivState,r=mobResolve(),eng=curEngine();if(!eng||!eng.trigger.ok)return;
 const all=[...eng.dalam,...eng.luar];const c=all.find(x=>x.poId===s.mob.candidateKey);if(!c)return;
 const src=r.mode==='pengguna'?c.poId:r.po,dst=r.mode==='pengguna'?r.po:c.poId;
 if(ivDrafts.some(d=>d.status==='draf'&&d.sourcePOId===src&&d.destinationPOId===dst&&d.commodityId===r.cm.id&&d.quantityMT===+c.qty.toFixed(2))){toastSafe('Draf yang sama sudah wujud');return}
 const ds=myDate(refNow).replace(/-/g,'');const suf=Math.max(0,...ivDrafts.filter(d=>d.interventionId.startsWith('IV-'+ds+'-')).map(d=>+d.interventionId.slice(-3)||0))+1;
 const ad=disruptionLevel(r.po);
 ivDrafts.push({interventionId:`IV-${ds}-${String(suf).padStart(3,'0')}`,mode:r.mode,status:'draf',createdAt:refNow,sourcePOId:src,destinationPOId:dst,commodityId:r.cm.id,quantityMT:+c.qty.toFixed(2),distanceKm:Math.round(c.km),transportCostPerKg:+c.costPerKg.toFixed(3),netGapPerKg:+c.netGap.toFixed(3),score:c.score,justification:`Jurang harga bersih ${sgn(c.netGap)} RM/kg selepas kos pengangkutan; skor ${c.score}/100.`,deliveryRisk:(ad&&ad.level==='Amaran'?'PO terpilih berada dalam amaran banjir. Sahkan akses laluan sebelum menghantar. ':'')+(c.vehicleKnown?'':'Ketersediaan kenderaan tidak diketahui.'),stockVerification:'belum disahkan',weights:{price:s.mob.wPrice,dist:100-s.mob.wPrice},createdBy:'prototaip',source:'dummy'});
 const ok=saveDrafts();toastSafe(ok?'Draf cadangan intervensi disediakan (status: draf)':'Draf disimpan sementara dalam sesi ini sahaja');
 ivRender(['draft']);return true;
}
function ivRenderDrafts(){
 const box=$i('ivDraftBox');
 box.innerHTML=`<details style="margin-top:12px" ${ivDrafts.length?'open':''}><summary class="iv-sec" style="cursor:pointer">DRAF CADANGAN INTERVENSI (${ivDrafts.length}) ${tagD}</summary><div id="ivDrafts">${ivDrafts.length?ivDrafts.map(d=>`<div class="iv-draft"><span><b>${E(d.interventionId)}</b> · ${E(commName(d.commodityId))} · ${E(poName(d.sourcePOId))} → ${E(poName(d.destinationPOId))} · ${f2(d.quantityMT)} MT · ${E(d.distanceKm)} km ${chip('status: draf','warn')}</span><button type="button" class="button tiny danger" data-iv-act="delDraft" data-iv-arg="${E(d.interventionId)}">Padam Draf</button></div>`).join(''):'<div class="iv-empty">Belum ada draf. Pilih calon dan tekan “Sediakan Cadangan Intervensi”.</div>'}</div></details>`;
}

/* ===== Paparan 5 ===== */
function marCtx(){const po=effPO(),cm=effCommodity();return {po,cm}}
function ivRenderMarDefs(){
 $i('ivMarDefs').innerHTML=`<div class="iv-defs"><p><b>Harga Borong Beli:</b> harga yang FAMA PO jual kepada pemborong luar.</p><p><b>Harga Borong Jual:</b> harga jualan borong yang diperhatikan dan dikutip oleh FAMA di pasaran terbuka.</p><p><b>Spread = Harga Borong Jual − Harga Borong Beli. Spread bukan margin operasi PO.</b></p><p class="iv-note">Harga Jualan PO (dalam formula) = Harga Borong Beli. Margin% = (Jualan − Ladang − Kos) ÷ Jualan × 100; Harga Ladang Maksimum = Jualan × (1 − sasaran) − Kos; Harga Jualan Minimum = (Ladang + Kos) ÷ (1 − sasaran).</p></div>`;
}
function seedMargin(){
 const {po,cm}=marCtx();const m=ivState.margin;const ctx=po+'|'+cm.id;
 if(!po||!isKg(cm.id)){return}
 if(m.ctx!==ctx&&!m.touched){const d=marginDefaults(po,cm.id);m.jual=d.jual!=null?String(d.jual):'';m.beli=d.beli!=null?String(d.beli):'';m.ladang=d.ladang!=null?String(d.ladang):'';m.kos=String(d.kos);m.target='15'}
 m.ctx=ctx;
}
function ivRenderMarCtl(){
 const {po,cm}=marCtx();const box=$i('ivMarCtl'),res=$i('ivMarRes');const m=ivState.margin;
 $i('ivMarChips').innerHTML=tagD+notApplicable('mar');
 if(!po){box.innerHTML='';res.innerHTML='<div class="iv-empty">Pilih Pusat Operasi pada peta atau senarai keutamaan</div>';box.dataset.sig='';return}
 if(!isKg(cm.id)){box.innerHTML='';res.innerHTML=`<div class="iv-banner">Unit komoditi (${E(IV_COMMBY[cm.id].unit)}) tidak disokong untuk pengiraan MT dan RM/kg. Pilih komoditi RM/kg.</div>`;box.dataset.sig='';return}
 seedMargin();
 const sig=po+'|'+cm.id+'|'+m.ctx;
 if(box.dataset.sig===sig&&box.firstChild)return;box.dataset.sig=sig;
 const d=marginDefaults(po,cm.id);
 box.innerHTML=`<div class="iv-chips"><span>PO:</span><select class="iv-in" style="width:auto" data-iv-sel="marpo" aria-label="PO simulasi margin">${IV_PO.map(p=>`<option value="${E(p.id)}"${p.id===po?' selected':''}>${E(p.name)}</option>`).join('')}</select>${chip('Komoditi: '+IV_COMMBY[cm.id].name,'info')}${cm.def?chip('lalai (penapis ialah Semua)','warn'):''}${d.override?chip('nilai lalai ujian (dummy)','warn'):''}<button type="button" class="button tiny ghost" data-iv-act="marReset">Pulih nilai lalai</button></div>
 <div class="iv-ctl">
 <label>Harga Borong Jual (RM/kg)<input class="iv-in" type="number" step="0.01" data-iv-in="m-jual" id="ivMJual" value="${E(m.jual)}"><span class="iv-err" id="ivMJualErr"></span></label>
 <label>Harga Borong Beli (RM/kg)<input class="iv-in" type="number" step="0.01" data-iv-in="m-beli" id="ivMBeli" value="${E(m.beli)}"><span class="iv-err" id="ivMBeliErr"></span></label>
 <label>Harga Belian Ladang (RM/kg)<input class="iv-in" type="number" step="0.01" data-iv-in="m-ladang" id="ivMLadang" value="${E(m.ladang)}"><span class="iv-err" id="ivMLadangErr"></span></label>
 <label>Kos Operasi (RM/kg)<input class="iv-in" type="number" step="0.01" data-iv-in="m-kos" id="ivMKos" value="${E(m.kos)}"><span class="iv-err" id="ivMKosErr"></span></label>
 <label>Margin Sasaran (%)<input class="iv-in" type="number" step="0.5" data-iv-in="m-target" id="ivMTarget" value="${E(m.target)}"><input type="range" min="0" max="95" step="1" data-iv-in="m-target-range" id="ivMTargetR" value="${E(Math.min(95,Math.max(0,Number(m.target)||0)))}" aria-label="Margin sasaran"><span class="iv-err" id="ivMTargetErr"></span></label></div>`;
}
let _lastGoodMargin=null;
function ivRenderMarRes(){
 const {po,cm}=marCtx();const host=$i('ivMarRes');const m=ivState.margin;
 if(!po||!isKg(cm.id))return;
 const v=validateMargin(m);
 ['jual','beli','ladang','kos','target'].forEach(k=>{const id={jual:'ivMJual',beli:'ivMBeli',ladang:'ivMLadang',kos:'ivMKos',target:'ivMTarget'}[k];const inp=$i(id),er=$i(id+'Err');if(!inp)return;if(v.err[k]){inp.setAttribute('aria-invalid','true');if(er)er.textContent=v.err[k]}else{inp.removeAttribute('aria-invalid');if(er)er.textContent=''}});
 const hist=historyOf(po,cm.id);
 const fl=ivPrice(po,cm.id,'Ladang',30);
 const ctx={farmFloor:fl?fl.floor:0};
 let note='';
 if(v.ok){_lastGoodMargin={v:v.val,po,cm:cm.id}}
 const use=v.ok?v.val:(_lastGoodMargin&&_lastGoodMargin.po===po&&_lastGoodMargin.cm===cm.id?_lastGoodMargin.v:null);
 if(!use){host.innerHTML=`<div class="iv-banner">Masukkan nilai yang sah untuk melihat hasil simulasi. ${Object.values(v.err).map(E).join('. ')}</div>`;return}
 if(!v.ok)note=`<div class="iv-banner">Input tidak sah (${Object.values(v.err).map(E).join('; ')}). Hasil terakhir yang sah dikekalkan.</div>`;
 const r=simulateMargin(use,hist,ctx);
 const warnBeli=r.buyAboveSell?'<div class="iv-banner" id="ivWarnBeli">Harga Borong Beli melebihi Harga Borong Jual</div>':'';
 const tile=(l,val)=>`<div class="iv-stat"><div><b>${val}</b><span>${l}</span></div></div>`;
 let h=note+warnBeli+`<div class="iv-stats" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))" id="ivMarSummary">${tile('Harga Borong Beli',rmAny(r.S))}${tile('Harga Borong Jual',rmAny(r.J))}${tile('Spread Semasa',sgn(r.spread)+' RM/kg')}${tile('Margin Operasi PO Semasa',fin(r.cur)?sgn(r.cur,2)+' %':'—')}</div>`;
 const INF='Tiada julat harga yang memenuhi margin sasaran';
 const farm=r.farmOk?`<div class="iv-big" id="ivMaxFarm">${rmPos(r.maxF)}</div><div class="iv-note">Harga belian maksimum</div><div class="iv-kv"><span>Julat dicadangkan<b>${rmPos(r.farmLow)} – ${rmPos(r.maxF)}</b></span><span>Kesan margin<b>${sgn(r.impact)} mata peratus</b></span></div>`:`<div class="iv-big">—</div><div class="iv-banner" id="ivFarmInf">${INF}</div>`;
 let sell;
 if(!r.enough)sell=`<div class="iv-big" id="ivMinSell">${rmPos(r.minS)}</div><div class="iv-note">Harga minimum untuk margin sasaran</div><div class="iv-banner" id="ivHistWarn">Data sejarah tidak mencukupi (${r.hs?r.hs.n:0} minggu, perlu sekurang-kurangnya ${IV_CONFIG.minHistory}). Julat sokongan pasaran tidak dipaparkan.</div>`;
 else if(r.sellOk)sell=`<div class="iv-big" id="ivSellRange">${rmPos(r.recLow)} – ${rmPos(r.recHigh)}</div><div class="iv-note">Julat jualan dicadangkan (julat dicadangkan, bukan nilai optimum)</div><div class="iv-kv"><span>Harga minimum untuk margin sasaran<b id="ivMinSell">${rmPos(r.minS)}</b></span><span>Margin pada hujung julat<b>${fin(r.marginAtLow)?r.marginAtLow.toFixed(2):'—'}% – ${fin(r.marginAtHigh)?r.marginAtHigh.toFixed(2):'—'}%</b></span><span>Julat sokongan pasaran<b>${rmPos(r.mLow)} – ${rmPos(r.mHigh)}</b></span></div>`;
 else sell=`<div class="iv-big">—</div><div class="iv-note">Harga minimum untuk margin sasaran: <b id="ivMinSell">${rmPos(r.minS)}</b></div><div class="iv-banner" id="ivSellInf">${INF}</div>`;
 h+=`<div class="iv-two" style="margin-top:10px"><div class="iv-res-g" id="ivCardFarm"><h4>Cadangan Harga Belian Ladang</h4>${farm}</div><div class="iv-res-c" id="ivCardSell"><h4>Cadangan Harga Jualan Borong PO</h4>${sell}</div></div>`;
 const hs=r.hs;
 h+=`<div class="iv-card" style="margin-top:10px" id="ivHistBlock"><h4>Analisis Spread Sejarah ${tagD}</h4>${hs?`<div class="iv-kv"><span>Purata<b id="ivHMean">${f2(hs.mean)}</b></span><span>Median<b id="ivHMed">${f2(hs.median)}</b></span><span>Sisihan piawai<b id="ivHSd">${f2(hs.sd)}</b></span><span>Trend<b id="ivHTrend">${hs.trend}</b></span><span>Bilangan minggu<b>${hs.n}</b></span></div>`:'<div class="iv-note">Tiada data sejarah.</div>'}<div class="iv-note">Jika sejarah kurang daripada ${IV_CONFIG.minHistory} minggu, julat sokongan pasaran tidak dipaparkan. Sejarah ialah data dummy yang dijana secara deterministik.</div></div>`;
 const open=ivState.ui.marInsight;
 h+=`<div style="margin-top:10px"><button type="button" class="button ghost" id="ivInsightBtn" data-iv-act="marInsight" aria-expanded="${open}">${open?'▾':'▸'} Pandangan AI Margin</button><div id="ivInsight" ${open?'':'hidden'}></div></div>`;
 host.innerHTML=h;
 if(open)ivFillInsight(r,po,cm.id);
}
let _insSeq=0;
async function ivFillInsight(r,po,cid){
 const host=$i('ivInsight');if(!host)return;const seq=++_insSeq;
 const fb=`Margin semasa ${fin(r.cur)?r.cur.toFixed(2)+'%':'tidak dapat dikira'} berbanding sasaran ${r.t.toFixed(2)}%. Harga belian ladang maksimum untuk sasaran ialah ${rmPos(r.maxF)} (semasa ${rmAny(r.F)}), jadi kemampanan harga belian ${r.F<=r.maxF?'mencukupi':'tidak mencukupi'}. Harga jualan minimum ialah ${rmPos(r.minS)} berbanding harga jualan semasa ${rmAny(r.S)}, jadi kecukupan harga jualan ${r.S>=r.minS?'mencukupi':'tidak mencukupi'}. Risiko harga jatuh: ${r.hs&&r.hs.trend==='turun'?'trend spread menurun':'tiada isyarat trend menurun'}. Cadangan pelarasan: ${r.F>r.maxF?'turunkan harga belian ladang atau naikkan harga jualan':'kekalkan dan pantau'}.`;
 host.innerHTML='<div class="iv-ai" aria-busy="true"><div class="iv-spin">Menjana pandangan…</div></div>';
 const res=await callAI('explainMargin',{text:fb},fb);
 if(seq!==_insSeq)return;const h=$i('ivInsight');if(!h)return;
 h.innerHTML=`<div class="iv-ai"><h4>Pandangan AI Margin (simulasi)</h4><div>${E(res.text)}</div>${res.ai?'':'<div class="iv-note">Penjelasan AI tidak tersedia, angka dikira oleh enjin.</div>'}<div class="iv-note">Nasihat sahaja dan tertakluk kepada pengesahan operasi.</div></div>`;
}

/* ===== Paparan 6 ===== */
let museAll=[],museMeta={dropped:0,lastDataDate:'2026-11-14',processing:'Siap'};
const ivDataService={loadMuse(){return new Promise((res,rej)=>{setTimeout(()=>{if(failFlags.muse){failFlags.muse=false;rej(new Error('Kegagalan data Muse disuntik (ujian)'));return}res({status:'dummy',lastDataDate:'2026-11-14',processingStatus:'Siap',records:IV_MUSE_RAW.map(x=>({...x}))})},250)})}};
async function ivLoadMuse(){
 ivState.muse.status='loading';ivRender(['muse']);
 try{
  const d=await ivDataService.loadMuse();const v=validateMuseRaw(d.records);
  const ex=await Promise.all(v.ok.map(r=>aiAdapter.extractMuseIssue(r)));
  museAll=ex.map(x=>x.data);museMeta={dropped:v.dropped,lastDataDate:d.lastDataDate,processing:v.dropped?`Sebahagian (${v.dropped} rekod tidak sah)`:d.processingStatus};
  ivState.muse.status='ready';
 }catch(err){console.warn('Data AI Muse tidak dapat dimuatkan',err&&err.message);ivState.muse.status='error'}
 ivRender(['muse']);
}
function sparkline(i){
 const pts=[i.riskBefore,i.riskCurrent,i.riskForward];const mx=Math.max(50,...pts);const W=160,H=44;
 const xy=pts.map((v,k)=>[10+k*70,H-6-(v/mx)*(H-14)]);
 return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Trend risiko: sebelum ${i.riskBefore}, semasa ${i.riskCurrent}, ramalan ${i.riskForward}"><polyline fill="none" stroke="#34d2ed" stroke-width="2" points="${xy.map(p=>p.join(',')).join(' ')}"/>${xy.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#34d2ed"/>`).join('')}</svg>`;
}
function ivRenderMuse(){
 const s=ivState,body=$i('ivMuseBody'),ms=s.muse;
 $i('ivMuseChips').innerHTML=tagD+chip('Kelompok harian','grey')+notApplicable('muse');
 if(ms.status==='loading'){body.innerHTML='<div class="iv-empty" aria-busy="true">Memuatkan data AI Muse…</div>';return}
 if(ms.status==='error'){body.innerHTML='<div class="iv-banner bad">Data AI Muse tidak dapat dimuatkan <button type="button" class="button tiny" data-iv-act="museRetry">Cuba Semula</button></div>';return}
 const ws=ms.weekStart,cur=weekStart(myDate(refNow));
 let list=museWeekList(museAll,ws);
 const f=ivState;
 list=list.filter(i=>(!f.selectedCommodityId||i.commodityId===f.selectedCommodityId)&&(!f.selectedStateId||i.stateId===f.selectedStateId)&&(!f.selectedPOId||i.matchedPOId===f.selectedPOId)&&(!f.selectedDistrictId||i.districtId===f.selectedDistrictId)&&(f.selectedRisk==='all'||i.riskBand===({kritikal:'merah',waspada:'kuning',normal:'hijau'}[f.selectedRisk])));
 const locs=new Set(list.map(i=>i.districtId)).size,comms=new Set(list.map(i=>i.commodityId||i.commodityLabel)).size;
 const stale=museMeta.lastDataDate<addDays(myDate(refNow),-1);
 const minWs=weekStart(addDays(museEarliest(),-14));
 let h=`${stale?`<div class="iv-banner">Data lapuk: kemas kini terakhir pada ${fmtDate(museMeta.lastDataDate)}</div>`:''}
 <div class="iv-three" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
  <div class="iv-card"><div class="iv-sec" style="margin-top:0">MINGGU ANALISIS</div><div class="iv-chips"><button type="button" class="button tiny ghost" data-iv-act="museWeek" data-iv-arg="prev" aria-label="Minggu sebelum" ${addDays(ws,-7)<minWs?'disabled':''}>◀</button><b id="ivWeekLbl">${fmtWeek(ws)}</b><button type="button" class="button tiny ghost" data-iv-act="museWeek" data-iv-arg="next" aria-label="Minggu seterusnya" ${ws>=cur?'disabled':''}>▶</button></div><button type="button" class="button tiny" style="margin-top:6px" data-iv-act="museWeek" data-iv-arg="now">Minggu ini</button><div class="iv-note">Isnin hingga Ahad, waktu Malaysia (UTC+8)</div></div>
  <div class="iv-card"><div class="iv-sec" style="margin-top:0">TARIKH DATA TERAKHIR</div><b>${fmtDate(museMeta.lastDataDate)}</b></div>
  <div class="iv-card"><div class="iv-sec" style="margin-top:0">STATUS PEMPROSESAN</div><b>${E(museMeta.processing)}</b></div>
  <div class="iv-card"><div class="iv-sec" style="margin-top:0">BILANGAN ISU MINGGUAN</div><b class="iv-big" id="ivMuseN">${list.length}</b></div>
  <div class="iv-card"><div class="iv-sec" style="margin-top:0">LOKASI DIKENAL PASTI</div><b class="iv-big" id="ivMuseL">${locs}</b></div>
  <div class="iv-card"><div class="iv-sec" style="margin-top:0">KOMODITI TERLIBAT</div><b class="iv-big" id="ivMuseC">${comms}</b></div></div><div style="margin-top:12px" id="ivMuseCards">`;
 if(!list.length)h+='<div class="iv-empty" id="ivMuseEmpty">Tiada isu sentimen berlokasi yang memenuhi kriteria minggu ini</div>';
 list.forEach(i=>{
  const open=ms.expandedId===i.insightId,ev=!!ms.evidenceOpen[i.insightId];
  const bc=i.riskBand==='merah'?'bad':i.riskBand==='kuning'?'warn':'ok';const ch=i.riskCurrent-i.riskBefore;
  const ltl={disahkan:'Lokasi acara disahkan',disebut:'Lokasi hanya disebut',belum:'Lokasi belum disahkan'}[i.locationType];
  h+=`<button type="button" class="iv-muse-card" aria-expanded="${open}" data-iv-act="museExp" data-iv-arg="${E(i.insightId)}"><div class="iv-chips"><b>${E(i.commodityLabel)}</b>${chip(i.location.label)}${chip('Risiko '+(i.riskBand==='merah'?'Merah':i.riskBand==='kuning'?'Kuning':'Hijau'),bc)}${chip('Sentimen negatif','grey')}</div><div class="iv-row-s" style="margin-top:4px">${E(i.summary)}</div>
  <div class="iv-kv"><span>Risiko sebelum<b>${i.riskBefore}</b></span><span>Risiko semasa<b>${i.riskCurrent}</b></span><span>Perubahan<b>${sgn(ch,0)}</b></span><span>Indeks sentimen<b>${f2(i.sentimentIndex)}</b></span><span>Bilangan sampel<b>${i.sampleCount}</b></span><span>Sumber<b>${E(i.sourceName)}</b></span><span>Tarikh acara<b>${fmtDate(i.eventDate)}</b></span></div><div class="iv-row-s"><b>Tindakan disyorkan:</b> ${E(i.suggestedActions[0])}</div></button>`;
  if(open){
   h+=`<div class="iv-muse-x"><div class="iv-kv"><span>Lokasi diekstrak<b>${E(i.location.label)}</b></span><span>Jenis lokasi<b>${ltl}</b></span><span>Keyakinan lokasi<b>${Math.round(i.locationConfidence*100)}%</b></span><span>PO berkaitan<b>${i.matchedPOId?E(poName(i.matchedPOId)):'Belum disahkan'}</b></span></div><div class="iv-note">${E(i.explanation)}</div><div class="iv-sec">TREND RISIKO</div>${sparkline(i)}
   <div class="iv-sec">TINDAKAN DISYORKAN</div><ul class="iv-note">${i.suggestedActions.map(a=>`<li>${E(a)}</li>`).join('')}</ul>
   <div class="iv-fix"><button type="button" class="button tiny ghost" data-iv-act="museEv" data-iv-arg="${E(i.insightId)}" aria-expanded="${ev}">Lihat Butiran Bukti</button>${i.matchedPOId&&i.commodityId&&IV_COMMBY[i.commodityId]?`<button type="button" class="button tiny" data-iv-act="museXfer" data-iv-arg="${E(i.insightId)}">Hantar Konteks ke Senarai Keutamaan dan Mobilisasi</button>`:`<span class="iv-note">Padanan daerah kepada PO masih memerlukan pengesahan.</span>`}</div>
   ${ev?`<div class="iv-sec">BUKTI SUMBER</div>${i.evidence.map(e=>`<div class="iv-ev">“${E(e.quote)}”<br><small>${E(e.sourceName)} · ${fmtDate(e.date)}</small></div>`).join('')}`:''}</div>`;
  }
 });
 h+='</div><div class="iv-note">Isu dimasukkan hanya jika komoditi dikenal pasti, lokasi acara disahkan, tarikh acara (bukan tarikh rekod) berada dalam minggu dipilih, berkaitan pengeluaran/bekalan/harga/pemasaran dan bukan pendua. Sentimen negatif sahaja tidak dianggap kekurangan bekalan.</div>';
 body.innerHTML=h;
}

/* ===== Render ===== */
const _pan={filters:ivRenderFilters,map:ivRenderMap,log:ivRenderLog,pri:ivRenderPri,mob:()=>{ivRenderMobCtl();ivRenderMobRes()},mobres:()=>{ivRenderMobCtl();ivRenderMobRes()},draft:ivRenderDrafts,mar:()=>{ivRenderMarDefs();ivRenderMarCtl();ivRenderMarRes()},marres:()=>{ivRenderMarCtl();ivRenderMarRes()},muse:ivRenderMuse};
const DEP={ };
function ivRender(keys){
 const set=new Set(keys||ALL_PANELS);
 const order=['filters','map','log','pri','mob','mobres','draft','mar','marres','muse'];
 order.forEach(k=>{if(!set.has(k))return;
  if(k==='mobres'&&set.has('mob'))return;if(k==='marres'&&set.has('mar'))return;
  try{_pan[k]()}catch(err){console.error('Paparan gagal dipaparkan:',k,err);const t=({filters:'ivFilters',map:'ivMapChips',log:'ivLogBody',pri:'ivPriList',mob:'ivMobRes',mobres:'ivMobRes',draft:'ivDraftBox',mar:'ivMarRes',marres:'ivMarRes',muse:'ivMuseBody'})[k];const e=$i(t);if(e)e.innerHTML=`<div class="iv-banner bad">Paparan ini tidak dapat dipaparkan. Cuba semula <button type="button" class="button tiny" data-iv-act="retryPanel">Cuba Semula</button></div>`}});
}
function ivRenderAll(){ivRender(ALL_PANELS)}
let _scenSig='';
function scenSig(){return JSON.stringify(ivScenarios().map(s=>[s.scenarioId,s.riskLevel,s.affectedPOIds,s.validUntil]))}
function ivRefreshScenarios(force){
 const sg=scenSig();if(sg!==_scenSig||force){_scenSig=sg;ivRender(['map','pri','mob','log'])}
}
