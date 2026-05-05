const { getDB } = require('./_db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = getDB();

  try {
    // GET — fetch all contacts
    if (req.method === 'GET') {
      const { data, error } = await sb
        .from('contacts')
        .select('id, data')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.json((data || []).map(r => ({ ...r.data, id: r.id })));
    }

    if (req.method === 'POST') {
      const { action } = req.body;

      // Upsert a single contact
      if (action === 'upsert') {
        const { contact } = req.body;
        const { error } = await sb.from('contacts').upsert({
          id: contact.id,
          data: contact,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        return res.json({ success: true });
      }

      // Delete a contact and its matches
      if (action === 'delete') {
        const { id } = req.body;
        // Fetch all matches and remove those referencing this contact
        const { data: allM } = await sb.from('matches').select('id, data');
        const toRemove = (allM || []).filter(m => m.data.idA === id || m.data.idB === id);
        if (toRemove.length) {
          await sb.from('matches').delete().in('id', toRemove.map(m => m.id));
        }
        const { error } = await sb.from('contacts').delete().eq('id', id);
        if (error) throw error;
        return res.json({ success: true });
      }

      // Bulk import (from JSON backup restore)
      if (action === 'import') {
        const { contacts } = req.body;
        const rows = contacts.map(c => ({
          id: c.id,
          data: c,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await sb.from('contacts').upsert(rows);
        if (error) throw error;
        return res.json({ success: true, count: rows.length });
      }
    }

    return res.status(400).json({ error: 'Invalid request' });
  } catch (e) {
    console.error('contacts error:', e);
    return res.status(500).json({ error: e.message });
  }
};
