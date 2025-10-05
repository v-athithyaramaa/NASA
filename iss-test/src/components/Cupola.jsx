import React, { Suspense, useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture, Html, Preload, Stars } from "@react-three/drei";
import * as THREE from "three";
// ✨ CORRECTION: Make sure this is a .png file with a transparent background
import Cloud from "../assests/Cloud1.png";

// No changes to Earth component
function Earth({ radius = 2, earthGroup }) {
    const cloudRef = useRef();
    const [dayMap, cloudMap] = useTexture([
        "https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg",
        "https://threejs.org/examples/textures/planets/earth_clouds_1024.png",
    ]);

    useMemo(() => {
        [dayMap, cloudMap].forEach((t) => {
            if (!t) return;
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.minFilter = THREE.LinearFilter;
            t.anisotropy = 8;
        });
    }, [dayMap, cloudMap]);

    useFrame(() => {
        if (earthGroup.current) earthGroup.current.rotation.y += 0.0005;
        if (cloudRef.current) cloudRef.current.rotation.y += 0.0008;
    });

    return (
        <group ref={earthGroup}>
            <mesh>
                <sphereGeometry args={[radius, 64, 64]} />
                <meshStandardMaterial
                    map={dayMap}
                    roughness={0.9}
                    metalness={0.0}
                    emissiveIntensity={0.2}
                />
            </mesh>
            <mesh
                ref={cloudRef}
                material={
                    new THREE.MeshStandardMaterial({
                        map: cloudMap,
                        transparent: true,
                        opacity: 0.42,
                        depthWrite: false,
                        side: THREE.DoubleSide,
                    })
                }
            >
                <sphereGeometry args={[radius + 0.03, 64, 64]} />
            </mesh>
        </group>
    );
}

// No changes to PlaceMarker component
function PlaceMarker({ position, name, color = "#ff0", onClick, highlight }) {
    const ref = useRef();
    const [hovered, setHovered] = useState(false);

    useFrame(({ clock }) => {
        if (ref.current) {
            const basePulse = 1 + Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.12;
            const scale = highlight ? basePulse * 1.5 : basePulse;
            ref.current.scale.set(scale, scale, scale);
        }
    });

    return (
        <group position={position}>
            <mesh
                ref={ref}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHovered(true);
                    document.body.style.cursor = "pointer";
                }}
                onPointerOut={(e) => {
                    e.stopPropagation();
                    setHovered(false);
                    document.body.style.cursor = "auto";
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (onClick) onClick();
                }}
            >
                <sphereGeometry args={[0.03, 16, 16]} />
                <meshStandardMaterial
                    color={hovered ? "#fff" : color}
                    emissive={color}
                    emissiveIntensity={0.9}
                    roughness={0.3}
                    metalness={0.1}
                />
            </mesh>
            {hovered && (
                <Html position={[0, 0.07, 0]}>
                    <div
                        style={{
                            background: "rgba(0,0,0,0.7)",
                            color: "white",
                            padding: "6px 10px",
                            borderRadius: 6,
                            fontSize: 14,
                            fontFamily: "Inter, sans-serif",
                            whiteSpace: "nowrap",
                            pointerEvents: "none",
                        }}
                    >
                        {name}
                    </div>
                </Html>
            )}
        </group>
    );
}

// No changes to CameraFollower component
function CameraFollower({ selectedPlace, earthGroup, controlsRef }) {
    const overviewPos = useRef(new THREE.Vector3(0, 0, 8));

    useFrame(({ camera }) => {
        if (!earthGroup.current || !controlsRef.current) return;
        const controls = controlsRef.current;

        if (selectedPlace) {
            controls.enableRotate = false;
            controls.enableZoom = false;
            controls.enablePan = false;

            const worldPos = new THREE.Vector3(...selectedPlace.position);
            worldPos.applyMatrix4(earthGroup.current.matrixWorld);
            const camPos = worldPos.clone().normalize().multiplyScalar(3.5);

            camera.position.lerp(camPos, 0.05);
            controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.05);
            controls.update();
        } else {
            controls.enableRotate = true;
            controls.enableZoom = true;
            controls.enablePan = true;

            camera.position.lerp(overviewPos.current, 0.05);
            controls.update();
        }
    });

    return null;
}

// No changes to Sidebar component
function Sidebar({ earthPlaces, onSelect, selected }) {
    return (
        <div
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100vh",
                width: "220px",
                background: "rgba(0, 0, 0, 0.75)",
                backdropFilter: "blur(10px)",
                color: "white",
                padding: "20px",
                overflowY: "auto",
                borderRight: "1px solid rgba(255,255,255,0.1)",
                fontFamily: "Inter, sans-serif",
                zIndex: 10,
            }}
        >
            <h3 style={{ marginBottom: "12px", fontSize: "18px" }}>🌍 Earth Places</h3>
            {earthPlaces.map((p, i) => (
                <div
                    key={i}
                    onClick={() => onSelect(p)}
                    style={{
                        marginBottom: "10px",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        background:
                            selected?.name === p.name
                                ? "rgba(255,255,255,0.15)"
                                : "transparent",
                        transition: "background 0.3s",
                    }}
                    onMouseOver={(e) =>
                        (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
                    }
                    onMouseOut={(e) =>
                    (e.currentTarget.style.background =
                        selected?.name === p.name
                            ? "rgba(255,255,255,0.15)"
                            : "transparent")
                    }
                >
                    <span style={{ color: p.color, marginRight: "6px" }}>●</span>
                    {p.name}
                </div>
            ))}
        </div>
    );
}

// ✨ CORRECTED CloudTransition component
function CloudTransition({ active }) {
    if (!active) return null;

    // The imported 'Cloud' variable is used directly.
    return (
        <div className="cloud-overlay">
            <img src={Cloud} className="cloud-image left" alt="Cloud transition" />
            <img src={Cloud} className="cloud-image right" alt="Cloud transition" />
        </div>
    );
}


export default function CupolaScene() {
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [showImage, setShowImage] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const controlsRef = useRef();
    const earthGroup = useRef();
    const initialCamPos = new THREE.Vector3(0, 0, 8);

    function latLonToVector3(lat, lon, radius = 2) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = lon * (Math.PI / 180);
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = -radius * Math.sin(phi) * Math.sin(theta);
        return [x, y, z];
    }

    const earthPlaces = [
        { name: "Amazon Rainforest", position: latLonToVector3(-6.4653, -62.2159), color: "#00ff7f", description: "The world's largest tropical rainforest, covering over 5.5 million square kilometers across nine countries in South America.", image: "https://tse4.mm.bing.net/th?id=OIF.%2ffrl9IrIcQl649IPkKgqBA&pid=Api&P=0&h=180" },
        { name: "Great Barrier Reef", position: latLonToVector3(-19.2871, 149.6992), color: "#00bfff", description: "The world's largest coral reef system off the coast of Queensland, Australia, visible even from space.", image: "https://images.fineartamerica.com/images-medium-large-5/1-great-barrier-reef-nasascience-photo-library.jpg" },
        { name: "Sahara Desert", position: latLonToVector3(25.4162, 55.6628), color: "#ffd700", description: "The largest hot desert on Earth, stretching across much of North Africa.", image: "https://www.desertusa.com/desert_photos/Sahara_satellite-nasa.jpg" },
        { name: "Mt. Everest, Himalayas", position: latLonToVector3(28.9881, 84.925), color: "#ffffff", description: "The highest mountain on Earth at 8,848 meters above sea level, located on the border of Nepal and China.", image: "https://i.pinimg.com/originals/9a/c8/c3/9ac8c367ab03f7ec00a36e301ad0d410.jpg" },
        { name: "Nile River Delta", position: latLonToVector3(25.7965, 32.0), color: "#00ff00", description: "The fertile delta where the Nile River spreads out before flowing into the Mediterranean Sea.", image: "https://assets.iflscience.com/assets/articleNo/67955/aImg/66388/nile-meta.jpg" },
        { name: "Arabian Peninsula", position: latLonToVector3(25.8859, 46.0792), color: "#ffcc99", description: "The largest peninsula in the world, located in Western Asia and bordered by the Red Sea and the Persian Gulf.", image: "https://i.pinimg.com/originals/ad/b1/d4/adb1d43568c14a011a66819ef6e82a96.jpg" },
        { name: "Tibetan Plateau", position: latLonToVector3(34.0, 93.0), color: "#add8e6", description: "Known as the 'Roof of the World,' this vast plateau averages over 4,500 meters above sea level.", image: "https://scitechdaily.com/images/Himalayan-Mountain-Range-From-Space-Art-Concept.jpg" },
        { name: "Ganges River Delta", position: latLonToVector3(24.5, 80.5), color: "#32cd32", description: "The world's largest river delta, formed by the Ganges, Brahmaputra, and Meghna rivers in Bangladesh and India.", image: "https://i.pinimg.com/originals/52/8a/e5/528ae51adc18b293c063b91bc01198cf.jpg" },
        { name: "Great Wall of China", position: latLonToVector3(37.4319, 110.5704), color: "#ff4500", description: "An ancient series of walls and fortifications built to protect China from northern invasions.", image: "https://www.esa.int/var/esa/storage/images/esa_multimedia/images/2018/06/great_wall_of_china/17561105-1-eng-GB/Great_Wall_of_China_pillars.jpg" },
    ];

    const handlePlaceSelect = (place) => {
        setSelectedPlace(place);
        setShowImage(false);
        setIsTransitioning(true);

        setTimeout(() => {
            setShowImage(true);
        }, 1250);

        setTimeout(() => {
            setIsTransitioning(false);
        }, 2500);
    };

    const handleClosePanel = () => {
        setSelectedPlace(null);
        setShowImage(false);
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "black" }}>
            <Sidebar earthPlaces={earthPlaces} onSelect={handlePlaceSelect} selected={selectedPlace} />
            <Canvas camera={{ fov: 55, near: 0.1, far: 1000, position: [initialCamPos.x, initialCamPos.y, initialCamPos.z] }}>
                <color attach="background" args={["black"]} />
                <ambientLight intensity={0.4} />
                <directionalLight position={[10, 10, 5]} intensity={1.2} />
                <Stars radius={300} depth={80} count={3500} factor={4} fade speed={0.02} />
                <Preload all />
                <Suspense fallback={<Html center>Loading Earth...</Html>}>
                    <group ref={earthGroup}>
                        <Earth radius={2} earthGroup={earthGroup} />
                        {earthPlaces.map((p, i) => (
                            <PlaceMarker key={i} {...p} onClick={() => handlePlaceSelect(p)} highlight={selectedPlace?.name === p.name && !showImage} />
                        ))}
                    </group>
                </Suspense>
                <OrbitControls ref={controlsRef} enablePan={false} enableZoom={true} zoomSpeed={0.6} rotateSpeed={0.5} minDistance={3.5} maxDistance={12} />
                <CameraFollower selectedPlace={selectedPlace} earthGroup={earthGroup} controlsRef={controlsRef} />
            </Canvas>

            <CloudTransition active={isTransitioning} />

            {selectedPlace && showImage && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: `url(${selectedPlace.image})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        color: "white",
                        fontFamily: "Inter, sans-serif",
                        animation: "fadeIn 0.8s ease-in-out",
                        zIndex: 20,
                    }}
                >
                    <div
                        style={{
                            background: "rgba(0,0,0,0.5)",
                            padding: "24px",
                        }}
                    >
                        <h1 style={{ margin: 0, fontSize: "28px" }}>{selectedPlace.name}</h1>
                        <p style={{ fontSize: "16px", lineHeight: "1.5", marginTop: "8px" }}>
                            {selectedPlace.description}
                        </p>
                        <button
                            onClick={handleClosePanel}
                            style={{
                                marginTop: "16px",
                                padding: "10px 16px",
                                background: "rgba(255,255,255,0.9)",
                                border: "none",
                                borderRadius: "8px",
                                fontSize: "16px",
                                color: "#000",
                                cursor: "pointer",
                            }}
                        >
                            ⬅️ Return to Globe
                        </button>
                    </div>
                </div>
            )}

            {/* CSS is correct and does not need changes */}
            <style>{`
  @keyframes fadeIn {
    from { opacity: 0; } 
    to { opacity: 1; }
  }

  .cloud-overlay {
    position: fixed;
    inset: 0;
    z-index: 15;
    pointer-events: none;
    overflow: hidden;
    background: radial-gradient(circle at center, rgba(0,0,0,0.2), rgba(0,0,0,0.8));
  }

  .cloud-image {
    position: absolute;
    top: 0;
    height: 120%;
    width: auto;
    opacity: 0;
    filter: blur(6px) brightness(1.2);
    animation-duration: 2.8s;
    animation-timing-function: cubic-bezier(0.45, 0.05, 0.55, 0.95);
    animation-fill-mode: forwards;
    transform-origin: center;
    mix-blend-mode: screen;
  }

  .cloud-image.left {
    left: 0;
    animation-name: billow-left;
  }

  .cloud-image.right {
    right: 0;
    transform: scaleX(-1) rotate(2deg);
    animation-name: billow-right;
  }

  @keyframes billow-left {
    0% { 
      transform: translate(-120%, 20%) scale(0.8) rotate(-8deg); 
      opacity: 0; 
      filter: blur(12px) brightness(0.9);
    }
    25% { 
      opacity: 0.8; 
      filter: blur(5px) brightness(1.3);
    }
    50% { 
      transform: translate(-10%, -10%) scale(1.05) rotate(-2deg); 
      opacity: 1; 
    }
    75% { 
      opacity: 0.7; 
      filter: blur(8px);
    }
    100% { 
      transform: translate(100%, -30%) scale(1.2) rotate(6deg); 
      opacity: 0; 
      filter: blur(15px) brightness(0.7);
    }
  }

  @keyframes billow-right {
    0% { 
      transform: translate(120%, -20%) scaleX(-1) scale(0.8) rotate(6deg); 
      opacity: 0; 
      filter: blur(12px) brightness(0.9);
    }
    25% { 
      opacity: 0.8; 
      filter: blur(5px) brightness(1.3);
    }
    50% { 
      transform: translate(10%, 10%) scaleX(-1) scale(1.05) rotate(0deg); 
      opacity: 1; 
    }
    75% { 
      opacity: 0.7; 
      filter: blur(8px);
    }
    100% { 
      transform: translate(-100%, 30%) scaleX(-1) scale(1.2) rotate(-8deg); 
      opacity: 0; 
      filter: blur(15px) brightness(0.7);
    }
  }
`}</style>

        </div>
    );
}