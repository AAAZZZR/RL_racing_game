// src/App.js
import React from "react";
import CarGame from "./CarGame";
import "./index.css"; // Tailwind 基本設定

function App() {
  return (
    <div className="bg-gray-800 min-h-screen flex items-center justify-center">
      <CarGame />
    </div>
  );
}

export default App;
