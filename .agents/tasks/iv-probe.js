const fs=require('fs');const L=fs.readFileSync('../../Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html','utf8').split('\n');
const l=L[245];const DATA=eval('('+l.replace(/^const DATA = /,'').replace(/;\s*$/,'')+')');
console.log(Object.keys(DATA));
for(const k of Object.keys(DATA)){const v=DATA[k];console.log(k,Array.isArray(v)?'array '+v.length:typeof v);}
console.log(JSON.stringify(DATA.po[0]).slice(0,900));
console.log(DATA.po.map(p=>p.id+'|'+p.name+'|'+p.negeri+'|'+p.lat+','+p.lon+'|'+p.logistikGroup+'|'+p.districts.map(d=>d[0]).join(',')).join('\n'));
console.log(JSON.stringify(DATA.komoditi));
const r=DATA.rekod[0];console.log(Object.keys(r), JSON.stringify(r).slice(0,900), DATA.rekod.length);
console.log(JSON.stringify(DATA.banjir).slice(0,600));
console.log(JSON.stringify(DATA.po[0].districts).slice(0,300));
console.log(JSON.stringify(DATA.po.map(p=>p.logistik)[13]), JSON.stringify(DATA.po[4].logistikGroup));
const rr=DATA.rekod.filter(x=>x.poId==='simpangrenggam'&&x.komoditi==='Cili Merah');console.log(rr.map(x=>x.id+x.peringkat+x.daerah+x.prices.slice(-3)+'|'+x.ramalan+'|'+x.purata+'|'+x.hargaLantai+'|'+x.hargaSiling).join('\n'));
console.log([...new Set(DATA.rekod.map(x=>x.peringkat))], [...new Set(DATA.rekod.map(x=>x.komoditi))]);
console.log(Object.keys(DATA.mapPaths||{}));
