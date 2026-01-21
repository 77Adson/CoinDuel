from flask import Flask, request
from flask_socketio import SocketIO
from flask_cors import CORS

from market_maker import load_all_markets

app = Flask(__name__)
CORS(app)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# --- KONFIG ---
INITIAL_VISIBLE_CANDLES = 50
GAME_SPEED = 0.5
STARTING_BALANCE = 10_000

# --- DANE RYNKOWE (GLOBALNE, READ-ONLY) ---
ALL_MARKETS = load_all_markets()

# --- STAN GRY PER GRACZ ---
active_games = {}  # sid -> state


# ---------- HELPERS ----------

def create_game_state():
    return {
        "current_index": INITIAL_VISIBLE_CANDLES,
        "visible_coins": [],
        "cash": STARTING_BALANCE,
        "portfolio": {},     # coin -> {amount, invested}
        "running": False
    }


def emit_portfolio_state(sid):
    game = active_games[sid]
    prices = {
        c: ALL_MARKETS[c][game["current_index"] - 1]["close"]
        for c in game["visible_coins"]
    }

    coins_state = {}
    total_value = game["cash"]

    for coin, state in game["portfolio"].items():
        price = prices[coin]
        value = state["amount"] * price
        invested = state["invested"]

        pnl = ((value - invested) / invested * 100) if invested > 0 else 0.0
        total_value += value

        coins_state[coin] = {
            "amount": round(state["amount"], 6),
            "value": round(value, 2),
            "pnl_percent": round(pnl, 2),
            "price": price
        }

    socketio.emit("portfolio_state", {
        "cash": round(game["cash"], 2),
        "total_value": round(total_value, 2),
        "coins": coins_state
    }, to=sid)


# ---------- SOCKET EVENTS ----------

@socketio.on("connect")
def on_connect(auth=None):
    sid = request.sid
    print(f"Client connected: {sid}")

    active_games[sid] = create_game_state()

    # frontend może zapytać jakie coiny są dostępne
    socketio.emit("available_coins", list(ALL_MARKETS.keys()), to=sid)


@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    active_games.pop(sid, None)
    print(f"Client disconnected: {sid}")


@socketio.on("select_coins")
def select_coins(data):
    sid = request.sid
    coins = data.get("coins", [])

    if len(coins) == 0 or len(coins) > 3:
        return

    if not all(c in ALL_MARKETS for c in coins):
        return

    game = active_games[sid]
    game["visible_coins"] = coins

    game["portfolio"] = {
        c: {"amount": 0.0, "invested": 0.0} for c in coins
    }

    # historia tylko dla wybranych
    for coin in coins:
        socketio.emit("history", {
            "coin": coin,
            "candles": ALL_MARKETS[coin][:INITIAL_VISIBLE_CANDLES]
        }, to=sid)

    emit_portfolio_state(sid)

    if not game["running"]:
        game["running"] = True
        socketio.start_background_task(game_loop, sid)


def game_loop(sid):
    game = active_games[sid]

    while game["running"]:
        idx = game["current_index"]

        if idx >= len(next(iter(ALL_MARKETS.values()))):
            socketio.emit("game_over", to=sid)
            break

        for coin in game["visible_coins"]:
            candle = ALL_MARKETS[coin][idx]
            socketio.emit("candle", {
                "coin": coin,
                "candle": candle
            }, to=sid)

        emit_portfolio_state(sid)

        game["current_index"] += 1
        socketio.sleep(GAME_SPEED)


@socketio.on("trade")
def handle_trade(data):
    sid = request.sid
    game = active_games[sid]

    coin = data.get("coin")
    action = data.get("action")
    amount = float(data.get("amount", 0))

    if coin not in game["portfolio"] or amount <= 0:
        return

    price = ALL_MARKETS[coin][game["current_index"] - 1]["close"]
    state = game["portfolio"][coin]

    if action == "BUY" and game["cash"] >= amount:
        crypto = amount / price
        game["cash"] -= amount
        state["amount"] += crypto
        state["invested"] += amount

    elif action == "SELL":
        crypto = amount / price
        if state["amount"] >= crypto and state["invested"] > 0:
            ratio = crypto / state["amount"]
            state["invested"] -= state["invested"] * ratio
            state["amount"] -= crypto
            game["cash"] += amount

    emit_portfolio_state(sid)


# ---------- START ----------
if __name__ == "__main__":
    socketio.run(app, port=5000, debug=True, allow_unsafe_werkzeug=True)
