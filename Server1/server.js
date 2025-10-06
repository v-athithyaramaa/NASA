// server.js
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import axios from "axios";
import xml2js from "xml2js";
import { globSync } from "glob";
import satellite from "satellite.js";

const app = express();
const PORT = process.env.PORT || 3000;

// ----------- Middleware ------------
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://nasa-iss-space-surfers.vercel.app"
  ],
}));

// ----------- Helpers ------------
function safeInt(value) {
  if (!value) return 0;
  value = value.toString().trim();
  if (value.startsWith("<")) return 0;
  const n = parseInt(value);
  return isNaN(n) ? 0 : n;
}

function safeFloat(value) {
  if (!value) return 0.0;
  const f = parseFloat(value);
  return isNaN(f) ? 0.0 : f;
}

// Parse XML file and return array of visible passes
function parseXmlFile(filePath) {
  const xml = fs.readFileSync(filePath, "utf-8");
  let passes = [];
  xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
    if (err) return;
    const visiblePasses = result?.visible_passes?.visible_pass;
    if (!visiblePasses) return;

    const passArray = Array.isArray(visiblePasses) ? visiblePasses : [visiblePasses];
    passArray.forEach(vp => {
      passes.push({
        country: vp.country || null,
        region: vp.region || null,
        city: vp.city || null,
        spacecraft: vp.spacecraft || null,
        sighting_date: vp.sighting_date || null,
        duration_minutes: safeInt(vp.duration_minutes),
        max_elevation: safeInt(vp.max_elevation),
        enters: vp.enters || null,
        exits: vp.exits || null,
        utc_offset: safeFloat(vp.utc_offset),
        utc_time: vp.utc_time || null,
        utc_date: vp.utc_date || null
      });
    });
  });
  return passes;
}

// ----------- Load XML Data ------------
const DATA_FOLDER = "xml_data";
const VISIBLE_PASSES = globSync(path.join(DATA_FOLDER, "*.xml"))
  .flatMap(parseXmlFile);

// ---------- Root Homepage ----------
app.get("/", (req, res) => {
  res.send(`
    <h1>🚀 ISS Tracker API</h1>
    <p>Server is running!</p>
    <p>Access the API endpoints:</p>
    <ul>
      <li><a href="/passes">/passes</a></li>
      <li><a href="/cities">/cities</a></li>
      <li><a href="/countries">/countries</a></li>
      <li><a href="/current-iss">/current-iss</a></li>
      <li><a href="/astronauts">/astronauts</a></li>
      <li><a href="/iss-location-at?minutes_from_now=0">/iss-location-at</a></li>
    </ul>
  `);
});

// ---------------- Routes ----------------

// Get visible passes (optional filters: city, country, date)
app.get("/passes", (req, res) => {
  const { city, country, date } = req.query;
  let results = VISIBLE_PASSES;

  if (city) results = results.filter(p => p.city?.toLowerCase() === city.toLowerCase());
  if (country) results = results.filter(p => p.country?.toLowerCase() === country.toLowerCase());
  if (date) results = results.filter(p => p.utc_date === date);

  if (results.length === 0) return res.status(404).json({ message: "No passes found" });
  res.json(results);
});

// Get list of cities
app.get("/cities", (req, res) => {
  const cities = Array.from(new Set(VISIBLE_PASSES.map(p => p.city).filter(Boolean))).sort();
  res.json(cities);
});

// Get list of countries
app.get("/countries", (req, res) => {
  const countries = Array.from(new Set(VISIBLE_PASSES.map(p => p.country).filter(Boolean))).sort();
  res.json(countries);
});

// ✅ Get current ISS position via HTTPS proxy
app.get("/current-iss", async (req, res) => {
  try {
    const proxyUrl = "https://api.allorigins.win/raw?url=http://api.open-notify.org/iss-now.json";
    const response = await axios.get(proxyUrl);
    const data = response.data;
    if (data.message !== "success") throw new Error("ISS API error");
    res.json({
      latitude: parseFloat(data.iss_position.latitude),
      longitude: parseFloat(data.iss_position.longitude)
    });
  } catch (err) {
    console.error("ISS API Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get list of astronauts via HTTPS proxy
app.get("/astronauts", async (req, res) => {
  try {
    const proxyUrl = "https://api.allorigins.win/raw?url=http://api.open-notify.org/astros.json";
    const response = await axios.get(proxyUrl);
    res.json(response.data);
  } catch (err) {
    console.error("Astronaut API Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get ISS location at N minutes from now
app.get("/iss-location-at", async (req, res) => {
  const minutes = parseInt(req.query.minutes_from_now) || 0;

  try {
    // Load ISS TLE data
    const tleResp = await axios.get("https://celestrak.org/NORAD/elements/stations.txt");
    const tleLines = tleResp.data.split("\n");
    const issIndex = tleLines.findIndex(line => line.includes("ISS"));
    const tle1 = tleLines[issIndex + 1].trim();
    const tle2 = tleLines[issIndex + 2].trim();

    const satrec = satellite.twoline2satrec(tle1, tle2);
    const now = new Date(Date.now() + minutes * 60 * 1000);
    const positionAndVelocity = satellite.propagate(satrec, now);
    const gmst = satellite.gstime(now);
    const geo = satellite.eciToGeodetic(positionAndVelocity.position, gmst);

    res.json({
      timestamp_utc: now.toISOString(),
      latitude: geo.latitude * (180 / Math.PI),
      longitude: geo.longitude * (180 / Math.PI),
      altitude_km: geo.height
    });
  } catch (err) {
    console.error("ISS location error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Start server ------------
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
