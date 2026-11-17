const fs=require('fs');const path=require('path');
const T=path.resolve(__dirname,'..');const root=path.resolve(T,'..','..');
const src=fs.readFileSync(path.join(T,'backup-before-intervensi.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'iv.css'),'utf8');
const view=fs.readFileSync(path.join(__dirname,'iv-view.html'),'utf8');
const js=['iv-1.js','iv-2.js','iv-3.js'].map(f=>fs.readFileSync(path.join(__dirname,f),'utf8')).join('\n');
let h=src;const nl=h.includes('\r\n')?'\r\n':'\n';
function rep(a,b,once=true){const i=h.indexOf(a);if(i<0)throw new Error('anchor tiada: '+a.slice(0,60));if(once&&h.indexOf(a,i+1)>=0)throw new Error('anchor berganda: '+a.slice(0,60));h=h.slice(0,i)+b+h.slice(i+a.length)}
// E1
const ams=h.indexOf('<style id="amsStyle">');const e1=h.indexOf('</style>',ams)+8;
h=h.slice(0,e1)+nl+'<style id="ivStyle">'+nl+css+'</style>'+h.slice(e1);
// E2/E3
const nav='<nav class="iv-tabs" role="tablist" aria-label="Halaman dashboard"><button type="button" class="iv-tab" role="tab" id="ivTabMonitor" aria-selected="true" aria-controls="viewMonitor">Pemantauan Komoditi</button><button type="button" class="iv-tab" role="tab" id="ivTabIv" aria-selected="false" aria-controls="viewIntervensi" tabindex="-1">Dashboard Intervensi Komoditi</button></nav>'+nl+'<div id="viewMonitor" class="iv-view" role="tabpanel" aria-labelledby="ivTabMonitor">';
rep('</header>','</header>'+nl+nav);
rep('<footer class="footer">','</div>'+nl+view+nl+'<footer class="footer">');
// E5/E6/E7
rep("const MAP_BOUNDS=[[99.5,0.8],[119.5,7.5]];","const MAP_BOUNDS=[[99.5,0.8],[119.5,7.5]];"+nl+"  const FAMA_MAP_STYLE='https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json?key=cb1_584u_1_8040ec8ba084f2ad4e5e6a63';window.FAMA_MAP_CONFIG={style:FAMA_MAP_STYLE,bounds:MAP_BOUNDS};");
rep("style:'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json?key=cb1_584u_1_8040ec8ba084f2ad4e5e6a63',bounds:MAP_BOUNDS","style:FAMA_MAP_STYLE,bounds:MAP_BOUNDS");
rep(nl+" initMap();"+nl,nl+" initMap();"+nl+" window.famaMonitorMapResize=()=>{if(map)map.resize()};"+nl);
// E7b
rep("initControls();renderAll();"+nl+"initScenarios();","initControls();renderAll();"+nl+"window.famaScenariosReady=initScenarios();");
// E8
rep('</body>','<script id="ivScript">'+nl+"(function(){'use strict';"+nl+js+nl+'})();'+nl+'</script>'+nl+'</body>');
fs.writeFileSync(path.join(root,'Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html'),h,'utf8');
// syntax check
const m=/<script id="ivScript">([\s\S]*?)<\/script>/.exec(h);fs.writeFileSync(path.join(__dirname,'iv-extracted.js'),m[1]);
console.log('ok',h.length);
