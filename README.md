# Ship Test Bench

Browser-based ship simulation with a single Test workspace and the built-in 120 m demo ferry. The page opens directly into Waves with motion and live buoyancy meters. Heel, Hydrostatics, Stability, and Performance are available beside it.

See [REPO_MAP.md](REPO_MAP.md) for every project file, the calculation flow, and the remaining work for testing imported ship meshes.

See [SIMULATION_INPUTS.md](SIMULATION_INPUTS.md) for the metric-by-metric input checklist, formulas, units, fixed assumptions, and comparison guidance for another ship or ANSYS results.

See [ANSYS_IMPORT.md](ANSYS_IMPORT.md) for importing ship-specific motion/force recordings, metadata, supported report formats and coordinate conventions. A runnable, clearly labelled synthetic example is in [examples/ansys-synthetic](examples/ansys-synthetic/).

Built on [vessel.js](https://github.com/shiplab/vesseljs) (MIT licence), React, and Three.js. There is no backend or AI service.

> Early pre-check only. Not an official approval. Flooding is a simplified estimate.

## Run

Use Node.js 24 LTS, or another Node version supported by Vite 8 (20.19+ or 22.12+).

~~~sh
npm ci
npm run dev
~~~

Open the local URL printed by Vite (normally http://localhost:5173).

This workspace also has a portable Node runtime under the ignored .tools/ directory. In PowerShell, it can be used for the current terminal:

~~~powershell
$env:Path = "$((Resolve-Path .tools\node-v24.22.3-win-x64).Path);$env:Path"
npm.cmd run dev
~~~

The portable runtime is local tooling and is not committed.

## Interface

Test is the only workspace tab. The header has a File menu for model import, model dimensions, simulation/playback status, camera reset, and a theme toggle. Its sidebar has Waves, Heel, Hydrostatics, Stability, and Performance. Flooding, Evacuation, Design, Issues, Inspect, Damage, How to use, Sources, the other old menus/branding, deck selector, editor tools, and tour are removed. There is no Fix with AI tab.

The model is read-only. Drag to orbit, scroll to zoom, and double-click a space to focus the camera. Test controls remain scrollable beside the viewport on desktop and below it on narrow screens.

Use **File > Import ANSYS package...** and select a setup JSON, its STL/self-contained GLB, and all referenced CSV/OUT reports together. Fields fill from metadata, and that ship's meters and animation follow its recording on one timeline. Pause, seek, restart, change playback speed or loop; use the header's **Ship profile** selector to switch ships. Profiles retain their data and timeline position during the browser session. Reload starts the demo again.

Use **File > Import model (STL / GLB)...** for geometry alone. It stays static with unavailable readings until **Attach / replace ANSYS results...** supplies setup/results. The initial 1 m placement is a placeholder; set physical length/orientation in File or supply them in the package. Import adds profiles; Attach replaces only the selected matching ship's setup. No imported ship inherits ferry readings. Recorded geometry/conditions are locked to metadata, and incomplete channels remain unavailable.

- **Waves:** sea-state presets, wave amplitude/frequency/heading, speed, motion gauges, live hydrostatic buoyancy (MN), displaced volume, equilibrium weight, and traces. Unsupported analytical motion settings show an unavailable message rather than invalid scene transforms.
- **Heel:** automatic sweep or a manual angle, GZ, and righting moment. The dial extends beyond the evaluated GZ range to keep its red sector visible. If the curve never crosses zero, red means beyond the calculated range; the endpoint is not labelled as a known stability-loss angle.
- **Hydrostatics:** floating condition, weights, hydrostatic curves, and tables.
- **Stability:** GZ curve, initial GM, stability range, and reference criteria.
- **Performance:** resistance/power curves and regular-wave motion inputs and response curves.

Each test supports run/pause, restart, and playback speeds from 0.5x to 4x. Live measurements reset when changing or restarting tests. PDF download remains in the Test panel; it currently includes the original engineering and compliance sections.

The preceding analytical test descriptions and PDF apply to the demo ferry. Imported profiles use a separate results panel: Waves displays recorded motions/forces, Heel uses recorded inclination, Hydrostatics shows supplied setup, Performance shows recorded min/max, and Stability has no imported assessment. GZ/righting moment and the demo PDF are excluded from imported profiles. Normalized results can be exported as CSV.

Only the ferry's cruise hull is shipped as a production preset. Box and V-section hulls live in tests/fixtures/hulls.json solely for analytic verification.

Deep links select a test with ?test=sea or ?test=heel. Removed flood/evac links default to Waves. Use &theme=light or &theme=dark to choose a theme. Legacy panel/mode/deck links do not reopen the editor. Reloading starts the demo ferry, regardless of the old browser session.

## Commands and verification

| Command | Purpose |
| --- | --- |
| npm test | Unit/physics checks, including ANSYS report parsing, units, synchronization/gaps, transactional packages, and mesh placement. |
| npm run typecheck | Strict TypeScript check. |
| npm run build | Type check and production build in dist/. |
| npm run preview | Serve the production build locally. |
| npm run e2e | Demo regression checks and actual multi-file ANSYS imports, profile isolation/switching, timeline/pose synchronization, playback boundaries, missing channels, batch/hash validation, and responsive layouts. |
| npm run report | Print the demo ferry's engineering report in the terminal. |
| npm run report -- my.design.json | Print the same report for an existing structured design JSON. |

Browser checks require Chrome or Edge. Set CHROME to its executable if auto-detection fails, and APP_URL if the dev server is not at http://127.0.0.1:5173/. Screenshots and downloaded PDFs are written to the ignored e2e-output/ directory.

## Calculation model and remaining work

The demo's structured hull offsets, loading, compartments, spaces, and routes drive the tests. The underlying engine still computes compliance results for reports and existing tests; removing that engine work is separate from removing its interface.

STL/GLB plus ANSYS setup/results import is available from File. Imported profiles play back recorded results; this browser application does not launch ANSYS or solve CFD for new geometry/conditions. Raw binary case/data and arbitrary .6dof motion layouts must first be exported/converted to the documented CSV. Incident regular-wave water can match supplied conditions; CFD wake/surface reconstruction is not imported. Compartment and evacuation-route data belong to retained legacy reports.

Weights include parametric estimates and GZ uses fixed trim. Wave animation uses prescribed analytical regular-wave amplitudes/phases. Live buoyancy is rho*g*instantaneous submerged volume with the primary wave linearized across each hull section. It excludes transient dynamic/viscous forces and does not feed back into the motion solution. Flooding/evacuation calculations remain in the original engineering reports and engine tests, but their tabs/animations are removed.

The original regulation PDFs, modelling questions, and engine helpers remain available for reference. The legacy sidebar module, inspector, help/tour, score ring, and finding cards have been deleted. Hydrostatics, Stability, and Performance live in EngineeringPanels.tsx with the shared Chart.tsx component. Only Test is a supported top-level workspace.
