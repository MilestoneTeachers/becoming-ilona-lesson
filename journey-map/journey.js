/*
 * journey.js
 *
 * Drives the scrollytelling map for the Becoming Ilona journey.
 *
 * Behavior:
 *  - Builds the Leaflet map with the Stamen Terrain tile layer (via Stadia).
 *  - Observes the scroll position of each waypoint card and flies the map to
 *    matching coordinates when a card enters the viewport center.
 *  - Drops a circular gold marker at each waypoint as it becomes active and
 *    draws a dashed gold trail line between consecutive waypoints.
 *  - Honors prefers-reduced-motion: when set, fly-to is replaced by setView
 *    with no animation.
 *  - Handles keyboard navigation (PageDown / PageUp / arrow keys) by
 *    scrolling between cards.
 *
 * Depends on:
 *  - Leaflet 1.9+ (loaded via CDN in index.html)
 *  - window.JOURNEY_WAYPOINTS (populated by waypoints.js)
 */

(function () {
  "use strict";

  /* ------------------------------------------------------------------------ */
  /* Config                                                                   */
  /* ------------------------------------------------------------------------ */

  var GOLD = "#E8B341";
  var GOLD_DEEP = "#B58A2B";
  var INK = "#1A1A1A";
  var BG = "#FFFFFF";

  var FLYTO_DURATION = 2.0; // seconds
  var INTERSECTION_THRESHOLD = 0.55;
  var INTRO_OVERVIEW_DELAY_MS = 900;

  /* ------------------------------------------------------------------------ */
  /* Helpers                                                                  */
  /* ------------------------------------------------------------------------ */

  function prefersReducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined && text !== null) {
      node.textContent = text;
    }
    return node;
  }

  /* ------------------------------------------------------------------------ */
  /* Map setup                                                                */
  /* ------------------------------------------------------------------------ */

  function buildMap() {
    var map = L.map("map", {
      zoomControl: true,
      scrollWheelZoom: false,
      keyboard: true,
      worldCopyJump: false,
      attributionControl: true
    });

    // CartoDB Positron tiles. Free for any use, no API key required.
    // Light gray + white aesthetic that matches the editorial design of this lesson.
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

    // Initial overview: show Hungary and southeastern Canada at once so the
    // arc of the journey is visible before scrolling begins.
    map.setView([50.0, -10.0], 3);

    // Move the zoom control to the bottom-right so it never collides with the
    // gold corner triangle at the top-right of the page.
    map.zoomControl.setPosition("bottomright");

    return map;
  }

  /* ------------------------------------------------------------------------ */
  /* Waypoint card rendering                                                  */
  /* ------------------------------------------------------------------------ */

  function buildCard(waypoint, index) {
    var card = el("article", "waypoint");
    card.setAttribute("data-waypoint-id", waypoint.id);
    card.setAttribute("data-waypoint-index", String(index));
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", waypoint.title);
    card.id = "wp-" + waypoint.id;

    var step = el(
      "div",
      "waypoint-step",
      "Stop " + (index + 1) + " of " + window.JOURNEY_WAYPOINTS.length
    );
    card.appendChild(step);

    card.appendChild(el("h3", "waypoint-title", waypoint.title));
    card.appendChild(el("p", "waypoint-subtitle", waypoint.subtitle));
    card.appendChild(el("p", "waypoint-body", waypoint.body));

    if (waypoint.streetView) {
      var sv = el("a", "waypoint-streetview", waypoint.streetView.label);
      sv.href = waypoint.streetView.url;
      sv.target = "_blank";
      sv.rel = "noopener noreferrer";
      sv.setAttribute(
        "aria-label",
        waypoint.streetView.label + ", opens in a new tab"
      );
      var arrow = document.createElement("span");
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = " →";
      sv.appendChild(arrow);
      card.appendChild(sv);
    }

    var citation = el("p", "waypoint-citation", waypoint.citation);
    card.appendChild(citation);

    return card;
  }

  /* ------------------------------------------------------------------------ */
  /* Marker rendering                                                         */
  /* ------------------------------------------------------------------------ */

  function makeCircleMarker(waypoint, isActive) {
    var radius = isActive ? 9 : 6;
    return L.circleMarker(waypoint.coords, {
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

  function attachTooltip(marker, waypoint) {
    marker.bindTooltip(waypoint.title, {
      direction: "top",
      offset: [0, -8],
      className: "journey-tooltip",
      opacity: 1
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Trail rendering                                                          */
  /* ------------------------------------------------------------------------ */

  function drawTrailSegment(map, fromCoords, toCoords) {
    var line = L.polyline([fromCoords, toCoords], {
      color: GOLD,
      weight: 2,
      opacity: 0.7,
      dashArray: "6, 6",
      lineCap: "round",
      lineJoin: "round",
      interactive: false
    });
    line.addTo(map);
    return line;
  }

  /* ------------------------------------------------------------------------ */
  /* Main controller                                                          */
  /* ------------------------------------------------------------------------ */

  function init() {
    var waypoints = window.JOURNEY_WAYPOINTS || [];
    if (!waypoints.length) {
      return;
    }

    var map = buildMap();

    // Render all cards.
    var cardsHost = document.getElementById("waypoint-cards");
    var cardNodes = waypoints.map(function (wp, idx) {
      var card = buildCard(wp, idx);
      cardsHost.appendChild(card);
      return card;
    });

    // Track per-waypoint state: marker (created on first visit), and whether
    // we have already drawn the trail leading INTO this waypoint.
    var markerByIndex = new Array(waypoints.length).fill(null);
    var trailDrawnTo = new Array(waypoints.length).fill(false);
    var currentIndex = -1;
    var visited = new Array(waypoints.length).fill(false);

    function setActive(index) {
      if (index === currentIndex) {
        return;
      }
      currentIndex = index;

      // Card states.
      cardNodes.forEach(function (node, i) {
        node.classList.remove("is-active");
        if (i < index) {
          node.classList.add("is-passed");
        } else {
          node.classList.remove("is-passed");
        }
      });
      if (cardNodes[index]) {
        cardNodes[index].classList.add("is-active");
      }

      flyToWaypoint(index);
      placeMarker(index);
      drawTrailUpTo(index);
    }

    function flyToWaypoint(index) {
      var wp = waypoints[index];
      if (!wp) {
        return;
      }
      if (prefersReducedMotion()) {
        map.setView(wp.coords, wp.zoom, { animate: false });
        return;
      }
      map.flyTo(wp.coords, wp.zoom, {
        duration: FLYTO_DURATION,
        easeLinearity: 0.25
      });
    }

    function placeMarker(index) {
      // Demote previous markers.
      markerByIndex.forEach(function (marker, i) {
        if (!marker) {
          return;
        }
        marker.setStyle({
          radius: 6,
          fillOpacity: 0.55,
          weight: 2
        });
        var elem = marker.getElement && marker.getElement();
        if (elem) {
          elem.classList.remove("journey-marker-active");
        }
      });

      // Create or refresh the current marker.
      var existing = markerByIndex[index];
      var wp = waypoints[index];
      if (!existing) {
        var marker = makeCircleMarker(wp, true);
        marker.addTo(map);
        attachTooltip(marker, wp);
        markerByIndex[index] = marker;
        visited[index] = true;
      } else {
        existing.setStyle({
          radius: 9,
          fillOpacity: 0.95,
          weight: 2
        });
        var elem2 = existing.getElement && existing.getElement();
        if (elem2) {
          elem2.classList.add("journey-marker-active");
        }
        visited[index] = true;
      }
    }

    function drawTrailUpTo(index) {
      // For every adjacent pair (i-1, i) up to the current index, draw a
      // dashed line if it has not already been drawn. We only draw forward
      // segments; scrolling back does not redraw.
      for (var i = 1; i <= index; i++) {
        if (trailDrawnTo[i]) {
          continue;
        }
        if (!visited[i - 1]) {
          // Make sure the prior marker exists (silent placement only).
          var prior = waypoints[i - 1];
          if (!markerByIndex[i - 1]) {
            var m = makeCircleMarker(prior, false);
            m.addTo(map);
            attachTooltip(m, prior);
            markerByIndex[i - 1] = m;
            visited[i - 1] = true;
          }
        }
        drawTrailSegment(map, waypoints[i - 1].coords, waypoints[i].coords);
        trailDrawnTo[i] = true;
      }
    }

    /* ---------------------------------------------------------------------- */
    /* IntersectionObserver: pick which card is in view                       */
    /* ---------------------------------------------------------------------- */

    var io = new IntersectionObserver(
      function (entries) {
        // Pick the entry closest to the viewport center among intersecting
        // ones. This avoids jitter when two cards are partially visible.
        var best = null;
        var bestScore = -Infinity;
        var viewportCenter = window.innerHeight / 2;

        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            var rect = entry.boundingClientRect;
            var entryCenter = rect.top + rect.height / 2;
            var distance = Math.abs(entryCenter - viewportCenter);
            // Closer to center = higher score.
            var score = -distance;
            if (score > bestScore) {
              bestScore = score;
              best = entry.target;
            }
          } else {
            entry.target.classList.remove("is-visible");
          }
        });

        if (best) {
          var idx = parseInt(best.getAttribute("data-waypoint-index"), 10);
          if (!isNaN(idx)) {
            setActive(idx);
          }
        }
      },
      {
        threshold: [INTERSECTION_THRESHOLD],
        rootMargin: "-10% 0px -10% 0px"
      }
    );

    cardNodes.forEach(function (node) {
      io.observe(node);
    });

    /* ---------------------------------------------------------------------- */
    /* Initial fly-in: after a short delay, settle on the first waypoint     */
    /* ---------------------------------------------------------------------- */

    if (prefersReducedMotion()) {
      // Skip the dramatic intro: jump straight to the first waypoint.
      window.setTimeout(function () {
        setActive(0);
      }, 0);
    } else {
      window.setTimeout(function () {
        setActive(0);
      }, INTRO_OVERVIEW_DELAY_MS);
    }

    /* ---------------------------------------------------------------------- */
    /* Keyboard navigation: PageUp / PageDown / arrow keys                   */
    /* ---------------------------------------------------------------------- */

    function scrollToCard(idx) {
      var node = cardNodes[idx];
      if (!node) {
        return;
      }
      node.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "center"
      });
      // Move focus so subsequent Tab order makes sense.
      node.focus({ preventScroll: true });
    }

    document.addEventListener("keydown", function (ev) {
      var target = ev.target;
      var inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (inField) {
        return;
      }

      if (ev.key === "PageDown" || ev.key === "ArrowDown") {
        // Only intercept when the user appears to be navigating waypoints,
        // i.e. when a card has focus. Otherwise let the page scroll normally.
        if (
          target &&
          target.classList &&
          target.classList.contains("waypoint")
        ) {
          ev.preventDefault();
          var next = Math.min(currentIndex + 1, waypoints.length - 1);
          scrollToCard(next);
        }
      } else if (ev.key === "PageUp" || ev.key === "ArrowUp") {
        if (
          target &&
          target.classList &&
          target.classList.contains("waypoint")
        ) {
          ev.preventDefault();
          var prev = Math.max(currentIndex - 1, 0);
          scrollToCard(prev);
        }
      } else if (ev.key === "Home") {
        if (
          target &&
          target.classList &&
          target.classList.contains("waypoint")
        ) {
          ev.preventDefault();
          scrollToCard(0);
        }
      } else if (ev.key === "End") {
        if (
          target &&
          target.classList &&
          target.classList.contains("waypoint")
        ) {
          ev.preventDefault();
          scrollToCard(waypoints.length - 1);
        }
      }
    });

    /* ---------------------------------------------------------------------- */
    /* Resize: invalidate map size after layout shifts (e.g. mobile rotate) */
    /* ---------------------------------------------------------------------- */

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (resizeTimer) {
        window.clearTimeout(resizeTimer);
      }
      resizeTimer = window.setTimeout(function () {
        map.invalidateSize({ animate: false });
      }, 180);
    });
  }

  /* ------------------------------------------------------------------------ */
  /* DOM ready                                                                */
  /* ------------------------------------------------------------------------ */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
