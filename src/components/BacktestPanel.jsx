import { useState } from 'react';
import { fetchStockHistory } from '../services/historyApi';
import { runStrategyMA, runStrategyRSI, runStrategyBreakout, runStrategyBollinger } from '../utils/strategies';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BacktestPanel = ({ stockCode }) => {
  const [range, setRange] = useState('2y');
  const [strategy, setStrategy] = useState('MA'); // 'MA' or 'RSI'
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runBacktest = async () => {
    if (!stockCode) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await fetchStockHistory(stockCode, range, '1d');
      let stratResult;
      
      if (strategy === 'MA') {
        stratResult = runStrategyMA(data);
      } else if (strategy === 'RSI') {
        stratResult = runStrategyRSI(data);
      } else if (strategy === 'BREAKOUT') {
        stratResult = runStrategyBreakout(data);
      } else {
        stratResult = runStrategyBollinger(data);
      }

      setResult({ ...stratResult, data });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl p-6 bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl shadow-xl mt-6">
      <h3 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
        <span className="text-blue-400">📊</span> 策略回測
      </h3>
      
      <div className="flex flex-wrap gap-4 items-end mb-6">
        <div>
          <label className="block text-sm text-slate-400 mb-1">股票代號</label>
          <div className="bg-slate-900/50 border border-slate-600 rounded px-3 py-2 text-slate-300 font-mono w-24">
            {stockCode || '---'}
          </div>
        </div>

        <div>
           <label className="block text-sm text-slate-400 mb-1">策略選擇</label>
           <select 
             value={strategy} 
             onChange={(e) => setStrategy(e.target.value)}
             className="bg-slate-700 text-slate-200 border border-slate-600 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
           >
             <option value="MA">黃金交叉 (MA Cross)</option>
             <option value="RSI">RSI 反轉策略</option>
             <option value="BREAKOUT">突破近兩年新高</option>
             <option value="BOLLINGER">布林通道回歸 (High Win Rate)</option>
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
          {loading ? '回測運算中...' : '開始回測'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/20 text-red-300 rounded-lg mb-4 border border-red-500/30">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700">
               <p className="text-slate-400 text-sm">總報酬率</p>
               <p className={`text-2xl font-bold ${result.totalReturn >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                 {result.totalReturn.toFixed(2)}%
               </p>
            </div>
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700">
               <p className="text-slate-400 text-sm">交易次數</p>
               <p className="text-2xl font-bold text-slate-200">{result.trades.length}</p>
            </div>
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700">
               <p className="text-slate-400 text-sm">勝率</p>
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
