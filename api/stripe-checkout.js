import { supabase } from './_supabase.js';

const STRIPE_API = 'https://api.stripe.com/v1';

function stripeHeaders() {
  return {
    'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

function encode(obj, prefix = '') {
  return Object.entries(obj).map(([k, v]) => {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && typeof v === 'object') return encode(v, key);
    return `${encodeURIComponent(key)}=${encodeURIComponent(v ?? '')}`;
  }).flat().join('&');
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe non configuré (STRIPE_SECRET_KEY manquante)' });
  }

  const {
    prenom, nom, email, telephone,
    date_arrivee, date_depart, heure_arrivee, heure_depart, duree_type,
    extras, montant_base, montant_extras, montant_remise, montant_total,
    code_promo, occasion, message
  } = req.body;

  if (!prenom || !nom || !email || !date_arrivee || !date_depart || !montant_total) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  // 1. Sauvegarde réservation en base avec statut "pending"
  const basePayload = {
    prenom, nom, email, telephone,
    date_arrivee, date_depart,
    heure_arrivee: heure_arrivee || '17:00',
    heure_depart:  heure_depart  || '09:00',
    duree_type,
    extras: extras || [],
    montant_base:   montant_base   || 0,
    montant_extras: montant_extras || 0,
    montant_remise: montant_remise || 0,
    montant_total:  montant_total  || 0,
    code_promo:     code_promo     || null,
    occasion, message,
    statut: 'pending'
  };

  const { data: resa, error: resaErr } = await supabase
    .from('reservations').insert(basePayload).select().single();

  if (resaErr) return res.status(500).json({ error: resaErr.message });

  const baseUrl = process.env.SITE_URL || 'https://loftdeliciae.fr';

  // Description des extras pour Stripe
  const extrasDesc = (extras || []).map(e => e.nom).join(', ');
  const description = [
    `Séjour ${date_arrivee} → ${date_depart}`,
    extrasDesc ? `Extras : ${extrasDesc}` : null,
    code_promo ? `Code promo : ${code_promo}` : null,
  ].filter(Boolean).join(' | ');

  // 2. Création session Stripe Checkout
  const sessionParams = {
    mode: 'payment',
    customer_email: email,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': Math.round(montant_total * 100), // en centimes
    'line_items[0][price_data][product_data][name]': `Loft Deliciae — ${date_arrivee} → ${date_depart}`,
    'line_items[0][price_data][product_data][description]': description,
    'line_items[0][quantity]': 1,
    'payment_method_types[0]': 'card',
    'success_url': `${baseUrl}/reservation-success.html?session_id={CHECKOUT_SESSION_ID}&resa_id=${resa.id}`,
    'cancel_url': `${baseUrl}/reservation.html?cancelled=1`,
    'metadata[resa_id]': String(resa.id),
    'metadata[client]': `${prenom} ${nom}`,
  };

  const stripeRes = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: stripeHeaders(),
    body: encode(sessionParams),
  });

  const session = await stripeRes.json();
  if (!stripeRes.ok) {
    return res.status(500).json({ error: session.error?.message || 'Erreur Stripe' });
  }

  return res.status(200).json({ url: session.url });
}
