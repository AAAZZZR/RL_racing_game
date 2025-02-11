import React, { useState, useRef, useEffect } from "react";
import Car from "./components/Car";
import { trackData, drawTrack } from "./components/Track";
import { updateCar } from "./components/GameEngine";

// === 幫助函式：線段相交判斷 ===
function lineSegmentsIntersect(p1, p2, p3, p4) {
  const s1x = p2.x - p1.x;
  const s1y = p2.y - p1.y;
  const s2x = p4.x - p3.x;
  const s2y = p4.y - p3.y;

  const denom = -s2x * s1y + s1x * s2y;
  if (denom === 0) {
    // 平行或共線
    return false;
  }

  const s = (-s1y * (p1.x - p3.x) + s1x * (p1.y - p3.y)) / denom;
  const t = (s2x * (p1.y - p3.y) - s2y * (p1.x - p3.x)) / denom;
  return s >= 0 && s <= 1 && t >= 0 && t <= 1;
}

// === 幫助函式：計算點到線段的最短距離 ===
function distanceToLineSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    const distX = px - x1;
    const distY = py - y1;
    return Math.sqrt(distX * distX + distY * distY);
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  const distX = px - projX;
  const distY = py - projY;
  return Math.sqrt(distX * distX + distY * distY);
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

function CarGame() {
  const canvasRef = useRef(null);

  const trackRef = useRef(trackData);
  const carRef = useRef(
    new Car({
      x: CANVAS_WIDTH / 2 - 50,
      y: 450,
      width: 30,
      height: 50,
      speed: 0,
    })
  );

  const keysRef = useRef({
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
  });

  const [time, setTime] = useState(0);
  const [laps, setLaps] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const prevCenterXRef = useRef(carRef.current.x + carRef.current.width / 2);
  const prevCenterYRef = useRef(carRef.current.y + carRef.current.height / 2);

  const nextCheckpointRef = useRef(0);
  const oldDistRef = useRef(null);

  const [mode, setMode] = useState("manual");
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = new WebSocket("ws://localhost:8080");
    console.log("Attempting to connect to WebSocket...");

    socketRef.current.onopen = () => {
      console.log("WebSocket connected to Python server.");
    };

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      //console.log("Message received from Python:", data);

      if (data.action !== undefined) {
        handleAIAction(data.action);
      }
    };

    socketRef.current.onclose = () => {
      console.log("WebSocket connection closed.");
    };

    socketRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    };
  }, []);

  const handleAIAction = (action) => {
    switch (action) {
      case 0:
        keysRef.current = {
          ArrowUp: true,
          ArrowDown: false,
          ArrowLeft: false,
          ArrowRight: false,
        };
        break;
      case 1:
        keysRef.current = {
          ArrowUp: false,
          ArrowDown: false,
          ArrowLeft: true,
          ArrowRight: false,
        };
        break;
      case 2:
        keysRef.current = {
          ArrowUp: false,
          ArrowDown: false,
          ArrowLeft: false,
          ArrowRight: true,
        };
        break;
      case 3:
        keysRef.current = {
          ArrowUp: false,
          ArrowDown: true,
          ArrowLeft: false,
          ArrowRight: false,
        };
        break;
      default:
        keysRef.current = {
          ArrowUp: false,
          ArrowDown: false,
          ArrowLeft: false,
          ArrowRight: false,
        };
        break;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (mode === "manual" && keysRef.current.hasOwnProperty(e.key)) {
        e.preventDefault();
        keysRef.current[e.key] = true;
      }
    };
    const handleKeyUp = (e) => {
      if (mode === "manual" && keysRef.current.hasOwnProperty(e.key)) {
        e.preventDefault();
        keysRef.current[e.key] = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [mode]);

  useEffect(() => {
    if (isRunning) {
      const intervalId = setInterval(() => {
        setTime((prev) => prev + 0.1);
      }, 100);
      return () => clearInterval(intervalId);
    }
  }, [isRunning]);

  useEffect(() => {
    let animationId;
    let reward = 0;
    let done = false;

    function gameLoop() {
     

      const car = carRef.current;
      const track = trackRef.current;
      const keys = keysRef.current;

      updateCar(car, keys, track);

      const carCenterX = car.x + car.width / 2;
      const carCenterY = car.y + car.height / 2;
      const prevCenterX = prevCenterXRef.current;
      const prevCenterY = prevCenterYRef.current;

      const directionReward = car.speed * 0.2;  // 速度獎勵
      const progressReward = nextCheckpointRef.current * 5; // 進度獎勵
      const timePenalty = -0.1; // 時間懲罰
      reward = directionReward + progressReward + timePenalty;
      
      let dist = null;
      function getDistanceToNextCheckpoint() {
        const checkpointIndex = nextCheckpointRef.current;
        if (checkpointIndex < track.checkLines.length) {
          const lineSeg = track.checkLines[checkpointIndex];
          const distance = distanceToLineSegment(
            carCenterX,
            carCenterY,
            lineSeg.x1,
            lineSeg.y1,
            lineSeg.x2,
            lineSeg.y2
          );
          return { distance, lineSeg };
        }
        return { distance: null, lineSeg: null };
      }
      const { distance, lineSeg } = getDistanceToNextCheckpoint();
      dist = distance;

      if (dist !== null) {
        const k = 50;
        const shapingReward = Math.exp(-dist / k);
        if (oldDistRef.current !== null) {
          const diff = oldDistRef.current - dist;
          if (diff > 0) {
            reward += shapingReward * 5;
          } else {
            reward -= Math.abs(diff) * 0.5;
          }
        }
        oldDistRef.current = dist;
      }

      const p1 = { x: prevCenterX, y: prevCenterY };
      const p2 = { x: carCenterX, y: carCenterY };
      track.checkLines.forEach((line, index) => {
        if (nextCheckpointRef.current === index) {
          const p3 = { x: line.x1, y: line.y1 };
          const p4 = { x: line.x2, y: line.y2 };
          if (lineSegmentsIntersect(p1, p2, p3, p4)) {
            reward += 50;
            nextCheckpointRef.current++;
            oldDistRef.current = null;
            if (nextCheckpointRef.current % 5 === 0) {
              reward += 100;
            }
          }
        }
      });

      const { x1, y1, x2, y2 } = track.startFinishLine;
      const sf1 = { x: x1, y: y1 };
      const sf2 = { x: x2, y: y2 };

      if (lineSegmentsIntersect(p1, p2, sf1, sf2)) {
        if (!isRunning) {
          setIsRunning(true);
        } else {
          if (nextCheckpointRef.current === track.checkLines.length) {
            reward += 10;
            done = true;
            nextCheckpointRef.current = 0;
            oldDistRef.current = null;
            setLaps((laps) => laps + 1);
          }
        }
      }

      
      prevCenterXRef.current = carCenterX;
      prevCenterYRef.current = carCenterY;

      if (
        mode === "ai" &&
        socketRef.current &&
        socketRef.current.readyState === WebSocket.OPEN
      ) {
        const state = {
          x: car.x,
          y: car.y,
          speed: car.speed || 0,
          angle: car.angle || 0,
        };
        socketRef.current.send(
          JSON.stringify({
            type: "step",
            observation: state,
            reward: reward,
            done: done,
          })
        );
      }

      renderScene();
      animationId = requestAnimationFrame(gameLoop);
    }

    gameLoop();

    return () => cancelAnimationFrame(animationId);
  }, [isRunning, mode]);

  const renderScene = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawTrack(ctx, trackRef.current);
    carRef.current.draw(ctx);
  };

  return (
    <div className="relative flex flex-col items-center space-y-4">
      <h1 className="text-2xl text-white font-bold">Racing Game</h1>

      <div className="flex space-x-2">
        <button
          onClick={() => setMode("manual")}
          className={`px-4 py-2 rounded ${mode === "manual" ? "bg-blue-500" : "bg-gray-500"}`}
        >
          Manual Mode
        </button>
        <button
          onClick={() => setMode("ai")}
          className={`px-4 py-2 rounded ${mode === "ai" ? "bg-blue-500" : "bg-gray-500"}`}
        >
          AI Mode
        </button>
      </div>

      <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white rounded px-4 py-2 text-center z-10">
        <p className="text-lg font-bold">Time: {time.toFixed(1)}s</p>
        <p className="text-lg font-bold">Laps: {laps}</p>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-4 border-white rounded"
      />
    </div>
  );
}

export default CarGame;
