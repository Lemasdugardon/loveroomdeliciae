import { supabase } from './_supabase.js';

/* ── Auth ─────────────────────────────────────────────────── */
function checkAdmin(req, res) {
  const auth = (req.headers.authorization || '').replace('Bearer ', '').trim();
  const ok   = auth && auth === (process.env.ADMIN_PASSWORD || 'LoftAdmin2024!');
  if (!ok) res.status(401).json({ error: 'Non autorisé' });
  return ok;
}

/* ── Helpers ──────────────────────────────────────────────── */
function dateRange(debut, fin) {
  const dates = [], d = new Date(debut), end = new Date(fin);
  while (d <= end) { dates.push(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1); }
  return dates;
}

/* ── Router ───────────────────────────────────────────────── */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const resource = req.query.resource || '';

  /* LOGIN (no auth required) */
  if (resource === 'login') {
    if (req.method !== 'POST') return res.status(405).end();
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'LoftAdmin2024!';
    if (!password || password !== adminPassword) return res.status(401).json({ error: 'Mot de passe incorrect' });
    return res.status(200).json({ token: password, ok: true });
  }

  /* All other routes require admin */
  if (!checkAdmin(req, res)) return;

  /* RESERVATIONS */
  if (resource === 'reservations') {
    if (req.method === 'GET') {
      const { data } = await supabase.from('reservations').select('*').order('created_at', { ascending: false });
      return res.status(200).json(data || []);
    }
    if (req.method === 'PATCH') {
      const { id, statut } = req.body;
      await supabase.from('reservations').update({ statut }).eq('id', id);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).end();
  }

  /* STATS */
  if (resource === 'stats') {
    const today = new Date().toISOString().split('T')[0];
    const { data: all }      = await supabase.from('reservations').select('statut, montant_total, date_arrivee, created_at');
    const { data: upcoming } = await supabase.from('reservations').select('*').gte('date_arrivee', today).neq('statut', 'cancelled').order('date_arrivee').limit(5);
    const confirmed = (all || []).filter(r => r.statut === 'confirmed');
    const revenue   = confirmed.reduce((s, r) => s + (r.montant_total || 0), 0);
    const revenueM  = confirmed.filter(r => r.created_at?.startsWith(today.slice(0, 7))).reduce((s, r) => s + (r.montant_total || 0), 0);
    return res.status(200).json({
      total: (all || []).length,
      confirmed: confirmed.length,
      pending: (all || []).filter(r => r.statut === 'pending').length,
      revenue, revenue_month: revenueM,
      upcoming: upcoming || []
    });
  }

  /* TARIFS */
  if (resource === 'tarifs') {
    if (req.method === 'GET') {
      const { data: tarifs } = await supabase.from('tarifs').select('*').order('nuits');
      const { data: extras } = await supabase.from('extras').select('*').order('id');
      return res.status(200).json({ tarifs: tarifs || [], extras: extras || [] });
    }
    if (req.method === 'PATCH') {
      const { tarifs, extras } = req.body;
      for (const t of tarifs || []) await supabase.from('tarifs').update({ prix: t.prix }).eq('type', t.type);
      for (const e of extras || []) await supabase.from('extras').update({ prix: e.prix, actif: e.actif }).eq('key', e.key);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).end();
  }

  /* BLOCKED-DATES */
  if (resource === 'blocked-dates') {
    if (req.method === 'GET') {
      const { data } = await supabase.from('blocked_dates').select('*').order('date');
      return res.status(200).json(data || []);
    }
    if (req.method === 'POST') {
      const { date, date_debut, date_fin, raison } = req.body;
      const dates = date_debut && date_fin ? dateRange(date_debut, date_fin) : [date];
      for (const d of dates) await supabase.from('blocked_dates').insert({ date: d, raison });
      return res.status(201).json({ ok: true, count: dates.length });
    }
    if (req.method === 'DELETE') {
      const q = req.query;
      const b = req.body || {};
      const date       = q.date       || b.date;
      const date_debut = q.date_debut || b.date_debut;
      const date_fin   = q.date_fin   || b.date_fin;

      if (!date && !(date_debut && date_fin)) {
        return res.status(400).json({ error: 'Date manquante', recu: q });
      }

      const dates = date_debut && date_fin ? dateRange(date_debut, date_fin) : [date];

      for (const d of dates) {
        const delRes = await fetch(
          `${process.env.SUPABASE_URL}/rest/v1/blocked_dates?date=eq.${encodeURIComponent(d)}`,
          {
            method: 'DELETE',
            headers: {
              'apikey': process.env.SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
              'Prefer': 'return=minimal',
            },
          }
        );
        if (!delRes.ok) {
          const txt = await delRes.text().catch(() => 'inconnu');
          return res.status(400).json({ error: 'Suppression échouée', date: d, detail: txt });
        }
      }
      return res.status(200).json({ ok: true });
    }
    return res.status(405).end();
  }

  /* EXTRAS */
  if (resource === 'extras') {
    if (req.method === 'POST') {
      const { key, nom, prix, description } = req.body;
      if (!key || !nom || prix === undefined) return res.status(400).json({ error: 'Champs manquants' });
      const { error } = await supabase.from('extras').insert({
        key: key.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
        nom, prix: parseInt(prix) || 0, description: description || '', actif: true
      });
      if (error) return res.status(400).json({ error: error.message });
      return res.status(201).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const { key } = req.body;
      await supabase.from('extras').delete().eq('key', key);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).end();
  }

  /* TEXTES */
  if (resource === 'textes') {
    if (req.method === 'GET') {
      const { data } = await supabase.from('settings').select('cle, valeur');
      const textes = {};
      (data || []).filter(r => r.cle.startsWith('texte_')).forEach(r => { textes[r.cle] = r.valeur; });
      return res.status(200).json(textes);
    }
    if (req.method === 'PATCH') {
      for (const [cle, valeur] of Object.entries(req.body)) {
        if (!cle.startsWith('texte_')) continue;
        const { data } = await supabase.from('settings').select('cle').eq('cle', cle).single();
        if (data) await supabase.from('settings').update({ valeur }).eq('cle', cle);
        else       await supabase.from('settings').insert({ cle, valeur });
      }
      return res.status(200).json({ ok: true });
    }
    return res.status(405).end();
  }

  /* PHOTOS */
  if (resource === 'photos') {
    if (req.method === 'GET') {
      const { data } = await supabase.from('photos').select('*').order('ordre');
      return res.status(200).json(data || []);
    }
    if (req.method === 'POST') {
      const { url, alt, categorie = 'galerie', ordre = 0 } = req.body;
      if (!url) return res.status(400).json({ error: 'URL manquante' });
      const { error } = await supabase.from('photos').insert({ url, alt: alt || '', categorie, ordre: parseInt(ordre) || 0, actif: true });
      if (error) return res.status(400).json({ error: error.message });
      return res.status(201).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const { id } = req.body;
      await supabase.from('photos').delete().eq('id', id);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'PATCH') {
      const { id, ...updates } = req.body;
      await supabase.from('photos').update(updates).eq('id', id);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).end();
  }

  /* UPLOAD */
  if (resource === 'upload') {
    if (req.method !== 'POST') return res.status(405).end();
    const { filename, contentType, data } = req.body;
    if (!filename || !contentType || !data) return res.status(400).json({ error: 'Données manquantes' });
    const safeName   = filename.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
    const objectName = `${Date.now()}-${safeName}`;
    const buffer     = Buffer.from(data, 'base64');
    const uploadRes  = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/photos/${objectName}`,
      { method: 'POST', headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, 'Content-Type': contentType, 'x-upsert': 'true' }, body: buffer }
    );
    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      return res.status(400).json({ error: err.message || 'Échec upload' });
    }
    return res.status(200).json({ url: `${process.env.SUPABASE_URL}/storage/v1/object/public/photos/${objectName}` });
  }

  res.status(404).json({ error: 'Route inconnue' });
}
