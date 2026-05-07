export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'LoftAdmin2024!';

  if (!password || password !== adminPassword) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }

  res.status(200).json({ token: password, ok: true });
}
