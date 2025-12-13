// analysis.js - Technical Analysis Utilities

// Calculate Simple Moving Average
export const calculateSMA = (data, period) => {
  if (data.length < period) return null;
  const recent = data.slice(data.length - period);
  const sum = recent.reduce((acc, val) => acc + val.close, 0);
  return sum / period;
};

// Calculate Local Support and Resistance (Basic implementation using Swing Lows/Highs)
export const calculateSupportResistance = (candles, period = 20) => {
  // We look back 'period' days to find the lowest low and highest high
  if (candles.length < period) return { support: 0, resistance: 0 };
  
  const recentCandles = candles.slice(-period);
  const lowestLow = Math.min(...recentCandles.map(c => c.low));
  const highestHigh = Math.max(...recentCandles.map(c => c.high));
  
  return { support: lowestLow, resistance: highestHigh };
};

// Calculate Average True Range (ATR) for volatility
export const calculateATR = (candles, period = 14) => {
  if (candles.length < period + 1) return 0;

  let trSum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i-1].close;
    
    // TR = Max(H-L, |H-Cp|, |L-Cp|)
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trSum += tr;
  }
  
  return trSum / period;
};

// Calculate RSI
export const calculateRSI = (candles, period = 14) => {
  if (candles.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  // Initial average
  for (let i = candles.length - period; i < candles.length; i++) {
    const change = candles[i].close - candles[i-1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const rs = avgGain / (avgLoss === 0 ? 1 : avgLoss);
  return 100 - (100 / (1 + rs));
};



// Fundamental Scoring Logic
export const calculateFundamentalScore = (fundamentals) => {
  if (!fundamentals) return { score: 0, reasons: [] };

  let score = 0;
  const reasons = [];

  // Profitability (Max 40)
  if (fundamentals.roe > 0.15) {
    score += 20;
    reasons.push(`ROE 優異 (${(fundamentals.roe * 100).toFixed(1)}%)`);
  } else if (fundamentals.roe > 0.08) {
    score += 10;
  }
  
  if (fundamentals.profitMargin > 0.2) {
    score += 20;
    reasons.push(`淨利率高 (${(fundamentals.profitMargin * 100).toFixed(1)}%)`);
  } else if (fundamentals.profitMargin > 0.1) {
    score += 10;
  }

  // Growth (Max 30)
  if (fundamentals.revenueGrowth > 0.2) {
    score += 15;
    reasons.push(`營收爆發成長 (${(fundamentals.revenueGrowth * 100).toFixed(1)}%)`);
  } else if (fundamentals.revenueGrowth > 0) {
    score += 5;
  }

  if (fundamentals.earningsGrowth > 0.2) {
    score += 15;
    reasons.push(`獲利大幅成長 (${(fundamentals.earningsGrowth * 100).toFixed(1)}%)`);
  } else if (fundamentals.earningsGrowth > 0) {
    score += 5;
  }

  // Valuation (Max 15) - Conservative check
  if (fundamentals.peTrailing > 0 && fundamentals.peTrailing < 15) {
    score += 15;
    reasons.push(`本益比合理偏低 (${fundamentals.peTrailing.toFixed(1)})`);
  } else if (fundamentals.peTrailing > 0 && fundamentals.peTrailing < 25) {
    score += 5;
  }

  // Limit Score
  return { 
    score: Math.min(100, score), 
    reasons 
  };
};

// Main Health Check Logic
export const analyzeStockOperations = (candles, entryPrice, fundamentals = null) => {
  if (!candles || candles.length < 60) {
    return { error: "資料不足，無法分析 (需要至少 60 天數據)" };
  }

  const currentPrice = candles[candles.length - 1].close;
  const lastCandle = candles[candles.length - 1];

  // 1. Calculate Indicators
  const sma5 = calculateSMA(candles, 5);
  const sma20 = calculateSMA(candles, 20);
  const sma60 = calculateSMA(candles, 60);
  const atr = calculateATR(candles, 14);
  const rsi = calculateRSI(candles, 14);
  const { support, resistance } = calculateSupportResistance(candles, 20); // 20-day high/low

  // 2. Determine Trend Score (Win Rate Approximation)
  let score = 50; // Base score
  let reasons = [];

  // Trend Alignment
  if (sma5 > sma20 && sma20 > sma60) {
    score += 20;
    reasons.push("均線多頭排列 (5 > 20 > 60 日均線)，趨勢向上");
  } else if (currentPrice > sma20) {
    score += 10;
    reasons.push("股價站上月線 (20MA)，短期強勢");
  } else if (currentPrice < sma20 && currentPrice < sma60) {
    score -= 20;
    reasons.push("股價跌破月季線，趨勢偏弱");
  }

  // RSI Check
  if (rsi > 70) {
    score -= 5;
    reasons.push("RSI 過熱 (>70)，留意回檔風險");
  } else if (rsi < 30) {
    score += 5;
    reasons.push("RSI 超賣 (<30)，可能反彈");
  } else if (rsi > 50) {
    reasons.push("RSI 強勢區 (>50)");
  }

  // Volume Check (Simple: Compare last vol to avg)
  const avgVol = candles.slice(-5).reduce((a, c) => a + c.volume, 0) / 5;
  if (lastCandle.volume > avgVol * 1.5 && currentPrice > candles[candles.length - 2].close) {
    score += 10;
    reasons.push("近期出量上漲，買盤強勁");
  }
  
  // Fundamental Integration
  let fundamentalResult = null;
  if (fundamentals) {
      fundamentalResult = calculateFundamentalScore(fundamentals);
      // Mix Technical and Fundamental? 
      // User requested "Strategy Suggestion", usually Short Term -> Technical.
      // But we can report total health separately.
      // Let's BOOST technical score slightly if fundamentals are great
      if (fundamentalResult.score > 70) {
          score += 5;
          reasons.push("基本面優良，提供長線保護");
      } else if (fundamentalResult.score < 30) {
          score -= 5;
          reasons.push("基本面偏弱，建議短線操作");
      }
  }

  // Cap Score
  score = Math.min(95, Math.max(5, score));

  // 3. Strategy Suggestions (Stop Loss / Take Profit)
  
  // Logic: 
  // Stop Loss: 
  // If Long (Entry Price exists):
  // Suggest SL at Support level OR Entry - 2*ATR (Volatility Stop)
  // Which one? Use the tighter one but give breathing room?
  // Let's suggest: Max(Support, Entry - 2*ATR) if Entry is close to support?
  // Actually standard is: SL should be below support.
  // Let's simply suggest: "Support Level" and "Volatility Stop"
  
  // We will provide ONE recommended Stop Loss for simplicity
  // If Entry Price > Support: SL = Support - buffer
  // If Entry Price is way above Support, using Support is too much risk. Use ATR trailing.
  
  // ATR Multiplier
  const slBuffer = 2 * atr; 
  let suggestedStopLoss = 0;
  let slReason = "";

  if (entryPrice) {
    const riskDiff = entryPrice - support;
    if (riskDiff > slBuffer) {
      // Too far from support, use Volatility Stop
      suggestedStopLoss = entryPrice - slBuffer;
      slReason = `進場點離支撐太遠，建議使用 2倍 ATR (${slBuffer.toFixed(2)}) 作為移動停損`;
    } else {
      // Entry is near support, use support
      suggestedStopLoss = support * 0.98; // 2% below support to avoid fakeout
      slReason = `近期波段低點支撐 (${support}) 下方`;
    }
  } else {
    // No entry price, advise based on current price
    suggestedStopLoss = currentPrice - slBuffer;
    slReason = "以現價計算 2倍 ATR 波動";
  }

  // Take Profit: Risk Reward 1:1.5 or 1:2
  // Or Resistance level
  let suggestedTakeProfit = 0;
  let tpReason = "";
  
  if (entryPrice) {
      const risk = entryPrice - suggestedStopLoss;
      const targetReward = risk * 2; // 1:2 Ratio
      
      // Check Resistance
      if (resistance > entryPrice && resistance < (entryPrice + targetReward)) {
         // Resistance is closer than 1:2 target, warn user
         suggestedTakeProfit = resistance;
         tpReason = `上方有波段壓力 (${resistance})，建議先觀察能否突破`;
      } else {
         suggestedTakeProfit = entryPrice + targetReward;
         tpReason = `依據 1:2 風險報酬比推算`;
      }
  }

  return {
    score: Math.round(score),
    trend: score > 60 ? 'Bulish' : (score < 40 ? 'Bearish' : 'Neutral'),
    stopLoss: suggestedStopLoss,
    stopLossReason: slReason,
    takeProfit: suggestedTakeProfit,
    takeProfitReason: tpReason,
    reasons: reasons,
    technical: {
        sma5, sma20, sma60, atr, rsi, support, resistance
    },
    // Return fundamental score separately
    fundamental: fundamentalResult
  };
};
