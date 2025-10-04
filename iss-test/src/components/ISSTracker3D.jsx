import React, { useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html, useTexture, Line } from "@react-three/drei";
import * as THREE from "three";

const ISSModel = ({ position }) => {
  const groupRef = useRef();
  useFrame(() => {
    if (groupRef.current && position) {
      const earthRadius = 2.0;
      const normalizedAltitude = position.altitude / 6371; // Normalized altitude (approx 0.05-0.1)
      const issRadius = earthRadius + 0.1 + normalizedAltitude; // ~2.1
      const phi = (90 - position.latitude) * (Math.PI / 180);
      const theta = (position.longitude + 180) * (Math.PI / 180);
      const x = issRadius * Math.sin(phi) * Math.cos(theta);
      const z = issRadius * Math.sin(phi) * Math.sin(theta);
      const y = issRadius * Math.cos(phi);
      groupRef.current.position.set(x, y, z);
      groupRef.current.lookAt(new THREE.Vector3(0, 0, 0));
    }
  });
  return (
    <group ref={groupRef} scale={[0.2, 0.2, 0.2]}>
      {}
      <mesh>
        <boxGeometry args={[1.5, 0.75, 4]} />
        <meshStandardMaterial color="#C0C0C0" metalness={0.8} roughness={0.2} />
      </mesh>
      {}
      <mesh position={[4, 0, 0]}>
        <boxGeometry args={[8, 0.1, 2]} />
        <meshStandardMaterial color="#003366" emissive="#001122" />
      </mesh>
      <mesh position={[-4, 0, 0]}>
        <boxGeometry args={[8, 0.1, 2]} />
        <meshStandardMaterial color="#003366" emissive="#001122" />
      </mesh>
      {}
      <mesh position={[0, 0, 2.5]}>
        <cylinderGeometry args={[0.5, 0.5, 1]} />
        <meshStandardMaterial color="#F0F0F0" />
      </mesh>
      {}
      <pointLight
        color="#00ffff"
        intensity={0.5}
        distance={10}
        position={[0, 0, 0]}
      />
      {}
      <Html position={[0, 3, 0]} center>
        <div className="iss-label">
          <span>International Space Station</span>
          {position && (
            <div className="iss-coords">
              {position.latitude.toFixed(2)}°, {position.longitude.toFixed(2)}°
            </div>
          )}
        </div>
      </Html>
    </group>
  );
};
const Earth = () => {
  const earthRef = useRef();
  const cloudRef = useRef();
  const [dayTexture, nightTexture, cloudTexture, bumpTexture] = useTexture([
    "https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg",
    "https://threejs.org/examples/textures/planets/earth_lights_2048.png",
    "https://threejs.org/examples/textures/planets/earth_clouds_1024.png",
    "https://threejs.org/examples/textures/planets/earth_normal_2048.jpg",
  ]);
  const vertexShader = `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  const fragmentShader = `
      uniform sampler2D dayTexture;
      uniform sampler2D nightTexture;
      uniform vec3 sunDirection;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vec3 dayColor = texture2D(dayTexture, vUv).rgb;
        vec3 nightColor = texture2D(nightTexture, vUv).rgb;
        vec3 worldNormal = normalize(vNormal);
        float lightIntensity = max(0.0, dot(worldNormal, sunDirection));
        float dayNightMix = smoothstep(-0.1, 0.4, lightIntensity);
        vec3 color = mix(nightColor * 1.5, dayColor, dayNightMix); // Night side uses lights texture
        vec3 viewDirection = normalize(cameraPosition - vPosition);
        float rimLight = 1.0 - max(0.0, dot(vNormal, viewDirection));
        rimLight = pow(rimLight, 3.0);
        color += vec3(0.1, 0.4, 1.0) * rimLight * 0.1; // Blue atmospheric glow
        gl_FragColor = vec4(color, 1.0);
      }
    `;
  const earthMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayTexture },
        nightTexture: { value: nightTexture },
        sunDirection: { value: new THREE.Vector3(1, 0, 0) },
        cameraPosition: { value: new THREE.Vector3() },
      },
      vertexShader,
      fragmentShader,
    });
  }, [dayTexture, nightTexture]);
  useFrame((state) => {
    if (earthRef.current) {
      earthRef.current.rotation.y += 0.0005;
      if (cloudRef.current) cloudRef.current.rotation.y += 0.0006;
      const timeFactor = Date.now() / (1000 * 60 * 60 * 24); // Time in days
      const angle = (timeFactor * Math.PI * 2) % (Math.PI * 2);
      const sunDirection = new THREE.Vector3(
        Math.cos(angle - Math.PI / 2),
        0,
        Math.sin(angle - Math.PI / 2)
      ).normalize();
      earthMaterial.uniforms.sunDirection.value = sunDirection;
      earthMaterial.uniforms.cameraPosition.value = state.camera.position;
    }
  });
  return (
    <group>
      {}
      <mesh ref={earthRef}>
        <sphereGeometry args={[2, 64, 64]} />
        <primitive object={earthMaterial} attach="material" />
      </mesh>
      {}
      <mesh ref={cloudRef}>
        <sphereGeometry args={[2.01, 64, 64]} />
        <meshStandardMaterial
          map={cloudTexture}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>
      {}
      <mesh>
        <sphereGeometry args={[2.05, 64, 64]} />
        <meshStandardMaterial
          color="#4080ff"
          transparent
          opacity={0.2}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
};
const OrbitalPath = ({ trajectoryData }) => {
  const points = useMemo(() => {
    if (!trajectoryData || trajectoryData.length === 0) return [];
    return trajectoryData.map((point) => {
      const earthRadius = 2.0;
      const normalizedAltitude = point.altitude / 6371; // Normalized altitude
      const pathRadius = earthRadius + 0.1 + normalizedAltitude; // ~2.1
      const phi = (90 - point.latitude) * (Math.PI / 180);
      const theta = (point.longitude + 180) * (Math.PI / 180);
      const x = pathRadius * Math.sin(phi) * Math.cos(theta);
      const z = pathRadius * Math.sin(phi) * Math.sin(theta);
      const y = pathRadius * Math.cos(phi);
      return new THREE.Vector3(x, y, z);
    });
  }, [trajectoryData]);
  if (points.length === 0) return null;
  return (
    <Line
      points={points}
      color="#00ffff"
      lineWidth={2}
      transparent
      opacity={0.6}
      dashed={false}
    />
  );
};
const GroundTrack = ({ trajectoryData }) => {
  const points = useMemo(() => {
    if (!trajectoryData || trajectoryData.length === 0) return [];
    return trajectoryData.map((point) => {
      const groundTrackRadius = 2.005; // Slightly above Earth surface
      const phi = (90 - point.latitude) * (Math.PI / 180);
      const theta = (point.longitude + 180) * (Math.PI / 180);
      const x = groundTrackRadius * Math.sin(phi) * Math.cos(theta);
      const z = groundTrackRadius * Math.sin(phi) * Math.sin(theta);
      const y = groundTrackRadius * Math.cos(phi);
      return new THREE.Vector3(x, y, z);
    });
  }, [trajectoryData]);
  if (points.length === 0) return null;
  return (
    <Line
      points={points}
      color="#ffff00"
      lineWidth={3}
      transparent
      opacity={0.8}
      dashed={false}
    />
  );
};
const UserLocationMarker = ({ userLocation }) => {
  if (!userLocation || (!userLocation.lat && !userLocation.lon)) return null;
  const position = useMemo(() => {
    const markerRadius = 2.015; // Slightly above ground track
    const phi = (90 - userLocation.lat) * (Math.PI / 180);
    const theta = (userLocation.lon + 180) * (Math.PI / 180);
    const x = markerRadius * Math.sin(phi) * Math.cos(theta);
    const z = markerRadius * Math.sin(phi) * Math.sin(theta);
    const y = markerRadius * Math.cos(phi);
    return [x, y, z];
  }, [userLocation]);
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshStandardMaterial color="#ff4444" emissive="#ff4444" />
      </mesh>
      <Html position={[0, 0.05, 0]} center>
        <div className="user-location-label">You</div>
      </Html>
    </group>
  );
};
const ISSTracker3D = ({ issData, trajectoryData, userLocation }) => {
  const [cameraPosition, setCameraPosition] = useState([5, 3, 5]);
  const [autoRotate, setAutoRotate] = useState(true);
  const [error, setError] = useState(null);
  return (
    <div className="iss-tracker-3d">
      {}
      {error && (
        <div
          className="error-banner"
          style={{
            position: "absolute",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#ff4444",
            color: "white",
            padding: "10px 20px",
            borderRadius: "5px",
            zIndex: 1000,
          }}
        >
          {error}
        </div>
      )}
      {}
      <div className="tracker-controls">
        <button
          className={`control-btn ${autoRotate ? "active" : ""}`}
          onClick={() => setAutoRotate(!autoRotate)}
        >
          Auto Rotate: {autoRotate ? "ON" : "OFF"}
        </button>
        <div className="view-presets">
          <button
            className="control-btn"
            onClick={() => setCameraPosition([5, 3, 5])}
          >
            Default
          </button>
          <button
            className="control-btn"
            onClick={() => setCameraPosition([0, 0, 8])}
          >
            Front
          </button>
          <button
            className="control-btn"
            onClick={() => setCameraPosition([0, 8, 0])}
          >
            Top
          </button>
        </div>
      </div>
      {}
      <Canvas
        camera={{ position: cameraPosition, fov: 60 }}
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        }}
        className="tracker-canvas"
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          const handleContextLost = (event) => {
            event.preventDefault();
            console.warn("WebGL context lost, attempting to restore...");
            setError("WebGL context lost. Refreshing visualization...");
            setTimeout(() => {
              setError(null);
            }, 2000);
          };
          const handleContextRestored = () => {
            console.log("WebGL context restored");
            setError(null);
          };
          canvas.addEventListener("webglcontextlost", handleContextLost);
          canvas.addEventListener(
            "webglcontextrestored",
            handleContextRestored
          );
          return () => {
            canvas.removeEventListener("webglcontextlost", handleContextLost);
            canvas.removeEventListener(
              "webglcontextrestored",
              handleContextRestored
            );
          };
        }}
      >
        {}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1.5}
          castShadow
          color="#ffffff"
        />
        {}
        <Stars
          radius={300}
          depth={60}
          count={5000}
          factor={7}
          saturation={0}
          fade
        />
        {}
        <Earth />
        {}
        {issData && <ISSModel position={issData} />}
        {}
        <OrbitalPath trajectoryData={trajectoryData} />
        {}
        <GroundTrack trajectoryData={trajectoryData} />
        {}
        <UserLocationMarker userLocation={userLocation} />
        {}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          autoRotate={autoRotate}
          autoRotateSpeed={0.5}
          minDistance={3}
          maxDistance={15}
          enablePan={true}
          enableZoom={true}
        />
      </Canvas>
      {}
      {issData && (
        <div className="info-panel-3d">
          <h3>ISS Real-Time Data</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Altitude:</span>
              <span className="value">{Math.round(issData.altitude)} km</span>
            </div>
            <div className="info-item">
              <span className="label">Velocity:</span>
              <span className="value">{Math.round(issData.velocity)} km/h</span>
            </div>
            <div className="info-item">
              <span className="label">Visibility:</span>
              <span className="value">{issData.visibility}</span>
            </div>
            <div className="info-item">
              <span className="label">Footprint:</span>
              <span className="value">{Math.round(issData.footprint)} km</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ISSTracker3D;
