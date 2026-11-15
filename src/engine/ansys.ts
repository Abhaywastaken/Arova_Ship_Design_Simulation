/** ANSYS interchange and time-series sampling. No inferred vessel physics. */
export const CHANNELS = ["roll", "pitch", "yaw", "heel", "heave", "surge", "sway", "bowAcceleration", "buoyancy", "verticalForce", "resistance", "submergedVolume"] as const;
export type Channel = typeof CHANNELS[number];
export type Axis = "+X" | "-X" | "+Y" | "-Y" | "+Z" | "-Z";
export interface ChannelSpec { column: string; unit: string; sign?: 1 | -1 }
export interface Manifest {
  version: 1;
  name: string;
  mesh: { file: string; lengthM: number; up: Axis; bow: Axis; sha256?: string };
  coordinates: { frame: "ship-x-forward-y-port-z-up"; rotationOrder: "XYZ" | "ZYX"; referencePointM: [number, number, number] };
  environment: { waterDensityKgM3: number; gravityMps2: number; speedMps?: number; waveAmplitudeM?: number; wavePeriodS?: number; waveHeadingDeg?: number; wavePhaseRad?: number };
  equilibrium: { draftM: number; massKg?: number; beamM?: number; depthM?: number; cgM?: [number, number, number]; bowPointM?: [number, number, number]; pitchDeg?: number; rollDeg?: number };
  reports: { file: string; time: { column: string; unit: "s" | "ms" }; channels: Partial<Record<Channel, ChannelSpec>> }[];
  forceDefinition?: string;
  notes?: string;
}
export interface Signal { times: number[]; values: (number | null)[]; file: string; column: string }
export interface Recording { signals: Partial<Record<Channel, Signal>>; start: number; end: number }
const angular = new Set<Channel>(["roll", "pitch", "yaw", "heel"]);
const units = (key: Channel): Record<string, number> => angular.has(key) ? { deg: 1, rad: 180 / Math.PI } :
  key === "bowAcceleration" ? { "m/s2": 1, g: 0 } :
  ["buoyancy", "verticalForce", "resistance"].includes(key) ? { N: 1, kN: 1000, MN: 1e6 } : key === "submergedVolume" ? { m3: 1 } : { m: 1, mm: 0.001 };

function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function positive(v: unknown) { return typeof v === "number" && Number.isFinite(v) && v > 0; }
function finite(v: unknown) { return typeof v === "number" && Number.isFinite(v); }
function vector(v: unknown) { return Array.isArray(v) && v.length === 3 && v.every(finite); }
export function parseManifest(text: string): Manifest {
  const m = JSON.parse(text);
  if (!object(m) || m.version !== 1 || typeof m.name !== "string" || !m.name.trim()) throw new Error("Metadata needs version: 1 and a ship name.");
  const mesh = m.mesh, c = m.coordinates, e = m.environment, eq = m.equilibrium;
  const axis = (v: unknown) => typeof v === "string" && /^[+-][XYZ]$/.test(v);
  if (!object(mesh) || typeof mesh.file !== "string" || !/\.(stl|glb)$/i.test(mesh.file) || !positive(mesh.lengthM) || !axis(mesh.up) || !axis(mesh.bow) || String(mesh.up)[1] === String(mesh.bow)[1]) throw new Error("Mesh setup needs an STL/GLB filename, positive lengthM and perpendicular signed up/bow axes.");
  if (mesh.sha256 !== undefined && (typeof mesh.sha256 !== "string" || !/^[a-f\d]{64}$/i.test(mesh.sha256))) throw new Error("mesh.sha256 must be a 64-character SHA-256 hash.");
  if (!object(c) || c.frame !== "ship-x-forward-y-port-z-up" || !["XYZ", "ZYX"].includes(String(c.rotationOrder)) || !vector(c.referencePointM)) throw new Error("Coordinates must specify the ship frame, XYZ/ZYX rotationOrder and referencePointM.");
  if (!object(e) || !positive(e.waterDensityKgM3) || !positive(e.gravityMps2)) throw new Error("Environment needs positive waterDensityKgM3 and gravityMps2.");
  for (const key of ["speedMps", "waveAmplitudeM", "wavePeriodS", "waveHeadingDeg", "wavePhaseRad"]) {
    if (e[key] !== undefined && (!finite(e[key]) || (["speedMps", "waveAmplitudeM"].includes(key) && Number(e[key]) < 0) || (key === "wavePeriodS" && !positive(e[key])))) throw new Error(`Invalid environment.${key}.`);
  }
  if (!object(eq) || !finite(eq.draftM) || Number(eq.draftM) < 0) throw new Error("Equilibrium needs a nonnegative draftM.");
  for (const key of ["massKg", "beamM", "depthM"]) if (eq[key] !== undefined && !positive(eq[key])) throw new Error(`Invalid equilibrium.${key}.`);
  for (const key of ["cgM", "bowPointM"]) if (eq[key] !== undefined && !vector(eq[key])) throw new Error(`Invalid equilibrium.${key}.`);
  for (const key of ["pitchDeg", "rollDeg"]) if (eq[key] !== undefined && !finite(eq[key])) throw new Error(`Invalid equilibrium.${key}.`);
  if (!Array.isArray(m.reports) || !m.reports.length) throw new Error("Metadata needs at least one report.");
  const seen = new Set<string>();
  for (const r of m.reports) {
    if (!object(r) || typeof r.file !== "string" || !object(r.time) || typeof r.time.column !== "string" || !["s", "ms"].includes(String(r.time.unit)) || !object(r.channels) || !Object.keys(r.channels).length) throw new Error("Each report needs file, time column/unit and channels.");
    for (const [key, spec] of Object.entries(r.channels)) {
      if (!CHANNELS.includes(key as Channel) || seen.has(key)) throw new Error(`Unknown or duplicate channel: ${key}.`);
      if (!object(spec) || typeof spec.column !== "string" || !spec.column || !Object.hasOwn(units(key as Channel), String(spec.unit)) || (spec.sign !== undefined && spec.sign !== 1 && spec.sign !== -1)) throw new Error(`Invalid column, unit or sign for ${key}.`);
      seen.add(key);
    }
  }
  for (const key of ["notes", "forceDefinition"]) if (m[key] !== undefined && typeof m[key] !== "string") throw new Error(`${key} must be text.`);
  if (seen.has("buoyancy") && (typeof m.forceDefinition !== "string" || !m.forceDefinition.trim())) throw new Error("Specify forceDefinition for the buoyancy report.");
  return m as unknown as Manifest;
}

function cells(line: string, delimiter: string): string[] {
  const result: string[] = []; let value = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { if (quoted && line[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (line[i] === delimiter && !quoted) { result.push(value.trim()); value = ""; }
    else value += line[i];
  }
  if (quoted) throw new Error("Unclosed quote in report.");
  result.push(value.trim()); return result;
}
/** CSV/TSV and Fluent report files with quoted headers and whitespace numeric rows. */
export function parseReport(text: string): { header: string[]; rows: (number | null)[][] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  let header: string[] = [], delimiter = "", begin = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("(")) {
      const names = [...line.matchAll(/"([^"]+)"/g)].map(m => m[1]);
      if (names.length > 1) { header = names; begin = i + 1; break; }
    } else {
      delimiter = [",", ";", "\t"].find(d => line.includes(d)) ?? "";
      if (delimiter) { header = cells(line, delimiter); begin = i + 1; break; }
    }
  }
  if (begin < 0 || new Set(header).size !== header.length || header.some(h => !h)) throw new Error("Report needs unique CSV column names or a Fluent quoted column header.");
  const rows = lines.slice(begin).map((line, i) => {
    const row = delimiter ? cells(line, delimiter) : line.split(/\s+/);
    if (row.length !== header.length) throw new Error(`Report row ${i + begin + 1}: expected ${header.length} columns.`);
    return row.map(v => {
      if (!v || /^(null|nan|n\/a)$/i.test(v)) return null;
      const n = Number(v.replace(/[dD]([+-]?\d+)$/, "e$1"));
      if (!Number.isFinite(n)) throw new Error(`Report row ${i + begin + 1}: invalid number "${v}".`);
      return n;
    });
  });
  if (rows.length < 2) throw new Error("A report needs at least two time samples.");
  return { header, rows };
}

export function buildRecording(manifest: Manifest, files: Map<string, string>): Recording {
  const signals: Recording["signals"] = {};
  let start = Infinity, end = -Infinity;
  for (const r of manifest.reports) {
    const text = files.get(r.file);
    if (text === undefined) throw new Error(`Missing report file: ${r.file}. Select it with the metadata and mesh.`);
    const { header, rows } = parseReport(text);
    const ti = header.indexOf(r.time.column);
    if (ti < 0) throw new Error(`${r.file}: time column "${r.time.column}" not found.`);
    const times = rows.map(row => row[ti] === null ? NaN : row[ti]! * (r.time.unit === "ms" ? 0.001 : 1));
    if (times.some((t, i) => !Number.isFinite(t) || (i > 0 && t <= times[i - 1]))) throw new Error(`${r.file}: times must be finite and strictly increasing; remove duplicate/restarted steps.`);
    start = Math.min(start, times[0]); end = Math.max(end, times[times.length - 1]);
    for (const [key, spec] of Object.entries(r.channels) as [Channel, ChannelSpec][]) {
      const ci = header.indexOf(spec.column);
      if (ci < 0) throw new Error(`${r.file}: ${key} column "${spec.column}" not found.`);
      const scale = (spec.unit === "g" ? manifest.environment.gravityMps2 : units(key)[spec.unit]) * (spec.sign ?? 1);
      const values = rows.map(row => row[ci] === null ? null : row[ci]! * scale);
      if (values.some(v => v !== null && !Number.isFinite(v))) throw new Error(`${r.file}: ${key} overflows after unit conversion.`);
      if (values.filter(v => v !== null).length < 2) throw new Error(`${r.file}: ${key} needs at least two finite values.`);
      signals[key] = { times, values, file: r.file, column: spec.column };
    }
  }
  return { signals, start, end };
}

/** Null means missing, outside a channel's time span, or inside an explicitly missing interval. */
export function sampleSignal(signal: Signal | undefined, time: number, angle = false): number | null {
  if (!signal || time < signal.times[0] || time > signal.times[signal.times.length - 1]) return null;
  const { times, values } = signal;
  let lo = 0, hi = times.length - 1;
  while (hi - lo > 1) { const mid = (hi + lo) >> 1; if (times[mid] <= time) lo = mid; else hi = mid; }
  if (time === times[lo]) return values[lo];
  if (time === times[hi]) return values[hi];
  const a = values[lo], b = values[hi];
  if (a === null || b === null) return null;
  const delta = angle ? ((b - a + 180) % 360 + 360) % 360 - 180 : b - a;
  return a + delta * (time - times[lo]) / (times[hi] - times[lo]);
}
export function sampleRecording(recording: Recording | undefined, time: number): Partial<Record<Channel, number | null>> {
  return Object.fromEntries(CHANNELS.map(key => [key, sampleSignal(recording?.signals[key], time, angular.has(key))]));
}
