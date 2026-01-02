from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import eventlet

# Importy naszych modułów
from models import db, Score
from market_maker import get_daily_scenario

# Konfiguracja App
app = Flask(__name__)
app.config['SECRET_KEY'] = 'sekretny_klucz_do_produkcji_zmien_to'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Inicjalizacja
CORS(app) # Pozwala frontendowi (np. localhost:5173) gadać z backendem
db.init_app(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Tworzymy tabele w bazie przy starcie
with app.app_context():
    db.create_all()

# --- ZMIENNE W PAMIĘCI (RAM) ---
# Przechowujemy stan gry dla każdego aktywnego gracza
# Klucz: socket_id, Wartość: { balance, inventory, current_tick, scenario_data }
active_games = {}

# --- ENDPOINTY HTTP (Dla rankingu) ---
@app.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    # Pobierz top 10 wyników
    top_scores = Score.query.order_by(Score.score.desc()).limit(10).all()
    return jsonify([s.to_dict() for s in top_scores])

# --- WEBSOCKETS (Gra) ---

@socketio.on('connect')
def handle_connect():
    print(f"Klient połączony: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in active_games:
        del active_games[request.sid]
    print(f"Klient rozłączony: {request.sid}")

@socketio.on('start_game')
def start_game(data):
    """Rozpoczyna sesję gry dla użytkownika"""
    sid = request.sid
    username = data.get('username', 'Anonim')
    
    # 1. Pobierz dzisiejszy scenariusz
    scenario = get_daily_scenario()
    
    if not scenario:
        emit('error', {'msg': 'Brak danych rynkowych na serwerze!'})
        return

    # 2. Zainicjuj stan gracza
    active_games[sid] = {
        'username': username,
        'balance': 10000.0,  # Startowe USD
        'crypto_amount': 0.0,
        'scenario': scenario['data'], # Pełna lista świeczek na dziś
        'total_ticks': len(scenario['data']),
        'current_tick': 0,
        'running': True
    }

    # Wyślij info o starcie do klienta
    emit('game_started', {
        'asset': scenario['asset'],
        'balance': 10000.0,
        'total_ticks': len(scenario['data'])
    })

    # 3. Uruchom pętlę gry w tle dla tego konkretnego gracza
    socketio.start_background_task(game_loop, sid)

def game_loop(sid):
    """To jest pętla, która 'popycha' czas do przodu dla gracza"""
    while True:
        # Sprawdzamy czy gra nadal istnieje i trwa
        game = active_games.get(sid)
        if not game or not game['running']:
            break

        idx = game['current_tick']
        candles = game['scenario']

        # KONIEC GRY
        if idx >= len(candles):
            finish_game(sid)
            break

        # Pobieramy aktualną świeczkę
        current_candle = candles[idx]
        
        # Obliczamy aktualną wartość portfela (USD + KRYPTO * CENA)
        # Przyjmujemy 'Close' jako aktualną cenę do wyceny
        current_price = current_candle['Close'] # lub 'close' zależnie od CSV
        total_value = game['balance'] + (game['crypto_amount'] * current_price)

        # Wysyłamy dane do gracza
        socketio.emit('new_candle', {
            'candle': current_candle,
            'portfolio_value': round(total_value, 2),
            'current_price': current_price,
            'tick_index': idx
        }, to=sid) # Ważne: to=sid wysyła tylko do tego jednego gracza!

        # Przesuwamy czas
        game['current_tick'] += 1
        
        # Czekamy (szybkość gry) - np. 0.5 sekundy = 1 świeczka
        socketio.sleep(0.5)

@socketio.on('trade')
def handle_trade(data):
    """Obsługa KUP/SPRZEDAJ"""
    sid = request.sid
    game = active_games.get(sid)
    if not game: return

    action = data.get('action') # 'BUY' lub 'SELL'
    
    # Pobieramy aktualną cenę z ostatniej świeczki (bezpieczniej niż brać od klienta)
    idx = game['current_tick'] - 1 
    if idx < 0: return
    current_price = game['scenario'][idx]['Close']

    if action == 'BUY':
        # Kupujemy za wszystko (All-in mode dla uproszczenia arcade)
        # lub stałą kwotę. Tutaj wersja: Kup za 1000$
        amount_usd = 1000
        if game['balance'] >= amount_usd:
            game['balance'] -= amount_usd
            game['crypto_amount'] += (amount_usd / current_price)
            
    elif action == 'SELL':
        # Sprzedajemy wszystko
        if game['crypto_amount'] > 0:
            val = game['crypto_amount'] * current_price
            game['balance'] += val
            game['crypto_amount'] = 0

def finish_game(sid):
    """Zapisuje wynik i kończy grę"""
    game = active_games.get(sid)
    if not game: return

    # Finalna wycena
    last_price = game['scenario'][-1]['Close']
    final_score = game['balance'] + (game['crypto_amount'] * last_price)
    profit_percent = ((final_score - 10000) / 10000) * 100

    # Zapis do bazy
    try:
        # Potrzebujemy contextu aplikacji bo jesteśmy w background thread
        with app.app_context():
            new_score = Score(
                username=game['username'],
                score=round(final_score, 2),
                asset=game.get('scenario', [{}])[0].get('asset', 'UNKNOWN')
            )
            db.session.add(new_score)
            db.session.commit()
    except Exception as e:
        print(f"Błąd zapisu bazy: {e}")

    # Info do klienta
    socketio.emit('game_over', {
        'final_score': round(final_score, 2),
        'profit_percent': round(profit_percent, 2)
    }, to=sid)
    
    game['running'] = False

# Uruchomienie
if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)