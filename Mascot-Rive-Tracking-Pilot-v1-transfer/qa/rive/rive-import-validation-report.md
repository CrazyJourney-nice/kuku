# Rive Import Validation Report

## Result

**PARTIAL PASS — usable pilot import, not production-identical artwork.**

The validated SVG geometry was reconstructed in the connected Rive document and
the neutral character renders correctly after draw-order repair. The imported
runtime is suitable for controller and interaction validation. It is not
pixel-identical to the Illustrator master and does not yet contain hand-authored
perspective vertex poses.

## Source integrity

No source file was edited.

| Source | SHA-256 |
| --- | --- |
| `mascot-interactive-topology-v1-master.ai` | `184eab8ddba8029975362a2cf7e13d027d1e3fca21003a73395c9ed0d7e51372` |
| `mascot-interactive-topology-v1-runtime.svg` | `7530065d39d4fdba6ec6de2771185050a5b50e5806b236f193c022c965eb72df` |

Validated source metrics:

```text
Artboard:              1254 × 1254
Unique SVG IDs:        61
Rendered shapes:       42
Paths:                 38
Polygons:              4
Anchor endpoints:      923
Expanded path commands:945
Unsupported commands:  0
```

## Import method

Direct SVG import through the desktop Editor was not available to the automation
surface at authoring time. The 42 rendered SVG shapes were therefore recreated
through the Rive MCP path editor from the already validated SVG.

The reproducible parser is:

```text
rive/tools/generate-rive-shape-payload.mjs
```

It supports the command set present in this asset:

```text
M / L / H / V / C / S / Z
absolute and relative variants
```

This was a geometry reconstruction, not an image trace.

## Artboard and hierarchy

```text
MascotTracking_1254
├── background_fill
└── MASCOT_ROOT
    ├── foot shapes (viewer-left and viewer-right)
    └── BODY_PITCH_CTRL
        └── BODY_YAW_CTRL
            └── BODY_AIM
                ├── shell, ears, port, and cable
                └── FACE_PARALLAX_CTRL
                    ├── bezel and face panel
                    ├── EYE_CTRL_viewer_L
                    │   └── PUPIL_CTRL_viewer_L
                    ├── EYE_CTRL_viewer_R
                    │   └── PUPIL_CTRL_viewer_R
                    └── nose
```

Pivots:

```text
BODY_PITCH_CTRL: 627, 1091
BODY_YAW_CTRL:   0, 0 relative to pitch
BODY_AIM:        0, 0 relative to yaw
```

Feet remain outside both body controllers. Their baseline stays at SVG
`Y=1091`.

## Draw-order QA

The first hierarchy pass placed `FACE_PARALLAX_CTRL` behind `shell_base`.
Editor visual QA caught this immediately. Draw order was repaired so that:

```text
cable front
face/eyes/nose
port
shell highlights/outlines
shell base
cable back
```

Within each eye:

```text
eye outline
pupil group
sclera
```

The repaired neutral pose is shown in `pose-neutral.png`.

## Check matrix

| Check | Status | Evidence |
| --- | --- | --- |
| 1254×1254 artboard | PASS | Rive artboard inspection |
| 42 rendered SVG shapes recreated | PASS | MCP creation log and source parser |
| Semantic object names retained | PASS | Rive hierarchy inspection |
| Background `#FEF5E6` | PASS | Editor and runtime screenshot |
| Feet outside yaw/pitch controllers | PASS | Hierarchy inspection |
| Feet stay on baseline | PASS | 3×3 runtime screenshots |
| Neutral draw order | PASS | Editor visual QA after repair |
| Public ViewModel bound to artboard | PASS | Runtime load and Data Binding |
| Pupil clipping mask | NOT IMPLEMENTED | MCP surface exposed no clipping authoring |
| Pixel-identical to Illustrator QA | PARTIAL | Compound highlights simplify in runtime |
| True left/right 45° path poses | NOT IMPLEMENTED | Current pilot uses transform/parallax |

## Visual differences from Illustrator

The character identity, palette, silhouette, eyes, nose, ears, feet, and cable
placement are preserved. The runtime recreation simplifies some compound-path
details:

- cable inner highlight/stroke detail;
- bezel highlight/outline layering;
- some shell highlight nuance.

This is acceptable for interaction validation, but it should not be signed off
as final production artwork without an Illustrator-to-Rive visual refinement
pass.

