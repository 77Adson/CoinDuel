import { useState, useEffect } from 'react';
import { GameChart } from './components/GameChart';
import { io } from 'socket.io-client';

const BACKEND_URL = "http://localhost:5000";

function App() {
  const [chartData, setChartData] = useState([]);
  const [balance, setBalance] = useState(10000);

  // --- 1. FUNKCJA NAPRAWIAJĄCA DANE ---
  // To jest kluczowe. Backend wysyła "Open", wykres chce "open".
  // Backend wysyła datę jako string, wykres chce sekundy.
  const formatCandle = (rawCandle) => {
    if (!rawCandle) return null;

    // Próba wyciągnięcia czasu z różnych możliwych kluczy
    let timeVal = rawCandle.Date || rawCandle.Datetime || rawCandle.time || rawCandle.Time;
    
    // Konwersja daty (String) na Timestamp (Sekundy)
    // Lightweight Charts WYMAGA sekund (Unix Timestamp)
    let timeInSeconds = timeVal;
    if (typeof timeVal === 'string') {
      timeInSeconds = new Date(timeVal).getTime() / 1000;
    } else if (typeof timeVal === 'number' && timeVal > 20000000000) {
      // Jeśli liczba jest ogromna (milisekundy), podziel przez 1000
      timeInSeconds = timeVal / 1000;
    }

    // Jeśli po konwersji czas jest NaN (błąd), zwróć null
    if (!timeInSeconds || isNaN(timeInSeconds)) {
      console.error("Błędny format czasu w świeczce:", rawCandle);
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
    // Łączymy się z Twoim backendem
    const socket = io(BACKEND_URL);

    socket.on('connect', () => {
      console.log('✅ Połączono z Backendem (ID:', socket.id, ')');
    });

    // --- 2. ODBIÓR HISTORII (Nazwa zdarzenia: 'history') ---
    socket.on('history', (data) => {
      console.log('📦 Otrzymano historię:', data.length, 'świeczek.');
      
      // Formatujemy każdą świeczkę
      const formattedData = data
        .map(c => formatCandle(c))
        .filter(c => c !== null) // Wyrzucamy błędne
        .sort((a, b) => a.time - b.time); // Wykres wymaga chronologii!

      if (formattedData.length > 0) {
        setChartData(formattedData);
      } else {
        console.warn("⚠️ Otrzymano historię, ale jest pusta lub źle sformatowana.");
      }
    });

    // --- 3. ODBIÓR POJEDYNCZEJ ŚWIECZKI (Nazwa zdarzenia: 'candle') ---
    socket.on('candle', (rawCandle) => {
      // console.log('🕯️ Nowa świeczka:', rawCandle); // Odkomentuj do debugowania
      
      const newCandle = formatCandle(rawCandle);
      if (!newCandle) return;

      setChartData(prevData => {
        // Unikanie duplikatów (jeśli ta sama świeczka przyjdzie dwa razy)
        if (prevData.length > 0) {
          const lastCandle = prevData[prevData.length - 1];
          if (newCandle.time === lastCandle.time) {
             // Aktualizacja ostatniej świeczki
             const updated = [...prevData];
             updated[updated.length - 1] = newCandle;
             return updated;
          }
          if (newCandle.time < lastCandle.time) {
            // Ignorujemy świeczki z przeszłości (błędy kolejności)
            return prevData;
          }
        }
        // Dodanie nowej
        return [...prevData, newCandle];
      });
      
      // Tutaj możemy aktualizować cenę portfela w przyszłości
      // setBalance(...)
    });

    return () => socket.disconnect();
  }, []);

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

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEWA STRONA: WYKRES */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
             <GameChart data={chartData} />
          </div>
        </div>

        {/* PRAWA STRONA: PANEL */}
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex flex-col justify-between h-[480px]">
          <div>
            <h2 className="text-gray-400 uppercase text-xs font-bold mb-2">Twój Portfel</h2>
            <div className="text-4xl font-bold text-green-400 mb-1">${balance.toFixed(2)}</div>
          </div>
          <div className="space-y-3">
            <button className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition">KUP (BUY)</button>
            <button className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition">SPRZEDAJ (SELL)</button>
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-gray-500 mt-8">
        Charts by <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-500">TradingView</a>
      </footer>
    </div>
  );
}

export default App;