import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
const API_URL_ISS = "https://api.wheretheiss.at/v1/satellites/25544";
const vertexShader = `
 varying vec2 vUv;
 varying vec3 vNormal;
 varying vec3 vWorldPosition;
 void main() {
 vUv = uv;
 vNormal = normalize(normalMatrix * normal);
 vec4 worldPosition = modelMatrix * vec4(position, 1.0);
 vWorldPosition = worldPosition.xyz;
 gl_Position = projectionMatrix * viewMatrix * worldPosition;
 }
`;
const fragmentShader = `
 uniform sampler2D dayTexture;
 uniform sampler2D nightTexture;
 uniform vec3 sunDirection;
 varying vec2 vUv;
 varying vec3 vNormal;
 varying vec3 vWorldPosition;
 void main() {
 vec3 dayColor = texture2D(dayTexture, vUv).rgb;
 vec3 nightColor = texture2D(nightTexture, vUv).rgb;
 vec3 worldNormal = normalize(vNormal);
 float lightIntensity = max(0.0, dot(worldNormal, sunDirection));
 float dayNightMix = smoothstep(-0.05, 0.15, lightIntensity);
 vec3 finalColor = mix(nightColor, dayColor, dayNightMix);
 gl_FragColor = vec4(finalColor, 1.0);
 }
`;
const createIssModel = () => {
  const issGroup = new THREE.Group();
  const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc });
  const panelMaterial = new THREE.MeshBasicMaterial({
    color: 0x003366,
    side: THREE.DoubleSide,
  });
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.4),
    bodyMaterial
  );
  issGroup.add(body);
  const panel1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.2, 0.01),
    panelMaterial
  );
  panel1.position.x = 0.5;
  issGroup.add(panel1);
  const panel2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.2, 0.01),
    panelMaterial
  );
  panel2.position.x = -0.5;
  issGroup.add(panel2);
  issGroup.scale.set(0.2, 0.2, 0.2);
  return issGroup;
};
const DataItem = ({ label, value }) => (
  <div className="data-item">
    <span className="data-label">{label}:</span>{" "}
    <span className="data-value">{value}</span>{" "}
  </div>
);
export default function ISSTracker() {
  const [issData, setIssData] = useState(null);
  const [error, setError] = useState(null);
  const mountRef = useRef(null);
  const issMeshRef = useRef(null);
  const orbitLineRef = useRef(null);
  const groundTrackLineRef = useRef(null);
  const rendererRef = useRef(null);
  const earthMaterialRef = useRef(null);
  const sunLightRef = useRef(null);
  const animationIdRef = useRef();
  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020916);
    const camera = new THREE.PerspectiveCamera(
      75,
      currentMount.clientWidth / currentMount.clientHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sunLight = new THREE.PointLight(0xffffff, 1.5, 100);
    sunLightRef.current = sunLight;
    scene.add(sunLight);
    const earthGeometry = new THREE.SphereGeometry(2, 64, 64);
    const textureLoader = new THREE.TextureLoader(); // Load textures from public folder or network path
    const dayTex = textureLoader.load(
      "https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg"
    );
    const nightTex = textureLoader.load(
      "https://threejs.org/examples/textures/planets/earth_lights_2048.png"
    );
    const cloudTex = textureLoader.load(
      "https://threejs.org/examples/textures/planets/earth_clouds_1024.png"
    );
    earthMaterialRef.current = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        dayTexture: { value: dayTex },
        nightTexture: { value: nightTex },
        sunDirection: { value: new THREE.Vector3(0, 0, 1) },
      },
    });
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterialRef.current);
    scene.add(earthMesh);
    const cloudGeometry = new THREE.SphereGeometry(2.03, 64, 64);
    const cloudMaterial = new THREE.MeshPhongMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.4,
    });
    const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    scene.add(cloudMesh);
    const issModel = createIssModel();
    issMeshRef.current = issModel;
    scene.add(issModel);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: textureLoader.load(
        "https://threejs.org/examples/textures/sprites/disc.png"
      ),
      color: 0x00ffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.5,
    });
    const issGlow = new THREE.Sprite(spriteMaterial);
    issGlow.scale.set(0.5, 0.5, 1.0);
    issModel.add(issGlow);
    const orbitLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([]),
      new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.5,
      })
    );
    orbitLineRef.current = orbitLine;
    scene.add(orbitLine);
    const groundTrackLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([]),
      new THREE.LineBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.7,
      })
    );
    groundTrackLineRef.current = groundTrackLine;
    scene.add(groundTrackLine);
    camera.position.z = 5;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 10;
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate); // Store the ID // Earth rotation and day/night cycle logic
      const date = new Date();
      const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60;
      const sunAngle = (utcHour / 24) * Math.PI * 2 - Math.PI / 2;
      const sunDirection = new THREE.Vector3()
        .set(Math.cos(sunAngle), 0, Math.sin(sunAngle))
        .normalize();
      if (earthMaterialRef.current)
        earthMaterialRef.current.uniforms.sunDirection.value = sunDirection;
      if (sunLightRef.current)
        sunLightRef.current.position.copy(sunDirection).multiplyScalar(10); // Optional: rotate the Earth for effect
      earthMesh.rotation.y += 0.001;
      cloudMesh.rotation.y += 0.0012;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    const handleResize = () => {
      if (currentMount) {
        camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      }
    };
    window.addEventListener("resize", handleResize);
    const fetchISSData = async () => {
      try {
        const response = await fetch(API_URL_ISS);
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();
        setIssData(data);
        setError(null);
        const { latitude, longitude, altitude } = data; // Convert geographic coordinates (Lat, Lon) to Spherical coordinates (Phi, Theta)
        const phi = (90 - latitude) * (Math.PI / 180);
        const theta = (longitude + 180) * (Math.PI / 180);
        const issRadius = 2.1 + altitude / 6371; // Base radius 2 + normalized altitude
        if (issMeshRef.current) {
          const issPosition = new THREE.Vector3().setFromSphericalCoords(
            issRadius,
            phi,
            theta
          );
          issMeshRef.current.position.copy(issPosition); // Orient ISS towards the Earth (center 0,0,0)
          issMeshRef.current.lookAt(new THREE.Vector3(0, 0, 0));
        } // Update Orbit Line
        if (orbitLineRef.current && issMeshRef.current) {
          const points = orbitLineRef.current.geometry.attributes.position
            ? Array.from(
                orbitLineRef.current.geometry.attributes.position.array
              )
            : [];
          points.push(
            issMeshRef.current.position.x,
            issMeshRef.current.position.y,
            issMeshRef.current.position.z
          );
          if (points.length > 3000) points.splice(0, 3 * 10); // Keep only 1000 segments
          orbitLineRef.current.geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(points, 3)
          );
          orbitLineRef.current.geometry.attributes.position.needsUpdate = true;
        } // Update Ground Track
        if (groundTrackLineRef.current) {
          const groundTrackRadius = 2.01;
          const groundPosition = new THREE.Vector3().setFromSphericalCoords(
            groundTrackRadius,
            phi,
            theta
          );
          const points = groundTrackLineRef.current.geometry.attributes.position
            ? Array.from(
                groundTrackLineRef.current.geometry.attributes.position.array
              )
            : [];
          points.push(groundPosition.x, groundPosition.y, groundPosition.z);
          if (points.length > 3000) points.splice(0, 3 * 10); // Keep only 1000 segments
          groundTrackLineRef.current.geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(points, 3)
          );
          groundTrackLineRef.current.geometry.attributes.position.needsUpdate = true;
        }
      } catch (err) {
        setError(err.message);
        console.error("Failed to fetch ISS data:", err);
      }
    };
    fetchISSData();
    const intervalId = setInterval(fetchISSData, 5000); // 🌟🌟🌟 THE CRITICAL FIX: Aggressive WebGL Context Cleanup 🌟🌟🌟
    return () => {
      cancelAnimationFrame(animationIdRef.current); // 2. Stop data fetching
      clearInterval(intervalId); // 3. Remove resize listener
      window.removeEventListener("resize", handleResize);
      controls.dispose(); // 5. Dispose of all Three.js resources to free up the GPU context
      if (rendererRef.current) {
        scene.traverse((object) => {
          if (object.isMesh || object.isLine || object.isSprite) {
            if (object.geometry && object.geometry.dispose)
              object.geometry.dispose(); // Dispose material and textures
            if (Array.isArray(object.material)) {
              object.material.forEach((material) => {
                if (material.map && material.map.dispose)
                  material.map.dispose();
                if (material.dispose) material.dispose();
              });
            } else if (object.material && object.material.dispose) {
              if (object.material.map && object.material.map.dispose)
                object.material.map.dispose();
              object.material.dispose();
            }
          }
        }); // Dispose the renderer itself
        rendererRef.current.dispose();
      } // 6. Remove the canvas element from the DOM (crucial for context release)
      if (
        currentMount &&
        rendererRef.current &&
        rendererRef.current.domElement
      ) {
        currentMount.removeChild(rendererRef.current.domElement);
      }
    };
  }, []);
  return (
    <div className="tracker-container">
      <div ref={mountRef} className="three-canvas"></div> {" "}
      <div className="data-panel">
        <h2>Live ISS Data</h2>{" "}
        {error && <p style={{ color: "var(--error-color)" }}>Error: {error}</p>}{" "}
        {issData ? (
          <div>
            {" "}
            <DataItem label="Latitude" value={issData.latitude.toFixed(4)} />{" "}
            <DataItem label="Longitude" value={issData.longitude.toFixed(4)} />
            {" "}
            <DataItem
              label="Altitude"
              value={`${issData.altitude.toFixed(2)} km`}
            />
            {" "}
            <DataItem
              label="Speed"
              value={`${issData.velocity.toFixed(2)} km/h`}
            />
             <DataItem label="Visibility" value={issData.visibility} /> {" "}
          </div>
        ) : (
          <p>Fetching ISS data...</p>
        )}
         {" "}
      </div>
      {" "}
    </div>
  );
}
