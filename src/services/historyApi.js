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
    // Helper to fetch valid data
    const fetchYahoo = async (suffix) => {
      const ticker = `${code}${suffix}`;
      const url = `/api/yahoo/v8/finance/chart/${ticker}?range=${range}&interval=${interval}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      const result = json.chart.result?.[0];
      if (!result) return null;
      return result;
    }

    // Attempt 1: Try .TW (TSE)
    let result = await fetchYahoo('.TW');
    
    // Attempt 2: Try .TWO (OTC) if .TW failed
    if (!result) {
        result = await fetchYahoo('.TWO');
    }

    if (!result) {
      throw new Error('查無歷史資料 (404 Not Found)');
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
