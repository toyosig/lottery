import React from "react";
import lotteryBg from "./assets/images/image.png";

const App = () => {
  return (
    <div style={styles.page}>
      <div style={styles.backgroundLayer}></div>
      <div style={styles.gradientOverlay}></div>

      <div style={styles.comingSoonOverlay}>
        <div style={styles.comingSoonModal} className="comingSoonModal">
          <div style={styles.glowEffect}></div>
          
          <div style={styles.iconContainer}>
            <span style={styles.icon}>🎰</span>
          </div>
          
          <h1 style={styles.title}>COMING SOON</h1>
          
          <p style={styles.subtitle}>NYNM Casino is launching soon!</p>
          
          <p style={styles.description}>
            Get ready for the most exciting Solana casino experience. 
            Spin, win, and become a legend!
          </p>
          
          <div style={styles.features}>
            <div style={styles.feature}>
              <span style={styles.featureIcon}>💎</span>
              <span style={styles.featureText}>Token-Based Rewards</span>
            </div>
            <div style={styles.feature}>
              <span style={styles.featureIcon}>🏆</span>
              <span style={styles.featureText}>Massive Prize Pools</span>
            </div>
            <div style={styles.feature}>
              <span style={styles.featureIcon}>⚡</span>
              <span style={styles.featureText}>Instant Payouts</span>
            </div>
          </div>
          
          <div style={styles.footer}>
            <span style={styles.footerText}>
              Stay tuned for updates • Built on Solana
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes glow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        @media (max-width: 768px) {
          .comingSoonModal {
            padding: 40px 20px !important;
          }
        }
        
        @media (max-width: 480px) {
          .comingSoonModal {
            padding: 30px 15px !important;
            border-radius: 16px !important;
          }
        }
      `}</style>
    </div>
  );
};

const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  backgroundLayer: {
    position: "fixed",
    inset: 0,
    backgroundImage: `url(${lotteryBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    filter: "brightness(0.4) blur(5px)",
    zIndex: -2,
  },
  gradientOverlay: {
    position: "fixed",
    inset: 0,
    background: "radial-gradient(circle at 50% 0%, rgba(139, 0, 139, 0.3) 0%, rgba(0, 0, 0, 0.9) 70%)",
    zIndex: -1,
  },
  comingSoonOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.85)",
    backdropFilter: "blur(10px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
    overflowY: "auto",
  },
  comingSoonModal: {
    background: "linear-gradient(135deg, rgba(20, 20, 40, 0.95) 0%, rgba(10, 10, 20, 0.95) 100%)",
    backdropFilter: "blur(20px)",
    border: "3px solid rgba(255, 215, 0, 0.4)",
    borderRadius: "24px",
    maxWidth: "700px",
    width: "100%",
    padding: "60px 40px",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.6)",
    textAlign: "center",
    position: "relative",
    overflow: "hidden",
    margin: "auto",
  },
  glowEffect: {
    position: "absolute",
    inset: "-100px",
    background: "radial-gradient(circle, rgba(255, 215, 0, 0.15) 0%, transparent 70%)",
    filter: "blur(50px)",
    animation: "glow 3s ease-in-out infinite",
    zIndex: -1,
  },
  iconContainer: {
    fontSize: "5rem",
    marginBottom: "20px",
    filter: "drop-shadow(0 0 20px rgba(255, 215, 0, 0.8))",
    animation: "pulse 2s ease-in-out infinite",
  },
  icon: {
    display: "inline-block",
  },
  title: {
    fontSize: "clamp(2rem, 8vw, 3.5rem)",
    fontWeight: "900",
    marginBottom: "20px",
    background: "linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)",
    backgroundSize: "200% 100%",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    animation: "shimmer 3s linear infinite",
    textShadow: "0 0 40px rgba(255, 215, 0, 0.5)",
  },
  subtitle: {
    color: "#FFD700",
    fontSize: "clamp(1rem, 4vw, 1.5rem)",
    fontWeight: "700",
    marginBottom: "15px",
  },
  description: {
    color: "#b0b0b0",
    fontSize: "clamp(0.9rem, 3vw, 1.1rem)",
    marginBottom: "50px",
    lineHeight: "1.6",
    maxWidth: "500px",
    margin: "0 auto 50px",
    padding: "0 10px",
  },
  features: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    marginBottom: "50px",
  },
  feature: {
    background: "rgba(255, 215, 0, 0.05)",
    border: "2px solid rgba(255, 215, 0, 0.3)",
    borderRadius: "12px",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "15px",
    transition: "all 0.3s ease",
    flexWrap: "wrap",
  },
  featureIcon: {
    fontSize: "clamp(1.5rem, 5vw, 2rem)",
    filter: "drop-shadow(0 0 10px rgba(255, 215, 0, 0.5))",
  },
  featureText: {
    color: "#fff",
    fontSize: "clamp(0.9rem, 3vw, 1.1rem)",
    fontWeight: "700",
  },
  footer: {
    borderTop: "1px solid rgba(255, 215, 0, 0.2)",
    paddingTop: "30px",
  },
  footerText: {
    color: "#888",
    fontSize: "0.9rem",
    fontWeight: "500",
  },
};

export default App;