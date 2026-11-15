import { useEffect } from "react";
import { useStore } from "./store";
import { Viewport } from "./three/Viewport";
import { TestPanel } from "./TestPanel";
import { f, Icon } from "./fields";
import { FileMenu } from "./FileMenu";
import { ImportedTestPanel } from "./ImportedTestPanel";

export function App() {
  const theme = useStore((s) => s.theme);
  const analyzing = useStore((s) => s.analyzing);
  const analysis = useStore((s) => s.analysis);
  const toast = useStore((s) => s.toast);
  const design = useStore((s) => s.design);
  const test = useStore((s) => s.test);
  const setTheme = useStore((s) => s.setTheme);
  const activeProfileId = useStore(s => s.activeProfileId);
  const profiles = useStore(s => s.profiles);
  const profile = profiles.find(p => p.id === activeProfileId);
  const c = analysis?.condition;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-bg text-fg">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-surface px-4 py-2">
        <FileMenu />
        <nav aria-label="Workspace" className="flex self-stretch" role="tablist">
          <button
            id="test-tab"
            type="button"
            role="tab"
            aria-selected="true"
            aria-controls="test-workspace"
            className="relative px-1 text-[12px] text-fg"
          >
            Test
            <span className="absolute right-0 bottom-0 left-0 h-[2px] bg-accent" />
          </button>
        </nav>
        <div className="order-last w-full min-w-0 border-t border-line pt-2 sm:order-none sm:w-auto sm:flex-1 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
          {profiles.length ? <select aria-label="Ship profile" className="w-full min-w-0 truncate bg-surface text-[12px] font-medium" value={activeProfileId ?? "demo"} onChange={e => useStore.getState().selectProfile(e.target.value === "demo" ? null : e.target.value)}>
            <option value="demo">{design.name}</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select> : <div className="truncate text-[12px] font-medium">{design.name}</div>}
          {profile ? <div aria-label="Calculation model" className="mt-0.5 text-[10px] text-muted">{profile.recording ? "ANSYS recording" : "Geometry only / Results unavailable"} · {profile.placement.lengthM} m</div> : <div className="mt-0.5 hidden text-[10px] text-faint sm:block">LOA {design.hull.LOA} m <span className="mx-1.5">/</span> Beam {design.hull.BOA} m <span className="mx-1.5">/</span> Depth {design.hull.depth} m</div>}
        </div>
        <div role="status" aria-label="Simulation status" className="hidden items-center gap-2 text-[11px] text-muted sm:flex">
          <span className={`h-1.5 w-1.5 rounded-full ${analyzing ? "bg-warn" : test.running ? "bg-ok" : "bg-faint"}`} />
          <span>{profile ? "Recorded results" : {sea: "Waves", heel: "Heel"}[test.kind]}</span>
          <span className="text-faint">{!profile && analyzing ? "Preparing" : test.running ? "Running" : "Paused"}</span>
          <span className="font-mono text-faint">{test.timeScale}x</span>
        </div>
        <div className="ml-auto flex items-center gap-1 border-l border-line pl-3 sm:ml-0">
          <button type="button" aria-label="Reset camera" title="Reset camera" className="rounded p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg" onClick={() => window.dispatchEvent(new CustomEvent("viewport:view", { detail: "3d" }))}>
            <Icon d="M8 4H4v4M4 4l5 5M16 20h4v-4m0 4-5-5M20 8V4h-4M4 16v4h4" size={16} />
          </button>
          <button type="button" aria-label={theme === "dark" ? "Light theme" : "Dark theme"} title={theme === "dark" ? "Light theme" : "Dark theme"} className="rounded p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            <Icon d={theme === "dark" ? "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" : "M20 15A8 8 0 0 1 9 4a8 8 0 1 0 11 11Z"} size={16} />
          </button>
        </div>
      </header>

      <div id="test-workspace" role="tabpanel" aria-labelledby="test-tab" className="flex min-h-0 flex-1 flex-col md:flex-row">
        <main aria-label="Ship simulation" className="relative min-h-[240px] min-w-0 flex-1 overflow-hidden">
          <Viewport />
          {analyzing && !profile && (
            <div role="status" className="absolute top-3 left-4 text-xs text-muted">Preparing simulation...</div>
          )}
          {toast && (
            <div
              key={toast.id}
              role={toast.kind === "error" ? "alert" : "status"}
              className="anim-rise absolute right-4 bottom-4 left-4 mx-auto w-fit max-w-full rounded border border-line bg-surface px-4 py-2 text-xs shadow-lg"
              style={{ color: toast.kind === "error" ? "var(--bad)" : "var(--fg)", overflowWrap: "anywhere" }}
            >
              {toast.text}
            </div>
          )}
        </main>

        <aside aria-label="Test controls" className="min-h-0 max-h-[52%] w-full shrink-0 overflow-y-auto border-t border-line bg-surface md:max-h-none md:w-[400px] md:border-t-0 md:border-l">
          {profile ? <ImportedTestPanel key={profile.id} profile={profile} /> : !analyzing && !c ? (
            <p role="alert" className="px-4 py-3 text-xs text-bad">The simulation could not load. Reload the page to try again.</p>
          ) : (
            <TestPanel />
          )}
        </aside>
      </div>

      <footer aria-label="Ship condition" className="flex shrink-0 flex-wrap gap-x-5 gap-y-1 border-t border-line bg-surface px-4 py-1.5 text-[11px] text-muted tabular-nums">
        {profile ? <>
          <span>Source: {profile.recording ? "ANSYS recording" : "No results"}</span>
          <span>Length {f(profile.placement.lengthM, 2)} m</span>
          <span>Draft {f(profile.manifest?.equilibrium.draftM, 2)} m</span>
          <span>Mass {profile.manifest?.equilibrium.massKg ? f(profile.manifest.equilibrium.massKg / 1000, 1) + " t" : "unavailable"}</span>
        </> : c ? (
          <>
            <span><span className="text-faint">Displacement </span>{f(c.weights.total.massT, 0)} t</span>
            <span><span className="text-faint">Draft </span>{f(c.T, 2)} m</span>
            <span><span className="text-faint">Trim </span>{f(c.trimByStern, 2)} m</span>
            <span><span className="text-faint">GM </span>{f(c.GMt, 2)} m</span>
            <span><span className="text-faint">Freeboard </span>{f(c.freeboard, 2)} m</span>
          </>
        ) : (
          <span>{analyzing ? "Calculating ship condition..." : "Ship condition unavailable"}</span>
        )}
      </footer>
    </div>
  );
}
