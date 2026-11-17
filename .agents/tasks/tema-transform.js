// Penukar sekali jalan: tukar warna hex pada CSS kepada pemboleh ubah tema.
// Guna: node tema-transform.js  (baca backup-before-tema.html -> tulis ../../Dashboard...html)
// Palet cerah dijana oleh fungsi mapB/mapT di bawah; laraskan di sini dan jalankan semula
// (atau ubah terus nilai dalam <style id="temaStyle"> pada HTML).
const fs=require('fs'),path=require('path');
const SRC=path.join(__dirname,'backup-before-tema.html');
const DST=path.join(__dirname,'..','..','Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html');
let html=fs.readFileSync(SRC,'utf8');

const norm=h=>{h=h.replace('#','').toLowerCase();if(h.length<=4)h=h.split('').map(c=>c+c).join('');return h};
const rgb=h=>[0,2,4].map(i=>parseInt(h.substr(i,2),16));
const alpha=h=>h.length===8?h.substr(6,2):'';
function toHsl([r,g,b]){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0;const l=(mx+mn)/2;
 if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h*=60}return[h,s,l]}
function fromHsl(h,s,l){const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;let r=0,g=0,b=0;
 if(h<60)[r,g,b]=[c,x,0];else if(h<120)[r,g,b]=[x,c,0];else if(h<180)[r,g,b]=[0,c,x];else if(h<240)[r,g,b]=[0,x,c];else if(h<300)[r,g,b]=[x,0,c];else[r,g,b]=[c,0,x];
 return[r+m,g+m,b+m].map(v=>Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0')).join('')}
const lum=([r,g,b])=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
const cr=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const LBG=[0xe8,0xef,0xf8];
const interp=(pts,x)=>{if(x<=pts[0][0])return pts[0][1];for(let i=1;i<pts.length;i++)if(x<=pts[i][0]){const[a,b]=[pts[i-1],pts[i]];return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])}return pts[pts.length-1][1]};
const SURF=[[0,.93],[.08,.955],[.12,.995],[.14,.985],[.17,.955],[.20,.925],[.24,.88],[.30,.82],[.36,.76]];
// permukaan / sempadan / latar
function mapB(hex){const[r,g,b]=rgb(hex),a=alpha(hex);const[h,s,l]=toHsl([r,g,b]);
 if(l>.36)return hex;
 let L2,S2;const blueish=h>=195&&h<=240;
 if(!blueish&&s>.2&&l<.3){L2=.96-(l-.1)*.4;S2=.8}else{L2=interp(SURF,l);S2=Math.min(s,.65)*.6}
 return fromHsl(h,S2,Math.min(1,L2))+a}
// teks / aksen
function mapT(hex,minC=5.3){const[r,g,b]=rgb(hex),a=alpha(hex);let[h,s,l]=toHsl([r,g,b]);
 const mx=Math.max(r,g,b),mn=Math.min(r,g,b),chroma=(mx-mn)/255,hsvS=mx?(mx-mn)/mx:0;
 let L2,S2;
 if(chroma<.04)h=212;const neu=chroma<.45;if(neu){L2=.15+(.97-l)*.72}else{L2=.36;S2=Math.min(s,.9)*.95}
 let out;for(;;){if(neu)S2=Math.min(.8,Math.max(.2,.55-(L2-.15)*1.4)+hsvS*.15);out=fromHsl(h,S2,L2);if(cr(rgb(out),LBG)>=minC||L2<=.08)break;L2-=.01}
 return out+a}
// garis stroke: aksen terang -> gelapkan (min 3), selainnya sebagai permukaan
function mapS(hex){const[r,g,b]=rgb(hex);const[h,s,l]=toHsl([r,g,b]);return l>.36?mapT(hex,3):mapB(hex)}
function mapShadow(hex){const[r,g,b]=rgb(hex),a=alpha(hex);const[,,l]=toHsl([r,g,b]);
 if(l<.2&&a){const al=Math.round(parseInt(a,16)*.45).toString(16).padStart(2,'0');return '0f2540'+al}
 return mapB(hex)}
const MAP={b:mapB,t:mapT,s:mapS,x:mapShadow};
const vars={}; // nama -> [gelap, cerah]
const SKIP_SEL=/\.(map-label|po-marker|district-marker|flood-dot|iv-po-marker|iv-dist|iv-out|iv-popup|logo|alert-head)\b|^\s*:root\s*$|^\s*\.button\s*$/;
const KEEP_VAL=new Set(['e6ebef']);

function kindOf(prop){prop=prop.trim().toLowerCase();
 if(prop.startsWith('--ams-'))return 't';
 if(/^(color|fill|caret-color)$/.test(prop))return 't';
 if(prop==='stroke')return 's';
 if(/shadow/.test(prop))return 'x';
 return 'b'}

function transformCss(css){
 let n=0;
 // 1) hex
 css=css.replace(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g,(m0,hx,idx)=>{
  const lo=css.lastIndexOf('{',idx),lc=css.lastIndexOf('}',idx);
  if(lo<lc)return m0; // di luar blok
  let selStart=Math.max(css.lastIndexOf('}',lo),css.lastIndexOf('{',lo-1),css.lastIndexOf('*/',lo));
  const sel=css.slice(selStart+1,lo).trim();
  if(SKIP_SEL.test(sel))return m0;
  const semi=Math.max(css.lastIndexOf(';',idx),lo);
  const decl=css.slice(semi+1,idx);const colon=decl.indexOf(':');
  if(colon<0)return m0;
  const prop=decl.slice(0,colon);
  if(/^\s*:root/.test(sel))return m0;
  const h=norm(hx);if(KEEP_VAL.has(h))return m0;
  const k=kindOf(prop);const name='--'+k+h;
  if(!vars[name])vars[name]=[h,MAP[k](h)];
  n++;return 'var('+name+')'});
 // 2) "white" pada color:
 css=css.replace(/([{;]\s*color\s*:\s*)white\b/g,(m0,pre,idx)=>{
  const lo=css.lastIndexOf('{',idx);const sel=css.slice(Math.max(css.lastIndexOf('}',lo),css.lastIndexOf('{',lo-1))+1,lo).trim();
  if(SKIP_SEL.test(sel))return m0;
  const name='--tffffff';if(!vars[name])vars[name]=['ffffff',mapT('ffffff')];n++;return pre+'var('+name+')'});
 return css;
}

vars['--t8eb2cd']=['8eb2cd',mapT('8eb2cd')];
const lines=html.split('\n');
const region=(a,b,fn)=>{const seg=lines.slice(a,b).join('\n');const out=fn(seg);lines.splice(a,b-a,...out.split('\n'))};
// cari blok style
const idxs=[];lines.forEach((s,i)=>{if(/^<style/.test(s))idxs.push([i,null]);});
idxs.forEach(p=>{for(let j=p[0];j<lines.length;j++)if(/^<\/style>/.test(lines[j])){p[1]=j;break}});
// proses dari belakang supaya indeks kekal
idxs.reverse().forEach(([a,b])=>{region(a+1,b,transformCss)});
html=lines.join('\n');

// pemboleh ubah :root asal -> palet cerah
const ROOTL={'--bg':['b'],'--panel':['b'],'--panel2':['b'],'--panel3':['b'],'--line':['b'],'--line2':['b'],'--white':['t'],'--muted':['t'],'--cyan':['t'],'--blue':['t'],'--green':['t'],'--yellow':['t'],'--red':['t']};
const rootMatch=/:root\{([^}]*)\}/.exec(html)[1];
const rootLight=[];
for(const[k,[kind]]of Object.entries(ROOTL)){const m=new RegExp(k+':(#[0-9a-fA-F]{6})').exec(rootMatch);const h=norm(m[1]);rootLight.push(k+':#'+MAP[kind](h))}
const amsL=[['--ams-orange','ff9f43'],['--ams-violet','c084fc']];


fs.writeFileSync(path.join(__dirname,'tema-vars.json'),JSON.stringify({vars,rootLight},null,1));
const dark=Object.entries(vars).map(([k,v])=>k+':#'+v[0]).join(';');
const light=Object.entries(vars).map(([k,v])=>k+':#'+v[1]).join(';');
const manual=fs.readFileSync(path.join(__dirname,'tema-manual.css'),'utf8');
const temaStyle='<style id="temaStyle">\n/* ===== Tema Gelap / Cerah =====\n   Palet gelap = nilai asal. Palet cerah di bawah html[data-theme="cerah"].\n   Pemboleh ubah --b<hex> (latar/sempadan), --t<hex> (teks/aksen), --s<hex> (stroke), --x<hex> (bayang) dijana dari warna asal. */\n:root{'+dark+'}\nhtml[data-theme="cerah"]{color-scheme:light;'+rootLight.join(';')+';--shadow:0 10px 30px #0f254018;'+light+'}\n'+manual+'\n</style>';
html=html.replace(/(<style id="ivStyle">[\s\S]*?<\/style>)/,'$1\n'+temaStyle.replace(/\$/g,'$$'));
// ---- JS / HTML tambahan
const rep=(a,b)=>{if(!html.includes(a))throw new Error('tiada: '+a.slice(0,60));html=html.split(a).join(b)};
rep('<meta name="color-scheme" content="dark">','<meta name="color-scheme" content="dark light" id="metaScheme">\n<script>(function(){var t="gelap";try{var s=localStorage.getItem("fama_tema");if(s==="cerah"||s==="gelap")t=s}catch(e){}document.documentElement.setAttribute("data-theme",t);var m=document.getElementById("metaScheme");if(m)m.content=t==="cerah"?"light":"dark"})();</script>');

rep('style="color:#8eb2cd"','style="color:var(--t8eb2cd)"');
rep('style="color:#4798ff"','style="color:var(--blue)"');rep('style="color:#22d88a"','style="color:var(--green)"');rep('style="color:#ffbd43"','style="color:var(--yellow)"');rep('style="color:#ff4e63"','style="color:var(--red)"');
rep('rx="7" fill="#0b2442"/>','rx="7" style="fill:var(--ch-bg)"/>');
rep('fill="#174536" opacity','style="fill:var(--ch-ok)" opacity');
rep('fill="#7d6822" opacity','style="fill:var(--ch-warn)" opacity');
rep('fill="#4fb8ff" stroke="#08213c" stroke-width','style="fill:var(--ch-pt);stroke:var(--ch-pt-stroke)" stroke-width');
rep('fill="${r.status===\'merah\'?\'#ff4e63\':r.status===\'kuning\'?\'#ffbd43\':\'#22d88a\'}"','style="fill:${r.status===\'merah\'?\'var(--red)\':r.status===\'kuning\'?\'var(--yellow)\':\'var(--green)\'}"');
rep('<polyline fill="none" stroke="#34d2ed" stroke-width','<polyline fill="none" style="stroke:var(--cyan)" stroke-width');
rep('r="3" fill="#34d2ed"/>','r="3" style="fill:var(--cyan)"/>');
rep('<div class="head-right">','<div class="head-right"><div class="tema-toggle" role="group" aria-label="Tema paparan"><button type="button" id="temaGelap" data-tema="gelap" aria-pressed="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>Gelap</button><button type="button" id="temaCerah" data-tema="cerah" aria-pressed="false"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>Cerah</button></div>');
{const ts='<script id="temaScript">(function(){var h=document.documentElement,bs=document.querySelectorAll(".tema-toggle button"),m=document.getElementById("metaScheme");function ap(t){h.setAttribute("data-theme",t);if(m)m.content=t==="cerah"?"light":"dark";bs.forEach(function(b){b.setAttribute("aria-pressed",b.dataset.tema===t?"true":"false")})}ap(h.getAttribute("data-theme")==="cerah"?"cerah":"gelap");bs.forEach(function(b){b.addEventListener("click",function(){var t=b.dataset.tema;ap(t);try{localStorage.setItem("fama_tema",t)}catch(e){}})})})();<\/script>';
const i=html.lastIndexOf('</body>');html=html.slice(0,i)+ts+'\n'+html.slice(i);}
fs.writeFileSync(DST,html,'utf8');
console.log('vars',Object.keys(vars).length);
