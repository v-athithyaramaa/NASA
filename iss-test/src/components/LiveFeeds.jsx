import React, { useState } from "react";
import YouTube from "react-youtube";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCw,
  Settings,
  Globe,
  Satellite,
} from "lucide-react";

const LiveFeeds = () => {
  const [selectedFeed, setSelectedFeed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
const cameraFeeds = [
  {
    id: "iss-hdev",
    name: "ISS HD Earth Viewing (Official NASA Stream)",
    url: "iYmvCUonukw",
    icon: Globe,
  },
  {
    id: "nasa-tv",
    name: "NASA TV: Live ISS Mission Broadcast",
    url: "yf5cEJULZXk",
    icon: Satellite,
  },
  {
    id: "earth-observation",
    name: "Earth Observation Camera: Live ISS View",
    url: "fO9e9jnhYK8",
    icon: Globe,
  },
  {
    id: "alternate-earth-view",
    name: "ISS Alternate Earth Live Feed",
    url: "wQE_pVfv5nA",
    icon: Globe,
  },
];


  const currentFeed = cameraFeeds[selectedFeed];

  const handleFeedSelect = (index) => {
    setSelectedFeed(index);
    setIsPlaying(true);
    setIsMuted(true);
  };

  const togglePlay = () => setIsPlaying((prev) => !prev);
  const toggleMute = () => setIsMuted((prev) => !prev);

  const toggleFullscreen = () => {
    const wrapper = document.querySelector(".main-player-wrapper");
    if (!document.fullscreenElement) {
      wrapper?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const opts = {
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 1,
      controls: 0,
      mute: isMuted ? 1 : 0,
      rel: 0,
      modestbranding: 1,
      enablejsapi: 1,
      playsinline: 1,
    },
  };

  const FeedSelector = () => (
    <div className="feed-selector">
      <h3>Available Camera Feeds</h3>
      <div className="feed-grid">
        {cameraFeeds.map((feed, index) => {
          const IconComponent = feed.icon;
          const isActive = selectedFeed === index;
          return (
            <motion.div
              key={feed.id}
              className={`feed-card ${isActive ? "active" : ""}`}
              onClick={() => handleFeedSelect(index)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="feed-icon">
                <IconComponent size={24} />
              </div>
              <div className="feed-info">
                <h4>{feed.name}</h4>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  const PlayerControls = () => (
    <div
      className="player-controls"
      style={{
        display: "flex",
        gap: "10px",
        position: "absolute",
        bottom: "10px",
        left: "10px",
        zIndex: 10,
      }}
    >
      <button onClick={togglePlay} title={isPlaying ? "Pause" : "Play"}>
        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
      </button>
      <button onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>
      <button onClick={toggleFullscreen} title="Fullscreen">
        {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
      </button>
      <button onClick={() => window.location.reload()} title="Refresh">
        <RotateCw size={20} />
      </button>
      <button title="Settings">
        <Settings size={20} />
      </button>
    </div>
  );

  return (
    <div className={`live-feeds-container ${isFullscreen ? "fullscreen" : ""}`}>
      <h2>ISS Live Camera Feeds</h2>
      <div className="feeds-content" style={{ display: "flex", gap: "20px" }}>
        {/* Main Player */}
        <div className="main-player-wrapper" style={{ flex: 2, position: "relative" }}>
          <div
            className="main-player"
            style={{
              position: "relative",
              width: "100%",
              paddingTop: "56.25%", // 16:9 aspect ratio
            }}
          >
            <YouTube
              videoId={currentFeed.url}
              opts={opts}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
              }}
              onReady={(e) => {
                if (isPlaying) e.target.playVideo();
              }}
            />
            <PlayerControls />
          </div>
        </div>

        {/* Sidebar */}
        <div className="feeds-sidebar" style={{ flex: 1 }}>
          <FeedSelector />
        </div>
      </div>
    </div>
  );
};

export default LiveFeeds;
