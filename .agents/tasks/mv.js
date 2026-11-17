const fs=require('fs');const f=process.argv[2];let t=fs.readFileSync(f,'utf8');
const nl=t.includes('\r\n')?'\r\n':'\n';let L=t.split(nl);
const ci=L.findIndex(l=>l.includes('class="panel compare-panel"'));
const line=L.splice(ci,1)[0];
const mi=L.findIndex(l=>l.trim().startsWith('</main>'));
if(mi<0)throw 'nomain';
L.splice(mi+1,0,line);
t=L.join(nl);
function rep(a,b){if(t.split(a).length!==2)throw 'count '+a;t=t.replace(a,()=>b)}
rep('.analytics-col .listpanel .listbody>.price-row{flex:0 0 auto;padding-top:12px;padding-bottom:12px}}','.analytics-col .listpanel .listbody>.price-row{flex:1 1 auto;max-height:86px;padding-top:12px;padding-bottom:12px}}\n.main-grid+.compare-panel{margin-top:14px}');
fs.writeFileSync(f,t);
