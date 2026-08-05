# Mascot Vector Standard v1.0 — Canonical Contour Cleanup Validation Report

**Overall result: PASS**

Validation target: `mascot-interactive-topology-v1`  
Validation date: 2026-07-27 (Asia/Hong_Kong)

## Deliverables

| Deliverable | File | Size | SHA-256 |
|---|---|---:|---|
| Corrected Illustrator master | `mascot-interactive-topology-v1-master.ai` | 464,551 bytes | `184eab8ddba8029975362a2cf7e13d027d1e3fca21003a73395c9ed0d7e51372` |
| Runtime-only SVG | `mascot-interactive-topology-v1-runtime.svg` | 32,776 bytes | `7530065d39d4fdba6ec6de2771185050a5b50e5806b236f193c022c965eb72df` |
| Illustrator reopen QA screenshot | `qa/illustrator-runtime-reopen-canonical-cleanup.png` | 421,194 bytes | `1c86dd2933590beee311a2a0a2ba9eb4d120d5ac8f6ee92ae92c662570bf2183` |

## Illustrator master validation

| Check | Result | Evidence |
|---|---|---|
| Saved `.ai` master | PASS | Illustrator reports `saved=true`; RGB document |
| Approved semantic groups | PASS | `MASCOT_ROOT`, `BODY_AIM`, eyes, `pupil_driver`, feet and cable groups present |
| Pivot records | PASS | 10 required groups contain `pivot_svg` notes |
| Neutral transform contract | PASS | 10 required groups contain `scale_100; rotation_0; skew_0; mirror_false` notes |
| Guide layer | PASS | `_rig_guides_do_not_export` is hidden and locked; 18 pivot guide paths |
| Palette | PASS | 16 required RGB palette swatches present |
| Unique master item names | PASS | 98 page items; 0 duplicate named items |
| `*_fill` / `*_base` fill-only | PASS | 0 stroke ownership violations |
| Closed filled geometry | PASS | 0 open filled paths |
| Foot baselines | PASS | Illustrator Y = `163` / `163`, equivalent SVG Y = `1091` / `1091` |
| Old ear backing | PASS | `ear_viewer_L/R_inner_backing` absent |
| Unsupported master artwork | PASS | 0 raster, placed image, text and mesh items |

## Runtime SVG validation

| Metric / check | Result |
|---|---|
| XML validity | PASS |
| IDs | 61 total / 61 unique |
| Naming contract | PASS — canonical uppercase containers and approved `_L` / `_R` viewer-side tokens retained |
| Rendered shapes | 42 |
| Anchor endpoints | 923, below 1,500 |
| Expanded path commands | 945, below 1,500 |
| Open or empty geometry | 0 |
| Unbaked `transform` attributes | 0 |
| `<style>`, CSS classes and inline `style` | 0 |
| Raster, text, mask, filter, gradient, pattern, clipping, symbol, `use`, foreign object or script | 0 |
| Hidden/reference/guide artwork | 0 |
| Runtime size budget | PASS — 32,776 bytes, below 500 KB |
| Shape budget | PASS — 42, below 120 |

## Hierarchy and interaction separation

- Approved visual hierarchy and draw order: PASS.
- `BODY_AIM` remains independent from both feet: PASS.
- Both `eye_viewer` groups retain independent `pupil_driver` groups: PASS.
- Each `pupil_driver` still contains only its own `pupil`, `highlight` and `orange_accent`: PASS.
- No eye geometry, pupil hierarchy, pivot contract or interactive part separation was merged or flattened: PASS.

## Canonical contour cleanup

- All `fill` and `base` owners are fill-only: PASS.
- Foot L/R each have exactly one outline owner: PASS.
- Foot rectangular highlight removed and replaced by a closed inset highlight contained inside the foot silhouette: PASS.
- Extra foot bottom edges removed; both baselines aligned to SVG Y `1091`: PASS.
- Ear L/R each have exactly one outline owner: PASS.
- Ear 10 px `inner_backing` removed; inner and highlight are separate closed solid polygons; no exposed background ring in reopen QA: PASS.
- `cable_back_fill` and `cable_front_fill` are stroke-free: PASS.
- `cable_back` and `cable_front` each have exactly one stroke-only outline owner with geometry matching its fill silhouette: PASS.
- Structural unintended double-stroke check across feet, ears and cable: PASS.

## Illustrator reopen QA

Illustrator was fully closed, the exported runtime SVG was reopened through Illustrator, deselected and fitted to the artboard before capture.

Visual inspection confirms:

- no missing artwork or export flattening;
- no old foot rectangle or duplicate bottom edge;
- aligned foot baselines;
- no ear backing ring or exposed background gap;
- consistent cable outline and stroke-free cable fill;
- preserved eye and `pupil_driver` separation;
- no guide/reference layer in runtime.

## Independent read-only cross-check

An independent audit re-read the final runtime SVG and reopen screenshot from disk and matched both expected SHA-256 values.

- Structural result: PASS.
- Visual ear close-up: PASS — the former cream wedge is fully covered, the orange inner remains inside the dark frame and `inner_backing` remains absent.
- 61/61 unique IDs, 42 shapes, 50/50 closed path subpaths, 923 anchor endpoints and 945 expanded commands.
- 0 transforms, style elements, class references, unsupported features or guide/reference leaks.
- Final independent status: **PASS — no blocker within the requested scope**.

## Scope guard

This pass did not add animation, ML tracking, 3D, Polar Coordinate logic or a Rive State Machine. It validates the Illustrator master and runtime SVG handoff only; Rive import/animation behaviour was intentionally not tested in this scope.
