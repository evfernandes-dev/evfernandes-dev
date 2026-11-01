import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USER = process.env.GITHUB_USER || "evfernandes-dev";
const OUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "assets",
  "language-graph.svg",
);
const API = `https://api.github.com/users/${USER}/repos?per_page=100&type=owner&sort=updated`;

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": `${USER}-language-graph`,
};

if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

const response = await fetch(API, { headers });

if (!response.ok) {
  throw new Error(`Failed to fetch repositories: ${response.status} ${response.statusText}`);
}

const repos = await response.json();
const counts = new Map();

for (const repo of repos) {
  if (repo.fork || repo.archived || !repo.language) {
    continue;
  }

  counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
}

const total = [...counts.values()].reduce((sum, count) => sum + count, 0);

if (total === 0) {
  throw new Error("No language data found");
}

const sorted = [...counts.entries()].sort(
  (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
);

const palette = {
  Python: "#3572A5",
  Java: "#b07219",
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  HTML: "#e34c26",
  CSS: "#563d7c",
  "Jupyter Notebook": "#DA5B0B",
  SQL: "#e38c00",
  Shell: "#89e051",
  Dockerfile: "#384d54",
  "C#": "#178600",
  PHP: "#4F5D95",
  Kotlin: "#A97BFF",
  Go: "#00ADD8",
  Rust: "#dea584",
  Ruby: "#701516",
  "C++": "#f34b7d",
  C: "#666666",
  Other: "#6b8ba3",
};

const fallback = ["#00e5ff", "#8a2be2", "#00ffa3", "#ff4fd8", "#ffd166", "#4cc9f0"];
const MAX_ROWS = 6;
const rows = sorted.slice(0, MAX_ROWS);

if (sorted.length > MAX_ROWS) {
  const other = sorted.slice(MAX_ROWS).reduce((sum, [, count]) => sum + count, 0);
  rows.push(["Other", other]);
}

const totalLabel = total.toLocaleString("en-US");
const topLanguage = sorted[0][0];

const rawPercents = rows.map(([, count]) => (count / total) * 100);
const rowPercents = rawPercents.map((value) => Math.floor(value));
const percentRemainder = 100 - rowPercents.reduce((sum, value) => sum + value, 0);
const percentOrder = rawPercents
  .map((value, index) => ({ index, fraction: value - rowPercents[index] }))
  .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

for (let index = 0; index < percentRemainder; index += 1) {
  rowPercents[percentOrder[index % percentOrder.length].index] += 1;
}

const topPercent = rowPercents[0];
const topColor = palette[topLanguage] ?? fallback[0];
const maxCount = Math.max(...rows.map(([, count]) => count));

function colorFor(language, index) {
  return palette[language] ?? fallback[index % fallback.length];
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  })[char]);
}

const W = 700;
const H = 230;
const ringX = 100;
const ringY = 128;
const ringR = 42;
const circumference = 2 * Math.PI * ringR;
const ringDash = (topPercent / 100) * circumference;
const barX = 310;
const barMax = 250;
const rowTop = 54;
const rowBottom = 194;
const rowStep = rows.length > 1 ? Math.min(30, (rowBottom - rowTop) / (rows.length - 1)) : 0;
const rowStart = rowTop + ((rowBottom - rowTop) - rowStep * (rows.length - 1)) / 2;

const bars = rows.map(([language, count], index) => {
  const color = colorFor(language, index);
  const percent = rowPercents[index];
  const width = Math.max(12, (count / maxCount) * barMax);
  const y = rowStart + index * rowStep;
  const delay = (-(index * 0.55)).toFixed(2);

  return `
    <g>
      <circle cx="212" cy="${y + 4}" r="3" fill="${color}" />
      <text x="222" y="${y + 7}" fill="#cfe9ff" font-size="9.2" font-family="Segoe UI, Arial, sans-serif" font-weight="600">${escapeXml(language)}</text>
      <rect x="${barX}" y="${y}" width="${barMax}" height="8" rx="4" fill="#101a2d" />
      <rect class="bar" x="${barX}" y="${y}" width="${width.toFixed(1)}" height="8" rx="4" fill="${color}" filter="url(#glow)" style="animation-delay:${delay}s">
        <title>${escapeXml(language)}: ${count} ${count === 1 ? "repository" : "repositories"} (${percent}%)</title>
      </rect>
      <rect x="${barX}" y="${y}" width="${width.toFixed(1)}" height="2.5" rx="1.2" fill="#ffffff" opacity="0.18" />
      <text x="682" y="${y + 7}" text-anchor="end" fill="#7fa6bd" font-size="8.5" font-family="Segoe UI, Arial, sans-serif">${count} &#183; ${percent}%</text>
    </g>`;
}).join("\n");

const dust = [
  [58, 74], [146, 196], [250, 40], [430, 204],
  [560, 36], [648, 160], [300, 214], [680, 72],
].map(([cx, cy], index) => (
  `<circle class="dust" cx="${cx}" cy="${cy}" r="${index % 2 ? 1.2 : 1.8}" fill="#00e5ff" style="animation-delay:-${(index * 0.9).toFixed(1)}s" />`
)).join("\n  ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Repositories by language: ${totalLabel} repositories, top language ${escapeXml(topLanguage)} with ${topPercent}%">
  <defs>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1224" />
      <stop offset="1" stop-color="#060a16" />
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#00e5ff" />
      <stop offset="1" stop-color="#8a2be2" />
    </linearGradient>
    <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${topColor}" />
      <stop offset="1" stop-color="#00e5ff" />
    </linearGradient>
    <linearGradient id="shineGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#00e5ff" stop-opacity="0" />
      <stop offset="0.5" stop-color="#00e5ff" stop-opacity="0.22" />
      <stop offset="1" stop-color="#00e5ff" stop-opacity="0" />
    </linearGradient>
    <clipPath id="barsClip">
      <rect x="${barX}" y="46" width="${barMax + 12}" height="170" rx="4" />
    </clipPath>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="2.4" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <style>
    .bar { animation: barPulse 5s ease-in-out infinite; }
    .ring { animation: ringPulse 4s ease-in-out infinite; }
    .orbit { transform-origin: ${ringX}px ${ringY}px; animation: orbit 9s linear infinite; }
    .shine { animation: shineMove 5.5s linear infinite; }
    .dust { animation: dustFloat 7s ease-in-out infinite; opacity: .2; }
    .border { animation: borderPulse 4s ease-in-out infinite; }
    .accent { animation: accentPulse 3.6s ease-in-out infinite; }
    @keyframes barPulse { 0%, 100% { opacity: .72; } 50% { opacity: 1; } }
    @keyframes ringPulse { 0%, 100% { opacity: .68; } 50% { opacity: 1; } }
    @keyframes orbit { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    @keyframes shineMove { 0% { transform: translateX(-90px); } 100% { transform: translateX(300px); } }
    @keyframes dustFloat { 0%, 100% { transform: translateY(0); opacity: .18; } 50% { transform: translateY(-7px); opacity: .6; } }
    @keyframes borderPulse { 0%, 100% { stroke-opacity: .55; } 50% { stroke-opacity: 1; } }
    @keyframes accentPulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
  </style>

  <rect class="border" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="url(#panel)" stroke="#17304d" />
  <rect class="accent" x="18" y="14" width="48" height="2" rx="1" fill="url(#accent)" />

  <text x="18" y="32" fill="#7be9ff" font-size="10" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="2.4" filter="url(#glow)">REPOS BY LANGUAGE</text>
  <text x="18" y="47" fill="#5d7e95" font-size="8" font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.8">NON-FORK &#183; PRIMARY LANGUAGE</text>

  <circle cx="${ringX}" cy="${ringY}" r="${ringR}" fill="none" stroke="#142033" stroke-width="9" />
  <circle class="ring" cx="${ringX}" cy="${ringY}" r="${ringR}" fill="none" stroke="url(#ringGrad)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${ringDash.toFixed(1)} ${circumference.toFixed(1)}" transform="rotate(-90 ${ringX} ${ringY})" filter="url(#glow)" />
  <circle class="orbit" cx="${ringX}" cy="${ringY - ringR}" r="2.2" fill="#00e5ff" filter="url(#glow)" />

  <text x="${ringX}" y="${ringY + 6}" text-anchor="middle" fill="#eafcff" font-size="28" font-family="Segoe UI, Arial, sans-serif" font-weight="800">${totalLabel}</text>
  <text x="${ringX}" y="${ringY + 22}" text-anchor="middle" fill="#7fa6bd" font-size="7" font-family="Segoe UI, Arial, sans-serif" letter-spacing="2">REPOS</text>
  <text x="${ringX}" y="194" text-anchor="middle" fill="#7be9ff" font-size="8.5" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="0.6">${escapeXml(topLanguage.toUpperCase())} &#183; ${topPercent}%</text>

  <g>
    ${bars}
  </g>

  <g clip-path="url(#barsClip)">
    <rect class="shine" x="${barX}" y="46" width="70" height="170" fill="url(#shineGrad)" />
  </g>

  ${dust}
</svg>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg, "utf8");

console.log(`Updated ${OUT}: ${total} repositories, top ${topLanguage} ${topPercent}%`);
