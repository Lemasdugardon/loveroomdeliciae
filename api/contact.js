import { supabase } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { prenom, nom, email, sujet, message } = req.body || {};
  if (!email || !message) return res.status(400).json({ error: 'Champs manquants' });

  // Sauvegarde dans Supabase
  await supabase.from('messages').insert({ prenom, nom, email, sujet, message });

  // Envoi email via Resend
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(200).json({ ok: true, warn: 'RESEND_API_KEY manquante' });

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Loft Deliciae <onboarding@resend.dev>',
      to: ['Lemasdugardon@gmail.com'],
      subject: `Nouveau message — ${sujet || 'Contact'} — Loft Deliciae`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#333;">Nouveau message de contact</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px;color:#666;width:120px;">Prénom</td><td style="padding:8px;">${prenom || '—'}</td></tr>
            <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">Nom</td><td style="padding:8px;">${nom || '—'}</td></tr>
            <tr><td style="padding:8px;color:#666;">Email</td><td style="padding:8px;"><a href="mailto:${email}">${email}</a></td></tr>
            <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">Sujet</td><td style="padding:8px;">${sujet || '—'}</td></tr>
          </table>
          <div style="margin-top:20px;padding:16px;background:#f9f9f9;border-left:3px solid #c47a7a;">
            <strong>Message :</strong><br><br>
            ${message.replace(/\n/g, '<br>')}
          </div>
          <p style="margin-top:20px;font-size:12px;color:#999;">
            Répondez directement à cet email pour contacter ${prenom || 'le visiteur'}.
          </p>
        </div>
      `,
      reply_to: email,
    }),
  });

  const resendData = await resendRes.json().catch(() => ({}));

  if (!resendRes.ok) {
    console.error('[Resend error]', resendRes.status, resendData);
    return res.status(200).json({ ok: true, email_error: resendData });
  }

  return res.status(200).json({ ok: true, email_sent: true });
}
