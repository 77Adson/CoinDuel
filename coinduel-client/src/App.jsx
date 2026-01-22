import { useState, useEffect, useRef } from 'react';
import { GameChart } from './components/GameChart';
import Header from './components/Header';
import CoinControl from './components/CoinControl';
import StartGamePopup from './components/StartGamePopup';
import { io } from 'socket.io-client';

const BACKEND_URL = "http://localhost:5000";

const CoinStats = ({ portfolio }) => {
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
          </div>
        </div>
      ))}
    </div>
  );
};


function App() {
  const [chartData, setChartData] = useState({});
  
  const [availableCoins, setAvailableCoins] = useState([]);
  const [visibleCoins, setVisibleCoins] = useState([]);
  const [allCoins, setAllCoins] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [portfolioState, setPortfolioState] = useState(null);
  const [selectedCoinForStats, setSelectedCoinForStats] = useState(null);
  const [isStartGamePopupVisible, setIsStartGamePopupVisible] = useState(true);

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

    socket.on('portfolio_state', (data) => {
      setPortfolioState(data);
    });

    socket.on('game_over', () => {
      console.log("Game Over");
      alert(`Koniec gry! Końcowy wynik: ${portfolioState?.total_value?.toFixed(2)}`);
      setGameStarted(false);
      setIsStartGamePopupVisible(true);
      setPortfolioState(null);
      setChartData({});
      setAllCoins([]);
      setVisibleCoins([]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleVisibilityChange = (coin) => {
    setVisibleCoins(prev => 
      prev.includes(coin) ? prev.filter(c => c !== coin) : [...prev, coin]
    );
  };
  
  const handleStartGame = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('start_game');
    setAllCoins(availableCoins);
    setVisibleCoins(availableCoins);
    if(availableCoins.length > 0){
        setSelectedCoinForStats(availableCoins[0]);
    }
    setGameStarted(true);
    setIsStartGamePopupVisible(false);
    console.log('Rozpoczynanie gry')
  };

  const handleTrade = (action, coin, amount) => {
    if (!socketRef.current) return;
    socketRef.current.emit('trade', {
      coin: coin,
      action: action, 
      amount: amount
    });
  };

  const isConnected = socketRef.current?.connected;

  const chartsToShow = gameStarted ? visibleCoins : [];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 font-sans">
      <Header isConnected={isConnected} portfolio={portfolioState} />

      {isStartGamePopupVisible && <StartGamePopup onStartGame={handleStartGame} availableCoins={availableCoins} />}

      <main className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        <div className="lg:col-span-1 bg-gray-800 p-4 rounded-xl border border-gray-700 h-fit flex flex-col">
            <h3 className="text-gray-400 text-xs font-bold uppercase mb-4 tracking-wider">Widoczne Rynki</h3>
            
            <div className="space-y-2">
                {allCoins.map(coin => (
                <div 
                    key={coin}
                    onClick={() => handleVisibilityChange(coin)}
                    className={`p-3 rounded-lg cursor-pointer transition flex justify-between items-center ${visibleCoins.includes(coin) ? 'bg-yellow-500 text-gray-900 font-bold' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                    <span>{coin}</span>
                    {visibleCoins.includes(coin) && <span>✓</span>}
                </div>
                ))}
            </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
            {gameStarted && chartsToShow.length > 0 ? (
                chartsToShow.map(coin => (
                    <div key={coin} 
                        onClick={() => setSelectedCoinForStats(coin)}
                        className={`bg-gray-800 p-4 rounded-xl border h-[480px] flex flex-col cursor-pointer transition ${selectedCoinForStats === coin ? 'border-yellow-500' : 'border-gray-700'}`}>
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
                    {gameStarted ? "Wybierz widoczne coiny" : "Oczekiwanie na rozpoczęcie gry..."}
                </div>
            )}
        </div>

        <div className="lg:col-span-1 bg-gray-800 p-6 rounded-xl border border-gray-700 flex flex-col justify-start h-fit sticky top-6">
          {gameStarted && portfolioState ? (
            <>
              <CoinControl coin={selectedCoinForStats} onTrade={handleTrade} />
              <div className="my-6 border-t border-gray-700"></div>
              <CoinStats portfolio={portfolioState} />
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