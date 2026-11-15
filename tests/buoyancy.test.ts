import { describe, it, expect } from "vitest";
import { BuoyancyModel, buoyancyForceN, type BuoyancyPose } from "../src/engine/buoyancy";
import { createShip, RHO, G } from "../src/engine/vessel";
import { blankDesign } from "../src/data/demoDesign";
import hulls from "./fixtures/hulls.json";

const design = blankDesign();
design.hull = { ...design.hull, template: "custom", custom: hulls.box, LOA: 100, BOA: 20, depth: 10 };
const model = new BuoyancyModel(createShip(design), 10);
const calm: BuoyancyPose = {
  draftM: 5, heaveM: 0, rollRad: 0, pitchRad: 0, pivotXM: 50,
  waveAmplitudeM: 0, waveFrequencyRadS: 0.6, headingRad: Math.PI,
  encounterFrequencyRadS: 0.6, timeS: 0,
};

describe("live hydrostatic buoyancy against analytic box values", () => {
  it("equals displaced-fluid weight at rest", () => {
    const r = model.sample(calm);
    expect(r.volumeM3).toBeCloseTo(100 * 20 * 5, 5);
    expect(r.forceN).toBeCloseTo(RHO * G * 100 * 20 * 5, 3);
  });
  it("upward heave removes waterplane area times heave from displacement", () => {
    expect(model.sample({ ...calm, heaveM: 1 }).volumeM3).toBeCloseTo(100 * 20 * 4, 5);
  });
  it("downward heave increases displacement", () => {
    expect(model.sample({ ...calm, heaveM: -1 }).volumeM3).toBeCloseTo(100 * 20 * 6, 5);
  });
  it("is zero when dry and bounded by total watertight hull volume", () => {
    expect(model.sample({ ...calm, heaveM: 20 }).forceN).toBe(0);
    expect(model.sample({ ...calm, heaveM: -20 }).volumeM3).toBeCloseTo(100 * 20 * 10, 5);
  });
  it("uniform rising and falling water gives known box displacements", () => {
    const wave = { ...calm, waveAmplitudeM: 1, waveFrequencyRadS: 0, encounterFrequencyRadS: 1 };
    expect(model.sample(wave).volumeM3).toBeCloseTo(12000, 5);
    expect(model.sample({ ...wave, timeS: Math.PI }).volumeM3).toBeCloseTo(8000, 5);
  });
  it("symmetric heel and trim preserve box volume before edge immersion", () => {
    expect(model.sample({ ...calm, rollRad: 0.1 }).volumeM3).toBeCloseTo(10000, 5);
    expect(model.sample({ ...calm, rollRad: -0.1 }).volumeM3).toBeCloseTo(10000, 5);
    expect(model.sample({ ...calm, pitchRad: 0.01 }).volumeM3).toBeCloseTo(10000, 5);
  });
  it("force scales with fluid density and gravity", () => {
    expect(buoyancyForceN(10, 1000, 10)).toBe(100000);
    expect(model.sample(calm, 1000, 10).forceN).toBeCloseTo(100000000, 3);
  });
  it("rejects invalid physical inputs rather than displaying a fabricated force", () => {
    expect(() => buoyancyForceN(-1)).toThrow();
    expect(() => buoyancyForceN(1, 0)).toThrow();
    expect(() => model.sample({ ...calm, heaveM: NaN })).toThrow();
  });
});
