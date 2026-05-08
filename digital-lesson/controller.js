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
    if (!audio || !playBtn) { return; }

    var available = false;

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

    audio.addEventListener("pause", function () {
      playBtn.innerHTML = '<span aria-hidden="true">&#9654;</span> Play audio';
      playBtn.setAttribute("aria-label", "Play lesson narration audio");
    });
    audio.addEventListener("ended", function () {
      playBtn.innerHTML = '<span aria-hidden="true">&#9654;</span> Play audio';
      playBtn.setAttribute("aria-label", "Play lesson narration audio");
    });
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
