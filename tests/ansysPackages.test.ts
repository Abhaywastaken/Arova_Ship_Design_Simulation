import { describe, expect, it } from "vitest";
import { importPackages, meshProfile, PACKAGE_TEMPLATE } from "../src/ui/shipProfiles";
import { disposeModel } from "../src/ui/three/modelImport";
import { sampleRecording } from "../src/engine/ansys";

const points = [[0,0,0],[10,0,0],[0,2,0],[0,0,4]];
const stl = "solid tetra\n" + [[0,2,1],[0,1,3],[1,2,3],[2,0,3]].map(face => "facet normal 0 0 0\nouter loop\n" + face.map(i => "vertex " + points[i].join(" ")).join("\n") + "\nendloop\nendfacet").join("\n") + "\nendsolid tetra";
const mesh = () => new File([stl], "ship.stl");
const results = () => new File(["time_s,roll_deg,pitch_deg,heave_m,bow_acc_z_mps2,buoyancy_N\n0,0,0,0,0,100\n2,4,2,1,2,300"], "results.csv");
function setup(name = "A", extra = {}) { return new File([JSON.stringify({ ...PACKAGE_TEMPLATE, name, ...extra })], name + ".json"); }

describe("multi-file ship packages", () => {
  it("adds independent profiles for two conditions even when they share a mesh", async () => {
    const profiles = await importPackages([setup("A"), setup("B"), mesh(), results()]);
    expect(profiles).toHaveLength(2); expect(profiles[0].id).not.toBe(profiles[1].id);
    expect(profiles[0].object).not.toBe(profiles[1].object);
    expect(sampleRecording(profiles[0].recording, 1)).toMatchObject({ roll: 2, heave: .5, buoyancy: 200 });
    profiles.forEach(p => disposeModel(p.source));
  });
  it("attaches without the mesh file and keeps the existing profile identity", async () => {
    const active = await meshProfile(mesh());
    const [attached] = await importPackages([setup(), results()], active);
    expect(attached.id).toBe(active.id); expect(attached.manifest?.name).toBe("A");
    expect(active.recording).toBeUndefined();
    disposeModel(active.source); disposeModel(attached.source);
  });
  it("rejects a mismatched hash and attaching a different mesh", async () => {
    const active = await meshProfile(mesh());
    await expect(importPackages([setup("bad", { mesh: { ...PACKAGE_TEMPLATE.mesh, sha256: "0".repeat(64) } }), results()], active)).rejects.toThrow("SHA-256");
    await expect(importPackages([setup("other", { mesh: { ...PACKAGE_TEMPLATE.mesh, file: "other.stl" } }), results()], active)).rejects.toThrow("different mesh");
    disposeModel(active.source);
  });
  it("rejects incomplete and malformed batches without changing an existing profile", async () => {
    const active = await meshProfile(mesh());
    const original = active.object;
    await expect(importPackages([setup(), mesh()])).rejects.toThrow("Missing report");
    await expect(importPackages([setup(), mesh(), results(), new File(["{}"], "invalid.json")])).rejects.toThrow("Metadata");
    expect(active.object).toBe(original); expect(active.recording).toBeUndefined();
    disposeModel(active.source);
  });
});
