from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Score(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False)
    score = db.Column(db.Float, nullable=False) # Zysk/Strata w % lub USD
    asset = db.Column(db.String(20)) # Na czym grał (np. BTC)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'username': self.username,
            'score': self.score,
            'asset': self.asset,
            'date': self.created_at.strftime('%Y-%m-%d %H:%M')
        }