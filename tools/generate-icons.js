const sharp = require('sharp');
const path = require('path');

const OUT = 'src/assets/images';

const BLUE = '#1363DF';
const BLUE_DARK = '#0B3F91';
const WHITE = '#FFFFFF';
const GRID = 'rgba(255,255,255,0.10)';

/**
 * A route that avoids a point: a curved line with a pin at the end and a
 * crossed out circle in the middle of it.
 */
const route = (color = WHITE) => `
  <g fill="none" stroke="${color}" stroke-width="46" stroke-linecap="round" stroke-linejoin="round">
    <path d="M232 742 C232 560 330 520 420 520 C520 520 560 610 660 610" />
  </g>
  <g fill="${color}">
    <path d="M660 388 q-88 0 -88 88 q0 68 88 152 q88 -84 88 -152 q0 -88 -88 -88 z" />
    <circle cx="660" cy="474" r="34" fill="${BLUE}" />
  </g>
  <g stroke="${color}" stroke-width="40" stroke-linecap="round">
    <line x1="286" y1="596" x2="438" y2="748" />
    <line x1="438" y1="596" x2="286" y2="748" />
  </g>
`;

const grid = (size) => {
    const lines = [];
    const step = size / 16;
    for (let i = 1; i < 16; i += 1) {
        const position = Math.round(i * step);
        lines.push(`<line x1="${position}" y1="0" x2="${position}" y2="${size}" />`);
        lines.push(`<line x1="0" y1="${position}" x2="${size}" y2="${position}" />`);
    }
    return `<g stroke="${GRID}" stroke-width="3">${lines.join('')}</g>`;
};

const background = (size) => `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BLUE}" />
      <stop offset="100%" stop-color="${BLUE_DARK}" />
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.16" />
      <stop offset="55%" stop-color="#FFFFFF" stop-opacity="0" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)" />
  ${grid(size)}
  <path d="M0 ${size} L${size} ${size * 0.28} L${size} ${size} Z" fill="url(#sheen)" />
`;

const svg = (size, body) => Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`,
);

const glyphOnly = (size, scale, color = WHITE) => {
    const cx = 512;
    const cy = 512;
    return `
    <g transform="translate(${size / 2 - cx * scale} ${size / 2 - cy * scale}) scale(${scale})">
      ${route(color)}
    </g>
  `;
};

const roundedMask = (size, radius) => Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
     <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff" />
   </svg>`,
);

const write = async (name, buffer) => {
    await sharp(buffer).png().toFile(path.join(OUT, name));
    console.log('wrote', name);
};

(async () => {
    const size = 1024;
    const radius = size * 0.22;

    const full = sharp(svg(size, `${background(size)}${glyphOnly(size, 0.78)}`));
    await full
        .composite([{ input: roundedMask(size, radius), blend: 'dest-in' }])
        .png()
        .toFile(path.join(OUT, 'icon.png'));
    console.log('wrote icon.png');

    await write('android-icon-background.png', svg(size, background(size)));
    await write('android-icon-foreground.png', svg(size, glyphOnly(size, 0.68)));
    await write('android-icon-monochrome.png', svg(size, glyphOnly(size, 0.68, '#000000')));
    await write('splash-icon.png', svg(512, glyphOnly(512, 0.58)));
    await write('favicon.png', svg(48, glyphOnly(48, 0.58)));
})();
