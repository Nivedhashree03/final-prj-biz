export const extractAmount = (text) => {
    const lines = text.split('\n');
    const TOTAL_KEYWORDS = [
        "total", "grand total", "amount", "net amount", "bill amount", 
        "payable", "inr", "net", "grand", "tota", "tate", "tobi", "tot", "fotal", "amt"
    ];

    const extractNumbers = (str) => {
        const norm = str.replace(/(\d)\s+(\d)/g, '$1$2')
            .replace(/\s+([.,])/g, '$1')
            .replace(/([.,])\s+/g, '$1');

        const decimalMatches = norm.match(/(\d{1,3}([, ]\d{3})*|[0-9]+)([.,]\d{2})/g);
        const results = [];

        if (decimalMatches) {
            decimalMatches.forEach(m => {
                const val = parseFloat(m.replace(/,/g, '').replace(' ', ''));
                if (!isNaN(val)) results.push(val);
            });
        }

        const fuzzyNumPattern = /\b([0-9ySbgloIiz]{2,6})\b(?!\s*(ml|mi|m1|mI|mg|g|kg|pcs|qty|qyt|items|ltr|lt|gm))/gi;
        const fuzzyMatches = norm.match(fuzzyNumPattern);

        if (fuzzyMatches) {
            fuzzyMatches.forEach(m => {
                const cleaned = m.toLowerCase()
                    .replace(/y/g, '4')
                    .replace(/s/g, '5')
                    .replace(/b/g, '6')
                    .replace(/g/g, '9')
                    .replace(/[loiI]/g, '1')
                    .replace(/z/g, '2');

                const val = parseInt(cleaned);
                if (!isNaN(val)) {
                    results.push(val);
                }
            });
        }

        const currencyMatches = str.match(/(?:RS|INR|₹|RE)\s*([\d,.]+)/i);
        if (currencyMatches) {
            const val = parseFloat(currencyMatches[1].replace(/,/g, ''));
            if (!isNaN(val)) results.push(val);
        }

        return results;
    };

    let lastTotalCandidate = null;
    let globalMax = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();

        const numbers = extractNumbers(line);

        if (numbers.length) {
            const filtered = numbers.filter(n => n < 100000 && n !== 2025 && n !== 2026 && n !== 2024 && n > 20);
            if (filtered.length) {
                globalMax = Math.max(globalMax, ...filtered);
            }
        }

        const isTotalLine = TOTAL_KEYWORDS.some(keyword => line.includes(keyword));

        if (isTotalLine) {
            let candidate = null;

            if (numbers.length) {
                candidate = Math.max(...numbers);
            } else if (lines[i + 1]) {
                const nextNumbers = extractNumbers(lines[i + 1]);
                if (nextNumbers.length) {
                    candidate = Math.max(...nextNumbers);
                }
            }

            if (candidate !== null) {
                lastTotalCandidate = candidate;
            }
        }
    }

    return lastTotalCandidate !== null ? lastTotalCandidate : globalMax;
};
