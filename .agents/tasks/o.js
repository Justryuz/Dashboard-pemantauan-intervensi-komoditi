const fs=require('fs');const f=process.argv[2];let t=fs.readFileSync(f,'utf8');
const a='.main-grid+.compare-panel{margin-top:14px}';if(t.split(a).length!==2)throw 1;
t=t.replace(a,()=>a+'\n@media(max-width:1250px){.left-col{display:contents}.left-col>.map-panel{order:1}.analytics-col{order:2}.left-col>.triple-row{order:3}}');
fs.writeFileSync(f,t);
