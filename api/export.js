const XLSX = require('xlsx');
const { getDB } = require('./_db');

const REGION_LABELS = { china: 'China', mexico: 'Mexico', north_america: 'North America', others: 'Others' };
const STAGE_LABELS  = { exploring: 'Exploring', active: 'Active', ready: 'Ready' };
const PRI_LABELS    = { high: 'High', medium: 'Medium', low: 'Low' };
const STATUS_LABELS = { suggested: 'Suggested', introduced: 'Introduced', in_progress: 'In Progress', closed: 'Closed' };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sb = getDB();

    // Fetch all data from Supabase
    const [{ data: cRows }, { data: mRows }] = await Promise.all([
      sb.from('contacts').select('id, data').order('created_at', { ascending: false }),
      sb.from('matches').select('id, data').order('created_at', { ascending: false }),
    ]);

    const contacts = (cRows || []).map(r => ({ ...r.data, id: r.id }));
    const matches  = (mRows  || []).map(r => ({ ...r.data, id: r.id }));
    const cMap = {};
    contacts.forEach(c => { cMap[c.id] = c; });

    const wb = XLSX.utils.book_new();

    // ── Contacts sheet ──
    const cHeaders = [
      'Name','Title','Company','Company Type','Region','Sector','Stage','Priority',
      'WeChat','WhatsApp','Email','Phone','LinkedIn','Other Contact',
      'Budget','Scale','Source','Website',
      'Offers','Needs','Description','Date Added',
    ];
    const cData = contacts.map(c => [
      c.name || '', c.title || '', c.company || '', c.companyType || '',
      REGION_LABELS[c.region] || c.region || '',
      c.sector || '',
      STAGE_LABELS[c.stage] || c.stage || '',
      PRI_LABELS[c.priority] || c.priority || '',
      c.wechat || '', c.whatsapp || '', c.email || '', c.phone || '',
      c.linkedin || '', c.otherContact || '',
      c.budget || 'Unknown', c.scale || 'Unknown', c.source || '', c.website || '',
      (c.offers || []).join(', '),
      (c.needs  || []).join(', '),
      c.description || '', c.dateAdded || '',
    ]);

    const wsC = XLSX.utils.aoa_to_sheet([cHeaders, ...cData]);
    wsC['!cols'] = [20,15,22,18,12,14,10,8,16,16,26,14,26,15,14,20,15,26,35,35,55,12].map(w => ({ wch: w }));
    // Bold header row
    const cRange = XLSX.utils.decode_range(wsC['!ref']);
    for (let C = cRange.s.c; C <= cRange.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!wsC[addr]) continue;
      wsC[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: 'F1F5F9' } } };
    }
    XLSX.utils.book_append_sheet(wb, wsC, 'Contacts');

    // ── Matches sheet ──
    const mHeaders = [
      'Score','Person A','Company A','Region A','Contact A',
      'Person B','Company B','Region B','Contact B',
      'Why Match','Status','Smart Match','Date',
    ];
    const mData = matches.map(m => {
      const cA = cMap[m.idA] || {};
      const cB = cMap[m.idB] || {};
      return [
        m.score || '',
        cA.name || '', cA.company || '', REGION_LABELS[cA.region] || cA.region || '',
        [cA.wechat, cA.whatsapp, cA.email].filter(Boolean).join(' / '),
        cB.name || '', cB.company || '', REGION_LABELS[cB.region] || cB.region || '',
        [cB.wechat, cB.whatsapp, cB.email].filter(Boolean).join(' / '),
        m.reason || '',
        STATUS_LABELS[m.status] || m.status || '',
        m.isSmartMatch ? 'Yes' : 'No',
        m.date || '',
      ];
    });

    const wsM = XLSX.utils.aoa_to_sheet([mHeaders, ...mData]);
    wsM['!cols'] = [6,20,20,12,28,20,20,12,28,55,12,10,12].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wsM, 'Matches');

    // ── Summary sheet ──
    const regionCounts = {};
    contacts.forEach(c => {
      const r = REGION_LABELS[c.region] || c.region || 'Unknown';
      regionCounts[r] = (regionCounts[r] || 0) + 1;
    });
    const summaryData = [
      ['Gateway CRM Export', new Date().toLocaleDateString()],
      [''],
      ['Total Contacts', contacts.length],
      ['Total Matches', matches.length],
      ['Active Matches', matches.filter(m => m.status !== 'closed').length],
      [''],
      ['By Region', ''],
      ...Object.entries(regionCounts).map(([r, n]) => [r, n]),
      [''],
      ['By Stage', ''],
      ['Exploring', contacts.filter(c => c.stage === 'exploring').length],
      ['Active', contacts.filter(c => c.stage === 'active').length],
      ['Ready', contacts.filter(c => c.stage === 'ready').length],
      [''],
      ['By Priority', ''],
      ['High', contacts.filter(c => c.priority === 'high').length],
      ['Medium', contacts.filter(c => c.priority === 'medium').length],
      ['Low', contacts.filter(c => c.priority === 'low').length],
    ];
    const wsS = XLSX.utils.aoa_to_sheet(summaryData);
    wsS['!cols'] = [{ wch: 22 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsS, 'Summary');

    // Send file
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `gateway-crm-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buf.length);
    return res.send(buf);

  } catch (e) {
    console.error('export error:', e);
    return res.status(500).json({ error: e.message });
  }
};
