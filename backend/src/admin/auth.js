import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import config from '../config.js';

export const COOKIE = 'admin_token';
const MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkCredentials(username, password) {
  // Evaluate both so timing doesn't reveal which one was wrong.
  const u = safeEqual(username, config.adminUsername);
  const p = safeEqual(password, config.adminPassword);
  return u && p;
}

export function issueToken(res) {
  const token = jwt.sign({ sub: config.adminUsername, role: 'admin' }, config.jwtSecret, { expiresIn: MAX_AGE_MS / 1000 });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: false, // admin is plain http on localhost
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function clearToken(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

export function requireAdmin(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Please log in' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.role !== 'admin') throw new Error('bad role');
    req.admin = payload;
    next();
  } catch {
    clearToken(res);
    res.status(401).json({ error: 'Session expired, please log in again' });
  }
}
