import { useState, useEffect } from 'react';
import { fetchStockHistory } from '../services/historyApi';
import { fetchCompanyProfile } from '../services/api';
import { runStrategyMA, runStrategyRSI, runStrategyBreakout, runStrategyBollinger, runStrategyMACD, runStrategySupertrend, analyzeSignal } from '../utils/strategies';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BacktestPanel = ({ stockCode }) => {
  const [range, setRange] = useState('2y');
  const [strategy, setStrategy] = useState('MA'); // 'MA' or 'RSI'
  const [result, setResult] = useState(null);
  const [analysisSummary, setAnalysisSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Company Profile State
  const [profile, setProfile] = useState(null);
  const [showFullDesc, setShowFullDesc] = useState(false);

  // Auto-run when props or filters change
  useEffect(() => {
    if (stockCode) {
      runBacktest();
    }
  }, [stockCode, strategy, range]);

  const runBacktest = async () => {
    if (!stockCode) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setAnalysisSummary([]);
    setProfile(null);
    
    // ... rest of function
    try {
      // Parallel fetch for speed
      const [data, profileData] = await Promise.all([
        fetchStockHistory(stockCode, range, '1d'),
        fetchCompanyProfile(stockCode)
      ]);
      
      setProfile(profileData);

      let stratResult;
      
      // 1. Run Selected Backtest
      if (strategy === 'MA') {
        stratResult = runStrategyMA(data);
      } else if (strategy === 'RSI') {
        stratResult = runStrategyRSI(data);
      } else if (strategy === 'BREAKOUT') {
        stratResult = runStrategyBreakout(data);
      } else if (strategy === 'BOLLINGER') {
        stratResult = runStrategyBollinger(data);
      } else if (strategy === 'MACD') {
        stratResult = runStrategyMACD(data);
      } else {
        stratResult = runStrategySupertrend(data);
      }

      setResult({ ...stratResult, data });

      // 2. Run Multi-Strategy Diagnosis
      const summary = ['MA', 'RSI', 'BREAKOUT', 'BOLLINGER', 'MACD', 'SUPERTREND'].map(type => {
        const analysis = analyzeSignal(data, type);
        let name = '';
        let logic = '';
        if (type === 'MA') { name = '黃金交叉 (MA)'; logic = '短週突破長週線，動能轉強'; }
        else if (type === 'RSI') { name = 'RSI 反轉'; logic = 'RSI 低檔超賣區反彈'; }
        else if (type === 'BREAKOUT') { name = '突破新高'; logic = '突破兩年新高價，無套牢賣壓'; }
        else if (type === 'MACD') { name = 'MACD 順勢'; logic = 'MACD 柱狀體翻紅/黃金交叉'; }
        else if (type === 'SUPERTREND') { name = 'Supertrend'; logic = '趨勢指標翻多，順勢操作'; }
        else { name = '布林通道'; logic = '觸及下通道反彈 (均值回歸)'; }
        
        return { type, name, logic, ...analysis };
      });
      setAnalysisSummary(summary);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl p-6 bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl shadow-xl mt-6">
      <h3 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
        <span className="text-blue-400">📊</span> 策略回測與診斷
      </h3>

      {/* Company Profile Section */}
      {profile && (
        <div className="mb-6 p-4 bg-slate-700/30 rounded-xl border border-slate-600/50">
           <div className="flex flex-wrap gap-2 mb-2">
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded border border-blue-500/30">
                {profile.sector || '其他板塊'}
              </span>
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded border border-purple-500/30">
                {profile.industry || '產業不詳'}
              </span>
           </div>
           <p className={`text-sm text-slate-300 leading-relaxed ${!showFullDesc && 'line-clamp-2'}`}>
              {profile.description || '暫無公司簡介'}
           </p>
           {profile.description && profile.description.length > 100 && (
             <button 
               onClick={() => setShowFullDesc(!showFullDesc)}
               className="text-xs text-blue-400 hover:text-blue-300 mt-1"
             >
                {showFullDesc ? '收起' : '展開更多...'}
             </button>
           )}
        </div>
      )}

      {/* Recommended Strategy Highlight */}
      {analysisSummary.some(s => s.signal === 'BUY') && (
         <div className="mb-6 p-4 bg-gradient-to-r from-yellow-900/20 to-slate-800/50 border border-yellow-500/30 rounded-xl flex items-start gap-3">
            <div className="text-2xl">💡</div>
            <div>
               <h4 className="font-bold text-yellow-100 text-sm mb-1">AI 投資觀點</h4>
               <p className="text-sm text-slate-300">
                  此標的目前出現 
                  <span className="font-bold text-yellow-400 mx-1">
                    {analysisSummary.filter(s => s.signal === 'BUY').length} 個買進訊號
                  </span>。
                  主要推薦原因：
                  <ul className="list-disc list-inside mt-1 text-slate-400 text-xs space-y-1">
                     {analysisSummary.filter(s => s.signal === 'BUY').map(s => (
                        <li key={s.type}>
                           <span className="text-slate-200 font-bold">{s.name}</span>: {s.details} ({s.logic})
                        </li>
                     ))}
                  </ul>
               </p>
            </div>
         </div>
      )}
      
      <div className="flex flex-wrap gap-4 items-end mb-6">
        <div>
          <label className="block text-sm text-slate-400 mb-1">股票代號</label>
          <div className="bg-slate-900/50 border border-slate-600 rounded px-3 py-2 text-slate-300 font-mono w-24">
            {stockCode || '---'}
          </div>
        </div>

        <div>
           <label className="block text-sm text-slate-400 mb-1">回測策略</label>
           <select 
             value={strategy} 
             onChange={(e) => setStrategy(e.target.value)}
             className="bg-slate-700 text-slate-200 border border-slate-600 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
           >
             <option value="MA">黃金交叉 (MA Cross)</option>
             <option value="RSI">RSI 反轉策略</option>
             <option value="BREAKOUT">突破近兩年新高</option>
             <option value="BOLLINGER">布林通道回歸 (High Win Rate)</option>
             <option value="MACD">MACD 順勢交易 (Trend)</option>
             <option value="SUPERTREND">Supertrend 趨勢跟隨 (Low Risk)</option>
           </select>
        </div>

        <div>
           <label className="block text-sm text-slate-400 mb-1">歷史資料</label>
           <select 
             value={range} 
             onChange={(e) => setRange(e.target.value)}
             className="bg-slate-700 text-slate-200 border border-slate-600 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
           >
             <option value="1y">近 1 年</option>
             <option value="2y">近 2 年</option>
             <option value="5y">近 5 年</option>
           </select>
        </div>

        <button 
          onClick={runBacktest}
          disabled={!stockCode || loading}
          className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
        >
          {loading ? '分析運算中...' : '開始分析'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/20 text-red-300 rounded-lg mb-4 border border-red-500/30">
          ❌ {error}
        </div>
      )}

      {analysisSummary.length > 0 && (
        <div className="mb-8">
           <h4 className="text-lg font-bold text-slate-200 mb-3 border-b border-slate-700/50 pb-2">策略診斷報告</h4>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {analysisSummary.map(item => (
                <div key={item.type} className={`p-4 rounded-xl border relative overflow-hidden ${
                  item.signal === 'BUY' ? 'bg-green-900/20 border-green-500/30' : 
                  item.signal === 'SELL' ? 'bg-red-900/20 border-red-500/30' :
                  item.prediction ? 'bg-blue-900/10 border-blue-500/30' :
                  'bg-slate-800/50 border-slate-700'
                }`}>
                   {/* Status Badge */}
                   <div className="absolute top-2 right-2">
                      {item.signal === 'BUY' && <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded font-bold">BUY</span>}
                      {item.signal === 'SELL' && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold">SELL</span>}
                      {item.prediction && <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold">WATCH</span>}
                   </div>

                   <h5 className="text-sm font-bold text-slate-300 mb-1">{item.name}</h5>
                   <p className="text-xs text-slate-400 h-8 mb-2 line-clamp-2">{item.details || '無訊號'}</p>
                   
                   <div className="space-y-1 mt-2 pt-2 border-t border-slate-700/30">
                      <div className="flex justify-between text-xs">
                         <span className="text-slate-500">Entry</span>
                         <span className="text-yellow-400 font-mono">{item.suggestedEntry ? item.suggestedEntry.toFixed(1) : '-'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                         <span className="text-slate-500">Target</span>
                         <span className="text-emerald-400 font-mono">{item.suggestedTarget ? item.suggestedTarget.toFixed(1) : '-'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                         <span className="text-slate-500">Stop</span>
                         <span className="text-red-400 font-mono">{item.suggestedStopLoss ? item.suggestedStopLoss.toFixed(1) : '-'}</span>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <h4 className="text-lg font-bold text-slate-200 border-b border-slate-700/50 pb-2">
             歷史回測詳情 ({strategy})
          </h4>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700">
               <p className="text-slate-400 text-sm">總報酬率</p>
               <p className={`text-2xl font-bold ${result.totalReturn >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                 {result.totalReturn.toFixed(2)}%
               </p>
            </div>
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700">
               <p className="text-slate-400 text-sm">平均交易報酬</p>
               <p className={`text-2xl font-bold ${result.avgTradeReturn >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {result.avgTradeReturn ? result.avgTradeReturn.toFixed(1) : 0}%
               </p>
            </div>
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700">
               <p className="text-slate-400 text-sm">勝率 (Win Rate)</p>
               <p className="text-2xl font-bold text-slate-200">{result.winRate.toFixed(1)}%</p>
            </div>
          </div>

          {/* Chart */}
          <div className="h-80 w-full bg-slate-900/30 rounded-xl p-4 border border-slate-700/50">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize: 12}} />
                <YAxis domain={['auto', 'auto']} stroke="#94a3b8" tick={{fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                  itemStyle={{ color: '#f1f5f9' }}
                />
                <Legend />
                <Line type="monotone" dataKey="close" stroke="#818cf8" dot={false} name="股價" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Trade Log */}
          <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="bg-slate-700 text-slate-100 sticky top-0">
                <tr>
                  <th className="px-3 py-2 rounded-tl-lg">Type</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Percent</th>
                  <th className="px-3 py-2 rounded-tr-lg">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {result.log.map((entry, i) => (
                  <tr key={i} className="hover:bg-slate-800/50">
                    <td className={`px-3 py-2 font-bold ${entry.type === 'BUY' ? 'text-red-400' : 'text-green-400'}`}>
                      {entry.type}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-400">{entry.date}</td>
                    <td className="px-3 py-2">{entry.price.toFixed(1)}</td>
                    <td className={`px-3 py-2 ${entry.pnl > 0 ? 'text-red-400' : entry.pnl < 0 ? 'text-green-400' : ''}`}>
                      {entry.pnl ? `${entry.pnl.toFixed(2)}%` : '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{entry.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BacktestPanel;
