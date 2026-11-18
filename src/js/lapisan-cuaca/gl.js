'use strict';
// Dua lapisan WebGL tersuai untuk MapLibre GL 4.7.1: FillLayer (imej kanvas terikat bbox) dan GarisLayer (garis dengan alfa setiap bucu).
// Matriks yang diterima render() ialah matriks Mercator (0..1) ke klip (v4; berubah pada v5, jadi versi dikunci).
(function () {
  const NS = (window.FamaCuaca = window.FamaCuaca || {});

  function kompil(gl, jenis, kod) {
    const s = gl.createShader(jenis);
    gl.shaderSource(s, kod);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const m = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(m || 'shader');
    }
    return s;
  }
  function bina(gl, vs, fs) {
    const p = gl.createProgram();
    const a = kompil(gl, gl.VERTEX_SHADER, vs);
    const b = kompil(gl, gl.FRAGMENT_SHADER, fs);
    gl.attachShader(p, a);
    gl.attachShader(p, b);
    gl.linkProgram(p);
    gl.deleteShader(a);
    gl.deleteShader(b);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const m = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error(m || 'program');
    }
    return p;
  }
  let amaranWebGL = false;
  function gagalPelayar(e) {
    if (!amaranWebGL) {
      amaranWebGL = true;
      console.warn('Lapisan cuaca: WebGL gagal dimulakan: ' + (e && e.message));
    }
    if (NS.padaTidakSokong) NS.padaTidakSokong();
  }

  // ---- FillLayer ----
  class FillLayer {
    constructor(id, bbox, kanvas) {
      this.id = id;
      this.type = 'custom';
      this.renderingMode = '2d';
      this.bbox = bbox;
      this.kanvas = kanvas || null;
      this.kotor = !!kanvas;
      this.ok = false;
    }
    onAdd(map, gl) {
      this.map = map;
      try {
        this.program = bina(
          gl,
          'attribute vec2 a_pos;attribute vec2 a_uv;uniform mat4 u_matrix;varying vec2 v_uv;' +
            'void main(){v_uv=a_uv;gl_Position=u_matrix*vec4(a_pos,0.0,1.0);}',
          'precision mediump float;varying vec2 v_uv;uniform sampler2D u_tex;' +
            'void main(){gl_FragColor=texture2D(u_tex,v_uv);}',
        );
      } catch (e) {
        gagalPelayar(e);
        this.program = null;
        return;
      }
      const b = this.bbox;
      const nw = maplibregl.MercatorCoordinate.fromLngLat([b.lonMin, b.latMax]);
      const se = maplibregl.MercatorCoordinate.fromLngLat([b.lonMax, b.latMin]);
      // x, y (Mercator), u, v (v = 0 di utara = baris pertama kanvas)
      this.verts = new Float32Array([
        nw.x,
        nw.y,
        0,
        0,
        se.x,
        nw.y,
        1,
        0,
        nw.x,
        se.y,
        0,
        1,
        se.x,
        se.y,
        1,
        1,
      ]);
      this.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, this.verts, gl.STATIC_DRAW);
      this.aPos = gl.getAttribLocation(this.program, 'a_pos');
      this.aUv = gl.getAttribLocation(this.program, 'a_uv');
      this.uMat = gl.getUniformLocation(this.program, 'u_matrix');
      this.uTex = gl.getUniformLocation(this.program, 'u_tex');
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array(4),
      );
      this.ok = true;
      this.kotor = !!this.kanvas;
    }
    setPiksel(kanvas) {
      this.kanvas = kanvas;
      this.kotor = true;
      if (this.map) this.map.triggerRepaint();
    }
    render(gl, matrix) {
      if (!this.ok) return;
      if (this.kotor && this.kanvas) {
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.kanvas);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        this.kotor = false;
      }
      gl.useProgram(this.program);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.STENCIL_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(this.uMat, false, matrix);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.uniform1i(this.uTex, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.enableVertexAttribArray(this.aPos);
      gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(this.aUv);
      gl.vertexAttribPointer(this.aUv, 2, gl.FLOAT, false, 16, 8);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(this.aPos);
      gl.disableVertexAttribArray(this.aUv);
      gl.disable(gl.BLEND);
    }
    onRemove(map, gl) {
      if (this.tex) gl.deleteTexture(this.tex);
      if (this.buf) gl.deleteBuffer(this.buf);
      if (this.program) gl.deleteProgram(this.program);
      this.tex = this.buf = this.program = null;
      this.ok = false;
      this.map = null;
    }
  }

  // ---- GarisLayer ----
  // isiBucu(map) -> {data: Float32Array [x, y, alfa]*n, bilangan} dipanggil pada setiap render (zarah/anak panah).
  class GarisLayer {
    constructor(id, isiBucu, warna) {
      this.id = id;
      this.type = 'custom';
      this.renderingMode = '2d';
      this.isiBucu = isiBucu;
      this.warna = warna || [1, 1, 1];
      this.ok = false;
      this.denyutan = 0;
    }
    onAdd(map, gl) {
      this.map = map;
      try {
        this.program = bina(
          gl,
          'attribute vec2 a_pos;attribute float a_a;uniform mat4 u_matrix;varying float v_a;' +
            'void main(){v_a=a_a;gl_Position=u_matrix*vec4(a_pos,0.0,1.0);}',
          'precision mediump float;varying float v_a;uniform vec3 u_c;' +
            'void main(){gl_FragColor=vec4(u_c*v_a,v_a);}',
        );
      } catch (e) {
        gagalPelayar(e);
        this.program = null;
        return;
      }
      this.buf = gl.createBuffer();
      this.aPos = gl.getAttribLocation(this.program, 'a_pos');
      this.aA = gl.getAttribLocation(this.program, 'a_a');
      this.uMat = gl.getUniformLocation(this.program, 'u_matrix');
      this.uC = gl.getUniformLocation(this.program, 'u_c');
      this.ok = true;
    }
    render(gl, matrix) {
      if (!this.ok) return;
      const r = this.isiBucu(this.map);
      this.denyutan++;
      if (!r || !r.bilangan) return;
      gl.useProgram(this.program);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.STENCIL_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(this.uMat, false, matrix);
      gl.uniform3fv(this.uC, this.warna);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, r.data.subarray(0, r.bilangan * 3), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.aPos);
      gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 12, 0);
      gl.enableVertexAttribArray(this.aA);
      gl.vertexAttribPointer(this.aA, 1, gl.FLOAT, false, 12, 8);
      gl.drawArrays(gl.LINES, 0, r.bilangan);
      gl.disableVertexAttribArray(this.aPos);
      gl.disableVertexAttribArray(this.aA);
      gl.disable(gl.BLEND);
    }
    onRemove(map, gl) {
      if (this.buf) gl.deleteBuffer(this.buf);
      if (this.program) gl.deleteProgram(this.program);
      this.buf = this.program = null;
      this.ok = false;
      this.map = null;
    }
  }

  NS.gl = { FillLayer, GarisLayer };
})();
