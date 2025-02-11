//////////////////////////////
// GameEngine.js
//////////////////////////////

import { trackData } from "./Track.js";

export function updateCar(car, keys) {
  // 1. 鍵盤 -> speed
  if (keys.ArrowUp) {
    car.speed += car.accel;
  }
  if (keys.ArrowDown) {
    car.speed -= car.brake;
  }

  // 2. 速度 > 0.2 才能轉向 (前進時 Left/Right，倒車時相反)
  if (car.speed > 0.2) {
    if (keys.ArrowLeft) car.angle -= car.turnSpeed;
    if (keys.ArrowRight) car.angle += car.turnSpeed;
  } else if (car.speed < -0.2) {
    if (keys.ArrowLeft) car.angle += car.turnSpeed;
    if (keys.ArrowRight) car.angle -= car.turnSpeed;
  }

  // 3. 限制最大速度
  if (car.speed > car.maxSpeed) {
    car.speed = car.maxSpeed;
  }
  if (car.speed < -car.maxSpeed / 2) {
    car.speed = -car.maxSpeed / 2;
  }

  // 4. 摩擦力 (若沒按上下鍵)
  if (!keys.ArrowUp && !keys.ArrowDown) {
    if (car.speed > 0) {
      car.speed -= car.friction;
      if (car.speed < 0) car.speed = 0;
    } else if (car.speed < 0) {
      car.speed += car.friction;
      if (car.speed > 0) car.speed = 0;
    }
  }

  // 5. 根據角度更新位置
  car.x += Math.sin(car.angle) * car.speed;
  car.y -= Math.cos(car.angle) * car.speed;

  // 6. 用線段碰撞處理
  handleLineCollisions(car, trackData);

  // 7. 圓形障礙物 (若需要)
  handleObstacleCollision(car, trackData);
}

/**
 * handleLineCollisions:
 * Checks collision between the car (approximated as a circle) and each line in trackData.lines,
 * then does reflection if needed.
 */
function handleLineCollisions(car, track) {
  // Car velocity components
  let vx = Math.sin(car.angle) * car.speed;
  let vy = -Math.cos(car.angle) * car.speed;

  // Car circle center & radius (simple approach)
  const carCenterX = car.x + car.width / 2;
  const carCenterY = car.y + car.height / 2;
  const carRadius = car.width / 2;

  // We may detect multiple collisions; keep track if we collided
  let collided = false;
  let normalX = 0;
  let normalY = 0;

  // For each line segment, check if we collided
  for (let line of track.lines) {
    const { x1, y1, x2, y2 } = line;

    // Line direction
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lineLenSq = dx * dx + dy * dy;
    if (lineLenSq === 0) continue; // Avoid zero-length line

    // Project car center onto the infinite line (param t)
    // param t = ((cx - x1)*dx + (cy - y1)*dy) / (dx^2 + dy^2)
    const t = ((carCenterX - x1) * dx + (carCenterY - y1) * dy) / lineLenSq;

    // Clamp t to [0,1] so we stay within segment
    const tClamped = Math.max(0, Math.min(1, t));

    // Closest point on the segment
    const closestX = x1 + tClamped * dx;
    const closestY = y1 + tClamped * dy;

    // Distance from car center to closest point
    const distX = carCenterX - closestX;
    const distY = carCenterY - closestY;
    const distSq = distX * distX + distY * distY;

    // Check collision
    if (distSq < carRadius * carRadius) {
      // There's an overlap
      const dist = Math.sqrt(distSq);
      const overlap = carRadius - dist;

      // Normal from line to circle center
      let nx = distX / (dist || 1e-6);
      let ny = distY / (dist || 1e-6);

      // 1) Push the car out along that normal
      car.x += nx * overlap;
      car.y += ny * overlap;

      // 2) Compute reflection
      //    v' = v - 2*(v·n)*n
      //    dot = vx*nx + vy*ny
      const dot = vx * nx + vy * ny;
      let vxPrime = vx - 2 * dot * nx;
      let vyPrime = vy - 2 * dot * ny;

      // Some bounce factor
      const bounceFactor = 0.7;
      vxPrime *= bounceFactor;
      vyPrime *= bounceFactor;

      // Convert vxPrime, vyPrime back to (speed, angle)
      const newSpeed = Math.sqrt(vxPrime * vxPrime + vyPrime * vyPrime);
      //const newAngle = Math.atan2(vxPrime, -vyPrime);

      car.speed = newSpeed;
      //car.angle = newAngle;

      // We only handle one collision at a time for simplicity;
      // break or keep going if you want multiple collisions per frame
      collided = true;
      break;
    }
  }
}

/**
 * handleObstacleCollision:
 * Same as your original code. If track.obstacle is present, do circle vs circle collision.
 */
function handleObstacleCollision(car, track) {
  if (!track.obstacles) return;

  track.obstacles.forEach((obstacle) => {
    const { cx, cy, radius } = obstacle;

    // 計算車子的中心點與障礙物中心點的距離
    const carCenterX = car.x + car.width / 2;
    const carCenterY = car.y + car.height / 2;
    const dx = carCenterX - cx;
    const dy = carCenterY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 確認車子的邊界與障礙物是否重疊
    const carRadius = car.width / 2; // 假設車子寬度為直徑
    if (dist < radius + carRadius) {
      // 撞到障礙物
      const overlap = (radius + carRadius) - dist;

      // 計算法向量 (從障礙物指向車子)
      const nx = dx / dist;
      const ny = dy / dist;

      // 1) 推開車子以解決重疊
      car.x += nx * overlap;
      car.y += ny * overlap;

      // 2) 計算反射方向
      //    v' = v - 2 * (v · n) * n
      const vx = Math.sin(car.angle) * car.speed;
      const vy = -Math.cos(car.angle) * car.speed;
      const dot = vx * nx + vy * ny; // 內積
      const vxPrime = vx - 2 * dot * nx;
      const vyPrime = vy - 2 * dot * ny;

      // 3) 減速（模擬碰撞損耗）
      const bounceFactor = 0.5; // 碰撞後速度衰減
      car.speed = Math.sqrt(vxPrime * vxPrime + vyPrime * vyPrime) * bounceFactor;

      // 更新車子的方向
      //car.angle = Math.atan2(vxPrime, -vyPrime);
    }
  });
  
}
