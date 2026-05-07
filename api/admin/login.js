import { supabase } from '../_supabase.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body;

  const { data } = await supabase
    .from('settings')
    .select('valeur')
    .eq('cle', 'admin_password')
    .single();

  if (!data || data.valeur !== password) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }

  res.status(200).json({ token: password, ok: true });
}
