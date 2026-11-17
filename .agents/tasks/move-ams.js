const fs=require('fs');const f='Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html';let s=fs.readFileSync(f,'utf8');
const a=s.indexOf('<section class="panel ams-panel"');const e=s.indexOf('</section>',a)+10;
const blk=s.slice(a,e);console.log(a,e,blk.length);
s=s.slice(0,a)+s.slice(e).replace(/^\s*/,'');
const i=s.indexOf('<footer class="footer">');
const j=s.lastIndexOf('</section>',i);
s=s.slice(0,j)+'  '+blk.replace(/\n/g,'\n  ')+'\n'+s.slice(j);
fs.writeFileSync(f,s);
