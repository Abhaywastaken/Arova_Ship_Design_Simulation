import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sampleRecording } from "../../engine/ansys";
import { live, useStore } from "../store";
import type { ShipProfile } from "../shipProfiles";

/** Single authoritative imported-results clock. No demo calculations enter this scene. */
export function ImportedScene({ profile }: { profile: ShipProfile }) {
  const pivot = useRef<THREE.Group>(null), inner = useRef<THREE.Group>(null);
  const time = useRef(profile.resumeTime), lastSeek = useRef(-1), lastRestart = useRef(-1);
  const refMesh = useStore(s => s.refMesh);
  const water = useRef<THREE.PlaneGeometry>(null);
  const metadata = profile.manifest, r = profile.recording;
  const L = profile.placement.lengthM, B = metadata?.equilibrium.beamM ?? L * 0.2;
  useFrame((_, dt) => {
    const state = useStore.getState(), { test, playback } = state;
    if (lastRestart.current !== test.restart) { time.current = r?.start ?? 0; lastRestart.current = test.restart; }
    if (lastSeek.current !== playback.seek) { time.current = playback.time; lastSeek.current = playback.seek; }
    if (test.running && r) {
      time.current += Math.min(dt, 0.1) * test.timeScale;
      if (time.current >= r.end) {
        if (playback.loop) time.current = r.start + (time.current - r.start) % (r.end - r.start);
        else { time.current = r.end; state.setTest({ running: false }); }
      }
    }
    const sample = sampleRecording(r, time.current);
    live.t = time.current;
    live.rollDeg = sample.roll ?? NaN; live.pitchDeg = sample.pitch ?? NaN;
    live.heave = sample.heave ?? NaN; live.heelDeg = sample.heel ?? sample.roll ?? NaN;
    live.vertAcc = sample.bowAcceleration ?? NaN; live.buoyancyN = sample.buoyancy ?? NaN;
    live.submergedVolumeM3 = sample.submergedVolume ?? NaN; live.gz = NaN;
    if (pivot.current && inner.current) {
      const ref = metadata?.coordinates.referencePointM ?? [L / 2, 0, 0];
      pivot.current.position.set(ref[0] + (sample.surge ?? 0), ref[1] + (sample.sway ?? 0), ref[2] + (sample.heave ?? 0));
      pivot.current.rotation.set((sample.roll ?? sample.heel ?? metadata?.equilibrium.rollDeg ?? 0) * Math.PI / 180, (sample.pitch ?? metadata?.equilibrium.pitchDeg ?? 0) * Math.PI / 180, (sample.yaw ?? 0) * Math.PI / 180, metadata?.coordinates.rotationOrder ?? "XYZ");
      inner.current.position.set(-ref[0], -ref[1], -ref[2]);
    }
    if (water.current && metadata) {
      const pos = water.current.getAttribute("position"), env = metadata.environment;
      const omega = env.wavePeriodS ? 2 * Math.PI / env.wavePeriodS : 0;
      const k = omega * omega / env.gravityMps2, beta = (env.waveHeadingDeg ?? 0) * Math.PI / 180;
      const encounter = omega - k * (env.speedMps ?? 0) * Math.cos(beta);
      for (let i = 0; i < pos.count; i++) {
        const phase = k * (pos.getX(i) * Math.cos(beta) + pos.getY(i) * Math.sin(beta)) - encounter * time.current + (env.wavePhaseRad ?? 0);
        pos.setZ(i, metadata.equilibrium.draftM + (env.waveAmplitudeM ?? 0) * Math.cos(phase));
      }
      pos.needsUpdate = true;
    }
  });
  return <group rotation={[-Math.PI / 2, 0, 0]}>
    <group ref={pivot}><group ref={inner}>
      {refMesh?.visible && <primitive object={profile.object} />}
    </group></group>
    {metadata && <mesh>
      <planeGeometry ref={water} args={[L * 4, Math.max(B * 8, L * 2), 90, 48]} />
      <meshBasicMaterial color="#9a958e" wireframe transparent opacity={0.2} side={THREE.DoubleSide} />
    </mesh>}
  </group>;
}
