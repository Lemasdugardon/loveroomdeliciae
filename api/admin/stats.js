import { supabase } from '../_supabase.js';
import { requireAdmin } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!await requireAdmin(req, res)) return;

  const today = new Date().toISOString().split('T')[0];

  const { data: all }      = await supabase.from('reservations').select('statut, montant_total, date_arrivee, created_at');
  const { data: upcoming } = await supabase.from('reservations').select('*').gte('date_arrivee', today).neq('statut', 'cancelled').order('date_arrivee').limit(5);

  const confirmed  = (all || []).filter(r => r.statut === 'confirmed');
  const pending    = (all || []).filter(r => r.statut === 'pending');
  const revenue    = confirmed.reduce((s, r) => s + (r.montant_total || 0), 0);
  const thisMonth  = confirmed.filter(r => r.created_at?.startsWith(today.slice(0, 7)));
  const revenueM   = thisMonth.reduce((s, r) => s + (r.montant_total || 0), 0);

  res.status(200).json({
    total:          (all || []).length,
    confirmed:      confirmed.length,
    pending:        pending.length,
    revenue,
    revenue_month:  revenueM,
    upcoming:       upcoming || []
  });
}
