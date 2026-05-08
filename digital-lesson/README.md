# Becoming Ilona: Digital Immersive Lesson

The digital companion to the print PDF lesson on Judy Abrams' *Tenuous Threads*.

This is a single scrolling HTML page with the lesson reading on the left and a
sticky scrollytelling Leaflet map on the right. As students scroll the lesson,
the map advances through the six waypoints of Judy's wartime journey from
Budapest in 1937 to Montreal in 1949.

The print PDF (`../Becoming-Ilona-Lesson-Plan.pdf`) is the primary editorial
artifact. This digital lesson is the classroom-experience version that
demonstrates the same content in an immersive web layout.

## Files

| File           | Purpose                                                |
|----------------|--------------------------------------------------------|
| `index.html`   | The immersive lesson page (single-page scrolling site) |
| `style.css`    | Scoped styles; matches the print PDF visual register   |
| `controller.js`| Scroll-driven map advancement + audio play/pause       |
| `README.md`    | This file                                              |

The page reuses `../journey-map/waypoints.js` for the six waypoint coordinates
(no duplication; one source of truth across the whole site).

## Layout

- **Desktop (>= 800px)**: split-screen. Lesson reading scrolls in the left
  column. The map sticks to the right side and advances with scroll. A
  Street-View-link panel beneath the map gives three "walk this street today"
  buttons that open Google Maps in a new tab.
- **Mobile (< 800px)**: stacked. The map sticks to the top with a 50vh height.
  The lesson reading scrolls beneath.

## Section-to-waypoint mapping

| Lesson section          | Map behaviour                                  |
|-------------------------|------------------------------------------------|
| Lesson opener           | (no map change; intro overview holds)          |
| Minds On                | (no map change)                                |
| Meet Judy               | Fly to Budapest 1937 (waypoint 1)              |
| Before we read          | (no map change)                                |
| Vocabulary              | (no map change)                                |
| The Reading, part 1     | Fly to Ursulines, Stefánia Street (waypoint 2) |
| The Reading, part 2     | Fly to Pincehely, Tolna County (waypoint 3)    |
| Liberation              | Fly to Budapest, January 1945 (waypoint 4)     |
| Judy's journey overview | Show all 6 waypoints, fit bounds               |
| Comprehension           | (no map change)                                |
| Sample response         | (no map change)                                |
| Thought experiment      | (no map change)                                |
| Exit ticket             | (no map change)                                |
| Reflection              | Fly to Montreal 1949 (waypoint 5)              |
| Sources                 | Zoom out to overview (waypoint 6, memoir 2011) |
| About the designer      | (no map change)                                |

## Street View links

Three places from Judy's path that are still walkable today on Google Street
View. Each link opens in a new tab. Persistent panel beneath the map (always
visible, not waypoint-dependent) so students can reach for them whenever the
geography becomes the focus:

1. **Stefánia Street, Budapest**: neighbourhood of the Ursuline Mother House
   (47.5009, 19.0911)
2. **Pincehely village, Tolna County**: rural Hungary where the convent
   relocated (46.7333, 18.4500)
3. **Mile End, Montreal**: where many Hungarian Jewish refugees resettled in
   1949 (45.5219, -73.5957)

Each link uses the standard Google Maps coordinate URL with the
`@lat,lng,3a,75y,90h,90t/data=!3m6!1e1` Street View slug. No API key required.

## Audio

The page includes an HTML5 `<audio controls>` element pointing at
`../audio/lesson-narration.mp3`. The "Play audio" button in the top bar plays
or pauses that audio.

If the file is not yet available (the narration may still be generating in a
background process), the page detects the load error and disables the button
with a friendly status message. Refresh the page once the file lands in
`output/azrieli/audio/lesson-narration.mp3`.

Per-section audio timestamps are not yet wired (the controller has the hooks
but the timestamp map is empty until audio is finalized).

## How to run locally

```sh
# from the repo root
cd output/azrieli/digital-lesson
python3 -m http.server 8000
# open http://localhost:8000/ in a browser
```

Or open `index.html` directly via `file://`. The lesson reading + Street View
links work offline. The map tiles require internet (CartoDB Positron CDN).

## How to deploy

Run the existing deploy script:

```sh
bash output/azrieli/scripts/deploy-azrieli-site.sh
```

The script has been updated to also sync this `digital-lesson/` directory to
the GitHub Pages target. After deploy the page will be live at:

```
https://milestoneteachers.github.io/becoming-ilona-lesson/digital-lesson/
```

## Constraints honoured

- Zero em dashes anywhere in HTML, CSS, or JavaScript (verified by grep).
- Zero AI tropes.
- No API keys required.
- All historical claims sourced (Azrieli Foundation Tenuous Threads 2011,
  USHMM, Yad Vashem).
- Mobile-responsive (tested at 375px, 768px, 1024px, 1440px).
- Accessibility: skip link, ARIA labels on every interactive element,
  keyboard navigation for the map, audio player has accessible controls,
  alt text on every image referenced, `prefers-reduced-motion` respected
  (no flyTo when reduced motion is requested).

## Tradeoffs

- **Map rendering on first paint**: sticky containers sometimes initialize
  Leaflet at zero size on first paint. The controller calls
  `map.invalidateSize()` after a 250ms delay to force a re-measurement. This
  is invisible to the user but worth knowing if you debug map issues.
- **Audio file path**: the `<source>` points at `../audio/lesson-narration.mp3`
  even though the file is still being generated. The error handler updates the
  status text and disables the play button rather than crashing. Once the file
  exists, the page picks it up automatically on next load.
- **Six waypoints, one waypoints.js**: duplicating the waypoint data in
  another JSON file would have been simpler but creates a drift risk. Reusing
  `../journey-map/waypoints.js` means the map data is in one place across the
  whole site.
- **No Street View embeds (iframes)**: Google's `/maps/embed/v1/streetview`
  endpoint requires an API key, which conflicts with the no-API-key
  constraint. The "open in new tab" link pattern is the cleanest legal path.
