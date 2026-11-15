import { useEffect, useMemo, useState } from "react";
import { CHANNELS, sampleRecording, type Channel } from "../engine/ansys";
import { useStore, live } from "./store";
import type { ShipProfile } from "./shipProfiles";
import { downloadText } from "./shipProfiles";
import { Gauge } from "./TestPanel";
import { Btn, Check, KV, Section, f } from "./fields";
import { Chart } from "./Chart";

const METRICS: [Channel, string, string, number][] = [["roll", "Roll", "deg", 1], ["pitch", "Pitch", "deg", 1], ["heave", "Heave", "m", 1], ["bowAcceleration", "Vertical acc. at bow", "m/s2", 1], ["buoyancy", "Buoyancy", "MN", 1e-6]];
export function ImportedTestPanel({ profile }: { profile: ShipProfile }) {
  const [tab, setTab] = useState("Waves"), [, tick] = useState(0);
  const test = useStore(s => s.test), playback = useStore(s => s.playback);
  useEffect(() => { const timer = setInterval(() => tick(x => x + 1), 100); return () => clearInterval(timer); }, []);
  const r = profile.recording, m = profile.manifest;
  const sample = sampleRecording(r, live.t);
  const summaries = useMemo(() => Object.fromEntries(Object.entries(r?.signals ?? {}).map(([key, signal]) => {
    let min = Infinity, max = -Infinity, mean = 0, n = 0;
    for (const value of signal.values) if (value !== null) { min = Math.min(min, value); max = Math.max(max, value); mean += (value - mean) / ++n; }
    return [key, { min, max, mean }];
  })), [r]);
  const summary = (key: Channel) => summaries[key];
  const traces = useMemo(() => METRICS.filter(([key]) => r?.signals[key]).map(([key, label, unit, scale]) => {
    const signal = r!.signals[key]!, stride = Math.max(1, Math.ceil(signal.times.length / 400));
    const segments: [number, number][][] = [[]];
    signal.values.forEach((v, i) => { if (v === null) { if (segments[segments.length - 1].length) segments.push([]); } else if (i % stride === 0 || i === signal.values.length - 1 || signal.values[i - 1] === null || signal.values[i + 1] === null) segments[segments.length - 1].push([signal.times[i], v * scale]); });
    return { key, label, unit, segments };
  }), [r]);
  const meter = (key: Channel, label: string, unit: string, scale = 1) => {
    const signal = r?.signals[key], stats = summary(key), value = sample[key];
    const extent = stats ? Math.max(Math.abs(stats.min), Math.abs(stats.max), 0.01) * scale * 1.15 : 1;
    return <div key={key} className="min-w-0 p-3" data-channel={key}>
      {value !== null && value !== undefined && signal ? <Gauge label={label} value={value * scale} min={key === "buoyancy" && (stats?.min ?? 0) >= 0 ? 0 : -extent} max={extent} unit={unit} digits={2} /> : <div className="flex h-[120px] flex-col items-center justify-center gap-2"><span className="label">{label}</span><span className="text-xs text-muted">Unavailable</span></div>}
      <div className="mt-1 text-center text-[10px] text-faint">{signal ? value == null ? "No sample at this time" : "ANSYS recording" : "Channel not supplied"}</div>
    </div>;
  };
  return <div>
    <div role="tablist" aria-label="Test and analysis" className="flex flex-wrap gap-x-5 gap-y-1 border-b border-line px-4 pt-3">
      {["Waves", "Heel", "Hydrostatics", "Stability", "Performance"].map(name => <button key={name} role="tab" aria-selected={tab === name} className={`relative pb-2 text-[12.5px] ${tab === name ? "text-fg" : "text-muted"}`} onClick={() => setTab(name)}>{name}{tab === name && <span className="absolute right-0 bottom-0 left-0 h-[1.5px] bg-accent" />}</button>)}
    </div>
    {!r ? <Section title="Results needed"><p className="text-xs leading-relaxed text-muted">Geometry loaded. Use File → Attach / replace ANSYS results to select metadata and report files. This ship has no motion or force readings yet.</p></Section> : <>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 text-xs">
        <button title={test.running ? "Pause" : "Run"} aria-label={test.running ? "Pause" : "Run"} className="rounded border border-line px-2 py-1" onClick={() => useStore.getState().setTest({ running: !test.running })}>{test.running ? "Pause" : "Run"}</button>
        <button title="Restart" aria-label="Restart" className="text-muted" onClick={() => { useStore.getState().seekPlayback(r.start); useStore.getState().setTest({ running: true }); }}>Restart</button>
        {[0.5, 1, 2, 4].map(speed => <button key={speed} className={test.timeScale === speed ? "text-accent" : "text-muted"} onClick={() => useStore.getState().setTest({ timeScale: speed })}>{speed}x</button>)}
      </div>
      <Section title="Recorded timeline">
        <label className="block text-xs"><span className="flex justify-between text-muted"><span>Time</span><span className="font-mono" data-testid="recording-time">{f(live.t, 3)} s</span></span><input aria-label="Recording time" type="range" className="mt-2 w-full" min={r.start} max={r.end} step="any" value={Math.min(r.end, Math.max(r.start, live.t))} onChange={e => useStore.getState().seekPlayback(Number(e.target.value))} /></label>
        <div className="mb-2 flex justify-between text-[10px] text-faint"><span>{f(r.start, 3)} s</span><span>{f(r.end, 3)} s</span></div>
        <Check label="Loop recording" value={playback.loop} onChange={loop => useStore.getState().setLoop(loop)} />
        <p className="mt-2 text-[11px] leading-relaxed text-muted">Recorded conditions are fixed. All meters and model motion share this timeline. Missing motion components stay at equilibrium; missing readings remain unavailable.</p>
      </Section>
    </>}
    {tab === "Waves" && <><div className="grid grid-cols-2 border-b border-line">{METRICS.map(args => meter(...args))}</div>
      {m && <Section title="Recorded conditions">
        <KV k="Ship speed" v={f(m.environment.speedMps, 2)} unit="m/s" /><KV k="Wave amplitude" v={f(m.environment.waveAmplitudeM, 2)} unit="m" /><KV k="Wave period" v={f(m.environment.wavePeriodS, 2)} unit="s" /><KV k="Wave heading" v={f(m.environment.waveHeadingDeg, 1)} unit="deg" />
        <p className="mt-2 text-[11px] text-muted">Water shows the specified incident regular wave where provided. CFD wake/free-surface results are not included.</p>
        {m.forceDefinition && <p className="mt-2 text-[11px] text-muted">Force definition: {m.forceDefinition}</p>}
      </Section>}
      {traces.map(({ key, label, unit, segments }) => <Section key={key} title={label + " recorded trace"}><Chart xLabel="Time (s)" yLabel={unit} series={segments.filter(s => s.length).map((points, i) => ({ name: `${label} ${i + 1}`, color: "var(--accent)", points }))} vLines={[{ x: live.t, label: "Now", color: "var(--muted)" }]} /></Section>)}
    </>}
    {tab === "Heel" && <>
      {meter(r?.signals.heel ? "heel" : "roll", "Heel", "deg")}
      <Section title="Recorded inclination"><p className="text-xs text-muted">{r?.signals.heel ? "Uses the supplied heel channel." : r?.signals.roll ? "Uses the recorded roll angle as instantaneous heel; this is the same longitudinal-axis rotation." : "No heel or roll channel was supplied."}</p><KV k="Sample mean inclination" v={f(summary(r?.signals.heel ? "heel" : "roll")?.mean, 2)} unit="deg" /></Section>
    </>}
    {tab === "Hydrostatics" && <Section title="Imported vessel setup">
      <KV k="Physical length" v={f(profile.placement.lengthM, 2)} unit="m" /><KV k="Beam" v={f(m?.equilibrium.beamM, 2)} unit="m" /><KV k="Depth" v={f(m?.equilibrium.depthM, 2)} unit="m" /><KV k="Equilibrium draft" v={f(m?.equilibrium.draftM, 3)} unit="m" /><KV k="Loaded mass" v={m?.equilibrium.massKg ? f(m.equilibrium.massKg / 1000, 2) : "Unavailable"} unit="t" /><KV k="Water density" v={f(m?.environment.waterDensityKgM3, 1)} unit="kg/m3" />
      <KV k="Gravity" v={f(m?.environment.gravityMps2, 3)} unit="m/s2" />
      {(["LCG", "TCG", "KG"] as const).map((label, i) => <KV key={label} k={label} v={f(m?.equilibrium.cgM?.[i], 3)} unit="m" />)}
      <p className="mt-2 text-xs text-muted">Values come from this profile's metadata. Hydrostatic curves and GM are unavailable; no demo-ferry calculations are used.</p>
    </Section>}
    {tab === "Stability" && <Section title="Stability data"><p className="text-xs text-muted">No stability assessment is imported in this workflow. Recorded inclination is available under Heel.</p></Section>}
    {tab === "Performance" && <Section title="Recorded response statistics">
      <p className="mb-2 text-[11px] text-muted">Minimum / maximum over this recording; these are not fitted harmonic amplitudes.</p>
      {[...METRICS, ["resistance", "Resistance", "N", 1] as [Channel, string, string, number]].map(([key, label, unit, scale]) => { const s = summary(key); return <KV key={key} k={label} v={s ? `${f(s.min * scale, 2)} / ${f(s.max * scale, 2)}` : "Unavailable"} unit={unit} />; })}
    </Section>}
    {m && r && <Section title="Data provenance">
      <p className="text-[11px] text-muted">{m.notes}</p>
      <div className="mt-2 space-y-1 break-words text-[10px] text-faint">{Object.entries(r.signals).map(([key, signal]) => <div key={key}>{key}: {signal.file} → {signal.column}</div>)}</div>
      <Btn className="mt-3" onClick={() => {
        const times = [...new Set(Object.values(r.signals).flatMap(s => s.times))].sort((a, b) => a - b);
        const rows = times.map(t => { const values = sampleRecording(r, t); return [t, ...CHANNELS.map(k => values[k] ?? "")].join(","); });
        downloadText("recording-si.csv", ["time_s," + CHANNELS.join(","), ...rows].join("\n"), "text/csv");
      }}>Export normalized results CSV</Btn>
    </Section>}
  </div>;
}
