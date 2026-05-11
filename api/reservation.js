import { supabase } from './_supabase.js';

const fmt = d => d ? new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—';
const euros = n => `${n ?? 0} €`;

async function sendEmail(payload) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const {
    prenom, nom, email, telephone,
    date_arrivee, date_depart, heure_arrivee, heure_depart, duree_type,
    extras, montant_base, montant_extras, montant_remise, montant_total,
    code_promo, occasion, message
  } = req.body;

  if (!prenom || !nom || !email || !date_arrivee || !date_depart) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  const basePayload = {
    prenom, nom, email, telephone,
    date_arrivee, date_depart,
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

  let { data, error } = await supabase
    .from('reservations')
    .insert({ ...basePayload, heure_arrivee: heure_arrivee || '17:00', heure_depart: heure_depart || '09:00' })
    .select()
    .single();

  if (error && error.message.includes('heure')) {
    ({ data, error } = await supabase.from('reservations').insert(basePayload).select().single());
  }

  if (error) return res.status(500).json({ error: error.message, detail: error.details || error.hint || '' });

  const extrasHtml = (extras || []).length
    ? (extras || []).map(e => `<tr style="background:#f9f9f9;"><td style="padding:6px 8px;color:#666;">+ ${e.nom}</td><td style="padding:6px 8px;text-align:right;">${euros(e.prix)}</td></tr>`).join('')
    : '';

  const tableRows = `
    <tr><td style="padding:8px;color:#666;">Client</td><td style="padding:8px;"><strong>${prenom} ${nom}</strong></td></tr>
    <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">Email</td><td style="padding:8px;"><a href="mailto:${email}">${email}</a></td></tr>
    <tr><td style="padding:8px;color:#666;">Téléphone</td><td style="padding:8px;">${telephone || '—'}</td></tr>
    <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">Arrivée</td><td style="padding:8px;">${fmt(date_arrivee)} à ${(heure_arrivee || '17:00').slice(0,5).replace(':','h')}</td></tr>
    <tr><td style="padding:8px;color:#666;">Départ</td><td style="padding:8px;">${fmt(date_depart)} à ${(heure_depart || '09:00').slice(0,5).replace(':','h')}</td></tr>
    ${occasion ? `<tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">Occasion</td><td style="padding:8px;">${occasion}</td></tr>` : ''}
    ${message ? `<tr><td style="padding:8px;color:#666;">Message</td><td style="padding:8px;">${message}</td></tr>` : ''}
    <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">Hébergement</td><td style="padding:8px;text-align:right;">${euros(montant_base)}</td></tr>
    ${extrasHtml}
    ${montant_remise ? `<tr><td style="padding:8px;color:#2a7a4a;">Code promo (${code_promo})</td><td style="padding:8px;color:#2a7a4a;text-align:right;">- ${euros(montant_remise)}</td></tr>` : ''}
    <tr style="border-top:2px solid #eee;"><td style="padding:10px 8px;font-weight:bold;">TOTAL</td><td style="padding:10px 8px;font-weight:bold;text-align:right;font-size:1.1em;">${euros(montant_total)}</td></tr>
  `;

  // Email à l'admin
  await sendEmail({
    from: 'Loft Deliciae <contact@loftdeliciae.fr>',
    to: ['lemasdugardon@gmail.com'],
    subject: `🛎 Nouvelle demande de réservation — ${prenom} ${nom} — ${fmt(date_arrivee)}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#333;">Nouvelle demande de réservation</h2>
        <p style="color:#666;">Une nouvelle demande vient d'être reçue. Statut : <strong>En attente de confirmation</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">${tableRows}</table>
        <p style="margin-top:24px;font-size:13px;color:#999;">
          Connectez-vous à l'<a href="https://loftdeliciae.fr/admin">espace admin</a> pour confirmer ou annuler cette réservation.
        </p>
      </div>
    `,
    reply_to: email,
  });

  // Email de confirmation au client
  await sendEmail({
    from: 'Loft Deliciae <contact@loftdeliciae.fr>',
    to: [email],
    subject: `Votre demande de réservation — Loft Deliciae`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#333;">Merci ${prenom}, votre demande est bien reçue !</h2>
        <p style="color:#666;">Nous avons bien enregistré votre demande de réservation et nous vous confirmons votre séjour dans les plus brefs délais (sous 24h).</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">${tableRows}</table>
        <p style="margin-top:24px;color:#666;">Pour toute question, répondez simplement à cet email ou contactez-nous sur <a href="https://loftdeliciae.fr/contact">loftdeliciae.fr</a>.</p>
        <p style="margin-top:8px;font-size:13px;color:#999;">Loft Deliciae — Love Room à Remoulins</p>
      </div>
    `,
  });

  res.status(201).json({ id: data.id, message: 'Réservation enregistrée' });
}
