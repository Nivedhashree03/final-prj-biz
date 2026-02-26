import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Rewind, Play, Pause, SkipBack, SkipForward, ArrowLeft, Trash2, Edit3,
    TrendingUp, TrendingDown, Minus, AlertCircle, Sparkles, BarChart3
} from 'lucide-react';
import {
    reconstructStateAtDate,
    calculateWhatIf_RemoveTransaction,
    calculateWhatIf_ModifyAmount,
    generateTimelineSnapshots,
    identifyKeyDecisions,
    calculateTrajectory
} from '../utils/timelineEngine';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

const FinancialReplay = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState([]);
    const [snapshots, setSnapshots] = useState([]);
    const [currentSnapshotIndex, setCurrentSnapshotIndex] = useState(0);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [whatIfScenario, setWhatIfScenario] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [keyDecisions, setKeyDecisions] = useState([]);

    useEffect(() => {
        if (!currentUser) return;

        const fetchData = async () => {
            try {
                const token = localStorage.getItem('finance_token');
                const response = await fetch('http://localhost:5000/api/transactions', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const txns = await response.json();
                    setTransactions(txns);

                    // Generate snapshots
                    const snaps = generateTimelineSnapshots(txns, 'monthly');
                    setSnapshots(snaps);
                    setCurrentSnapshotIndex(snaps.length - 1); // Start at latest

                    // Identify key decisions
                    const decisions = identifyKeyDecisions(txns);
                    setKeyDecisions(decisions);
                }
            } catch (err) {
                console.error("Failed to fetch replay data:", err);
            }
        };
        fetchData();
    }, [currentUser]);

    // Auto-play timeline
    useEffect(() => {
        if (!isPlaying) return;

        const interval = setInterval(() => {
            setCurrentSnapshotIndex(prev => {
                if (prev >= snapshots.length - 1) {
                    setIsPlaying(false);
                    return prev;
                }
                return prev + 1;
            });
        }, 1500);

        return () => clearInterval(interval);
    }, [isPlaying, snapshots.length]);

    const currentSnapshot = snapshots[currentSnapshotIndex] || {
        balance: 0,
        income: 0,
        expenses: 0,
        transactionCount: 0,
        label: 'No Data'
    };

    const handleRemoveTransaction = (transactionId) => {
        const scenario = calculateWhatIf_RemoveTransaction(transactions, transactionId);
        setWhatIfScenario(scenario);
    };

    const handleModifyTransaction = (transactionId, newAmount) => {
        const scenario = calculateWhatIf_ModifyAmount(transactions, transactionId, newAmount);
        setWhatIfScenario(scenario);
    };

    const trajectory = calculateTrajectory(snapshots);

    // Prepare chart data for comparison
    const comparisonChartData = snapshots.map((snap, index) => ({
        name: snap.label,
        actual: snap.balance,
        whatIf: whatIfScenario && index <= currentSnapshotIndex
            ? snap.balance + (whatIfScenario.difference.balance || 0)
            : null
    }));

    if (transactions.length === 0) {
        return (
            <div className="page-container flex items-center justify-center min-h-screen">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center max-w-md"
                >
                    <Rewind size={64} className="text-primary mx-auto mb-6 opacity-50" />
                    <h2 className="text-3xl font-bold mb-4">No Financial History Yet</h2>
                    <p className="text-text-muted mb-8">
                        Start adding transactions to unlock the Financial Memory Replay feature.
                        You'll be able to travel back in time and explore "what-if" scenarios.
                    </p>
                    <button onClick={() => navigate('/transaction')} className="btn-primary">
                        Add Your First Transaction
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="page-container pb-20">
            {/* Header */}
            <header className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/dashboard')} className="btn-outline p-2">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <Rewind className="text-primary" size={32} />
                            Financial Memory Replay
                        </h1>
                        <p className="text-text-muted">Travel through your financial history</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-text-muted">Trajectory:</span>
                    <span className={`font-bold flex items-center gap-1 ${trajectory.trend === 'improving' ? 'text-green-400' :
                        trajectory.trend === 'declining' ? 'text-red-400' : 'text-yellow-400'
                        }`}>
                        {trajectory.trend === 'improving' && <TrendingUp size={16} />}
                        {trajectory.trend === 'declining' && <TrendingDown size={16} />}
                        {trajectory.trend === 'stable' && <Minus size={16} />}
                        {trajectory.trend.toUpperCase()}
                    </span>
                </div>
            </header>

            {/* Timeline Controls */}
            <div className="glass-panel p-6 mb-6">
                <div className="flex items-center gap-4 mb-4">
                    <button
                        onClick={() => setCurrentSnapshotIndex(Math.max(0, currentSnapshotIndex - 1))}
                        className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition"
                        disabled={currentSnapshotIndex === 0}
                    >
                        <SkipBack size={20} />
                    </button>
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="p-3 bg-primary text-black rounded-lg hover:bg-primary/80 transition"
                    >
                        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                    </button>
                    <button
                        onClick={() => setCurrentSnapshotIndex(Math.min(snapshots.length - 1, currentSnapshotIndex + 1))}
                        className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition"
                        disabled={currentSnapshotIndex === snapshots.length - 1}
                    >
                        <SkipForward size={20} />
                    </button>
                    <div className="flex-1">
                        <input
                            type="range"
                            min="0"
                            max={snapshots.length - 1}
                            value={currentSnapshotIndex}
                            onChange={(e) => setCurrentSnapshotIndex(parseInt(e.target.value))}
                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                            style={{
                                background: `linear-gradient(to right, #00f0ff ${(currentSnapshotIndex / (snapshots.length - 1)) * 100}%, rgba(255,255,255,0.1) ${(currentSnapshotIndex / (snapshots.length - 1)) * 100}%)`
                            }}
                        />
                    </div>
                    <span className="text-sm font-bold text-primary min-w-[100px] text-right">
                        {currentSnapshot.label}
                    </span>
                </div>
                <div className="flex gap-2 text-xs text-text-muted">
                    {snapshots.map((snap, index) => (
                        <div
                            key={index}
                            className={`flex-1 h-1 rounded-full transition-all ${index <= currentSnapshotIndex ? 'bg-primary' : 'bg-white/10'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Financial Snapshot Card */}
                <motion.div
                    key={currentSnapshotIndex}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-panel p-6 lg:col-span-2"
                >
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <BarChart3 className="text-primary" size={24} />
                        Financial Snapshot
                    </h3>
                    <div className="grid grid-cols-3 gap-6 mb-8">
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                            <p className="text-text-muted text-sm mb-2">Balance</p>
                            <p className="text-3xl font-black text-primary">
                                ₹{currentSnapshot.balance?.toLocaleString('en-IN') || 0}
                            </p>
                        </div>
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                            <p className="text-text-muted text-sm mb-2">Income</p>
                            <p className="text-3xl font-black text-green-400">
                                ₹{currentSnapshot.income?.toLocaleString('en-IN') || 0}
                            </p>
                        </div>
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                            <p className="text-text-muted text-sm mb-2">Expenses</p>
                            <p className="text-3xl font-black text-red-400">
                                ₹{currentSnapshot.expenses?.toLocaleString('en-IN') || 0}
                            </p>
                        </div>
                    </div>

                    {/* Trajectory Chart */}
                    <div style={{ height: '250px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={comparisonChartData}>
                                <defs>
                                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#00f0ff" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorWhatIf" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#7000ff" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#7000ff" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="name" stroke="#666" tick={{ fill: '#888', fontSize: 12 }} />
                                <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f0f1a', border: '1px solid #333', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="actual" stroke="#00f0ff" strokeWidth={2} fillOpacity={1} fill="url(#colorActual)" />
                                {whatIfScenario && (
                                    <Area type="monotone" dataKey="whatIf" stroke="#7000ff" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorWhatIf)" />
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Key Decisions Panel */}
                <div className="glass-panel p-6">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Sparkles className="text-secondary" size={24} />
                        Key Decisions
                    </h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {keyDecisions.slice(0, 5).map((decision) => (
                            <div
                                key={decision.id}
                                className="bg-white/5 p-4 rounded-xl border border-white/10 hover:border-primary/50 transition cursor-pointer"
                                onClick={() => setSelectedTransaction(decision)}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-sm font-bold">{decision.category}</span>
                                    <span className="text-xs text-primary">+{decision.impactPercentage}%</span>
                                </div>
                                <p className="text-2xl font-black text-primary mb-1">
                                    ₹{parseFloat(decision.amount).toLocaleString('en-IN')}
                                </p>
                                <p className="text-xs text-text-muted">{decision.description || 'No description'}</p>
                            </div>
                        ))}
                        {keyDecisions.length === 0 && (
                            <p className="text-text-muted text-sm text-center py-8">
                                No major decisions detected yet
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* What-If Scenario Builder */}
            <AnimatePresence>
                {selectedTransaction && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="glass-panel p-6 mb-6 border-2 border-secondary"
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                    <AlertCircle className="text-secondary" size={24} />
                                    What-If Scenario Builder
                                </h3>
                                <p className="text-text-muted text-sm">
                                    Exploring: {selectedTransaction.category} - ₹{parseFloat(selectedTransaction.amount).toLocaleString('en-IN')}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedTransaction(null);
                                    setWhatIfScenario(null);
                                }}
                                className="text-text-muted hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => handleRemoveTransaction(selectedTransaction.id)}
                                className="btn-outline flex items-center gap-2"
                            >
                                <Trash2 size={16} />
                                Remove This Transaction
                            </button>
                            <button
                                onClick={() => {
                                    const newAmount = prompt('Enter new amount:', selectedTransaction.amount);
                                    if (newAmount) handleModifyTransaction(selectedTransaction.id, parseFloat(newAmount));
                                }}
                                className="btn-outline flex items-center gap-2"
                            >
                                <Edit3 size={16} />
                                Modify Amount
                            </button>
                        </div>

                        {/* Comparison Results */}
                        {whatIfScenario && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="mt-6 grid grid-cols-3 gap-4"
                            >
                                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                    <p className="text-text-muted text-xs mb-2">Balance Difference</p>
                                    <p className={`text-2xl font-black ${whatIfScenario.difference.balance > 0 ? 'text-green-400' : 'text-red-400'
                                        }`}>
                                        {whatIfScenario.difference.balance > 0 ? '+' : ''}
                                        ₹{Math.abs(whatIfScenario.difference.balance).toLocaleString('en-IN')}
                                    </p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                    <p className="text-text-muted text-xs mb-2">Actual Balance</p>
                                    <p className="text-2xl font-black text-primary">
                                        ₹{whatIfScenario.actual.balance.toLocaleString('en-IN')}
                                    </p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                    <p className="text-text-muted text-xs mb-2">Alternative Balance</p>
                                    <p className="text-2xl font-black text-secondary">
                                        ₹{whatIfScenario.alternative.balance.toLocaleString('en-IN')}
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Transactions at Current Time */}
            <div className="glass-panel p-6">
                <h3 className="text-xl font-bold mb-4">
                    Transactions at {currentSnapshot.label}
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {currentSnapshot.transactions?.slice(0, 10).map((txn) => (
                        <div
                            key={txn.id}
                            className="flex justify-between items-center p-3 bg-white/5 rounded-lg hover:bg-white/10 transition"
                        >
                            <div>
                                <p className="font-bold">{txn.category}</p>
                                <p className="text-xs text-text-muted">{txn.description || 'No description'}</p>
                            </div>
                            <div className="text-right">
                                <p className={`text-lg font-black ${txn.type === 'Income' || txn.type === 'income' ? 'text-green-400' : 'text-primary'
                                    }`}>
                                    ₹{parseFloat(txn.amount).toLocaleString('en-IN')}
                                </p>
                                <p className="text-xs text-text-muted">{txn.type}</p>
                            </div>
                        </div>
                    ))}
                    {(!currentSnapshot.transactions || currentSnapshot.transactions.length === 0) && (
                        <p className="text-text-muted text-center py-8">No transactions at this point</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FinancialReplay;
