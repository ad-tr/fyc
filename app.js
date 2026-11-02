(() => {
  // Résolution de la vidéo enregistrée
  const W = 1920, H = 1080, FPS = 30;
  const DEFAULT_CAM = { w: 420, h: 560 }; // taille par défaut de la caméra, en px vidéo
  const MARGIN = 0; // écart entre la caméra et le bord de la vidéo
  const FADE_MS = 180;

  const $ = (id) => document.getElementById(id);
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();
  const COLORS = { bg: token('--canvas-bg'), shadow: token('--cam-shadow') };

  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;

  const s = {
    source: null, slides: [], script: null, count: 0, index: 0,
    textOn: true, textSize: 22,
    cache: new Map(), current: null, prev: null, fadeAt: 0, loadToken: 0,
    camOn: true, camAlpha: 1, corner: 'tr', camSize: { ...DEFAULT_CAM },
    bubble: null, drag: null,
    camStream: null, micStream: null,
    rec: null, recVideoTrack: null, chunks: [], mime: '',
    counting: false, paused: false, elapsed: 0, lastTick: 0, shownSec: -1,
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (ms) => {
    const sec = Math.floor(ms / 1000);
    const h = Math.floor(sec / 3600);
    const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 4500);
  }

  /* ---------- Slides & script ---------- */

  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
  const stem = (name) => name.replace(/\.[^.]+$/, '').trim().toLowerCase();
  const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  const isImage = (f) => f.type.startsWith('image/');
  const isScript = (f) => /\.(md|markdown|txt)$/i.test(f.name);

  async function loadFiles(list) {
    const files = [...list];
    const scripts = files.filter(isScript).sort(byName);
    const pdf = files.find(isPdf);
    const imgs = files.filter(isImage).sort(byName);
    if (!scripts.length && !pdf && !imgs.length) {
      return toast('Format non supporté. Slides : PDF ou images. Script : .md ou .txt.');
    }
    try {
      if (scripts.length) {
        const text = (await Promise.all(scripts.map((f) => f.text()))).join('\n\n');
        const sections = parseScript(text);
        if (sections.length) s.script = sections;
        else toast('Aucun texte trouvé dans le script. Format attendu : ## [Diapo nom-de-la-slide]');
      }
      if (pdf) {
        if (!window.pdfjsLib) throw new Error('pdf.js non chargé (connexion internet ?)');
        const doc = await pdfjsLib.getDocument({ data: await pdf.arrayBuffer() }).promise;
        setSource({ kind: 'pdf', doc, name: pdf.name });
      } else if (imgs.length) {
        setSource({ kind: 'img', files: imgs });
      }
      buildSlides();
    } catch (err) {
      toast(`Impossible de lire le fichier : ${err.message}`);
    }
  }

  function setSource(source) {
    if (s.source?.kind === 'pdf') s.source.doc.destroy();
    s.source = source;
  }

  /*
   * Format du script (Markdown) :
   *   # Titre de chapitre            -> affiché au-dessus du texte (optionnel)
   *   ## [Diapo nom-de-la-slide]     -> début du texte d'une slide
   *   Paragraphes...                 -> texte à lire
   *   *(indication)*                 -> didascalie, affichée à part
   * Images : "nom-de-la-slide" = nom du fichier sans extension.
   * PDF : sections dans l'ordre des pages, ou [Diapo 3] pour viser la page 3.
   * Sans aucun "## [...]", des lignes "---" séparent les slides.
   */
  function parseScript(text) {
    const sections = [];
    let chapter = '';
    let cur = null;
    const lines = text.split(/\r?\n/);
    const hasMarkers = lines.some((l) => /^##\s*\[[^\]]+\]/.test(l));

    if (!hasMarkers) {
      return text
        .split(/^\s*-{3,}\s*$/m)
        .map((block, i) => ({ id: String(i + 1), chapter: '', paras: toParas(block.split(/\r?\n/)) }))
        .filter((sec) => sec.paras.length);
    }

    for (const line of lines) {
      const marker = line.match(/^##\s*\[\s*(?:(?:diapo|slide)\s+)?([^\]]+?)\s*\]/i);
      if (marker) {
        cur = { id: marker[1], chapter, lines: [] };
        sections.push(cur);
        continue;
      }
      const title = line.match(/^#\s+(.+)$/);
      if (title) {
        chapter = title[1].trim();
        cur = null;
        continue;
      }
      if (cur) cur.lines.push(line);
    }
    return sections.map(({ id, chapter: ch, lines: ls }) => ({ id, chapter: ch, paras: toParas(ls) }));
  }

  function toParas(lines) {
    return lines
      .join('\n')
      .replace(/<!--[\s\S]*?-->/g, '')
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
      .filter(Boolean);
  }

  // Associe chaque slide à son texte
  function buildSlides() {
    const src = s.source;
    const script = s.script;
    let slides = [];
    let info = '';

    if (src?.kind === 'pdf') {
      const n = src.doc.numPages;
      const numbered = script?.every((sec) => /^\d+$/.test(sec.id));
      slides = Array.from({ length: n }, (_, i) => ({
        page: i + 1,
        note: (script && (numbered ? script.find((sec) => +sec.id === i + 1) : script[i])) || null,
      }));
      info = `${src.name} · ${n} slides`;
      if (script && !numbered && script.length !== n) info += ` · attention : ${script.length} textes pour ${n} pages`;
    } else if (src?.kind === 'img') {
      const files = src.files;
      // "24-2.4-mint.png" et "2.4-mint.png" correspondent tous deux à [Diapo 2.4-mint]
      const byStem = new Map();
      for (const f of files) {
        const name = stem(f.name);
        byStem.set(name, f);
        const unnumbered = name.replace(/^\d{2,3}[-_ ]+/, "");
        if (!byStem.has(unnumbered)) byStem.set(unnumbered, f);
      }
      const used = new Set();
      if (script) {
        for (const note of script) {
          const f = byStem.get(note.id.toLowerCase());
          if (f && !used.has(f)) {
            used.add(f);
            slides.push({ file: f, note });
          }
        }
      }
      if (script && !used.size) {
        // Aucun nom ne correspond : association dans l'ordre
        slides = files.map((f, i) => ({ file: f, note: script[i] || null }));
      } else {
        files.forEach((f) => used.has(f) || slides.push({ file: f, note: null }));
      }
      info = `${files.length} image${files.length > 1 ? 's' : ''}`;
      if (script) {
        const matched = slides.filter((sl) => sl.note).length;
        info += ` · ${matched} texte${matched > 1 ? 's' : ''} associé${matched > 1 ? 's' : ''}`;
        const orphans = script.length - matched;
        if (orphans > 0) info += ` · ${orphans} sans image`;
      }
    } else if (script) {
      info = `Script chargé : ${script.length} textes. Glisse maintenant tes slides.`;
    }

    s.slides = slides;
    s.count = slides.length;
    s.cache.clear();
    s.current = s.prev = null;
    s.index = 0;
    document.body.classList.toggle('loaded', s.count > 0);
    document.body.classList.toggle('has-script', !!script);
    updatePager();
    renderNote();
    if (s.count) go(0, true);
    if (info) toast(info);
  }

  async function renderSlide(i) {
    const slide = s.slides[i];
    if (slide.file) return createImageBitmap(slide.file);
    const page = await s.source.doc.getPage(slide.page);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(W / base.width, H / base.height) });
    const c = document.createElement('canvas');
    c.width = Math.round(viewport.width);
    c.height = Math.round(viewport.height);
    await page.render({ canvasContext: c.getContext('2d'), viewport }).promise;
    return c;
  }

  function getSlide(i) {
    if (!s.cache.has(i)) s.cache.set(i, renderSlide(i).catch(() => null));
    return s.cache.get(i);
  }

  async function go(i, instant = false) {
    if (!s.count) return;
    i = clamp(i, 0, s.count - 1);
    if (i === s.index && s.current && !instant) return;
    s.index = i;
    updatePager();
    renderNote();

    const token = ++s.loadToken;
    const img = await getSlide(i);
    if (token !== s.loadToken || !img) return;

    s.prev = instant ? null : s.current;
    s.current = img;
    s.fadeAt = performance.now();

    // Précharge les voisines, libère le reste
    [i + 1, i + 2, i - 1].forEach((j) => j >= 0 && j < s.count && getSlide(j));
    for (const k of s.cache.keys()) if (Math.abs(k - i) > 3) s.cache.delete(k);
  }

  function updatePager() {
    $('counter').textContent = s.count ? `${s.index + 1} / ${s.count}` : '– / –';
    $('prev').disabled = !s.count || s.index === 0;
    $('next').disabled = !s.count || s.index === s.count - 1;
  }

  /* ---------- Panneau texte ---------- */

  const TEXT_KEY = 'slide-recorder:text';
  const escapeHtml = (str) =>
    str.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function inline(p) {
    return escapeHtml(p)
      .replace(/\*\((.+?)\)\*/g, '<span class="cue">$1</span>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }

  function plain(p) {
    return p.replace(/\*\(.+?\)\*/g, '').replace(/[*`]/g, '').trim();
  }

  function firstWords(p, n = 10) {
    const words = plain(p).split(/\s+/);
    return words.slice(0, n).join(' ') + (words.length > n ? '…' : '');
  }

  function renderNote() {
    if (!s.script) return;
    const note = s.slides[s.index]?.note;
    const body = $('noteBody');

    $('noteChapter').textContent = note?.chapter || '';
    $('noteId').textContent = note?.id || (s.count ? `Slide ${s.index + 1}` : '');

    if (!s.count) body.innerHTML = `<p class="note-empty">${s.script.length} textes chargés. Glisse maintenant tes slides.</p>`;
    else if (!note) body.innerHTML = '<p class="note-empty">Pas de texte pour cette slide.</p>';
    else body.innerHTML = note.paras.map((p) => `<p>${inline(p)}</p>`).join('');
    body.scrollTop = 0;

    const next = s.slides[s.index + 1]?.note;
    const nextEl = $('noteNext');
    nextEl.hidden = !next;
    if (next) {
      const label = next.chapter && next.chapter !== note?.chapter ? next.chapter : next.id;
      nextEl.innerHTML = `<span>Ensuite</span> ${escapeHtml(label)} · ${escapeHtml(firstWords(next.paras[0] || ''))}`;
    }
  }

  function setTextSize(px) {
    s.textSize = clamp(px, 14, 44);
    document.documentElement.style.setProperty('--note-size', `${s.textSize}px`);
    saveTextPrefs();
  }

  function toggleText() {
    if (!s.script) return;
    s.textOn = !s.textOn;
    document.body.classList.toggle('text-off', !s.textOn);
    $('textToggle').classList.toggle('on', s.textOn);
    saveTextPrefs();
  }

  function loadTextPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(TEXT_KEY));
      if (typeof p?.size === 'number') s.textSize = clamp(p.size, 14, 44);
      if (p?.on === false) s.textOn = false;
    } catch {}
    document.documentElement.style.setProperty('--note-size', `${s.textSize}px`);
    document.body.classList.toggle('text-off', !s.textOn);
    $('textToggle').classList.toggle('on', s.textOn);
  }

  function saveTextPrefs() {
    try {
      localStorage.setItem(TEXT_KEY, JSON.stringify({ size: s.textSize, on: s.textOn }));
    } catch {}
  }

  /* ---------- Rendu ---------- */

  function bubbleTarget() {
    const { w, h } = s.camSize;
    return {
      x: s.corner.includes('l') ? MARGIN + w / 2 : W - MARGIN - w / 2,
      y: s.corner.includes('t') ? MARGIN + h / 2 : H - MARGIN - h / 2,
      w,
      h,
    };
  }

  function drawSlide(img, alpha) {
    const scale = Math.min(W / img.width, H / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.globalAlpha = 1;
  }

  function drawCam() {
    const b = s.bubble;
    const tg = bubbleTarget();
    const k = 0.18;
    if (!s.drag) for (const key of ['x', 'y', 'w', 'h']) b[key] += (tg[key] - b[key]) * k;
    s.camAlpha += ((s.camOn ? 1 : 0) - s.camAlpha) * 0.2;

    if (s.camAlpha < 0.01 || !video.videoWidth) return;
    const { x, y, w, h } = b;
    const left = x - w / 2, top = y - h / 2;
    const ratio = w / h;

    ctx.save();
    ctx.globalAlpha = s.camAlpha;
    ctx.shadowColor = COLORS.shadow;
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(left, top, w, h);
    ctx.shadowColor = 'transparent';

    // Crop centré dans l'image de la webcam au ratio du cadre, en miroir
    const vw = video.videoWidth, vh = video.videoHeight;
    let sw = vw, sh = vw / ratio;
    if (sh > vh) { sh = vh; sw = vh * ratio; }
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function frame(now) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    const t = Math.min(1, (now - s.fadeAt) / FADE_MS);
    if (s.prev && t < 1) drawSlide(s.prev, 1);
    if (s.current) drawSlide(s.current, s.prev ? ease(t) : 1);
    if (t >= 1) s.prev = null;

    drawCam();
    tickTimer(now);
    tickMeter();
    requestAnimationFrame(frame);
  }

  /* ---------- Caméra : déplacer & redimensionner ---------- */

  const EDGE = 28; // zone de prise des bords, en px vidéo
  const MIN_W = 120, MIN_H = 120;
  const PREFS_KEY = 'slide-recorder:cam';

  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * W) / rect.width, y: ((e.clientY - rect.top) * H) / rect.height };
  }

  function camBox() {
    const { x, y, w, h } = s.bubble;
    return { l: x - w / 2, t: y - h / 2, r: x + w / 2, b: y + h / 2 };
  }

  // null = hors caméra, { move } = intérieur, sinon les bords attrapés
  function camHit(p) {
    if (!s.camOn) return null;
    const box = camBox();
    const pad = EDGE / 2;
    if (p.x < box.l - pad || p.x > box.r + pad || p.y < box.t - pad || p.y > box.b + pad) return null;
    const e = {
      l: Math.abs(p.x - box.l) < EDGE,
      r: Math.abs(p.x - box.r) < EDGE,
      t: Math.abs(p.y - box.t) < EDGE,
      b: Math.abs(p.y - box.b) < EDGE,
    };
    return e.l || e.r || e.t || e.b ? e : { move: true };
  }

  function cursorFor(hit) {
    if (!hit) return '';
    if (hit.move) return 'grab';
    if ((hit.l && hit.t) || (hit.r && hit.b)) return 'nwse-resize';
    if ((hit.r && hit.t) || (hit.l && hit.b)) return 'nesw-resize';
    return hit.l || hit.r ? 'ew-resize' : 'ns-resize';
  }

  function fitSize(w, h) {
    return { w: clamp(w, MIN_W, W - MARGIN * 2), h: clamp(h, MIN_H, H - MARGIN * 2) };
  }

  function loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY));
      if (p?.w > 0 && p?.h > 0) s.camSize = fitSize(p.w, p.h);
      if (/^[tb][lr]$/.test(p?.corner)) s.corner = p.corner;
    } catch {}
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ ...s.camSize, corner: s.corner }));
    } catch {}
  }

  canvas.addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    const hit = camHit(p);
    if (!hit) return;
    s.drag = { hit, p0: p, box: camBox() };
    canvas.setPointerCapture(e.pointerId);
    if (hit.move) canvas.style.cursor = 'grabbing';
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = toCanvas(e);
    if (!s.drag) {
      canvas.style.cursor = cursorFor(camHit(p));
      return;
    }
    const { hit, p0, box } = s.drag;
    const dx = p.x - p0.x, dy = p.y - p0.y;
    let { l, t, r, b } = box;
    if (hit.move) {
      const w = r - l, h = b - t;
      l = clamp(l + dx, 0, W - w);
      t = clamp(t + dy, 0, H - h);
      r = l + w;
      b = t + h;
    } else {
      if (hit.l) l = clamp(l + dx, 0, r - MIN_W);
      if (hit.r) r = clamp(r + dx, l + MIN_W, W);
      if (hit.t) t = clamp(t + dy, 0, b - MIN_H);
      if (hit.b) b = clamp(b + dy, t + MIN_H, H);
    }
    Object.assign(s.bubble, { x: (l + r) / 2, y: (t + b) / 2, w: r - l, h: b - t });
  });

  const endDrag = (e) => {
    if (!s.drag) return;
    s.drag = null;
    s.camSize = fitSize(s.bubble.w, s.bubble.h);
    s.corner = (s.bubble.y < H / 2 ? 't' : 'b') + (s.bubble.x < W / 2 ? 'l' : 'r');
    canvas.style.cursor = cursorFor(camHit(toCanvas(e)));
    savePrefs();
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // Double-clic sur la caméra : taille par défaut
  canvas.addEventListener('dblclick', (e) => {
    if (!camHit(toCanvas(e))) return;
    s.camSize = { ...DEFAULT_CAM };
    savePrefs();
  });

  /* ---------- Caméra & micro ---------- */

  const VIDEO = { width: { ideal: 1280 }, height: { ideal: 720 } };
  const AUDIO = { echoCancellation: true, noiseSuppression: true };

  function attachCam(stream) {
    s.camStream?.getTracks().forEach((t) => t.stop());
    s.camStream = stream;
    video.srcObject = stream;
    video.play().catch(() => {});
  }

  function attachMic(stream) {
    s.micStream?.getTracks().forEach((t) => t.stop());
    s.micStream = stream;
    hookMeter();
  }

  async function startCam(deviceId) {
    try {
      attachCam(await navigator.mediaDevices.getUserMedia({
        video: { ...VIDEO, deviceId: deviceId ? { exact: deviceId } : undefined },
      }));
    } catch (e) {
      toast(`Caméra inaccessible : ${e.message}`);
    }
  }

  async function startMic(deviceId) {
    try {
      attachMic(await navigator.mediaDevices.getUserMedia({
        audio: { ...AUDIO, deviceId: deviceId ? { exact: deviceId } : undefined },
      }));
    } catch (e) {
      toast(`Micro inaccessible : ${e.message}`);
    }
  }

  async function initMedia() {
    if (!navigator.mediaDevices?.getUserMedia) {
      return toast('Ce navigateur ne donne pas accès à la caméra. Ouvre la page dans Chrome.');
    }
    try {
      // Une seule demande de permission pour les deux
      const st = await navigator.mediaDevices.getUserMedia({ video: VIDEO, audio: AUDIO });
      attachCam(new MediaStream(st.getVideoTracks()));
      attachMic(new MediaStream(st.getAudioTracks()));
    } catch {
      await startCam();
      await startMic();
    }
    listDevices();
  }

  async function listDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const fill = (wrap, select, kind, stream) => {
      const list = devices.filter((d) => d.kind === kind);
      const current = stream?.getTracks()[0]?.getSettings().deviceId;
      select.innerHTML = '';
      list.forEach((d, i) => select.add(new Option(d.label || `Appareil ${i + 1}`, d.deviceId, false, d.deviceId === current)));
      wrap.hidden = list.length < 2;
    };
    fill($('camWrap'), $('camSelect'), 'videoinput', s.camStream);
    fill($('micWrap'), $('micSelect'), 'audioinput', s.micStream);
  }

  let audioCtx, analyser, meterBuf, level = 0;
  function hookMeter() {
    const track = s.micStream?.getAudioTracks()[0];
    if (!track) return;
    audioCtx ??= new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    meterBuf = new Float32Array(analyser.fftSize);
    audioCtx.createMediaStreamSource(s.micStream).connect(analyser);
  }

  function tickMeter() {
    if (!analyser) return;
    analyser.getFloatTimeDomainData(meterBuf);
    let sum = 0;
    for (const v of meterBuf) sum += v * v;
    const target = Math.min(1, Math.sqrt(sum / meterBuf.length) * 5);
    level += (target - level) * (target > level ? 0.5 : 0.1);
    $('meterFill').style.transform = `scaleX(${level.toFixed(3)})`;
  }

  // L'AudioContext ne démarre qu'après une interaction
  const resumeAudio = () => audioCtx?.state === 'suspended' && audioCtx.resume();
  document.addEventListener('pointerdown', resumeAudio);
  document.addEventListener('keydown', resumeAudio);

  /* ---------- Enregistrement ---------- */

  function pickMime() {
    if (!window.MediaRecorder) return '';
    return [
      'video/mp4;codecs=avc1.640028,mp4a.40.2',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find((m) => MediaRecorder.isTypeSupported(m)) || '';
  }

  async function toggleRec() {
    if (s.counting) { s.counting = false; return; }
    if (s.rec) return stopRec();
    if (!window.MediaRecorder) return toast("Ce navigateur ne sait pas enregistrer. Utilise Chrome.");

    s.counting = true;
    const el = $('countdown');
    el.hidden = false;
    for (let n = 3; n > 0 && s.counting; n--) {
      el.textContent = n;
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
      await wait(1000);
    }
    el.hidden = true;
    const confirmed = s.counting;
    s.counting = false;
    if (confirmed) startRec();
  }

  function startRec() {
    const vTrack = canvas.captureStream(FPS).getVideoTracks()[0];
    const tracks = [vTrack];
    const mic = s.micStream?.getAudioTracks()[0];
    if (mic) tracks.push(mic);
    else toast('Pas de micro : la vidéo sera muette.');

    s.mime = pickMime();
    try {
      s.rec = new MediaRecorder(new MediaStream(tracks), {
        mimeType: s.mime || undefined,
        videoBitsPerSecond: 8_000_000,
        audioBitsPerSecond: 128_000,
      });
    } catch (e) {
      vTrack.stop();
      return toast(`Enregistrement impossible : ${e.message}`);
    }

    s.recVideoTrack = vTrack;
    s.chunks = [];
    s.rec.ondataavailable = (e) => e.data.size && s.chunks.push(e.data);
    s.rec.onstop = saveRec;
    s.rec.start(1000);

    s.elapsed = 0;
    s.shownSec = -1;
    s.paused = false;
    s.lastTick = performance.now();
    setRecUI(true);
  }

  function stopRec() {
    if (s.rec && s.rec.state !== 'inactive') s.rec.stop();
  }

  function togglePause() {
    if (!s.rec) return;
    if (s.paused) s.rec.resume(); else s.rec.pause();
    s.paused = !s.paused;
    document.body.classList.toggle('paused', s.paused);
    $('pause').textContent = s.paused ? 'Reprendre' : 'Pause';
  }

  function saveRec() {
    const type = s.rec.mimeType || s.mime || 'video/webm';
    const blob = new Blob(s.chunks, { type });
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const name = `enregistrement-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.${ext}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);

    s.recVideoTrack?.stop();
    s.rec = s.recVideoTrack = null;
    s.chunks = [];
    setRecUI(false);
    toast(`Enregistré (${fmt(s.elapsed)}) : ${name}`);
  }

  function setRecUI(on) {
    document.body.classList.toggle('recording', on);
    document.body.classList.remove('paused');
    $('recLabel').textContent = on ? 'Arrêter' : 'Enregistrer';
    $('pause').hidden = !on;
    $('pause').textContent = 'Pause';
    $('camSelect').disabled = $('micSelect').disabled = on;
    if (!on) $('timer').textContent = '00:00';
  }

  function tickTimer(now) {
    if (s.rec && !s.paused) s.elapsed += now - s.lastTick;
    s.lastTick = now;
    if (!s.rec) return;
    const sec = Math.floor(s.elapsed / 1000);
    if (sec !== s.shownSec) {
      s.shownSec = sec;
      $('timer').textContent = fmt(s.elapsed);
    }
  }

  window.addEventListener('beforeunload', (e) => {
    if (s.rec) e.preventDefault();
  });

  /* ---------- UI ---------- */

  function toggleCam() {
    s.camOn = !s.camOn;
    $('camToggle').classList.toggle('on', s.camOn);
  }

  $('file').addEventListener('change', (e) => {
    if (e.target.files.length) loadFiles(e.target.files);
    e.target.value = '';
  });
  $('prev').addEventListener('click', () => go(s.index - 1));
  $('next').addEventListener('click', () => go(s.index + 1));
  $('rec').addEventListener('click', toggleRec);
  $('pause').addEventListener('click', togglePause);
  $('camToggle').addEventListener('click', toggleCam);
  $('textToggle').addEventListener('click', toggleText);
  $('textSmaller').addEventListener('click', () => setTextSize(s.textSize - 2));
  $('textBigger').addEventListener('click', () => setTextSize(s.textSize + 2));
  $('camSelect').addEventListener('change', (e) => startCam(e.target.value));
  $('micSelect').addEventListener('change', (e) => startMic(e.target.value));
  navigator.mediaDevices?.addEventListener?.('devicechange', listDevices);

  // Évite qu'Espace réactive le dernier bouton cliqué
  document.addEventListener('click', (e) => e.target.closest('button')?.blur());

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('select, input') || e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': go(s.index + 1); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': go(s.index - 1); break;
      case 'Home': go(0); break;
      case 'End': go(s.count - 1); break;
      case 'r': case 'R': toggleRec(); break;
      case 'p': case 'P': togglePause(); break;
      case 'c': case 'C': toggleCam(); break;
      case 't': case 'T': toggleText(); break;
      case '+': case '=': setTextSize(s.textSize + 2); break;
      case '-': setTextSize(s.textSize - 2); break;
      case 'f': case 'F':
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.();
        break;
      case 'Escape': if (s.counting) s.counting = false; else return; break;
      default: return;
    }
    e.preventDefault();
  });

  // Glisser-déposer sur toute la fenêtre
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth++;
    document.body.classList.add('over');
  });
  window.addEventListener('dragleave', () => {
    if (--dragDepth <= 0) {
      dragDepth = 0;
      document.body.classList.remove('over');
    }
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    document.body.classList.remove('over');
    if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files);
  });

  /* ---------- Diapo fourni avec l'app ---------- */

  // Si un dossier slides/ avec un manifest.json est servi à côté de l'app,
  // ses fichiers (images, PDF, script) sont chargés au démarrage.
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf', md: 'text/markdown', txt: 'text/plain' };

  async function loadBundled() {
    try {
      const res = await fetch('slides/manifest.json', { cache: 'no-cache' });
      if (!res.ok) return;
      const { files } = await res.json();
      if (!Array.isArray(files) || !files.length) return;
      toast('Chargement du diapo…');
      const loaded = await Promise.all(files.map(async (name) => {
        const r = await fetch(`slides/${encodeURIComponent(name)}`);
        if (!r.ok) throw new Error(name);
        const blob = await r.blob();
        const ext = name.split('.').pop().toLowerCase();
        return new File([blob], name, { type: MIME[ext] || blob.type });
      }));
      await loadFiles(loaded);
    } catch {
      // Pas de diapo fourni (ou page ouverte en file://) : on attend un glisser-déposer
    }
  }

  /* ---------- Go ---------- */

  loadPrefs();
  loadTextPrefs();
  s.bubble = bubbleTarget();
  requestAnimationFrame(frame);
  initMedia();
  loadBundled();
})();
