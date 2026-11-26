/* ===== Panel EWS (AI) di tab Pemantauan =====
   Tiga paparan: Amaran Rasmi (MET Malaysia & JPS), Risiko Banjir (JPS), Risiko Sentimen (Muse AI).
   Data amaran dan banjir dirender oleh app.js (renderMetAlerts, renderFloodCard). Sentimen dimuat
   melalui FamaMuse (muse-data.js) yang dikongsi dengan tab Intervensi. Menukar tab tidak memuat data. */
const EWS_TABS = {
  amaran: { tab: 'ewsTabAmaran', view: 'ewsViewAmaran' },
  banjir: { tab: 'ewsTabBanjir', view: 'ewsViewBanjir' },
  sentimen: { tab: 'ewsTabSentimen', view: 'ewsViewSentimen' },
};
const EWS_URUTAN = ['amaran', 'banjir', 'sentimen'];
const EWS_BAND = {
  Merah: { cls: 'bad', rank: 0 },
  Kuning: { cls: 'warn', rank: 1 },
  Hijau: { cls: 'ok', rank: 2 },
};
const EWS_BULAN = [
  'Jan',
  'Feb',
  'Mac',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Ogo',
  'Sep',
  'Okt',
  'Nov',
  'Dis',
];
const EWS_STALE_MS = 36 * 3600e3;
let museEwsState = { status: 'memuat', data: null };

function ewsTarikh(ds, penuh) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ds || ''));
  if (!m) return String(ds || '-');
  return `${Number(m[3])} ${EWS_BULAN[Number(m[2]) - 1] || ''}${penuh ? ' ' + m[1] : ''}`;
}
function ewsTajuk(nota) {
  let x = String(nota || '')
    .replace(/\s+/g, ' ')
    .trim();
  const m = x.search(/;|\.(?=\s|$)/);
  if (m > 0) x = x.slice(0, m);
  if (x.length > 90) x = x.slice(0, 89).replace(/[\s,:;.\-–—]+$/, '') + '…';
  return x.charAt(0).toUpperCase() + x.slice(1);
}
// satu item bagi setiap komoditi (rekod terbaharu); disusun ikut tahap, kenaikan risiko, label
function ewsMuseItems(d) {
  const sah = (r) => Object.prototype.hasOwnProperty.call(EWS_BAND, r.band);
  const rank = (r) => (sah(r) ? EWS_BAND[r.band].rank : 3);
  const baru = (a, b) =>
    a.tarikh < b.tarikh ? 1 : a.tarikh > b.tarikh ? -1 : (b.id || 0) - (a.id || 0);
  const m = new Map();
  (d.rekod || []).forEach((r) => {
    if (!r || !r.komoditiId) return;
    const c = m.get(r.komoditiId);
    if (!c || baru(r, c) < 0) m.set(r.komoditiId, r);
  });
  const naik = (r) =>
    Number.isFinite(r.risikoSemasa) ? r.risikoSemasa - (r.risikoSebelum || 0) : 0;
  return [...m.values()].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      naik(b) - naik(a) ||
      String(a.komoditiLabel).localeCompare(String(b.komoditiLabel), 'ms'),
  );
}
function ewsSentRow(r) {
  const sah = Object.prototype.hasOwnProperty.call(EWS_BAND, r.band);
  const cls = sah ? EWS_BAND[r.band].cls : 'grey';
  let chip;
  if (sah && Number.isFinite(r.risikoSemasa)) {
    const ch =
      r.risikoSemasa - (Number.isFinite(r.risikoSebelum) ? r.risikoSebelum : r.risikoSemasa);
    const arr = ch > 0 ? '↑' : ch < 0 ? '↓' : '→';
    const dir = ch > 0 ? 'up' : ch < 0 ? 'down' : 'flat';
    chip = `<span class="ews-chip ${cls}">${esc(r.band)} <span class="ews-tr ${dir}">${esc(r.risikoSemasa)} ${arr} ${ch > 0 ? '+' : ''}${esc(ch)}</span></span>`;
  } else {
    chip = '<span class="ews-chip grey">Tahap tidak diketahui</span>';
  }
  const idx = Number.isFinite(r.indeksSentimen)
    ? `<span>Indeks sentimen <b>${r.indeksSentimen > 0 ? '+' : ''}${esc(r.indeksSentimen)}</b></span>`
    : '';
  const samp = Number.isFinite(r.bilSampel) ? `<span>Sampel <b>${esc(r.bilSampel)}</b></span>` : '';
  const t = ewsTajuk(r.nota);
  return `<li class="ews-sent-row" data-band="${esc(String(r.band || '').toLowerCase())}"><span class="ews-sent-top"><b class="ews-sent-n" title="${esc(r.komoditiLabel)}">${esc(r.komoditiLabel)}</b>${chip}</span>${t ? `<span class="ews-sent-hl" title="${esc(t)}">${esc(t)}</span>` : ''}<span class="ews-sent-bot">${idx}${samp}<span>${esc(ewsTarikh(r.tarikh))}</span></span></li>`;
}
function ewsMuseSubtajuk() {
  const s = museEwsState;
  if (s.status === 'memuat') return 'Memuatkan data sentimen…';
  if (s.status === 'ready') return 'Dikemas kini ' + cuacaMasa(s.data.fetchedAt);
  return 'Data sentimen tidak tersedia';
}
function renderMuseEws() {
  const body = $('ewsMuseBody');
  const chips = $('ewsMuseChips');
  if (!body || !chips) return;
  chips.innerHTML =
    '<span class="ews-chip grey">Kelompok harian</span><span class="ews-chip">Sumber: AI Muse · db-curated (Google Drive)</span>';
  const s = museEwsState;
  if (s.status === 'memuat') {
    body.innerHTML = '<div class="ews-sent-state" aria-busy="true">Memuatkan data sentimen…</div>';
    return;
  }
  if (s.status === 'file') {
    body.innerHTML =
      '<div class="ews-sent-state bad">Data sentimen memerlukan pelayan (npm start)</div>';
    return;
  }
  if (s.status !== 'ready' || !s.data) {
    body.innerHTML =
      '<div class="ews-sent-state bad">Data sentimen tidak tersedia <button type="button" class="button tiny" data-act="muse-ews-retry">Cuba semula</button></div>';
    return;
  }
  const d = s.data;
  const items = ewsMuseItems(d);
  const stale =
    d.latestDate && Date.now() - Date.parse(d.latestDate + 'T00:00:00+08:00') > EWS_STALE_MS;
  let h = '';
  if (stale)
    h += `<div class="ews-sent-warn">Data AI Muse lapuk: tarikh data terakhir ${esc(ewsTarikh(d.latestDate, true))}</div>`;
  if (d.status === 'sebahagian')
    h +=
      '<div class="ews-sent-warn">Sebahagian folder Drive gagal dimuat turun; data mungkin tidak lengkap.</div>';
  if (!items.length) {
    body.innerHTML = h + '<div class="ews-sent-state">Tiada isyarat sentimen</div>';
    return;
  }
  const bil = (b) => items.filter((r) => r.band === b).length;
  const terburuk = ['Merah', 'Kuning', 'Hijau'].find((b) => bil(b) > 0);
  const ringkas = terburuk
    ? `<span class="ews-sent-level"><span class="ews-sent-lbl">Tahap keseluruhan</span><span class="ews-chip ${EWS_BAND[terburuk].cls}">${esc(terburuk)}</span></span>`
    : '';
  const kiraan = ['Merah', 'Kuning', 'Hijau'].map((b) => `${bil(b)} ${b}`).join(' · ');
  h += `<div class="ews-sent-sum">${ringkas}<span class="ews-sent-count">${esc(items.length)} komoditi · ${esc(kiraan)}</span><span class="ews-sent-last">Tarikh data terakhir <b>${esc(d.latestDate ? ewsTarikh(d.latestDate, true) : '—')}</b></span></div>`;
  h += `<ul class="ews-sent-list" aria-label="Risiko sentimen mengikut komoditi (Muse AI)">${items.map(ewsSentRow).join('')}</ul>`;
  body.innerHTML = h;
}
function ewsSubtajuk() {
  const t = (id) => (($(id) || {}).textContent || '').trim();
  if (state.ewsTab === 'banjir') return t('ewsFloodNote');
  if (state.ewsTab === 'sentimen') return ewsMuseSubtajuk();
  return t('metAlertTag') || 'Amaran rasmi MET Malaysia dan JPS';
}
function renderEwsSubtajuk() {
  const el = $('ewsSubtitle');
  if (el) el.textContent = ewsSubtajuk();
}
// Menerapkan tab terpilih (state.ewsTab) ke DOM. Tiada fetch.
function renderEws() {
  if (!EWS_TABS[state.ewsTab]) state.ewsTab = 'amaran';
  EWS_URUTAN.forEach((k) => {
    const aktif = k === state.ewsTab;
    const tab = $(EWS_TABS[k].tab);
    const view = $(EWS_TABS[k].view);
    if (tab) {
      tab.setAttribute('aria-selected', aktif ? 'true' : 'false');
      tab.tabIndex = aktif ? 0 : -1;
    }
    if (view) view.hidden = !aktif;
  });
  renderEwsSubtajuk();
}
function setEwsTab(nama, opts) {
  if (!EWS_TABS[nama]) return;
  state.ewsTab = nama;
  renderEws();
  if (opts && opts.fokus) {
    const tab = $(EWS_TABS[nama].tab);
    if (tab) tab.focus();
  }
}
function ewsMuatSentimen(reuse) {
  museEwsState = { status: 'memuat', data: null };
  renderMuseEws();
  renderEwsSubtajuk();
  return FamaMuse.load(undefined, { reuse })
    .then(
      (d) => {
        museEwsState = { status: 'ready', data: d };
      },
      (e) => {
        console.warn('Data sentimen Muse tidak dapat dimuatkan', e && e.message);
        museEwsState = { status: e && e.kind === 'file' ? 'file' : 'error', data: null };
      },
    )
    .then(() => {
      renderMuseEws();
      renderEwsSubtajuk();
    });
}
function initEws() {
  const bar = $('ewsTabs');
  if (!bar) return Promise.resolve();
  bar.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-ews-tab]');
    if (b) setEwsTab(b.dataset.ewsTab);
  });
  bar.addEventListener('keydown', (ev) => {
    const b = ev.target.closest('[data-ews-tab]');
    if (!b) return;
    const i = EWS_URUTAN.indexOf(b.dataset.ewsTab);
    let j = -1;
    if (ev.key === 'ArrowRight') j = (i + 1) % EWS_URUTAN.length;
    else if (ev.key === 'ArrowLeft') j = (i - 1 + EWS_URUTAN.length) % EWS_URUTAN.length;
    else if (ev.key === 'Home') j = 0;
    else if (ev.key === 'End') j = EWS_URUTAN.length - 1;
    if (j < 0) return;
    ev.preventDefault();
    setEwsTab(EWS_URUTAN[j], { fokus: true });
  });
  document.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-act="muse-ews-retry"]')) ewsMuatSentimen(false);
  });
  // subtajuk mengikut tajuk/nota yang dikemas kini oleh renderMetAlerts dan renderFloodCard
  if (typeof MutationObserver === 'function') {
    const mo = new MutationObserver(renderEwsSubtajuk);
    ['metAlertTag', 'ewsFloodNote'].forEach((id) => {
      const el = $(id);
      if (el) mo.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }
  renderEws();
  return ewsMuatSentimen(true);
}
