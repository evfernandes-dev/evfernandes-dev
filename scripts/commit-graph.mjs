import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const USER = process.env.GITHUB_USER || 'evfernandes-dev';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'commit-activity.svg');
const API = `https://github-contributions-api.jogruber.de/v4/${USER}?y=last`;

const response = await fetch(API, {
  headers: { 'User-Agent': `${USER}-commit-graph`, Accept: 'application/json' }
});

if (!response.ok) {
  throw new Error(`Failed to fetch contributions: ${response.status} ${response.statusText}`);
}

const data = await response.json();
const allDays = Array.isArray(data.contributions) ? data.contributions : [];

if (allDays.length === 0) {
  throw new Error('Contribution API returned no days');
}

const last = new Date(`${allDays[allDays.length - 1].date}T00:00:00Z`);
const start = new Date(last);
start.setUTCDate(start.getUTCDate() - 364);

const days = allDays.filter((day) => new Date(`${day.date}T00:00:00Z`) >= start);
const total = days.reduce((sum, day) => sum + day.count, 0);

let streak = 0;
for (let i = days.length - 1; i >= 0; i--) {
  if (days[i].count > 0) streak++;
  else break;
}

const firstDate = new Date(`${days[0].date}T00:00:00Z`);
let week = 0;
let weekday = firstDate.getUTCDay();

const cells = days.map((day) => {
  const cell = { date: day.date, count: day.count, level: day.level, week, day: weekday };
  weekday++;
  if (weekday === 7) {
    weekday = 0;
    week++;
  }
  return cell;
});

const weeks = Math.ceil((firstDate.getUTCDay() + days.length) / 7);

const W = 700;
const H = 170;
const heatX = 212;
const heatY = 58;
const step = 8.7;
const cellSize = 7;
const radius = 1.6;

const levels = ['#142033', '#0b3d52', '#086b8a', '#00a8cc', '#00e5ff'];

const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const monthLabels = [];
const seenMonths = new Set();
for (const cell of cells) {
  const date = new Date(`${cell.date}T00:00:00Z`);
  const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
  if (!seenMonths.has(key) && cell.day <= 2) {
    seenMonths.add(key);
    monthLabels.push({
      x: heatX + cell.week * step,
      label: monthNames[date.getUTCMonth()]
    });
  }
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  })[char]);
}

const rects = cells.map((cell) => {
  const x = (heatX + cell.week * step).toFixed(1);
  const y = (heatY + cell.day * step).toFixed(1);
  const fill = levels[Math.max(0, Math.min(4, cell.level))];
  return `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="${radius}" fill="${fill}"><title>${escapeXml(cell.date)}: ${cell.count} contribution${cell.count === 1 ? '' : 's'}</title></rect>`;
}).join('\n    ');

const monthSvg = monthLabels.map((month) => (
  `<text x="${month.x.toFixed(1)}" y="48" fill="#6b8ba3" font-size="8" font-family="Segoe UI, Arial, sans-serif" font-weight="600" letter-spacing="0.6">${month.label}</text>`
)).join('\n    ');

const streakLabel = `${streak} ${streak === 1 ? 'day' : 'days'}`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Commit activity: ${total} contributions in the last 12 months, current streak of ${streakLabel}">
  <defs>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1224"/>
      <stop offset="1" stop-color="#060a16"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#00e5ff"/>
      <stop offset="1" stop-color="#8a2be2"/>
    </linearGradient>
  </defs>

  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="url(#panel)" stroke="#17304d"/>
  <rect x="18" y="14" width="48" height="2" rx="1" fill="url(#accent)"/>

  <text x="18" y="32" fill="#7be9ff" font-size="10" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="2.4">COMMIT ACTIVITY</text>
  <text x="18" y="70" fill="#eafcff" font-size="34" font-family="Segoe UI, Arial, sans-serif" font-weight="800">${total.toLocaleString('en-US')}</text>
  <text x="18" y="86" fill="#7fa6bd" font-size="9" font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.6">contributions · last 12 months</text>

  <line x1="18" y1="100" x2="186" y2="100" stroke="#17304d" stroke-width="1"/>

  <text x="18" y="118" fill="#7fa6bd" font-size="8" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="1.8">CURRENT STREAK</text>
  <text x="18" y="142" fill="#00e5ff" font-size="20" font-family="Segoe UI, Arial, sans-serif" font-weight="800">${streakLabel}</text>

  ${monthSvg}

  <g>
    ${rects}
  </g>

  <text x="${heatX}" y="156" fill="#5d7e95" font-size="8" font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.5">Less</text>
  ${levels.map((color, index) => `<rect x="${heatX + 34 + index * 12}" y="149" width="8" height="8" rx="1.5" fill="${color}"/>`).join('')}
  <text x="${heatX + 34 + levels.length * 12 + 2}" y="156" fill="#5d7e95" font-size="8" font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.5">More</text>
</svg>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg, 'utf8');

console.log(`Updated ${OUT}: ${total} contributions, ${streakLabel} streak, ${weeks} weeks`);
