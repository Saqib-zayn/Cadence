import { timingSafeEqual } from 'node:crypto';
import process from 'node:process';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const token = String(body.token || '');

  const a = Buffer.from(token);
  const b = Buffer.from(process.env.DEV_PASSWORD || '');
  const valid = a.length > 0 && a.length === b.length && timingSafeEqual(a, b);

  return res.status(200).json({ valid });
}
