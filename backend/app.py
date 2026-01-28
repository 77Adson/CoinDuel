from flask import Flask, request
from flask_socketio import SocketIO
from flask_cors import CORS

from market_maker import load_all_markets
from models import db, Score
from flask import jsonify

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///scores.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)
CORS(app)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

INITIAL_VISIBLE_CANDLES = 50
STARTING_BALANCE = 10_000

ALL_MARKETS = load_all_markets()
active_games = {}  # sid -> game state


def create_game():
    return {
        "index": INITIAL_VISIBLE_CANDLES,
        "cash": STARTING_BALANCE,
        "coins": [],
        "portfolio": {},
        "speed": 0.5, 
        "username": None,
        "running": False
    }


@socketio.on("connect")
def connect():
    sid = request.sid
    active_games[sid] = create_game()
    socketio.emit("available_coins", list(ALL_MARKETS.keys()), to=sid)


@socketio.on("start_game")
def start_game(data=None):
    sid = request.sid
    game = active_games[sid]

    if not data:
        data = {}
    
    game["username"] = data.get("username", "anonymous")
    
    selected_coins = data.get("coins", [])
    if not selected_coins:
        selected_coins = list(ALL_MARKETS.keys())[:5]

    game["coins"] = selected_coins
    game["speed"] = float(data.get("speed", 0.5))

    if not game["coins"]:
        socketio.emit("error", {"msg": "No coins available/selected"}, to=sid)
        return

    game["portfolio"] = {
        c: {"amount": 0.0, "invested": 0.0}
        for c in game["coins"]
    }

    for c in game["coins"]:
        if c in ALL_MARKETS:
            socketio.emit(
                "history",
                {
                    "coin": c,
                    "candles": ALL_MARKETS[c][:INITIAL_VISIBLE_CANDLES],
                },
                to=sid,
            )

    game["running"] = True
    socketio.start_background_task(game_loop, sid)


@socketio.on("update_speed")
def update_speed(data):
    sid = request.sid
    if sid in active_games:
        try:
            new_speed = float(data.get("speed", 0.5))
            new_speed = max(0.1, min(new_speed, 2.0))
            active_games[sid]["speed"] = new_speed
        except ValueError:
            pass


def game_loop(sid):
    game = active_games[sid]
    
    if not game["coins"] or not ALL_MARKETS:
        return

    first_coin = game["coins"][0]
    # Zabezpieczenie na wypadek braku klucza w ALL_MARKETS
    if first_coin not in ALL_MARKETS:
        return

    max_len = len(ALL_MARKETS[first_coin])

    while game["running"]:
        if sid not in active_games:
            break

        idx = game["index"]
        if idx >= max_len:
            finish_game(sid)
            break

        for c in game["coins"]:
            if c in ALL_MARKETS:
                socketio.emit("candle", {
                    "coin": c,
                    "candle": ALL_MARKETS[c][idx]
                }, to=sid)

        emit_portfolio(sid)
        game["index"] += 1
        
        socketio.sleep(game["speed"])


def emit_portfolio(sid):
    game = active_games[sid]
    idx = game["index"] - 1
    if idx < 0: idx = 0

    prices = {}
    for c in game["coins"]:
        if c in ALL_MARKETS and idx < len(ALL_MARKETS[c]):
             prices[c] = ALL_MARKETS[c][idx]["close"]
        else:
             prices[c] = 0

    total = game["cash"]
    coins_data = {}

    for c, s in game["portfolio"].items():
        price = prices.get(c, 0)
        val = s["amount"] * price
        total += val
        
        invested = s["invested"]
        pnl_percent = 0
        if invested > 0:
            pnl_percent = ((val - invested) / invested) * 100

        coins_data[c] = {
            "amount": round(s["amount"], 6),
            "value": round(val, 2),
            "price": price,
            "pnl_percent": pnl_percent
        }

    socketio.emit("portfolio_state", {
        "cash": round(game["cash"], 2),
        "total_value": round(total, 2),
        "coins": coins_data
    }, to=sid)


@socketio.on("trade")
def trade(data):
    sid = request.sid
    if sid not in active_games: return
    game = active_games[sid]

    c = data["coin"]
    amt = float(data["amount"])
    
    current_idx = game["index"] - 1
    if c not in ALL_MARKETS: return
    price = ALL_MARKETS[c][current_idx]["close"]
    
    state = game["portfolio"][c]

    if data["action"] == "BUY":
        if game["cash"] >= amt:
            crypto = amt / price
            game["cash"] -= amt
            state["amount"] += crypto
            state["invested"] += amt
        else:
            socketio.emit("error", {"msg": "Niewystarczające środki"}, to=sid)

    elif data["action"] == "SELL":
        crypto_to_sell = amt / price
        if state["amount"] >= crypto_to_sell * 0.999:
            ratio = crypto_to_sell / state["amount"]
            state["invested"] *= (1 - ratio)
            
            state["amount"] -= crypto_to_sell
            game["cash"] += amt
            
            if state["amount"] < 0.000001:
                state["amount"] = 0
                state["invested"] = 0
        else:
             socketio.emit("error", {"msg": "Nie masz wystarczająco kryptowaluty"}, to=sid)


def finish_game(sid):
    if sid not in active_games: return
    game = active_games[sid]
    
    emit_portfolio(sid)
    
    # 1. Obliczamy Total
    total = game["cash"]
    idx = game["index"] - 1
    for c, s in game["portfolio"].items():
        if c in ALL_MARKETS:
            # Zabezpieczenie indexu
            safe_idx = min(idx, len(ALL_MARKETS[c]) - 1)
            price = ALL_MARKETS[c][safe_idx]["close"]
            total += s["amount"] * price
    
    # 2. POPRAWKA: Używamy app.app_context() do zapisu w bazie
    try:
        with app.app_context():  # <--- TO JEST KLUCZOWA ZMIANA
            score = Score(
                username=game["username"],
                score=total,
                assets=",".join(game["coins"])
            )
            db.session.add(score)
            db.session.commit()
            print(f"[DB] Zapisano wynik dla {game['username']}: {total}")
            
        socketio.emit("game_over", {"total": round(total, 2)}, to=sid)
    except Exception as e:
        print(f"Błąd zapisu wyniku: {e}")
        # Mimo błędu bazy, wysyłamy info do gracza
        socketio.emit("game_over", {"total": round(total, 2)}, to=sid)

    game["running"] = False


@app.route("/leaderboard", methods=["GET"])
def leaderboard():
    top = (
        Score.query
        .order_by(Score.score.desc())
        .limit(10)
        .all()
    )
    return jsonify([s.to_dict() for s in top])

if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    socketio.run(app, port=5000, debug=True, allow_unsafe_werkzeug=True)