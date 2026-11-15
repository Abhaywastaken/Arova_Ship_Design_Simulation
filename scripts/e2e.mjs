// Test-bench regression checks through Chrome DevTools. Start npm run dev first.
// Optional environment: CHROME, APP_URL.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const browser = process.env.CHROME ?? [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((p) => fs.existsSync(p));
if (!browser) throw new Error("Chrome/Edge not found. Set CHROME to the browser executable.");
const appURL = process.env.APP_URL ?? "http://127.0.0.1:5173/";
const port = 9333;
const outDir = path.resolve("e2e-output");
fs.mkdirSync(outDir, { recursive: true });
// Chrome may overwrite an earlier file with the same name. Give each run its
// own download directory so previous PDFs cannot make this check pass or fail.
const downloadDir = fs.mkdtempSync(path.join(outDir, "downloads-"));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "arova-e2e-"));
const chrome = spawn(browser, [
  "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  "--window-size=1600,900", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--no-first-run", "about:blank",
], { stdio: "ignore", windowsHide: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const errors = [];
let passed = 0;
let ws;
function check(name, ok, detail = "") {
  if (!ok) throw new Error(`${name}${detail ? ": " + detail : ""}`);
  passed++;
  console.log(`PASS  ${name}${detail ? "  (" + detail + ")" : ""}`);
}

async function main() {
  let available = false;
  for (let i = 0; i < 60; i++) {
    try {
      await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      available = true;
      break;
    } catch { await sleep(200); }
  }
  if (!available) throw new Error("Browser did not start.");
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (message) => {
    const data = JSON.parse(message.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject, timer } = pending.get(data.id);
      clearTimeout(timer);
      pending.delete(data.id);
      if (data.error) reject(new Error(JSON.stringify(data.error)));
      else resolve(data.result);
    }
    if (data.method === "Runtime.exceptionThrown") errors.push(data.params.exceptionDetails.exception?.description ?? data.params.exceptionDetails.text);
    if (data.method === "Runtime.consoleAPICalled" && data.params.type === "error") errors.push(data.params.args.map((a) => a.description ?? a.value).join(" "));
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const callId = ++id;
    const timer = setTimeout(() => { pending.delete(callId); reject(new Error("Timed out: " + method)); }, 30000);
    pending.set(callId, { resolve, reject, timer });
    ws.send(JSON.stringify({ id: callId, method, params }));
  });
  const ev = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result?.value;
  };
  const until = async (expression, timeout = 30000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await ev(expression)) return;
      await sleep(150);
    }
    throw new Error("Condition did not become true: " + expression);
  };
  const S = "window.__store.getState()";
  const L = "window.__live";
  const ready = async () => {
    await until(`!!window.__store && !!${S}.analysis && !${S}.analyzing && !!window.__project`);
    check("analysis completes without calculation errors", await ev(`${S}.analysis.errors.length === 0`));
  };
  const go = async (query = "") => {
    await send("Page.navigate", { url: appURL + query });
    await ready();
  };
  const shot = async (name) => {
    const result = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(outDir, name + ".png"), Buffer.from(result.data, "base64"));
  };
  const mouse = (type, x, y, buttons = 0) => send("Input.dispatchMouseEvent", {
    type, x, y, button: type === "mouseMoved" ? "none" : "left", buttons, clickCount: type === "mouseMoved" ? 0 : 1,
  });
  const clickElement = async (expression) => {
    const point = await ev(`(() => { const el = ${expression}; if (!el) throw new Error("Control not found"); el.scrollIntoView({block:"center"}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await mouse("mouseMoved", point.x, point.y);
    await mouse("mousePressed", point.x, point.y, 1);
    await mouse("mouseReleased", point.x, point.y);
    await sleep(180);
  };
  const button = (text) => clickElement(`[...document.querySelectorAll("button")].find(b => b.textContent.trim() === ${JSON.stringify(text)})`);
  const title = (text) => clickElement(`document.querySelector('button[title="${text}"]')`);
  const input = (label, value, kind = "input") => ev(`(() => {
    const el = [...document.querySelectorAll("label")].find(l => l.textContent.trim().startsWith(${JSON.stringify(label)}))?.querySelector(${JSON.stringify(kind)});
    if (!el) throw new Error("Input not found");
    Object.getOwnPropertyDescriptor(${kind === "select" ? "HTMLSelectElement" : "HTMLInputElement"}.prototype, "value").set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event(${JSON.stringify(kind === "select" ? "change" : "input")}, {bubbles:true}));
  })()`);

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.setInterceptFileChooserDialog", { enabled: true });
  await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });
  await go();
  check("opens directly in Test with the demo ferry", await ev(`${S}.mode === "test" && ${S}.panel === "test" && ${S}.design.name === "Demo ferry 120 m" && ${S}.design.spaces.length === 115`));
  check("Test remains the only workspace tab", await ev('JSON.stringify([...document.querySelectorAll("header [role=tab]")].map(b => b.textContent.trim())) === JSON.stringify(["Test"])'));
  check("header shows model details and playback status", await ev(`document.querySelector("header").textContent.includes("Demo ferry 120 m") && document.querySelector("header").textContent.includes("LOA 120 m") && document.querySelector('[aria-label="Simulation status"]').textContent.includes("Running")`));
  await title("Light theme");
  check("header theme control switches to light", await ev('!document.documentElement.classList.contains("dark")'));
  await title("Dark theme");
  check("header theme control switches back to dark", await ev('document.documentElement.classList.contains("dark")'));
  check("Waves, Heel and three analysis tabs are available", await ev('JSON.stringify([...document.querySelectorAll("aside [role=tab]")].map(b => b.textContent.trim())) === JSON.stringify(["Waves","Heel","Hydrostatics","Stability","Performance"])'));
  const sidebarIsTestOnly = `JSON.stringify([...document.querySelectorAll('aside [role="tab"]')].map(b => b.textContent.trim())) === JSON.stringify(["Waves","Heel","Hydrostatics","Stability","Performance"]) && !/Score|COMPLIANCE|Worst first|Rule order/.test(document.body.textContent)`;
  check("legacy sidebar tabs, compliance summary and score counters are absent", await ev(sidebarIsTestOnly));
  check("editor menus, deck selector, AI fix and tour are absent", await ev(`!document.body.textContent.match(/Fix with AI|Switch to Design|Load demo|New empty|Pre-Check/) && !document.querySelector("[data-tour]") && ${S}.tourStep === null`));
  for (const [label, content] of [["Hydrostatics", "Hydrostatic curves"], ["Stability", "Righting lever curve GZ"], ["Performance", "Calm water resistance"]]) {
    await button(label);
    check(label + " displays calculated data and charts", await ev(`document.querySelector("aside").textContent.includes(${JSON.stringify(content)}) && document.querySelectorAll("aside svg polyline, aside svg path").length > 0 && !/NaN|Infinity/.test(document.querySelector("aside").textContent)`));
    await shot("test-" + label.toLowerCase());
  }
  await button("Waves");
  const templates = JSON.parse(fs.readFileSync("src/data/hullTemplates.json", "utf8"));
  check("demo ferry is the only production hull preset", JSON.stringify(Object.keys(templates)) === JSON.stringify(["cruise"]));
  await until(`${L}.t > 1.5 && ${L}.history.length > 8`);
  check("waves animate and produce a finite trace", await ev(`${L}.history.every(p=>Number.isFinite(p.a)&&Number.isFinite(p.b)) && Math.max(...${L}.history.map(p=>Math.abs(p.a))) > 0.1`));
  check("live buoyancy meter and trace are present", await ev(`!!document.querySelector('svg[aria-label="Buoyancy gauge"]') && document.querySelector("aside").textContent.includes("Buoyancy (MN)")`));
  check("buoyancy follows displaced-fluid weight and varies during waves", await ev(`Math.abs(${L}.buoyancyN-1025*9.81*${L}.submergedVolumeM3)<0.01 && Math.max(...${L}.history.map(p=>p.buoyancyN))-Math.min(...${L}.history.map(p=>p.buoyancyN))>1000`));
  await shot("test-waves");

  await title("Pause");
  await sleep(250);
  const paused = await ev(`${L}.t`);
  const pausedBuoyancy = await ev(`${L}.buoyancyN`);
  await sleep(450);
  check("pause freezes the simulation clock", await ev(`!${S}.test.running && ${L}.t === ${paused}`));
  check("header status reflects paused playback", await ev(`document.querySelector('[aria-label="Simulation status"]').textContent.includes("Paused")`));
  check("pause also freezes buoyancy", await ev(`${L}.buoyancyN === ${pausedBuoyancy}`));
  await title("Run");
  await until(`${L}.t > ${paused + 0.2}`);
  check("run resumes the animation", true);
  await button("4x");
  check("playback speed can be changed", await ev(`${S}.test.timeScale === 4`));
  await input("Preset", "1", "select");
  check("sea state selector updates wave settings", await ev(`${S}.test.waveAmp === 1 && ${S}.test.waveFreq === 0.75`));
  await input("Wave amplitude", "1.8");
  await input("Wave frequency", "1.6");
  await input("Wave heading", "0");
  await until(`document.querySelector("aside").textContent.includes("Motion estimates are unavailable")`);
  check("unsupported motion conditions are explained without a broken scene", await ev(`!document.querySelector('svg[aria-label="Buoyancy gauge"]') && Number.isFinite(${L}.t)`));
  await input("Wave frequency", "0.6");
  await input("Wave heading", "150");
  await until(`!!document.querySelector('svg[aria-label="Buoyancy gauge"]') && ${L}.buoyancyN > 0`);
  check("motion and buoyancy recover after valid conditions are restored", true);
  check("wave slider updates simulation settings", await ev(`${S}.test.waveAmp === 1.8`));

  await input("Wave amplitude", "0");
  await until(`${S}.test.waveAmp === 0 && Math.abs(${L}.heave)<1e-6`);
  check("calm-water buoyancy matches vessel displacement within integration tolerance", await ev(`Math.abs(${L}.buoyancyN/(${S}.analysis.condition.hydro.Vs*1025*9.81)-1)<0.01`));
  await input("Wave amplitude", "1.8");
  await button("Heel");
  await until(`${L}.heelDeg > 2 && Number.isFinite(${L}.gz)`);
  check("heel sweep produces angle and GZ", true);
  await clickElement('document.querySelector("input[type=checkbox]")');
  await input("Heel angle", "20");
  await until(`Math.abs(${L}.heelDeg - 20) < 0.01`);
  check("manual heel control changes the displayed angle", await ev(`!${S}.test.heelSweep && ${S}.test.heelDeg === 20`));
  check("heel gauge has a visible sector beyond the calculated range", await ev(`(()=>{const zones=document.querySelectorAll('svg[aria-label="Heel gauge"] path[data-zone-from]');const red=zones[zones.length-1];return +red.dataset.zoneTo > +red.dataset.zoneFrom && red.getTotalLength()>1;})()`));
  check("heel readout does not call the calculation endpoint a stability-loss angle", await ev('document.querySelector("aside").textContent.includes("Beyond calculated range") && document.querySelector("aside").textContent.includes("GZ evaluated to") && !document.querySelector("aside").textContent.includes("Stability lost beyond")'));
  await shot("test-heel");

  await button("Waves");
  await until(`${L}.history.length > 2 && ${L}.buoyancyN > 0`);
  check("returning to Waves resumes buoyancy calculation", await ev(`${L}.history.every(p=>Number.isFinite(p.buoyancyN))`));
  await title("Restart");
  await until(`${L}.t < 3`);
  check("restart resets the wave clock", true);

  await title("Pause");
  const designBefore = await ev(`JSON.stringify(${S}.design)`);
  for (const key of ["t", "1", "d", "w", "Delete", "ArrowUp", "?"]) {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key });
  }
  const area = await ev('(() => {const r=document.querySelector("canvas").getBoundingClientRect();return {x:r.x+r.width*.35,y:r.y+r.height*.5};})()');
  const projectedBefore = await ev("window.__project(0,0,0)");
  await mouse("mousePressed", area.x, area.y, 1);
  for (let i=1;i<=8;i++) {
    await mouse("mouseMoved", area.x+i*10, area.y+i*3, 1);
    await sleep(40);
  }
  await mouse("mouseReleased", area.x+80, area.y+24);
  await sleep(700);
  check("camera orbit remains interactive", await ev(`Math.abs(window.__project(0,0,0).x-${projectedBefore.x}) > 0.5`));
  await title("Reset camera");
  await until(`Math.abs(window.__project(0,0,0).x-${projectedBefore.x}) < 1`);
  check("header camera reset restores the default view", true);
  check("old shortcuts and pointer gestures cannot edit or leave Test", await ev(`${S}.mode === "test" && ${S}.panel === "test" && ${S}.selection === null && ${S}.tool.kind === "select" && ${S}.tourStep === null && JSON.stringify(${S}.design) === ${JSON.stringify(designBefore)}`));

  for (const [width,height,name] of [[1024,768,"tablet"],[390,844,"mobile"],[320,740,"narrow"]]) {
    await send("Emulation.setDeviceMetricsOverride", { width,height,deviceScaleFactor:1,mobile:false });
    await sleep(300);
    check(name + " layout fits and leaves controls scrollable", await ev('document.documentElement.scrollWidth <= innerWidth && (()=>{const a=document.querySelector("aside"),r=a.getBoundingClientRect(),v=document.querySelector("canvas").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight&&r.height>120&&v.height>=240&&a.scrollHeight>a.clientHeight;})()'));
    await button("Heel");
    check(name + " tabs remain usable", await ev(`${S}.test.kind === "heel"`));
    await button("Performance");
    check(name + " analysis tab fits and remains usable", await ev('document.querySelector("aside").textContent.includes("Calm water resistance") && document.documentElement.scrollWidth <= innerWidth'));
    await button("Heel");
    await shot("test-" + name);
    await button("Waves");
  }
  await send("Emulation.clearDeviceMetricsOverride");

  // Exercise the actual file input and production loaders, using generated local meshes.
  const points = [[0,-10,0],[100,-10,0],[100,10,0],[0,10,0],[0,-10,20],[100,-10,20],[100,10,20],[0,10,20]];
  const faces = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
  const stl = "solid ship\n" + faces.map(face => "facet normal 0 0 0\nouter loop\n" + face.map(i => "vertex " + points[i].join(" ")).join("\n") + "\nendloop\nendfacet").join("\n") + "\nendsolid ship";
  const stlPath = path.join(outDir, "import-ship.stl");
  const badPath = path.join(outDir, "empty.stl");
  const glbPath = path.join(outDir, "import-ship.glb");
  fs.writeFileSync(stlPath, stl);
  fs.writeFileSync(badPath, "solid empty\nendsolid empty");
  const vertexData = new Float32Array(faces.flatMap(face => face.flatMap(i => [points[i][0], points[i][2], -points[i][1]])));
  const binary = Buffer.from(vertexData.buffer);
  let json = JSON.stringify({ asset:{version:"2.0"}, scene:0, scenes:[{nodes:[0]}], nodes:[{mesh:0}], meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}], materials:[{alphaMode:"BLEND",doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[0.8,0.75,0.7,0.8],metallicFactor:0,roughnessFactor:0.7}}], accessors:[{bufferView:0,componentType:5126,count:vertexData.length/3,type:"VEC3",min:[0,0,-10],max:[100,20,10]}], bufferViews:[{buffer:0,byteLength:binary.length}], buffers:[{byteLength:binary.length}] });
  json = json.padEnd(Math.ceil(json.length/4)*4, " ");
  const glb = Buffer.alloc(12+8+json.length+8+binary.length);
  glb.writeUInt32LE(0x46546c67,0); glb.writeUInt32LE(2,4); glb.writeUInt32LE(glb.length,8);
  glb.writeUInt32LE(json.length,12); glb.writeUInt32LE(0x4e4f534a,16); glb.write(json,20);
  glb.writeUInt32LE(binary.length,20+json.length); glb.writeUInt32LE(0x004e4942,24+json.length); binary.copy(glb,28+json.length);
  fs.writeFileSync(glbPath, glb);
  const upload = async (file, packaged = false) => {
    const {root} = await send("DOM.getDocument");
    const {nodeId} = await send("DOM.querySelector", {nodeId:root.nodeId,selector:`input[aria-label="${packaged ? "Import ANSYS package" : "Import ship model"}"]`});
    await send("DOM.setFileInputFiles", {nodeId,files:Array.isArray(file) ? file : [file]});
  };
  const fileMenu = async () => { if (!await ev('document.querySelector("header details").open')) await clickElement('document.querySelector("header details summary")'); };
  const chooseProfile = async (id) => {
    await ev(`(()=>{const e=document.querySelector('select[aria-label="Ship profile"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set.call(e,${JSON.stringify(id)});e.dispatchEvent(new Event("change",{bubbles:true}));})()`);
    await sleep(150);
  };
  const seek = async time => {
    await ev(`(()=>{const e=document.querySelector('input[aria-label="Recording time"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,${time});e.dispatchEvent(new Event("input",{bubbles:true}));})()`);
    await until(`Math.abs(${L}.t-${time})<1e-8 && !${S}.test.running`);
  };
  await fileMenu();
  check("File menu offers STL and GLB import", await ev('document.querySelector("header details").open && document.querySelector(\'input[aria-label="Import ship model"]\').accept === ".stl,.glb"'));
  await upload(stlPath);
  await until(`${S}.refMesh?.name === "import-ship.stl" && !document.querySelector('input[type=file]').disabled`);
  const stlId = await ev(`${S}.activeProfileId`);
  check("STL creates an isolated profile without demo readings", await ev(`${S}.refMesh.visible && !${S}.test.running && document.querySelector('aside').textContent.includes("Results needed") && !Number.isFinite(${L}.buoyancyN) && !document.querySelector('footer').textContent.includes("4663")`));
  await input("Model up axis", "+Y", "select");
  await input("Model bow direction", "-X", "select");
  await input("Physical length", "100");
  await ev('document.querySelector("header details input[inputmode=decimal]").dispatchEvent(new FocusEvent("focusout", {bubbles:true}))');
  check("import orientation and length controls update the normalized model", await ev(`document.querySelector('header details select').value === "+Y" && [...document.querySelectorAll("header details select")][1].value === "-X" && Math.abs(${S}.refMesh.object.scale.x - 1)<1e-9`));
  await send("Input.dispatchKeyEvent", {type:"keyDown",key:"Escape"});
  await send("Input.dispatchKeyEvent", {type:"keyUp",key:"Escape"});
  check("Escape dismisses the File menu", await ev('!document.querySelector("header details").open'));
  await fileMenu();
  await upload(badPath);
  await until('!!document.querySelector("header details [role=alert]")');
  check("invalid mesh shows an error and preserves the loaded model", await ev(`${S}.refMesh.name === "import-ship.stl" && document.querySelector("header details [role=alert]").textContent.includes("valid 3D mesh")`));
  await upload(glbPath);
  await until(`${S}.refMesh?.name === "import-ship.glb" && !document.querySelector('input[type=file]').disabled`);
  check("GLB creates a second profile and uses its Y-up convention", await ev(`${S}.profiles.length === 2 && document.querySelector("header details select").value === "+Y"`));
  check("GLB material opacity is preserved", await ev(`(()=>{let ok=false;${S}.refMesh.object.traverse(o=>{if(o.isMesh)ok=o.material.transparent&&Math.abs(o.material.opacity-.8)<1e-9;});return ok;})()`));
  await clickElement('document.querySelector("header details input[type=checkbox]")');
  check("hiding an imported model does not reintroduce the demo", await ev(`!${S}.refMesh.visible && !!${S}.activeProfileId && document.querySelector('[aria-label="Calculation model"]').textContent.includes("Geometry only")`));
  await clickElement('document.querySelector("header details input[type=checkbox]")');

  const manifest = {version:1,name:"Judge ship A",mesh:{file:"import-ship.stl",lengthM:100,up:"+Z",bow:"+X"},coordinates:{frame:"ship-x-forward-y-port-z-up",rotationOrder:"ZYX",referencePointM:[50,0,6]},environment:{waterDensityKgM3:1025,gravityMps2:9.81,speedMps:4,waveAmplitudeM:1,wavePeriodS:8,waveHeadingDeg:180,wavePhaseRad:0},equilibrium:{draftM:5,massKg:130000,beamM:20,depthM:20,cgM:[50,0,6]},reports:[{file:"judge-motion.csv",time:{column:"time",unit:"s"},channels:{roll:{column:"roll",unit:"deg"},pitch:{column:"pitch",unit:"deg"},heave:{column:"heave",unit:"m"},bowAcceleration:{column:"acc",unit:"m/s2"}}},{file:"judge-force.out",time:{column:"flow-time",unit:"s"},channels:{buoyancy:{column:"buoyancyz",unit:"kN"}}}],forceDefinition:"Synthetic hydrostatic force for importer testing; not CFD."};
  const metaPath = path.join(outDir,"judge-a.json"), motionPath=path.join(outDir,"judge-motion.csv"), forcePath=path.join(outDir,"judge-force.out"), metaBPath=path.join(outDir,"judge-b.json"), motionBPath=path.join(outDir,"judge-b.csv");
  fs.writeFileSync(metaPath,JSON.stringify(manifest));
  fs.writeFileSync(motionPath,"time,roll,pitch,heave,acc\n0,0,0,0,0\n2,4,-2,.2,.4\n4,8,-4,.4,.8\n6,12,-6,.6,1.2");
  fs.writeFileSync(forcePath,'"buoyancyz-rfile"\n"Time Step" "buoyancyz etc.."\n("Time Step" "buoyancyz" "flow-time")\n0 1100 1\n1 1300 3\n2 1500 5');
  const manifestB = {...manifest,name:"Judge ship B",mesh:{file:"import-ship.glb",lengthM:80,up:"+Y",bow:"+X"},equilibrium:{draftM:3,massKg:80000},reports:[{file:"judge-b.csv",time:{column:"time",unit:"s"},channels:{heave:{column:"h",unit:"mm"}}}]};
  fs.writeFileSync(metaBPath,JSON.stringify(manifestB)); fs.writeFileSync(motionBPath,"time,h\n0,-1000\n4,0\n8,1000");
  await chooseProfile(stlId);
  await fileMenu(); await button("Attach / replace ANSYS results...");
  await upload([metaPath,motionPath,forcePath],true);
  await until(`${S}.profiles.find(p=>p.id===${S}.activeProfileId)?.recording && !document.querySelector('input[type=file]').disabled`);
  check("metadata and CSV/Fluent OUT attach to the matching mesh", await ev(`${S}.activeProfileId === ${JSON.stringify(stlId)} && ${S}.profiles.length===2 && document.querySelector('[aria-label="Calculation model"]').textContent.includes("ANSYS recording")`));
  await clickElement('document.querySelector("header details summary")');
  await seek(2.5);
  check("all meters interpolate the same timestamp with correct SI conversions", await ev(`${L}.rollDeg===5 && ${L}.pitchDeg===-2.5 && Math.abs(${L}.heave-.25)<1e-9 && Math.abs(${L}.vertAcc-.5)<1e-9 && ${L}.buoyancyN===1250000`));
  check("mesh pose uses recorded rotation order and measurement reference point", await ev(`(()=>{const p=${S}.refMesh.object.parent?.parent;return p.rotation.order==="ZYX" && Math.abs(p.rotation.x-5*Math.PI/180)<1e-9 && Math.abs(p.position.z-6.25)<1e-9;})()`));
  const importedPose = await ev(`JSON.stringify(${S}.refMesh.object.matrixWorld.elements)`);
  await sleep(300);
  check("pause freezes both imported readings and model pose", await ev(`${L}.t===2.5 && JSON.stringify(${S}.refMesh.object.matrixWorld.elements)===${JSON.stringify(importedPose)}`));
  await seek(0);
  check("channels outside their recorded span show unavailable", await ev('document.querySelector(\'[data-channel="buoyancy"]\').textContent.includes("Unavailable")'));
  await seek(5.98); await title("Run");
  await until(`${L}.t===6 && !${S}.test.running`);
  check("playback stops at the final sample without extrapolation", await ev(`!Number.isFinite(${L}.buoyancyN) && ${L}.heave===.6`));
  await clickElement('document.querySelector("aside input[type=checkbox]")');
  await title("Run"); await until(`${L}.t<5 && ${S}.test.running`);
  check("loop playback wraps within the recording", true);
  await seek(2.5);
  await button("Heel");
  check("Heel uses recorded roll without GZ or righting-moment estimates", await ev('document.querySelector("aside").textContent.includes("instantaneous heel") && !/Righting lever|Righting moment/.test(document.querySelector("aside").textContent)'));
  await button("Hydrostatics");
  check("imported hydrostatics shows this ship setup only", await ev('document.querySelector("aside").textContent.includes("130.00") && !document.querySelector("aside").textContent.includes("Floating condition (vessel.js)")'));
  await button("Performance");
  check("imported performance uses recording statistics", await ev('document.querySelector("aside").textContent.includes("Recorded response statistics") && !document.querySelector("aside").textContent.includes("Holtrop")'));
  await button("Waves");
  await shot("test-ansys-recording");
  await fileMenu(); await button("Import ANSYS package..."); await upload([metaBPath,glbPath,motionBPath],true);
  await until(`${S}.profiles.find(p=>p.id===${S}.activeProfileId)?.name === "Judge ship B"`);
  const bId = await ev(`${S}.activeProfileId`);
  await clickElement('document.querySelector("header details summary")');
  await seek(2);
  check("second ship has its own heave and missing channels stay unavailable", await ev(`Math.abs(${L}.heave+.5)<1e-9 && !Number.isFinite(${L}.rollDeg) && !Number.isFinite(${L}.buoyancyN) && document.querySelectorAll('[data-channel] svg').length===1`));
  await chooseProfile(stlId);
  await until(`${S}.activeProfileId===${JSON.stringify(stlId)} && Number.isFinite(${L}.buoyancyN)`);
  check("profile switching restores the first ship recording and position", await ev(`Math.abs(${L}.t-2.5)<1 && ${S}.profiles.find(p=>p.id===${S}.activeProfileId).manifest.mesh.lengthM===100`));
  await seek(2.5);
  const badMetaPath=path.join(outDir,"bad-setup.json");
  fs.writeFileSync(badMetaPath,JSON.stringify({...manifest,mesh:{...manifest.mesh,sha256:"0".repeat(64)}}));
  await fileMenu(); await button("Attach / replace ANSYS results..."); await upload([badMetaPath,motionPath,forcePath],true);
  await until('!!document.querySelector("header details [role=alert]")');
  check("mismatched mesh hashes leave the active profile unchanged", await ev(`${S}.activeProfileId===${JSON.stringify(stlId)} && document.querySelector("header details [role=alert]").textContent.includes("SHA-256")`));
  await button("Import ANSYS package...");
  await upload([metaPath,stlPath,motionPath,forcePath,metaBPath,glbPath,motionBPath],true);
  await until(`${S}.profiles.length===5 && !document.querySelector('input[type=file]').disabled`);
  check("multiple complete packages can be imported in one selection", await ev('!document.querySelector("header details [role=alert]")'));
  await send("Emulation.setDeviceMetricsOverride", {width:320,height:740,deviceScaleFactor:1,mobile:false});
  await sleep(250);
  check("File menu and imported-model header fit on a narrow display", await ev('document.documentElement.scrollWidth <= innerWidth && (()=>{const r=document.querySelector(\'[aria-label="File options"]\').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})()'));
  await shot("test-import-mobile");
  await button("Remove ship profile");
  check("removing a profile restores demo without deleting other ships", await ev(`${S}.activeProfileId === null && ${S}.refMesh === null && ${S}.profiles.length===4 && !document.querySelector('[aria-label="Calculation model"]')`));
  await send("Emulation.clearDeviceMetricsOverride");
  await chooseProfile(bId);
  await button("Waves");
  await send("Emulation.setDeviceMetricsOverride", {width:320,height:740,deviceScaleFactor:1,mobile:false});
  await sleep(250);
  check("recorded timeline and meters remain usable at 320 px", await ev('document.documentElement.scrollWidth<=innerWidth && !!document.querySelector(\'input[aria-label="Recording time"]\')'));
  await shot("test-ansys-mobile");
  await send("Emulation.clearDeviceMetricsOverride");
  await chooseProfile("demo");
  await button("Waves");

  await ev(`localStorage.setItem("ship-precheck-design-v1",JSON.stringify({... ${S}.design,name:"Old research ship",hull:{...${S}.design.hull,template:"research"}}))`);
  await go("?mode=design&panel=design&deck=D1&test=invalid&theme=invalid");
  check("legacy links and saved designs cannot reopen Design or another preset", await ev(`${S}.mode === "test" && ${S}.panel === "test" && ${S}.test.kind === "sea" && ${S}.design.name === "Demo ferry 120 m" && ${S}.design.hull.template === "cruise"`));
  for (const panel of ["issues", "inspect", "design", "damage", "evac", "guide", "sources"]) {
    await go("?panel=" + panel);
    check("removed " + panel + " sidebar link stays in Test", await ev(`${S}.panel === "test" && (${sidebarIsTestOnly})`));
  }
  for (const removed of ["flood", "evac"]) {
    await go("?test=" + removed);
    check("removed " + removed + " simulation link defaults to Waves", await ev(`${S}.test.kind === "sea" && (${sidebarIsTestOnly})`));
  }
  await go("?test=heel&theme=light");
  check("valid test and theme links still work", await ev(`${S}.test.kind === "heel" && document.documentElement.classList.contains("dark") === false`));
  await shot("test-light");

  await button("Download PDF report");
  const downloadStart = Date.now();
  const hasPDF = () => fs.readdirSync(downloadDir).some(f => f.endsWith(".pdf") && fs.statSync(path.join(downloadDir, f)).size > 20000);
  while (Date.now()-downloadStart<15000 && !hasPDF()) await sleep(200);
  check("PDF report downloads from the Test panel", hasPDF());
  check("no uncaught browser or console errors", errors.length===0, errors.join("; "));
}

main().catch(error => { console.error(error); process.exitCode=1; }).finally(() => {
  ws?.close();
  chrome.kill();
  console.log(`\n${passed} checks passed. Screenshots and PDF: ${outDir}`);
});
