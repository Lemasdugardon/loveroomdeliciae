import { supabase } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const { data } = await supabase.from('settings').select('cle, valeur');
  const textes = {};
  (data || []).filter(r => r.cle.startsWith('texte_')).forEach(r => { textes[r.cle] = r.valeur; });
  res.status(200).json(textes);
}
