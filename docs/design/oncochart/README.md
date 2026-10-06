# Handoff: OncoChart · Jornada Oncológica 3D + OncoAssist

## Overview
OncoChart is an oncology clinical workstation (single-patient chart during a chemotherapy visit). This handoff covers the full chart **plus the new 3D module**:
- **Jornada 3D** — a depth-based oncological timeline (time × clinical lane × height) with a camera that flies to milestones.
- **OncoAssist avatar** — animated 3D-looking assistant that narrates the case (typewriter + optional pt-BR speech synthesis), with a guided tour.
- **Chart3D** — rotatable 3D bar charts: RECIST 1.1 target lesions over time and a CTCAE v5 toxicity "skyline".
- **OncoFab** — floating avatar on the main chart with rotating clinical hints; entry point to the 3D journey.

All patient data is **fictitious** (patient "Marina Costa", breast cancer cT2 cN1 M0 IIB, HR+/HER2−, BRCA1+, neoadjuvant AC-dd → weekly paclitaxel, today = C11).

## About the Design Files
The files in this bundle are **design references created in HTML/React (in-browser Babel)** — prototypes that show intended look and behavior, **not production code to ship directly**. Recreate them in the target codebase's environment (e.g. React + TypeScript + Vite/Next, with its own component library, state management and data layer). If no environment exists, recommended stack: React 18 + TypeScript, CSS Modules or Tailwind with the tokens below, Zustand/Redux for UI state, and either keep the pure-CSS 3D (preserve-3d) or port the 3D scene to **react-three-fiber** if more objects/performance are needed.

## Fidelity
**High-fidelity.** Final colors (oklch tokens), typography, spacing, motion and interactions. Recreate pixel-accurately on a fixed 1680×1000 canvas (scaled to viewport), or make responsive using the same proportions.

---

## Global layout
- Fixed design canvas **1680 × 1000 px**, scaled with `transform: scale(min(vw/1680, vh/1000))`, letterboxed and centered. Page never scrolls.
- `.app` grid: `58px | 1fr | 396px` → **Rail** · **Main** · **Side panel**.
- Main column (padding 0 14px): Topbar (52px) → PatientHeader → Timeline (2D) → Tabs → tab content → floating Dock (bottom center) → OncoFab (bottom right).

## Screens / Views

### 1. Main chart (existing, restored)
- **Rail** (58px): logo square 34px r11 accent; 7 icon buttons 40×40 r12; active = accent-soft bg + 3px accent bar at left.
- **Topbar**: breadcrumb · search (360px, h36, r10, Ctrl K → command palette) · day/night toggle (64×32, view-transition circular reveal 650ms) · alerts dropdown · user avatar dropdown.
- **PatientHeader**: avatar 72px conic ring, name 26px/600 −0.7px, diagnosis card 540px (CID tile 66px, TNM/stage/ECOG stats), actions (Consulta Flash).
- **Timeline 2D** (`.tl`): 4 lanes × 21px, months axis, events/cycles/thumbnails with hover tips, "HOJE" marker. **New:** a `Ver em 3D` button (`.tl-3d`, h22 r7, accent bg, 10.5px/600) in the header after the cycle chip → opens Jornada 3D.
- **Tabs**: Visão geral · Quimioterapia (C11) · Dados clínicos · Evolução — sliding 2px accent indicator (spring 350ms).
- **Dock** (bottom center, glass blur 14px): mic (recording) · Novo registro · Exames · Ciclo QT · Tumor-pack · Trials · **Jornada 3D (new)** · Encerrar·WhatsApp.
- **Side panel** (396px): Seg (Agenda / Gráficos / Exame), KPIs, queue with "Chamar próximo".
- Overlays: ImageViewer (CT + OncoAssist explainer), AudioBox, FinishModal, Tumor-pack drawer, Trials drawer, Anagráficos, Interações, Liberação QT (gates), Flash, Dx/CID modals, Palette.

### 2. OncoFab (floating avatar) — `avatar.jsx`
- Position: absolute, `right:20px; bottom:10px`, 58×66, z-index 35. Hidden while mic is recording.
- Avatar size 58. Speech bubble absolutely positioned `right:30px; bottom:70px`, h32, padding 0 12px, radius `16 16 4 16`, surface bg, 1px line-strong border, 11.5px/500, icon in accent.
- Hints rotate every **4800ms**: "RP −34% na TC de 28/set" · "Fluoxetina × tamoxifeno: trocar antes da HT" · "C11 liberado · todos os gates OK" · "Ver jornada em 3D". On hover: text = "Abrir jornada oncológica 3D" and avatar enters `talk` state. Bubble re-mounts with `bubIn` (450ms spring, from opacity 0 / translateX 10px / scale .9).
- Click → opens Jornada 3D.

### 3. OncoAvatar component — `avatar.jsx` + `styles3d.css` (`.ava*`)
Props: `size` (px, default 100), `speaking` (bool), `mood` (class hook).
Layers (all sized relative to `--s`):
- `.ava-halo` — radial accent glow, blur 6px, pulses (3s; 0.7s when talking).
- `.ava-ring.r1` (info color, rotateX 72°, spins 6s; 2.4s when talking) and `.r2` (amber, rotateY 64°, 9s reverse) — each with a 7px glowing satellite dot.
- `.ava-head` — sphere via radial gradient (highlight follows cursor), inner/outer shadows; overlay conic shimmer (`mix-blend: screen`, 7s spin; 2s talking). Rotates `rotateY(lx·28°) rotateX(−ly·24°)` toward the cursor.
- `.ava-face` — dark visor (40% radius) translated in Z (`s·0.12`) with parallax; contains 2 eyes (cyan glow, blink every 4.6s) and mouth (animates 220ms alternate when `speaking`).
- `.ava-float` — idle bob 4.2s (−7% of size); `.ava-shadow` scales in sync.
- Cursor tracking: global `pointermove`, `--lx/--ly` = clamp((cursor − center)/(3·size), −1..1).

### 4. Jornada 3D (modal) — `journey3d.jsx`
Container `.j3`: absolute `inset:24px`, radius 22, 1px line-strong border, grid `1fr | 440px`, enter `viewerIn` 550ms spring; backdrop blur 4px. Esc / backdrop click close (300ms).

**Left (scene):**
- Header (padding 14 18): cube icon · "Jornada oncológica · 3D" (16/600) · chips `D+147` (accent), `cT2 cN1 M0 · IIB`, `RP −34%` (ok) · view Seg (Perspectiva / Topo / Rasante, width 290) · overview button (deselect).
- Stage: `perspective:1150px; perspective-origin:50% 38%`. Camera node `.j3-cam` at left 50% / top 60%, `transform-style: preserve-3d`.
- **World coordinates:** X = time, `W = 1680px` across 1 May 2026 → 31 Jan 2027 (px per day = W / days). Z = lane depth: `[-165, -55, 55, 165]` for Diagnóstico, Imagem, Sistêmico, Cirurgia·RT. Y up = negative.
- Floor (1680 × 480, rotateX 90°): 30px grid, edges masked; future region (after today) hatched 135° ok-tinted; 4 lane strips (h52, r10, uppercase 12px/600 labels, letter-spacing 1.2px); month dividers (dashed) with mono 13px labels.
- **Today plane**: vertical gradient plane (480×220) at today X, rotateY 90°, accent bottom border; billboard label "HOJE · 06 out" (accent pill, 11px/700).
- **Treatment bars**: Box3D per bar (AC-dd×4, Paclitaxel×12, RT adjuvante), width = date span, depth 34, height 12; future = dashed ghost.
- **Cycle pillars**: Box3D 7×7, height 28 (today's C11 = 52, amber, brightness pulse 1.4s); future cycles ghost.
- **Milestones (13 stops)**: floor dot (22px, glow; selected → expanding ring 1.6s) + billboard (always faces camera: `rotateY(−yaw) rotateX(−tilt·0.6)`) with a gradient stem and either:
  - **Card** `.j3-card` 162px, padding 9 11, r12, glass (88% surface + blur 8), border 45% of event color; small mono 9.5px uppercase date·tag; title 13/600; subtitle 11px muted. Hover lift −4px scale 1.04; selected scale 1.16 + 3px colored ring. Future = dashed border, 62% bg.
  - **Thumbnail** `.j3-thumb` 150px (CT image 92px high, caption on #0b0b12) for imaging stops; selected scale 1.2, border ok.
  - Stem height = `54 + level·66 (+14 on systemic lane)`; level increments when stops on the same lane are < 170px apart (anti-collision).
  - Focus: when a stop is selected, others fade (opacity = max(.28, 1 − |dx|/520)) and blur 1.2px if |dx| > 300.
- Hint (bottom-left, 11px faint): "Arraste = orbitar · scroll = aproximar · ← → navegar · espaço = tour".
- **Scrubber** (padding 10 26 22): 6px track, fill gradient info→accent up to today; 13px ticks per stop (future = hollow), selected scale 1.6 + ring; month labels mono 10px.

**Camera behavior:**
- State `{x, yaw, tilt, dist}`; each frame lerps toward target with k = 0.075; idle sway `sin(t/3200)·2.2°` on yaw.
- Transform: `translateZ(−dist) rotateX(tilt) rotateY(yaw) translateX(−x)`; exposes `--yaw` and `--tilt` CSS vars for billboards.
- Presets: Perspectiva tilt −26 yaw −10 · Topo tilt −68 yaw 0 · Rasante tilt −9 yaw −26. Overview dist 640 (Topo 900). Selected stop: x = stop.x, yaw −4, tilt +6, dist −60 (Topo 260).
- User: drag → yaw offset ±40° (0.18°/px); wheel → dist offset −500..700 (0.8/deltaY). Offsets reset when view/selection changes.
- Keyboard: ← / → previous/next stop, Space toggles tour.

**Right (OncoAssist side, padding 16 18, gap 12, scrollable):**
- Row: OncoAvatar 104px (speaking while typing) · "OncoAssist" 17/600 · status dot (pulse) "narrando o caso…" / "tour em andamento" / "pronto" · voice toggle (speechSynthesis pt-BR, rate 1.05) · close.
- Narration card (surface-2, min-h 150, padding 14): header "NN/13 · title" in stop color; typewriter text 13px/1.55 with blinking caret (2 chars per 18ms). Intro text when nothing selected.
- Nav: ‹ · primary "Tour guiado"/"Pausar tour" · › · "Abrir TC" (ghost, only on imaging stops → opens ImageViewer with exam id).
- Progress segments (13 × 4px, done = 55% color, current = full + scaleY 1.8), clickable.
- Chart card: title switches ("RECIST 1.1 · lesões-alvo" / "CTCAE v5 · skyline de toxicidade") + Seg RECIST/CTCAE; Chart3D; legend row.
- Disclaimer 10px: "Narração assistiva com dados fictícios. Não substitui laudo nem decisão do oncologista."

**Tour:** advances to next stop after typing finishes + 2600ms (5200ms with voice). Stops at the last stop. Selecting a stop with `chart` property switches chart mode (imaging → RECIST, systemic → CTCAE).

**Persistence:** `localStorage` keys `onco.j3.sel` (default 9 = today) and `onco.j3.view`.

### 5. Chart3D — `chart3d.jsx`
- Stage h250, `perspective:900px`, origin 50% 30%, accent-soft radial floor glow, top border. World at 50%/66%, `rotateX(−24°) rotateY(var(--yaw))`.
- Auto-rotate: yaw = base + sin(t/2600)·20°; drag sets yaw (0.4°/px), release resumes oscillation around new base.
- Floor: 380×300, 34px grid, radial mask.
- **RECIST mode:** 3 timepoints (Baseline 20 mai / Interina 20 jul / Reaval. 28 set) at X = −112, 0, 112. Rows at Z −92 (Soma, amber, w58 d46), 0 (T1 mama, accent), 72 (T2 axila, info), w58 d40. Height = mm × 2.5. Values: T1 34/30/21, T2 18/16/11, Soma 52/46/32. Value labels above sum columns (13/700 mono). Green dashed horizontal plane at −30% of baseline (36.4 mm) labeled "−30% limiar RP".
- **CTCAE mode:** 6 rows (Neutropenia, Náusea, Fadiga, Neuropatia, Mucosite, Alopecia) × 9 cols (AC1–AC4, P2–P10) from `DATA.chemo.tox.g`, 26×26 boxes, spacing 34, height `4 + grade·26`; color G0 line-strong, G1 ok, G2 amber, G3+ danger.
- Grow-in: heights start at 2px and animate (900ms spring) with staggered `transition-delay` on mode change.
- Labels billboard toward camera.

### Box3D primitive
5 faces (front, back, right, left, top) on a `preserve-3d` node; face fill = `color-mix(color X%, oklch(0.18 0.03 280))` with shades front 88 / back 64 / sides 72 / top 100; 1px border in the color; ghost = transparent + dashed. Hover brightness 1.25. In production with r3f: `boxGeometry` + `meshStandardMaterial`, or keep CSS for ≤ ~200 boxes.

---

## Interactions & Behavior (summary)
| Trigger | Result |
|---|---|
| Timeline "Ver em 3D" / Dock "Jornada 3D" / OncoFab click | open Jornada 3D (`ov = 'j3'`) |
| Click milestone card/thumb/tick/progress | select (camera flies); click again = deselect (overview) |
| Drag scene / wheel | orbit / zoom |
| ← → / Space | prev/next stop / tour |
| Tour guiado | sequential narration with auto-advance |
| Voice toggle | Web Speech API pt-BR reads the current text |
| Abrir TC | opens ImageViewer for that exam |
| Esc / backdrop | close modal |
Motion tokens: `--ease: cubic-bezier(.2,.8,.2,1)`, `--spring: cubic-bezier(.34,1.56,.64,1)`.

## State Management
- App: `theme`, `tab`, `sideTab`, `ecog`, `dx` (versioned diagnosis), `ov` (current overlay: finish, pack, trials, anag, ix, clin, release, flash, dx, cid, **j3**), `viewer` (exam id), `mic`, `queue`, `pal`.
- Journey3D: `sel` (stop index | null), `view` (persp|top|low), `play`, `voice`, `chart` (recist|tox); refs for camera current/target/user offsets (no React re-render per frame — mutate style in rAF).
- Data: currently static `window.DATA` (`data.js`). In production fetch per patient/tenant: timeline events, cycles, RECIST lesions per timepoint, CTCAE grades per cycle, exams. Narration text is **hardcoded in `journey3d.jsx` (`J3.stops[].say`)** — replace with LLM-generated, grounded on patient data, with a clinical guardrail (no new dose/conduct claims) and human review.

## Design Tokens (oklch; hex approximations for night theme)
| Token | Night | Day |
|---|---|---|
| --bg | oklch(0.16 0.012 265) ≈ #101219 | oklch(0.985 0.004 240) |
| --surface | oklch(0.215 0.015 265) ≈ #1a1d26 | #ffffff |
| --surface-2 / -3 | 0.255 / 0.30 | 0.978 / 0.955 |
| --line / --line-strong | oklch(0.36 0.02 265/.55) / (0.45/.7) | 0.9 / 0.82 |
| --text / --muted / --faint | 0.96 / 0.72 / 0.56 | 0.22 / 0.45 / 0.6 |
| --accent | oklch(0.76 0.13 292) ≈ #b89cf5 | oklch(0.50 0.19 292) ≈ #6a3fd1 |
| --amber | oklch(0.82 0.13 78) | oklch(0.58 0.14 65) |
| --ok | oklch(0.78 0.14 160) | oklch(0.52 0.13 160) |
| --danger | oklch(0.70 0.17 22) | oklch(0.55 0.2 25) |
| --info | oklch(0.78 0.10 230) | oklch(0.5 0.13 240) |
| --wa | oklch(0.74 0.16 150) | oklch(0.55 0.15 150) |
Soft variants = same color at 10–18% alpha. Full list in `styles.css` top.
- **Typography:** Geist (400/500/600/700) UI; Geist Mono for numbers/dates/codes. Base 13px. Scale used: 9–10.5 labels, 11.5–13 body, 15–17 titles, 19 stats, 26 patient name.
- **Radius:** 5–8 (chips/small), 10–12 (buttons, cards inner), 16 (cards), 18–22 (modals, 3D container).
- **Shadows:** `--shadow` (night: inset top highlight + 0 12px 32px -12px black/.6), `--glow` (accent ring + 24px glow), modals `0 40px 100px -20px #000c`.
- **Spacing:** 4/6/8/9/10/12/14/18 px rhythm.

## Assets
- `assets/ct-torax.jpg`, `assets/ct-abdome.jpg` — placeholder CT images (demo only; replace with DICOM viewer/PACS thumbnails).
- Icons: inline stroke SVG set in `ui.jsx` (`P` map; 24-grid, stroke 1.75, round caps) — replace with codebase icon library (e.g. Lucide equivalents).
- Fonts: Google Fonts Geist / Geist Mono.

## Files
- `OncoChart.html` — entry, App shell, canvas scaling, overlay routing.
- `styles.css` — tokens + all base UI styles. `styles3d.css` — avatar, Box3D, Chart3D, Jornada 3D, OncoFab, grid fix.
- `data.js` — fictitious patient dataset.
- `ui.jsx` — Icon, Btn (ripple), Dropdown/DDItem, Modal, Drawer, ToastHost/useToast, Seg, Tabs, CountUp, Switch, SidePanel.
- `patient.jsx` — PatientHeader, 2D Timeline (+ "Ver em 3D"), DxModal.
- `tabs.jsx`, `panels.jsx`, `side.jsx`, `overlays.jsx` — chart panes, side panel, overlays.
- `avatar.jsx` — OncoAvatar, OncoFab. `chart3d.jsx` — Box3D, Chart3D. `journey3d.jsx` — Journey3D, stop data & narration.

## Clinical safety notes for implementation
- All data and narration are fictitious; label as demo until connected to real records.
- Narration must be grounded only on the patient record, never invent doses/conduct, and display the assistive disclaimer.
- Keep diagnosis/staging versioning (never overwrite) and audit trail as in DxModal.
