export async function requireAdmin(req, res) {
  const auth = req.headers.authorization || '';
  const password = auth.replace('Bearer ', '').trim();
  if (!password) { res.status(401).json({ error: 'Non autorisé' }); return false; }

  const adminPassword = process.env.ADMIN_PASSWORD || 'LoftAdmin2024!';
  if (password !== adminPassword) {
    res.status(401).json({ error: 'Mot de passe incorrect' });
    return false;
  }
  return true;
}
