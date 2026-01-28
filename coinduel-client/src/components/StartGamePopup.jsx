import React, { useState } from 'react';

const StartGamePopup = ({ onStartGame, availableCoins }) => {
    const [nickname, setNickname] = useState("");

    const handleStart = () => {
        if (nickname.trim()) {
            onStartGame(nickname);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && nickname.trim()) {
            handleStart();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-8 rounded-xl shadow-2xl text-center w-full max-w-md border border-gray-700">
                <h2 className="text-3xl font-bold mb-2 text-yellow-400 tracking-wider">COINDUEL</h2>
                <p className="text-gray-400 mb-6 text-sm">Wprowadź swój nick, aby dołączyć do rankingu.</p>
                
                <input
                    type="text"
                    placeholder="Twój Nick"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={15}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 px-4 text-white mb-6 focus:outline-none focus:border-yellow-500 text-center font-bold text-lg placeholder-gray-600 uppercase"
                    autoFocus
                />

                <button
                    onClick={handleStart}
                    disabled={!nickname.trim() || availableCoins.length === 0}
                    className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 text-gray-900 font-bold rounded-lg transition-transform transform active:scale-95 shadow-lg disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed disabled:shadow-none uppercase tracking-wide"
                >
                    Rozpocznij Grę
                </button>
                
                {availableCoins.length === 0 && (
                     <p className="text-xs text-red-400 mt-4">Oczekiwanie na połączenie z serwerem...</p>
                )}
            </div>
        </div>
    );
};

export default StartGamePopup;