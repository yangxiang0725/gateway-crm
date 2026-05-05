const { getDB } = require('./_db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = getDB();

  try {
    // GET — fetch all matches
    if (req.method === 'GET') {
      const { data, error } = await sb
        .from('matches')
        .select('id, data')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.json((data || []).map(r => ({ ...r.data, id: r.id })));
    }

    if (req.method === 'POST') {
      const { action } = req.body;

      // Upsert a single match (or array of matches)
      if (action === 'upsert') {
        const { match, matches } = req.body;
        const items = matches || [match];
        const rows = items.map(m => ({
          id: m.id,
          data: m,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await sb.from('matches').upsert(rows);
        if (error) throw error;
        return res.json({ success: true });
      }

      // Update just the status field
      if (action === 'update_status') {
        const { id, status } = req.body;
        const { data: existing } = await sb.from('matches').select('data').eq('id', id).single();
        if (!existing) return res.status(404).json({ error: 'Match not found' });
        const updated = { ...existing.data, status };
        const { error } = await sb.from('matches').update({ data: updated, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        return res.json({ success: true });
      }

      // Delete a match
      if (action === 'delete') {
        const { id } = req.body;
        const { error } = await sb.from('matches').delete().eq('id', id);
        if (error) throw error;
        return res.json({ success: true });
      }

      // Bulk import
      if (action === 'import') {
        const { matches } = req.body;
        const rows = matches.map(m => ({
          id: m.id,
          data: m,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await sb.from('matches').upsert(rows);
        if (error) throw error;
        return res.json({ success: true, count: rows.length });
      }
    }

    return res.status(400).json({ error: 'Invalid request' });
  } catch (e) {
    console.error('matches error:', e);
    return res.status(500).json({ error: e.message });
  }
};
