import { supabase } from '../_supabase.js';
import { requireAdmin } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!await requireAdmin(req, res)) return;

  if (req.method === 'POST') {
    const { key, nom, prix, description } = req.body;
    if (!key || !nom || prix === undefined) return res.status(400).json({ error: 'Champs manquants' });
    const { error } = await supabase.from('extras').insert({
      key: key.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      nom, prix: parseInt(prix) || 0, description: description || '', actif: true
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { key } = req.body;
    await supabase.from('extras').delete().eq('key', key);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
