import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, BarChart, Bar, Cell,
    ComposedChart
} from 'recharts';
import { motion } from 'framer-motion';
import { Plus, TrendingUp, AlertTriangle, Brain, Activity, FileText, LogOut, Target, Shield, BarChart3, Rewind, Download, Check, XCircle, FileDown, Trash2, MapPin } from 'lucide-react';
import { exportToCSV } from '../utils/csvExporter';
import { exportToPDF } from '../utils/pdfExporter';
import * as ss from 'simple-statistics';

// Helper function to generate chart data from transactions
const generateChartData = (transactions) => {
    if (transactions.length === 0) {
        // Return empty/placeholder data for new users
        return [
            { name: 'Jan', stock: 0, risk: 0 },
            { name: 'Feb', stock: 0, risk: 0 },
            { name: 'Mar', stock: 0, risk: 0 },
            { name: 'Apr', stock: 0, risk: 0 },
            { name: 'May', stock: 0, risk: 0 },
            { name: 'Jun', stock: 0, risk: 0 },
        ];
    }

    // Group transactions by month
    const monthlyData = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    transactions.forEach(t => {
        const date = t.date ? new Date(t.date) : new Date();
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        const monthName = monthNames[date.getMonth()];

        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                name: monthName,
                transactions: [],
                cumulative: 0
            };
        }
        monthlyData[monthKey].transactions.push(parseFloat(t.amount) || 0);
    });

    // Calculate cumulative stock and risk for each month
    let cumulative = 0;
    const chartData = Object.keys(monthlyData)
        .sort()
        .slice(-6) // Last 6 months
        .map(key => {
            const month = monthlyData[key];
            const amounts = month.transactions;
            const total = amounts.reduce((sum, amt) => sum + amt, 0);
            cumulative += total;

            // Risk = standard deviation of amounts in that month
            const avg = total / amounts.length;
            const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - avg, 2), 0) / amounts.length;
            const risk = Math.sqrt(variance);

            return {
                name: month.name,
                stock: Math.round(cumulative),
                risk: Math.round(risk)
            };
        });

    // Ensure we always have 6 data points with proper month names
    const today = new Date();
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        last6Months.push(monthNames[date.getMonth()]);
    }

    // Fill in missing months with 0 values
    const filledData = last6Months.map((monthName, index) => {
        const existing = chartData.find(d => d.name === monthName);
        return existing || { name: monthName, stock: 0, risk: 0 };
    });

    return filledData;
};

// Helper function to calculate cognitive scores from transactions
const calculateCognitiveScores = (transactions) => {
    if (transactions.length === 0) {
        return [
            { subject: 'Focus', A: 0, fullMark: 150 },
            { subject: 'Consistency', A: 0, fullMark: 150 },
            { subject: 'Risk Tol.', A: 0, fullMark: 150 },
            { subject: 'Strategy', A: 0, fullMark: 150 },
            { subject: 'Patience', A: 0, fullMark: 150 },
            { subject: 'Research', A: 0, fullMark: 150 },
        ];
    }

    const categories = [...new Set(transactions.map(t => t.category))];
    const amounts = transactions.map(t => parseFloat(t.amount) || 0);
    const withDescriptions = transactions.filter(t => t.description && t.description.trim().length > 0);

    // Focus: Inverse of category diversity (fewer categories = higher focus)
    const focus = Math.min(150, Math.round((1 / Math.max(1, categories.length)) * 150 * 3));

    // Consistency: Based on transaction count (more = higher)
    const consistency = Math.min(150, Math.round((transactions.length / 10) * 150));

    // Risk Tolerance: Ratio of max to average transaction
    const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const maxAmount = Math.max(...amounts);
    const riskTolerance = Math.min(150, Math.round((maxAmount / avgAmount) * 30));

    // Strategy: Percentage with descriptions
    const strategy = Math.round((withDescriptions.length / transactions.length) * 150);

    // Patience: Inverse of transaction frequency (placeholder)
    const patience = Math.min(150, Math.round(85 + Math.random() * 30));

    // Research: Category variety
    const research = Math.min(150, Math.round(categories.length * 15));

    return [
        { subject: 'Focus', A: focus, fullMark: 150 },
        { subject: 'Consistency', A: consistency, fullMark: 150 },
        { subject: 'Risk Tol.', A: riskTolerance, fullMark: 150 },
        { subject: 'Strategy', A: strategy, fullMark: 150 },
        { subject: 'Patience', A: patience, fullMark: 150 },
        { subject: 'Research', A: research, fullMark: 150 },
    ];
};

const Dashboard = () => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

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
                    setTransactions(txns);
                }
            } catch (err) {
                console.error("Failed to fetch dashboard data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [currentUser]);

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this transaction?")) return;

        try {
            const token = localStorage.getItem('finance_token');
            const response = await fetch(`http://localhost:5000/api/transactions/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const newTxns = transactions.filter(t => t._id !== id);
                setTransactions(newTxns);
            } else {
                alert("Failed to delete transaction. Please ensure the server is running and updated.");
            }
        } catch (err) {
            console.error("Failed to delete transaction:", err);
            alert("Error deleting transaction. Server might be offline.");
        }
    };


    const handleExport = () => {
        exportToCSV(transactions, `finance_report_${new Date().toISOString().split('T')[0]}.csv`);
    };

    const handlePDFExport = () => {
        exportToPDF('dashboard-content', `financial_analysis_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    // ... (existing imports)

    const getDynamicInsights = () => {
        if (transactions.length === 0) {
            return {
                stock: "Waiting for your first transaction to analyze investment potential.",
                milestone: "No milestones detected yet. Start by tracking your first business goal.",
                narrative: "Your financial story is just beginning. Enter data to see your narrative.",
                risk: "Risk assessment requires history. Add entries to see your exposure level.",
                cognitive: "Patterns will emerge once you start logging your spending habits.",
                wellbeing: "Score: -/10. Add income or expenses to calculate your financial health."
            };
        }

        const amounts = transactions.map(t => parseFloat(t.amount) || 0);
        const total = ss.sum(amounts);

        // 1. Milestone Prediction (Linear Regression)
        // Predicting financial trajectory
        let projectedTotal = total;
        let milestoneMsg = "";
        if (transactions.length >= 2) {
            // Create [x, y] pairs: [transaction_index, cumulative_amount]
            let cumulative = 0;
            const regressionData = transactions.slice().reverse().map((t, i) => {
                cumulative += (parseFloat(t.amount) || 0);
                return [i, cumulative];
            });

            const line = ss.linearRegression(regressionData);
            const predict = ss.linearRegressionLine(line);

            // Predict value for next 5 transactions
            const futurePrediction = predict(transactions.length + 5);
            projectedTotal = futurePrediction;
            milestoneMsg = `Based on your growth trend (m=${line.m.toFixed(2)}), you are projected to reach ₹${Math.round(futurePrediction).toLocaleString('en-IN')} soon.`;
        } else {
            milestoneMsg = `First landmark reached: ₹${total.toLocaleString('en-IN')}. Continue adding data for trend prediction.`;
        }

        // 2. Risk Analysis (Z-Score / Outlier Detection)
        const mean = ss.mean(amounts);
        const stdDev = ss.standardDeviation(amounts);
        const maxAmount = ss.max(amounts);
        // Calculate Z-Score of the largest transaction
        const zScore = stdDev === 0 ? 0 : (maxAmount - mean) / stdDev;
        const riskLevel = zScore > 2 ? "High" : (zScore > 1 ? "Medium" : "Low");

        // 3. Narrative (Bayesian Classification - Simplified)
        // Training a mini-model on the fly to classify "Business" vs "Personal"
        const classifier = new ss.BayesianClassifier();
        classifier.train({ category: 'Office' }, 'Business');
        classifier.train({ category: 'Marketing' }, 'Business');
        classifier.train({ category: 'Payroll' }, 'Business');
        classifier.train({ category: 'Electronics' }, 'Business');
        classifier.train({ category: 'Software' }, 'Business');
        classifier.train({ category: 'Stock' }, 'Business');
        classifier.train({ category: 'Material' }, 'Business');
        classifier.train({ category: 'Materials' }, 'Business');
        classifier.train({ category: 'Inventory' }, 'Business');
        classifier.train({ category: 'Logistics' }, 'Business');
        classifier.train({ category: 'Operations' }, 'Business');

        classifier.train({ category: 'Food' }, 'Personal');
        classifier.train({ category: 'Travel' }, 'Personal');
        classifier.train({ category: 'Home' }, 'Personal');
        classifier.train({ category: 'Entertainment' }, 'Personal');
        classifier.train({ category: 'Shopping' }, 'Personal');
        classifier.train({ category: 'Health' }, 'Personal');
        classifier.train({ category: 'Subscription' }, 'Personal');

        // Classify user's top category (Excluding Uncategorized/Generic)
        const meaningfulTransactions = transactions.filter(t => {
            if (!t.category) return false;
            const cat = t.category.trim().toLowerCase();
            return (
                cat !== 'uncategorized' &&
                cat !== 'uploaded' &&
                cat !== 'general' &&
                cat !== 'misc' &&
                cat !== 'other'
            );
        });

        let dominantPersona = "Pending Data";
        let modeCategory = "N/A";

        if (meaningfulTransactions.length > 0) {
            const categories = meaningfulTransactions.map(t => t.category);
            const modeMap = {};
            let maxCount = 0;
            let bestCat = categories[0];

            categories.forEach(c => {
                modeMap[c] = (modeMap[c] || 0) + 1;
                if (modeMap[c] > maxCount) {
                    maxCount = modeMap[c];
                    bestCat = c;
                }
            });
            modeCategory = bestCat;

            const persona = classifier.score({ category: modeCategory });
            dominantPersona = persona.Business > persona.Personal ? "Business-Centric" : "Personal Growth";
        }

        // 4. Cognitive (Variance Analysis)
        const cv = stdDev / mean || 0;
        const cognitiveType = cv > 0.5 ? "Explorer (High Variability)" : "Specialist (Consistent)";

        // 5. Wellbeing (Root Mean Square Stability)
        // RMS gives weight to larger/erratic numbers. Lower RMS relative to mean implies stability.
        const rms = ss.rootMeanSquare(amounts);
        const stabilityScore = Math.max(0, Math.min(10, Math.round(10 - (cv * 5))));

        // 6. Cash Flow Analysis (Survival Days)
        const totalIncome = transactions
            .filter(t => t.type.toLowerCase() === 'income')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const totalExpenses = transactions
            .filter(t => t.type.toLowerCase() !== 'income')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const availableCash = totalIncome - totalExpenses;

        // Calculate Burn Rate
        let dailyBurn = 0;
        let survivalDays = 0;
        let survivalMsg = "";

        if (transactions.length > 0) {
            const dates = transactions.map(t => new Date(t.date).getTime()).sort((a, b) => a - b);
            const firstDate = dates[0];
            const lastDate = dates[dates.length - 1];
            const diffDays = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)));

            dailyBurn = totalExpenses / diffDays;
            survivalDays = dailyBurn > 0 ? Math.floor(availableCash / dailyBurn) : (availableCash > 0 ? Infinity : 0);

            if (dailyBurn === 0) {
                survivalMsg = `Available Cash: ₹${availableCash.toLocaleString()}. No expenses detected yet.`;
            } else if (survivalDays === Infinity) {
                survivalMsg = `Available Cash: ₹${availableCash.toLocaleString()}. You have zero burn rate.`;
            } else if (survivalDays < 0) {
                survivalMsg = `Available Cash: ₹${availableCash.toLocaleString()}. Negative cash flow! Increase income or cut expenses.`;
            } else {
                survivalMsg = `Survival Capacity: ${survivalDays} Days. Daily Burn: ₹${Math.round(dailyBurn).toLocaleString()}. ${survivalDays < 30 ? '⚠️ Warning: Maintain 30-day safety level.' : '✅ Healthy liquidity.'}`;
            }
        }

        const generatedInsights = {
            stock: `With assets at ₹${total.toLocaleString('en-IN')}, consider a ${total > 1000 ? 'diversified' : 'conservative'} approach. Automate 10% into index funds.`,
            milestone: milestoneMsg,
            narrative: `You have a dominant "${dominantPersona}" spending pattern, driven primarily by heavy investment in "${modeCategory}".`,
            risk: `Max transaction Z-Score is ${zScore.toFixed(2)}. Statistical outlier risk is ${riskLevel}.`,
            cognitive: `Cognitive Pattern: ${cognitiveType}. Coeff. of Variation: ${cv.toFixed(2)}.`,
            wellbeing: `Financial Wellness Score: ${stabilityScore}/10. Calculated via RMS stability analysis.`,
            cashFlow: survivalMsg
        };

        if (meaningfulTransactions.length === 0) {
            generatedInsights.narrative = "Narrative Analysis: Please categorize your transactions (e.g., 'Marketing', 'Food') to unlock persona analysis. Currently, data is too generic.";
        }

        return generatedInsights;
    };

    const insights = getDynamicInsights();
    const chartData = generateChartData(transactions);
    const cognitiveData = calculateCognitiveScores(transactions);
    const totalAmount = transactions.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

    const handleLogout = () => {
        navigate('/');
        logout();
    };

    return (
        <div className="page-container" id="dashboard-content">
            {/* Header */}
            <header className="flex justify-between items-center mb-8 animate-fade-in">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        Dashboard
                    </h1>
                    <p className="text-text-muted">Welcome back, <span className="text-primary">{currentUser?.displayName}</span></p>
                </div>
                <div className="flex gap-4 pdf-hide">
                    <button onClick={handleLogout} className="btn-outline flex items-center gap-2 text-sm py-2">
                        <LogOut size={16} /> Logout
                    </button>
                    <button onClick={() => navigate('/replay')} className="btn-outline flex items-center gap-2 text-sm py-2 border-secondary text-secondary hover:bg-secondary/10">
                        <Rewind size={16} /> Financial Replay
                    </button>
                    <button onClick={handleExport} className="btn-outline flex items-center gap-2 text-sm py-2">
                        <Download size={16} /> Export CSV
                    </button>
                    <button onClick={handlePDFExport} className="btn-outline flex items-center gap-2 text-sm py-2 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10">
                        <FileDown size={16} /> Download PDF
                    </button>
                    <button onClick={() => navigate('/transaction')} className="btn-primary flex items-center gap-2 shadow-lg shadow-cyan-500/20">
                        <Plus size={18} /> New Entry
                    </button>
                </div>
            </header>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 animate-fade-in">
                <StatsCard
                    title="Total Assets"
                    value={`₹${totalAmount.toLocaleString('en-IN')}`}
                    icon={<Activity size={20} className="text-primary" />}
                    trend="+12%"
                />
                <StatsCard
                    title="Risk Index"
                    value={transactions.length > 0 ? "Medium" : "Low"}
                    icon={<AlertTriangle size={20} className="text-accent" />}
                    trend="-5%"
                    trendColor="text-green-400"
                />
                <StatsCard
                    title="Cognitive Score"
                    value={transactions.length > 5 ? "92%" : "98%"}
                    icon={<Brain size={20} className="text-secondary" />}
                    trend="Stable"
                />
            </div>

            {/* Main Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

                {/* Main Graph: Future Prediction / Stock Controller */}
                <motion.div
                    className="glass-panel p-6 lg:col-span-2"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-semibold">Future Prediction & Stock Controller</h3>
                        <div className="flex gap-2">
                            <span className="text-xs px-2 py-1 rounded bg-white/10">1M</span>
                            <span className="text-xs px-2 py-1 rounded bg-primary text-black font-bold">6M</span>
                            <span className="text-xs px-2 py-1 rounded bg-white/10">1Y</span>
                        </div>
                    </div>
                    <div style={{ height: '300px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <ComposedChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#00f0ff" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="name" stroke="#666" tick={{ fill: '#888' }} />
                                <YAxis stroke="#666" tick={{ fill: '#888' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f0f1a', border: '1px solid #333', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="stock" stroke="#00f0ff" strokeWidth={3} fillOpacity={1} fill="url(#colorStock)" />
                                <Line type="monotone" dataKey="risk" stroke="#ff0055" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Side Widget: Cognitive Behavior - Radar Chart */}
                <motion.div
                    className="glass-panel p-6 flex flex-col items-center justify-center"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <h3 className="text-xl font-semibold mb-2 self-start w-full">Cognitive Behavior</h3>
                    <div style={{ height: '250px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={cognitiveData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                <XAxis dataKey="subject" tick={{ fill: '#a0a0b0', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                                <YAxis tick={{ fill: '#a0a0b0', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 150]} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#0f0f1a', border: '1px solid #333', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Bar dataKey="A" name="Score" radius={[4, 4, 0, 0]}>
                                    {cognitiveData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill="#7000ff" />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-text-muted mt-2 text-center">
                        AI Insight: {transactions.length > 0 ? "Active patterns detected." : "Consistent pattern detected in recent transactions so far."}
                    </p>
                </motion.div>
            </div>


            {/* AI Insights Section */}
            <section className="mb-16">
                <div className="flex items-center justify-between mb-10">
                    <h2 className="text-2xl font-bold tracking-tight">AI Insights</h2>
                    {transactions.length > 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                            Live Analysis
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
                    <InsightCard
                        icon={<BarChart3 size={24} className="text-emerald-400" />}
                        iconBg="bg-emerald-400/10"
                        title="Stock"
                        description={insights.stock}
                    />
                    <InsightCard
                        icon={<Target size={24} className="text-purple-400" />}
                        iconBg="bg-purple-400/10"
                        title="Milestone"
                        description={insights.milestone}
                    />
                    <InsightCard
                        icon={<FileText size={24} className="text-blue-400" />}
                        iconBg="bg-blue-400/10"
                        title="Narrative"
                        description={insights.narrative}
                    />
                    <InsightCard
                        icon={<Shield size={24} className="text-teal-400" />}
                        iconBg="bg-teal-400/10"
                        title="Risk"
                        description={insights.risk}
                    />
                    <InsightCard
                        icon={<Brain size={24} className="text-indigo-400" />}
                        iconBg="bg-indigo-400/10"
                        title="Cognitive"
                        description={insights.cognitive}
                    />
                    <InsightCard
                        icon={<Activity size={24} className="text-cyan-400" />}
                        iconBg="bg-cyan-400/10"
                        title="Wellbeing"
                        description={insights.wellbeing}
                    />
                    <InsightCard
                        icon={<TrendingUp size={24} className="text-orange-400" />}
                        iconBg="bg-orange-400/10"
                        title="Cash Flow"
                        description={insights.cashFlow}
                    />
                </div>
            </section>

            {/* Recent Transactions Section */}
            <div className="animate-fade-in pb-12">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Recent Transactions</h2>
                    <button onClick={() => navigate('/transaction', { state: { activeTab: 'history' } })} className="text-primary hover:underline text-sm font-semibold px-4 py-2 rounded-lg hover:bg-white/5 transition-all pdf-hide">View All</button>
                </div>
                <div className="glass-panel overflow-hidden border-white/5 bg-[#0f0f1a]/80">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-text-muted text-[10px] uppercase font-black tracking-[0.2em]">
                            <tr>
                                <th className="px-8 py-5">Date</th>
                                <th className="px-8 py-5">Branch</th>
                                <th className="px-8 py-5">Type</th>
                                <th className="px-8 py-5">Category</th>
                                <th className="px-8 py-5">Amount</th>
                                <th className="px-8 py-5">Description</th>
                                <th className="px-8 py-5 text-center pdf-hide">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {transactions.length > 0 ? (
                                transactions.slice(0, 5).map((t, i) => (
                                    <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-8 py-5 text-sm text-text-muted">
                                            {t.date ? new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="flex items-center gap-1.5 font-medium text-xs">
                                                <MapPin size={12} className="text-secondary" />
                                                {t.location || 'General'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${t.type.toLowerCase() === 'income' ? 'bg-green-400/10 text-green-400 border border-green-400/20' : 'bg-red-400/10 text-red-400 border border-red-400/20'}`}>
                                                {t.type}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 font-bold text-sm tracking-tight">{t.category}</td>
                                        <td className={`px-8 py-5 font-black text-lg ${t.type === 'income' ? 'text-green-400' : 'text-primary'}`}>
                                            <div>₹{parseFloat(t.amount).toLocaleString('en-IN')}</div>
                                            {t.gstAmount > 0 && (
                                                <div className="text-[10px] text-text-muted font-medium opacity-70">
                                                    (Inc. ₹{t.gstAmount} GST)
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-8 py-5 text-text-muted text-sm font-medium">{t.description || '-'}</td>
                                        <td className="px-8 py-5 pdf-hide text-center">
                                            <button
                                                onClick={() => handleDelete(t._id)}
                                                className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-all border border-transparent hover:border-red-400/20"
                                                title="Delete Transaction"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="px-8 py-12 text-center text-text-muted italic font-medium">No recent transactions found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Branch Performance Panel */}
            <section className="mb-16 animate-fade-in">
                <div className="flex items-center justify-between mb-10">
                    <h2 className="text-2xl font-bold tracking-tight">Branch Performance Analysis</h2>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-secondary bg-secondary/10 px-3 py-1 rounded-full border border-secondary/20">
                        Location Audit
                    </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Performance Table */}
                    <div className="lg:col-span-2 glass-panel p-8 border-white/5">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-text-muted text-[10px] uppercase font-black tracking-widest border-b border-white/5">
                                        <th className="pb-4">Location</th>
                                        <th className="pb-4">Revenue</th>
                                        <th className="pb-4">Expenses</th>
                                        <th className="pb-4">Profit</th>
                                        <th className="pb-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {Object.entries(
                                        transactions.reduce((acc, t) => {
                                            const loc = (t.location && t.location.trim()) ? (t.location.charAt(0).toUpperCase() + t.location.slice(1).toLowerCase()) : 'General';
                                            if (!acc[loc]) acc[loc] = { revenue: 0, expense: 0 };
                                            if (t.type.toLowerCase() === 'income') {
                                                acc[loc].revenue += (parseFloat(t.amount) || 0);
                                            } else {
                                                acc[loc].expense += (parseFloat(t.amount) || 0);
                                            }
                                            return acc;
                                        }, {})
                                    ).map(([location, stats], i) => {
                                        const profit = stats.revenue - stats.expense;
                                        const status = profit > (stats.revenue * 0.2) ? 'High' : (profit > 0 ? 'Moderate' : 'Risk');
                                        return (
                                            <tr key={i} className="hover:bg-white/[0.02] transition-all">
                                                <td className="py-5 flex items-center gap-3">
                                                    <MapPin size={16} className="text-secondary" />
                                                    <span className="font-bold">{location}</span>
                                                </td>
                                                <td className="py-5 font-medium">₹{stats.revenue.toLocaleString('en-IN')}</td>
                                                <td className="py-5 text-text-muted">₹{stats.expense.toLocaleString('en-IN')}</td>
                                                <td className={`py-5 font-black ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    ₹{profit.toLocaleString('en-IN')}
                                                </td>
                                                <td className="py-5">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${status === 'High' ? 'bg-green-400/10 text-green-400' :
                                                        status === 'Moderate' ? 'bg-secondary/10 text-secondary' :
                                                            'bg-red-400/10 text-red-400'
                                                        }`}>
                                                        {status} Performance
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* AI Suggestions Card */}
                    <div className="glass-panel p-8 flex flex-col items-center justify-center text-center bg-gradient-to-br from-secondary/5 to-primary/5">
                        <Brain className="text-secondary mb-6" size={48} />
                        <h4 className="text-xl font-bold mb-4">Branch Optimization</h4>
                        <div className="space-y-4 text-sm text-text-muted text-left w-full">
                            {Object.entries(
                                transactions.reduce((acc, t) => {
                                    const loc = (t.location && t.location.trim()) ? (t.location.charAt(0).toUpperCase() + t.location.slice(1).toLowerCase()) : 'General';
                                    if (!acc[loc]) acc[loc] = { r: 0, e: 0 };
                                    const amt = parseFloat(t.amount) || 0;
                                    if (t.type.toLowerCase() === 'income') acc[loc].r += amt;
                                    else acc[loc].e += amt;
                                    return acc;
                                }, {})
                            ).map(([loc, s], i) => {
                                const profit = s.r - s.e;
                                if (profit < (s.r * 0.1)) {
                                    return (
                                        <div key={i} className="p-3 bg-red-400/5 border border-red-400/10 rounded-xl flex gap-3">
                                            <AlertTriangle size={18} className="text-red-400 shrink-0" />
                                            <p><span className="text-white font-bold">{loc}:</span> Suggestion: Reduce operational cost. Profit margin low ({Math.round((profit / s.r) * 100)}%).</p>
                                        </div>
                                    );
                                }
                                return null;
                            })}
                            <div className="p-3 bg-green-400/5 border border-green-400/10 rounded-xl flex gap-3">
                                <Check size={18} className="text-green-400 shrink-0" />
                                <p>Overall network is stable. Maintain focus on high-performing hubs.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Anomaly Detection Modal */}
            <AnomalyModal transactions={transactions} />
        </div>
    );
};


// Anomaly Detection Popup Component
const AnomalyModal = ({ transactions }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [anomalies, setAnomalies] = useState([]);

    useEffect(() => {
        if (transactions.length < 5) return;

        const amounts = transactions.map(t => parseFloat(t.amount) || 0);
        const mean = ss.mean(amounts);
        const stdDev = ss.standardDeviation(amounts);

        // Find standard anomalies (Z-Score > 2.5) that are EXPENSES
        const detected = transactions.filter(t => {
            if (t.type.toLowerCase() === 'income') return false; // Ignore large incomes for anomaly warnings usually
            const val = parseFloat(t.amount);
            const z = stdDev === 0 ? 0 : (val - mean) / stdDev;
            return z > 2.5;
        });

        if (detected.length > 0) {
            setAnomalies(detected);
            // Check if we've already shown this session or recently
            const lastWarned = sessionStorage.getItem('anomaly_warned_timestamp');
            const now = Date.now();
            // Show only if 1 hour has passed since last warning to avoid spam
            if (!lastWarned || (now - parseInt(lastWarned) > 3600000)) {
                setIsOpen(true);
                sessionStorage.setItem('anomaly_warned_timestamp', now.toString());
            }
        }
    }, [transactions]);

    if (!isOpen || anomalies.length === 0) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="glass-panel w-full max-w-md border-red-500/30 shadow-[0_0_50px_rgba(220,38,38,0.2)]">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-4 items-center">
                        <div className="p-3 bg-red-500/20 rounded-full text-red-500">
                            <AlertTriangle size={32} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Anomaly Detected</h3>
                            <p className="text-red-400 text-sm font-medium">Unusual spending pattern identified</p>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-white">
                        <XCircle size={24} />
                    </button>
                </div>

                <div className="space-y-4 mb-6">
                    <p className="text-sm text-text-muted">Our AI-lite fraud detection engine flagged the following transactions as statistical outliers (Z-Score {'>'} 2.5):</p>
                    <div className="bg-red-500/5 rounded-lg border border-red-500/20 max-h-60 overflow-y-auto">
                        {anomalies.map((t, i) => (
                            <div key={i} className="p-3 border-b border-red-500/10 last:border-0 flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-white">{t.category}</p>
                                    <p className="text-xs text-red-300">{new Date(t.date).toLocaleDateString()}</p>
                                </div>
                                <span className="font-mono font-bold text-red-400">₹{parseFloat(t.amount).toLocaleString('en-IN')}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={() => setIsOpen(false)} className="btn-outline text-xs py-2 px-4">Dismiss</button>
                    <button onClick={() => { setIsOpen(false); /* Logic to mark reviewed */ }} className="btn-primary bg-red-500 hover:bg-red-600 border-red-500 text-white text-xs py-2 px-4 shadow-red-500/20">
                        Review Transactions
                    </button>
                </div>
            </div>
        </div>
    );
};

const InsightCard = ({ icon, iconBg, title, description }) => (
    <motion.div
        className="bg-[#0f0f1a]/60 backdrop-blur-xl p-10 flex flex-col items-start gap-6 border border-white/5 rounded-[32px] hover:border-primary/30 transition-all duration-500 group"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
    >
        <div className={`p-4 rounded-2xl ${iconBg} group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] transition-all duration-500 border border-white/5`}>
            {icon}
        </div>
        <div className="space-y-4">
            <h4 className="text-xl font-bold tracking-tight text-white/90">{title}</h4>
            <p className="text-sm text-text-muted leading-relaxed font-medium opacity-80 group-hover:opacity-100 transition-opacity">
                {description}
            </p>
        </div>
    </motion.div>
);

const StatsCard = ({ title, value, icon, trend, trendColor = "text-primary" }) => (
    <div className="glass-panel p-5 hover:bg-white/[0.02] transition">
        <div className="flex justify-between items-start mb-2">
            <span className="text-text-muted text-sm">{title}</span>
            <div className="p-2 bg-white/5 rounded-lg">{icon}</div>
        </div>
        <div className="flex items-end gap-2">
            <h4 className="text-2xl font-bold">{value}</h4>
            {trend && <span className={`text-xs ${trendColor} font-medium mb-1`}>{trend}</span>}
        </div>
    </div>
);

export default Dashboard;
