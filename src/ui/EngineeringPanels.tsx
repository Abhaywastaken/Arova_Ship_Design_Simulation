import { useMemo, useState } from "react";
import { useStore } from "./store";
import { Section, Badge, KV, Num, f } from "./fields";
import { Chart } from "./Chart";
import { motions } from "../engine/vessel";
import { gzAt } from "../engine/stability";
import { ruleDef } from "../engine/rules";

export function HydroPanel() {
  const a = useStore((s) => s.analysis);
  const c = a?.condition;
  if (!a || !c) return <div className="p-4 text-xs text-muted">No loading condition yet.</div>;
  const h = c.hydro;
  return (
    <div>
      <Section title="Floating condition (vessel.js)">
        {c.overloaded && <p className="mb-1 text-xs font-semibold text-bad">The ship is heavier than its hull can carry.</p>}
        <div className="grid grid-cols-2 gap-x-4">
          <KV k="Displacement" v={f(c.weights.total.massT, 0)} unit="t" />
          <KV k="Mean draft T" v={f(c.T, 3)} unit="m" />
          <KV k="Draft aft" v={f(c.draftAft, 3)} unit="m" />
          <KV k="Draft forward" v={f(c.draftFwd, 3)} unit="m" />
          <KV k="Trim (by stern +)" v={f(c.trimByStern, 3)} unit="m" />
          <KV k="Freeboard" v={f(c.freeboard, 2)} unit="m" />
          <KV k="KG solid" v={f(c.KGsolid, 3)} unit="m" />
          <KV k="Free-surface corr." v={f(c.FSC, 3)} unit="m" />
          <KV k="KG fluid" v={f(c.KG, 3)} unit="m" />
          <KV k="LCG" v={f(c.LCG, 2)} unit="m" />
          <KV k="KB" v={f(h.KB, 3)} unit="m" />
          <KV k="BMt" v={f(h.BMt, 3)} unit="m" />
          <KV k="KMt" v={f(h.KMt, 3)} unit="m" />
          <KV k="GMt (fluid)" v={f(c.GMt, 3)} unit="m" />
          <KV k="GMl" v={f(c.GMl, 1)} unit="m" />
          <KV k="Heel from TCG" v={f(c.heelDeg, 2)} unit="deg" />
          <KV k="LCB" v={f(h.LCB, 2)} unit="m" />
          <KV k="LCF" v={f(h.LCF, 2)} unit="m" />
          <KV k="Cb" v={f(h.Cb, 3)} />
          <KV k="Cp" v={f(h.Cp, 3)} />
          <KV k="Cwp" v={f(h.Cwp, 3)} />
          <KV k="Cm" v={f(h.Cm, 3)} />
          <KV k="LWL" v={f(h.LWL, 2)} unit="m" />
          <KV k="BWL" v={f(h.BWL, 2)} unit="m" />
          <KV k="TPC" v={f(h.TPC, 2)} unit="t/cm" />
          <KV k="MCT 1 cm" v={f(h.MCT, 1)} unit="t.m" />
          <KV k="Wetted area" v={f(h.wettedArea, 0)} unit="m2" />
          <KV k="Waterplane area" v={f(h.Awp, 0)} unit="m2" />
        </div>
      </Section>
      <Section title="Weight breakdown">
        <table className="w-full text-xs tabular-nums">
          <thead className="text-muted">
            <tr>
              <th className="text-left font-normal">Item</th>
              <th className="text-right font-normal">t</th>
              <th className="text-right font-normal">LCG</th>
              <th className="text-right font-normal">VCG</th>
            </tr>
          </thead>
          <tbody>
            {c.weights.items.map((w) => (
              <tr key={w.label}>
                <td className="pr-1">{w.label}</td>
                <td className="text-right">{f(w.massT, 1)}</td>
                <td className="text-right">{f(w.lcg, 2)}</td>
                <td className="text-right">{f(w.vcg, 2)}</td>
              </tr>
            ))}
            <tr className="border-t border-line font-semibold">
              <td>Total</td>
              <td className="text-right">{f(c.weights.total.massT, 1)}</td>
              <td className="text-right">{f(c.LCG, 2)}</td>
              <td className="text-right">{f(c.KGsolid, 2)}</td>
            </tr>
          </tbody>
        </table>
        {c.weights.lightship.estimated && <p className="mt-1 text-[11px] text-warn">Lightship is a vessel.js parametric estimate.</p>}
      </Section>
      {a.hydroTable.length > 0 && (
        <>
          <Section title="Hydrostatic curves">
            <Chart
              xLabel="Draft T (m)"
              yLabel="m"
              series={[
                { name: "KB", color: "#a8a49e", points: a.hydroTable.map((r) => [r.T, r.KB]) },
                { name: "KMt", color: "#e0803c", points: a.hydroTable.map((r) => [r.T, Math.min(r.KMt, 60)]) },
                { name: "LCB / 10", color: "#c9a27a", points: a.hydroTable.map((r) => [r.T, r.LCB / 10]) },
              ]}
              vLines={[{ x: c.T, label: "T" }]}
              hLines={[{ y: c.KG, label: "KG", color: "#e5484d" }]}
            />
            <Chart xLabel="Draft T (m)" yLabel="Displacement (t)" series={[{ name: "Displacement", color: "#a8a49e", points: a.hydroTable.map((r) => [r.T, r.dispT]) }]} vLines={[{ x: c.T, label: "T" }]} height={160} />
          </Section>
          <Section title="Hydrostatic table">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] tabular-nums">
                <thead className="text-muted">
                  <tr>
                    {["T", "Disp t", "KB", "KMt", "LCB", "LCF", "TPC", "MCT", "Cb", "Cwp"].map((x) => (
                      <th key={x} className="px-1 text-right font-normal">
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {a.hydroTable.map((r) => (
                    <tr key={r.T}>
                      {[f(r.T, 2), f(r.dispT, 0), f(r.KB, 2), f(r.KMt, 2), f(r.LCB, 2), f(r.LCF, 2), f(r.TPC, 2), f(r.MCT, 1), f(r.Cb, 3), f(r.Cwp, 3)].map((v, i) => (
                        <td key={i} className="px-1 text-right">
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Stability
export function StabilityPanel() {
  const a = useStore((s) => s.analysis);
  const gz = a?.gz;
  const c = a?.condition;
  if (!gz || !c) return <div className="p-4 text-xs text-muted">GZ curve not available (check the loading condition).</div>;
  const v = ruleDef("INTACT-STABILITY").values;
  const rows: [string, number, number, string][] = [
    ["Area 0 to 30 deg", gz.area0_30, v.min_area_0_30_m_rad, "m.rad"],
    ["Area 0 to 40 deg", gz.area0_40, v.min_area_0_40_m_rad, "m.rad"],
    ["Area 30 to 40 deg", gz.area30_40, v.min_area_30_40_m_rad, "m.rad"],
    ["GZ at 30 deg", gzAt(gz, 30), v.min_gz_at_30_deg_or_more_m, "m"],
    ["Angle of max GZ", gz.angleMaxGZ, v.min_angle_of_max_gz_deg, "deg"],
    ["Initial GM", c.GMt, v.min_initial_gm_m, "m"],
  ];
  return (
    <div>
      <Section title="Righting lever curve GZ">
        <Chart
          xLabel="Heel angle (deg)"
          yLabel="GZ (m)"
          series={[
            { name: "GZ", color: "#e0803c", points: gz.points.map((p) => [p.deg, p.gz]) },
            { name: "GM sin(heel)", color: "#6e6b66", dashed: true, points: gz.points.filter((p) => p.deg <= 40).map((p) => [p.deg, c.GMt * Math.sin((p.deg * Math.PI) / 180)]) },
          ]}
          vLines={[
            { x: gz.deckEdgeDeg, label: "deck edge", color: "#c9a27a" },
            { x: 30, label: "30", color: "#55524e" },
            { x: 40, label: "40", color: "#55524e" },
          ]}
          height={220}
        />
        <p className="mt-1 text-[11px] text-muted">Computed by integrating heeled hull sections from the vessel.js offsets at constant displacement. Fixed trim, hull watertight to the moulded depth, slack-tank free-surface correction included.</p>
      </Section>
      <Section title="IS Code 2008 general criteria">
        <table className="w-full text-xs tabular-nums">
          <tbody>
            {rows.map(([n, val, lim, unit]) => (
              <tr key={n}>
                <td>{n}</td>
                <td className="text-right">
                  {f(val, 3)} {unit}
                </td>
                <td className="text-right text-muted">min {lim}</td>
                <td className="pl-2 text-right">
                  <Badge status={val >= lim ? "green" : "red"}>{val >= lim ? "ok" : "fail"}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <KV k="Maximum GZ" v={f(gz.maxGZ, 3)} unit="m" />
        <KV k="Range of positive stability" v={f(gz.rangeDeg, 1)} unit="deg" />
      </Section>
    </div>
  );
}

export function PerformancePanel() {
  const a = useStore((s) => s.analysis);
  const design = useStore((s) => s.design);
  const [m, setM] = useState({ speedKn: design.hull.designSpeedKn, waveFreq: 0.6, waveAmp: 1.5, relHeadingDeg: 180, positionPct: 80 });
  const res = a?.resistance ?? [];
  const ship = a?.ship;
  const c = a?.condition;
  const result = useMemo(() => {
    if (!ship || !c || c.overloaded) return null;
    try {
      return motions(ship, c, m);
    } catch {
      return null;
    }
  }, [ship, c, m]);
  const rao = useMemo(() => {
    if (!ship || !c || c.overloaded) return [];
    const out: { w: number; heave: number; pitch: number; roll: number }[] = [];
    for (let w = 0.2; w <= 2.0001; w += 0.05) {
      try {
        const r = motions(ship, c, { ...m, waveFreq: w, waveAmp: 1 });
        out.push({ w, heave: r.heaveAmp, pitch: r.pitchAmpDeg, roll: r.rollAmpDeg });
      } catch {
        /* skip */
      }
    }
    return out;
  }, [ship, c, m]);
  return (
    <div>
      <Section title="Calm water resistance (Holtrop-Mennen, vessel.js)">
        {res.length ? (
          <>
            <Chart
              xLabel="Speed (kn)"
              yLabel="kN / kW / 10"
              series={[
                { name: "Total resistance kN", color: "#e0803c", points: res.map((p) => [p.speedKn, p.resistanceKN]) },
                { name: "Effective power kW / 10", color: "#e0803c", points: res.map((p) => [p.speedKn, p.effectivePowerKW / 10]) },
              ]}
              vLines={[{ x: design.hull.designSpeedKn, label: "reference speed" }]}
            />
            {a!.holtropWarnings.length > 0 && <p className="mt-1 text-[11px] text-warn">Outside the Holtrop validity range: {a!.holtropWarnings.join("; ")}</p>}
          </>
        ) : (
          <p className="text-xs text-muted">Not available.</p>
        )}
      </Section>
      <Section title="Motions in regular waves (vessel.js WaveMotion)">
        <Num label="Ship speed" value={m.speedKn} unit="kn" step={1} min={0} onChange={(v) => setM({ ...m, speedKn: v })} />
        <Num label="Wave frequency" value={m.waveFreq} unit="rad/s" step={0.05} min={0.1} max={3} onChange={(v) => setM({ ...m, waveFreq: v })} />
        <Num label="Wave amplitude" value={m.waveAmp} unit="m" step={0.25} min={0} onChange={(v) => setM({ ...m, waveAmp: v })} />
        <Num label="Wave heading (180 = head)" value={m.relHeadingDeg} unit="deg" step={15} min={0} max={360} digits={0} onChange={(v) => setM({ ...m, relHeadingDeg: v })} />
        <Num label="Position along hull" value={m.positionPct} unit="% L" step={5} min={0} max={100} digits={0} onChange={(v) => setM({ ...m, positionPct: v })} />
        {result && (
          <div className="mt-2 grid grid-cols-2 gap-x-4">
            <KV k="Heave amplitude" v={f(result.heaveAmp, 2)} unit="m" />
            <KV k="Pitch amplitude" v={f(result.pitchAmpDeg, 2)} unit="deg" />
            <KV k="Roll amplitude" v={f(result.rollAmpDeg, 2)} unit="deg" />
            <KV k="Vertical motion" v={f(result.verticalMotion, 2)} unit="m" />
            <KV k="Vertical acc." v={f(result.verticalAcc, 2)} unit="m/s2" />
            <KV k="Encounter freq." v={f(result.encounterFreq, 3)} unit="rad/s" />
            <KV k="Natural roll period" v={f(result.naturalRollPeriod, 1)} unit="s" />
          </div>
        )}
        {rao.length > 0 && (
          <Chart
            xLabel="Wave frequency (rad/s)"
            yLabel="per m wave amplitude"
            series={[
              { name: "Heave m/m", color: "#e0803c", points: rao.map((r) => [r.w, r.heave]) },
              { name: "Pitch deg/m", color: "#e0803c", points: rao.map((r) => [r.w, r.pitch]) },
              { name: "Roll deg/m", color: "#e5484d", points: rao.map((r) => [r.w, r.roll]) },
            ]}
          />
        )}
        <p className="mt-1 text-[11px] text-muted">Closed-form formulas (Jensen, Mansour and Olsen) as implemented in vessel.js. For early comparison of alternatives only.</p>
      </Section>
    </div>
  );
}
