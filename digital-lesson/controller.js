/*
 * controller.js
 *
 * Drives the digital immersive lesson page for Becoming Ilona.
 *
 * Behaviour:
 *  - Builds the Leaflet map with CartoDB Positron tiles (no API key required).
 *  - Reads window.JOURNEY_WAYPOINTS from ../journey-map/waypoints.js.
 *  - Watches each <section data-waypoint="..."> with IntersectionObserver.
 *    When a section enters the viewport, the map flies to the matching
 *    waypoint, drops a gold marker, and draws a dashed line to it.
 *  - "data-waypoint='all'" on a section reveals every waypoint at once
 *    (used by the "Judy's Journey" overview section).
 *  - Honours prefers-reduced-motion: replaces flyTo with setView, no animation.
 *  - Handles the "Play audio" button, the audio element, and a soft fallback
 *    if the MP3 isn't available yet.
 *
 * No build step. No bundler. Plain ES5 + ES6 features safe in evergreen
 * browsers. Loads as a regular <script> after waypoints.js.
 */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Config                                                             */
  /* ------------------------------------------------------------------ */

  var GOLD = "#E8B341";
  var GOLD_DEEP = "#B58A2B";

  var FLYTO_DURATION = 2.0;   // seconds; longer = more dramatic
  // Use a low threshold and a generous rootMargin so the "in view" detection
  // works reliably across short sections, tall sections, and fast scrolling.
  // The rootMargin pulls the detection band toward the top third of the
  // viewport so a section "wins" once its top crosses ~33% from the top.
  var INTERSECTION_THRESHOLDS = [0, 0.1, 0.25, 0.5, 0.75];
  var INTERSECTION_ROOT_MARGIN = "-20% 0px -45% 0px";

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function prefersReducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function $(selector) {
    return document.querySelector(selector);
  }

  function $all(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  /* ------------------------------------------------------------------ */
  /* Map setup                                                          */
  /* ------------------------------------------------------------------ */

  function buildMap() {
    var map = L.map("map", {
      zoomControl: true,
      scrollWheelZoom: false,
      keyboard: true,
      worldCopyJump: false,
      attributionControl: true
    });

    var tileUrl =
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    var attribution =
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, ' +
      '&copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      minZoom: 2,
      subdomains: "abcd",
      attribution: attribution,
      crossOrigin: true
    }).addTo(map);

    // Initial overview: show Hungary and southeastern Canada at once.
    map.setView([50.0, -30.0], 3);
    map.zoomControl.setPosition("bottomright");

    return map;
  }

  /* ------------------------------------------------------------------ */
  /* Waypoint marker creation                                           */
  /* ------------------------------------------------------------------ */

  function makeMarker(wp, isActive) {
    var radius = isActive ? 9 : 6;
    return L.circleMarker(wp.coords, {
      radius: radius,
      color: GOLD_DEEP,
      weight: 2,
      fillColor: GOLD,
      fillOpacity: isActive ? 0.95 : 0.7,
      className: isActive ? "journey-marker-active" : "",
      interactive: true,
      bubblingMouseEvents: false,
      keyboard: false
    });
  }

  function attachTooltip(marker, wp) {
    marker.bindTooltip(wp.title, {
      direction: "top",
      offset: [0, -8],
      className: "journey-tooltip",
      opacity: 1
    });
  }

  function drawSegment(map, fromCoords, toCoords) {
    return L.polyline([fromCoords, toCoords], {
      color: GOLD,
      weight: 2,
      opacity: 0.7,
      dashArray: "6, 6",
      lineCap: "round",
      lineJoin: "round",
      interactive: false
    }).addTo(map);
  }

  /* ------------------------------------------------------------------ */
  /* Map controller (handles fly-to + marker + trail state)             */
  /* ------------------------------------------------------------------ */

  function makeMapController(map, waypoints) {
    // Index by id for O(1) lookups.
    var byId = {};
    waypoints.forEach(function (wp, i) {
      byId[wp.id] = { waypoint: wp, index: i };
    });

    var markerByIndex = new Array(waypoints.length).fill(null);
    var trailDrawnTo = new Array(waypoints.length).fill(false);
    var visited = new Array(waypoints.length).fill(false);
    var currentId = null;

    function placeMarkerAt(index, opts) {
      opts = opts || {};
      var existing = markerByIndex[index];
      if (existing) {
        if (opts.makeActive) {
          existing.setStyle({ radius: 9, fillOpacity: 0.95, weight: 2 });
          var elem = existing.getElement && existing.getElement();
          if (elem) { elem.classList.add("journey-marker-active"); }
        }
        return existing;
      }
      var wp = waypoints[index];
      var marker = makeMarker(wp, !!opts.makeActive);
      marker.addTo(map);
      attachTooltip(marker, wp);
      markerByIndex[index] = marker;
      visited[index] = true;
      return marker;
    }

    function demoteAllMarkers() {
      markerByIndex.forEach(function (marker) {
        if (!marker) { return; }
        marker.setStyle({ radius: 6, fillOpacity: 0.55, weight: 2 });
        var elem = marker.getElement && marker.getElement();
        if (elem) { elem.classList.remove("journey-marker-active"); }
      });
    }

    function drawTrailUpTo(index) {
      // Draw forward-only segments. Scrolling back doesn't redraw.
      for (var i = 1; i <= index; i++) {
        if (trailDrawnTo[i]) { continue; }
        if (!markerByIndex[i - 1]) {
          placeMarkerAt(i - 1, { makeActive: false });
        }
        drawSegment(map, waypoints[i - 1].coords, waypoints[i].coords);
        trailDrawnTo[i] = true;
      }
    }

    function flyTo(coords, zoom) {
      if (prefersReducedMotion()) {
        map.setView(coords, zoom, { animate: false });
        return;
      }
      map.flyTo(coords, zoom, {
        duration: FLYTO_DURATION,
        easeLinearity: 0.25
      });
    }

    function showWaypoint(id) {
      if (id === currentId) { return; }
      var entry = byId[id];
      if (!entry) { return; }
      currentId = id;

      demoteAllMarkers();
      placeMarkerAt(entry.index, { makeActive: true });
      drawTrailUpTo(entry.index);
      flyTo(entry.waypoint.coords, entry.waypoint.zoom);
      updateStatus(entry.index, entry.waypoint);
    }

    function showAll() {
      // Render every waypoint and zoom to fit.
      currentId = "all";
      waypoints.forEach(function (wp, i) {
        placeMarkerAt(i, { makeActive: false });
      });
      // Re-emphasize the most recent one (Montreal).
      var lastIdx = waypoints.length - 1;
      var lastMarker = markerByIndex[lastIdx];
      if (lastMarker) {
        lastMarker.setStyle({ radius: 9, fillOpacity: 0.95, weight: 2 });
        var lastElem = lastMarker.getElement && lastMarker.getElement();
        if (lastElem) { lastElem.classList.add("journey-marker-active"); }
      }
      drawTrailUpTo(lastIdx);

      var bounds = L.latLngBounds(waypoints.map(function (w) { return w.coords; }));
      if (prefersReducedMotion()) {
        map.fitBounds(bounds, { padding: [40, 40], animate: false });
      } else {
        map.flyToBounds(bounds, { padding: [40, 40], duration: FLYTO_DURATION });
      }
      updateStatus(-1, {
        title: "Judy's full path, 1937-2011",
        subtitle: "Six places. Three names. One testimony."
      });
    }

    function updateStatus(index, wp) {
      var stepEl = document.getElementById("map-status-step");
      var titleEl = document.getElementById("map-status-title");
      if (!stepEl || !titleEl) { return; }
      if (index < 0) {
        stepEl.textContent = "Full path";
      } else {
        stepEl.textContent = "Stop " + (index + 1) + " of " + waypoints.length;
      }
      titleEl.textContent = wp.title || "";
    }

    return {
      showWaypoint: showWaypoint,
      showAll: showAll,
      placeMarkerAt: placeMarkerAt,
      map: map
    };
  }

  /* ------------------------------------------------------------------ */
  /* Section observer, drives the map from scroll position               */
  /* ------------------------------------------------------------------ */

  function setupSectionObserver(controller) {
    var sections = $all(".lesson-section");
    // Track which sections are currently visible so we can pick the best one
    // on each event (the IntersectionObserver only reports CHANGES, not the
    // current full set of visible sections).
    var visibleSections = new Set();

    function pickBestAndApply() {
      // Among currently-visible sections, pick the one whose top edge is
      // closest to the upper third of the viewport. This is the section the
      // reader is most likely focused on right now.
      var anchorY = window.innerHeight * 0.33;
      var best = null;
      var bestScore = Infinity;
      visibleSections.forEach(function (section) {
        var rect = section.getBoundingClientRect();
        // Distance from section top to anchorY. Sections whose top is at or
        // just above anchorY score best.
        var topDist = Math.abs(rect.top - anchorY);
        if (topDist < bestScore) {
          bestScore = topDist;
          best = section;
        }
      });
      if (!best) { return; }

      // Mark active class for visual indicator.
      sections.forEach(function (s) { s.classList.remove("is-active"); });
      best.classList.add("is-active");

      var waypointId = best.getAttribute("data-waypoint");
      if (!waypointId) { return; } // section has no map binding; leave map as-is
      if (waypointId === "all") {
        controller.showAll();
      } else {
        controller.showWaypoint(waypointId);
      }
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          visibleSections.add(entry.target);
        } else {
          visibleSections.delete(entry.target);
          entry.target.classList.remove("is-active");
        }
      });
      pickBestAndApply();
    }, {
      threshold: INTERSECTION_THRESHOLDS,
      rootMargin: INTERSECTION_ROOT_MARGIN
    });

    sections.forEach(function (s) { io.observe(s); });

    // Re-evaluate on regular scroll too, throttled. This catches cases where
    // a section never crosses a threshold (e.g. large sections that fully
    // occupy the viewport).
    var scrollTimer = null;
    window.addEventListener("scroll", function () {
      if (scrollTimer) { return; }
      scrollTimer = window.setTimeout(function () {
        scrollTimer = null;
        // Refresh visibleSections from current geometry.
        visibleSections.clear();
        sections.forEach(function (s) {
          var rect = s.getBoundingClientRect();
          if (rect.bottom > 0 && rect.top < window.innerHeight) {
            visibleSections.add(s);
          }
        });
        pickBestAndApply();
      }, 120);
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ */
  /* Audio integration                                                  */
  /* ------------------------------------------------------------------ */

  function setupAudio() {
    var audio = document.getElementById("lesson-audio");
    var playBtn = document.getElementById("play-audio");
    var statusLine = document.getElementById("audio-status");
    var pulse = document.getElementById("audio-pulse");
    var pulseVideo = pulse ? pulse.querySelector(".audio-pulse__video") : null;

    if (!audio || !playBtn) { return; }

    var available = false;

    function setPulseState(state) {
      if (!pulse) { return; }
      pulse.setAttribute("data-state", state);
      if (state === "playing" && pulseVideo) {
        try {
          pulseVideo.currentTime = 0;
          var p = pulseVideo.play();
          if (p && typeof p.catch === "function") { p.catch(function () {}); }
        } catch (e) { /* ignore */ }
      } else if (pulseVideo) {
        try { pulseVideo.pause(); } catch (e) { /* ignore */ }
      }
    }

    audio.addEventListener("loadedmetadata", function () {
      available = true;
      if (statusLine) {
        statusLine.textContent = "Audio narration of the full lesson, read by the lesson designer.";
      }
    });

    audio.addEventListener("error", function () {
      available = false;
      if (statusLine) {
        statusLine.textContent = "Audio narration is still being generated. Refresh later, or follow the print PDF.";
      }
      playBtn.disabled = true;
      playBtn.style.opacity = "0.5";
      playBtn.style.cursor = "not-allowed";
      playBtn.setAttribute("aria-disabled", "true");
    });

    playBtn.addEventListener("click", function () {
      if (!available) { return; }
      if (audio.paused) {
        audio.play().then(function () {
          playBtn.innerHTML = '<span aria-hidden="true">&#10074;&#10074;</span> Pause audio';
          playBtn.setAttribute("aria-label", "Pause lesson narration audio");
        }).catch(function () {
          // Some browsers block play(); user can use the inline player instead.
        });
      } else {
        audio.pause();
        playBtn.innerHTML = '<span aria-hidden="true">&#9654;</span> Play audio';
        playBtn.setAttribute("aria-label", "Play lesson narration audio");
      }
    });

    audio.addEventListener("play", function () {
      setPulseState("playing");
    });

    audio.addEventListener("pause", function () {
      playBtn.innerHTML = '<span aria-hidden="true">&#9654;</span> Play audio';
      playBtn.setAttribute("aria-label", "Play lesson narration audio");
      setPulseState("paused");
    });
    audio.addEventListener("ended", function () {
      playBtn.innerHTML = '<span aria-hidden="true">&#9654;</span> Play audio';
      playBtn.setAttribute("aria-label", "Play lesson narration audio");
      setPulseState("paused");
    });
  }

  /* ------------------------------------------------------------------ */
  /* Then-and-Now intro triggers (year-transition Remotion videos)       */
  /* ------------------------------------------------------------------ */

  function setupThenNowIntros() {
    var blocks = $all(".then-now-block");
    if (!blocks.length) { return; }

    var reveal = function (block) {
      if (block.dataset.revealed === "1") { return; }
      block.dataset.revealed = "1";
      var video = block.querySelector(".then-now-block__video");
      var slider = block.querySelector(".then-now-block__slider");

      if (prefersReducedMotion() || !video) {
        // Skip the intro: jump straight to revealing the slider.
        block.classList.add("is-revealed");
        return;
      }

      block.classList.add("is-intro-playing");

      var playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function () {
          // Autoplay blocked: still reveal the slider.
          block.classList.remove("is-intro-playing");
          block.classList.add("is-intro-played", "is-revealed");
        });
      }

      var revealAfter = function () {
        block.classList.remove("is-intro-playing");
        block.classList.add("is-intro-played", "is-revealed");
      };
      video.addEventListener("ended", revealAfter, { once: true });
      // Backstop: if the ended event never fires (e.g. video error),
      // reveal after 3.5 seconds.
      window.setTimeout(revealAfter, 3500);
    };

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.intersectionRatio > 0.15) {
          reveal(entry.target);
        }
      });
    }, {
      threshold: [0.15, 0.4],
      rootMargin: "0px 0px -10% 0px"
    });

    blocks.forEach(function (b) { io.observe(b); });
  }

  /* ------------------------------------------------------------------ */
  /* Slide mode (Read | Present toggle, keyboard + touch nav)            */
  /* ------------------------------------------------------------------ */

  function setupSlideMode(mapController) {
    var readBtn = document.getElementById("mode-read");
    var presentBtn = document.getElementById("mode-present");
    var slideNav = document.getElementById("slide-nav");
    var prevBtn = document.getElementById("slide-prev");
    var nextBtn = document.getElementById("slide-next");
    var exitBtn = document.getElementById("slide-exit");
    var progress = document.getElementById("slide-progress");
    var introOverlay = document.getElementById("intro-overlay");
    var overlayVideo = document.getElementById("intro-overlay-video");
    var overlayStill = document.getElementById("intro-overlay-still");
    var overlaySkip = document.getElementById("intro-overlay-skip");

    if (!readBtn || !presentBtn) { return; }

    var sections = $all(".lesson-section");
    var currentIndex = 0;
    var inSlideMode = false;
    var isShowingIntro = false;

    function readMode() { return !inSlideMode; }

    function getStored(key) {
      try { return window.localStorage.getItem(key); }
      catch (e) { return null; }
    }
    function setStored(key, value) {
      try { window.localStorage.setItem(key, value); }
      catch (e) { /* ignore */ }
    }

    function updateProgress() {
      if (!progress) { return; }
      progress.textContent = "Slide " + (currentIndex + 1) + " of " + sections.length;
      if (prevBtn) { prevBtn.disabled = (currentIndex === 0); }
      if (nextBtn) { nextBtn.disabled = (currentIndex === sections.length - 1); }
    }

    function applyCurrentSection(skipFade) {
      sections.forEach(function (s, i) {
        if (i === currentIndex) {
          s.classList.add("is-current");
        } else {
          s.classList.remove("is-current", "is-fading");
        }
      });
      updateProgress();

      // Fire any waypoint binding so the map state stays correct
      // (even though the map is hidden in slide mode, the controller
      // remains the single source of truth for "where are we").
      var waypointId = sections[currentIndex].getAttribute("data-waypoint");
      if (waypointId && mapController) {
        if (waypointId === "all") {
          mapController.showAll();
        } else {
          mapController.showWaypoint(waypointId);
        }
      }

      // Trigger any inline year-transition + then-now block reveals on the
      // current slide (the IntersectionObserver doesn't fire in slide
      // mode because non-current sections are display:none).
      var blocks = sections[currentIndex].querySelectorAll(".then-now-block");
      blocks.forEach(function (b) {
        if (b.dataset.revealed === "1") { return; }
        b.dataset.revealed = "1";
        if (prefersReducedMotion()) {
          b.classList.add("is-revealed");
          return;
        }
        var v = b.querySelector(".then-now-block__video");
        b.classList.add("is-intro-playing");
        if (v) {
          v.play().catch(function () {
            b.classList.remove("is-intro-playing");
            b.classList.add("is-intro-played", "is-revealed");
          });
          v.addEventListener("ended", function () {
            b.classList.remove("is-intro-playing");
            b.classList.add("is-intro-played", "is-revealed");
          }, { once: true });
        }
        window.setTimeout(function () {
          b.classList.remove("is-intro-playing");
          b.classList.add("is-intro-played", "is-revealed");
        }, 3500);
      });
    }

    function playOverlay(introKey, onDone) {
      if (!introOverlay || !overlayVideo) { onDone && onDone(); return; }
      var srcMp4 = "./assets/intros/section-" + introKey + ".mp4";
      var srcPng = "./assets/intros/section-" + introKey + ".png";

      // Special intros use different prefixes:
      if (introKey === "now-presenting") {
        srcMp4 = "./assets/intros/now-presenting.mp4";
        srcPng = "./assets/intros/now-presenting.png";
      }

      isShowingIntro = true;
      overlayStill.src = srcPng;
      overlayStill.alt = "Section card preview for " + introKey;
      overlayVideo.innerHTML = "";
      var source = document.createElement("source");
      source.src = srcMp4;
      source.type = "video/mp4";
      overlayVideo.appendChild(source);
      overlayVideo.load();

      introOverlay.classList.add("is-visible");
      introOverlay.setAttribute("aria-hidden", "false");

      var done = function () {
        if (!isShowingIntro) { return; }
        isShowingIntro = false;
        introOverlay.classList.remove("is-visible");
        introOverlay.setAttribute("aria-hidden", "true");
        try { overlayVideo.pause(); } catch (e) {}
        if (onDone) { onDone(); }
      };

      if (prefersReducedMotion()) {
        // Show the still for 1.6s, then proceed.
        window.setTimeout(done, 1600);
        return;
      }

      var p = overlayVideo.play();
      if (p && typeof p.catch === "function") {
        p.catch(function () { done(); });
      }
      overlayVideo.addEventListener("ended", done, { once: true });
      // Backstop in case ended never fires:
      window.setTimeout(done, 4500);

      // Allow user to skip the overlay
      var skipHandler = function () {
        overlaySkip.removeEventListener("click", skipHandler);
        done();
      };
      overlaySkip.addEventListener("click", skipHandler);
    }

    function goTo(targetIndex, withIntro) {
      if (targetIndex < 0 || targetIndex >= sections.length) { return; }
      if (targetIndex === currentIndex) { return; }

      var fade = function () {
        var current = sections[currentIndex];
        if (current) { current.classList.add("is-fading"); }
        window.setTimeout(function () {
          currentIndex = targetIndex;
          applyCurrentSection();
        }, 280);
      };

      if (withIntro) {
        var key = sections[targetIndex].getAttribute("data-intro");
        if (key) {
          playOverlay(key, fade);
          return;
        }
      }
      fade();
    }

    function enterSlideMode(skipNowPresentingIntro) {
      inSlideMode = true;
      document.body.classList.add("slide-mode");
      readBtn.classList.remove("is-active");
      readBtn.setAttribute("aria-pressed", "false");
      presentBtn.classList.add("is-active");
      presentBtn.setAttribute("aria-pressed", "true");
      if (slideNav) { slideNav.setAttribute("aria-hidden", "false"); }

      // Pick the section currently most visible to start from
      var anchorY = window.innerHeight * 0.33;
      var bestIdx = 0;
      var bestScore = Infinity;
      sections.forEach(function (s, i) {
        var rect = s.getBoundingClientRect();
        var dist = Math.abs(rect.top - anchorY);
        if (dist < bestScore) { bestScore = dist; bestIdx = i; }
      });
      currentIndex = bestIdx;
      applyCurrentSection(true);

      var seenNow = getStored("azrieli_seen_now_presenting");
      if (!seenNow && !skipNowPresentingIntro) {
        playOverlay("now-presenting", function () {
          setStored("azrieli_seen_now_presenting", "1");
        });
      }
    }

    function exitSlideMode() {
      inSlideMode = false;
      document.body.classList.remove("slide-mode");
      readBtn.classList.add("is-active");
      readBtn.setAttribute("aria-pressed", "true");
      presentBtn.classList.remove("is-active");
      presentBtn.setAttribute("aria-pressed", "false");
      if (slideNav) { slideNav.setAttribute("aria-hidden", "true"); }
      sections.forEach(function (s) {
        s.classList.remove("is-current", "is-fading");
      });
      // Hide any visible overlay too
      if (introOverlay) {
        introOverlay.classList.remove("is-visible");
        introOverlay.setAttribute("aria-hidden", "true");
      }
      // Scroll the section the user was on into view (read mode is back).
      var target = sections[currentIndex];
      if (target) {
        target.scrollIntoView({ behavior: "auto", block: "start" });
      }
      setStored("azrieli_mode", "read");
    }

    readBtn.addEventListener("click", function () {
      if (inSlideMode) { exitSlideMode(); }
    });
    presentBtn.addEventListener("click", function () {
      if (!inSlideMode) {
        enterSlideMode(false);
        setStored("azrieli_mode", "present");
      }
    });

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        if (currentIndex > 0) { goTo(currentIndex - 1, false); }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        if (currentIndex < sections.length - 1) {
          goTo(currentIndex + 1, true);
        }
      });
    }
    if (exitBtn) {
      exitBtn.addEventListener("click", exitSlideMode);
    }

    // Keyboard navigation in slide mode
    document.addEventListener("keydown", function (e) {
      if (!inSlideMode) { return; }
      // Don't hijack typing inside form fields.
      var active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
        return;
      }
      // If the intro overlay is showing, Esc skips it.
      if (isShowingIntro) {
        if (e.key === "Escape" || e.key === "Esc") {
          e.preventDefault();
          if (overlaySkip) { overlaySkip.click(); }
        }
        return;
      }
      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "Spacebar":
        case "PageDown":
          e.preventDefault();
          if (currentIndex < sections.length - 1) {
            goTo(currentIndex + 1, true);
          }
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          if (currentIndex > 0) {
            goTo(currentIndex - 1, false);
          }
          break;
        case "Escape":
        case "Esc":
          e.preventDefault();
          exitSlideMode();
          break;
        default: break;
      }
    });

    // Touch swipe handlers (slide mode only)
    var touchStartX = null;
    var touchStartY = null;
    document.addEventListener("touchstart", function (e) {
      if (!inSlideMode || !e.touches || !e.touches.length) { return; }
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener("touchend", function (e) {
      if (!inSlideMode || touchStartX === null) { return; }
      var changed = e.changedTouches && e.changedTouches[0];
      if (!changed) { touchStartX = null; return; }
      var dx = changed.clientX - touchStartX;
      var dy = changed.clientY - touchStartY;
      touchStartX = null;
      touchStartY = null;
      // Need a clearly horizontal gesture, at least 60px in X.
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) { return; }
      if (dx < 0) {
        // Swipe left: next
        if (currentIndex < sections.length - 1) { goTo(currentIndex + 1, true); }
      } else {
        // Swipe right: previous
        if (currentIndex > 0) { goTo(currentIndex - 1, false); }
      }
    }, { passive: true });

    // Restore mode preference from a previous visit.
    var saved = getStored("azrieli_mode");
    if (saved === "present") {
      // Defer so the layout is ready first.
      window.setTimeout(function () { enterSlideMode(false); }, 60);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Resize handling                                                    */
  /* ------------------------------------------------------------------ */

  function setupResize(map) {
    var t = null;
    window.addEventListener("resize", function () {
      if (t) { window.clearTimeout(t); }
      t = window.setTimeout(function () {
        map.invalidateSize({ animate: false });
      }, 180);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                               */
  /* ------------------------------------------------------------------ */

  function init() {
    var waypoints = window.JOURNEY_WAYPOINTS || [];
    if (!waypoints.length) {
      console.warn("[controller] no waypoints found; map will be inert.");
      return;
    }

    var map = buildMap();
    var controller = makeMapController(map, waypoints);
    setupSectionObserver(controller);
    setupAudio();
    setupResize(map);
    setupThenNowIntros();
    setupSlideMode(controller);

    // After a short delay, ensure the map has measured itself (sticky containers
    // sometimes initialize at zero size on first paint).
    window.setTimeout(function () {
      map.invalidateSize({ animate: false });
    }, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

// =============================================================================
// Festival Cut launcher — dynamically import the player on first click.
// =============================================================================
(function setupMovieModeCTA() {
  function attach() {
    const btn = document.getElementById("movie-mode-cta");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const originalHTML = btn.innerHTML;
      btn.textContent = "Loading film…";
      try {
        const { MovieMode } = await import("./movie/movie-mode.js");
        await MovieMode.open({ timelineSrc: "./movie/timeline.json" });
      } catch (e) {
        console.error("[festival-cut] failed to open:", e);
        btn.textContent = "Couldn't open film — see console";
        setTimeout(() => { btn.innerHTML = originalHTML; btn.disabled = false; }, 4000);
        return;
      }
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach);
  } else {
    attach();
  }
})();
