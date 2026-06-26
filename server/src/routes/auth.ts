import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { authMiddleware, AuthRequest, signToken } from '../auth.js';

const router = Router();

router.post('/login', (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = db
      .prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?')
      .get(email) as { id: string; email: string; name: string; password_hash: string } | undefined;

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    let passwordValid = false;
    try {
      passwordValid = bcrypt.compareSync(password, user.password_hash);
    } catch {
      res.status(500).json({ error: 'Account data is corrupted. Delete server/data/ajaia.db and restart.' });
      return;
    }

    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const { password_hash: _, ...safeUser } = user;
    res.json({ token: signToken(safeUser), user: safeUser });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

router.get('/users', authMiddleware, (_req, res) => {
  const users = db
    .prepare('SELECT id, email, name FROM users ORDER BY name')
    .all();
  res.json({ users });
});

export default router;
