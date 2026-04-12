import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";

dayjs.extend(customParseFormat);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

export interface FintechAnalysisResult {
  result: "REAL" | "FAKE" | "SUSPICIOUS";
  confidence_score: number;
  explanation: string[];
  features: {
    amount?: string;
    receiver?: string;
    upiId?: string;
    txId?: string;
    utr?: string;
    date?: string;
    status?: string;
  };
}

export function analyzeFintech(text: string): FintechAnalysisResult {
  const explanation: string[] = [];
  let score = 0;

  // 1. OCR Extraction & Cleaning
  const cleanText = text.replace(/₹/g, "Rs").replace(/\s+/g, " ").toUpperCase();
  
  // Regex Patterns
  const upiPattern = /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/i;
  const txIdPattern = /[A-Z0-9]{12,30}/;
  const utrPattern = /\b\d{10,16}\b/;
  const amountPattern = /(?:RS\.?|INR|PAID|AMOUNT)\s?(\d+(?:,\d+)*(?:\.\d{2})?)/gi;
  
  const upiMatch = text.match(upiPattern);
  const txIdMatch = text.match(txIdPattern);
  const utrMatch = text.match(utrPattern);
  const amountMatches = Array.from(cleanText.matchAll(amountPattern));

  // 2. Status Priority
  const isSuccess = cleanText.includes("SUCCESS") || cleanText.includes("SUCCESSFUL") || cleanText.includes("COMPLETED");
  if (isSuccess) {
    score += 0.30;
    explanation.push("✔ Transaction marked successful");
  }

  // 3. UPI ID & Transaction Validation
  if (upiMatch) {
    score += 0.20;
    explanation.push("✔ Valid UPI format");
  }

  if (utrMatch || txIdMatch) {
    score += 0.15;
    explanation.push("✔ Valid Transaction/UTR format");
  }

  // 4. Date Handling (72h tolerance)
  const datePatterns = [
    "DD MMM YYYY",
    "YYYY-MM-DD",
    "DD/MM/YY",
    "DD/MM/YYYY",
    "MMM DD, YYYY"
  ];
  
  let foundDate: dayjs.Dayjs | null = null;
  const words = cleanText.split(" ");
  for (let i = 0; i < words.length; i++) {
    const potentialDate = words.slice(i, i + 3).join(" ");
    for (const pattern of datePatterns) {
      const d = dayjs(potentialDate, pattern, true);
      if (d.isValid()) {
        foundDate = d;
        break;
      }
    }
    if (foundDate) break;
  }

  if (foundDate) {
    const now = dayjs();
    const toleranceLimit = now.add(72, "hour");
    
    if (foundDate.isSameOrBefore(toleranceLimit)) {
      score += 0.15;
      explanation.push("✔ Date within acceptable range");
    } else {
      explanation.push("⚠ Date exceeds standard processing window");
    }
  }

  // 5. UI Validation (Relaxed)
  const keywords = ["TRANSACTION SUCCESSFUL", "PAID TO", "UPI", "DEBITED FROM"];
  let keywordMatches = 0;
  keywords.forEach(kw => {
    if (cleanText.includes(kw)) keywordMatches++;
  });
  
  if (keywordMatches >= 2) { // Relaxed: 2 out of 4 matches (~50-60%)
    score += 0.10;
    explanation.push("✔ UI structure consistent");
  }

  // 6. Amount Consistency
  if (amountMatches.length >= 1) {
    // If multiple amounts found, check if they match (simplified)
    const amounts = amountMatches.map(m => m[1].replace(/,/g, ""));
    const uniqueAmounts = new Set(amounts);
    if (uniqueAmounts.size === 1) {
      score += 0.10;
      explanation.push("✔ Amount consistency verified");
    } else if (uniqueAmounts.size > 1) {
      explanation.push("⚠ Minor amount discrepancy detected");
    } else {
      score += 0.10; // Only one amount found, still a positive signal
      explanation.push("✔ Amount detected");
    }
  }

  // Final Decision Logic
  let result: "REAL" | "FAKE" | "SUSPICIOUS" = "FAKE";
  if (score >= 0.7) {
    result = "REAL";
  } else if (score >= 0.4) {
    result = "SUSPICIOUS";
  }

  return {
    result,
    confidence_score: score,
    explanation,
    features: {
      amount: amountMatches[0]?.[1],
      upiId: upiMatch?.[0],
      txId: txIdMatch?.[0] || utrMatch?.[0],
      utr: utrMatch?.[0],
      date: foundDate?.format("YYYY-MM-DD"),
      status: isSuccess ? "Success" : "Unknown"
    }
  };
}
