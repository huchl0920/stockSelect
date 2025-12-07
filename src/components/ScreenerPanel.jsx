import { useState } from 'react';
import { POPULAR_STOCKS } from '../data/stocks';
import { fetchStockHistory } from '../services/historyApi';
import { runStrategyMA, runStrategyRSI, runStrategyBreakout, runStrategyBollinger, analyzeSignal } from '../utils/strategies';

const ScreenerPanel = ({ onSelectStock }) => {
  const [strategy, setStrategy] = useState('MA');
  const [range, setRange] = useState('2y');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSignalsOnly, setShowSignalsOnly] = useState(false);

  const runScreening = async () => {
    setLoading(true);
    setResults([]);
    setProgress(0);
    const tempResults = [];
    
    // Batch processing
    const batchSize = 5; 
    
    for (let i = 0; i < POPULAR_STOCKS.length; i += batchSize) {
      const batch = POPULAR_STOCKS.slice(i, i + batchSize);
      
      const promises = batch.map(async (stock) => {
        try {
          const data = await fetchStockHistory(stock.code, range);
          let stats;
          if (strategy === 'MA') {
             stats = runStrategyMA(data);
          } else if (strategy === 'RSI') {
             stats = runStrategyRSI(data);
          } else if (strategy === 'BREAKOUT') {
             stats = runStrategyBreakout(data);
          } else {
             stats = runStrategyBollinger(data);
          }

          // Analyze Signal (Today's state)
          const signalAnalysis = analyzeSignal(data, strategy);
          
          return {
             ...stock,
             winRate: stats.winRate,
             totalReturn: stats.totalReturn,
             tradeCount: stats.trades.length,
             signal: signalAnalysis.signal,          // 'BUY', 'SELL', null
             prediction: signalAnalysis.prediction,  // 'APPROACHING_BUY', etc
             details: signalAnalysis.details
          };
        } catch (err) {
          return null;
        }
      });

      const batchComp = await Promise.all(promises);
      tempResults.push(...batchComp.filter(r => r !== null));
      setProgress(Math.round(((i + batch.length) / POPULAR_STOCKS.length) * 100));
      
      await new Promise(r => setTimeout(r, 200));
    }

    // Sort: Signals First, then Prediction, then Total Return
    tempResults.sort((a, b) => {
       // Priority 1: Has Signal
       if (a.signal && !b.signal) return -1;
       if (!a.signal && b.signal) return 1;
       
       // Priority 2: Has Prediction
       if (a.prediction && !b.prediction) return -1;
       if (!a.prediction && b.prediction) return 1;

       // Priority 3: Total Return
       return b.totalReturn - a.totalReturn;
    });
    
    setResults(tempResults);
    setLoading(false);
  };

  const filteredResults = showSignalsOnly 
    ? results.filter(r => r.signal || r.prediction) 
    : results;

  return (
    <div className="w-full max-w-4xl p-6 bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl shadow-xl mt-6">
       <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span className="text-green-400">🤖</span> 智慧選股 (Smart Screener)
          </h3>
          <div className="flex items-center gap-2">
             <input 
               type="checkbox" 
               id="signalsOnly"
               checked={showSignalsOnly}
               onChange={(e) => setShowSignalsOnly(e.target.checked)}
               className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500"
             />
             <label htmlFor="signalsOnly" className="text-sm text-slate-300 cursor-pointer select-none">
                只顯示訊號 (Signals Only)
             </label>
          </div>
       </div>
      
      <div className="flex flex-wrap gap-4 items-end mb-6">
         <div>
           <label className="block text-sm text-slate-400 mb-1">使用策略</label>
           <select 
             value={strategy} 
             onChange={(e) => setStrategy(e.target.value)}
             className="bg-slate-700 text-slate-200 border border-slate-600 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
           >
             <option value="MA">黃金交叉 (MA Cross)</option>
             <option value="RSI">RSI 反轉 (RSI Reversal)</option>
             <option value="BREAKOUT">突破近兩年新高 (Breakout 2Y)</option>
             <option value="BOLLINGER">布林通道回歸 (High Win Rate)</option>
           </select>
         </div>

         <button 
          onClick={runScreening}
          disabled={loading}
          className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? '掃描中...' : '開始篩選'}
        </button>
      </div>

      {loading && (
        <div className="mb-6">
           <div className="flex justify-between text-xs text-slate-400 mb-1">
             <span>Scanning Market...</span>
             <span>{progress}%</span>
           </div>
           <div className="w-full bg-slate-700 rounded-full h-2.5">
             <div className="bg-green-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
           </div>
        </div>
      )}

      {filteredResults.length > 0 && !loading && (
        <div className="overflow-hidden rounded-xl border border-slate-700">
           <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
             <table className="w-full text-sm text-left text-slate-300 relative">
               <thead className="bg-slate-700 text-slate-100 sticky top-0 z-10">
                 <tr>
                   <th className="px-4 py-3">Status</th>
                   <th className="px-4 py-3">Code</th>
                   <th className="px-4 py-3">Name</th>
                   <th className="px-4 py-3 text-right">Win Rate</th>
                   <th className="px-4 py-3 text-right">Return</th>
                   <th className="px-4 py-3 text-center">Action</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-700/50 bg-slate-800/30">
                 {filteredResults.slice(0, 50).map((row) => (
                   <tr key={row.code} className="hover:bg-slate-700/50 transition-colors">
                     <td className="px-4 py-3">
                        {row.signal === 'BUY' && <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">🟢 BUY NOW</span>}
                        {row.signal === 'SELL' && <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">🔴 SELL</span>}
                        
                        {row.prediction === 'APPROACHING_BUY' && <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 ml-1">🔵 WATCH</span>}
                        {row.prediction === 'APPROACHING_SELL' && <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 ml-1">🟠 WATCH</span>}
                        
                        {!row.signal && !row.prediction && <span className="text-slate-600">-</span>}
                     </td>
                     <td className="px-4 py-3 font-mono text-blue-300">{row.code}</td>
                     <td className="px-4 py-3 font-bold text-slate-200">
                        {row.name}
                        <div className="text-[10px] font-normal text-slate-500">{row.details}</div>
                     </td>
                     <td className="px-4 py-3 text-right text-slate-400">{row.winRate.toFixed(0)}%</td>
                     <td className={`px-4 py-3 text-right font-bold ${row.totalReturn >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                       {row.totalReturn.toFixed(1)}%
                     </td>
                     <td className="px-4 py-3 text-center">
                       <button 
                         onClick={() => onSelectStock(row.code)}
                         className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-white transition-colors"
                       >
                         分析
                       </button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
           
           {filteredResults.length === 0 && (
             <div className="p-8 text-center text-slate-500">
               沒有符合條件的股票
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default ScreenerPanel;
