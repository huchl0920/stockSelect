// History API Service
// Data Source: usage of /api/yahoo proxy to query1.finance.yahoo.com

export const fetchStockHistory = async (code, range = '2y', interval = '1d') => {
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

    return candles;
  } catch (error) {
    console.error("History Fetch Error:", error);
    throw new Error(error.message || '無法取得歷史資料');
  }
};
