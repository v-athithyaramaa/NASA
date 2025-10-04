import React, { useState } from "react";
import {
  Globe,
  History,
  Bot,
  Satellite,
  Users,
  Camera,
  Command,
  BarChart3,
  Gamepad2,
  Settings as SettingsIcon,
} from "lucide-react";
import ISSCommandCenter from "./components/ISSCommandCenter";
import ISSTracker from "./components/ISSTracker";
import NasaHistory from "./components/NasaHistory";
import NasaChatbot from "./components/NasaChatbot";
import CrewInfo from "./components/CrewInfo";
import LiveFeeds from "./components/LiveFeeds";
import TLEAnalysis from "./components/TLEAnalysis";
import InteractiveGames from "./components/InteractiveGames";
import Settings from "./components/Settings";
import "./App.css";
import { ToastContainer } from "react-toastify";
const Header = ({ activePage, setActivePage, onSettingsClick }) => {
  const navItems = [
    { id: "command", icon: Command, label: "Command Center" },
    { id: "games", icon: Gamepad2, label: "Training Games" },
    { id: "tracker", icon: Globe, label: "ISS Tracker" },
    { id: "crew", icon: Users, label: "Crew Info" },
    { id: "feeds", icon: Camera, label: "Live Feeds" },
    { id: "analysis", icon: BarChart3, label: "TLE Analysis" },
    { id: "history", icon: History, label: "NASA History" },
    { id: "chatbot", icon: Bot, label: "AI Assistant" },
  ];
  return (
    <header className="header">
      <nav className="nav-container">
        <div className="logo-container">
          <Satellite className="logo-icon" size={32} />
          <span>ISS Command Center</span>
        </div>
        <div className="nav-links">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`nav-button ${activePage === item.id ? "active" : ""}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
          {}
          <button
            onClick={onSettingsClick}
            className="nav-button settings-btn"
            title="Settings"
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </nav>
    </header>
  );
};
const Footer = () => (
  <footer className="footer">
    <div className="footer-content">
      <div className="footer-right">
        <p>Made with ❤️ by Athithya & Team</p>
      </div>
    </div>
  </footer>
);
export default function App() {
  const [activePage, setActivePage] = useState("command");
  const [showSettings, setShowSettings] = useState(false);
  const [userPreferences, setUserPreferences] = useState({});
  const handleSettingsClick = () => {
    setShowSettings(true);
  };
  const handleSettingsClose = () => {
    setShowSettings(false);
  };
  const handlePreferencesChange = (preferences) => {
    setUserPreferences(preferences);
  };
  const renderPage = () => {
    switch (activePage) {
      case "command":
        return <ISSCommandCenter />;
      case "games":
        return <InteractiveGames />;
      case "tracker":
        return <ISSTracker />;
      case "crew":
        return <CrewInfo crewData={[]} />;
      case "feeds":
        return <LiveFeeds />;
      case "analysis":
        return <TLEAnalysis />;
      case "history":
        return <NasaHistory />;
      case "chatbot":
        return <NasaChatbot />;
      default:
        return <ISSCommandCenter />;
    }
  };
  return (
    <div className="app-container">
      <Header
        activePage={activePage}
        setActivePage={setActivePage}
        onSettingsClick={handleSettingsClick}
      />
      <main className="main-content">{renderPage()}</main>
      <Footer />
      {}
      {showSettings && (
        <Settings
          onClose={handleSettingsClose}
          onPreferencesChange={handlePreferencesChange}
        />
      )}
      {}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </div>
  );
}
