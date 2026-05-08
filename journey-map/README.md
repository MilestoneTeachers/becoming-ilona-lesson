# Becoming Ilona, Judy's Wartime Path

A standalone scrollytelling journey map for the Grade 6 Holocaust memoir lesson on Judy Abrams' *Tenuous Threads*. Portfolio submission to the Azrieli Foundation.

## What it is

A single-page web companion to the lesson. Students scroll through six waypoints along Judy Abrams' wartime geography (Budapest, 1937; Ursuline Mother House, 1944; Pincehely, 1944; liberation in Budapest, 1945; emigration to Montreal, 1949; publication of *Tenuous Threads*, 2011) while the map flies between locations and a dashed gold trail traces the path. Editorial typography matches the lesson PDF.

## Files in this folder

| File | Purpose |
|---|---|
| `index.html` | The standalone page. Open this. |
| `style.css` | All visual styling. Single accent color: warm gold `#E8B341`. |
| `journey.js` | Scroll-driven map controller (Leaflet `flyTo`, IntersectionObserver). |
| `waypoints.js` | The six waypoints. **Edit this file** to revise body copy, citations, or coordinates. |
| `README.md` | This file. |

## How to run it

### Local preview (no install)

1. Double-click `index.html`. It opens in your default browser.
2. The map tiles need an internet connection to load (Stadia Maps + Stamen Design serve them on a free non-commercial tier).
3. The page works on Chrome, Firefox, Safari, and Edge. iPad Safari and Chrome on Android also work.

### Hosting it

This is a fully static site. No backend, no build step. To put it online:

- **GitHub Pages**: drop the four files into a repo, turn on Pages, done.
- **Cloudflare Pages or Netlify**: drag the folder into their upload box.
- **A USB stick**: copy the folder to the stick, hand it to a teacher, they double-click `index.html`.

## Editing the content

### Change the body copy on a waypoint

Open `waypoints.js`. Each waypoint is an object in the `WAYPOINTS` array with a `body` field. Rewrite that field. Save. Refresh the browser. Done.

### Add or remove a waypoint

Add or remove an object in the `WAYPOINTS` array. The page rebuilds itself on load. Coordinates use `[latitude, longitude]` in decimal degrees.

### Change the closing note

In `index.html`, find the section labeled `<aside class="closing">`. Replace the placeholder paragraph that begins with `[Brandon: write 2 sentences here ...]` with your own two-sentence reflection in the lesson's voice.

### Change the accent color

In `style.css`, change `--gold: #E8B341;` at the top of the `:root` block. Everything that uses gold (cards' active border, trail line, tooltip arrow, corner triangle) updates from this single variable.

## Accessibility notes

- All text passes WCAG AA contrast against the white background.
- Keyboard users can Tab onto a waypoint card, then use Page Up, Page Down, Home, and End to move between waypoints. The map flies along.
- Users with `prefers-reduced-motion` set in their OS skip the fly-to animation; the map jumps instantly.
- The map container has an ARIA label explaining how to advance it.
- A print stylesheet hides the map and renders the cards as a clean reading copy if a teacher prints the page.

## Sources

All historical claims on the page cite to one of:

- Azrieli Foundation Holocaust Survivor Memoirs Program, *Tenuous Threads*, 2011
- Re:Collection digital archive (recollection.azrielifoundation.org)
- USHMM Holocaust Encyclopedia
- Yad Vashem archives

The closing block credits Stadia Maps and Stamen Design for the terrain tile layer (CC BY 4.0) and OpenStreetMap for underlying geographic data (ODbL).

## Contact

Built by Brandon Gluck for submission to the Azrieli Foundation. Questions about the lesson, the memoir alignment, or the underlying scholarship route to Brandon directly.
