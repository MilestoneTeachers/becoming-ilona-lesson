# Becoming Ilona — Azrieli Foundation Portfolio Submission

This is your deliverable package for the Educator application to the Azrieli Foundation Holocaust Survivor Memoirs Program.

It is two products at once:
1. A **print-ready 51-page editorial PDF** that stands alone on paper.
2. A **digital immersive lesson** that adds an interwoven scrollable map, three short animated moments, three Street View walking links, and inline audio narration.

Both products share the same content. Each is optimized for a different use.

---

## Live URLs (already deployed)

| Artifact | URL |
|---|---|
| **Lesson site (landing)** | https://milestoneteachers.github.io/becoming-ilona-lesson/ |
| **🎬 Digital Immersive Lesson** | https://milestoneteachers.github.io/becoming-ilona-lesson/digital-lesson/ |
| **🗺 Standalone Journey Map** | https://milestoneteachers.github.io/becoming-ilona-lesson/journey-map/ |
| **📄 Print PDF (51 pp, 2.4 MB)** | https://milestoneteachers.github.io/becoming-ilona-lesson/Becoming-Ilona-Lesson-Plan.pdf |
| **📨 Family Letter (1 pp)** | https://milestoneteachers.github.io/becoming-ilona-lesson/Becoming-Ilona-Family-Letter.pdf |
| **📝 Designer's Note (1 pp)** | https://milestoneteachers.github.io/becoming-ilona-lesson/Becoming-Ilona-Designers-Note.pdf |
| **✉ Cover Letter (1 pp)** | https://milestoneteachers.github.io/becoming-ilona-lesson/Becoming-Ilona-Cover-Letter.pdf |

---

## What's in the print PDF (51 pp)

| Section | Length | What it does |
|---|---|---|
| 1. Lesson opener | 2 pp | Curriculum codes (A3.7 + B3.5 verbatim), the Big Idea, age-relatability framing, learning targets |
| 1b. Minds On | 2 pp | 5-minute opener: "What does your name carry?" with 4 prompts incl. age bridge to Judy at 7 |
| 2. Meet Judy | 2 pp | Bio + 1938 Budapest park + ice-skating photos with attribution |
| 3. Before We Read | 2 pp | Class agreement + content background + 1932 Hungarian classroom + forged-Kennkarte photo |
| 4. Vocabulary | 1 pp | 6 vocab cards in Brandon's voice |
| 5-6. Reading | 4 pp | 4 brief illustrative quotes from the Foundation's openly-published excerpts + Brandon's marginalia + 1943 Pannonhalma nuns photo (Benedictine, captioned to clarify ≠ Ursuline) |
| 7. Judy's Journey | 2 pp | Animated journey map still + 1948 Pier 21 Halifax photo + 2025 Pincehely church photo |
| 8. Comprehension | 2 pp | 6 questions: 2 literal, 2 inferential, 2 connective |
| 8b. Sample Response | 2 pp | Brandon's worked example for Q4 with Level 3 / Level 4 reasoning |
| 9. Thought Experiment | 2 pp | "What would you have kept hidden?" with sentence stems, IHRA 3.2.7 cited |
| 10. Reflection | 2 pp | Three choice prompts for 24-hour homework |
| 10b. Exit Ticket | 1 pp | 3-minute in-class formative assessment |
| 11. Teacher Notes | 4 pp | Six classroom-real notes incl. handling silence, exits, hard questions |
| 12. Standards & Rubric | 4 pp | Full A3.7 / B3.5 alignment + 4-point rubric |
| 13. Sources | 2 pp | Primary memoir + curriculum + IHRA + USHMM + Echoes & Reflections + Yad Vashem + Azrieli |
| 14. About the Designer | 1 pp | Your bio verbatim |

Total photos: 12, all license-verified (Wikimedia Commons, Public Domain Canada, FORTEPAN CC BY-SA).

---

## What's in the digital immersive lesson

The same lesson reading, but reorganized into a single scrollable HTML page with these integrations:

- **Interwoven map:** sticky on the right side, advances with scroll. As you scroll into "Meet Judy" the map flies to Budapest 1937. As you scroll into "Reading I" it flies to the Ursulines on Stefánia Street. As you scroll into "Reading II" it flies to Pincehely. Etc.
- **Three Street View links** (open in new tab to walk the actual streets today): Stefánia Street Budapest, Pincehely village, Mile End Montreal.
- **Three Remotion-animated moments** (15-30 seconds each, embedded inline at the right beats):
  - **Cover-story checklist** (between Vocabulary and Reading I): the 7-line cover story Ilona had to memorize, animated checkmarks
  - **Hidden-child daily clock** (between Reading I and Reading II): 24-hour clock cycling through the daily routines that Ilona performed as cover
  - **Two-names toggle** (at Comprehension): visual representation of Judit | Ilona, the parallel inner lives held under one name
- **Inline audio player** at the top: the entire lesson narration as MP3, click-to-play, with section-jump buttons.
- **"Download print PDF" button** so the digital page acknowledges the print one.

---

## What you must do before submission

There are now ~10 `[TODO Brandon: ...]` markers across the four written artifacts. Search for `TODO Brandon` in the source HTML files in `output/azrieli/lesson-pages/`.

The biggest five:

1. **Cover letter, hiring manager name + position title.** Currently bracketed.
2. **Cover letter paragraph 2 (the personal note).** Decide whether to add one specific sentence about your grandparent. The paragraph stands honestly without it.
3. **Page 11, Teacher Note 2** ("When a student steps out of the room"). Drop in a real classroom moment from when you taught something hard.
4. **Designer's Note Choice 2.** I claimed your first draft asked "imagine you are Judy." If true, keep as authentic process disclosure. If not, strike it.
5. **Page 1 Big Idea.** A new TODO marker asks for a real classroom moment when you asked a Grade 6 student what they remembered being seven and the answer stayed with you.

---

## The final read-aloud pass

Read every printed word of the lesson plan, the Designer's Note, the Cover Letter, and the Family Letter out loud, in your own voice, before you submit.

Anything that doesn't sound like you when you read it out loud, rewrite. The drafts try to sound like a thoughtful Ontario teacher; they will get closer to that with your hand on them.

---

## Iteration

When you have notes, edit the source HTML files in `output/azrieli/lesson-pages/`, then re-run:

```bash
cd output/azrieli
node scripts/assemble-azrieli-lesson.mjs    # rebuild lesson HTML site
node scripts/render-azrieli-pdf.mjs          # rebuild print PDF
node scripts/render-companion-pdfs.mjs       # rebuild Designer's Note + Cover Letter + Family Letter
bash  scripts/deploy-azrieli-site.sh         # push everything to GitHub Pages
```

For audio regeneration after content changes:
```bash
rm output/azrieli/audio/parts/*.pcm           # clear stale cache
node output/azrieli/scripts/generate-audio-or.mjs  # ~$1, ~10 min
```

---

## Curriculum codes

The lesson aligns to two new 2023 Ontario Grade 6 Social Studies expectations:

- **A3.7**: Jewish communities in Canada and the impacts of antisemitism on those communities
- **B3.5**: Canadian government responses to human rights violations during the Holocaust and post-WWII human rights legislation

Both expectations were added in the 2023 curriculum revision under the Grade 6 Holocaust education requirement. There is no statute called the Holocaust Education Act; the mandate is an administrative curriculum revision (announced November 2022, implemented September 2023). The lesson cites the curriculum, not legislation.

Secondary alignment: Grade 6 Language (2023), Strand C: Comprehension, expectations C1.6, C2.5, C3.2, C3.6.

---

## Pedagogical frameworks cited

- **IHRA Recommendations for Teaching and Learning About the Holocaust** (2019), specifically 3.2.1 (creating a safe environment), 3.2.7 (no simulation), 3.4.3 (handling silence)
- **USHMM Guidelines for Teaching About the Holocaust**, especially 9 (translate statistics into people) and 10 (no simulations)
- **Echoes & Reflections** (joint program of ADL, USC Shoah Foundation, and Yad Vashem)
- **Yad Vashem Pedagogical Principles for Teaching the Holocaust at the Elementary Level**
- **The Azrieli Foundation's published guidance** on trauma-informed Holocaust memoir teaching

---

## Production notes

- **Layout and typography:** Source Sans 3 throughout, single warm-gold accent (#E8B341), white background. Modeled visually on the Foundation's published *Seeking Refuge* Student Reading Booklet.
- **Brief illustrative quotes from the memoir** (under 25 words each, fully cited) appear in the lesson under fair-use educational commentary. The bulk of the reading happens with the actual published memoir, which the lesson directs teachers to obtain free of charge from the Foundation at memoirs.azrielifoundation.org/education/memoirs/.
- **No AI-generated Holocaust imagery anywhere.** Photographs are real, sourced from Wikimedia Commons (CC BY-SA), Library of Congress / Public Domain, and FORTEPAN under CC BY-SA. The Remotion-animated moments use pure typography + abstract geometry; no human figures, no period scenes.
- **Audio narration** synthesizes only your original lesson scaffolding (Minds On, Vocabulary, Comprehension, Teacher Notes, etc.). The memoir excerpts are NOT narrated; they are read by the teacher from the actual published memoir during class.
- **Honest gap on Judy's photographs:** the Foundation has not published Judy's photos under any clear public-reuse license. Direct permission would need to come from `memoirs@azrielifoundation.org`. The lesson uses contextual archival photos with explicit captions clarifying "this is historical context, not Judy specifically."

---

## Submission checklist

- [ ] Open the print PDF, read every page out loud
- [ ] Open the digital lesson, scroll end-to-end, watch each Remotion moment, click each Street View link
- [ ] Hiring manager name and position title confirmed in cover letter
- [ ] All `[TODO Brandon: ...]` markers in the source HTML resolved
- [ ] Designer's Note Choice 2 self-disclosure either confirmed or struck
- [ ] Decision made on grandparent reference in Cover Letter paragraph 2
- [ ] Print PDF + Designer's Note PDF + Cover Letter PDF + Family Letter PDF + audio MP3 attached to email
- [ ] The digital lesson URL referenced in the cover letter
- [ ] Bcc yourself on the submission email

---

Designed by Brandon Gluck, May 2026.
