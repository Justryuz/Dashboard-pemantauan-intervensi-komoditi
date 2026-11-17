const fs=require('fs');const F='Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html';
let t=fs.readFileSync(F,'utf8');const eol=t.includes('\r\n')?'\r\n':'\n';
let L=t.split('\n');const cr=eol==='\r\n'?'\r':'';
const STYLE='https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json?key=cb1_584u_1_8040ec8ba084f2ad4e5e6a63';
function must(c,m){if(!c)throw new Error(m)}
// head
must(L[18].trimStart().startsWith('</style>'),'style end');
L[5]=L[5]+'\n<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">'+'\n<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>'.replace(/\n$/,'');
L[5]=L[5].replace(/\n/g,cr+'\n');
// CSS line 8 (index 7)
let css=L[7];
const a=css.indexOf('#mapSvg{');const endMark='.flood-dot circle{fill:#11c8f2;fill-opacity:.15;stroke:#37d9ff;stroke-width:1.6;stroke-dasharray:4 4}';
const b=css.indexOf(endMark);must(a>0&&b>a,'css range');
const newCss='#map{position:absolute;inset:0;width:100%;height:100%}.maplibregl-map{font-family:inherit}'
+'.po-marker,.district-marker,.flood-dot{position:relative;display:flex;align-items:center;justify-content:center}'
+'.po-marker{width:26px;height:26px;cursor:pointer;outline:none}.po-marker .halo{position:absolute;left:50%;top:50%;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:currentColor;opacity:.22}'
+'.po-marker .core{position:relative;width:13px;height:13px;border-radius:50%;background:currentColor;border:2px solid #fff;box-shadow:0 0 0 1px #0b2540aa,0 1px 4px #0006;box-sizing:content-box}'
+'.po-marker:hover .halo{opacity:.4}.po-marker:hover .core,.po-marker:focus-visible .core{border-width:3px}.po-marker:focus-visible{outline:2px solid #0b2540;border-radius:50%}'
+'.po-marker.compact .halo{width:22px;height:22px;margin:-11px 0 0 -11px}.po-marker.compact .core{width:10px;height:10px}'
+'.po-marker.status-merah,.district-marker.status-merah{color:var(--red)}.po-marker.status-kuning,.district-marker.status-kuning{color:var(--yellow)}.po-marker.status-hijau,.district-marker.status-hijau{color:var(--green)}'
+'.po-marker.status-merah .halo{animation:pulsate 1.4s infinite}@keyframes pulsate{0%{opacity:.15;transform:scale(.76)}65%{opacity:.45;transform:scale(1.65)}100%{opacity:0;transform:scale(2)}}'
+'.map-label{position:absolute;white-space:nowrap;pointer-events:none;font-weight:800;color:#0b2540;text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff,0 0 4px #fff,0 0 4px #fff}'
+'.po-marker .po-label{font-size:11px}.district-marker .map-label{font-size:11px}'
+'.district-marker{width:22px;height:22px;cursor:pointer;outline:none}.district-marker .dot-core{position:relative;width:11px;height:11px;border-radius:50%;background:currentColor;border:2px solid #fff;box-shadow:0 0 0 1px #0b2540aa,0 1px 3px #0006;box-sizing:content-box}'
+'.district-marker.selected .dot-core{width:14px;height:14px;border-color:#0b2540;box-shadow:0 0 0 2px #fff}.district-marker:focus-visible{outline:2px solid #0b2540;border-radius:50%}'
+'.district-marker .district-halo{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:2px solid currentColor;opacity:.75}.district-marker.status-merah .district-halo{animation:pulsate 1.4s infinite}'
+'.flood-dot{pointer-events:none;width:24px;height:24px;border-radius:50%;background:#11c8f2cc;border:2px dashed #0a6fa8;box-shadow:0 0 0 2px #ffffffb0;color:#04324d;font-size:14px;font-weight:900;line-height:1}.flood-dot.compact{width:16px;height:16px;font-size:10px}';
css=css.slice(0,a)+newCss+css.slice(b+endMark.length);
css=css.replace('background:radial-gradient(circle at 57% 20%,#103552 0,#09182c 72%)}#map{','background:#e6ebef}#map{');
must(css.includes('background:#e6ebef}#map{'),'frame bg');
css=css.replace('color:#c9eaff;pointer-events:none}.map-floating .num','color:#c9eaff;pointer-events:none;z-index:5}.map-floating .num');
must(css.includes('z-index:5}.map-floating .num'),'floating z');
L[7]=css;
// po-label rule line 15
const old15='.po-marker .po-label{fill:#d8f5ff;font-size:9px;font-weight:800;stroke:#031524;stroke-width:2.1px;paint-order:stroke;pointer-events:none}';
must(L[14].includes(old15),'po-label rule');L[14]=L[14].replace(old15,'');
// HTML line 41
must(L[40].includes('<svg id="mapSvg"'),'svg');
const s=L[40].indexOf('<svg id="mapSvg"'),e=L[40].indexOf('</svg>')+6;
L[40]=L[40].slice(0,s)+'<div id="map" role="region" aria-label="Peta Malaysia interaktif dengan penanda Pusat Operasi contoh"></div>'+L[40].slice(e);
// footer
must(L[61].includes('Tiada API sebenar digunakan.'),'footer');
L[61]=L[61].replace('Tiada API sebenar digunakan.','Tiada API sebenar digunakan. Peta asas: CARTO Voyager © penyumbang OpenStreetMap.');
// JS
must(L[80].trimStart().startsWith('function project('),'project');
must(L[106].trimStart().startsWith('const NAMESPACE')&&L[107].trimStart().startsWith('function mkSvg'),'mk');
must(L[108].trimStart().startsWith('function renderMap()'),'rm');
must(L[112].trimStart().startsWith("const districts=$('districtLayer')"),'d');
must(L[113].trimStart().startsWith("$('backMap').style.display"),'bm');
must(L[118].trimStart().startsWith('let currentViewBox')&&L[119].trimStart().startsWith('function zoomTo'),'zt');
const shiftMatch=L[111].match(/const labelShift=\{[^}]*\};/);must(shiftMatch,'labelShift');
const mapCode=`
 let map=null,mapView=null,mapMarkers=[];
 const MAP_BOUNDS=[[99.5,0.8],[119.5,7.5]];
 function initMap(){if(typeof maplibregl==='undefined'){console.warn('MapLibre GL tidak dapat dimuatkan');return;}
  try{map=new maplibregl.Map({container:'map',style:'${STYLE}',bounds:MAP_BOUNDS,fitBoundsOptions:{padding:20},attributionControl:true,cooperativeGestures:true,dragRotate:false,pitchWithRotate:false,locale:{'CooperativeGesturesHandler.WindowsHelpText':'Tekan Ctrl + skrol untuk zum peta','CooperativeGesturesHandler.MacHelpText':'Tekan ⌘ + skrol untuk zum peta','CooperativeGesturesHandler.MobileHelpText':'Guna dua jari untuk gerakkan peta'}});
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');}catch(err){console.warn('Peta tidak dapat dimulakan',err);map=null;}}
 function addMapMarker(el,lon,lat){const m=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([lon,lat]).addTo(map);mapMarkers.push(m);return m}
 function mapEl(cls,attrs={}){const el=document.createElement('div');el.className=cls;Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));return el}
 function mapChild(tag,cls,text){const c=document.createElement(tag);c.className=cls;if(text!==undefined)c.textContent=text;return c}
 function renderMap(){
  $('floodToggle').textContent=state.banjir?'≋ Banjir: Hidup':'≋ Banjir: Mati';
  const visible=statePOs();
  if(map){mapMarkers.forEach(m=>m.remove());mapMarkers=[];
   if(state.banjir){DATA.banjir.forEach(f=>{const el=mapEl('flood-dot'+(state.po?' compact':''),{'aria-label':f.name,title:f.name});el.textContent='≋';addMapMarker(el,f.lon,f.lat);})}
   ${shiftMatch[0]}visible.forEach(p=>{const s=poStatus(p);const el=mapEl(\`po-marker status-\${s}\${state.po?' compact':''}\`,{tabindex:'0',role:'button','aria-label':\`\${p.name}, \${labels[s]}\`,title:\`\${p.name} · \${labels[s]} · \${p.negeri} · Muatan kumpulan: \${p.logistik.muatanMT} MT\${p.logistik.shared?' (angka dikongsi)':''} — klik untuk perincian\`});el.append(mapChild('span','halo'),mapChild('span','core'));if(!state.po){const [dx,dy]=labelShift[p.id]||[9,-10];const t=mapChild('span','map-label po-label',p.label);t.style.left=\`calc(50% + \${dx}px)\`;t.style.top=\`calc(50% + \${dy}px)\`;t.style.transform=dx<0?'translate(-100%,-50%)':'translate(0,-50%)';el.append(t);}el.addEventListener('click',()=>selectPO(p.id));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectPO(p.id)}});addMapMarker(el,p.lon,p.lat);});
   if(state.po){const p=poById[state.po];p.districts.forEach((d,i)=>{const s=poStatus(p,d[0]);const el=mapEl(\`district-marker status-\${s}\${state.daerah===d[0]?' selected':''}\`,{tabindex:'0',role:'button','aria-label':\`\${d[0]}, \${labels[s]}\`,title:\`\${d[0]} · \${labels[s]}\`});if(s==='merah')el.append(mapChild('span','district-halo'));el.append(mapChild('span','dot-core'));const t=mapChild('span','map-label',d[0]);t.style.left=\`calc(50% + \${i%2?9:-9}px)\`;t.style.top='calc(50% - 10px)';t.style.transform=i%2?'translate(0,-50%)':'translate(-100%,-50%)';el.append(t);el.addEventListener('click',()=>selectDistrict(d[0]));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectDistrict(d[0])}});addMapMarker(el,d[2],d[1]);});}
  }
`.replace(/\n/g,cr+'\n');
const zoomCode=` function applyMapView(){if(!map)return;const po=mapView;if(po){const b=new maplibregl.LngLatBounds([po.lon,po.lat],[po.lon,po.lat]);po.districts.forEach(d=>b.extend([d[2],d[1]]));map.fitBounds(b,{padding:60,maxZoom:10,duration:700});}else map.fitBounds(MAP_BOUNDS,{padding:20,duration:700});}
 function zoomTo(po){mapView=po||null;if(!map)return;if(map.loaded())applyMapView();else map.once('load',applyMapView);}
 initMap();`;
const out=[];
for(let i=0;i<L.length;i++){
 if(i===80||i===106||i===107)continue;
 if(i===108){out.push(mapCode.replace(/^\r?\n/,'').replace(/\r?\n$/,'')+cr);continue}
 if(i>=109&&i<=112)continue;
 if(i===118)continue;
 if(i===119){out.push(zoomCode+cr);continue}
 out.push(L[i]);
}
// mapCode ends with the "  }" of if(map) block; renderMap continues with lines 114-115 (backMap etc.) and its closing brace
fs.writeFileSync(F,out.join('\n'));

