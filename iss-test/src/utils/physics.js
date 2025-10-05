// NBL Training Simulator Physics Engine

// Handles underwater buoyancy, EVA tether mechanics, and lunar gravity

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const lerp = (a, b, t) => a + (b - a) * t;

export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function applyDrag(velocity, dragCoeff = 0.92) {
  return {
    x: velocity.x * dragCoeff,

    y: velocity.y * dragCoeff,
  };
}

export function integrate(position, velocity, acceleration, deltaTime) {
  const newVelocity = {
    x: velocity.x + acceleration.x * deltaTime,

    y: velocity.y + acceleration.y * deltaTime,
  };

  const newPosition = {
    x: position.x + newVelocity.x * deltaTime,

    y: position.y + newVelocity.y * deltaTime,
  };

  return [newPosition, newVelocity];
}

export function computeBuoyancy({
  mass = 80,

  floaties = 0,

  weights = 0,

  waterDensity = 1.0,

  gravity = 9.81,
}) {
  // Floaties provide upward lift, weights add downward force

  const floatiesLift = floaties * 0.9; // Tunable lift per floatie unit

  const weightsPull = weights * 1.0; // Tunable mass per weight unit // Calculate effective mass after equipment
  const effectiveMass = mass + weightsPull - floatiesLift; // Forces in Newtons

  const weightForce = effectiveMass * gravity;

  const buoyancyForce = waterDensity * gravity * (1.0 + floaties * 0.05); // Net force (positive = upward, negative = downward)

  const netForceY = buoyancyForce - weightForce; // Neutral buoyancy when forces are balanced (within tolerance)

  const isNeutral = Math.abs(netForceY) < 0.8;

  return {
    netForceY,

    isNeutral,

    buoyancyStatus:
      netForceY > 2 ? "floating" : netForceY < -2 ? "sinking" : "neutral",
  };
}

export function calculateTetherForce(
  playerPos,
  anchorPos,
  maxLength = 200,
  springConstant = 0.04
) {
  const dx = playerPos.x - anchorPos.x;

  const dy = playerPos.y - anchorPos.y;

  const currentDistance = Math.hypot(dx, dy); // No force if within tether limit

  if (currentDistance <= maxLength) {
    return { x: 0, y: 0, tension: 0 };
  } // Spring force pulls toward anchor when tether is stretched

  const stretch = currentDistance - maxLength;

  const force = stretch * springConstant; // Normalize direction and apply force

  const directionX = -dx / currentDistance;

  const directionY = -dy / currentDistance;

  return {
    x: directionX * force,

    y: directionY * force,

    tension: force,
  };
}

export function applyLunarGravity(acceleration, lunarGravity = 0.12) {
  return {
    x: acceleration.x,

    y: acceleration.y + lunarGravity,
  };
}

export function checkCollision(playerPos, objective, playerRadius = 16) {
  const dist = distance(playerPos, objective.pos);

  return dist <= objective.radius + playerRadius;
}

export function constrainToBounds(position, bounds) {
  return {
    x: clamp(position.x, bounds.minX, bounds.maxX),

    y: clamp(position.y, bounds.minY, bounds.maxY),
  };
}

export function normalizeInput(inputX, inputY) {
  const magnitude = Math.hypot(inputX, inputY) || 1;

  return {
    x: inputX / magnitude,

    y: inputY / magnitude,
  };
}
