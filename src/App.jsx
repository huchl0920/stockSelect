import { useState } from 'react';
import SearchInput from './components/SearchInput';
import StockCard from './components/StockCard';
import BacktestPanel from './components/BacktestPanel';
import ScreenerPanel from './components/ScreenerPanel';
import { fetchStockInfo } from './services/api';

function App() {
  const [activeTab, setActiveTab] = useState('quote'); // 'quote' | 'backtest'
  const [stock, setStock] = useState(null);
  const [searchCode, setSearchCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (code) => {
    // Keep track of search code for backtest
    setSearchCode(code);
    setLoading(true);
    setError(null);
    setStock(null);
    
    try {
      const data = await fetchStockInfo(code);
      setStock(data);
      // Auto switch to quote tab if finding new stock, unless in backtest?
      // User might be in backtest mode, let's stay there.
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center py-10 px-4 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="z-10 w-full max-w-4xl flex flex-col items-center gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent drop-shadow-sm">
            Taiwan Stock
          </h1>
          <p className="text-slate-400 text-lg font-light">
            全方位台股分析平台
          </p>
        </div>

        <SearchInput onSearch={handleSearch} />

        {/* Tabs */}
        <div className="flex p-1 bg-slate-800/50 rounded-xl">
           <button 
             onClick={() => setActiveTab('quote')}
             className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'quote' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
           >
             即時報價
           </button>
           <button 
             onClick={() => setActiveTab('backtest')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'backtest' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
           >
             策略回測
           </button>
           <button 
             onClick={() => setActiveTab('screener')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'screener' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
           >
             智慧選股
           </button>
        </div>

        {/* Content Area */}
        <div className="w-full flex flex-col items-center min-h-[400px]">
          
          {loading && (
            <div className="flex flex-col items-center gap-3 animate-pulse text-slate-400 mt-10">
              <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>資料讀取中...</p>
            </div>
          )}

          {error && activeTab === 'quote' && (
            <div className="text-center p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 mt-6">
               <p className="font-bold text-lg">⚠️ 錯誤</p>
               <p>{error}</p>
            </div>
          )}

          {/* Quote View */}
          {activeTab === 'quote' && !loading && stock && (
            <StockCard stock={stock} />
          )}
          
          {activeTab === 'quote' && !stock && !loading && !error && (
             <div className="text-slate-600 text-center mt-10">
                <p>請輸入代號 (例如 2330)</p>
             </div>
          )}

          {/* Backtest View */}
          {activeTab === 'backtest' && (
             <BacktestPanel stockCode={searchCode || (stock ? stock.code : '')} />
          )}

          {/* Screener View */}
          {activeTab === 'screener' && (
             <ScreenerPanel onSelectStock={(code) => {
               setSearchCode(code);
               handleSearch(code);
               setActiveTab('backtest'); // Switch to backtest to see details
             }} />
          )}

        </div>
      </div>
    </div>
  );
}

export default App;
