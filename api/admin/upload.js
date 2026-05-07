import { requireAdmin } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!await requireAdmin(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  const { filename, contentType, data } = req.body;
  if (!filename || !contentType || !data) return res.status(400).json({ error: 'Données manquantes' });

  const safeName = filename.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
  const objectName = `${Date.now()}-${safeName}`;
  const buffer = Buffer.from(data, 'base64');

  const uploadRes = await fetch(
    `${process.env.SUPABASE_URL}/storage/v1/object/photos/${objectName}`,
    {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: buffer,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    return res.status(400).json({ error: err.message || 'Échec de l\'upload' });
  }

  const url = `${process.env.SUPABASE_URL}/storage/v1/object/public/photos/${objectName}`;
  return res.status(200).json({ url });
}
