'use strict';
// Zarah angin beranimasi (jejak pendek) dan anak panah statik (angin untuk gerakan dikurangkan, arah ombak).
// Kedudukan dalam unit Mercator (0..1) supaya kekal tepat secara geografi semasa zum.
(function () {
  const NS = (window.FamaCuaca = window.FamaCuaca || {});
  const I = window.FamaInterp;
  const K = 5; // panjang jejak (kedudukan)
  const N_MIN = 600;
  const N_MAKS = 3500;
  const KELAJUAN_PX = 0.06; // piksel setiap (km/j) setiap bingkai; pemalar visual

  // bilinear pantas tanpa peruntukan; NaN jika mana-mana penjuru hilang
  function sampel(arr, nx, ny, fx, fy) {
    const x0 = Math.min(Math.floor(fx), nx - 2);
    const y0 = Math.min(Math.floor(fy), ny - 2);
    const tx = fx - x0;
    const ty = fy - y0;
    const a = arr[y0 * nx + x0];
    const b = arr[y0 * nx + x0 + 1];
    const c = arr[(y0 + 1) * nx + x0];
    const d = arr[(y0 + 1) * nx + x0 + 1];
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  }

  const pxMerc = (map) => 1 / (512 * Math.pow(2, map.getZoom()));

  class ParticleSystem {
    constructor() {
      this.medan = null; // {nx, ny, bbox, u, v}
      this.px = new Float32Array(N_MAKS);
      this.py = new Float32Array(N_MAKS);
      this.umur = new Uint16Array(N_MAKS);
      this.maks = new Uint16Array(N_MAKS);
      this.jejak = new Float32Array(N_MAKS * K * 2);
      this.kepala = 0;
      this.bucu = new Float32Array(N_MAKS * (K - 1) * 2 * 3);
      this.n = N_MIN;
      this.had = N_MAKS;
      this.denyutan = 0;
      this.masaLalu = 0;
      this.tingkap = [];
      this.rendah = 0;
      this.mulaiSemua = true;
    }
    setMedan(m) {
      this.medan = m;
    }
    bilangan() {
      return this.n;
    }
    _lahir(i, r) {
      const x = r.x0 + Math.random() * (r.x1 - r.x0);
      const y = r.y0 + Math.random() * (r.y1 - r.y0);
      this.px[i] = x;
      this.py[i] = y;
      this.umur[i] = 0;
      this.maks[i] = 30 + Math.floor(Math.random() * 60);
      for (let k = 0; k < K; k++) {
        this.jejak[(i * K + k) * 2] = x;
        this.jejak[(i * K + k) * 2 + 1] = y;
      }
    }
    _kawasan(map) {
      const m = this.medan;
      const b = map.getBounds();
      const lonA = Math.max(m.bbox.lonMin, b.getWest());
      const lonB = Math.min(m.bbox.lonMax, b.getEast());
      const latA = Math.max(m.bbox.latMin, b.getSouth());
      const latB = Math.min(m.bbox.latMax, b.getNorth());
      if (lonA >= lonB || latA >= latB) return null;
      return {
        x0: I.mercatorX(lonA),
        x1: I.mercatorX(lonB),
        y0: I.mercatorY(latB),
        y1: I.mercatorY(latA),
      };
    }
    _tadbir(masa, map) {
      // Had zarah ikut luas tetingkap peta, dan pelaras ikut masa bingkai purata.
      const c = map.getContainer();
      this.had = Math.max(
        N_MIN,
        Math.min(N_MAKS, Math.round((c.clientWidth * c.clientHeight) / 600)),
      );
      if (this.n > this.had) this.n = this.had;
      if (this.masaLalu) {
        this.tingkap.push(masa - this.masaLalu);
        if (this.tingkap.length > 30) this.tingkap.shift();
        if (this.tingkap.length === 30 && this.denyutan % 30 === 0) {
          const purata = this.tingkap.reduce((a, x) => a + x, 0) / 30;
          if (purata > 24) {
            this.n = Math.max(N_MIN, Math.round(this.n * 0.8));
            this.rendah = 0;
          } else if (purata < 14) {
            this.rendah += 30;
            if (this.rendah >= 120) {
              this.n = Math.min(this.had, Math.round(this.n * 1.1));
              this.rendah = 0;
            }
          } else this.rendah = 0;
        }
      }
      this.masaLalu = masa;
    }
    // Dipanggil oleh GarisLayer pada setiap render: maju satu langkah dan pulangkan bucu.
    isiBucu(map) {
      const m = this.medan;
      if (!m) return { data: this.bucu, bilangan: 0 };
      if (document.hidden) {
        this.masaLalu = 0;
        return { data: this.bucu, bilangan: 0 };
      }
      this._tadbir(performance.now(), map);
      const r = this._kawasan(map);
      if (!r) {
        map.triggerRepaint();
        return { data: this.bucu, bilangan: 0 };
      }
      const f = KELAJUAN_PX * pxMerc(map);
      const { nx, ny, bbox } = m;
      const skx = (nx - 1) / (bbox.lonMax - bbox.lonMin);
      const sky = (ny - 1) / (bbox.latMax - bbox.latMin);
      this.kepala = (this.kepala + 1) % K;
      let o = 0;
      const bu = this.bucu;
      for (let i = 0; i < this.n; i++) {
        if (this.mulaiSemua || this.umur[i] >= this.maks[i]) this._lahir(i, r);
        let x = this.px[i];
        let y = this.py[i];
        const lon = (x - 0.5) * 360;
        const lat = I.latDariMercatorY(y);
        const fx = (lon - bbox.lonMin) * skx;
        const fy = (lat - bbox.latMin) * sky;
        let laju = 0;
        if (fx >= 0 && fx <= nx - 1 && fy >= 0 && fy <= ny - 1) {
          const u = sampel(m.u, nx, ny, fx, fy);
          const v = sampel(m.v, nx, ny, fx, fy);
          if (u === u && v === v) {
            x += u * f;
            y -= v * f;
            laju = Math.hypot(u, v);
          } else this.umur[i] = this.maks[i];
        } else this.umur[i] = this.maks[i];
        this.px[i] = x;
        this.py[i] = y;
        this.umur[i]++;
        this.jejak[(i * K + this.kepala) * 2] = x;
        this.jejak[(i * K + this.kepala) * 2 + 1] = y;
        const a = 0.8 * Math.min(1, laju / 40);
        if (a < 0.02) continue;
        for (let j = 0; j < K - 1; j++) {
          const A = (this.kepala - j + K) % K;
          const B = (this.kepala - j - 1 + K) % K;
          bu[o++] = this.jejak[(i * K + A) * 2];
          bu[o++] = this.jejak[(i * K + A) * 2 + 1];
          bu[o++] = a * (1 - j / (K - 1));
          bu[o++] = this.jejak[(i * K + B) * 2];
          bu[o++] = this.jejak[(i * K + B) * 2 + 1];
          bu[o++] = a * (1 - (j + 1) / (K - 1));
        }
      }
      this.mulaiSemua = false;
      this.denyutan++;
      map.triggerRepaint();
      return { data: bu, bilangan: o / 3 };
    }
  }

  // Anak panah statik pada kekisi 1.0 darjah. arah(lat, lon) -> {ux, uy, panjangPx, ada} atau null.
  function kekisi(map, bbox, panjangPxFn, arahFn) {
    const px = pxMerc(map);
    const titik = [];
    for (let lat = Math.ceil(bbox.latMin); lat <= bbox.latMax; lat += 1) {
      for (let lon = Math.ceil(bbox.lonMin); lon <= bbox.lonMax; lon += 1) {
        const d = arahFn(lat, lon);
        if (!d) continue;
        titik.push({
          x: I.mercatorX(lon),
          y: I.mercatorY(lat),
          ux: d.ux,
          uy: d.uy,
          len: panjangPxFn(d) * px,
          alpha: 0.85,
        });
      }
    }
    const data = I.panahGaris(titik);
    return { data, bilangan: titik.length * 6 };
  }

  // Panah angin: medan {nx, ny, bbox, u, v}. Panjang 6..26 px mengikut laju (40 km/j = 18 px).
  function panahAngin(map, m) {
    return kekisi(
      map,
      m.bbox,
      (d) => Math.max(6, Math.min(26, (d.laju / 40) * 18)),
      (lat, lon) => {
        const p = I.lonlatKeGrid(m.bbox, m.nx, m.ny, lat, lon);
        if (!p) return null;
        const u = I.bilinear(m.u, m.nx, m.ny, p.fx, p.fy);
        const v = I.bilinear(m.v, m.nx, m.ny, p.fx, p.fy);
        if (u === null || v === null) return null;
        const laju = Math.hypot(u, v);
        if (laju < 0.5) return null;
        return { ux: u / laju, uy: -v / laju, laju };
      },
    );
  }

  // Panah ombak: medan {nx, ny, bbox, tinggi, arah}; hanya sel laut. Arah rambatan = arah sumber + 180.
  function panahOmbak(map, m) {
    return kekisi(
      map,
      m.bbox,
      () => 14,
      (lat, lon) => {
        const p = I.lonlatKeGrid(m.bbox, m.nx, m.ny, lat, lon);
        if (!p) return null;
        const h = I.bilinear(m.tinggi, m.nx, m.ny, p.fx, p.fy, { renormalisasi: true });
        if (h === null) return null;
        // arah: purata vektor (elak lompatan 359/0) pada sel terdekat yang sah
        const x0 = Math.round(p.fx);
        const y0 = Math.round(p.fy);
        const dir = m.arah[y0 * m.nx + x0];
        if (!(dir === dir)) return null;
        const th = ((dir + 180) * Math.PI) / 180;
        return { ux: Math.sin(th), uy: -Math.cos(th), laju: 0 };
      },
    );
  }

  NS.zarah = { ParticleSystem, panahAngin, panahOmbak };
})();
