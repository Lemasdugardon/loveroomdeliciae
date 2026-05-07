import { supabase } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const { data } = await supabase.from('photos').select('*').eq('actif', true).order('ordre');
  res.status(200).json(data || []);
}
