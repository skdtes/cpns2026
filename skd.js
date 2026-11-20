/* ============================================================================
   SIMULASI CAT SKD CPNS — alur peserta bergaya CAT BKN: login (captcha) -> Daftar Simulasi ->
   Info -> Konfirmasi -> Ujian -> Hasil (ambang batas TWK/TIU/TKP), Dashboard, grafik perkembangan,
   analisis materi, sertifikat, kartu peserta, serta impor data peserta dan analisis di portal guru.
   Dimuat SETELAH app.js; mengganti beberapa fungsi bawaan tanpa mengubah fitur lain.
   ============================================================================ */
'use strict';
const Skd = (function () {
  const $ = (id) => document.getElementById(id);
  const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => escapeHtml_(String(s == null ? '' : s));

  // ---------------- tanggal ----------------
  function parseTgl(v) {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return { d: v.getDate(), m: v.getMonth() + 1, y: v.getFullYear() };
    const s = String(v).trim();
    if (/^\d{5}(\.\d+)?$/.test(s)) { const n = Number(s); if (n > 20000 && n < 80000) { const dt = new Date(Math.round((n - 25569) * 86400000)); return { d: dt.getUTCDate(), m: dt.getUTCMonth() + 1, y: dt.getUTCFullYear() }; } }
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return { y: +m[1], m: +m[2], d: +m[3] };
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/); if (m) return { d: +m[1], m: +m[2], y: +m[3] };
    m = s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (m) { const i = BLN.findIndex(b => b.toLowerCase().slice(0, 3) === m[2].toLowerCase().slice(0, 3)); if (i >= 0) return { d: +m[1], m: i + 1, y: +m[3] }; }
    return null;
  }
  function isoTgl(v) { const t = parseTgl(v); return t ? t.y + '-' + pad(t.m) + '-' + pad(t.d) : String(v == null ? '' : v).trim(); }
  function tglPanjang(v) { const t = parseTgl(v); return t ? pad(t.d) + ' ' + BLN[t.m - 1] + ' ' + t.y : String(v || ''); }

  // ---------------- QR (byte mode, ECC M, versi 1-10) ----------------
  function qrMatrix(text) {
    const data = Array.from(new TextEncoder().encode(text));
    const ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26], BLK = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
    const raw = (v) => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const na = Math.floor(v / 7) + 2; r -= (25 * na - 10) * na - 55; if (v >= 7) r -= 36; } return r; };
    let ver = 1;
    for (; ver <= 10; ver++) { if (data.length * 8 + 4 + (ver < 10 ? 8 : 16) <= (Math.floor(raw(ver) / 8) - ECC[ver] * BLK[ver]) * 8) break; }
    if (ver > 10) throw new Error('Teks QR terlalu panjang');
    const dataCw = Math.floor(raw(ver) / 8) - ECC[ver] * BLK[ver];
    const bits = []; const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    put(4, 4); put(data.length, ver < 10 ? 8 : 16); data.forEach(b => put(b, 8));
    put(0, Math.min(4, dataCw * 8 - bits.length)); while (bits.length % 8) bits.push(0);
    for (let p = 0xEC; bits.length < dataCw * 8; p ^= 0xEC ^ 0x11) put(p, 8);
    const cw = []; for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; };
    const div = (deg) => { const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = mul(root, 2); } return r; };
    const rem = (d, dv) => { const r = dv.map(() => 0); for (const b of d) { const f = b ^ r.shift(); r.push(0); dv.forEach((c, i) => { r[i] ^= mul(c, f); }); } return r; };
    const nb = BLK[ver], el = ECC[ver], rawCw = Math.floor(raw(ver) / 8), nShort = nb - rawCw % nb, shortLen = Math.floor(rawCw / nb), dv = div(el);
    const blocks = []; for (let i = 0, k = 0; i < nb; i++) { const d = cw.slice(k, k + shortLen - el + (i < nShort ? 0 : 1)); k += d.length; blocks.push(d.concat(i < nShort ? [0] : [], rem(d, dv))); }
    const out = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - el || j >= nShort) out.push(b[i]); });
    const size = ver * 4 + 17; const M = [], F = [];
    for (let y = 0; y < size; y++) { M.push(new Array(size).fill(false)); F.push(new Array(size).fill(false)); }
    const setF = (x, y, d) => { if (x >= 0 && y >= 0 && x < size && y < size) { M[y][x] = d; F[y][x] = true; } };
    for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); setF(cx + dx, cy + dy, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    if (ver >= 2) {
      const na = Math.floor(ver / 7) + 2, step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2; const pos = [6];
      for (let p = size - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
      for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
    const fmt = (mask) => {
      const dat = (0 << 3) | mask; let r = dat; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((dat << 10) | r) ^ 0x5412; const g = (i) => ((b >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) setF(8, i, g(i)); setF(8, 7, g(6)); setF(8, 8, g(7)); setF(7, 8, g(8));
      for (let i = 9; i < 15; i++) setF(14 - i, 8, g(i));
      for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, g(i));
      for (let i = 8; i < 15; i++) setF(8, size - 15 + i, g(i));
      setF(8, size - 8, true);
    };
    fmt(0);
    if (ver >= 7) { let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25); const b = (ver << 12) | r; for (let i = 0; i < 18; i++) { const d = ((b >>> i) & 1) !== 0, a = size - 11 + i % 3, c = Math.floor(i / 3); setF(a, c, d); setF(c, a, d); } }
    let k = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
        if (!F[y][x] && k < out.length * 8) { M[y][x] = ((out[k >>> 3] >>> (7 - (k & 7))) & 1) !== 0; k++; }
      }
    }
    const maskFn = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0, (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
    const apply = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && maskFn[m](x, y)) M[y][x] = !M[y][x]; };
    const penalty = () => {
      let p = 0;
      for (let y = 0; y < size; y++) { let run = 1; for (let x = 1; x < size; x++) { if (M[y][x] === M[y][x - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (let x = 0; x < size; x++) { let run = 1; for (let y = 1; y < size; y++) { if (M[y][x] === M[y - 1][x]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
      let dark = 0; M.forEach(r => r.forEach(c => { if (c) dark++; })); p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    };
    let best = 0, bp = Infinity;
    for (let m = 0; m < 8; m++) { apply(m); fmt(m); const p = penalty(); if (p < bp) { bp = p; best = m; } apply(m); }
    apply(best); fmt(best);
    return M;
  }
  function qrSvg(text) {
    const M = qrMatrix(text), n = M.length, q = 2; let d = '';
    M.forEach((r, y) => { let x = 0; while (x < n) { if (r[x]) { let w = 1; while (x + w < n && r[x + w]) w++; d += 'M' + (x + q) + ' ' + (y + q) + 'h' + w + 'v1h-' + w + 'z'; x += w; } else x++; } });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 2 * q} ${n + 2 * q}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }

  // ======================================================================================
  //  UMUM
  // ======================================================================================
  const num = (v, d) => { v = Number(v); return isNaN(v) ? (d || 0) : v; };
  const NAMA_SUBTES = { TWK: 'Tes Wawasan Kebangsaan (TWK)', TIU: 'Tes Intelegensia Umum (TIU)', TKP: 'Tes Karakteristik Pribadi (TKP)' };
  const WARNA = { TWK: '#0d6efd', TIU: '#fd7e14', TKP: '#198754', Total: '#6f42c1' };
  const fmtTgl = (iso, denganJam) => {
    if (!iso) return '-'; const d = new Date(iso); if (isNaN(d)) return String(iso);
    return pad(d.getDate()) + ' ' + BLN[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear() + (denganJam ? ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : '');
  };
  const nTeks = (v) => (Math.round(num(v) * 10) / 10).toLocaleString('id-ID');
  function hashHex(str, panjang) { // fingerprint deterministik (bukan kriptografi) untuk nomor sertifikat
    let out = '';
    for (let k = 0; out.length < (panjang || 32); k++) {
      let h1 = 0xdeadbeef ^ k, h2 = 0x41c6ce57 ^ k;
      for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
      out += ((h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0'));
    }
    return out.slice(0, panjang || 32).toUpperCase();
  }

  // ---------------- grafik garis (SVG, tanpa pustaka) ----------------
  // series: [{ nama, warna, data:[angka|null] }]; opt: { maks, tinggi, garis:[{y,label,warna}] }
  function grafikGaris(labels, series, opt) {
    opt = opt || {}; const W = 760, H = opt.tinggi || 280, L = 46, R = 16, T = 18, B = 54;
    let maks = opt.maks || Math.max(10, ...series.map(s => Math.max(0, ...s.data.filter(v => v !== null && v !== undefined).map(Number))));
    maks = Math.ceil(maks / 50) * 50 || 50;
    const n = labels.length; const x = (i) => L + (n <= 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1));
    const y = (v) => T + (1 - v / maks) * (H - T - B);
    let s = `<svg class="skd-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik garis perkembangan skor">`;
    for (let g = 0; g <= 5; g++) { const v = maks * g / 5, yy = y(v); s += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" class="gl"/><text x="${L - 6}" y="${yy + 4}" text-anchor="end" class="gt">${Math.round(v)}</text>`; }
    (opt.garis || []).forEach(g => { if (g.y > 0 && g.y <= maks) { const yy = y(g.y); s += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="${g.warna || '#dc3545'}" stroke-dasharray="6 4" stroke-width="1.4"/><text x="${W - R}" y="${yy - 4}" text-anchor="end" class="gt" fill="${g.warna || '#dc3545'}">${esc(g.label)}</text>`; } });
    labels.forEach((lb, i) => { const t = String(lb).length > 16 ? String(lb).slice(0, 15) + '…' : String(lb); s += `<text x="${x(i)}" y="${H - B + 16}" text-anchor="middle" class="gt" transform="rotate(${n > 5 ? 28 : 0} ${x(i)} ${H - B + 16})">${esc(t)}</text>`; });
    series.forEach(se => {
      const pts = se.data.map((v, i) => (v === null || v === undefined) ? null : [x(i), y(Number(v)), Number(v), i]).filter(Boolean);
      if (pts.length > 1) s += `<polyline fill="none" stroke="${se.warna}" stroke-width="2.6" stroke-linejoin="round" points="${pts.map(p => p[0] + ',' + p[1]).join(' ')}"/>`;
      pts.forEach(p => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="4.2" fill="#fff" stroke="${se.warna}" stroke-width="2.4"><title>${esc(se.nama)} — ${esc(labels[p[3]])}: ${nTeks(p[2])}</title></circle>`; });
      const last = pts[pts.length - 1]; if (last) s += `<text x="${last[0]}" y="${last[1] - 9}" text-anchor="middle" class="gv" fill="${se.warna}">${nTeks(last[2])}</text>`;
    });
    s += '</svg><div class="skd-legend-chart">' + series.map(se => `<span><i style="background:${se.warna}"></i>${esc(se.nama)}</span>`).join('') + '</div>';
    return s;
  }
  function badgeTren(arr) { // arr: angka berurutan waktu
    const a = arr.filter(v => v !== null && v !== undefined).map(Number);
    if (a.length < 2) return '<span class="skd-tren flat"><i class="fa-solid fa-minus"></i> Belum ada pembanding</span>';
    const d = Math.round((a[a.length - 1] - a[a.length - 2]) * 10) / 10;
    if (d > 0) return `<span class="skd-tren up"><i class="fa-solid fa-arrow-trend-up"></i> Naik ${nTeks(d)} dari sebelumnya</span>`;
    if (d < 0) return `<span class="skd-tren down"><i class="fa-solid fa-arrow-trend-down"></i> Turun ${nTeks(-d)} dari sebelumnya</span>`;
    return '<span class="skd-tren flat"><i class="fa-solid fa-minus"></i> Tetap dibanding sebelumnya</span>';
  }
  function grafikRiwayat(riwayat) {
    if (!riwayat || !riwayat.length) return '<p class="skd-muted">Belum ada simulasi yang diselesaikan.</p>';
    const lab = riwayat.map(r => r.judul + ' · ' + fmtTgl(r.waktu));
    const amb = (riwayat[riwayat.length - 1].ambang) || {};
    const ser = [
      { nama: 'TWK', warna: WARNA.TWK, data: riwayat.map(r => r.twk) }, { nama: 'TIU', warna: WARNA.TIU, data: riwayat.map(r => r.tiu) },
      { nama: 'TKP', warna: WARNA.TKP, data: riwayat.map(r => r.tkp) }, { nama: 'Total', warna: WARNA.Total, data: riwayat.map(r => r.nilai) }];
    return grafikGaris(lab, ser, { maks: 550, garis: amb.total ? [{ y: amb.total, label: 'Passing grade total ' + amb.total, warna: '#dc3545' }] : [] }) +
      `<div class="skd-tren-row">Total: ${badgeTren(riwayat.map(r => r.nilai))} &nbsp; TWK: ${badgeTren(riwayat.map(r => r.twk))} &nbsp; TIU: ${badgeTren(riwayat.map(r => r.tiu))} &nbsp; TKP: ${badgeTren(riwayat.map(r => r.tkp))}</div>`;
  }

  // ---------------- analisis materi ----------------
  function statusMateri(p) {
    if (p >= 80) return { k: 'kuat', t: 'Kuat', s: 'Pertahankan dengan latihan rutin.' };
    if (p >= 60) return { k: 'cukup', t: 'Cukup', s: 'Perkuat dengan latihan soal tambahan.' };
    if (p >= 40) return { k: 'kurang', t: 'Perlu ditingkatkan', s: 'Pelajari ulang konsep dasar lalu latihan.' };
    return { k: 'sangat', t: 'Prioritas utama', s: 'Mulai dari materi dasar, kerjakan latihan bertahap.' };
  }
  function htmlAnalisisMateri(topik, opt) {
    opt = opt || {};
    if (!topik || !topik.length) return '<p class="skd-muted">Belum ada data. Analisis muncul setelah peserta menyelesaikan minimal satu simulasi dan soal diberi kolom Topik.</p>';
    const urut = topik.slice().sort((a, b) => a.persen - b.persen);
    const lemah = urut.filter(t => t.persen < 70 && t.topik !== '(Tanpa topik)').slice(0, 6);
    let h = '';
    h += lemah.length
      ? `<div class="skd-prioritas"><h4><i class="fa-solid fa-bullseye"></i> ${opt.guru ? 'Materi yang perlu diperkuat peserta ini' : 'Materi yang harus kamu pelajari lagi'}</h4><ol>${lemah.map(t => { const st = statusMateri(t.persen); return `<li><b>${esc(t.topik)}</b> <span class="skd-chip sub-${esc(t.subtes)}">${esc(t.subtes)}</span> — ${nTeks(t.persen)}% <span class="skd-muted">(${st.s})</span></li>`; }).join('')}</ol></div>`
      : '<div class="skd-prioritas ok"><h4><i class="fa-solid fa-circle-check"></i> Tidak ada materi yang tergolong lemah (di bawah 70%).</h4></div>';
    ['TWK', 'TIU', 'TKP'].forEach(st => {
      const arr = topik.filter(t => t.subtes === st).sort((a, b) => a.persen - b.persen); if (!arr.length) return;
      h += `<h4 class="skd-h4 sub-${st}">${esc(NAMA_SUBTES[st])}</h4><div class="skd-scroll"><table class="skd-tbl"><thead><tr><th>Materi (Topik)</th><th>Soal</th><th>Skor</th><th style="min-width:160px">Penguasaan</th><th>Status</th></tr></thead><tbody>` +
        arr.map(t => { const s = statusMateri(t.persen); return `<tr><td>${esc(t.topik)}</td><td>${t.jumlah}</td><td>${nTeks(t.skor)} / ${nTeks(t.maks)}</td><td><div class="skd-bar"><i class="b-${s.k}" style="width:${Math.min(100, t.persen)}%"></i></div><small>${nTeks(t.persen)}%</small></td><td><span class="skd-st st-${s.k}">${s.t}</span></td></tr>`; }).join('') + '</tbody></table></div>';
    });
    return h;
  }

  // ======================================================================================
  //  LOGIN (captcha) & PORTAL
  // ======================================================================================
  let captchaKode = '';
  function buatCaptcha() {
    const c = $('skd-captcha-canvas'); if (!c || !c.getContext) return;
    const ctx = c.getContext('2d'); const huruf = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    captchaKode = Array.from({ length: 5 }, () => huruf[Math.floor(Math.random() * huruf.length)]).join('');
    ctx.fillStyle = '#f1f3f5'; ctx.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 70; i++) { ctx.fillStyle = 'rgba(' + [0, 1, 2].map(() => 100 + Math.random() * 120 | 0).join(',') + ',.45)'; ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2); }
    for (let i = 0; i < 4; i++) { ctx.strokeStyle = 'rgba(80,80,120,.35)'; ctx.beginPath(); ctx.moveTo(Math.random() * c.width, Math.random() * c.height); ctx.lineTo(Math.random() * c.width, Math.random() * c.height); ctx.stroke(); }
    ctx.textBaseline = 'middle';
    captchaKode.split('').forEach((ch, i) => { ctx.save(); ctx.translate(16 + i * 25, c.height / 2 + (Math.random() * 6 - 3)); ctx.rotate((Math.random() - .5) * .6); ctx.font = 'bold ' + (24 + (Math.random() * 6 | 0)) + 'px monospace'; ctx.fillStyle = '#1e3a6e'; ctx.fillText(ch, 0, 0); ctx.restore(); });
    const inp = $('skd-captcha-input'); if (inp) inp.value = '';
  }
  function captchaBenar() {
    const box = $('skd-captcha-box'); if (!box || box.classList.contains('hidden')) return true;
    return String($('skd-captcha-input').value || '').trim().toUpperCase() === captchaKode && captchaKode !== '';
  }
  const _login = Auth.login;
  Auth.login = function (ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    if (!captchaBenar()) { $('login-error').textContent = 'Captcha salah. Silakan coba lagi.'; buatCaptcha(); const i = $('skd-captcha-input'); if (i) i.focus(); return Promise.resolve(); }
    return Promise.resolve(_login.call(Auth, ev)).finally(() => { if (!$('login-screen').classList.contains('hidden')) buatCaptcha(); });
  };

  function toggleSandi(btn) {
    const el = $('login-password'); const sembunyi = el.type === 'password';
    el.type = sembunyi ? 'text' : 'password';
    btn.innerHTML = '<i class="fa-solid ' + (sembunyi ? 'fa-eye-slash' : 'fa-eye') + '"></i>';
  }
  function pilihPortal(role, ev) {
    if (ev) ev.preventDefault();
    UI.pilihRole(role);
    const g = role === 'guru';
    $('login-judul').textContent = g ? 'LOGIN GURU' : 'SIMULASI CAT BKN';
    $('login-sub').textContent = g ? 'Silakan masukkan username dan password akun guru Anda' : 'Silakan masukkan username dan password Anda';
    $('skd-link-guru').classList.toggle('hidden', g); $('skd-link-siswa').classList.toggle('hidden', !g);
    $('login-error').textContent = ''; buatCaptcha();
    try { history.replaceState(null, '', location.pathname + location.search + (g ? '#guru' : '')); } catch (e) { /* abaikan */ }
  }
  function tutupModal(id) { const m = $(id); if (m) m.classList.add('hidden'); }

  // ---------------- header & layar ----------------
  function setUser() {
    const u = state.user; if (!u || u.role !== 'siswa') return;
    document.querySelectorAll('.skd-user-nama').forEach(e => { e.textContent = u.nama || u.username || ''; });
  }
  const _tampilkan = UI.tampilkan;
  UI.tampilkan = function (id) {
    _tampilkan.call(UI, id);
    if (state.user && state.user.role === 'siswa') setUser();
    window.scrollTo(0, 0);
  };

  // ======================================================================================
  //  ALUR PESERTA: Daftar Simulasi -> Info -> Konfirmasi -> Ujian
  // ======================================================================================
  let daftarCache = [], ujianPilih = null;
  const durTeks = (m) => m + ' menit';
  async function tampilDaftar() {
    const u = state.user; if (!u || u.role !== 'siswa') return;
    UI.tampilkan('daftar-screen');
    const cont = $('skd-daftar'); cont.innerHTML = '<p class="skd-muted">Memuat...</p>';
    let res; try { res = await api('getUjianSiswa', { siswaId: u.id }); } catch (e) { res = { ok: false, error: 'Gagal terhubung ke server.' }; }
    if (!res || !res.ok) { cont.innerHTML = `<div class="skd-card skd-kosong"><p>${esc((res && res.error) || 'Gagal memuat daftar simulasi.')}</p><button class="skd-btn skd-btn-primary" onclick="Skd.tampilDaftar()">Coba lagi</button></div>`; return; }
    daftarCache = res.data || [];
    if (!daftarCache.length) { cont.innerHTML = '<div class="skd-card skd-kosong"><i class="fa-solid fa-hourglass-half"></i><p>Belum ada simulasi yang tersedia untuk Anda. Hubungi pengawas/guru untuk jadwal kelas Anda.</p></div>'; return; }
    cont.innerHTML = daftarCache.map((s, i) => {
      const jadwal = (s.mulai || s.selesai) ? (fmtTgl(s.mulai, true) + ' - ' + fmtTgl(s.selesai, true)) : 'Kapan saja';
      const amb = s.ambang; const pass = amb ? Number(amb.total).toFixed(2) : '-';
      const aksi = s.status === 'selesai'
        ? `<button class="skd-btn skd-btn-green" onclick="Skd.lihatHasil('${esc(s.sesiId)}')"><i class="fa-solid fa-chart-column"></i> Lihat Hasil</button>`
        : `<button class="skd-btn skd-btn-primary" onclick="Skd.tampilInfo(${i})"><i class="fa-solid fa-circle-info"></i> ${s.status === 'berlangsung' ? 'Lanjutkan Ujian' : 'Lihat Detail &amp; Mulai Ujian'}</button>`;
      const chip = s.status === 'selesai' ? '<span class="skd-chip st-selesai">Sudah dikerjakan</span>' : (s.status === 'berlangsung' ? '<span class="skd-chip st-jalan">Sedang berlangsung</span>' : '');
      return `<article class="skd-card skd-sim"><div class="skd-sim-ico"><i class="fa-solid fa-file-lines"></i></div>
        <h3>${esc(s.judul)} ${chip}</h3><p class="skd-muted">Detail Simulasi :</p>
        <ul class="skd-sim-det"><li><i class="fa-solid fa-clock skd-ic-y"></i> Durasi: ${durTeks(s.durasi)}</li><li><i class="fa-solid fa-calendar-days skd-ic-c"></i> Tanggal Tersedia: ${esc(jadwal)}</li><li><i class="fa-solid fa-circle-question skd-ic-g"></i> Total Soal: ${s.totalSoal}</li><li><i class="fa-solid fa-trophy skd-ic-y"></i> Passing Grade: ${pass}</li></ul>${aksi}</article>`;
    }).join('');
  }
  function tampilInfo(i) {
    const s = daftarCache[i]; if (!s) return; ujianPilih = s;
    UI.tampilkan('info-screen');
    $('info-judul').textContent = 'Simulasi ' + s.judul.replace(/^simulasi\s+/i, '');
    $('info-deskripsi').textContent = 'Deskripsi Ujian: ' + (s.deskripsi || s.judul);
    $('info-durasi').textContent = durTeks(s.durasi); $('info-total').textContent = s.totalSoal + ' soal';
    const a = s.ambang; $('info-passing').innerHTML = a ? `${Number(a.total).toFixed(2)}<br><small class="skd-muted">TWK ${a.twk || '-'} · TIU ${a.tiu || '-'} · TKP ${a.tkp || '-'}</small>` : '-';
    const k = s.komposisi || {};
    $('info-materi').innerHTML = [['TWK', k.twk], ['TIU', k.tiu], ['TKP', k.tkp]].filter(x => x[1]).map(x => `<li><i class="fa-solid fa-book skd-ic-b"></i> ${esc(NAMA_SUBTES[x[0]])}<span class="skd-pill">${x[1]} soal</span></li>`).join('') || `<li>${s.totalSoal} soal</li>`;
    $('input-token-ujian').value = ''; $('token-error').textContent = '';
    $('info-btn-teks').textContent = s.status === 'berlangsung' ? 'Lanjutkan Ujian' : 'Mulai Ujian Sekarang';
  }
  function mintaKonfirmasiMulai() {
    const t = $('input-token-ujian').value.trim();
    if (!t) { $('token-error').textContent = 'Token belum diisi. Minta token kepada pengawas.'; $('input-token-ujian').focus(); return; }
    $('token-error').textContent = '';
    $('modal-konfirmasi-mulai').classList.remove('hidden');
  }
  async function mulaiUjian() {
    tutupModal('modal-konfirmasi-mulai');
    const inp = $('input-token-ujian'), err = $('token-error'), btn = $('info-btn-mulai');
    const token = inp.value.trim().toUpperCase(); err.textContent = '';
    btn.classList.add('is-disabled');
    try {
      const res = await api('cekToken', { token, siswaId: state.user && state.user.id });
      if (!res.ok) { err.textContent = res.error || 'Token salah.'; return; }
      if (ujianPilih && res.ujian && res.ujian.id !== ujianPilih.id) { err.textContent = 'Token ini bukan untuk simulasi yang dipilih.'; return; }
      state.ujian = res.ujian;
      await Siswa.mulaiUjian();
    } finally { btn.classList.remove('is-disabled'); }
  }
  function lewatkan() { Siswa.soalBerikutnya(); }
  function toggleNav() { const p = $('skd-navpanel'); if (p) p.classList.toggle('terlipat'); }
  UI.kembaliKeBerandaSiswa = function () { tampilDaftar(); };

  // ======================================================================================
  //  PENYAJI SOAL (tampilan CAT BKN) + MESIN UJIAN
  // ======================================================================================
  const RE_PISAH_TAG = /<(p|div)[^>]*>\s*(?:-{3,}|\[\[PISAH\]\])\s*<\/\1>/i;
  const RE_PISAH_TEKS = /(?:<br\s*\/?>\s*|\n|^)\s*(?:-{3,}|\[\[PISAH\]\])\s*(?:<br\s*\/?>|\n|$)/i;
  function pisah(raw) {
    raw = String(raw || '');
    for (const re of [RE_PISAH_TAG, RE_PISAH_TEKS]) { const m = re.exec(raw); if (m) return { stim: raw.slice(0, m.index), tanya: raw.slice(m.index + m[0].length) }; }
    return { stim: '', tanya: raw };
  }
  const opsiObj = (o) => (o && typeof o === 'object') ? o : { teks: o || '', gambar: '' };
  const isiOpsi = (item) => kontenSoalHtml(item.teks) + (item.gambar ? tagGambarAman_(item.gambar, 'opsi-gambar-tampil', 'Gambar opsi') : '');
  const HURUF = 'ABCDEFGH';
  function renderSoal(soal, opts) {
    const jwb = (opts && opts.jawaban) || {}; const id = esc(soal.id); const aktif = !(opts && opts.interaktif === false);
    if (!['pilihan_ganda', 'tkp', 'benar_salah', 'checkbox'].includes(soal.tipe)) return renderKontenSoal(soal, { nomor: 0, total: 0, interaktif: true, jawaban: jwb, pecah: true });
    const { stim, tanya } = pisah(soal.pertanyaan);
    let h = '';
    const kontenTanya = (stim.trim() ? stim : '') + (stim.trim() && tanya.trim() ? '' : '') + (stim.trim() ? tanya : tanya);
    h += '<div class="skd-pertanyaan pertanyaan">' + kontenSoalHtml(stim.trim() ? stim + tanya : tanya) + '</div>';
    if (soal.gambar) h += tagGambarAman_(soal.gambar, 'gambar-soal', 'Gambar soal');
    if (soal.tipe === 'pilihan_ganda' || soal.tipe === 'tkp' || soal.tipe === 'benar_salah') {
      h += '<div class="skd-opsi-list">' + (soal.opsi || []).map((o, i) =>
        `<label class="skd-opsi${jwb[soal.id] === i ? ' selected' : ''}" data-opsi="${i}"${aktif ? ` onclick="ExamEngine.pilihJawabanTunggal('${id}', ${i})"` : ''}><span class="skd-huruf">${HURUF[i] || i + 1}</span><span class="skd-opsi-t">${isiOpsi(opsiObj(o))}</span></label>`).join('') + '</div>';
    } else if (soal.tipe === 'checkbox') {
      const dip = jwb[soal.id] || [];
      h += '<div class="skd-opsi-list">' + (soal.opsi || []).map((o, i) =>
        `<label class="skd-opsi${dip.includes(i) ? ' selected' : ''}" data-opsi="${i}"${aktif ? ` onclick="ExamEngine.toggleJawabanGanda('${id}', ${i})"` : ''}><span class="skd-huruf">${HURUF[i] || i + 1}</span><span class="skd-opsi-t">${isiOpsi(opsiObj(o))}</span></label>`).join('') + '</div>';
    } else {
      h += `<textarea rows="6" placeholder="Tulis jawaban Anda di sini..." oninput="ExamEngine.isiJawabanUraian('${id}', this.value)">${esc(jwb[soal.id] || '')}</textarea>`;
    }
    return h;
  }
  ExamEngine.renderSoal = function () {
    const idx = state.idxSoal, soal = state.soal[idx], card = $('question-card'), total = state.soal.length;
    card.innerHTML = renderSoal(soal, { jawaban: state.jawaban });
    renderMatika(card);
    $('u-nomor').textContent = 'Soal ' + (idx + 1) + ' dari ' + total;
    const st = $('u-subtes'); const nm = soal.subtes ? NAMA_SUBTES[soal.subtes] : ''; st.textContent = nm; st.style.display = nm ? '' : 'none'; st.className = 'skd-badge-subtes sub-' + (soal.subtes || '');
    $('chk-ragu').checked = state.ragu.includes(soal.id);
    $('btn-soal-prev').disabled = idx === 0;
    const terakhir = idx === total - 1, nx = $('btn-soal-next');
    nx.querySelector('span').textContent = terakhir ? 'Simpan dan Selesai' : 'Simpan dan Lanjutkan';
    $('btn-lewatkan').style.display = terakhir ? 'none' : '';
    SkalaSoal.terapkan(); ExamEngine.renderGridSoal();
    $('u-prog-teks').textContent = (idx + 1) + ' / ' + total; const pf = $('exam-progress-fill'); if (pf) pf.style.width = ((idx + 1) / total * 100) + '%';
    if (state.ujian) $('ujian-judul-aktif').textContent = state.ujian.judul;
    if (state.user) $('ujian-peserta').textContent = state.user.nama || state.user.username || '';
  };
  ExamEngine.pilihJawabanTunggal = function (id, i) {
    state.jawaban[id] = i; simpanCacheLokal();
    document.querySelectorAll('#question-card .skd-opsi').forEach(e => e.classList.toggle('selected', +e.dataset.opsi === i));
    ExamEngine.renderGridSoal();
  };
  ExamEngine.toggleJawabanGanda = function (id, i) {
    const arr = state.jawaban[id] || []; const k = arr.indexOf(i);
    if (k === -1) arr.push(i); else arr.splice(k, 1);
    state.jawaban[id] = arr; simpanCacheLokal();
    document.querySelectorAll('#question-card .skd-opsi').forEach(e => e.classList.toggle('selected', arr.includes(+e.dataset.opsi)));
    ExamEngine.renderGridSoal();
  };
  const _buka = KumpulUI.buka;
  KumpulUI.buka = function () { _buka.call(KumpulUI); const j = $('kumpul-judul'); if (j) j.textContent = 'Konfirmasi Selesai Ujian'; };

  // ======================================================================================
  //  HASIL SIMULASI, DASHBOARD PESERTA, SERTIFIKAT
  // ======================================================================================
  function barSubtes(kode, nama, skor, maks, amb, ok, benar, jml) {
    const pct = maks > 0 ? Math.min(100, skor / maks * 100) : 0; const mark = (amb > 0 && maks > 0) ? Math.min(100, amb / maks * 100) : null;
    return `<div class="skd-card skd-sub ${ok ? 'ok' : 'no'}"><div class="skd-sub-h"><span class="skd-chip sub-${kode}">${kode}</span><b>${esc(nama)}</b><span class="skd-sub-st">${ok ? '<i class="fa-solid fa-circle-check"></i> Memenuhi' : '<i class="fa-solid fa-circle-xmark"></i> Belum memenuhi'}</span></div>
      <div class="skd-sub-skor"><b>${nTeks(skor)}</b><span>/ ${nTeks(maks)}</span></div>
      <div class="skd-gauge"><i style="width:${pct}%"></i>${mark !== null ? `<u style="left:${mark}%" title="Ambang batas ${amb}"></u>` : ''}</div>
      <p class="skd-muted">${amb > 0 ? 'Ambang batas: <b>' + amb + '</b>' : 'Ambang batas: tidak disyaratkan'}${jml ? ' · ' + benar + ' dari ' + jml + ' soal tepat' : ''}</p></div>`;
  }
  async function tampilHasil(sesiId) {
    const sid = sesiId || state.sesiId; if (!sid) return tampilDaftar();
    state.sesiId = sid; UI.tampilkan('hasil-skd-screen');
    const box = $('hasil-skd-isi'); box.innerHTML = '<p class="skd-muted">Memuat hasil...</p>';
    const res = await api('getHasil', { sesiId: sid });
    if (!res || !res.ok) { box.innerHTML = '<div class="skd-card skd-kosong"><p>Hasil belum dapat dimuat.</p><button class="skd-btn skd-btn-primary" onclick="Skd.tampilDaftar()">Kembali</button></div>'; return; }
    const s = res.skd;
    let h = `<h2 class="skd-h2"><i class="fa-solid fa-chart-column"></i> Hasil ${esc(res.judulUjian || 'Simulasi')}</h2>`;
    if (!s) {
      h += `<div class="skd-card"><p>Hasil ujian ini tersimpan sebagai nilai biasa: <b>${esc(res.nilai)}</b>.</p></div>`;
    } else {
      h += `<div class="skd-banner ${s.lulus ? 'ok' : 'no'}"><i class="fa-solid ${s.lulus ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i><div><b>${s.lulus ? 'MEMENUHI AMBANG BATAS SKD' : 'BELUM MEMENUHI AMBANG BATAS SKD'}</b><p>Skor total <b>${nTeks(s.total)}</b> dari ${nTeks(s.maks.total)} (passing grade total ${s.ambang.total}).${s.lulus ? '' : ' Periksa subtes yang berwarna merah dan pelajari materi yang disarankan di bawah.'}</p></div></div>`;
      h += '<div class="skd-grid3">' + barSubtes('TWK', 'Tes Wawasan Kebangsaan', s.twk, s.maks.twk, s.ambang.twk, s.ok.twk, s.benar.twk, s.jumlah.twk) +
        barSubtes('TIU', 'Tes Intelegensia Umum', s.tiu, s.maks.tiu, s.ambang.tiu, s.ok.tiu, s.benar.tiu, s.jumlah.tiu) +
        barSubtes('TKP', 'Tes Karakteristik Pribadi', s.tkp, s.maks.tkp, s.ambang.tkp, s.ok.tkp, s.benar.tkp, s.jumlah.tkp) + '</div>';
      h += `<div class="skd-card skd-total ${s.ok.total ? 'ok' : 'no'}"><div><span class="skd-muted">SKOR TOTAL</span><div class="skd-total-n">${nTeks(s.total)} <small>/ ${nTeks(s.maks.total)}</small></div></div><div class="skd-total-amb">Passing grade total: <b>${s.ambang.total}</b><br>${s.ok.total ? '<span class="skd-st st-kuat">Total terpenuhi</span>' : '<span class="skd-st st-sangat">Total belum terpenuhi</span>'}</div></div>`;
    }
    h += `<div class="skd-aksi"><button class="skd-btn skd-btn-primary" onclick="ExamEngine.bukaDetailJawaban()"><i class="fa-solid fa-list-check"></i> Detail Jawaban &amp; Pembahasan</button>
      <button class="skd-btn skd-btn-green" onclick="Skd.sertifikatSesi('${esc(sid)}')"><i class="fa-solid fa-award"></i> Unduh Sertifikat</button>
      <button class="skd-btn skd-btn-grey" onclick="Skd.tampilDaftar()"><i class="fa-solid fa-arrow-left"></i> Kembali ke Daftar Simulasi</button></div>`;
    if (s && s.topik) h += `<section class="skd-card"><h3 class="skd-h3"><i class="fa-solid fa-bullseye"></i> Analisis Materi — Simulasi Ini</h3>${htmlAnalisisMateri(s.topik)}</section>`;
    h += '<section class="skd-card"><h3 class="skd-h3"><i class="fa-solid fa-chart-line"></i> Grafik Perkembangan Skor</h3><div id="hasil-riwayat"><p class="skd-muted">Memuat...</p></div></section>';
    box.innerHTML = h; renderMatika(box);
    const rw = await api('getRiwayatSkd', { siswaId: state.user.id });
    const t = $('hasil-riwayat'); if (t) t.innerHTML = rw && rw.ok ? grafikRiwayat(rw.data) : '<p class="skd-muted">Riwayat belum dapat dimuat.</p>';
  }
  function lihatHasil(sesiId) { state.sesiId = sesiId; return tampilHasil(sesiId); }
  ExamEngine.tampilkanHasil = function () { return tampilHasil(state.sesiId); };
  ExamEngine.tutupDetailJawaban = function () { UI.tampilkan('hasil-skd-screen'); };

  async function tampilDashboard() {
    const u = state.user; if (!u || u.role !== 'siswa') return;
    UI.tampilkan('dash-screen'); const box = $('dash-isi'); box.innerHTML = '<p class="skd-muted">Memuat...</p>';
    const [rw, an] = await Promise.all([api('getRiwayatSkd', { siswaId: u.id }), api('getAnalisisMateri', { siswaId: u.id })]);
    const r = rw && rw.ok ? rw.data : [];
    const tertinggi = r.length ? Math.max(...r.map(x => x.nilai)) : 0, terakhir = r.length ? r[r.length - 1] : null;
    let h = `<h2 class="skd-h2"><i class="fa-solid fa-gauge-high"></i> Dashboard Peserta</h2>
      <div class="skd-grid3"><div class="skd-card skd-stat"><span>Simulasi diselesaikan</span><b>${r.length}</b></div><div class="skd-card skd-stat"><span>Skor total tertinggi</span><b>${r.length ? nTeks(tertinggi) : '-'}</b></div><div class="skd-card skd-stat"><span>Skor total terakhir</span><b>${terakhir ? nTeks(terakhir.nilai) : '-'}</b><small>${terakhir ? badgeTren(r.map(x => x.nilai)) : ''}</small></div></div>
      <section class="skd-card"><h3 class="skd-h3"><i class="fa-solid fa-chart-line"></i> Grafik Perkembangan Skor</h3>${grafikRiwayat(r)}</section>`;
    h += '<section class="skd-card"><h3 class="skd-h3"><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Simulasi</h3>' + (r.length ? `<div class="skd-scroll"><table class="skd-tbl"><thead><tr><th>Simulasi</th><th>Tanggal</th><th>TWK</th><th>TIU</th><th>TKP</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>` +
      r.slice().reverse().map(x => `<tr><td>${esc(x.judul)}</td><td>${fmtTgl(x.waktu, true)}</td><td>${x.twk === null ? '-' : nTeks(x.twk)}</td><td>${x.tiu === null ? '-' : nTeks(x.tiu)}</td><td>${x.tkp === null ? '-' : nTeks(x.tkp)}</td><td><b>${nTeks(x.nilai)}</b></td><td><span class="skd-st ${x.lulus ? 'st-kuat' : 'st-sangat'}">${x.lulus ? 'Memenuhi' : 'Belum'}</span></td><td class="skd-nowrap"><button class="skd-btn skd-btn-xs skd-btn-primary" onclick="Skd.lihatHasil('${esc(x.sesiId)}')">Hasil</button> <button class="skd-btn skd-btn-xs skd-btn-green" onclick="Skd.sertifikatSesi('${esc(x.sesiId)}')">Sertifikat</button></td></tr>`).join('') + '</tbody></table></div>' : '<p class="skd-muted">Belum ada simulasi yang diselesaikan.</p>') + '</section>';
    h += `<section class="skd-card"><h3 class="skd-h3"><i class="fa-solid fa-bullseye"></i> Analisis Materi (gabungan semua simulasi)</h3>${an && an.ok ? htmlAnalisisMateri(an.topik) : '<p class="skd-muted">Belum dapat dimuat.</p>'}</section>
      <div class="skd-aksi"><button class="skd-btn skd-btn-grey" onclick="Skd.tampilDaftar()"><i class="fa-solid fa-arrow-left"></i> Kembali ke Daftar Simulasi</button></div>`;
    box.innerHTML = h;
  }

  // ---------------- sertifikat (cetak / simpan PDF) ----------------
  function htmlSertifikat(d) { // d: { nama, kelas, judul, waktu, skd, nilai, lulus, sesiId }
    const s = d.skd || { twk: 0, tiu: 0, tkp: 0, total: num(d.nilai), maks: { total: 550 }, ambang: { total: 0 }, ok: {}, lulus: !!d.lulus };
    const nomor = hashHex(String(d.sesiId) + '|' + d.nama + '|' + s.total, 32);
    const base = location.href.split('#')[0]; let qr = '';
    try { qr = qrSvg('SIMULASI-SKD|' + nomor + '|' + d.nama + '|' + s.total + '|' + fmtTgl(d.waktu)); } catch (e) { qr = ''; }
    const baris = [['Tes Wawasan Kebangsaan', s.twk, s.ok && s.ok.twk, s.ambang && s.ambang.twk], ['Tes Intelejensia Umum', s.tiu, s.ok && s.ok.tiu, s.ambang && s.ambang.tiu], ['Tes Karakteristik Pribadi', s.tkp, s.ok && s.ok.tkp, s.ambang && s.ambang.tkp]];
    return `<section class="cert"><div class="cert-frame"><div class="cert-corner tl"></div><div class="cert-corner br"></div>
      <img class="cert-logo-tr" src="icons/bkn.png" alt="">
      <div class="cert-in"><h1>SERTIFIKAT</h1><h2>SELEKSI KOMPETENSI DASAR</h2><div class="cert-sim">HASIL SIMULASI LATIHAN</div>
        <p class="cert-no">NO : ${nomor}</p>
        <p class="cert-kpd">Diberikan kepada :</p><div class="cert-nama">${esc(d.nama)}</div>${d.kelas ? `<p class="cert-kelas">${esc(d.kelas)}</p>` : ''}
        <p class="cert-tgl">Tanggal Ujian : ${tglPanjang(d.waktu) || fmtTgl(d.waktu)} &nbsp;·&nbsp; ${esc(d.judul || '')}</p>
        <div class="cert-skor"><table>${baris.map(b => `<tr><td>${b[0]}</td><td>:</td><td class="n">${nTeks(b[1])}</td></tr>`).join('')}<tr class="tot"><td>Total</td><td>:</td><td class="n">${nTeks(s.total)}</td></tr></table><div class="cert-qr">${qr}</div></div>
        <p class="cert-status ${s.lulus ? 'ok' : 'no'}">${s.lulus ? 'Memenuhi ambang batas SKD (simulasi)' : 'Belum memenuhi ambang batas SKD (simulasi)'}${s.ambang && s.ambang.total ? ' — passing grade ' + s.ambang.total : ''}</p>
        <p class="cert-note">Sertifikat ini adalah hasil <b>simulasi latihan</b> dan bukan dokumen resmi Badan Kepegawaian Negara.</p>
      </div></div></section>`;
  }
  function cetakSertifikat(list, judul) {
    if (!list.length) { toast('Tidak ada hasil untuk dicetak.', 'error'); return; }
    const html = '<div class="cert-wrap">' + list.map(htmlSertifikat).join('') + '</div>';
    Guru._cetakArea_(html, judul || 'Sertifikat Simulasi SKD');
    const a = $('cetak-area'); if (a) a.classList.add('cert-area');
  }
  async function sertifikatSesi(sesiId) {
    const res = await api('getHasil', { sesiId });
    if (!res || !res.ok) { toast('Hasil belum dapat dimuat.', 'error'); return; }
    cetakSertifikat([{ nama: state.user.nama || state.user.username, kelas: state.user.kelas || '', judul: res.judulUjian, waktu: res.selesaiPada || new Date().toISOString(), skd: res.skd, nilai: res.nilai, lulus: String(res.lulus) === 'true', sesiId }], 'Sertifikat ' + (state.user.nama || ''));
  }
  function sertifikatTerpilih() {
    const ids = Array.from(document.querySelectorAll('#tabel-rekap .rekap-cek:checked')).map(c => c.value);
    let rows = state.guru._rekapAktif || [];
    rows = ids.length ? rows.filter(r => ids.includes(r.sesiId)) : (Guru.rekapTersaring_ ? Guru.rekapTersaring_() : rows);
    rows = rows.filter(r => r.status !== 'berlangsung');
    const sel = $('pilih-ujian-rekap'); const judul = sel && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : 'Simulasi SKD';
    cetakSertifikat(rows.map(r => ({ nama: r.nama, kelas: r.kelas, judul, waktu: r.selesai || r.mulai, skd: r.skd, nilai: r.nilai, lulus: String(r.lulus) === 'true', sesiId: r.sesiId })), 'Sertifikat Simulasi SKD');
  }

  // ======================================================================================
  //  PORTAL GURU: tren dashboard, analisis materi per peserta
  // ======================================================================================
  async function muatTrenDashboard() {
    const box = $('dash-tren'); if (!box) return;
    const res = await api('getTrenSkd', { guruId: state.user.id });
    if (!res || !res.ok || !res.data.length) { box.innerHTML = '<p class="subtitle">Belum ada simulasi yang diselesaikan peserta.</p>'; return; }
    const r = res.data; const lab = r.map(x => x.judul + ' · ' + fmtTgl(x.waktu));
    box.innerHTML = grafikGaris(lab, [{ nama: 'TWK', warna: WARNA.TWK, data: r.map(x => x.twk) }, { nama: 'TIU', warna: WARNA.TIU, data: r.map(x => x.tiu) }, { nama: 'TKP', warna: WARNA.TKP, data: r.map(x => x.tkp) }, { nama: 'Total', warna: WARNA.Total, data: r.map(x => x.total) }], { maks: 550, garis: [{ y: 311, label: 'Passing grade 311', warna: '#dc3545' }] }) +
      `<div class="skd-tren-row">Rata-rata total: ${badgeTren(r.map(x => x.total))} &nbsp; TWK: ${badgeTren(r.map(x => x.twk))} &nbsp; TIU: ${badgeTren(r.map(x => x.tiu))} &nbsp; TKP: ${badgeTren(r.map(x => x.tkp))}</div>`;
  }
  async function muatTabMateri() {
    if (!(state.guru.daftarSiswa || []).length && Guru.muatDaftarSiswa) { try { await Guru.muatDaftarSiswa(); } catch (e) { /* abaikan */ } }
    const kelas = Array.from(new Set((state.guru.daftarSiswa || []).map(s => s.kelas || ''))).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
    const k = $('materi-kelas'); const pil = k.value;
    k.innerHTML = '<option value="">Semua Kelas</option>' + kelas.map(x => `<option value="${esc(x)}">${esc(x || '(tanpa kelas)')}</option>`).join(''); k.value = pil;
    isiPilihanSiswaMateri();
    const ru = await api('getDaftarUjian', { guruId: state.user.id }); const u = $('materi-ujian'); const pu = u.value;
    u.innerHTML = '<option value="">Semua simulasi</option>' + ((ru && ru.ok ? ru.data : [])).map(x => `<option value="${esc(x.id)}">${esc(x.judul)}</option>`).join(''); u.value = pu;
  }
  function isiPilihanSiswaMateri() {
    const kelas = $('materi-kelas').value; const s = $('materi-siswa'); const pil = s.value;
    const list = (state.guru.daftarSiswa || []).filter(x => !kelas || (x.kelas || '') === kelas).sort((a, b) => String(a.nama || '').localeCompare(String(b.nama || ''), 'id'));
    s.innerHTML = '<option value="">Pilih peserta...</option>' + list.map(x => `<option value="${esc(x.id)}">${esc(x.nama)} — ${esc(x.kelas || '-')}</option>`).join(''); s.value = pil;
  }
  async function muatAnalisisMateriGuru() {
    const sid = $('materi-siswa').value; const box = $('materi-isi'); if (!sid) { box.innerHTML = '<p class="subtitle">Pilih peserta untuk melihat analisis materinya.</p>'; return; }
    box.innerHTML = '<p class="subtitle">Memuat...</p>';
    const res = await api('getAnalisisMateri', { siswaId: sid, ujianId: $('materi-ujian').value || '' });
    if (!res || !res.ok) { box.innerHTML = '<p class="subtitle">Gagal memuat analisis.</p>'; return; }
    const nm = ($('materi-siswa').selectedOptions[0] || {}).textContent || '';
    box.innerHTML = `<h3 style="margin:.2rem 0">${esc(nm)}</h3><p class="subtitle">Berdasarkan ${res.simulasi} simulasi yang sudah diselesaikan.</p>` + (res.riwayat && res.riwayat.length ? `<div class="skd-card-flat"><b>Perkembangan skor</b>${grafikRiwayat(res.riwayat)}</div>` : '') + htmlAnalisisMateri(res.topik, { guru: true });
  }
  async function ringkasanKelasMateri() {
    const kelas = $('materi-kelas').value; const list = (state.guru.daftarSiswa || []).filter(x => !kelas || (x.kelas || '') === kelas);
    const box = $('materi-isi'); if (!list.length) { box.innerHTML = '<p class="subtitle">Tidak ada peserta pada kelas ini.</p>'; return; }
    const hasil = []; let selesai = 0;
    box.innerHTML = `<p class="subtitle">Memuat ringkasan 0 / ${list.length}...</p>`;
    const antre = list.slice();
    async function kerja() { while (antre.length) { const s = antre.shift(); const r = await api('getAnalisisMateri', { siswaId: s.id, ujianId: $('materi-ujian').value || '' }); hasil.push({ s, r }); selesai++; box.innerHTML = `<p class="subtitle">Memuat ringkasan ${selesai} / ${list.length}...</p>`; } }
    await Promise.all([kerja(), kerja(), kerja()]);
    hasil.sort((a, b) => String(a.s.nama || '').localeCompare(String(b.s.nama || ''), 'id'));
    box.innerHTML = `<h3 style="margin:.2rem 0">Ringkasan Materi yang Perlu Diperkuat${kelas ? ' — ' + esc(kelas) : ''}</h3><div class="skd-scroll"><table class="skd-tbl"><thead><tr><th>Peserta</th><th>Kelas</th><th>Simulasi</th><th>Materi terlemah (maks. 3)</th></tr></thead><tbody>` +
      hasil.map(({ s, r }) => { const lm = (r && r.ok ? r.topik : []).filter(t => t.persen < 70 && t.topik !== '(Tanpa topik)').sort((a, b) => a.persen - b.persen).slice(0, 3);
        return `<tr><td>${esc(s.nama)}</td><td>${esc(s.kelas || '-')}</td><td>${r && r.ok ? r.simulasi : '-'}</td><td>${r && r.ok && r.simulasi ? (lm.length ? lm.map(t => `<span class="skd-chip sub-${esc(t.subtes)}">${esc(t.subtes)}</span> ${esc(t.topik)} <small>(${nTeks(t.persen)}%)</small>`).join('<br>') : '<span class="skd-st st-kuat">Tidak ada materi lemah</span>') : '<span class="skd-muted">Belum mengerjakan</span>'}</td></tr>`; }).join('') + '</tbody></table></div>';
  }

  // ======================================================================================
  //  KARTU PESERTA (meniru Kartu Peserta Ujian CASN: logo, barcode, foto, tabel data, QR, PIN)
  // ======================================================================================
  const C39 = { '0': '101001101101', '1': '110100101011', '2': '101100101011', '3': '110110010101', '4': '101001101011', '5': '110100110101', '6': '101100110101', '7': '101001011011', '8': '110100101101', '9': '101100101101',
    A: '110101001011', B: '101101001011', C: '110110100101', D: '101011001011', E: '110101100101', F: '101101100101', G: '101010011011', H: '110101001101', I: '101101001101', J: '101011001101',
    K: '110101010011', L: '101101010011', M: '110110101001', N: '101011010011', O: '110101101001', P: '101101101001', Q: '101010110011', R: '110101011001', S: '101101011001', T: '101011011001',
    U: '110010101011', V: '100110101011', W: '110011010101', X: '100101101011', Y: '110010110101', Z: '100110110101', '-': '100101011011', '.': '110010101101', ' ': '100110101101', '*': '100101101101' };
  function barcode39(teks) { // Code 39 sebagai SVG
    const isi = String(teks || '').toUpperCase().replace(/[^0-9A-Z\-. ]/g, ''); const kode = ('*' + isi + '*').split('');
    let bits = ''; kode.forEach((c, i) => { bits += C39[c] + (i < kode.length - 1 ? '0' : ''); });
    let d = '', x = 0; while (x < bits.length) { if (bits[x] === '1') { let w = 1; while (x + w < bits.length && bits[x + w] === '1') w++; d += `M${x} 0h${w}v40h-${w}z`; x += w; } else x++; }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bits.length} 40" preserveAspectRatio="none" class="kp-barsvg"><path d="${d}" fill="#000"/></svg>`;
  }
  function bukaKartuLogin() {
    const semua = state.guru.daftarSiswa || [];
    if (!semua.length) { toast('Belum ada data peserta. Impor atau tambahkan peserta dulu.', 'error'); return; }
    let m = $('modal-kartu-login'); if (m) m.remove();
    const kelas = Array.from(new Set(semua.map(s => s.kelas || ''))).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
    const pil = $('filter-kelas-siswa') ? $('filter-kelas-siswa').value : '';
    m = document.createElement('div'); m.id = 'modal-kartu-login'; m.className = 'modal-backdrop';
    m.innerHTML = `<div class="modal"><h3>Cetak Kartu Peserta</h3>
      <p class="subtitle" style="margin-top:-.4rem">Kartu mengikuti bentuk Kartu Peserta Ujian CASN: logo, barcode nomor peserta, kotak pas foto, data peserta, QR (memindai QR membuka aplikasi dengan username &amp; password terisi), dan PIN ujian.</p>
      <div class="field"><label>Judul kartu</label><input type="text" id="kl-j1" value="KARTU PESERTA SIMULASI SKD CPNS"></div>
      <div class="field"><label>Sub judul / formasi</label><input type="text" id="kl-j2" value="SELEKSI KOMPETENSI DASAR · FORMASI UMUM"></div>
      <div class="row"><div class="field"><label>Penyelenggara</label><input type="text" id="kl-org" value="Simulasi CAT SKD CPNS"></div><div class="field"><label>Lokasi ujian</label><input type="text" id="kl-lok" placeholder="mis. Lab Komputer 1"></div></div>
      <div class="row">
        <div class="field"><label>Kelas / kelompok</label><select id="kl-kelas"><option value="">Semua kelas</option>${kelas.map(k => `<option value="${esc(k)}"${k === pil ? ' selected' : ''}>${esc(k || '(tanpa kelas)')}</option>`).join('')}</select></div>
        <div class="field"><label>Ukuran kartu</label><select id="kl-ukuran"><option value="2">Standar: 2 kartu per halaman A4</option><option value="4">Ringkas: 4 kartu per halaman A4</option></select></div>
      </div>
      <div class="modal-close-row"><button class="secondary" onclick="document.getElementById('modal-kartu-login').remove()">Batal</button><button class="accent" id="kl-cetak" onclick="Skd.cetakKartuLogin()">Cetak / Simpan PDF</button></div></div>`;
    document.body.appendChild(m);
  }
  function cetakKartuLogin() {
    const kelas = $('kl-kelas').value, kol = $('kl-ukuran').value;
    const j1 = $('kl-j1').value.trim() || 'KARTU PESERTA SIMULASI SKD CPNS', j2 = $('kl-j2').value.trim(), org = $('kl-org').value.trim(), lok = $('kl-lok').value.trim();
    let daftar = (state.guru.daftarSiswa || []).filter(s => !kelas || (s.kelas || '') === kelas);
    if (!daftar.length) { toast('Tidak ada peserta untuk dicetak.', 'error'); return; }
    daftar = daftar.slice().sort((a, b) => String(a.kelas || '').localeCompare(String(b.kelas || ''), 'id', { numeric: true }) || String(a.nama || '').localeCompare(String(b.nama || ''), 'id'));
    const base = location.href.split('#')[0];
    const kartu = daftar.map(s => {
      let qr = ''; try { qr = qrSvg(base + '#u=' + encodeURIComponent(s.username) + '&p=' + encodeURIComponent(s.password)); } catch (e) { qr = ''; }
      const ttl = [s.tempat_lahir, tglPanjang(s.tanggal_lahir)].filter(Boolean).join(' / ');
      const jk = /^l|pria|laki/i.test(String(s.jenis_kelamin || '')) ? 'Pria' : (/^p|wanita|perempuan/i.test(String(s.jenis_kelamin || '')) ? 'Wanita' : '');
      const baris = [['Penyelenggara', org], ['Nama', s.nama, 'b'], ['NISN / NIK', s.nisn], ['Tempat / Tanggal Lahir', ttl], ['Jenis Kelamin', jk], ['Nomor Peserta', s.username, 'nomor'], ['Kelas / Kelompok', s.kelas], ['Lokasi Ujian', lok]];
      return `<div class="kp-card"><div class="kp-head"><img class="kp-logo" src="icons/bkn.png" alt=""><div class="kp-judul"><b>${esc(j1)}</b><span>${esc(j2)}</span></div><div class="kp-bar">${barcode39(s.username)}<small>${esc(s.username)}</small></div></div>
        <div class="kp-body"><div class="kp-foto"><span>Pas Foto<br>3 x 4</span></div><table class="kp-tb">${baris.map(r => `<tr><td class="k">${r[0]}</td><td class="v ${r[2] || ''}">${esc(r[1] || '')}</td></tr>`).join('')}</table></div>
        <div class="kp-bawah"><div class="kp-qr">${qr}<small>Pindai untuk login</small></div><table class="kp-pin"><tr><td class="k">PIN UJIAN (Password)</td><td class="pin">${esc(s.password || '')}</td></tr><tr><td class="k">Tanggal Simulasi</td><td class="isi">&nbsp;</td></tr></table></div>
        <div class="kp-foot">Bawa kartu ini saat simulasi. Jaga kerahasiaan PIN ujian. Hasil simulasi bukan hasil seleksi resmi.</div></div>`;
    }).join('');
    const html = `<div class="kp-wrap kp-k${kol}">${kartu}</div>`;
    $('modal-kartu-login').remove();
    Guru._cetakArea_(html, 'Kartu Peserta' + (kelas ? ' ' + kelas : '')).then(() => {});
    const a = $('cetak-area'); if (a) a.classList.add('kp-area');
  }

  // ---------------- impor data siswa (sesuai Kartu Login) ----------------
  const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const KOL = {
    nama: ['nama', 'namapeserta', 'namalengkap', 'namasiswa'], nisn: ['nisn', 'nis'], tempat: ['tempatlahir', 'tempat'],
    tgl: ['tanggallahir', 'tgllahir', 'tanggal'], ttl: ['tempattanggallahir', 'tempattgllahir', 'ttl'],
    username: ['username', 'user', 'namapengguna'], password: ['password', 'sandi', 'katasandi', 'pass'],
    kelas: ['kelas', 'rombel'], jk: ['jeniskelamin', 'jk', 'kelamin', 'lp']
  };
  function petaKolom(row) {
    const p = {}; (row || []).forEach((c, i) => { const n = norm(c); Object.keys(KOL).forEach(k => { if (p[k] === undefined && KOL[k].includes(n)) p[k] = i; }); });
    return p;
  }
  const normJk = (v) => { const s = String(v || '').trim().toLowerCase(); return /^(l|lk|laki)/.test(s) ? 'L' : (/^(p|pr|perempuan|wanita)/.test(s) ? 'P' : ''); };
  const teks = (v) => (v === null || v === undefined) ? '' : String(v).trim();

  Guru.unduhTemplateSiswa = function () {
    unduhXlsx('template-data-siswa.xlsx', ['Nama Peserta', 'NISN', 'Tempat Lahir', 'Tanggal Lahir', 'Jenis Kelamin', 'Kelas', 'Username', 'Password'], [
      ['Komang Rendi Mahardika', '0105952278', 'Banjarasem', '01 Oktober 2010', 'L', '9A', 'TP2206005700018', '187377*'],
      ['Ayu Lestari', '0112345678', 'Singaraja', '12/03/2011', 'P', '9A', '', '']
    ]);
  };
  Guru.importSiswaDariFile = function (ev) {
    const file = ev.target.files[0]; if (!file) return;
    const kelasOverride = $('siswa-import-kelas').value.trim();
    const reader = new FileReader();
    reader.onload = async (e) => {
      try { await muatPustaka_('xlsx'); } catch (err) { toast(err.message, 'error'); ev.target.value = ''; return; }
      const wb = XLSX.read(e.target.result, { type: 'binary' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
      let hi = rows.findIndex(r => petaKolom(r).nama !== undefined), P;
      if (hi >= 0) P = petaKolom(rows[hi]); else { hi = 0; P = { nama: 0, kelas: 1, username: 2, password: 3 }; }
      const data = rows.slice(hi + 1).filter(r => r.some(c => teks(c)) && teks(r[P.nama]));
      const ada = {}, adaNisn = {}; (state.guru.daftarSiswa || []).forEach(s => { ada[String(s.username).trim().toLowerCase()] = s; if (s.nisn) adaNisn[String(s.nisn)] = s; });
      const terpakai = Object.keys(ada); let nUser = 0, nPass = 0;
      const baru = [], ubah = [];
      data.forEach(r => {
        const nama = teks(r[P.nama]); let tempat = P.tempat !== undefined ? teks(r[P.tempat]) : '', tgl = P.tgl !== undefined ? r[P.tgl] : '';
        if (P.ttl !== undefined && teks(r[P.ttl])) { const t = teks(r[P.ttl]), k = t.indexOf(','); if (k > 0) { tempat = tempat || t.slice(0, k).trim(); tgl = tgl || t.slice(k + 1).trim(); } else tempat = tempat || t; }
        let nisn = P.nisn !== undefined ? teks(r[P.nisn]) : ''; if (/^\d{1,9}$/.test(nisn)) nisn = nisn.padStart(10, '0');
        let username = P.username !== undefined ? teks(r[P.username]) : '';
        let password = P.password !== undefined ? teks(r[P.password]) : '';
        const rec = { nama, nisn, tempat_lahir: tempat, tanggal_lahir: isoTgl(tgl), jenis_kelamin: P.jk !== undefined ? normJk(r[P.jk]) : '' };
        const kelas = kelasOverride || (P.kelas !== undefined ? teks(r[P.kelas]) : ''); if (kelas) rec.kelas = kelas;
        const lama = (username && ada[username.toLowerCase()]) || (nisn && adaNisn[nisn]) || null;
        if (lama) { if (password) rec.password = password; if (username) rec.username = username; ubah.push(Object.assign({}, rec, { id: lama.id })); return; }
        if (!username) { username = buatUsernameDariNama(nama, terpakai); nUser++; }
        terpakai.push(username.toLowerCase());
        if (!password) { password = buatPasswordAcak(); nPass++; }
        baru.push(Object.assign({ kelas: '' }, rec, { username, password }));
      });
      if (!baru.length && !ubah.length) { toast('Tidak ada baris valid. Pastikan ada kolom "Nama Peserta".', 'error'); ev.target.value = ''; return; }
      let gagal = '';
      if (baru.length) { const r = await api('importSiswa', { siswaList: JSON.stringify(baru) }); if (!r.ok) gagal = r.error; }
      for (const u of ubah) { const r = await api('updateSiswa', { siswa: JSON.stringify(u) }); if (!r.ok) gagal = r.error; }
      if (gagal) toast('Gagal impor: ' + gagal, 'error');
      else {
        let pesan = baru.length + ' siswa baru diimpor' + (ubah.length ? ', ' + ubah.length + ' siswa lama diperbarui' : '') + '.';
        if (nUser) pesan += ' ' + nUser + ' username dibuatkan otomatis.'; if (nPass) pesan += ' ' + nPass + ' password dibuatkan otomatis.';
        toast(pesan, 'success'); $('siswa-import-kelas').value = '';
      }
      Guru.muatDaftarSiswa(); ev.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  // ---------------- awal: #guru dan #u=..&p=.. (hasil memindai QR kartu) + captcha ----------------
  window.addEventListener('DOMContentLoaded', () => {
    buatCaptcha();
    const h = location.hash || '';
    if (/^#guru/i.test(h)) pilihPortal('guru');
    else if (/^#u=/.test(h)) {
      const q = new URLSearchParams(h.slice(1));
      if (q.get('u')) { $('login-username').value = q.get('u'); $('login-password').value = q.get('p') || ''; }
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* abaikan */ }
      setTimeout(() => { const b = $('skd-captcha-input'); if (b) b.focus(); }, 50);
    }
  });

  return { setUser, isoTgl, tglPanjang, toggleSandi, pilihPortal, buatCaptcha, tutupModal, renderSoal, qrMatrix, qrSvg, bukaKartuLogin, cetakKartuLogin,
    tampilDaftar, tampilInfo, mintaKonfirmasiMulai, mulaiUjian, lewatkan, toggleNav, tampilHasil, lihatHasil, tampilDashboard, sertifikatSesi, sertifikatTerpilih,
    muatTrenDashboard, muatTabMateri, isiPilihanSiswaMateri, muatAnalisisMateriGuru, ringkasanKelasMateri, grafikGaris, htmlAnalisisMateri, barcode39, hashHex, htmlSertifikat,
    tampilKonfirmasiData: tampilDaftar};
})();
window.Skd = Skd;
