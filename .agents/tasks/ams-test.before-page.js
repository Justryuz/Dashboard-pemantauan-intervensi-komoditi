// Headless Edge verification for the AMS panel. Run from workspace root: node .agents/tasks/ams-test.js [fileOverride]
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(__dirname, 'bt/node_modules/puppeteer-core'));
const FILE = path.resolve(process.argv[2] || 'Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html');
const OUT = __dirname;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, detail === undefined ? '' : JSON.stringify(detail)); } };

const S01 = 'Hujan berterusan di Kelantan, Terengganu dan Pahang berpotensi mengganggu aktiviti penuaian, pengumpulan hasil serta penghantaran komoditi pertanian. PO Kota Baharu dan PO Kuantan turut dikaitkan dengan senario amaran banjir S03, yang meningkatkan keperluan pemantauan akses logistik dan bekalan.';
const S02 = 'Ribut petir dan angin kencang berpotensi menyebabkan gangguan sementara terhadap aktiviti penuaian, pengumpulan hasil serta operasi pengangkutan di Johor dan Melaka. Risiko terhadap komoditi dan laluan pengedaran memerlukan pengesahan daripada PO berkaitan.';
const S03 = 'Kawasan yang terdedah kepada banjir mungkin mengalami gangguan akses jalan dan penghantaran bekalan. Dua PO juga terlibat dalam senario hujan berterusan S01.';

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: 'new', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage();
  await pg.setViewport({ width: 1440, height: 1000 });
  const errs = [];
  pg.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  pg.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await pg.goto('file:///' + FILE.replace(/\\/g, '/'));
  await pg.waitForSelector('.po-marker', { timeout: 30000 });
  await sleep(3000);
  const T = (fn, ...a) => pg.evaluate(fn, ...a);
  const txt = sel => T(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
  const rows = () => T(() => [...document.querySelectorAll('.ams-po-row')].map(r => r.querySelector('.ams-po-name').childNodes[0].textContent.trim() + '|' + r.querySelector('.ams-pill').textContent.trim() + '|' + (r.querySelector('.ams-po-also') ? r.querySelector('.ams-po-also').textContent.trim() : '')));
  const rings = () => T(() => [...document.querySelectorAll('.po-marker.scenario-ring')].map(e => e.querySelector('.po-label').textContent));
  const statuses = () => T(() => Object.fromEntries([...document.querySelectorAll('.po-marker')].map(e => [e.querySelector('.po-label').textContent, [...e.classList].filter(c => c.startsWith('status-')).join()])));
  const scrollY = () => T(() => window.scrollY);

  // 1 default
  ok('default: 3 cards', (await T(() => document.querySelectorAll('#amsList .ams-card').length)) === 3);
  ok('default: KPIs 3/6/2', JSON.stringify(await T(() => [...document.querySelectorAll('.ams-kpi-v')].map(e => e.textContent))) === '["3","6","2"]');
  ok('default: KPI labels', JSON.stringify(await T(() => [...document.querySelectorAll('.ams-kpi-l')].map(e => e.textContent))) === '["Senario","PO unik terlibat","PO bertindih"]');
  ok('default: detail hidden', await T(() => document.getElementById('amsDetail').hidden && !document.getElementById('amsDetail').innerHTML.trim()));
  ok('default: badge DATA DUMMY', (await txt('#amsBadge')) === 'DATA DUMMY');
  ok('default: titles', (await txt('#amsTitle')) === 'AI Multi-Scenario Monitoring' && (await txt('.ams-sub')) === 'Pemantauan pelbagai senario dan PO terlibat' && (await txt('.ams-section')) === 'Senario Cuaca yang Dikesan');
  ok('default: brain icon svg', await T(() => !!document.querySelector('.ams-brain svg')));
  ok('default: no ring', (await rings()).length === 0);
  ok('default: stats()', JSON.stringify(await T(() => DASHBOARD_TEST.scenarioStats())) === '{"scenarios":3,"uniquePO":6,"overlapPO":2}');
  ok('default: no state msg', (await txt('#amsState')) === '');
  const cards = await T(() => [...document.querySelectorAll('.ams-card')].map(c => ({ t: c.querySelector('.ams-card-title').textContent, l: [...c.querySelectorAll('.ams-card-line')].map(x => x.textContent), r: c.querySelector('.ams-risk').textContent, ae: c.getAttribute('aria-expanded'), ac: c.getAttribute('aria-controls'), svg: !!c.querySelector('.ams-ico svg'), chev: !!c.querySelector('.ams-chev'), col: getComputedStyle(c.querySelector('.ams-risk')).color })));
  console.log(JSON.stringify(cards));
  ok('cards content', cards[0].t === 'S01 · Hujan Berterusan' && cards[0].l[0] === 'Kelantan, Terengganu & Pahang' && cards[0].l[1] === '3 PO berkaitan · MET Malaysia' && cards[0].r === 'Risiko Sederhana'
    && cards[1].t === 'S02 · Ribut Petir & Angin Kencang' && cards[1].l[0] === 'Johor & Melaka' && cards[1].l[1] === '3 PO berkaitan · MET Malaysia'
    && cards[2].t === 'S03 · Amaran Banjir' && cards[2].l[0] === 'Kelantan & Pahang' && cards[2].l[1] === '2 PO berkaitan · JPS Malaysia' && cards[2].r === 'Risiko Tinggi', cards);
  ok('cards a11y/icons', cards.every(c => c.ae === 'false' && c.ac === 'amsDetail' && c.svg && c.chev));
  ok('card risk colours (orange/orange/red)', cards[0].col === 'rgb(255, 159, 67)' && cards[1].col === 'rgb(255, 159, 67)' && cards[2].col === 'rgb(255, 78, 99)', cards.map(c => c.col));
  await pg.screenshot({ path: path.join(OUT, 'ams-1440-default.png'), fullPage: true });
  const panelBox0 = await T(() => { const r = document.getElementById('amsPanel').getBoundingClientRect(); return { y: r.top + scrollY, h: r.height }; });
  const baseStatus = await statuses();
  const lsBefore = await T(() => localStorage.getItem('fama-demo-intervensi-v1'));

  // placement: between main and bottom-grid
  ok('placement: 3rd panel inside bottom-grid after MET', await T(() => { const p = document.getElementById('amsPanel'); return p.parentElement.classList.contains('bottom-grid') && p.parentElement.children.length === 3 && p === p.parentElement.lastElementChild; }));

  // 2 S01
  await pg.click('.ams-card[data-sid="S01"]'); await sleep(500);
  ok('S01 sel+expanded', await T(() => { const c = document.querySelector('.ams-card[data-sid="S01"]'); return c.classList.contains('sel') && c.getAttribute('aria-expanded') === 'true' && document.querySelectorAll('.ams-card.sel').length === 1; }));
  ok('S01 header', (await txt('.ams-det-head h3')) === 'Senario Dipilih: S01' && (await txt('.ams-det-head .ams-risk')) === 'Risiko Sederhana');
  ok('S01 risk pill orange', (await T(() => getComputedStyle(document.querySelector('.ams-det-head .ams-risk')).color)) === 'rgb(255, 159, 67)');
  ok('S01 PO rows', JSON.stringify(await rows()) === JSON.stringify(['PO Kota Baharu|2 senario|· Juga dalam S03', 'PO Kuala Terengganu|1 senario|', 'PO Kuantan|2 senario|· Juga dalam S03']), await rows());
  ok('S01 pill classes', JSON.stringify(await T(() => [...document.querySelectorAll('.ams-pill')].map(p => p.classList.contains('multi')))) === '[true,false,true]');
  ok('S01 PO YANG BERKAITAN', (await txt('.ams-sub-title')) === 'PO YANG BERKAITAN');
  ok('S01 exact insight', (await txt('.ams-ins-summary')) === S01);
  ok('S01 Komoditi', (await txt('.ams-ins-comm')) === 'Cili Merah, Sawi dan Timun.');
  ok('S01 Cadangan', (await txt('.ams-ins-rec')) === 'Semak status pengeluaran dan stok komoditi di PO terlibat, pantau laluan penghantaran yang berisiko serta sediakan pilihan mobilisasi bekalan daripada PO lain dalam zon yang sama sekiranya gangguan disahkan.');
  ok('S01 AI title + chip + buttons', (await txt('.ams-ai-title')) === 'AI Insight — Hujan Berterusan' && (await txt('.ams-dummy-chip')) === 'Contoh data dummy — bukan hasil model AI sebenar' && (await T(() => [...document.querySelectorAll('.ams-actions button')].map(x => x.textContent).join('|'))) === 'Kembali ke Senarai Senario|Lihat Pilihan Intervensi' && (await T(() => !!document.querySelector('.ams-ai-title svg'))));
  ok('S01 no hash/url change', (await T(() => location.hash)) === '');
  await sleep(1200);
  ok('S01 rings = 3 POs', JSON.stringify((await rings()).sort()) === JSON.stringify(['K. Terengganu', 'Kota Baharu', 'Kuantan']), await rings());
  ok('S01 status classes unchanged', JSON.stringify(await statuses()) === JSON.stringify(baseStatus));
  ok('S01 detail visible in viewport', await T(() => { const r = document.getElementById('amsDetail').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }));

  // 3 S02
  await pg.click('.ams-card[data-sid="S02"]'); await sleep(400);
  ok('S02 only one sel; S01 replaced', await T(() => document.querySelectorAll('.ams-card.sel').length === 1 && document.querySelector('.ams-card.sel').dataset.sid === 'S02' && document.querySelectorAll('.ams-det-head').length === 1));
  ok('S02 PO rows', JSON.stringify(await rows()) === JSON.stringify(['PO Johor Baharu|1 senario|', 'PO Simpang Renggam|1 senario|', 'PO Ayer Keroh|1 senario|']), await rows());
  ok('S02 exact insight', (await txt('.ams-ins-summary')) === S02);
  ok('S02 cadangan+komoditi', (await txt('.ams-ins-rec')) === 'Semak keadaan pusat pengumpulan, kesiapsiagaan kenderaan dan jadual penghantaran. Pantau risiko gangguan bekalan dan pertimbangkan pelarasan pengedaran jika perlu.' && (await txt('.ams-ins-comm')) === 'Tomato, Cili Merah dan Sayur Berdaun.');
  ok('S02 pills muted', await T(() => [...document.querySelectorAll('.ams-pill')].every(p => !p.classList.contains('multi'))));
  ok('S02 header Sederhana', (await txt('.ams-det-head .ams-risk')) === 'Risiko Sederhana');
  await sleep(1200);
  ok('S02 rings', JSON.stringify((await rings()).sort()) === JSON.stringify(['Ayer Keroh', 'Johor Baharu', 'S. Renggam']), await rings());

  // 4 S03
  await pg.click('.ams-card[data-sid="S03"]'); await sleep(400);
  ok('S03 PO rows', JSON.stringify(await rows()) === JSON.stringify(['PO Kota Baharu|2 senario|· Juga dalam S01', 'PO Kuantan|2 senario|· Juga dalam S01']), await rows());
  ok('S03 exact insight', (await txt('.ams-ins-summary')) === S03);
  ok('S03 cadangan', (await txt('.ams-ins-rec')) === 'Utamakan semakan akses logistik, stok dan keperluan mobilisasi dari PO lain dalam zon.');
  ok('S03 Risiko Tinggi red', (await txt('.ams-det-head .ams-risk')) === 'Risiko Tinggi' && (await T(() => getComputedStyle(document.querySelector('.ams-det-head .ams-risk')).color)) === 'rgb(255, 78, 99)');
  ok('S03 selected card red border', (await T(() => getComputedStyle(document.querySelector('.ams-card.sel')).borderTopColor)) === 'rgb(255, 78, 99)');
  await sleep(1200);
  ok('S03 rings = 2', JSON.stringify((await rings()).sort()) === JSON.stringify(['Kota Baharu', 'Kuantan']), await rings());
  ok('S03 status classes unchanged', JSON.stringify(await statuses()) === JSON.stringify(baseStatus));
  ok('ring pseudo present', await T(() => getComputedStyle(document.querySelector('.po-marker.scenario-ring'), '::after').borderTopWidth === '2px'));

  // 7 PO drawer (S03 -> Kota Baharu)
  await pg.click('.ams-po-row[data-po="kelantan"]'); await sleep(400);
  const dr = await txt('#amsPoDrawer');
  console.log(dr);
  ok('drawer opens', !!dr && dr.includes('PO Kota Baharu') && dr.includes('Kelantan'));
  ok('drawer scenario ids', dr.includes('S01, S03'));
  ok('drawer logistics values', dr.includes('9 buah') && dr.includes('30.39 MT') && dr.includes('2 unit') && dr.includes('10.1 MT'));
  ok('drawer union commodities', dr.includes('Cili Merah, Sawi dan Timun'));
  ok('drawer separate price block', dr.includes('Status bekalan/harga komoditi (berasingan daripada amaran cuaca)') && dr.includes('Sawi: Data harga tidak tersedia (dummy)') && /Cili Merah: ● (Kritikal|Berwaspada|Stabil)/.test(dr), dr);
  ok('drawer separation note', dr.includes('Amaran cuaca tidak menukar status PO kepada merah'));
  ok('drawer actions + button', dr.includes('Utamakan semakan akses logistik') && dr.includes('Lihat harga komoditi PO ini'));
  ok('one drawer at a time', await T(() => document.querySelectorAll('#amsPoDrawer').length === 1));
  await pg.click('.ams-po-row[data-po="pahang"]'); await sleep(300);
  ok('switch drawer to Kuantan', (await txt('#amsPoDrawer h4')) === 'PO Kuantan' && (await T(() => document.querySelectorAll('#amsPoDrawer').length)) === 1);
  // shared logistics PO via S02
  await pg.click('.ams-card[data-sid="S02"]'); await sleep(300);
  ok('drawer closed when switching scenario', (await T(() => !document.getElementById('amsPoDrawer'))));
  await pg.click('.ams-po-row[data-po="johor"]'); await sleep(300);
  const dj = await txt('#amsPoDrawer');
  ok('shared logistics: Angka gabungan', dj.includes('Angka gabungan: PO Johor Baharu + PO Simpang Renggam'), dj);
  ok('Tomato maps to Tomato Bulat', dj.includes('Tomato → Tomato Bulat:'), dj);
  ok('Sayur Berdaun no price data', dj.includes('Sayur Berdaun: Data harga tidak tersedia (dummy)'));
  await pg.keyboard.press('Escape'); await sleep(200);
  ok('Escape closes drawer', await T(() => !document.getElementById('amsPoDrawer')));
  await pg.click('.ams-po-row[data-po="johor"]'); await sleep(200);
  await pg.click('#amsPoDrawer [data-act="closepo"]'); await sleep(200);
  ok('Tutup closes drawer', await T(() => !document.getElementById('amsPoDrawer')));
  // price drill-down
  await pg.click('.ams-po-row[data-po="melaka"]'); await sleep(300);
  await pg.click('#amsPoDrawer [data-act="prices"]'); await sleep(1500);
  const sp = await T(() => ({ po: DASHBOARD_TEST.state.po, sel: document.getElementById('filterState').value, kom: DASHBOARD_TEST.state.komoditi, selK: document.getElementById('filterCommodity').value, open: DASHBOARD_TEST.state.scenario, drawer: !!document.getElementById('amsPoDrawer'), detail: !document.getElementById('amsDetail').hidden }));
  ok('Lihat harga: selectPO + commodity synced, panel stays open', sp.po === 'melaka' && sp.sel === 'melaka' && sp.kom === 'Tomato Bulat' && sp.selK === 'Tomato Bulat' && sp.open === 'S02' && sp.drawer && sp.detail, sp);
  ok('status classes with PO filter still only status-*', await T(() => [...document.querySelectorAll('.po-marker')].every(e => [...e.classList].some(c => /^status-(merah|kuning|hijau)$/.test(c)))));
  await T(() => document.getElementById('resetFilters').click()); await sleep(800);
  ok('reset clears filters, keeps scenario', await T(() => DASHBOARD_TEST.state.po === null && DASHBOARD_TEST.state.komoditi === 'all' && DASHBOARD_TEST.state.scenario === 'S02'));

  // 9 intervention
  await pg.click('.ams-card[data-sid="S03"]'); await sleep(400);
  await pg.click('[data-act="interv"]'); await sleep(400);
  const note = await T(() => document.getElementById('actionNote') && document.getElementById('actionNote').value);
  console.log(note);
  ok('interv modal opens prefilled (S03)', !!note && note.startsWith('Konteks senario S03 · Amaran Banjir · PO ') && note.endsWith('Komoditi: Cili Merah, Sawi dan Timun'), note);
  ok('modal shows an existing Borong record title', (await txt('#modalTitle')) !== null);
  await pg.click('#actionCancel'); await sleep(200);
  ok('cancel: localStorage unchanged', (await T(() => localStorage.getItem('fama-demo-intervensi-v1'))) === lsBefore);
  // with selected PO
  await pg.click('.ams-po-row[data-po="pahang"]'); await sleep(300);
  await pg.click('[data-act="interv"]'); await sleep(300);
  const note2 = await T(() => document.getElementById('actionNote').value);
  ok('interv with selected PO uses that PO', note2.includes('PO Kuantan'), note2);
  await pg.click('#modalClose'); await sleep(200);
  // existing callers: empty note
  await T(() => document.querySelector('#riskList button, .risk-feed button, .risk-feed [data-id]') && 0);
  const qBtn = await T(() => { const b = document.querySelector('[data-open-action]'); if (b) { b.click(); return true; } return false; });
  await sleep(300);
  ok('existing queue "Tindakan" opens modal with empty note', qBtn && (await T(() => document.getElementById('actionNote') && document.getElementById('actionNote').value === '')));
  await T(() => { const c = document.getElementById('modalClose'); c && c.click(); });
  // fallback: S02 -> Sayur Berdaun not matched but Tomato/Cili are; use temp scenario with no matching commodity
  await T(() => { const l = DASHBOARD_TEST.scenarioDummy(); const x = l[2]; x.scenarioId = 'S09'; x.scenarioName = 'Ujian Tanpa Padanan'; x.affectedCommodities = ['Sawi', 'Timun']; l.push(x); DASHBOARD_TEST.setScenarios(l); });
  await pg.click('.ams-card[data-sid="S09"]'); await sleep(300);
  await pg.click('[data-act="interv"]'); await sleep(300);
  ok('fallback toast + modal', (await T(() => document.getElementById('toast').textContent)) === 'Konteks senario dihantar; tiada rekod harga sepadan untuk komoditi senario.' && (await T(() => !!document.getElementById('actionNote').value.startsWith('Konteks senario S09'))));
  await T(() => { document.getElementById('modalClose').click(); });
  ok('fallback: nothing saved', (await T(() => localStorage.getItem('fama-demo-intervensi-v1'))) === lsBefore);

  // 10 data-driven 4th scenario (temp)
  await T(() => { const l = DASHBOARD_TEST.scenarioDummy(); l.push({ scenarioId: 'S04', scenarioName: 'Angin Kencang Uji', warningType: 'ribut_petir', source: 'MET Malaysia', issuedAt: '2026-11-14T10:00:00+08:00', validFrom: '2026-11-14T10:00:00+08:00', validUntil: '2026-11-14T20:00:00+08:00', affectedStates: ['Johor', 'Kelantan'], affectedDistricts: [], affectedPOIds: ['johor', 'kelantan'], riskLevel: 'tinggi', affectedCommodities: ['Tomato'], recommendedActions: ['Uji'], dataStatus: 'dummy' }); DASHBOARD_TEST.setScenarios(l); });
  await sleep(200);
  const st4 = await T(() => DASHBOARD_TEST.scenarioStats());
  const exp4 = await T(() => { const m = {}; DASHBOARD_TEST.scenarioList().forEach(s => s.affectedPOIds.forEach(i => (m[i] = m[i] || []).push(s.scenarioId))); return { scenarios: DASHBOARD_TEST.scenarioList().length, uniquePO: Object.keys(m).length, overlapPO: Object.values(m).filter(a => a.length >= 2).length }; });
  ok('4th scenario: 4 cards, KPI recomputed', (await T(() => document.querySelectorAll('.ams-card').length)) === 4 && JSON.stringify(st4) === JSON.stringify(exp4) && JSON.stringify(await T(() => [...document.querySelectorAll('.ams-kpi-v')].map(e => +e.textContent))) === JSON.stringify([exp4.scenarios, exp4.uniquePO, exp4.overlapPO]), { st4, exp4 });
  await pg.click('.ams-card[data-sid="S04"]'); await sleep(300);
  ok('4th scenario detail renders (fallback insight, 2 pills)', (await rows()).length === 2 && (await T(() => [...document.querySelectorAll('.ams-pill')].every(p => p.classList.contains('multi')))) && (await txt('.ams-ins-summary')).includes('belum tersedia'));
  await T(() => DASHBOARD_TEST.setScenarios(DASHBOARD_TEST.scenarioDummy()));
  await T(() => DASHBOARD_TEST.initScenarios()); await sleep(300);
  ok('restored: 3 cards, 3/6/2, S04 gone', (await T(() => document.querySelectorAll('.ams-card').length)) === 3 && JSON.stringify(await T(() => [...document.querySelectorAll('.ams-kpi-v')].map(e => e.textContent))) === '["3","6","2"]' && (await T(() => DASHBOARD_TEST.state.scenario)) === null);

  // loading / error / empty states
  await T(() => DASHBOARD_TEST.initScenarios(async () => { throw new Error('uji'); })); await sleep(300);
  ok('error state message + dummy fallback', (await txt('#amsState')) === 'Gagal memuatkan senario — memaparkan data dummy' && (await T(() => document.querySelectorAll('.ams-card').length)) === 3);
  await T(() => DASHBOARD_TEST.initScenarios(async () => ({ status: 'dummy', data: [] }))); await sleep(300);
  ok('empty state', (await txt('#amsState')) === 'Tiada senario amaran dikesan' && (await T(() => document.querySelectorAll('.ams-card').length)) === 0);
  const loadingSeen = await T(() => { const p = DASHBOARD_TEST.initScenarios(() => new Promise(() => {})); return document.getElementById('amsState').textContent; });
  ok('loading state', loadingSeen === 'Memuatkan senario…', loadingSeen);
  await T(() => DASHBOARD_TEST.initScenarios()); await sleep(300);
  ok('recovered to 3 cards', (await T(() => document.querySelectorAll('.ams-card').length)) === 3 && (await txt('#amsState')) === '');
  ok('ScenarioService.validateScenario rejects bad', await T(() => { const v = DASHBOARD_TEST.ScenarioService.validateScenario({ scenarioId: 'X', affectedPOIds: ['nope'] }); const g = DASHBOARD_TEST.ScenarioService.validateScenario(DASHBOARD_TEST.scenarioDummy()[0]); return !v.ok && v.errors.length > 0 && g.ok; }));
  ok('fetchAIInsight stub source dummy', await T(async () => (await DASHBOARD_TEST.ScenarioService.fetchAIInsight('S01')).source === 'dummy'));

  // 5 collapse / back
  await pg.click('.ams-card[data-sid="S01"]'); await sleep(300);
  await pg.click('.ams-card[data-sid="S01"]'); await sleep(900);
  ok('click selected collapses', await T(() => document.getElementById('amsDetail').hidden && !document.querySelector('.ams-card.sel') && !document.querySelector('.scenario-ring') && document.querySelector('.ams-card').getAttribute('aria-expanded') === 'false'));
  await pg.click('.ams-card[data-sid="S01"]'); await sleep(300);
  await T(() => window.scrollTo(0, document.body.scrollHeight)); await sleep(300);
  await pg.click('[data-act="back"]'); await sleep(1200);
  ok('Kembali ke Senarai Senario returns to overview', await T(() => document.getElementById('amsDetail').hidden && !document.querySelector('.ams-card.sel') && document.activeElement && document.activeElement.dataset.sid === 'S01'));
  ok('Kembali scrolls panel top into view', await T(() => { const r = document.getElementById('amsPanel').getBoundingClientRect(); return r.top > -5 && r.bottom > 0 && r.top < innerHeight - 100; }), await T(() => { const p=document.getElementById('amsPanel'); return [p.getBoundingClientRect().top,p.scrollTop,scrollY]; }));

  // 6 keyboard
  await T(() => document.querySelector('.ams-card[data-sid="S01"]').focus());
  await pg.keyboard.press('Enter'); await sleep(300);
  ok('Enter opens S01', (await T(() => DASHBOARD_TEST.state.scenario)) === 'S01');
  await T(() => document.querySelector('.ams-card[data-sid="S02"]').focus());
  await pg.keyboard.press('Space'); await sleep(300);
  ok('Space selects S02', (await T(() => DASHBOARD_TEST.state.scenario)) === 'S02' && (await T(() => document.activeElement.dataset.sid)) === 'S02');
  ok('focus ring visible', await T(() => { const c = document.querySelector('.ams-card[data-sid="S02"]'); c.focus(); const s = getComputedStyle(c); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; }));
  await T(() => document.querySelector('.ams-po-row').focus());
  await pg.keyboard.press('Enter'); await sleep(300);
  ok('Enter on PO row opens drawer', await T(() => !!document.getElementById('amsPoDrawer')));
  ok('PO row focus retained after open', await T(() => document.activeElement.classList.contains('ams-po-row')));
  await pg.keyboard.press('Escape'); await sleep(200);

  // 11 existing features
  await pg.select('#filterCommodity', 'Cili Merah'); await sleep(500);
  ok('filter select works & scenario stays', (await T(() => DASHBOARD_TEST.state.komoditi)) === 'Cili Merah' && (await T(() => DASHBOARD_TEST.state.scenario)) === 'S02');
  await pg.select('#filterCommodity', 'all'); await sleep(300);
  await pg.select('#filterState', 'selangor'); await sleep(800);
  ok('filterState selects PO (existing)', (await T(() => DASHBOARD_TEST.state.po)) === 'selangor' && (await T(() => !document.getElementById('amsDetail').hidden)));
  await T(() => document.getElementById('backMap').click()); await sleep(500);
  ok('#backMap works', (await T(() => DASHBOARD_TEST.state.po)) === null);
  await T(() => window.scrollTo(0, 0)); await sleep(300);
  const mk = (await pg.evaluateHandle(() => [...document.querySelectorAll('.po-marker')].find(e => e.textContent === 'Kuantan')));
  await mk.asElement().hover(); await sleep(700);
  ok('hover popup shows', await T(() => !!document.querySelector('.po-hover-popup')));
  await T(() => [...document.querySelectorAll('.po-marker')].find(e => e.textContent === 'Kuantan').click()); await sleep(1200);
  ok('map marker click selects PO and scenario panel intact', (await T(() => DASHBOARD_TEST.state.po)) === 'pahang' && (await T(() => DASHBOARD_TEST.state.scenario)) === 'S02');
  await T(() => document.getElementById('resetFilters').click()); await sleep(500);
  ok('reset works', (await T(() => DASHBOARD_TEST.state.po)) === null);
  ok('hidden panels still hidden', await T(() => ['logistikKpis', 'dataQuality', 'outletPanel', 'mapDetail', 'poDirectory'].every(id => { const e = document.getElementById(id); return !e || getComputedStyle(e).display === 'none' || (e.closest('[hidden]') && true) || e.hidden; })));

  // 12 layout regression vs original
  const rects = p => p.evaluate(() => { const g = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }; return { map: g('.map-panel'), analytics: g('.analytics-col'), triple: g('.triple-row'), bottom: g('.bottom-grid'), main: g('.main-grid') }; });
  await T(() => DASHBOARD_TEST.state.scenario && DASHBOARD_TEST.selectScenario(DASHBOARD_TEST.state.scenario)); // collapse
  await sleep(500);
  const newRects = await rects(pg);
  const pg2 = await b.newPage(); await pg2.setViewport({ width: 1440, height: 1000 });
  await pg2.goto('file:///' + path.resolve(OUT, 'original-before-ai-panel.html').replace(/\\/g, '/'));
  await pg2.waitForSelector('.po-marker', { timeout: 30000 }); await sleep(3000);
  const oldRects = await rects(pg2);
  ok('layout regression: existing panel sizes equal original @1440', JSON.stringify(newRects) === JSON.stringify(oldRects), { newRects, oldRects });
  await pg2.close();

  ok('no console errors / page errors', errs.length === 0, errs);

  // screenshots
  async function shots(w, h, tag) {
    await pg.setViewport({ width: w, height: h }); await sleep(800);
    await T(() => { DASHBOARD_TEST.state.scenario && DASHBOARD_TEST.selectScenario(DASHBOARD_TEST.state.scenario); });
    await sleep(500);
    await T(() => document.getElementById('amsPanel').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await pg.screenshot({ path: path.join(OUT, `ams-${tag}-default.png`) });
    await T(() => DASHBOARD_TEST.selectScenario('S03')); await sleep(600);
    await T(() => DASHBOARD_TEST.openScenarioPO('kelantan')); await sleep(600);
    await T(() => document.getElementById('amsPanel').scrollIntoView({ block: 'start', behavior: 'instant' })); await sleep(300);
    await pg.screenshot({ path: path.join(OUT, `ams-${tag}-s03.png`) });
    await pg.screenshot({ path: path.join(OUT, `ams-${tag}-s03-full.png`), fullPage: true });
    const noHScroll = await T(() => document.documentElement.scrollWidth <= innerWidth);
    ok(`no horizontal page scroll @${w}`, noHScroll, await T(() => [document.documentElement.scrollWidth, innerWidth]));
    await T(() => DASHBOARD_TEST.selectScenario('S03'));
  }
  await shots(1440, 1000, '1440');
  fs.copyFileSync(path.join(OUT, 'ams-1440-s03-full.png'), path.join(OUT, 'ams-1440.png'));
  await shots(1024, 900, '1024');
  fs.copyFileSync(path.join(OUT, 'ams-1024-s03.png'), path.join(OUT, 'ams-1024.png'));
  await shots(390, 844, '390');
  fs.copyFileSync(path.join(OUT, 'ams-390-s03.png'), path.join(OUT, 'ams-390.png'));
  ok('no console errors after resize/screens', errs.length === 0, errs);

  // reduced motion
  const pg3 = await b.newPage(); await pg3.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await pg3.setViewport({ width: 1440, height: 1000 });
  await pg3.goto('file:///' + FILE.replace(/\\/g, '/')); await pg3.waitForSelector('.ams-card'); await sleep(1500);
  await pg3.click('.ams-card[data-sid="S01"]'); await sleep(200);
  ok('reduced-motion: selection works', (await pg3.evaluate(() => DASHBOARD_TEST.state.scenario)) === 'S01' && (await pg3.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)));

  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
