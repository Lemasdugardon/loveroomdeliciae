import { supabase } from '../_supabase.js';
import { requireAdmin } from '../_auth.js';

function dateRange(debut, fin) {
  const dates = [];
  const d = new Date(debut);
  const end = new Date(fin);
  while (d <= end) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!await requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    const { data } = await supabase.from('blocked_dates').select('*').order('date');
    return res.status(200).json(data || []);
  }

  if (req.method === 'POST') {
    const { date, date_debut, date_fin, raison } = req.body;
    const dates = date_debut && date_fin ? dateRange(date_debut, date_fin) : [date];
    for (const d of dates) {
      await supabase.from('blocked_dates').insert({ date: d, raison });
    }
    return res.status(201).json({ ok: true, count: dates.length });
  }

  if (req.method === 'DELETE') {
    const { date, date_debut, date_fin } = req.body;
    const dates = date_debut && date_fin ? dateRange(date_debut, date_fin) : [date];
    for (const d of dates) {
      await supabase.from('blocked_dates').delete().eq('date', d);
    }
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
