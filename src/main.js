import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as LocAR from "locar";

// Manejo seguro del export según la versión del bundle de LocAR
const App = LocAR.App || LocAR.default?.App || LocAR.default;

// ==========================================
// 1. COORDENADA OBJETIVO (Donde aparecerá el Router)
// ==========================================
const TARGET = {
  lat: -2.288417,
  lon: -78.116955,
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

  // Fondo semitransparente
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);

  // Borde verde
  ctx.strokeStyle = "#00FF00";
  ctx.lineWidth = 12;
  ctx.strokeRect(8, 8, labelCanvas.width - 16, labelCanvas.height - 16);

  // Texto
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
  sprite.position.set(0, 8, 0); // Altura sobre el router
  return sprite;
}

// Función auxiliar para cubos de calibración cardinal
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
    // 1. Agregar luces para que el modelo 3D no se vea negro
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
    locar.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(0, 20, 10);
    locar.scene.add(dirLight);
    statusText.innerText = "Obteniendo GPS... Espera la primera lectura.";

    let firstPosition = true;

    locar.startGps();

    locar.on("gpsupdate", async (ev) => {
      const coords = ev.position.coords;
      gpsText.innerHTML = `GPS: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}<br>Precisión: ${Math.round(coords.accuracy)} m`;

      if (firstPosition) {
        firstPosition = false;
        statusText.innerText = "GPS recibido. Cargando modelos...";

        // 1. Cubos de calibración cardinal (~30 metros alrededor)
        const d = 0.0003;
        locar.add(makeBox(0xff0000, 4), coords.longitude, coords.latitude + d, 2); // Norte (Rojo)
        locar.add(makeBox(0xffff00, 4), coords.longitude, coords.latitude - d, 2); // Sur (Amarillo)
        locar.add(makeBox(0x00ffff, 4), coords.longitude - d, coords.latitude, 2); // Oeste (Celeste)
        locar.add(makeBox(0x00ff00, 4), coords.longitude + d, coords.latitude, 2); // Este (Verde)

        // 2. Cargar el Router GLB + Etiqueta
        const loader = new GLTFLoader();
        loader.load(
          "/models/router.glb",
          (gltf) => {
            const router = gltf.scene;
            router.scale.set(5, 5, 5);

            const label = createInfoLabel();

            const routerGroup = new THREE.Group();
            routerGroup.add(router);
            routerGroup.add(label);

            // Se coloca en la coordenada objetivo
            locar.add(routerGroup, TARGET.lon, TARGET.lat, 5);

            statusText.innerText = "Router agregado. Gira lentamente hacia la ubicación objetivo.";
          },
          undefined,
          (err) => {
            console.error("Error al cargar router.glb, mostrando respaldo:", err);
            const fallbackBox = makeBox(0xff00ff, 8);
            locar.add(fallbackBox, TARGET.lon, TARGET.lat, 5);
            statusText.innerText = "Router.glb no encontrado. Mostrando caja magenta de respaldo.";
          }
        );
      }
    });

  } catch (err) {
    statusText.innerText = "Error: " + err.message;
    console.error(err);
  }
});
