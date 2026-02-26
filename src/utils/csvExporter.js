/**
 * Exports transaction data to a CSV file and triggers download
 * @param {Array} transactions - The list of transactions to export
 * @param {string} filename - The desired filename for the download
 */
export const exportToCSV = (transactions, filename = 'transactions.csv') => {
    if (!transactions || transactions.length === 0) {
        console.warn('No transactions to export');
        return;
    }

    // Define headers
    const headers = ['Date', 'Type', 'Category', 'Amount', 'Description'];

    // Map transactions to CSV rows
    const rows = transactions.map(t => [
        t.date ? new Date(t.date).toLocaleDateString() : '-',
        t.type || '-',
        t.category || '-',
        t.amount || 0,
        (t.description || '').replace(/,/g, ';') // Replace commas to avoid CSV breakage
    ]);

    // Create CSV content
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    // Create blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
