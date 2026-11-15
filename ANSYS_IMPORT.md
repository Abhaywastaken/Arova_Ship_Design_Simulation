# Import ship-specific ANSYS recordings

This workflow plays back each ship's own exported results. It does not launch Fluent or predict a new sea condition. Files are read locally in the browser; profiles remain available for switching until removed or the page is reloaded.

## Try the included example

1. Start the app and choose **File > Import ANSYS package...**.
2. Select all four files in `examples/ansys-synthetic/`: `sample.setup.json`, `sample.stl`, `motion.csv`, and `buoyancy.out`.
3. Close File to view the meters and traces. Use the timeline, pause/run, restart, playback speed and loop controls.
4. Import another package, then use **Ship profile** in the header to switch between them and the demo ferry.

The example is generated box geometry and synthetic signals for checking the format. It is explicitly labelled **not CFD**. Replace it with your ANSYS results for judging.

## Prepare one package per ship and test condition

A package is a group of selected files, not a ZIP archive. Select its metadata JSON, STL/GLB, and all referenced CSV/TSV/OUT reports together. You can select several complete packages in one import if their filenames are distinct. References use exact filenames, without directory paths.

For an already imported mesh, **File > Attach / replace ANSYS results...** accepts one metadata file and its reports without selecting the mesh again. The metadata mesh filename must match the active profile's file. It replaces that profile's setup/results. Supplying the STL/GLB as part of an attachment also works. **Import ANSYS package** always adds new profiles, including another test condition for the same mesh. Include `mesh.sha256` when you need a content check in addition to filename matching; an incorrect hash rejects the import.

**File > Import model (STL / GLB)...** creates a static geometry-only profile. Its initial physical length is 1 m as a placement placeholder. Set its orientation and length in File; it has no readings until results are attached. A complete package supplies and locks physical placement from its metadata. Hiding the model never reveals the demo ferry behind an imported profile.

Use **Download setup template** in File for an editable metadata JSON, or copy `examples/ansys-synthetic/sample.setup.json`. Every example value must be replaced with the actual test setup.

## Required setup metadata

The version-1 structure is demonstrated in the included JSON. It contains:

| Field | Meaning |
| --- | --- |
| `version`, `name` | Version must be 1. Name identifies the ship and test condition in the profile selector. |
| `mesh.file`, `lengthM`, `up`, `bow` | STL/GLB filename, physical overall length in metres, and original mesh directions such as `+Z` up / `+X` bow. Up and bow must be perpendicular. |
| `mesh.sha256` | Optional SHA-256 of the exact mesh file. |
| `coordinates.frame` | Must be `ship-x-forward-y-port-z-up`. All exported motion channels must already follow this right-handed ship frame. |
| `coordinates.rotationOrder` | `XYZ` or `ZYX`, matching the rotation convention of the exported angles. It is applied as Three.js intrinsic Euler order. Convert the source orientation before export if it uses another convention. |
| `coordinates.referencePointM` | `[x,y,z]` measurement/rotation point in the normalized ship geometry, metres. Typically the motion-report centre of gravity. |
| `equilibrium.draftM` | Still-water elevation above the normalized mesh bottom in metres. |
| `environment.waterDensityKgM3`, `gravityMps2` | Actual water density and positive gravity magnitude. |
| `reports` | At least one report with a filename, time column/unit, and explicit channel mappings. |

Optional setup includes mass in kg, beam/depth in m, CG and bow sensor coordinates in m, equilibrium roll/pitch in degrees, speed in m/s, and regular-wave amplitude/period/heading/phase. Missing setup values remain absent; the ferry's values are never substituted.

The geometry is first oriented into the ship frame, uniformly scaled to `lengthM`, shifted to aft `x=0`, centred at `y=0`, and placed with its **lowest mesh point at z=0**. Export reference points, CG, bow sensor coordinates and draft relative to this same normalized frame. A propeller or another feature below the moulded keel affects this origin; do not copy keel-referenced coordinates without the corresponding offset.

## Supported data channels

Each mapped channel has `column`, `unit`, and optional `sign` of `1` or `-1`. Example: `"buoyancy": {"column":"buoyancyz", "unit":"N"}`. Channel names and units are case-sensitive.

| Channel | Accepted units | Definition |
| --- | --- | --- |
| `roll`, `pitch`, `yaw`, `heel` | `deg`, `rad` | Right-handed inclination about the ship x/y/z axes. Roll and heel are x-axis readings. Angles are absolute inclinations relative to the equilibrium coordinate axes, not extra angles added to equilibrium roll/pitch. |
| `heave`, `surge`, `sway` | `m`, `mm` | z/x/y displacement of `referencePointM` relative to the equilibrium position, in a frame travelling at the specified steady ship speed. Export perturbations, not absolute CG coordinates or the steady forward travel distance. |
| `bowAcceleration` | `m/s2`, `g` | Global vertical dynamic acceleration at the specified bow point, excluding gravitational acceleration. `g` converts using this profile's gravity. It is supplied, not differentiated from noisy displacement samples. |
| `buoyancy` | `N`, `kN`, `MN` | Upward hydrostatic buoyancy; requires a nonempty `forceDefinition` in metadata describing the report, surfaces and pressure reference. |
| `verticalForce` | `N`, `kN`, `MN` | Total vertical hydrodynamic force. Kept distinct from hydrostatic buoyancy; retained in normalized exports/provenance. |
| `resistance` | `N`, `kN`, `MN` | Longitudinal resistance, with its sign convention set explicitly; min/max shown in Performance. |
| `submergedVolume` | `m3` | Supplied submerged volume. Retained in normalized export. |

Only map the channels you actually exported. At least one channel is required. No bow acceleration, buoyancy or heave is inferred from the other channels. Righting lever GZ and righting moment are excluded from imported profiles. The demo's existing analytical views remain separate.

## Motion CSV and Fluent force reports

A normalized motion CSV can have:

```csv
time_s,roll_deg,pitch_deg,heave_m,bow_acc_z_mps2
0,0,0,0,0
0.1,0.2,-0.1,0.02,0.03
```

Use the metadata to map these names to channels. Export motion history from ANSYS, then convert its position/orientation convention to the declared ship frame. Arbitrary `.6dof` layouts and binary case/data files are not parsed directly in this version; convert them to the documented CSV first. Prescribed/locked motion in ANSYS is still prescribed/locked in these results; it is not a predicted free response.

Native Fluent force `.out` files with a quoted column header are supported, including the format of the supplied `buoyancyz-rfile.out`:

```text
"buoyancyz-rfile"
"Time Step" "buoyancyz etc.."
("Time Step" "buoyancyz" "flow-time")
0 1000000 0
1 1000100 0.1
```

Set `time.column` to `flow-time`, `time.unit` to `s`, and the mapped force column to `buoyancyz`. A report name alone does not establish whether it contains hydrostatic buoyancy or total vertical force; preserve the actual ANSYS definition.

Times may use `s` or `ms`. Each report needs at least two strictly increasing finite times. Duplicate/restarted times, unknown units, missing files/columns, malformed numeric rows and duplicate channel mappings reject the whole import. Separate reports can have different sampling rates and time ranges.

## Playback and missing data

- Numeric channels are linearly interpolated by timestamp; angular interpolation takes the shortest arc. Export densely enough to resolve the actual motions. Multiple revolutions between adjacent angular samples are not reconstructed.
- Empty, `null`, `NaN` or `N/A` cells are missing. Gaps and times outside a channel's recorded span display **Unavailable**. There is no extrapolation or fallback to ferry readings.
- Missing motion components use equilibrium geometry only, with a notice in the timeline panel. The associated meters remain unavailable. With a separate heel channel but no roll, heel controls the x-axis pose; otherwise roll drives that axis. Heel falls back to the recorded roll angle when no separate heel channel exists.
- The timeline spans the union of supplied reports and stops at the final sample unless Loop is selected. Seeking pauses playback. Switching profiles remembers each profile's last position and starts its recording there. Tab changes do not restart recordings.
- Waves contains meters and traces. Hydrostatics shows supplied setup only. Performance shows recorded min/max, not fitted harmonic response amplitudes. Stability has no imported assessment. The demo PDF is not offered for imported ships. Normalized CSV export retains missing values as empty cells; channel units are degrees, metres, m/s2, N and m3 as documented above.
- Incident regular water follows `k=(2*pi/period)^2/gravity` and phase `k*(x*cos(heading)+y*sin(heading)) - (omega-k*speed*cos(heading))*time + wavePhaseRad`. Heading 180 degrees is head seas. This assumes deep water and a translating ship frame. Supply phase referenced to x=y=0 and the same time origin as the reports. A phase not supplied defaults to zero for visualization. Missing wave amplitude/period produces flat water. No wake, irregular spectrum or CFD water-surface reconstruction is inferred.

For judging, keep loading/scale and environmental conditions comparable across vessels and record the ANSYS mesh/time-step checks externally. Import validation checks format and consistency, not the numerical accuracy or provenance of a CFD calculation.
