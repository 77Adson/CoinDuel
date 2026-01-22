import React from 'react';

const StartGamePopup = ({ onStartGame, availableCoins }) => {
    const handleStart = () => {
        onStartGame();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-8 rounded-xl shadow-2xl text-center w-full max-w-md">
                <h2 className="text-3xl font-bold mb-4 text-yellow-400">Rozpocznij Grę</h2>
                <p className="text-gray-300 mb-6">Gra rozpocznie się ze wszystkimi dostępnymi rynkami.</p>
                
                <button
                    onClick={handleStart}
                    disabled={!onStartGame || availableCoins.length === 0}
                    className="w-full py-3 bg-green-600 text-white font-bold rounded-lg transition-transform transform active:scale-95 shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed disabled:shadow-none"
                >
                    Start
                </button>
            </div>
        </div>
    );
};

export default StartGamePopup;
