import { useState, useEffect } from 'react';
import { GameChart } from './components/GameChart';

// Przykładowe dane startowe, żebyś widział, że wykres działa
// (Później zastąpimy to danymi z backendu)
const INITIAL_DATA = [
  { time: '2018-12-22', open: 75.16, high: 82.84, low: 36.16, close: 45.72 },
  { time: '2018-12-23', open: 45.12, high: 53.90, low: 45.12, close: 48.09 },
  { time: '2018-12-24', open: 60.71, high: 60.71, low: 53.39, close: 59.29 },
  { time: '2018-12-25', open: 68.26, high: 68.26, low: 59.04, close: 60.50 },
  { time: '2018-12-26', open: 67.71, high: 105.85, low: 66.67, close: 91.04 },
  { time: '2018-12-27', open: 91.04, high: 121.40, low: 82.70, close: 111.40 },
  { time: '2018-12-28', open: 111.51, high: 142.83, low: 103.34, close: 131.25 },
  { time: '2018-12-29', open: 131.33, high: 151.17, low: 77.68, close: 96.43 },
];

function App() {
  // Stan na dane wykresu
  const [chartData, setChartData] = useState(INITIAL_DATA);

  return (
    // Główny kontener (Full Screen, ciemne tło)
    <div className="min-h-screen bg-gray-900 text-white p-4 font-sans">
      
      {/* HEADER */}
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-yellow-500 tracking-wider">
            COINDUEL <span className="text-white text-lg font-normal">| Turbo Trader</span>
          </h1>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span>
            <span>Online</span>
          </div>
          <div className="text-gray-400">Gracz: <span className="text-white">Ty</span></div>
        </div>
      </header>

      {/* MAIN GRID - Podział na 2 kolumny na dużych ekranach */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEWA KOLUMNA: Wykres (zajmuje 2/3 szerokości) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <div className="flex justify-between mb-2">
              <span className="text-gray-400 text-sm">BTC/USD (Replay)</span>
              <span className="text-xl font-mono font-bold">$131.25</span>
            </div>
            {/* TU JEST TWÓJ KOMPONENT WYKRESU */}
            <GameChart data={chartData} />
          </div>
        </div>

        {/* PRAWA KOLUMNA: Panel Gracza (zajmuje 1/3 szerokości) */}
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex flex-col justify-between h-[480px]">
          
          {/* Sekcja: Portfel */}
          <div>
            <h2 className="text-gray-400 uppercase text-xs font-bold mb-2">Twój Portfel</h2>
            <div className="text-4xl font-bold text-green-400 mb-1">$10,000.00</div>
            <div className="text-sm text-gray-500">Zysk: 0.00%</div>
          </div>

          {/* Sekcja: Przyciski (Placeholder pod Twoją Figmę) */}
          <div className="space-y-3">
            <button className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition shadow-lg shadow-green-900/50">
              KUP (BUY)
            </button>
            <button className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition shadow-lg shadow-red-900/50">
              SPRZEDAJ (SELL)
            </button>
          </div>

        </div>
      </main>

    </div>
  );
}

export default App;