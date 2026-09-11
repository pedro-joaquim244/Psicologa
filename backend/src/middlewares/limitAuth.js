const attempts = new Map();
export function limitAuth(req, res, next) {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const entry = attempts.get(req.ip) || { count: 0, until: now + 15 * 60 * 1000 };
  entry.count++;
  attempts.set(req.ip, entry);
  if (entry.count > 30) {
    res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000)));
    return res.status(429).json({ erro: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
  }
  next();
}
