import * as THREE from "three";

export type ModelAxis = "+X" | "-X" | "+Y" | "-Y" | "+Z" | "-Z";
export interface ModelPlacement {
  up: ModelAxis;
  bow: ModelAxis;
  lengthM: number;
}

const axisVector = (axis: ModelAxis) => {
  const sign = axis[0] === "+" ? 1 : -1;
  return new THREE.Vector3(axis[1] === "X" ? sign : 0, axis[1] === "Y" ? sign : 0, axis[1] === "Z" ? sign : 0);
};

/** Mesh display only. No mass, hull offsets or hydrodynamics are inferred. */
export async function readModel(file: File): Promise<THREE.Object3D> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "stl" && ext !== "glb") throw new Error("Choose an STL or a self-contained GLB file.");
  const buffer = await file.arrayBuffer();
  let object: THREE.Object3D;
  if (ext === "stl") {
    const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
    let geometry: THREE.BufferGeometry;
    try {
      geometry = new STLLoader().parse(buffer);
    } catch {
      throw new Error("The STL file does not contain a valid 3D mesh.");
    }
    geometry.computeVertexNormals();
    object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: "#c8c4bd", side: THREE.DoubleSide, roughness: 0.7 }));
  } else {
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      if (!url.startsWith("blob:") && !url.startsWith("data:")) throw new Error("Export a self-contained GLB with its textures embedded.");
      return url;
    });
    object = (await new GLTFLoader(manager).parseAsync(buffer, "")).scene;
  }
  try {
    let vertices = 0;
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const positions = mesh.geometry.getAttribute("position");
      if (!positions) return;
      vertices += positions.count;
      for (let i = 0; i < positions.count; i++) {
        if (![positions.getX(i), positions.getY(i), positions.getZ(i)].every(Number.isFinite)) throw new Error("The model contains invalid vertex coordinates.");
      }
    });
    const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
    if (vertices < 3 || ![size.x, size.y, size.z].every((v) => Number.isFinite(v) && v > 0)) throw new Error("The file does not contain a valid 3D mesh.");
    return object;
  } catch (error) {
    disposeModel(object);
    throw error;
  }
}

export function defaultPlacement(object: THREE.Object3D, name: string, lengthM: number): ModelPlacement {
  const up = name.toLowerCase().endsWith(".glb") ? "+Y" : "+Z";
  const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
  // STL has no axis metadata. Start with its longest horizontal extent forward.
  const other = up === "+Y" ? "Z" : "Y";
  const bow: ModelAxis = size.x >= (other === "Z" ? size.z : size.y) ? "+X" : `+${other}`;
  return { up, bow, lengthM };
}

/** Rotate into x-forward/z-up, then put stern at x=0 and keel at z=0. */
export function placeModel(source: THREE.Object3D, placement: ModelPlacement): THREE.Object3D {
  if (!Number.isFinite(placement.lengthM) || placement.lengthM <= 0) throw new Error("Model length must be greater than zero.");
  const forward = axisVector(placement.bow), up = axisVector(placement.up);
  if (Math.abs(forward.dot(up)) > 0.5) throw new Error("Bow and up must use different axes.");
  const port = new THREE.Vector3().crossVectors(up, forward);
  const rotation = new THREE.Matrix4().makeBasis(forward, port, up).invert();
  const oriented = new THREE.Group();
  oriented.quaternion.setFromRotationMatrix(rotation);
  oriented.add(source.clone(true));
  const box = new THREE.Box3().setFromObject(oriented);
  const scale = placement.lengthM / (box.max.x - box.min.x);
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("The model cannot be scaled to this physical length.");
  const result = new THREE.Group();
  result.name = "Imported model";
  result.scale.setScalar(scale);
  result.position.set(-box.min.x * scale, -(box.min.y + box.max.y) / 2 * scale, -box.min.z * scale);
  result.add(oriented);
  return result;
}

export function disposeModel(object: THREE.Object3D) {
  const resources = new Set<{ dispose(): void }>();
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    resources.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      resources.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) resources.add(value);
    }
  });
  resources.forEach((resource) => resource.dispose());
}
