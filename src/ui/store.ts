import { create } from "zustand";
import type { Design, Space, SpaceType } from "../engine/types";
import { normalizeDesign } from "../engine/types";
import { analyze, type Analysis } from "../engine/analyze";
import { demoDesign } from "../data/demoDesign";
import { overlapsWith } from "../engine/topology";
import { centreOutsideHull } from "../engine/vessel";
import type { ShipProfile } from "./shipProfiles";
import { disposeModel } from "./three/modelImport";

export type StampKind = "cabin_block" | "stair_core";
export type Tool =
  | { kind: "select" }
  | { kind: "space"; type: SpaceType }
  | { kind: "door" }
  | { kind: "bulkhead"; bk: "fire_zone" | "watertight" }
  | { kind: "lsa"; lsa: "lifeboat" | "liferaft" }
  | { kind: "stamp"; stamp: StampKind };
export type Selection = { kind: "space" | "door" | "bulkhead" | "lsa"; id: string } | null;
export type TestKind = "sea" | "heel";

export interface RefMesh {
  name: string;
  object: unknown; // THREE.Object3D, kept out of the design file
  offset: [number, number, number];
  scale: number;
  rotZ: number;
  visible: boolean;
  opacity: number;
}

export interface TestSettings {
  kind: TestKind;
  running: boolean;
  speedKn: number;
  waveAmp: number;
  waveFreq: number;
  headingDeg: number; // 180 = head seas
  heelSweep: boolean;
  heelDeg: number;
  timeScale: number;
  restart: number; // bump to restart the animation
}

const STORAGE_KEY = "ship-precheck-design-v1";
const PREVIOUS_KEY = "ship-precheck-previous-session";
const THEME_KEY = "ship-precheck-theme";

/**
 * The app always starts from the default demo ferry, so a reload never shows an old, half-edited design.
 * The design of the last session is kept under PREVIOUS_KEY and can be restored from File > Restore last session.
 */
function loadInitial(): Design {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) localStorage.setItem(PREVIOUS_KEY, raw);
  } catch {
    /* storage unavailable */
  }
  return demoDesign();
}

export function hasPreviousSession(): boolean {
  try {
    return localStorage.getItem(PREVIOUS_KEY) !== null;
  } catch {
    return false;
  }
}

/** The design from the previous browser session, or null. */
export function previousSession(): Design | null {
  try {
    const raw = localStorage.getItem(PREVIOUS_KEY);
    return raw ? normalizeDesign(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

interface State {
  profiles: ShipProfile[];
  activeProfileId: string | null;
  playback: { time: number; seek: number; loop: boolean };
  addProfiles: (profiles: ShipProfile[]) => void;
  selectProfile: (id: string | null) => void;
  removeProfile: (id: string) => void;
  updateProfile: (id: string, patch: Partial<Pick<ShipProfile, "placement" | "object">>) => void;
  seekPlayback: (time: number) => void;
  setLoop: (loop: boolean) => void;
  design: Design;
  past: Design[];
  future: Design[];
  analysis: Analysis | null;
  analyzing: boolean;
  selection: Selection;
  activeDeckId: string;
  tool: Tool;
  panel: "test";
  mode: "design" | "test";
  theme: "dark" | "light";
  view: { isolateDeck: boolean; showHull: boolean; showRoutes: boolean; showWater: boolean; showBulkheads: boolean; showLabels: boolean };
  focusCase: number | null;
  test: TestSettings;
  refMesh: RefMesh | null;
  toast: { text: string; kind: "error" | "info" | "ok"; id: number } | null;
  tourStep: null;
  assembleAt: number; // time (s) of the last design load: spaces assemble from it
  stampOpts: { cabins: number; cabinLength: number; cabinDepth: number; corridorWidth: number; persons: number; stairWidthMm: number };
  setStampOpts: (p: Partial<State["stampOpts"]>) => void;
  edit: (fn: (d: Design) => void, commit?: boolean) => void;
  /** Edit one space; refused (with a message) if the result would overlap another space. */
  editSpace: (id: string, fn: (s: Space) => void) => boolean;
  beginGesture: () => void;
  commit: () => void;
  cancelGesture: () => void;
  undo: () => void;
  redo: () => void;
  load: (d: Design) => void;
  select: (s: Selection) => void;
  set: (p: Partial<Pick<State, "activeDeckId" | "tool" | "panel" | "focusCase" | "mode" | "tourStep">>) => void;
  setView: (p: Partial<State["view"]>) => void;
  setTest: (p: Partial<TestSettings>) => void;
  setTheme: (t: "dark" | "light") => void;
  setRefMesh: (m: RefMesh | null) => void;
  notify: (text: string, kind?: "error" | "info" | "ok") => void;
}

let gestureStart: Design | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<State>((set, get) => {
  const schedule = () => {
    if (timer) clearTimeout(timer);
    set({ analyzing: true });
    timer = setTimeout(() => {
      const d = get().design;
      let a: Analysis | null = null;
      try {
        a = analyze(d);
      } catch (e) {
        console.error(e);
      }
      set({ analysis: a, analyzing: false });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
      } catch {
        /* storage unavailable */
      }
    }, 200);
  };
  const initial = loadInitial();
  setTimeout(schedule, 0);
  let theme: "dark" | "light" = "dark";
  let urlTest: TestKind | null = null;
  try {
    const q = new URLSearchParams(window.location.search);
    const requestedTest = q.get("test");
    if (["sea", "heel"].includes(requestedTest ?? "")) urlTest = requestedTest as TestKind;
    const requestedTheme = q.get("theme") ?? localStorage.getItem(THEME_KEY);
    if (requestedTheme === "dark" || requestedTheme === "light") theme = requestedTheme;
  } catch {
    /* no window */
  }
  return {
    profiles: [], activeProfileId: null, playback: { time: 0, seek: 0, loop: false },
    addProfiles: (profiles) => {
      const ids = new Set(profiles.map(p => p.id));
      const old = get().profiles.filter(p => ids.has(p.id));
      set({ profiles: [...get().profiles.filter(p => !ids.has(p.id)), ...profiles] });
      get().selectProfile(profiles[profiles.length - 1].id);
      old.forEach(p => disposeModel(p.source));
    },
    selectProfile: (id) => {
      const next = get().profiles.find(p => p.id === id);
      if (id !== null && !next) return;
      const previousId = get().activeProfileId;
      const time = next?.resumeTime ?? 0;
      set({ profiles: get().profiles.map(p => p.id === previousId && p.id !== id ? { ...p, resumeTime: live.t } : p), activeProfileId: id,
        refMesh: next ? { name: next.meshFile.name, object: next.object, offset: [0, 0, 0], scale: 1, rotZ: 0, visible: true, opacity: 1 } : null,
        playback: { ...get().playback, time, seek: get().playback.seek + 1 },
        test: { ...get().test, running: !!next?.recording || id === null, restart: Date.now() } });
      resetLive(); live.t = time;
      window.dispatchEvent(new CustomEvent("viewport:view", { detail: "3d" }));
    },
    removeProfile: (id) => {
      if (get().activeProfileId === id) get().selectProfile(null);
      const removed = get().profiles.find(p => p.id === id);
      set({ profiles: get().profiles.filter(p => p.id !== id) });
      if (removed) disposeModel(removed.source);
    },
    updateProfile: (id, patch) => {
      set({ profiles: get().profiles.map(p => p.id === id ? { ...p, ...patch } : p) });
      if (id === get().activeProfileId && get().refMesh && patch.object) set({ refMesh: { ...get().refMesh!, object: patch.object } });
    },
    seekPlayback: (time) => {
      const r = get().profiles.find(p => p.id === get().activeProfileId)?.recording;
      if (!r || !Number.isFinite(time)) return;
      set({ playback: { ...get().playback, time: Math.min(r.end, Math.max(r.start, time)), seek: get().playback.seek + 1 }, test: { ...get().test, running: false } });
    },
    setLoop: (loop) => set({ playback: { ...get().playback, loop } }),
    design: initial,
    past: [],
    future: [],
    analysis: null,
    analyzing: true,
    selection: null,
    activeDeckId: initial.decks[Math.min(2, initial.decks.length - 1)]?.id ?? "",
    tool: { kind: "select" },
    panel: "test",
    mode: "test",
    theme,
    view: { isolateDeck: true, showHull: true, showRoutes: false, showWater: true, showBulkheads: true, showLabels: false },
    focusCase: null,
    test: { kind: urlTest ?? "sea", running: true, speedKn: initial.hull.designSpeedKn, waveAmp: 1.5, waveFreq: 0.6, headingDeg: 150, heelSweep: true, heelDeg: 10, timeScale: 1, restart: 0 },
    refMesh: null,
    toast: null,
    tourStep: null,
    assembleAt: typeof performance !== "undefined" ? performance.now() / 1000 : 0,
    stampOpts: { cabins: 6, cabinLength: 4, cabinDepth: 4, corridorWidth: 2, persons: 2, stairWidthMm: 1200 },
    setStampOpts: (p) => set({ stampOpts: { ...get().stampOpts, ...p } }),
    edit: (fn, commit = true) => {
      const prev = get().design;
      const next = structuredClone(prev);
      fn(next);
      if (commit) set({ design: next, past: [...get().past.slice(-99), prev], future: [] });
      else set({ design: next });
      schedule();
    },
    editSpace: (id, fn) => {
      const probe = structuredClone(get().design);
      const s = probe.spaces.find((x) => x.id === id);
      if (!s) return false;
      fn(s);
      const hit = overlapsWith(probe, s);
      if (hit.length) {
        get().notify(`Not applied: ${s.name} would overlap ${hit[0].name}. Spaces may touch but not overlap.`, "error");
        return false;
      }
      const ship = get().analysis?.ship;
      if (ship && centreOutsideHull(probe, ship, s)) {
        get().notify(`Not applied: the centre of ${s.name} would be outside the hull, in the water. Move it towards the centreline.`, "error");
        return false;
      }
      get().edit((d) => fn(d.spaces.find((x) => x.id === id)!));
      return true;
    },
    beginGesture: () => {
      gestureStart = get().design;
    },
    commit: () => {
      if (gestureStart && gestureStart !== get().design) set({ past: [...get().past.slice(-99), gestureStart], future: [] });
      gestureStart = null;
    },
    cancelGesture: () => {
      if (gestureStart) set({ design: gestureStart });
      gestureStart = null;
      schedule();
    },
    undo: () => {
      const { past, design, future } = get();
      if (!past.length) return;
      set({ design: past[past.length - 1], past: past.slice(0, -1), future: [design, ...future] });
      schedule();
    },
    redo: () => {
      const { past, design, future } = get();
      if (!future.length) return;
      set({ design: future[0], future: future.slice(1), past: [...past, design] });
      schedule();
    },
    load: (d) => {
      const n = normalizeDesign(d);
      set({ design: n, past: [...get().past, get().design], future: [], selection: null, activeDeckId: n.decks[Math.min(2, n.decks.length - 1)]?.id ?? "", focusCase: null, assembleAt: performance.now() / 1000 });
      schedule();
    },
    // Legacy panel links and tool requests must never re-enable the editor.
    select: () => set({ selection: null }),
    set: (p) => set({ ...p, mode: "test", panel: "test", tool: { kind: "select" }, selection: null, tourStep: null }),
    setView: (p) => set({ view: { ...get().view, ...p } }),
    setTest: (p) => set({ test: { ...get().test, ...p } }),
    setTheme: (t) => {
      set({ theme: t });
      try {
        localStorage.setItem(THEME_KEY, t);
      } catch {
        /* storage unavailable */
      }
    },
    setRefMesh: (m) => set({ refMesh: m }),
    notify: (text, kind = "info") => {
      if (toastTimer) clearTimeout(toastTimer);
      set({ toast: { text, kind, id: Date.now() } });
      toastTimer = setTimeout(() => set({ toast: null }), 4000);
    },
  };
});

let idc = 0;
export function newId(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${(idc++).toString(36)}`;
}

/** Values written every frame by the 3D test animation and read by the dials. */
export const live = {
  t: 0,
  heave: 0,
  pitchDeg: 0,
  rollDeg: 0,
  vertAcc: 0,
  heelDeg: 0,
  gz: 0,
  buoyancyN: 0,
  submergedVolumeM3: 0,
  history: [] as { t: number; a: number; b: number; buoyancyN: number }[],
};

/** Clear measurements when a test is switched or restarted. */
export function resetLive() {
  Object.assign(live, {
    t: 0, heave: 0, pitchDeg: 0, rollDeg: 0, vertAcc: 0,
    heelDeg: 0, gz: 0, buoyancyN: 0, submergedVolumeM3: 0, history: [],
  });
}
