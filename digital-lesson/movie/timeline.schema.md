# timeline.json schema

A timeline drives the festival-cut player. Beats run in document order. The
narration audio is the master clock — all other media syncs to it.

## Shape

```json
{
  "totalDurationSeconds": 780,
  "narration": {
    "src": "./narration/festival-cut.mp3",
    "captions": "./narration/festival-cut.vtt"
  },
  "musicTracks": {
    "<id>": {
      "src": "./music/<file>.mp3",
      "loop": true,
      "volume": 0.35,
      "duckOnNarration": true,
      "duckLevel": 0.12
    }
  },
  "chapters": [
    {
      "id": "ch1-three-names",
      "title": "CHAPTER 1 — THREE NAMES",
      "startSeconds": 0,
      "endSeconds": 90,
      "musicCue": "<id of musicTracks entry>",
      "pauseAfter": {
        "prompt": "What do you notice...",
        "framingNote": "Take 30 seconds..."
      },
      "beats": [
        { "type": "title", "asset": "./chapter-cards/ch1.mp4", "startSeconds": 0, "endSeconds": 35 },
        { "type": "remotion-moment", "asset": "./assets/moments/names-carried-forward.mp4", "startSeconds": 35, "endSeconds": 90 }
      ]
    }
  ]
}
```

## Beat types

- `title` — Remotion-rendered chapter title card (MP4 + PNG poster)
- `remotion-moment` — existing Remotion moment from `./assets/moments/`
- `ken-burns-photo` — archival JPG with `panFrom` / `panTo` (normalized 0..1 coordinates)
- `then-now-slider` — slider auto-wipe 0→100%, takes left + right image src
- `veo-atmospheric` — Veo MP4 loop, played as background under captions
- `map-flyover` — Leaflet map fly-between, takes `fromWaypointId` + `toWaypointId`
- `end-credits` — final scroll card

All beats have `startSeconds` + `endSeconds` (absolute, from film start).
`pauseAfter` is a chapter-level field. The last chapter has no `pauseAfter` (END).
