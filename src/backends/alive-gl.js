/**
 * alive-gl.js — a WebGL implementation of the Canvas2D subset the alive entity's field layers use.
 *
 * Why: browsers that raster Canvas2D on the CPU (Firefox on Linux, even with gfx.canvas.accelerated
 * forced) ran the alive 2D scene at ~11 fps at 3840x2400 while WebGL ran 60 (S234, Radeon 890M).
 * The field code (grid, stars, haze, motes, mesh, bokeh, sphere, lens, pulses, orbits, fx) keeps its
 * exact draw calls; this object stands in for `ctx` and batches them into a few WebGL draws.
 *
 * Supported: setTransform/save/restore/translate/rotate/scale, globalAlpha, fillStyle/strokeStyle
 * ('#rrggbb', 'rgba()', or a radial gradient centered at r0=0), lineWidth, globalCompositeOperation
 * ('source-over' | 'lighter'), beginPath/moveTo/lineTo/closePath/arc/ellipse, fill() of full circles
 * and ellipses, stroke() of any path, fillRect, createRadialGradient, a Path2D recorder (.Path2D), and
 * drawTexture() for a pre-rendered canvas (the face). Not supported (unused by the field layers):
 * clip, line dash, polygon fill, caps/joins beyond miter. Blending math matches Canvas2D 'lighter'
 * (src*alpha + dst) and 'source-over' in the same 8-bit sRGB space, so the look is unchanged.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {Object|null} ctx-like object, or null when WebGL is unavailable
 */
const TAU = Math.PI * 2;
const VS = `
attribute vec2 aPos; attribute vec2 aG; attribute vec4 aCol; attribute vec3 aP;
uniform vec2 uRes;
varying vec2 vG; varying vec4 vCol; varying vec3 vP;
void main(){ vG=aG; vCol=aCol; vP=aP; vec2 c=aPos/uRes*2.0-1.0; gl_Position=vec4(c.x,-c.y,0.0,1.0); }`;
// modes (vP.x): 0 radial gradient LUT row vP.y · 1 AA disc (vP.z = radius px) · 2 AA band (vG.x = edge, vP.z = half-extent px) · 3 premultiplied texture
const FS = `
precision mediump float;
varying vec2 vG; varying vec4 vCol; varying vec3 vP;
uniform sampler2D uLut; uniform float uRows; uniform sampler2D uTex;
void main(){
  float m=vP.x;
  if(m<0.5){ float r=min(length(vG),1.0); vec4 c=texture2D(uLut,vec2(r*(255.0/256.0)+0.5/256.0,(vP.y+0.5)/uRows)); gl_FragColor=vec4(c.rgb,c.a*vCol.a); }
  else if(m<1.5){ float a=clamp((1.0-length(vG))*vP.z+0.5,0.0,1.0); gl_FragColor=vec4(vCol.rgb,vCol.a*a); }
  else if(m<2.5){ float a=clamp(vG.x-abs(vG.y)*vP.z,0.0,1.0); gl_FragColor=vec4(vCol.rgb,vCol.a*a); }
  else { gl_FragColor=texture2D(uTex,vG)*vCol.a; }
}`;
const FLOATS = 11; // pos2 g2 col4 p3
const LUT_W = 256, LUT_ROWS = 64;

function parseColor(s, cache) {
  let c = cache.get(s);
  if (c) return c;
  if (s[0] === '#') { const n = parseInt(s.slice(1, 7), 16); c = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1]; }
  else { const m = s.match(/[\d.]+/g) || [0, 0, 0, 1]; c = [m[0] / 255, m[1] / 255, m[2] / 255, m[3] == null ? 1 : +m[3]]; }
  if (cache.size > 512) cache.clear();
  cache.set(s, c);
  return c;
}

class RecPath {
  constructor() { this.subs = []; this.cur = null; }
  moveTo(x, y) {
    const c = this.cur;
    if (c && !c.ell && c.pts.length && Math.abs(c.pts[c.pts.length - 2] - x) < 1e-6 && Math.abs(c.pts[c.pts.length - 1] - y) < 1e-6) return; // coalesce joints
    this.cur = { pts: [x, y], closed: false }; this.subs.push(this.cur);
  }
  lineTo(x, y) { if (!this.cur || this.cur.ell) this.moveTo(x, y); else this.cur.pts.push(x, y); }
  closePath() { if (this.cur && !this.cur.ell) this.cur.closed = true; }
  ellipse(x, y, rx, ry, rot, a0, a1, ccw) { this.cur = { ell: [x, y, rx, ry, rot, a0, a1, !!ccw] }; this.subs.push(this.cur); this.cur = null; }
  arc(x, y, r, a0, a1, ccw) { this.ellipse(x, y, r, r, 0, a0, a1, ccw); }
}

export function createGLContext2D(canvas) {
  const opts = { alpha: false, antialias: false, premultipliedAlpha: false, depth: false, stencil: false, powerPreference: 'high-performance' };
  const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  try { gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); } catch (e) { console.warn('[alive-gl]', e.message); return null; }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('[alive-gl] link failed'); return null; }
  gl.useProgram(prog);
  const loc = (n) => gl.getAttribLocation(prog, n), uni = (n) => gl.getUniformLocation(prog, n);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  const B = FLOATS * 4;
  [['aPos', 2, 0], ['aG', 2, 8], ['aCol', 4, 16], ['aP', 3, 32]].forEach(([n, size, off]) => { const l = loc(n); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, B, off); });
  const uRes = uni('uRes');
  gl.uniform1f(uni('uRows'), LUT_ROWS);
  gl.uniform1i(uni('uLut'), 0);
  gl.uniform1i(uni('uTex'), 1);
  const mkTex = (unit) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
  const lutTex = mkTex(0);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, LUT_W, LUT_ROWS, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const faceTex = mkTex(1);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);

  // ---- gradients -> LUT rows (same-rgb gradients are normalized so a per-frame alpha change reuses the row)
  const rows = new Map(); let nextRow = 0;
  const colorCache = new Map();
  function lutRow(grad) {
    const st = grad.stops.map(([o, c]) => [o, parseColor(c, colorCache)]).sort((a, b) => a[0] - b[0]);
    const same = st.every(([, c]) => c[0] === st[0][1][0] && c[1] === st[0][1][1] && c[2] === st[0][1][2]);
    const maxA = same ? Math.max(1e-6, ...st.map(([, c]) => c[3])) : 1;
    const key = st.map(([o, c]) => `${o.toFixed(3)}:${c[0].toFixed(3)},${c[1].toFixed(3)},${c[2].toFixed(3)},${(c[3] / maxA).toFixed(3)}`).join('|');
    let row = rows.get(key);
    if (row == null) {
      row = nextRow < LUT_ROWS ? nextRow++ : LUT_ROWS - 1;
      if (rows.size >= LUT_ROWS * 4) rows.clear();
      rows.set(key, row);
      const px = new Uint8Array(LUT_W * 4);
      for (let i = 0; i < LUT_W; i++) {
        const t = i / (LUT_W - 1);
        let k = 0; while (k < st.length - 1 && st[k + 1][0] < t) k++;
        const [o0, c0] = st[k], [o1, c1] = st[Math.min(k + 1, st.length - 1)];
        const f = o1 > o0 ? Math.min(1, Math.max(0, (t - o0) / (o1 - o0))) : 0;
        for (let j = 0; j < 4; j++) { let v = c0[j] + (c1[j] - c0[j]) * f; if (j === 3) v /= maxA; px[i * 4 + j] = Math.round(Math.min(1, Math.max(0, v)) * 255); }
      }
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, lutTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, row, LUT_W, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    }
    return { row, alpha: maxA };
  }

  // ---- vertex stream + batches (a batch = contiguous verts sharing blend + texture)
  let buf = new Float32Array(FLOATS * 6 * 4096), n = 0; // n = vertex count
  const batches = []; let batch = null;
  function need(v) { if ((n + v) * FLOATS > buf.length) { const nb = new Float32Array(Math.max(buf.length * 2, (n + v) * FLOATS)); nb.set(buf.subarray(0, n * FLOATS)); buf = nb; } }
  function setBatch(blend, tex) { if (!batch || batch.blend !== blend || batch.tex !== tex) { batch = { blend, tex, start: n, count: 0 }; batches.push(batch); } }
  function vert(x, y, gx, gy, c, a, m, row, aa) { const o = n * FLOATS; buf[o] = x; buf[o + 1] = y; buf[o + 2] = gx; buf[o + 3] = gy; buf[o + 4] = c[0]; buf[o + 5] = c[1]; buf[o + 6] = c[2]; buf[o + 7] = a; buf[o + 8] = m; buf[o + 9] = row; buf[o + 10] = aa; n++; batch.count++; }
  // quad from 4 corners, each [x, y, gx, gy], in order around
  function quad(p, c, a, m, row, aa) { need(6); for (const i of [0, 1, 2, 0, 2, 3]) vert(p[i][0], p[i][1], p[i][2], p[i][3], c, a, m, row, aa); }

  // ---- state
  let M = [1, 0, 0, 1, 0, 0]; const stack = [];
  const S = { globalAlpha: 1, fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, globalCompositeOperation: 'source-over', lineCap: 'butt', lineJoin: 'miter', lineDashOffset: 0 };
  let path = new RecPath();
  const tx = (x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
  const mscale = () => Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2])) || 1;
  const blendMode = () => (S.globalCompositeOperation === 'lighter' ? 'add' : 'over');

  function ellipsePoints(e, closeFull) {
    const [x, y, rx, ry, rot, a0, a1Raw, ccw] = e;
    let a1 = a1Raw, span = a1 - a0;
    if (ccw) { span = a0 - a1; if (span < 0) span += TAU; span = -Math.min(span, TAU); } else { if (span < 0) span += TAU; span = Math.min(span, TAU); }
    const full = Math.abs(Math.abs(span) - TAU) < 1e-4 || (a1Raw - a0 >= TAU - 1e-6);
    if (full && !ccw) span = TAU;
    const rpx = Math.max(rx, ry) * mscale();
    const segs = Math.max(8, Math.min(256, Math.ceil(Math.abs(span) * rpx / 4)));
    const cr = Math.cos(rot), sr = Math.sin(rot), pts = [];
    for (let i = 0; i <= segs; i++) { const t = a0 + span * i / segs, ex = rx * Math.cos(t), ey = ry * Math.sin(t); pts.push(x + ex * cr - ey * sr, y + ex * sr + ey * cr); }
    return { pts, closed: full && closeFull };
  }

  // thick AA polyline with miter joins (continuous strip: no double-brightness at joints under 'lighter')
  function strokePts(dev, closed, w, c, a) {
    let np = dev.length / 2; if (np < 2) return;
    if (w < 1) { a *= w; w = 1; }
    const hw = w / 2 + 1, edge = w / 2 + .5;
    const P = dev, nx = new Float32Array(np), ny = new Float32Array(np), ml = new Float32Array(np);
    const seg = (i) => { const j = (i + 1) % np, dx = P[j * 2] - P[i * 2], dy = P[j * 2 + 1] - P[i * 2 + 1], L = Math.hypot(dx, dy) || 1; return [-dy / L, dx / L]; };
    const segN = []; const last = closed ? np : np - 1;
    for (let i = 0; i < last; i++) segN.push(seg(i));
    for (let i = 0; i < np; i++) {
      const prev = i > 0 ? segN[i - 1] : closed ? segN[last - 1] : null, next = i < last ? segN[i] : closed ? segN[0] : null;
      let vx, vy, m = 1;
      if (prev && next) { vx = prev[0] + next[0]; vy = prev[1] + next[1]; const L = Math.hypot(vx, vy); if (L < 1e-3) { vx = next[0]; vy = next[1]; } else { vx /= L; vy /= L; m = Math.min(4, 1 / Math.max(.25, vx * next[0] + vy * next[1])); } }
      else { const s = prev || next; vx = s[0]; vy = s[1]; }
      nx[i] = vx; ny[i] = vy; ml[i] = m * hw;
    }
    need(6 * last);
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % np, x0 = P[i * 2], y0 = P[i * 2 + 1], x1 = P[j * 2], y1 = P[j * 2 + 1];
      if (x0 === x1 && y0 === y1) continue;
      const q = [[x0 + nx[i] * ml[i], y0 + ny[i] * ml[i], edge, 1], [x1 + nx[j] * ml[j], y1 + ny[j] * ml[j], edge, 1],
        [x1 - nx[j] * ml[j], y1 - ny[j] * ml[j], edge, -1], [x0 - nx[i] * ml[i], y0 - ny[i] * ml[i], edge, -1]];
      for (const k of [0, 1, 2, 0, 2, 3]) vert(q[k][0], q[k][1], q[k][2], q[k][3], c, a, 2, 0, hw);
    }
  }

  function doStroke(p, userSpace) {
    const style = S.strokeStyle; if (typeof style !== 'string') return;
    const col = parseColor(style, colorCache), a = S.globalAlpha * col[3]; if (a <= 0) return;
    setBatch(blendMode(), null);
    const w = S.lineWidth * mscale();
    for (const sp of p.subs) {
      let pts, closed;
      if (sp.ell) { const r = ellipsePoints(sp.ell, true); pts = r.pts; closed = r.closed; if (closed) pts.length -= 2; }
      else { pts = sp.pts; closed = sp.closed; }
      const dev = new Array(pts.length);
      for (let i = 0; i < pts.length; i += 2) { const q = userSpace ? tx(pts[i], pts[i + 1]) : [pts[i], pts[i + 1]]; dev[i] = q[0]; dev[i + 1] = q[1]; }
      strokePts(dev, closed, w, col, a);
    }
  }

  const ctx = {
    canvas,
    get globalAlpha() { return S.globalAlpha; }, set globalAlpha(v) { S.globalAlpha = +v; },
    get fillStyle() { return S.fillStyle; }, set fillStyle(v) { S.fillStyle = v; },
    get strokeStyle() { return S.strokeStyle; }, set strokeStyle(v) { S.strokeStyle = v; },
    get lineWidth() { return S.lineWidth; }, set lineWidth(v) { S.lineWidth = +v; },
    get globalCompositeOperation() { return S.globalCompositeOperation; }, set globalCompositeOperation(v) { S.globalCompositeOperation = v; },
    get lineCap() { return S.lineCap; }, set lineCap(v) { S.lineCap = v; },
    get lineJoin() { return S.lineJoin; }, set lineJoin(v) { S.lineJoin = v; },
    get lineDashOffset() { return S.lineDashOffset; }, set lineDashOffset(v) { S.lineDashOffset = v; },
    setLineDash() {},
    setTransform(a, b, c, d, e, f) { M = [a, b, c, d, e, f]; },
    save() { stack.push([M.slice(), Object.assign({}, S)]); },
    restore() { const s = stack.pop(); if (s) { M = s[0]; Object.assign(S, s[1]); } },
    translate(x, y) { M[4] += M[0] * x + M[2] * y; M[5] += M[1] * x + M[3] * y; },
    scale(x, y) { M[0] *= x; M[1] *= x; M[2] *= y; M[3] *= y; },
    rotate(t) { const c = Math.cos(t), s = Math.sin(t), [a, b, cc, d] = M; M[0] = a * c + cc * s; M[1] = b * c + d * s; M[2] = -a * s + cc * c; M[3] = -b * s + d * c; },
    beginPath() { path = new RecPath(); },
    // the current path stores device coordinates (Canvas2D applies the CTM when the path is built)
    moveTo(x, y) { const q = tx(x, y); path.moveTo(q[0], q[1]); },
    lineTo(x, y) { const q = tx(x, y); path.lineTo(q[0], q[1]); },
    closePath() { path.closePath(); },
    arc(x, y, r, a0, a1, ccw) { this.ellipse(x, y, r, r, 0, a0, a1, ccw); },
    ellipse(x, y, rx, ry, rot, a0, a1, ccw) { path.subs.push({ ell: [x, y, rx, ry, rot, a0, a1, !!ccw], M: M.slice() }); path.cur = null; },
    stroke(p) {
      if (p instanceof RecPath) { doStroke(p, true); return; }
      // current path: points are already device space; ellipses carry their build-time matrix
      const saved = M;
      const devPath = new RecPath();
      for (const sp of path.subs) {
        if (sp.ell) { M = sp.M; const r = ellipsePoints(sp.ell, true); const pts = r.pts; if (r.closed) pts.length -= 2; const dev = []; for (let i = 0; i < pts.length; i += 2) dev.push(...tx(pts[i], pts[i + 1])); devPath.subs.push({ pts: dev, closed: r.closed }); M = saved; }
        else devPath.subs.push(sp);
      }
      doStroke(devPath, false);
    },
    fill() {
      const style = S.fillStyle, grad = typeof style === 'object' && style && style.stops;
      const solid = !grad ? parseColor(style, colorCache) : null;
      const saved = M;
      for (const sp of path.subs) {
        if (!sp.ell) continue; // polygon fill is not used by the field layers
        M = sp.M;
        const [x, y, rx, ry, rot] = sp.ell, cr = Math.cos(rot), sr = Math.sin(rot);
        const corner = (u, v) => { const ux = x + rx * u * cr - ry * v * sr, uy = y + rx * u * sr + ry * v * cr, d = tx(ux, uy); return [d[0], d[1], ux, uy]; };
        const pts = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
        setBatch(blendMode(), null);
        if (grad) {
          const { row, alpha } = lutRow(style), R = style.r1 || 1;
          quad(pts.map(p => [p[0], p[1], (p[2] - style.x1) / R, (p[3] - style.y1) / R]), [1, 1, 1], S.globalAlpha * alpha, 0, row, 0);
        } else {
          let rpx = Math.min(rx, ry) * mscale(), a = S.globalAlpha * solid[3];
          let grow = 1; if (rpx < .75) { a *= (rpx / .75) * (rpx / .75); grow = .75 / Math.max(1e-3, rpx); rpx = .75; }
          const g = grow === 1 ? pts : [corner(-grow, -grow), corner(grow, -grow), corner(grow, grow), corner(-grow, grow)];
          quad(g.map((p, i) => [p[0], p[1], [-1, 1, 1, -1][i], [-1, -1, 1, 1][i]]), solid, a, 1, 0, rpx);
        }
      }
      M = saved;
    },
    fillRect(x, y, w, h) {
      const style = S.fillStyle, grad = typeof style === 'object' && style && style.stops;
      const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([ux, uy]) => { const d = tx(ux, uy); return [d[0], d[1], ux, uy]; });
      setBatch(blendMode(), null);
      if (grad) { const { row, alpha } = lutRow(style), R = style.r1 || 1; quad(pts.map(p => [p[0], p[1], (p[2] - style.x1) / R, (p[3] - style.y1) / R]), [1, 1, 1], S.globalAlpha * alpha, 0, row, 0); }
      else { const c = parseColor(style, colorCache); quad(pts.map(p => [p[0], p[1], 1e4, 0]), c, S.globalAlpha * c[3], 2, 0, 1); }
    },
    clearRect() {},
    createRadialGradient(x0, y0, r0, x1, y1, r1) { return { x1, y1, r1, stops: [], addColorStop(o, c) { this.stops.push([o, c]); } }; },
    /** Draw a canvas (premultiplied upload) as a textured quad in device pixels. One per frame (the face). */
    drawTexture(src, dx, dy, dw, dh) {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, faceTex);
      pendingTex = src;
      setBatch('pre', 'face');
      quad([[dx, dy, 0, 0], [dx + dw, dy, 1, 0], [dx + dw, dy + dh, 1, 1], [dx, dy + dh, 0, 1]], [1, 1, 1], 1, 3, 0, 0);
    },
    Path2D: RecPath,
    beginFrame() { n = 0; batches.length = 0; batch = null; M = [1, 0, 0, 1, 0, 0]; stack.length = 0; S.globalAlpha = 1; S.globalCompositeOperation = 'source-over'; },
    endFrame() {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      if (pendingTex) {
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, faceTex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pendingTex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        pendingTex = null;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, n * FLOATS), gl.STREAM_DRAW);
      for (const b of batches) {
        if (!b.count) continue;
        if (b.blend === 'add') gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        else if (b.blend === 'pre') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.TRIANGLES, b.start, b.count);
      }
    },
    isContextLost() { return gl.isContextLost(); },
    dispose() { const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); },
  };
  let pendingTex = null;
  return ctx;
}
