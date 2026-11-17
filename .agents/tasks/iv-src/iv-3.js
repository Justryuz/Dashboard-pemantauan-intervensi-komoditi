/* ===== Pengendali acara ===== */
const root=$i('viewIntervensi');
function mobField(id,errId,val,lo,hi,msg){const inp=$i(id),er=$i(errId);const ok=Number.isFinite(val)&&val>=lo&&val<=hi;if(ok){inp.removeAttribute('aria-invalid');if(er)er.textContent=''}else{inp.setAttribute('aria-invalid','true');if(er)er.textContent=msg}return ok}
function onAct(el,ev){
 const a=el.dataset.ivAct,arg=el.dataset.ivArg;
 switch(a){
  case 'mode':ivDispatch('setMode',arg);break;
  case 'reset':ivDispatch('resetFilters');$i('ivMobCtl').dataset.sig='';$i('ivMarCtl').dataset.sig='';toastSafe('Penapis dan paparan disetkan semula');break;
  case 'backMY':ivState.selectedStateId=null;ivDispatch('setFilter',['po','all']);break;
  case 'outCat':ivDispatch('toggleOutletCat',arg);break;
  case 'district':ivDispatch('selectDistrict',arg);break;
  case 'selPO':ivDispatch('selectPO',arg);break;
  case 'selRow':{const r=recsNow().find(x=>x.id===arg);if(r){ivState.selectedInterventionId=r.id;ivRender(['log','pri','mob','mar'])}break}
  case 'tindakan':ivDispatch('selectIntervention',arg);{const b=$i('ivPriBannerBox');if(b)b.focus({preventScroll:true})}break;
  case 'showAll':ivState.ui.showAll=!ivState.ui.showAll;ivRender(['pri']);break;
  case 'jumpP4':$i('ivMobPanel').scrollIntoView({behavior:'smooth',block:'start'});break;
  case 'cand':ivDispatch('selectCandidate',arg);break;
  case 'draft':createDraft();break;
  case 'delDraft':ivDispatch('deleteDraft',arg);break;
  case 'resetNeed':$i('ivMobCtl').dataset.sig='';ivDispatch('setMob',['resetNeed']);break;
  case 'resetRef':$i('ivMobCtl').dataset.sig='';ivDispatch('setMob',['resetRef']);break;
  case 'marReset':$i('ivMarCtl').dataset.sig='';ivDispatch('resetMargin');break;
  case 'marInsight':ivState.ui.marInsight=!ivState.ui.marInsight;ivRender(['marres']);break;
  case 'museWeek':ivDispatch('museWeek',arg);break;
  case 'museExp':ivDispatch('museExpand',arg);break;
  case 'museEv':ivDispatch('museEvidence',arg);break;
  case 'museXfer':ivDispatch('museTransfer',arg);break;
  case 'museRetry':ivLoadMuse();break;
  case 'mapRetry':ivRetryMap();break;
  case 'retryPanel':ivRenderAll();break;
 }
}
root.addEventListener('click',ev=>{const el=ev.target.closest('[data-iv-act]');if(!el||!root.contains(el))return;if(el.tagName==='A')ev.preventDefault();onAct(el,ev)});
root.addEventListener('keydown',ev=>{if(ev.key!=='Enter'&&ev.key!==' ')return;const el=ev.target.closest&&ev.target.closest('[data-iv-act]');if(!el||el!==ev.target||el.tagName==='BUTTON'||el.tagName==='A'||el.tagName==='INPUT')return;ev.preventDefault();onAct(el,ev)});
root.addEventListener('change',ev=>{
 const t=ev.target;const k=t.dataset&&t.dataset.ivSel;if(!k)return;
 if(k==='marpo'){ivDispatch('selectPO',t.value);return}
 ivDispatch('setFilter',[k,t.value]);
});
root.addEventListener('input',ev=>{
 const t=ev.target;const k=t.dataset&&t.dataset.ivIn;
 if(t.dataset&&t.dataset.ivThr){
  const [m,w]=t.dataset.ivThr.split('.');const v=Number(t.value);const ok=t.value!==''&&Number.isFinite(v)&&ivDispatch('setThreshold',[m,w,v])!==false;
  if(ok){t.removeAttribute('aria-invalid');$i('ivThrErr').textContent='';ivRender(ALL_PANELS)}else{t.setAttribute('aria-invalid','true');$i('ivThrErr').textContent='Ambang tidak sah: amaran antara 1 dan 50; kritikal lebih besar daripada amaran dan tidak melebihi 90'}
  return;
 }
 if(!k)return;
 if(k==='need'){const v=Number(t.value);if(t.value!==''&&mobField('ivNeed','ivNeedErr',v,0.1,500,'Masukkan 0.1 hingga 500 MT'))ivDispatch('setMob',['need',v]);else mobField('ivNeed','ivNeedErr',NaN,0.1,500,'Masukkan 0.1 hingga 500 MT')}
 else if(k==='ref'){const v=Number(t.value);if(t.value!==''&&mobField('ivRef','ivRefErr',v,0.01,999,'Masukkan harga RM/kg antara 0.01 dan 999'))ivDispatch('setMob',['ref',v]);else mobField('ivRef','ivRefErr',NaN,0.01,999,'Masukkan harga RM/kg antara 0.01 dan 999')}
 else if(k==='limit'){const v=Number(t.value);if(t.value!==''&&mobField('ivLimit','ivLimitErr',v,50,2000,'Masukkan 50 hingga 2000 km'))ivDispatch('setMob',['limit',v]);else mobField('ivLimit','ivLimitErr',NaN,50,2000,'Masukkan 50 hingga 2000 km')}
 else if(k==='wp'||k==='wd'){
  const raw=Number(t.value);const wp=k==='wp'?raw:100-raw;ivDispatch('setMob',['wPrice',wp]);
  const w=ivState.mob.wPrice;$i('ivWP').value=w;$i('ivWD').value=100-w;$i('ivWPL').textContent=w+'%';$i('ivWDL').textContent=(100-w)+'%';$i('ivWTotal').innerHTML=`Jumlah wajaran: <b>${w}% + ${100-w}% = 100%</b>`;
 }
 else if(k.startsWith('m-')){
  const f=k.slice(2);
  if(f==='target-range'){ivDispatch('setMargin',['target',t.value]);$i('ivMTarget').value=t.value}
  else{ivDispatch('setMargin',[f,t.value]);if(f==='target'){const n=Number(t.value);if(Number.isFinite(n))$i('ivMTargetR').value=Math.min(95,Math.max(0,n))}}
 }
});
$i('ivFilterToggle').addEventListener('click',()=>{const f=$i('ivFilters');const c=f.classList.toggle('iv-collapsed');$i('ivFilterToggle').setAttribute('aria-expanded',String(!c))});

/* ===== Tab ===== */
const tabM=$i('ivTabMonitor'),tabI=$i('ivTabIv'),viewM=$i('viewMonitor');
let ivInited=false,ivActive='pemantauan';
function writeHash(h){try{history.replaceState(null,'','#'+h)}catch(_){try{location.hash=h}catch(__){}}}
function showTab(which,opts){
 opts=opts||{};
 ivActive=which;const iv=which==='intervensi';
 tabM.setAttribute('aria-selected',String(!iv));tabI.setAttribute('aria-selected',String(iv));tabM.tabIndex=iv?-1:0;tabI.tabIndex=iv?0:-1;
 viewM.hidden=iv;root.hidden=!iv;document.body.dataset.ivTab=iv?'intervensi':'pemantauan';
 if(!opts.noHash)writeHash(iv?'intervensi':'pemantauan');
 if(iv){
  if(!ivInited){ivInited=true;ivInit()}
  requestAnimationFrame(()=>{if(!ivMap&&!ivState.ui.mapError)ivInitMap();if(ivMap){try{ivMap.resize()}catch(_){}}ivRefreshScenarios(false);ivRender(['map'])});
 }else{
  requestAnimationFrame(()=>{try{if(window.famaMonitorMapResize)window.famaMonitorMapResize()}catch(_){}});
 }
}
tabM.addEventListener('click',()=>showTab('pemantauan'));
tabI.addEventListener('click',()=>showTab('intervensi'));
[tabM,tabI].forEach(t=>t.addEventListener('keydown',ev=>{
 const order=[tabM,tabI];let i=order.indexOf(t);
 if(ev.key==='ArrowRight')i=(i+1)%2;else if(ev.key==='ArrowLeft')i=(i+1)%2;else if(ev.key==='Home')i=0;else if(ev.key==='End')i=1;else return;
 ev.preventDefault();order[i].focus();showTab(i===1?'intervensi':'pemantauan');
}));

function ivInit(){
 ivState.ui.scenPending=!scenSettled;
 ivRenderMarDefs();ivRenderAll();ivLoadMuse();
 const sp=window.famaScenariosReady;
 if(sp&&typeof sp.then==='function'){const done=()=>{scenSettled=true;ivState.ui.scenPending=false;ivState.ui.scenError=ivState.ui.scenError||false;ivRefreshScenarios(true);ivRender(['mob'])};sp.then(done,e=>{ivState.ui.scenError=true;done()})}
}
let scenSettled=false;
if(window.famaScenariosReady&&typeof window.famaScenariosReady.then==='function')window.famaScenariosReady.then(()=>{scenSettled=true},()=>{scenSettled=true});else scenSettled=true;

/* Pautan dalam (hash): hanya selepas load dan senario selesai */
(function(){
 const want=(location.hash||'').toLowerCase();
 if(want!=='#intervensi')return;
 const loadP=document.readyState==='complete'?Promise.resolve():new Promise(r=>window.addEventListener('load',r,{once:true}));
 const sp=window.famaScenariosReady&&window.famaScenariosReady.then?window.famaScenariosReady:Promise.resolve();
 let applied=false;const apply=()=>{if(applied)return;applied=true;showTab('intervensi',{noHash:true})};
 Promise.allSettled([loadP,sp]).then(()=>requestAnimationFrame(apply));
 setTimeout(apply,3000);
})();

/* ===== Hook ujian ===== */
window.IV_TEST={
 state:()=>JSON.parse(JSON.stringify(ivState)),outletStats,dispatch:ivDispatch,refresh:()=>ivRefreshScenarios(true),
 setScenariosPending:b=>{ivState.ui.scenPending=!!b;ivRender(['mob'])},
 ivClassify,supplyConfirm,priorityScore,mobilisationEngine,marginPct,maxFarmPrice,minSell,historyStats,weekStart,weekRange,extractMuseIssue,museInclude,validateMuseRaw,ivValidateAi,
 map:()=>ivMap,drafts:()=>JSON.parse(JSON.stringify(ivDrafts)),failNext:k=>{if(k in failFlags)failFlags[k]=true},
 withholdDistrictMap:id=>{ivWithheld[id]=true;ivRender(ALL_PANELS)},
 setRefNow:iso=>{refNow=iso;ivRender(ALL_PANELS)},
 engine:curEngine,priRows:()=>priRows().map(r=>({id:r.id,level:r.cls.level,score:r.score,label:issueLabel(r),flag:r.cls.flag,po:r.poId,district:r.district,commodity:r.commodityId})),
 poLevel,museAll:()=>museAll.map(x=>({...x})),config:()=>IV_CONFIG,resolveMob:mobResolve,marginDefaults,simulateMargin,validateMargin,historyOf,ivPrice
};
