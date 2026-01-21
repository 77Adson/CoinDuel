import React, { useState } from 'react';

const CoinControl = ({ coin, onTrade }) => {
    const [tradeAmount, setTradeAmount] = useState(100);

    const handleTrade = (action) => {
        if (!coin) return;
        const amount = parseFloat(tradeAmount);
        if (isNaN(amount) || amount <= 0) {
            alert("Wpisz poprawną kwotę!");
            return;
        }
        onTrade(action, coin, amount);
    };

    if (!coin) {
        return (
            <div className="text-center text-gray-500 py-16">
              <p>Kliknij na wykres, aby handlować.</p>
            </div>
          );
    }

    return (
        <div>
            <h3 className="text-xl text-yellow-500 font-bold mb-4">Handel: {coin}</h3>
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

            <div className="flex gap-4 mt-4">
                <button 
                    onClick={() => handleTrade('BUY')} 
                    className="w-full py-3 bg-green-600 text-white font-bold rounded-lg transition active:scale-95 shadow-lg"
                >
                    KUP
                </button>
                <button 
                    onClick={() => handleTrade('SELL')}
                    className="w-full py-3 bg-red-600 text-white font-bold rounded-lg transition active:scale-95 shadow-lg"
                >
                    SPRZEDAJ
                </button>
            </div>
        </div>
    );
};

export default CoinControl;