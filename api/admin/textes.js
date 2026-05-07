import { supabase } from '../_supabase.js';
import { requireAdmin } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!await requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    const { data } = await supabase.from('settings').select('cle, valeur');
    const textes = {};
    (data || []).filter(r => r.cle.startsWith('texte_')).forEach(r => { textes[r.cle] = r.valeur; });
    return res.status(200).json(textes);
  }

  if (req.method === 'PATCH') {
    for (const [cle, valeur] of Object.entries(req.body)) {
      if (!cle.startsWith('texte_')) continue;
      const { data } = await supabase.from('settings').select('cle').eq('cle', cle).single();
      if (data) await supabase.from('settings').update({ valeur }).eq('cle', cle);
      else await supabase.from('settings').insert({ cle, valeur });
    }
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
