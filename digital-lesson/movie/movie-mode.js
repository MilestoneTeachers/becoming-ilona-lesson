/**
 * Becoming Ilona — Festival Cut, movie-mode player engine.
 *
 * Public surface:
 *   - MovieMode.open({ timelineSrc }) — launches the stage
 *   - MovieMode.close() — exits the stage
 *
 * Internal pure helpers exported for unit tests:
 *   - parseTimeline(json) — validates a timeline.json payload
 *   - beatAtTime(timeline, t) — returns active beat at time t, or null
 *   - chapterAtTime(timeline, t) — returns active chapter at time t, or null
 */

export function parseTimeline(json) {
  if (!json || typeof json !== "object") {
    throw new Error("timeline must be an object");
  }
  if (typeof json.totalDurationSeconds !== "number" || json.totalDurationSeconds <= 0) {
    throw new Error("totalDurationSeconds must be positive");
  }
  if (!Array.isArray(json.chapters) || json.chapters.length === 0) {
    throw new Error("chapters must be a non-empty array");
  }
  // Detect overlaps and beat-out-of-bounds.
  for (let i = 0; i < json.chapters.length; i++) {
    const ch = json.chapters[i];
    if (ch.endSeconds <= ch.startSeconds) {
      throw new Error(`chapter ${ch.id} has non-positive duration`);
    }
    if (i > 0 && ch.startSeconds < json.chapters[i - 1].endSeconds) {
      throw new Error(`chapter ${ch.id} overlaps previous chapter`);
    }
    for (const beat of ch.beats || []) {
      if (beat.startSeconds < ch.startSeconds || beat.endSeconds > ch.endSeconds) {
        throw new Error(`beat in ${ch.id} extends past chapter bounds`);
      }
    }
  }
  return json;
}

export function chapterAtTime(timeline, t) {
  // Inclusive of startSeconds, exclusive of endSeconds — so an exact boundary
  // (t === previous.endSeconds === next.startSeconds) belongs to NEXT chapter
  // via the >= match. parseTimeline rejects overlaps + zero-duration chapters,
  // so this single pass is sufficient.
  for (const ch of timeline.chapters) {
    if (t >= ch.startSeconds && t < ch.endSeconds) return ch;
  }
  return null;
}

export function beatAtTime(timeline, t) {
  const ch = chapterAtTime(timeline, t);
  if (!ch) return null;
  for (const beat of ch.beats || []) {
    if (t >= beat.startSeconds && t < beat.endSeconds) return beat;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Stage launcher + player engine
// ---------------------------------------------------------------------------

let _stageEl = null;
let _state = null;

function _q(parent, sel) { return parent.querySelector(sel); }

async function _loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load ${url}: ${res.status}`);
  return res.json();
}

function _parseVTT(vttText) {
  const cues = [];
  const blocks = vttText.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split(/\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const timingLine = lines.find(l => l.includes("-->"));
    if (!timingLine) continue;
    const [from, to] = timingLine.split("-->").map(s => s.trim().split(" ")[0]);
    const text = lines.slice(lines.indexOf(timingLine) + 1).join(" ").trim();
    if (!text) continue;
    cues.push({ start: _vttTime(from), end: _vttTime(to), text });
  }
  return cues;
}

function _vttTime(s) {
  const parts = s.split(":").map(parseFloat);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parseFloat(s);
}

function _captionAtTime(cues, t) {
  for (const c of cues) {
    if (t >= c.start && t <= c.end) return c.text;
  }
  return "";
}

function _buildStageDOM() {
  const stage = document.createElement("div");
  stage.className = "movie-mode-stage";
  stage.setAttribute("role", "application");
  stage.setAttribute("aria-label", "Becoming Ilona, festival cut film player");
  stage.innerHTML = `
    <div class="movie-mode-stage__letterbox-top"></div>
    <div class="movie-mode-stage__viewport">
      <div class="movie-mode-stage__beat-layer" data-beat-layer></div>
      <div class="movie-mode-stage__captions" data-captions>
        <span class="movie-mode-stage__caption-text" data-caption-text></span>
      </div>
      <div class="movie-mode-stage__pause-panel" hidden data-pause-panel>
        <p class="movie-mode-stage__pause-eyebrow" data-pause-eyebrow></p>
        <p class="movie-mode-stage__pause-prompt" data-pause-prompt></p>
        <p class="movie-mode-stage__pause-framing" data-pause-framing></p>
        <button class="movie-mode-stage__pause-continue" data-pause-continue>Continue ▸</button>
      </div>
      <div class="movie-mode-stage__loading" data-loading>Loading the film…</div>
      <div class="movie-mode-stage__controls" data-controls>
        <button class="movie-mode-stage__btn" data-btn-play>▶ Play</button>
        <span class="movie-mode-stage__chapter-label" data-chapter-label>Ch 1 / 4</span>
        <div class="movie-mode-stage__timeline" data-timeline>
          <div class="movie-mode-stage__timeline-fill" data-timeline-fill></div>
        </div>
        <button class="movie-mode-stage__btn" data-btn-cc>CC</button>
        <button class="movie-mode-stage__btn" data-btn-fs>⛶</button>
        <button class="movie-mode-stage__btn" data-btn-exit aria-label="Exit film">Exit ✕</button>
      </div>
    </div>
    <div class="movie-mode-stage__letterbox-bottom"></div>
  `;
  return stage;
}

async function _setupAudio(state, timeline) {
  const narrAudio = new Audio(state.resolveAsset(timeline.narration.src));
  narrAudio.preload = "auto";
  state.narrationAudio = narrAudio;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  state.audioCtx = new AudioCtx();
  state.musicTracks = {};
  for (const [id, track] of Object.entries(timeline.musicTracks || {})) {
    const audio = new Audio(state.resolveAsset(track.src));
    audio.preload = "auto";
    audio.loop = !!track.loop;
    audio.addEventListener("error", () => {
      console.warn(`[movie-mode] music track ${id} failed to load — playing silent for this cue`);
    });
    try {
      const src = state.audioCtx.createMediaElementSource(audio);
      const gain = state.audioCtx.createGain();
      gain.gain.value = 0;
      src.connect(gain).connect(state.audioCtx.destination);
      state.musicTracks[id] = { audio, gain, config: track };
    } catch (e) {
      console.warn(`[movie-mode] failed to wire music track ${id}:`, e);
    }
  }
}

function _setMusicForChapter(state, chapterMusicCue) {
  for (const [id, t] of Object.entries(state.musicTracks)) {
    if (id === chapterMusicCue) {
      if (t.audio.paused) t.audio.play().catch(() => {});
      t.gain.gain.cancelScheduledValues(state.audioCtx.currentTime);
      t.gain.gain.linearRampToValueAtTime(t.config.volume ?? 0.35, state.audioCtx.currentTime + 0.6);
    } else {
      t.gain.gain.cancelScheduledValues(state.audioCtx.currentTime);
      t.gain.gain.linearRampToValueAtTime(0.0, state.audioCtx.currentTime + 0.6);
    }
  }
}

function _duckMusic(state, isNarrating) {
  for (const [, t] of Object.entries(state.musicTracks)) {
    if (!t.config.duckOnNarration) continue;
    const target = isNarrating ? (t.config.duckLevel ?? 0.12) : (t.config.volume ?? 0.35);
    if (t.gain.gain.value > 0.01) {
      t.gain.gain.cancelScheduledValues(state.audioCtx.currentTime);
      t.gain.gain.linearRampToValueAtTime(target, state.audioCtx.currentTime + 0.4);
    }
  }
}

function _renderBeat(state, beat) {
  if (!beat) {
    state.beatLayer.innerHTML = "";
    state.currentBeatId = null;
    return;
  }
  const beatId = `${beat.type}-${beat.startSeconds}`;
  if (beatId === state.currentBeatId) return;
  state.currentBeatId = beatId;

  const oldChildren = Array.from(state.beatLayer.children);
  oldChildren.forEach(c => {
    c.style.opacity = "0";
    setTimeout(() => c.remove(), 1000);
  });

  const resolveAsset = state.resolveAsset;
  let el;
  switch (beat.type) {
    case "title":
    case "remotion-moment":
    case "veo-atmospheric":
    case "end-credits":
      el = document.createElement("video");
      el.src = resolveAsset(beat.asset);
      el.autoplay = true;
      el.muted = true;
      el.playsInline = true;
      el.loop = !!beat.loop || beat.type === "veo-atmospheric";
      el.addEventListener("error", () => console.warn(`[movie-mode] video failed: ${beat.asset}`));
      break;
    case "ken-burns-photo":
      el = document.createElement("img");
      el.src = resolveAsset(beat.asset);
      el.className = "ken-burns";
      el.addEventListener("error", () => console.warn(`[movie-mode] photo failed: ${beat.asset}`));
      break;
    case "then-now-slider": {
      el = document.createElement("div");
      el.style.position = "absolute";
      el.style.inset = "0";
      el.style.overflow = "hidden";
      const leftImg = document.createElement("img");
      leftImg.src = resolveAsset(beat.leftSrc);
      leftImg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;";
      const rightImg = document.createElement("img");
      rightImg.src = resolveAsset(beat.rightSrc);
      rightImg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;clip-path:inset(0 0 0 0%);";
      rightImg.dataset.thenNowRight = "true";
      el.appendChild(leftImg);
      el.appendChild(rightImg);
      break;
    }
    case "map-flyover":
      el = document.createElement("div");
      el.textContent = "[map flyover placeholder]";
      el.style.cssText = "color:#E8B341;font-size:24px;display:flex;align-items:center;justify-content:center;width:100%;height:100%;";
      break;
    case "music-cue-overlay":
      return;
    default:
      el = document.createElement("div");
      el.textContent = `[unknown beat: ${beat.type}]`;
  }

  el.style.opacity = "0";
  state.beatLayer.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; });
}

function _updateKenBurns(state, beat, beatProgress) {
  if (beat.type !== "ken-burns-photo") return;
  const img = state.beatLayer.querySelector("img.ken-burns");
  if (!img) return;
  const fromX = beat.panFrom?.x ?? 0.5;
  const fromY = beat.panFrom?.y ?? 0.5;
  const fromZ = beat.panFrom?.zoom ?? 1.0;
  const toX = beat.panTo?.x ?? 0.5;
  const toY = beat.panTo?.y ?? 0.5;
  const toZ = beat.panTo?.zoom ?? 1.0;
  const x = fromX + (toX - fromX) * beatProgress;
  const y = fromY + (toY - fromY) * beatProgress;
  const z = fromZ + (toZ - fromZ) * beatProgress;
  img.style.transform = `scale(${z}) translate(${(0.5 - x) * 100}%, ${(0.5 - y) * 100}%)`;
}

function _updateThenNow(state, beat, beatProgress) {
  if (beat.type !== "then-now-slider") return;
  const rightImg = state.beatLayer.querySelector("[data-then-now-right]");
  if (!rightImg) return;
  const wipePct = beatProgress * 100;
  rightImg.style.clipPath = `inset(0 0 0 ${wipePct}%)`;
}

function _updateCaptions(state, t) {
  const text = _captionAtTime(state.captions || [], t);
  state.captionText.textContent = text;
}

function _updateControls(state, t) {
  const pct = (t / state.timeline.totalDurationSeconds) * 100;
  state.timelineFill.style.width = `${Math.min(100, pct)}%`;
  const ch = chapterAtTime(state.timeline, t);
  if (ch) {
    const idx = state.timeline.chapters.indexOf(ch) + 1;
    state.chapterLabel.textContent = `Ch ${idx} / ${state.timeline.chapters.length}`;
  }
}

function _showPause(state, chapter) {
  state.pausePanel.removeAttribute("hidden");
  _q(state.pausePanel, "[data-pause-eyebrow]").textContent = chapter.title;
  _q(state.pausePanel, "[data-pause-prompt]").textContent = chapter.pauseAfter.prompt;
  _q(state.pausePanel, "[data-pause-framing]").textContent = chapter.pauseAfter.framingNote || "";
  _q(state.pausePanel, "[data-pause-continue]").focus();
  state.paused = true;
  state.narrationAudio.pause();
  for (const [, t] of Object.entries(state.musicTracks)) {
    if (t.gain.gain.value > 0.01) {
      t.gain.gain.cancelScheduledValues(state.audioCtx.currentTime);
      t.gain.gain.linearRampToValueAtTime((t.config.volume ?? 0.35) * 0.5, state.audioCtx.currentTime + 0.6);
    }
  }
}

function _hidePause(state) {
  state.pausePanel.setAttribute("hidden", "");
  state.paused = false;
  state.narrationAudio.play();
  const t = state.narrationAudio.currentTime;
  const ch = chapterAtTime(state.timeline, t);
  if (ch) _setMusicForChapter(state, ch.musicCue);
}

function _tick(state) {
  if (state.closed) return;
  requestAnimationFrame(() => _tick(state));

  const t = state.narrationAudio.currentTime;
  const beat = beatAtTime(state.timeline, t);
  const ch = chapterAtTime(state.timeline, t);

  _renderBeat(state, beat);

  if (beat) {
    const beatProgress = (t - beat.startSeconds) / (beat.endSeconds - beat.startSeconds);
    _updateKenBurns(state, beat, beatProgress);
    _updateThenNow(state, beat, beatProgress);
  }

  _updateCaptions(state, t);
  _updateControls(state, t);

  if (ch && state.lastChapterId && state.lastChapterId !== ch.id) {
    const prevCh = state.timeline.chapters.find(c => c.id === state.lastChapterId);
    if (prevCh && prevCh.pauseAfter && !state.pausedChapters.has(prevCh.id)) {
      state.pausedChapters.add(prevCh.id);
      _showPause(state, prevCh);
    } else if (ch.musicCue) {
      _setMusicForChapter(state, ch.musicCue);
    }
  } else if (ch && !state.lastChapterId) {
    if (ch.musicCue) _setMusicForChapter(state, ch.musicCue);
  }
  state.lastChapterId = ch?.id || null;

  const isNarrating = !state.narrationAudio.paused && (_captionAtTime(state.captions || [], t).length > 0);
  _duckMusic(state, isNarrating);
}

function _onKey(state, ev) {
  if (state.closed) return;
  if (ev.key === " " || ev.code === "Space") {
    ev.preventDefault();
    if (state.paused && !state.pausePanel.hasAttribute("hidden")) {
      _hidePause(state);
    } else if (state.narrationAudio.paused) {
      state.narrationAudio.play();
    } else {
      state.narrationAudio.pause();
    }
  } else if (ev.key === "Escape") {
    ev.preventDefault();
    MovieMode.close();
  } else if (ev.key === "c" || ev.key === "C") {
    ev.preventDefault();
    const captionsEl = _q(state.stage, "[data-captions]");
    if (captionsEl.hasAttribute("hidden")) captionsEl.removeAttribute("hidden");
    else captionsEl.setAttribute("hidden", "");
  } else if (ev.key === "ArrowRight") {
    ev.preventDefault();
    const t = state.narrationAudio.currentTime;
    const idx = state.timeline.chapters.findIndex(c => t < c.endSeconds);
    if (idx >= 0 && idx + 1 < state.timeline.chapters.length) {
      state.narrationAudio.currentTime = state.timeline.chapters[idx + 1].startSeconds;
    }
  } else if (ev.key === "ArrowLeft") {
    ev.preventDefault();
    const t = state.narrationAudio.currentTime;
    const idx = state.timeline.chapters.findIndex(c => t < c.endSeconds);
    const prev = Math.max(0, idx - 1);
    state.narrationAudio.currentTime = state.timeline.chapters[prev].startSeconds;
  } else if (ev.key === "f" || ev.key === "F") {
    ev.preventDefault();
    if (!document.fullscreenElement) state.stage.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  }
}

function _setupControls(state) {
  let hideTimer = null;
  const showControls = () => {
    state.controls.dataset.hidden = "false";
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      state.controls.dataset.hidden = "true";
    }, 3000);
  };
  state.stage.addEventListener("mousemove", showControls);
  state.stage.addEventListener("touchstart", showControls);
  showControls();

  _q(state.stage, "[data-btn-play]").addEventListener("click", () => {
    if (state.narrationAudio.paused) state.narrationAudio.play();
    else state.narrationAudio.pause();
  });
  _q(state.stage, "[data-btn-exit]").addEventListener("click", () => MovieMode.close());
  _q(state.stage, "[data-btn-cc]").addEventListener("click", () => {
    const c = _q(state.stage, "[data-captions]");
    if (c.hasAttribute("hidden")) c.removeAttribute("hidden");
    else c.setAttribute("hidden", "");
  });
  _q(state.stage, "[data-btn-fs]").addEventListener("click", () => {
    if (!document.fullscreenElement) state.stage.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  });
  _q(state.stage, "[data-pause-continue]").addEventListener("click", () => _hidePause(state));

  _q(state.stage, "[data-timeline]").addEventListener("click", (ev) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const pct = (ev.clientX - rect.left) / rect.width;
    state.narrationAudio.currentTime = pct * state.timeline.totalDurationSeconds;
  });
}

export const MovieMode = {
  async open({ timelineSrc = "./movie/timeline.json" } = {}) {
    if (_stageEl) return;

    // Resolve all asset paths against the timeline.json directory, not the
    // host document. Critical: timeline.json uses "./narration/foo.mp3" which
    // means relative-to-timeline, not relative-to-/digital-lesson/.
    const timelineUrl = new URL(timelineSrc, document.baseURI);
    const resolveAsset = (s) => new URL(s, timelineUrl).href;

    const timelineRaw = await _loadJSON(timelineSrc);
    const timeline = parseTimeline(timelineRaw);

    const stage = _buildStageDOM();
    document.body.appendChild(stage);
    _stageEl = stage;
    const _prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const state = {
      stage,
      timeline,
      timelineUrl,
      resolveAsset,
      prevBodyOverflow: _prevBodyOverflow,
      beatLayer: _q(stage, "[data-beat-layer]"),
      captionText: _q(stage, "[data-caption-text]"),
      pausePanel: _q(stage, "[data-pause-panel]"),
      loading: _q(stage, "[data-loading]"),
      controls: _q(stage, "[data-controls]"),
      timelineFill: _q(stage, "[data-timeline-fill]"),
      chapterLabel: _q(stage, "[data-chapter-label]"),
      currentBeatId: null,
      lastChapterId: null,
      pausedChapters: new Set(),
      paused: false,
      closed: false,
      captions: [],
    };
    _state = state;

    await _setupAudio(state, timeline);

    // Captions — resolved via the same helper.
    try {
      const vttRes = await fetch(resolveAsset(timeline.narration.captions));
      if (vttRes.ok) {
        const vttText = await vttRes.text();
        state.captions = _parseVTT(vttText);
      }
    } catch (e) {
      console.warn("[movie-mode] captions failed to load:", e);
    }

    _setupControls(state);

    state.keyHandler = (ev) => _onKey(state, ev);
    document.addEventListener("keydown", state.keyHandler);

    // Race the narration buffer against a 15-second timeout. If buffering
    // hangs, show a friendly error instead of an indefinite loading screen.
    const audio = state.narrationAudio;
    try {
      await new Promise((resolve, reject) => {
        if (audio.readyState >= 3) return resolve();
        const onCanPlay = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(new Error(`narration failed to load: ${audio.error?.message || "unknown"}`)); };
        const timeout = setTimeout(() => { cleanup(); reject(new Error("narration buffer timeout after 15s")); }, 15000);
        function cleanup() {
          audio.removeEventListener("canplay", onCanPlay);
          audio.removeEventListener("error", onError);
          clearTimeout(timeout);
        }
        audio.addEventListener("canplay", onCanPlay, { once: true });
        audio.addEventListener("error", onError, { once: true });
      });
    } catch (e) {
      console.error("[movie-mode]", e);
      state.loading.textContent = "Could not load the film. Refresh the page or watch the print PDF.";
      state.loading.style.color = "#E8B341";
      return;
    }

    state.loading.setAttribute("hidden", "");

    if (state.audioCtx.state === "suspended") await state.audioCtx.resume();

    try {
      await state.narrationAudio.play();
    } catch (e) {
      console.error("[movie-mode] narration play() rejected:", e);
      state.loading.removeAttribute("hidden");
      state.loading.textContent = "Click anywhere to start the film.";
      // Recover by waiting for a user gesture inside the stage.
      stage.addEventListener("click", () => {
        state.narrationAudio.play().catch(() => {});
        state.loading.setAttribute("hidden", "");
      }, { once: true });
    }
    requestAnimationFrame(() => _tick(state));
  },

  close() {
    if (!_stageEl || !_state) return;
    _state.closed = true;
    try { _state.narrationAudio.pause(); } catch {}
    for (const t of Object.values(_state.musicTracks || {})) {
      try { t.audio.pause(); } catch {}
    }
    try { _state.audioCtx?.close(); } catch {}
    document.removeEventListener("keydown", _state.keyHandler);
    _stageEl.remove();
    document.body.style.overflow = _state.prevBodyOverflow ?? "";
    _stageEl = null;
    _state = null;
  },
};
