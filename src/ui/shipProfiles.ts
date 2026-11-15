import type { Object3D } from "three";
import { buildRecording, parseManifest, type Manifest, type Recording } from "../engine/ansys";
import { defaultPlacement, disposeModel, placeModel, readModel, type ModelPlacement } from "./three/modelImport";

export interface ShipProfile {
  id: string;
  name: string;
  source: Object3D;
  meshFile: File;
  object: Object3D;
  placement: ModelPlacement;
  manifest?: Manifest;
  recording?: Recording;
  resumeTime: number;
}
export async function meshProfile(file: File): Promise<ShipProfile> {
  const source = await readModel(file);
  const placement = defaultPlacement(source, file.name, 1);
  // Unitless mesh import stays static until physical scale/setup is supplied.
  return { id: crypto.randomUUID(), name: file.name, source, meshFile: file, object: placeModel(source, placement), placement, resumeTime: 0 };
}

/** Multi-select package import is transactional: failed packages leave loaded profiles untouched. */
export async function importPackages(files: File[], active?: ShipProfile): Promise<ShipProfile[]> {
  const byName = new Map<string, File>();
  for (const file of files) {
    if (byName.has(file.name)) throw new Error(`Duplicate filename: ${file.name}. Import packages with distinct filenames separately.`);
    byName.set(file.name, file);
  }
  const metadata = files.filter(f => f.name.toLowerCase().endsWith(".json"));
  if (!metadata.length) throw new Error("Select a metadata JSON, its STL/GLB, and CSV/OUT reports together.");
  if (active && metadata.length !== 1) throw new Error("Attach one setup at a time, or use Import ANSYS package to add multiple profiles.");
  const loaded: ShipProfile[] = [];
  try {
    for (const file of metadata) {
      const manifest = parseManifest(await file.text());
      if (active && manifest.mesh.file !== active.meshFile.name) throw new Error("This setup belongs to a different mesh. Use Import ANSYS package to add it as another ship.");
      const mesh = byName.get(manifest.mesh.file) ?? (active?.meshFile.name === manifest.mesh.file ? active.meshFile : undefined);
      if (!mesh) throw new Error(`Missing mesh file: ${manifest.mesh.file}.`);
      if (manifest.mesh.sha256) {
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await mesh.arrayBuffer())), b => b.toString(16).padStart(2, "0")).join("");
        if (hash !== manifest.mesh.sha256.toLowerCase()) throw new Error(`${mesh.name}: SHA-256 does not match this setup.`);
      }
      const reports = new Map<string, string>();
      for (const r of manifest.reports) {
        const report = byName.get(r.file);
        if (!report) throw new Error(`Missing report file: ${r.file}.`);
        reports.set(r.file, await report.text());
      }
      const recording = buildRecording(manifest, reports);
      const source = await readModel(mesh);
      const placement = { up: manifest.mesh.up, bow: manifest.mesh.bow, lengthM: manifest.mesh.lengthM };
      try {
        loaded.push({ id: metadata.length === 1 && active && active.meshFile.name === mesh.name ? active.id : crypto.randomUUID(), name: manifest.name, source, meshFile: mesh, placement, object: placeModel(source, placement), manifest, recording, resumeTime: recording.start });
      } catch (error) { disposeModel(source); throw error; }
    }
    return loaded;
  } catch (error) {
    loaded.forEach(p => disposeModel(p.source));
    throw error;
  }
}

export const PACKAGE_TEMPLATE: Manifest = {
  version: 1, name: "My ship / moderate sea",
  mesh: { file: "ship.stl", lengthM: 120, up: "+Z", bow: "+X" },
  coordinates: { frame: "ship-x-forward-y-port-z-up", rotationOrder: "ZYX", referencePointM: [60, 0, 5] },
  equilibrium: { draftM: 5, massKg: 4000000, beamM: 20, depthM: 9, cgM: [60, 0, 5], bowPointM: [108, 0, 9] },
  environment: { waterDensityKgM3: 1025, gravityMps2: 9.81, speedMps: 5, waveAmplitudeM: 1, wavePeriodS: 8, waveHeadingDeg: 180, wavePhaseRad: 0 },
  reports: [{ file: "results.csv", time: { column: "time_s", unit: "s" }, channels: {
    roll: { column: "roll_deg", unit: "deg" }, pitch: { column: "pitch_deg", unit: "deg" },
    heave: { column: "heave_m", unit: "m" }, bowAcceleration: { column: "bow_acc_z_mps2", unit: "m/s2" },
    buoyancy: { column: "buoyancy_N", unit: "N" },
  } }],
  forceDefinition: "REPLACE: describe hydrostatic buoyancy report, selected hull surfaces, vertical direction and pressure reference.",
  notes: "TEMPLATE ONLY. Replace all example setup values. Export angles in the specified ship frame/order and heave relative to equilibrium at referencePointM. Bow acceleration is global vertical dynamic acceleration excluding gravity.",
};

export function downloadText(name: string, content: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
