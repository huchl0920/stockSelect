import { useState, useEffect, useRef } from 'react';
import { POPULAR_STOCKS } from '../data/stocks';
import { ALL_STOCKS } from '../data/all_stocks';
import { fetchStockHistory } from '../services/historyApi';
import { 
  runStrategyMA, 
  runStrategyRSI, 
  runStrategyBreakout, 
  runStrategyBollinger, 
  runStrategyMACD, 
  runStrategySupertrend,
  analyzeSignal 
} from '../utils/strategies';

const STRATEGIES = [
  { id: 'MA', name: '黃金交叉', type: 'reversal' },
  { id: 'RSI', name: 'RSI 反轉', type: 'reversal' },
  { id: 'BREAKOUT', name: '突破新高', type: 'trend' },
  { id: 'BOLLINGER', name: '布林通道', type: 'reversal' },
  { id: 'MACD', name: 'MACD 順勢', type: 'trend' },
  { id: 'SUPERTREND', name: 'Supertrend', type: 'trend' }
];

const DailyPicks = ({ onSelectStock }) => {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scope, setScope] = useState('popular'); // 'popular' | 'all'
  const stopScanRef = useRef(false);

  const scanMarket = async () => {
    stopScanRef.current = false;
    setLoading(true);
    setPicks([]);
    setProgress(0);
    
    const targetList = scope === 'all' ? ALL_STOCKS : POPULAR_STOCKS;
    const recommendations = [];
    const batchSize = 5;

    for (let i = 0; i < targetList.length; i += batchSize) {
      if (stopScanRef.current) break;

      const batch = targetList.slice(i, i + batchSize);
      
      const promises = batch.map(async (stock) => {
        try {
          // Fetch 2y data needed for all strategies
          const data = await fetchStockHistory(stock.code, '2y');
          
          const stockRecs = [];

          // Check all strategies
          for(const strat of STRATEGIES) {
             const analysis = analyzeSignal(data, strat.id);
             
             // Only interested in BUY signals for "Top Picks"
             if (analysis.signal === 'BUY') {
                // Run backtest to get stats for scoring
                let stats;
                if (strat.id === 'MA') stats = runStrategyMA(data);
                else if (strat.id === 'RSI') stats = runStrategyRSI(data);
                else if (strat.id === 'BREAKOUT') stats = runStrategyBreakout(data);
                else if (strat.id === 'BOLLINGER') stats = runStrategyBollinger(data);
                else if (strat.id === 'MACD') stats = runStrategyMACD(data);
                else stats = runStrategySupertrend(data);

                // Scoring Algorithm: Win Rate * Expected Return
                // We value Consistency (Win Rate) and Upside (Avg Return)
                // Score = WinRate * (AvgReturn + 1)
                
                const winRate = stats.winRate;
                const expectedReturn = stats.avgTradeReturn;
                
                // Filter out bad strategies for this specific stock
                if (winRate < 40 || expectedReturn < 0.5) continue;

                const score = (winRate * 0.6) + (expectedReturn * 10); 

                stockRecs.push({
                   stockCode: stock.code,
                   stockName: stock.name,
                   strategyName: strat.name,
                   strategyType: strat.type,
                   detail: analysis.details,
                   entry: analysis.suggestedEntry,
                   target: analysis.suggestedTarget,
                   stopLoss: analysis.suggestedStopLoss,
                   winRate: winRate,
                   expReturn: expectedReturn,
                   score: score
                });
             }
          }
          return stockRecs;

        } catch (err) {
          return [];
        }
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach(recs => recommendations.push(...recs));
      
      setProgress(Math.round(((i + batch.length) / targetList.length) * 100));
      await new Promise(r => setTimeout(r, 100)); // Throttle
    }

    // Sort by Score DESC
    recommendations.sort((a, b) => b.score - a.score);
    
    setPicks(recommendations);
    setLoading(false);
  };

  const handleStop = () => {
    stopScanRef.current = true;
    setLoading(false);
  };

  useEffect(() => {
    scanMarket();
  }, [scope]);

  return (
    <div className="w-full max-w-6xl p-6 bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl shadow-xl mt-6">
       <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div>
            <h3 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
              <span className="text-yellow-400 text-3xl">🏆</span> 每日精選推薦 (Daily Top Picks)
            </h3>
            <p className="text-slate-400 text-sm mt-1">
              系統自動掃描市場，為您找出今日發生買進訊號，且歷史期望值最高的機會。
            </p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex bg-slate-700 rounded-lg p-1">
                <button 
                  onClick={() => !loading && setScope('popular')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all ${scope === 'popular' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                  disabled={loading}
                >
                  🔥 熱門股 ({POPULAR_STOCKS.length})
                </button>
                <button 
                  onClick={() => !loading && setScope('all')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all ${scope === 'all' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                  disabled={loading}
                >
                  🌐 全市場 ({ALL_STOCKS.length})
                </button>
             </div>

             {!loading ? (
               <button 
                 onClick={scanMarket}
                 className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors flex items-center gap-1"
               >
                 <span>🔄</span> 重新掃描
               </button>
             ) : (
               <button 
                 onClick={handleStop}
                 className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/50 hover:bg-red-600/30 rounded-lg text-sm transition-colors flex items-center gap-1"
               >
                 <span>⛔</span> 停止
               </button>
             )}
          </div>
       </div>

       {loading ? (
         <div className="py-20 text-center">
            <div className="w-64 h-2 bg-slate-700 rounded-full mx-auto mb-4 overflow-hidden">
               <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300" style={{width: `${progress}%`}} />
            </div>
            <p className="text-slate-400 animate-pulse">
               正在為您掃描 {scope === 'all' ? '全市場' : '熱門股'} 機會... {progress}%
            </p>
            <p className="text-xs text-slate-600 mt-2">
               分析 6 種模型 x {scope === 'all' ? ALL_STOCKS.length : POPULAR_STOCKS.length} 檔標的
            </p>
         </div>
       ) : picks.length === 0 ? (
         <div className="py-20 text-center text-slate-500 border-2 border-dashed border-slate-700 rounded-xl">
            <p className="text-xl mb-2">😴 今日無強力買進訊號</p>
            <p className="text-sm">市場目前較為平靜，建議觀望或查看「智慧選股」中的觀察名單。</p>
         </div>
       ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {picks.map((pick, index) => (
               <div 
                 key={`${pick.stockCode}-${pick.strategyName}`}
                 className={`relative p-5 rounded-xl border transition-all hover:scale-[1.02] hover:shadow-2xl group ${
                    index === 0 ? 'bg-gradient-to-br from-yellow-900/20 to-slate-900 border-yellow-500/50 shadow-yellow-900/20' : 
                    'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                 }`}
               >
                 {index === 0 && (
                    <div className="absolute -top-3 -right-3 bg-yellow-500 text-slate-900 font-black text-xs px-3 py-1 rounded-full shadow-lg transform rotate-12 z-10">
                       TOP 1 BEST BUY
                    </div>
                 )}
                 {index < 3 && index > 0 && (
                    <div className="absolute -top-3 -right-3 bg-slate-600 text-white font-bold text-xs px-2 py-1 rounded-full shadow-lg z-10">
                       #{index + 1}
                    </div>
                 )}

                 <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                           <span className="text-blue-400 font-mono font-bold text-lg">{pick.stockCode}</span>
                           <span className="text-2xl font-bold text-slate-100">{pick.stockName}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{pick.strategyType.toUpperCase()} STRATEGY</div>
                    </div>
                    <div className="text-right">
                       <div className="text-sm text-slate-400">歷史勝率</div>
                       <div className="text-xl font-bold text-green-400">{pick.winRate.toFixed(0)}%</div>
                    </div>
                 </div>

                 <div className="mb-4">
                    <span className="inline-block px-2 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold rounded border border-blue-500/30">
                       {pick.strategyName}
                    </span>
                    <span className="ml-2 text-sm text-slate-300">
                       {pick.detail}
                    </span>
                 </div>

                 <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                    <div className="text-center">
                       <div className="text-[10px] text-slate-500 mb-1">建議進場</div>
                       <div className="text-yellow-400 font-mono font-bold">{pick.entry.toFixed(1)}</div>
                    </div>
                    <div className="text-center border-l border-slate-700/50">
                       <div className="text-[10px] text-slate-500 mb-1">目標停利</div>
                       <div className="text-emerald-400 font-mono font-bold">{pick.target.toFixed(1)}</div>
                    </div>
                    <div className="text-center border-l border-slate-700/50">
                       <div className="text-[10px] text-slate-500 mb-1">停損價格</div>
                       <div className="text-red-400 font-mono font-bold">{pick.stopLoss.toFixed(1)}</div>
                    </div>
                 </div>

                 <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
                    <div className="text-xs text-slate-500">
                       期望報酬: <span className="text-slate-300 font-bold">{pick.expReturn.toFixed(1)}% / 交易</span>
                    </div>
                    <button 
                       onClick={() => onSelectStock(pick.stockCode)}
                       className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded transition-colors shadow-lg"
                    >
                       分析詳情 ➔
                    </button>
                 </div>
               </div>
            ))}
         </div>
       )}
    </div>
  );
};

export default DailyPicks;
