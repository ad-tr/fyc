// Outils partagés entre l'enregistreur (app.js) et le montage (editor.js)
window.SR = (() => {
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Durée en ms -> "mm:ss" (ou "h:mm:ss")
  const fmt = (ms) => {
    const sec = Math.floor(ms / 1000);
    const h = Math.floor(sec / 3600);
    const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  // Secondes -> "mm:ss.d"
  const fmtTenths = (sec) => {
    const t = Math.max(0, sec);
    return `${fmt(t * 1000)}.${Math.floor((t * 10) % 10)}`;
  };

  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 4500);
  }

  const MIMES = {
    video: ['video/mp4;codecs=avc3.640028', 'video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'],
    audio: ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4'],
    both: [
      'video/mp4;codecs=avc3.640028,mp4a.40.2',
      'video/mp4;codecs=avc1.640028,mp4a.40.2',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ],
  };
  const pickMime = (kind) => (window.MediaRecorder && MIMES[kind].find((m) => MediaRecorder.isTypeSupported(m))) || '';

  let ac;
  const audioCtx = () => (ac ??= new AudioContext());

  // Couleur du bord d'une slide : sert de fond autour d'elle dans la vidéo
  const edgeCache = new WeakMap();
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const probeCtx = probe.getContext('2d', { willReadFrequently: true });

  function edgeColor(img) {
    if (!img) return null;
    if (edgeCache.has(img)) return edgeCache.get(img);
    const w = img.width, h = img.height, k = 4;
    const corners = [[1, 1], [w - k - 1, 1], [1, h - k - 1], [w - k - 1, h - k - 1]].map(([x, y]) => {
      probeCtx.clearRect(0, 0, 1, 1);
      probeCtx.drawImage(img, x, y, k, k, 0, 0, 1, 1);
      return [...probeCtx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    });
    // Le coin qui ressemble le plus aux autres (évite un logo dans un coin)
    const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    const best = corners
      .map((c) => ({ c, score: corners.reduce((n, o) => n + dist(c, o), 0) }))
      .sort((a, b) => a.score - b.score)[0].c;
    const color = `rgb(${best[0]}, ${best[1]}, ${best[2]})`;
    edgeCache.set(img, color);
    return color;
  }

  // Dessine une image centrée et entière dans une zone
  function drawContain(ctx, img, area, alpha = 1) {
    const scale = Math.min(area.w / img.width, area.h / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, area.x + (area.w - dw) / 2, area.y + (area.h - dh) / 2, dw, dh);
    ctx.globalAlpha = 1;
  }

  const stamp = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  };

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const extFor = (type, fallback = 'bin') => {
    if (/mp4/.test(type)) return type.startsWith('audio') ? 'm4a' : 'mp4';
    if (/webm/.test(type)) return 'webm';
    if (/ogg/.test(type)) return 'ogg';
    if (/wav/.test(type)) return 'wav';
    if (/mpeg/.test(type)) return 'mp3';
    return fallback;
  };

  return { $, clamp, ease, wait, fmt, fmtTenths, token, toast, pickMime, audioCtx, edgeColor, drawContain, stamp, download, extFor };
})();
