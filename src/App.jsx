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
import santa from "./assets/images/santa.png";
import lotteryBg from "./assets/images/lotteryBg.jpg";
import whiteboardPdf from "./assets/whiteboardPdf.pdf";

const PROGRAM_ID = new PublicKey("AHJVuYoVquX4wruGcHwNxhFt1tu8SXFB89hhqyDtgK6H");
const TOKEN_ADDRESS = "BJdGG4rQEkFSDfdwrMjQUpEdJ7NAqqHSZ8dj7ghQpump";
const MIN_TOKEN_VALUE_SOL = 0.04;
const SPIN_COST_SOL = 0.01;

// Optional: Add your Moralis API key for holder ranking features
const MORALIS_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6Ijk4OTZhZDI1LTA5NDItNDc5Yi1iMjcxLWQwZDRiMDY1ZmI2MCIsIm9yZ0lkIjoiMzc1Njk2IiwidXNlcklkIjoiMzg2MDc2IiwidHlwZUlkIjoiYmViZjI4N2ItNjMyNS00MmQ2LWI1NmYtY2YzMTY4MWZhZmE5IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3MDcwNDE3ODIsImV4cCI6NDg2MjgwMTc4Mn0.qhV3NBVMXvKm5Gt1pPtYIVSdwlErOYZ4e4gXjs4x5Hg";

// FIXED: Symbols array - contract returns 0-5
const symbols = [santa, twoImage, giraffe, apple, fourImage, zeroImage];
const isImage = (symbol) => typeof symbol === "string";

// FIXED: Direct mapping - contract now returns 0-5
const mapReelToSymbol = (reelValue) => {
  if (reelValue >= 0 && reelValue < symbols.length) {
    return symbols[reelValue];
  }
  return santa; // fallback
};

// Confetti Component
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

// Reel Component
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
  
  // Token-related states
  const [tokenBalance, setTokenBalance] = useState(0);
  const [tokenValueSOL, setTokenValueSOL] = useState(0);
  const [tokenPriceUSD, setTokenPriceUSD] = useState(0);
  const [holderRank, setHolderRank] = useState(null);
  const [hasMinTokens, setHasMinTokens] = useState(false);
  const [isCheckingTokens, setIsCheckingTokens] = useState(false);
  const [lastRankUpdate, setLastRankUpdate] = useState(null);

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

  // Fetch SOL price in USD from DexScreener
  const fetchSOLPrice = async () => {
    try {
      console.log("🔍 Fetching SOL/USD price...");
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112`
      );
      
      if (!response.ok) {
        throw new Error(`DexScreener SOL API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        const bestPair = data.pairs.reduce((prev, current) => 
          (prev.liquidity?.usd || 0) > (current.liquidity?.usd || 0) ? prev : current
        );
        
        const solPriceUSD = parseFloat(bestPair.priceUsd || 0);
        console.log("💰 SOL Price: $" + solPriceUSD.toFixed(2));
        
        return solPriceUSD;
      }
      
      console.warn("⚠️ No SOL pairs found");
      return 0;
    } catch (error) {
      console.error("❌ Failed to fetch SOL price:", error);
      return 0;
    }
  };

  // Fetch token price from DexScreener API
  const fetchTokenPrice = async () => {
    try {
      console.log("🔍 Fetching token price from DexScreener...");
      
      const [tokenResponse, solPriceUSD] = await Promise.all([
        fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDRESS}`),
        fetchSOLPrice()
      ]);
      
      if (!tokenResponse.ok) {
        throw new Error(`DexScreener API error: ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();
      
      if (tokenData.pairs && tokenData.pairs.length > 0) {
        const bestPair = tokenData.pairs.reduce((prev, current) => 
          (prev.liquidity?.usd || 0) > (current.liquidity?.usd || 0) ? prev : current
        );
        
        const tokenPriceUSD = parseFloat(bestPair.priceUsd || 0);
        const tokenPriceSOL = solPriceUSD > 0 ? tokenPriceUSD / solPriceUSD : 0;
        
        console.log("💰 Token Price:", { 
          tokenPriceUSD: tokenPriceUSD.toFixed(8),
          solPriceUSD: solPriceUSD.toFixed(2),
          tokenPriceSOL: tokenPriceSOL.toFixed(8)
        });
        
        setTokenPriceUSD(tokenPriceUSD);
        
        return { priceUSD: tokenPriceUSD, priceSOL: tokenPriceSOL };
      }
      
      console.warn("⚠️ No pairs found for token - using fallback");
      return { priceUSD: 0, priceSOL: 0 };
    } catch (error) {
      console.error("❌ Failed to fetch token price:", error);
      return { priceUSD: 0, priceSOL: 0 };
    }
  };

  // Fetch token holders from Moralis API
  const fetchTokenHolders = async () => {
    if (!MORALIS_API_KEY) {
      console.log("⚠️ Moralis API key not configured - skipping holder ranking");
      return [];
    }

    try {
      console.log("🔍 Fetching token holders from Moralis...");
      
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

      if (!response.ok) {
        throw new Error(`Moralis API error: ${response.status}`);
      }

      const data = await response.json();
      console.log("📊 Token holders data:", data);
      
      return data.result || [];
    } catch (error) {
      console.error("❌ Failed to fetch token holders:", error);
      return [];
    }
  };

  // Check user's token balance and rank
  const checkTokenHoldings = async (walletAddress) => {
    if (!walletAddress) return;
    
    setIsCheckingTokens(true);
    console.log("🔍 Checking token holdings for:", walletAddress.toString());

    try {
      const { priceUSD, priceSOL } = await fetchTokenPrice();
      
      if (priceUSD === 0 || priceSOL === 0) {
        console.warn("⚠️ Could not fetch token price - allowing play anyway");
        setTokenBalance(1);
        setTokenValueSOL(MIN_TOKEN_VALUE_SOL);
        setHasMinTokens(true);
        setIsCheckingTokens(false);
        return;
      }

      if (!MORALIS_API_KEY) {
        console.log("⚠️ Moralis API not configured - using fallback values");
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

      if (!balanceResponse.ok) {
        throw new Error(`Moralis balance API error: ${balanceResponse.status}`);
      }

      const balanceData = await balanceResponse.json();
      console.log("💼 Wallet tokens:", balanceData);

      const tokenData = balanceData.tokens?.find(
        t => t.mint === TOKEN_ADDRESS
      );

      if (!tokenData) {
        console.log("❌ Token not found in wallet");
        setTokenBalance(0);
        setTokenValueSOL(0);
        setHasMinTokens(false);
        setHolderRank(null);
        setIsCheckingTokens(false);
        return;
      }

      const balance = parseFloat(tokenData.amount) / Math.pow(10, tokenData.decimals);
      const valueSOL = balance * priceSOL;

      console.log("💰 Token holdings:", {
        balance: balance.toFixed(4),
        tokenPriceSOL: priceSOL.toFixed(8),
        valueSOL: valueSOL.toFixed(4),
        meetsMinimum: valueSOL >= MIN_TOKEN_VALUE_SOL
      });

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

        const userRank = sortedHolders.findIndex(
          h => h.address === walletAddress.toString()
        ) + 1;

        console.log("🏆 Holder rank:", userRank, "out of", sortedHolders.length);
        setHolderRank(userRank > 0 ? userRank : null);
      }

      setIsCheckingTokens(false);
    } catch (error) {
      console.error("❌ Token check failed:", error);
      console.log("⚠️ Using fallback - allowing play");
      setTokenBalance(1);
      setTokenValueSOL(MIN_TOKEN_VALUE_SOL);
      setHasMinTokens(true);
      setIsCheckingTokens(false);
    }
  };

  // NEW: Update player rank on-chain
  const updatePlayerRank = async () => {
    if (!program || !publicKey || !playerAccount) {
      console.log("⚠️ Cannot update rank - not ready");
      return false;
    }

    // Check if rank needs updating (once per day)
    const now = Date.now();
    if (lastRankUpdate && (now - lastRankUpdate) < 86400000) { // 24 hours in ms
      console.log("✅ Rank already updated today");
      return true;
    }

    setIsUpdatingRank(true);
    console.log("🔄 Updating player rank from Moralis...");

    try {
      // Fetch fresh rank data
      await checkTokenHoldings(publicKey);

      // Wait a bit for state to update
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
        [Buffer.from("game")],
        PROGRAM_ID
      );

      const rank = holderRank || 101;

      console.log("📋 Updating rank to:", rank);

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

      console.log("✅ Rank updated! Tx:", tx);
      
      await connection.confirmTransaction(tx, "confirmed");
      
      // Mark rank as updated
      setLastRankUpdate(now);
      
      // Wait for account to update
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setIsUpdatingRank(false);
      return true;
    } catch (err) {
      console.error("❌ Rank update failed:", err);
      
      if (err.logs) {
        console.error("Program logs:", err.logs);
      }
      
      setErrorMessage("Failed to update rank. Please try again.");
      setTimeout(() => setErrorMessage(""), 5000);
      setIsUpdatingRank(false);
      return false;
    }
  };

  // Check tokens when wallet connects
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
        console.log(gameAccount)
        if (gameAccount) {
          const state = await program.account.gameState.fetch(gamePda);
          console.log("🎮 Game state:", {
            totalSpins: state.totalSpins.toString(),
            totalJackpots: state.totalJackpots.toString(),
            totalPaidOut: (Number(state.totalPaidOut?.toString() || 0) / LAMPORTS_PER_SOL).toFixed(4) + " SOL"
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

  // Fetch Player Account - FIXED VERSION
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
          console.log("⚠️ Player not registered - account doesn't exist");
          setPlayerAccount(null);
          setDailySpinsLeft(0);
          setExtraSpins(0);
          return;
        }

        const acc = await program.account.playerAccount.fetch(playerPda);
        
        const rank = Number(acc.holderRank?.toString() || 0);
        const dailyLimit = Number(acc.dailySpinLimit?.toString() || 0);
        const dailyUsed = Number(acc.dailySpinsUsed?.toString() || 0);
        const extra = Number(acc.extraSpins?.toString() || 0);
        
        console.log("👤 Player account:", {
          rank,
          dailyLimit,
          dailyUsed,
          extraSpins: extra,
          totalSpins: Number(acc.totalSpins?.toString() || 0),
          totalWins: Number(acc.totalWins?.toString() || 0),
          totalWinnings: (Number(acc.totalWinnings?.toString() || 0) / LAMPORTS_PER_SOL).toFixed(4) + " SOL"
        });
        
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

  // Download PDF
  const downloadPDF = () => {
    const link = document.createElement('a');
    link.href = whiteboardPdf;
    link.download = 'whiteboard.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Register Player - FIXED VERSION
  const registerPlayer = async () => {
    if (!program || !publicKey) {
      console.log("⚠️ Cannot register - missing program or publicKey");
      return;
    }

    try {
      const [playerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("player"), publicKey.toBytes()],
        PROGRAM_ID
      );
      
      const existingAccount = await connection.getAccountInfo(playerPda);
      if (existingAccount) {
        console.log("✅ Already registered, fetching account...");
        setErrorMessage("Already registered!");
        setTimeout(() => setErrorMessage(""), 3000);
        return;
      }
    } catch (e) {
      // Account doesn't exist, proceed with registration
    }

    if (!hasMinTokens) {
      setErrorMessage(`Need at least ${MIN_TOKEN_VALUE_SOL} SOL worth of tokens!`);
      setTimeout(() => setErrorMessage(""), 5000);
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

      const rank = holderRank || 101;

      console.log("📋 Registration params:", {
        holderRank: rank,
        hasMinTokens,
        tokenBalance: tokenBalance.toFixed(4),
        tokenValueSOL: tokenValueSOL.toFixed(4),
        playerPda: playerPda.toString(),
        gamePda: gamePda.toString()
      });

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

      console.log("✅ Registration successful! Tx:", tx);
      
      await connection.confirmTransaction(tx, "confirmed");
      
      // Mark rank as updated
      setLastRankUpdate(Date.now());
      
      await new Promise(resolve => setTimeout(resolve, 2000));
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

  // Buy Extra Spin - FIXED VERSION
  const buyExtraSpin = async () => {
    if (!program || !publicKey || !playerAccount) {
      console.log("⚠️ Cannot buy spin - not ready");
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
        .rpc({
          commitment: "confirmed"
        });

      console.log("✅ Extra spin purchased! Tx:", tx);
      
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

  // Spin Function - MODIFIED to update rank daily
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

    // NEW: Update rank before spinning (once per day)
    const rankUpdated = await updatePlayerRank();
    if (!rankUpdated) {
      return; // Stop if rank update failed
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
          systemProgram: SystemProgram.programId
        })
        .rpc({
          commitment: "confirmed"
        });

      console.log("✅ Spin transaction sent! Tx:", tx);
      
      // Wait for confirmation
      await connection.confirmTransaction(tx, "confirmed");

      // Fetch results after confirmation
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
          
          // If won, show the winning combination: FOUR (4), ZERO (5), TWO (1)
          if (wonLamports > 0) {
            // Winning combination: fourImage, zeroImage, twoImage
            // These map to indices 4, 5, 1 in the symbols array
            finalResults = [symbols[4], symbols[5], symbols[1]]; // fourImage, zeroImage, twoImage
          } else {
            // Generate random non-winning results
            let reel1, reel2, reel3;
            do {
              reel1 = symbols[Math.floor(Math.random() * symbols.length)];
              reel2 = symbols[Math.floor(Math.random() * symbols.length)];
              reel3 = symbols[Math.floor(Math.random() * symbols.length)];
            } while (
              // Avoid the exact winning combination
              (reel1 === symbols[4] && reel2 === symbols[5] && reel3 === symbols[1])
            );
            
            finalResults = [reel1, reel2, reel3];
          }

          console.log("🎰 Reel results:", finalResults);

          return {
            results: finalResults,
            wonSOL,
            freshPlayer,
            newPool
          };
        } catch (e) {
          console.error("❌ Failed to fetch results:", e);
          // Fallback to random non-winning results
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

      // Animate reels
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

        // Update spins properly
        const newDailySpinsLeft = Math.max(0, Number(resultData.freshPlayer.dailySpinLimit?.toString() || 0) - Number(resultData.freshPlayer.dailySpinsUsed?.toString() || 0));
        setDailySpinsLeft(newDailySpinsLeft);
        setExtraSpins(Number(resultData.freshPlayer.extraSpins?.toString() || 0));
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
      
      if (err.logs) {
        console.error("Program logs:", err.logs);
      }
      
      setErrorMessage(err?.message?.substring(0, 100) || "Spin failed!");
      setTimeout(() => setErrorMessage(""), 5000);
      setSpinning([false, false, false]);
      setIsPlaying(false);
    }
  };

  // Check if current results are a winning combination
  const isWinner = results.length === 3 && 
    results[0] === symbols[4] &&  // fourImage
    results[1] === symbols[5] &&  // zeroImage
    results[2] === symbols[1] &&  // twoImage
    lastWin > 0;


  return (
    <div style={styles.page}>
      <div style={styles.backgroundLayer}></div>

      {showConfetti && <Confetti />}

      <div style={styles.headerSection}>
        <h2 style={styles.headerTitle}>🎰 Token-Gated Slot Casino 🎰</h2>
      </div>

      <div style={styles.topButtons}>
        <WalletMultiButton style={{ ...styles.walletButton, height: "50px" }} />
      </div>

      <div style={styles.contractBox}>
        <div style={styles.contractLabel}>📜 Token Contract Address</div>
        <div style={styles.contractAddress}>
          {TOKEN_ADDRESS.toString().substring(0, 30)}...
        </div>
        <div style={styles.contractActions}>
          <button
            style={styles.actionButton}
            onClick={() => {
              navigator.clipboard.writeText(TOKEN_ADDRESS.toString());
            }}
          >
            📋 Copy
          </button>
          <button onClick={downloadPDF} style={styles.pdfButton}>
            📄 Whitepaper
          </button>
        </div>
      </div>

      {errorMessage && <div style={styles.errorMessage}>{errorMessage}</div>}

      {isUpdatingRank && (
        <div style={styles.updateRankBanner}>
          🔄 Updating holder rank... Please wait.
        </div>
      )}

      {connected && (
        <div style={styles.tokenInfoBox}>
          <div style={styles.tokenInfoLabel}>
            {isCheckingTokens ? "🔄 Checking Token Holdings..." : "💎 Token Status"}
          </div>
          <div style={styles.tokenInfoGrid}>
            <div style={styles.tokenInfoItem}>
              <span style={styles.tokenInfoKey}>Balance:</span>
              <span style={styles.tokenInfoValue}>{tokenBalance.toFixed(2)} tokens</span>
            </div>
            <div style={styles.tokenInfoItem}>
              <span style={styles.tokenInfoKey}>Value:</span>
              <span style={styles.tokenInfoValue}>{tokenValueSOL.toFixed(4)} SOL</span>
            </div>
            <div style={styles.tokenInfoItem}>
              <span style={styles.tokenInfoKey}>Rank:</span>
              <span style={styles.tokenInfoValue}>
                {holderRank ? `#${holderRank}` : "Checking..."}
              </span>
            </div>
            <div style={styles.tokenInfoItem}>
              <span style={styles.tokenInfoKey}>Qualified:</span>
              <span style={{
                ...styles.tokenInfoValue,
                color: hasMinTokens ? "#4CAF50" : "#FF1744"
              }}>
                {hasMinTokens ? "✅ Yes" : "❌ No"}
              </span>
            </div>
          </div>
          {!hasMinTokens && (
            <div style={styles.tokenWarning}>
              ⚠️ Need {MIN_TOKEN_VALUE_SOL} SOL worth of {TOKEN_ADDRESS.substring(0, 8)}... tokens to play
            </div>
          )}
          {lastRankUpdate && (
            <div style={styles.rankUpdateInfo}>
              ✅ Rank last updated: {new Date(lastRankUpdate).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}

      <div style={styles.container}>
        <div style={styles.slotMachine}>
          <div style={styles.displayPanel}>
            <div style={styles.infoBox}>
              <div style={styles.infoLabel}>PRIZE POOL</div>
              <div style={styles.infoValue}>10.877 SOL</div>
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

          {connected && playerAccount && (
            <div style={styles.statsBadge}>
              📊 Total Spins: {Number(playerAccount.totalSpins?.toString() || 0)} | 
              Wins: {Number(playerAccount.totalWins?.toString() || 0)} | 
              Total Won: {(Number(playerAccount.totalWinnings?.toString() || 0) / LAMPORTS_PER_SOL).toFixed(4)} SOL
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
                disabled={isRegistering || !hasMinTokens || isCheckingTokens}
                style={{
                  ...styles.registerButton,
                  opacity: isRegistering || !hasMinTokens || isCheckingTokens ? 0.6 : 1,
                }}
              >
                {isRegistering ? "REGISTERING..." : 
                 isCheckingTokens ? "CHECKING TOKENS..." :
                 !hasMinTokens ? "INSUFFICIENT TOKENS" : 
                 "REGISTER TO PLAY"}
              </button>
            ) : (
              <>
                <button
                  onClick={play}
                  disabled={!connected || isPlaying || isUpdatingRank || (dailySpinsLeft <= 0 && extraSpins <= 0)}
                  style={{
                    ...styles.spinButton,
                    opacity: !connected || isPlaying || isUpdatingRank || (dailySpinsLeft <= 0 && extraSpins <= 0) ? 0.6 : 1,
                  }}
                >
                  {isPlaying ? "SPINNING..." : 
                   isUpdatingRank ? "UPDATING RANK..." :
                   connected ? "SPIN" : "CONNECT WALLET"}
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
                    {isBuyingSpin ? "BUYING..." : `BUY SPIN (${SPIN_COST_SOL} SOL)`}
                  </button>
                )}
              </>
            )}
          </div>

          {connected && (
            <div style={styles.infoText}>
              💡 Holder Benefits:<br/>
              🥇 Top 10: 100 daily spins | 🥈 Top 11-50: 50 spins | 🥉 Top 51-100: 10 spins<br/>
              💰 Minimum {MIN_TOKEN_VALUE_SOL} SOL worth of tokens required<br/>
              🎯 Match 3 symbols(4-0-2) on up to 80% of the prize pool!<br/>
              🔥 Extra spins cost {SPIN_COST_SOL} SOL and never expire except usage<br/>
              ⚡ Daily spins reset every 24 hours<br/>
              🔄 Your rank is automatically updated from once per day
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

// Styles
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
  updateRankBanner: {
    margin: "8px 0",
    padding: "10px",
    background: "rgba(156, 39, 176, 0.2)",
    border: "2px solid #9C27B0",
    borderRadius: "10px",
    color: "#9C27B0",
    fontWeight: "700",
    fontSize: "0.9rem",
    maxWidth: "420px",
    textAlign: "center",
  },
  tokenInfoBox: {
    background: "#000",
    border: "2px solid #9C27B0",
    borderRadius: "12px",
    padding: "12px",
    margin: "8px 0",
    width: "100%",
    maxWidth: "420px",
  },
  tokenInfoLabel: {
    color: "#9C27B0",
    fontSize: "0.8rem",
    fontWeight: "700",
    marginBottom: "8px",
    textAlign: "center",
  },
  tokenInfoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  tokenInfoItem: {
    background: "rgba(156, 39, 176, 0.1)",
    padding: "6px",
    borderRadius: "6px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  tokenInfoKey: {
    color: "#9C27B0",
    fontSize: "0.65rem",
    fontWeight: "600",
  },
  tokenInfoValue: {
    color: "#fff",
    fontSize: "0.85rem",
    fontWeight: "700",
  },
  tokenWarning: {
    marginTop: "8px",
    padding: "6px",
    background: "rgba(255, 23, 68, 0.15)",
    border: "1px solid #FF1744",
    borderRadius: "6px",
    color: "#FF1744",
    fontSize: "0.7rem",
    textAlign: "center",
  },
  rankUpdateInfo: {
    marginTop: "8px",
    padding: "6px",
    background: "rgba(76, 175, 80, 0.15)",
    border: "1px solid #4CAF50",
    borderRadius: "6px",
    color: "#4CAF50",
    fontSize: "0.7rem",
    textAlign: "center",
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
    cursor: "pointer",
  },
  registerButton: {
    padding: "12px 22px",
    fontSize: "1rem",
    borderRadius: "999px",
    background: "linear-gradient(135deg, #43a047, #1b5e20)",
    border: "2px solid #FFD700",
    color: "#fff",
    fontWeight: "800",
    cursor: "pointer",
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
    maxWidth: "420px",
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