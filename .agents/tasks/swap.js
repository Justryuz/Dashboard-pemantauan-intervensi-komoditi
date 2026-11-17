const fs=require('fs');const f=process.argv[2];let t=fs.readFileSync(f,'utf8');
const nl=t.includes('\r\n')?'\r\n':'\n';let L=t.split(nl);
const ci=L.findIndex(l=>l.includes('class="panel compare-panel"'));
if(!L[ci+1].includes('class="panel chart-panel"'))throw 'x';
[L[ci],L[ci+1]]=[L[ci+1],L[ci]];
t=L.join(nl);
function rep(a,b){if(t.split(a).length!==2)throw 'count '+a;t=t.replace(a,()=>b)}
rep('<svg id="priceChart" class="chart-svg" viewBox="0 0 770 275"','<svg id="priceChart" class="chart-svg" viewBox="0 0 900 400"');
rep('const W=770,H=275,left=58,right=710,top=18,bottom=228;','const W=900,H=400,left=58,right=840,top=18,bottom=350;');
rep('<text x="${right+8}" y="${yy+3}" style="font-size:10px">','<text x="${right+8}" y="${yy+3}" style="font-size:11px">');
fs.writeFileSync(f,t);
