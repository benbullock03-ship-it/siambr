---
name: siambr
description: One sitting day of Senedd Cymru on a 3D stage, with an editorial register behind it.
colors:
  ground: "#F7F6F2"
  panel: "#ECEAE3"
  ink: "#16191D"
  body-text: "#3F474F"
  muted: "#65717C"
  border: "#D1CEBE"
  rule-strong: "#3F474F"
  accent-plum: "#C9187E"
  accent-plum-dark: "#8F0D57"
  accent-plum-on-ink: "#F485C2"
  timber-cedar: "#C87D4A"
  timber-cedar-dark: "#915025"
  timber-cedar-on-ink: "#E6A87C"
  focus: "#E8590C"
  inset-bar: "#D1CEBE"
  inset-bar-strong: "#16191D"
  success: "#1E6B41"
  warning: "#A65B00"
  error: "#C7261A"
  ink-room: "#111417"
  ink-room-raised: "#191D22"
  party-labour: "#D93B3B"
  party-conservatives: "#3B7BD9"
  party-plaid: "#329966"
  party-libdems: "#E59E2B"
  party-independent: "#7A828A"
typography:
  h1:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "clamp(2rem, 5vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.08
  h2:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "clamp(1.6rem, 3.2vw, 2.6rem)"
    fontWeight: 600
    lineHeight: 1.12
  h3:
    fontFamily: "DM Sans, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "DM Sans, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.65
  small:
    fontFamily: "DM Sans, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.45
  kicker:
    fontFamily: "DM Sans, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.14em"
    textTransform: uppercase
  figure:
    fontFamily: "JetBrains Mono, Consolas, monospace"
    fontVariantNumeric: "tabular-nums"
    fontSize: "clamp(2rem, 5vw, 3.5rem)"
    fontWeight: 600
rounded:
  none: "0px"
  small: "4px"
  pill: "100px"
components:
  plate:
    backgroundColor: "{colors.ground}"
    borderColor: "{colors.border}"
    rounded: "{rounded.none}"
  button-primary:
    backgroundColor: "{colors.accent-plum}"
    textColor: "#ffffff"
    rounded: "{rounded.none}"
    minHeight: "44px"
  focus-ring:
    outline: "3px solid {colors.focus}"
    outlineOffset: "2px"
---

# Design System: Siambr

> **Creative North Star: The Sovereign Assembly.**
> 
> Siambr treats democratic proceedings with the architectural reverence of the Senedd building itself: Cardiff Bay slate, Western red cedar timber, clean limestone stock, and precise Welsh parliamentary typography.
>
> Boring Hansard transcripts become an engaging, physical space not through gamification or cartoonish graphics, but through spatial clarity, honest material presence, and instant access to the verbatim record.

---

## 1. The Dual-Mode Architecture

Siambr functions as two complementary surfaces sharing a single URL and data backbone:

```
                  ┌──────────────────────────────┐
                  │        MODE SWITCHER         │
                  │ [ 3D Siambr ]  [ Register ]  │
                  └──────────────┬───────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
┌──────────────────────────────┐       ┌──────────────────────────────┐
│        THE STAGE (3D)        │       │         2D REGISTER          │
│ (Threlte / WebGPU / Three)   │       │ (High-density, low-power)    │
│                              │       │                              │
│ - One sitting day, a clock   │       │ - Zero WebGL overhead        │
│ - Floor light on the speaker │       │ - Member pages of record     │
│ - Guided camera, walk opt-in │       │ - Client-side search         │
│ - Divisions tint the desks   │       │ - Derived stats, badged      │
└──────────────┬───────────────┘       └──────────────┬───────────────┘
               │                                      │
               └───────────────────┬──────────────────┘
                                   ▼
                   ┌──────────────────────────────┐
                   │      THE DOSSIER PLATE       │
                   │  (Verbatim Speeches, Video,  │
                   │   Votes, Petitions, Citations│
                   └──────────────────────────────┘
```

1. **The Stage (`/sitting/{date}`)**:
   - Built on Threlte (Three.js for SvelteKit 5 runes).
   - Renders the Siambr chamber and plays one sitting day in real time from Senedd TV offsets: the speaking Member's desk lights, verbatim text scrolls beside the chamber, divisions tint the desks.
   - Designed for presence and legibility: who speaks, when, for how long.
   - Graceful fallback: WebGL failure, battery-saver mode, or `prefers-reduced-motion` automatically redirects to the 2D Register mode.

2. **2D Civic Register (`Mode: Register`)**:
   - Zero WebGL overhead, instantaneous page load.
   - Formatted as an unhurried, publication-grade civic ledger directly inheriting `datamapuk`'s typographic rigor.
   - Full mobile and screen-reader accessibility.

---

## 2. Color System: The Senedd Estate

The palette is derived directly from the physical materials of the Senedd building in Cardiff Bay:

| Token | Hex | Role |
|---|---|---|
| `--color-ground` | `#F7F6F2` | Limestone stock ground |
| `--color-panel` | `#ECEAE3` | Secondary elevated surface |
| `--color-ink` | `#16191D` | Welsh slate ink for primary reading text |
| `--color-timber-cedar` | `#C87D4A` | Western red cedar for architectural highlights |
| `--color-accent-plum` | `#C9187E` | The single primary action accent (Senedd brand plum) |
| `--color-border` | `#D1CEBE` | Hairline dividing rules |
| `--color-ink-room` | `#111417` | Deep slate night room |

### The One-Accent Rule
`#C9187E` (Senedd plum) is spent exactly **once per view**: on the primary interaction button or active marker. Secondary states use timber cedar `#C87D4A` or structural hairline rules, never a competing bright hue.

---

## 3. Typography: Three Faces, Three Jobs

1. **Lora (Serif)**:
   - Reserved for debate titles, plenary motion headings, and parliamentary acts.
   - Brings legal and civic gravitas to the spoken record.
2. **DM Sans (Humanist Sans)**:
   - Body copy, debate transcripts, Member biographies, and committee explanations.
   - Clean, legible, accessible down to 12px.
3. **JetBrains Mono (Monospace)**:
   - Dates, legislative reference numbers (e.g. `Bill 14/VI`), division voting figures (`32 For / 24 Against`), timestamps, and video offsets.
   - Strictly formatted with `font-variant-numeric: tabular-nums`.

---

## 4. Prose Standards: The Senedd Verbatim Charter

Inherited from `datamapuk/docs/editorial-standards.md`:

1. **No Invented Speeches or Sentiment**:
   - Siambr never summarizes a politician's intent with evaluative adjectives ("controversial speech", "fiery debate"). Copy states: *"Debated on 14 May 2024. 8 amendments considered; 2 agreed."*
2. **Provenance Labels**:
   - **Verbatim Official Record**: Speeches and procedural records transcribed directly from `record.senedd.wales`.
   - **Official Briefing**: Neutral summary authored by Senedd Research.
   - **Algorithmic Topic Cluster**: Stated explicitly with provenance badge: *"Topic clustered by Siambr engine — speeches verbatim."*
3. **Relocatability**:
   - Every sitting moment, Member page and dossier drawer provides a direct, permanent permalink back to the exact page on `senedd.wales` or `record.senedd.wales`.
