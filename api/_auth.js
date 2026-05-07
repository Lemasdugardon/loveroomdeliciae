import { supabase } from './_supabase.js';

export async function requireAdmin(req, res) {
  const auth = req.headers.authorization || '';
  const password = auth.replace('Bearer ', '').trim();
  if (!password) { res.status(401).json({ error: 'Non autorisé' }); return false; }

  const { data } = await supabase
    .from('settings')
    .select('valeur')
    .eq('cle', 'admin_password')
    .single();

  if (!data || data.valeur !== password) {
    res.status(401).json({ error: 'Mot de passe incorrect' });
    return false;
  }
  return true;
}
