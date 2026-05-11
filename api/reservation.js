import { supabase } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const {
    prenom, nom, email, telephone,
    date_arrivee, date_depart, heure_arrivee, heure_depart, duree_type,
    extras, montant_base, montant_extras, montant_total,
    occasion, message
  } = req.body;

  if (!prenom || !nom || !email || !date_arrivee || !date_depart) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  const basePayload = {
    prenom, nom, email, telephone,
    date_arrivee, date_depart,
    duree_type,
    extras: extras || [],
    montant_base, montant_extras: montant_extras || 0, montant_total,
    occasion, message,
    statut: 'pending'
  };

  let { data, error } = await supabase
    .from('reservations')
    .insert({ ...basePayload, heure_arrivee: heure_arrivee || '17:00', heure_depart: heure_depart || '10:00' })
    .select()
    .single();

  // Si les colonnes heure n'existent pas encore en base, on insère sans
  if (error && error.message.includes('heure')) {
    ({ data, error } = await supabase.from('reservations').insert(basePayload).select().single());
  }

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({ id: data.id, message: 'Réservation enregistrée' });
}
