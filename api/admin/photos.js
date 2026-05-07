import { supabase } from '../_supabase.js';
import { requireAdmin } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!await requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    const { data } = await supabase.from('photos').select('*').order('ordre');
    return res.status(200).json(data || []);
  }

  if (req.method === 'POST') {
    const { url, alt, categorie = 'galerie', ordre = 0 } = req.body;
    if (!url) return res.status(400).json({ error: 'URL manquante' });
    const { error } = await supabase.from('photos').insert({ url, alt: alt || '', categorie, ordre: parseInt(ordre) || 0, actif: true });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    await supabase.from('photos').delete().eq('id', id);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body;
    await supabase.from('photos').update(updates).eq('id', id);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
