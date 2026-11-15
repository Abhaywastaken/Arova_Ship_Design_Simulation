import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { defaultPlacement, placeModel, readModel, type ModelAxis } from "../src/ui/three/modelImport";

describe("imported model placement", () => {
  it("normalizes a nested transformed model to the requested length, centreline and keel", () => {
    const source = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 4));
    mesh.position.set(30, -5, 12);
    source.add(mesh);
    source.scale.setScalar(3);
    const original = source.toJSON();
    const placed = placeModel(source, { up: "+Z", bow: "+X", lengthM: 120 });
    const bounds = new THREE.Box3().setFromObject(placed);
    expect(bounds.min.x).toBeCloseTo(0);
    expect(bounds.max.x).toBeCloseTo(120);
    expect(bounds.min.y + bounds.max.y).toBeCloseTo(0);
    expect(bounds.min.z).toBeCloseTo(0);
    expect(bounds.max.z).toBeCloseTo(48);
    expect(source.toJSON()).toEqual(original);
  });

  it("maps every perpendicular bow/up pair to ship forward/up without mirroring", () => {
    const axes: ModelAxis[] = ["+X", "-X", "+Y", "-Y", "+Z", "-Z"];
    const vector = (axis: ModelAxis) => new THREE.Vector3(axis[1] === "X" ? 1 : 0, axis[1] === "Y" ? 1 : 0, axis[1] === "Z" ? 1 : 0).multiplyScalar(axis[0] === "+" ? 1 : -1);
    const source = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 2));
    for (const up of axes) for (const bow of axes.filter((axis) => axis[1] !== up[1])) {
      const placed = placeModel(source, { up, bow, lengthM: 100 });
      placed.updateMatrixWorld(true);
      const rotation = placed.children[0].matrixWorld;
      expect(vector(bow).transformDirection(rotation).distanceTo(new THREE.Vector3(1, 0, 0))).toBeLessThan(1e-10);
      expect(vector(up).transformDirection(rotation).distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-10);
      expect(rotation.determinant()).toBeGreaterThan(0);
      expect(new THREE.Box3().setFromObject(placed).getSize(new THREE.Vector3()).x).toBeCloseTo(100);
    }
  });

  it("starts STL Z-up and GLB Y-up with the longest horizontal axis forward", () => {
    const model = new THREE.Mesh(new THREE.BoxGeometry(4, 10, 20));
    expect(defaultPlacement(model, "ship.stl", 120)).toEqual({ up: "+Z", bow: "+Y", lengthM: 120 });
    expect(defaultPlacement(model, "ship.GLB", 120)).toEqual({ up: "+Y", bow: "+Z", lengthM: 120 });
  });

  it("rejects invalid length and parallel axes", () => {
    const model = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 2));
    for (const lengthM of [0, -1, NaN, Infinity]) expect(() => placeModel(model, { up: "+Z", bow: "+X", lengthM })).toThrow("length");
    expect(() => placeModel(model, { up: "+Z", bow: "-Z", lengthM: 120 })).toThrow("different axes");
  });

  it("rejects unsupported and empty model files", async () => {
    await expect(readModel(new File(["{}"], "ship.json"))).rejects.toThrow("STL");
    await expect(readModel(new File(["solid empty\nendsolid empty"], "empty.stl"))).rejects.toThrow("valid 3D mesh");
  });
});
