# app.py
from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS

from market_maker import get_daily_scenario

app = Flask(__name__)
CORS(app)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# --- DANE W RAM ---
market_data = []
current_index = 0
is_running = False

@socketio.on('connect')
def on_connect():
    global market_data, current_index, is_running

    print("Client connected")

    if not market_data:
        market_data = get_daily_scenario()
        current_index = 0

    # Wyślij CAŁĄ historię
    socketio.emit("history", market_data)

    # Odpal stream tylko raz
    if not is_running:
        is_running = True
        socketio.start_background_task(stream_market)

def stream_market():
    global current_index

    while True:
        if current_index >= len(market_data):
            break

        candle = market_data[current_index]

        socketio.emit("candle", candle)
        current_index += 1

        socketio.sleep(0.5)

if __name__ == "__main__":
    socketio.run(app, port=5000, debug=True)
