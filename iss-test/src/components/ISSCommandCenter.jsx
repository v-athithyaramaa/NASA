import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Satellite,
  Users,
  Activity,
  MapPin,
  Zap,
  Eye,
  Maximize2,
  Minimize2,
  RotateCcw,
  Play,
  Pause,
} from "lucide-react";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { issDataService } from "../services/ISSDataService";
import ISSTracker3D from "./ISSTracker3D";
import ISSWorldMap from "./ISSWorldMap";
import CrewInfo from "./CrewInfo";
import LiveFeeds from "./LiveFeeds";
import TLEAnalysis from "./TLEAnalysis";
import moment from "moment-timezone";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);
const ISSCommandCenter = () => {
  const [issData, setIssData] = useState(null);
  const [crewData, setCrewData] = useState([]);
  const [trajectoryData, setTrajectoryData] = useState([]);
  const [solarActivity, setSolarActivity] = useState(null);
  const [isRealTime, setIsRealTime] = useState(true);
  const [selectedView, setSelectedView] = useState("3d");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [userLocation, setUserLocation] = useState({ lat: 0, lon: 0 });
  const [passData, setPassData] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const realTimeRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());
  useEffect(() => {
    initializeData();
    if (isRealTime) {
      startRealTimeUpdates();
    }
    getUserLocation();
    return () => {
      if (realTimeRef.current) {
        realTimeRef.current();
      }
    };
  }, [isRealTime]);
  const initializeData = async () => {
    try {
      const [position, crew, trajectory, solar] = await Promise.all([
        issDataService.getCurrentPosition(),
        issDataService.getCrewInfo(),
        issDataService.getTrajectoryData(),
        issDataService.getSolarActivity(),
      ]);
      setIssData(position);
      setCrewData(crew);
      setTrajectoryData(trajectory);
      setSolarActivity(solar);
      lastUpdateRef.current = Date.now();
    } catch (error) {
      console.error("Error initializing data:", error);
    }
  };
  const startRealTimeUpdates = () => {
    if (realTimeRef.current) {
      realTimeRef.current();
    }
    const mockUpdateInterval = setInterval(async () => {
      try {
        const position = await issDataService.getCurrentPosition();
        const crew = await issDataService.getCrewInfo();
        const timestamp = Date.now();
        setIssData(position);
        setCrewData(crew);
        lastUpdateRef.current = timestamp;
        checkForNotifications(position);
      } catch (error) {
        console.error("Real-time update failed:", error);
      }
    }, 30000);
    realTimeRef.current = () => clearInterval(mockUpdateInterval);
  };
  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          };
          setUserLocation(location);
          const passes = await issDataService.getPassTimes(
            location.lat,
            location.lon
          );
          setPassData(passes);
        },
        (error) => {
          console.warn("Geolocation error:", error);
          setUserLocation({ lat: 40.7128, lon: -74.006 });
        }
      );
    }
  };
  const checkForNotifications = (position) => {
    if (!userLocation.lat || !userLocation.lon) return;
    const distance = issDataService.calculateDistance(
      userLocation.lat,
      userLocation.lon,
      position.latitude,
      position.longitude
    );
    if (distance < 500) {
      const notification = {
        id: Date.now(),
        type: "proximity",
        message: `ISS is nearby! Distance: ${Math.round(distance)}km`,
        timestamp: Date.now(),
      };
      setNotifications((prev) => [...prev.slice(-4), notification]);
    }
  };
  const StatsCard = ({
    title,
    value,
    unit,
    icon: Icon,
    trend,
    color = "blue",
  }) => (
    <motion.div
      className={`stats-card stats-color-${color}`}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <div className="stats-header">
        <Icon className={`stats-icon stats-icon-color-${color}`} size={24} />
        <h3 className="stats-title">{title}</h3>
      </div>
      <div className="stats-content">
        <span className="stats-value">{value}</span>
        <span className="stats-unit">{unit}</span>
        {trend && (
          <span
            className={`stats-trend ${trend > 0 ? "positive" : "negative"}`}
          >
            {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </motion.div>
  );
  const ControlPanel = () => (
    <div className="control-panel">
      <div className="control-group">
        <button
          className={`control-btn ${isRealTime ? "active" : ""}`}
          onClick={() => setIsRealTime(!isRealTime)}
        >
          {isRealTime ? <Pause size={18} /> : <Play size={18} />}
          {isRealTime ? "Pause" : "Resume"} Updates
        </button>
        <button className="control-btn" onClick={initializeData}>
          <RotateCcw size={18} />
          Refresh Data
        </button>
        <button
          className="control-btn"
          onClick={() => setIsFullscreen(!isFullscreen)}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          {isFullscreen ? "Exit" : "Enter"} Fullscreen
        </button>
      </div>
      <div className="view-selector">
        {["3d", "map", "data"].map((view) => (
          <button
            key={view}
            className={`view-btn ${selectedView === view ? "active" : ""}`}
            onClick={() => setSelectedView(view)}
          >
            {view === "3d" && <Globe size={16} />}
            {view === "map" && <MapPin size={16} />}
            {view === "data" && <Activity size={16} />}
            {view.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
  const NotificationPanel = () => (
    <AnimatePresence>
      {notifications.length > 0 && (
        <motion.div
          className="notification-panel"
          initial={{ opacity: 0, x: 300 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 300 }}
        >
          <h4>Live Notifications</h4>
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              className="notification-item"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <span className="notification-time">
                {moment(notification.timestamp).format("HH:mm:ss")}
              </span>
              <span className="notification-message">
                {notification.message}
              </span>
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
  const renderMainView = () => {
    switch (selectedView) {
      case "3d":
        return (
          <ISSTracker3D
            issData={issData}
            trajectoryData={trajectoryData}
            userLocation={userLocation}
          />
        );
      case "map":
        return (
          <ISSWorldMap
            issData={issData}
            trajectoryData={trajectoryData}
            userLocation={userLocation}
            passData={passData}
          />
        );
      case "data":
        return (
          <div className="data-view-grid">
            <TLEAnalysis />
            <CrewInfo crewData={crewData} />
            <LiveFeeds />
          </div>
        );
      default:
        return null;
    }
  };
  if (!issData) {
    return (
      <div className="command-center-loading">
        <motion.div
          className="loading-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="loading-icon"
            animate={{
              rotate: 360,
              scale: [1, 1.1, 1],
            }}
            transition={{
              rotate: { duration: 2, repeat: Infinity, ease: "linear" },
              scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            <Satellite size={48} />
          </motion.div>
          <h2>ISS Command Center</h2>
          <p>Establishing connection to ISS...</p>
          <div className="loading-steps">
            <motion.div
              className="step"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              📡 Connecting to satellite network
            </motion.div>
            <motion.div
              className="step"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
            >
              🌍 Acquiring ISS position data
            </motion.div>
            <motion.div
              className="step"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
            >
              🚀 Loading mission parameters
            </motion.div>
          </div>
          <div className="loading-spinner"></div>
        </motion.div>
      </div>
    );
  }
  return (
    <div className={`iss-command-center ${isFullscreen ? "fullscreen" : ""}`}>
      {}
      <header className="command-header">
        <div className="header-left">
          <h1>ISS Command Center</h1>
          <span className="last-update">
            Last Update: {moment(lastUpdateRef.current).format("HH:mm:ss UTC")}
          </span>
        </div>
        <div className="header-stats">
          <StatsCard
            title="Altitude"
            value={Math.round(issData.altitude)}
            unit="km"
            icon={Activity}
            color="blue"
          />
          <StatsCard
            title="Velocity"
            value={Math.round(issData.velocity)}
            unit="km/h"
            icon={Zap}
            color="green"
          />
          <StatsCard
            title="Crew"
            value={crewData.length}
            unit="members"
            icon={Users}
            color="purple"
          />
          <StatsCard
            title="Visibility"
            value={issData.visibility}
            unit=""
            icon={Eye}
            color={issData.visibility === "daylight" ? "yellow" : "indigo"}
          />
        </div>
      </header>
      {}
      <ControlPanel />
      {}
      <main className="main-content-cc">
        <div className="main-view-container">{renderMainView()}</div>
        {}
        <aside className="side-panel">
          <div className="current-position-card">
            <h3>Current Position</h3>
            <div className="position-data">
              <div className="coord-item">
                <span className="label">Latitude:</span>
                <span className="value">{issData.latitude.toFixed(4)}°</span>
              </div>
              <div className="coord-item">
                <span className="label">Longitude:</span>
                <span className="value">{issData.longitude.toFixed(4)}°</span>
              </div>
              <div className="coord-item">
                <span className="label">Footprint:</span>
                <span className="value">
                  {Math.round(issData.footprint)} km
                </span>
              </div>
            </div>
          </div>
          {}
          {passData.length > 0 && (
            <div className="next-pass-card">
              <h3>Next Pass (Your Location)</h3>
              <div className="pass-info">
                <div className="pass-item">
                  <span className="label">Start Time:</span>
                  <span className="value">
                    {moment(passData[0].startTime).format("MMM DD, HH:mm")}
                  </span>
                </div>
                <div className="pass-item">
                  <span className="label">Duration:</span>
                  <span className="value">
                    {Math.round(passData[0].duration / 60)} min
                  </span>
                </div>
                <div className="pass-item">
                  <span className="label">Max Elevation:</span>
                  <span className="value">
                    {Math.round(passData[0].maxElevation)}°
                  </span>
                </div>
              </div>
            </div>
          )}
          {}
          {solarActivity && (
            <div className="solar-activity-card">
              <h3>Space Weather</h3>
              <div className="solar-data">
                <div className="solar-item">
                  <span className="label">Solar Flux:</span>
                  <span className="value">
                    {solarActivity[solarActivity.length - 1]?.flux || "N/A"}
                  </span>
                </div>
                {}
                <div className="solar-item">
                  <span className="label">K-index:</span>
                  <span className="value">
                    {Math.floor(Math.random() * 5) + 1}
                  </span>
                </div>
                <div className="solar-item">
                  <span className="label">Latest Flare:</span>
                  <span className="value">
                    {["C1.0", "M3.2", "X1.5"][Math.floor(Math.random() * 3)]}
                  </span>
                </div>
              </div>
            </div>
          )}
        </aside>
      </main>
      {}
      <NotificationPanel />
      {}
      <footer className="status-bar">
        <div className="status-left">
          <span
            className={`connection-status ${
              isRealTime ? "connected" : "disconnected"
            }`}
          >
            <span className="status-dot">●</span>{" "}
            {isRealTime ? "LIVE" : "PAUSED"}
          </span>
          <span className="data-source">Data: wheretheiss.at API</span>
        </div>
        <div className="status-right">
          <span className="mission-time">
            Mission Day:{" "}
            {Math.floor(
              (Date.now() - new Date("1998-11-20").getTime()) /
                (1000 * 60 * 60 * 24)
            )}
          </span>
        </div>
      </footer>
    </div>
  );
};
export default ISSCommandCenter;
