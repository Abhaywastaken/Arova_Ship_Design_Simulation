import { useEffect, useRef, useState } from "react";
import { useStore } from "./store";
import { Check, Icon, Num, Select } from "./fields";
import { placeModel, type ModelAxis, type ModelPlacement } from "./three/modelImport";
import { downloadText, importPackages, meshProfile, PACKAGE_TEMPLATE } from "./shipProfiles";

const AXES: ModelAxis[] = ["+X", "-X", "+Y", "-Y", "+Z", "-Z"];
const actionClass = "w-full rounded px-2 py-2 text-left text-xs text-fg hover:bg-surface-2 disabled:opacity-40";
export function FileMenu() {
  const menu = useRef<HTMLDetailsElement>(null), input = useRef<HTMLInputElement>(null), packageInput = useRef<HTMLInputElement>(null);
  const attaching = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const profiles = useStore(s => s.profiles), activeId = useStore(s => s.activeProfileId), refMesh = useStore(s => s.refMesh);
  const active = profiles.find(p => p.id === activeId);
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (menu.current && !menu.current.contains(e.target as Node)) menu.current.open = false; };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape" && menu.current?.open) { menu.current.open = false; menu.current.querySelector("summary")?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  const load = async (files: File[], packaged: boolean) => {
    if (!files.length) return;
    setBusy(true); setError("");
    try {
      const imported = packaged ? await importPackages(files, attaching.current ? active : undefined) : [await meshProfile(files[0])];
      useStore.getState().addProfiles(imported);
      useStore.getState().notify(`Imported ${imported.length} ship profile${imported.length === 1 ? "" : "s"}.`, "ok");
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); if (menu.current) menu.current.open = true; }
  };
  const place = (patch: Partial<ModelPlacement>) => {
    if (!active || active.recording) return;
    const placement = { ...active.placement, ...patch };
    useStore.getState().updateProfile(active.id, { placement, object: placeModel(active.source, placement) });
  };
  return <details ref={menu} className="relative shrink-0">
    <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded px-2 py-2 text-xs text-muted hover:bg-surface-2 hover:text-fg [&::-webkit-details-marker]:hidden">File <Icon d="m8 10 4 4 4-4" size={12} /></summary>
    <div aria-label="File options" className="absolute top-full left-0 z-50 mt-3 max-h-[70dvh] w-[min(340px,calc(100vw-32px))] overflow-y-auto rounded border border-line bg-surface p-2 shadow-xl">
      <button className={actionClass} disabled={busy} onClick={() => { attaching.current = false; packageInput.current?.click(); }}>{busy ? "Importing..." : "Import ANSYS package..."}</button>
      <p className="px-2 pb-2 text-[11px] text-muted">Select the metadata JSON, STL/GLB and all CSV/OUT reports together. Multiple packages can be selected.</p>
      <button className={actionClass} disabled={busy} onClick={() => input.current?.click()}>Import model (STL / GLB)...</button>
      <button className={actionClass} onClick={() => downloadText("ship.setup.json", JSON.stringify(PACKAGE_TEMPLATE, null, 2))}>Download setup template</button>
      {error && <p role="alert" className="px-2 py-2 text-xs break-words text-bad">{error}</p>}
      {active && <div className="mt-1 border-t border-line px-2 pt-3 pb-1">
        <div className="label mb-2">Ship profile</div>
        <p className="mb-2 truncate text-xs" title={active.name}>{active.name}</p>
        <p className="mb-3 text-[11px] leading-relaxed text-muted">{active.recording ? "ANSYS recording. Physical setup and geometry are locked to the imported metadata." : "Geometry only. Set the physical length and orientation, then attach metadata and reports. Readings are unavailable until results are imported."}</p>
        {!active.recording && <>
          <Select label="Model up axis" value={active.placement.up} options={AXES.map(value => ({ value, label: value }))} onChange={up => place({ up, ...(up[1] === active.placement.bow[1] ? { bow: AXES.find(axis => axis[1] !== up[1])! } : {}) })} />
          <Select label="Model bow direction" value={active.placement.bow} options={AXES.filter(axis => axis[1] !== active.placement.up[1]).map(value => ({ value, label: value }))} onChange={bow => place({ bow })} />
          <Num label="Physical length" value={active.placement.lengthM} onChange={lengthM => place({ lengthM })} min={0.01} max={1000} unit="m" />
        </>}
        <button className={actionClass} disabled={busy} onClick={() => { attaching.current = true; packageInput.current?.click(); }}>Attach / replace ANSYS results...</button>
        {refMesh && <Check label="Show imported model" value={refMesh.visible} onChange={visible => useStore.getState().setRefMesh({ ...refMesh, visible })} />}
        <button className={`${actionClass} mt-2`} onClick={() => { useStore.getState().removeProfile(active.id); setError(""); if (menu.current) menu.current.open = false; }}>Remove ship profile</button>
      </div>}
      <p className="px-2 pt-2 text-[10px] text-faint">Profiles stay in this browser session until removed or the page is reloaded.</p>
    </div>
    <input ref={input} aria-label="Import ship model" type="file" accept=".stl,.glb" className="hidden" disabled={busy} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void load(files, false); }} />
    <input ref={packageInput} aria-label="Import ANSYS package" type="file" multiple accept=".json,.stl,.glb,.csv,.out,.txt,.tsv" className="hidden" disabled={busy} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void load(files, true); }} />
  </details>;
}
