import React, { useEffect, useState, useRef } from "react";
import Globe from "react-globe.gl";

export default function ISSGlobe() {
  const globeEl = useRef();
  const [issPosition, setIssPosition] = useState({ lat: 0, lng: 0 });
  const [nextPass, setNextPass] = useState(null);
  const [clickedPosition, setClickedPosition] = useState(null); // new state
  const [error, setError] = useState("");

  // Fetch current ISS position every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/current-iss");
        if (!res.ok) throw new Error("Failed to fetch ISS position");
        const data = await res.json();
        setIssPosition({ lat: data.latitude, lng: data.longitude });
      } catch (err) {
        setError(err.message);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle globe click to fetch next pass
  const handleClick = async (latLng) => {
    try {
      const { lat, lng } = latLng;
      setClickedPosition({ lat, lng }); // mark clicked position
      const res = await fetch(
        `http://127.0.0.1:8000/next-pass?lat=${lat}&lon=${lng}`
      );
      if (!res.ok) throw new Error("No next pass found");
      const data = await res.json();
      setNextPass(data);
      setError("");
    } catch (err) {
      setError(err.message);
      setNextPass(null);
    }
  };

  // Combine ISS and clicked marker
  const markers = [issPosition];
  if (clickedPosition) markers.push(clickedPosition);

  return (
    <div>
      {error && <div style={{ color: "red" }}>Error: {error}</div>}
      {nextPass && (
        <div>
          <strong>Next Pass (IST):</strong> {nextPass.enters} – {nextPass.exits} | Max Elevation:{" "}
          {nextPass.max_elevation.toFixed(1)}°
        </div>
      )}
      <Globe
        ref={globeEl}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        onGlobeClick={(latLng) => handleClick(latLng)}
        htmlElementsData={markers}
        htmlElement={(d) => {
          const el = document.createElement("div");
          if (d === issPosition) {
            el.innerHTML = "🛰️"; // ISS
            el.style.fontSize = "24px";
          } else {
            el.innerHTML = "📍"; // clicked location
            el.style.fontSize = "18px";
          }
          el.style.transform = "translate(-50%, -50%)";
          return el;
        }}
      />
    </div>
  );
}
