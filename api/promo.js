import { supabase } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Code manquant' });

  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('active', true)
    .eq('used', false)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Code invalide ou déjà utilisé' });

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Code expiré' });
  }

  return res.status(200).json({
    ok: true,
    code: data.code,
    type: data.type,
    discount_type: data.discount_type,
    discount_value: data.discount_value,
  });
}
