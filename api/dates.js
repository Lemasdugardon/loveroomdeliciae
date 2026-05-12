import { supabase } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { data: blocked } = await supabase
    .from('blocked_dates')
    .select('date');

  const { data: reservations } = await supabase
    .from('reservations')
    .select('date_arrivee, date_depart')
    .neq('statut', 'cancelled');

  const bookedDates = new Set();

  (blocked || []).forEach(r => bookedDates.add(r.date));

  (reservations || []).forEach(({ date_arrivee, date_depart }) => {
    const start = new Date(date_arrivee);
    const end   = new Date(date_depart);
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      bookedDates.add(d.toISOString().split('T')[0]);
    }
  });

  res.status(200).json({ booked: [...bookedDates] });
}
