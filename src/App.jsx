import React, { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";

import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import idl from "./idl.json";

// Import images from assets
import zeroImage from "./assets/images/zeroImage.png";
import twoImage from "./assets/images/twoImage.png";
import fourImage from "./assets/images/fourImage.png";
import apple from "./assets/images/appleImage.png";
import giraffe from "./assets/images/giraffeImage.png"
import santa from "./assets/images/santa.png";
import lotteryBg from "./assets/images/lotteryBg.jpg";
import whiteboardPdf from "./assets/whiteboardPdf.pdf";

const PROGRAM_ID = new PublicKey("CfwgZDQq3QrScgkGM3CrBGbJWqLuZ3G7F7u4i7x347CY");
const RECENT_BLOCKHASHES_SYSVAR = new PublicKey("SysvarRecentB1ockHashes11111111111111111111");

const SPIN_COST_SOL = 0.01;
const MIN_SOL_BALANCE = 0.1;

const symbols = [santa, twoImage, giraffe, apple, fourImage, zeroImage];
const isImage = (symbol) => typeof symbol === "string";

// Map blockchain reel values (0-9) to our symbols
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
    9: twoImage
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
  const [copiedContract, setCopiedContract] = useState(false);

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

      const prog = new Program(idl, provider);
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
        console.log("⚠️ Failed to fetch balance:", e.message);
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
          console.log("🎮 Game state:", {
            totalSpins: state.totalSpins.toString(),
            totalJackpots: state.totalJackpots.toString()
          });
          setGameState(state);

          const lamports = gameAccount.lamports;
          const poolSol = lamports / LAMPORTS_PER_SOL;
          console.log(`💰 Prize pool: ${poolSol.toFixed(4)} SOL`);
          setPrizePool(poolSol);
        } else {
          console.log("⚠️ Game state not initialized yet");
        }
      } catch (e) {
        console.log("⚠️ Game state fetch error:", e.message);
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
        console.log("👤 Player account:", {
          rank: acc.holderRank,
          dailyLimit: acc.dailySpinLimit,
          dailyUsed: acc.dailySpinsUsed,
          extraSpins: acc.extraSpins,
          totalSpins: acc.totalSpins,
          totalWins: acc.totalWins,
          totalWinnings: (acc.totalWinnings.toNumber() / LAMPORTS_PER_SOL).toFixed(4) + " SOL"
        });
        setPlayerAccount(acc);
        setDailySpinsLeft(acc.dailySpinLimit - acc.dailySpinsUsed);
        setExtraSpins(acc.extraSpins);
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

  // Copy contract address to clipboard
  const copyContractAddress = () => {
    navigator.clipboard.writeText(PROGRAM_ID.toString());
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 2000);
  };

  // Download PDF
  const downloadPDF = () => {
    const link = document.createElement('a');
    link.href = whiteboardPdf;
    link.download = 'whiteboard.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Register Player
  const registerPlayer = async () => {
    if (!program || !publicKey || playerAccount || !hasEnoughSOL) {
      console.log("⚠️ Cannot register:", { 
        hasProgram: !!program, 
        hasPublicKey: !!publicKey, 
        alreadyRegistered: !!playerAccount,
        hasEnoughSOL
      });
      return;
    }

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

      console.log("📋 Registration params:", {
        holderRank,
        playerPda: playerPda.toString(),
        gamePda: gamePda.toString()
      });

      const tx = await program.methods
        .registerPlayer(holderRank)
        .accounts({
          gameState: gamePda,
          playerAccount: playerPda,
          player: publicKey,
        })
        .rpc({
          skipPreflight: false,
          commitment: "confirmed"
        });

      console.log("✅ Registration successful! Tx:", tx);
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      setIsRegistering(false);
    } catch (err) {
      console.error("❌ Registration failed:", err);
      
      if (err.logs) {
        console.error("Program logs:", err.logs);
      }
      
      setErrorMessage(err?.message?.substring(0, 100) || "Registration failed!");
      setTimeout(() => setErrorMessage(""), 5000);
      setIsRegistering(false);
    }
  };

  // Buy Extra Spin
  const buyExtraSpin = async () => {
    if (!program || !publicKey || !playerAccount) {
      console.log("⚠️ Cannot buy spin - not ready");
      return;
    }

    if (solBalance < SPIN_COST_SOL) {
      setErrorMessage(`Need ${SPIN_COST_SOL} SOL for extra spin!`);
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    setIsBuyingSpin(true);
    console.log("🛒 Buying extra spin...");

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

  // Spin Function - NOW WITH DYNAMIC RESULTS FROM BLOCKCHAIN
  const play = async () => {
    if (!program || !publicKey || !playerAccount) {
      console.log("⚠️ Cannot spin - not ready");
      return;
    }

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
    console.log("🎰 Spinning...");

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
      console.log("🎲 Client seed:", clientSeed.toString());

      const tx = await program.methods
        .spin(clientSeed)
        .accounts({
          gameState: gamePda,
          playerAccount: playerPda,
          player: publicKey,
          recentBlockhashes: RECENT_BLOCKHASHES_SYSVAR,
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

          return {
            results: finalResults,
            wonSOL,
            freshPlayer,
            newPool
          };
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
          return {
            results: fallbackResults,
            wonSOL: 0,
            freshPlayer: playerAccount,
            newPool: prizePool
          };
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
        setExtraSpins(resultData.freshPlayer.extraSpins);
        setPrizePool(resultData.newPool);

        console.log("💰 Win check:", { wonSOL: resultData.wonSOL });

        if (resultData.wonSOL > 0) {
          console.log("🎉 JACKPOT! Won:", resultData.wonSOL.toFixed(4), "SOL");
          setLastWin(resultData.wonSOL);
          setShowConfetti(true);
        } else {
          console.log("❌ No win this time");
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
        <h2 style={styles.headerTitle}>🎰 Devnet Test Mode - SOL Only 🎰</h2>
      </div>

      <div style={styles.topButtons}>
        <WalletMultiButton style={{ ...styles.walletButton, height: "50px" }} />
      </div>

      <div style={styles.contractBox}>
        <div style={styles.contractLabel}>📜 Contract Address</div>

        <div style={styles.contractAddress}>
            CfwgZDQq3QrScgkGM3CrBGbJWqLuZ3G7F7u4i7x347CY

        </div>

        <div style={styles.contractActions}>
          <button
            style={styles.actionButton}
            onClick={() => {
              navigator.clipboard.writeText("CfwgZDQ...i7x347CY");
            }}
          >
            📋 Copy
          </button>

          <a
            href="/whitepaper.pdf"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            <button style={styles.pdfButton}>
              📄 Whitepaper
            </button>
          </a>
        </div>
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
                    {isBuyingSpin ? "BUYING..." : "BUY EXTRA SPIN"}
                  </button>
                )}
              </>
            )}
          </div>

          {connected && (
            <div style={styles.infoText}>
              💡 Daily spins reset every 24 hours. Extra spins never expire!<br/>
              🎯 Win up to 80% of the prize pool when you hit 4-0-2!<br/>
              🔥 Extra spin costs {SPIN_COST_SOL} SOL<br/>
              ⚠️ DEVNET TESTING MODE - Using SOL instead of tokens
            </div>
          )}
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
  page: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    overflowX: "hidden",
    position: "relative",
  },
  contractBox: {
  background: "#000",
  border: "2px solid #FFD700",
  borderRadius: "12px",
  padding: "10px 12px",
  margin: "8px 0",
  width: "100%",
  maxWidth: "420px",
  textAlign: "center",
},

contractLabel: {
  color: "#FFD700",
  fontSize: "0.7rem",
  fontWeight: "700",
  marginBottom: "4px",
},

contractAddress: {
  color: "#fff",
  fontSize: "0.8rem",
  wordBreak: "break-all",
  marginBottom: "8px",
},

  contractActions: {
    display: "flex",
    gap: "8px",
    justifyContent: "center",
    flexWrap: "wrap",
  },

  actionButton: {
    padding: "6px 14px",
    fontSize: "0.75rem",
    borderRadius: "999px",
    background: "linear-gradient(135deg, #FFD700, #C9A400)",
    border: "none",
    color: "#000",
    fontWeight: "800",
    cursor: "pointer",
  },

  pdfButton: {
    padding: "6px 14px",
    fontSize: "0.75rem",
    borderRadius: "999px",
    background: "linear-gradient(135deg, #1e88e5, #0d47a1)",
    border: "2px solid #FFD700",
    color: "#fff",
    fontWeight: "700",
    cursor: "pointer",
  },

  backgroundLayer: {
    position: "fixed",
    inset: 0,
    backgroundImage: `linear-gradient(rgba(60,10,10,0.35), rgba(0,0,0,0.75)), url(${lotteryBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    filter: "blur(6px)",
    zIndex: -1,
  },

  headerSection: {
    padding: "6px 0",
  },

  headerTitle: {
    color: "#FFD700",
    fontSize: "1.3rem",
    fontWeight: "700",
    letterSpacing: "0.5px",
    textAlign: "center",
  },

  topButtons: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    marginBottom: "8px",
  },

  walletButton: {
    padding: "10px 15px",
    fontSize: "0.9rem",
    borderRadius: "10px",
    background: "#000",
    color: "#FFD700",
    fontWeight: "700",
    border: "2px solid #FFD700",
  },

  container: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    padding: "0 10px",
    boxSizing: "border-box",
  },

  slotMachine: {
    width: "100%",
    maxWidth: "500px",
    background: "linear-gradient(180deg, #141428, #0b0b16)",
    borderRadius: "16px",
    padding: "14px",
    border: "2px solid #FFD700",
    textAlign: "center",
  },

  displayPanel: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "6px",
    marginBottom: "10px",
  },

  infoBox: {
    background: "#000",
    padding: "6px",
    borderRadius: "8px",
    border: "1.5px solid #FFD700",
    textAlign: "center",
  },

  infoLabel: {
    color: "#FFD700",
    fontSize: "0.6rem",
    fontWeight: "700",
  },

  infoValue: {
    color: "#fff",
    fontSize: "0.9rem",
    fontWeight: "700",
  },

  rankBadge: {
    margin: "8px 0",
    padding: "8px",
    background: "#000",
    border: "2px solid #FFD700",
    borderRadius: "10px",
    color: "#FFD700",
    fontWeight: "700",
    fontSize: "0.85rem",
  },

  statsBadge: {
    margin: "8px 0",
    padding: "8px",
    background: "#000",
    border: "2px solid #4CAF50",
    borderRadius: "10px",
    color: "#4CAF50",
    fontWeight: "700",
    fontSize: "0.8rem",
  },

  timerBadge: {
    margin: "8px 0",
    padding: "8px",
    background: "#000",
    border: "2px solid #FF1744",
    borderRadius: "10px",
    color: "#FF1744",
    fontWeight: "700",
    fontSize: "0.85rem",
  },

  title: {
    color: "#FFD700",
    fontSize: "1.35rem",
    margin: "8px 0",
    fontWeight: "800",
  },

  reelsSection: {
    background: "#000",
    padding: "10px",
    borderRadius: "12px",
    border: "2px solid #FFD700",
    marginBottom: "10px",
  },

  reelsRow: {
    display: "flex",
    justifyContent: "center",
    gap: "8px",
  },

  reelContainer: {
    position: "relative",
  },

  reelBox: {
    width: "85px",
    height: "85px",
    background: "#000",
    borderRadius: "10px",
    overflow: "hidden",
    border: "2px solid #FFD700",
    position: "relative",
  },

  reelStrip: {
    display: "flex",
    flexDirection: "column",
  },

  symbol: {
    width: "100%",
    height: "85px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0a0a0a",
  },

  finalNumber: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  controlPanel: {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: "14px",
  },

  spinButton: {
    padding: "12px 26px",
    fontSize: "1.15rem",
    borderRadius: "999px",
    background: "linear-gradient(135deg, #ff2d55, #c4002f)",
    border: "2px solid #FFD700",
    color: "#fff",
    fontWeight: "800",
    cursor: "pointer",
    boxShadow: "0 0 12px rgba(255,45,85,0.6)",
  },

  buySpinButton: {
    padding: "10px 18px",
    fontSize: "0.95rem",
    borderRadius: "999px",
    background: "linear-gradient(135deg, #7b1fa2, #4a0072)",
    border: "2px solid #FFD700",
    color: "#fff",
    fontWeight: "700",
  },

  registerButton: {
    padding: "12px 22px",
    fontSize: "1rem",
    borderRadius: "999px",
    background: "linear-gradient(135deg, #43a047, #1b5e20)",
    border: "2px solid #FFD700",
    color: "#fff",
    fontWeight: "800",
  },

  winnerBanner: {
    margin: "8px 0",
    padding: "8px",
    fontSize: "1.05rem",
    color: "#FFD700",
    border: "2px solid #FFD700",
    borderRadius: "8px",
    fontWeight: "900",
  },

  infoText: {
    marginTop: "12px",
    fontSize: "0.78rem",
    color: "#eaeaea",
    lineHeight: "1.6",
    textAlign: "left",
    background: "rgba(0,0,0,0.45)",
    padding: "10px",
    borderRadius: "8px",
  },

  errorMessage: {
    color: "#FF1744",
    fontWeight: "700",
    marginBottom: "10px",
    textAlign: "center",
    fontSize: "1rem",
    padding: "10px",
    background: "rgba(255,23,68,0.15)",
    borderRadius: "10px",
    border: "2px solid #FF1744",
  },

  confettiContainer: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    zIndex: 9999,
    overflow: "hidden",
  },

  confettiPiece: {
    position: "absolute",
    top: "-20px",
    animation: "confettiFall linear infinite",
  },
};


export default App;