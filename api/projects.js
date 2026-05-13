const { getDB } = require('./_db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = getDB();

  try {
    if (req.method === 'GET') {
      const { data, error } = await sb
        .from('projects')
        .select('id, data')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.json((data || []).map(r => ({ ...r.data, id: r.id })));
    }

    if (req.method === 'POST') {
      const { action } = req.body;

      if (action === 'upsert') {
        const { project } = req.body;
        const { error } = await sb.from('projects').upsert({
          id: project.id,
          data: project,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        return res.json({ success: true });
      }

      if (action === 'delete') {
        const { id } = req.body;
        const { error } = await sb.from('projects').delete().eq('id', id);
        if (error) throw error;
        return res.json({ success: true });
      }

      if (action === 'add_note') {
        const { id, note } = req.body;
        const { data: existing } = await sb.from('projects').select('data').eq('id', id).single();
        if (!existing) return res.status(404).json({ error: 'Not found' });
        const proj = existing.data;
        proj.notes = proj.notes || [];
        proj.notes.unshift({ id: Date.now().toString(36), text: note, date: new Date().toISOString() });
        const { error } = await sb.from('projects').update({ data: proj, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        return res.json({ success: true, project: proj });
      }
    }

    return res.status(400).json({ error: 'Invalid request' });
  } catch (e) {
    console.error('projects error:', e);
    return res.status(500).json({ error: e.message });
  }
};
