// Real TWSE API Service
// Data Source: usage of /api/stock proxy to mis.twse.com.tw

export const fetchStockInfo = async (code) => {
  try {
    // Query both TSE (Listed) and OTC (Over-the-Counter) to ensure we find it.
    // timestamp is added to prevent caching
    const timestamp = new Date().getTime();
    const url = `/api/stock/api/getStockInfo.jsp?ex_ch=tse_${code}.tw|otc_${code}.tw&json=1&delay=0&_=${timestamp}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.msgArray || data.msgArray.length === 0) {
      throw new Error('查無此股票代號');
    }

    // parsing the first valid result
    const stockData = data.msgArray[0];

    // TWSE API fields:
    // z: Price (Most recent trade)
    // y: Yesterday's Close
    // v: Volume (Accumulated)
    // n: Name
    // o: Open
    // h: High
    // l: Low
    
    // Sometimes 'z' is '-' if no trade happened yet (or pre-market). 
    // We can fallback to 'y' or handle it. For now, let's try to parse 'z'.
    let currentPrice = parseFloat(stockData.z);
    
    // If currentPrice is NaN (e.g. '-'), try to find a valid price or use yesterday's close as fallback for display
    // But better to check best bid/ask if 'z' is missing, roughly. 
    // For simplicity, if 'z' is '-', we assume price hasn't moved or rely on 'y' but mark it clearly? 
    // Let's fallback to Yesterday Close but maybe we can do better.
    // Actually, if 'z' is '-', it usually means no trades yet today.
    if (isNaN(currentPrice)) {
       // If no trade price, typically you might check 'b' (buy price) or just show yesterday's close 
       // but user wants "latest".
       // Let's use 'y' (yesterday) if 'z' is invalid, but calculate change as 0.
       if (!isNaN(parseFloat(stockData.y))) {
           currentPrice = parseFloat(stockData.y);
       } else {
           // Extremely rare case
           currentPrice = 0;
       }
    }

    const yesterdayClose = parseFloat(stockData.y);
    const volume = parseInt(stockData.v) || 0;
    const name = stockData.n;
    
    // Calculate Change
    const change = currentPrice - yesterdayClose;
    const changePercent = (change / yesterdayClose) * 100;

    return {
      code: stockData.c,
      name: name,
      price: currentPrice,
      change: change,
      changePercent: changePercent,
      volume: volume,
    };

  } catch (error) {
    console.error("Stock Fetch Error:", error);
    throw new Error(error.message || '無法取得股票資訊');
  }
};

export const fetchCompanyProfile = async (code) => {
  try {
    const fetchProfile = async (suffix) => {
       const ticker = `${code}${suffix}`;
       const url = `/api/yahoo/v10/finance/quoteSummary/${ticker}?modules=assetProfile`;
       const res = await fetch(url);
       if (!res.ok) return null;
       const data = await res.json();
       return data.quoteSummary?.result?.[0]?.assetProfile;
    }

    let profile = await fetchProfile('.TW');
    if (!profile) {
       profile = await fetchProfile('.TWO');
    }

    if (!profile) return null;

    return {
      sector: profile.sector,
      industry: profile.industry,
      description: profile.longBusinessSummary,
      website: profile.website
    };
  } catch (err) {
    console.error("Profile Fetch Error:", err);
    return null;
  }
};
