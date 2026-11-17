const fs=require('fs'),path=require('path');const f=path.resolve(__dirname,'..','intervensi-test.js');
let t=fs.readFileSync(f,'utf8');
const a=" await ev(()=>IV_TEST.failNext('ai'));\n await ev(()=>{IV_TEST.dispatch('resetFilters');IV_TEST.dispatch('setMode','pengeluar');IV_TEST.dispatch('setFilter',['komoditi','cili-merah']);IV_TEST.dispatch('selectPO','simpangrenggam');IV_TEST.dispatch('setMob',['limit',560])});await sleep(1200);";
const b=" await ev(()=>{IV_TEST.dispatch('resetFilters');IV_TEST.dispatch('setMode','pengeluar');IV_TEST.dispatch('setFilter',['komoditi','cili-merah']);IV_TEST.dispatch('selectPO','simpangrenggam')});await sleep(1200);await ev(()=>{IV_TEST.failNext('ai');IV_TEST.dispatch('setMob',['wPrice',40])});await sleep(1200);";
t=t.replace(/\r\n/g,'\n');
if(!t.includes(a))console.log('TIADA');t=t.replace(a,b);fs.writeFileSync(f,t);
