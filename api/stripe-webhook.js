import crypto from 'crypto';
import { supabase } from './_supabase.js';

export const config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySignature(rawBody, sigHeader, secret) {
  const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
  const signed = `${parts.t}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1 || ''));
  } catch {
    return false;
  }
}

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
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (secret) {
    if (!sig || !verifySignature(rawBody.toString(), sig, secret)) {
      return res.status(400).json({ error: 'Signature invalide' });
    }
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    return res.status(400).json({ error: 'JSON invalide' });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  if (session.payment_status !== 'paid') {
    return res.status(200).json({ received: true });
  }

  const resa_id = session.metadata?.resa_id;
  if (!resa_id) return res.status(200).json({ received: true });

  const { data: resa, error } = await supabase
    .from('reservations')
    .update({ statut: 'confirmed' })
    .eq('id', resa_id)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ received: true });

  // Emails de confirmation en arrière-plan
  if (!resa) return;
  const r = resa;
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
      <p style="color:#666;">Le paiement a été reçu via Stripe. La réservation est confirmée.</p>
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
