"""Account, session and subscription storage for a single-server pilot."""
import hashlib
import secrets
import sqlite3
import time
from contextlib import contextmanager
from fastapi import HTTPException


class Accounts:
    def __init__(self, path):
        self.path = path
        self.attempts = {}
        with self.db() as db:
            db.executescript('''
            CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,trial_until REAL NOT NULL,stripe_customer TEXT,stripe_subscription TEXT,status TEXT NOT NULL DEFAULT 'trial');
            CREATE TABLE IF NOT EXISTS sessions(digest TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY);
            ''')
            columns = {r['name'] for r in db.execute('PRAGMA table_info(users)')}
            if 'plan' not in columns:
                db.execute("ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'trial'")

    @contextmanager
    def db(self):
        with sqlite3.connect(self.path, timeout=10) as db:
            db.row_factory = sqlite3.Row
            yield db

    @staticmethod
    def password(value, salt=None):
        salt = salt or secrets.token_hex(16)
        digest = hashlib.scrypt(value.encode(), salt=salt.encode(), n=16384,r=8,p=1).hex()
        return salt + ':' + digest

    def authenticate(self, email, password, register, ip):
        current = time.time()
        attempts = [t for t in self.attempts.get(ip, []) if t > current - 300]
        if len(attempts) >= 15:
            raise HTTPException(429, 'Demasiados intentos. Espera cinco minutos.')
        self.attempts[ip] = attempts + [current]
        email = email.strip().lower()
        if '@' not in email or len(email) > 254 or len(password) < 12 or len(password) > 128:
            raise HTTPException(422, 'Usa un correo válido y una contraseña de 12 a 128 caracteres.')
        with self.db() as db:
            if register:
                try:
                    db.execute('INSERT INTO users(id,email,password,trial_until) VALUES(?,?,?,?)',
                        (secrets.token_hex(16), email, self.password(password),current+14*86400))
                except sqlite3.IntegrityError:
                    raise HTTPException(409, 'No se pudo crear la cuenta con ese correo.')
            user = db.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
            if not user or not secrets.compare_digest(user['password'],self.password(password,user['password'].split(':')[0])):
                raise HTTPException(401, 'Correo o contraseña incorrectos.')
            token = secrets.token_urlsafe(32)
            db.execute('DELETE FROM sessions WHERE expires<?',(current,))
            db.execute('INSERT INTO sessions VALUES(?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),user['id'],current+604800))
            return token

    def user(self, token):
        with self.db() as db:
            row = db.execute('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.digest=? AND s.expires>?',
                (hashlib.sha256(token.encode()).hexdigest(),time.time())).fetchone()
            return dict(row) if row else None

    def logout(self, token):
        with self.db() as db:
            db.execute('DELETE FROM sessions WHERE digest=?',(hashlib.sha256(token.encode()).hexdigest(),))

    @staticmethod
    def entitled(user):
        return user['status'] in ('active','trialing') or user['trial_until'] > time.time()
