'use strict';
// Menu lapisan, legenda dan garis masa lapisan cuaca. Semua teks dibina dengan textContent (tiada innerHTML).
(function () {
  const NS = (window.FamaCuaca = window.FamaCuaca || {});
  const SVG = 'http://www.w3.org/2000/svg';
  let tandaLegenda = '';

  function el(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks !== undefined) e.textContent = teks;
    return e;
  }
  function ikon(d, penuh) {
    const s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', '0 0 16 16');
    s.setAttribute('width', '16');
    s.setAttribute('height', '16');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', penuh ? 'currentColor' : 'none');
    p.setAttribute('stroke', penuh ? 'none' : 'currentColor');
    p.setAttribute('stroke-width', '1.4');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    s.append(p);
    return s;
  }
  const $ = (id) => document.getElementById(id);

  function tutupMenuMudahAlih() {
    if (!window.matchMedia || !window.matchMedia('(max-width: 640px)').matches) return;
    const kot = $('petaKawalan');
    const btn = $('petaMenuBtn');
    if (kot) kot.classList.remove('terbuka');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function pasangMenu(menu) {
    const kot = el('div', 'cuaca-menu');
    kot.id = 'cuacaMenu';
    kot.setAttribute('role', 'group');
    kot.setAttribute('aria-label', 'Lapisan cuaca');
    const kepala = el('div', 'cuaca-menu-kepala');
    const tajuk = el('span', 'cuaca-menu-tajuk', 'Lapisan cuaca');
    const cip = el('span', 'cuaca-menu-cip');
    cip.id = 'cuacaMenuCip';
    cip.hidden = true;
    const kecil = el('button', 'cuaca-kecil');
    kecil.id = 'cuacaKecil';
    kecil.type = 'button';
    kecil.setAttribute('aria-controls', 'cuacaSenarai');
    kepala.append(tajuk, cip, kecil);
    kot.append(kepala);
    const senarai = el('div', 'cuaca-senarai');
    senarai.id = 'cuacaSenarai';
    const dalam = el('div', 'cuaca-senarai-dalam');
    senarai.append(dalam);
    kot.append(senarai);
    kepala.addEventListener('click', () => tetapKecil(!kot.classList.contains('kecil')));
    NS.LAPISAN.forEach((l) => {
      const b = el('button', 'cuaca-btn');
      b.type = 'button';
      b.setAttribute('data-lapisan', l.id);
      b.setAttribute('aria-pressed', 'false');
      b.append(ikon(l.ikon), el('span', 'cuaca-label', l.label));
      if (l.jenis === 'tindih') {
        const t = el('span', 'cuaca-tambah', '+');
        t.setAttribute('aria-hidden', 'true');
        b.append(t);
        b.title = 'Lapisan tambahan';
      }
      b.addEventListener('click', () => {
        NS.togol(l.id);
        tutupMenuMudahAlih();
      });
      dalam.append(b);
    });
    menu.append(kot);
    rujukMenu = { kot, btn: kecil, cip };
    let kecilSimpan = false;
    try {
      kecilSimpan = localStorage.getItem(KUNCI_KECIL) === '1';
    } catch {
      /* abaikan */
    }
    tetapKecil(kecilSimpan, true);
    kemas();
  }

  const KUNCI_KECIL = 'fama_lapisan_kecil';
  let rujukMenu = null;
  function tetapKecil(kecil, tanpaSimpan) {
    if (!rujukMenu) return;
    const { kot, btn } = rujukMenu;
    kot.classList.toggle('kecil', kecil);
    btn.setAttribute('aria-expanded', kecil ? 'false' : 'true');
    const label = kecil ? 'Besarkan panel lapisan' : 'Kecilkan panel lapisan';
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.replaceChildren(ikon(kecil ? 'M3.5 6 L8 10.5 L12.5 6' : 'M3.5 8 H12.5'));
    if (!tanpaSimpan) {
      try {
        localStorage.setItem(KUNCI_KECIL, kecil ? '1' : '0');
      } catch {
        /* abaikan */
      }
    }
    kemasCip();
  }
  function kemasCip() {
    if (!rujukMenu || !NS.keadaanKawalan) return;
    const { kot, cip } = rujukMenu;
    const k = NS.keadaanKawalan();
    const l = NS.LAPISAN.find((x) => x.id === k.utama);
    const teks = l ? l.label : '';
    cip.textContent = teks;
    cip.hidden = !(kot.classList.contains('kecil') && teks);
  }

  function pasangPapan(bingkai) {
    const papan = el('div', 'cuaca-papan');
    papan.id = 'cuacaPapan';
    const leg = el('div', 'cuaca-legenda');
    leg.id = 'cuacaLegenda';
    leg.setAttribute('role', 'region');
    leg.setAttribute('aria-label', 'Legenda cuaca');
    leg.hidden = true;
    leg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-w]');
      if (b && !b.disabled) NS.tetapW(Number(b.getAttribute('data-w')));
    });
    const bawah = el('div', 'cuaca-bawah');
    bawah.id = 'cuacaBawah';
    bawah.hidden = true;
    const main = el('button', 'cuaca-main');
    main.id = 'cuacaMain';
    main.type = 'button';
    main.setAttribute('aria-label', 'Main');
    main.append(ikon('M4 2.5 L13 8 L4 13.5z', true));
    main.addEventListener('click', () => (NS.keadaanKawalan().bermain ? NS.jeda() : NS.mainkan()));
    const slider = el('input', 'cuaca-slider');
    slider.id = 'cuacaSlider';
    slider.type = 'range';
    slider.min = '0';
    slider.max = '0';
    slider.step = '1';
    slider.value = '0';
    slider.setAttribute('aria-label', 'Garis masa cuaca');
    slider.addEventListener('input', () => NS.tetapSlider(Number(slider.value)));
    const masa = el('span', 'cuaca-masa');
    masa.id = 'cuacaMasa';
    const mod = el('div', 'cuaca-mod');
    mod.id = 'cuacaMod';
    mod.setAttribute('role', 'group');
    mod.setAttribute('aria-label', 'Mod garis masa');
    mod.hidden = true;
    ['ramalan', 'imbasan'].forEach((m) => {
      const b = el('button', 'cuaca-mod-btn', m === 'ramalan' ? 'Ramalan' : 'Imbasan');
      b.type = 'button';
      b.setAttribute('data-mod', m);
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => NS.tetapMod(m));
      mod.append(b);
    });
    bawah.append(main, slider, masa, mod);
    papan.append(leg, bawah);
    bingkai.append(papan);
    kemas();
  }

  function binaBarisLegenda(o, k) {
    const baris = el('div', 'cuaca-leg-baris');
    baris.setAttribute('data-lapisan', o.id);
    const kepala = el('div', 'cuaca-leg-tajuk');
    kepala.append(el('b', null, o.tajuk));
    if (o.unit) kepala.append(el('span', 'cuaca-leg-unit', o.unit));
    baris.append(kepala);
    if (o.gradien) {
      const bar = el('div', 'cuaca-legenda-bar');
      bar.style.background = o.gradien;
      baris.append(bar);
    }
    if (o.min !== null && o.min !== undefined && o.id !== 'ribut') {
      const j = el('div', 'cuaca-leg-julat');
      j.append(el('span', null, String(o.min)), el('span', null, String(o.max)));
      baris.append(j);
    }
    if (o.kelas) {
      const s = el('div', 'cuaca-leg-kelas');
      o.kelas.forEach((c) => {
        const x = el('span', 'cuaca-leg-kelas-item');
        const sw = el('i');
        sw.style.background = c.hex;
        x.append(sw, document.createTextNode(c.teks));
        s.append(x);
      });
      baris.append(s);
    }
    if (o.aras) {
      const s = el('div', 'cuaca-leg-kelas');
      o.aras.forEach(([nama, hex]) => {
        const x = el('span', 'cuaca-leg-kelas-item');
        const sw = el('i');
        sw.style.background = hex;
        x.append(sw, document.createTextNode(nama));
        s.append(x);
      });
      baris.append(s);
    }
    if (o.id === 'kumpulan') {
      const g = el('div', 'cuaca-w');
      g.setAttribute('role', 'group');
      g.setAttribute('aria-label', 'Tempoh kumpulan hujan');
      NS.OPSI_W.forEach((w) => {
        const b = el('button', 'cuaca-w-btn', w + ' j');
        b.type = 'button';
        b.setAttribute('data-w', String(w));
        b.setAttribute('aria-pressed', k.W === w ? 'true' : 'false');
        if (!k.wTersedia(w)) {
          b.disabled = true;
          b.title = 'Data tidak mencukupi';
        }
        g.append(b);
      });
      baris.append(g);
    }
    if (o.nota) baris.append(el('div', 'cuaca-leg-nota', o.nota));
    if (o.mesej) baris.append(el('div', 'cuaca-leg-mesej', o.mesej));
    baris.append(el('div', 'cuaca-leg-atr', o.atribusi));
    baris.title = [o.tajuk, o.unit, o.nota].filter(Boolean).join(' · ');
    return baris;
  }

  function kemasLegenda(k) {
    const leg = $('cuacaLegenda');
    if (!leg) return;
    const semua = NS.legendaSemua();
    const tanda =
      JSON.stringify([semua, k.mesej, k.W]) +
      [3, 12, 24, 48, 72].map((w) => (k.wTersedia(w) ? 1 : 0)).join('');
    if (tanda === tandaLegenda) return;
    tandaLegenda = tanda;
    leg.textContent = '';
    semua.forEach((o) => leg.append(binaBarisLegenda(o, k)));
    if (k.mesej) {
      const m = el('div', 'cuaca-leg-mesej cuaca-leg-global', k.mesej);
      m.setAttribute('role', 'status');
      leg.append(m);
    }
    leg.hidden = !semua.length && !k.mesej;
  }

  function kemasBawah(k) {
    const bawah = $('cuacaBawah');
    if (!bawah) return;
    bawah.hidden = !k.mod;
    if (!k.mod) return;
    const slider = $('cuacaSlider');
    const ramalan = k.mod === 'ramalan';
    const n = ramalan ? k.bilStop : k.bilBingkai;
    slider.max = String(Math.max(0, n - 1));
    slider.value = String(ramalan ? k.jam : k.bingkai);
    slider.disabled = n <= 1;
    slider.setAttribute('aria-valuetext', k.label);
    $('cuacaMasa').textContent = k.label;
    const main = $('cuacaMain');
    main.setAttribute('aria-label', k.bermain ? 'Jeda' : 'Main');
    main.textContent = '';
    main.append(
      ikon(k.bermain ? 'M3.5 2.5 h3 v11 h-3z M9.5 2.5 h3 v11 h-3z' : 'M4 2.5 L13 8 L4 13.5z', true),
    );
    const mod = $('cuacaMod');
    mod.hidden = !k.bolehPilihMod;
    mod
      .querySelectorAll('[data-mod]')
      .forEach((b) =>
        b.setAttribute('aria-pressed', b.getAttribute('data-mod') === k.mod ? 'true' : 'false'),
      );
  }

  function kemas() {
    if (!NS.keadaanKawalan) return;
    const k = NS.keadaanKawalan();
    document.querySelectorAll('#cuacaMenu [data-lapisan]').forEach((b) => {
      const id = b.getAttribute('data-lapisan');
      const tekan = id === k.utama || k.tindih.includes(id);
      b.setAttribute('aria-pressed', tekan ? 'true' : 'false');
      const sebab = k.lumpuh[id];
      b.disabled = !!sebab;
      if (sebab) b.title = sebab;
      else if (b.querySelector('.cuaca-tambah')) b.title = 'Lapisan tambahan';
      else b.removeAttribute('title');
    });
    kemasCip();
    kemasLegenda(k);
    kemasBawah(k);
  }

  NS.pasangMenu = pasangMenu;
  NS.pasangPapan = pasangPapan;
  NS.kawalan = { kemas };
})();
