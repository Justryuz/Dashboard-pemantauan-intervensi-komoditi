const fs=require('fs');const f=process.argv[2];let s=fs.readFileSync(f,'utf8');
const eol=s.includes('\r\n')?'\r\n':'\n';
const m=s.match(/[ \t]*<div class="panel compare-panel">.*?<\/tbody><\/table><\/div><\/div>\r?\n/);
if(!m)throw 'no compare';
const cmp=m[0];s=s.replace(cmp,'');
const marker='<div class="triple-row">'+eol;
if(!s.includes(marker))throw 'no marker';
s=s.replace(marker,marker+cmp);
function rep(a,b){if(s.split(a).length!==2)throw 'not unique: '+a;s=s.replace(a,()=>b);}
rep('.triple-row{display:grid;grid-template-columns:minmax(0,1fr);','.triple-row{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);');
rep('.triple-row .chart-svg{width:100%;height:auto;padding:0 10px 6px;flex:0 0 auto}','.triple-row .chart-svg{width:100%;height:auto;padding:0 10px 6px;flex:1 1 auto;min-height:0}');
rep('.main-grid+.compare-panel{margin-top:14px}','');
rep('@media(max-width:1250px){.left-col{display:contents}','@media(max-width:1250px){.triple-row{grid-template-columns:minmax(0,1fr)}.left-col{display:contents}');
rep('.chart-svg text{fill:#8ea7c3;font-family:inherit;font-size:11px}','.chart-svg text{fill:#8ea7c3;font-family:inherit;font-size:13px}');
rep('viewBox="0 0 900 400"','viewBox="0 0 680 340"');
rep('const W=900,H=400,left=58,right=840,top:18,bottom=350;'.replace('top:18','top=18'),'const W=680,H=340,left=52,right=620,top=16,bottom=300;');
rep('style="font-size:11px">${label}','style="font-size:13px">${label}');
fs.writeFileSync(f,s);console.log('ok');
