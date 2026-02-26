// Timeline Engine - Core utility functions for Financial Memory Replay

/**
 * Reconstruct financial state at a specific date
 * @param {Array} transactions - All user transactions
 * @param {Date} targetDate - Date to reconstruct state for
 * @returns {Object} Financial snapshot at that date
 */
export const reconstructStateAtDate = (transactions, targetDate) => {
    const target = new Date(targetDate);
    target.setHours(23, 59, 59, 999); // End of day

    // Filter transactions up to target date
    const relevantTransactions = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate <= target;
    });

    if (relevantTransactions.length === 0) {
        return {
            date: target.toISOString(),
            balance: 0,
            income: 0,
            expenses: 0,
            transactions: [],
            transactionCount: 0
        };
    }

    // Calculate totals
    let income = 0;
    let expenses = 0;

    relevantTransactions.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        if (t.type === 'Income' || t.type === 'income') {
            income += amount;
        } else {
            expenses += amount;
        }
    });

    const balance = income - expenses;

    return {
        date: target.toISOString(),
        balance,
        income,
        expenses,
        transactions: relevantTransactions,
        transactionCount: relevantTransactions.length
    };
};

/**
 * Calculate what-if scenario by removing a transaction
 * @param {Array} transactions - All user transactions
 * @param {String} transactionId - ID of transaction to remove
 * @returns {Object} Alternative financial state
 */
export const calculateWhatIf_RemoveTransaction = (transactions, transactionId) => {
    const filteredTransactions = transactions.filter(t => t.id !== transactionId);
    const removedTransaction = transactions.find(t => t.id === transactionId);

    if (!removedTransaction) return null;

    // Reconstruct state without this transaction
    const latestDate = new Date(Math.max(...transactions.map(t => new Date(t.date))));
    const alternativeState = reconstructStateAtDate(filteredTransactions, latestDate);
    const actualState = reconstructStateAtDate(transactions, latestDate);

    return {
        scenario: 'remove',
        transactionRemoved: removedTransaction,
        actual: actualState,
        alternative: alternativeState,
        difference: {
            balance: alternativeState.balance - actualState.balance,
            income: alternativeState.income - actualState.income,
            expenses: alternativeState.expenses - actualState.expenses
        }
    };
};

/**
 * Calculate what-if scenario by modifying transaction amount
 * @param {Array} transactions - All user transactions
 * @param {String} transactionId - ID of transaction to modify
 * @param {Number} newAmount - New amount for the transaction
 * @returns {Object} Alternative financial state
 */
export const calculateWhatIf_ModifyAmount = (transactions, transactionId, newAmount) => {
    const modifiedTransactions = transactions.map(t =>
        t.id === transactionId ? { ...t, amount: newAmount } : t
    );

    const originalTransaction = transactions.find(t => t.id === transactionId);
    if (!originalTransaction) return null;

    const latestDate = new Date(Math.max(...transactions.map(t => new Date(t.date))));
    const alternativeState = reconstructStateAtDate(modifiedTransactions, latestDate);
    const actualState = reconstructStateAtDate(transactions, latestDate);

    return {
        scenario: 'modify',
        transactionModified: originalTransaction,
        newAmount,
        actual: actualState,
        alternative: alternativeState,
        difference: {
            balance: alternativeState.balance - actualState.balance,
            income: alternativeState.income - actualState.income,
            expenses: alternativeState.expenses - actualState.expenses
        }
    };
};

/**
 * Generate timeline snapshots at regular intervals
 * @param {Array} transactions - All user transactions
 * @param {String} interval - 'monthly' or 'weekly'
 * @returns {Array} Array of financial snapshots
 */
export const generateTimelineSnapshots = (transactions, interval = 'monthly') => {
    if (transactions.length === 0) return [];

    const dates = transactions.map(t => new Date(t.date));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    const snapshots = [];
    let currentDate = new Date(minDate);
    currentDate.setDate(1); // Start of month

    while (currentDate <= maxDate) {
        const snapshot = reconstructStateAtDate(transactions, currentDate);
        snapshots.push({
            ...snapshot,
            label: currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        });

        // Move to next interval
        if (interval === 'monthly') {
            currentDate.setMonth(currentDate.getMonth() + 1);
        } else {
            currentDate.setDate(currentDate.getDate() + 7);
        }
    }

    // Always include the latest date
    const latestSnapshot = reconstructStateAtDate(transactions, maxDate);
    if (snapshots.length === 0 || snapshots[snapshots.length - 1].date !== latestSnapshot.date) {
        snapshots.push({
            ...latestSnapshot,
            label: maxDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        });
    }

    return snapshots;
};

/**
 * Identify key financial decisions in transaction history
 * @param {Array} transactions - All user transactions
 * @returns {Array} Key decision points
 */
export const identifyKeyDecisions = (transactions) => {
    if (transactions.length === 0) return [];

    const amounts = transactions.map(t => parseFloat(t.amount) || 0);
    const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;

    // Lower threshold to 80% of average (more sensitive)
    const threshold = avgAmount * 0.8;

    const keyDecisions = transactions
        .filter(t => parseFloat(t.amount) >= threshold)
        .map(t => ({
            ...t,
            isKeyDecision: true,
            impact: parseFloat(t.amount) - avgAmount,
            impactPercentage: ((parseFloat(t.amount) - avgAmount) / avgAmount * 100).toFixed(1)
        }))
        .sort((a, b) => b.amount - a.amount);

    // If no key decisions found (very few transactions), show all transactions
    if (keyDecisions.length === 0 && transactions.length > 0) {
        return transactions
            .map(t => ({
                ...t,
                isKeyDecision: true,
                impact: parseFloat(t.amount) - avgAmount,
                impactPercentage: transactions.length === 1 ? '0.0' : ((parseFloat(t.amount) - avgAmount) / avgAmount * 100).toFixed(1)
            }))
            .sort((a, b) => b.amount - a.amount);
    }

    return keyDecisions;
};

/**
 * Calculate financial trajectory (trend over time)
 * @param {Array} snapshots - Timeline snapshots
 * @returns {Object} Trajectory analysis
 */
export const calculateTrajectory = (snapshots) => {
    if (snapshots.length < 2) {
        return { trend: 'insufficient_data', slope: 0, prediction: 0 };
    }

    // Simple linear regression
    const n = snapshots.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    snapshots.forEach((snapshot, index) => {
        const x = index;
        const y = snapshot.balance;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict next period
    const prediction = slope * n + intercept;

    return {
        trend: slope > 0 ? 'improving' : slope < 0 ? 'declining' : 'stable',
        slope: slope.toFixed(2),
        prediction: Math.round(prediction),
        confidence: snapshots.length >= 6 ? 'high' : snapshots.length >= 3 ? 'medium' : 'low'
    };
};
