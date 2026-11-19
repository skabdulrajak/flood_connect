import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Droplets,
  Info,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { EAST_GODAVARI_CENTER } from '../../utils/constants';

const CAMERA_PRESETS = {
  overview: {
    pos: new THREE.Vector3(38, 26, 44),
    target: new THREE.Vector3(0, 2, 0),
  },
  barrage: {
    pos: new THREE.Vector3(18, 12, 22),
    target: new THREE.Vector3(-4, 4, -8),
  },
  colony: {
    pos: new THREE.Vector3(28, 11, 16),
    target: new THREE.Vector3(16, 2.5, 6),
  },
  shelter: {
    pos: new THREE.Vector3(-22, 13, 24),
    target: new THREE.Vector3(-17, 5, 11),
  },
};

function detectSoftwareWebGL(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      const info = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
      if (/SwiftShader|llvmpipe|Software|Microsoft Basic Render|Warp/i.test(info)) {
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

function createConcreteTexture(maxAnisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c8ced4';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const shade = 180 + Math.floor(Math.random() * 35);
    ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 4})`;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.strokeStyle = 'rgba(70,80,92,0.18)';
  ctx.lineWidth = 2;
  for (let y = 32; y < 256; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createTerrainTexture(maxAnisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#5a7852');
  grad.addColorStop(0.5, '#688259');
  grad.addColorStop(1, '#7c7b5c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(65,95,55,0.22)' : 'rgba(130,115,82,0.22)';
    ctx.fillRect(x, y, 3, 3);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createRoadTexture(maxAnisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#e2e8f0';
  for (let x = 8; x < 256; x += 40) {
    ctx.fillRect(x, 30, 22, 4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(6, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function buildDowleswaramBarrage(concreteTex, roadTex) {
  const group = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({
    map: concreteTex,
    roughness: 0.82,
    metalness: 0.06,
  });
  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a5f,
    roughness: 0.45,
    metalness: 0.65,
  });
  const gateSteelMat = new THREE.MeshStandardMaterial({
    color: 0x13a89e,
    roughness: 0.38,
    metalness: 0.55,
  });
  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex,
    roughness: 0.85,
    metalness: 0.05,
  });

  // 7 reinforced concrete piers with cutwater noses
  const pierCount = 7;
  const span = 5.4;
  const startX = -((pierCount - 1) * span) / 2;
  const sluiceGates = [];

  for (let i = 0; i < pierCount; i += 1) {
    const px = startX + i * span;
    const pier = new THREE.Mesh(new THREE.BoxGeometry(1.35, 8.2, 4.4), concreteMat);
    pier.position.set(px, 2.2, 0);
    pier.castShadow = true;
    pier.receiveShadow = true;
    group.add(pier);

    // Cutwater nose (upstream prism)
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.72, 7.6, 6), concreteMat);
    nose.position.set(px, 2.0, -2.2);
    nose.castShadow = true;
    group.add(nose);

    // Overhead hoist tower block
    const hoist = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.0, 2.2), concreteMat);
    hoist.position.set(px, 7.3, 0);
    hoist.castShadow = true;
    group.add(hoist);

    // Lamp post on pier
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6), darkSteelMat);
    post.position.set(px, 8.6, 1.4);
    group.add(post);

    // Sluice gate between pier i and i+1
    if (i < pierCount - 1) {
      const gate = new THREE.Mesh(new THREE.BoxGeometry(span - 1.35, 3.8, 0.35), gateSteelMat);
      gate.position.set(px + span / 2, 2.1, -0.35);
      gate.castShadow = true;
      group.add(gate);
      sluiceGates.push(gate);

      // Hoist beam across span
      const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 0.45, 0.55), darkSteelMat);
      beam.position.set(px + span / 2, 8.0, 0);
      group.add(beam);
    }
  }

  // Barrage roadway deck
  const deckWidth = (pierCount - 1) * span + 10;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(deckWidth, 0.65, 4.0), roadMat);
  deck.position.set(0, 6.25, 0.25);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  // Guardrails
  const railGeo = new THREE.BoxGeometry(deckWidth, 0.45, 0.16);
  const railFront = new THREE.Mesh(railGeo, darkSteelMat);
  railFront.position.set(0, 6.75, 2.15);
  const railBack = new THREE.Mesh(railGeo, darkSteelMat);
  railBack.position.set(0, 6.75, -1.65);
  group.add(railFront, railBack);

  group.position.set(0, 0, -10);
  return { group, sluiceGates };
}

function buildReliefShelter(concreteTex) {
  const group = new THREE.Group();
  const plinthMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.85 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.72 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x13a89e, roughness: 0.45, metalness: 0.15 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x0b2545, roughness: 0.52, metalness: 0.28 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x26466d, roughness: 0.18, metalness: 0.6 });

  // Elevated flood-resilient concrete plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(10.5, 2.4, 7.6), plinthMat);
  plinth.position.set(0, 1.2, 0);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // Main civic shelter hall
  const hall = new THREE.Mesh(new THREE.BoxGeometry(9.2, 3.6, 6.2), wallMat);
  hall.position.set(0, 4.2, 0);
  hall.castShadow = true;
  hall.receiveShadow = true;
  group.add(hall);

  // Teal civic identification band
  const band = new THREE.Mesh(new THREE.BoxGeometry(9.35, 0.55, 6.35), accentMat);
  band.position.set(0, 5.7, 0);
  group.add(band);

  // Pitched roof canopy
  const roof = new THREE.Mesh(new THREE.BoxGeometry(9.9, 0.55, 6.9), roofMat);
  roof.position.set(0, 6.25, 0);
  roof.castShadow = true;
  group.add(roof);

  // Rooftop solar panel array (2 panels)
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.22, metalness: 0.55 });
  for (const offset of [-2.2, 2.2]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.8), solarMat);
    panel.position.set(offset, 6.75, -0.5);
    panel.rotation.x = 0.22;
    group.add(panel);
  }

  // Front windows
  for (const wx of [-2.6, 0, 2.6]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 0.12), glassMat);
    win.position.set(wx, 4.2, 3.12);
    group.add(win);
  }

  // Accessibility ramp
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 4.2), plinthMat);
  ramp.position.set(0, 1.15, 5.1);
  ramp.rotation.x = 0.45;
  group.add(ramp);

  group.position.set(-19, 3.2, 11);
  return group;
}

function buildResidentialCluster(concreteTex) {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.86 });
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.4 });
  const wallColors = [0xe8dfd1, 0xdbe4ea, 0xe9d8c8, 0xd6e2dc];
  const roofColors = [0x9a4e0a, 0x7c3f2c, 0x475569, 0x854d0e];

  const homes = [
    { x: 14, y: 1.5, z: 3, w: 4.2, h: 3.1, d: 3.6, rot: 0.08 },
    { x: 20.5, y: 1.65, z: 1.5, w: 3.8, h: 2.8, d: 3.4, rot: -0.06 },
    { x: 16.5, y: 1.35, z: 9.2, w: 4.6, h: 3.3, d: 3.8, rot: 0.12 },
    { x: 23, y: 1.85, z: 8.5, w: 4.0, h: 3.0, d: 3.5, rot: -0.05 },
    { x: 13.5, y: 1.25, z: 15.2, w: 3.9, h: 2.7, d: 3.2, rot: 0.04 },
    { x: 20, y: 2.0, z: 15.6, w: 4.4, h: 3.6, d: 3.8, rot: -0.08 },
  ];

  homes.forEach((h, idx) => {
    const house = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({
      color: wallColors[idx % wallColors.length],
      roughness: 0.78,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: roofColors[idx % roofColors.length],
      roughness: 0.65,
    });

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(h.w + 0.4, 0.7, h.d + 0.4), baseMat);
    plinth.position.y = 0.35;
    plinth.receiveShadow = true;
    house.add(plinth);

    const body = new THREE.Mesh(new THREE.BoxGeometry(h.w, h.h, h.d), wallMat);
    body.position.y = 0.7 + h.h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    house.add(body);

    // Parapet roof slab + stairwell hood (typical Andhra Pradesh terrace roofs for flood refuge)
    const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(h.w + 0.35, 0.28, h.d + 0.35), roofMat);
    roofSlab.position.y = 0.7 + h.h + 0.14;
    roofSlab.castShadow = true;
    house.add(roofSlab);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(h.w * 0.34, 0.9, h.d * 0.34), wallMat);
    hood.position.set(-h.w * 0.2, 0.7 + h.h + 0.65, -h.d * 0.15);
    hood.castShadow = true;
    house.add(hood);

    // Windows
    const win1 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.8, 0.12), windowMat);
    win1.position.set(-h.w * 0.24, 0.7 + h.h * 0.55, h.d / 2 + 0.04);
    const win2 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.8, 0.12), windowMat);
    win2.position.set(h.w * 0.24, 0.7 + h.h * 0.55, h.d / 2 + 0.04);
    house.add(win1, win2);

    house.position.set(h.x, h.y, h.z);
    house.rotation.y = h.rot;
    group.add(house);
  });

  return group;
}

function buildRescueBoat() {
  const boat = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x0b2545, roughness: 0.42, metalness: 0.25 });
  const pontoonMat = new THREE.MeshStandardMaterial({ color: 0xf28c28, roughness: 0.48, metalness: 0.08 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.15, metalness: 0.6 });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0x991b1b,
    emissiveIntensity: 0.7,
    roughness: 0.2,
  });

  // Main deck hull
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 5.0), hullMat);
  hull.position.y = 0.25;
  hull.castShadow = true;
  boat.add(hull);

  // Port & Starboard inflatable orange rescue pontoons
  const tubeGeo = new THREE.CylinderGeometry(0.38, 0.38, 5.2, 10);
  tubeGeo.rotateX(Math.PI / 2);
  const leftTube = new THREE.Mesh(tubeGeo, pontoonMat);
  leftTube.position.set(-1.12, 0.42, 0);
  leftTube.castShadow = true;
  const rightTube = new THREE.Mesh(tubeGeo, pontoonMat);
  rightTube.position.set(1.12, 0.42, 0);
  rightTube.castShadow = true;
  boat.add(leftTube, rightTube);

  // Bow nose cone
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 2.2, 10), pontoonMat);
  bow.rotation.z = Math.PI / 2;
  bow.position.set(0, 0.48, 2.55);
  boat.add(bow);

  // Console cabin + windshield
  const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 1.35), cabinMat);
  consoleBox.position.set(0, 1.05, 0.2);
  consoleBox.castShadow = true;
  boat.add(consoleBox);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.55, 0.12), glassMat);
  windshield.position.set(0, 1.35, 0.9);
  windshield.rotation.x = -0.25;
  boat.add(windshield);

  // Static beacon light on console roof
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.25, 8), beaconMat);
  beacon.position.set(0, 1.75, 0.2);
  boat.add(beacon);

  // Outboard motor housing
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.85, 0.65), hullMat);
  motor.position.set(0, 0.55, -2.7);
  boat.add(motor);

  return boat;
}

function buildInstancedTrees() {
  const treeCoords = [
    [-26, 4.2, -4], [-28, 4.4, 2], [-25, 4.0, 18], [-22, 4.1, 22], [-14, 3.6, 20],
    [-27, 4.5, -18], [-20, 3.9, -20], [26, 3.2, -16], [28, 3.5, -8], [29, 3.2, 4],
    [27, 3.1, 14], [25, 3.4, 21], [17, 2.3, 22], [-12, 3.2, -19], [16, 2.6, -21],
  ];
  const group = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 3.2, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.9 });
  const canopyGeo = new THREE.DodecahedronGeometry(1.55, 0);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2f6b3f, roughness: 0.82 });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCoords.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCoords.length);
  trunks.castShadow = true;
  canopies.castShadow = true;

  const dummy = new THREE.Object3D();
  treeCoords.forEach(([x, y, z], i) => {
    const scale = 0.85 + (i % 4) * 0.14;
    dummy.position.set(x, y + 1.4 * scale, z);
    dummy.scale.set(scale, scale, scale);
    dummy.rotation.set(0, i * 0.7, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, y + 3.2 * scale, z);
    dummy.scale.set(scale * 1.15, scale * 0.95, scale * 1.15);
    dummy.updateMatrix();
    canopies.setMatrixAt(i, dummy.matrix);
  });

  group.add(trunks, canopies);
  return group;
}

export function GodavariFloodScene3D({ incidents = [] }) {
  const { t } = useTranslation();
  const mountRef = useRef(null);
  const waterStageRef = useRef(13.8); // meters (Dowleswaram warning stage ~13.75m, danger ~17.75m)
  const cameraGoalRef = useRef(null);

  const [waterStageMeters, setWaterStageMeters] = useState(13.8);
  const [activePreset, setActivePreset] = useState('overview');
  const [dockOpen, setDockOpen] = useState(true);

  useEffect(() => {
    waterStageRef.current = waterStageMeters;
  }, [waterStageMeters]);

  const jumpToPreset = (key) => {
    setActivePreset(key);
    const p = CAMERA_PRESETS[key];
    if (p) {
      cameraGoalRef.current = {
        pos: p.pos.clone(),
        target: p.target.clone(),
      };
    }
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return undefined;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 540;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xc9d9e6);
    scene.fog = new THREE.FogExp2(0xc9d9e6, 0.0082);

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.5, 280);
    camera.position.copy(CAMERA_PRESETS.overview.pos);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    const isSoftwareGl = detectSoftwareWebGL(renderer);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.62;
    pmrem.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.475;
    controls.minDistance = 12;
    controls.maxDistance = 92;
    controls.target.copy(CAMERA_PRESETS.overview.target);
    controls.addEventListener('start', () => {
      cameraGoalRef.current = null;
    });

    // Lighting: Warm monsoon sun key + cool sky/ground hemisphere
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x4b5c49, 0.72);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.9);
    sunLight.position.set(36, 48, 28);
    sunLight.castShadow = true;
    const shadowRes = isSoftwareGl ? 1024 : 2048;
    sunLight.shadow.mapSize.set(shadowRes, shadowRes);
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 140;
    sunLight.shadow.camera.left = -46;
    sunLight.shadow.camera.right = 46;
    sunLight.shadow.camera.top = 46;
    sunLight.shadow.camera.bottom = -46;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const concreteTex = createConcreteTexture(maxAnisotropy);
    const terrainTex = createTerrainTexture(maxAnisotropy);
    const roadTex = createRoadTexture(maxAnisotropy);

    // Sculpted East Godavari River Basin Terrain (channel in center, elevated west shelter bank, low-lying east residential terrace)
    const terrainGeo = new THREE.PlaneGeometry(110, 100, 64, 64);
    terrainGeo.rotateX(-Math.PI / 2);
    const tPos = terrainGeo.attributes.position;
    for (let i = 0; i < tPos.count; i += 1) {
      const x = tPos.getX(i);
      const z = tPos.getZ(i);
      // Curved river channel meandering gently through x = 0
      const channelCenter = Math.sin(z * 0.045) * 3.5;
      const distFromChannel = Math.abs(x - channelCenter);
      let y = -2.2;
      if (distFromChannel > 10.5) {
        const bankRise = Math.min(1, (distFromChannel - 10.5) / 8.5);
        if (x < channelCenter) {
          // West bank: higher relief shelter terrace
          y = -2.2 + bankRise * 5.8 + Math.sin(x * 0.12 + z * 0.08) * 0.35;
        } else {
          // East bank: low-lying floodplain residential colony
          y = -2.2 + bankRise * 3.45 + Math.cos(x * 0.1 + z * 0.1) * 0.28;
        }
      } else {
        // Riverbed profile
        y = -2.6 + (distFromChannel / 10.5) * 0.55;
      }
      tPos.setY(i, y);
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      map: terrainTex,
      roughness: 0.92,
      metalness: 0.02,
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    scene.add(terrain);

    // Composite Structures
    const { group: barrageGroup, sluiceGates } = buildDowleswaramBarrage(concreteTex, roadTex);
    scene.add(barrageGroup);

    const shelterGroup = buildReliefShelter(concreteTex);
    scene.add(shelterGroup);

    const residentialGroup = buildResidentialCluster(concreteTex);
    scene.add(residentialGroup);

    const treesGroup = buildInstancedTrees();
    scene.add(treesGroup);

    const rescueBoat = buildRescueBoat();
    scene.add(rescueBoat);

    // Animated Godavari Floodwater Plane (pre-allocated base coordinates, zero per-frame allocs)
    const waterSegs = isSoftwareGl ? 36 : 56;
    const waterGeo = new THREE.PlaneGeometry(108, 98, waterSegs, waterSegs);
    waterGeo.rotateX(-Math.PI / 2);
    const wPos = waterGeo.attributes.position;
    const baseXZ = new Float32Array(wPos.count * 2);
    for (let i = 0; i < wPos.count; i += 1) {
      baseXZ[i * 2] = wPos.getX(i);
      baseXZ[i * 2 + 1] = wPos.getZ(i);
    }

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e6078,
      roughness: 0.16,
      metalness: 0.08,
      transparent: true,
      opacity: 0.88,
      clearcoat: 0.65,
      clearcoatRoughness: 0.18,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.receiveShadow = true;
    scene.add(waterMesh);

    // Live Incident Beacons projected from real FloodConnect records
    const beaconGroup = new THREE.Group();
    const severityHex = {
      critical: 0xdc2626,
      high: 0xf28c28,
      medium: 0xd97706,
      low: 0x13a89e,
    };

    const visibleIncidents = (incidents || []).slice(0, 12);
    visibleIncidents.forEach((inc, idx) => {
      const lat = Number(inc.latitude);
      const lng = Number(inc.longitude);
      const dx = Number.isFinite(lng) ? (lng - EAST_GODAVARI_CENTER.lng) * 140 : (idx % 4) * 5 - 7;
      const dz = Number.isFinite(lat) ? -(lat - EAST_GODAVARI_CENTER.lat) * 140 : Math.floor(idx / 4) * 8 - 6;
      const clampedX = Math.max(-26, Math.min(26, dx));
      const clampedZ = Math.max(-24, Math.min(24, dz));

      const sev = inc.reviewed_priority || inc.severity || 'medium';
      const color = severityHex[sev] || severityHex.medium;

      const pylon = new THREE.Group();
      const beamMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.72,
        roughness: 0.3,
      });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.32, 6.2, 8), beamMat);
      shaft.position.y = 4.6;
      const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), beamMat);
      cap.position.y = 8.1;
      pylon.add(shaft, cap);
      pylon.position.set(clampedX, 0.5, clampedZ);
      beaconGroup.add(pylon);
    });
    scene.add(beaconGroup);

    // Pre-allocated animation scratch variables
    let disposed = false;
    let rafId = 0;
    let timeoutId = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    const waterColorLow = new THREE.Color(0x137a8b);
    const waterColorHigh = new THREE.Color(0x524634); // Silt-heavy Godavari monsoon spate
    const scratchColor = new THREE.Color();

    const scheduleNext = (fn) => {
      if (disposed) return;
      if (isSoftwareGl) {
        timeoutId = window.setTimeout(fn, 24);
      } else {
        rafId = window.requestAnimationFrame(fn);
      }
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      elapsed += dt;

      // Map Dowleswaram stage (10.0m normal -> 19.5m extreme flood) to scene Y (-0.4 -> +3.1)
      const stage = waterStageRef.current;
      const stageNorm = Math.max(0, Math.min(1, (stage - 10.0) / 9.5));
      const baseWaterY = -0.45 + stageNorm * 3.55;

      // Silt color shift as floodwaters rise
      scratchColor.copy(waterColorLow).lerp(waterColorHigh, stageNorm * 0.75);
      waterMat.color.copy(scratchColor);

      // Smooth wave displacement along river flow (+Z downstream)
      const waveAmp = 0.08 + stageNorm * 0.14;
      for (let i = 0; i < wPos.count; i += 1) {
        const bx = baseXZ[i * 2];
        const bz = baseXZ[i * 2 + 1];
        const wy =
          baseWaterY +
          Math.sin(bx * 0.22 + elapsed * 1.4) * waveAmp +
          Math.cos(bz * 0.18 - elapsed * 2.1) * (waveAmp * 0.85);
        wPos.setY(i, wy);
      }
      wPos.needsUpdate = true;

      // Lift barrage sluice gates proportionally to flood stage
      const gateLift = 1.6 + stageNorm * 2.7;
      for (let i = 0; i < sluiceGates.length; i += 1) {
        sluiceGates[i].position.y = gateLift;
      }

      // Patrol rescue boat gently along the flooded channel & colony edge
      const boatAngle = elapsed * 0.26;
      const boatX = 4.2 + Math.sin(boatAngle) * 5.2;
      const boatZ = 8.0 + Math.cos(boatAngle) * 9.5;
      const nextX = 4.2 + Math.sin(boatAngle + 0.05) * 5.2;
      const nextZ = 8.0 + Math.cos(boatAngle + 0.05) * 9.5;
      rescueBoat.position.set(
        boatX,
        baseWaterY - 0.06 + Math.sin(elapsed * 2.4) * 0.06,
        boatZ
      );
      rescueBoat.rotation.y = Math.atan2(nextX - boatX, nextZ - boatZ);
      rescueBoat.rotation.z = Math.sin(elapsed * 2.1) * 0.04;
      rescueBoat.rotation.x = Math.cos(elapsed * 1.8) * 0.03;

      // Gentle camera preset exponential damping
      if (cameraGoalRef.current) {
        const alpha = 1 - Math.exp(-5.5 * dt);
        camera.position.lerp(cameraGoalRef.current.pos, alpha);
        controls.target.lerp(cameraGoalRef.current.target, alpha);
        if (camera.position.distanceTo(cameraGoalRef.current.pos) < 0.12) {
          cameraGoalRef.current = null;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      scheduleNext(tick);
    };

    const handleResize = () => {
      if (!container || disposed) return;
      const nextW = container.clientWidth || 800;
      const nextH = container.clientHeight || 540;
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
      renderer.setSize(nextW, nextH);
    };

    window.addEventListener('resize', handleResize);
    scheduleNext(tick);

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      controls.dispose();
      concreteTex.dispose();
      terrainTex.dispose();
      roadTex.dispose();
      envTex.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [incidents]);

  const alertLevel =
    waterStageMeters >= 17.75
      ? { label: t('basin3d.stageDanger', { defaultValue: 'Danger Level (3rd Warning)' }), color: 'text-red-300' }
      : waterStageMeters >= 15.0
      ? { label: t('basin3d.stageWarning2', { defaultValue: '2nd Flood Warning' }), color: 'text-amber-300' }
      : waterStageMeters >= 13.75
      ? { label: t('basin3d.stageWarning1', { defaultValue: '1st Flood Warning' }), color: 'text-yellow-200' }
      : { label: t('basin3d.stageNormal', { defaultValue: 'Normal Monsoon Flow' }), color: 'text-emerald-300' };

  const sluiceOpeningPct = Math.round(Math.max(5, Math.min(100, ((waterStageMeters - 10) / 9.5) * 100)));

  return (
    <div className="relative h-[calc(100vh-10.5rem)] min-h-[520px] w-full overflow-hidden rounded-xl border border-slate-300 bg-[#0B2545]">
      {/* Full-Bleed Three.js Canvas */}
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      {/* Top-Left Compact Simulation Badge (Opaque, no backdrop-filter over WebGL) */}
      <div className="pointer-events-none absolute left-4 top-4 max-w-sm rounded-lg border border-white/15 bg-[#0B2545]/92 px-3.5 py-2.5 text-white shadow-md">
        <p className="text-xs font-bold uppercase tracking-wider text-[#13A89E]">
          {t('basin3d.badgeTitle', { defaultValue: 'Dowleswaram Barrage · 3D Flood Basin Model' })}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-200">
          {t('basin3d.simulationNotice', {
            defaultValue:
              'Interactive hydrological visualization with live FloodConnect incident pylons. Water stage slider is a simulation control, not a live CWC sensor feed.',
          })}
        </p>
      </div>

      {/* Collapsible Bottom Control Dock (<= 15% viewport, solid dark surface, zero backdrop-filter) */}
      <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-white/15 bg-[#0B2545]/95 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Droplets className="h-4 w-4 text-[#13A89E]" aria-hidden="true" />
              <span className="font-mono tabular-nums">{waterStageMeters.toFixed(2)} m</span>
            </span>
            <span className={`font-semibold ${alertLevel.color}`}>{alertLevel.label}</span>
            <span className="hidden sm:inline text-slate-300 font-mono tabular-nums">
              {t('basin3d.sluiceOpening', { defaultValue: 'Sluice Gates' })}: {sluiceOpeningPct}%
            </span>
            <span className="hidden md:inline text-slate-300 font-mono tabular-nums">
              {t('basin3d.projectedIncidents', { defaultValue: 'Projected Incidents' })}:{' '}
              {Math.min(12, incidents.length)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setDockOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20 transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{dockOpen ? t('common.hide', { defaultValue: 'Hide' }) : t('basin3d.controls', { defaultValue: 'Controls' })}</span>
            {dockOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>

        {dockOpen ? (
          <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Water Level Simulation Slider */}
            <div className="flex flex-1 max-w-md items-center gap-3">
              <label htmlFor="water-stage-slider" className="text-xs font-medium text-slate-200 whitespace-nowrap">
                {t('basin3d.riverStageLabel', { defaultValue: 'Simulated Stage' })}:
              </label>
              <input
                id="water-stage-slider"
                type="range"
                min={10.5}
                max={19.2}
                step={0.1}
                value={waterStageMeters}
                onChange={(e) => setWaterStageMeters(Number(e.target.value))}
                className="w-full accent-[#13A89E]"
              />
            </div>

            {/* Camera Viewpoint Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-slate-400 mr-1" aria-hidden="true" />
              {[
                { key: 'overview', label: t('basin3d.presetOverview', { defaultValue: 'Basin Overview' }) },
                { key: 'barrage', label: t('basin3d.presetBarrage', { defaultValue: 'Dowleswaram Barrage' }) },
                { key: 'colony', label: t('basin3d.presetColony', { defaultValue: 'Low-Lying Colony' }) },
                { key: 'shelter', label: t('basin3d.presetShelter', { defaultValue: 'Relief Shelter' }) },
              ].map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => jumpToPreset(preset.key)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    activePreset === preset.key
                      ? 'bg-[#13A89E] text-white'
                      : 'bg-white/10 text-slate-200 hover:bg-white/20'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setWaterStageMeters(13.8);
                  jumpToPreset('overview');
                }}
                title={t('common.reset')}
                className="inline-flex items-center gap-1 rounded border border-white/20 px-2 py-1 text-xs text-slate-200 hover:bg-white/15"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
