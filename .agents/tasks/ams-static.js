// Static checks for the AMS panel. Run: node .agents/tasks/ams-static.js (from workspace root)
const fs = require('fs');
const f = 'Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html';
const o = '.agents/tasks/original-before-ai-panel.html';
const s = fs.readFileSync(f, 'utf8');
const m = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)];
m.forEach(x => new Function(x[1]));
console.log('syntax ok, inline scripts:', m.length);
const lines = s.split('\n');
const noData = lines.filter(l => !l.startsWith('const DATA =')).join('\n');
const ids = [...noData.matchAll(/\sid="([^"]+)"/g)].map(x => x[1]);
const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
console.log('duplicate ids:', dup.length ? dup : 'none');
const ol = fs.readFileSync(o, 'utf8').split('\n');
const dl = lines.findIndex(l => l.startsWith('const DATA ='));
const odl = ol.findIndex(l => l.startsWith('const DATA ='));
console.log('DATA line byte-identical:', lines[dl] === ol[odl]);
// original lines preserved except the 4 planned edits
const set = new Set(lines);
const changed = ol.filter(l => !set.has(l));
console.log('original lines modified/removed:', changed.length);
changed.forEach(l => console.log('  -', l.slice(0, 90).replace(/\s+/g, ' ')));
// hardcode check
const block = s.slice(s.indexOf('/* ===== AI Multi-Scenario Monitoring (data'), s.indexOf('/* ===== Tamat'));
const bad = [...block.matchAll(/>\s*(3|6|2)\s*</g)];
console.log('hardcoded KPI literals >3< >6< >2<:', bad.length);
