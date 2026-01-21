import React from 'react';

const PlayerStats = ({ portfolio }) => {
    if (!portfolio) return null;

    const pnl = portfolio.total_value - 10000;
    const pnlPercent = (pnl / 10000) * 100;

    return (
        <div className="flex items-center gap-6">
            <div>
                <h2 className="text-gray-400 uppercase text-xs font-bold">Wartość Portfela</h2>
                <div className={`text-2xl font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${portfolio.total_value?.toFixed(2) || '0.00'}
                </div>
            </div>
            <div>
                <h2 className="text-gray-400 uppercase text-xs font-bold">Dostępne Środki</h2>
                <div className="text-2xl font-bold text-white">
                    ${portfolio.cash?.toFixed(2) || '0.00'}
                </div>
            </div>
            <div>
                <h2 className="text-gray-400 uppercase text-xs font-bold">Zysk/Strata (PnL)</h2>
                <div className={`text-2xl font-bold ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {pnl.toFixed(2)}$ ({pnlPercent.toFixed(2)}%)
                </div>
            </div>
        </div>
    );
};


const Header = ({ isConnected, portfolio }) => {
    return (
        <header className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
            <h1 className="text-2xl font-bold text-yellow-500 tracking-wider">
                COINDUEL <span className="text-white text-lg font-normal">| Turbo Trader</span>
            </h1>

            {portfolio && <PlayerStats portfolio={portfolio} />}
            
            <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} ${isConnected ? 'animate-pulse' : ''}`}></span>
                    <span>{isConnected ? 'Połączono' : 'Brak połączenia'}</span>
                </div>
            </div>
        </header>
    );
};

export default Header;
