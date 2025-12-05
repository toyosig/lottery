import React, { useState } from "react";
import appleImage from './assets/images/appleImage.png';
import giraffeImage from './assets/images/giraffeImage.png';
import zeroImage from './assets/images/zeroImage.png';
import twoImage from './assets/images/twoImage.png';
import fourImage from './assets/images/fourImage.png';
import NavComponent from "./NavComponent";

// Symbols list
const symbols = [
  appleImage,
  giraffeImage,
  twoImage,
  fourImage,
  zeroImage,
];

// Helper to detect images
const isImage = (symbol) => {
  return (
    typeof symbol === "string" &&
    (symbol.endsWith(".png") ||
     symbol.endsWith(".jpg") ||
     symbol.endsWith(".jpeg") ||
     symbol.startsWith("http"))
  );
};

const Reel = ({ spinning, result }) => {
  const renderSymbol = (symbol) => {
    if (isImage(symbol)) {
      return (
        <img
          src={symbol}
          alt=""
          style={{ width: "80%", height: "80%", objectFit: "contain" }}
        />
      );
    }

    return (
      <span style={{ color: "white", fontWeight: "900" }}>
        {symbol}
      </span>
    );
  };

  return (
    <div style={styles.reelBox}>
      <div
        style={{
          ...styles.reelStrip,
          animation: spinning ? "spin 0.15s linear infinite" : "none"
        }}
      >
        {symbols.map((s, i) => (
          <div key={i} style={styles.symbol}>
            {renderSymbol(s)}
          </div>
        ))}
      </div>

      {!spinning && (
        <div style={styles.finalNumber}>
          {renderSymbol(result)}
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [spinning, setSpinning] = useState([false, false, false]);
  const [results, setResults] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false); // NEW STATE

  const play = () => {
    setIsPlaying(true); // button shows PLAYING...

    const final = [
      symbols[Math.floor(Math.random() * symbols.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
      symbols[Math.floor(Math.random() * symbols.length)]
    ];

    setResults(final);
    setSpinning([true, true, true]);

    // Stop gradually
    setTimeout(() => setSpinning([false, true, true]), 1500);
    setTimeout(() => setSpinning([false, false, true]), 2200);
    setTimeout(() => {
      setSpinning([false, false, false]);
      setIsPlaying(false); // button returns to PLAY after all reels stop
    }, 3000);
  };

  const isWinner = results[0] === "4" && results[1] === "0" && results[2] === "2";

  return (
    <div style={styles.page}>

      <NavComponent />

      <div><h2 style={styles.headerTitle} >Are You Ready To Be A Winner?</h2></div>

      <div style={styles.container}>
        <div style={styles.slotMachine}>
          <h1 style={styles.title}>🎰 Slot Reels 🎰</h1>

          <div style={styles.reelsRow}>
            <Reel spinning={spinning[0]} result={results[0]} />
            <Reel spinning={spinning[1]} result={results[1]} />
            <Reel spinning={spinning[2]} result={results[2]} />
          </div>

          <button
            onClick={play}
            style={styles.button}
            disabled={isPlaying}  // prevents spamming
          >
            {isPlaying ? "PLAYING..." : "PLAY"}
          </button>

          {isWinner && !spinning.includes(true) && (
            <div style={styles.winnerText}>🎉 YOU WIN! 🎉</div>
          )}
        </div>

        <style>
          {`
            @keyframes spin {
              0% { transform: translateY(0px); }
              100% { transform: translateY(-360px); }
            }
          `}
        </style>
      </div>
    </div>
  );
};

// ===================================
//            STYLES
// ===================================
const styles = {
  page: {
    height: "100vh",
    width: "100vw",
    background: "#000",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },

  headerTitle:{
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    paddingBottom: 10,
  },

  container: {
    height: "calc(100vh - 70px)",
    width: "100vw",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#000",
    // paddingTop: 10,
    paddingBottom: 40,
    boxSizing: "border-box",
  },

  slotMachine: {
    textAlign: "center",
    padding: 40,
    borderRadius: 20,
    background: "#111",
    boxShadow: "0 0 40px rgba(255,255,255,0.1)",
  },

  title: {
    fontSize: "3rem",
    color: "white",
    marginBottom: 40,
  },

  reelsRow: {
    display: "flex",
    justifyContent: "center",
    gap: 40,
    marginBottom: 40,
  },

  reelBox: {
    width: 140,
    height: 140,
    background: "#111",
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    border: "4px solid #444",
    boxShadow: "0 0 20px rgba(255,255,255,0.2)",
  },

  reelStrip: {
    display: "flex",
    flexDirection: "column",
  },

  symbol: {
    width: "100%",
    height: 140,
    fontSize: "3rem",
    fontWeight: "900",
    background: "#000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  finalNumber: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    fontSize: "3rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.85)",
    textShadow: "0 0 15px gold",
  },

  button: {
    padding: "15px 50px",
    fontSize: "1.5rem",
    borderRadius: 12,
    background: "gold",
    border: "none",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "all 0.3s",
  },

  winnerText: {
    marginTop: 20,
    fontSize: "2rem",
    fontWeight: "bold",
    color: "lime",
    textShadow: "0 0 10px lime, 0 0 20px lime",
  },
};

export default App;
