import { describe, expect, it } from "vitest";
import { buildRecording, parseManifest, parseReport, sampleRecording, sampleSignal, type Manifest } from "../src/engine/ansys";
import { PACKAGE_TEMPLATE } from "../src/ui/shipProfiles";

function metadata(channels: Manifest["reports"][number]["channels"] = { roll: { column: "roll", unit: "rad" }, buoyancy: { column: "force", unit: "kN" } }): Manifest {
  return parseManifest(JSON.stringify({ ...PACKAGE_TEMPLATE, reports: [{ file: "report.out", time: { column: "flow-time", unit: "s" }, channels }] }));
}
const out = '"buoyancyz-rfile"\n"Time Step" "values"\n("Time Step" "roll" "force" "flow-time")\n0 0 20 1\n1 1.5707963267948966 40 3\n2 3.141592653589793 60 5';
describe("ANSYS import and synchronized sampling", () => {
  it("reads actual Fluent-style multi-line reports and converts radians/kN", () => {
    const r = buildRecording(metadata(), new Map([["report.out", out]]));
    expect(r.start).toBe(1); expect(r.end).toBe(5);
    const s = sampleRecording(r, 2);
    expect(s.roll).toBeCloseTo(45); expect(s.buoyancy).toBe(30000);
    expect(s.pitch).toBeNull(); expect(s.heave).toBeNull();
  });
  it("accepts quoted CSV, semicolons, tabs and Fortran exponents", () => {
    expect(parseReport('"time","force"\n0,1D+3\n1,2D+3').rows).toEqual([[0, 1000], [1, 2000]]);
    expect(parseReport('time;value\n0;1\n1;2').header).toEqual(["time", "value"]);
    expect(parseReport('time\tvalue\n0\t1\n1\t2').rows).toHaveLength(2);
  });
  it("converts ms, mm, g and signed forces explicitly", () => {
    const m = metadata({ heave: { column: "h", unit: "mm" }, bowAcceleration: { column: "a", unit: "g" }, verticalForce: { column: "f", unit: "MN", sign: -1 } });
    m.reports[0].time = { column: "t", unit: "ms" };
    const r = buildRecording(m, new Map([["report.out", "t,h,a,f\n1000,100,1,2\n2000,200,2,3"]]));
    const s = sampleRecording(r, 1.5);
    expect(s.heave).toBeCloseTo(.15); expect(s.bowAcceleration).toBeCloseTo(1.5 * 9.81); expect(s.verticalForce).toBe(-2.5e6);
  });
  it("resamples separate files without extrapolating unavailable channels", () => {
    const m = metadata({ heave: { column: "h", unit: "m" } });
    m.reports.push({ file: "force.csv", time: { column: "t", unit: "s" }, channels: { buoyancy: { column: "f", unit: "N" } } });
    m.reports[0].time.column = "t";
    const r = buildRecording(m, new Map([["report.out", "t,h\n0,0\n2,2\n4,0"], ["force.csv", "t,f\n1,100\n3,300"]]));
    expect(sampleRecording(r, 2)).toMatchObject({ heave: 2, buoyancy: 200 });
    expect(sampleRecording(r, 0).buoyancy).toBeNull(); expect(sampleRecording(r, 4).buoyancy).toBeNull();
  });
  it("preserves gaps and exact endpoints", () => {
    const signal = { times: [0, 1, 2, 3], values: [0, null, 2, 3], file: "a", column: "b" };
    expect(sampleSignal(signal, .5)).toBeNull(); expect(sampleSignal(signal, 1)).toBeNull();
    expect(sampleSignal(signal, 2)).toBe(2); expect(sampleSignal(signal, 3)).toBe(3);
    expect(sampleSignal(signal, 3.1)).toBeNull();
  });
  it("interpolates angular crossings along the shortest arc", () => {
    const signal = { times: [0, 2], values: [179, -179], file: "a", column: "b" };
    expect(sampleSignal(signal, 1, true)).toBe(180);
  });
  it("rejects duplicate or decreasing time, malformed rows and missing columns/files", () => {
    const m = metadata({ heave: { column: "h", unit: "m" } }); m.reports[0].time.column = "t";
    for (const report of ["t,h\n0,1\n0,2", "t,h\n1,1\n0,2"]) expect(() => buildRecording(m, new Map([["report.out", report]]))).toThrow("increasing");
    expect(() => parseReport("t,h\n0,1\n1")).toThrow("columns");
    expect(() => parseReport("t,h\n0,1\n1,nope")).toThrow("invalid number");
    expect(() => buildRecording(m, new Map())).toThrow("Missing report");
    expect(() => buildRecording(m, new Map([["report.out", "t,x\n0,1\n1,2"]]))).toThrow('"h"');
  });
  it("rejects unsupported units, ambiguous axes, duplicate channels and unknown frames", () => {
    for (const mutate of [
      (m: Manifest) => { m.reports[0].channels.roll!.unit = "rpm"; },
      (m: Manifest) => { m.mesh.bow = "-Z"; },
      (m: Manifest) => { m.coordinates.frame = "unknown" as Manifest["coordinates"]["frame"]; },
      (m: Manifest) => { m.reports.push(m.reports[0]); },
      (m: Manifest) => { m.environment.gravityMps2 = -1; },
    ]) { const m = metadata(); mutate(m); expect(() => parseManifest(JSON.stringify(m))).toThrow(); }
  });
  it("requires a buoyancy report definition and keeps total vertical force distinct", () => {
    const m = metadata(); delete m.forceDefinition;
    expect(() => parseManifest(JSON.stringify(m))).toThrow("forceDefinition");
    const total = metadata({ verticalForce: { column: "f", unit: "N" } });
    const r = buildRecording(total, new Map([["report.out", "flow-time,f\n0,10\n1,20"]]));
    expect(sampleRecording(r, .5)).toMatchObject({ verticalForce: 15, buoyancy: null });
  });
});
