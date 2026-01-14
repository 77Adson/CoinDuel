import { useState, useEffect, useRef } from 'react';
import { GameChart } from './components/GameChart';
import { io } from 'socket.io-client';

const BACKEND_URL = "http://localhost:5000";

function App() {
  const [chartData, setChartData] = useState([]);
  
  // Stan dla kwoty transakcji (domyślnie 1000)
  const [tradeAmount, setTradeAmount] = useState(1000);

  // Stan portfela - odbierany z backendu
  const [gameState, setGameState] = useState({
    cash: 10000,
    btc_amount: 0,
    portfolio_value: 10000,
    pnl_percent: 0
  });

  const socketRef = useRef(null);

  // --- FUNKCJA FORMATUJĄCA DANE ---
  const formatCandle = (rawCandle) => {
    if (!rawCandle) return null;

    let timeVal = rawCandle.Date || rawCandle.Datetime || rawCandle.time || rawCandle.Time;
    
    let timeInSeconds = timeVal;
    if (typeof timeVal === 'string') {
      timeInSeconds = new Date(timeVal).getTime() / 1000;
    } else if (typeof timeVal === 'number' && timeVal > 20000000000) {
      timeInSeconds = timeVal / 1000;
    }

    if (!timeInSeconds || isNaN(timeInSeconds)) {
      return null;
    }

    return {
      time: timeInSeconds,
      open: parseFloat(rawCandle.Open || rawCandle.open),
      high: parseFloat(rawCandle.High || rawCandle.high),
      low: parseFloat(rawCandle.Low || rawCandle.low),
      close: parseFloat(rawCandle.Close || rawCandle.close),
    };
  };

  useEffect(() => {
    socketRef.current = io(BACKEND_URL);
    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('✅ Połączono z Backendem');
    });

    socket.on('history', (data) => {
      const formattedData = data
        .map(c => formatCandle(c))
        .filter(c => c !== null)
        .sort((a, b) => a.time - b.time);

      if (formattedData.length > 0) {
        setChartData(formattedData);
      }
    });

    socket.on('candle', (rawCandle) => {
      const newCandle = formatCandle(rawCandle);
      if (!newCandle) return;

      setChartData(prevData => {
        if (prevData.length > 0) {
          const lastCandle = prevData[prevData.length - 1];
          if (newCandle.time === lastCandle.time) {
             const updated = [...prevData];
             updated[updated.length - 1] = newCandle;
             return updated;
          }
        }
        return [...prevData, newCandle];
      });
    });

    socket.on('game_state', (data) => {
      setGameState(data);
    });

    socket.on('game_over', (data) => {
      console.log("Game Over:", data);
      alert(`Koniec gry! Twój wynik: $${data.final_value} (${data.pnl_percent}%)`);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // --- FUNKCJA HANDLU ---
  const handleTrade = (action) => {
    if (!socketRef.current) return;

    // Walidacja kwoty
    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0) {
        alert("Wpisz poprawną kwotę!");
        return;
    }

    // Wysyłamy event do backendu z wybraną kwotą
    socketRef.current.emit('trade', {
      action: action, 
      amount: amount
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 font-sans">
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-yellow-500 tracking-wider">
          COINDUEL <span className="text-white text-lg font-normal">| Turbo Trader</span>
        </h1>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${chartData.length > 0 ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></span>
            <span>{chartData.length > 0 ? 'Live Data' : 'Waiting...'}</span>
          </div>
        </div>
      </header>

      {/* GŁÓWNY GRID: Zmieniony na 4 kolumny (1 lewa, 2 środek, 1 prawa) */}
      <main className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* 1. LEWY PANEL - LISTA COINÓW (Placeholder) */}
        <div className="lg:col-span-1 bg-gray-800 p-4 rounded-xl border border-gray-700 h-[480px] overflow-hidden flex flex-col">
            <h3 className="text-gray-400 text-xs font-bold uppercase mb-4 tracking-wider">Dostępne Rynki</h3>
            
            {/* Placeholder listy */}
            <div className="flex-1 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-gray-700 rounded-lg bg-gray-900/50">
                <span className="text-2xl mb-2">🚀</span>
                <span className="text-sm">Wkrótce...</span>
                <span className="text-xs opacity-50">(Sprint 3)</span>
            </div>
            
            {/* Przykładowy nieaktywny element listy, żeby było widać jak to będzie wyglądać */}
            <div className="mt-4 p-3 bg-gray-700/50 rounded flex justify-between items-center opacity-50 cursor-not-allowed">
                <div className="flex flex-col">
                    <span className="font-bold text-sm">BTC/USD</span>
                    <span className="text-xs text-green-400">+2.4%</span>
                </div>
                <span className="text-xs bg-yellow-600 px-2 py-1 rounded text-white">Active</span>
            </div>
        </div>

        {/* 2. ŚRODKOWY PANEL - WYKRES */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 h-[480px] flex flex-col">
             <div className="flex-1 w-full relative">
                {/* Kontener musi mieć flex-1 żeby zajął wysokość rodzica */}
                <div className="absolute inset-0">
                    <GameChart data={chartData} />
                </div>
             </div>
          </div>
        </div>

        {/* 3. PRAWY PANEL - HANDEL */}
        <div className="lg:col-span-1 bg-gray-800 p-6 rounded-xl border border-gray-700 flex flex-col justify-between h-[480px]">
          <div>
            <h2 className="text-gray-400 uppercase text-xs font-bold mb-2">Twój Portfel</h2>
            <div className={`text-4xl font-bold mb-1 ${gameState.pnl_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${gameState.portfolio_value.toFixed(2)}
            </div>
            
            <div className="mt-4 space-y-2 text-sm text-gray-300">
                <div className="flex justify-between">
                    <span>Dostępne środki:</span>
                    <span className="font-mono text-white">${gameState.cash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Posiadane BTC:</span>
                    <span className="font-mono text-white">{gameState.btc_amount.toFixed(6)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-600 pt-2 mt-2">
                    <span>Zysk (PnL):</span>
                    <span className={`font-bold ${gameState.pnl_percent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {gameState.pnl_percent.toFixed(2)}%
                    </span>
                </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* NOWE POLE TEKSTOWE */}
            <div>
                <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Kwota transakcji ($)</label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input 
                        type="number" 
                        value={tradeAmount}
                        onChange={(e) => setTradeAmount(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 pl-8 pr-4 text-white font-mono focus:outline-none focus:border-yellow-500 transition"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={() => handleTrade('BUY')}
                    className="py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition active:scale-95 shadow-lg shadow-green-900/20"
                >
                    BUY
                </button>
                <button 
                    onClick={() => handleTrade('SELL')}
                    className="py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition active:scale-95 shadow-lg shadow-red-900/20"
                >
                    SELL
                </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-gray-500 mt-8">
        Charts by TradingView | CoinDuel Sprint 2
      </footer>
    </div>
  );
}

export default App;