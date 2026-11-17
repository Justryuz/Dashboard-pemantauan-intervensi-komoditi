const s=require('fs').readFileSync(process.argv[2],'utf8');
const sc=[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);let bad=0;
sc.forEach(c=>{try{new Function(c)}catch(e){bad++;console.log(e.message)}});
console.log('scripts',sc.length,'bad',bad);
const ids={};[...s.matchAll(/ id="([^"]+)"/g)].forEach(m=>ids[m[1]]=(ids[m[1]]||0)+1);
console.log('dups',Object.entries(ids).filter(x=>x[1]>1));
const i=s.indexOf('<div class="triple-row">');console.log(JSON.stringify(s.slice(i,i+110)));
