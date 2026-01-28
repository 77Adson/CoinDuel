from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Score(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False)
    score = db.Column(db.Float, nullable=False)
    assets = db.Column(db.String(100))               # "BTC,ETH,XRP"
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "username": self.username,
            "score": round(self.score, 2),
            "assets": self.assets,
            "date": self.created_at.strftime("%Y-%m-%d %H:%M")
        }