import React, { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import idl from "./idl.json";

// Import images from assets
import zeroImage from "./assets/images/zeroImage.png";
import twoImage from "./assets/images/twoImage.png";
import fourImage from "./assets/images/fourImage.png";
import santa from "./assets/images/santa.png";
import lotteryBg from "./assets/images/lotteryBg.jpg";

const PROGRAM_ID = new PublicKey("CfwgZDQq3QrScgkGM3CrBGbJWqLuZ3G7F7u4i7x347CY");

const symbols = [santa, twoImage, fourImage, zeroImage];

const isImage = (symbol) => {
  return typeof symbol === "string";
};

// ------------------------
// Confetti Component
// ------------------------
const Confetti = () => {
  const confettiPieces = Array.from({ length: 200 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    animationDuration: 3 + Math.random() * 4,
    color: ["#FFD700", "#FF1744", "#4CAF50", "#9C27B0", "#00BCD4"][Math.floor(Math.random() * 5)],
    rotation: Math.random() * 360,
    size: 8 + Math.random() * 8,
  }));

  return (
    <div style={styles.confettiContainer}>
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          style={{
            ...styles.confettiPiece,
            left: `${piece.left}%`,
            backgroundColor: piece.color,
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            transform: `rotate(${piece.rotation}deg)`,
            animationDuration: `${piece.animationDuration}s`,
          }}
        />
      ))}
    </div>
  );
};

// ------------------------
// Reel Component
// ------------------------
const Reel = ({ spinning, result, delay }) => {
  const renderSymbol = (symbol) => {
    if (!symbol) return null;
    
    if (isImage(symbol)) {
      return <img src={symbol} alt="" style={{ width: "70%", height: "70%", objectFit: "contain" }} />;
    }
    return <span style={{ color: "white", fontWeight: "900" }}>{symbol}</span>;
  };

  return (
    <div style={styles.reelContainer}>
      <div style={styles.reelBox}>
        <div
          style={{
            ...styles.reelStrip,
            animation: spinning ? "spin 0.1s linear infinite" : "none",
            animationDelay: `${delay}ms`,
          }}
        >
          {symbols.map((s, i) => (
            <div key={i} style={styles.symbol}>
              {renderSymbol(s)}
            </div>
          ))}
        </div>

        {!spinning && result && (
          <div style={styles.finalNumber}>
            {renderSymbol(result)}
          </div>
        )}
      </div>
    </div>
  );
};

// ------------------------
// Main App Component
// ------------------------
const App = () => {
  const { connection } = useConnection();
  const { publicKey, connected, wallet } = useWallet();

  const [program, setProgram] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [playerAccount, setPlayerAccount] = useState(null);
  const [results, setResults] = useState([]);
  const [spinning, setSpinning] = useState([false, false, false]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastWin, setLastWin] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [dailySpinsLeft, setDailySpinsLeft] = useState(0);
  const [prizePool, setPrizePool] = useState(0);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isGettingSpins, setIsGettingSpins] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [hasEnoughTokens, setHasEnoughTokens] = useState(false);

  // Setup Anchor program
  useEffect(() => {
    if (!connection || !wallet?.adapter) {
      setProgram(null);
      return;
    }

    try {
      const provider = new AnchorProvider(
        connection, 
        wallet.adapter, 
        { commitment: "confirmed" }
      );
      
      const prog = new Program(idl, PROGRAM_ID, provider);
      setProgram(prog);
    } catch (error) {
      console.error("Failed to initialize program:", error);
      setProgram(null);
    }
  }, [connection, wallet]);

  // Fetch Game State
  useEffect(() => {
    if (!program || !program.account?.gameState) return;

    const fetchGameState = async () => {
      try {
        const [gamePda] = PublicKey.findProgramAddressSync(
          [Buffer.from("game_state")], 
          PROGRAM_ID
        );
        const state = await program.account.gameState.fetch(gamePda);
        setGameState(state);
        
        if (state?.prizePoolLamports) {
          setPrizePool(state.prizePoolLamports.toNumber() / LAMPORTS_PER_SOL);
        }
      } catch (e) {
        console.log("Game state not initialized yet:", e.message);
      }
    };

    fetchGameState();
    const interval = setInterval(fetchGameState, 10000);
    return () => clearInterval(interval);
  }, [program]);

  // Fetch Player Account
  useEffect(() => {
    if (!program || !publicKey || !program.account?.playerAccount) {
      setPlayerAccount(null);
      setDailySpinsLeft(0);
      return;
    }

    const fetchPlayer = async () => {
      try {
        const [playerPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("player"), publicKey.toBytes()],
          PROGRAM_ID
        );
        const acc = await program.account.playerAccount.fetch(playerPda);
        setPlayerAccount(acc);
        
        if (acc?.dailySpinLimit && acc?.dailySpinsUsed !== undefined) {
          setDailySpinsLeft(acc.dailySpinLimit - acc.dailySpinsUsed);
        }

        // Check token balance
        if (gameState?.tokenMint) {
          const playerTokenAccount = await getAssociatedTokenAddress(
            gameState.tokenMint,
            publicKey
          );
          
          try {
            const tokenAccountInfo = await connection.getTokenAccountBalance(playerTokenAccount);
            const balance = tokenAccountInfo.value.uiAmount || 0;
            setTokenBalance(balance);

            // Check if player has enough tokens (0.04 SOL worth)
            const tokenPriceLamports = gameState.tokenPriceLamports?.toNumber() || 1;
            const minTokens = 40_000_000 / tokenPriceLamports; // 0.04 SOL worth
            setHasEnoughTokens(balance >= minTokens);
          } catch (e) {
            console.log("Token account not found or error:", e);
            setTokenBalance(0);
            setHasEnoughTokens(false);
          }
        }
      } catch (e) {
        console.log("Player account not found:", e.message);
        setPlayerAccount(null);
        setDailySpinsLeft(0);
      }
    };

    fetchPlayer();
    const interval = setInterval(fetchPlayer, 8000);
    return () => clearInterval(interval);
  }, [program, publicKey, gameState, connection]);

  // Register Player Function (called only once when first joining)
  const registerPlayer = async () => {
    if (!program || !publicKey) {
      setErrorMessage("Please connect your wallet first!");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    if (playerAccount) {
      setErrorMessage("You are already registered!");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    if (!hasEnoughTokens) {
      setErrorMessage("You need at least 0.04 SOL worth of tokens to register!");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    setIsRegistering(true);

    try {
      const [playerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("player"), publicKey.toBytes()],
        PROGRAM_ID
      );
      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game_state")], 
        PROGRAM_ID
      );

      // Fetch game state to get token mint
      const gameStateData = await program.account.gameState.fetch(gamePda);
      const tokenMint = gameStateData.tokenMint;

      // Get player's token account address
      const playerTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        publicKey
      );

      // You can set holder rank based on token balance or default to a value
      // For now, we'll use a default rank of 100 (which gives 10 daily spins)
      const holderRank = 100;

      await program.methods
        .registerPlayer(holderRank)
        .accounts({
          playerAccount: playerPda,
          gameState: gamePda,
          playerTokenAccount: playerTokenAccount,
          player: publicKey,
        })
        .rpc();

      setErrorMessage("");
      
      // Refresh player account
      setTimeout(async () => {
        try {
          const acc = await program.account.playerAccount.fetch(playerPda);
          setPlayerAccount(acc);
          
          if (acc?.dailySpinLimit && acc?.dailySpinsUsed !== undefined) {
            setDailySpinsLeft(acc.dailySpinLimit - acc.dailySpinsUsed);
          }
        } catch (e) {
          console.error("Failed to fetch player account:", e);
        }
        setIsRegistering(false);
      }, 2000);

    } catch (err) {
      console.error("Registration failed:", err);
      setErrorMessage(err?.message || "Registration failed!");
      setTimeout(() => setErrorMessage(""), 5000);
      setIsRegistering(false);
    }
  };

  // Get Free Spins Function (called when spins are exhausted but user has enough tokens)
  const getFreeSpins = async () => {
    if (!program || !publicKey) {
      setErrorMessage("Please connect your wallet first!");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    if (!hasEnoughTokens) {
      setErrorMessage("You need at least 0.04 SOL worth of tokens to get free spins!");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    setIsGettingSpins(true);

    try {
      const [playerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("player"), publicKey.toBytes()],
        PROGRAM_ID
      );

      // Refresh player account to check if 24h has passed
      const acc = await program.account.playerAccount.fetch(playerPda);
      const currentTime = Math.floor(Date.now() / 1000);
      const timeSinceReset = currentTime - acc.lastSpinReset.toNumber();
      
      if (timeSinceReset < 86400) { // 86400 seconds = 24 hours
        const hoursLeft = Math.ceil((86400 - timeSinceReset) / 3600);
        setErrorMessage(`You need to wait ${hoursLeft} more hour(s) for free spins!`);
        setTimeout(() => setErrorMessage(""), 5000);
        setIsGettingSpins(false);
        return;
      }

      // If 24h has passed, the next spin will automatically reset the daily spins
      // Just refresh the player account to update the UI
      const freshPlayer = await program.account.playerAccount.fetch(playerPda);
      setPlayerAccount(freshPlayer);
      
      if (freshPlayer?.dailySpinLimit && freshPlayer?.dailySpinsUsed !== undefined) {
        setDailySpinsLeft(freshPlayer.dailySpinLimit - freshPlayer.dailySpinsUsed);
      }

      setErrorMessage("");
      setIsGettingSpins(false);

    } catch (err) {
      console.error("Failed to get free spins:", err);
      setErrorMessage(err?.message || "Failed to refresh spins!");
      setTimeout(() => setErrorMessage(""), 5000);
      setIsGettingSpins(false);
    }
  };

  // Spin Function
  const play = async () => {
    if (!program || !publicKey) {
      setErrorMessage("Please connect your wallet first!");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    if (!playerAccount || dailySpinsLeft <= 0) {
      setErrorMessage("No spins left today or not registered!");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    setIsPlaying(true);
    setLastWin(0);
    setShowConfetti(false);
    setSpinning([true, true, true]);
    setResults([]);

    try {
      const [playerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("player"), publicKey.toBytes()],
        PROGRAM_ID
      );
      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game_state")], 
        PROGRAM_ID
      );

      // Fetch game state to get token mint
      const gameStateData = await program.account.gameState.fetch(gamePda);
      const tokenMint = gameStateData.tokenMint;

      // Get player's token account address
      const playerTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        publicKey
      );

      // Get slot hashes sysvar
      const SLOT_HASHES_SYSVAR_ID = new PublicKey("SysvarS1otHashes111111111111111111111111111");

      await program.methods
        .spin()
        .accounts({
          playerAccount: playerPda,
          gameState: gamePda,
          playerTokenAccount: playerTokenAccount,
          player: publicKey,
          slotHashes: SLOT_HASHES_SYSVAR_ID,
        })
        .rpc();

      // Reel stop animation
      setTimeout(() => setSpinning([false, true, true]), 1500);
      setTimeout(() => setSpinning([false, false, true]), 2200);

      // After spin
      setTimeout(async () => {
        try {
          const freshPlayer = await program.account.playerAccount.fetch(playerPda);
          const freshGame = await program.account.gameState.fetch(gamePda);

          const newSpinsLeft = (freshPlayer?.dailySpinLimit || 0) - (freshPlayer?.dailySpinsUsed || 0);
          setDailySpinsLeft(newSpinsLeft);
          
          if (freshGame?.prizePoolLamports) {
            setPrizePool(freshGame.prizePoolLamports.toNumber() / LAMPORTS_PER_SOL);
          }

          const wonLamports = (freshPlayer?.totalWinnings?.toNumber() || 0) - (playerAccount?.totalWinnings?.toNumber() || 0);
          const wonSOL = wonLamports / LAMPORTS_PER_SOL;

          if (wonLamports > 0) {
            setLastWin(wonSOL);
            setShowConfetti(true);
            setResults([fourImage, zeroImage, twoImage]);
          } else {
            setResults([santa, twoImage, santa]);
          }
        } catch (e) {
          console.error("Failed to fetch updated state:", e);
          setResults([santa, fourImage, zeroImage]);
        }

        setSpinning([false, false, false]);
        setIsPlaying(false);
      }, 3200);
    } catch (err) {
      console.error("Spin failed:", err);
      setErrorMessage(err?.message || "Transaction failed!");
      setTimeout(() => setErrorMessage(""), 5000);
      setSpinning([false, false, false]);
      setIsPlaying(false);
    }
  };

  const isWinner = results.length === 3 && results[0] === fourImage && results[1] === zeroImage && results[2] === twoImage;

  return (
    <div style={styles.page}>
      <div style={styles.backgroundLayer}></div>

      {showConfetti && <Confetti />}

      <div style={styles.headerSection}>
        <h2 style={styles.headerTitle}>Are You Ready To Be A Winner?</h2>
      </div>

      <div style={styles.topButtons}>
        <WalletMultiButton style={{ ...styles.walletButton, height: "50px" }} />
      </div>

      {errorMessage && <div style={styles.errorMessage}>{errorMessage}</div>}

      <div style={styles.container}>
        <div style={styles.slotMachine}>
          <div style={styles.displayPanel}>
            <div style={styles.infoBox}>
              <div style={styles.infoLabel}>PRIZE POOL</div>
              <div style={styles.infoValue}>{prizePool.toFixed(4)} SOL</div>
            </div>

            <div style={styles.infoBox}>
              <div style={styles.infoLabel}>SPINS TODAY</div>
              <div style={styles.infoValue}>{connected ? dailySpinsLeft : "-"}</div>
            </div>

            <div style={styles.infoBox}>
              <div style={styles.infoLabel}>LAST WIN</div>
              <div style={{ ...styles.infoValue, color: lastWin > 0 ? "#FFD700" : "#FFF" }}>
                {lastWin > 0 ? `${lastWin.toFixed(4)} SOL` : "0"}
              </div>
            </div>
          </div>

          <h1 style={styles.title}>🎰 Take A Spin 🎰</h1>

          <div style={styles.reelsSection}>
            <div style={styles.reelsRow}>
              <Reel spinning={spinning[0]} result={results[0]} delay={0} />
              <Reel spinning={spinning[1]} result={results[1]} delay={50} />
              <Reel spinning={spinning[2]} result={results[2]} delay={100} />
            </div>
          </div>

          {isWinner && (
            <div style={styles.winnerBanner}>
              🎉 JACKPOT! YOU WON {lastWin.toFixed(4)} SOL! 🎉
            </div>
          )}

          <div style={styles.controlPanel}>
            {!playerAccount && connected ? (
              <button
                onClick={registerPlayer}
                disabled={isRegistering || !hasEnoughTokens}
                style={{
                  ...styles.registerButton,
                  opacity: isRegistering || !hasEnoughTokens ? 0.6 : 1,
                }}
              >
                {isRegistering ? "REGISTERING..." : hasEnoughTokens ? "REGISTER" : "NEED 0.04 SOL TOKENS"}
              </button>
            ) : dailySpinsLeft <= 0 && connected ? (
              <button
                onClick={getFreeSpins}
                disabled={isGettingSpins || !hasEnoughTokens}
                style={{
                  ...styles.registerButton,
                  opacity: isGettingSpins || !hasEnoughTokens ? 0.6 : 1,
                }}
              >
                {isGettingSpins ? "CHECKING..." : hasEnoughTokens ? "GET FREE SPINS" : "NEED 0.04 SOL TOKENS"}
              </button>
            ) : (
              <button
                onClick={play}
                disabled={!connected || isPlaying || dailySpinsLeft <= 0}
                style={{
                  ...styles.spinButton,
                  opacity: !connected || isPlaying || dailySpinsLeft <= 0 ? 0.6 : 1,
                }}
              >
                {isPlaying ? "SPINNING..." : connected ? "SPIN" : "CONNECT WALLET"}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-${symbols.length * 110}px); }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

// ------------------------
// Styles
// ------------------------
const styles = {
  page: { height: "100vh", width: "100vw", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", overflow: "hidden" },
  headerSection: { padding: "5px 0" },
  headerTitle: { textAlign: "center", color: "#FFD700", fontSize: "clamp(1rem, 3vw, 1.6rem)", marginTop: "5px" },
  container: { flex: 1, width: "100%", display: "flex", justifyContent: "center", alignItems: "center", overflow: "hidden" },
  slotMachine: { background: "linear-gradient(180deg, #1a1a2e 0%, #0f0f1e 100%)", borderRadius: "20px", padding: "15px", border: "4px solid #FFD700", width: "80%", maxWidth: "600px", maxHeight: "70vh", overflow: "hidden", textAlign: "center" },
  displayPanel: { display: "flex", justifyContent: "space-around", marginBottom: "10px", gap: "10px", flexWrap: "wrap" },
  infoBox: { background: "#000", padding: "8px 12px", borderRadius: "10px", border: "2px solid #FFD700", textAlign: "center", minWidth: "100px" },
  infoLabel: { color: "#FFD700", fontSize: "0.8rem", fontWeight: "bold" },
  infoValue: { color: "#FFF", fontSize: "1.2rem", fontWeight: "bold" },
  title: { fontSize: "1.5rem", color: "#FFD700", marginBottom: "10px" },
  reelsSection: { background: "#000", padding: "10px", borderRadius: "15px", border: "3px solid #FFD700", marginBottom: "10px" },
  reelsRow: { display: "flex", justifyContent: "center", gap: "10px" },
  reelContainer: { position: "relative" },
  reelBox: { width: "clamp(60px, 15vw, 110px)", height: "clamp(60px, 15vw, 110px)", background: "#000", borderRadius: "10px", overflow: "hidden", border: "3px solid #FFD700" },
  reelStrip: { display: "flex", flexDirection: "column" },
  symbol: { width: "100%", height: "clamp(60px, 15vw, 110px)", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" },
  finalNumber: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0, 0, 0, 0.85)", display: "flex", justifyContent: "center", alignItems: "center" },
  controlPanel: { display: "flex", gap: "10px", justifyContent: "center", marginTop: "20px" },
  spinButton: { padding: "12px 20px", fontSize: "1.2rem", borderRadius: "50%", background: "linear-gradient(135deg, #FF1744 0%, #C51162 100%)", border: "3px solid #FFD700", color: "white", fontWeight: "bold", cursor: "pointer", minWidth: "clamp(90px, 20vw, 150px)" },
  registerButton: { padding: "12px 20px", fontSize: "1.2rem", borderRadius: "50%", background: "linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)", border: "3px solid #FFD700", color: "white", fontWeight: "bold", cursor: "pointer", minWidth: "clamp(90px, 20vw, 150px)" },
  winnerBanner: { margin: "10px 0", padding: "10px", fontSize: "1.2rem", color: "#FFD700", border: "2px solid #FFD700", borderRadius: "10px", fontWeight: "bold" },
  confettiContainer: { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9999, overflow: "hidden" },
  confettiPiece: { position: "absolute", top: "-20px", animation: "confettiFall linear infinite" },
  topButtons: { width: "80%", maxWidth: "600px", display: "flex", justifyContent: "center", marginBottom: "10px" },
  walletButton: { padding: "10px 15px", fontSize: "0.9rem", borderRadius: "10px", background: "#000", color: "#FFD700", fontWeight: "bold", border: "2px solid #FFD700" },
  errorMessage: { color: "#FF1744", fontWeight: "bold", marginBottom: "10px", textAlign: "center", fontSize: "1.1rem" },
  backgroundLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundImage: `linear-gradient(rgba(75, 12, 12, 0.23), rgba(0,0,0,0.6)), url(${lotteryBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    filter: "blur(8px)",
    zIndex: -1,
  },
};

export default App;