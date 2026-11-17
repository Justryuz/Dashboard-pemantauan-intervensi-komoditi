/* ===== Dashboard Intervensi Komoditi: modul data dan logik tulen (ruang nama iv*) ===== */
const $i=id=>document.getElementById(id);
const slug=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const fin=x=>typeof x==='number'&&Number.isFinite(x);
const f2=x=>fin(x)?x.toFixed(2):'—';
const sgn=(x,d=2)=>fin(x)?(x>0?'+':'')+x.toFixed(d):'—';
const rmPos=x=>fin(x)&&x>0?'RM '+x.toFixed(2):'—';
const rmAny=x=>fin(x)?'RM '+x.toFixed(2):'—';
const E=s=>esc(s);
function hash32(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const MY_MONTHS=['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'];
const MY_MON_IDX={januari:1,februari:2,mac:3,april:4,mei:5,jun:6,julai:7,ogos:8,september:9,oktober:10,november:11,disember:12};

const IV_CONFIG={
 refNow:'2026-11-15T12:00:00+08:00',
 thresholds:{pengeluar:{direction:'turun',warnPct:-8,critPct:-15,stage:'Ladang'},pengguna:{direction:'naik',warnPct:8,critPct:15,stage:'Runcit'}},
 supply:{minSurplusMT:3,minSurplusRatio:0.15,shortageCoverage:0.8,staleHours:72},
 detour:1.3,costBase:0.03,costPerKm:0.002,crossZoneRules:[],
 museBands:{kuning:20,merah:40},minHistory:8,
 labelShift:{perlis:[-8,-16],kedah:[-5,21],penang:[12,-10],perak:[-9,20],selangor:[12,22],selayang:[-10,-14],negerisembilan:[-12,20],melaka:[18,13],kelantan:[-8,-15],terengganu:[16,-6],pahang:[15,-10],johor:[16,16],simpangrenggam:[-8,-16],sabah:[18,-13],sarawak:[14,-12]}
};
const IV_THR_DEFAULT=JSON.parse(JSON.stringify(IV_CONFIG.thresholds));
let refNow=IV_CONFIG.refNow;
const nowMs=()=>Date.parse(refNow);
const myDate=iso=>new Date(Date.parse(iso)+8*3600e3).toISOString().slice(0,10);
function addDays(ds,n){const [y,m,d]=ds.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10)}
function weekStart(ds){const [y,m,d]=ds.split('-').map(Number);const dow=new Date(Date.UTC(y,m-1,d)).getUTCDay();return addDays(ds,-((dow+6)%7))}
function weekRange(ws){return [ws,addDays(ws,6)]}
function fmtDate(ds){const [y,m,d]=ds.split('-').map(Number);return d+' '+MY_MONTHS[m-1]+' '+y}
function fmtWeek(ws){const [a,b]=weekRange(ws);const [y1,m1,d1]=a.split('-').map(Number),[y2,m2,d2]=b.split('-').map(Number);return m1===m2?`${d1} – ${d2} ${MY_MONTHS[m2-1]} ${y2}`:`${d1} ${MY_MONTHS[m1-1]} – ${d2} ${MY_MONTHS[m2-1]} ${y2}`}

/* ===== MODUL DATA: PO (paparan terbitan DATA.po, tiada salinan nilai) ===== */
const IV_PO=DATA.po.map(p=>({id:p.id,name:p.name,label:p.label,negeri:p.negeri,stateId:slug(p.negeri),zone:p.negeri==='Sabah'?'Sabah':p.negeri==='Sarawak'?'Sarawak':'Semenanjung',lat:p.lat,lon:p.lon,coordApprox:true,group:p.logistikGroup,districts:p.districts,logistik:p.logistik,source:'sebenar',origin:'DATA.po'}));
const IV_POBY=Object.fromEntries(IV_PO.map(p=>[p.id,p]));
const IV_STATES=[...new Map(IV_PO.map(p=>[p.stateId,p.negeri])).entries()].map(([id,name])=>({id,name}));
const IV_COMM=DATA.komoditi.map(k=>({id:slug(k.name),name:k.name,unit:k.unit,base:k.base,floor:k.floor,ceiling:k.ceiling,source:'dummy',origin:'DATA.rekod'}));
const IV_COMMBY=Object.fromEntries(IV_COMM.map(c=>[c.id,c]));
const isKg=cid=>IV_COMMBY[cid]&&IV_COMMBY[cid].unit==='RM/kg';

/* Pemetaan daerah ke PO (dummy, eksplisit) */
const IV_DISTRICTS=[];
IV_PO.forEach(p=>p.districts.forEach(d=>IV_DISTRICTS.push({districtId:p.stateId+'/'+slug(d[0]),name:d[0],stateId:p.stateId,negeri:p.negeri,poId:p.id,lat:d[1],lon:d[2],coordApprox:true,mappingStatus:'dummy-sah',source:'dummy',origin:'DATA.po.districts'})));
const IV_DISTBY=Object.fromEntries(IV_DISTRICTS.map(d=>[d.districtId,d]));
const IV_GAZETTEER=[{name:'Dungun',stateId:'terengganu',negeri:'Terengganu',lat:4.76,lon:103.42},{name:'Kemaman',stateId:'terengganu',negeri:'Terengganu',lat:4.23,lon:103.42},{name:'Besut',stateId:'terengganu',negeri:'Terengganu',lat:5.83,lon:102.55},{name:'Cameron Highlands',stateId:'pahang',negeri:'Pahang',lat:4.47,lon:101.38}];
let ivWithheld={};

/* Outlet (dummy) */
const IV_CATS=[{id:'pasar-awam',label:'Pasar Awam',glyph:'PA'},{id:'ptk',label:'PTK',glyph:'PT'},{id:'rakr',label:'RAKR',glyph:'RK'},{id:'agrobazaar',label:'Agrobazaar',glyph:'AB'}];
const IV_CATBY=Object.fromEntries(IV_CATS.map(c=>[c.id,c]));
const IV_OUTLETS=(function(){
 const out=[];const named={'johor/kluang':[['OUT-KLU-01','Pasar Awam Kluang','pasar-awam'],['OUT-KLU-02','Agrobazaar Kluang','agrobazaar'],['OUT-KLU-03','RAKR Kluang','rakr']],'johor/johor-bahru':[['OUT-JHB-01','Pasar Awam Larkin','pasar-awam'],['OUT-JHB-02','PTK Johor Bahru','ptk'],['OUT-JHB-03','Agrobazaar Johor Bahru','agrobazaar']],'kelantan/pasir-mas':[['OUT-PMS-01','Pasar Awam Pasir Mas','pasar-awam'],['OUT-PMS-02','PTK Pasir Mas','ptk'],['OUT-PMS-03','RAKR Pasir Mas','rakr']]};
 const commPool=IV_COMM.filter(c=>c.unit==='RM/kg').map(c=>c.id);
 const stat=h=>h%7===0?'Tidak beroperasi':h%11===0?'Data tidak tersedia':'Beroperasi';
 IV_DISTRICTS.forEach((d,i)=>{
  if(d.name==='Jasin'||d.name==='Jelebu')return;
  const h=hash32(d.districtId);
  let list=named[d.districtId];
  if(!list){const n=1+(h%2);list=[];for(let k=0;k<n;k++){const c=IV_CATS[(h+k+i)%4];list.push(['OUT-'+slug(d.name).toUpperCase().replace(/-/g,'').slice(0,5)+'-0'+(k+1),c.label+' '+d.name,c.id]);}}
  list.forEach(([id,nama,kat],k)=>{
   const hh=hash32(id);const dlat=((hh%81)-40)/1000,dlon=(((hh>>>8)%81)-40)/1000;
   let kom=[commPool[hh%commPool.length],commPool[(hh+3)%commPool.length]];
   if(d.districtId==='johor/kluang'||d.districtId==='johor/johor-bahru')kom=['cili-merah',kom[0]];
   if(d.districtId==='kelantan/pasir-mas')kom=['bawang-merah-kecil',kom[0]];
   out.push({outletId:id,nama:nama+' (Contoh)',kategori:kat,stateId:d.stateId,negeri:d.negeri,districtId:d.districtId,districtName:d.name,supervisingPOId:d.poId,lat:+(d.lat+dlat).toFixed(4),lon:+(d.lon+dlon).toFixed(4),coordApprox:true,status:named[d.districtId]?'Beroperasi':stat(hh),komoditiBerkaitan:[...new Set(kom)],assignmentStatus:'dummy-sah',source:'dummy',origin:'iv'});
  });
 });
 [['OUT-KMN-01','Pasar Awam Kemaman','pasar-awam',IV_GAZETTEER[1]],['OUT-KMN-02','RAKR Kemaman','rakr',IV_GAZETTEER[1]]].forEach(([id,n,k,g])=>out.push({outletId:id,nama:n+' (Contoh)',kategori:k,stateId:g.stateId,negeri:g.negeri,districtId:g.stateId+'/'+slug(g.name),districtName:g.name,supervisingPOId:null,lat:g.lat+0.01,lon:g.lon+0.01,coordApprox:true,status:'Data tidak tersedia',komoditiBerkaitan:['cili-merah'],assignmentStatus:'tidak-disahkan',source:'dummy',origin:'iv'}));
 return out;
})();
function outletsOfPO(poId){return IV_OUTLETS.filter(o=>o.supervisingPOId===poId&&!(ivWithheld[poId]))}
function outletStats(){const cat={},po={};IV_CATS.forEach(c=>cat[c.id]=0);IV_PO.forEach(p=>po[p.id]=0);IV_OUTLETS.forEach(o=>{cat[o.kategori]++;if(o.supervisingPOId)po[o.supervisingPOId]++});const empty=IV_DISTRICTS.filter(d=>!IV_OUTLETS.some(o=>o.districtId===d.districtId)).map(d=>d.name);return {cat,po,empty,total:IV_OUTLETS.length}}

/* ===== Harga: ivPrice ===== */
const IV_REK=new Map();DATA.rekod.forEach(r=>IV_REK.set(r.poId+'|'+r.daerah+'|'+slug(r.komoditi)+'|'+r.peringkat,r));
const IV_PRICE_OVERLAY=[
 {id:'T1',poId:'simpangrenggam',district:'Kluang',commodityId:'cili-merah',stage:'Ladang',dev:-17.5,devF:-19,note:'Senario ujian 1 (dummy)'},
 ...['Kinta','Kampar','Kuala Kangsar','Manjung'].map(d=>({id:'T1b',poId:'perak',district:d,commodityId:'cili-merah',stage:'Borong',dev:6,devF:6,note:'Senario ujian 1b (dummy)'})),
 {id:'T2',poId:'johor',district:'Johor Bahru',commodityId:'cili-merah',stage:'Runcit',dev:16,devF:18,note:'Senario ujian 2 (dummy)'},
 {id:'T3',poId:'kelantan',district:'Pasir Mas',commodityId:'bawang-merah-kecil',stage:'Runcit',dev:17,devF:19,note:'Senario ujian 3 (dummy)'},
 {id:'T4',poId:'perlis',district:'Kangar',commodityId:'cili-merah',stage:'Ladang',dev:-16,devF:-16,note:'Senario ujian 4 (dummy)'},
 {id:'T5',poId:'sarawak',district:'Serian',commodityId:'kubis-bulat',stage:'Ladang',dev:-18,devF:-18,note:'Senario ujian 5 (dummy)'},
 {id:'T6',poId:'pahang',district:'Temerloh',commodityId:'cili-hijau',stage:'Ladang',dev:-10,devF:-10,note:'Senario ujian 6 (dummy)'},
 {id:'T6',poId:'sabah',district:'Tuaran',commodityId:'tomato-bulat',stage:'Ladang',dev:-9,devF:-9,note:'Senario ujian 6 (dummy)'},
 {id:'T7',poId:'pahang',district:'Kuantan',commodityId:'tomato-bulat',stage:'Runcit',dev:18,devF:18,note:'Senario ujian 7 (dummy)'},
 {id:'T8',poId:'selangor',district:'Sepang',commodityId:'cili-hijau',stage:'Runcit',dev:9,devF:9,note:'Senario ujian 8 (dummy)'},
 {id:'T8',poId:'sarawak',district:'Kuching',commodityId:'ayam-proses-super',stage:'Runcit',dev:10,devF:10,note:'Senario ujian 8 (dummy)'}
];
const IV_OVBY=new Map(IV_PRICE_OVERLAY.map(o=>[o.poId+'|'+o.district+'|'+o.commodityId+'|'+o.stage,o]));
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
function recPrice(r,days){
 const cid=slug(r.komoditi);const th=IV_CONFIG.thresholds;
 const arr=r.prices.slice(-Math.max(1,Math.min(days,r.prices.length)));
 const baseline=mean(arr);
 let actual=r.prices[r.prices.length-1],forecast=r.ramalan,overlay=null;
 const ov=IV_OVBY.get(r.poId+'|'+r.daerah+'|'+cid+'|'+r.peringkat);
 if(ov){actual=baseline*(1+ov.dev/100);forecast=baseline*(1+ov.devF/100);overlay={id:ov.id,note:ov.note}}
 return {actual,forecast,baseline,devPct:(actual-baseline)/baseline*100,forecastDevPct:(forecast-baseline)/baseline*100,thresholdLow:baseline*(1+th.pengeluar.warnPct/100),thresholdHigh:baseline*(1+th.pengguna.warnPct/100),floor:r.hargaLantai,ceiling:r.hargaSiling,unit:r.unit,priceLevel:r.peringkat,grade:null,gradeNote:'gred tidak tersedia dalam data sedia ada',windowDays:days,overlay,source:'dummy',origin:'DATA.rekod'};
}
function ivPrice(poId,commodityId,stage,days){
 days=days||ivState.selectedDateRange.days;
 const p=IV_POBY[poId];if(!p)return null;
 const ps=p.districts.map(d=>IV_REK.get(poId+'|'+d[0]+'|'+commodityId+'|'+stage)).filter(Boolean).map(r=>recPrice(r,days));
 if(!ps.length)return null;
 const m=k=>mean(ps.map(x=>x[k]));
 return {actual:m('actual'),forecast:m('forecast'),baseline:m('baseline'),devPct:m('devPct'),forecastDevPct:m('forecastDevPct'),floor:m('floor'),ceiling:m('ceiling'),unit:ps[0].unit,priceLevel:stage,grade:null,gradeNote:ps[0].gradeNote,overlay:ps.find(x=>x.overlay)?ps.find(x=>x.overlay).overlay:null,windowDays:days,source:'dummy',origin:'DATA.rekod'};
}

/* ===== Bekalan (dummy) ===== */
const IV_UPD='2026-11-15T06:00:00+08:00';
function mkSupply(poId,cid,avail,res,req,upd,tag){
 const net=+(avail-res).toFixed(6);
 return {poId,commodityId:cid,availableStockMT:avail,reservedMT:res,requiredMT:req,net,surplusMT:+Math.max(0,net-req).toFixed(6),shortageMT:+Math.max(0,req-net).toFixed(6),coverage:req>0?net/req:null,lastUpdated:upd||IV_UPD,scenario:tag||null,source:'dummy',origin:'iv'};
}
const IV_SUPPLY_OVERRIDE=(function(){
 const o={};const add=(po,c,a,r,q,upd,t)=>o[po+'|'+c]=mkSupply(po,c,a,r,q,upd,t);
 add('simpangrenggam','cili-merah',18,1,5,null,'T1');add('johor','cili-merah',2,0,8,null,'T1b/T2');add('selangor','cili-merah',2,0,7,null,'T1b');add('perak','cili-merah',3,0,7,null,'T1b');add('sabah','cili-merah',2,0,8,null,'T1b');
 add('melaka','cili-merah',16,0,6,null,'T2s');add('negerisembilan','cili-merah',11,0,6,null,'T2s');add('selayang','cili-merah',12,0,6,null,'T2s');add('pahang','cili-merah',14,0,6,null,'T2s');add('kelantan','cili-merah',15,0,6,null,'T2s');add('sarawak','cili-merah',14,0,6,null,'T2s');
 add('perlis','cili-merah',6,0,5.5,null,'T4');add('kedah','cili-merah',8,0,8);add('penang','cili-merah',8,0,8);add('terengganu','cili-merah',8,0,8);
 add('kelantan','bawang-merah-kecil',3,0,9,null,'T3');add('perak','bawang-merah-kecil',14,0,6,null,'T3');add('pahang','bawang-merah-kecil',12,0,6,null,'T3');add('terengganu','bawang-merah-kecil',13,0,6,null,'T3');add('johor','bawang-merah-kecil',9,0,6,null,'T3');
 add('sarawak','kubis-bulat',15,1,5,'2026-11-10T06:00:00+08:00','T5');
 add('pahang','cili-hijau',12,0,6,null,'T6');add('sabah','tomato-bulat',10,0,5,null,'T6');
 add('pahang','tomato-bulat',12,0,10,null,'T7');
 add('selangor','cili-hijau',7,0,10,'2026-11-11T06:00:00+08:00','T8');add('sarawak','ayam-proses-super',7,0,10,'2026-11-11T06:00:00+08:00','T8');
 return o;
})();
const IV_SUPPLY=(function(){
 const rows={};
 IV_PO.forEach(p=>IV_COMM.forEach(c=>{
  if(c.unit!=='RM/kg')return;
  const k=p.id+'|'+c.id;
  if(IV_SUPPLY_OVERRIDE[k]){rows[k]=IV_SUPPLY_OVERRIDE[k];return}
  const r=mulberry32(hash32(k));const a=r();const arche=a<.35?'surplus':a<.75?'balanced':'shortage';
  const req=3+Math.round(r()*90)/10;const res=Math.round(r()*20)/10;let avail;
  if(arche==='surplus')avail=req+res+3+r()*8;else if(arche==='balanced')avail=req+res+(r()-.5);else avail=Math.max(1,req*(.3+r()*.45)+res);
  avail=Math.min(20,Math.max(4,Math.round(avail*10)/10));
  rows[k]=mkSupply(p.id,c.id,avail,res,req);
 }));
 return rows;
})();
const supplyRow=(poId,cid)=>IV_SUPPLY[poId+'|'+cid]||null;

/* ===== Logistik ===== */
const IV_LOGISTICS_AVAIL={johor_simpang:{availableVehicleCount:5,availableCapacityMT:62.0,actualStockMT:92.4},ayerkeroh:{availableVehicleCount:6,availableCapacityMT:28.0,actualStockMT:6.6},kotabaharu:{availableVehicleCount:1,availableCapacityMT:1.5,actualStockMT:8.6}};
function logisticsOf(poId){
 const p=IV_POBY[poId];if(!p)return null;const l=p.logistik;const a=IV_LOGISTICS_AVAIL[p.group]||null;
 const members=IV_PO.filter(x=>x.group===p.group).map(x=>x.id);
 return {poId,logisticsCapacityGroupId:p.group,kenderaanMax:l.kenderaan,muatanMaxMT:l.muatanMT,bilikSejukMax:l.bilikSejuk,simpananMaxMT:l.kapasitiSimpananMT,groupShared:members.length>1,groupMemberPOIds:members,availableVehicleCount:a?a.availableVehicleCount:null,availableCapacityMT:a?a.availableCapacityMT:null,actualStockMT:a?a.actualStockMT:null,availabilityUpdated:a?IV_UPD:null,source:'sebenar',availSource:'dummy'};
}
function readiness(lg){
 const parts=[];
 if(lg.availableVehicleCount!=null&&lg.kenderaanMax>0)parts.push(lg.availableVehicleCount/lg.kenderaanMax);
 if(lg.availableCapacityMT!=null&&lg.simpananMaxMT>0)parts.push(lg.availableCapacityMT/lg.simpananMaxMT);
 if(!parts.length)return {state:'tidak-dinilai',r:null,label:'Kesiapsiagaan tidak dapat dinilai'};
 const r=mean(parts);
 return r>=0.6?{state:'sedia',r,label:'Sedia'}:r>=0.3?{state:'terhad',r,label:'Terhad'}:{state:'kritikal',r,label:'Kritikal'};
}

/* ===== Pengiraan tahap, bekalan dan skor ===== */
function supplyConfirm(mode,row,now){
 now=now==null?nowMs():now;const cfg=IV_CONFIG.supply;
 if(!row||row.availableStockMT==null||row.requiredMT==null)return {state:'tiada',reason:'Tiada data bekalan'};
 if((now-Date.parse(row.lastUpdated))/36e5>cfg.staleHours)return {state:'lapuk',reason:'Data stok lapuk'};
 if(mode==='pengeluar'){if(row.surplusMT>=Math.max(cfg.minSurplusMT,cfg.minSurplusRatio*row.net))return {state:'disahkan',reason:'Lebihan bekalan dikesan'};}
 else if(row.coverage!==null&&row.coverage<cfg.shortageCoverage&&row.shortageMT>=cfg.minSurplusMT)return {state:'disahkan',reason:'Kekurangan bekalan dikesan'};
 return {state:'tidak-disahkan',reason:'Menunggu pengesahan bekalan'};
}
function ivClassify(mode,price,row){
 const th=IV_CONFIG.thresholds[mode];const crit=Math.abs(th.critPct),warn=Math.abs(th.warnPct);
 const harm=mode==='pengeluar'?-price.devPct:price.devPct,harmF=mode==='pengeluar'?-price.forecastDevPct:price.forecastDevPct;
 const floorHit=mode==='pengeluar'?(fin(price.floor)&&price.actual<=price.floor):(fin(price.ceiling)&&price.actual>=price.ceiling);
 let pl='normal';
 if(harm>=crit||floorHit)pl='kritikal';else if(harm>=warn||harmF>=warn)pl='waspada';
 const sc=supplyConfirm(mode,row);let level,flag=null,early=false;
 if(pl==='kritikal'){if(sc.state==='disahkan')level='kritikal';else{level='waspada';flag=sc.state==='tidak-disahkan'?'Menunggu pengesahan bekalan':sc.reason}}
 else if(pl==='waspada')level='waspada';
 else{level='normal';early=sc.state==='disahkan'}
 return {priceLevel:pl,level,flag,earlySignal:early,supply:sc,harm,harmF};
}
function priorityScore(mode,price,row,cls){
 const crit=Math.abs(IV_CONFIG.thresholds[mode].critPct);
 const P=clamp(cls.harm/(2*crit),0,1),F=clamp(cls.harmF/(2*crit),0,1);
 let gap=0;if(row)gap=mode==='pengeluar'?row.surplusMT/Math.max(row.net,1):row.shortageMT/Math.max(row.requiredMT,1);
 const S=clamp(gap,0,1);const C=cls.supply.state==='disahkan'?1:cls.supply.state==='lapuk'?.5:0;
 return {score:Math.round(100*(.45*P+.35*S+.10*F+.10*C)),P,S,F,C};
}
const LV_W={normal:0,waspada:1,kritikal:2};
const LV_LABEL={normal:'Normal',waspada:'Waspada',kritikal:'Kritikal'};
const MODE_STAGE={pengeluar:'Ladang',pengguna:'Runcit'};
const _recCache={};
function computeRecs(mode,days){
 const key=mode+'|'+days+'|'+JSON.stringify(IV_CONFIG.thresholds)+'|'+refNow;
 if(_recCache[key])return _recCache[key];
 const stage=MODE_STAGE[mode];const out=[];
 DATA.rekod.forEach(r=>{
  if(r.peringkat!==stage)return;
  const cid=slug(r.komoditi);const price=recPrice(r,days);const row=isKg(cid)?supplyRow(r.poId,cid):null;
  const cls=ivClassify(mode,price,row);const sc=priorityScore(mode,price,row,cls);
  const po=IV_POBY[r.poId];
  out.push({id:`${mode}:${r.poId}:${po.stateId}/${slug(r.daerah)}:${cid}`,mode,poId:r.poId,poName:po.name,stateId:po.stateId,negeri:po.negeri,district:r.daerah,districtId:po.stateId+'/'+slug(r.daerah),commodityId:cid,commodity:r.komoditi,price,row,cls,score:sc.score,comp:sc,legacyStatus:r.status});
 });
 Object.keys(_recCache).forEach(k=>delete _recCache[k]);
 _recCache[key]=out;return out;
}
const worst=(a,b)=>LV_W[a]>=LV_W[b]?a:b;

/* ===== Cuaca/banjir ===== */
function ivScenarios(){return typeof SCEN_LIST!=='undefined'&&Array.isArray(SCEN_LIST)?SCEN_LIST:[]}
function hav(lat1,lon1,lat2,lon2){const R=6371,r=Math.PI/180;const dl=(lat2-lat1)*r,dn=(lon2-lon1)*r;const a=Math.sin(dl/2)**2+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(a))}
function disruptionLevel(poId,now){
 now=now==null?nowMs():now;const p=IV_POBY[poId];let best=null;
 const rank={Amaran:2,Waspada:1};
 (DATA.banjir||[]).forEach(f=>{if(hav(p.lat,p.lon,f.lat,f.lon)<=30){const lv=f.level;if(!best||rank[lv]>rank[best.level])best={level:lv,source:`${lv==='Amaran'?'Amaran':'Waspada'} banjir (DATA.banjir)`}}});
 ivScenarios().forEach(s=>{if(s.warningType!=='amaran_banjir'||!(s.affectedPOIds||[]).includes(poId))return;
  if(!(Date.parse(s.validFrom)<=now&&now<=Date.parse(s.validUntil)))return;
  const lv=s.riskLevel==='tinggi'?'Amaran':s.riskLevel==='sederhana'?'Waspada':null;if(!lv)return;
  if(!best||rank[lv]>rank[best.level]||(rank[lv]===rank[best.level]&&best.source.includes('DATA.banjir')))best={level:lv,source:`${lv} banjir AMS ${s.scenarioId}`};});
 return best;
}
const disruptionLabel=d=>d?(d.level==='Amaran'?'Amaran banjir':'Waspada banjir')+(d.source.includes('AMS')?' AMS '+d.source.split('AMS ')[1]:' (DATA.banjir)'):'';

/* ===== Enjin mobilisasi (tulen) ===== */
function mobilisationEngine(inp){
 const {mode,anchorPOId,commodityId}=inp;const out={dalam:[],luar:[],excluded:[],trigger:{ok:false,reason:null},inputsEcho:{...inp}};
 const anchor=IV_POBY[anchorPOId];if(!anchor||!isKg(commodityId)){out.trigger.reason='tiada';return out}
 const aRow=supplyRow(anchorPOId,commodityId);const sc=supplyConfirm(mode,aRow,inp.now);
 if(sc.state!=='disahkan'){out.trigger={ok:false,reason:sc.state,text:sc.reason};return out}
 out.trigger={ok:true,reason:'disahkan',text:sc.reason};
 const wP=clamp(inp.wPrice,0,100)/100,wD=1-wP;const need=inp.needMT;const refPrice=inp.refPrice;
 const el=[];
 IV_PO.forEach(c=>{
  const ex=r=>out.excluded.push({poId:c.id,name:c.name,reason:r});
  if(c.id===anchorPOId)return ex('PO terpilih sendiri');
  const row=supplyRow(c.id,commodityId);const pr=ivPrice(c.id,commodityId,'Borong',inp.days);
  if(!row||!pr)return ex('Data tidak lengkap');
  const stock=mode==='pengguna'?row.surplusMT:row.shortageMT;
  if(!(stock>0))return ex(mode==='pengguna'?'Tiada lebihan stok':'Tiada permintaan tambahan (tiada kekurangan)');
  if(c.zone!==anchor.zone&&!IV_CONFIG.crossZoneRules.some(r=>r.approved&&r.from===anchor.zone&&r.to===c.zone))return ex(`Zon berbeza (${c.zone} lawan ${anchor.zone})`);
  const km=hav(anchor.lat,anchor.lon,c.lat,c.lon)*IV_CONFIG.detour;
  if(km>inp.distLimitKm)return ex(`Jarak ${Math.round(km)} km melebihi had ${inp.distLimitKm} km`);
  const dis=disruptionLevel(c.id,inp.now);
  if(dis&&dis.level==='Amaran')return ex(dis.source);
  const cost=IV_CONFIG.costBase+IV_CONFIG.costPerKm*km;
  const gap=mode==='pengguna'?refPrice-pr.actual-cost:pr.actual-refPrice-cost;
  if(!(gap>0))return ex('Jurang harga bersih tidak positif');
  const lg=logisticsOf(c.id);
  let qty=Math.min(need,stock),cap=null;
  if(lg.availableVehicleCount!=null){cap=lg.availableVehicleCount*lg.muatanMaxMT/lg.kenderaanMax;qty=Math.min(qty,cap)}
  el.push({poId:c.id,name:c.name,negeri:c.negeri,zone:c.zone,sameState:c.negeri===anchor.negeri,stockMT:stock,price:pr.actual,km,costPerKg:cost,netGap:gap,qty,vehicleCapMT:cap,vehicleKnown:lg.availableVehicleCount!=null,maxCapMT:lg.muatanMaxMT,sameGroup:c.group===anchor.group,flood:dis&&dis.level==='Waspada'?dis:null,totalCost:cost*1000*qty,overlay:pr.overlay});
 });
 const rank=list=>{const mx=Math.max(...list.map(x=>x.netGap),1e-9);list.forEach(x=>{const ps=x.netGap/mx,ds=clamp(1-x.km/inp.distLimitKm,0,1);x.priceScore=ps;x.distScore=ds;x.score=Math.max(0,Math.round(100*(wP*ps+wD*ds))-(x.flood?5:0))});
  list.sort((a,b)=>b.score-a.score||b.qty-a.qty||a.km-b.km||a.name.localeCompare(b.name));list.slice(0,5).forEach((x,i)=>x.rank=i+1);return list.slice(0,5)};
 out.dalam=rank(el.filter(x=>x.sameState));out.luar=rank(el.filter(x=>!x.sameState));
 return out;
}

/* ===== Margin ===== */
const marginPct=(S,F,C)=>S>0?(S-F-C)/S*100:NaN;
const maxFarmPrice=(S,C,t)=>S*(1-t/100)-C;
const minSell=(F,C,t)=>(1-t/100)>0?(F+C)/(1-t/100):NaN;
function historyStats(h){
 const sp=h.map(x=>x.jual-x.beli),n=sp.length;if(!n)return null;
 const m=mean(sp),s=[...sp].sort((a,b)=>a-b),med=n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2;
 const sd=Math.sqrt(mean(sp.map(x=>(x-m)**2)));
 const xm=(n-1)/2;let num=0,den=0;sp.forEach((y,i)=>{num+=(i-xm)*(y-m);den+=(i-xm)**2});const slope=den?num/den:0;
 return {n,mean:m,median:med,sd,slope,trend:Math.abs(slope)<0.01?'stabil':slope>0?'naik':'turun'};
}
const IV_OPCOST=Object.fromEntries(IV_PO.map(p=>[p.id,+(0.35+(hash32('kos'+p.id)%26)/100).toFixed(2)]));IV_OPCOST.simpangrenggam=0.45;
const IV_HISTORY_OVERRIDE={'simpangrenggam|cili-merah':[1.10,1.20,1.30,1.20,1.10,1.20,1.30,1.20,1.10,1.20,1.30,1.20].map((s,i)=>({week:addDays('2026-11-15',-7*(11-i)),beli:12.5,jual:+(12.5+s).toFixed(2)})),
 'penang|kubis-bulat':[0,1,2,3].map(i=>({week:addDays('2026-11-15',-7*(3-i)),beli:4.1+i*.02,jual:+(4.55+i*.01).toFixed(2)}))};
const IV_MARGIN_DEFAULT_OVERRIDE={'simpangrenggam|cili-merah':{ladang:9.80}};
function historyOf(poId,cid){
 const k=poId+'|'+cid;if(IV_HISTORY_OVERRIDE[k])return IV_HISTORY_OVERRIDE[k];
 const pr=ivPrice(poId,cid,'Borong',30);if(!pr)return [];const r=mulberry32(hash32('h'+k));const out=[];
 for(let i=0;i<12;i++){const jual=pr.baseline*(1+(r()-.5)*.08);const sp=.06+r()*.06;out.push({week:addDays('2026-11-15',-7*(11-i)),beli:+(jual*(1-sp)).toFixed(2),jual:+jual.toFixed(2)})}
 return out;
}
function marginDefaults(poId,cid){
 const h=historyOf(poId,cid),last=h[h.length-1]||null;
 const lad=ivPrice(poId,cid,'Ladang',30);const ov=IV_MARGIN_DEFAULT_OVERRIDE[poId+'|'+cid];
 return {jual:last?last.jual:null,beli:last?last.beli:null,ladang:ov?ov.ladang:(lad?+lad.actual.toFixed(2):null),kos:IV_OPCOST[poId],target:15,override:!!ov};
}
function validateMargin(m){
 const err={};const val={};
 const pf=(k,lbl,allowZero)=>{const raw=String(m[k]).trim();const v=Number(raw);if(raw===''||!Number.isFinite(v)){err[k]=`${lbl} mesti nombor`;return}
  if(allowZero?(v<0||v>999):(v<=0||v>999)){err[k]=allowZero?`${lbl} mesti antara 0 dan 999`:`${lbl} mesti lebih daripada 0 dan tidak melebihi 999`;return}val[k]=v};
 pf('beli','Harga Borong Beli');pf('jual','Harga Borong Jual');pf('ladang','Harga Belian Ladang');pf('kos','Kos Operasi',true);
 const traw=String(m.target).trim(),t=Number(traw);
 if(traw===''||!Number.isFinite(t))err.target='Margin sasaran mesti nombor';
 else if(t<0)err.target='Margin sasaran tidak boleh negatif';
 else if(t>=100)err.target='Margin sasaran mesti kurang daripada 100%';
 else if(t>95)err.target='Margin sasaran maksimum 95%';
 else val.target=t;
 return {ok:!Object.keys(err).length,err,val};
}
function simulateMargin(v,hist,ctx){
 const S=v.beli,F=v.ladang,C=v.kos,t=v.target,J=v.jual;
 const cur=marginPct(S,F,C),spread=J-S,maxF=maxFarmPrice(S,C,t),minS=minSell(F,C,t);
 const hs=historyStats(hist);const enough=hist.length>=IV_CONFIG.minHistory;
 const farmLow=Math.max(0,ctx.farmFloor||0);
 const farmOk=fin(maxF)&&maxF>0&&maxF>=farmLow;
 let mLow=NaN,mHigh=NaN,recLow=NaN,recHigh=NaN,sellOk=false;
 if(hs&&enough){mLow=Math.max(0,J-(hs.median+hs.sd));mHigh=Math.max(0,J-Math.max(0,hs.median-hs.sd));recLow=Math.max(minS,mLow);recHigh=mHigh;sellOk=fin(minS)&&minS>0&&minS<=mHigh&&recLow<=recHigh}
 return {S,F,C,t,J,cur,spread,maxF,minS,farmLow,farmOk,hs,enough,mLow,mHigh,recLow,recHigh,sellOk,
  impact:t-cur,marginAtLow:marginPct(recLow,F,C),marginAtHigh:marginPct(recHigh,F,C),buyAboveSell:S>J};
}

/* ===== AI Muse (data dummy mentah + penyarian) ===== */
const IV_MUSE_RAW=[
 {rawId:'M01',recordDate:'2026-11-11',analystNote:'Kelapa tua (Matag): pada 4 November 2026 seramai 69 pekebun kelapa Matag terjejas di Dungun, Terengganu akibat tekanan harga daripada kelapa import.',sourceName:'Nota penganalisis FAMA (dummy)',sentimentIndex:-0.42,sampleCount:69,riskBefore:4,riskCurrent:16,riskForward:18},
 {rawId:'M02',recordDate:'2026-11-12',analystNote:'Harga ladang cili merah jatuh di Kluang, Johor pada 12 November 2026 akibat lebihan bekalan; peladang sukar memasarkan hasil.',sourceName:'Nota penganalisis FAMA (dummy)',sentimentIndex:-0.55,sampleCount:42,riskBefore:12,riskCurrent:38,riskForward:44},
 {rawId:'M03',recordDate:'2026-11-13',analystNote:'Harga runcit bawang merah kecil naik di Pasir Mas, Kelantan pada 13 November 2026; bekalan terhad selepas gangguan banjir.',sourceName:'Nota penganalisis FAMA (dummy)',sentimentIndex:-0.48,sampleCount:35,riskBefore:15,riskCurrent:41,riskForward:46},
 {rawId:'M04',recordDate:'2026-11-11',analystNote:'Cuaca buruk menjejaskan hasil tomato bulat di Cameron Highlands, Pahang pada 10 November 2026.',sourceName:'Nota penganalisis FAMA (dummy)',sentimentIndex:-0.3,sampleCount:21,riskBefore:8,riskCurrent:24,riskForward:27},
 {rawId:'M05',recordDate:'2026-11-13',analystNote:'Dipercayai harga ladang cili merah masih jatuh di Kluang pada 12 November 2026 kerana lebihan bekalan.',sourceName:'Laporan kedua (dummy)',sentimentIndex:-0.5,sampleCount:18,riskBefore:12,riskCurrent:36,riskForward:40},
 {rawId:'M06',recordDate:'2026-11-12',analystNote:'Harga kubis bulat jatuh di Serian, Sarawak; berbanding pada 3 Mac 2025 harga jatuh dengan teruk.',sourceName:'Nota penganalisis FAMA (dummy)',sentimentIndex:-0.2,sampleCount:12,riskBefore:6,riskCurrent:14,riskForward:15},
 {rawId:'M07',recordDate:'2026-11-12',analystNote:'Harga ayam proses super dilaporkan naik di sebuah pasar di utara pada 12 November 2026.',sourceName:'Nota penganalisis FAMA (dummy)',sentimentIndex:-0.25,sampleCount:9,riskBefore:5,riskCurrent:18,riskForward:19},
 {rawId:'M08',recordDate:'2026-11-12',analystNote:'Latihan kakitangan mengenai pengendalian telur gred A diadakan di Kangar pada 11 November 2026.',sourceName:'Nota dalaman (dummy)',sentimentIndex:0.1,sampleCount:0,riskBefore:2,riskCurrent:2,riskForward:2},
 {rawId:'M09',recordDate:'2026-11-06',analystNote:'Hasil cili hijau merosot di Temerloh, Pahang pada 5 November 2026 akibat hujan lebat.',sourceName:'Nota penganalisis FAMA (dummy)',sentimentIndex:-0.35,sampleCount:27,riskBefore:10,riskCurrent:30,riskForward:33}
];
const IV_COMM_ALIAS=[['kelapa matag',null,'Kelapa Tua (Matag)'],['kelapa tua',null,'Kelapa Tua (Matag)'],['kelapa',null,'Kelapa Tua (Matag)'],['cili merah','cili-merah','Cili Merah'],['cili hijau','cili-hijau','Cili Hijau'],['tomato bulat','tomato-bulat','Tomato Bulat'],['tomato','tomato-bulat','Tomato Bulat'],['bawang merah kecil','bawang-merah-kecil','Bawang Merah Kecil'],['bawang merah','bawang-merah-kecil','Bawang Merah Kecil'],['ayam proses super','ayam-proses-super','Ayam Proses Super'],['ayam','ayam-proses-super','Ayam Proses Super'],['kubis bulat','kubis-bulat','Kubis Bulat'],['kubis','kubis-bulat','Kubis Bulat'],['telur gred a','telur-gred-a','Telur Gred A'],['telur','telur-gred-a','Telur Gred A']];
const MUSE_ISSUE_RE=/harga|bekalan|lebihan|hasil|pengeluaran|pemasaran|memasarkan|kekurangan|terjejas|menjejaskan/i;
const MUSE_RECALL_RE=/tahun lepas|berbanding|sebelum ini|lalu|pada tahun/i;
function validateMuseRaw(rows){const ok=[];let dropped=0;(Array.isArray(rows)?rows:[]).forEach(r=>{if(r&&typeof r.rawId==='string'&&typeof r.analystNote==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.recordDate||''))ok.push(r);else dropped++});return {ok,dropped}}
function extractMuseIssue(raw){
 const note=raw.analystNote,low=note.toLowerCase();
 let com=null;for(const [a,id,lbl] of IV_COMM_ALIAS){if(low.includes(a)){com={id,label:lbl};break}}
 const sentences=note.split(/(?<=[.;:])\s+/);const csent=com?(sentences.find(s=>s.toLowerCase().includes(IV_COMM_ALIAS.find(a=>a[2]===com.label&&low.includes(a[0]))[0]))||note):note;
 const dates=[];let m;
 const re1=/(\d{1,2})\s+(januari|februari|mac|april|mei|jun|julai|ogos|september|oktober|november|disember)(?:\s+(\d{4}))?/gi;
 while((m=re1.exec(note))){const y=m[3]?+m[3]:+raw.recordDate.slice(0,4);dates.push({ds:`${y}-${String(MY_MON_IDX[m[2].toLowerCase()]).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}`,off:m.index})}
 const re2=/(\d{2})\/(\d{2})\/(\d{4})/g;while((m=re2.exec(note)))dates.push({ds:`${m[3]}-${m[2]}-${m[1]}`,off:m.index});
 const re3=/(\d{4})-(\d{2})-(\d{2})/g;while((m=re3.exec(note)))dates.push({ds:m[0],off:m.index});
 const ry=+raw.recordDate.slice(0,4);
 const keep=dates.filter(d=>{const pre=note.slice(Math.max(0,d.off-40),d.off);return !(MUSE_RECALL_RE.test(pre)||+d.ds.slice(0,4)<ry)});
 const cOff=note.indexOf(csent),cEnd=cOff+csent.length;
 const dist=d=>d.off>=cOff&&d.off<=cEnd?0:Math.min(Math.abs(d.off-cOff),Math.abs(d.off-cEnd));
 keep.sort((a,b)=>dist(a)-dist(b)||(a.ds<b.ds?-1:1));
 let eventDate=keep.length?keep[0].ds:null;
 if(!eventDate){if(/kelmarin/i.test(note))eventDate=addDays(raw.recordDate,-2);else if(/semalam/i.test(note))eventDate=addDays(raw.recordDate,-1);else if(/hari ini|baru-baru ini/i.test(note))eventDate=raw.recordDate}
 let loc=null;const mapped=IV_DISTRICTS.find(d=>new RegExp('\\b'+d.name+'\\b','i').test(note));
 if(mapped)loc={name:mapped.name,stateId:mapped.stateId,negeri:mapped.negeri,districtId:mapped.districtId,mapped:true};
 else{const g=IV_GAZETTEER.find(x=>new RegExp('\\b'+x.name+'\\b','i').test(note));if(g)loc={name:g.name,stateId:g.stateId,negeri:g.negeri,districtId:g.stateId+'/'+slug(g.name),mapped:false}}
 let ltype='belum',conf=0;
 if(loc){const pre=note.slice(Math.max(0,note.search(new RegExp('\\b'+loc.name+'\\b','i'))-18),note.search(new RegExp('\\b'+loc.name+'\\b','i')));
  if(/(dilaporkan dari|berbanding|\bdari)\s*$/i.test(pre))ltype='disebut';else if(/\bdi\s*$/i.test(pre)){ltype='disahkan'}else ltype='disebut';
  conf=ltype==='disahkan'?(/dipercayai|mungkin|dikatakan/i.test(note)?0.8:0.9):0.5}
 const issue=MUSE_ISSUE_RE.test(note);
 const band=raw.riskCurrent>=IV_CONFIG.museBands.merah?'merah':raw.riskCurrent>=IV_CONFIG.museBands.kuning?'kuning':'hijau';
 const po=loc&&loc.mapped?IV_DISTBY[loc.districtId].poId:null;
 const supplyKw=/bekalan|lebihan|kekurangan/i.test(note);
 return {insightId:raw.rawId,commodityId:com?com.id:null,commodityLabel:com?com.label:null,eventDate,recordDate:raw.recordDate,location:loc?{label:`${loc.name}, ${loc.negeri}`,type:ltype}:{label:'Tidak dikenal pasti',type:'belum'},districtName:loc?loc.name:null,stateId:loc?loc.stateId:null,negeri:loc?loc.negeri:null,districtId:loc?loc.districtId:null,matchedPOId:po,locationConfidence:conf,locationType:ltype,riskBefore:raw.riskBefore,riskCurrent:raw.riskCurrent,riskForward:raw.riskForward,riskBand:band,sentimentIndex:raw.sentimentIndex,sampleCount:raw.sampleCount,analystNote:note,sourceName:raw.sourceName,evidence:[{quote:note,sourceName:raw.sourceName,date:raw.recordDate}],issueRelevant:issue,issueClass:/lebihan|jatuh|turun/i.test(note)?'lebihan-harga-turun':/naik|terhad|kekurangan/i.test(note)?'bekalan-harga-naik':'hasil',supplyKw,
  suggestedActions:band==='merah'?['Sahkan stok dan harga di lokasi','Pertimbangkan mobilisasi bekalan melalui Paparan 4']:['Pantau harga dan bekalan di lokasi','Semak semula dalam kemas kini harian seterusnya'],
  summary:`${com?com.label:'Komoditi'}: ${csent}`,explanation:'Penyarian deterministik (simulasi) daripada nota penganalisis; bukan keputusan AI sebenar.',source:'dummy',origin:'iv'};
}
function museInclude(ins,ws){
 const [a,b]=weekRange(ws);
 return !!(ins.commodityLabel&&ins.locationType==='disahkan'&&ins.districtId&&ins.eventDate&&ins.eventDate>=a&&ins.eventDate<=b&&ins.issueRelevant);
}
function museWeekList(all,ws){
 const cand=all.filter(i=>museInclude(i,ws));const best=new Map();
 cand.forEach(i=>{const k=[i.commodityId||i.commodityLabel,i.districtId,i.eventDate,i.issueClass].join('|');const o=best.get(k);if(!o||i.locationConfidence>o.locationConfidence||(i.locationConfidence===o.locationConfidence&&i.recordDate>o.recordDate))best.set(k,i)});
 return [...best.values()].sort((x,y)=>y.riskCurrent-x.riskCurrent);
}
