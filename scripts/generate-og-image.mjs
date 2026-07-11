// Generates public/og-default.png (1200x630).
// Dark terminal aesthetic matching the site: dark base, terminal window
// chrome with traffic-light dots, green prompt, tagline.
// Run: node scripts/generate-og-image.mjs
import sharp from 'sharp';

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#050505"/>
  <rect x="90" y="105" width="1020" height="420" rx="16" fill="#0b0f0d" stroke="#1f2a24" stroke-width="2"/>
  <path d="M90 161 h1020 v-40 a16 16 0 0 0 -16 -16 h-988 a16 16 0 0 0 -16 16 z" fill="#101613"/>
  <circle cx="130" cy="133" r="8" fill="#ef4444"/>
  <circle cx="158" cy="133" r="8" fill="#eab308"/>
  <circle cx="186" cy="133" r="8" fill="#22c55e"/>
  <text x="600" y="140" font-family="Menlo, 'DejaVu Sans Mono', monospace" font-size="18" fill="#6b7280" text-anchor="middle">camber ~ zsh</text>
  <text x="150" y="235" font-family="Menlo, 'DejaVu Sans Mono', monospace" font-size="26" fill="#4ade80">$ camber --intro</text>
  <text x="150" y="330" font-family="Menlo, 'DejaVu Sans Mono', monospace" font-size="76" font-weight="700" fill="#f9fafb">Camber Co</text>
  <text x="150" y="395" font-family="Menlo, 'DejaVu Sans Mono', monospace" font-size="34" fill="#9ca3af">The AI consultant who builds.</text>
  <rect x="150" y="428" width="20" height="40" fill="#4ade80"/>
  <text x="150" y="580" font-family="Menlo, 'DejaVu Sans Mono', monospace" font-size="22" fill="#4b5563">camberco.co.uk</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('public/og-default.png');
console.log('Wrote public/og-default.png');
