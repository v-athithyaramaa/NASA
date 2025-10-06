import { useEffect, useRef } from "react";

export function useKeyboardInput() {
  const keysRef = useRef({
    up: false,

    down: false,

    left: false,

    right: false,

    action: false,

    jump: false,
  });

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase();

      const code = event.code;

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
        ].includes(key) ||
        code === "Space"
      ) {
        event.preventDefault();
      }

      if (key === "w" || key === "arrowup") keysRef.current.up = true;

      if (key === "s" || key === "arrowdown") keysRef.current.down = true;

      if (key === "a" || key === "arrowleft") keysRef.current.left = true;

      if (key === "d" || key === "arrowright") keysRef.current.right = true;

      if (code === "Space") {
        keysRef.current.action = true;

        keysRef.current.jump = true;
      }
    };

    const handleKeyUp = (event) => {
      const key = event.key.toLowerCase();

      const code = event.code;

      if (key === "w" || key === "arrowup") keysRef.current.up = false;

      if (key === "s" || key === "arrowdown") keysRef.current.down = false;

      if (key === "a" || key === "arrowleft") keysRef.current.left = false;

      if (key === "d" || key === "arrowright") keysRef.current.right = false;

      if (code === "Space") {
        keysRef.current.action = false;

        keysRef.current.jump = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);

      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return keysRef;
}

export function calculateDirectionVector(keys, joystickInput = { x: 0, y: 0 }) {
  const keyboardX = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);

  const keyboardY = (keys.current.down ? 1 : 0) - (keys.current.up ? 1 : 0);

  const totalX = keyboardX + (joystickInput.x || 0);

  const totalY = keyboardY + (joystickInput.y || 0);

  const magnitude = Math.hypot(totalX, totalY) || 1;

  return {
    x: totalX / magnitude,

    y: totalY / magnitude,

    isMoving: magnitude > 0.1,
  };
}

export function VirtualJoystick({ onChange, size = 120, className = "" }) {
  const joystickRef = useRef(null);

  const knobRef = useRef(null);

  const isDraggingRef = useRef(false);

  const centerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const joystick = joystickRef.current;

    const knob = knobRef.current;

    if (!joystick || !knob) return;

    const handleStart = (event) => {
      event.preventDefault();

      isDraggingRef.current = true;

      const rect = joystick.getBoundingClientRect();

      centerRef.current = {
        x: rect.left + rect.width / 2,

        y: rect.top + rect.height / 2,
      };

      joystick.style.opacity = "0.8";
    };

    const handleMove = (event) => {
      if (!isDraggingRef.current) return;

      event.preventDefault();

      const clientX = event.touches ? event.touches[0].clientX : event.clientX;

      const clientY = event.touches ? event.touches[0].clientY : event.clientY;

      const deltaX = clientX - centerRef.current.x;

      const deltaY = clientY - centerRef.current.y;

      const distance = Math.hypot(deltaX, deltaY);

      const maxDistance = size / 2 - 20;

      let normalizedX = deltaX / maxDistance;

      let normalizedY = deltaY / maxDistance;

      if (distance > maxDistance) {
        normalizedX = (deltaX / distance) * (maxDistance / maxDistance);

        normalizedY = (deltaY / distance) * (maxDistance / maxDistance);
      }

      const knobX = normalizedX * maxDistance;

      const knobY = normalizedY * maxDistance;

      knob.style.transform = `translate(${knobX}px, ${knobY}px)`;

      onChange({
        x: Math.abs(normalizedX) > 0.1 ? normalizedX : 0,

        y: Math.abs(normalizedY) > 0.1 ? normalizedY : 0,
      });
    };

    const handleEnd = (event) => {
      if (!isDraggingRef.current) return;

      event.preventDefault();

      isDraggingRef.current = false;

      joystick.style.opacity = "0.6";

      knob.style.transform = "translate(0px, 0px)";

      onChange({ x: 0, y: 0 });
    };

    joystick.addEventListener("mousedown", handleStart);

    document.addEventListener("mousemove", handleMove);

    document.addEventListener("mouseup", handleEnd);

    joystick.addEventListener("touchstart", handleStart);

    document.addEventListener("touchmove", handleMove, { passive: false });

    document.addEventListener("touchend", handleEnd);

    return () => {
      joystick.removeEventListener("mousedown", handleStart);

      document.removeEventListener("mousemove", handleMove);

      document.removeEventListener("mouseup", handleEnd);

      joystick.removeEventListener("touchstart", handleStart);

      document.removeEventListener("touchmove", handleMove);

      document.removeEventListener("touchend", handleEnd);
    };
  }, [onChange, size]);

  return (
    <div
      ref={joystickRef}
      className={`virtual-joystick ${className}`}
      style={{
        width: size,

        height: size,

        position: "relative",

        userSelect: "none",

        touchAction: "none",
      }}
    >
           {" "}
      <div
        className="joystick-base"
        style={{
          width: "100%",

          height: "100%",

          borderRadius: "50%",

          background: "rgba(0, 0, 0, 0.3)",

          border: "2px solid rgba(69, 183, 209, 0.6)",

          position: "absolute",
        }}
      />
           {" "}
      <div
        ref={knobRef}
        className="joystick-knob"
        style={{
          width: 40,

          height: 40,

          borderRadius: "50%",

          background: "radial-gradient(circle at 30% 30%, #ffffff, #b3d9ff)",

          border: "2px solid rgba(255, 255, 255, 0.8)",

          position: "absolute",

          left: "50%",

          top: "50%",

          marginLeft: -20,

          marginTop: -20,

          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",

          transition: "transform 0.1s ease-out",
        }}
      />
         {" "}
    </div>
  );
}

export function TouchActionButton({
  onPress,
  onRelease,
  children,
  className = "",
}) {
  const handleTouchStart = (event) => {
    event.preventDefault();

    onPress && onPress();
  };

  const handleTouchEnd = (event) => {
    event.preventDefault();

    onRelease && onRelease();
  };

  return (
    <button
      className={`touch-action-button ${className}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={onPress}
      onMouseUp={onRelease}
      style={{
        background: "rgba(69, 183, 209, 0.7)",

        border: "2px solid rgba(255, 255, 255, 0.8)",

        borderRadius: "50%",

        color: "white",

        width: 60,

        height: 60,

        display: "flex",

        alignItems: "center",

        justifyContent: "center",

        touchAction: "none",

        userSelect: "none",

        fontSize: "1.2rem",
      }}
    >
            {children}   {" "}
    </button>
  );
}
