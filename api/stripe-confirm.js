import { supabase } from './_supabase.js';

const STRIPE_API = 'https://api.stripe.com/v1';

function stripeHeaders() {
  return { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` };
}

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

  const { session_id, resa_id } = req.query;
  if (!session_id || !resa_id) return res.status(400).json({ error: 'Paramètres manquants' });

  // Vérification du paiement auprès de Stripe
  const stripeRes = await fetch(`${STRIPE_API}/checkout/sessions/${session_id}`, {
    headers: stripeHeaders(),
  });
  const session = await stripeRes.json();

  if (!stripeRes.ok || session.payment_status !== 'paid') {
    return res.status(400).json({ error: 'Paiement non confirmé', status: session.payment_status });
  }

  // Mise à jour de la réservation en "confirmed"
  const { error } = await supabase
    .from('reservations')
    .update({ statut: 'confirmed' })
    .eq('id', resa_id);

  if (error) return res.status(500).json({ error: error.message });

  const { data: resa } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', resa_id)
    .single();

  if (!resa) return res.status(500).json({ error: 'Réservation introuvable' });

  // Répondre immédiatement au client sans attendre les emails
  res.status(200).json({ ok: true, resa_id: resa.id });

  // Envoi des emails en arrière-plan (sans bloquer la réponse)
  const r = resa;
  const extrasHtml = (r.extras || []).map(e =>
    `<tr style="background:#f9f9f9;"><td style="padding:6px 8px;color:#666;">+ ${e.nom}</td><td style="padding:6px 8px;text-align:right;">${euros(e.prix)}</td></tr>`
  ).join('');

  const tableRows = `
    <tr><td style="padding:8px;color:#666;">Client</td><td style="padding:8px;"><strong>${r.prenom} ${r.nom}</strong></td></tr>
    <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">Email</td><td style="padding:8px;">${r.email}</td></tr>
    <tr><td style="padding:8px;color:#666;">Téléphone</td><td style="padding:8px;">${r.telephone || '—'}</td></tr>
    <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">Arrivée</td><td style="padding:8px;">${fmt(r.date_arrivee)} à ${(r.heure_arrivee || '17:00').slice(0,5).replace(':','h')}</td></tr>
    <tr><td style="padding:8px;color:#666;">Départ</td><td style="padding:8px;">${fmt(r.date_depart)} à ${(r.heure_depart || '09:00').slice(0,5).replace(':','h')}</td></tr>
    ${r.occasion ? `<tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">Occasion</td><td style="padding:8px;">${r.occasion}</td></tr>` : ''}
    ${r.message ? `<tr><td style="padding:8px;color:#666;">Message</td><td style="padding:8px;">${r.message}</td></tr>` : ''}
    <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">Hébergement</td><td style="padding:8px;text-align:right;">${euros(r.montant_base)}</td></tr>
    ${extrasHtml}
    ${r.montant_remise ? `<tr><td style="padding:8px;color:#2a7a4a;">Code promo (${r.code_promo})</td><td style="padding:8px;color:#2a7a4a;text-align:right;">- ${euros(r.montant_remise)}</td></tr>` : ''}
    <tr style="border-top:2px solid #eee;"><td style="padding:10px 8px;font-weight:bold;">TOTAL PAYÉ</td><td style="padding:10px 8px;font-weight:bold;text-align:right;font-size:1.1em;">${euros(r.montant_total)}</td></tr>
  `;

  await sendEmail({
    from: 'Loft Deliciae <contact@loftdeliciae.fr>',
    to: ['lemasdugardon@gmail.com'],
    subject: `✅ Paiement reçu — ${r.prenom} ${r.nom} — ${fmt(r.date_arrivee)}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#2a7a4a;">Paiement confirmé ✅</h2>
      <p style="color:#666;">Le paiement a été reçu. La réservation est confirmée.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">${tableRows}</table>
      <p style="margin-top:24px;font-size:13px;color:#999;">
        <a href="https://www.loftdeliciae.fr/admin/login.html">Voir dans l'espace admin</a>
      </p>
    </div>`,
    reply_to: r.email,
  });

  await sendEmail({
    from: 'Loft Deliciae <contact@loftdeliciae.fr>',
    to: [r.email],
    subject: `✅ Réservation confirmée — Loft Deliciae`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#333;">Votre réservation est confirmée, ${r.prenom} !</h2>
      <p style="color:#666;">Votre paiement a bien été reçu. Nous avons hâte de vous accueillir au Loft Deliciae.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">${tableRows}</table>
      <p style="margin-top:24px;color:#666;">Pour toute question, contactez-nous sur <a href="https://loftdeliciae.fr/contact">loftdeliciae.fr</a>.</p>
      <p style="margin-top:8px;font-size:13px;color:#999;">Loft Deliciae — Love Room à Remoulins</p>
    </div>`,
  });

  // (réponse déjà envoyée plus haut)
}
