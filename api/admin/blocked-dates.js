import { supabase } from '../_supabase.js';
import { requireAdmin } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!await requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    const { data } = await supabase.from('blocked_dates').select('*').order('date');
    return res.status(200).json(data || []);
  }

  if (req.method === 'POST') {
    const { date, raison } = req.body;
    const { error } = await supabase.from('blocked_dates').insert({ date, raison });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { date } = req.body;
    await supabase.from('blocked_dates').delete().eq('date', date);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
