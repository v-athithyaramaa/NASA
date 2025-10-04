import React, { useState, useEffect } from "react";
import { Line, Radar, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale,
} from "chart.js";
import {
  Activity,
  TrendingUp,
  RotateCcw,
  Zap,
  Orbit,
  Clock,
  Calculator,
  Download,
  RotateCw,
} from "lucide-react";
import { issDataService } from "../services/ISSDataService";
import * as satellite from "satellite.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale
);

const TLEAnalysis = () => {
  const [tleData, setTleData] = useState(null);
  const [orbitalElements, setOrbitalElements] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState("24h");

  useEffect(() => {
    loadTLEData();
  }, []);

  useEffect(() => {
    if (tleData) {
      const satrec = satellite.twoline2satrec(tleData.line1, tleData.line2);
      const preds = generatePredictions(satrec, selectedTimeframe);
      setPredictions(preds);
    }
  }, [selectedTimeframe, tleData]);

  const loadTLEData = async () => {
    try {
      setLoading(true);
      setError(null);

      const tle = await issDataService.getTLEData();
      if (tle) {
        setTleData(tle);
        const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
        const elements = extractOrbitalElements(tle.line1, tle.line2);
        setOrbitalElements(elements);

        const preds = generatePredictions(satrec, selectedTimeframe);
        setPredictions(preds);
      }
    } catch (err) {
      setError(err.message);
      console.error("Error loading TLE data:", err);
    } finally {
      setLoading(false);
    }
  };

  const extractOrbitalElements = (line1, line2) => {
    const inclination = parseFloat(line2.substring(8, 16));
    const raan = parseFloat(line2.substring(17, 25));
    const eccentricity = parseFloat("0." + line2.substring(26, 33));
    const argPerigee = parseFloat(line2.substring(34, 42));
    const meanAnomaly = parseFloat(line2.substring(43, 51));
    const meanMotion = parseFloat(line2.substring(52, 63));
    const epochYear = parseInt(line1.substring(18, 20));

    const period = 1440 / meanMotion;
    const GMEarth = 398600.4418; // km^3/s^2
    const REarth = 6371; // km
    const meanMotionRadDay = meanMotion * 2 * Math.PI;
    const a = Math.cbrt(
      (GMEarth * (86400 * 86400)) / (meanMotionRadDay * meanMotionRadDay)
    );

    const apogee = a * (1 + eccentricity) - REarth;
    const perigee = a * (1 - eccentricity) - REarth;

    return {
      inclination,
      raan,
      eccentricity,
      argPerigee,
      meanAnomaly,
      meanMotion,
      period,
      apogee,
      perigee,
      epochYear: epochYear < 57 ? 2000 + epochYear : 1900 + epochYear,
    };
  };

  const generatePredictions = (satrec, timeframe) => {
    const predictions = [];
    let hours;
    let interval;

    if (timeframe === "24h") {
      hours = 24;
      interval = 10; // minutes
    } else if (timeframe === "7d") {
      hours = 168;
      interval = 60; // minutes
    } else {
      // "30d"
      hours = 720;
      interval = 360; // minutes (6 hours)
    }

    for (let i = 0; i < hours * 60; i += interval) {
      const time = new Date(Date.now() + i * 60000);
      const positionAndVelocity = satellite.propagate(satrec, time);

      if (positionAndVelocity.position) {
        const gmst = satellite.gstime(time);
        const geodetic = satellite.eciToGeodetic(
          positionAndVelocity.position,
          gmst
        );

        const altitude = geodetic.height;
        const velocity = positionAndVelocity.velocity
          ? Math.sqrt(
              Math.pow(positionAndVelocity.velocity.x, 2) +
                Math.pow(positionAndVelocity.velocity.y, 2) +
                Math.pow(positionAndVelocity.velocity.z, 2)
            ) * 3.6 // km/s to km/h conversion (approx)
          : 0;

        predictions.push({
          time: time.toISOString(),
          timestamp: time.getTime(),
          altitude,
          velocity,
          latitude: satellite.degreesLat(geodetic.latitude),
          longitude: satellite.degreesLong(geodetic.longitude),
        });
      }
    }

    return predictions;
  };

  const OrbitalElementsCard = () => {
    if (!orbitalElements) return null;

    return (
      <div className="tle-section orbital-elements-card">
        <h3>Current Orbital Elements</h3>
        <div className="elements-grid">
          <div className="element-item">
            <span className="element-label">Inclination</span>
            <span className="element-value">
              {orbitalElements.inclination.toFixed(4)}°
            </span>
          </div>
          <div className="element-item">
            <span className="element-label">Eccentricity</span>
            <span className="element-value">
              {orbitalElements.eccentricity.toFixed(6)}
            </span>
          </div>
          <div className="element-item">
            <span className="element-label">RAAN</span>
            <span className="element-value">
              {orbitalElements.raan.toFixed(4)}°
            </span>
          </div>
          <div className="element-item">
            <span className="element-label">Arg. of Perigee</span>
            <span className="element-value">
              {orbitalElements.argPerigee.toFixed(4)}°
            </span>
          </div>
          <div className="element-item">
            <span className="element-label">Mean Anomaly</span>
            <span className="element-value">
              {orbitalElements.meanAnomaly.toFixed(4)}°
            </span>
          </div>
          <div className="element-item">
            <span className="element-label">Mean Motion</span>
            <span className="element-value">
              {orbitalElements.meanMotion.toFixed(8)} rev/day
            </span>
          </div>
          <div className="element-item">
            <span className="element-label">Orbital Period</span>
            <span className="element-value">
              {orbitalElements.period.toFixed(2)} min
            </span>
          </div>
          <div className="element-item">
            <span className="element-label">Apogee</span>
            <span className="element-value">
              {orbitalElements.apogee.toFixed(1)} km
            </span>
          </div>
          <div className="element-item">
            <span className="element-label">Perigee</span>
            <span className="element-value">
              {orbitalElements.perigee.toFixed(1)} km
            </span>
          </div>
        </div>
      </div>
    );
  };

  const AltitudeChart = () => {
    if (predictions.length === 0) return null;

    const chartData = {
      labels: predictions.map((p) =>
        new Date(p.timestamp).toLocaleTimeString()
      ),
      datasets: [
        {
          label: "Altitude (km)",
          data: predictions.map((p) => p.altitude),
          borderColor: "#00ffff",
          backgroundColor: "rgba(0, 255, 255, 0.1)",
          borderWidth: 2,
          fill: true, // Requires Filler plugin
          tension: 0.4,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#ffffff" },
        },
        title: {
          display: true,
          text: "ISS Altitude Prediction",
          color: "#ffffff",
        },
      },
      scales: {
        x: {
          ticks: { color: "#ffffff" },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
        },
        y: {
          ticks: { color: "#ffffff" },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          title: {
            display: true,
            text: "Altitude (km)",
            color: "#ffffff",
          },
        },
      },
    };

    return (
      <div className="chart-container">
        <Line data={chartData} options={options} />
      </div>
    );
  };

  const VelocityChart = () => {
    if (predictions.length === 0) return null;

    const chartData = {
      labels: predictions.map((p) =>
        new Date(p.timestamp).toLocaleTimeString()
      ),
      datasets: [
        {
          label: "Velocity (km/h)",
          data: predictions.map((p) => p.velocity),
          borderColor: "#ffff00",
          backgroundColor: "rgba(255, 255, 0, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#ffffff" },
        },
        title: {
          display: true,
          text: "ISS Velocity Prediction",
          color: "#ffffff",
        },
      },
      scales: {
        x: {
          ticks: { color: "#ffffff" },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
        },
        y: {
          ticks: { color: "#ffffff" },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          title: {
            display: true,
            text: "Velocity (km/h)",
            color: "#ffffff",
          },
        },
      },
    };

    return (
      <div className="chart-container">
        <Line data={chartData} options={options} />
      </div>
    );
  };

  const OrbitRadarChart = () => {
    if (!orbitalElements) return null;

    const chartData = {
      labels: [
        "Inclination",
        "Eccentricity",
        "RAAN",
        "Arg. Perigee",
        "Mean Anomaly",
        "Mean Motion",
      ],
      datasets: [
        {
          label: "Orbital Parameters",
          data: [
            (orbitalElements.inclination / 180) * 100,
            orbitalElements.eccentricity * 10000,
            (orbitalElements.raan / 360) * 100,
            (orbitalElements.argPerigee / 360) * 100,
            (orbitalElements.meanAnomaly / 360) * 100,
            (orbitalElements.meanMotion / 20) * 100,
          ],
          backgroundColor: "rgba(0, 255, 255, 0.2)",
          borderColor: "#00ffff",
          borderWidth: 2,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#ffffff" },
        },
        title: {
          display: true,
          text: "Orbital Parameters Overview",
          color: "#ffffff",
        },
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { color: "#ffffff", backdropColor: "rgba(10, 10, 15, 0.8)" },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          angleLines: { color: "rgba(255, 255, 255, 0.1)" },
          pointLabels: {
            color: "#ffffff",
          },
        },
      },
    };

    return (
      <div className="chart-container">
        <Radar data={chartData} options={options} />
      </div>
    );
  };

  const TLERawData = () => {
    if (!tleData) return null;

    return (
      <div className="tle-section tle-raw-data">
        <h3>Two-Line Element Set</h3>
        <div className="tle-info">
          <div className="tle-meta">
            <span className="tle-label">Satellite:</span>
            <span className="tle-value">{tleData.name}</span>
          </div>
          <div className="tle-meta">
            <span className="tle-label">NORAD ID:</span>
            <span className="tle-value">{tleData.id}</span>
          </div>
          <div className="tle-meta">
            <span className="tle-label">TLE Timestamp:</span>
            <span className="tle-value">
              {new Date(tleData.tle_timestamp * 1000).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="tle-lines">
          <div className="tle-header">{tleData.header}</div>
          <div className="tle-line">
            <span className="line-number">1</span>
            <span className="line-content">{tleData.line1}</span>
          </div>
          <div className="tle-line">
            <span className="line-number">2</span>
            <span className="line-content">{tleData.line2}</span>
          </div>
        </div>

        <div className="tle-actions">
          <button
            className="tle-action-btn"
            onClick={() =>
              navigator.clipboard.writeText(
                `${tleData.header}\n${tleData.line1}\n${tleData.line2}`
              )
            }
          >
            <Download size={16} />
            Copy TLE
          </button>
          <button className="tle-action-btn" onClick={loadTLEData}>
            <RotateCw size={16} />
            Refresh TLE
          </button>
        </div>
      </div>
    );
  };

  const OrbitalStats = () => (
    <div className="tle-section stats-section">
      <h3>Orbital Statistics</h3>
      <div className="stats-grid">
        <div className="stat-card">
          <Orbit className="stat-icon" />
          <div className="stat-content">
            <span className="stat-label">Orbits per Day</span>
            <span className="stat-value">
              {orbitalElements ? orbitalElements.meanMotion.toFixed(2) : "0"}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <Clock className="stat-icon" />
          <div className="stat-content">
            <span className="stat-label">Period</span>
            <span className="stat-value">
              {orbitalElements
                ? `${orbitalElements.period.toFixed(1)} min`
                : "0 min"}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <TrendingUp className="stat-icon" />
          <div className="stat-content">
            <span className="stat-label">Apogee</span>
            <span className="stat-value">
              {orbitalElements
                ? `${orbitalElements.apogee.toFixed(0)} km`
                : "0 km"}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <Activity className="stat-icon" />
          <div className="stat-content">
            <span className="stat-label">Perigee</span>
            <span className="stat-value">
              {orbitalElements
                ? `${orbitalElements.perigee.toFixed(0)} km`
                : "0 km"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="tle-loading">
        <Calculator size={48} />
        <p>Loading TLE data and calculating orbital mechanics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tle-error">
        <h3>Error Loading TLE Data</h3>
        <p>{error}</p>
        <button onClick={loadTLEData} className="retry-btn">
          <RotateCcw size={16} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="tle-analysis-container">
      <div className="tle-header">
        <h2>TLE Data & Orbital Analysis</h2>
        <div className="timeframe-selector">
          <label>Prediction Timeframe:</label>
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
          >
            <option value="24h">24 Hours</option>
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
          </select>
        </div>
      </div>

      <div className="tle-grid">
        {/* The component functions now render their top-level class names */}
        <OrbitalElementsCard />
        <OrbitalStats />
        <TLERawData />

        {/* Row 2/3 Charts */}
        <div className="tle-section chart-section">
          <h3>Altitude Predictions</h3>
          <AltitudeChart />
        </div>

        <div className="tle-section chart-section">
          <h3>Velocity Predictions</h3>
          <VelocityChart />
        </div>

        <div
          className="tle-section chart-section"
          style={{ gridColumn: "1 / -1" }}
        >
          <h3>Orbital Parameters</h3>
          <OrbitRadarChart />
        </div>
      </div>
    </div>
  );
};

export default TLEAnalysis;
