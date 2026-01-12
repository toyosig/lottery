import React, { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import idl from "./idl.json";

// Import images from assets
import zeroImage from "./assets/images/zeroImage.png";
import twoImage from "./assets/images/twoImage.png";
import fourImage from "./assets/images/fourImage.png";
import apple from "./assets/images/appleImage.png";
import giraffe from "./assets/images/giraffeImage.png"
import santa from "./assets/images/ny.png";
import lotteryBg from "./assets/images/image.png";
import whiteboardPdf from "./assets/whiteboardPdf.pdf";
// BJdGG4rQEkFSDfdwrMjQUpEdJ7NAqqHSZ8dj7ghQpump
const PROGRAM_ID = new PublicKey("AHJVuYoVquX4wruGcHwNxhFt1tu8SXFB89hhqyDtgK6H");
const TOKEN_ADDRESS = "";
const MIN_TOKEN_VALUE_SOL = 0.04;
const SPIN_COST_SOL = 0.01;

const GAME_WALLET_SEED = "game";
const MORALIS_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6Ijk4OTZhZDI1LTA5NDItNDc5Yi1iMjcxLWQwZDRiMDY1ZmI2MCIsIm9yZ0lkIjoiMzc1Njk2IiwidXNlcklkIjoiMzg2MDc2IiwidHlwZUlkIjoiYmViZjI4N2ItNjMyNS00MmQ2LWI1NmYtY2YzMTY4MWZhZmE5IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3MDcwNDE3ODIsImV4cCI6NDg2MjgwMTc4Mn0.qhV3NBVMXvKm5Gt1pPtYIVSdwlErOYZ4e4gXjs4x5Hg";

const symbols = [santa, twoImage, giraffe, apple, fourImage, zeroImage];
const isImage = (symbol) => typeof symbol === "string";

const mapReelToSymbol = (reelValue) => {
  if (reelValue >= 0 && reelValue < symbols.length) {
    return symbols[reelValue];
  }
  return santa;
};

// Enhanced Confetti Component
const Confetti = () => {
  const confettiPieces = Array.from({ length: 150 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    animationDuration: 2.5 + Math.random() * 3,
    color: ["#FFD700", "#FF1744", "#4CAF50", "#9C27B0", "#00BCD4", "#FF9800"][Math.floor(Math.random() * 6)],
    rotation: Math.random() * 360,
    size: 6 + Math.random() * 10,
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

// Enhanced Reel Component
const Reel = ({ spinning, result, delay }) => {
  const renderSymbol = (symbol) => {
    if (!symbol) return null;
    if (isImage(symbol)) {
      return <img src={symbol} alt="" style={{ width: "75%", height: "75%", objectFit: "contain" }} />;
    }
    return <span style={{ color: "white", fontWeight: "900", fontSize: "2rem" }}>{symbol}</span>;
  };

  return (
    <div style={styles.reelContainer}>
      <div style={styles.reelBox}>
        <div
          style={{
            ...styles.reelStrip,
            animation: spinning ? "spin 0.08s linear infinite" : "none",
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
      {!spinning && <div style={styles.reelGlow}></div>}
    </div>
  );
};

// Main App Component
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
  const [timeUntilReset, setTimeUntilReset] = useState("");
  const [isUpdatingRank, setIsUpdatingRank] = useState(false);
  const [showGlobalWinners, setShowGlobalWinners] = useState(false);
  const [globalWinners, setGlobalWinners] = useState([]);
  const [isLoadingWinners, setIsLoadingWinners] = useState(false);
  const [gameWalletAddress, setGameWalletAddress] = useState("");
  const [tokenBalance, setTokenBalance] = useState(0);
  const [tokenValueSOL, setTokenValueSOL] = useState(0);
  const [tokenPriceUSD, setTokenPriceUSD] = useState(0);
  const [holderRank, setHolderRank] = useState(null);
  const [hasMinTokens, setHasMinTokens] = useState(false);
  const [isCheckingTokens, setIsCheckingTokens] = useState(false);
  const [lastRankUpdate, setLastRankUpdate] = useState(null);

  // Setup Anchor program and derive game wallet
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

      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from(GAME_WALLET_SEED)],
        PROGRAM_ID
      );
      setGameWalletAddress(gamePda.toString());
      console.log("💰 Game Funding Wallet:", gamePda.toString());
    } catch (error) {
      console.error("❌ Failed to initialize program:", error);
      setErrorMessage("Failed to load game. Please refresh.");
      setTimeout(() => setErrorMessage(""), 5000);
      setProgram(null);
    }
  }, [connection, wallet]);

  const fetchSOLPrice = async () => {
    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112`
      );

      if (!response.ok) throw new Error(`DexScreener SOL API error: ${response.status}`);
      const data = await response.json();

      if (data.pairs && data.pairs.length > 0) {
        const bestPair = data.pairs.reduce((prev, current) => 
          (prev.liquidity?.usd || 0) > (current.liquidity?.usd || 0) ? prev : current
        );
        return parseFloat(bestPair.priceUsd || 0);
      }
      return 0;
    } catch (error) {
      console.error("❌ Failed to fetch SOL price:", error);
      return 0;
    }
  };

  const fetchTokenPrice = async () => {
    try {
      const [tokenResponse, solPriceUSD] = await Promise.all([
        fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDRESS}`),
        fetchSOLPrice()
      ]);

      if (!tokenResponse.ok) throw new Error(`DexScreener API error: ${tokenResponse.status}`);
      const tokenData = await tokenResponse.json();

      if (tokenData.pairs && tokenData.pairs.length > 0) {
        const bestPair = tokenData.pairs.reduce((prev, current) => 
          (prev.liquidity?.usd || 0) > (current.liquidity?.usd || 0) ? prev : current
        );

        const tokenPriceUSD = parseFloat(bestPair.priceUsd || 0);
        const tokenPriceSOL = solPriceUSD > 0 ? tokenPriceUSD / solPriceUSD : 0;
        setTokenPriceUSD(tokenPriceUSD);
        return { priceUSD: tokenPriceUSD, priceSOL: tokenPriceSOL };
      }
      return { priceUSD: 0, priceSOL: 0 };
    } catch (error) {
      console.error("❌ Failed to fetch token price:", error);
      return { priceUSD: 0, priceSOL: 0 };
    }
  };

  const fetchTokenHolders = async () => {
    if (!MORALIS_API_KEY) return [];

    try {
      const options = {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'X-API-Key': MORALIS_API_KEY
        }
      };

      const response = await fetch(
        `https://solana-gateway.moralis.io/token/mainnet/${TOKEN_ADDRESS}/owners?limit=100`,
        options
      );

      if (!response.ok) throw new Error(`Moralis API error: ${response.status}`);
      const data = await response.json();
      return data.result || [];
    } catch (error) {
      console.error("❌ Failed to fetch token holders:", error);
      return [];
    }
  };

  const checkTokenHoldings = async (walletAddress) => {
    if (!walletAddress) return;

    setIsCheckingTokens(true);

    try {
      const { priceUSD, priceSOL } = await fetchTokenPrice();

      if (priceUSD === 0 || priceSOL === 0) {
        setTokenBalance(1);
        setTokenValueSOL(MIN_TOKEN_VALUE_SOL);
        setHasMinTokens(true);
        setIsCheckingTokens(false);
        return;
      }

      if (!MORALIS_API_KEY) {
        setTokenBalance(1);
        setTokenValueSOL(MIN_TOKEN_VALUE_SOL);
        setHasMinTokens(true);
        setHolderRank(null);
        setIsCheckingTokens(false);
        return;
      }

      const options = {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'X-API-Key': MORALIS_API_KEY
        }
      };

      const balanceResponse = await fetch(
        `https://solana-gateway.moralis.io/account/mainnet/${walletAddress.toString()}/tokens`,
        options
      );

      if (!balanceResponse.ok) throw new Error(`Moralis balance API error: ${balanceResponse.status}`);
      const balanceData = await balanceResponse.json();

      const tokenData = balanceData.tokens?.find(t => t.mint === TOKEN_ADDRESS);

      if (!tokenData) {
        setTokenBalance(0);
        setTokenValueSOL(0);
        setHasMinTokens(false);
        setHolderRank(null);
        setIsCheckingTokens(false);
        return;
      }

      const balance = parseFloat(tokenData.amount) / Math.pow(10, tokenData.decimals);
      const valueSOL = balance * priceSOL;

      setTokenBalance(balance);
      setTokenValueSOL(valueSOL);
      setHasMinTokens(valueSOL >= MIN_TOKEN_VALUE_SOL);

      const holders = await fetchTokenHolders();

      if (holders.length > 0) {
        const sortedHolders = holders
          .map(h => ({
            address: h.owner,
            balance: parseFloat(h.amount) / Math.pow(10, h.decimals || 9)
          }))
          .sort((a, b) => b.balance - a.balance);

        const userRank = sortedHolders.findIndex(h => h.address === walletAddress.toString()) + 1;
        setHolderRank(userRank > 0 ? userRank : null);
      }

      setIsCheckingTokens(false);
    } catch (error) {
      console.error("❌ Token check failed:", error);
      setTokenBalance(1);
      setTokenValueSOL(MIN_TOKEN_VALUE_SOL);
      setHasMinTokens(true);
      setIsCheckingTokens(false);
    }
  };

  const fetchGlobalWinners = async () => {
    if (!program) return;
    
    setIsLoadingWinners(true);
    try {
      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from(GAME_WALLET_SEED)],
        PROGRAM_ID
      );

      const signatures = await connection.getSignaturesForAddress(gamePda, { limit: 100 });
      const winners = [];
      
      for (const sig of signatures) {
        try {
          const tx = await connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
          });
          
          if (!tx || !tx.meta) continue;
          
          const postBalances = tx.meta.postBalances;
          const preBalances = tx.meta.preBalances;
          const accountKeys = tx.transaction.message.accountKeys;
          
          const gameIndex = accountKeys.findIndex(key => 
            key.pubkey.toString() === gamePda.toString()
          );
          
          if (gameIndex === -1) continue;
          
          const balanceChange = postBalances[gameIndex] - preBalances[gameIndex];
          
          if (balanceChange < 0) {
            const winAmount = Math.abs(balanceChange) / LAMPORTS_PER_SOL;
            
            for (let i = 0; i < accountKeys.length; i++) {
              const change = postBalances[i] - preBalances[i];
              if (change > 0 && i !== gameIndex) {
                winners.push({
                  wallet: accountKeys[i].pubkey.toString(),
                  amount: winAmount,
                  timestamp: tx.blockTime || Date.now() / 1000,
                  signature: sig.signature
                });
                break;
              }
            }
          }
        } catch (err) {
          console.error("Error parsing transaction:", err);
        }
      }
      
      const sortedWinners = winners
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);
      
      setGlobalWinners(sortedWinners);
    } catch (err) {
      console.error("❌ Failed to fetch global winners:", err);
    } finally {
      setIsLoadingWinners(false);
    }
  };

  const updatePlayerRank = async () => {
    if (!program || !publicKey || !playerAccount) return false;

    const now = Date.now();
    if (lastRankUpdate && (now - lastRankUpdate) < 86400000) {
      return true;
    }

    setIsUpdatingRank(true);

    try {
      await checkTokenHoldings(publicKey);
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!hasMinTokens) {
        setErrorMessage("Insufficient tokens to continue playing!");
        setTimeout(() => setErrorMessage(""), 5000);
        setIsUpdatingRank(false);
        return false;
      }

      const [playerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("player"), publicKey.toBytes()],
        PROGRAM_ID
      );

      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from(GAME_WALLET_SEED)],
        PROGRAM_ID
      );

      const rank = holderRank || 101;

      const tx = await program.methods
        .registerPlayer(rank, hasMinTokens)
        .accounts({
          gameState: gamePda,
          playerAccount: playerPda,
          player: publicKey,
          systemProgram: SystemProgram.programId
        })
        .rpc({
          skipPreflight: false,
          commitment: "confirmed"
        });

      await connection.confirmTransaction(tx, "confirmed");
      setLastRankUpdate(now);
      await new Promise(resolve => setTimeout(resolve, 1500));

      setIsUpdatingRank(false);
      return true;
    } catch (err) {
      console.error("❌ Rank update failed:", err);
      setErrorMessage("Failed to update rank. Please try again.");
      setTimeout(() => setErrorMessage(""), 5000);
      setIsUpdatingRank(false);
      return false;
    }
  };

  useEffect(() => {
    if (connected && publicKey) {
      checkTokenHoldings(publicKey);
    } else {
      setTokenBalance(0);
      setTokenValueSOL(0);
      setHasMinTokens(false);
      setHolderRank(null);
    }
  }, [connected, publicKey]);

  useEffect(() => {
    if (!program) return;

    const fetchGameState = async () => {
      try {
        const [gamePda] = PublicKey.findProgramAddressSync(
          [Buffer.from(GAME_WALLET_SEED)],
          PROGRAM_ID
        );

        const gameAccount = await connection.getAccountInfo(gamePda);
        if (gameAccount) {
          const state = await program.account.gameState.fetch(gamePda);
          setGameState(state);

          const lamports = gameAccount.lamports;
          const poolSol = lamports / LAMPORTS_PER_SOL;
          setPrizePool(poolSol);
        }
      } catch (e) {
        console.log("⚠️ Game state fetch error:", e.message);
      }
    };

    fetchGameState();
    const interval = setInterval(fetchGameState, 10000);
    return () => clearInterval(interval);
  }, [program, connection]);

  useEffect(() => {
    if (!playerAccount || !playerAccount.lastSpinReset) return;

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const lastReset = Number(playerAccount.lastSpinReset?.toString() || 0);
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

        const accountInfo = await connection.getAccountInfo(playerPda);
        if (!accountInfo) {
          setPlayerAccount(null);
          setDailySpinsLeft(0);
          setExtraSpins(0);
          return;
        }

        const acc = await program.account.playerAccount.fetch(playerPda);

        const dailyLimit = Number(acc.dailySpinLimit?.toString() || 0);
        const dailyUsed = Number(acc.dailySpinsUsed?.toString() || 0);
        const extra = Number(acc.extraSpins?.toString() || 0);

        setPlayerAccount(acc);

        const spinsLeft = Math.max(0, dailyLimit - dailyUsed);
        setDailySpinsLeft(spinsLeft);
        setExtraSpins(extra);
      } catch (e) {
        console.log("⚠️ Player fetch error:", e.message);
        setPlayerAccount(null);
        setDailySpinsLeft(0);
        setExtraSpins(0);
      }
    };

    fetchPlayer();
    const interval = setInterval(fetchPlayer, 8000);
    return () => clearInterval(interval);
  }, [program, publicKey, connection]);

  const downloadPDF = () => {
    const link = document.createElement('a');
    link.href = whiteboardPdf;
    link.download = 'whiteboard.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const registerPlayer = async () => {
    if (!program || !publicKey) return;

    try {
      const [playerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("player"), publicKey.toBytes()],
        PROGRAM_ID
      );

      const existingAccount = await connection.getAccountInfo(playerPda);
      if (existingAccount) {
        setErrorMessage("Already registered!");
        setTimeout(() => setErrorMessage(""), 3000);
        return;
      }
    } catch (e) {
    }

    if (!hasMinTokens) {
      setErrorMessage(`Need at least ${MIN_TOKEN_VALUE_SOL} SOL worth of tokens!`);
      setTimeout(() => setErrorMessage(""), 5000);
      return;
    }

    setIsRegistering(true);

    try {
      const [playerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("player"), publicKey.toBytes()],
        PROGRAM_ID
      );

      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from(GAME_WALLET_SEED)],
        PROGRAM_ID
      );

      const rank = holderRank || 101;

      const tx = await program.methods
        .registerPlayer(rank, hasMinTokens)
        .accounts({
          gameState: gamePda,
          playerAccount: playerPda,
          player: publicKey,
          systemProgram: SystemProgram.programId
        })
        .rpc({
          skipPreflight: false,
          commitment: "confirmed"
        });

      await connection.confirmTransaction(tx, "confirmed");
      setLastRankUpdate(Date.now());
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsRegistering(false);
    } catch (err) {
      console.error("❌ Registration failed:", err);
      setErrorMessage(err?.message?.substring(0, 100) || "Registration failed!");
      setTimeout(() => setErrorMessage(""), 5000);
      setIsRegistering(false);
    }
  };

  const buyExtraSpin = async () => {
    if (!program || !publicKey || !playerAccount) return;

    setIsBuyingSpin(true);

    try {
      const [playerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("player"), publicKey.toBytes()],
        PROGRAM_ID
      );

      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from(GAME_WALLET_SEED)],
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
        .rpc({
          commitment: "confirmed"
        });

      await connection.confirmTransaction(tx, "confirmed");
      await new Promise(resolve => setTimeout(resolve, 1500));

      setIsBuyingSpin(false);
    } catch (err) {
      console.error("❌ Purchase failed:", err);
      setErrorMessage(err?.message || "Purchase failed!");
      setTimeout(() => setErrorMessage(""), 5000);
      setIsBuyingSpin(false);
    }
  };

  const play = async () => {
    if (!program || !publicKey || !playerAccount) return;

    const totalSpinsAvailable = dailySpinsLeft + extraSpins;
    if (totalSpinsAvailable <= 0) {
      setErrorMessage("No spins left! Buy extra spins or wait for daily reset.");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    const rankUpdated = await updatePlayerRank();
    if (!rankUpdated) return;

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
        [Buffer.from(GAME_WALLET_SEED)],
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
        .rpc({
          commitment: "confirmed"
        });

      await connection.confirmTransaction(tx, "confirmed");

      const fetchResults = async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 1500));

          const freshPlayer = await program.account.playerAccount.fetch(playerPda);
          const gameAccount = await connection.getAccountInfo(gamePda);
          const newPool = gameAccount ? gameAccount.lamports / LAMPORTS_PER_SOL : 0;

          const previousWinnings = Number(playerAccount?.totalWinnings?.toString() || 0);
          const currentWinnings = Number(freshPlayer.totalWinnings?.toString() || 0);
          const wonLamports = currentWinnings - previousWinnings;
          const wonSOL = wonLamports / LAMPORTS_PER_SOL;

          let finalResults;

          if (wonLamports > 0) {
            finalResults = [symbols[4], symbols[5], symbols[1]];
          } else {
            let reel1, reel2, reel3;
            do {
              reel1 = symbols[Math.floor(Math.random() * symbols.length)];
              reel2 = symbols[Math.floor(Math.random() * symbols.length)];
              reel3 = symbols[Math.floor(Math.random() * symbols.length)];
            } while (
              (reel1 === symbols[4] && reel2 === symbols[5] && reel3 === symbols[1])
            );

            finalResults = [reel1, reel2, reel3];
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
            fallbackResults[0] === symbols[4] && 
            fallbackResults[1] === symbols[5] && 
            fallbackResults[2] === symbols[1]
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

        const newDailySpinsLeft = Math.max(0, Number(resultData.freshPlayer.dailySpinLimit?.toString() || 0) - Number(resultData.freshPlayer.dailySpinsUsed?.toString() || 0));
        setDailySpinsLeft(newDailySpinsLeft);
        setExtraSpins(Number(resultData.freshPlayer.extraSpins?.toString() || 0));
        setPrizePool(resultData.newPool);

        if (resultData.wonSOL > 0) {
          setLastWin(resultData.wonSOL);
          setShowConfetti(true);
        }

        setIsPlaying(false);
      }, 3200);
    } catch (err) {
      console.error("❌ Spin failed:", err);
      setErrorMessage(err?.message?.substring(0, 100) || "Spin failed!");
      setTimeout(() => setErrorMessage(""), 5000);
      setSpinning([false, false, false]);
      setIsPlaying(false);
    }
  };

  const isWinner = results.length === 3 && 
    results[0] === symbols[4] &&
    results[1] === symbols[5] &&
    results[2] === symbols[1] &&
    lastWin > 0;

  return (
    <div style={styles.page}>
      <div style={styles.backgroundLayer}></div>
      <div style={styles.gradientOverlay}></div>

      {showConfetti && <Confetti />}

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerGlow}></div>
        <h1 style={styles.headerTitle}>
          <span style={styles.titleIcon}>🎰</span>
          NYNM Casino
          <span style={styles.titleIcon}>🎰</span>
        </h1>
        <p style={styles.headerSubtitle}>Spin to win big on Solana</p>
      </div>

      {/* Wallet & Winners Buttons */}
      <div style={styles.topBar}>
        <WalletMultiButton style={styles.walletButton} />
        <button
          onClick={() => {
            setShowGlobalWinners(!showGlobalWinners);
            if (!showGlobalWinners && globalWinners.length === 0) {
              fetchGlobalWinners();
            }
          }}
          style={styles.winnersButton}
        >
          🏆 Winners
        </button>
      </div>

      {/* Game Funding Wallet */}
      {gameWalletAddress && (
        <div style={styles.fundingWallet}>
          <div style={styles.fundingLabel}>💰 Fund the Prize Pool</div>
          <div style={styles.fundingAddress}>
            {gameWalletAddress.substring(0, 16)}...{gameWalletAddress.substring(gameWalletAddress.length - 8)}
          </div>
          <div style={styles.fundingActions}>
            <button
              style={styles.copyButton}
              onClick={() => {
                navigator.clipboard.writeText(gameWalletAddress);
                setErrorMessage("Address copied!");
                setTimeout(() => setErrorMessage(""), 2000);
              }}
            >
              📋 Copy
            </button>
            <a
              href={`https://solscan.io/account/${gameWalletAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.solscanLink}
            >
              🔍 Solscan
            </a>
          </div>
        </div>
      )}

      {/* Global Winners Modal */}
      {showGlobalWinners && (
        <div style={styles.modalOverlay} onClick={() => setShowGlobalWinners(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>🏆 Global Winners</h3>
              <button style={styles.closeButton} onClick={() => setShowGlobalWinners(false)}>×</button>
            </div>
            <div style={styles.modalBody}>
              {isLoadingWinners ? (
                <div style={styles.loadingText}>Loading...</div>
              ) : globalWinners.length === 0 ? (
                <div style={styles.noWinners}>No winners yet. Be the first!</div>
              ) : (
                <div style={styles.winnersList}>
                  {globalWinners.map((winner, idx) => (
                    <div key={idx} style={styles.winnerItem}>
                      <div style={styles.winnerRank}>#{idx + 1}</div>
                      <div style={styles.winnerInfo}>
                        <div style={styles.winnerWallet}>
                          {winner.wallet.substring(0, 8)}...{winner.wallet.substring(winner.wallet.length - 6)}
                        </div>
                        <div style={styles.winnerTime}>
                          {new Date(winner.timestamp * 1000).toLocaleString()}
                        </div>
                      </div>
                      <div style={styles.winnerAmount}>{winner.amount.toFixed(4)} SOL</div>
                      <a
                        href={`https://solscan.io/tx/${winner.signature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.txLink}
                      >
                        🔗
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Token Contract */}
      <div style={styles.contractCard}>
        <div style={styles.cardLabel}>📜 Token Contract</div>
        <div style={styles.contractAddress}>{TOKEN_ADDRESS.substring(0, 28)}...</div>
        <div style={styles.contractActions}>
          <button
            style={styles.copyButton}
            onClick={() => navigator.clipboard.writeText(TOKEN_ADDRESS)}
          >
            📋 Copy
          </button>
          <button onClick={downloadPDF} style={styles.whitepaperButton}>
            📄 Whitepaper
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && <div style={styles.errorBanner}>{errorMessage}</div>}

      {/* Rank Update Banner */}
      {isUpdatingRank && (
        <div style={styles.rankUpdateBanner}>
          🔄 Updating holder rank... Please wait.
        </div>
      )}

      {/* Token Status */}
      {connected && (
        <div style={styles.tokenCard}>
          <div style={styles.cardLabel}>
            {isCheckingTokens ? "🔄 Checking Holdings..." : "💎 Token Status"}
          </div>
          <div style={styles.tokenGrid}>
            <div style={styles.tokenStat}>
              <div style={styles.statLabel}>Name</div>
              <div style={styles.statValue}>NYNM</div>
            </div>
            <div style={styles.tokenStat}>
              <div style={styles.statLabel}>Value</div>
              <div style={styles.statValue}>{tokenValueSOL.toFixed(4)} SOL</div>
            </div>
            <div style={styles.tokenStat}>
              <div style={styles.statLabel}>Rank</div>
              <div style={styles.statValue}>{holderRank ? `#${holderRank}` : "—"}</div>
            </div>
            <div style={styles.tokenStat}>
              <div style={styles.statLabel}>Status</div>
              <div style={{
                ...styles.statValue,
                color: hasMinTokens ? "#4CAF50" : "#FF1744"
              }}>
                {hasMinTokens ? "✅" : "❌"}
              </div>
            </div>
          </div>
          {!hasMinTokens && (
            <div style={styles.tokenWarning}>
              ⚠️ Need {MIN_TOKEN_VALUE_SOL} SOL worth of tokens to play
            </div>
          )}
        </div>
      )}

      {/* Main Slot Machine */}
      <div style={styles.slotMachine}>
        {/* Stats Panel */}
        <div style={styles.statsPanel}>
          <div style={styles.stat}>
            <div style={styles.statIcon}>💰</div>
            <div>
              <div style={styles.statLabelSmall}>Prize Pool</div>
              <div style={styles.statValueLarge}>{prizePool.toFixed(4)} SOL</div>
            </div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statIcon}>🎯</div>
            <div>
              <div style={styles.statLabelSmall}>Daily Spins</div>
              <div style={styles.statValueLarge}>{connected ? dailySpinsLeft : "—"}</div>
            </div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statIcon}>⚡</div>
            <div>
              <div style={styles.statLabelSmall}>Extra Spins</div>
              <div style={styles.statValueLarge}>{connected ? extraSpins : "—"}</div>
            </div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statIcon}>🏆</div>
            <div>
              <div style={styles.statLabelSmall}>Last Win</div>
              <div style={{
                ...styles.statValueLarge,
                color: lastWin > 0 ? "#FFD700" : "#fff"
              }}>
                {lastWin > 0 ? `${lastWin.toFixed(4)}` : "0"}
              </div>
            </div>
          </div>
        </div>

        {/* Player Stats Badge */}
        {connected && playerAccount && (
          <div style={styles.playerStats}>
            📊 Spins: {Number(playerAccount.totalSpins?.toString() || 0)} | 
            Wins: {Number(playerAccount.totalWins?.toString() || 0)} | 
            Total Won: {(Number(playerAccount.totalWinnings?.toString() || 0) / LAMPORTS_PER_SOL).toFixed(4)} SOL
          </div>
        )}

        {/* Timer Badge */}
        {connected && playerAccount && dailySpinsLeft === 0 && extraSpins === 0 && (
          <div style={styles.timerBadge}>
            ⏰ {timeUntilReset}
          </div>
        )}

        {/* Reels */}
        <div style={styles.reelsContainer}>
          <div style={styles.reelsWrapper}>
            <Reel spinning={spinning[0]} result={results[0]} delay={0} />
            <Reel spinning={spinning[1]} result={results[1]} delay={50} />
            <Reel spinning={spinning[2]} result={results[2]} delay={100} />
          </div>
        </div>

        {/* Winner Banner */}
        {isWinner && (
          <div style={styles.jackpotBanner}>
            <div style={styles.jackpotText}>
              🎉 JACKPOT! 🎉
            </div>
            <div style={styles.jackpotAmount}>
              {lastWin.toFixed(4)} SOL
            </div>
          </div>
        )}

        {/* Controls */}
        <div style={styles.controls}>
          {!playerAccount && connected ? (
            <button
              onClick={registerPlayer}
              disabled={isRegistering || !hasMinTokens || isCheckingTokens}
              style={{
                ...styles.registerButton,
                opacity: isRegistering || !hasMinTokens || isCheckingTokens ? 0.5 : 1,
              }}
            >
              {isRegistering ? "Registering..." : 
               isCheckingTokens ? "Checking Tokens..." :
               !hasMinTokens ? "Insufficient Tokens" : 
               "Register to Play"}
            </button>
          ) : (
            <>
              <button
                onClick={play}
                disabled={!connected || isPlaying || isUpdatingRank || (dailySpinsLeft <= 0 && extraSpins <= 0)}
                style={{
                  ...styles.spinButton,
                  opacity: !connected || isPlaying || isUpdatingRank || (dailySpinsLeft <= 0 && extraSpins <= 0) ? 0.5 : 1,
                }}
              >
                {isPlaying ? "🎰 Spinning..." : 
                 isUpdatingRank ? "🔄 Updating..." :
                 connected ? "🎲 SPIN" : "Connect Wallet"}
              </button>

              {connected && playerAccount && (
                <button
                  onClick={buyExtraSpin}
                  disabled={isBuyingSpin}
                  style={{
                    ...styles.buyButton,
                    opacity: isBuyingSpin ? 0.5 : 1,
                  }}
                >
                  {isBuyingSpin ? "Buying..." : `Buy Spin (${SPIN_COST_SOL} SOL)`}
                </button>
              )}
            </>
          )}
        </div>

        {/* Info Section */}
        {connected && (
          <div style={styles.infoSection}>
            <div style={styles.infoTitle}>💡 How It Works</div>
            <div style={styles.infoGrid}>
              <div style={styles.infoItem}>
                <div style={styles.infoItemIcon}>🥇</div>
                <div style={styles.infoItemText}>Top 10: 100 daily spins</div>
              </div>
              <div style={styles.infoItem}>
                <div style={styles.infoItemIcon}>🥈</div>
                <div style={styles.infoItemText}>Top 11-50: 50 spins</div>
              </div>
              <div style={styles.infoItem}>
                <div style={styles.infoItemIcon}>🥉</div>
                <div style={styles.infoItemText}>Top 51-100: 10 spins</div>
              </div>
              <div style={styles.infoItem}>
                <div style={styles.infoItemIcon}>🎯</div>
                <div style={styles.infoItemText}>Match 4-0-2 to win 80% pool</div>
              </div>
              <div style={styles.infoItem}>
                <div style={styles.infoItemIcon}>⚡</div>
                <div style={styles.infoItemText}>Extra spins: {SPIN_COST_SOL} SOL</div>
              </div>
              <div style={styles.infoItem}>
                <div style={styles.infoItemIcon}>🔄</div>
                <div style={styles.infoItemText}>Daily reset every 24h</div>
              </div>
            </div>
          </div>
        )}
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
        @keyframes glow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
      `}</style>
    </div>
  );
};

// Enhanced Styles
const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px 10px",
    position: "relative",
  },
  backgroundLayer: {
    position: "fixed",
    inset: 0,
    backgroundImage: `url(${lotteryBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    filter: "brightness(0.6)",
    zIndex: -2,
  },
  gradientOverlay: {
    position: "fixed",
    inset: 0,
    background: "radial-gradient(circle at 50% 0%, rgba(139, 0, 139, 0.3) 0%, rgba(0, 0, 0, 0.9) 70%)",
    zIndex: -1,
  },
  header: {
    textAlign: "center",
    marginBottom: "20px",
    position: "relative",
  },
  headerGlow: {
    position: "absolute",
    inset: "-20px",
    background: "radial-gradient(circle, rgba(255, 215, 0, 0.2) 0%, transparent 70%)",
    filter: "blur(30px)",
    animation: "glow 3s ease-in-out infinite",
    zIndex: -1,
  },
  headerTitle: {
    fontSize: "2.5rem",
    fontWeight: "900",
    background: "linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)",
    backgroundSize: "200% 100%",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    animation: "shimmer 3s linear infinite",
    textShadow: "0 0 40px rgba(255, 215, 0, 0.5)",
    margin: "0 0 10px 0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "15px",
  },
  titleIcon: {
    filter: "drop-shadow(0 0 10px rgba(255, 215, 0, 0.8))",
  },
  headerSubtitle: {
    color: "#b0b0b0",
    fontSize: "1rem",
    fontWeight: "500",
    margin: 0,
  },
  topBar: {
    display: "flex",
    gap: "12px",
    marginBottom: "20px",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  walletButton: {
    padding: "12px 24px",
    fontSize: "1rem",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #8B00FF 0%, #6200EA 100%)",
    border: "2px solid rgba(255, 215, 0, 0.3)",
    color: "#fff",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(139, 0, 255, 0.4)",
    transition: "all 0.3s ease",
  },
  winnersButton: {
    padding: "12px 24px",
    fontSize: "1rem",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #FF6B35 0%, #FF1744 100%)",
    border: "2px solid rgba(255, 215, 0, 0.3)",
    color: "#fff",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(255, 23, 68, 0.4)",
    transition: "all 0.3s ease",
  },
  fundingWallet: {
    background: "linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(30, 30, 30, 0.8) 100%)",
    backdropFilter: "blur(10px)",
    border: "2px solid rgba(255, 215, 0, 0.3)",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "20px",
    width: "100%",
    maxWidth: "500px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
  },
  fundingLabel: {
    color: "#FFD700",
    fontSize: "0.9rem",
    fontWeight: "700",
    marginBottom: "10px",
    textAlign: "center",
  },
  fundingAddress: {
    color: "#fff",
    fontSize: "0.95rem",
    marginBottom: "15px",
    textAlign: "center",
    fontFamily: "monospace",
    wordBreak: "break-all",
  },
  fundingActions: {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
  },
  copyButton: {
    padding: "8px 16px",
    fontSize: "0.9rem",
    borderRadius: "8px",
    background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
    border: "none",
    color: "#000",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  solscanLink: {
    padding: "8px 16px",
    fontSize: "0.9rem",
    borderRadius: "8px",
    background: "linear-gradient(135deg, #1e88e5 0%, #1565c0 100%)",
    border: "none",
    color: "#fff",
    fontWeight: "700",
    textDecoration: "none",
    display: "inline-block",
    transition: "all 0.3s ease",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.85)",
    backdropFilter: "blur(5px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modal: {
    background: "linear-gradient(135deg, rgba(20, 20, 40, 0.95) 0%, rgba(10, 10, 20, 0.95) 100%)",
    backdropFilter: "blur(20px)",
    border: "2px solid rgba(255, 215, 0, 0.3)",
    borderRadius: "20px",
    maxWidth: "600px",
    width: "100%",
    maxHeight: "80vh",
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
  },
  modalHeader: {
    padding: "20px",
    borderBottom: "1px solid rgba(255, 215, 0, 0.2)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    color: "#FFD700",
    fontSize: "1.5rem",
    fontWeight: "800",
    margin: 0,
  },
  closeButton: {
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: "2rem",
    cursor: "pointer",
    padding: "0",
    width: "40px",
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
    transition: "all 0.3s ease",
  },
  modalBody: {
    padding: "20px",
    maxHeight: "calc(80vh - 80px)",
    overflowY: "auto",
  },
  loadingText: {
    color: "#fff",
    textAlign: "center",
    padding: "40px",
    fontSize: "1.1rem",
  },
  noWinners: {
    color: "#888",
    textAlign: "center",
    padding: "40px",
    fontSize: "1.1rem",
  },
  winnersList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  winnerItem: {
    background: "rgba(255, 215, 0, 0.05)",
    border: "1px solid rgba(255, 215, 0, 0.2)",
    borderRadius: "12px",
    padding: "15px",
    display: "flex",
    alignItems: "center",
    gap: "15px",
    transition: "all 0.3s ease",
  },
  winnerRank: {
    background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
    color: "#000",
    fontWeight: "800",
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  winnerInfo: {
    flex: 1,
  },
  winnerWallet: {
    color: "#fff",
    fontSize: "0.95rem",
    fontFamily: "monospace",
    marginBottom: "5px",
  },
  winnerTime: {
    color: "#888",
    fontSize: "0.8rem",
  },
  winnerAmount: {
    color: "#4CAF50",
    fontWeight: "700",
    fontSize: "1.1rem",
    whiteSpace: "nowrap",
  },
  txLink: {
    color: "#1e88e5",
    fontSize: "1.3rem",
    textDecoration: "none",
  },
  contractCard: {
    background: "linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(30, 30, 30, 0.8) 100%)",
    backdropFilter: "blur(10px)",
    border: "2px solid rgba(255, 215, 0, 0.3)",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "20px",
    width: "100%",
    maxWidth: "500px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
  },
  cardLabel: {
    color: "#FFD700",
    fontSize: "0.9rem",
    fontWeight: "700",
    marginBottom: "10px",
    textAlign: "center",
  },
  contractAddress: {
    color: "#fff",
    fontSize: "0.9rem",
    marginBottom: "15px",
    textAlign: "center",
    fontFamily: "monospace",
    wordBreak: "break-all",
  },
  contractActions: {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
  },
  whitepaperButton: {
    padding: "8px 16px",
    fontSize: "0.9rem",
    borderRadius: "8px",
    background: "linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)",
    border: "none",
    color: "#fff",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  errorBanner: {
    background: "linear-gradient(135deg, rgba(255, 23, 68, 0.2) 0%, rgba(139, 0, 0, 0.2) 100%)",
    border: "2px solid #FF1744",
    borderRadius: "12px",
    padding: "15px",
    marginBottom: "20px",
    width: "100%",
    maxWidth: "500px",
    color: "#FF1744",
    fontWeight: "700",
    textAlign: "center",
    boxShadow: "0 4px 20px rgba(255, 23, 68, 0.3)",
  },
  rankUpdateBanner: {
    background: "linear-gradient(135deg, rgba(156, 39, 176, 0.2) 0%, rgba(123, 31, 162, 0.2) 100%)",
    border: "2px solid #9C27B0",
    borderRadius: "12px",
    padding: "15px",
    marginBottom: "20px",
    width: "100%",
    maxWidth: "500px",
    color: "#9C27B0",
    fontWeight: "700",
    textAlign: "center",
  },
  tokenCard: {
    background: "linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(30, 30, 30, 0.8) 100%)",
    backdropFilter: "blur(10px)",
    border: "2px solid rgba(156, 39, 176, 0.5)",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "20px",
    width: "100%",
    maxWidth: "500px",
    boxShadow: "0 8px 32px rgba(156, 39, 176, 0.3)",
  },
  tokenGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "15px",
    marginTop: "15px",
  },
  tokenStat: {
    background: "rgba(156, 39, 176, 0.1)",
    border: "1px solid rgba(156, 39, 176, 0.3)",
    borderRadius: "10px",
    padding: "15px",
    textAlign: "center",
  },
  statLabel: {
    color: "#9C27B0",
    fontSize: "0.8rem",
    fontWeight: "600",
    marginBottom: "5px",
  },
  statValue: {
    color: "#fff",
    fontSize: "1.1rem",
    fontWeight: "800",
  },
  tokenWarning: {
    marginTop: "15px",
    padding: "12px",
    background: "rgba(255, 23, 68, 0.15)",
    border: "1px solid #FF1744",
    borderRadius: "10px",
    color: "#FF1744",
    fontSize: "0.85rem",
    textAlign: "center",
  },
  slotMachine: {
    width: "100%",
    maxWidth: "600px",
    background: "linear-gradient(135deg, rgba(20, 20, 40, 0.95) 0%, rgba(10, 10, 20, 0.95) 100%)",
    backdropFilter: "blur(20px)",
    border: "3px solid rgba(255, 215, 0, 0.4)",
    borderRadius: "24px",
    padding: "30px 20px",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
    position: "relative",
  },
  statsPanel: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "15px",
    marginBottom: "20px",
  },
  stat: {
    background: "rgba(0, 0, 0, 0.6)",
    border: "2px solid rgba(255, 215, 0, 0.3)",
    borderRadius: "12px",
    padding: "15px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    transition: "all 0.3s ease",
  },
  statIcon: {
    fontSize: "2rem",
    filter: "drop-shadow(0 0 8px rgba(255, 215, 0, 0.5))",
  },
  statLabelSmall: {
    color: "#FFD700",
    fontSize: "0.75rem",
    fontWeight: "600",
    marginBottom: "5px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  statValueLarge: {
    color: "#fff",
    fontSize: "1.2rem",
    fontWeight: "800",
  },
  playerStats: {
    background: "rgba(76, 175, 80, 0.1)",
    border: "2px solid rgba(76, 175, 80, 0.4)",
    borderRadius: "12px",
    padding: "12px",
    marginBottom: "15px",
    color: "#4CAF50",
    fontWeight: "700",
    fontSize: "0.9rem",
    textAlign: "center",
  },
  timerBadge: {
    background: "rgba(255, 23, 68, 0.1)",
    border: "2px solid rgba(255, 23, 68, 0.4)",
    borderRadius: "12px",
    padding: "12px",
    marginBottom: "15px",
    color: "#FF1744",
    fontWeight: "700",
    fontSize: "0.95rem",
    textAlign: "center",
  },
  reelsContainer: {
    background: "rgba(0, 0, 0, 0.7)",
    border: "3px solid rgba(255, 215, 0, 0.5)",
    borderRadius: "16px",
    padding: "30px 20px",
    marginBottom: "20px",
    position: "relative",
    boxShadow: "inset 0 4px 20px rgba(0, 0, 0, 0.8)",
  },
  reelsWrapper: {
    display: "flex",
    justifyContent: "center",
    gap: "15px",
  },
  reelContainer: {
    position: "relative",
  },
  reelBox: {
    width: "100px",
    height: "100px",
    background: "linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)",
    borderRadius: "12px",
    overflow: "hidden",
    border: "3px solid rgba(255, 215, 0, 0.6)",
    position: "relative",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6), inset 0 2px 4px rgba(255, 215, 0, 0.1)",
  },
  reelStrip: {
    display: "flex",
    flexDirection: "column",
  },
  symbol: {
    width: "100%",
    height: "100px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0a0a0a",
  },
  finalNumber: {
    position: "absolute",
    inset: 0,
    background: "rgba(0, 0, 0, 0.95)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "pulse 1s ease-in-out",
  },
  reelGlow: {
    position: "absolute",
    inset: "-5px",
    background: "radial-gradient(circle, rgba(255, 215, 0, 0.4) 0%, transparent 70%)",
    borderRadius: "12px",
    filter: "blur(10px)",
    zIndex: -1,
    animation: "glow 2s ease-in-out infinite",
  },
  jackpotBanner: {
    background: "linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 165, 0, 0.2) 100%)",
    border: "3px solid #FFD700",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "20px",
    textAlign: "center",
    boxShadow: "0 8px 32px rgba(255, 215, 0, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.2)",
    animation: "pulse 1.5s ease-in-out infinite",
  },
  jackpotText: {
    fontSize: "1.8rem",
    fontWeight: "900",
    color: "#FFD700",
    marginBottom: "10px",
    textShadow: "0 0 20px rgba(255, 215, 0, 0.8)",
  },
  jackpotAmount: {
    fontSize: "2.2rem",
    fontWeight: "900",
    background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    textShadow: "0 0 30px rgba(255, 215, 0, 0.6)",
  },
  controls: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    marginBottom: "20px",
  },
  registerButton: {
    padding: "18px 32px",
    fontSize: "1.2rem",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)",
    border: "3px solid rgba(76, 175, 80, 0.5)",
    color: "#fff",
    fontWeight: "800",
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(76, 175, 80, 0.4)",
    transition: "all 0.3s ease",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  spinButton: {
    padding: "20px 40px",
    fontSize: "1.4rem",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #FF1744 0%, #C62828 100%)",
    border: "3px solid rgba(255, 215, 0, 0.5)",
    color: "#fff",
    fontWeight: "900",
    cursor: "pointer",
    boxShadow: "0 8px 32px rgba(255, 23, 68, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.2)",
    transition: "all 0.3s ease",
    textTransform: "uppercase",
    letterSpacing: "2px",
  },
  buyButton: {
    padding: "15px 28px",
    fontSize: "1.05rem",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #9C27B0 0%, #6A1B9A 100%)",
    border: "2px solid rgba(156, 39, 176, 0.5)",
    color: "#fff",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 6px 20px rgba(156, 39, 176, 0.4)",
    transition: "all 0.3s ease",
  },
  infoSection: {
    background: "rgba(0, 0, 0, 0.4)",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid rgba(255, 215, 0, 0.2)",
  },
  infoTitle: {
    color: "#FFD700",
    fontSize: "1.1rem",
    fontWeight: "800",
    marginBottom: "15px",
    textAlign: "center",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
  },
  infoItem: {
    background: "rgba(255, 215, 0, 0.05)",
    border: "1px solid rgba(255, 215, 0, 0.2)",
    borderRadius: "8px",
    padding: "12px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  infoItemIcon: {
    fontSize: "1.5rem",
  },
  infoItemText: {
    color: "#e0e0e0",
    fontSize: "0.85rem",
    fontWeight: "500",
    lineHeight: "1.4",
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