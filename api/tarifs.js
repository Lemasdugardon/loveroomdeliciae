import { supabase } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { data: tarifs } = await supabase.from('tarifs').select('*').order('nuits');
  const { data: extras } = await supabase.from('extras').select('*').eq('actif', true).order('id');

  res.status(200).json({ tarifs: tarifs || [], extras: extras || [] });
}
