// the hat's band carries a 30-cell code: 24 bits from the wallet + 6 check bits. Same rules as the page.
const crypto = require("crypto");
const P = 16, SIZE = 800, X0 = 208, Y0 = 24; // the hat sprite on the 800px picture
const ROWS = [7, 8, 9], COLS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const BORDER = [];
for (let c = 6; c <= 17; c++) { BORDER.push([6, c]); BORDER.push([10, c]); }
for (const r of [7, 8, 9]) { BORDER.push([r, 6]); BORDER.push([r, 17]); }
const WHITE = []; for (let r = 3; r <= 5; r++) for (let c = 8; c <= 15; c++) WHITE.push([r, c]);
const ACC = [255, 92, 48], ACC_L = [255, 186, 160];
const sha = s => crypto.createHash("sha256").update(s).digest();
function codeFor(wallet) {
  const h = sha(wallet), data = (h[0] << 16) | (h[1] << 8) | h[2], hex = data.toString(16).padStart(6, "0");
  const chk = sha("hat|" + hex)[0] >> 2;
  const bits = []; for (let i = 23; i >= 0; i--) bits.push((data >> i) & 1); for (let i = 5; i >= 0; i--) bits.push((chk >> i) & 1);
  return { hex, bits };
}
function bitsToCode(bits) {
  let data = 0, chk = 0; for (let i = 0; i < 24; i++) data = data * 2 + bits[i]; for (let i = 24; i < 30; i++) chk = chk * 2 + bits[i];
  const hex = data.toString(16).padStart(6, "0"); return { hex, valid: (sha("hat|" + hex)[0] >> 2) === chk };
}
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
// read the band out of an RGB buffer (w x h). Searches small shifts and scales so a little crop or resize still reads.
function readBand(buf, w, h) {
  const k = w / SIZE, kh = h / SIZE;
  const avg = (x, y, half) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let yy = Math.round(y - half); yy <= Math.round(y + half); yy++) for (let xx = Math.round(x - half); xx <= Math.round(x + half); xx++) {
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const i = (yy * w + xx) * 3; r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; n++;
    }
    return n ? [r / n, g / n, b / n] : [0, 0, 0];
  };
  let best = null;
  for (let s = 0.86; s <= 1.141; s += 0.02) for (let dy = -0.06; dy <= 0.0601; dy += 0.006) for (let dx = -0.06; dx <= 0.0601; dx += 0.006) {
    const p = P * k * s, ph = P * kh * s;
    const ox = (SIZE / 2 + (X0 - SIZE / 2) * s) * k + dx * w, oy = (Y0 * s) * kh + dy * h;
    const cell = (r, c) => avg(ox + (c + .5) * p, oy + (r + .5) * ph, Math.max(0, p * .22));
    let sc = 0; for (const [r, c] of BORDER) if (d2(cell(r, c), ACC) < 75 * 75) sc++;
    if (sc < 18) continue;
    let wsc = 0; for (const [r, c] of WHITE) { const v = cell(r, c); if (v[0] > 190 && v[1] > 185 && v[2] > 170) wsc++; }
    const total = sc + wsc * .5;
    if (!best || total > best.total) best = { total, sc, wsc, ox, oy, p, ph, cell };
  }
  if (!best || best.sc < 24) return null;
  const bits = [];
  for (const r of ROWS) for (const c of COLS) { const v = best.cell(r, c); bits.push(d2(v, ACC_L) < d2(v, ACC) ? 1 : 0); }
  return { bits, ...bitsToCode(bits), border: best.sc };
}
module.exports = { codeFor, bitsToCode, readBand, P, SIZE, X0, Y0, ROWS, COLS, ACC, ACC_L };
