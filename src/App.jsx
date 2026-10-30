import React, { useState, useEffect, useRef } from "react";
import { 
  Trophy, Users, Gavel, Volume2, VolumeX, 
  ChevronRight, ShieldCheck, Play, Pause, RotateCcw, 
  Eye, CheckCircle2, XCircle, Award, Lock, LogOut, KeyRound, 
  AlertTriangle, Shuffle, Layers, Dices, Shirt, Rocket, Clock,
  Crown, UserPlus, Trash2, ListPlus, ShieldPlus, PlusCircle,
  Sliders, Settings, Download, FileUp, Sparkles
} from "lucide-react";
import { db } from "./firebase";
import { ref, onValue, set } from "firebase/database";

const AUCTIONEER_PIN = "9999";
const DEFAULT_INCREMENT = 10000;

const DEFAULT_SLOTS = [
  { id: "s_bat", name: "Pure Batsmen" },
  { id: "s_ar", name: "All-Rounders" },
  { id: "s_wk", name: "Wicketkeepers" },
  { id: "s_bowl", name: "Bowlers & Spinners" }
];

const DEFAULT_TEAMS = [
  { id: "t1", name: "Veteran Kings", pin: "1111", purse: 1000000, initialPurse: 1000000, players: [], border: "border-blue-500", captainId: null },
  { id: "t2", name: "Veteran Smashers", pin: "2222", purse: 1000000, initialPurse: 1000000, players: [], border: "border-amber-500", captainId: null },
  { id: "t3", name: "Veteran Lions", pin: "3333", purse: 1000000, initialPurse: 1000000, players: [], border: "border-emerald-500", captainId: null },
  { id: "t4", name: "Veteran Strikers", pin: "4444", purse: 1000000, initialPurse: 1000000, players: [], border: "border-rose-500", captainId: null }
];

const DEFAULT_PLAYERS = [
  { id: "p1", name: "Sudhir Kumar", category: "Pure Batsmen", role: "Top-Order Batsman", basePrice: 40000, stats: { matches: 22, runs: 580, wickets: 3 }, status: "UP_FOR_BID", soldPrice: 0, soldTo: "", round: 1, isCaptain: false },
  { id: "p2", name: "Ajay Rout", category: "All-Rounders", role: "Pace All-Rounder", basePrice: 50000, stats: { matches: 28, runs: 640, wickets: 24 }, status: "UP_FOR_BID", soldPrice: 0, soldTo: "", round: 1, isCaptain: false },
  { id: "p3", name: "Santosh Verma", category: "Wicketkeepers", role: "Wicketkeeper / Bat", basePrice: 40000, stats: { matches: 25, runs: 490, wickets: 0 }, status: "UP_FOR_BID", soldPrice: 0, soldTo: "", round: 1, isCaptain: false },
  { id: "p4", name: "Shivashish", category: "Bowlers & Spinners", role: "Strike Bowler", basePrice: 30000, stats: { matches: 20, runs: 75, wickets: 29 }, status: "UP_FOR_BID", soldPrice: 0, soldTo: "", round: 1, isCaptain: false }
];

const shuffleArray = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export default function App() {
  const [role, setRole] = useState("spectator"); 
  const [authenticatedRole, setAuthenticatedRole] = useState(null);
  const [authenticatedTeamId, setAuthenticatedTeamId] = useState(null);

  // Core Auction State
  const [auctionStarted, setAuctionStarted] = useState(false);
  const [maxRosterSize, setMaxRosterSize] = useState(11);
  const [minSlotReservePrice, setMinSlotReservePrice] = useState(20000);
  const [slots, setSlots] = useState(DEFAULT_SLOTS);
  const [teams, setTeams] = useState(DEFAULT_TEAMS);
  const [players, setPlayers] = useState(DEFAULT_PLAYERS);
  const [shuffledSlots, setShuffledSlots] = useState([]);
  const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
  const [isAcceleratedRound, setIsAcceleratedRound] = useState(false);
  const [activePlayerId, setActivePlayerId] = useState(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [leadingTeamId, setLeadingTeamId] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [timer, setTimer] = useState(30);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hammerActive, setHammerActive] = useState(false);

  // Modals
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [targetLoginRole, setTargetLoginRole] = useState(null);
  const [selectedTeamForLogin, setSelectedTeamForLogin] = useState("");
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState("");

  const [controlCenterOpen, setControlCenterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("slots");

  // Form Inputs
  const [newSlotName, setNewSlotName] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamPurse, setNewTeamPurse] = useState(1000000);
  const [newTeamPin, setNewTeamPin] = useState("");
  const [newTeamBorder, setNewTeamBorder] = useState("border-cyan-500");

  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerCategory, setNewPlayerCategory] = useState("");
  const [newPlayerRole, setNewPlayerRole] = useState("");
  const [newPlayerBasePrice, setNewPlayerBasePrice] = useState(30000);
  const [newPlayerMatches, setNewPlayerMatches] = useState(10);
  const [newPlayerRuns, setNewPlayerRuns] = useState("");
  const [newPlayerWickets, setNewPlayerWickets] = useState("");

  const [csvText, setCsvText] = useState("");

  const audioCtxRef = useRef(null);
  const isSyncingFromRemote = useRef(false);

  // Sync to Firebase with undefined sanitization
  const syncToFirebase = (patch = {}) => {
    if (!db || isSyncingFromRemote.current) return;
    try {
      const currentState = {
        auctionStarted,
        maxRosterSize,
        minSlotReservePrice,
        slots,
        teams,
        players,
        shuffledSlots,
        currentSlotIndex,
        isAcceleratedRound,
        activePlayerId: activePlayerId || "",
        currentBid,
        leadingTeamId: leadingTeamId || "",
        bidHistory,
        timer,
        isTimerRunning,
        hammerActive,
        ...patch
      };

      const cleanPayload = JSON.parse(JSON.stringify(currentState));
      set(ref(db, "auctionState"), cleanPayload).catch((err) => {
        console.warn("Firebase sync write error:", err);
      });
    } catch (err) {
      console.warn("Firebase sync payload error:", err);
    }
  };

  // Firebase Remote Listener
  useEffect(() => {
    if (!db) return;
    try {
      const auctionStateRef = ref(db, "auctionState");
      const unsubscribe = onValue(auctionStateRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          isSyncingFromRemote.current = true;
          setAuctionStarted(Boolean(data.auctionStarted));
          setMaxRosterSize(data.maxRosterSize || 11);
          setMinSlotReservePrice(data.minSlotReservePrice || 20000);
          if (data.slots && Array.isArray(data.slots)) setSlots(data.slots);
          if (data.teams && Array.isArray(data.teams)) setTeams(data.teams);
          if (data.players && Array.isArray(data.players)) setPlayers(data.players);
          if (data.shuffledSlots && Array.isArray(data.shuffledSlots)) setShuffledSlots(data.shuffledSlots);
          setCurrentSlotIndex(data.currentSlotIndex || 0);
          setIsAcceleratedRound(Boolean(data.isAcceleratedRound));
          setActivePlayerId(data.activePlayerId || null);
          setCurrentBid(data.currentBid || 0);
          setLeadingTeamId(data.leadingTeamId || null);
          setBidHistory(Array.isArray(data.bidHistory) ? data.bidHistory : []);
          setTimer(data.timer !== undefined ? data.timer : 30);
          setIsTimerRunning(Boolean(data.isTimerRunning));
          setHammerActive(Boolean(data.hammerActive));
          setTimeout(() => {
            isSyncingFromRemote.current = false;
          }, 50);
        }
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Firebase listener skipped:", e);
    }
  }, []);

  useEffect(() => {
    if (slots.length > 0 && !newPlayerCategory) {
      setNewPlayerCategory(slots[0].name);
    }
  }, [slots]);

  const activeSlot = isAcceleratedRound 
    ? { id: "ACCELERATED", name: "Accelerated Round 2" } 
    : (shuffledSlots[currentSlotIndex] || slots[0] || { id: "none", name: "General" });

  const currentPlayer = players.find((p) => p.id === activePlayerId) || null;

  const playTone = (freq, duration, type = "sine") => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio fallback
    }
  };

  const getTeamEligibility = (team) => {
    const currentCount = team.players ? team.players.length : 0;
    const isFull = currentCount >= maxRosterSize;
    const remainingSlotsNeeded = Math.max(0, maxRosterSize - (currentCount + 1));
    const mandatoryReserve = remainingSlotsNeeded * minSlotReservePrice;
    const safeMaxBid = Math.max(0, team.purse - mandatoryReserve);

    return {
      isFull,
      currentCount,
      remainingSlotsNeeded,
      mandatoryReserve,
      safeMaxBid
    };
  };

  // Timer loop
  useEffect(() => {
    let interval = null;
    if (auctionStarted && isTimerRunning && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 5 && prev > 1) {
            playTone(880, 0.15, "triangle");
          } else if (prev === 1) {
            playTone(440, 0.4, "sawtooth");
          }
          const next = prev - 1;
          if (role === "auctioneer") syncToFirebase({ timer: next });
          return next;
        });
      }, 1000);
    } else if (timer === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      if (role === "auctioneer") syncToFirebase({ isTimerRunning: false });
    }
    return () => clearInterval(interval);
  }, [auctionStarted, isTimerRunning, timer, soundEnabled, role]);

  const openPinPrompt = (roleType) => {
    setTargetLoginRole(roleType);
    setEnteredPin("");
    setPinError("");
    if (roleType === "captain" && teams.length > 0 && !selectedTeamForLogin) {
      setSelectedTeamForLogin(teams[0].id);
    }
    setPinModalOpen(true);
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (targetLoginRole === "auctioneer") {
      if (enteredPin === AUCTIONEER_PIN) {
        setAuthenticatedRole("auctioneer");
        setRole("auctioneer");
        setPinModalOpen(false);
      } else {
        setPinError("Invalid Auctioneer PIN (Hint: 9999)");
      }
    } else if (targetLoginRole === "captain") {
      const team = teams.find((t) => t.id === selectedTeamForLogin);
      if (team && team.pin === enteredPin) {
        setAuthenticatedRole("captain");
        setAuthenticatedTeamId(team.id);
        setRole("captain");
        setPinModalOpen(false);
      } else {
        setPinError(`Invalid PIN for ${team?.name || "Team"}`);
      }
    }
  };

  const handleLogout = () => {
    setAuthenticatedRole(null);
    setAuthenticatedTeamId(null);
    setRole("spectator");
  };

  // Robust Add Player Handler
  const handleAddPlayer = (e) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    const categoryToAssign = newPlayerCategory || (slots[0] ? slots[0].name : "General");

    const cleanStats = {
      matches: Number(newPlayerMatches) || 0
    };
    if (newPlayerRuns !== "" && !isNaN(Number(newPlayerRuns))) {
      cleanStats.runs = Number(newPlayerRuns);
    }
    if (newPlayerWickets !== "" && !isNaN(Number(newPlayerWickets))) {
      cleanStats.wickets = Number(newPlayerWickets);
    }

    const newPlayer = {
      id: "p_" + Date.now(),
      name: newPlayerName.trim(),
      category: categoryToAssign,
      role: newPlayerRole.trim() || categoryToAssign,
      basePrice: Number(newPlayerBasePrice) || minSlotReservePrice,
      stats: cleanStats,
      status: "UP_FOR_BID",
      soldPrice: 0,
      soldTo: "",
      round: 1,
      isCaptain: false
    };

    const updated = [...players, newPlayer];
    setPlayers(updated);
    syncToFirebase({ players: updated });

    setNewPlayerName("");
    setNewPlayerRole("");
    setNewPlayerRuns("");
    setNewPlayerWickets("");
    playTone(550, 0.15, "sine");
  };

  // Remove Player Handler
  const handleRemovePlayer = (playerId) => {
    const target = players.find((p) => p.id === playerId);
    if (!target) return;
    if (target.isCaptain || target.status === "SOLD") {
      alert("Cannot delete a player who is already allocated as Captain or Sold!");
      return;
    }
    const updated = players.filter((p) => p.id !== playerId);
    setPlayers(updated);
    const patch = { players: updated };
    if (activePlayerId === playerId) {
      setActivePlayerId(null);
      setCurrentBid(0);
      patch.activePlayerId = "";
      patch.currentBid = 0;
    }
    syncToFirebase(patch);
  };

  // Add Team Handler
  const handleAddTeam = (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    const newTeam = {
      id: "t_" + Date.now(),
      name: newTeamName.trim(),
      pin: newTeamPin.trim() || "0000",
      purse: Number(newTeamPurse) || 1000000,
      initialPurse: Number(newTeamPurse) || 1000000,
      players: [],
      border: newTeamBorder,
      captainId: ""
    };

    const updatedTeams = [...teams, newTeam];
    setTeams(updatedTeams);
    syncToFirebase({ teams: updatedTeams });
    setNewTeamName("");
    setNewTeamPin("");
    playTone(600, 0.1, "sine");
  };

  // Remove Team Handler
  const handleRemoveTeam = (teamId) => {
    const target = teams.find((t) => t.id === teamId);
    if (!target) return;
    if (target.players && target.players.length > 0) {
      alert(`Cannot delete ${target.name} because they already have squad members!`);
      return;
    }
    const updated = teams.filter((t) => t.id !== teamId);
    setTeams(updated);
    syncToFirebase({ teams: updated });
  };

  // Bulk CSV Import Handler
  const handleBulkCsvImport = () => {
    if (!csvText.trim()) return;
    const lines = csvText.trim().split("\n");
    const parsedPlayers = [];
    const discoveredSlots = new Set(slots.map(s => s.name));

    lines.forEach((line, index) => {
      if (index === 0 && line.toLowerCase().includes("name") && line.toLowerCase().includes("category")) {
        return;
      }

      const parts = line.split(",").map(p => p.trim());
      if (parts.length >= 2 && parts[0]) {
        const name = parts[0];
        const category = parts[1] || (slots[0] ? slots[0].name : "General");
        const role = parts[2] || category;
        const basePrice = Number(parts[3]) || minSlotReservePrice;
        const matches = Number(parts[4]) || 0;
        const runs = parts[5] && !isNaN(Number(parts[5])) ? Number(parts[5]) : undefined;
        const wickets = parts[6] && !isNaN(Number(parts[6])) ? Number(parts[6]) : undefined;

        discoveredSlots.add(category);

        const cleanStats = { matches };
        if (runs !== undefined) cleanStats.runs = runs;
        if (wickets !== undefined) cleanStats.wickets = wickets;

        parsedPlayers.push({
          id: `p_${Date.now()}_${index}`,
          name,
          category,
          role,
          basePrice,
          stats: cleanStats,
          status: "UP_FOR_BID",
          soldPrice: 0,
          soldTo: "",
          round: 1,
          isCaptain: false
        });
      }
    });

    if (parsedPlayers.length === 0) {
      alert("No valid player rows found in the CSV text!");
      return;
    }

    const updatedSlots = Array.from(discoveredSlots).map((name, i) => ({
      id: `s_${i}_${Date.now()}`,
      name
    }));

    const updatedPlayers = [...players, ...parsedPlayers];
    setSlots(updatedSlots);
    setPlayers(updatedPlayers);
    syncToFirebase({ slots: updatedSlots, players: updatedPlayers });
    setCsvText("");
    alert(`Successfully imported ${parsedPlayers.length} players!`);
  };

  // Export CSV Handler
  const handleExportCsv = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Type,Player Name,Role,Category,Team,Winning Bid (INR),Status\n";

    players.forEach((p) => {
      const type = p.isCaptain ? "Captain" : "Player";
      const team = p.soldTo || "None";
      const price = p.soldPrice || 0;
      csvContent += `"${type}","${p.name}","${p.role}","${p.category}","${team}","${price}","${p.status}"\n`;
    });

    csvContent += "\nFranchise Summary\n";
    csvContent += "Team Name,Starting Purse,Remaining Purse,Players Signed\n";
    teams.forEach((t) => {
      const count = t.players ? t.players.length : 0;
      csvContent += `"${t.name}","${t.initialPurse}","${t.purse}","${count}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Auction_Final_Summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadSampleCsv = () => {
    const sample = `Sudhir Kumar,Pure Batsmen,Top-Order Batsman,40000,22,580,3
Ajay Rout,All-Rounders,Pace All-Rounder,50000,28,640,24
Santosh Verma,Wicketkeepers,Wicketkeeper / Bat,40000,25,490,0
Shivashish,Bowlers & Spinners,Strike Bowler,30000,20,75,29
Aman Gupta,Pure Batsmen,Opening Batsman,30000,15,320,0
Somasis,All-Rounders,Spin All-Rounder,40000,24,390,19
Akash Deep,Bowlers & Spinners,Express Pacer,35000,18,40,26
Mohit Sharma,Bowlers & Spinners,Mystery Spinner,30000,19,40,21`;
    setCsvText(sample);
  };

  // Assign Captain Handler
  const handleAssignCaptain = (teamId, playerId) => {
    const targetPlayer = players.find((p) => p.id === playerId);
    const targetTeam = teams.find((t) => t.id === teamId);
    if (!targetPlayer || !targetTeam) return;

    const updatedPlayers = players.map((p) => {
      if (p.id === playerId) {
        return { ...p, status: "SOLD", soldPrice: 0, soldTo: targetTeam.name, isCaptain: true };
      }
      return p;
    });

    const captainRecord = { ...targetPlayer, status: "SOLD", soldPrice: 0, soldTo: targetTeam.name, isCaptain: true };

    const updatedTeams = teams.map((t) => {
      if (t.id === teamId) {
        const existingWithoutCapt = (t.players || []).filter((p) => !p.isCaptain);
        return {
          ...t,
          captainId: playerId,
          players: [captainRecord, ...existingWithoutCapt]
        };
      }
      return t;
    });

    setPlayers(updatedPlayers);
    setTeams(updatedTeams);
    syncToFirebase({ players: updatedPlayers, teams: updatedTeams });
    playTone(750, 0.2, "triangle");
  };

  const allCaptainsAssigned = teams.length > 0 && teams.every((t) => Boolean(t.captainId));

  // Start Auction Handler
  const handleStartAuction = () => {
    if (teams.length < 2) {
      alert("Please configure at least 2 teams before starting!");
      return;
    }
    if (slots.length === 0) {
      alert("Please add at least 1 Category Slot!");
      return;
    }
    if (!allCaptainsAssigned) {
      alert("Please assign a captain for every team before starting!");
      return;
    }

    const availablePlayers = players.filter((p) => p.status === "UP_FOR_BID");
    if (availablePlayers.length === 0) {
      alert("No players available in the pool! Please add or import players first.");
      return;
    }

    const randomized = shuffleArray(slots);
    const firstSlotName = randomized[0].name;
    const pool = players.filter((p) => p.category === firstSlotName && p.status === "UP_FOR_BID");
    
    let firstPlayer = null;
    if (pool.length > 0) {
      firstPlayer = pool[Math.floor(Math.random() * pool.length)];
    } else {
      firstPlayer = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
    }

    const nextState = {
      auctionStarted: true,
      shuffledSlots: randomized,
      currentSlotIndex: 0,
      activePlayerId: firstPlayer ? firstPlayer.id : "",
      currentBid: firstPlayer ? firstPlayer.basePrice : 0,
      leadingTeamId: "",
      bidHistory: [],
      timer: 30,
      isTimerRunning: false,
      hammerActive: false
    };

    setAuctionStarted(true);
    setShuffledSlots(randomized);
    setCurrentSlotIndex(0);
    if (firstPlayer) {
      setActivePlayerId(firstPlayer.id);
      setCurrentBid(firstPlayer.basePrice);
    }
    setLeadingTeamId(null);
    setBidHistory([]);
    setTimer(30);
    setIsTimerRunning(false);

    syncToFirebase(nextState);
    playTone(660, 0.3, "square");
  };

  // Next Random Player Pick
  const pickNextRandomPlayer = (updatedPlayers, currentSlotIdx = currentSlotIndex, isAccelerated = isAcceleratedRound, slotList = shuffledSlots) => {
    if (isAccelerated) {
      const acceleratedPool = updatedPlayers.filter((p) => p.status === "UP_FOR_BID" && p.round === 2);
      if (acceleratedPool.length > 0) {
        const rand = acceleratedPool[Math.floor(Math.random() * acceleratedPool.length)];
        const nextState = {
          activePlayerId: rand.id,
          currentBid: rand.basePrice,
          leadingTeamId: "",
          bidHistory: [],
          timer: 30,
          isTimerRunning: false
        };
        setActivePlayerId(rand.id);
        setCurrentBid(rand.basePrice);
        setLeadingTeamId(null);
        setBidHistory([]);
        setTimer(30);
        setIsTimerRunning(false);
        syncToFirebase(nextState);
        playTone(520, 0.15, "triangle");
        return;
      }
      return;
    }

    if (slotList.length === 0) return;
    const currentSlotName = slotList[currentSlotIdx]?.name;
    const poolInCurrentSlot = updatedPlayers.filter((p) => p.category === currentSlotName && p.status === "UP_FOR_BID");

    if (poolInCurrentSlot.length > 0) {
      const randPlayer = poolInCurrentSlot[Math.floor(Math.random() * poolInCurrentSlot.length)];
      const nextState = {
        activePlayerId: randPlayer.id,
        currentBid: randPlayer.basePrice,
        leadingTeamId: "",
        bidHistory: [],
        timer: 30,
        isTimerRunning: false
      };
      setActivePlayerId(randPlayer.id);
      setCurrentBid(randPlayer.basePrice);
      setLeadingTeamId(null);
      setBidHistory([]);
      setTimer(30);
      setIsTimerRunning(false);
      syncToFirebase(nextState);
      playTone(520, 0.15, "triangle");
    } else {
      let foundNextSlot = -1;
      for (let i = 0; i < slotList.length; i++) {
        const checkName = slotList[i].name;
        const count = updatedPlayers.filter((p) => p.category === checkName && p.status === "UP_FOR_BID").length;
        if (count > 0) {
          foundNextSlot = i;
          break;
        }
      }

      if (foundNextSlot !== -1) {
        const nextName = slotList[foundNextSlot].name;
        const nextPool = updatedPlayers.filter((p) => p.category === nextName && p.status === "UP_FOR_BID");
        const chosen = nextPool[Math.floor(Math.random() * nextPool.length)];
        const nextState = {
          currentSlotIndex: foundNextSlot,
          activePlayerId: chosen.id,
          currentBid: chosen.basePrice,
          leadingTeamId: "",
          bidHistory: [],
          timer: 30,
          isTimerRunning: false
        };
        setCurrentSlotIndex(foundNextSlot);
        setActivePlayerId(chosen.id);
        setCurrentBid(chosen.basePrice);
        setLeadingTeamId(null);
        setBidHistory([]);
        setTimer(30);
        setIsTimerRunning(false);
        syncToFirebase(nextState);
        playTone(680, 0.25, "square");
      }
    }
  };

  // Place Bid Handler
  const handlePlaceBid = (teamId, increment = DEFAULT_INCREMENT) => {
    if (!auctionStarted) return;
    const team = teams.find((t) => t.id === teamId);
    if (!team || !currentPlayer) return;

    const { isFull, safeMaxBid, remainingSlotsNeeded, mandatoryReserve } = getTeamEligibility(team);

    if (isFull) {
      alert(`${team.name} already has ${maxRosterSize} players! Squad is complete.`);
      return;
    }

    const nextBidAmount = leadingTeamId ? currentBid + increment : currentBid;

    if (nextBidAmount > safeMaxBid) {
      alert(
        `Bid Rejected! ${team.name} has ₹${team.purse.toLocaleString("en-IN")}.\n` +
        `Must reserve ₹${mandatoryReserve.toLocaleString("en-IN")} for ${remainingSlotsNeeded} slot(s) left.\n` +
        `Max safe bid: ₹${safeMaxBid.toLocaleString("en-IN")}.`
      );
      return;
    }

    const nextHistory = [
      { teamId, amount: nextBidAmount, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
      ...bidHistory
    ];

    setCurrentBid(nextBidAmount);
    setLeadingTeamId(teamId);
    setBidHistory(nextHistory);
    setTimer(30);
    setIsTimerRunning(true);

    syncToFirebase({
      currentBid: nextBidAmount,
      leadingTeamId: teamId,
      bidHistory: nextHistory,
      timer: 30,
      isTimerRunning: true
    });

    playTone(600, 0.1, "sine");
  };

  // Hammer Sold Handler
  const handleSold = () => {
    if (!leadingTeamId || !currentPlayer) return;
    setHammerActive(true);
    syncToFirebase({ hammerActive: true });
    playTone(220, 0.5, "sawtooth");

    const winningTeam = teams.find((t) => t.id === leadingTeamId);

    const updatedTeams = teams.map((t) =>
      t.id === leadingTeamId
        ? { ...t, purse: t.purse - currentBid, players: [...(t.players || []), { ...currentPlayer, soldPrice: currentBid, soldTo: winningTeam.name }] }
        : t
    );

    const updatedPlayers = players.map((p) =>
      p.id === currentPlayer.id
        ? { ...p, status: "SOLD", soldPrice: currentBid, soldTo: winningTeam.name }
        : p
    );

    setTeams(updatedTeams);
    setPlayers(updatedPlayers);

    setTimeout(() => {
      setHammerActive(false);
      syncToFirebase({
        hammerActive: false,
        teams: updatedTeams,
        players: updatedPlayers
      });
      pickNextRandomPlayer(updatedPlayers);
    }, 1500);
  };

  // Pass to Unsold Handler
  const handleUnsold = () => {
    if (!currentPlayer) return;
    playTone(180, 0.3, "square");

    const updatedPlayers = players.map((p) =>
      p.id === currentPlayer.id ? { ...p, status: "UNSOLD" } : p
    );
    setPlayers(updatedPlayers);
    syncToFirebase({ players: updatedPlayers });
    pickNextRandomPlayer(updatedPlayers);
  };

  const handleStartAcceleratedRound = (slashBasePrice = false) => {
    const updatedPlayers = players.map((p) => {
      if (p.status === "UNSOLD") {
        return {
          ...p,
          status: "UP_FOR_BID",
          round: 2,
          basePrice: slashBasePrice ? Math.max(minSlotReservePrice, Math.floor(p.basePrice / 2)) : p.basePrice
        };
      }
      return p;
    });

    setPlayers(updatedPlayers);
    setIsAcceleratedRound(true);
    syncToFirebase({ players: updatedPlayers, isAcceleratedRound: true });
    pickNextRandomPlayer(updatedPlayers, currentSlotIndex, true);
  };

  const currentSlotRemainingCount = isAcceleratedRound
    ? players.filter((p) => p.status === "UP_FOR_BID" && p.round === 2).length
    : players.filter((p) => p.category === activeSlot.name && p.status === "UP_FOR_BID").length;

  const totalUnsoldCount = players.filter((p) => p.status === "UNSOLD").length;
  const pendingInitialCount = players.filter((p) => p.status === "UP_FOR_BID" && p.round === 1).length;
  const leadingTeam = teams.find((t) => t.id === leadingTeamId);
  const myCaptainTeam = teams.find((t) => t.id === authenticatedTeamId);
  const myEligibility = myCaptainTeam ? getTeamEligibility(myCaptainTeam) : null;
  const nextRequiredBid = leadingTeamId ? currentBid + DEFAULT_INCREMENT : currentBid;
  
  const canCaptainBid = auctionStarted && myCaptainTeam && 
    !myEligibility.isFull && 
    nextRequiredBid <= myEligibility.safeMaxBid && 
    leadingTeamId !== myCaptainTeam.id;

  const availableCaptainCandidates = players.filter((p) => p.status === "UP_FOR_BID");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 rounded-xl shadow-lg font-black">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black uppercase tracking-wider bg-gradient-to-r from-amber-300 via-orange-400 to-yellow-200 bg-clip-text text-transparent">
                  Live Cricket Auction 2026
                </h1>
                {auctionStarted ? (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-300 border-emerald-500/40 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE SYNCED
                  </span>
                ) : (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full border bg-amber-500/20 text-amber-300 border-amber-500/40 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Setup Lobby
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {teams.length} Teams • {slots.length} Category Slots • {maxRosterSize} Max Roster Limit
              </p>
            </div>
          </div>

          {/* Role Navigation */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
            <button
              onClick={() => {
                if (authenticatedRole === "auctioneer") setRole("auctioneer");
                else openPinPrompt("auctioneer");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                role === "auctioneer" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              <Gavel className="w-3.5 h-3.5" /> 
              Auctioneer
              {authenticatedRole !== "auctioneer" && <Lock className="w-3 h-3 ml-0.5 opacity-60" />}
            </button>

            <button
              onClick={() => {
                if (authenticatedRole === "captain") setRole("captain");
                else openPinPrompt("captain");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                role === "captain" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" /> 
              Captain Paddle
              {authenticatedRole !== "captain" && <Lock className="w-3 h-3 ml-0.5 opacity-60" />}
            </button>

            <button
              onClick={() => setRole("spectator")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                role === "spectator" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Big Screen
            </button>

            {authenticatedRole && (
              <button
                onClick={handleLogout}
                title="Log out"
                className="p-1.5 text-rose-400 hover:bg-slate-800 rounded-lg ml-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 flex items-center gap-1 font-bold transition"
              title="Export Rosters to CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" /> Export CSV
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700 transition"
              title="Toggle Audio"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full p-4 md:p-6 flex-1 flex flex-col gap-5">
        
        {/* Teams Dashboard */}
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {teams.map((team) => {
            const elig = getTeamEligibility(team);
            const captainObj = (team.players || []).find((p) => p.isCaptain);

            return (
              <div
                key={team.id}
                className={`p-3.5 rounded-xl border bg-slate-900/60 backdrop-blur transition-all ${
                  auctionStarted && leadingTeamId === team.id ? `${team.border} ring-2 ring-amber-400/50 shadow-lg` : "border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black uppercase text-slate-300 truncate">{team.name}</span>
                  {captainObj && (
                    <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Crown className="w-2.5 h-2.5" /> {captainObj.name.split(" ")[0]}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between mt-2">
                  <div>
                    <div className="text-[10px] text-slate-400 font-medium">Purse Remaining</div>
                    <div className="text-base font-extrabold text-white">₹{(team.purse).toLocaleString("en-IN")}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 font-medium">Squad</div>
                    <div className="text-sm font-bold text-amber-400">
                      {elig.currentCount} <span className="text-slate-500 text-[10px]">/ {maxRosterSize}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Safe Max Bid:</span>
                  <span className="font-mono font-bold text-emerald-400">₹{elig.safeMaxBid.toLocaleString("en-IN")}</span>
                </div>
              </div>
            );
          })}
        </section>

        {/* PRE-AUCTION LOBBY */}
        {!auctionStarted ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden flex flex-col gap-6">
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl shadow-inner">
                  <Sliders className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider">
                    Auction Setup & Captain Allocation
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">
                    Manage Slots, Teams, Budgets, and Bulk Import Players. Everything syncs live through Firebase.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {role === "auctioneer" && (
                  <>
                    <button
                      onClick={() => setControlCenterOpen(true)}
                      className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold text-xs uppercase tracking-wider transition flex items-center gap-2"
                    >
                      <Settings className="w-4 h-4" /> Control Center
                    </button>
                    <button
                      disabled={!allCaptainsAssigned}
                      onClick={handleStartAuction}
                      className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-xl ${
                        allCaptainsAssigned
                          ? "bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 shadow-amber-500/20 active:scale-95 cursor-pointer"
                          : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                      }`}
                    >
                      <Rocket className="w-4 h-4" /> Start Auction Now
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Captain Allocation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {teams.map((team) => {
                const assignedCaptain = players.find((p) => p.id === team.captainId);

                return (
                  <div
                    key={team.id}
                    className={`p-4 rounded-2xl border bg-slate-950/80 flex flex-col justify-between transition-all ${
                      assignedCaptain ? "border-emerald-500/40 shadow-lg shadow-emerald-500/5" : "border-slate-800"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-extrabold text-sm text-white truncate">{team.name}</span>
                        {assignedCaptain ? (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Allocated
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-400">
                            Required
                          </span>
                        )}
                      </div>

                      {assignedCaptain ? (
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center font-black text-lg">
                            {assignedCaptain.name.charAt(0)}
                          </div>
                          <div className="flex-1 truncate">
                            <div className="text-xs font-black text-white truncate">{assignedCaptain.name}</div>
                            <div className="text-[10px] text-amber-400 font-medium">{assignedCaptain.role}</div>
                            <div className="text-[9px] text-emerald-400 font-bold mt-0.5">Squad #1 (Free)</div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                          No captain designated
                        </div>
                      )}
                    </div>

                    {role === "auctioneer" ? (
                      <div className="mt-4 pt-3 border-t border-slate-800">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          {assignedCaptain ? "Change Captain" : "Designate Captain"}
                        </label>
                        <select
                          value={team.captainId || ""}
                          onChange={(e) => handleAssignCaptain(team.id, e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white font-bold text-xs rounded-xl p-2.5 focus:border-amber-400 focus:outline-none"
                        >
                          <option value="">-- Select from Player Pool --</option>
                          {assignedCaptain && (
                            <option value={assignedCaptain.id}>{assignedCaptain.name} ({assignedCaptain.role}) [Selected]</option>
                          )}
                          {availableCaptainCandidates.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="mt-3 text-[11px] text-slate-400 text-center">
                        Waiting for Auctioneer to designate captain
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!allCaptainsAssigned && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-center gap-2 text-center">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Assign a captain for every team to unlock the <b>"Start Auction Now"</b> button.</span>
              </div>
            )}

          </div>
        ) : (
          /* LIVE ARENA */
          <>
            <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Dices className="w-3.5 h-3.5 text-amber-400" /> Random Category Slots:
                </span>

                {shuffledSlots.map((slot, sIdx) => {
                  const countInSlot = players.filter((p) => p.category === slot.name && p.status === "UP_FOR_BID").length;
                  const isActive = !isAcceleratedRound && currentSlotIndex === sIdx;

                  return (
                    <div
                      key={slot.id}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition ${
                        isActive
                          ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-2 ring-amber-400/30"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      <span>#{sIdx + 1} {slot.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                        isActive ? "bg-slate-950/20 text-slate-950" : "bg-slate-800 text-slate-300"
                      }`}>
                        {countInSlot} left
                      </span>
                    </div>
                  );
                })}
              </div>

              {role === "auctioneer" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setControlCenterOpen(true)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                  >
                    <Settings className="w-3.5 h-3.5" /> Controls
                  </button>
                  <button
                    onClick={() => {
                      const randomized = shuffleArray(slots);
                      setShuffledSlots(randomized);
                      setCurrentSlotIndex(0);
                      pickNextRandomPlayer(players, 0, false, randomized);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                    title="Randomly reshuffle remaining slots"
                  >
                    <Shuffle className="w-3.5 h-3.5" /> Re-Shuffle
                  </button>
                </div>
              )}
            </section>

            {/* Accelerated Round Banner */}
            {role === "auctioneer" && pendingInitialCount === 0 && totalUnsoldCount > 0 && !isAcceleratedRound && (
              <div className="bg-gradient-to-r from-purple-900/60 to-indigo-900/60 border border-purple-500/40 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                <div>
                  <h4 className="font-black text-white text-base">All Slots Finished! {totalUnsoldCount} Unsold In Pool</h4>
                  <p className="text-xs text-purple-200 mt-0.5">
                    Start Accelerated Round 2 so every single player ends up sold.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartAcceleratedRound(false)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow transition"
                  >
                    Re-Auction Same Base
                  </button>
                  <button
                    onClick={() => handleStartAcceleratedRound(true)}
                    className="px-4 py-2 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 text-slate-950 font-black text-xs rounded-xl shadow transition"
                  >
                    50% Price Slash
                  </button>
                </div>
              </div>
            )}

            {/* Podium */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 md:p-6 relative overflow-hidden backdrop-blur flex flex-col justify-between shadow-2xl">
                {hammerActive && (
                  <div className="absolute inset-0 bg-slate-950/90 z-30 flex flex-col items-center justify-center">
                    <div className="text-6xl mb-3 animate-bounce">🔨</div>
                    <h3 className="text-3xl font-black text-amber-400 uppercase tracking-widest">SOLD!</h3>
                    <p className="text-lg text-slate-200 mt-2 font-semibold">
                      To <span className="text-emerald-400">{leadingTeam?.name}</span> for ₹{currentBid.toLocaleString("en-IN")}
                    </p>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-black uppercase tracking-wider rounded-md flex items-center gap-1">
                        <Layers className="w-3 h-3" /> Slot: {activeSlot.name}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold uppercase">{currentPlayer?.role}</span>
                    </div>

                    <div className={`px-3 py-1 rounded-lg border font-mono font-bold text-sm flex items-center gap-1.5 ${
                      timer <= 5 ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse" : "bg-slate-800 border-slate-700 text-slate-300"
                    }`}>
                      ⏱️ 00:{timer < 10 ? `0${timer}` : timer}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center mt-2">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 border-2 border-slate-600 flex items-center justify-center text-4xl shadow-inner font-black text-amber-400">
                      {currentPlayer?.name ? currentPlayer.name.charAt(0) : "?"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl sm:text-3xl font-black text-white">{currentPlayer?.name || "Slot Complete"}</h2>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Random Selection
                        </span>
                      </div>
                      {currentPlayer && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-md font-medium">
                            Matches: <b className="text-white">{currentPlayer.stats.matches}</b>
                          </span>
                          {currentPlayer.stats.runs !== undefined && (
                            <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-md font-medium">
                              Runs: <b className="text-white">{currentPlayer.stats.runs}</b>
                            </span>
                          )}
                          {currentPlayer.stats.wickets !== undefined && (
                            <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-md font-medium">
                              Wkts: <b className="text-white">{currentPlayer.stats.wickets}</b>
                            </span>
                          )}
                        </div>
                      )}
                      <div className="mt-3 text-xs text-slate-400">
                        Base Price: <span className="font-bold text-slate-200">₹{currentPlayer?.basePrice?.toLocaleString("en-IN") || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Highest Bid</span>
                    <div className="text-3xl md:text-4xl font-black text-amber-400 tracking-tight">
                      ₹{currentBid.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Highest Bidder</span>
                    <div className="text-lg font-extrabold text-white">
                      {leadingTeam ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400">
                          <ShieldCheck className="w-4 h-4" /> {leadingTeam.name}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">No bids yet</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Panels */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                
                {role === "auctioneer" && (
                  <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-5 backdrop-blur shadow-xl">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                      <h3 className="font-extrabold text-sm uppercase text-amber-400 flex items-center gap-1.5">
                        <Gavel className="w-4 h-4" /> Auctioneer Deck
                      </h3>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const next = !isTimerRunning;
                            setIsTimerRunning(next);
                            syncToFirebase({ isTimerRunning: next });
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 text-xs font-semibold flex items-center gap-1"
                        >
                          {isTimerRunning ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                        </button>
                        <button
                          onClick={() => {
                            setTimer(30);
                            syncToFirebase({ timer: 30 });
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 text-xs"
                          title="Reset Timer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Raise Bid (+₹10,000)</label>
                      <div className="grid grid-cols-2 gap-2">
                        {teams.map((t) => {
                          const elig = getTeamEligibility(t);
                          const nextBid = leadingTeamId ? currentBid + 10000 : currentBid;
                          const isBidDisabled = elig.isFull || nextBid > elig.safeMaxBid;

                          return (
                            <button
                              key={t.id}
                              disabled={isBidDisabled}
                              onClick={() => handlePlaceBid(t.id, 10000)}
                              className={`p-2.5 rounded-xl text-left transition flex flex-col border ${
                                elig.isFull 
                                  ? "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed opacity-50"
                                  : isBidDisabled
                                  ? "bg-rose-950/20 border-rose-900/40 text-rose-300 cursor-not-allowed"
                                  : "bg-slate-800/90 hover:bg-slate-800 border-slate-700 hover:border-amber-400/50"
                              }`}
                            >
                              <span className="text-xs font-bold text-white truncate">{t.name}</span>
                              <span className="text-[10px] text-amber-400 font-mono mt-0.5">
                                {elig.isFull ? `Full (${maxRosterSize})` : isBidDisabled ? "Reserve Blocked" : `Safe: ₹${(elig.safeMaxBid/1000).toFixed(0)}k`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800">
                      <button
                        disabled={!leadingTeamId}
                        onClick={handleSold}
                        className="p-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Sold (Hammer)
                      </button>
                      <button
                        onClick={handleUnsold}
                        className="p-3 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        <XCircle className="w-4 h-4" /> Pass to Unsold
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-3 text-xs">
                      <button
                        onClick={() => pickNextRandomPlayer(players)}
                        className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
                      >
                        <Shuffle className="w-3.5 h-3.5" /> Skip / Draw Random Next
                      </button>
                      <span className="text-slate-500 font-medium">{currentSlotRemainingCount} left in slot</span>
                    </div>
                  </div>
                )}

                {/* Captain Paddle */}
                {role === "captain" && (
                  <div className="flex flex-col gap-4">
                    
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur shadow-xl">
                      <div className="pb-3 border-b border-slate-800 mb-4 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Logged In As</span>
                          <h3 className="text-base font-black text-amber-400 flex items-center gap-1.5">
                            {myCaptainTeam?.name}
                          </h3>
                        </div>
                        <button
                          onClick={() => openPinPrompt("captain")}
                          className="text-xs text-slate-400 hover:text-white underline"
                        >
                          Switch Team
                        </button>
                      </div>

                      {myCaptainTeam && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                            <div>
                              <div className="text-slate-400 text-[10px]">Purse</div>
                              <div className="text-sm font-extrabold text-white mt-0.5">₹{myCaptainTeam.purse.toLocaleString("en-IN")}</div>
                            </div>
                            <div>
                              <div className="text-slate-400 text-[10px]">Squad Count</div>
                              <div className="text-sm font-extrabold text-amber-400 mt-0.5">{myEligibility.currentCount} / {maxRosterSize}</div>
                            </div>
                            <div>
                              <div className="text-slate-400 text-[10px]">Safe Max Bid</div>
                              <div className="text-sm font-extrabold text-emerald-400 mt-0.5">₹{myEligibility.safeMaxBid.toLocaleString("en-IN")}</div>
                            </div>
                          </div>

                          {myEligibility.remainingSlotsNeeded > 0 && (
                            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <div>
                                <b>₹{myEligibility.mandatoryReserve.toLocaleString("en-IN")}</b> reserved for your remaining <b>{myEligibility.remainingSlotsNeeded}</b> squad slot(s).
                              </div>
                            </div>
                          )}

                          <button
                            disabled={!canCaptainBid}
                            onClick={() => handlePlaceBid(authenticatedTeamId, 10000)}
                            className={`w-full py-5 rounded-2xl font-black text-lg tracking-wider uppercase transition-all shadow-xl active:scale-95 flex flex-col items-center justify-center ${
                              myEligibility.isFull
                                ? "bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed"
                                : leadingTeamId === authenticatedTeamId
                                ? "bg-slate-800 text-emerald-400 border border-emerald-500/50 cursor-default"
                                : canCaptainBid
                                ? "bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 shadow-amber-500/20"
                                : "bg-slate-800 text-rose-400 border border-rose-500/30 cursor-not-allowed"
                            }`}
                          >
                            {myEligibility.isFull ? (
                              <span>ROSTER COMPLETE ({maxRosterSize} PLAYERS)</span>
                            ) : leadingTeamId === authenticatedTeamId ? (
                              <span>YOU HOLD HIGHEST BID</span>
                            ) : canCaptainBid ? (
                              <>
                                <span>RAISE PADDLE (+₹10k)</span>
                                <span className="text-xs font-bold tracking-normal opacity-80 mt-0.5">New Bid: ₹{nextRequiredBid.toLocaleString("en-IN")}</span>
                              </>
                            ) : (
                              <div className="text-center">
                                <span className="text-sm">BID BLOCKED: PURSE RESERVE LIMIT</span>
                                <div className="text-[10px] tracking-normal opacity-80 mt-0.5">Must reserve budget for {maxRosterSize} players</div>
                              </div>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Purchased Squad View */}
                    {myCaptainTeam && (
                      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur shadow-xl">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                          <h4 className="font-extrabold text-sm uppercase text-slate-200 flex items-center gap-2">
                            <Shirt className="w-4 h-4 text-amber-400" /> 
                            Your Squad ({myCaptainTeam.players ? myCaptainTeam.players.length : 0} / {maxRosterSize})
                          </h4>
                          <span className="text-xs text-slate-400 font-mono">
                            Spent: ₹{(myCaptainTeam.initialPurse - myCaptainTeam.purse).toLocaleString("en-IN")}
                          </span>
                        </div>

                        <div className="grid grid-cols-11 gap-1 mb-3">
                          {Array.from({ length: maxRosterSize }).map((_, slotIdx) => {
                            const filled = slotIdx < (myCaptainTeam.players ? myCaptainTeam.players.length : 0);
                            const isCaptSlot = filled && myCaptainTeam.players[slotIdx].isCaptain;

                            return (
                              <div
                                key={slotIdx}
                                className={`h-2 rounded-full transition-all ${
                                  isCaptSlot 
                                    ? "bg-amber-400 shadow-sm shadow-amber-400/50" 
                                    : filled 
                                    ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" 
                                    : "bg-slate-800"
                                }`}
                                title={`Slot ${slotIdx + 1}: ${filled ? myCaptainTeam.players[slotIdx].name : "Empty"}`}
                              />
                            );
                          })}
                        </div>

                        {(!myCaptainTeam.players || myCaptainTeam.players.length === 0) ? (
                          <div className="text-xs text-slate-500 italic py-6 text-center border border-dashed border-slate-800 rounded-xl">
                            No players purchased yet. Place bids to build your {maxRosterSize}-player squad!
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {myCaptainTeam.players.map((p, idx) => (
                              <div
                                key={idx}
                                className={`flex items-center justify-between p-2.5 rounded-xl border ${
                                  p.isCaptain ? "bg-amber-500/10 border-amber-500/30" : "bg-slate-950/80 border-slate-800"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                    p.isCaptain ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-400"
                                  }`}>
                                    {p.isCaptain ? "👑" : idx + 1}
                                  </span>
                                  <div>
                                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                      {p.name}
                                      {p.isCaptain && <span className="text-[9px] bg-amber-400/20 text-amber-300 font-extrabold px-1 rounded">CAPTAIN</span>}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-medium">{p.role}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-extrabold font-mono text-emerald-400">
                                    {p.isCaptain ? "Assigned" : `₹${p.soldPrice?.toLocaleString("en-IN")}`}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )}

                {/* Big Screen Spectator Mode */}
                {role === "spectator" && (
                  <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 text-center">
                    <Dices className="w-8 h-8 text-amber-400 mx-auto mb-2 opacity-80 animate-spin" />
                    <h4 className="font-bold text-white text-sm">Random Slot: {activeSlot.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Both the slots and the players are drawn in randomized order.
                    </p>
                  </div>
                )}

                {/* Bid History */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                    <span>Recent Bid Ticker</span>
                    <span className="text-[10px] text-slate-500">{bidHistory.length} bids</span>
                  </h4>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {bidHistory.length === 0 ? (
                      <div className="text-xs text-slate-500 italic py-3 text-center">Awaiting initial bid...</div>
                    ) : (
                      bidHistory.map((item, idx) => {
                        const t = teams.find((team) => team.id === item.teamId);
                        return (
                          <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                            <span className="font-bold text-slate-300">{t?.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-amber-400">₹{item.amount.toLocaleString("en-IN")}</span>
                              <span className="text-[10px] text-slate-500">{item.timestamp}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>
            </section>

            {/* Active Slot Summary */}
            <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-sm uppercase text-slate-300 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" /> Active Slot ({activeSlot.name})
                </h3>
                <span className="text-xs font-bold text-slate-400">
                  {players.filter(p => p.category === activeSlot.name && p.status === "SOLD").length} / {players.filter(p => p.category === activeSlot.name).length} Sold
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {players
                  .filter((p) => isAcceleratedRound ? p.status === "UNSOLD" || (p.round === 2) : p.category === activeSlot.name)
                  .map((p) => (
                    <div
                      key={p.id}
                      className={`p-3 rounded-xl border text-xs transition ${
                        p.id === activePlayerId
                          ? "bg-amber-500/10 border-amber-400/50"
                          : p.status === "SOLD"
                          ? "bg-slate-950/60 border-emerald-500/30 opacity-70"
                          : p.status === "UNSOLD"
                          ? "bg-rose-950/30 border-rose-500/40"
                          : "bg-slate-950 border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-white truncate">{p.name}</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          p.isCaptain ? "bg-amber-400/20 text-amber-300" :
                          p.status === "SOLD" ? "bg-emerald-500/20 text-emerald-400" :
                          p.status === "UNSOLD" ? "bg-rose-500/20 text-rose-400" : "bg-slate-800 text-slate-400"
                        }`}>
                          {p.isCaptain ? "CAPTAIN" : p.status}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] flex items-center justify-between">
                        <span>{p.role}</span>
                        <span className="text-slate-500">{p.isCaptain ? "Pre-Allocated" : `₹${p.basePrice.toLocaleString("en-IN")}`}</span>
                      </div>
                      {p.status === "SOLD" && (
                        <div className="mt-1 text-[10px] font-bold text-emerald-400">
                          {p.isCaptain ? `Captain of ${p.soldTo}` : `₹${p.soldPrice?.toLocaleString("en-IN")} → ${p.soldTo}`}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          </>
        )}

      </main>

      {/* AUCTIONEER 5-TAB CONTROL CENTER */}
      {controlCenterOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-3xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setActiveTab("slots")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeTab === "slots" ? "bg-amber-500 text-slate-950 font-black shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Slots ({slots.length})
                </button>
                <button
                  onClick={() => setActiveTab("teams")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeTab === "teams" ? "bg-amber-500 text-slate-950 font-black shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Franchises ({teams.length})
                </button>
                <button
                  onClick={() => setActiveTab("players")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeTab === "players" ? "bg-amber-500 text-slate-950 font-black shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Players ({players.length})
                </button>
                <button
                  onClick={() => setActiveTab("bulk")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeTab === "bulk" ? "bg-amber-500 text-slate-950 font-black shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Bulk Import / CSV
                </button>
                <button
                  onClick={() => setActiveTab("rules")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeTab === "rules" ? "bg-amber-500 text-slate-950 font-black shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Budget Rules
                </button>
              </div>

              <button
                onClick={() => setControlCenterOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-3 py-1.5 bg-slate-800 rounded-lg"
              >
                Close
              </button>
            </div>

            {/* TAB 1: SLOTS */}
            {activeTab === "slots" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!newSlotName.trim()) return;
                  const newSlot = { id: "s_" + Date.now(), name: newSlotName.trim() };
                  const updatedSlots = [...slots, newSlot];
                  setSlots(updatedSlots);
                  syncToFirebase({ slots: updatedSlots });
                  setNewSlotName("");
                }} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 my-4 flex gap-2">
                  <input
                    type="text"
                    placeholder="New Slot Name (e.g. Marquee Batsmen, Spin Bowlers) *"
                    value={newSlotName}
                    onChange={(e) => setNewSlotName(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:border-amber-400 focus:outline-none"
                    required
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Add Slot
                  </button>
                </form>

                <div className="flex-1 overflow-y-auto pr-1">
                  <div className="space-y-2">
                    {slots.map((s, idx) => {
                      const count = players.filter((p) => p.category === s.name).length;
                      return (
                        <div key={s.id} className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center font-bold text-[10px] text-amber-400">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-white">{s.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                              {count} players assigned
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              const updated = slots.filter((slot) => slot.id !== s.id);
                              setSlots(updated);
                              syncToFirebase({ slots: updated });
                            }}
                            className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                            title="Remove Slot"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TEAMS */}
            {activeTab === "teams" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <form onSubmit={handleAddTeam} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 my-4 space-y-3">
                  <span className="text-[11px] font-extrabold uppercase text-amber-400 tracking-wider block">Add New Franchise</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Team Name (e.g. Veteran Royals) *"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:border-amber-400 focus:outline-none"
                      required
                    />
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="4-Digit Captain PIN *"
                      value={newTeamPin}
                      onChange={(e) => setNewTeamPin(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:border-amber-400 focus:outline-none font-mono"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Starting Purse (₹)</label>
                      <input
                        type="number"
                        step={50000}
                        value={newTeamPurse}
                        onChange={(e) => setNewTeamPurse(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2 focus:border-amber-400 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Accent Color</label>
                      <select
                        value={newTeamBorder}
                        onChange={(e) => setNewTeamBorder(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2 focus:border-amber-400 focus:outline-none"
                      >
                        <option value="border-cyan-500">Cyan</option>
                        <option value="border-purple-500">Purple</option>
                        <option value="border-pink-500">Pink</option>
                        <option value="border-lime-500">Lime</option>
                        <option value="border-orange-500">Orange</option>
                        <option value="border-yellow-500">Yellow</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Register Team
                  </button>
                </form>

                <div className="flex-1 overflow-y-auto pr-1">
                  <div className="space-y-2">
                    {teams.map((t) => (
                      <div key={t.id} className={`flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border ${t.border} text-xs`}>
                        <div>
                          <div className="font-extrabold text-white flex items-center gap-2">
                            {t.name}
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-amber-300">
                              PIN: {t.pin}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                            Purse: ₹{t.purse.toLocaleString("en-IN")} • Squad: {t.players ? t.players.length : 0} / {maxRosterSize}
                          </div>
                        </div>

                        <div>
                          {t.players && t.players.length > 0 ? (
                            <span className="text-[10px] text-slate-500 italic">Has Players</span>
                          ) : (
                            <button
                              onClick={() => handleRemoveTeam(t.id)}
                              className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                              title="Delete Team"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: PLAYERS */}
            {activeTab === "players" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <form onSubmit={handleAddPlayer} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 my-4 space-y-3">
                  <span className="text-[11px] font-extrabold uppercase text-amber-400 tracking-wider block">Add Player</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Player Name *"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:border-amber-400 focus:outline-none"
                      required
                    />
                    
                    <select
                      value={newPlayerCategory}
                      onChange={(e) => setNewPlayerCategory(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:border-amber-400 focus:outline-none"
                    >
                      {slots.map((s) => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="Role (e.g. Opener / Finisher)"
                      value={newPlayerRole}
                      onChange={(e) => setNewPlayerRole(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Base Price (₹)</label>
                      <input
                        type="number"
                        step={5000}
                        value={newPlayerBasePrice}
                        onChange={(e) => setNewPlayerBasePrice(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2 focus:border-amber-400 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Matches</label>
                      <input
                        type="number"
                        value={newPlayerMatches}
                        onChange={(e) => setNewPlayerMatches(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2 focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Runs</label>
                      <input
                        type="number"
                        placeholder="Optional"
                        value={newPlayerRuns}
                        onChange={(e) => setNewPlayerRuns(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2 focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Wickets</label>
                      <input
                        type="number"
                        placeholder="Optional"
                        value={newPlayerWickets}
                        onChange={(e) => setNewPlayerWickets(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2 focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Add Player To Pool
                  </button>
                </form>

                <div className="flex-1 overflow-y-auto pr-1">
                  <div className="space-y-2">
                    {players.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-[10px] text-amber-400">
                            {p.isCaptain ? "👑" : p.category.charAt(0)}
                          </span>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              {p.name}
                              {p.isCaptain && <span className="text-[9px] bg-amber-400/20 text-amber-300 font-bold px-1 rounded">Captain</span>}
                              {p.status === "SOLD" && !p.isCaptain && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-1 rounded">Sold ({p.soldTo})</span>}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              Slot: <b className="text-amber-400/90">{p.category}</b> • ₹{p.basePrice.toLocaleString("en-IN")} • {p.role}
                            </div>
                          </div>
                        </div>

                        <div>
                          {p.status === "SOLD" || p.isCaptain ? (
                            <span className="text-[10px] text-slate-500 font-semibold italic">Locked</span>
                          ) : (
                            <button
                              onClick={() => handleRemovePlayer(p.id)}
                              className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                              title="Remove Player"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: BULK CSV */}
            {activeTab === "bulk" && (
              <div className="flex-1 p-4 bg-slate-950 rounded-2xl border border-slate-800 my-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase text-amber-400">Paste CSV or Excel Rows</h4>
                    <p className="text-[11px] text-slate-400">Format: Name, Category Slot, Role, Base Price, Matches, Runs, Wickets</p>
                  </div>
                  <button
                    onClick={loadSampleCsv}
                    className="text-xs text-amber-400 hover:text-white underline font-semibold"
                  >
                    Load Sample CSV
                  </button>
                </div>

                <textarea
                  rows={8}
                  placeholder="Paste rows here:&#10;Sudhir Kumar,Pure Batsmen,Top-Order,40000,22,580,3&#10;Ajay Rout,All-Rounders,Pacer,50000,28,640,24"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs p-3 rounded-xl focus:border-amber-400 focus:outline-none"
                />

                <button
                  onClick={handleBulkCsvImport}
                  className="w-full py-3 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <FileUp className="w-4 h-4" /> Import All Players to Firebase
                </button>
              </div>
            )}

            {/* TAB 5: RULES */}
            {activeTab === "rules" && (
              <div className="flex-1 p-4 bg-slate-950 rounded-2xl border border-slate-800 my-4 space-y-5">
                <div>
                  <h4 className="text-sm font-extrabold text-white uppercase tracking-wider mb-1">
                    Global Tournament Rules
                  </h4>
                  <p className="text-xs text-slate-400">
                    Adjust squad limits and reserve minimums. These rules are enforced live across all devices.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Max Players Per Squad
                    </label>
                    <input
                      type="number"
                      min={4}
                      max={25}
                      value={maxRosterSize}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 11;
                        setMaxRosterSize(val);
                        syncToFirebase({ maxRosterSize: val });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 text-white font-mono font-bold text-sm rounded-xl p-2.5 focus:border-amber-400 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Default is 11 players per team</span>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Mandatory Reserve Price Per Slot (₹)
                    </label>
                    <input
                      type="number"
                      step={5000}
                      value={minSlotReservePrice}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 20000;
                        setMinSlotReservePrice(val);
                        syncToFirebase({ minSlotReservePrice: val });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 text-white font-mono font-bold text-sm rounded-xl p-2.5 focus:border-amber-400 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Teams cannot bid if remaining purse falls below (Unfilled Slots × This Amount).
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                  Safe max bid formula: <b>Safe Bid = Team Purse - (Remaining Slots to reach {maxRosterSize} × ₹{minSlotReservePrice.toLocaleString("en-IN")})</b>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Security PIN Entry Modal */}
      {pinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-white text-base">
                  {targetLoginRole === "auctioneer" ? "Auctioneer Access" : "Captain Authentication"}
                </h3>
                <p className="text-xs text-slate-400">Enter security PIN to continue</p>
              </div>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              {targetLoginRole === "captain" && (
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Select Your Team
                  </label>
                  <select
                    value={selectedTeamForLogin}
                    onChange={(e) => setSelectedTeamForLogin(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white font-bold text-xs rounded-xl p-2.5 focus:border-amber-400 focus:outline-none"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  4-Digit Security PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  autoFocus
                  placeholder="••••"
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-center tracking-[0.5em] text-xl font-mono text-amber-400 font-black rounded-xl p-3 focus:border-amber-400 focus:outline-none"
                />
                {pinError && <p className="text-xs text-rose-400 font-semibold mt-1.5">{pinError}</p>}
                <div className="text-[11px] text-slate-500 mt-2">
                  {targetLoginRole === "auctioneer" ? "Default Auctioneer PIN: 9999" : "Enter your designated team PIN"}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPinModalOpen(false)}
                  className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 transition"
                >
                  Unlock Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}