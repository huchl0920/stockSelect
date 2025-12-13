import { useState, useEffect } from 'react';
import { fetchStockHistory as getHistoryWithCache } from '../services/historyApi';
import { fetchStockInfo as getLiveInfo, fetchStockFundamentals } from '../services/api';
import { analyzeStockOperations } from '../utils/analysis';

function HealthCheckPanel({ defaultCode }) {
  const [code, setCode] = useState(defaultCode || '');
  const [entryPrice, setEntryPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [stockName, setStockName] = useState('');

  useEffect(() => {
    if (defaultCode) {
      setCode(defaultCode);
      // Auto fetch name/price to pre-fill?
      // Optional: Just let user type or click
    }
  }, [defaultCode]);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!code) return;

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      // 1. Get Live Data (for current price check)
      const liveData = await getLiveInfo(code);
      setStockName(liveData.name);
      
      // If user provided no entry price, use current price as simulation? 
      // Or just require it? Let's treat empty as "Planning to enter at current price"
      const analysisPrice = entryPrice ? parseFloat(entryPrice) : liveData.price;

      // 2. Get Historical Data (for technicals)
      const candles = await getHistoryWithCache(code, '1y', '1d'); // Need enough history
      
      // 3. Get Fundamentals
      const fundamentals = await fetchStockFundamentals(code);

      // 4. Run Analysis
      const result = analyzeStockOperations(candles, analysisPrice, fundamentals);

      if (result.error) {
        setError(result.error);
      } else {
        setReport({
          ...result,
          currentPrice: liveData.price,
          analysisPrice: analysisPrice
        });
      }

    } catch (err) {
      console.error(err);
      setError(err.message || "發生錯誤，請檢查代號");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl animate-fade-in p-4">
      {/* Input Section */}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 shadow-xl mb-8">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">🩺</span> 操作健檢診斷室
        </h2>
        
        <form onSubmit={handleAnalyze} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-slate-400 text-sm mb-2">股票代號</label>
            <input 
              type="text" 
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="例如 2330"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none text-lg font-mono"
            />
          </div>
          
          <div className="flex-1 w-full">
            <label className="block text-slate-400 text-sm mb-2">
               進場價格 
               <span className="text-xs text-slate-500 ml-2">(留空則以現價計算)</span>
            </label>
            <input 
              type="number" 
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              placeholder="例如 500"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none text-lg font-mono"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full md:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '分析中...' : '開始健檢'}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-center">
          {error}
        </div>
      )}

      {/* Report Section */}
      {report && (
        <div className="space-y-6 animate-slide-up">
           {/* Header */}
           <div className="flex items-center justify-between text-slate-300 border-b border-slate-700 pb-2">
              <div>
                <span className="text-2xl font-bold text-white mr-2">{stockName}</span>
                <span className="font-mono text-slate-400">{code}</span>
              </div>
              <div className="text-sm">
                現價: <span className="text-white font-mono text-lg">{report.currentPrice}</span>
                <span className="mx-2">|</span>
                計算基準: <span className="text-yellow-400 font-mono">{report.analysisPrice}</span>
              </div>
           </div>

           {/* Score & Main Verdict */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Win Rate / Score */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 relative overflow-hidden group">
                 <div className={`absolute top-0 left-0 w-2 h-full ${report.score >= 60 ? 'bg-green-500' : (report.score >= 40 ? 'bg-yellow-500' : 'bg-red-500')}`} />
                 <h3 className="text-slate-400 text-sm font-medium mb-1">健康度評分 (勝率預估)</h3>
                 <div className="flex items-end gap-2">
                    <span className={`text-5xl font-black ${report.score >= 60 ? 'text-green-400' : (report.score >= 40 ? 'text-yellow-400' : 'text-red-400')}`}>
                      {report.score}
                    </span>
                    <span className="text-slate-500 text-sm mb-2">/ 100</span>
                 </div>
                 <div className="mt-4 text-sm text-slate-300">
                    趨勢判定: 
                    <span className={`ml-2 font-bold ${report.trend === 'Bulish' ? 'text-green-400' : (report.trend === 'Bearish' ? 'text-red-400' : 'text-yellow-400')}`}>
                      {report.trend === 'Bulish' ? '多頭格局' : (report.trend === 'Bearish' ? '空頭格局' : '盤整中')}
                    </span>
                 </div>
              </div>

              {/* Stop Loss */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 md:col-span-2 flex flex-col justify-center">
                 <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-slate-400 text-sm font-medium">建議停損點 (Stop Loss)</h3>
                      <div className="text-3xl font-mono text-red-400 mt-1">{report.stopLoss.toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                       <h3 className="text-slate-400 text-sm font-medium">建議停利點 (Take Profit)</h3>
                       <div className="text-3xl font-mono text-green-400 mt-1">{report.takeProfit.toFixed(2)}</div>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4 text-xs bg-slate-900/50 p-3 rounded-lg">
                    <div>
                       <span className="text-red-300 block mb-1">🔴 停損理由:</span>
                       <span className="text-slate-400">{report.stopLossReason}</span>
                    </div>
                    <div>
                       <span className="text-green-300 block mb-1">🟢 停利理由:</span>
                       <span className="text-slate-400">{report.takeProfitReason}</span>
                    </div>
                 </div>
              </div>
           </div>

           {/* Fundamental Analysis Card */}
           <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
             <h3 className="text-white font-bold mb-4 flex items-center justify-between">
                <span className="flex items-center">
                  <span className="text-xl mr-2">📊</span> 基本面健檢 (Financial Health)
                </span>
                {report.fundamental ? (
                  <span className={`px-3 py-1 rounded text-xs font-bold ${report.fundamental.score > 70 ? 'bg-green-500/20 text-green-400' : (report.fundamental.score < 40 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400')}`}>
                     評分: {report.fundamental.score} / 100
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 border border-slate-600 px-2 py-1 rounded">
                    暫無資料
                  </span>
                )}
             </h3>
             
             {report.fundamental ? (
               <>
                 {/* Metrics Grid */}
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-slate-900/50 p-3 rounded-lg">
                       <div className="text-slate-500 text-xs mb-1">ROE (股東權益報酬率)</div>
                       <div className={`text-lg font-mono font-bold ${report.fundamental.reasons.some(r=>r.includes('ROE')) ? 'text-green-400' : 'text-slate-200'}`}>
                          {report.fundamental.reasons.find(r=>r.includes('ROE')) ? 'High' : 'Normal'}
                       </div>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-lg">
                       <div className="text-slate-500 text-xs mb-1">營收成長 (YoY)</div>
                       <div className={`text-lg font-mono font-bold ${report.fundamental.reasons.some(r=>r.includes('營收')) ? 'text-green-400' : 'text-slate-200'}`}>
                          {report.fundamental.reasons.find(r=>r.includes('營收')) ? 'Strong' : 'Stable'}
                       </div>
                    </div>
                 </div>

                 {/* Fundamental Reasons */}
                 <div className="space-y-2">
                    {report.fundamental.reasons.map((r, i) => (
                       <div key={i} className="flex items-center text-sm text-slate-300">
                          <span className="mr-2 text-green-500">✔</span> {r}
                       </div>
                    ))}
                    {report.fundamental.reasons.length === 0 && (
                       <div className="text-slate-500 text-sm italic">無顯著基本面亮點</div>
                    )}
                 </div>
               </>
             ) : (
               <div className="text-center py-6 text-slate-500 bg-slate-900/30 rounded-lg border border-dashed border-slate-700">
                  <p className="mb-2">⚠️ 無法取得基本面資訊</p>
                  <p className="text-xs text-slate-600">可能是資料來源連線問題或該個股缺乏財務數據</p>
               </div>
             )}
           </div>

           {/* Rationale List */}
           <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-white font-bold mb-4 flex items-center">
                 <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                 診斷詳細理由
              </h3>
              <div className="space-y-3">
                 {report.reasons.map((reason, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
                       <div className="mt-1">
                          {reason.includes('看多') || reason.includes('上漲') || reason.includes('強勢') || reason.includes('多頭') || reason.includes('反彈') 
                            ? <span className="text-green-500">✅</span> 
                            : (reason.includes('看空') || reason.includes('下跌') || reason.includes('弱') || reason.includes('風險') 
                                ? <span className="text-red-500">⚠️</span>
                                : <span className="text-blue-500">ℹ️</span>)
                          }
                       </div>
                       <div className="text-slate-300 text-sm">
                          {reason}
                       </div>
                    </div>
                 ))}
                 
                 {report.reasons.length === 0 && (
                    <div className="text-slate-500 italic">尚無明顯技術特徵</div>
                 )}
              </div>
           </div>
           
           {/* Disclaimer */}
           <div className="text-center text-[10px] text-slate-600 mt-8">
              免責聲明：本功能僅為技術分析輔助工具，不代表買賣建議。投資均有風險，請獨立判斷。
           </div>
        </div>
      )}
    </div>
  );
}

export default HealthCheckPanel;
