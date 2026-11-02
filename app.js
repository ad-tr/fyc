(() => {
  const { $, clamp, wait, fmt, token, toast, pickMime, audioCtx, edgeColor, drawContain } = SR;

  // Résolution de rendu des slides
  const W = 1920, H = 1080;
  const THUMB = { w: 640, h: 360 };

  const bigCanvas = $('slideBig');
  const thumbCanvas = $('slideThumb');
  bigCanvas.width = W;
  bigCanvas.height = H;
  thumbCanvas.width = THUMB.w;
  thumbCanvas.height = THUMB.h;
  const camPreview = $('camPreview');
  const BG = token('--canvas-bg');

  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const s = {
    source: null, slides: [], script: null, count: 0, index: 0,
    textOn: true, textSize: 28,
    cache: new Map(), shown: null, loadToken: 0,
    camOn: true,
    camStream: null, micStream: null,
    // Prise en cours : une piste caméra et une piste voix séparées, plus la chronologie des slides
    take: null,
    counting: false, paused: false, elapsed: 0, lastTick: 0, shownSec: -1,
    project: null,
  };

  const editing = () => document.body.classList.contains('editing');

  /* ---------- Slides & script ---------- */

  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
  const stem = (name) => name.replace(/\.[^.]+$/, '').trim().toLowerCase();
  const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  const isImage = (f) => f.type.startsWith('image/');
  const isScript = (f) => /\.(md|markdown|txt)$/i.test(f.name);

  async function loadFiles(list) {
    if (s.take) return toast("Termine l'enregistrement avant de changer de diapo.");
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
    const old = s.source;
    // Le montage en cours peut encore avoir besoin de l'ancien PDF
    if (old?.kind === 'pdf' && old !== s.project?.source) old.doc.destroy();
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
    s.shown = null;
    s.index = 0;
    document.body.classList.toggle('loaded', s.count > 0);
    document.body.classList.toggle('has-script', !!script);
    updatePager();
    renderNote();
    if (s.count) go(0, true);
    if (info) toast(info);
  }

  // Rend une slide à partir d'une liste figée (le montage garde la sienne)
  async function renderSlide(slides, source, i) {
    const slide = slides[i];
    if (!slide) return null;
    if (slide.file) return createImageBitmap(slide.file);
    const page = await source.doc.getPage(slide.page);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(W / base.width, H / base.height) });
    const c = document.createElement('canvas');
    c.width = Math.round(viewport.width);
    c.height = Math.round(viewport.height);
    await page.render({ canvasContext: c.getContext('2d'), viewport }).promise;
    return c;
  }

  function getSlide(i) {
    if (!s.cache.has(i)) s.cache.set(i, renderSlide(s.slides, s.source, i).catch(() => null));
    return s.cache.get(i);
  }

  async function go(i, instant = false) {
    if (!s.count) return;
    i = clamp(i, 0, s.count - 1);
    if (i === s.index && s.shown && !instant) return;
    s.index = i;
    logSlide(i);
    updatePager();
    renderNote();

    const token = ++s.loadToken;
    const img = await getSlide(i);
    if (token !== s.loadToken || !img) return;
    showSlide(img);

    // Précharge les voisines, libère le reste
    [i + 1, i + 2, i - 1].forEach((j) => j >= 0 && j < s.count && getSlide(j));
    for (const k of s.cache.keys()) if (Math.abs(k - i) > 3) s.cache.delete(k);
  }

  function paint(c, img) {
    const g = c.getContext('2d');
    g.fillStyle = edgeColor(img) || BG;
    g.fillRect(0, 0, c.width, c.height);
    drawContain(g, img, { x: 0, y: 0, w: c.width, h: c.height });
  }

  function showSlide(img) {
    s.shown = img;
    paint(thumbCanvas, img);
    paint(bigCanvas, img);
  }

  function updatePager() {
    const label = s.count ? `${s.index + 1} / ${s.count}` : '– / –';
    $('counter').textContent = label;
    $('sideCounter').textContent = s.count ? label : '–';
    $('prev').disabled = !s.count || s.index === 0;
    $('next').disabled = !s.count || s.index === s.count - 1;
  }

  /* ---------- Texte ---------- */

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
    s.textSize = clamp(px, 16, 48);
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
      if (typeof p?.size === 'number') s.textSize = clamp(p.size, 16, 48);
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

  /* ---------- Caméra & micro ---------- */

  const VIDEO = { width: { ideal: 1280 }, height: { ideal: 720 } };
  const AUDIO = { echoCancellation: true, noiseSuppression: true };

  function attachCam(stream) {
    s.camStream?.getTracks().forEach((t) => t.stop());
    s.camStream = stream;
    camPreview.srcObject = stream;
    camPreview.play().catch(() => {});
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

  let analyser, meterBuf, level = 0;
  function hookMeter() {
    const track = s.micStream?.getAudioTracks()[0];
    if (!track) return;
    const ac = audioCtx();
    analyser = ac.createAnalyser();
    analyser.fftSize = 512;
    meterBuf = new Float32Array(analyser.fftSize);
    ac.createMediaStreamSource(s.micStream).connect(analyser);
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
  const resumeAudio = () => audioCtx().state === 'suspended' && audioCtx().resume();
  document.addEventListener('pointerdown', resumeAudio);
  document.addEventListener('keydown', resumeAudio);

  /* ---------- Enregistrement ---------- */

  // Temps enregistré (pauses exclues), en ms
  const recNow = () => s.elapsed + (s.take && !s.paused ? performance.now() - s.lastTick : 0);

  function logSlide(i) {
    const take = s.take;
    if (!take) return;
    const last = take.events[take.events.length - 1];
    if (last.index === i) return;
    const t = recNow();
    if (t - last.t < 1) last.index = i;
    else take.events.push({ t, index: i });
  }

  async function toggleRec() {
    if (s.counting) { s.counting = false; return; }
    if (s.take) return stopRec();
    if (!window.MediaRecorder) return toast("Ce navigateur ne sait pas enregistrer. Utilise Chrome.");
    if (!s.count) return toast("Charge d'abord tes slides.");

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

  function makeRecorder(track, kind) {
    const mime = pickMime(kind);
    const rec = new MediaRecorder(new MediaStream([track]), {
      mimeType: mime || undefined,
      ...(kind === 'video' ? { videoBitsPerSecond: 6_000_000 } : { audioBitsPerSecond: 192_000 }),
    });
    const r = { rec, mime, chunks: [] };
    rec.ondataavailable = (e) => e.data.size && r.chunks.push(e.data);
    r.stopped = new Promise((res) => { rec.onstop = res; });
    return r;
  }

  function startRec() {
    const camTrack = s.camOn ? s.camStream?.getVideoTracks()[0] : null;
    const micTrack = s.micStream?.getAudioTracks()[0];
    if (!camTrack && !micTrack) return toast('Ni caméra ni micro : rien à enregistrer.');
    if (!micTrack) toast('Pas de micro : la vidéo sera muette.');

    let cam = null, mic = null;
    try {
      cam = camTrack ? makeRecorder(camTrack, 'video') : null;
      mic = micTrack ? makeRecorder(micTrack, 'audio') : null;
    } catch (e) {
      return toast(`Enregistrement impossible : ${e.message}`);
    }

    s.take = { cam, mic, events: [{ t: 0, index: s.index }], marks: [] };
    cam?.rec.start(1000);
    mic?.rec.start(1000);

    s.elapsed = 0;
    s.shownSec = -1;
    s.paused = false;
    s.lastTick = performance.now();
    setRecUI(true);
  }

  async function stopRec() {
    const take = s.take;
    if (!take) return;
    const duration = recNow();
    s.take = null;
    for (const r of [take.cam, take.mic]) if (r && r.rec.state !== 'inactive') r.rec.stop();
    await Promise.all([take.cam?.stopped, take.mic?.stopped]);

    const toBlob = (r) => (r && r.chunks.length ? new Blob(r.chunks, { type: r.rec.mimeType || r.mime }) : null);
    s.project = {
      duration,
      events: take.events,
      marks: take.marks,
      cam: toBlob(take.cam),
      voice: toBlob(take.mic),
      source: s.source,
      slideCount: s.count,
      renderSlide: renderSlide.bind(null, s.slides, s.source),
      exported: false,
    };
    setRecUI(false);
    SR.editor.open(s.project);
  }

  function togglePause() {
    if (!s.take) return;
    for (const r of [s.take.cam, s.take.mic]) {
      if (!r) continue;
      if (s.paused) r.rec.resume(); else r.rec.pause();
    }
    s.paused = !s.paused;
    document.body.classList.toggle('paused', s.paused);
    $('pause').textContent = s.paused ? 'Reprendre' : 'Pause';
  }

  // Marque un raté : au montage, la phrase ratée sera proposée à la coupe
  function markRetake() {
    if (!s.take) return;
    s.take.marks.push(recNow());
    const n = s.take.marks.length;
    const el = $('markCount');
    el.hidden = false;
    el.textContent = `${n} raté${n > 1 ? 's' : ''}`;
    toast('Raté marqué. Reprends ta phrase.');
  }

  function setRecUI(on) {
    document.body.classList.toggle('recording', on);
    document.body.classList.remove('paused');
    $('recLabel').textContent = on ? 'Arrêter' : 'Enregistrer';
    $('pause').hidden = !on;
    $('pause').textContent = 'Pause';
    $('camSelect').disabled = $('micSelect').disabled = on;
    $('openEditor').hidden = on || !s.project;
    if (on) $('markCount').hidden = true;
    if (!on) $('timer').textContent = '00:00';
  }

  function tickTimer(now) {
    if (s.take && !s.paused) s.elapsed += now - s.lastTick;
    s.lastTick = now;
    if (!s.take) return;
    const sec = Math.floor(s.elapsed / 1000);
    if (sec !== s.shownSec) {
      s.shownSec = sec;
      $('timer').textContent = fmt(s.elapsed);
    }
  }

  function loop(now) {
    tickTimer(now);
    if (!editing()) tickMeter();
    requestAnimationFrame(loop);
  }

  window.addEventListener('beforeunload', (e) => {
    if (s.take || (s.project && !s.project.exported)) e.preventDefault();
  });

  /* ---------- UI ---------- */

  function toggleCam() {
    if (s.take) return toast('Tu pourras masquer la caméra au montage.');
    s.camOn = !s.camOn;
    $('camToggle').classList.toggle('on', s.camOn);
    document.body.classList.toggle('cam-off-state', !s.camOn);
  }

  // Le montage revient ici via ce rappel
  SR.onEditorClose = () => {
    $('openEditor').hidden = !s.project;
  };

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
  $('openEditor').addEventListener('click', () => s.project && SR.editor.open(s.project));
  $('textSmaller').addEventListener('click', () => setTextSize(s.textSize - 2));
  $('textBigger').addEventListener('click', () => setTextSize(s.textSize + 2));
  $('camSelect').addEventListener('change', (e) => startCam(e.target.value));
  $('micSelect').addEventListener('change', (e) => startMic(e.target.value));
  navigator.mediaDevices?.addEventListener?.('devicechange', listDevices);

  // Évite qu'Espace réactive le dernier bouton cliqué
  document.addEventListener('click', (e) => e.target.closest('button')?.blur());

  document.addEventListener('keydown', (e) => {
    if (editing()) return;
    if (e.target.matches('select, input') || e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': go(s.index + 1); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': go(s.index - 1); break;
      case 'Home': go(0); break;
      case 'End': go(s.count - 1); break;
      case 'r': case 'R': toggleRec(); break;
      case 'p': case 'P': togglePause(); break;
      case 'm': case 'M': markRetake(); break;
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
    if (editing()) return;
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
    if (editing()) return toast("Reviens à l'enregistrement pour changer de diapo.");
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

  loadTextPrefs();
  requestAnimationFrame(loop);
  initMedia();
  loadBundled();
})();
