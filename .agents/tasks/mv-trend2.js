const fs=require('fs');const f=process.argv[2];let s=fs.readFileSync(f,'utf8');
function rep(a,b){if(s.split(a).length!==2)throw 'not unique: '+a;s=s.replace(a,()=>b);}
rep('viewBox="0 0 680 340"','viewBox="0 0 600 420"');
rep('const W=680,H=340,left=52,right=620,top=16,bottom=300;','const W=600,H=420,left=50,right=545,top=16,bottom=385;');
rep('@media(max-width:1250px){.triple-row{grid-template-columns:minmax(0,1fr)}','@media(max-width:1250px){.triple-row{grid-template-columns:minmax(0,1fr)}.triple-row .chart-svg{max-height:420px}');
fs.writeFileSync(f,s);console.log('ok');
