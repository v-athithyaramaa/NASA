import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";

import { motion, AnimatePresence } from "framer-motion";

import {
  Timer,
  Zap,
  Battery,
  Trophy,
  Activity,
  CheckCircle,
  Play,
  RotateCcw,
  Move,
  Settings,
  Target,
} from "lucide-react";

import {
  clamp,
  integrate,
  applyDrag,
  computeBuoyancy,
  calculateTetherForce,
  applyLunarGravity,
  checkCollision,
  constrainToBounds,
  distance,
} from "../utils/physics";

import {
  useKeyboardInput,
  calculateDirectionVector,
  VirtualJoystick,
  TouchActionButton,
} from "../utils/input.jsx";

import "./NBLTrainingSimulator.css";

const GAME_DURATION = {
  pool: 180,
  eva: 300,
  lunar: 240,
};

const BOUNDS = {
  minX: 25,

  maxX: 615,

  minY: 25,

  maxY: 355,
};

const RESOURCE_DRAIN = {
  pool: { oxygen: 0.08, power: 0.05 },

  eva: { oxygen: 0.12, power: 0.08 },

  lunar: { oxygen: 0.06, power: 0.04 },
};

const playSound = (type, enabled) => {
  if (!enabled) return;

  try {
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    const oscillator = audioContext.createOscillator();

    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);

    gainNode.connect(audioContext.destination);

    const sounds = {
      success: { freq: 600, duration: 0.2, type: "sine" },

      pickup: { freq: 800, duration: 0.15, type: "triangle" },

      complete: { freq: 523, duration: 0.5, type: "sine" },

      error: { freq: 200, duration: 0.3, type: "sawtooth" },

      warning: { freq: 300, duration: 0.1, type: "square" },

      boost: { freq: 1000, duration: 0.1, type: "sine" },
    };

    const sound = sounds[type] || sounds.success;

    oscillator.frequency.setValueAtTime(sound.freq, audioContext.currentTime);

    oscillator.type = sound.type;

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);

    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + sound.duration
    );

    oscillator.start(audioContext.currentTime);

    oscillator.stop(audioContext.currentTime + sound.duration);
  } catch (error) {
    console.warn("Audio playback failed:", error);
  }
};

const generatePoolObjectives = () => [
  {
    id: "hatch-ops",

    type: "sequence",

    pos: { x: 150, y: 120 },

    radius: 35,

    icon: "🔧",

    name: "Hatch Operations",

    steps: ["position", "unlock", "open"],

    currentStep: 0,

    completed: false,

    reward: 150,
  },

  {
    id: "tool-retrieval",

    type: "pickup",

    pos: { x: 490, y: 180 },

    radius: 25,

    icon: "🔨",

    name: "Tool Retrieval",

    completed: false,

    reward: 100,
  },

  {
    id: "sample-collection",

    type: "pickup",

    pos: { x: 320, y: 280 },

    radius: 25,

    icon: "🧪",

    name: "Sample Collection",

    completed: false,

    reward: 120,
  },

  {
    id: "maintenance-check",

    type: "sequence",

    pos: { x: 520, y: 310 },

    radius: 30,

    icon: "⚙️",

    name: "Maintenance Check",

    steps: ["inspect", "test", "verify"],

    currentStep: 0,

    completed: false,

    reward: 180,
  },
];

const generateEVAObjectives = () => [
  {
    id: "solar-repair",

    type: "sequence",

    pos: { x: 180, y: 100 },

    radius: 40,

    icon: "☀️",

    name: "Solar Panel Repair",

    steps: ["diagnose", "disconnect", "replace", "reconnect", "test"],

    currentStep: 0,

    completed: false,

    reward: 250,

    requiredTool: "multitool",
  },

  {
    id: "antenna-adjust",

    type: "sequence",

    pos: { x: 460, y: 130 },

    radius: 35,

    icon: "📡",

    name: "Antenna Adjustment",

    steps: ["position", "calibrate", "lock"],

    currentStep: 0,

    completed: false,

    reward: 200,

    requiredTool: "wrench",
  },

  {
    id: "cable-routing",

    type: "sequence",

    pos: { x: 350, y: 290 },

    radius: 30,

    icon: "🔌",

    name: "Cable Routing",

    steps: ["measure", "route", "secure"],

    currentStep: 0,

    completed: false,

    reward: 180,

    requiredTool: "cable-tool",
  },
];

const generateLunarObjectives = () => [
  {
    id: "mineral-sample-a",

    type: "pickup",

    pos: { x: 120, y: 250 },

    radius: 20,

    icon: "💎",

    name: "Mineral Sample A",

    value: 80,

    completed: false,

    reward: 80,
  },

  {
    id: "core-sample",

    type: "sequence",

    pos: { x: 300, y: 200 },

    radius: 25,

    icon: "🥄",

    name: "Core Drilling",

    steps: ["position", "drill", "extract"],

    currentStep: 0,

    completed: false,

    reward: 150,
  },

  {
    id: "mineral-sample-b",

    type: "pickup",

    pos: { x: 480, y: 280 },

    radius: 20,

    icon: "🔸",

    name: "Mineral Sample B",

    value: 60,

    completed: false,

    reward: 60,
  },

  {
    id: "equipment-setup",

    type: "sequence",

    pos: { x: 520, y: 150 },

    radius: 30,

    icon: "📋",

    name: "Equipment Setup",

    steps: ["unpack", "assemble", "test"],

    currentStep: 0,

    completed: false,

    reward: 120,
  },
];

export default function NBLTrainingSimulator() {
  const [mode, setMode] = useState("pool");

  const [gameState, setGameState] = useState("briefing");

  const [score, setScore] = useState(0);

  const [timeLeft, setTimeLeft] = useState(GAME_DURATION.pool);

  const [oxygen, setOxygen] = useState(100);

  const [power, setPower] = useState(100);

  const [soundEnabled, setSoundEnabled] = useState(true);

  const [weights, setWeights] = useState(0);

  const [floaties, setFloaties] = useState(0);

  const [buoyancyStatus, setBuoyancyStatus] = useState("neutral");

  const [_selectedTool, _setSelectedTool] = useState("multitool");

  const [tetherTension, setTetherTension] = useState(0);

  const [joystickInput, setJoystickInput] = useState({ x: 0, y: 0 });

  const [isActionPressed, setIsActionPressed] = useState(false);

  const [objectives, setObjectives] = useState([]);

  const [particles, setParticles] = useState([]);

  const playerRef = useRef({
    pos: { x: 320, y: 180 },

    vel: { x: 0, y: 0 },

    mass: 80,
  });

  const keys = useKeyboardInput();

  const rafRef = useRef(0);

  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    const generators = {
      pool: generatePoolObjectives,

      eva: generateEVAObjectives,

      lunar: generateLunarObjectives,
    };

    setObjectives(generators[mode]());

    setGameState("briefing");

    setScore(0);

    setTimeLeft(GAME_DURATION[mode]);

    setOxygen(100);

    setPower(100);

    setTetherTension(0);

    playerRef.current = {
      pos: { x: 320, y: 180 },

      vel: { x: 0, y: 0 },

      mass: 80,
    };
  }, [mode]);

  useEffect(() => {
    if (mode === "pool") {
      const { buoyancyStatus: status } = computeBuoyancy({
        mass: playerRef.current.mass,

        floaties,

        weights,
      });

      setBuoyancyStatus(status);
    }
  }, [mode, weights, floaties]);

  const createParticle = useCallback(
    (x, y, color = "#45b7d1", type = "pickup") => {
      const particleCount = type === "complete" ? 8 : 4;

      for (let i = 0; i < particleCount; i++) {
        const particle = {
          id: Date.now() + Math.random() + i,

          x,

          y,

          vx: (Math.random() - 0.5) * (type === "complete" ? 6 : 4),

          vy: (Math.random() - 0.5) * (type === "complete" ? 6 : 4) - 1,

          life: 1.0,

          color:
            type === "complete"
              ? ["#ffd700", "#ffed4e", "#96ceb4"][i % 3]
              : color,

          size:
            type === "complete" ? Math.random() * 4 + 3 : Math.random() * 3 + 2,
        };

        setParticles((prev) => [...prev, particle]);
      }

      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => p.id < Date.now() - 580));
      }, 600);
    },
    []
  );

  useEffect(() => {
    if (gameState !== "active") return;

    lastTimeRef.current = performance.now();

    const gameLoop = (currentTime) => {
      const deltaTime = Math.min(
        (currentTime - lastTimeRef.current) / 16.667,
        2
      );

      lastTimeRef.current = currentTime;

      const player = playerRef.current;

      const direction = calculateDirectionVector(keys, joystickInput);

      const moveForce = 0.8;

      let acceleration = {
        x: direction.x * moveForce,

        y: direction.y * moveForce,
      };

      switch (mode) {
        case "pool": {
          player.vel = applyDrag(player.vel, 0.88);

          break;
        }

        case "eva": {
          const anchorPos = { x: 320, y: 200 };

          const tetherForce = calculateTetherForce(
            player.pos,
            anchorPos,
            180,
            0.05
          );

          acceleration.x += tetherForce.x;

          acceleration.y += tetherForce.y + 0.06;

          setTetherTension(tetherForce.tension);

          player.vel = applyDrag(player.vel, 0.91);

          break;
        }

        case "lunar": {
          acceleration = applyLunarGravity(acceleration, 0.15);

          player.vel = applyDrag(player.vel, 0.95);

          break;
        }
      }

      const [newPos, newVel] = integrate(
        player.pos,
        player.vel,
        acceleration,
        deltaTime
      );

      player.pos = constrainToBounds(newPos, BOUNDS);

      player.vel = newVel;

      const drain = RESOURCE_DRAIN[mode];

      setOxygen((prev) => clamp(prev - drain.oxygen * deltaTime, 0, 100));

      setPower((prev) => clamp(prev - drain.power * deltaTime, 0, 100));

      setTimeLeft((prev) => Math.max(0, prev - 0.017 * deltaTime));

      const actionPressed = keys.current.action || isActionPressed;

      setObjectives((prevObjectives) => {
        return prevObjectives.map((obj) => {
          if (obj.completed) return obj;

          const isNear = checkCollision(player.pos, obj, 8);

          if (isNear && actionPressed) {
            if (obj.type === "pickup") {
              playSound("pickup", soundEnabled);

              createParticle(obj.pos.x, obj.pos.y, "#96ceb4", "pickup");

              setScore((prev) => prev + obj.reward);

              return { ...obj, completed: true };
            }

            if (obj.type === "sequence") {
              const nextStep = obj.currentStep + 1;

              const isComplete = nextStep >= obj.steps.length;

              if (isComplete) {
                playSound("complete", soundEnabled);

                createParticle(obj.pos.x, obj.pos.y, "#ffd700", "complete");

                setScore((prev) => prev + obj.reward);

                return {
                  ...obj,
                  completed: true,
                  currentStep: obj.steps.length,
                };
              } else {
                playSound("success", soundEnabled);

                createParticle(obj.pos.x, obj.pos.y, "#45b7d1", "pickup");

                return { ...obj, currentStep: nextStep };
              }
            }
          }

          return obj;
        });
      });

      const allCompleted = objectives.every((obj) => obj.completed);

      if (allCompleted && objectives.length > 0) {
        setGameState("completed");

        playSound("complete", soundEnabled);

        setTimeout(() => {
          createParticle(320, 180, "#ffd700", "complete");
        }, 200);

        return;
      }

      if (timeLeft <= 0 || oxygen <= 0) {
        setGameState("failed");

        playSound("error", soundEnabled);

        return;
      }

      if (oxygen < 20 && oxygen > 19.8) {
        playSound("warning", soundEnabled);
      }

      rafRef.current = requestAnimationFrame(gameLoop);
    };

    rafRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [
    gameState,
    mode,
    weights,
    floaties,
    joystickInput,
    isActionPressed,
    keys,
    soundEnabled,
    objectives,
    timeLeft,
    oxygen,
    createParticle,
  ]);

  const startGame = () => {
    setGameState("active");

    playSound("success", soundEnabled);

    lastTimeRef.current = performance.now();
  };

  const resetGame = () => {
    setMode(mode);
  };

  const changeMode = useCallback(
    (newMode) => {
      if (gameState === "active") {
        setGameState("briefing");
      }

      setMode(newMode);
    },
    [gameState]
  );

  const timeBonus = Math.max(0, Math.floor(timeLeft * 5));

  const oxygenBonus = Math.max(0, Math.floor(oxygen * 2));

  const powerBonus = Math.max(0, Math.floor(power * 1.5));

  const finalScore = score + timeBonus + oxygenBonus + powerBonus;

  const ModeSelector = useMemo(
    () => (
      <div className="nbl-mode-selector">
        {" "}
        {[
          { id: "pool", label: "Neutral Buoyancy Pool", icon: "🏊‍♂️" },

          { id: "eva", label: "EVA Training", icon: "🚀" },

          { id: "lunar", label: "Lunar Pool Scenario", icon: "🌙" },
        ].map(({ id, label, icon }) => (
          <button
            key={id}
            className={`mode-button ${mode === id ? "active" : ""}`}
            onClick={() => changeMode(id)}
            disabled={gameState === "active"}
          >
            <span className="mode-icon">{icon}</span>{" "}
            <span className="mode-label">{label}</span>{" "}
          </button>
        ))}{" "}
      </div>
    ),
    [mode, gameState, changeMode]
  );

  const GameHUD = useMemo(
    () => (
      <div className="nbl-hud">
        {" "}
        <div className="hud-primary">
          {" "}
          <div className="hud-item">
            <Timer size={16} />{" "}
            <span>
              {Math.floor(timeLeft / 60)}:
              {(timeLeft % 60).toFixed(0).padStart(2, "0")}
            </span>{" "}
          </div>{" "}
          <div className="hud-item">
            <Zap size={16} /> <span>O₂: {Math.round(oxygen)}%</span>{" "}
          </div>{" "}
          <div className="hud-item">
            <Battery size={16} /> <span>PWR: {Math.round(power)}%</span>{" "}
          </div>{" "}
          <div className="hud-item">
            <Trophy size={16} /> <span>Score: {score}</span>{" "}
          </div>{" "}
        </div>{" "}
        <div className="hud-secondary">
          {" "}
          {mode === "pool" && (
            <div className={`buoyancy-indicator ${buoyancyStatus}`}>
              <Activity size={16} /> <span>Buoyancy: {buoyancyStatus}</span>{" "}
            </div>
          )}{" "}
          {mode === "eva" && (
            <div className="tether-indicator">
              <Target size={16} />{" "}
              <span>Tether: {tetherTension > 0.5 ? "TAUT" : "OK"}</span>{" "}
            </div>
          )}{" "}
          {mode === "lunar" && (
            <div className="gravity-indicator">
              <Activity size={16} /> <span>Low Gravity</span>{" "}
            </div>
          )}{" "}
          <button
            className={`sound-toggle ${soundEnabled ? "enabled" : ""}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? "🔊" : "🔇"}{" "}
          </button>{" "}
        </div>{" "}
      </div>
    ),
    [
      timeLeft,
      oxygen,
      power,
      score,
      mode,
      buoyancyStatus,
      tetherTension,
      soundEnabled,
    ]
  );

  return (
    <div className={`nbl-simulator mode-${mode} state-${gameState}`}>
      {" "}
      <div className="nbl-header">
        <h1>🏊‍♂️ NBL Training Simulator</h1>{" "}
        <p>Neutral Buoyancy Laboratory - Astronaut Training Experience</p>{" "}
      </div>
      {ModeSelector}{" "}
      <div className="nbl-main">
        {" "}
        {gameState === "briefing" && (
          <div className="briefing-screen">
            {" "}
            <motion.div
              className="briefing-content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {" "}
              <h2>
                {mode === "pool"
                  ? "🏊‍♂️ Neutral Buoyancy Training"
                  : mode === "eva"
                  ? "🚀 EVA Repair Training"
                  : "🌙 Lunar Pool Exploration"}
              </h2>{" "}
              <div className="mission-overview">
                {" "}
                {mode === "pool" && (
                  <>
                    {" "}
                    <p>
                      Master underwater movement and buoyancy control in our
                      training pool.
                    </p>{" "}
                    <ul>
                      {" "}
                      <li>
                        Use <strong>WASD</strong> or joystick to swim
                      </li>{" "}
                      <li>
                        Adjust <strong>weights</strong> and{" "}
                        <strong>floaties</strong> for neutral buoyancy
                      </li>{" "}
                      <li>
                        Press <strong>Space</strong> or tap action button to
                        interact with objectives
                      </li>{" "}
                      <li>Complete all training tasks before time runs out</li>{" "}
                    </ul>{" "}
                  </>
                )}{" "}
                {mode === "eva" && (
                  <>
                    {" "}
                    <p>
                      Practice spacewalk procedures and repairs while tethered
                      to the ISS.
                    </p>{" "}
                    <ul>
                      {" "}
                      <li>
                        Use <strong>WASD</strong> or joystick to maneuver in
                        space
                      </li>{" "}
                      <li>
                        Stay within <strong>tether limits</strong> (safety line)
                      </li>{" "}
                      <li>Complete multi-step procedures at each station</li>{" "}
                      <li>Manage oxygen and power while working</li>{" "}
                    </ul>{" "}
                  </>
                )}{" "}
                {mode === "lunar" && (
                  <>
                    {" "}
                    <p>
                      Experience low-gravity lunar surface operations in the
                      training pool.
                    </p>{" "}
                    <ul>
                      {" "}
                      <li>
                        Use <strong>WASD</strong> to move in 1/6 gravity
                      </li>{" "}
                      <li>
                        Press <strong>Space</strong> for low-gravity jumps
                      </li>{" "}
                      <li>Collect samples and set up equipment</li>
                      <li>Adapt to momentum in low gravity</li>{" "}
                    </ul>{" "}
                  </>
                )}{" "}
              </div>{" "}
              {mode === "pool" && (
                <div className="buoyancy-controls">
                  <h3>Buoyancy Setup</h3>{" "}
                  <div className="control-grid">
                    {" "}
                    <div className="control-group">
                      <label>Weights: {weights}</label>{" "}
                      <input
                        type="range"
                        min="0"
                        max="8"
                        value={weights}
                        onChange={(e) => setWeights(parseInt(e.target.value))}
                      />{" "}
                    </div>{" "}
                    <div className="control-group">
                      <label>Floaties: {floaties}</label>{" "}
                      <input
                        type="range"
                        min="0"
                        max="8"
                        value={floaties}
                        onChange={(e) => setFloaties(parseInt(e.target.value))}
                      />{" "}
                    </div>{" "}
                  </div>{" "}
                  <div className={`buoyancy-status ${buoyancyStatus}`}>
                    Status: {buoyancyStatus.toUpperCase()}{" "}
                  </div>{" "}
                </div>
              )}{" "}
              <div className="objectives-preview">
                {" "}
                <h3>Training Objectives ({objectives.length})</h3>{" "}
                <div className="objectives-grid">
                  {" "}
                  {objectives.map((obj) => (
                    <div key={obj.id} className="objective-preview">
                      {" "}
                      <span className="obj-icon">{obj.icon}</span>
                      <span className="obj-name">{obj.name}</span>{" "}
                      <span className="obj-reward">{obj.reward} pts</span>{" "}
                    </div>
                  ))}{" "}
                </div>{" "}
              </div>{" "}
              <button className="start-training-btn" onClick={startGame}>
                <Play size={20} /> Begin Training{" "}
              </button>{" "}
            </motion.div>{" "}
          </div>
        )}{" "}
        {gameState === "active" && (
          <div className="training-active">
            {GameHUD}{" "}
            <div className="training-environment">
              <div className={`parallax-bg parallax-${mode}`} />
              {}{" "}
              <motion.div
                className="astronaut-avatar"
                style={{
                  left: playerRef.current.pos.x,

                  top: playerRef.current.pos.y,
                }}
                animate={{
                  rotate: playerRef.current.vel.x * 2,

                  scale: [1, 1.02, 1],
                }}
                transition={{
                  rotate: { duration: 0.1 },

                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                }}
              >
                {" "}
                <div className="avatar-sprite">
                  {" "}
                  {mode === "pool" ? "🏊‍♂️" : mode === "eva" ? "👨‍🚀" : "🧑‍🚀"}{" "}
                </div>{" "}
              </motion.div>
              {}{" "}
              {mode === "eva" && (
                <div
                  className="tether-line"
                  style={{
                    position: "absolute",

                    left: 320,

                    top: 200,

                    width: distance({ x: 320, y: 200 }, playerRef.current.pos),

                    height: 2,

                    background: `linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0.3))`,

                    transformOrigin: "left center",

                    transform: `rotate(${Math.atan2(
                      playerRef.current.pos.y - 200,

                      playerRef.current.pos.x - 320
                    )}rad)`,
                  }}
                />
              )}
              {}{" "}
              {objectives.map((obj) => (
                <motion.div
                  key={obj.id}
                  className={`objective-marker ${
                    obj.completed ? "completed" : "active"
                  } ${obj.type}`}
                  style={{
                    left: obj.pos.x,

                    top: obj.pos.y,
                  }}
                  animate={
                    obj.completed
                      ? {}
                      : {
                          scale: [1, 1.1, 1],

                          opacity: [0.8, 1, 0.8],
                        }
                  }
                  transition={{
                    duration: 1.5,

                    repeat: Infinity,

                    ease: "easeInOut",
                  }}
                >
                  {" "}
                  <div className="objective-icon">
                    {" "}
                    {obj.completed ? <CheckCircle size={24} /> : obj.icon}{" "}
                  </div>{" "}
                  <div className="objective-info">
                    {" "}
                    <div className="objective-name">{obj.name}</div>{" "}
                    {obj.type === "sequence" && !obj.completed && (
                      <div className="objective-progress">
                        Step {obj.currentStep + 1}/{obj.steps.length}{" "}
                      </div>
                    )}{" "}
                  </div>{" "}
                </motion.div>
              ))}{" "}
              {}{" "}
              <AnimatePresence>
                {" "}
                {particles.map((particle) => (
                  <motion.div
                    key={particle.id}
                    className="particle"
                    style={{
                      position: "absolute",

                      left: particle.x,

                      top: particle.y,

                      width: particle.size || 6,

                      height: particle.size || 6,

                      borderRadius: "50%",

                      background: particle.color,

                      pointerEvents: "none",

                      boxShadow: `0 0 ${(particle.size || 6) * 2}px ${
                        particle.color
                      }`,
                    }}
                    initial={{ opacity: 1, scale: 0.5 }}
                    animate={{
                      opacity: 0,

                      scale: 1.5,

                      x: particle.vx * 25,

                      y: particle.vy * 25,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                ))}{" "}
              </AnimatePresence>
              {}{" "}
              <div className="controls-guide">
                {" "}
                <div className="guide-item">
                  <Move size={16} /> <span>WASD / Joystick: Move</span>{" "}
                </div>{" "}
                <div className="guide-item">
                  <span>⎵</span> <span>Space / Action: Interact</span>{" "}
                </div>{" "}
                <div className="objectives-counter">
                  Objectives: {objectives.filter((o) => o.completed).length}/
                  {objectives.length}{" "}
                </div>{" "}
              </div>{" "}
            </div>
            {}{" "}
            <div className="touch-controls">
              {" "}
              <VirtualJoystick
                onChange={setJoystickInput}
                size={100}
                className="movement-joystick"
              />{" "}
              <TouchActionButton
                onPress={() => setIsActionPressed(true)}
                onRelease={() => setIsActionPressed(false)}
                className="action-button"
              >
                ⎵{" "}
              </TouchActionButton>{" "}
            </div>{" "}
          </div>
        )}{" "}
        {(gameState === "completed" || gameState === "failed") && (
          <div className="results-screen">
            {" "}
            <motion.div
              className="results-content"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
            >
              {" "}
              <h2>
                {" "}
                {gameState === "completed"
                  ? "🎯 Training Complete!"
                  : "💥 Training Failed"}{" "}
              </h2>{" "}
              {gameState === "completed" && (
                <div className="success-stats">
                  {" "}
                  <div className="completion-badge">
                    {" "}
                    {objectives.filter((o) => o.completed).length ===
                    objectives.length
                      ? "⭐ PERFECT MISSION ⭐"
                      : "✨ MISSION ACCOMPLISHED ✨"}{" "}
                  </div>{" "}
                  <div className="score-breakdown">
                    {" "}
                    <div className="score-item">
                      <span>Objectives:</span>
                      <span>{score} pts</span>{" "}
                    </div>{" "}
                    <div className="score-item">
                      <span>Time Bonus:</span>    <span>+{timeBonus} pts</span> 
                                     {" "}
                    </div>
                                       {" "}
                    <div className="score-item">
                                            <span>Oxygen Bonus:</span>         
                        <span>+{oxygenBonus} pts</span>   {" "}
                    </div>
                                       {" "}
                    <div className="score-item">
                                            <span>Power Bonus:</span>         {" "}
                      <span>+{powerBonus} pts</span> {" "}
                    </div>
                                       {" "}
                    <div className="score-item total">
                                            <span>Final Score:</span>         {" "}
                      <span>{finalScore} pts</span>                   {" "}
                    </div>
                                     {" "}
                  </div>
                                 {" "}
                </div>
              )}
                                         {" "}
              {gameState === "failed" && (
                <div className="failure-stats">
                                    <p>Training session ended due to:</p>       
                   {" "}
                  <ul>
                                       {" "}
                    {timeLeft <= 0 && <li>⏰ Time expired</li>} {" "}
                    {oxygen <= 0 && <li>🫁 Oxygen depleted</li>}   {" "}
                  </ul>
                                    <p>Review procedures and try again.</p>     
                     {" "}
                </div>
              )}
                                         {" "}
              <div className="results-actions">
                               {" "}
                <button className="retry-btn" onClick={resetGame}>
                                    <RotateCcw size={20} />
                  Retry Training                {" "}
                </button>
                               {" "}
                <button
                  className="mode-btn"
                  onClick={() => setGameState("briefing")}
                >
                                    <Settings size={20} />
                  Change Mode                {" "}
                </button>
                             {" "}
              </div>
                         {" "}
            </motion.div>
                     {" "}
          </div>
        )}
             {" "}
      </div>
         {" "}
    </div>
  );
}
