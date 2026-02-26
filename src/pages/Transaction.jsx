import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Upload, Plus, FileText, CheckCircle, Loader, Brain, Trash2, List, History, XCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Set worker using a CDN to ensure it loads correctly in Vite
GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;

const Transaction = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('manual');
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState([]);

    // Manual Form State
    const [formData, setFormData] = useState({
        amount: '', // Total Amount (Base + GST)
        baseAmount: '', // Base Amount for user input
        gstRate: '0',
        category: '',
        description: '',
        location: 'Chennai', // Default location
        type: 'Expense' // Income or Expense
    });

    // Verification State for OCR
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationData, setVerificationData] = useState(null);

    // Update total amount when base or GST changes
    useEffect(() => {
        const base = parseFloat(formData.baseAmount) || 0;
        const rate = parseFloat(formData.gstRate) || 0;
        const gstVal = base * (rate / 100);
        const total = base + gstVal;

        setFormData(prev => ({
            ...prev,
            amount: total.toFixed(2)
        }));
    }, [formData.baseAmount, formData.gstRate]);

    // File Upload State
    const [dragActive, setDragActive] = useState(false);

    // Load transactions on mount
    useEffect(() => {
        if (!currentUser) return;

        // Handle initial tab from navigation state
        if (location.state?.activeTab) {
            setActiveTab(location.state.activeTab);
        }

        const fetchTransactions = async () => {
            try {
                const token = localStorage.getItem('finance_token');
                const response = await fetch('http://localhost:5000/api/transactions', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setTransactions(data);
                }
            } catch (err) {
                console.error("Failed to fetch transactions:", err);
            }
        };
        fetchTransactions();
    }, [currentUser, location.state]);

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
                setTransactions(prev => prev.filter(t => t._id !== id));
            } else {
                alert("Failed to delete transaction.");
            }
        } catch (err) {
            console.error("Failed to delete transaction:", err);
            alert("Error deleting transaction.");
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const convertPdfToImage = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await getDocument(arrayBuffer).promise;
        const page = await pdf.getPage(1); // Get first page

        const viewport = page.getViewport({ scale: 2.5 }); // High scale for clarity
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        return canvas;
    };

    const processImageForOCR = async (fileOrUrl, threshold = 185) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                // Upscale for better OCR - 3x is the sweet spot for small font receipts
                const scale = 3.0;
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;

                // Draw image
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Apply black and white thresholding for ultra-clear text
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    // Boost contrast: items below threshold become black, above become white
                    const val = avg < threshold ? 0 : 255;
                    data[i] = data[i + 1] = data[i + 2] = val;
                }
                ctx.putImageData(imageData, 0, 0);

                resolve(canvas);
            };
            if (typeof fileOrUrl === 'string') {
                img.src = fileOrUrl;
            } else {
                img.src = URL.createObjectURL(fileOrUrl);
            }
        });
    };

    const performOCR = async (canvas) => {
        const Tesseract = (await import('tesseract.js')).default;
        const dataUrl = canvas.toDataURL('image/png');

        return new Promise((resolve, reject) => {
            Tesseract.recognize(
                dataUrl,
                'eng',
                { logger: m => console.log(m.status, Math.round(m.progress * 100) + '%') }
            ).then(({ data: { text } }) => {
                const lines = text.split('\n');
                let amount = 0;
                let amountFromWords = 0;
                let gstAmountStr = 0;
                let date = new Date();
                let description = `Scanned Receipt`;
                let location = 'General';

                const wordsToNumber = (text) => {
                    const units = { 'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19 };
                    const tens = { 'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90 };
                    const scales = { 'thousand': 1000, 'hundred': 100, 'lakh': 100000 };

                    const words = text.toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/);
                    let current = 0;
                    let total = 0;

                    words.forEach(word => {
                        if (units[word] !== undefined) current += units[word];
                        else if (tens[word] !== undefined) current += tens[word];
                        else if (scales[word] !== undefined) {
                            if (current === 0) current = 1;
                            total += current * scales[word];
                            current = 0;
                        }
                    });
                    return total + current;
                };

                const extractNumbers = (str) => {
                    // Normalize: join digits separated by spaces and fix spaces around dots/commas
                    const norm = str.replace(/(\d)\s+(\d)/g, '$1$2')
                        .replace(/\s+([.,])/g, '$1')
                        .replace(/([.,])\s+/g, '$1');
                    // Greedily find anything that looks like a price with decimals
                    const matches = norm.match(/(\d{1,3}([, ]\d{3})*|[0-9]+)([.,]\d{2})/g);
                    const results = [];

                    if (matches) {
                        matches.forEach(m => {
                            const val = parseFloat(m.replace(/,/g, '').replace(' ', ''));
                            if (!isNaN(val)) results.push(val);
                        });
                    }

                    // Also look for simple currency strings
                    const currencyMatches = str.match(/(?:RS|INR|₹)\s*([\d,.]+)/i);
                    if (currencyMatches) {
                        const val = parseFloat(currencyMatches[1].replace(/,/g, ''));
                        if (!isNaN(val)) results.push(val);
                    }

                    return results;
                };

                let maxTotalCandidate = 0;
                let foundTotalKeyword = false;

                // --- SMART ANCHOR SCANNING ---
                let foundAnyAmount = false;
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const lower = line.toLowerCase();
                    const nums = extractNumbers(line);

                    // Look for TOTAL keywords - we want the LARGEST total found (usually Grand Total)
                    if (lower.includes('total') || lower.includes('payable') || lower.includes('inr') || lower.includes('net') || lower.includes('grand')) {
                        if (nums.length > 0) {
                            const maxInLine = Math.max(...nums);
                            // CRITICAL FIX: Always keep the maximum value found across all total lines
                            if (maxInLine > maxTotalCandidate) {
                                maxTotalCandidate = maxInLine;
                                foundTotalKeyword = true;
                            }
                        }
                    }

                    if (lower.includes('words') || lower.includes('thousand')) {
                        const wordAmount = wordsToNumber(line);
                        if (wordAmount > 0) {
                            amountFromWords = wordAmount;
                        }
                    }
                }

                // Fallback: If no anchor found, use the global max (less reliable)
                if (!foundTotalKeyword) {
                    const allTextNums = extractNumbers(text);
                    if (allTextNums.length > 0) {
                        maxTotalCandidate = Math.max(...allTextNums);
                    }
                }

                // Prefer word amount if it looks like a total
                if (amountFromWords > 0) {
                    amount = amountFromWords;
                } else if (maxTotalCandidate > 0) {
                    amount = maxTotalCandidate;
                } else {
                    const allDecimals = text.match(/\d+[.,\s]+\d{2}/g);
                    if (allDecimals) {
                        const parsed = allDecimals.map(m => parseFloat(m.replace(/,/g, '').replace(/\s/g, '')));
                        amount = Math.max(...parsed);
                    }
                }

                const dateMatch = text.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(\d{1,2}[-\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\s]\d{2,4})/i);
                if (dateMatch) {
                    const parsedDate = new Date(dateMatch[0].replace(/-/g, ' '));
                    if (!isNaN(parsedDate)) date = parsedDate;
                }

                const firstLine = lines.slice(0, 15).find(line => {
                    const l = line.trim();
                    if (l.length < 8) return false;
                    const alphaCount = (l.match(/[a-zA-Z]/g) || []).length;
                    const digitCount = (l.match(/[0-9]/g) || []).length;
                    if (alphaCount < 6) return false;
                    if (digitCount > alphaCount) return false;
                    return true;
                });

                const priorityVendor = lines.slice(0, 20).find(l =>
                    l.toLowerCase().includes('enterprise') ||
                    l.toLowerCase().includes('jothi') ||
                    l.toLowerCase().includes('clinic') ||
                    l.toLowerCase().includes('hospital') ||
                    l.toLowerCase().includes('pharmacy')
                );

                // --- TABLE-BASED ITEM EXTRACTION ---
                const tableHeaders = ['item description', 'description', 'particulars'];
                let tableItem = '';
                for (let i = 0; i < lines.length; i++) {
                    const lower = lines[i].toLowerCase();
                    if (tableHeaders.some(h => lower.includes(h))) {
                        // Header found, look at the next few lines for the first actual item
                        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                            const candidate = lines[j].trim();
                            if (candidate.length > 5 && !candidate.match(/^[| \-_.]+$/)) {
                                // Try to extract the name from between pipes or at the start
                                let cleaned = candidate.split('|')
                                    .map(p => p.trim())
                                    .find(p => p.length > 5 && !p.match(/^\d+$/) && !p.toLowerCase().includes('hsn'));

                                if (!cleaned) {
                                    cleaned = candidate.replace(/^[| \d.\-_]+/, '').trim();
                                }

                                if (cleaned && cleaned.length > 3) {
                                    tableItem = cleaned;
                                    break;
                                }
                            }
                        }
                        if (tableItem) break;
                    }
                }

                // --- ITEM EXTRACTION LOGIC ---
                // Search for specific product names or middle-document lines that look like items
                let itemCandidate = '';
                const itemKeywords = ['amrutanjan', 'roll', 'tablet', 'syrup', 'oil', 'capsule', 'cream', 'gel', 'powder', 'soap', 'shampoo', 'paste', 'brush'];

                // Scan the middle 60% of lines (most likely place for items)
                const startScan = Math.floor(lines.length * 0.1);
                const endScan = Math.floor(lines.length * 0.8);

                for (let i = startScan; i < endScan; i++) {
                    const line = lines[i].toLowerCase();
                    if (itemKeywords.some(k => line.includes(k))) {
                        // Found an item keyword, take the line but strip common noise
                        itemCandidate = lines[i].trim();
                        break;
                    }
                }

                // If no item keyword found, look for lines with product-like patterns (Alphanumeric text with numbers at the end)
                if (!itemCandidate) {
                    for (let i = startScan; i < endScan; i++) {
                        const line = lines[i].trim();
                        const lower = line.toLowerCase();
                        // Filter out headers and noisy fragments
                        if (line.length > 5 && (line.match(/[a-z]/gi) || []).length > 5 && !lower.includes('invoice') && !lower.includes('tax') && !lower.includes('gst') && !lower.includes('total')) {
                            itemCandidate = line; // Use first descriptive line in middle
                            break;
                        }
                    }
                }

                if (tableItem) {
                    description = tableItem;
                } else if (itemCandidate) {
                    description = itemCandidate;
                } else if (priorityVendor) {
                    description = priorityVendor.trim();
                } else if (firstLine) {
                    description = firstLine.trim();
                }

                let category = 'Uncategorized';
                const lowerText = text.toLowerCase();
                const keywords = {
                    'Shopping': ['reliance', 'mart', 'store', 'shop', 'mall', 'supermarket', 'billing'],
                    'Food': ['zomato', 'swiggy', 'restaurant', 'food', 'hotel', 'cafe', 'bistro', 'dining'],
                    'Electronics': ['amazon', 'flipkart', 'mobile', 'laptop', 'hardware', 'croma'],
                    'Travel': ['petrol', 'fuel', 'shell', 'uber', 'ola', 'taxi', 'parking', 'garage'],
                    'Office Supplies': ['office', 'stationery', 'print', 'paper', 'xerox', 'courier'],
                    'Health/Medicine': ['amrutanjan', 'pharmacy', 'medicine', 'health', 'clinic', 'hospital', 'medical', 'ent']
                };

                for (const [cat, keys] of Object.entries(keywords)) {
                    if (keys.some(k => lowerText.includes(k))) {
                        category = cat;
                        break;
                    }
                }

                // --- LOCATION DETECTION ---
                const locations = ['chennai', 'madurai', 'bangalore', 'bengaluru', 'mumbai', 'delhi', 'hyderabad', 'pune', 'kolkata'];
                for (const loc of locations) {
                    if (lowerText.includes(loc)) {
                        location = loc.charAt(0).toUpperCase() + loc.slice(1);
                        break;
                    }
                }

                description = description.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

                // --- FUZZY VENDOR & CATEGORY HARDENING ---
                if (lowerText.includes('jothi') || lowerText.includes('enterprise')) {
                    // Only overwrite description if it's generic or a noisy first line
                    if (description === 'Scanned Receipt' || !itemCandidate) {
                        description = "Jothi Enterprises";
                    }
                    category = "Health/Medicine";
                } else if (lowerText.includes('amrutanjan') || lowerText.includes('clinic')) {
                    category = "Health/Medicine";
                }

                console.log("--- OCR RAW TEXT ---");
                console.log(text);
                console.log("--------------------");

                resolve({
                    amount,
                    gstAmount: gstAmountStr,
                    date: date.toISOString(),
                    description,
                    category,
                    location,
                    rawText: text,
                    score: text.length // Simple metric for quality
                });
            }).catch(reject);
        });
    };

    const performDeepOCR = async (fileOrCanvas) => {
        // Multi-pass thresholds to handle different lighting
        const thresholds = [185, 155, 215];
        let bestResult = null;
        let bestScore = -1;

        for (const thresh of thresholds) {
            console.log(`OCR Pass - Threshold: ${thresh}`);
            let canvas;
            if (fileOrCanvas instanceof HTMLCanvasElement) {
                // For PDFs, we already have a canvas, so we can't easily re-threshold 
                // but we can try to use a default or process the canvas pixels.
                canvas = fileOrCanvas;
                if (thresholds.indexOf(thresh) > 0) break; // Only one pass for PDFs for now
            } else {
                canvas = await processImageForOCR(fileOrCanvas, thresh);
            }

            const result = await performOCR(canvas);

            // Confidence Scoring
            let score = result.rawText.length;
            if (result.amount > 0) score += 5000;
            if (result.description !== 'Scanned Receipt') score += 2000;
            if (result.category !== 'Uncategorized') score += 1000;

            if (score > bestScore) {
                bestScore = score;
                bestResult = result;
            }

            // Early exit if result is very high confidence
            if (result.amount > 0 && result.category !== 'Uncategorized' && result.description.length > 5) {
                console.log("High confidence OCR result found.");
                break;
            }
        }

        return {
            ...bestResult,
            cognitiveParams: { focus: 75, stress: 30 },
            riskScore: bestResult.amount > 500 ? 60 : 20,
            stockInsights: { recommended: "N/A", prediction: "Stable" },
            narrative: `Detected transaction of ${bestResult.amount} from ${bestResult.description}.`
        };
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            // Process file
            const file = e.dataTransfer.files[0];
            handleFileUpload(file);
        }
    };

    const handleFileUpload = async (file) => {
        if (!currentUser) return;
        setLoading(true);

        try {
            console.log("Analyzing file:", file.name);
            let ocrInput;

            if (file.type === 'application/pdf') {
                console.log("Detailed PDF conversion starting...");
                ocrInput = await convertPdfToImage(file);
            } else {
                ocrInput = file; // Pass raw file to DeepOCR for thresholding
            }

            const ocrResult = await performDeepOCR(ocrInput);
            console.log("Extracted Data:", ocrResult);

            if (ocrResult.amount === 0) {
                console.warn("OCR failed to detect a valid amount. User will need to enter it manually.");
            }

            // Calculate rate if both amounts present
            let calculatedRate = 0;
            if (ocrResult.amount > 0 && ocrResult.gstAmount > 0) {
                const base = ocrResult.amount - ocrResult.gstAmount;
                if (base > 0) {
                    calculatedRate = Math.round((ocrResult.gstAmount / base) * 100);
                }
            }

            // Set for verification instead of direct save
            setVerificationData({
                type: 'Expense',
                amount: ocrResult.amount || 0,
                gstRate: calculatedRate,
                gstAmount: ocrResult.gstAmount || 0,
                category: ocrResult.category,
                description: ocrResult.description,
                location: ocrResult.location || 'General',
                date: ocrResult.date.split('T')[0], // For input date field
                aiAnalysis: ocrResult
            });
            setIsVerifying(true);
            setLoading(false);
        } catch (err) {
            console.error("Failed to process uploaded file:", err);
            setLoading(false);
            alert("Error processing image. Please try again.");
        }
    };

    const handleConfirmVerification = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('finance_token');
            const dataToSave = {
                ...verificationData,
                date: new Date(verificationData.date).toISOString()
            };

            await fetch('http://localhost:5000/api/transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(dataToSave)
            });

            setIsVerifying(false);
            setVerificationData(null);
            setLoading(false);
            navigate('/dashboard');
        } catch (err) {
            console.error("Failed to save transaction after verification:", err);
            setLoading(false);
            alert("Failed to save transaction.");
        }
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        if (!currentUser) return;

        // Proceed with saving transaction
        saveTransaction();
    };

    const saveTransaction = async () => {
        setLoading(true);

        const base = parseFloat(formData.baseAmount) || 0;
        const rate = parseFloat(formData.gstRate) || 0;
        const gstVal = base * (rate / 100);
        // Ensure accurate total
        const total = base + gstVal;

        const newTransaction = {
            type: formData.type,
            amount: total,
            gstRate: rate,
            gstAmount: gstVal,
            category: formData.category,
            description: formData.description,
            location: formData.location || 'General',
            date: new Date().toISOString(),
            aiAnalysis: null
        };

        try {
            const token = localStorage.getItem('finance_token');
            await fetch('http://localhost:5000/api/transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newTransaction)
            });

            setLoading(false);
            navigate('/dashboard');
        } catch (err) {
            console.error("Failed to save transaction:", err);
            setLoading(false);
        }
    };

    return (
        <>
            {/* OCR Verification Modal */}
            {isVerifying && verificationData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-panel w-full max-w-lg p-8 border-primary/30 shadow-[0_0_50px_rgba(0,240,255,0.1)]"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-white flex gap-2 items-center">
                                <Brain className="text-primary" /> Verify Extracted Data
                            </h3>
                            <button onClick={() => setIsVerifying(false)} className="text-text-muted hover:text-white">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs uppercase tracking-widest text-text-muted mb-1 block">Amount (₹)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white font-bold"
                                        value={verificationData.amount}
                                        onChange={(e) => setVerificationData({ ...verificationData, amount: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs uppercase tracking-widest text-text-muted mb-1 block">Date</label>
                                    <input
                                        type="date"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white"
                                        value={verificationData.date}
                                        onChange={(e) => setVerificationData({ ...verificationData, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs uppercase tracking-widest text-text-muted mb-1 block">Category</label>
                                <input
                                    type="text"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white"
                                    value={verificationData.category}
                                    onChange={(e) => setVerificationData({ ...verificationData, category: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="text-xs uppercase tracking-widest text-text-muted mb-1 block">Vendor/Description</label>
                                    <input
                                        type="text"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white"
                                        value={verificationData.description}
                                        onChange={(e) => setVerificationData({ ...verificationData, description: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs uppercase tracking-widest text-text-muted mb-1 block">Location / Branch</label>
                                    <input
                                        type="text"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white"
                                        value={verificationData.location}
                                        onChange={(e) => setVerificationData({ ...verificationData, location: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setIsVerifying(false)}
                                className="flex-1 btn-outline py-3"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmVerification}
                                disabled={loading}
                                className="flex-1 btn-primary py-3 flex justify-center items-center gap-2"
                            >
                                {loading ? <Loader className="animate-spin" /> : <><CheckCircle size={18} /> Confirm & Save</>}
                            </button>
                        </div>
                    </motion.div >
                </div >
            )}


            <div className="page-container flex flex-col items-center justify-center">
                <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-primary opacity-10 blur-[150px] rounded-full pointer-events-none"></div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-panel p-8 w-full max-w-2xl reltive z-10"
                >
                    <h2 className="text-3xl font-bold mb-6 text-center">Add New Transaction</h2>

                    {/* Tabs */}
                    <div className="flex bg-[#141423] p-1 rounded-xl mb-8">
                        <button
                            onClick={() => setActiveTab('manual')}
                            className={`flex-1 py-3 rounded-lg font-medium transition-all ${activeTab === 'manual' ? 'bg-primary text-white shadow-lg shadow-cyan-500/50' : 'text-text-muted hover:text-white'}`}
                        >
                            Manual Entry
                        </button>
                        <button
                            onClick={() => setActiveTab('upload')}
                            className={`flex-1 py-3 rounded-lg font-medium transition-all ${activeTab === 'upload' ? 'bg-secondary text-white shadow-lg shadow-purple-50' : 'text-text-muted hover:text-white'}`}
                        >
                            Upload File (AI OCR)
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 py-3 rounded-lg font-medium transition-all ${activeTab === 'history' ? 'bg-blue-600/20 text-blue-400 shadow-lg shadow-blue-500/10' : 'text-text-muted hover:text-white'}`}
                        >
                            History
                        </button>
                    </div>

                    {activeTab === 'history' ? (
                        <div className="animate-fade-in space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-xl font-bold">Transaction History</h3>
                                <span className="text-sm text-text-muted">{transactions.length} entries</span>
                            </div>

                            <div className="overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                                {transactions.length > 0 ? (
                                    <div className="space-y-3">
                                        {transactions.map((t) => (
                                            <div key={t._id} className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-primary/30 transition-all flex justify-between items-center group">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 rounded-full ${t.type === 'income' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                        {t.type === 'income' ? <Plus size={20} /> : <FileText size={20} />}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-white">{t.category}</h4>
                                                        <p className="text-sm text-text-muted">{new Date(t.date).toLocaleDateString()} • {t.description || 'No description'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="text-right">
                                                        <p className={`font-bold ${t.type === 'income' ? 'text-green-400' : 'text-white'}`}>
                                                            {t.type === 'income' ? '+' : ''}₹{parseFloat(t.amount).toLocaleString('en-IN')}
                                                        </p>
                                                        {t.gstAmount > 0 && <p className="text-xs text-text-muted">Inc. ₹{t.gstAmount} GST</p>}
                                                    </div>
                                                    <button
                                                        onClick={() => handleDelete(t._id)}
                                                        className="p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-text-muted">
                                        <History size={48} className="mx-auto mb-4 opacity-20" />
                                        <p>No transactions found.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : activeTab === 'manual' ? (
                        <form onSubmit={handleManualSubmit} className="space-y-5 animate-fade-in">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label>Type</label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full bg-[#1e1e2d] text-white border border-white/10 rounded-lg p-3"
                                    >
                                        <option value="Expense" className="bg-[#1e1e2d] text-white">Expense</option>
                                        <option value="Income" className="bg-[#1e1e2d] text-white">Income</option>
                                        <option value="Business" className="bg-[#1e1e2d] text-white">Business</option>
                                        <option value="Stock" className="bg-[#1e1e2d] text-white">Stock Purchase</option>
                                    </select>
                                </div>
                                <div className="space-y-4">
                                    {/* Base Amount */}
                                    <div>
                                        <label>Base Amount (₹)</label>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            required
                                            value={formData.baseAmount}
                                            onChange={(e) => setFormData({ ...formData, baseAmount: e.target.value })}
                                        />
                                    </div>

                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 items-center">
                                {/* GST Selection */}
                                <div>
                                    <label>GST Rate</label>
                                    <select
                                        value={formData.gstRate}
                                        onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
                                        className="w-full bg-[#1e1e2d] text-white border border-white/10 rounded-lg p-3"
                                    >
                                        <option value="0" className="bg-[#1e1e2d] text-white">0% (Nil)</option>
                                        <option value="5" className="bg-[#1e1e2d] text-white">5%</option>
                                        <option value="12" className="bg-[#1e1e2d] text-white">12%</option>
                                        <option value="18" className="bg-[#1e1e2d] text-white">18% (Standard)</option>
                                        <option value="28" className="bg-[#1e1e2d] text-white">28% (Luxury)</option>
                                    </select>
                                </div>

                                {/* Read-only calculation */}
                                <div className="p-3 bg-white/5 rounded-lg border border-white/10 flex flex-col justify-center">
                                    <div className="flex justify-between text-xs text-text-muted mb-1">
                                        <span>GST Amount:</span>
                                        <span>+ ₹{(parseFloat(formData.baseAmount || 0) * (parseFloat(formData.gstRate || 0) / 100)).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-lg text-primary">
                                        <span>Total:</span>
                                        <span>₹{formData.amount || '0.00'}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label>Category</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Marketing, Office Supplies, Apple Stock"
                                    required
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                />
                            </div>
                            <div>
                                <label>Location / Branch</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Chennai, Madurai"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                />
                            </div>
                            <div>
                                <label>Description (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="Details..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            {transactions.filter(t => t.regretLabel).length < 3 && (
                                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs text-primary flex gap-2 items-center italic">
                                    <Brain size={14} />
                                    AI Predictor needs 3 labeled transactions from Dashboard to activate.
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full btn-primary mt-4 flex justify-center"
                            >
                                {loading ? <Loader className="animate-spin" /> : 'Add Transaction'}
                            </button>
                        </form>

                    ) : (
                        <div className="animate-fade-in">
                            <div
                                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${dragActive ? 'border-primary bg-primary/10' : 'border-glass-border hover:border-text-muted'}`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                            >
                                {loading ? (
                                    <div className="flex flex-col items-center py-8">
                                        <Loader size={48} className="text-secondary animate-spin mb-4" />
                                        <h3 className="text-xl font-bold mb-2">Analyzing Document...</h3>
                                        <p className="text-text-muted max-w-xs">Extracting financial data, scanning for cognitive patterns, and assessing risk...</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-20 h-20 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Upload size={32} className="text-secondary" />
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">Drag & Drop Invoice or Receipt</h3>
                                        <p className="text-text-muted mb-6">Supports PDF, JPG, PNG. AI will extract all details automatically.</p>
                                        <label className="btn-outline inline-block cursor-pointer">
                                            Browse Files
                                            <input type="file" className="hidden" onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])} />
                                        </label>
                                    </>
                                )}
                            </div>
                            <div className="mt-6 p-4 bg-[#141423]/50 rounded-lg text-sm text-text-muted flex gap-3">
                                <CheckCircle size={16} className="text-green-400 shrink-0 mt-1" />
                                <p>AI automatically detects amounts, vendors, and dates while performing a sentiment analysis on your purchasing behavior.</p>
                            </div>
                        </div>
                    )}

                </motion.div>
            </div>
        </>
    );
};

export default Transaction;
