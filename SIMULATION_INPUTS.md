# Ship simulation inputs and displayed quantities

This checklist describes the implemented model, including the live buoyancy meter. Waves and Heel remain available, alongside Hydrostatics, Stability, and Performance. Flooding and Evacuation tabs and animations are removed.

The demo ferry uses analytical regular-wave motions and hydrostatics. It does not run a coupled six-degree-of-freedom CFD simulation. The checklist below describes that analytical engine. Imported ships now use their own ANSYS setup/results recordings in a separate scene/panel, with no ferry fallback. See [ANSYS_IMPORT.md](ANSYS_IMPORT.md) for the multi-file package, channels, units, coordinate definitions and playback limitations. An STL/GLB alone stays static with unavailable readings until results are attached. Geometry alone does not supply loading, inertia, damping, fluid properties, or wave conditions.

## Shared vessel and environment inputs

- **Geometry:** watertight external hull below and above the waterline, hull offsets or sections compatible with the engine, LOA, moulded depth, and correct physical scale in metres. A mesh-to-calculation conversion is still needed for STL/GLB.
- **Representation:** the current half-breadth model uses symmetric filled sections. Disconnected multihulls, tunnels, openings and other geometry outside that representation need a suitable geometry/calculation backend.
- **Coordinates:** x forward from stern, y positive to port, z up from keel. Record the file origin and orientation before conversion.
- **Loading:** lightship mass, cargo/deadweight, fuel/water/ballast, people/equipment, and their longitudinal, transverse and vertical centres of gravity. Current mass inputs are tonnes; forces use kilograms internally.
- **Tank free surface:** tank length/breadth, liquid density, filling percentage, and tank locations. Slack tanks raise effective KG.
- **Hull attributes:** prismaticLengthRatio, bulb/transom flags, stern form, and appendage areas/resistance factors for methods that use them.
- **Environment:** water density, gravity, wave amplitude, wave frequency or period, heading relative to ship, and ship speed.
- **Actual current defaults:** seawater density 1025 kg/m3; gravity 9.81 m/s2. Density/gravity are engine constants rather than exposed UI inputs. Resistance also uses the library's dynamic viscosity default 0.00122 Pa.s.
- **For a more complete motion model:** obtain roll/pitch inertia or radii of gyration, damping, added-mass/radiation data, frequency/heading/speed-dependent complex RAOs, and their reference point. The current app does not import these; geometry-based inertia and damping approximations are used instead.
- **Reference point:** distinguish LCF (animation pivot), LCG (centre of gravity), the bow measurement point, and the reference point of any external RAO or CFD output.

## Roll

- **Meaning/unit:** oscillatory rotation about the ship's longitudinal x axis, degrees.
- **Inputs used:** waterline length LWL, breadth BWL, draft T, block coefficient Cb, waterplane coefficient Cwp, transverse GM, hull prismaticLengthRatio, speed, relative wave heading, wave amplitude/frequency, water density and gravity.
- **Current assumptions:** vessel.js approximates the hull as two prismatic bodies; roll radius of gyration is estimated as 0.4 BWL. The adapter passes 20% critical damping. These are not measured inertia or calibrated damping for an imported ship.
- **Live signal:** roll(t) = rollAmplitude * sin(omegaE * t + 0.6), with the amplitude from vessel.js. The 0.6 rad phase offset is a visual prescription.
- **Prepare for another ship:** real loading and GM, hull coefficients, prismatic ratio, Ixx or roll gyration radius, calibrated damping, and validated roll RAOs. The last three require extending the current input/model interface.

## Pitch

- **Meaning/unit:** rotation about the transverse y axis, degrees; positive rendered pitch lowers the bow.
- **Inputs used:** LWL, BWL, draft, Cb, speed, wave amplitude/frequency/heading, and gravity through vessel.js's closed-form heave/pitch model.
- **Live signal:** pitch(t) = pitchAmplitude * sin(omegaE * t). The adapter takes the magnitude of the calculated amplitude and prescribes this phase.
- **Prepare:** hull sections/offsets and loading at the test draft, environmental inputs, plus Iyy, pitch damping and complex pitch RAOs for higher-fidelity prediction. The latter inputs are not currently consumed.

## Heave

- **Meaning/unit:** vertical translation of the ship about its reference floating position, metres; positive upwards.
- **Inputs used:** LWL, BWL, Cb, draft, speed, wave amplitude/frequency/heading, and gravity.
- **Live signal:** heave(t) = heaveAmplitude * cos(omegaE * t).
- **Prepare:** hull geometry and loading, wave setup, and heave RAOs/added mass/damping for a validated motion model. Current amplitudes use vessel.js's analytical approximation, not a time-domain force-balance solver.
- **Availability:** if the analytical library produces non-finite amplitudes for a loading/speed/heading combination, the app reports the estimate unavailable and hides live motion/buoyancy meters until valid settings are restored.

## Vertical acceleration at bow

- **Meaning/unit:** dynamic vertical acceleration at the centreline point x = 0.9 LOA. The dial shows g; the internal value is m/s2.
- **Inputs used:** heave and pitch signals, encounter angular frequency, LOA, LCF, and gravity for display conversion.
- **Implemented formula:** az = -omegaE² * (heave - pitchRadians * (0.9 LOA - LCF)). Display az / 9.81.
- **Prepare:** the exact measurement location and reference point used by the comparison data. This centreline formula has no off-centre roll contribution, structural vibration, slamming or gravitational projection onto a moving sensor.
- **Comparison detail:** the Performance panel uses its own position setting, default 80% LOA, and vessel.js measures that distance from LCG. Its acceleration amplitude is not the same calculation/reference point as the live bow signal.

## Heel

- **Meaning/unit:** imposed inclination used to inspect intact stability, degrees.
- **Inputs used:** manually selected angle, or the automatic sweep; the GZ curve uses hull sections, displaced volume, effective KG, TCG, draft, depth and BWL.
- **Current sweep:** 14 simulation seconds per cycle, from zero to min(evaluated stability range, 75 degrees). This is an inspection animation, not a predicted equilibrium response to wind, a moving load, or an applied heeling moment.
- **Prepare:** hull sections, total mass, KG/TCG, tank free-surface corrections, and a prescribed heel or external heeling moment. An external-moment equilibrium solver is not currently implemented.

## Righting lever GZ

- **Inputs:** submerged hull sections at each heel, constant displaced volume, KG and TCG. The section solver finds the waterplane height that preserves displacement.
- **Result:** GZ = (TCG - yB) cos(phi) - (KG - zB) sin(phi), metres.
- **Limits:** fixed trim; hull assumed watertight to moulded depth; no openings/downflooding. The default calculation evaluates through 80 degrees in 2.5-degree increments.

## Righting moment

- **Inputs:** total loaded mass M and GZ at the current heel.
- **Result:** M * g * GZ, displayed in MN.m. This is a restoring moment, not an applied heeling moment.

## Buoyancy

- **Meaning/unit:** upward hydrostatic buoyancy force. The live meter and trace display MN; the calculation stores N. 1 MN = 1,000,000 N.
- **Inputs:** watertight hull sections and moulded depth, mean draft, instantaneous heave/roll/pitch, LCF pivot, primary-wave amplitude/frequency/heading, encounter frequency, simulation time, density and gravity.
- **Method:** transform the hull sections with the same pose used by the viewport. At each section, clip the submerged polygon against a local tangent plane of the primary regular wave, integrate the submerged areas along the hull, then calculate FB = rho * g * submergedVolume.
- **Sampling:** section positions include an 80-interval longitudinal grid and the original hull stations. The wave is linearized across each section.
- **Important distinction:** this is a hydrostatic estimate evaluated on a moving hull. It excludes dynamic pressure, viscous forces, wave radiation/diffraction, entrained water and slamming. The prescribed ship motion does not respond to this force; FB - weight is not used to integrate acceleration.
- **Visual wave detail:** decorative cross-swell/chop in the rendered sea is excluded from the force calculation. The meter uses the primary regular wave only.
- **Prepare:** physical hull scale, geometry, loading/waterline, density, gravity, wave conditions and motion/reference frame. To compare total transient hydrodynamic force, use matching CFD/experimental definitions or extend the solver.
- **Physical basis:** [NASA's statement of Archimedes' principle](https://www.grc.nasa.gov/www/k-12/WindTunnel/Activities/buoy_Archimedes.html).

## Displaced volume

- **Inputs:** hull geometry and water surface relative to the hull.
- **Result:** submerged volume in m3. Hydrostatics shows the upright equilibrium volume; the live buoyancy panel shows the changing volume during Waves.

## Equilibrium weight

- **Inputs:** total loaded mass and gravity.
- **Result:** M * g, displayed in MN beside the buoyancy meter. At still-water equilibrium FB approximately equals weight, within numerical integration tolerance.

## Heave, pitch and roll amplitudes

- **Inputs:** the same vessel/loading/environment parameters as each motion above.
- **Result:** peak absolute harmonic amplitudes in m or degrees. They are not RMS values or significant amplitudes from an irregular sea spectrum.

## Encounter frequency and period

- **Inputs:** wave frequency omega, heading beta, ship speed U and gravity.
- **Method:** k = omega²/g; omegaE = omega * (1 - U * omega/g * cos(beta)). Speed converts from knots using 0.514444 m/s per knot.
- **Live convention:** the animation uses max(abs(omegaE), 0.05) rad/s. Displayed period uses a small denominator floor to avoid division by zero. Near-zero encounter frequency therefore has an animation approximation.
- **Heading convention:** 180 degrees is head seas; 90 degrees is beam seas. The adapter offsets headings within 0.5 degrees of beam seas by +0.5 degrees to avoid the library's heave/pitch singularity.

## Natural roll period

- **Inputs:** BWL, GMt and gravity; roll gyration estimate 0.4 BWL.
- **Result:** 2*pi*0.4*BWL / sqrt(g*GMt), seconds. The adapter floors GMt in this displayed estimate to avoid invalid arithmetic.
- **Prepare:** actual roll gyration radius/inertia and validated loading if replacing this approximation.

## Vertical motion and acceleration amplitudes in Performance

- **Inputs:** heave/pitch amplitudes, frequency, chosen position as percent LOA, and LCG.
- **Result:** vessel.js combines heave and pitch displacement amplitudes at that position using a root-sum-square expression; acceleration amplitude is omegaE² times that displacement amplitude.
- **Prepare:** same measurement point and phase convention as external results. This is not the instantaneous live bow acceleration.

## Total mass and weight breakdown

- **Inputs:** known lightship override or parametric hull steel, deck/bulkhead structure, outfit, survival craft, people, tank contents and other deadweight.
- **Defaults:** Parsons hull coefficient K; deck equivalent thickness 0.014 m; bulkhead thickness 0.012 m; steel density 7850 kg/m3; outfit mass per room area by type; tank usable-volume factor 0.98; person mass 100 kg in the demo.
- **Prepare:** actual weight groups and their CGs. Use a real lightship estimate instead of relying on geometry to infer a ship's mass.

## LCG

- **Inputs:** each mass and its longitudinal coordinate.
- **Result:** sum(m*x)/sum(m), metres forward from stern.

## TCG

- **Inputs:** each mass and its transverse coordinate.
- **Result:** sum(m*y)/sum(m), metres positive to port. Current lightship/deadweight override fields assume their TCG is zero.

## KG solid

- **Inputs:** each mass and its vertical coordinate.
- **Result:** sum(m*z)/sum(m), metres above keel, before tank free-surface correction.

## Free-surface correction

- **Inputs:** slack-tank liquid density, length, breadth, filling and total loaded displacement.
- **Result:** sum(rhoLiquid*l*b³/12)/mass, with consistent tonne units in the adapter. Empty tanks and tanks at least 98% full contribute zero; tank liquids otherwise affect mass/CG.
- **Current densities:** fuel 850, fresh water 1000, ballast 1025 kg/m3. Rectangular-tank approximation.

## KG fluid

- **Inputs:** KG solid and free-surface correction.
- **Result:** KGsolid + FSC. Used for the displayed stability and wave-motion GM.

## Mean draft

- **Inputs:** hull offsets, total mass and water density.
- **Result:** upright draft solving displaced volume = mass/rho, metres. If overloaded, the condition is capped at moulded depth and marked overloaded.

## Draft aft

- **Inputs:** mean draft, LCF, aft waterline end, LCB/LCG and GMl.
- **Result:** T + (LCF - aftX) * trimTangent.

## Draft forward

- **Inputs:** mean draft, LCF, forward waterline end and trimTangent.
- **Result:** T + (LCF - forwardX) * trimTangent.

## Trim

- **Inputs:** LCB, LCG, GMl and waterline geometry.
- **Result:** trimTangent = (LCB - LCG)/GMl; displayed trim is draftAft - draftForward. Positive means stern deeper. Small-angle approximation.

## Freeboard

- **Inputs:** moulded depth and the deeper end draft.
- **Result:** depth - max(draftAft, draftForward), metres.

## Static heel from TCG

- **Inputs:** TCG and positive GMt.
- **Result:** atan(TCG/GMt), degrees. This Hydrostatics value differs from the user-imposed Heel animation and wave-driven Roll.

## KB

- **Inputs:** submerged upright hull volume and its vertical centroid.
- **Result:** centre of buoyancy height above keel, metres.

## LCB

- **Inputs:** submerged volume distribution along the hull.
- **Result:** longitudinal centre of buoyancy, metres from stern.

## LCF

- **Inputs:** waterplane area distribution.
- **Result:** longitudinal centroid of waterplane area, metres from stern.

## BMt

- **Inputs:** transverse waterplane second moment and submerged volume.
- **Result:** transverse second moment / volume, metres.

## BMl

- **Inputs:** longitudinal waterplane second moment and submerged volume.
- **Result:** longitudinal second moment / volume, metres.

## KMt

- **Inputs:** KB and BMt.
- **Result:** KB + BMt, metres.

## GMt

- **Inputs:** KB, BMt and KG fluid.
- **Result:** KB + BMt - KGfluid, metres.

## GMl

- **Inputs:** KB, BMl and KG fluid.
- **Result:** KB + BMl - KGfluid, metres.

## Waterline length LWL

- **Inputs:** hull intersection with the upright waterplane at draft T.
- **Result:** distance between its aft and forward limits. Different from LOA.

## Waterline breadth BWL

- **Inputs:** hull intersection with the upright waterplane.
- **Result:** waterline breadth used by the hydrostatic and empirical motion methods.

## Waterplane area

- **Inputs:** waterline outline at draft.
- **Result:** integrated horizontal area, m2.

## Wetted area

- **Inputs:** submerged hull surface from offsets at draft.
- **Result:** estimated wetted hull area, m2. The Holtrop implementation also uses its own empirical wetted-area estimate.

## Block coefficient Cb

- **Inputs:** submerged volume, LWL, BWL and draft.
- **Meaning:** volume relative to the corresponding rectangular block.

## Prismatic coefficient Cp

- **Inputs:** submerged volume, LWL and immersed midship sectional area.
- **Meaning:** volume relative to a prism with that sectional area.

## Waterplane coefficient Cwp

- **Inputs:** waterplane area, LWL and BWL.
- **Meaning:** waterplane area relative to its rectangular envelope.

## Midship coefficient Cm

- **Inputs:** immersed midship section, BWL and draft.
- **Meaning:** immersed midship area relative to BWL * T.

## Tonnes per centimetre immersion TPC

- **Inputs:** waterplane area and density.
- **Adapter result:** rho*Awp/100/1000, tonnes per centimetre.

## Moment to change trim one centimetre MCT

- **Inputs:** displacement in tonnes, BMl and LWL.
- **Adapter result:** displacementTonnes*BMl/(100*LWL), tonne-metres. This implementation uses BMl in that approximation.

## Maximum GZ and its angle

- **Inputs:** sampled GZ curve.
- **Result:** largest sampled GZ and its sampled heel angle. Angular resolution limits precision.

## Positive stability range or evaluated range

- **Inputs:** GZ curve and a positive-to-negative zero crossing.
- **Result:** interpolated crossing angle when found; otherwise the last evaluated angle. A positive curve at 80 degrees does not establish a capsizing angle there.

## Deck-edge immersion angle

- **Inputs:** mean draft, moulded depth and BWL.
- **Approximation:** atan((depth - T)/(BWL/2)). This is a geometric reference, not a downflooding calculation.

## Stability reference criteria

- **Inputs:** areas under GZ from 0–30, 0–40 and 30–40 degrees, GZ at 30 degrees, angle of maximum GZ, initial GM, and thresholds from rules.json.
- **Result:** measured values against the configured reference minima. They do not replace regulatory assessment.

## Calm-water resistance

- **Inputs:** speed, LWL/BWL, forward/aft draft, hull coefficients, LCB, bulb/transom flags, stern form, appendage areas/factors, density, gravity and viscosity.
- **Method:** vessel.js Holtrop-Mennen empirical estimate. Bulb parameters include internal estimates; geometry and appendage details are not inferred from a new mesh by the current loader.
- **Result:** kN. Check the method's hull-form validity range before comparing unlike ship types.

## Effective power

- **Inputs:** calm-water resistance and speed in m/s.
- **Result:** resistance * speed, kW. This is effective towing power, not installed shaft or electrical power; propulsion efficiency is not supplied by this display.

## Froude number

- **Inputs:** speed U, gravity and LWL.
- **Result:** U/sqrt(g*LWL), dimensionless.

## Response curves in Performance

- **Inputs:** the same analytical vessel model and motion settings; frequencies sampled from 0.2 to 2.0 rad/s at 0.05 rad/s intervals with 1 m wave amplitude.
- **Result:** heave m/m and pitch/roll deg/m. These are magnitude response estimates, not imported complex RAOs with calibrated phases.

## Simulation time and traces

- **Inputs:** frame delta, run/pause, restart and playback multiplier.
- **Implementation:** clock increments by min(frameDelta, 0.1 s)*timeScale. Slow rendering can make simulation time lag wall time. Trace history holds up to 240 samples, sampled approximately every 0.1 simulation seconds.
- **Comparison:** align external results to simulation time, not the elapsed wall-clock time of the browser session.

## ANSYS buoyancy example

- File supplied: buoyancyz-rfile.out, columns Time Step, buoyancyz, flow-time.
- There are 101 samples at 0.001 s intervals, covering 0–0.1 s. First force: 2.205789769552131; last: 2.155627471553327.
- Per your clarification, treat buoyancyz as upward buoyancy force in N. These are data for the other model; they are not applied to the demo ferry or replayed as its buoyancy.
- For a comparison, match model size/scale, loading, waterline, density, gravity, ship motion constraints, wave/speed conditions, reference frame, selected surfaces and simulation time.
- Keep the Fluent report definition with the data. [ANSYS force reports](https://ansyshelp.ansys.com/public/Views/Secured/corp/v242/en/flu_ug/flu_ug_ForceReport.html) distinguish pressure, viscous and total forces and force coefficients. The app's hydrostatic-only value should be compared with a compatible buoyancy definition, not automatically with total transient lift.
- A 0.1 s record by itself is not enough to identify a general ship-motion response over multiple wave periods.

## Where each calculation lives

- [src/engine/vessel.ts](src/engine/vessel.ts): loading, hydrostatics, free surface, analytical motion amplitudes and resistance.
- [src/vendor/vessel/vessel.module.js](src/vendor/vessel/vessel.module.js): vendored wave-motion and resistance formulas.
- [src/engine/stability.ts](src/engine/stability.ts): section clipping, GZ, constant-volume solution and section-volume integration.
- [src/engine/buoyancy.ts](src/engine/buoyancy.ts): live hydrostatic buoyancy from the posed hull and regular wave.
- [src/ui/three/Viewport.tsx](src/ui/three/Viewport.tsx): prescribed phases, clock, pivot, bow acceleration and per-frame buoyancy.
- [src/ui/TestPanel.tsx](src/ui/TestPanel.tsx): meters, unit conversion, controls and traces.
- [src/ui/EngineeringPanels.tsx](src/ui/EngineeringPanels.tsx): hydrostatic, stability and performance tables/curves.
