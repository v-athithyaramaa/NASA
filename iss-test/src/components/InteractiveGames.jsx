import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import Confetti from "react-confetti";
import {
  Gamepad2,
  Target,
  Trophy,
  Timer,
  Zap,
  Wrench,
  Package,
  AlertTriangle,
  CheckCircle,
  Star,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Award,
  Medal,
  Crown,
  Flame,
  MousePointer,
  Box,
  Move,
  Rocket,
  Battery,
  Activity,
  Map,
  Crosshair,
  Shield,
  Clock,
} from "lucide-react";
import "./InteractiveGames.css";

const MotionDiv = motion.div;

const VirtualJoystick = ({ onChange, size = 120 }) => {
  const baseRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const clampVec = (x, y, r) => {
    const d = Math.hypot(x, y);
    if (d <= r) return { x, y };
    const k = r / d;
    return { x: x * k, y: y * k };
  };

  const handlePointer = (clientX, clientY, release = false) => {
    const rect = baseRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const radius = size / 2 - 20;
    if (release) {
      setKnob({ x: 0, y: 0 });
      onChange?.({ x: 0, y: 0 });
      return;
    }
    const clamped = clampVec(dx, dy, radius);
    setKnob(clamped);
    const nx = clamped.x / radius;
    const ny = -(clamped.y / radius);
    onChange?.({ x: nx, y: ny });
  };

  return (
    <div
      className="virtual-joystick"
      style={{ width: size, height: size }}
      ref={baseRef}
      onPointerDown={(e) => {
        setDragging(true);
        handlePointer(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        handlePointer(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        setDragging(false);
        handlePointer(e.clientX, e.clientY, true);
      }}
      onPointerLeave={() => {
        if (dragging) {
          setDragging(false);
          handlePointer(0, 0, true);
        }
      }}
    >
      <div className="joystick-base" />
      <div
        className="joystick-knob"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
};

const GAME_DURATION_SEC = {
  "buoyancy-control": 120,
  "spacewalk-repair": 300,
  "lunar-collection": 180,
  "equipment-install": 240,
  "emergency-response": 240,
};

const playSound = (type, soundEnabled) => {
  if (!soundEnabled) return;

  try {
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    switch (type) {
      case "success":
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(
          1000,
          audioContext.currentTime + 0.1
        );
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        break;
      case "warning":
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(520, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(
          440,
          audioContext.currentTime + 0.08
        );
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        break;
      case "error":
        oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(
          200,
          audioContext.currentTime + 0.1
        );
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        break;
      case "click":
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        break;
      case "boost":
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(700, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(
          900,
          audioContext.currentTime + 0.05
        );
        gainNode.gain.setValueAtTime(0.12, audioContext.currentTime);
        break;
      case "pickup":
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(
          880,
          audioContext.currentTime + 0.05
        );
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        break;
      case "complete":
        oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(
          659,
          audioContext.currentTime + 0.1
        );
        oscillator.frequency.setValueAtTime(
          784,
          audioContext.currentTime + 0.2
        );
        gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
        break;
      default:
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    }

    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.3
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.warn("Audio context error:", error);
  }
};

const distance = (p1, p2) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

const clamp = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};

const BuoyancyGame = ({ gameId, onComplete, soundEnabled }) => {
  const [gameState, setGameState] = useState("setup");
  const [astronautPos, setAstronautPos] = useState({ x: 10, y: 50 });
  const [astronautVelocity, setAstronautVelocity] = useState({ x: 0, y: 0 });
  const [joystickDir, setJoystickDir] = useState({ x: 0, y: 0 });
  const [weights, setWeights] = useState([]);
  const [floaties, setFloaties] = useState([]);
  const [buoyancy, setBuoyancy] = useState(0);
  const [oxygen, setOxygen] = useState(100);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SEC[gameId]);
  const [particles, setParticles] = useState([]);
  const lastWarnRef = useRef(0);

  const [tasks, setTasks] = useState([
    {
      id: 1,
      x: 25,
      y: 30,
      completed: false,
      type: "tool",
      name: "Collect Tools",
      icon: "🔧",
    },
    {
      id: 2,
      x: 75,
      y: 70,
      completed: false,
      type: "sample",
      name: "Water Sample",
      icon: "🧪",
    },
    {
      id: 3,
      x: 60,
      y: 20,
      completed: false,
      type: "repair",
      name: "Fix Module",
      icon: "⚙️",
    },
    {
      id: 4,
      x: 40,
      y: 80,
      completed: false,
      type: "inspect",
      name: "Inspection",
      icon: "🔍",
    },
  ]);

  const [keysPressed, setKeysPressed] = useState({});
  const animationRef = useRef(null);
  const lastTimeRef = useRef(Date.now());

  const PHYSICS = useMemo(
    () => ({
      moveSpeed: 0.8,
      friction: 0.92,
      buoyancyForce: 0.03,
      maxVelocity: 2.5,
      collisionRadius: 2.5,
    }),
    []
  );

  const endGame = useCallback(() => {
    if (gameState === "completed") return;

    const completedTasks = tasks.filter((t) => t.completed).length;
    const timeBonus = timeLeft * 10;
    const oxygenBonus = Math.round(oxygen * 5);
    const completionBonus = completedTasks === tasks.length ? 1000 : 0;
    const finalScore = score + timeBonus + oxygenBonus + completionBonus;

    setGameState("completed");
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    playSound("complete", soundEnabled);
    onComplete(finalScore);
  }, [gameState, tasks, timeLeft, oxygen, score, soundEnabled, onComplete]);

  useEffect(() => {
    if (gameState !== "playing") return;

    const gameLoop = () => {
      const now = Date.now();
      const deltaTime = (now - lastTimeRef.current) / 16.67;
      lastTimeRef.current = now;

      setAstronautPos((prevPos) => {
        let newVel = { ...astronautVelocity };

        if (keysPressed["w"] || keysPressed["ArrowUp"])
          newVel.y -= PHYSICS.moveSpeed * deltaTime;
        if (keysPressed["s"] || keysPressed["ArrowDown"])
          newVel.y += PHYSICS.moveSpeed * deltaTime;
        if (keysPressed["a"] || keysPressed["ArrowLeft"])
          newVel.x -= PHYSICS.moveSpeed * deltaTime;
        if (keysPressed["d"] || keysPressed["ArrowRight"])
          newVel.x += PHYSICS.moveSpeed * deltaTime;

        if (Math.abs(joystickDir.x) > 0.05 || Math.abs(joystickDir.y) > 0.05) {
          newVel.x += joystickDir.x * PHYSICS.moveSpeed * deltaTime;
          newVel.y -= joystickDir.y * PHYSICS.moveSpeed * deltaTime;
        }

        newVel.y += buoyancy * PHYSICS.buoyancyForce * deltaTime;

        newVel.x *= PHYSICS.friction;
        newVel.y *= PHYSICS.friction;

        const speed = Math.sqrt(newVel.x * newVel.x + newVel.y * newVel.y);
        if (speed > PHYSICS.maxVelocity) {
          newVel.x = (newVel.x / speed) * PHYSICS.maxVelocity;
          newVel.y = (newVel.y / speed) * PHYSICS.maxVelocity;
        }

        setAstronautVelocity(newVel);

        let newPos = {
          x: clamp(prevPos.x + newVel.x, 3, 97),
          y: clamp(prevPos.y + newVel.y, 3, 97),
        };

        tasks.forEach((task) => {
          if (
            !task.completed &&
            distance(newPos, task) < PHYSICS.collisionRadius
          ) {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === task.id ? { ...t, completed: true } : t
              )
            );
            setScore((prev) => prev + 300);
            playSound("pickup", soundEnabled);

            const burstId = Date.now();
            const createBurst = Array.from({ length: 10 }).map((_, i) => ({
              id: `${burstId}-${i}`,
              x: newPos.x,
              y: newPos.y,
              angle: (i / 10) * Math.PI * 2,
              dist: 3 + Math.random() * 4,
            }));
            setParticles((prev) => [...prev, ...createBurst]);
            setTimeout(() => {
              setParticles((prev) =>
                prev.filter((p) => !String(p.id).startsWith(String(burstId)))
              );
            }, 700);

            const remainingTasks = tasks.filter(
              (t) => t.id !== task.id && !t.completed
            );
            if (remainingTasks.length === 0) {
              setTimeout(endGame, 500);
            }
          }
        });

        return newPos;
      });

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    gameState,
    keysPressed,
    astronautVelocity,
    buoyancy,
    tasks,
    soundEnabled,
    endGame,
    PHYSICS,
    joystickDir,
  ]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(key)
      ) {
        e.preventDefault();
        setKeysPressed((prev) => ({ ...prev, [key]: true }));
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(key)
      ) {
        e.preventDefault();
        setKeysPressed((prev) => ({ ...prev, [key]: false }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (gameState === "playing") {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            endGame();
            return 0;
          }
          return newTime;
        });

        setOxygen((prev) => {
          const newOxygen = Math.max(0, prev - 0.08);

          if (newOxygen < 20) {
            const now = Date.now();
            if (now - lastWarnRef.current > 2000) {
              playSound("warning", soundEnabled);
              lastWarnRef.current = now;
            }
          }
          if (newOxygen <= 0) {
            endGame();
          }
          return newOxygen;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [gameState, endGame, soundEnabled]);

  useEffect(() => {
    const totalWeight = weights.reduce((sum, w) => sum + w.value, 0);
    const totalFloat = floaties.reduce((sum, f) => sum + f.value, 0);
    setBuoyancy(totalFloat - totalWeight);
  }, [weights, floaties]);

  const addWeight = () => {
    if (weights.length < 4) {
      setWeights((prev) => [...prev, { id: Date.now(), value: 12 }]);
      playSound("click", soundEnabled);
    }
  };

  const addFloatie = () => {
    if (floaties.length < 4) {
      setFloaties((prev) => [...prev, { id: Date.now(), value: 15 }]);
      playSound("click", soundEnabled);
    }
  };

  const removeWeight = (id) => {
    setWeights((prev) => prev.filter((w) => w.id !== id));
    playSound("click", soundEnabled);
  };

  const removeFloatie = (id) => {
    setFloaties((prev) => prev.filter((f) => f.id !== id));
    playSound("click", soundEnabled);
  };

  const startGame = () => {
    if (Math.abs(buoyancy) <= 8) {
      setGameState("playing");
      setScore(0);
      setOxygen(100);
      setTimeLeft(GAME_DURATION_SEC[gameId]);
      setTasks((prev) => prev.map((t) => ({ ...t, completed: false })));
      playSound("success", soundEnabled);
      lastTimeRef.current = Date.now();
    } else {
      playSound("error", soundEnabled);
    }
  };

  const buoyancyStatus =
    Math.abs(buoyancy) <= 8 ? "neutral" : buoyancy > 8 ? "floating" : "sinking";
  const isReady = Math.abs(buoyancy) <= 8;

  if (gameState === "setup") {
    return (
      <div className="buoyancy-game">
        <div className="setup-phase">
          <h3>🌊 Neutral Buoyancy Configuration</h3>
          <p>
            Balance your equipment to achieve neutral buoyancy (target: -8 to
            +8)
          </p>

          <div className={`buoyancy-display ${buoyancyStatus}`}>
            <div className="buoyancy-meter">
              <div className="meter-bar">
                <div
                  className="meter-fill"
                  style={{
                    width: `${Math.min(100, Math.abs(buoyancy) * 2)}%`,
                    backgroundColor: isReady ? "#4ecdc4" : "#ff6b6b",
                  }}
                />
              </div>
              <div className="buoyancy-value">
                Buoyancy: {buoyancy > 0 ? "+" : ""}
                {buoyancy}
                <span className="status">({buoyancyStatus})</span>
              </div>
            </div>
          </div>

          <div className="equipment-controls">
            <div className="control-section">
              <h4>⚖️ Weights (-12 each, Max 4)</h4>
              <div className="control-buttons">
                <button onClick={addWeight} disabled={weights.length >= 4}>
                  Add Weight ({weights.length}/4)
                </button>
              </div>
              <div className="items-display">
                {weights.map((weight) => (
                  <motion.div
                    key={weight.id}
                    className="item weight-item"
                    whileHover={{ scale: 1.1 }}
                    onClick={() => removeWeight(weight.id)}
                  >
                    ⚖️
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="control-section">
              <h4>🎈 Buoyancy Aids (+15 each, Max 4)</h4>
              <div className="control-buttons">
                <button onClick={addFloatie} disabled={floaties.length >= 4}>
                  Add Floatie ({floaties.length}/4)
                </button>
              </div>
              <div className="items-display">
                {floaties.map((floatie) => (
                  <motion.div
                    key={floatie.id}
                    className="item floatie-item"
                    whileHover={{ scale: 1.1 }}
                    onClick={() => removeFloatie(floatie.id)}
                  >
                    🎈
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          <div className="mission-objectives">
            <h4>Mission Objectives:</h4>
            <ul>
              {tasks.map((task) => (
                <li key={task.id}>
                  {task.icon} {task.name}
                </li>
              ))}
            </ul>
          </div>

          <button
            className={`start-mission-btn ${isReady ? "ready" : "not-ready"}`}
            onClick={startGame}
            disabled={!isReady}
          >
            {isReady ? "🚀 Begin Mission" : `Adjust Buoyancy (${buoyancy})`}
          </button>
        </div>
      </div>
    );
  }

  if (gameState === "playing") {
    return (
      <div className="buoyancy-game active">
        <div className="game-hud">
          <div className="hud-item">
            <Timer size={16} />
            {Math.floor(timeLeft / 60)}:
            {(timeLeft % 60).toString().padStart(2, "0")}
          </div>
          <div className="hud-item">
            <Zap size={16} />
            O₂: {Math.round(oxygen)}%
          </div>
          <div className="hud-item">
            <Trophy size={16} />
            Score: {score}
          </div>
          <div className={`hud-item buoyancy-indicator ${buoyancyStatus}`}>
            <Activity size={16} />
            Buoyancy: {buoyancy > 0 ? "+" : ""}
            {buoyancy}
          </div>
        </div>

        <div className="pool-environment">
          <div className="underwater-scene">
            {}
            <div
              className="parallax-bg"
              style={{
                transform: `translate(${(astronautPos.x - 50) * -0.3}%, ${
                  (astronautPos.y - 50) * -0.3
                }%)`,
              }}
            />
            {}
            <motion.div
              className="astronaut-avatar"
              style={{
                left: `${astronautPos.x}%`,
                top: `${astronautPos.y}%`,
                transform: `rotate(${astronautVelocity.x * 5}deg)`,
              }}
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              🧑‍🚀
            </motion.div>

            {}
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                className={`task-point ${
                  task.completed ? "completed" : "active"
                }`}
                style={{ left: `${task.x}%`, top: `${task.y}%` }}
                animate={
                  task.completed
                    ? {}
                    : {
                        scale: [1, 1.2, 1],
                        opacity: [0.8, 1, 0.8],
                      }
                }
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <div className="task-icon">
                  {task.completed ? <CheckCircle size={20} /> : task.icon}
                </div>
                <div className="task-label">{task.name}</div>
              </motion.div>
            ))}

            {}
            {particles.map((p) => (
              <motion.div
                key={p.id}
                style={{
                  position: "absolute",
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#96ceb4",
                  transform: "translate(-50%, -50%)",
                }}
                initial={{ opacity: 0.9 }}
                animate={{
                  left: `${p.x + Math.cos(p.angle) * p.dist}%`,
                  top: `${p.y + Math.sin(p.angle) * p.dist}%`,
                  opacity: 0,
                }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            ))}

            {}
            <div className="pool-structures">
              <div className="iss-mockup" style={{ left: "35%", top: "55%" }}>
                🚀
              </div>
              <div
                className="equipment-rack"
                style={{ left: "70%", top: "25%" }}
              >
                �
              </div>
              <div
                className="observation-window"
                style={{ left: "15%", top: "80%" }}
              >
                🪟
              </div>
            </div>

            {}
            <div className="bubble-effects">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="bubble"
                  style={{
                    left: `${15 + i * 15}%`,
                    animationDelay: `${i * 0.5}s`,
                  }}
                  animate={{
                    y: [-20, -100],
                    opacity: [0, 1, 0],
                    scale: [0.5, 1, 0.3],
                  }}
                  transition={{
                    duration: 3 + i,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="controls-info">
            <div className="control-hint">
              <Move size={16} />
              Use WASD or Arrow Keys to navigate
            </div>
            <div className="tasks-remaining">
              Tasks: {tasks.filter((t) => !t.completed).length}/{tasks.length}
            </div>
          </div>

          {}
          <div className="mobile-controls">
            <VirtualJoystick onChange={setJoystickDir} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-results">
      {}
      <div className="completion-sparks">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className="spark"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{
              opacity: [0, 1, 0],
              y: [-10, -30, -50],
              scale: [0.6, 1, 0.4],
            }}
            transition={{
              duration: 1.2 + i * 0.05,
              repeat: Infinity,
              delay: i * 0.05,
            }}
          />
        ))}
      </div>
      <motion.div
        className="results-content"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h3>🎯 Mission Complete!</h3>
        <div className="final-statistics">
          <div className="stat-row">
            <span>Tasks Completed:</span>
            <span>
              {tasks.filter((t) => t.completed).length}/{tasks.length}
            </span>
          </div>
          <div className="stat-row">
            <span>Time Bonus:</span>
            <span>{timeLeft * 10} pts</span>
          </div>
          <div className="stat-row">
            <span>Oxygen Bonus:</span>
            <span>{Math.round(oxygen * 5)} pts</span>
          </div>
          <div className="stat-row total">
            <span>Final Score:</span>
            <span>{score + timeLeft * 10 + Math.round(oxygen * 5)}</span>
          </div>
        </div>
        <div className="performance-rating">
          {tasks.filter((t) => t.completed).length === tasks.length ? (
            <div className="perfect-score">⭐ Perfect Mission! ⭐</div>
          ) : (
            <div className="good-score">✨ Well Done! ✨</div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const SpacewalkRepairGame = ({ gameId, onComplete, soundEnabled }) => {
  const [gameState, setGameState] = useState("briefing");
  const [astronautPos] = useState({ x: 5, y: 50 });
  const [selectedTool, setSelectedTool] = useState(null);
  const [tetherStress, setTetherStress] = useState(0);
  const [suitPower, setSuitPower] = useState(100);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SEC[gameId]);
  const [score, setScore] = useState(0);
  const [workProgress, setWorkProgress] = useState(0);
  const [currentSystem, setCurrentSystem] = useState(null);

  const [systems, setSystems] = useState([
    {
      id: "solar",
      name: "Solar Array",
      status: "critical",
      progress: 0,
      requiredTools: ["wrench", "multimeter"],
      currentStep: 0,
      steps: [
        "Disconnect power",
        "Remove damaged panel",
        "Install replacement",
        "Test connection",
      ],
      x: 25,
      y: 20,
      difficulty: 3,
    },
    {
      id: "comm",
      name: "Communications Array",
      status: "damaged",
      progress: 0,
      requiredTools: ["screwdriver", "wire", "multimeter"],
      currentStep: 0,
      steps: [
        "Remove antenna cover",
        "Replace damaged wiring",
        "Reconnect cables",
        "Signal test",
      ],
      x: 50,
      y: 70,
      difficulty: 4,
    },
    {
      id: "cooling",
      name: "Thermal Management",
      status: "warning",
      progress: 0,
      requiredTools: ["wrench", "coolant"],
      currentStep: 0,
      steps: ["Drain coolant", "Replace valve", "Refill system"],
      x: 80,
      y: 40,
      difficulty: 2,
    },
  ]);

  const tools = [
    { id: "wrench", name: "Torque Wrench", icon: "🔧", available: true },
    {
      id: "screwdriver",
      name: "Power Screwdriver",
      icon: "🪛",
      available: true,
    },
    {
      id: "multimeter",
      name: "Digital Multimeter",
      icon: "📟",
      available: true,
    },
    { id: "wire", name: "Replacement Cable", icon: "🔌", available: true },
    { id: "coolant", name: "Coolant Tank", icon: "🧊", available: true },
  ];

  const endSpacewalkGame = useCallback(() => {
    if (gameState === "completed") return;

    const operationalSystems = systems.filter(
      (s) => s.status === "operational"
    ).length;
    const timeBonus = timeLeft * 15;
    const powerBonus = Math.round(suitPower * 3);
    const efficiencyBonus =
      operationalSystems === systems.length ? 2000 : operationalSystems * 500;

    const finalScore = score + timeBonus + powerBonus + efficiencyBonus;

    setGameState("completed");
    playSound("complete", soundEnabled);
    onComplete(finalScore);
  }, [
    gameState,
    systems,
    timeLeft,
    suitPower,
    score,
    soundEnabled,
    onComplete,
  ]);

  useEffect(() => {
    if (gameState === "active") {
      const gameTimer = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            endSpacewalkGame();
            return 0;
          }
          return newTime;
        });

        setSuitPower((prev) => {
          const drain = currentSystem ? 0.15 : 0.08;
          const newPower = Math.max(0, prev - drain);
          if (newPower <= 0) {
            endSpacewalkGame();
          }
          return newPower;
        });

        setTetherStress((prev) => Math.min(100, prev + 0.1));
      }, 1000);

      return () => clearInterval(gameTimer);
    }
  }, [gameState, currentSystem, endSpacewalkGame]);

  const selectSystem = (systemId) => {
    const system = systems.find((s) => s.id === systemId);
    if (!system || system.status === "operational") return;

    setCurrentSystem(system);
    setWorkProgress(0);
    playSound("click", soundEnabled);
  };

  const performWork = () => {
    if (!currentSystem || !selectedTool) {
      playSound("error", soundEnabled);
      return;
    }

    const correctTool = currentSystem.requiredTools.includes(selectedTool);

    if (correctTool) {
      const progressIncrease = 25 / currentSystem.difficulty;

      setWorkProgress((prev) => {
        const newProgress = prev + progressIncrease;

        if (newProgress >= 100) {

          setSystems((prevSystems) =>
            prevSystems.map((s) => {
              if (s.id === currentSystem.id) {
                const nextStep = s.currentStep + 1;
                const newProgress = (nextStep / s.steps.length) * 100;
                const newStatus =
                  nextStep >= s.steps.length ? "operational" : s.status;

                return {
                  ...s,
                  currentStep: nextStep,
                  progress: newProgress,
                  status: newStatus,
                };
              }
              return s;
            })
          );

          setScore((prev) => prev + 200 + currentSystem.difficulty * 50);
          playSound("success", soundEnabled);

          if (currentSystem.currentStep + 1 >= currentSystem.steps.length) {
            setCurrentSystem(null);

            const allOperational = systems
              .filter((s) => s.id !== currentSystem.id)
              .every((s) => s.status === "operational");
            if (allOperational) {
              setTimeout(endSpacewalkGame, 1000);
            }
          }

          return 0;
        }

        return newProgress;
      });

      setScore((prev) => prev + 25);
    } else {

      setScore((prev) => Math.max(0, prev - 50));
      setSuitPower((prev) => Math.max(0, prev - 2));
      playSound("error", soundEnabled);
    }
  };

  const getSystemPriority = (status) => {
    switch (status) {
      case "critical":
        return { color: "#ff4757", priority: "HIGH" };
      case "damaged":
        return { color: "#ff6b6b", priority: "MEDIUM" };
      case "warning":
        return { color: "#ffa502", priority: "LOW" };
      case "operational":
        return { color: "#2ed573", priority: "COMPLETE" };
      default:
        return { color: "#747d8c", priority: "UNKNOWN" };
    }
  };

  if (gameState === "briefing") {
    return (
      <div className="spacewalk-briefing">
        <motion.div
          className="mission-brief"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h3>🚨 Critical Systems Failure - Emergency EVA Required</h3>
          <div className="alert-banner">
            <AlertTriangle size={24} />
            Multiple ISS systems have failed. Immediate repair is essential for
            crew safety.
          </div>

          <div className="systems-overview">
            <h4>System Status Report:</h4>
            {systems.map((system) => {
              const { color, priority } = getSystemPriority(system.status);
              return (
                <div
                  key={system.id}
                  className="system-brief"
                  style={{ borderLeft: `4px solid ${color}` }}
                >
                  <div className="system-header">
                    <span className="system-name">{system.name}</span>
                    <span
                      className="priority-badge"
                      style={{ backgroundColor: color }}
                    >
                      {priority}
                    </span>
                  </div>
                  <div className="system-details">
                    <div>Required Tools: {system.requiredTools.join(", ")}</div>
                    <div>Steps: {system.steps.length}</div>
                    <div>Difficulty: {"⭐".repeat(system.difficulty)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mission-parameters">
            <h4>Mission Parameters:</h4>
            <div className="parameter-grid">
              <div className="parameter">
                <Clock size={20} />
                <span>
                  Time Limit: {Math.floor(GAME_DURATION_SEC[gameId] / 60)}{" "}
                  minutes
                </span>
              </div>
              <div className="parameter">
                <Battery size={20} />
                <span>Suit Power: Limited</span>
              </div>
              <div className="parameter">
                <Shield size={20} />
                <span>Tether Safety: Critical</span>
              </div>
            </div>
          </div>

          <button
            className="begin-eva-btn"
            onClick={() => {
              setGameState("active");
              playSound("success", soundEnabled);
            }}
          >
            <Rocket size={20} />
            Begin Emergency EVA
          </button>
        </motion.div>
      </div>
    );
  }

  if (gameState === "active") {
    return (
      <div className="spacewalk-active">
        <div className="eva-hud">
          <div className="hud-primary">
            <div className="hud-item">
              <Timer size={16} />
              {Math.floor(timeLeft / 60)}:
              {(timeLeft % 60).toString().padStart(2, "0")}
            </div>
            <div className="hud-item">
              <Battery size={16} />
              Power: {Math.round(suitPower)}%
            </div>
            <div className="hud-item">
              <Trophy size={16} />
              Score: {score}
            </div>
          </div>

          <div className="hud-secondary">
            <div className="hud-item">
              <Activity size={16} />
              Tether Stress: {Math.round(tetherStress)}%
            </div>
            <div className="hud-item">
              <Wrench size={16} />
              Tool:{" "}
              {selectedTool
                ? tools.find((t) => t.id === selectedTool)?.name
                : "None"}
            </div>
          </div>
        </div>

        <div className="iss-exterior-view">
          <div className="space-environment">
            {}
            <div
              className="eva-astronaut"
              style={{ left: `${astronautPos.x}%`, top: `${astronautPos.y}%` }}
            >
              <div
                className="safety-tether"
                style={{ width: `${tetherStress}px` }}
              />
              👨‍🚀
            </div>

            {}
            {systems.map((system) => {
              const { color } = getSystemPriority(system.status);
              const isSelected = currentSystem?.id === system.id;

              return (
                <motion.div
                  key={system.id}
                  className={`repair-station ${system.status} ${
                    isSelected ? "selected" : ""
                  }`}
                  style={{ left: `${system.x}%`, top: `${system.y}%` }}
                  onClick={() => selectSystem(system.id)}
                  whileHover={{ scale: 1.1 }}
                  animate={
                    system.status !== "operational"
                      ? {
                          boxShadow: [
                            `0 0 20px ${color}`,
                            `0 0 30px ${color}`,
                            `0 0 20px ${color}`,
                          ],
                        }
                      : {}
                  }
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <div className="system-panel">
                    <div className="system-header">
                      <div className="system-name">{system.name}</div>
                      <div className="system-status" style={{ color }}>
                        {system.status.toUpperCase()}
                      </div>
                    </div>

                    <div className="progress-indicator">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${system.progress}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>

                    {system.status !== "operational" && (
                      <div className="next-step">
                        Step {system.currentStep + 1}:{" "}
                        {system.steps[system.currentStep]}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {}
            <div className="space-debris">
              <div className="debris" style={{ left: "15%", top: "10%" }}>
                🛰️
              </div>
              <div className="debris" style={{ left: "85%", top: "80%" }}>
                ☄️
              </div>
              <div className="earth-view" style={{ left: "0%", top: "70%" }}>
                🌍
              </div>
            </div>
          </div>

          {}
          {currentSystem && (
            <motion.div
              className="work-interface"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="work-header">
                <h4>Working on: {currentSystem.name}</h4>
                <div className="current-step">
                  Step {currentSystem.currentStep + 1}/
                  {currentSystem.steps.length}:{" "}
                  {currentSystem.steps[currentSystem.currentStep]}
                </div>
              </div>

              <div className="work-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${workProgress}%` }}
                  />
                </div>
                <div className="progress-text">{Math.round(workProgress)}%</div>
              </div>

              <button
                className="perform-work-btn"
                onClick={performWork}
                disabled={!selectedTool}
              >
                {selectedTool
                  ? `Use ${tools.find((t) => t.id === selectedTool)?.name}`
                  : "Select Tool First"}
              </button>
            </motion.div>
          )}

          {}
          <div className="tool-selection">
            <h4>EVA Tools</h4>
            <div className="tools-grid">
              {tools.map((tool) => (
                <motion.button
                  key={tool.id}
                  className={`tool-btn ${
                    selectedTool === tool.id ? "selected" : ""
                  }`}
                  onClick={() => {
                    setSelectedTool(tool.id);
                    playSound("click", soundEnabled);
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="tool-icon">{tool.icon}</span>
                  <span className="tool-name">{tool.name}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="spacewalk-results">
      <motion.div
        className="results-content"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h3>🎯 EVA Mission Complete!</h3>

        <div className="mission-summary">
          <div className="systems-repaired">
            {systems.map((system) => (
              <div key={system.id} className={`system-result ${system.status}`}>
                <span className="system-name">{system.name}</span>
                <span className="system-final-status">
                  {system.status === "operational"
                    ? "✅ REPAIRED"
                    : "❌ INCOMPLETE"}
                </span>
              </div>
            ))}
          </div>

          <div className="final-statistics">
            <div className="stat-row">
              <span>Systems Repaired:</span>
              <span>
                {systems.filter((s) => s.status === "operational").length}/
                {systems.length}
              </span>
            </div>
            <div className="stat-row">
              <span>Time Bonus:</span>
              <span>{timeLeft * 15} pts</span>
            </div>
            <div className="stat-row">
              <span>Power Efficiency:</span>
              <span>{Math.round(suitPower * 3)} pts</span>
            </div>
            <div className="stat-row total">
              <span>Final Score:</span>
              <span>{score + timeLeft * 15 + Math.round(suitPower * 3)}</span>
            </div>
          </div>
        </div>

        <div className="performance-rating">
          {systems.every((s) => s.status === "operational") ? (
            <div className="perfect-mission">🏆 Perfect EVA Mission! 🏆</div>
          ) : (
            <div className="partial-success">
              ⭐ Mission Partially Complete ⭐
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const LunarCollectionGame = ({ gameId, onComplete, soundEnabled }) => {
  const [gameState, setGameState] = useState("preparation");
  const [astronautPos, setAstronautPos] = useState({ x: 50, y: 80 });
  const [astronautVelocity, setAstronautVelocity] = useState({ x: 0, y: 0 });
  const [joystickDir, setJoystickDir] = useState({ x: 0, y: 0 });
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SEC[gameId]);
  const [score, setScore] = useState(0);
  const [oxygenLevel, setOxygenLevel] = useState(100);
  const [keysPressed, setKeysPressed] = useState({});
  const [collectedSamples, setCollectedSamples] = useState([]);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [particles, setParticles] = useState([]);
  const lastWarnRef = useRef(0);

  const animationRef = useRef(null);
  const lastTimeRef = useRef(Date.now());

  const [samples, setSamples] = useState([
    {
      id: 1,
      x: 25,
      y: 30,
      type: "regolith",
      name: "Lunar Regolith",
      value: 200,
      collected: false,
      icon: "🌑",
    },
    {
      id: 2,
      x: 70,
      y: 20,
      type: "mineral",
      name: "Rare Minerals",
      value: 500,
      collected: false,
      icon: "💎",
    },
    {
      id: 3,
      x: 15,
      y: 60,
      type: "ice",
      name: "Water Ice",
      value: 800,
      collected: false,
      icon: "🧊",
    },
    {
      id: 4,
      x: 85,
      y: 50,
      type: "rock",
      name: "Mare Basalt",
      value: 300,
      collected: false,
      icon: "🪨",
    },
    {
      id: 5,
      x: 40,
      y: 10,
      type: "crystal",
      name: "Impact Glass",
      value: 600,
      collected: false,
      icon: "🔮",
    },
    {
      id: 6,
      x: 60,
      y: 70,
      type: "dust",
      name: "Solar Wind Particles",
      value: 400,
      collected: false,
      icon: "✨",
    },
  ]);

  const [obstacles] = useState([
    { id: 1, x: 30, y: 45, type: "crater", size: 8 },
    { id: 2, x: 75, y: 35, type: "boulder", size: 6 },
    { id: 3, x: 50, y: 25, type: "crater", size: 10 },
    { id: 4, x: 20, y: 15, type: "boulder", size: 5 },
  ]);

  const LUNAR_PHYSICS = useMemo(
    () => ({
      gravity: 0.166,
      moveSpeed: 0.6,
      friction: 0.88,
      maxVelocity: 2.0,
      collisionRadius: 3,
      jumpPower: 1.2,
    }),
    []
  );

  const endLunarGame = useCallback(() => {
    if (gameState === "completed") return;

    const sampleBonus = collectedSamples.reduce(
      (sum, sample) => sum + sample.value,
      0
    );
    const timeBonus = timeLeft * 8;
    const oxygenBonus = Math.round(oxygenLevel * 4);
    const efficiencyBonus = collectedSamples.length >= 4 ? 1000 : 0;

    const finalScore =
      score + sampleBonus + timeBonus + oxygenBonus + efficiencyBonus;

    setGameState("completed");
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    playSound("complete", soundEnabled);
    onComplete(finalScore);
  }, [
    gameState,
    collectedSamples,
    timeLeft,
    oxygenLevel,
    score,
    soundEnabled,
    onComplete,
  ]);

  useEffect(() => {
    if (gameState !== "exploring") return;

    const gameLoop = () => {
      const now = Date.now();
      const deltaTime = (now - lastTimeRef.current) / 16.67;
      lastTimeRef.current = now;

      setAstronautPos((prevPos) => {
        let newVel = { ...astronautVelocity };

        if (keysPressed["w"] || keysPressed["ArrowUp"])
          newVel.y -= LUNAR_PHYSICS.moveSpeed * deltaTime;
        if (keysPressed["s"] || keysPressed["ArrowDown"])
          newVel.y += LUNAR_PHYSICS.moveSpeed * deltaTime;
        if (keysPressed["a"] || keysPressed["ArrowLeft"])
          newVel.x -= LUNAR_PHYSICS.moveSpeed * deltaTime;
        if (keysPressed["d"] || keysPressed["ArrowRight"])
          newVel.x += LUNAR_PHYSICS.moveSpeed * deltaTime;

        if (Math.abs(joystickDir.x) > 0.05 || Math.abs(joystickDir.y) > 0.05) {
          newVel.x += joystickDir.x * LUNAR_PHYSICS.moveSpeed * deltaTime;
          newVel.y -= joystickDir.y * LUNAR_PHYSICS.moveSpeed * deltaTime;
        }
        if (keysPressed[" "]) {

          newVel.y -= LUNAR_PHYSICS.jumpPower * deltaTime;
        }

        newVel.y += LUNAR_PHYSICS.gravity * deltaTime;

        newVel.x *= LUNAR_PHYSICS.friction;
        newVel.y *= LUNAR_PHYSICS.friction;

        const speed = Math.sqrt(newVel.x * newVel.x + newVel.y * newVel.y);
        if (speed > LUNAR_PHYSICS.maxVelocity) {
          newVel.x = (newVel.x / speed) * LUNAR_PHYSICS.maxVelocity;
          newVel.y = (newVel.y / speed) * LUNAR_PHYSICS.maxVelocity;
        }

        setAstronautVelocity(newVel);

        let newPos = {
          x: clamp(prevPos.x + newVel.x, 2, 98),
          y: clamp(prevPos.y + newVel.y, 2, 98),
        };

        obstacles.forEach((obstacle) => {
          const obstacleDistance = distance(newPos, obstacle);
          if (obstacleDistance < obstacle.size) {

            const pushX =
              ((newPos.x - obstacle.x) / obstacleDistance) * obstacle.size;
            const pushY =
              ((newPos.y - obstacle.y) / obstacleDistance) * obstacle.size;
            newPos.x = obstacle.x + pushX;
            newPos.y = obstacle.y + pushY;

            setAstronautVelocity((prev) => ({
              x: prev.x * 0.3,
              y: prev.y * 0.3,
            }));
          }
        });

        samples.forEach((sample) => {
          if (
            !sample.collected &&
            distance(newPos, sample) < LUNAR_PHYSICS.collisionRadius
          ) {
            setSamples((prev) =>
              prev.map((s) =>
                s.id === sample.id ? { ...s, collected: true } : s
              )
            );
            setCollectedSamples((prev) => [...prev, sample]);
            setScore((prev) => prev + sample.value);
            setBatteryLevel((prev) => Math.max(0, prev - 5));
            playSound("pickup", soundEnabled);

            const burstId = Date.now();
            const burst = Array.from({ length: 12 }).map((_, i) => ({
              id: `${burstId}-${i}`,
              x: newPos.x,
              y: newPos.y,
              angle: (i / 12) * Math.PI * 2,
              dist: 3 + Math.random() * 5,
            }));
            setParticles((prev) => [...prev, ...burst]);
            setTimeout(() => {
              setParticles((prev) =>
                prev.filter((p) => !String(p.id).startsWith(String(burstId)))
              );
            }, 700);

            if (collectedSamples.length + 1 >= 4) {
              setTimeout(endLunarGame, 1000);
            }
          }
        });

        return newPos;
      });

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    gameState,
    keysPressed,
    astronautVelocity,
    obstacles,
    samples,
    collectedSamples,
    soundEnabled,
    endLunarGame,
    LUNAR_PHYSICS,
    joystickDir,
  ]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          " ",
        ].includes(key)
      ) {
        e.preventDefault();
        setKeysPressed((prev) => ({ ...prev, [key]: true }));
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          " ",
        ].includes(key)
      ) {
        e.preventDefault();
        setKeysPressed((prev) => ({ ...prev, [key]: false }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (gameState === "exploring") {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            endLunarGame();
            return 0;
          }
          return newTime;
        });

        setOxygenLevel((prev) => {
          const newOxygen = Math.max(0, prev - 0.06);
          if (newOxygen < 20) {
            const now = Date.now();
            if (now - lastWarnRef.current > 2000) {
              playSound("warning", soundEnabled);
              lastWarnRef.current = now;
            }
          }
          if (newOxygen <= 0) {
            endLunarGame();
          }
          return newOxygen;
        });

        setBatteryLevel((prev) => Math.max(0, prev - 0.08));
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [gameState, endLunarGame, soundEnabled]);

  if (gameState === "preparation") {
    return (
      <div className="lunar-preparation">
        <motion.div
          className="mission-prep"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h3>🌙 Lunar Sample Collection Mission</h3>
          <div className="mission-briefing">
            <div className="briefing-header">
              <Map size={24} />
              <span>
                Mission Objective: Collect valuable lunar samples for scientific
                research
              </span>
            </div>

            <div className="sample-catalog">
              <h4>Sample Types Available:</h4>
              <div className="samples-grid">
                {samples.map((sample) => (
                  <div key={sample.id} className="sample-info">
                    <span className="sample-icon">{sample.icon}</span>
                    <div className="sample-details">
                      <div className="sample-name">{sample.name}</div>
                      <div className="sample-value">{sample.value} pts</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mission-parameters">
              <h4>Mission Parameters:</h4>
              <div className="params-grid">
                <div className="param-item">
                  <span className="param-label">Gravity:</span>
                  <span className="param-value">16.6% of Earth</span>
                </div>
                <div className="param-item">
                  <span className="param-label">Target Samples:</span>
                  <span className="param-value">Minimum 4/6</span>
                </div>
                <div className="param-item">
                  <span className="param-label">Movement:</span>
                  <span className="param-value">WASD + Space (Jump)</span>
                </div>
                <div className="param-item">
                  <span className="param-label">Time Limit:</span>
                  <span className="param-value">
                    {Math.floor(GAME_DURATION_SEC[gameId] / 60)} minutes
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            className="begin-collection-btn"
            onClick={() => {
              setGameState("exploring");
              playSound("success", soundEnabled);
              lastTimeRef.current = Date.now();
            }}
          >
            <Rocket size={20} />
            Begin Lunar Exploration
          </button>
        </motion.div>
      </div>
    );
  }

  if (gameState === "exploring") {
    return (
      <div className="lunar-exploration">
        <div className="lunar-hud">
          <div className="hud-primary">
            <div className="hud-item">
              <Timer size={16} />
              {Math.floor(timeLeft / 60)}:
              {(timeLeft % 60).toString().padStart(2, "0")}
            </div>
            <div className="hud-item">
              <Zap size={16} />
              O₂: {Math.round(oxygenLevel)}%
            </div>
            <div className="hud-item">
              <Battery size={16} />
              Power: {Math.round(batteryLevel)}%
            </div>
            <div className="hud-item">
              <Package size={16} />
              Samples: {collectedSamples.length}/6
            </div>
          </div>

          <div className="hud-secondary">
            <div className="hud-item">
              <Trophy size={16} />
              Score: {score}
            </div>
            <div className="gravity-indicator">
              <Activity size={16} />
              Low Gravity Environment
            </div>
          </div>
        </div>

        <div className="lunar-surface">
          <div className="surface-environment">
            {}
            <div
              className="parallax-lunar"
              style={{
                transform: `translate(${(astronautPos.x - 50) * -0.25}%, ${
                  (astronautPos.y - 50) * -0.25
                }%)`,
              }}
            />
            {}
            <motion.div
              className="lunar-astronaut"
              style={{
                left: `${astronautPos.x}%`,
                top: `${astronautPos.y}%`,
                transform: `rotate(${astronautVelocity.x * 3}deg)`,
              }}
              animate={{
                scale: [1, 1.02, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              👨‍🚀
              <div className="jetpack-trail" />
            </motion.div>

            {}
            {samples.map(
              (sample) =>
                !sample.collected && (
                  <motion.div
                    key={sample.id}
                    className="sample-location"
                    style={{ left: `${sample.x}%`, top: `${sample.y}%` }}
                    animate={{
                      scale: [1, 1.15, 1],
                      opacity: [0.8, 1, 0.8],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <div className="sample-beacon">
                      <div className="sample-icon">{sample.icon}</div>
                      <div className="sample-label">{sample.name}</div>
                      <div className="sample-value">{sample.value} pts</div>
                    </div>
                  </motion.div>
                )
            )}

            {}
            {particles.map((p) => (
              <motion.div
                key={p.id}
                style={{
                  position: "absolute",
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#45b7d1",
                  transform: "translate(-50%, -50%)",
                }}
                initial={{ opacity: 0.9 }}
                animate={{
                  left: `${p.x + Math.cos(p.angle) * p.dist}%`,
                  top: `${p.y + Math.sin(p.angle) * p.dist}%`,
                  opacity: 0,
                }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            ))}

            {}
            {obstacles.map((obstacle) => (
              <div
                key={obstacle.id}
                className={`lunar-obstacle ${obstacle.type}`}
                style={{
                  left: `${obstacle.x}%`,
                  top: `${obstacle.y}%`,
                  width: `${obstacle.size * 2}%`,
                  height: `${obstacle.size * 2}%`,
                }}
              >
                {obstacle.type === "crater" ? "🕳️" : "🪨"}
              </div>
            ))}

            {}
            <div className="lunar-features">
              <div className="earth-view" style={{ left: "5%", top: "5%" }}>
                🌍
              </div>
              <div className="lunar-module" style={{ left: "45%", top: "85%" }}>
                🚀
              </div>
              <div className="flag" style={{ left: "52%", top: "78%" }}>
                🏴󠁧󠁢󠁥󠁮󠁧󠁿
              </div>
            </div>

            {}
            <div className="lunar-particles">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="dust-particle"
                  style={{
                    left: `${10 + i * 10}%`,
                    animationDelay: `${i * 0.3}s`,
                  }}
                  animate={{
                    y: [0, -30, 0],
                    opacity: [0, 0.6, 0],
                    scale: [0.3, 1, 0.3],
                  }}
                  transition={{
                    duration: 4 + i * 0.5,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="controls-guide">
            <div className="control-hint">
              <Move size={16} />
              WASD/Arrows: Move | Space: Low-gravity Jump
            </div>
            <div className="mission-progress">
              Target: Collect {4 - collectedSamples.length} more samples
            </div>
          </div>
        </div>

        {}
        {collectedSamples.length > 0 && (
          <div className="collected-samples">
            <h4>Collected Samples:</h4>
            <div className="samples-list">
              {collectedSamples.map((sample) => (
                <div key={sample.id} className="collected-sample">
                  <span>{sample.icon}</span>
                  <span>{sample.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {}
        <div className="mobile-controls">
          <VirtualJoystick onChange={setJoystickDir} />
        </div>
      </div>
    );
  }

  return (
    <div className="lunar-results">
      <div className="completion-sparks">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className="spark"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{
              opacity: [0, 1, 0],
              y: [-10, -30, -50],
              scale: [0.6, 1, 0.4],
            }}
            transition={{
              duration: 1.2 + i * 0.05,
              repeat: Infinity,
              delay: i * 0.05,
            }}
          />
        ))}
      </div>
      <motion.div
        className="results-content"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h3>🎯 Lunar Mission Complete!</h3>

        <div className="mission-summary">
          <div className="samples-collected">
            <h4>Samples Collected ({collectedSamples.length}/6):</h4>
            <div className="collected-grid">
              {collectedSamples.map((sample) => (
                <div key={sample.id} className="collected-sample-result">
                  <span className="sample-icon">{sample.icon}</span>
                  <div className="sample-info">
                    <div className="sample-name">{sample.name}</div>
                    <div className="sample-value">{sample.value} pts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="final-statistics">
            <div className="stat-row">
              <span>Samples Value:</span>
              <span>
                {collectedSamples.reduce((sum, s) => sum + s.value, 0)} pts
              </span>
            </div>
            <div className="stat-row">
              <span>Time Bonus:</span>
              <span>{timeLeft * 8} pts</span>
            </div>
            <div className="stat-row">
              <span>Oxygen Efficiency:</span>
              <span>{Math.round(oxygenLevel * 4)} pts</span>
            </div>
            <div className="stat-row total">
              <span>Total Score:</span>
              <span>{score + timeLeft * 8 + Math.round(oxygenLevel * 4)}</span>
            </div>
          </div>
        </div>

        <div className="performance-rating">
          {collectedSamples.length >= 5 ? (
            <div className="excellent-mission">
              🌟 Outstanding Scientific Achievement! 🌟
            </div>
          ) : collectedSamples.length >= 4 ? (
            <div className="good-mission">⭐ Mission Success! ⭐</div>
          ) : (
            <div className="partial-mission">
              ✨ Partial Mission Complete ✨
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const EquipmentInstallGame = ({ gameId, onComplete, soundEnabled }) => {
  const [gameState, setGameState] = useState("briefing");
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SEC[gameId]);
  const [score, setScore] = useState(0);
  const [precisionLevel, setPrecisionLevel] = useState(100);
  const [currentModule, setCurrentModule] = useState(null);
  const [alignmentAccuracy, setAlignmentAccuracy] = useState(0);
  const [draggedComponent, setDraggedComponent] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const [modules, setModules] = useState([
    {
      id: 1,
      name: "Solar Panel Array",
      components: [
        {
          id: "base",
          name: "Mounting Base",
          x: 40,
          y: 60,
          width: 20,
          height: 10,
          installed: false,
          targetX: 40,
          targetY: 60,
        },
        {
          id: "panel1",
          name: "Panel Section A",
          x: 10,
          y: 20,
          width: 15,
          height: 8,
          installed: false,
          targetX: 30,
          targetY: 55,
        },
        {
          id: "panel2",
          name: "Panel Section B",
          x: 70,
          y: 20,
          width: 15,
          height: 8,
          installed: false,
          targetX: 50,
          targetY: 55,
        },
        {
          id: "controller",
          name: "Power Controller",
          x: 20,
          y: 80,
          width: 8,
          height: 6,
          installed: false,
          targetX: 42,
          targetY: 65,
        },
      ],
      difficulty: 3,
      precision: 95,
      status: "pending",
    },
    {
      id: 2,
      name: "Docking Port Module",
      components: [
        {
          id: "port",
          name: "Docking Ring",
          x: 60,
          y: 30,
          width: 18,
          height: 18,
          installed: false,
          targetX: 45,
          targetY: 45,
        },
        {
          id: "sensor1",
          name: "Proximity Sensor",
          x: 15,
          y: 15,
          width: 6,
          height: 6,
          installed: false,
          targetX: 40,
          targetY: 40,
        },
        {
          id: "sensor2",
          name: "Alignment Sensor",
          x: 80,
          y: 15,
          width: 6,
          height: 6,
          installed: false,
          targetX: 55,
          targetY: 40,
        },
        {
          id: "mechanism",
          name: "Locking Mechanism",
          x: 25,
          y: 75,
          width: 10,
          height: 8,
          installed: false,
          targetX: 45,
          targetY: 50,
        },
      ],
      difficulty: 4,
      precision: 98,
      status: "pending",
    },
    {
      id: 3,
      name: "Science Laboratory",
      components: [
        {
          id: "frame",
          name: "Lab Frame",
          x: 50,
          y: 50,
          width: 25,
          height: 20,
          installed: false,
          targetX: 35,
          targetY: 40,
        },
        {
          id: "equipment",
          name: "Research Equipment",
          x: 20,
          y: 25,
          width: 12,
          height: 10,
          installed: false,
          targetX: 40,
          targetY: 45,
        },
        {
          id: "ventilation",
          name: "Ventilation Unit",
          x: 75,
          y: 25,
          width: 8,
          height: 8,
          installed: false,
          targetX: 50,
          targetY: 35,
        },
        {
          id: "computer",
          name: "Control Computer",
          x: 30,
          y: 80,
          width: 10,
          height: 6,
          installed: false,
          targetX: 42,
          targetY: 55,
        },
      ],
      difficulty: 5,
      precision: 99,
      status: "pending",
    },
  ]);

  const endInstallationGame = useCallback(() => {
    if (gameState === "completed") return;

    const completedModules = modules.filter(
      (m) => m.status === "completed"
    ).length;
    const precisionBonus = Math.round(precisionLevel * 5);
    const timeBonus = timeLeft * 12;
    const perfectInstall =
      completedModules === modules.length && precisionLevel > 90 ? 1500 : 0;

    const finalScore = score + precisionBonus + timeBonus + perfectInstall;

    setGameState("completed");
    playSound("complete", soundEnabled);
    onComplete(finalScore);
  }, [
    gameState,
    modules,
    precisionLevel,
    timeLeft,
    score,
    soundEnabled,
    onComplete,
  ]);

  useEffect(() => {
    if (gameState === "installing") {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            endInstallationGame();
            return 0;
          }
          return newTime;
        });

        setPrecisionLevel((prev) => Math.max(50, prev - 0.05));
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [gameState, endInstallationGame]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const selectModule = (moduleId) => {
    const module = modules.find((m) => m.id === moduleId);
    if (!module || module.status === "completed") return;

    setCurrentModule(module);
    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, status: "in-progress" } : m))
    );
    playSound("click", soundEnabled);
  };

  const startDrag = (component) => {
    if (component.installed) return;
    setDraggedComponent(component);
    playSound("click", soundEnabled);
  };

  const handleDrop = (e) => {
    if (!draggedComponent || !currentModule) return;

    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const dropX = ((e.clientX - rect.left) / rect.width) * 100;
    const dropY = ((e.clientY - rect.top) / rect.height) * 100;

    const targetX = draggedComponent.targetX;
    const targetY = draggedComponent.targetY;
    const accuracy =
      100 -
      Math.sqrt(Math.pow(dropX - targetX, 2) + Math.pow(dropY - targetY, 2));

    const isAccurate = accuracy >= currentModule.precision;

    if (isAccurate) {

      setModules((prev) =>
        prev.map((m) => {
          if (m.id === currentModule.id) {
            const updatedComponents = m.components.map((c) =>
              c.id === draggedComponent.id
                ? { ...c, installed: true, x: targetX, y: targetY }
                : c
            );

            const allInstalled = updatedComponents.every((c) => c.installed);
            return {
              ...m,
              components: updatedComponents,
              status: allInstalled ? "completed" : "in-progress",
            };
          }
          return m;
        })
      );

      setScore((prev) => prev + 300 + Math.round(accuracy * 5));
      setPrecisionLevel((prev) => Math.min(100, prev + 2));
      setAlignmentAccuracy(accuracy);
      playSound("success", soundEnabled);

      const updatedModule = modules.find((m) => m.id === currentModule.id);
      if (
        updatedModule &&
        updatedModule.components.every(
          (c) => c.installed || c.id === draggedComponent.id
        )
      ) {
        setTimeout(() => {
          setCurrentModule(null);

          const allComplete = modules.every(
            (m) => m.id === currentModule.id || m.status === "completed"
          );
          if (allComplete) {
            setTimeout(endInstallationGame, 1000);
          }
        }, 1000);
      }
    } else {

      setScore((prev) => Math.max(0, prev - 100));
      setPrecisionLevel((prev) => Math.max(30, prev - 5));
      playSound("error", soundEnabled);
    }

    setDraggedComponent(null);
  };

  const getDragPreview = () => {
    if (!draggedComponent) return null;

    return (
      <div
        className="drag-preview"
        style={{
          left: mousePos.x - 25,
          top: mousePos.y - 25,
          width: `${draggedComponent.width * 2}px`,
          height: `${draggedComponent.height * 2}px`,
        }}
      >
        📦
      </div>
    );
  };

  if (gameState === "briefing") {
    return (
      <div className="installation-briefing">
        <motion.div
          className="briefing-content"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h3>🔧 Precision Equipment Installation</h3>
          <div className="mission-overview">
            <div className="overview-header">
              <Settings size={24} />
              <span>
                Mission: Install critical station modules with extreme precision
              </span>
            </div>

            <div className="modules-list">
              <h4>Installation Queue:</h4>
              {modules.map((module) => (
                <div key={module.id} className="module-preview">
                  <div className="module-header">
                    <span className="module-name">{module.name}</span>
                    <span className="difficulty">
                      Difficulty: {"⭐".repeat(module.difficulty)}
                    </span>
                  </div>
                  <div className="module-specs">
                    <span>Components: {module.components.length}</span>
                    <span>Precision Required: {module.precision}%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="installation-requirements">
              <h4>Installation Requirements:</h4>
              <div className="requirements-grid">
                <div className="requirement">
                  <Crosshair size={20} />
                  <span>Extreme precision required (95%+ accuracy)</span>
                </div>
                <div className="requirement">
                  <MousePointer size={20} />
                  <span>Drag and drop components to exact positions</span>
                </div>
                <div className="requirement">
                  <Timer size={20} />
                  <span>Work quickly - precision degrades over time</span>
                </div>
                <div className="requirement">
                  <Target size={20} />
                  <span>Perfect alignment earns maximum points</span>
                </div>
              </div>
            </div>
          </div>

          <button
            className="begin-installation-btn"
            onClick={() => {
              setGameState("installing");
              playSound("success", soundEnabled);
            }}
          >
            <Settings size={20} />
            Begin Installation Sequence
          </button>
        </motion.div>
      </div>
    );
  }

  if (gameState === "installing") {
    return (
      <div className="installation-workspace">
        <div className="installation-hud">
          <div className="hud-primary">
            <div className="hud-item">
              <Timer size={16} />
              {Math.floor(timeLeft / 60)}:
              {(timeLeft % 60).toString().padStart(2, "0")}
            </div>
            <div className="hud-item">
              <Crosshair size={16} />
              Precision: {Math.round(precisionLevel)}%
            </div>
            <div className="hud-item">
              <Trophy size={16} />
              Score: {score}
            </div>
          </div>

          {alignmentAccuracy > 0 && (
            <div className="alignment-feedback">
              <Target size={16} />
              Last Alignment: {Math.round(alignmentAccuracy)}%
            </div>
          )}
        </div>

        <div className="workspace-area">
          {}
          <div className="module-selector">
            <h4>Select Module to Install:</h4>
            <div className="modules-grid">
              {modules.map((module) => (
                <motion.div
                  key={module.id}
                  className={`module-card ${module.status} ${
                    currentModule?.id === module.id ? "selected" : ""
                  }`}
                  onClick={() => selectModule(module.id)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="module-header">
                    <span className="module-name">{module.name}</span>
                    <span className={`status-badge ${module.status}`}>
                      {module.status === "completed"
                        ? "✅"
                        : module.status === "in-progress"
                        ? "🔄"
                        : "⏳"}
                    </span>
                  </div>
                  <div className="module-progress">
                    {module.components.filter((c) => c.installed).length}/
                    {module.components.length} components
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {}
          {currentModule && (
            <div className="installation-area">
              <h4>Installing: {currentModule.name}</h4>

              <div className="workspace-container">
                {}
                <div
                  className="assembly-zone"
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <div className="assembly-grid">
                    {}
                    {currentModule.components.map((component) => (
                      <div
                        key={`target-${component.id}`}
                        className="target-position"
                        style={{
                          left: `${component.targetX}%`,
                          top: `${component.targetY}%`,
                          width: `${component.width}%`,
                          height: `${component.height}%`,
                          opacity: component.installed ? 0.3 : 0.7,
                        }}
                      >
                        <div className="target-outline" />
                        <div className="target-label">{component.name}</div>
                      </div>
                    ))}

                    {}
                    {currentModule.components
                      .filter((c) => c.installed)
                      .map((component) => (
                        <div
                          key={`installed-${component.id}`}
                          className="installed-component"
                          style={{
                            left: `${component.x}%`,
                            top: `${component.y}%`,
                            width: `${component.width}%`,
                            height: `${component.height}%`,
                          }}
                        >
                          ✅ {component.name}
                        </div>
                      ))}
                  </div>
                </div>

                {}
                <div className="components-inventory">
                  <h5>Available Components:</h5>
                  <div className="components-list">
                    {currentModule.components
                      .filter((c) => !c.installed)
                      .map((component) => (
                        <motion.div
                          key={component.id}
                          className="component-item"
                          draggable
                          onDragStart={() => startDrag(component)}
                          whileHover={{ scale: 1.05 }}
                        >
                          <div className="component-icon">📦</div>
                          <div className="component-info">
                            <div className="component-name">
                              {component.name}
                            </div>
                            <div className="component-size">
                              {component.width}x{component.height}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                  </div>
                </div>
              </div>

              <div className="installation-instructions">
                <div className="instruction">
                  <MousePointer size={16} />
                  Drag components to their target positions with precision
                </div>
                <div className="precision-requirement">
                  Required Accuracy: {currentModule.precision}%
                </div>
              </div>
            </div>
          )}
        </div>

        {getDragPreview()}
      </div>
    );
  }

  return (
    <div className="installation-results">
      <motion.div
        className="results-content"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h3>🎯 Installation Mission Complete!</h3>

        <div className="installation-summary">
          <div className="modules-status">
            <h4>Module Installation Results:</h4>
            {modules.map((module) => (
              <div key={module.id} className={`module-result ${module.status}`}>
                <span className="module-name">{module.name}</span>
                <span className="components-installed">
                  {module.components.filter((c) => c.installed).length}/
                  {module.components.length}
                </span>
                <span className="status-icon">
                  {module.status === "completed" ? "✅ COMPLETE" : "⚠️ PARTIAL"}
                </span>
              </div>
            ))}
          </div>

          <div className="final-statistics">
            <div className="stat-row">
              <span>Modules Completed:</span>
              <span>
                {modules.filter((m) => m.status === "completed").length}/
                {modules.length}
              </span>
            </div>
            <div className="stat-row">
              <span>Final Precision:</span>
              <span>{Math.round(precisionLevel)}%</span>
            </div>
            <div className="stat-row">
              <span>Time Bonus:</span>
              <span>{timeLeft * 12} pts</span>
            </div>
            <div className="stat-row total">
              <span>Total Score:</span>
              <span>
                {score + Math.round(precisionLevel * 5) + timeLeft * 12}
              </span>
            </div>
          </div>
        </div>

        <div className="performance-rating">
          {modules.every((m) => m.status === "completed") &&
          precisionLevel > 90 ? (
            <div className="perfect-installation">
              🏆 Master Engineer! Perfect Installation! 🏆
            </div>
          ) : modules.filter((m) => m.status === "completed").length >= 2 ? (
            <div className="good-installation">
              ⭐ Excellent Installation Work! ⭐
            </div>
          ) : (
            <div className="partial-installation">
              ✨ Installation Training Complete ✨
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const EmergencyResponseGame = ({ gameId, onComplete, soundEnabled }) => {
  const [gameState, setGameState] = useState("briefing");
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SEC[gameId]);
  const [score, setScore] = useState(0);
  const [stressLevel, setStressLevel] = useState(0);
  const [currentCrisis, setCurrentCrisis] = useState(null);
  const [crisisStep, setCrisisStep] = useState(0);
  const [crewStatus, setCrewStatus] = useState("stable");
  const [systemsStatus, setSystemsStatus] = useState("operational");
  const [decisionsHistory, setDecisionsHistory] = useState([]);

  const [emergencies] = useState([
    {
      id: 1,
      type: "fire",
      name: "Cabin Fire Emergency",
      severity: "critical",
      description: "Fire detected in Node 2 - Harmony module",
      timeLimit: 180,
      steps: [
        {
          id: 1,
          situation:
            "🔥 Fire alarm activated in Harmony module. Smoke visible.",
          options: [
            {
              id: "a",
              text: "Immediately evacuate all crew to Soyuz",
              effect: "safe_slow",
              points: 50,
              stress: 5,
            },
            {
              id: "b",
              text: "Send crew to get fire suppression equipment",
              effect: "risk_fast",
              points: 100,
              stress: 15,
            },
            {
              id: "c",
              text: "Shut down ventilation system first",
              effect: "smart_prep",
              points: 150,
              stress: 8,
            },
          ],
        },
        {
          id: 2,
          situation: "Fire spreading, temperature rising. Crew in position.",
          options: [
            {
              id: "a",
              text: "Use CO2 suppression system",
              effect: "effective",
              points: 200,
              stress: 5,
            },
            {
              id: "b",
              text: "Use water-based suppression",
              effect: "electrical_risk",
              points: 50,
              stress: 20,
            },
            {
              id: "c",
              text: "Attempt manual extinguishing",
              effect: "crew_risk",
              points: 100,
              stress: 25,
            },
          ],
        },
        {
          id: 3,
          situation:
            "Fire contained but smoke remains. Air quality compromised.",
          options: [
            {
              id: "a",
              text: "Activate emergency air scrubbers",
              effect: "air_clear",
              points: 100,
              stress: -5,
            },
            {
              id: "b",
              text: "Evacuate to other modules until clear",
              effect: "wait_safe",
              points: 75,
              stress: 5,
            },
            {
              id: "c",
              text: "Continue operations with masks",
              effect: "continue_risk",
              points: 50,
              stress: 15,
            },
          ],
        },
      ],
    },
    {
      id: 2,
      type: "pressure",
      name: "Rapid Decompression",
      severity: "critical",
      description: "Hull breach detected in Columbus laboratory",
      timeLimit: 120,
      steps: [
        {
          id: 1,
          situation: "⚠️ Pressure alarm! Rapid pressure loss in Columbus lab.",
          options: [
            {
              id: "a",
              text: "Immediately isolate Columbus module",
              effect: "isolate_safe",
              points: 200,
              stress: 10,
            },
            {
              id: "b",
              text: "Send crew to locate breach first",
              effect: "delay_risk",
              points: 100,
              stress: 25,
            },
            {
              id: "c",
              text: "Evacuate all crew to Soyuz immediately",
              effect: "abandon_fast",
              points: 75,
              stress: 5,
            },
          ],
        },
        {
          id: 2,
          situation:
            "Module isolated. Breach location identified - micrometeorite impact.",
          options: [
            {
              id: "a",
              text: "Apply emergency patch from inside",
              effect: "patch_inside",
              points: 150,
              stress: 15,
            },
            {
              id: "b",
              text: "Prepare for emergency EVA",
              effect: "eva_prep",
              points: 200,
              stress: 20,
            },
            {
              id: "c",
              text: "Monitor and maintain isolation",
              effect: "wait_safe",
              points: 50,
              stress: 5,
            },
          ],
        },
        {
          id: 3,
          situation: "Temporary repair in place. Pressure stabilizing.",
          options: [
            {
              id: "a",
              text: "Plan permanent EVA repair",
              effect: "permanent_fix",
              points: 300,
              stress: 10,
            },
            {
              id: "b",
              text: "Request supply mission for parts",
              effect: "wait_resupply",
              points: 100,
              stress: 0,
            },
            {
              id: "c",
              text: "Keep module permanently isolated",
              effect: "permanent_loss",
              points: 25,
              stress: 15,
            },
          ],
        },
      ],
    },
    {
      id: 3,
      type: "medical",
      name: "Medical Emergency",
      severity: "high",
      description: "Crew member experiencing cardiac distress",
      timeLimit: 300,
      steps: [
        {
          id: 1,
          situation:
            "❤️ Crew member reporting chest pain and difficulty breathing.",
          options: [
            {
              id: "a",
              text: "Begin immediate medical assessment",
              effect: "assess_first",
              points: 150,
              stress: 10,
            },
            {
              id: "b",
              text: "Contact ground medical team",
              effect: "ground_contact",
              points: 100,
              stress: 5,
            },
            {
              id: "c",
              text: "Prepare for emergency return",
              effect: "return_prep",
              points: 50,
              stress: 20,
            },
          ],
        },
        {
          id: 2,
          situation:
            "Medical assessment complete. Signs point to cardiac event.",
          options: [
            {
              id: "a",
              text: "Administer emergency medication",
              effect: "medication",
              points: 200,
              stress: 15,
            },
            {
              id: "b",
              text: "Use defibrillator if needed",
              effect: "defib_ready",
              points: 150,
              stress: 20,
            },
            {
              id: "c",
              text: "Keep monitoring, prepare for evacuation",
              effect: "monitor_evacuate",
              points: 100,
              stress: 10,
            },
          ],
        },
        {
          id: 3,
          situation: "Patient stabilized but needs ground-based medical care.",
          options: [
            {
              id: "a",
              text: "Initiate emergency Soyuz return",
              effect: "emergency_return",
              points: 300,
              stress: 25,
            },
            {
              id: "b",
              text: "Continue treatment and monitor",
              effect: "continue_monitor",
              points: 150,
              stress: 15,
            },
            {
              id: "c",
              text: "Request expedited crew rotation",
              effect: "rotation_request",
              points: 100,
              stress: 5,
            },
          ],
        },
      ],
    },
  ]);

  const endEmergencyGame = useCallback(() => {
    if (gameState === "completed") return;

    const decisionsBonus = decisionsHistory.length * 50;
    const stressPenalty = Math.round(stressLevel * 2);
    const timeBonus = timeLeft * 8;
    const leadershipBonus =
      stressLevel < 50 && decisionsHistory.length >= 6 ? 1000 : 0;

    const finalScore = Math.max(
      0,
      score + decisionsBonus + timeBonus + leadershipBonus - stressPenalty
    );

    setGameState("completed");
    playSound("complete", soundEnabled);
    onComplete(finalScore);
  }, [
    gameState,
    decisionsHistory,
    stressLevel,
    timeLeft,
    score,
    soundEnabled,
    onComplete,
  ]);

  useEffect(() => {
    if (gameState === "crisis" && currentCrisis) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            endEmergencyGame();
            return 0;
          }
          return newTime;
        });

        setStressLevel((prev) => Math.min(100, prev + 0.2));

        if (currentCrisis.timeLimit) {
          setCurrentCrisis((prev) => ({
            ...prev,
            timeLimit: Math.max(0, prev.timeLimit - 1),
          }));
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [gameState, currentCrisis, endEmergencyGame]);

  const selectEmergency = (emergency) => {
    setCurrentCrisis({ ...emergency, timeLimit: emergency.timeLimit });
    setCrisisStep(0);
    setGameState("crisis");
    playSound("error", soundEnabled);
  };

  const makeDecision = (option) => {
    if (!currentCrisis) return;

    const decision = {
      step: crisisStep + 1,
      choice: option.text,
      effect: option.effect,
      points: option.points,
      stress: option.stress,
    };

    setDecisionsHistory((prev) => [...prev, decision]);
    setScore((prev) => prev + option.points);
    setStressLevel((prev) => clamp(prev + option.stress, 0, 100));

    if (option.effect.includes("risk")) {
      setCrewStatus("at_risk");
    } else if (option.effect.includes("safe")) {
      setCrewStatus("safe");
    }

    if (
      option.effect.includes("electrical") ||
      option.effect.includes("system")
    ) {
      setSystemsStatus("degraded");
    }

    playSound(option.stress > 15 ? "error" : "success", soundEnabled);

    if (crisisStep + 1 >= currentCrisis.steps.length) {

      setTimeout(() => {
        setCurrentCrisis(null);
        setCrisisStep(0);

        const completedCrises = decisionsHistory.filter(
          (d) => d.step === 3
        ).length;
        if (completedCrises >= 2) {
          setTimeout(endEmergencyGame, 1000);
        }
      }, 1500);
    } else {
      setCrisisStep((prev) => prev + 1);
    }
  };

  const getStressLevel = () => {
    if (stressLevel < 25)
      return { level: "low", color: "#2ed573", text: "Calm" };
    if (stressLevel < 50)
      return { level: "medium", color: "#ffa502", text: "Stressed" };
    if (stressLevel < 75)
      return { level: "high", color: "#ff6b6b", text: "High Stress" };
    return { level: "critical", color: "#ff4757", text: "Critical Stress" };
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "critical":
        return "#ff4757";
      case "high":
        return "#ff6b6b";
      case "medium":
        return "#ffa502";
      default:
        return "#2ed573";
    }
  };

  if (gameState === "briefing") {
    return (
      <div className="emergency-briefing">
        <motion.div
          className="briefing-content"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h3>🚨 Emergency Response Command Training</h3>
          <div className="command-overview">
            <div className="overview-header">
              <AlertTriangle size={24} />
              <span>
                You are the Mission Commander. Critical decisions await.
              </span>
            </div>

            <div className="emergency-scenarios">
              <h4>Potential Emergency Scenarios:</h4>
              {emergencies.map((emergency) => (
                <div key={emergency.id} className="scenario-preview">
                  <div className="scenario-header">
                    <span className="scenario-name">{emergency.name}</span>
                    <span
                      className="severity-badge"
                      style={{
                        backgroundColor: getSeverityColor(emergency.severity),
                      }}
                    >
                      {emergency.severity.toUpperCase()}
                    </span>
                  </div>
                  <div className="scenario-description">
                    {emergency.description}
                  </div>
                  <div className="scenario-timing">
                    Response Time: {Math.floor(emergency.timeLimit / 60)}:
                    {(emergency.timeLimit % 60).toString().padStart(2, "0")}
                  </div>
                </div>
              ))}
            </div>

            <div className="command-principles">
              <h4>Command Principles:</h4>
              <div className="principles-grid">
                <div className="principle">
                  <Shield size={20} />
                  <span>Crew safety is the highest priority</span>
                </div>
                <div className="principle">
                  <Clock size={20} />
                  <span>Time pressure affects decision quality</span>
                </div>
                <div className="principle">
                  <Activity size={20} />
                  <span>Stress management is crucial</span>
                </div>
                <div className="principle">
                  <Target size={20} />
                  <span>Quick, informed decisions save lives</span>
                </div>
              </div>
            </div>
          </div>

          <button
            className="assume-command-btn"
            onClick={() => {
              setGameState("crisis");
              playSound("success", soundEnabled);
            }}
          >
            <Crown size={20} />
            Assume Mission Command
          </button>
        </motion.div>
      </div>
    );
  }

  if (gameState === "crisis") {
    const stress = getStressLevel();

    return (
      <div className="emergency-command">
        <div className="command-hud">
          <div className="hud-primary">
            <div className="hud-item">
              <Timer size={16} />
              Mission: {Math.floor(timeLeft / 60)}:
              {(timeLeft % 60).toString().padStart(2, "0")}
            </div>
            <div className="hud-item" style={{ color: stress.color }}>
              <Activity size={16} />
              Stress: {stress.text} ({Math.round(stressLevel)}%)
            </div>
            <div className="hud-item">
              <Trophy size={16} />
              Score: {score}
            </div>
          </div>

          <div className="status-indicators">
            <div className={`status-item crew ${crewStatus}`}>
              👥 Crew: {crewStatus.replace("_", " ").toUpperCase()}
            </div>
            <div className={`status-item systems ${systemsStatus}`}>
              ⚙️ Systems: {systemsStatus.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="command-center">
          {!currentCrisis ? (
            <div className="emergency-selection">
              <h4>🚨 INCOMING EMERGENCIES</h4>
              <div className="alerts-grid">
                {emergencies.map((emergency) => (
                  <motion.div
                    key={emergency.id}
                    className={`emergency-alert ${emergency.severity}`}
                    onClick={() => selectEmergency(emergency)}
                    whileHover={{ scale: 1.02 }}
                    animate={{
                      boxShadow: [
                        `0 0 20px ${getSeverityColor(emergency.severity)}`,
                        `0 0 40px ${getSeverityColor(emergency.severity)}`,
                        `0 0 20px ${getSeverityColor(emergency.severity)}`,
                      ],
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <div className="alert-header">
                      <span className="alert-type">
                        {emergency.type === "fire"
                          ? "🔥"
                          : emergency.type === "pressure"
                          ? "⚠️"
                          : "❤️"}
                      </span>
                      <span className="alert-name">{emergency.name}</span>
                    </div>
                    <div className="alert-description">
                      {emergency.description}
                    </div>
                    <div className="response-time">
                      ⏱️ {Math.floor(emergency.timeLimit / 60)}:
                      {(emergency.timeLimit % 60).toString().padStart(2, "0")}{" "}
                      response time
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="crisis-management">
              <div className="crisis-header">
                <h4>{currentCrisis.name}</h4>
                <div className="crisis-timer">
                  ⏱️ {Math.floor(currentCrisis.timeLimit / 60)}:
                  {(currentCrisis.timeLimit % 60).toString().padStart(2, "0")}
                </div>
              </div>

              <div className="situation-report">
                <div className="situation-text">
                  {currentCrisis.steps[crisisStep]?.situation}
                </div>
              </div>

              <div className="decision-options">
                <h5>Your Command Decision:</h5>
                <div className="options-grid">
                  {currentCrisis.steps[crisisStep]?.options.map((option) => (
                    <motion.button
                      key={option.id}
                      className="decision-option"
                      onClick={() => makeDecision(option)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="option-text">{option.text}</div>
                      <div className="option-effects">
                        <span className="points">+{option.points} pts</span>
                        <span
                          className={`stress ${
                            option.stress > 15
                              ? "high"
                              : option.stress > 5
                              ? "medium"
                              : "low"
                          }`}
                        >
                          {option.stress > 0 ? "+" : ""}
                          {option.stress} stress
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="step-progress">
                Step {crisisStep + 1} / {currentCrisis.steps.length}
              </div>
            </div>
          )}

          {}
          {decisionsHistory.length > 0 && (
            <div className="decision-log">
              <h5>Command Log:</h5>
              <div className="decisions-list">
                {decisionsHistory.slice(-3).map((decision, index) => (
                  <div key={index} className="decision-entry">
                    <span className="step">Step {decision.step}:</span>
                    <span className="choice">{decision.choice}</span>
                    <span className="points">+{decision.points}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="emergency-results">
      <motion.div
        className="results-content"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h3>🎯 Command Mission Complete!</h3>

        <div className="command-summary">
          <div className="leadership-assessment">
            <h4>Leadership Performance:</h4>
            <div className="performance-metrics">
              <div className="metric">
                <span>Decisions Made:</span>
                <span>{decisionsHistory.length}</span>
              </div>
              <div className="metric">
                <span>Final Stress Level:</span>
                <span style={{ color: getStressLevel().color }}>
                  {getStressLevel().text} ({Math.round(stressLevel)}%)
                </span>
              </div>
              <div className="metric">
                <span>Crew Status:</span>
                <span className={crewStatus}>
                  {crewStatus.replace("_", " ").toUpperCase()}
                </span>
              </div>
              <div className="metric">
                <span>Systems Status:</span>
                <span className={systemsStatus}>
                  {systemsStatus.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div className="final-statistics">
            <div className="stat-row">
              <span>Command Points:</span>
              <span>{score} pts</span>
            </div>
            <div className="stat-row">
              <span>Decisions Bonus:</span>
              <span>{decisionsHistory.length * 50} pts</span>
            </div>
            <div className="stat-row">
              <span>Time Bonus:</span>
              <span>{timeLeft * 8} pts</span>
            </div>
            <div className="stat-row penalty">
              <span>Stress Penalty:</span>
              <span>-{Math.round(stressLevel * 2)} pts</span>
            </div>
            <div className="stat-row total">
              <span>Final Score:</span>
              <span>
                {Math.max(
                  0,
                  score +
                    decisionsHistory.length * 50 +
                    timeLeft * 8 -
                    Math.round(stressLevel * 2)
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="command-rating">
          {stressLevel < 50 && decisionsHistory.length >= 6 ? (
            <div className="exceptional-command">
              👑 Exceptional Mission Commander! 👑
            </div>
          ) : stressLevel < 70 && decisionsHistory.length >= 4 ? (
            <div className="good-command">⭐ Solid Command Performance! ⭐</div>
          ) : (
            <div className="learning-command">
              ✨ Command Training Complete ✨
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const InteractiveGames = () => {
  const [currentGame, setCurrentGame] = useState(null);
  const [gameStats, setGameStats] = useState({
    totalScore: 0,
    gamesPlayed: 0,
    achievements: [],
    highScores: {},
  });
  const [gameResults, setGameResults] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const games = [
    {
      id: "buoyancy-control",
      title: "Neutral Buoyancy Challenge",
      description: "Master physics and navigation in a simulated water tank.",
      icon: Target,
      difficulty: "Medium",
      duration: "2 min",
      type: "physics",
      color: "#4ecdc4",
      objectives: [
        "Achieve neutral buoyancy",
        "Complete tasks without floating away",
      ],
    },
    {
      id: "spacewalk-repair",
      title: "ISS Repair Mission",
      description: "Perform critical emergency spacewalk equipment repairs.",
      icon: Wrench,
      difficulty: "Hard",
      duration: "5 min",
      type: "skill",
      color: "#ff6b6b",
      objectives: ["Diagnose failures", "Replace damaged components"],
    },
    {
      id: "lunar-collection",
      title: "Lunar Sample Expedition",
      description:
        "Collect scientific samples across the Moon's rugged surface.",
      icon: Package,
      difficulty: "Easy",
      duration: "3 min",
      type: "exploration",
      color: "#45b7d1",
      objectives: [
        "Navigate lunar terrain",
        "Identify and collect valuable samples",
      ],
    },
    {
      id: "equipment-install",
      title: "Space Station Assembly",
      description: "Precision installation and alignment of new modules.",
      icon: Settings,
      difficulty: "Hard",
      duration: "4 min",
      type: "precision",
      color: "#96ceb4",
      objectives: ["Follow procedures", "Align components precisely"],
    },
    {
      id: "emergency-response",
      title: "Emergency Response Drill",
      description: "Crisis management drill for major space emergencies.",
      icon: AlertTriangle,
      difficulty: "Expert",
      duration: "4 min",
      type: "reaction",
      color: "#feca57",
      objectives: ["Assess situation", "Execute response protocols"],
    },
  ];

  const handleGameComplete = (score) => {
    playSound("success", soundEnabled);

    if (score > 5000) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }

    setGameResults({ score, game: currentGame });
    setGameStats((prev) => ({
      ...prev,
      totalScore: prev.totalScore + score,
      gamesPlayed: prev.gamesPlayed + 1,
      highScores: {
        ...prev.highScores,
        [currentGame.id]: Math.max(prev.highScores[currentGame.id] || 0, score),
      },
    }));
  };

  const GameSelector = () => (
    <div className="game-selector">
      <div className="selector-header">
        <h2>
          <Gamepad2 size={32} /> Choose Your Mission
        </h2>
        <p>Select a training simulation to begin your astronaut journey</p>
      </div>
      <div className="games-grid">
        {games.map((game) => (
          <motion.div
            key={game.id}
            className="game-card"
            onClick={() => {
              setCurrentGame(game);
              playSound("click", soundEnabled);
            }}
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.98 }}
            style={{ borderColor: game.color }}
          >
            <div className="game-card-header">
              <div
                className="game-icon"
                style={{ backgroundColor: game.color }}
              >
                <game.icon size={32} />
              </div>
              <div
                className={`difficulty-badge ${game.difficulty.toLowerCase()}`}
              >
                {game.difficulty}
              </div>
            </div>

            <div className="game-card-content">
              <h3>{game.title}</h3>
              <p>{game.description}</p>

              <div className="game-meta">
                <span className="duration">
                  <Timer size={16} /> {game.duration}
                </span>
                <span className="type">{game.type}</span>
              </div>

              <div className="objectives">
                <h4>Mission Objectives:</h4>
                <ul>
                  {game.objectives.slice(0, 2).map((obj, idx) => (
                    <li key={idx}>{obj}</li>
                  ))}
                  {game.objectives.length > 2 && (
                    <li>+{game.objectives.length - 2} more...</li>
                  )}
                </ul>
              </div>

              <div className="high-score">
                Best: {gameStats.highScores[game.id] || 0} pts
              </div>
            </div>

            <div className="play-button">
              <Play size={20} /> Launch Mission
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const GameInterface = ({ game, onBack, onComplete }) => {
    const renderGame = () => {
      switch (game.id) {
        case "buoyancy-control":
          return (
            <BuoyancyGame
              gameId={game.id}
              onComplete={onComplete}
              soundEnabled={soundEnabled}
            />
          );
        case "spacewalk-repair":
          return (
            <SpacewalkRepairGame
              gameId={game.id}
              onComplete={onComplete}
              soundEnabled={soundEnabled}
            />
          );
        case "lunar-collection":
          return (
            <LunarCollectionGame
              gameId={game.id}
              onComplete={onComplete}
              soundEnabled={soundEnabled}
            />
          );
        case "equipment-install":
          return (
            <EquipmentInstallGame
              gameId={game.id}
              onComplete={onComplete}
              soundEnabled={soundEnabled}
            />
          );
        case "emergency-response":
          return (
            <EmergencyResponseGame
              gameId={game.id}
              onComplete={onComplete}
              soundEnabled={soundEnabled}
            />
          );
        default:
          return <div>Game coming soon...</div>;
      }
    };

    return (
      <div className="game-interface">
        <div className="game-header">
          <button className="back-button" onClick={onBack}>
            ← Back to Missions
          </button>
          <h2 style={{ color: game.color }}>
            <game.icon size={28} /> {game.title}
          </h2>
          <div className="game-controls">
            <button
              className={`sound-toggle ${
                soundEnabled ? "enabled" : "disabled"
              }`}
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
          </div>
        </div>

        <div className="game-content">{renderGame()}</div>
      </div>
    );
  };

  const ResultsScreen = () => (
    <motion.div
      className="results-screen"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="results-content">
        <h2>
          <Trophy size={32} /> Mission Complete!
        </h2>

        <div className="score-display">
          <div className="final-score">{gameResults?.score || 0}</div>
          <div className="score-label">Points Earned</div>
        </div>

        <div className="performance-metrics">
          <div className="metric">
            <Star size={20} />
            <span>
              Performance:{" "}
              {gameResults?.score > 8000
                ? "Excellent"
                : gameResults?.score > 5000
                ? "Good"
                : "Fair"}
            </span>
          </div>
          <div className="metric">
            <Medal size={20} />
            <span>
              Rank:{" "}
              {gameResults?.score > 10000
                ? "Elite Astronaut"
                : gameResults?.score > 6000
                ? "Mission Specialist"
                : "Trainee"}
            </span>
          </div>
        </div>

        <div className="results-actions">
          <button
            className="play-again-btn"
            onClick={() => {
              setGameResults(null);
            }}
          >
            <RotateCcw size={20} /> Play Again
          </button>
          <button
            className="back-to-menu-btn"
            onClick={() => {
              setCurrentGame(null);
              setGameResults(null);
            }}
          >
            Back to Menu
          </button>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="interactive-games">
      {showConfetti && (
        <Confetti
          width={windowDimensions.width}
          height={windowDimensions.height}
          recycle={false}
          numberOfPieces={200}
          colors={["#4ecdc4", "#44a08d", "#096dd9", "#722ed1", "#eb2f96"]}
        />
      )}

      <AnimatePresence mode="wait">
        {!currentGame && (
          <motion.div
            key="selector"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <GameSelector />
          </motion.div>
        )}

        {currentGame && !gameResults && (
          <motion.div
            key="game"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
          >
            <GameInterface
              game={currentGame}
              onBack={() => setCurrentGame(null)}
              onComplete={handleGameComplete}
            />
          </motion.div>
        )}

        {gameResults && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
          >
            <ResultsScreen />
          </motion.div>
        )}
      </AnimatePresence>

      {}
      <div className="stats-dashboard">
        <div className="stat-item">
          <Trophy size={20} />
          <span>Total Score: {gameStats.totalScore}</span>
        </div>
        <div className="stat-item">
          <Gamepad2 size={20} />
          <span>Games Played: {gameStats.gamesPlayed}</span>
        </div>
        <div className="stat-item">
          <Award size={20} />
          <span>Achievements: {gameStats.achievements.length}</span>
        </div>
      </div>
    </div>
  );
};

export default InteractiveGames;
