import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as LocAR from "locar";

// Manejo seguro del export según la versión del bundle de LocAR
const App = LocAR.App || LocAR.default?.App || LocAR.default;

// COORDENADA OBJETIVO: a ~10 metros al norte de tu posición
const TARGET = {
  lat: -2.288423,
  lon: -78.116956,
  name: "LABORATORIO DE REDES"
};

const canvas = document.getElementById("cameraCanvas");
const startBtn = document.getElementById("startBtn");
const overlay = document.getElementById("overlay");
const gpsText = document.getElementById("gps");
const statusText = document.getElementById("status");

let app, locar;

// Función para crear la etiqueta flotante (Sprite 2D)
function createInfoLabel() {
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 1024;
  labelCanvas.height = 512;
  const ctx = labelCanvas.getContext("2d");

  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);

  ctx.strokeStyle = "#00FF00";
  ctx.lineWidth = 12;
  ctx.strokeRect(8, 8, labelCanvas.width - 16, labelCanvas.height - 16);

  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.font = "bold 72px Arial";
  ctx.fillText("ROUTER DE RED", labelCanvas.width / 2, 110);

  ctx.font = "52px Arial";
  ctx.fillText("IP: 192.168.1.1", labelCanvas.width / 2, 210);

  ctx.fillStyle = "#00FF00";
  ctx.fillText("Estado: ACTIVO", labelCanvas.width / 2, 300);

  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("24 puertos", labelCanvas.width / 2, 390);

  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(14, 7, 1);
  sprite.position.set(0, 2, 0);
  return sprite;
}

function makeBox(color, size = 6) {
  const geom = new THREE.BoxGeometry(size, size, size);
  const mat = new THREE.MeshBasicMaterial({ color });
  return new THREE.Mesh(geom, mat);
}

startBtn.addEventListener("click", async () => {
  startBtn.style.display = "none";
  overlay.style.display = "block";
  statusText.innerText = "Iniciando sensores y cámara...";

  try {
    app = new App({
      canvas,
      cameraOptions: {
        hFov: 80,
        near: 0.001,
        far: 1500
      }
    });

    locar = await app.start();

    // Luces seguras
    const activeScene = locar.scene || app.scene;
    if (activeScene) {
      const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
      activeScene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
      dirLight.position.set(0, 10, 5);
      activeScene.add(dirLight);
    }

    statusText.innerText = "Obteniendo GPS... Espera la primera señal.";

    let firstPosition = true;

    locar.startGps();

    locar.on("gpsupdate", async (ev) => {
      const coords = ev.position.coords;
      gpsText.innerHTML = `GPS: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}<br>Precisión: ${Math.round(coords.accuracy)} m`;

      if (firstPosition) {
        firstPosition = false;
        statusText.innerText = "GPS detectado. Cargando modelo 3D...";

        // 1. Cubos de calibración (~30m)
        const d = 0.0003;
        locar.add(makeBox(0xff0000, 4), coords.longitude, coords.latitude + d, 1); // Norte
        locar.add(makeBox(0xffff00, 4), coords.longitude, coords.latitude - d, 1); // Sur
        locar.add(makeBox(0x00ffff, 4), coords.longitude - d, coords.latitude, 1); // Oeste
        locar.add(makeBox(0x00ff00, 4), coords.longitude + d, coords.latitude, 1); // Este

        // 2. Cargar GLB + Etiqueta
        const loader = new GLTFLoader();
        loader.load(
          "/models/router.glb",
          (gltf) => {
            const router = gltf.scene;
            router.scale.set(6, 6, 6);

            const label = createInfoLabel();

            const routerGroup = new THREE.Group();
            routerGroup.add(router);
            routerGroup.add(label);

            locar.add(routerGroup, TARGET.lon, TARGET.lat, 1);

            statusText.innerText = "✅ Router colocado en escena. Gira en 360° para buscarlo.";
          },
          undefined,
          (err) => {
            console.error("Fallo al cargar router.glb:", err);
            const fallbackBox = makeBox(0xff00ff, 8);
            locar.add(fallbackBox, TARGET.lon, TARGET.lat, 1);
            statusText.innerText = "⚠️ router.glb no cargó (404). Se colocó cubo magenta.";
          }
        );
      }
    });

  } catch (err) {
    statusText.style.color = "#ff4444";
    statusText.innerText = "❌ ERROR: " + err.message;
    console.error(err);
  }
});
