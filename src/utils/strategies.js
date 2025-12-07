// Technical Indicators and Strategy Logic

// Helper: Calculate SMA
export const calculateSMA = (data, period) => {
  const sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(null);
      continue;
    }
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, curr) => acc + curr.close, 0);
    sma.push(sum / period);
  }
  return sma;
};

// Helper: Calculate RSI
export const calculateRSI = (data, period = 14) => {
  const rsi = [];
  let gains = 0;
  let losses = 0;

  // First RSI
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // Fill initial nulls
  for (let i = 0; i < period; i++) rsi.push(null);
  
  rsi.push(100 - (100 / (1 + avgGain / (avgLoss || 1))));

  // Smoothed RSI
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    
    rsi.push(100 - (100 / (1 + avgGain / (avgLoss || 1))));
  }

  return rsi;
};

// Strategy 1: MA Crossover (Golden Cross)
// Buy when short MA crosses above long MA
// Sell when short MA crosses below long MA
export const runStrategyMA = (data, shortPeriod = 5, longPeriod = 20) => {
  const smaShort = calculateSMA(data, shortPeriod);
  const smaLong = calculateSMA(data, longPeriod);
  
  const trades = [];
  let position = null; // { date, price }
  let capital = 100000; // Start with 100k
  const log = [];

  // Need enough data for long MA
  for (let i = longPeriod; i < data.length; i++) {
    const today = data[i];
    const prevShort = smaShort[i-1];
    const prevLong = smaLong[i-1];
    const currShort = smaShort[i];
    const currLong = smaLong[i];

    // Buy Signal: Golden Cross
    if (!position && prevShort <= prevLong && currShort > currLong) {
      position = { date: today.date, price: today.close };
      log.push({ type: 'BUY', date: today.date, price: today.close, reason: 'Golden Cross' });
    }
    // Sell Signal: Death Cross
    else if (position && prevShort >= prevLong && currShort < currLong) {
      const pnl = (today.close - position.price) / position.price;
      const profit = Math.round(capital * pnl);
      capital += profit;
      
      trades.push({
        entryDate: position.date,
        exitDate: today.date,
        entryPrice: position.price,
        exitPrice: today.close,
        returnPercent: pnl * 100,
        profit: profit
      });
      
      log.push({ type: 'SELL', date: today.date, price: today.close, reason: 'Death Cross', pnl: pnl*100 });
      position = null;
    }
  }

  const winTrades = trades.filter(t => t.returnPercent > 0);
  const winRate = trades.length > 0 ? (winTrades.length / trades.length) * 100 : 0;
  const totalReturn = ((capital - 100000) / 100000) * 100;
  const avgTradeReturn = trades.length > 0 ? trades.reduce((acc, t) => acc + t.returnPercent, 0) / trades.length : 0;

  return { trades, winRate, totalReturn, avgTradeReturn, log };
};

// Strategy 2: RSI Reversal
// Buy when RSI < 30 (Oversold)
// Sell when RSI > 70 (Overbought)
export const runStrategyRSI = (data, period = 14) => {
  const rsi = calculateRSI(data, period);
  const trades = [];
  let position = null;
  let capital = 100000;
  const log = [];

  for (let i = period; i < data.length; i++) {
    const today = data[i];
    const currRSI = rsi[i];

    if (!position && currRSI < 30) {
       position = { date: today.date, price: today.close };
       log.push({ type: 'BUY', date: today.date, price: today.close, reason: `RSI ${currRSI.toFixed(1)} < 30` });
    }
    else if (position && currRSI > 70) {
      const pnl = (today.close - position.price) / position.price;
      const profit = Math.round(capital * pnl);
      capital += profit;
      
      trades.push({
        entryDate: position.date,
        exitDate: today.date,
        entryPrice: position.price,
        exitPrice: today.close,
        returnPercent: pnl * 100,
        profit: profit
      });
      
      log.push({ type: 'SELL', date: today.date, price: today.close, reason: `RSI ${currRSI.toFixed(1)} > 70`, pnl: pnl*100 });
      position = null;
    }
  }

  const winTrades = trades.filter(t => t.returnPercent > 0);
  const winRate = trades.length > 0 ? (winTrades.length / trades.length) * 100 : 0;
  const totalReturn = ((capital - 100000) / 100000) * 100;
  const avgTradeReturn = trades.length > 0 ? trades.reduce((acc, t) => acc + t.returnPercent, 0) / trades.length : 0;

  return { trades, winRate, totalReturn, avgTradeReturn, log };
};

// Strategy 3: Breakout 2-Year High
// Buy when price breaks the highest high of the lookback period
export const runStrategyBreakout = (data, lookbackDays = 500) => { // ~2 years trading days
  const trades = [];
  let position = null;
  let capital = 100000;
  const log = [];

  // Need history to establish high
  // Start after lookback period or at least reasonable time
  const startIdx = Math.min(250, data.length - 10); 

  for (let i = startIdx; i < data.length; i++) {
    const today = data[i];
    
    // Calculate Max High of previous N days
    // Slice end is exclusive, so i is not included in history check (we are checking if Today breaks *past* history)
    const historyStart = Math.max(0, i - lookbackDays);
    const historyData = data.slice(historyStart, i);
    
    const maxHigh = Math.max(...historyData.map(d => d.high));
    
    // Buy Signal: Today's Close > Previous Max High
    if (!position && today.close > maxHigh) {
       position = { date: today.date, price: today.close };
       log.push({ type: 'BUY', date: today.date, price: today.close, reason: `Breakout High ${maxHigh}` });
    }
    // Sell Signal: Stop Loss (e.g. -10%) or Trailing Stop could be added here. 
    // For simplicity, let's Sell if it drops below 20-day MA (Trend Reversal) to lock profits or cut loss
    else if (position) {
       // Check MA20
       const ma20 = calculateSMA(data.slice(0, i+1), 20).pop();
       if (today.close < ma20) {
          const pnl = (today.close - position.price) / position.price;
          const profit = Math.round(capital * pnl);
          capital += profit;
          
          trades.push({
            entryDate: position.date,
            exitDate: today.date,
            entryPrice: position.price,
            exitPrice: today.close,
            returnPercent: pnl * 100,
            profit: profit
          });
          
          log.push({ type: 'SELL', date: today.date, price: today.close, reason: `Below MA20`, pnl: pnl*100 });
          position = null;
       }
    }
  }

  const winTrades = trades.filter(t => t.returnPercent > 0);
  const winRate = trades.length > 0 ? (winTrades.length / trades.length) * 100 : 0;
  const totalReturn = ((capital - 100000) / 100000) * 100;
  const avgTradeReturn = trades.length > 0 ? trades.reduce((acc, t) => acc + t.returnPercent, 0) / trades.length : 0;

  return { trades, winRate, totalReturn, avgTradeReturn, log };
};

// Strategy 4: Bollinger Band Reversion
// Buy when price touches lower band, Sell when price touches upper band
export const runStrategyBollinger = (data, period = 20, stdDev = 2) => {
  const sma = calculateSMA(data, period);
  const upperBand = [];
  const lowerBand = [];
  
  // Calculate Bands
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upperBand.push(null);
      lowerBand.push(null);
      continue;
    }
    const slice = data.slice(i - period + 1, i + 1);
    const mean = sma[i];
    const sumSqDiff = slice.reduce((acc, curr) => acc + Math.pow(curr.close - mean, 2), 0);
    const std = Math.sqrt(sumSqDiff / period);
    
    upperBand.push(mean + std * stdDev);
    lowerBand.push(mean - std * stdDev);
  }

  const trades = [];
  let position = null;
  let capital = 100000;
  const log = [];

  for (let i = period; i < data.length; i++) {
    const today = data[i];
    const upper = upperBand[i];
    const lower = lowerBand[i];

    // Buy Signal: Close < Lower Band (Oversold)
    if (!position && today.close < lower) {
       position = { date: today.date, price: today.close };
       log.push({ type: 'BUY', date: today.date, price: today.close, reason: `Lower Band Touch ${lower.toFixed(1)}` });
    }
    // Sell Signal: Close > Upper Band (Overbought)
    // Optional: Could sell at Mean (SMA20) for conservative profit
    else if (position && today.close > upper) {
      const pnl = (today.close - position.price) / position.price;
      const profit = Math.round(capital * pnl);
      capital += profit;
      
      trades.push({
        entryDate: position.date,
        exitDate: today.date,
        entryPrice: position.price,
        exitPrice: today.close,
        returnPercent: pnl * 100,
        profit: profit
      });
      
      log.push({ type: 'SELL', date: today.date, price: today.close, reason: `Upper Band Touch ${upper.toFixed(1)}`, pnl: pnl*100 });
      position = null;
    }
  }

  const winTrades = trades.filter(t => t.returnPercent > 0);
  const winRate = trades.length > 0 ? (winTrades.length / trades.length) * 100 : 0;
  const totalReturn = ((capital - 100000) / 100000) * 100;
  const avgTradeReturn = trades.length > 0 ? trades.reduce((acc, t) => acc + t.returnPercent, 0) / trades.length : 0;

  return { trades, winRate, totalReturn, avgTradeReturn, log };
};

// Helper: Calculate EMA
const calculateEMA = (data, period) => {
  const k = 2 / (period + 1);
  const ema = [data[0].close];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i].close * k + ema[i - 1] * (1 - k));
  }
  return ema;
};

// Helper: Calculate MACD
const calculateMACD = (data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  const emaFast = calculateEMA(data, fastPeriod);
  const emaSlow = calculateEMA(data, slowPeriod);
  const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
  
  // Calculate Signal Line (EMA of MACD Line)
  const k = 2 / (signalPeriod + 1);
  const signalLine = [];
  // Skip initial period where Slow EMA is stabilizing, but here we just compute all
  signalLine[0] = macdLine[0];
  for(let i=1; i<macdLine.length; i++){
      signalLine.push(macdLine[i] * k + signalLine[i-1] * (1-k));
  }
  
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macdLine, signalLine, histogram };
};

// Helper: Calculate ATR
const calculateATR = (data, period = 14) => {
  const tr = [0];
  for(let i=1; i<data.length; i++){
     const high = data[i].high;
     const low = data[i].low;
     const prevClose = data[i-1].close;
     const val = Math.max(high-low, Math.abs(high-prevClose), Math.abs(low-prevClose));
     tr.push(val);
  }
  
  // Wilder's Smoothing
  const atr = [tr[0]];
  for(let i=1; i<tr.length; i++){
     atr.push((atr[i-1] * (period-1) + tr[i]) / period);
  }
  return atr;
};

// Helper: Calculate Supertrend
const calculateSupertrend = (data, period = 10, multiplier = 3) => {
  const atr = calculateATR(data, period);
  const supertrend = []; // { value, direction: 1 (Up) or -1 (Down) }
  const basicUpperBand = [];
  const basicLowerBand = [];
  const finalUpperBand = [0];
  const finalLowerBand = [0];
  
  // Initialize
  for(let i=0; i<data.length; i++) {
     const hl2 = (data[i].high + data[i].low) / 2;
     const currentATR = atr[i];
     
     basicUpperBand.push(hl2 + (multiplier * currentATR));
     basicLowerBand.push(hl2 - (multiplier * currentATR));
     
     if (i === 0) {
        supertrend.push({ value: basicLowerBand[0], direction: 1 });
        continue;
     }

     // Final Upper Band
     if (basicUpperBand[i] < finalUpperBand[i-1] || data[i-1].close > finalUpperBand[i-1]) {
        finalUpperBand.push(basicUpperBand[i]);
     } else {
        finalUpperBand.push(finalUpperBand[i-1]);
     }

     // Final Lower Band
     if (basicLowerBand[i] > finalLowerBand[i-1] || data[i-1].close < finalLowerBand[i-1]) {
        finalLowerBand.push(basicLowerBand[i]);
     } else {
        finalLowerBand.push(finalLowerBand[i-1]);
     }
     
     // Trend Direction
     let direction = supertrend[i-1].direction;
     let value = supertrend[i-1].value;
     
     if (direction === 1) { // Prev Uptrend
        if (data[i].close < finalLowerBand[i]) {
           direction = -1; // Switch to Downtrend
           value = finalUpperBand[i];
        } else {
           value = finalLowerBand[i];
        }
     } else { // Prev Downtrend
        if (data[i].close > finalUpperBand[i]) {
           direction = 1; // Switch to Uptrend
           value = finalLowerBand[i];
        } else {
           value = finalUpperBand[i];
        }
     }
     
     supertrend.push({ value, direction });
  }
  return supertrend;
};

// Strategy 5: MACD
export const runStrategyMACD = (data) => {
  const { macdLine, signalLine } = calculateMACD(data);
  const trades = [];
  let position = null;
  let capital = 100000;
  const log = [];

  for (let i = 26; i < data.length; i++) {
    const today = data[i];
    
    // Golden Cross
    if (!position && macdLine[i-1] <= signalLine[i-1] && macdLine[i] > signalLine[i]) {
       position = { date: today.date, price: today.close };
       log.push({ type: 'BUY', date: today.date, price: today.close, reason: `MACD Cross` });
    }
    // Death Cross
    else if (position && macdLine[i-1] >= signalLine[i-1] && macdLine[i] < signalLine[i]) {
      const pnl = (today.close - position.price) / position.price;
      const profit = Math.round(capital * pnl);
      capital += profit;
      trades.push({
        entryDate: position.date,
        exitDate: today.date,
        entryPrice: position.price,
        exitPrice: today.close,
        returnPercent: pnl * 100,
        profit: profit
      });
      log.push({ type: 'SELL', date: today.date, price: today.close, reason: `MACD Death Cross`, pnl: pnl*100 });
      position = null;
    }
  }

  const winTrades = trades.filter(t => t.returnPercent > 0);
  const winRate = trades.length > 0 ? (winTrades.length / trades.length) * 100 : 0;
  const totalReturn = ((capital - 100000) / 100000) * 100;
  const avgTradeReturn = trades.length > 0 ? trades.reduce((acc, t) => acc + t.returnPercent, 0) / trades.length : 0;

  return { trades, winRate, totalReturn, avgTradeReturn, log };
};

// Strategy 6: Supertrend
export const runStrategySupertrend = (data) => {
  const st = calculateSupertrend(data);
  const trades = [];
  let position = null;
  let capital = 100000;
  const log = [];

  for (let i = 10; i < data.length; i++) {
    const today = data[i];
    const prevTrend = st[i-1].direction;
    const currTrend = st[i].direction;
    
    // Trend Flip Up
    if (!position && prevTrend === -1 && currTrend === 1) {
       position = { date: today.date, price: today.close };
       log.push({ type: 'BUY', date: today.date, price: today.close, reason: `Supertrend Bullish` });
    }
    // Trend Flip Down
    else if (position && prevTrend === 1 && currTrend === -1) {
      const pnl = (today.close - position.price) / position.price;
      const profit = Math.round(capital * pnl);
      capital += profit;
      trades.push({
        entryDate: position.date,
        exitDate: today.date,
        entryPrice: position.price,
        exitPrice: today.close,
        returnPercent: pnl * 100,
        profit: profit
      });
      log.push({ type: 'SELL', date: today.date, price: today.close, reason: `Supertrend Bearish`, pnl: pnl*100 });
      position = null;
    }
  }

  const winTrades = trades.filter(t => t.returnPercent > 0);
  const winRate = trades.length > 0 ? (winTrades.length / trades.length) * 100 : 0;
  const totalReturn = ((capital - 100000) / 100000) * 100;
  const avgTradeReturn = trades.length > 0 ? trades.reduce((acc, t) => acc + t.returnPercent, 0) / trades.length : 0;

  return { trades, winRate, totalReturn, avgTradeReturn, log };
};

// NEW: Analyze Signals & Predictions
export const analyzeSignal = (data, strategyType) => {
  const result = { signal: null, prediction: null, details: '', suggestedEntry: null, suggestedTarget: null, suggestedStopLoss: null };
  
  if (!data || data.length < 60) return result; // Require more data for targets (e.g. SMA60)

  const lastIndex = data.length - 1;
  const today = data[lastIndex];

  // Common Calculations for Targets
  const sma60Array = calculateSMA(data, 60); // Annual/Quarterly line often resistance
  const sma60 = sma60Array[lastIndex];
  
  // Previous 60 days High
  const historyStart60 = Math.max(0, lastIndex - 60);
  const maxHigh60 = Math.max(...data.slice(historyStart60, lastIndex).map(d => d.high));
  
  // Recent 10 days Low (Swing Low support)
  const historyStart10 = Math.max(0, lastIndex - 10);
  const minLow10 = Math.min(...data.slice(historyStart10, lastIndex + 1).map(d => d.low));

  if (strategyType === 'MA') {
    const smaShort = calculateSMA(data, 5);
    const smaLong = calculateSMA(data, 20);
    
    // Target: Previous 60-day High (Resistance)
    result.suggestedTarget = maxHigh60;
    // Entry: Current Price (approximating crossover point)
    result.suggestedEntry = today.close;
    // Stop: Recent Swing Low of 10 days
    result.suggestedStopLoss = minLow10;

    const prevShort = smaShort[lastIndex - 1];
    const prevLong = smaLong[lastIndex - 1];
    const currShort = smaShort[lastIndex];
    const currLong = smaLong[lastIndex];
    
    // 1. Just Matched (Live Signal)
    if (prevShort <= prevLong && currShort > currLong) {
      result.signal = 'BUY';
      result.details = 'Golden Cross Today';
    } else if (prevShort >= prevLong && currShort < currLong) {
       result.signal = 'SELL';
       result.details = 'Death Cross Today';
    } 
    // 2. Approaching (Prediction)
    else {
      if (currShort < currLong) {
        const gap = (currLong - currShort) / currLong;
        const prevGap = (prevLong - prevShort) / prevLong;
        if (gap < 0.02 && gap < prevGap) {
          result.prediction = 'APPROACHING_BUY';
          result.details = `MA Gap: ${(gap*100).toFixed(2)}%`;
        }
      }
    }

  } else if (strategyType === 'RSI') {
    const rsi = calculateRSI(data, 14);
    const currRSI = rsi[lastIndex];
    const prevRSI = rsi[lastIndex - 1];
    
    // Target: Revert to Mean (SMA 60)
    result.suggestedTarget = sma60;
    // Entry: Current Price
    result.suggestedEntry = today.close;
    // Stop: Recent Low
    result.suggestedStopLoss = minLow10;

    // 1. Just Matched
    if (prevRSI >= 30 && currRSI < 30) {
       result.signal = 'BUY';
       result.details = `RSI < 30 (${currRSI.toFixed(1)})`;
    } else if (prevRSI <= 70 && currRSI > 70) {
       result.signal = 'SELL';
       result.details = `RSI > 70 (${currRSI.toFixed(1)})`;
    }
    // 2. Approaching
    else {
      if (currRSI >= 30 && currRSI <= 38) {
         result.prediction = 'APPROACHING_BUY';
         result.details = `RSI: ${currRSI.toFixed(1)}`;
      }
      else if (currRSI >= 62 && currRSI <= 70) {
         result.prediction = 'APPROACHING_SELL';
         result.details = `RSI: ${currRSI.toFixed(1)}`;
      }
    }
  } else if (strategyType === 'BREAKOUT') {
     const lookbackDays = 500; // 2 Years
     const historyStart = Math.max(0, lastIndex - lookbackDays);
     const historyData = data.slice(historyStart, lastIndex); // Exclude today
     
     const maxHigh = Math.max(...historyData.map(d => d.high));
     
     result.suggestedEntry = maxHigh; // Breakout Level
     result.suggestedTarget = maxHigh * 1.2; // +20% Blue Sky Target
     result.suggestedStopLoss = maxHigh * 0.93; // -7% from breakout point
     
     // 1. Just Matched: Today BROKE the high
     if (today.close > maxHigh && data[lastIndex-1].close <= maxHigh) {
        result.signal = 'BUY';
        result.details = `New High! > ${maxHigh}`;
     }
     // 2. Approaching: Within 3% of High
     else if (today.close <= maxHigh) {
        const dist = (maxHigh - today.close) / maxHigh;
        if (dist < 0.03) {
           result.prediction = 'APPROACHING_BUY';
           result.details = `Near High (-${(dist*100).toFixed(1)}%)`;
        }
     }
  } else if (strategyType === 'BOLLINGER') {
     const period = 20;
     const stdDev = 2;
     // Calculate today's band (requires 20 days)
     const slice = data.slice(lastIndex - period + 1, lastIndex + 1);
     const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
     const mean = sum / period;
     const sumSqDiff = slice.reduce((acc, curr) => acc + Math.pow(curr.close - mean, 2), 0);
     const std = Math.sqrt(sumSqDiff / period);
     
     const upper = mean + std * stdDev;
     const lower = mean - std * stdDev;
     
     result.suggestedEntry = lower;
     result.suggestedTarget = upper;
     result.suggestedStopLoss = lower * 0.97; // 3% below lower band
     
     // 1. Just Matched: Touched Lower Today
     if (today.low <= lower) {
        result.signal = 'BUY';
        result.details = `Touched Lower ${lower.toFixed(1)}`;
     } else if (today.high >= upper) {
        result.signal = 'SELL';
        result.details = `Touched Upper ${upper.toFixed(1)}`;
     }
     // 2. Approaching: Within 1.5% of Lower Band
     else {
        const dist = (today.close - lower) / lower;
        if (dist < 0.015 && dist > 0) { // Positive dist means above lower band
           result.prediction = 'APPROACHING_BUY';
           result.details = `Near Lower (${(dist*100).toFixed(1)}%)`;
        }
     }
  } else if (strategyType === 'MACD') {
     const { macdLine, signalLine } = calculateMACD(data);
     const currMACD = macdLine[lastIndex];
     const currSignal = signalLine[lastIndex];
     const prevMACD = macdLine[lastIndex-1];
     const prevSignal = signalLine[lastIndex-1];
     
     result.suggestedEntry = today.close;
     result.suggestedTarget = maxHigh60;
     result.suggestedStopLoss = minLow10;

     // Gold Cross
     if (prevMACD <= prevSignal && currMACD > currSignal) {
        result.signal = 'BUY';
        result.details = 'MACD Cross Up';
     } else if (prevMACD >= prevSignal && currMACD < currSignal) {
        result.signal = 'SELL';
        result.details = 'MACD Cross Down';
     }
     else {
        // Approaching
        const diff = currSignal - currMACD;
        if (currMACD < currSignal && diff < 0.05 && diff < (signalLine[lastIndex-1]-macdLine[lastIndex-1])) {
           result.prediction = 'APPROACHING_BUY';
           result.details = 'MACD Converging';
        }
     }
  } else if (strategyType === 'SUPERTREND') {
     const st = calculateSupertrend(data);
     const curr = st[lastIndex];
     const prev = st[lastIndex-1];
     
     // Support/Resistance from Supertrend
     const stopLevel = curr.value;
     
     result.suggestedStopLoss = stopLevel;
     result.suggestedEntry = today.close;
     // Target: Risk 1:1.5 or 2? Let's say Distance to Stop * 2
     const risk = Math.abs(today.close - stopLevel);
     result.suggestedTarget = today.close + (risk * 2);

     if (prev.direction === -1 && curr.direction === 1) {
        result.signal = 'BUY';
        result.details = 'Trend Flip Bullish';
     } else if (prev.direction === 1 && curr.direction === -1) {
        result.signal = 'SELL';
        result.details = 'Trend Flip Bearish';
     } else {
        if (curr.direction === 1) {
           // In Uptrend, watch for pullback
           const dist = (today.close - stopLevel) / today.close;
           if (dist < 0.02) {
              result.prediction = 'APPROACHING_BUY'; // Buy on Dip near Support
              result.details = 'Near Supertrend Support';
           }
        }
     }
  }

  return result;
};
