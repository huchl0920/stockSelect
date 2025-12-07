// History API Service
// Data Source: usage of /api/yahoo proxy to query1.finance.yahoo.com

const CACHE = new Map();

// Simple cache for requests
export const getCachedData = (code, range = '2y', interval = '1d') => {
  return CACHE.get(`${code}-${range}-${interval}`);
};

export const fetchStockHistory = async (code, range = '2y', interval = '1d') => {
  const cacheKey = `${code}-${range}-${interval}`;
  
  if (CACHE.has(cacheKey)) {
    return CACHE.get(cacheKey);
  }

  try {
    // Yahoo Finance Ticker format for Taiwan: 2330.TW
    const ticker = `${code}.TW`;
    const url = `/api/yahoo/v8/finance/chart/${ticker}?range=${range}&interval=${interval}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`History API Error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.chart.result?.[0];

    if (!result) {
      throw new Error('查無歷史資料');
    }

    const timestamps = result.timestamp || [];
    const quote = result.indicators.quote[0];
    
    // Parse into standard candle format
    // Filter out incomplete days (null values)
    const candles = timestamps.map((ts, index) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      open: quote.open[index],
      high: quote.high[index],
      low: quote.low[index],
      close: quote.close[index],
      volume: quote.volume[index],
    })).filter(c => c.close !== null && c.close !== undefined);

    // Store in cache
    CACHE.set(cacheKey, candles);

    return candles;
  } catch (error) {
    console.error(`History Fetch Error (${code}):`, error);
    throw new Error(error.message || '無法取得歷史資料');
  }
};

export const preloadStocks = async (stockList, onProgress) => {
  const total = stockList.length;
  let completed = 0;
  const batchSize = 3; // Conservative batch size
  
  for (let i = 0; i < total; i += batchSize) {
    const batch = stockList.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (stock) => {
      try {
        // Pre-fetch 2y daily data (most common use case)
        await fetchStockHistory(stock.code, '2y', '1d');
      } catch (e) {
        // Ignore errors during preload
      } finally {
        completed++;
      }
    }));

    if (onProgress) {
      onProgress(Math.round((completed / total) * 100));
    }
    
    // Tiny delay to breathe
    await new Promise(r => setTimeout(r, 200));
  }
};
