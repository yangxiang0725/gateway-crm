const XLSX = require('xlsx');
const { getDB } = require('./_db');

const RL = { china:'China', mexico:'Mexico', north_america:'North America', others:'Others' };
const SL = { exploring:'Exploring', active:'Active', ready:'Ready' };
const PL = { high:'High', medium:'Medium', low:'Low' };
const ML = { suggested:'Suggested', introduced:'Introduced', in_progress:'In Progress', closed:'Closed' };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sb = getDB();
    const [{ data: cRows }, { data: mRows }] = await Promise.all([
      sb.from('contacts').select('id, data').order('created_at', { ascending: false }),
      sb.from('matches').select('id, data').order('created_at', { ascending: false }),
    ]);

    const contacts = (cRows || []).map(r => ({ ...r.data, id: r.id }));
    const matches = (mRows || []).map(r => ({ ...r.data, id: r.id }));
    const cMap = {};
    contacts.forEach(c => { cMap[c.id] = c; });

    const wb = XLSX.utils.book_new();

    // Contacts sheet
    const cH = ['Name','Title','Company','Company Type','Region','Sector','Stage','Priority',
      'Intent','Relationship','Language','Market Interest','Next Action',
      'WeChat','WhatsApp','Email','Phone','LinkedIn','Other Contact',
      'Budget','Scale','Source','Website','Offers','Needs','Description','Date Added'];
    const cD = contacts.map(c => [
      c.name||'', c.title||'', c.company||'', c.companyType||'',
      RL[c.region]||c.region||'', c.sector||'', SL[c.stage]||c.stage||'', PL[c.priority]||c.priority||'',
      c.intent||'', c.relationship||'', c.language||'',
      Array.isArray(c.marketInterest) ? c.marketInterest.join(', ') : (c.marketInterest||''),
      c.nextAction||'',
      c.wechat||'', c.whatsapp||'', c.email||'', c.phone||'', c.linkedin||'', c.otherContact||'',
      c.budget||'', c.scale||'', c.source||'', c.website||'',
      (c.offers||[]).join(', '), (c.needs||[]).join(', '), c.description||'', c.dateAdded||''
    ]);
    const wsC = XLSX.utils.aoa_to_sheet([cH, ...cD]);
    wsC['!cols'] = [18,14,20,16,12,14,10,8,10,12,10,25,14,15,15,25,14,25,14,14,18,14,22,30,30,50,12].map(w=>({wch:w}));
    XLSX.utils.book_append_sheet(wb, wsC, 'Contacts');

    // Matches sheet
    const mH = ['Score','Person A','Company A','Region A','Contact A','Person B','Company B','Region B','Contact B','Why Match','Status','Smart Match','Date'];
    const mD = matches.map(m => {
      const cA = cMap[m.idA]||{}; const cB = cMap[m.idB]||{};
      return [m.score||'', cA.name||'', cA.company||'', RL[cA.region]||cA.region||'',
        [cA.wechat, cA.whatsapp, cA.email].filter(Boolean).join(' / '),
        cB.name||'', cB.company||'', RL[cB.region]||cB.region||'',
        [cB.wechat, cB.whatsapp, cB.email].filter(Boolean).join(' / '),
        m.reason||'', ML[m.status]||m.status||'', m.isSmartMatch?'Yes':'No', m.date||''];
    });
    const wsM = XLSX.utils.aoa_to_sheet([mH, ...mD]);
    wsM['!cols'] = [6,20,20,12,28,20,20,12,28,55,12,10,12].map(w=>({wch:w}));
    XLSX.utils.book_append_sheet(wb, wsM, 'Matches');

    // Summary sheet
    const rCounts = {}; contacts.forEach(c => { const r = RL[c.region]||c.region||'Unknown'; rCounts[r]=(rCounts[r]||0)+1; });
    const wsS = XLSX.utils.aoa_to_sheet([
      ['SynerSage CRM Export', new Date().toLocaleDateString()], [''],
      ['Total Contacts', contacts.length], ['Total Matches', matches.length],
      ['Active Matches', matches.filter(m=>m.status!=='closed').length], [''],
      ['By Region', ''], ...Object.entries(rCounts).map(([r,n])=>[r,n]), [''],
      ['High Priority', contacts.filter(c=>c.priority==='high').length],
      ['Active Stage', contacts.filter(c=>c.stage==='active').length],
      ['Ready Stage', contacts.filter(c=>c.stage==='ready').length],
    ]);
    wsS['!cols'] = [{wch:22},{wch:14}];
    XLSX.utils.book_append_sheet(wb, wsS, 'Summary');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `synersage-crm-${new Date().toISOString().slice(0,10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buf);
  } catch (e) {
    console.error('export error:', e);
    return res.status(500).json({ error: e.message });
  }
};
