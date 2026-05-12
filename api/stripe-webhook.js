import { supabase } from './_supabase.js';

async function sendEmail(payload) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function processPayment(sessionId) {
  if (!sessionId) return;

  // Vérification indépendante auprès de Stripe
  const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  });
  if (!stripeRes.ok) return;

  const session = await stripeRes.json();
  if (session.payment_status !== 'paid') return;

  const resa_id = session.metadata?.resa_id;
  if (!resa_id) return;

  // Mise à jour en base (sans .single() pour éviter les erreurs si déjà confirmé)
  const { data: rows } = await supabase
    .from('reservations')
    .update({ statut: 'confirmed' })
    .eq('id', resa_id)
    .neq('statut', 'confirmed')
    .select();

  const r = rows?.[0];
  if (!r) return; // déjà confirmé ou introuvable

  const fmt = d => d ? new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const euros = n => `${n ?? 0} €`;

  const extrasHtml = (r.extras || []).map(e =>
    `<tr style="background:#f9f9f9;"><td style="padding:6px 8px;color:#666;">+ ${e.nom}</td><td style="padding:6px 8px;text-align:right;">${euros(e.prix)}</td></tr>`
  ).join('');

  const tableRows = `
    <tr><td style="padding:8px;color:#666;">Client</td><td style="padding:8px;"><strong>${r.prenom} ${r.nom}</strong></td></tr>
    <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">Email</td><td style="padding:8px;">${r.email}</td></tr>
    <tr><td style="padding:8px;color:#666;">Téléphone</td><td style="padding:8px;">${r.telephone || '—'}</td></tr>
    <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">Arrivée</td><td style="padding:8px;">${fmt(r.date_arrivee)} à ${(r.heure_arrivee || '17:00').slice(0,5).replace(':','h')}</td></tr>
    <tr><td style="padding:8px;color:#666;">Départ</td><td style="padding:8px;">${fmt(r.date_depart)} à ${(r.heure_depart || '09:00').slice(0,5).replace(':','h')}</td></tr>
    <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">Hébergement</td><td style="padding:8px;text-align:right;">${euros(r.montant_base)}</td></tr>
    ${extrasHtml}
    ${r.montant_remise ? `<tr><td style="padding:8px;color:#2a7a4a;">Code promo</td><td style="padding:8px;color:#2a7a4a;text-align:right;">- ${euros(r.montant_remise)}</td></tr>` : ''}
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
      <p style="margin-top:24px;font-size:13px;color:#999;"><a href="https://loftdeliciae.fr/admin">Voir dans l'espace admin</a></p>
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
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Répondre 200 immédiatement à Stripe pour éviter les retentatives
  res.status(200).json({ received: true });

  try {
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!event || event.type !== 'checkout.session.completed') return;

    // Extraire l'ID de session selon le format de l'événement (V1 ou V2)
    const sessionId = event.data?.object?.id
      || event.related_object?.id
      || event.data?.id;

    await processPayment(sessionId);
  } catch (err) {
    console.error('Webhook error:', err.message);
  }
}
