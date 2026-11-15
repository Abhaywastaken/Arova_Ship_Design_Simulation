import type { Ship } from "../vendor/vessel/vessel.module.js";
import { SectionModel } from "./stability";
import { G, RHO } from "./vessel";

export interface BuoyancyPose {
  draftM: number;
  heaveM: number;
  rollRad: number;
  pitchRad: number;
  pivotXM: number;
  waveAmplitudeM: number;
  waveFrequencyRadS: number;
  headingRad: number;
  encounterFrequencyRadS: number;
  timeS: number;
}

/** Archimedean force only, not total transient hydrodynamic force. */
export function buoyancyForceN(volumeM3: number, densityKgM3 = RHO, gravityMSS = G): number {
  if (![volumeM3, densityKgM3, gravityMSS].every(Number.isFinite) || volumeM3 < 0 || densityKgM3 <= 0 || gravityMSS <= 0) {
    throw new Error("Buoyancy requires finite non-negative volume and positive density/gravity.");
  }
  return densityKgM3 * gravityMSS * volumeM3;
}

/** Section integration against a regular wave, linearized across each section.
 * Hull pose matches the viewport's XYZ rotation about (LCF, 0, draft).
 * Does not feed force back into the prescribed wave-motion animation.
 */
export class BuoyancyModel {
  private sections: SectionModel;
  constructor(ship: Ship, depthM: number) {
    this.sections = new SectionModel(ship, depthM);
  }

  sample(p: BuoyancyPose, densityKgM3 = RHO, gravityMSS = G) {
    if (!Object.values(p).every(Number.isFinite) || p.waveAmplitudeM < 0 || p.waveFrequencyRadS < 0) {
      throw new Error("Invalid buoyancy pose or wave input.");
    }
    const sr = Math.sin(p.rollRad), cr = Math.cos(p.rollRad);
    const sp = Math.sin(p.pitchRad), cp = Math.cos(p.pitchRad);
    const dx = Math.cos(p.headingRad), dy = Math.sin(p.headingRad);
    const k = p.waveFrequencyRadS ** 2 / gravityMSS;
    const volumeM3 = this.sections.volumeUnderWaterplanes((x) => {
      const relativeX = x - p.pivotXM;
      const wx = p.pivotXM + cp * relativeX;
      const wy = sr * sp * relativeX;
      const phase = k * (wx * dx + wy * dy) - p.encounterFrequencyRadS * p.timeS;
      const eta = p.draftM + p.waveAmplitudeM * Math.cos(phase);
      const gradient = -p.waveAmplitudeM * k * Math.sin(phase);
      const gx = gradient * dx, gy = gradient * dy;
      const uy = sr - gy * cr;
      const uz = cr * cp - gx * sp + gy * sr * cp;
      return { uy, uz, h: uz * p.draftM + eta - p.draftM - p.heaveM + cr * sp * relativeX };
    });
    return { volumeM3, forceN: buoyancyForceN(volumeM3, densityKgM3, gravityMSS) };
  }
}
