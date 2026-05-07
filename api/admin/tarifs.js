import { supabase } from '../_supabase.js';
import { requireAdmin } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!await requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    const { data: tarifs } = await supabase.from('tarifs').select('*').order('nuits');
    const { data: extras } = await supabase.from('extras').select('*').order('id');
    return res.status(200).json({ tarifs: tarifs || [], extras: extras || [] });
  }

  if (req.method === 'PATCH') {
    const { tarifs, extras } = req.body;

    for (const t of tarifs || []) {
      await supabase.from('tarifs').update({ prix: t.prix }).eq('type', t.type);
    }
    for (const e of extras || []) {
      await supabase.from('extras').update({ prix: e.prix, actif: e.actif }).eq('key', e.key);
    }

    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
