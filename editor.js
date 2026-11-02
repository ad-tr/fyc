(() => {
  const { $, clamp, ease, wait, fmt, fmtTenths, token, toast, pickMime, audioCtx, edgeColor, drawContain, stamp, download, extFor } = SR;

  // Vidéo finale
  const W = 1920, H = 1080, FPS = 30;
  const FADE = 0.18;               // fondu entre deux slides (s)
  const CAM = { w: 480, h: 660 };  // caméra à la taille 100 % (px vidéo), collée au bord
  const HOP = 0.01;                // pas d'analyse de la voix (s)
  const PAD = 0.15;                // marge gardée autour d'une coupe de silence (s)
  const MAX_PPS = 400, ZOOM = 1.6; // zoom de la frise (px par seconde)
  const LAYOUT_KEY = 'slide-recorder:layout';

  const canvas = $('edCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  const COLORS = {
    bg: token('--canvas-bg'),
    wave: token('--wave'),
    waveCut: token('--wave-cut'),
    muted: token('--muted'),
    line: token('--line'),
    mono: token('--mono'),
  };

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  const scroller = $('tlScroll');
  const tl = $('tl');

  const e = {
    p: null, dur: 0, events: [], marks: [],
    hasCam: false, camUrl: null,
    buffer: null, voiceFile: null, frames: null, thr: 0, peak: 1,
    cuts: [], proposals: [], history: [],
    layout: { corner: 'br', scale: 1, hidden: false },
    volume: 1, gain: null,
    t: 0, playing: false, playFrom: 0, playAt: 0, src: null,
    sel: null, drag: null, camDrag: false,
    pps: 1, minPps: 1,
    cache: new Map(),
    job: null, running: false,
  };

  /* ---------- Ouverture ---------- */

  function open(p) {
    document.body.classList.add('editing');
    $('recorder').hidden = true;
    $('editor').hidden = false;
    if (!e.running) {
      e.running = true;
      requestAnimationFrame(loop);
    }
    if (p === e.p) return requestAnimationFrame(() => { fitIfNeeded(); renderTimeline(); });

    pause();
    e.p = p;
    e.dur = Math.max(0.1, p.duration / 1000);
    e.events = p.events.map((ev) => ({ t: ev.t / 1000, index: ev.index }));
    e.marks = p.marks.map((m) => m / 1000);
    e.cuts = [];
    e.history = [];
    e.sel = null;
    e.t = 0;
    for (const c of e.cache.values()) c.img?.close?.();
    e.cache.clear();

    if (e.camUrl) URL.revokeObjectURL(e.camUrl);
    e.hasCam = !!p.cam?.size;
    e.camUrl = e.hasCam ? URL.createObjectURL(p.cam) : null;
    if (e.camUrl) video.src = e.camUrl;
    else { video.removeAttribute('src'); video.load(); }
    document.body.classList.toggle('no-cam', !e.hasCam);

    e.buffer = e.frames = null;
    e.voiceFile = p.voice;
    e.proposals = markProposals();

    renderPanel();
    renderInfo();
    requestAnimationFrame(() => { fitZoom(); renderTimeline(); });
    if (p.voice?.size) loadVoice(p.voice, false);
    else $('edSilence').disabled = $('edVoiceDl').disabled = true;
  }

  function close() {
    if (e.job) return;
    pause();
    document.body.classList.remove('editing');
    $('editor').hidden = true;
    $('recorder').hidden = false;
    SR.onEditorClose?.();
  }

  function renderInfo() {
    const used = new Set(e.events.map((ev) => ev.index)).size;
    const n = e.marks.length;
    $('edInfo').textContent = [
      `${fmt(e.dur * 1000)} enregistrées`,
      `${used} slide${used > 1 ? 's' : ''}`,
      n ? `${n} raté${n > 1 ? 's' : ''} marqué${n > 1 ? 's' : ''}` : '',
      e.hasCam ? '' : 'sans caméra',
      e.p.voice ? '' : 'sans voix',
    ].filter(Boolean).join(' · ');
    const final = keptSegments().reduce((sum, sg) => sum + sg.b - sg.a, 0);
    $('edFinal').textContent = e.cuts.length ? `durée finale ${fmt(final * 1000)}` : '';
    $('edUndo').disabled = !e.history.length;
  }

  /* ---------- Voix : décodage et analyse ---------- */

  async function loadVoice(blob, replacing) {
    $('edSilence').disabled = true;
    try {
      const buf = await audioCtx().decodeAudioData(await blob.arrayBuffer());
      e.buffer = buf;
      e.voiceFile = blob;
      analyse();
      e.proposals = markProposals();
      if (replacing) {
        if (e.playing) startAt(now());
        const gap = buf.duration - e.dur;
        toast(Math.abs(gap) > 1
          ? `Voix remplacée. Attention : ${Math.abs(gap).toFixed(1)} s de ${gap > 0 ? 'plus' : 'moins'} que la caméra.`
          : 'Voix remplacée.');
      }
    } catch (err) {
      toast(`Impossible de lire la voix : ${err.message || 'format non supporté'}`);
    }
    $('edSilence').disabled = !e.frames;
    $('edVoiceDl').disabled = !e.voiceFile;
    renderOverlays();
    drawWave();
  }

  // Volume moyen par tranche de 10 ms
  function analyse() {
    const data = e.buffer.getChannelData(0);
    const step = Math.max(1, Math.round(e.buffer.sampleRate * HOP));
    const n = Math.ceil(data.length / step);
    const f = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const end = Math.min(data.length, (i + 1) * step);
      let sum = 0;
      for (let j = i * step; j < end; j++) sum += data[j] * data[j];
      f[i] = Math.sqrt(sum / Math.max(1, end - i * step));
    }
    const sorted = Float32Array.from(f).sort();
    const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] || 0;
    const lo = at(0.1), hi = at(0.95);
    e.frames = f;
    e.thr = lo + (hi - lo) * 0.12;
    e.peak = Math.max(at(0.99), 1e-4);
  }

  function silenceRuns(minLen) {
    const f = e.frames;
    if (!f) return [];
    const runs = [];
    let start = -1;
    for (let i = 0; i <= f.length; i++) {
      const quiet = i < f.length && f[i] < e.thr;
      if (quiet && start < 0) start = i;
      else if (!quiet && start >= 0) {
        const a = start * HOP, b = Math.min(i * HOP, e.dur);
        if (b - a >= minLen && a < e.dur) runs.push({ a, b });
        start = -1;
      }
    }
    return runs;
  }

  /* ---------- Propositions : silences et ratés ---------- */

  function findSilences() {
    const min = parseFloat($('edSilenceMin').value);
    const list = silenceRuns(min)
      .map((r) => ({
        a: r.a <= 0.02 ? 0 : r.a + PAD,
        b: r.b >= e.dur - 0.05 ? e.dur : r.b - PAD,
        kind: 'silence',
      }))
      .filter((r) => r.b - r.a >= 0.2 && !e.cuts.some((c) => r.a < c.b && r.b > c.a));
    e.proposals = e.proposals.filter((p) => p.kind !== 'silence').concat(list);
    renderOverlays();
    toast(list.length ? `${list.length} silence${list.length > 1 ? 's' : ''} trouvé${list.length > 1 ? 's' : ''}.` : 'Aucun silence de cette durée.');
  }

  // Pour chaque raté marqué : de la pause qui précède la phrase ratée jusqu'à la reprise
  function markProposals() {
    const runs = silenceRuns(0.3);
    return e.marks
      .map((m) => {
        if (!runs.length) return { a: Math.max(0, m - 3), b: m, kind: 'mark' };
        const k = runs.findIndex((r) => r.b > m);
        const next = k >= 0 && runs[k].a < m + 8 ? runs[k] : null;
        const prevRun = k < 0 ? runs[runs.length - 1] : runs[k - 1];
        const prev = prevRun && prevRun.b > m - 20 ? prevRun : null;
        const a = prev ? Math.max(prev.a, prev.b - 0.12) : Math.max(0, m - 3);
        const b = next ? Math.max(next.a, next.b - 0.12) : Math.min(e.dur, m + 0.3);
        return { a, b, kind: 'mark' };
      })
      .filter((p) => p.b - p.a > 0.1 && !e.cuts.some((c) => p.a >= c.a && p.b <= c.b));
  }

  /* ---------- Coupes ---------- */

  function snapshot() {
    e.history.push({ cuts: e.cuts.map((c) => ({ ...c })), proposals: e.proposals.map((p) => ({ ...p })) });
    if (e.history.length > 100) e.history.shift();
  }

  function merge(list, a, b) {
    const out = [];
    for (const c of list) {
      if (c.b < a || c.a > b) out.push(c);
      else { a = Math.min(a, c.a); b = Math.max(b, c.b); }
    }
    out.push({ a, b });
    return out.sort((x, y) => x.a - y.a);
  }

  function addCuts(ranges) {
    const valid = ranges
      .map((r) => ({ a: clamp(r.a, 0, e.dur), b: clamp(r.b, 0, e.dur) }))
      .filter((r) => r.b - r.a >= 0.02);
    if (!valid.length) return;
    snapshot();
    for (const r of valid) e.cuts = merge(e.cuts, r.a, r.b);
    e.proposals = e.proposals.filter((p) => !e.cuts.some((c) => p.a >= c.a - 0.01 && p.b <= c.b + 0.01));
    changed();
  }

  function cutSelection() {
    if (!e.sel) return;
    const { a, b } = e.sel;
    e.sel = null;
    addCuts([{ a, b }]);
    seek(Math.min(b, e.dur));
  }

  function removeCut(i) {
    snapshot();
    e.cuts.splice(i, 1);
    changed();
  }

  function acceptProposal(i) {
    const p = e.proposals[i];
    if (p) addCuts([p]);
  }

  function acceptAll(kind) {
    addCuts(e.proposals.filter((p) => p.kind === kind));
  }

  function clearProposals(kind) {
    e.proposals = e.proposals.filter((p) => p.kind !== kind);
    renderOverlays();
  }

  function undo() {
    const prev = e.history.pop();
    if (!prev) return;
    e.cuts = prev.cuts;
    e.proposals = prev.proposals;
    changed();
  }

  function changed() {
    renderOverlays();
    renderSel();
    renderInfo();
    drawWave();
  }

  const cutAt = (t) => e.cuts.find((c) => t >= c.a && t < c.b);

  function skipCuts(t) {
    let c;
    while ((c = cutAt(t))) t = c.b;
    return t;
  }

  function keptSegments() {
    const segs = [];
    let t = 0;
    for (const c of e.cuts) {
      if (c.a > t) segs.push({ a: t, b: c.a });
      t = Math.max(t, c.b);
    }
    if (t < e.dur) segs.push({ a: t, b: e.dur });
    return segs;
  }

  /* ---------- Lecture ---------- */

  function gainNode() {
    if (!e.gain) {
      e.gain = audioCtx().createGain();
      e.gain.connect(audioCtx().destination);
    }
    e.gain.gain.value = e.volume;
    return e.gain;
  }

  const now = () => (e.playing ? Math.max(e.playFrom, e.playFrom + audioCtx().currentTime - e.playAt) : e.t);

  function stopSources() {
    try { e.src?.stop(); } catch {}
    e.src?.disconnect();
    e.src = null;
  }

  function startAt(t) {
    stopSources();
    const ac = audioCtx();
    e.playFrom = t;
    e.playAt = ac.currentTime + 0.04;
    if (e.buffer && t < e.buffer.duration) {
      const src = ac.createBufferSource();
      src.buffer = e.buffer;
      src.connect(gainNode());
      src.start(e.playAt, t);
      e.src = src;
    }
    if (e.hasCam) {
      video.currentTime = t;
      video.play().catch(() => {});
    }
  }

  function play() {
    if (!e.p || e.job) return;
    audioCtx().resume();
    let t = e.t >= e.dur - 0.05 ? 0 : e.t;
    t = skipCuts(t);
    if (t >= e.dur) return;
    e.t = t;
    e.playing = true;
    startAt(t);
    document.body.classList.add('playing');
  }

  function pause() {
    if (!e.playing) return;
    e.t = clamp(now(), 0, e.dur);
    e.playing = false;
    stopSources();
    video.pause();
    document.body.classList.remove('playing');
  }

  function seek(t) {
    e.t = clamp(t, 0, e.dur);
    if (e.playing) startAt(skipCuts(e.t));
    else seekVideo(e.t);
  }

  let pendingSeek = null;
  function seekVideo(t) {
    if (!e.hasCam) return;
    if (video.seeking) { pendingSeek = t; return; }
    video.currentTime = t;
  }
  video.addEventListener('seeked', () => {
    if (pendingSeek == null) return;
    const t = pendingSeek;
    pendingSeek = null;
    video.currentTime = t;
  });

  function seekTo(t) {
    return new Promise((res) => {
      if (!video.seeking && Math.abs(video.currentTime - t) < 0.01) return res();
      const done = () => { clearTimeout(timer); video.removeEventListener('seeked', done); res(); };
      const timer = setTimeout(done, 3000);
      video.addEventListener('seeked', done);
      video.currentTime = t;
    });
  }

  // Garde la caméra calée sur la voix : petit ajustement de vitesse, ou saut si trop loin
  function syncVideo(t) {
    if (!e.hasCam || video.seeking || video.paused || video.ended) return;
    const d = video.currentTime - t;
    if (Math.abs(d) > 0.3) video.currentTime = t;
    else video.playbackRate = Math.abs(d) > 0.04 ? clamp(1 - d * 2, 0.9, 1.1) : 1;
  }

  function loop() {
    if (!document.body.classList.contains('editing')) { e.running = false; return; }
    if (e.job) tickExport();
    else if (e.playing) {
      const t = now();
      const c = cutAt(t);
      if (c && c.b < e.dur - 0.01) { e.t = c.b; startAt(c.b); }
      else if (c || t >= e.dur) { pause(); e.t = c ? c.a : e.dur; }
      else { e.t = t; syncVideo(t); }
    }
    const t = e.job ? e.job.t : e.t;
    prefetch(t);
    draw(t);
    renderHead();
    requestAnimationFrame(loop);
  }

  /* ---------- Rendu d'une image de la vidéo ---------- */

  function layoutRects() {
    const { corner, scale, hidden } = e.layout;
    if (hidden || !e.hasCam) return { slide: { x: 0, y: 0, w: W, h: H }, cam: null };
    const cw = Math.round(CAM.w * scale), ch = Math.round(CAM.h * scale);
    const right = corner[1] === 'r', top = corner[0] === 't';
    return {
      cam: { x: right ? W - cw : 0, y: top ? 0 : H - ch, w: cw, h: ch },
      // La slide occupe la largeur restante : la caméra ne passe jamais dessus
      slide: { x: right ? 0 : cw, y: 0, w: W - cw, h: H },
    };
  }

  function eventIndex(t) {
    let lo = 0, hi = e.events.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (e.events[mid].t <= t) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  function slideEntry(i) {
    let c = e.cache.get(i);
    if (!c) {
      c = { img: null };
      c.promise = e.p.renderSlide(i).then((img) => (c.img = img)).catch(() => null);
      e.cache.set(i, c);
    }
    return c;
  }

  const slideImg = (i) => (i == null ? null : slideEntry(i).img);

  function wanted(t) {
    const k = eventIndex(t);
    const set = new Set();
    for (let j = Math.max(0, k - 1); j <= Math.min(e.events.length - 1, k + 3); j++) set.add(e.events[j].index);
    return set;
  }

  function prefetch(t) {
    if (!e.p) return;
    const want = wanted(t);
    want.forEach(slideEntry);
    if (e.cache.size <= 12) return;
    for (const [key, c] of e.cache) {
      if (want.has(key)) continue;
      c.img?.close?.();
      e.cache.delete(key);
      if (e.cache.size <= 8) break;
    }
  }

  const ensureSlides = (t) => Promise.all([...wanted(t)].map((i) => slideEntry(i).promise));

  function draw(t) {
    if (!e.p) return;
    const L = layoutRects();
    const k = eventIndex(t);
    const ev = e.events[k];
    const cur = slideImg(ev?.index);
    const prev = k > 0 ? slideImg(e.events[k - 1].index) : null;
    const f = ev ? (t - ev.t) / FADE : 1;

    ctx.fillStyle = edgeColor(cur || prev) || COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    if (prev && (f < 1 || !cur)) drawContain(ctx, prev, L.slide);
    if (cur) drawContain(ctx, cur, L.slide, prev && f < 1 ? ease(clamp(f, 0, 1)) : 1);
    if (L.cam && video.readyState >= 2) drawCam(L.cam);
  }

  function drawCam(r) {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw) return;
    // Recadrage centré au format du cadre, en miroir
    const ratio = r.w / r.h;
    let sw = vw, sh = vw / ratio;
    if (sh > vh) { sh = vh; sw = vh * ratio; }
    ctx.save();
    ctx.translate(r.x + r.w, r.y);
    ctx.scale(-1, 1);
    ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, r.w, r.h);
    ctx.restore();
  }

  /* ---------- Frise ---------- */

  const x = (t) => t * e.pps;
  const timeAt = (clientX) => clamp((clientX - tl.getBoundingClientRect().left) / e.pps, 0, e.dur);

  function fitZoom() {
    e.minPps = Math.max(0.01, scroller.clientWidth / e.dur);
    e.pps = e.minPps;
  }

  function fitIfNeeded() {
    const atMin = Math.abs(e.pps - e.minPps) < 1e-6;
    e.minPps = Math.max(0.01, scroller.clientWidth / e.dur);
    e.pps = atMin ? e.minPps : Math.max(e.pps, e.minPps);
  }

  function zoom(factor) {
    const anchor = e.playing ? now() : e.t;
    const offset = x(anchor) - scroller.scrollLeft;
    e.pps = clamp(e.pps * factor, e.minPps, MAX_PPS);
    renderTimeline();
    scroller.scrollLeft = x(anchor) - offset;
    drawRuler();
    drawWave();
  }

  function renderTimeline() {
    if (!e.p) return;
    tl.style.width = `${x(e.dur)}px`;
    $('laneSlides').innerHTML = e.events.map((ev, i) => {
      const end = e.events[i + 1]?.t ?? e.dur;
      return `<div class="blk" style="left:${x(ev.t)}px;width:${Math.max(1, x(end) - x(ev.t))}px">${ev.index + 1}</div>`;
    }).join('');
    renderOverlays();
    renderSel();
    drawRuler();
    drawWave();
    renderHead();
  }

  function renderOverlays() {
    if (!e.p) return;
    const span = (r) => `left:${x(r.a)}px;width:${Math.max(2, x(r.b) - x(r.a))}px`;
    $('tlOverlay').innerHTML = [
      ...e.proposals.map((p, i) => `<div class="ov prop ${p.kind}" data-prop="${i}" style="${span(p)}" title="${p.kind === 'mark' ? 'Raté marqué' : 'Silence'} · clic pour couper"></div>`),
      ...e.cuts.map((c, i) => `<div class="ov cut" data-cut="${i}" style="${span(c)}" title="Passage coupé · clic pour le remettre"></div>`),
      ...e.marks.map((m) => `<div class="flag" style="left:${x(m)}px"></div>`),
    ].join('');
    renderProps();
  }

  function renderProps() {
    const count = (kind) => e.proposals.filter((p) => p.kind === kind).length;
    const chip = (kind, label) => {
      const n = count(kind);
      if (!n) return '';
      return `<span class="chip">${n} ${label}${n > 1 ? 's' : ''}<button data-all="${kind}">Tout couper</button><button class="x" data-clear="${kind}" aria-label="Ignorer">✕</button></span>`;
    };
    $('edProps').innerHTML = chip('silence', 'silence') + chip('mark', 'raté');
  }

  function renderSel() {
    const el = $('tlSel');
    el.hidden = !e.sel;
    if (e.sel) {
      el.style.left = `${x(e.sel.a)}px`;
      el.style.width = `${Math.max(1, x(e.sel.b) - x(e.sel.a))}px`;
    }
    $('edCut').disabled = !e.sel;
  }

  let lastShown = -1;
  function renderHead() {
    if (!e.p) return;
    const t = e.job ? e.job.t : e.playing ? now() : e.t;
    const px = x(t);
    $('tlHead').style.transform = `translateX(${px}px)`;
    if (e.playing || e.job) {
      const view = scroller.clientWidth;
      if (px < scroller.scrollLeft || px > scroller.scrollLeft + view - 40) scroller.scrollLeft = px - 40;
    }
    const tenth = Math.floor(t * 10);
    if (tenth !== lastShown) {
      lastShown = tenth;
      $('edTime').textContent = fmtTenths(t);
    }
  }

  function prepCanvas(c, w, h) {
    const dpr = window.devicePixelRatio || 1;
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return g;
  }

  function drawRuler() {
    if (!e.p) return;
    const c = $('tlRuler');
    const w = scroller.clientWidth, h = 22;
    const g = prepCanvas(c, w, h);
    const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    const step = steps.find((s) => s * e.pps >= 72) || 600;
    const t0 = scroller.scrollLeft / e.pps, t1 = (scroller.scrollLeft + w) / e.pps;
    g.font = `11px ${COLORS.mono}`;
    g.textBaseline = 'middle';
    for (let t = Math.floor(t0 / step) * step; t <= t1; t += step) {
      const px = Math.round(x(t) - scroller.scrollLeft) + 0.5;
      g.fillStyle = COLORS.line;
      g.fillRect(px, h - 6, 1, 6);
      g.fillStyle = COLORS.muted;
      g.fillText(fmt(t * 1000), px + 4, h / 2 - 1);
    }
  }

  function drawWave() {
    if (!e.p) return;
    const c = $('tlWave');
    const lane = $('laneVoice');
    const w = scroller.clientWidth, h = lane.clientHeight;
    c.style.left = `${scroller.scrollLeft}px`;
    const g = prepCanvas(c, w, h);
    const f = e.frames;
    if (!f) return;
    const mid = h / 2;
    for (let px = 0; px < w; px++) {
      const t0 = (scroller.scrollLeft + px) / e.pps;
      if (t0 > e.dur) break;
      const i0 = Math.floor(t0 / HOP);
      const i1 = Math.max(i0 + 1, Math.ceil((t0 + 1 / e.pps) / HOP));
      let m = 0;
      for (let i = i0; i < i1 && i < f.length; i++) if (f[i] > m) m = f[i];
      const amp = Math.min(1, Math.sqrt(m / e.peak)) * (mid - 3);
      g.fillStyle = cutAt(t0) ? COLORS.waveCut : COLORS.wave;
      g.fillRect(px, mid - amp, 1, Math.max(1, amp * 2));
    }
  }

  let scrollRaf = 0;
  scroller.addEventListener('scroll', () => {
    cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(() => { drawRuler(); drawWave(); });
  });

  window.addEventListener('resize', () => {
    if (!document.body.classList.contains('editing') || !e.p) return;
    fitIfNeeded();
    renderTimeline();
  });

  // Glisser = sélectionner · clic = se placer · clic sur une zone = couper ou remettre
  tl.addEventListener('pointerdown', (ev) => {
    if (!e.p || e.job || ev.button !== 0) return;
    const hit = ev.target.closest('[data-cut], [data-prop]');
    if (hit?.dataset.cut != null) return removeCut(+hit.dataset.cut);
    if (hit?.dataset.prop != null) return acceptProposal(+hit.dataset.prop);
    const t = timeAt(ev.clientX);
    e.drag = { t0: t, x0: ev.clientX, moved: false };
    tl.setPointerCapture(ev.pointerId);
    e.sel = null;
    renderSel();
    seek(t);
  });

  tl.addEventListener('pointermove', (ev) => {
    if (!e.drag) return;
    if (!e.drag.moved && Math.abs(ev.clientX - e.drag.x0) < 4) return;
    e.drag.moved = true;
    const t = timeAt(ev.clientX);
    e.sel = { a: Math.min(t, e.drag.t0), b: Math.max(t, e.drag.t0) };
    renderSel();
  });

  const endDrag = () => {
    if (!e.drag) return;
    e.drag = null;
    if (e.sel && e.sel.b - e.sel.a < 0.05) e.sel = null;
    renderSel();
  };
  tl.addEventListener('pointerup', endDrag);
  tl.addEventListener('pointercancel', endDrag);

  /* ---------- Aperçu : glisser la caméra vers un coin ---------- */

  function toVideo(ev) {
    const r = canvas.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) * W) / r.width, y: ((ev.clientY - r.top) * H) / r.height };
  }

  const inCam = (p) => {
    const c = layoutRects().cam;
    return c && p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h;
  };

  canvas.addEventListener('pointerdown', (ev) => {
    if (!e.p || e.job) return;
    if (inCam(toVideo(ev))) {
      e.camDrag = true;
      canvas.setPointerCapture(ev.pointerId);
      canvas.style.cursor = 'grabbing';
    } else {
      e.playing ? pause() : play();
    }
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!e.camDrag) canvas.style.cursor = e.p && inCam(toVideo(ev)) ? 'grab' : 'pointer';
  });
  canvas.addEventListener('pointerup', (ev) => {
    if (!e.camDrag) return;
    e.camDrag = false;
    const p = toVideo(ev);
    setLayout({ corner: (p.y < H / 2 ? 't' : 'b') + (p.x < W / 2 ? 'l' : 'r') });
    canvas.style.cursor = 'grab';
  });

  /* ---------- Panneau ---------- */

  function loadLayout() {
    try {
      const l = JSON.parse(localStorage.getItem(LAYOUT_KEY));
      if (/^[tb][lr]$/.test(l?.corner)) e.layout.corner = l.corner;
      if (typeof l?.scale === 'number') e.layout.scale = clamp(l.scale, 0.7, 1.3);
      if (typeof l?.hidden === 'boolean') e.layout.hidden = l.hidden;
    } catch {}
  }

  function setLayout(patch) {
    Object.assign(e.layout, patch);
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(e.layout)); } catch {}
    renderPanel();
  }

  function renderPanel() {
    const { corner, scale, hidden } = e.layout;
    document.querySelectorAll('#edCorner button').forEach((b) => b.classList.toggle('on', b.dataset.corner === corner));
    $('edCamToggle').classList.toggle('on', !hidden);
    $('edCamToggle').textContent = hidden ? 'Masquée' : 'Visible';
    $('edCamSize').value = Math.round(scale * 100);
    document.body.classList.toggle('cam-hidden', hidden);
    const off = !e.hasCam;
    $('edCamToggle').disabled = $('edCamSize').disabled = off;
    document.querySelectorAll('#edCorner button').forEach((b) => (b.disabled = off));
  }

  $('edCorner').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-corner]');
    if (b) setLayout({ corner: b.dataset.corner, hidden: false });
  });
  $('edCamToggle').addEventListener('click', () => setLayout({ hidden: !e.layout.hidden }));
  $('edCamSize').addEventListener('input', (ev) => setLayout({ scale: ev.target.value / 100 }));

  $('edVolume').addEventListener('input', (ev) => {
    e.volume = ev.target.value / 100;
    $('edVolumeOut').textContent = `${ev.target.value} %`;
    if (e.gain) e.gain.gain.value = e.volume;
  });

  $('edVoiceFile').addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (file && e.p) loadVoice(file, true);
  });

  const voiceName = () => e.voiceFile?.name || `voix-${stamp()}.${extFor(e.voiceFile?.type || '', 'webm')}`;
  $('edVoiceDl').addEventListener('click', () => e.voiceFile && download(e.voiceFile, voiceName()));

  /* ---------- Export ---------- */

  async function exportVideo() {
    if (e.job) { e.job.cancel = true; return; }
    if (!e.p) return;
    if (!window.MediaRecorder) return toast("Ce navigateur ne sait pas exporter. Utilise Chrome.");
    pause();
    const segs = keptSegments().filter((sg) => sg.b - sg.a > 0.04);
    if (!segs.length) return toast('Tout est coupé : rien à exporter.');

    const ac = audioCtx();
    await ac.resume();
    const mime = pickMime('both');
    const vTrack = canvas.captureStream(FPS).getVideoTracks()[0];
    const tracks = [vTrack];
    let g = null;
    if (e.buffer) {
      const dest = ac.createMediaStreamDestination();
      g = ac.createGain();
      g.gain.value = e.volume;
      g.connect(dest);
      tracks.push(dest.stream.getAudioTracks()[0]);
    }

    let rec;
    try {
      rec = new MediaRecorder(new MediaStream(tracks), {
        mimeType: mime || undefined,
        videoBitsPerSecond: 10_000_000,
        audioBitsPerSecond: 192_000,
      });
    } catch (err) {
      vTrack.stop();
      g?.disconnect();
      return toast(`Export impossible : ${err.message}`);
    }
    const chunks = [];
    rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    const stopped = new Promise((r) => { rec.onstop = r; });

    const total = segs.reduce((n, sg) => n + sg.b - sg.a, 0);
    const job = (e.job = { cancel: false, reason: '', t: segs[0].a, done: 0, total, seg: null });
    setExportUI(true);

    try {
      for (const seg of segs) {
        if (job.cancel) break;
        job.t = seg.a;
        await ensureSlides(seg.a);
        if (e.hasCam) { video.pause(); video.playbackRate = 1; await seekTo(seg.a); }
        if (job.cancel) break;

        const at = ac.currentTime + 0.12;
        let src = null;
        if (e.buffer && seg.a < e.buffer.duration) {
          src = ac.createBufferSource();
          src.buffer = e.buffer;
          src.connect(g);
          src.start(at, seg.a, seg.b - seg.a);
        }
        await wait(Math.max(0, (at - ac.currentTime) * 1000));
        if (e.hasCam) video.play().catch(() => {});
        if (rec.state === 'inactive') rec.start(1000); else rec.resume();

        await new Promise((res) => { job.seg = { ...seg, at, res }; });

        if (rec.state === 'recording') rec.pause();
        video.pause();
        try { src?.stop(); } catch {}
        src?.disconnect();
        job.done += seg.b - seg.a;
      }
    } finally {
      if (rec.state !== 'inactive') rec.stop();
      await stopped;
      vTrack.stop();
      g?.disconnect();
      e.job = null;
      setExportUI(false);
      seek(e.t);
    }

    if (job.cancel) return toast(job.reason || 'Export annulé.');
    const type = rec.mimeType || mime || 'video/webm';
    download(new Blob(chunks, { type }), `video-${stamp()}.${extFor(type, 'webm')}`);
    e.p.exported = true;
    toast(`Vidéo exportée (${fmt(total * 1000)}).`);
  }

  function tickExport() {
    const j = e.job;
    const seg = j.seg;
    if (seg) {
      const t = seg.a + Math.max(0, audioCtx().currentTime - seg.at);
      if (j.cancel || t >= seg.b) {
        j.t = Math.min(t, seg.b);
        j.seg = null;
        seg.res();
      } else {
        j.t = t;
        syncVideo(t);
      }
    }
    const progress = (j.done + (seg ? j.t - seg.a : 0)) / j.total;
    $('edProgressFill').style.transform = `scaleX(${clamp(progress, 0, 1).toFixed(4)})`;
  }

  function setExportUI(on) {
    document.body.classList.toggle('exporting', on);
    $('edProgress').hidden = !on;
    $('edProgressFill').style.transform = 'scaleX(0)';
    $('edExport').textContent = on ? "Annuler l'export" : 'Exporter la vidéo';
  }

  // En arrière-plan, le navigateur ralentit le rendu : l'export serait décalé
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (e.job) {
      e.job.cancel = true;
      e.job.reason = "Export interrompu : garde l'onglet visible pendant l'export.";
    }
    pause();
  });

  async function exportTracks() {
    if (!e.p) return;
    const st = stamp();
    const files = [];
    if (e.p.cam) files.push([e.p.cam, `camera-${st}.${extFor(e.p.cam.type, 'webm')}`]);
    if (e.voiceFile) files.push([e.voiceFile, voiceName()]);
    const timeline = {
      duration: e.dur,
      slides: e.events.map((ev) => ({ time: ev.t, slide: ev.index + 1 })),
      retakes: e.marks,
      cuts: e.cuts,
      camera: e.layout,
      volume: e.volume,
    };
    files.push([new Blob([JSON.stringify(timeline, null, 2)], { type: 'application/json' }), `montage-${st}.json`]);
    for (const [blob, name] of files) {
      download(blob, name);
      await wait(400);
    }
    toast(`${files.length} fichiers téléchargés : caméra, voix et chronologie des slides.`);
  }

  /* ---------- Boutons & clavier ---------- */

  $('edBack').addEventListener('click', close);
  $('edPlay').addEventListener('click', () => (e.playing ? pause() : play()));
  $('edCut').addEventListener('click', cutSelection);
  $('edSilence').addEventListener('click', findSilences);
  $('edUndo').addEventListener('click', undo);
  $('edZoomIn').addEventListener('click', () => zoom(ZOOM));
  $('edZoomOut').addEventListener('click', () => zoom(1 / ZOOM));
  $('edExport').addEventListener('click', exportVideo);
  $('edTracks').addEventListener('click', exportTracks);
  $('edProps').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (b?.dataset.all) acceptAll(b.dataset.all);
    else if (b?.dataset.clear) clearProposals(b.dataset.clear);
  });

  document.addEventListener('keydown', (ev) => {
    if (!document.body.classList.contains('editing')) return;
    if (ev.target.matches('input, select, textarea')) return;
    const mod = ev.metaKey || ev.ctrlKey;
    if (e.job) {
      if (ev.key === 'Escape') e.job.cancel = true;
      return;
    }
    if (mod && ev.key.toLowerCase() === 'z') { undo(); ev.preventDefault(); return; }
    if (mod || ev.altKey) return;
    const t = e.playing ? now() : e.t;
    const step = ev.shiftKey ? 5 : 1;
    switch (ev.key) {
      case ' ': e.playing ? pause() : play(); break;
      case 'ArrowLeft': seek(t - step); break;
      case 'ArrowRight': seek(t + step); break;
      case 'Home': seek(0); break;
      case 'End': seek(e.dur); break;
      case 'Backspace': case 'Delete': case 'x': case 'X': cutSelection(); break;
      case 'Escape': e.sel = null; renderSel(); break;
      case '+': case '=': zoom(ZOOM); break;
      case '-': zoom(1 / ZOOM); break;
      default: return;
    }
    ev.preventDefault();
  });

  loadLayout();
  renderPanel();

  SR.editor = { open, close };
})();
