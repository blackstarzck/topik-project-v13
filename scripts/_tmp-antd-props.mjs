import fs from 'node:fs';

const comps = ['Space', 'Alert', 'Drawer', 'Statistic', 'Spin', 'Steps', 'Empty', 'Input'];
for (const c of comps) {
  const d = JSON.parse(fs.readFileSync(`errors/info-${c}.json`, 'utf8'));
  const props = d.props || [];
  console.log(`\n===== ${c} =====`);
  for (const p of props) {
    console.log(`  ${(p.name || '').padEnd(18)} ${(p.type || '').replace(/\s+/g, ' ').slice(0, 70)}  [since ${p.since || '-'}]`);
  }
}
