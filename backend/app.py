from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS
from market_maker import get_daily_scenario
import time

app = Flask(__name__)
CORS(app)

# async_mode='eventlet' jest lepszy dla wydajności, 
# ale 'threading' jest łatwiejszy w instalacji na Windows.
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# --- KONFIGURACJA GRY ---
INITIAL_VISIBLE_CANDLES = 50
GAME_SPEED = 0.5

# --- STAN APLIKACJI (GLOBALNY - uproszczenie dla MVP) ---
market_data = []      # Tutaj trzymamy CAŁY wylosowany scenariusz (np. 200 świeczek)
current_index = 0     # Wskaźnik: "którą świeczkę teraz wysyłamy?"
is_running = False    # Czy pętla czasu już działa?

@socketio.on('connect')
def on_connect():
    global market_data, current_index, is_running

    print(f"Client connected: {socketio}")

    # 1. Losujemy scenariusz TYLKO RAZ (jeśli puste)
    if not market_data:
        scenario_obj = get_daily_scenario()
        # get_daily_scenario zwraca słownik {'data': [...], ...} lub samą listę
        # Zabezpieczamy się na oba przypadki:
        if isinstance(scenario_obj, dict):
            market_data = scenario_obj['data']
        else:
            market_data = scenario_obj
        
        print(f"Loaded scenario. Total candles: {len(market_data)}")
        
        # Ustawiamy wskaźnik na koniec "historii startowej"
        current_index = INITIAL_VISIBLE_CANDLES

    # 2. WAŻNE: Wysyłamy do klienta TYLKO POCZĄTEK (Wycinek)
    # Zamiast wysyłać całość [:], wysyłamy tylko [:50]
    initial_payload = market_data[:INITIAL_VISIBLE_CANDLES]
    
    socketio.emit("history", initial_payload)
    print(f"Sent initial history: {len(initial_payload)} candles")

    # 3. Uruchamiamy strumień w tle (jeśli jeszcze nie działa)
    if not is_running:
        is_running = True
        socketio.start_background_task(stream_market)
        print("Market stream started...")

def stream_market():
    global current_index, is_running

    while True:
        # Sprawdzamy, czy nie skończyły nam się dane
        if current_index >= len(market_data):
            print("Koniec danych. Game Over.")
            is_running = False
            break

        # Pobieramy AKTUALNĄ świeczkę (tę jedną, którą ma dostać gracz teraz)
        next_candle = market_data[current_index]

        # Wysyłamy do wszystkich podłączonych
        socketio.emit("candle", next_candle)
        
        # Przesuwamy wskaźnik czasu
        current_index += 1
        
        # Czekamy (symulacja czasu)
        socketio.sleep(GAME_SPEED)

if __name__ == "__main__":
    # allow_unsafe_werkzeug=True jest potrzebne czasem przy najnowszych wersjach Flaska
    socketio.run(app, port=5000, debug=True, allow_unsafe_werkzeug=True)