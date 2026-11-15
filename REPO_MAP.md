# Arova repository map

Snapshot: 15 November 2026. All paths below are relative to the repository root.

The application opens into Test with the 120 m demo ferry. File imports STL/GLB geometry and ANSYS metadata/recordings. Imported profiles use their own playback, meters and scene, with no ferry fallback. The header selects profiles and provides camera/theme controls. The editor shell, other navigation, deck selector, tour and editing shortcuts remain removed. The ferry is the only built-in production preset.

This map describes the current implementation, retained legacy source, and the dependencies relevant to imported-model testing. The legacy sidebar module, inspector, help/tour, score-ring, and finding-card components have been deleted. Hydrostatics, Stability, and Performance are restored as subviews inside Test, alongside Waves and Heel. The calculation and compliance engine still supports the existing tests and engineering reports.

## Application structure

The stack is Vite, React, TypeScript, Zustand, Three.js through React Three Fiber and Drei, Tailwind CSS, and jsPDF. Calculations use local TypeScript modules and a vendored copy of vessel.js. There is no application backend.

| Location | Responsibility |
| --- | --- |
| Repository root | Build configuration, project instructions, documentation, and rule data. |
| `src/data/` | Demo ferry construction and hull offset templates. |
| `src/engine/` | Ship data types, physics, arrangement topology, file conversion, and compliance checks. No React UI. |
| `src/ui/` | Test shell, shared state, simulation controls, shared fields/theme, and PDF reporting. |
| `src/ui/three/` | 3D scene, geometry, editing interactions, and test animations. |
| `src/vendor/vessel/` | Bundled vessel.js library, its declarations, licence, and patch notes. |
| `tests/` | Vitest unit and calculation verification. |
| `scripts/` | Browser testing and terminal reporting. |
| `docs/` | Regulation PDFs, reference ship documents, and the original challenge material. |
| `reference_images/` | Visual references for the interface and waves. |

### Runtime data flow

1. `index.html` loads `src/main.tsx`, which mounts `App` and loads the global stylesheet.
2. `src/ui/store.ts` starts with `demoDesign()`, holds application state, and schedules `analyze(design)` after a 200 ms debounce.
3. `src/engine/analyze.ts` creates the vessel.js ship and calculates its floating condition, stability, resistance, evacuation, and flooding. It also still produces geometry findings, rule results, a score, and element statuses for retained engine consumers and reports.
4. `App.tsx` renders only the Test workspace. `Viewport.tsx` renders the read-only ferry and runs animations. `TestPanel.tsx` provides five sidebar tabs: Waves, Heel, Hydrostatics, Stability, and Performance. The last three render from `EngineeringPanels.tsx`.
5. The viewport writes frame-by-frame measurements to the mutable `live` object exported from `store.ts`. The test panel refreshes its displays every 100 ms.
6. Browser PDF reporting and terminal reporting consume the same analysis output.

Imported data follows a separate path: `FileMenu.tsx` → `shipProfiles.ts` → `engine/ansys.ts` and `three/modelImport.ts` → store profiles. `App.tsx` switches to `ImportedTestPanel.tsx` and `ImportedScene.tsx`. One frame clock samples all recording channels, moves the model about its declared reference point/order, and updates `live`. Missing channels stay unavailable. Demo `Scene`/`ShipMotion` and its PDF/engineering views are not used for imported profiles. Files stay in memory until removal/reload.

## ANSYS workflow files

| File | What it does |
| --- | --- |
| [ANSYS_IMPORT.md](ANSYS_IMPORT.md) | Complete package/import guide, coordinate and measurement definitions, units, missing data, supported formats and limitations. |
| [src/engine/ansys.ts](src/engine/ansys.ts) | Pure metadata/report validation, CSV/TSV/Fluent OUT parsing, unit/sign conversion, independent channel ranges/gaps, binary-search interpolation and angular wrapping. |
| [src/ui/shipProfiles.ts](src/ui/shipProfiles.ts) | Profile types, local multi-file package loading, optional SHA-256 validation, transactional batches, mesh attachment, setup template and download helper. |
| [src/ui/ImportedTestPanel.tsx](src/ui/ImportedTestPanel.tsx) | Recording timeline/playback, five Test subviews, motion/force meters, time traces/provenance, setup, recorded extrema and normalized CSV export. Excludes GZ/righting moment/demo PDF. |
| [src/ui/three/ImportedScene.tsx](src/ui/three/ImportedScene.tsx) | Authoritative playback clock, interpolation to model pose/live values, reference-point and Euler-order transforms, optional matching incident regular-wave water. |
| [tests/ansys.test.ts](tests/ansys.test.ts) | Report formats, units/signs, timestamps, asynchronous channel sampling, missing intervals, angular wrapping and metadata rejection checks. |
| [tests/ansysPackages.test.ts](tests/ansysPackages.test.ts) | Multi-file profile isolation/attachment, mesh identity/hash checking and incomplete/invalid batch rejection. |
| [examples/ansys-synthetic/sample.setup.json](examples/ansys-synthetic/sample.setup.json) | Explicitly synthetic example setup and channel mappings, not an ANSYS result. |
| [examples/ansys-synthetic/sample.stl](examples/ansys-synthetic/sample.stl) | Closed box mesh used only to demonstrate the package format. |
| [examples/ansys-synthetic/motion.csv](examples/ansys-synthetic/motion.csv) | Generated 16 s motion/acceleration example. |
| [examples/ansys-synthetic/buoyancy.out](examples/ansys-synthetic/buoyancy.out) | Generated force signal in Fluent's quoted-header report format. |

## Root files

| File | What it does |
| --- | --- |
| [.gitignore](.gitignore) | Excludes dependencies, builds, caches, browser-test output, logs, secrets, editor files, and large reference videos. |
| [CLAUDE.md](CLAUDE.md) | Existing agent guidance: original product concept, architecture, calculation conventions, visual style, and verification expectations. Its editor and compliance requirements will need to follow the new scope. |
| [INSTRUCTIONS.txt](INSTRUCTIONS.txt) | Existing task-to-file reading guide, verification commands, and instruction to update `PROGRESS.md` after a session. |
| [PROGRESS.md](PROGRESS.md) | Work log, known gaps, and backlog. Older entries describe the original design editor. |
| [README.md](README.md) | Current test-bench setup, interface, commands, supported test/theme links, verification coverage, and remaining imported-model work. |
| [REPO_MAP.md](REPO_MAP.md) | This file: complete project file inventory, current runtime relationships, retained legacy source, and remaining conversion work. |
| [THINGS_TO_ASK.txt](THINGS_TO_ASK.txt) | Open questions behind rule thresholds and modelling assumptions, including stability, flooding, evacuation, and weights. |
| [index.html](index.html) | Browser HTML entry, page title, root element, and module script. |
| [package.json](package.json) | Package metadata, dependencies, and commands for development, builds, unit tests, type checking, reports, and browser tests. |
| [package-lock.json](package-lock.json) | Locked npm dependency graph for reproducible installation. |
| [rules.json](rules.json) | Ten compliance-rule definitions, thresholds, sources, colour meanings, and open questions. Also currently supplies simulation settings for flooding through `analyze.ts`. |
| [tsconfig.json](tsconfig.json) | Strict TypeScript configuration for source and tests; supports JSX, JSON imports, and the vendored JavaScript module. |
| [vite.config.ts](vite.config.ts) | React and Tailwind Vite plugins plus Vitest configuration for `tests/**/*.test.ts` in Node. |

## Buoyancy and model input additions

| File | What it does |
| --- | --- |
| [SIMULATION_INPUTS.md](SIMULATION_INPUTS.md) | Per-metric input checklist, units, formulas, fixed assumptions, data needed for another ship, and ANSYS comparison guidance. |
| [src/engine/buoyancy.ts](src/engine/buoyancy.ts) | Posed hull-section integration under a regular wave linearized per section; computes submerged volume and upward hydrostatic force rho*g*V in SI units. |
| [tests/buoyancy.test.ts](tests/buoyancy.test.ts) | Analytic box-hull checks for force/volume, heave, water levels, heel/trim, dry/fully submerged limits, density/gravity, and invalid inputs. |

The Waves panel displays live buoyancy in MN, volume in m3, equilibrium weight, and a buoyancy trace. This is not CFD: buoyancy does not drive the prescribed motions, and dynamic pressure/viscosity are excluded. Non-finite analytical motion outputs are rejected with an unavailable notice rather than sent into scene transforms. Flood/evac test query parameters fall back to Waves.

## Source entry and styling

| File | What it does |
| --- | --- |
| [src/main.tsx](src/main.tsx) | React entry point. Loads CSS, mounts `App` in Strict Mode, and exposes development-only store, live-measurement, and report hooks used by browser tests. |
| [src/index.css](src/index.css) | Tailwind integration, light/dark theme tokens, base typography, form styling, scrollbars, and shared animation classes. |

## Ship data

| File | What it does |
| --- | --- |
| [src/data/demoDesign.ts](src/data/demoDesign.ts) | Exports `blankDesign()` and `demoDesign()`. Builds the 120 m demo ferry in code: decks, rooms, stairs, doors, bulkheads, tanks, survival craft, people, and loading. Uses the `cruise` hull and `requiredMinutes()` from the rules engine when assigning wall ratings. Includes deliberate compliance problems for the original showcase. |
| [src/data/hullTemplates.json](src/data/hullTemplates.json) | Production hull data containing only `cruise`, the ferry's offset table and attributes. PX121/Gunnerus were removed; box/prism hulls moved into test fixtures. |

### Production hull and verification fixtures

`src/data/hullTemplates.json` contains only `cruise`, the passenger hull used by `demoDesign()` and the engine fallback. There is no model selector in the webpage. The ferry scales this offset table to 120 m x 20 m x 9 m.

PX121 (`psv`) and Gunnerus (`research`) have been removed. The analytic `box` and `wedge` shapes now live in [tests/fixtures/hulls.json](tests/fixtures/hulls.json) and enter physics tests as custom hulls; they are not production ship presets.

The production demo ferry is generated from structured data. The synthetic example STL is an opt-in import fixture, not a production ship preset.

## Calculation engine

| File | What it does |
| --- | --- |
| [src/engine/types.ts](src/engine/types.ts) | Defines `Design`, hull parameters, decks, spaces, stairs, doors, bulkheads, tanks, survival craft, loading, people, evacuation settings, findings, rule results, and status types. Includes pair keys and defaults for older design files. The current tests depend on this structured model even if editing is removed. |
| [src/engine/vessel.ts](src/engine/vessel.ts) | Main vessel.js adapter. Selects/scales hull offsets, builds ship specifications, estimates weights, includes tank contents and free-surface effects, solves draft/trim/GM, generates hydrostatic and resistance curves, calculates regular-wave motions, and exposes hull/deck geometry helpers. Also holds modelling constants and the bounded-waterline bug workaround. Core shared dependency for testing. |
| [src/engine/stability.ts](src/engine/stability.ts) | Integrates heeled hull sections at constant displacement to calculate the GZ righting-lever curve. Exports curve summaries, deck-edge immersion angle, and `gzAt()` interpolation for heel animation and displays. |
| [src/engine/flooding.ts](src/engine/flooding.ts) | Divides the structured hull into full-breadth compartments using watertight bulkheads. Calculates single and adjacent-pair lost-buoyancy damage cases, final draft/trim/GM, survival results, and simplified A/R indices. Supplies the flooding test. |
| [src/engine/evacuation.ts](src/engine/evacuation.ts) | Simplified evacuation calculation using rooms, doors, stairs, assembly stations, and a routing graph. Calculates route assignments, flows, congestion, queues, travel time, and total duration. Supplies the evacuation test and its animated routes. |
| [src/engine/topology.ts](src/engine/topology.ts) | Arrangement geometry and connectivity: rectangles, shared walls, overlap checks, door connections, deck membership, graph construction, shortest routes, and disjoint routes via max-flow. Shared by editing, compliance, and evacuation; cannot be deleted wholesale while retaining the current evacuation test. |
| [src/engine/generators.ts](src/engine/generators.ts) | Editor helpers for cabin-block and stair-core stamps, automatic doors, door snapping, and emergency-door widths. Primarily Design functionality. |
| [src/engine/rules.ts](src/engine/rules.ts) | Loads `rules.json`, implements the ten rule checks, creates findings and summaries, combines status severity, and calculates the compliance score. Also exports `ruleDef()` and `requiredMinutes()`, which other modules use outside the Issues panel. |
| [src/engine/analyze.ts](src/engine/analyze.ts) | Coordinates calculations, builds the route graph, produces geometry findings, runs compliance rules, and aggregates element colours and scores. Returns one combined `Analysis` object. This is the main place to separate simulation results from issue detection. |
| [src/engine/io.ts](src/engine/io.ts) | Retained engine conversion utilities for app design JSON, vessel.js specifications, and hull-offset CSV. Uses `blankDesign()` for vessel.js imports. No longer exposed through the webpage after removal of the File menu; does not process STL/GLB meshes. |

The ten rule IDs are `FIRE-ZONE-SIZE`, `FIRE-WALL-RATING`, `ESCAPE-TWO-EXITS`, `ESCAPE-STAIR-WIDTH`, `EVACUATION-TIME`, `FLOOD-SURVIVAL`, `INTACT-STABILITY`, `LSA-CAPACITY`, `WEIGHT-MARGIN`, and `REFERENCE-SHIPS`.

## Application interface

| File | What it does |
| --- | --- |
| [src/ui/App.tsx](src/ui/App.tsx) | Test shell, File/profile selector, dimensions/source, playback status, camera/theme, responsive layout. Selects the imported panel/footer instead of ferry analysis when a profile is active. |
| [src/ui/FileMenu.tsx](src/ui/FileMenu.tsx) | Package/geometry import, attach/replace results, setup-template download, busy/errors, physical length/axes for raw geometry, visibility and removal. Closes on outside click/Escape. |
| [src/ui/store.ts](src/ui/store.ts) | Demo analysis plus isolated imported profiles, selection, remembered timeline positions, seek/loop state and geometry resources. Starts the ferry in Test, prevents editor navigation, exports live measurements/reset. Retains unused legacy editing/session APIs. |
| [src/ui/TestPanel.tsx](src/ui/TestPanel.tsx) | Waves and Heel tabs, live buoyancy, gauges, traces, sea-state/wave/speed controls, manual/automatic heel, playback/restart/time scale, and PDF download. Refreshes measurements every 100 ms. Playback controls have accessible names; test tabs expose selected state. The heel scale extends beyond the GZ endpoint so the red sector has visible width; a curve endpoint without a zero crossing is labelled as the calculation limit, not a known stability-loss angle. |
| [src/ui/fields.tsx](src/ui/fields.tsx) | Shared numeric/text inputs, sliders, selects, checkboxes, sections, buttons, status badges/dots, key-value rows, icons, and number formatting. Used by testing as well as editing. |
| [src/ui/theme.ts](src/ui/theme.ts) | Space labels, colours, icons, default dimensions/person counts, status colours/labels, accent colours, and survival-craft/exit colours. Mixes shared display styling with editor defaults. |
| [src/ui/report.ts](src/ui/report.ts) | Generates and downloads a jsPDF report in the browser: scene snapshot, compliance score/findings/fixes, annotated deck plans, weights, stability, flooding, evacuation, and sources. The Test panel calls this file, so its compliance dependencies must be revised if report download remains. |

The simulation and analysis tabs share Test; opening an analysis view leaves the selected simulation running.

| File | What it does |
| --- | --- |
| [src/ui/EngineeringPanels.tsx](src/ui/EngineeringPanels.tsx) | Hydrostatics floating condition, weight tables and curves; Stability GZ curve and reference criteria; Performance resistance/power and regular-wave motion controls/response curves. Uses the existing calculation results. |
| [src/ui/Chart.tsx](src/ui/Chart.tsx) | Shared SVG line charts with axes, legends, multiple series, and reference lines for the three engineering views. |

## Three.js scene

| File | What it does |
| --- | --- |
| [src/ui/three/Viewport.tsx](src/ui/three/Viewport.tsx) | React Three Fiber canvas, lighting, orbit camera, camera presets/focus, ferry geometry, and Waves/Heel animation and live buoyancy sampling. Publishes live measurements and resets them on test changes/restarts. Editing and issue overlays/tints are disabled in the active Test workspace; legacy interaction/render helpers remain in source. |
| [src/ui/three/geometry.ts](src/ui/three/geometry.ts) | Builds Three.js buffer geometries for the parametric hull surface, deck outlines, and transverse compartment sections from vessel.js data. Does not process imported STL/GLB into calculation geometry. |
| [src/ui/three/modelImport.ts](src/ui/three/modelImport.ts) | Lazy STL/GLB loaders, mesh validation, format-specific initial axes, orientation/scale/keel/centreline normalization, and GPU-resource disposal. Converts display coordinates only; no physics inference. |

### Important viewport components

| Component or helper | Responsibility |
| --- | --- |
| `Viewport`, `Lights`, `CameraRig`, `focusOn` | Canvas setup, scene lighting, navigation, camera presets, smooth focus, and the development projection hook. |
| `Scene` | Composes the Test display and selected simulation overlays. Legacy Design-only branches remain inactive. |
| `ShipMotion`, `pushHistory` | Animates waves and heel; publishes measurements/history. Calls `resetLive()` on test changes/restarts to clear prior results. |
| `Sea` | Animated polygon wireframe water surface. |
| `DeckPlate`, `Bulkheads`, `Spaces`, `SpaceBox`, `Doors`, `LSAs` | Render the structured ferry arrangement. Some include selection or editing handlers and status colouring. |
| `FailingWalls`, `FlagPins` | Legacy issue overlays; disabled in the current Test workspace. |
| `Routes`, `FloodCase` | Route and selected-damage visualisations. Retained legacy helpers; the old animated flooding/evacuation components were deleted. |
| `RefMeshView` | Retained legacy reference renderer inside the demo scene. Normal imports now use ImportedScene; they never follow demo ShipMotion. |
| `Interaction`, `startDrag`, `magnet` | Legacy Design pointer handling, placement, snapping, dragging, and validation; not activated in Test. |

## Vendored library

| File | What it does |
| --- | --- |
| [src/vendor/vessel/vessel.module.js](src/vendor/vessel/vessel.module.js) | Bundled vessel.js JavaScript module providing ship/hull objects, hydrostatics, weights, draft/stability helpers, resistance, wave motion, and interpolation utilities. Imported through the engine adapter. |
| [src/vendor/vessel/vessel.module.d.ts](src/vendor/vessel/vessel.module.d.ts) | Minimal TypeScript declarations for the library classes and members used by this project. |
| [src/vendor/vessel/PATCHES.md](src/vendor/vessel/PATCHES.md) | Upstream source commit, local logging removals, bounded-waterline workaround, and provenance of the copied hull templates. |
| [src/vendor/vessel/LICENSE.md](src/vendor/vessel/LICENSE.md) | MIT licence and copyright notice for the vendored library. Keep with the library. |

## Tests and scripts

| File | What it does |
| --- | --- |
| [tests/physics.test.ts](tests/physics.test.ts) | Analytic checks for box and V-section hydrostatics, draft solving, GZ, lost-buoyancy flooding, trim, required index R, loading overrides, and weight margins. Depends on `box` and `wedge` fixtures. |
| [tests/evacuation.test.ts](tests/evacuation.test.ts) | Builds a small cabin/corridor/stair/assembly scenario and verifies route assignment, flows, density, stair queues, travel time, total duration, and limits. |
| [tests/io.test.ts](tests/io.test.ts) | Verifies design JSON round trips, vessel.js export/import hydrostatics and spaces, and rejection of unrelated JSON. Does not test mesh importing. |
| [tests/modelImport.test.ts](tests/modelImport.test.ts) | Mesh placement with nested transforms, all perpendicular signed-axis combinations, format defaults, source preservation, and invalid lengths/axes/files. |
| [tests/features.test.ts](tests/features.test.ts) | Mixed coverage for tanks/free surface, CSV offsets, overlap guards, stamps, auto doors, survival craft, findings, door snapping/widths, and refusal of room centres outside the hull. Retain calculation coverage while removing obsolete editor assertions. |
| [tests/rules.test.ts](tests/rules.test.ts) | Demo analysis and compliance regression checks, including targeted design edits that change findings. Also verifies basic floating condition, evacuation, flooding, and clean geometry. |
| [scripts/e2e.mjs](scripts/e2e.mjs) | Chrome DevTools browser checks: Test startup, removed tabs/score, single preset, Waves/Heel/buoyancy, actual STL/GLB uploads, import settings/errors/removal, playback, charts, camera, disabled editing, layouts down to 320 px, legacy URLs, and PDF. Writes generated mesh fixtures, screenshots/PDFs to ignored `e2e-output/`. |
| [scripts/report.ts](scripts/report.ts) | Terminal engineering report for the demo ferry or a supplied app design JSON. Calls `analyze()` and prints loading, hydrostatics, stability, resistance, evacuation, flooding, compliance findings, and geometry issues. |

## Regulation and reference documents

These are source/reference assets rather than runnable code. Their roles below follow project documentation and the source mappings in the app; this inventory does not revalidate their engineering content.

| File | Purpose |
| --- | --- |
| [docs/MSC.1-Circ.1533_Evacuation_Analysis.pdf](docs/MSC.1-Circ.1533_Evacuation_Analysis.pdf) | Evacuation-analysis reference used for the simplified method, flow tables, and timing. |
| [docs/MSC.429-98_Rev2_Flooding_MGN692_Annex.pdf](docs/MSC.429-98_Rev2_Flooding_MGN692_Annex.pdf) | Flooding/damage-stability reference associated with the original survival checks. |
| [docs/REG13_Means_of_Escape.pdf](docs/REG13_Means_of_Escape.pdf) | Means-of-escape reference for routes, stairs, and doors. |
| [docs/USCG_SOLAS-01_Stairs_in_Escape_Paths.pdf](docs/USCG_SOLAS-01_Stairs_in_Escape_Paths.pdf) | Stair-width and escape-path guidance used by stair checks. |
| [docs/Sources/04650 Rev.H General Arrangement GO SARS.pdf](<docs/Sources/04650 Rev.H General Arrangement GO SARS.pdf>) | G.O. Sars general arrangement used as a reference ship, including deck spacing. |
| [docs/Sources/23007-01-101-0110-01-R2-14-General-arrangement.pdf](docs/Sources/23007-01-101-0110-01-R2-14-General-arrangement.pdf) | Reference general arrangement associated with cabin-size comparisons. |
| [docs/Sources/9281-ga-plan-2017117-01-model-anynomized.pdf](docs/Sources/9281-ga-plan-2017117-01-model-anynomized.pdf) | Anonymized reference general arrangement, identified in the progress log as a 60 m fishery research vessel. |
| [docs/Sources/noaa_30507_DS1.pdf](docs/Sources/noaa_30507_DS1.pdf) | NOAA SWATH design report used for weight-margin and accommodation/escape comparisons. |
| [docs/ProjectOfDocs/MEYER Turku Challenge Presentation_SinceAI 2026.pdf](<docs/ProjectOfDocs/MEYER Turku Challenge Presentation_SinceAI 2026.pdf>) | Original challenge presentation and project context. |
| [docs/ProjectOfDocs/MeyerTurku_SinceAI_2026_Challenge_Brief.pdf](docs/ProjectOfDocs/MeyerTurku_SinceAI_2026_Challenge_Brief.pdf) | Original challenge brief behind the design/compliance product concept. |

## Visual references

| File | Purpose |
| --- | --- |
| [reference_images/Screenshot 2026-11-05 202415.png](<reference_images/Screenshot 2026-11-05 202415.png>) | Light Onshape interface with a turbine assembly cutaway; reference for CAD navigation, toolbars, and model presentation. |
| [reference_images/Screenshot 2026-11-05 202503.png](<reference_images/Screenshot 2026-11-05 202503.png>) | Light CAD/CAM view of a machined part and toolpaths; interface and model-view reference. |
| [reference_images/Screenshot 2026-11-05 202633.png](<reference_images/Screenshot 2026-11-05 202633.png>) | Dark Onshape Render Studio with a car model; dark viewport, panels, and lighting reference. |
| [reference_images/Screenshot 2026-11-05 202751.png](<reference_images/Screenshot 2026-11-05 202751.png>) | Light Onshape assembly view of a valve; toolbar, object tree, and orientation-cube reference. |
| [reference_images/reference gif wave.gif](<reference_images/reference gif wave.gif>) | Wave animation reference for the wireframe sea described in project guidance. |

## Remaining conversion work

### Separate compliance from simulation

The old sidebar module, Issues, Inspect, Design, Damage, separate evacuation analysis panel, How to use, Sources, score ring, finding cards, and help/tour have been deleted. Hydrostatics, Stability, and Performance are available through the new EngineeringPanels.tsx module inside Test. The score header, issue overlays, and editor controls are no longer exposed. Flooding and Evacuation tabs and animations have now been removed. Their engine calculations remain for existing engineering reports and regression tests. The underlying compliance engine still runs through `analyze.ts`, and the PDF and terminal reports still include findings and fixes. Remove or revise those consumers as a separate calculation/report cleanup.

Flooding currently reads permeability, heel limits, and case-mix settings through `ruleDef("FLOOD-SURVIVAL")`; move needed simulation configuration before deleting rule definitions. `demoDesign.ts` also uses `requiredMinutes()` to generate wall ratings. The route graph in `topology.ts` remains necessary for evacuation even when overlap/editing helpers become redundant.

### Make imported models the test subject

Imported ships now play back their own ANSYS recordings with explicit setup and channel mappings. Geometry-only profiles remain static/unavailable. This completes the result-import workflow; predicting unrecorded conditions, launching ANSYS, arbitrary .6dof parsing, mesh-driven force solving and CFD water-surface import remain separate future work.

| Imported view | Current source | Further predictive work |
| --- | --- | --- |
| Waves / Heel | Recorded motion, force channels and explicit setup. | A validated motion/force model or additional response data for unrecorded conditions. |
| Hydrostatics | Supplied metadata only. | A suitable mesh-to-hydrostatics backend with loading/CG data. |
| Performance | Recorded channel min/max. | Resistance curves and response functions across operating conditions. |

The retained animations visualize prescribed analytical regular-wave motion and heel. The deleted Flooding/Evacuation animations are no longer part of the workspace. Model import alone does not add a mesh-based fluid solver or infer an interior.

## Local tooling and verification

The map inventories project files, including vendored source and test fixtures. Git internals and installed/generated files are excluded. Dependencies are in `node_modules/`, build output in `dist/`, and browser evidence in `e2e-output/`. The ignored `.tools/` directory contains a checksum-verified portable Node 24 runtime and npm cache.

The React Vite plugin was upgraded for compatibility with Vite 8, and the missing `vite-node` dependency was declared for terminal reporting.

Verification on 15 November 2026: 91 unit/physics tests, strict TypeScript/production build, terminal report and all 93 browser checks passed. The browser suite covers independent profiles, actual metadata/CSV/OUT uploads, unit conversion, timeline/model synchronization, missing channels, end/loop behavior, batch import, hash rejection and 320 px layout, alongside demo regressions. No uncaught browser/console errors. Desktop/mobile recording screenshots were inspected. The existing production bundle remains large.
