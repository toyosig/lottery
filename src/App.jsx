import React, { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import idl from "./idl.json";

// Import images and PDF from assets
import zeroImage from "./assets/images/zeroImage.png";
import twoImage from "./assets/images/twoImage.png";
import fourImage from "./assets/images/fourImage.png";
import apple from "./assets/images/appleImage.png";
import giraffe from "./assets/images/giraffeImage.png";
import santa from "./assets/images/santa.png";
import lotteryBg from "./assets/images/lotteryBg.jpg";
import whiteboardPdf from "./assets/whiteboardPdf.pdf"; // Your PDF file

const PROGRAM_ID = new PublicKey("CfwgZDQq3QrScgkGM3CrBGbJWqLuZ3G7F7u4i7x347CY");

const SPIN_COST_SOL = 0.01;
const MIN_SOL_BALANCE = 0.1;

const symbols = [santa, twoImage, giraffe, apple, fourImage, zeroImage];

const isImage = (symbol) => typeof symbol === "string";

// Map reel values (0-9) to symbols
const mapReelToSymbol = (reelValue) => {
  const mapping = {
    0: zeroImage,
    1: santa,
    2: twoImage,
    3: giraffe,
    4: fourImage,
    5: apple,
    6: santa,
    7: giraffe,
    8: apple,
    9: santa
  };
  return mapping[reelValue] || santa;
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
  const [extraSpins, setExtraSpins] = useState(0);
  const [prizePool, setPrizePool] = useState(0);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isBuyingSpin, setIsBuyingSpin] = useState(false);
  const [solBalance, setSolBalance] = useState(0);
  const [hasEnoughSOL, setHasEnoughSOL] = useState(false);
  const [timeUntilReset, setTimeUntilReset] = useState("");
  const [holderRank, setHolderRank] = useState(50);

  // Setup Anchor program
  useEffect(() => {
    if (!connection || !wallet?.adapter) {
      setProgram(null);
      return;
    }

    try {
      const provider = new AnchorProvider(connection, wallet.adapter, {
        commitment: "confirmed",
        preflightCommitment: "confirmed"
      });

      const prog = new Program(idl, PROGRAM_ID, provider);
      console.log("✅ Program initialized:", prog.programId.toString());
      setProgram(prog);
    } catch (error) {
      console.error("❌ Failed to initialize program:", error);
      setErrorMessage("Failed to load game. Please refresh.");
      setTimeout(() => setErrorMessage(""), 5000);
      setProgram(null);
    }
  }, [connection, wallet]);

  // Fetch SOL balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!publicKey || !connection) return;

      try {
        const balance = await connection.getBalance(publicKey);
        const solBal = balance / LAMPORTS_PER_SOL;
        console.log(`💰 SOL balance: ${solBal.toFixed(4)}`);
        setSolBalance(solBal);
        setHasEnoughSOL(solBal >= MIN_SOL_BALANCE);
      } catch (e) {
        console.log("⚠️ Failed to fetch balance:", e);
        setSolBalance(0);
        setHasEnoughSOL(false);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [publicKey, connection]);

  // Fetch Game State and Prize Pool
  useEffect(() => {
    if (!program) return;

    const fetchGameState = async () => {
      try {
        const [gamePda] = PublicKey.findProgramAddressSync(
          [Buffer.from("game")],
          PROGRAM_ID
        );

        const gameAccount = await connection.getAccountInfo(gamePda);
        if (gameAccount) {
          const state = await program.account.gameState.fetch(gamePda);
          console.log("🎮 Game state:", state);
          setGameState(state);

          const lamports = gameAccount.lamports;
          const poolSol = lamports / LAMPORTS_PER_SOL;
          console.log(`💰 Prize pool: ${poolSol.toFixed(4)} SOL`);
          setPrizePool(poolSol);
        }
      } catch (e) {
        console.log("⚠️ Game state fetch error:", e);
      }
    };

    fetchGameState();
    const interval = setInterval(fetchGameState, 10000);
    return () => clearInterval(interval);
  }, [program, connection]);

  // Calculate time until daily reset
  useEffect(() => {
    if (!playerAccount || !playerAccount.lastSpinReset) return;

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const lastReset = playerAccount.lastSpinReset.toNumber();
      const timeSinceReset = now - lastReset;
      const timeRemaining = 86400 - timeSinceReset;

      if (timeRemaining <= 0) {
        setTimeUntilReset("Spins available! Play to reset.");
      } else {
        const hours = Math.floor(timeRemaining / 3600);
        const minutes = Math.floor((timeRemaining % 3600) / 60);
        setTimeUntilReset(`${hours}h ${minutes}m until reset`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [playerAccount]);

  // Fetch Player Account
  useEffect(() => {
    if (!program || !publicKey) {
      setPlayerAccount(null);
      setDailySpinsLeft(0);
      setExtraSpins(0);
      return;
    }

    const fetchPlayer = async () => {
      try {
        const [playerPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("player"), publicKey.toBytes()],
          PROGRAM_ID
        );

        const acc = await program.account.playerAccount.fetch(playerPda);
        console.log("👤 Player account:", acc);
        setPlayerAccount(acc);
        setDailySpinsLeft(acc.dailySpinLimit - acc.dailySpinsUsed);
        setExtraSpins(acc.extraSpins.toNumber());
      } catch (e) {
        console.log("⚠️ Player not registered");
        setPlayerAccount(null);
        setDailySpinsLeft(0);
        setExtraSpins(0);
      }
    };

    fetchPlayer();
    const interval = setInterval(fetchPlayer, 8000);
    return () => clearInterval(interval);
  }, [program, publicKey]);

  // Register Player
  const registerPlayer = async () => {
    if (!program || !publicKey || playerAccount || !hasEnoughSOL) return;

    setIsRegistering(true);
    console.log("📝 Registering player...");

    try {
      const [playerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("player"), publicKey.toBytes()],
        PROGRAM_ID
      );

      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game")],
        PROGRAM_ID
      );

      const tx = await program.methods
        .registerPlayer(holderRank)
        .accounts({
          gameState: gamePda,
          playerAccount: playerPda,
          player: publicKey,
        })
        .rpc();

      console.log("✅ Registration successful! Tx:", tx);
      await new Promise(resolve => setTimeout(resolve, 3000));
      setIsRegistering(false);
    } catch (err) {
      console.error("❌ Registration failed:", err);
      setErrorMessage(err?.message?.substring(0, 100) || "Registration failed!");
      setTimeout(() => setErrorMessage(""), 5000);
      setIsRegistering(false);
    }
  };

  // Buy Extra Spin
  const buyExtraSpin = async () => {
    if (!program || !publicKey || !playerAccount) return;

    if (solBalance < SPIN_COST_SOL) {
      setErrorMessage(`Need ${SPIN_COST_SOL} SOL for extra spin!`);
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    setIsBuyingSpin(true);

    try {
      const [playerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("player"), publicKey.toBytes()],
        PROGRAM_ID
      );

      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game")],
        PROGRAM_ID
      );

      const tx = await program.methods
        .buyExtraSpin()
        .accounts({
          gameState: gamePda,
          playerAccount: playerPda,
          player: publicKey,
          systemProgram: SystemProgram.programId
        })
        .rpc();

      console.log("✅ Extra spin purchased! Tx:", tx);
      setTimeout(() => setIsBuyingSpin(false), 2000);
    } catch (err) {
      console.error("❌ Purchase failed:", err);
      setErrorMessage(err?.message || "Purchase failed!");
      setTimeout(() => setErrorMessage(""), 5000);
      setIsBuyingSpin(false);
    }
  };

  // Spin Function
  const play = async () => {
    if (!program || !publicKey || !playerAccount) return;

    const totalSpinsAvailable = dailySpinsLeft + extraSpins;
    if (totalSpinsAvailable <= 0) {
      setErrorMessage("No spins left! Buy extra spins or wait for daily reset.");
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
        [Buffer.from("game")],
        PROGRAM_ID
      );

      const clientSeed = new BN(Math.floor(Math.random() * 1000000000));

      const tx = await program.methods
        .spin(clientSeed)
        .accounts({
          gameState: gamePda,
          playerAccount: playerPda,
          player: publicKey,
          systemProgram: SystemProgram.programId
        })
        .rpc();

      console.log("✅ Spin transaction sent! Tx:", tx);

      const fetchResults = async () => {
        try {
          const freshPlayer = await program.account.playerAccount.fetch(playerPda);
          const gameAccount = await connection.getAccountInfo(gamePda);
          const newPool = gameAccount ? gameAccount.lamports / LAMPORTS_PER_SOL : 0;

          const previousWinnings = playerAccount?.totalWinnings?.toNumber() || 0;
          const currentWinnings = freshPlayer.totalWinnings?.toNumber() || 0;
          const wonLamports = currentWinnings - previousWinnings;
          const wonSOL = wonLamports / LAMPORTS_PER_SOL;

          let finalResults;
          if (wonLamports > 0) {
            finalResults = [fourImage, zeroImage, twoImage];
          } else {
            do {
              finalResults = [
                symbols[Math.floor(Math.random() * symbols.length)],
                symbols[Math.floor(Math.random() * symbols.length)],
                symbols[Math.floor(Math.random() * symbols.length)]
              ];
            } while (
              finalResults[0] === fourImage && 
              finalResults[1] === zeroImage && 
              finalResults[2] === twoImage
            );
          }

          return { results: finalResults, wonSOL, freshPlayer, newPool };
        } catch (e) {
          console.error("❌ Failed to fetch results:", e);
          let fallbackResults;
          do {
            fallbackResults = [
              symbols[Math.floor(Math.random() * symbols.length)],
              symbols[Math.floor(Math.random() * symbols.length)],
              symbols[Math.floor(Math.random() * symbols.length)]
            ];
          } while (
            fallbackResults[0] === fourImage && 
            fallbackResults[1] === zeroImage && 
            fallbackResults[2] === twoImage
          );
          return { results: fallbackResults, wonSOL: 0, freshPlayer: playerAccount, newPool: prizePool };
        }
      };

      const resultData = await fetchResults();

      setTimeout(() => {
        setSpinning([false, true, true]);
        setResults([resultData.results[0]]);
      }, 1500);

      setTimeout(() => {
        setSpinning([false, false, true]);
        setResults([resultData.results[0], resultData.results[1]]);
      }, 2200);

      setTimeout(() => {
        setSpinning([false, false, false]);
        setResults(resultData.results);

        setDailySpinsLeft(resultData.freshPlayer.dailySpinLimit - resultData.freshPlayer.dailySpinsUsed);
        setExtraSpins(resultData.freshPlayer.extraSpins.toNumber());
        setPrizePool(resultData.newPool);

        if (resultData.wonSOL > 0) {
          setLastWin(resultData.wonSOL);
          setShowConfetti(true);
        }

        setIsPlaying(false);
      }, 3200);
    } catch (err) {
      console.error("❌ Spin failed:", err);
      setErrorMessage(err?.message || "Spin failed!");
      setTimeout(() => setErrorMessage(""), 5000);
      setSpinning([false, false, false]);
      setIsPlaying(false);
    }
  };

  const isWinner =
    results.length === 3 &&
    results[0] === fourImage &&
    results[1] === zeroImage &&
    results[2] === twoImage;

  return (
    <div style={styles.page}>
      <div style={styles.backgroundLayer}></div>

      {showConfetti && <Confetti />}

      <div style={styles.headerSection}>
        <h2 style={styles.headerTitle}>🎰 Solana Slot Casino 🎰</h2>
        <div style={styles.programIdDisplay}>
          Program ID: <code>{PROGRAM_ID.toBase58()}</code>
        </div>
      </div>

      <div style={styles.topButtons}>
        <WalletMultiButton style={{ ...styles.walletButton, height: "50px" }} />
        <a
          href={whiteboardPdf}
          download="Slot_Casino_Whiteboard.pdf"
          style={{ textDecoration: "none" }}
        >
          <button style={styles.whiteboardButton}>
            📄 Download Whiteboard PDF
          </button>
        </a>
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
              <div style={styles.infoLabel}>DAILY SPINS</div>
              <div style={styles.infoValue}>{connected ? dailySpinsLeft : "-"}</div>
            </div>

            <div style={styles.infoBox}>
              <div style={styles.infoLabel}>EXTRA SPINS</div>
              <div style={styles.infoValue}>{connected ? extraSpins : "-"}</div>
            </div>

            <div style={styles.infoBox}>
              <div style={styles.infoLabel}>LAST WIN</div>
              <div style={{ ...styles.infoValue, color: lastWin > 0 ? "#FFD700" : "#FFF" }}>
                {lastWin > 0 ? `${lastWin.toFixed(4)} SOL` : "0"}
              </div>
            </div>
          </div>

          {connected && (
            <div style={styles.rankBadge}>
              💰 SOL Balance: {solBalance.toFixed(4)} SOL | Test Rank: #{holderRank}
            </div>
          )}

          {connected && playerAccount && (
            <div style={styles.statsBadge}>
              📊 Total Spins: {playerAccount.totalSpins} | Wins: {playerAccount.totalWins} | 
              Total Won: {(playerAccount.totalWinnings.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
            </div>
          )}

          {connected && playerAccount && dailySpinsLeft === 0 && extraSpins === 0 && (
            <div style={styles.timerBadge}>
              ⏰ {timeUntilReset}
            </div>
          )}

          <h1 style={styles.title}>🎲 Take A Spin 🎲</h1>

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
                disabled={isRegistering || !hasEnoughSOL}
                style={{
                  ...styles.registerButton,
                  opacity: isRegistering || !hasEnoughSOL ? 0.6 : 1,
                }}
              >
                {isRegistering ? "REGISTERING..." : 
                 !hasEnoughSOL ? `NEED ${MIN_SOL_BALANCE} SOL` : 
                 "REGISTER TO PLAY"}
              </button>
            ) : (
              <>
                <button
                  onClick={play}
                  disabled={!connected || isPlaying || (dailySpinsLeft <= 0 && extraSpins <= 0)}
                  style={{
                    ...styles.spinButton,
                    opacity: !connected || isPlaying || (dailySpinsLeft <= 0 && extraSpins <= 0) ? 0.6 : 1,
                  }}
                >
                  {isPlaying ? "SPINNING..." : connected ? "SPIN" : "CONNECT WALLET"}
                </button>

                {connected && playerAccount && (
                  <button
                    onClick={buyExtraSpin}
                    disabled={isBuyingSpin}
                    style={{
                      ...styles.buySpinButton,
                      opacity: isBuyingSpin ? 0.6 : 1,
                    }}
                  >
                    {isBuyingSpin ? "BUYING..." : "BUY EXTRA SPIN (0.01 SOL)"}
                  </button>
                )}
              </>
            )}
          </div>

        </div>
      </div>

      <style jsx>{`
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
  headerSection: { padding: "10px 0", textAlign: "center" },
  headerTitle: { color: "#FFD700", fontSize: "clamp(1.4rem, 4vw, 2rem)", margin: "0 0 8px 0" },
  programIdDisplay: {
    color: "#FFD700",
    fontSize: "0.85rem",
    background: "rgba(0,0,0,0.6)",
    padding: "8px 12px",
    borderRadius: "10px",
    border: "1px solid #FFD700",
    wordBreak: "break-all",
  },
  topButtons: { width: "80%", maxWidth: "600px", display: "flex", justifyContent: "center", alignItems: "center", gap: "15px", marginBottom: "10px", flexWrap: "wrap" },
  walletButton: { padding: "10px 15px", fontSize: "0.9rem", borderRadius: "10px", background: "#000", color: "#FFD700", fontWeight: "bold", border: "2px solid #FFD700" },
  whiteboardButton: {
    padding: "12px 20px",
    fontSize: "1rem",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2196F3 0%, #1976D2 100%)",
    border: "3px solid #FFD700",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
  },
  container: { flex: 1, width: "100%", display: "flex", justifyContent: "center", alignItems: "center" },
  slotMachine: { background: "linear-gradient(180deg, #1a1a2e 0%, #0f0f1e 100%)", borderRadius: "20px", padding: "15px", border: "4px solid #FFD700", width: "80%", maxWidth: "600px", textAlign: "center" },
  displayPanel: { display: "flex", justifyContent: "space-around", marginBottom: "10px", gap: "8px", flexWrap: "wrap" },
  infoBox: { background: "#000", padding: "8px 12px", borderRadius: "10px", border: "2px solid #FFD700", minWidth: "90px" },
  infoLabel: { color: "#FFD700", fontSize: "0.7rem", fontWeight: "bold" },
  infoValue: { color: "#FFF", fontSize: "1rem", fontWeight: "bold" },
  title: { fontSize: "1.5rem", color: "#FFD700", margin: "15px 0 10px" },
  reelsSection: { background: "#000", padding: "10px", borderRadius: "15px", border: "3px solid #FFD700", marginBottom: "10px" },
  reelsRow: { display: "flex", justifyContent: "center", gap: "10px" },
  reelContainer: { position: "relative" },
  reelBox: { width: "clamp(60px, 15vw, 110px)", height: "clamp(60px, 15vw, 110px)", background: "#000", borderRadius: "10px", overflow: "hidden", border: "3px solid #FFD700" },
  reelStrip: { display: "flex", flexDirection: "column" },
  symbol: { width: "100%", height: "clamp(60px, 15vw, 110px)", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" },
  finalNumber: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0, 0, 0, 0.85)", display: "flex", justifyContent: "center", alignItems: "center" },
  controlPanel: { display: "flex", gap: "10px", justifyContent: "center", marginTop: "20px", flexWrap: "wrap" },
  spinButton: { padding: "12px 20px", fontSize: "1.2rem", borderRadius: "50%", background: "linear-gradient(135deg, #FF1744 0%, #C51162 100%)", border: "3px solid #FFD700", color: "white", fontWeight: "bold", cursor: "pointer", minWidth: "150px" },
  registerButton: { padding: "12px 20px", fontSize: "1.1rem", borderRadius: "50%", background: "linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)", border: "3px solid #FFD700", color: "white", fontWeight: "bold", cursor: "pointer", minWidth: "180px" },
  buySpinButton: { padding: "10px 18px", fontSize: "1rem", borderRadius: "50%", background: "linear-gradient(135deg, #9C27B0 0%, #6A1B9A 100%)", border: "3px solid #FFD700", color: "white", fontWeight: "bold", cursor: "pointer" },
  winnerBanner: { margin: "10px 0", padding: "10px", fontSize: "1.2rem", color: "#FFD700", border: "2px solid #FFD700", borderRadius: "10px", fontWeight: "bold" },
  rankBadge: { margin: "10px 0", padding: "8px", background: "#000", border: "2px solid #FFD700", borderRadius: "10px", color: "#FFD700", fontWeight: "bold", fontSize: "0.9rem" },
  statsBadge: { margin: "10px 0", padding: "8px", background: "#000", border: "2px solid #4CAF50", borderRadius: "10px", color: "#4CAF50", fontWeight: "bold", fontSize: "0.85rem" },
  timerBadge: { margin: "10px 0", padding: "8px", background: "#000", border: "2px solid #FF1744", borderRadius: "10px", color: "#FF1744", fontWeight: "bold" },
  confettiContainer: { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9999 },
  confettiPiece: { position: "absolute", top: "-20px", animation: "confettiFall linear infinite" },
  errorMessage: { color: "#FF1744", fontWeight: "bold", marginBottom: "10px", textAlign: "center", fontSize: "1.1rem", padding: "10px", background: "rgba(255, 23, 68, 0.2)", borderRadius: "10px", border: "2px solid #FF1744" },
  infoText: { marginTop: "15px", fontSize: "0.85rem", color: "#FFF", lineHeight: "1.6", padding: "10px", background: "rgba(0,0,0,0.5)", borderRadius: "10px" },
};

export default App;