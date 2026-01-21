import { useState, useEffect, useRef } from 'react';
import { GameChart } from './components/GameChart';
import { io } from 'socket.io-client';

const BACKEND_URL = "http://localhost:5000";

// --- Nowe Komponenty Statystyk ---

const PlayerStats = ({ portfolio }) => {
  if (!portfolio) return null;

  const pnl = portfolio.total_value - 10000;
  const pnlPercent = (pnl / 10000) * 100;

  return (
    <div>
      <h2 className="text-gray-400 uppercase text-xs font-bold mb-2">Twój Portfel</h2>
      <div className={`text-4xl font-bold mb-1 ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        ${portfolio.total_value?.toFixed(2) || '0.00'}
      </div>
      
      <div className="mt-4 space-y-2 text-sm text-gray-300">
        <div className="flex justify-between">
          <span>Dostępne środki:</span>
          <span className="font-mono text-white">${portfolio.cash?.toFixed(2) || '0.00'}</span>
        </div>
        <div className="flex justify-between border-t border-gray-600 pt-2 mt-2">
          <span>Zysk (PnL):</span>
          <span className={`font-bold ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {pnl.toFixed(2)}$ ({pnlPercent.toFixed(2)}%)
          </span>
        </div>
      </div>
    </div>
  );
};

const CoinStats = ({ portfolio, onTrade }) => {
  if (!portfolio || !portfolio.coins) return null;

  const ownedCoins = Object.entries(portfolio.coins).filter(([, data]) => data.amount > 0);

  if (ownedCoins.length === 0) {
    return (
      <div className="text-center text-gray-500 mt-6">
        <span>Nie posiadasz jeszcze coinów</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      <h3 className="text-gray-400 uppercase text-xs font-bold">Twoje Aktywa</h3>
      {ownedCoins.map(([coin, data]) => (
        <div key={coin} className="bg-gray-900/50 p-3 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-yellow-500">{coin}</span>
            <span className="font-mono text-lg">${data.value.toFixed(2)}</span>
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>Ilość:</span>
              <span>{data.amount.toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span>Zysk/Strata:</span>
              <span className={data.pnl_percent >= 0 ? 'text-green-400' : 'text-red-400'}>
                {data.pnl_percent.toFixed(2)}%
              </span>
            </div>
             {/* Proste przyciski handlu per coin */}
            <div className="flex gap-2 pt-2">
                <button onClick={() => onTrade('BUY', coin)} className="w-full text-xs bg-green-600 hover:bg-green-500 py-1 rounded">KUP</button>
                <button onClick={() => onTrade('SELL', coin)} className="w-full text-xs bg-red-600 hover:bg-red-500 py-1 rounded">SPRZEDAJ</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};


function App() {
  const [chartData, setChartData] = useState({});
  const [tradeAmount, setTradeAmount] = useState(100);

  // --- NOWY STAN ---
  const [availableCoins, setAvailableCoins] = useState([]);
  const [selectedCoins, setSelectedCoins] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [portfolioState, setPortfolioState] = useState(null);

  const socketRef = useRef(null);

  const formatCandle = (rawCandle) => {
    if (!rawCandle) return null;
    let timeVal = rawCandle.Date || rawCandle.Datetime || rawCandle.time || rawCandle.Time;
    let timeInSeconds = timeVal;
    if (typeof timeVal === 'string') {
      timeInSeconds = new Date(timeVal).getTime() / 1000;
    } else if (typeof timeVal === 'number' && timeVal > 20000000000) {
      timeInSeconds = timeVal / 1000;
    }
    if (!timeInSeconds || isNaN(timeInSeconds)) return null;
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

    socket.on('available_coins', (coins) => {
      console.log('Dostępne coiny:', coins);
      setAvailableCoins(coins);
    });

    socket.on('history', (data) => {
      const { coin, candles } = data;
      const formattedData = candles
        .map(c => formatCandle(c))
        .filter(c => c !== null)
        .sort((a, b) => a.time - b.time);

      if (formattedData.length > 0) {
        setChartData(prev => ({ ...prev, [coin]: formattedData }));
      }
    });

    socket.on('candle', (data) => {
      const { coin, candle: rawCandle } = data;
      const newCandle = formatCandle(rawCandle);
      if (!newCandle) return;

      setChartData(prevData => {
        const existingData = prevData[coin] || [];
        if (existingData.length > 0) {
          const lastCandle = existingData[existingData.length - 1];
          if (newCandle.time === lastCandle.time) {
             const updated = [...existingData];
             updated[updated.length - 1] = newCandle;
             return { ...prevData, [coin]: updated };
          }
        }
        return { ...prevData, [coin]: [...existingData, newCandle] };
      });
    });

    // ZMIENIONY EVENT HANDLER
    socket.on('portfolio_state', (data) => {
      setPortfolioState(data);
    });

    socket.on('game_over', () => {
      console.log("Game Over");
      alert(`Koniec gry! Końcowy wynik: $${portfolioState?.total_value?.toFixed(2)}`);
      setGameStarted(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSelectCoin = (coin) => {
    setSelectedCoins(prev => 
      prev.includes(coin) ? prev.filter(c => c !== coin) : [...prev, coin]
    );
  };
  
  const handleStartGame = () => {
    if (!socketRef.current || selectedCoins.length === 0) return;
    socketRef.current.emit('select_coins', { coins: selectedCoins });
    setGameStarted(true);
    console.log('Rozpoczynanie gry z:', selectedCoins)
  };

  const handleTrade = (action, coin) => {
    if (!socketRef.current) return;
    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0) {
        alert("Wpisz poprawną kwotę!");
        return;
    }
    socketRef.current.emit('trade', {
      coin: coin,
      action: action, 
      amount: amount
    });
  };

  const isConnected = socketRef.current?.connected;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 font-sans">
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-yellow-500 tracking-wider">
          COINDUEL <span className="text-white text-lg font-normal">| Turbo Trader</span>
        </h1>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} ${isConnected ? 'animate-pulse' : ''}`}></span>
            <span>{isConnected ? 'Połączono' : 'Brak połączenia'}</span>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* 1. LEWY PANEL - WYBÓR COINÓW */}
        <div className="lg:col-span-1 bg-gray-800 p-4 rounded-xl border border-gray-700 h-fit flex flex-col">
            <h3 className="text-gray-400 text-xs font-bold uppercase mb-4 tracking-wider">Wybierz Rynki (1-3)</h3>
            
            {gameStarted ? (
                 <div className="text-center text-gray-500 py-8">
                    <p>Gra w toku...</p>
                    <p className="text-sm">Aby zagrać ponownie, odśwież stronę.</p>
                 </div>
            ) : (
              <>
                <div className="space-y-2">
                  {availableCoins.map(coin => (
                    <div 
                      key={coin}
                      onClick={() => handleSelectCoin(coin)}
                      className={`p-3 rounded-lg cursor-pointer transition flex justify-between items-center ${selectedCoins.includes(coin) ? 'bg-yellow-500 text-gray-900 font-bold' : 'bg-gray-700 hover:bg-gray-600'}`}
                    >
                      <span>{coin}</span>
                      {selectedCoins.includes(coin) && <span>✓</span>}
                    </div>
                  ))}
                </div>
                <button 
                  onClick={handleStartGame}
                  disabled={selectedCoins.length === 0 || selectedCoins.length > 3}
                  className="w-full mt-4 py-3 bg-green-600 text-white font-bold rounded-lg transition active:scale-95 shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  Rozpocznij Grę
                </button>
              </>
            )}
        </div>

        {/* 2. ŚRODKOWY PANEL - WYKRESY */}
        <div className="lg:col-span-2 space-y-4">
            {gameStarted && selectedCoins.length > 0 ? (
                selectedCoins.map(coin => (
                    <div key={coin} className="bg-gray-800 p-4 rounded-xl border border-gray-700 h-[480px] flex flex-col">
                        <h3 className="text-yellow-500 font-bold mb-2">{coin}</h3>
                        <div className="flex-1 w-full relative">
                            <div className="absolute inset-0">
                                <GameChart data={chartData[coin] || []} />
                            </div>
                        </div>
                    </div>
                ))
            ) : (
                <div className="bg-gray-800 p-4 rounded-xl border-2 border-dashed border-gray-700 h-[480px] flex items-center justify-center text-gray-500">
                    Wybierz coiny i rozpocznij grę, aby zobaczyć wykresy.
                </div>
            )}
        </div>

        {/* 3. PRAWY PANEL - HANDEL I STATYSTYKI */}
        <div className="lg:col-span-1 bg-gray-800 p-6 rounded-xl border border-gray-700 flex flex-col justify-start h-fit">
          {gameStarted && portfolioState ? (
            <>
              <PlayerStats portfolio={portfolioState} />

              <div className="my-6 border-t border-gray-700"></div>

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

              <CoinStats portfolio={portfolioState} onTrade={handleTrade} />
            </>
          ) : (
            <div className="text-center text-gray-500 py-16">
              <p>Statystyki pojawią się po rozpoczęciu gry.</p>
            </div>
          )}
        </div>
      </main>

      <footer className="text-center text-xs text-gray-500 mt-8">
        Charts by TradingView | CoinDuel Sprint 2
      </footer>
    </div>
  );
}

export default App;