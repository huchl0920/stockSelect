import { useMemo } from 'react';

const StockCard = ({ stock }) => {
  // Taiwan Stock Color Logic: Red = Up, Green = Down
  const isUp = stock.change > 0;
  const isDown = stock.change < 0;
  
  const colorClass = isUp ? 'text-red-500' : isDown ? 'text-green-500' : 'text-slate-200';
  const bgClass = isUp ? 'bg-red-500/10 border-red-500/20' : isDown ? 'bg-green-500/10 border-green-500/20' : 'bg-slate-800/50 border-slate-700';
  const arrow = isUp ? '▲' : isDown ? '▼' : '';

  return (
    <div className={`w-full max-w-md p-6 rounded-2xl border ${bgClass} backdrop-blur-md transition-all duration-500 hover:scale-[1.02] shadow-xl`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">{stock.name}</h2>
          <span className="text-sm font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">{stock.code}</span>
        </div>
        <div className={`text-right ${colorClass}`}>
          <div className="text-3xl font-extrabold flex items-center justify-end gap-1">
             {stock.price.toFixed(2)}
          </div>
        </div>
      </div>
      
      <div className="flex justify-between items-center pt-4 border-t border-slate-700/50">
        <div className="flex items-center gap-4">
           <div>
              <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">漲跌</p>
              <p className={`text-lg font-bold flex items-center gap-1 ${colorClass}`}>
                 {arrow} {Math.abs(stock.change).toFixed(2)}
              </p>
           </div>
           <div>
              <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">幅度</p>
              <p className={`text-lg font-bold ${colorClass}`}>
                 {Math.abs(stock.changePercent).toFixed(2)}%
              </p>
           </div>
        </div>
        <div className="text-right">
           <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">成交量</p>
           <p className="text-slate-300 font-mono">{stock.volume.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

export default StockCard;
