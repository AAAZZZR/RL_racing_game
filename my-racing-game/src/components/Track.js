// src/components/Track.js

/**
 * 隨機生成障礙物的位置，確保不超出內外框之間的區域且彼此不重疊。
 * @param {Object} outerBox - 外框的範圍 { xMin, xMax, yMin, yMax }
 * @param {Object} innerBox - 內框的範圍 { xMin, xMax, yMin, yMax }
 * @param {number} numObstacles - 要生成的障礙物數量
 * @param {number} radius - 每個障礙物的半徑
 * @returns {Array} 障礙物陣列 [{ cx, cy, radius }, ...]
 */
function generateObstacles(outerBox, innerBox, numObstacles, radius) {
  const obstacles = [];

  while (obstacles.length < numObstacles) {
    // 隨機生成障礙物中心
    const cx = Math.random() * (outerBox.xMax - outerBox.xMin - 2 * radius) + outerBox.xMin + radius;
    const cy = Math.random() * (outerBox.yMax - outerBox.yMin - 2 * radius) + outerBox.yMin + radius;

    // 確保障礙物不在內框內
    if (
      cx > innerBox.xMin - radius &&
      cx < innerBox.xMax + radius &&
      cy > innerBox.yMin - radius &&
      cy < innerBox.yMax + radius
    ) {
      continue; // 在內框內，跳過
    }

    // 確保障礙物之間不重疊
    const isOverlapping = obstacles.some(
      (obstacle) => Math.hypot(obstacle.cx - cx, obstacle.cy - cy) < 2 * radius
    );
    if (isOverlapping) continue;

    // 加入障礙物
    obstacles.push({ cx, cy, radius });
  }

  return obstacles;
}

/**
 * trackData:
 * 外框與內框現在根據畫布 (800x600) 的中心對齊。
 * 障礙物動態生成，分別位於內外框之間。
 */
const trackData = {
  lines: [
    // ------ 外框 (Rectangle) ------
    { x1: 100, y1: 100, x2: 700, y2: 100 }, // 上邊
    { x1: 700, y1: 100, x2: 700, y2: 500 }, // 右邊
    { x1: 700, y1: 500, x2: 100, y2: 500 }, // 下邊
    { x1: 100, y1: 500, x2: 100, y2: 100 }, // 左邊

    // ------ 內框 (Rectangle) ------
    { x1: 200, y1: 200, x2: 600, y2: 200 }, // 上邊
    { x1: 600, y1: 200, x2: 600, y2: 400 }, // 右邊
    { x1: 600, y1: 400, x2: 200, y2: 400 }, // 下邊
    { x1: 200, y1: 400, x2: 200, y2: 200 }, // 左邊
  ],
  startFinishLine: { x1: 400, y1: 400, x2: 400, y2: 500}, // 起始/終止線
  checkLines:[
    { x1: 500, y1: 400, x2: 500, y2: 500 }, // 下邊
    { x1: 600, y1: 300, x2: 700, y2: 300 }, // 右邊
    { x1: 400, y1: 100, x2: 400, y2: 200 }, // 上邊
    { x1: 100, y1: 300, x2: 200, y2: 300 }, // 左邊
  ],
  // 隨機生成障礙物
  obstacles: generateObstacles(
    { xMin: 100, xMax: 700, yMin: 100, yMax: 500 }, // 外框範圍
    { xMin: 200, xMax: 600, yMin: 200, yMax: 400 }, // 內框範圍
    3, // 障礙物數量
    20 // 每個障礙物的半徑
  ),
};

/**
 * drawTrack: 將外框 + 內框 + 障礙物畫出來。
 */
function drawTrack(ctx, track) {
  if (!track?.lines) return;

  ctx.save();
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;

  // 依序繪製每一條線段
  track.lines.forEach((line) => {
    ctx.beginPath();
    ctx.moveTo(line.x1, line.y1);
    ctx.lineTo(line.x2, line.y2);
    ctx.stroke();
  });

  // 畫出障礙物
  if (track.obstacles) {
    track.obstacles.forEach((obstacle) => {
      ctx.beginPath();
      ctx.arc(obstacle.cx, obstacle.cy, obstacle.radius, 0, Math.PI * 2);
      ctx.strokeStyle = "red";
      ctx.stroke();
    });
  }
  if (track.startFinishLine) {
    ctx.strokeStyle = "green"; // 起始/終止線顏色
    ctx.lineWidth = 4;
    const { x1, y1, x2, y2 } = track.startFinishLine;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  if (track.checkLines) {
    ctx.strokeStyle = "blue"; // 檢查線顏色
    ctx.lineWidth = 3;
    track.checkLines.forEach((line) => {
      ctx.beginPath();
      ctx.moveTo(line.x1, line.y1);
      ctx.lineTo(line.x2, line.y2);
      ctx.stroke();
    });
  }
  ctx.restore();
}

export { trackData, drawTrack };
