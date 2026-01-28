import { useState, useEffect, useRef } from 'react';
import { GameChart } from './components/GameChart';
import Header from './components/Header';
import CoinControl from './components/CoinControl';
import StartGamePopup from './components/StartGamePopup';
import { io } from 'socket.io-client';

const BACKEND_URL = "http://localhost:5000";

// --- Komponent: Statystyki w trakcie gry ---
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
        <div key={coin} className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
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

// --- Komponent: Suwak Prędkości ---
const SpeedControl = ({ onSpeedChange }) => {
    const [sliderValue, setSliderValue] = useState(75);

    const handleChange = (e) => {
        const val = parseInt(e.target.value);
        setSliderValue(val);
        // 0 (Lewo/Wolno) = 2.0s, 100 (Prawo/Szybko) = 0.1s
        const speedInSeconds = 2.0 - ((val / 100) * 1.9);
        onSpeedChange(speedInSeconds);
    };

    return (
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 mb-4">
            <div className="flex justify-between mb-2">
                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Szybkość Rynku</h3>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-500 font-bold uppercase">Slow</span>
                <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={sliderValue}
                    onChange={handleChange}
                    className="slider-thumb w-full" 
                />
                <span className="text-[10px] text-yellow-500 font-bold uppercase">Fast</span>
            </div>
        </div>
    );
};

// --- Komponent: Ekran Końcowy z Rankingiem (Scoreboard) ---
const GameOverSummary = ({ data }) => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Pobieramy Top 10 z REST API
        fetch(`${BACKEND_URL}/leaderboard`)
            .then(res => res.json())
            .then(data => {
                setLeaderboard(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Błąd pobierania rankingu:", err);
                setLoading(false);
            });
    }, []);

    return (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 animate-fade-in overflow-y-auto py-10">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl text-center max-w-2xl w-full border border-yellow-500/30 my-auto">
                <h2 className="text-4xl font-black text-white mb-2">GAME OVER</h2>
                <div className="w-16 h-1 bg-yellow-500 mx-auto mb-8"></div>
                
                {/* Twój wynik */}
                <div className="mb-8 bg-gray-900/50 p-6 rounded-xl border border-gray-700">
                    <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Twój Wynik</p>
                    <p className={`text-5xl font-mono font-bold ${data.total >= 10000 ? 'text-green-400' : 'text-red-400'}`}>
                        ${data.total?.toFixed(2)}
                    </p>
                    <p className={`text-sm mt-2 font-bold ${data.total >= 10000 ? 'text-green-500' : 'text-red-500'}`}>
                        {data.total >= 10000 ? 'ZYSK' : 'STRATA'}: ${(data.total - 10000).toFixed(2)}
                    </p>
                </div>

                {/* Scoreboard */}
                <div className="text-left">
                    <h3 className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-4 border-b border-gray-700 pb-2">Top 10 Graczy</h3>
                    
                    <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                        <table className="w-full text-sm text-left text-gray-400">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-800 border-b border-gray-700">
                                <tr>
                                    <th className="px-4 py-3">#</th>
                                    <th className="px-4 py-3">Gracz</th>
                                    <th className="px-4 py-3">Wynik</th>
                                    <th className="px-4 py-3 text-right">Data</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="4" className="p-4 text-center">Ładowanie rankingu...</td></tr>
                                ) : leaderboard.length > 0 ? (
                                    leaderboard.map((score, index) => (
                                        <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/50">
                                            <td className="px-4 py-3 font-mono text-yellow-600 font-bold">{index + 1}.</td>
                                            <td className="px-4 py-3 font-bold text-white">{score.username}</td>
                                            <td className={`px-4 py-3 font-mono ${score.score >= 10000 ? 'text-green-400' : 'text-red-400'}`}>
                                                ${score.score.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs text-gray-500">{score.date}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="4" className="p-4 text-center">Brak wyników w bazie.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-8 text-gray-500 text-xs italic">
                    Odśwież stronę (F5), aby zagrać ponownie.
                </div>
            </div>
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
  
  // Ekrany
  const [isStartGamePopupVisible, setIsStartGamePopupVisible] = useState(true);
  const [gameOverData, setGameOverData] = useState(null);

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

    socket.on('connect', () => console.log('✅ Połączono'));
    socket.on('error', (data) => alert(`Błąd: ${data.msg}`));
    
    socket.on('available_coins', (coins) => setAvailableCoins(coins));

    socket.on('history', (data) => {
      const { coin, candles } = data;
      const formattedData = candles.map(c => formatCandle(c)).filter(Boolean).sort((a, b) => a.time - b.time);
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
        if (existingData.length > 0 && existingData[existingData.length - 1].time === newCandle.time) {
             const updated = [...existingData];
             updated[updated.length - 1] = newCandle;
             return { ...prevData, [coin]: updated };
        }
        const newData = [...existingData, newCandle];
        if (newData.length > 500) newData.shift(); 
        return { ...prevData, [coin]: newData };
      });
    });

    socket.on('portfolio_state', (data) => setPortfolioState(data));

    socket.on('game_over', (data) => {
      console.log("Game Over Received", data);
      setGameOverData(data); // To uruchomi wyświetlenie GameOverSummary
      setGameStarted(false); 
      setPortfolioState(null);
    });

    return () => socket.disconnect();
  }, []);

  const handleVisibilityChange = (coin) => {
    setVisibleCoins(prev => prev.includes(coin) ? prev.filter(c => c !== coin) : [...prev, coin]);
  };
  
  // ZMIANA: Funkcja przyjmuje teraz nickname
  const handleStartGame = (nickname) => {
    if (!socketRef.current) return;
    
    const initialSpeed = 0.5;

    socketRef.current.emit('start_game', {
        username: nickname, // Wysyłamy wprowadzony nick
        coins: availableCoins, 
        speed: initialSpeed
    });

    setAllCoins(availableCoins);
    setVisibleCoins(availableCoins);
    if(availableCoins.length > 0) setSelectedCoinForStats(availableCoins[0]);
    
    setGameStarted(true);
    setIsStartGamePopupVisible(false);
  };

  const handleTrade = (action, coin, amount) => {
    if (!socketRef.current) return;
    socketRef.current.emit('trade', { coin, action, amount });
  };

  const handleSpeedUpdate = (newSpeed) => {
      if (socketRef.current && gameStarted) {
          socketRef.current.emit('update_speed', { speed: newSpeed });
      }
  };

  const isConnected = socketRef.current?.connected;
  const chartsToShow = gameStarted ? visibleCoins : [];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 font-sans">
      <Header isConnected={isConnected} portfolio={portfolioState} />

      {/* Popup Startowy */}
      {isStartGamePopupVisible && !gameOverData && (
          <StartGamePopup onStartGame={handleStartGame} availableCoins={availableCoins} />
      )}

      {/* Ekran Końca Gry z Tabelą Wyników */}
      {gameOverData && (
          <GameOverSummary data={gameOverData} />
      )}

      <main className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Lewy panel */}
        <div className="lg:col-span-1 bg-gray-800 p-4 rounded-xl border border-gray-700 h-fit flex flex-col">
            <h3 className="text-gray-400 text-xs font-bold uppercase mb-4 tracking-wider">Widoczne Rynki</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {allCoins.length > 0 ? allCoins.map(coin => (
                <div 
                    key={coin}
                    onClick={() => handleVisibilityChange(coin)}
                    className={`p-3 rounded-lg cursor-pointer transition flex justify-between items-center ${visibleCoins.includes(coin) ? 'bg-yellow-500 text-gray-900 font-bold' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                    <span>{coin}</span>
                    {visibleCoins.includes(coin) && <span>✓</span>}
                </div>
                )) : (
                    <div className="text-gray-500 text-sm">Oczekiwanie na dane...</div>
                )}
            </div>
        </div>

        {/* Środek */}
        <div className="lg:col-span-2 space-y-4">
            {gameStarted && chartsToShow.length > 0 ? (
                chartsToShow.map(coin => (
                    <div key={coin} 
                        onClick={() => setSelectedCoinForStats(coin)}
                        className={`bg-gray-800 p-4 rounded-xl border h-[480px] flex flex-col cursor-pointer transition ${selectedCoinForStats === coin ? 'border-yellow-500' : 'border-gray-700'}`}>
                        <h3 className="text-yellow-500 font-bold mb-2 flex justify-between">
                            {coin}
                            {chartData[coin]?.length > 0 && (
                                <span className="text-white text-sm font-mono">
                                    ${chartData[coin][chartData[coin].length - 1].close.toFixed(2)}
                                </span>
                            )}
                        </h3>
                        <div className="flex-1 w-full relative">
                            <div className="absolute inset-0">
                                <GameChart data={chartData[coin] || []} />
                            </div>
                        </div>
                    </div>
                ))
            ) : (
                <div className="bg-gray-800 p-4 rounded-xl border-2 border-dashed border-gray-700 h-[480px] flex items-center justify-center text-gray-500 flex-col gap-2">
                    <p>{!gameOverData ? (gameStarted ? "Wybierz widoczne coiny" : "Wprowadź nick, aby zagrać") : "Gra zakończona"}</p>
                </div>
            )}
        </div>

        {/* Prawy panel */}
        <div className="lg:col-span-1 flex flex-col h-fit sticky top-6">
            
            {gameStarted && !gameOverData && (
                <SpeedControl onSpeedChange={handleSpeedUpdate} />
            )}

            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                {gameStarted && portfolioState ? (
                    <>
                    <CoinControl coin={selectedCoinForStats} onTrade={handleTrade} />
                    <div className="my-6 border-t border-gray-700"></div>
                    <CoinStats portfolio={portfolioState} />
                    </>
                ) : (
                    <div className="text-center text-gray-500 py-16">
                    <p>{gameOverData ? "Dzięki za grę!" : "Powodzenia!"}</p>
                    </div>
                )}
            </div>
        </div>
      </main>

      <footer className="text-center text-xs text-gray-500 mt-8 mb-4">
        CoinDuel Sprint 2
      </footer>
    </div>
  );
}

export default App;