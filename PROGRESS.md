# Progress

## Ship-specific ANSYS package playback (2026-11-15)

- Implemented local multi-file import of setup JSON, STL/self-contained GLB, and CSV/TSV/Fluent quoted-header OUT reports. Metadata explicitly defines physical scale, mesh axes, ship frame, reference point, Euler order, equilibrium/environment, channel names, units and optional signs/hash. File supplies a setup template; ANSYS_IMPORT.md documents the contract and how to prepare exports.
- Added pure `src/engine/ansys.ts` for validation, unit conversion and timestamp interpolation. Separate report sampling rates/ranges are supported. Missing channels, cells, gaps and out-of-range times stay unavailable; no extrapolation or inference from the ferry. Total vertical force remains distinct from hydrostatic buoyancy.
- Added profile state, add versus attach/replace controls, transactional batch import, SHA-256 checking, a header selector and per-profile remembered positions. Geometry-only imports are static until results arrive. Profiles are session-memory only and reload returns to the demo.
- Added separate ImportedScene and ImportedTestPanel. One playback clock drives poses and all live readings, with seek/pause/run/restart/speed/loop and stop-at-end. Motion respects supplied reference point and rotation order. Optional incident regular waves use supplied conditions and time; no CFD wake reconstruction is inferred. Recorded conditions/scale are locked to setup.
- Imported Waves/Heel show their own channels; Hydrostatics displays metadata and Performance recorded extrema. Missing analysis is unavailable. GZ/righting moment and the ferry PDF are excluded from imported profiles. Added channel provenance and normalized CSV export. The demo's existing analytical workflow remains separate.
- Included an opt-in `examples/ansys-synthetic/` package, clearly identified as generated demonstration signals, not CFD. Updated README, repo map, simulation guide and reading instructions.
- Verification: 91 unit/physics tests, strict TypeScript/production build, terminal demo report and all 93 Chrome browser checks passed. Tests exercise actual STL/GLB/metadata/CSV/OUT uploads, two ships, synchronized readings/pose, missing ranges, playback end/loop, profile switching, batch import, bad hash, responsive layout and demo regressions. No uncaught browser or console errors; desktop/mobile recording screenshots inspected. Existing bundle-size warning remains. No deployment performed.

## File menu and model preview import restored (2026-11-15)

- Restored File in the Test header with local STL/self-contained GLB import. Imported geometry replaces the visible ferry and follows the existing Waves/Heel transforms; hiding/removing it restores the ferry. Design, Issues, Flooding, Evacuation and the other removed navigation remain absent.
- Added `src/ui/FileMenu.tsx` and `src/ui/three/modelImport.ts`: lazy loaders, invalid-mesh/error handling that preserves the previous model, format-specific initial axes, up/bow controls, display length, visibility/removal, and resource disposal. Source objects are retained for repeatable placement changes without accumulating transforms.
- This restores the old visual import capability, not a new mesh-based physics solver. The header and File controls explicitly identify the demo ferry as the calculation source. Display length does not change physical inputs; imported-vessel geometry/loading setup remains outstanding.
- Recomputed STL normals to avoid black surfaces from zero file normals, preserved GLB material transparency, removed hidden-ferry hit targets during preview, and made the mobile header use a separate model-information row.
- Added five placement/validation tests and browser uploads of generated STL/GLB fixtures. Verification: 78 unit tests, strict TypeScript/production build and terminal report passed; 82 full browser checks passed, then 17 focused import checks passed after the final material-preservation change. No uncaught browser/console errors. Inspected desktop and 320 px import screenshots. The full script now includes the additional GLB opacity assertion.
- Updated README, repo map, simulation guide and task-reading instructions. No hosted deployment performed.

## Live buoyancy and model preparation guide (2026-11-14)

- Removed Flooding and Evacuation tabs, animation components, test settings and live fields. Waves, Heel, Hydrostatics, Stability and Performance remain. Old flood/evac test links now fall back to Waves. Engine/report calculations are retained separately.
- Added `src/engine/buoyancy.ts`: reusable hull-section integration of the posed hull against a primary regular wave linearized across each section. The live force is rho*g*submergedVolume; it is a hydrostatic estimate and is not fed back into the prescribed motions or presented as Fluent CFD.
- Added a Waves buoyancy meter/trace in MN, instantaneous displaced volume, and equilibrium weight. Buoyancy follows the simulation clock and freezes on pause.
- Read the supplied ANSYS buoyancyz-rfile.out as data. It contains 101 samples from 0 to 0.1 s. Per the user's clarification, buoyancyz is upward buoyancy in N. It was not substituted into the demo ferry or used as a calibration without matching vessel/setup data.
- Created `SIMULATION_INPUTS.md` with headings for every motion, buoyancy, hydrostatic and performance readout: inputs, units, methods, constants/assumptions, missing inputs for higher fidelity, and ANSYS comparison setup.
- Added finite-output validation to the analytical motion adapter; unsupported combinations now produce an unavailable message with recoverable input controls instead of NaN scene transforms.
- Added eight analytic buoyancy tests and two motion-validity tests. All 73 unit/physics tests, TypeScript, production build, terminal report, and 68 browser checks pass. Browser checks cover live/calm-water buoyancy, pause/restart, removed links, unsupported-condition recovery and narrow layouts. Inspected the new buoyancy screenshot.
- Updated README, repo map and reading guides. No hosted deployment performed.

## Heel gauge and functional header (2026-11-14)

- Fixed the invisible heel red sector: both the demo GZ calculation and gauge previously ended at 80 degrees, producing a zero-width arc. The dial now extends to at least 90 degrees and labels the red region beyond an unconfirmed endpoint as beyond the calculated range.
- The heel readout now distinguishes a positive-to-negative GZ crossing from the last evaluated angle. The demo shows GZ evaluated to 80 degrees, not an unsupported claim of stability loss there. Calculation methods and simulation inputs were unchanged.
- Added a compact header with model name/dimensions, current simulation and playback status/speed, camera reset, and theme toggle. Test remains the only workspace tab. No hero text or removed menus were added.
- Added gauge-zone labels, accessible gauge names, and browser assertions for the visible red arc, correct endpoint wording, status updates, theme switching, and camera reset. Inspected desktop and mobile screenshots.
- Verification passed: 63 unit/physics tests, TypeScript/production build, terminal report, and all 60 browser checks with no uncaught browser/console errors. Updated README and repo map. Changes remain local.

## Engineering views restored inside Test (2026-11-14)

- Restored Hydrostatics, Stability, and Performance beside Waves, Heel, Flooding, and Evacuation inside Test. These three analysis views should remain; the earlier sidebar cleanup removed them too broadly.
- Added `src/ui/EngineeringPanels.tsx` with the existing floating-condition/weight tables, hydrostatic curves, GZ curve/reference criteria, resistance/power curves, and regular-wave motion controls/response curves. Restored `Chart.tsx` as their shared renderer.
- Sidebar tabs wrap on narrow screens. Opening analysis leaves the selected simulation running; selecting a simulation returns to its controls. The top-level workspace remains Test-only, and editor/issue/help tabs stay removed.
- Updated browser checks for all seven tabs, rendered analysis data/charts, and analysis controls at tablet, 390 px, and 320 px. Updated README, repo map, and reading guides.
- Verification passed: 63 unit/physics tests, TypeScript via production build, terminal report, and all 53 browser checks with no uncaught browser/console errors. Inspected desktop Hydrostatics and narrow-screen screenshots. No hosted deployment performed.

## Sidebar source cleanup (2026-11-14)

- Deleted the obsolete sidebar modules `panels.tsx`, `Inspector.tsx`, `help.tsx`, and their unused `Chart.tsx` dependency. This removes the old Issues, Inspect, Design, engineering/evacuation analysis, How to use, and Sources panels, along with score-ring, finding-card, and tour components.
- Restricted workspace panel state to Test and removed the remaining inspector navigation targets. The four simulations inside Test, including Evacuation, remain available.
- Added explicit browser checks for the absence of sidebar tabs, compliance summaries, score counters, and every circled legacy panel URL. Made PDF-download verification independent of earlier test output by giving each run a fresh download directory.
- Updated the repo map, README, and agent reading guides to match the deleted files.
- Verification passed: 63 unit/physics tests, TypeScript, production build, terminal report, and all 47 browser checks, with no uncaught browser or console errors. Inspected the current workspace screenshot. Changes remain local; no hosted deployment was performed.

## Test workspace implemented (2026-11-14)

- Replaced the editor shell with a single Test workspace. Removed the branding/menu bar, Design switch, deck selector, editing tools and shortcuts, tour, score header, and navigation to the other panels. Fix with AI is absent (there was no implementation in this checkout).
- Startup always opens Test with the demo ferry. Legacy mode/panel/deck links, invalid test parameters, and old saved designs cannot reopen Design or choose another preset. Valid test/theme links remain supported.
- Removed PX121, Gunnerus, box, and wedge from production hull templates. Moved the analytic box/wedge hulls to `tests/fixtures/hulls.json`; retained all existing physics checks.
- Preserved Waves, Heel, Flooding, Evacuation, camera orbit/zoom/focus, playback controls, and PDF reporting. Removed issue overlays/tints from the testing view. The underlying compliance engine and original PDF sections remain for a subsequent cleanup.
- Reset live measurements on test changes and restarts to prevent stale flooding/evacuation displays. Added a responsive layout with scrollable controls and accessible names for playback controls.
- Replaced editor browser tests with 32 checks of the actual Test UI, simulations, playback, camera, legacy URLs, reports, and layouts at desktop, tablet, 390 px, and 320 px. Inspected the resulting screenshots.
- Resolved existing setup problems: upgraded the React plugin for Vite 8 and declared the missing vite-node report dependency. Installed a checksum-verified portable Node 24 runtime in ignored `.tools/`.
- Verification passed: 63 unit/physics tests, TypeScript, production build, terminal engineering report, and all 32 browser checks with no uncaught browser/console errors. Vite still reports the existing large bundle warning.
- Updated README and the repo map. Next: define the STL/GLB model import and test setup workflow, then separate compliance checks/report sections from simulation calculations.

## Test bench direction (2026-11-14)

- Created `REPO_MAP.md` with the complete project file inventory, runtime data flow, existing test dependencies, and removal boundaries. Linked it from `README.md`.
- Requested next scope: remove Design functionality and issue detection, retain testing functionality, accept STL/GLB ship models, and keep the demo ferry as the only built-in ship preset. No functional changes have been made in this mapping step.
- The current STL/GLB loader creates a visual reference overlay; physics still uses structured hull offsets and arrangement data. Imported-model testing needs that connection implemented explicitly. Flooding needs compartment setup, and evacuation needs route/occupancy data absent from the current mesh import.
- Keep the demo's `cruise` hull. The `box` and `wedge` presets also serve as analytic test fixtures and should be moved into test data if removed from production templates.
- Documentation and source references checked statically. Runtime checks were not performed: Node.js/npm are not available on the shell path and `node_modules/` is absent.

## Status (2026-11-07)
Core engine, rules, early warnings, editor, test mode and PDF report all work and are tested.

Done in session 2:
- Flag text rewritten: every finding has what / why / fix; summaries are plain sentences. "Assumed / ask Meyer" badges removed from the UI and collected in `THINGS_TO_ASK.txt`.
- `INSTRUCTIONS.txt` maps tasks to files; `CLAUDE.md` tells Claude to read it every session and after a reset.
- Overlap prevention: placing, dragging (snaps back), typing sizes, duplicating and stamps all refuse overlaps with a message.
- New parts: tanks with contents and filling (free-surface correction in GM), lifeboats and liferafts with new rule LSA-CAPACITY, cabin-block and stair-core stamps, auto doors, "set every wall to minimum rating".
- Imports: hull offsets CSV (replaces the hull in all calculations), STL / OBJ / glTF / GLB reference models, vessel.js JSON (now including lifeboats and deadweight). CSV template download.
- UI: dark theme default with light toggle, new palette, hover lift on spaces, pulsing flags, zoom to cursor with damping, double-click to fly, menu bar (File, Edit, Build, View, Analyze, Test, Help), floating tool rail, game-style build bar with hotkeys and counts, toasts.
- Test mode: waves (vessel.js motions on an animated sea), heel sweep with GZ, flooding animation to the damaged waterline, evacuation walk-through with moving people; live dials and traces.
- PDF report (jsPDF): summary with 3D snapshot, all flags with fixes, deck plans with flagged parts outlined and numbered, weights, GZ, damage cases, evacuation, sources.
- How to use tab (animated concept loop + interactive tour with spotlight and arrows, auto-starts on first visit) and Sources tab (method per rule, documents, "no AI used").
- Bug found by the browser test and fixed: room boxes swallowed pointer moves, so dragging across other rooms and previews over rooms did not work. Moves are now read at window level and intersected with the deck plane.
- Tests: 52 unit/physics tests, 14 browser checks (`npm run e2e`).

Done in session 3:
- Stair rule now follows the downloaded USCG PRG SOLAS-01 (quotes FSS Code 13.2.1.1): below 900 mm is red; 800 mm only for the Reg 13 dispensation case. Stair C (850 mm) in the demo is now red.
- UI redesign after the reference videos: neutral charcoal / off-white themes, dark-orange accent, crisp status colours without glow, thin monochrome icons that light up on hover, minimal right panel (rows, hairlines, underlined tabs), polygon wireframe sea with brighter crests, rooms assemble on load, map-style pins above flagged rooms, wipe/pop animations, drifting line fragments.
- Browser test now also takes dark, light, inspector and tour screenshots; a pin-blocks-drag bug it found is fixed (pins are visual only).

Done in session 4 (2026-11-06):
- Stair checks (ESCAPE-STAIR-WIDTH): the flights must fit in the stairwell box (length needed = rise per flight / tan 45 degrees; width needed = clear width, or 2 x clear width with 2+ flights per deck), and a stair needs a door on its top and bottom deck. Demo results unchanged. 3 new tests (55 total).
- Inspector stair section shows the climb, rise per flight, length and width needed versus actual, and people arriving versus passing per second.
- Dropdown lists use theme colours in both themes (were white with light text on Windows in dark mode).
- Build bar and tool rail: soft rounded tile in the tool colour on hover/active, icon fades slightly.
- Rules without a downloaded PDF (fire zone, fire walls, stability, lifeboats) now link to the online source page.

Done in session 5 (2026-11-07):
- New sources in docs/Sources reviewed: NOAA SWATH research ship design report (1990) and general arrangement drawings of G.O. Sars, GA 23007 and GA2017117 (60 m fishery research vessel). They are reference ships, not rules; only implementable parts were taken.
- New rule WEIGHT-MARGIN (NOAA Tables 1 and 8): design and build margin 6.8 % plus service life margin 4.5 % of lightship added at the lightship KG; draft solved again (grownCondition in vessel.ts, analytic box test); freeboard and GM checked.
- New rule REFERENCE-SHIPS (amber hints): cabin area per person (7.5 m2), deck-to-deck height (2.5 m), escape routes through rooms (NOAA 2.4.2).
- ESCAPE-STAIR-WIDTH: emergency doors into a stair at least as wide as the stair (REG13 guidance G5.1, amber). Demo now shows this for Stairs A and B.
- Emergency doors: renamed in the UI, drawn thicker with a screen-size exit icon on the active deck, door tool snaps to the nearest wall between two rooms (3 m), green/amber preview, refuses duplicates, width = stair width into stairs (emergencyDoorWidth), door inspector "Set to stair width".
- App always starts from the default demo ferry; File > Restore last session brings back the previous browser session.
- Rooms whose centre is outside the hull (in the water) are refused when placing, stamping, dragging, typing coordinates or duplicating (centreOutsideHull).
- Tests: 63 unit/physics, 17 browser checks.

## To-do
### Docs and data
- [ ] Download the USCG stair PDF by hand (see THINGS_TO_ASK.txt)
- [ ] Get answers to Q1 to Q9 in THINGS_TO_ASK.txt and update rules.json

### Next
1. [ ] Resize handles in 3D (now via inspector numbers)
2. [ ] Rotate spaces by 90 degrees (stairs across the ship)
3. [ ] Wing (asymmetric) compartments and heel in damage cases
4. [ ] Analysis in a Web Worker for bigger designs (now about 250 ms for 116 spaces)
5. [ ] STEP / IGES import via an OpenCascade WebAssembly module (large download)
6. [ ] Optional: Claude explains a flag from `docs/` excerpts (verdict stays deterministic)
7. [ ] Code-split three.js and jsPDF to cut the bundle size
