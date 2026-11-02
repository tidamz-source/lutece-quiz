// Helpers d'interface partagés (formes, couleurs, icônes)
export const COLORS = ['#2e8e43', '#e8384f', '#3fa3e0', '#cfa800'];

const SHAPES = [
  '<path d="M12 3.2 22 20.5H2z"/>',
  '<path d="M12 1.8 22.2 12 12 22.2 1.8 12z"/>',
  '<circle cx="12" cy="12" r="9.6"/>',
  '<rect x="3" y="3" width="18" height="18" rx="2.5"/>',
];
export const shape = (i, cls = '') =>
  `<svg class="shape ${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${SHAPES[i % 4]}</svg>`;

const ic = (d) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  trash: ic('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  dup: ic('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  download: ic('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  up: ic('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  down: ic('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  check: ic('<path d="M5 12.5 10 17l9-10"/>'),
  x: ic('<path d="M6 6l12 12M18 6 6 18"/>'),
  image: ic('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>'),
  video: ic('<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>'),
  audio: ic('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
  text: ic('<path d="M5 6h14M12 6v13M9 19h6"/>'),
  back: ic('<path d="M15 5l-7 7 7 7"/>'),
  next: ic('<path d="M9 5l7 7-7 7"/>'),
  play: ic('<path d="M7 5v14l11-7z" fill="currentColor"/>'),
  full: ic('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
};

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function uid(n = 10) {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  return [...crypto.getRandomValues(new Uint8Array(n))].map((x) => a[x % a.length]).join('');
}
export function roomCode() {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  return [...crypto.getRandomValues(new Uint8Array(4))].map((x) => a[x % a.length]).join('');
}
export const ordinal = (n) => (n === 1 ? '1er' : `${n}e`);
export function colorFor(str = '') {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0;
  return COLORS[Math.abs(h) % 4];
}

// Mascotte : point (montre), happy (content), run (court), scheme (suspense)
export const star = (pose, cls = '') => `<img class="star ${cls}" src="img/star-${pose}.png" alt="" draggable="false">`;

// Avatars (fichiers dans avatars/)
export const avatarSrc = (i) => `avatars/avatar-${String((i ?? 0) + 1).padStart(2, '0')}.png`;
export const avatar = (i, cls = '') => `<img class="av ${cls}" src="${avatarSrc(i)}" alt="" draggable="false">`;

export const logo = () =>
  `<span class="logo">${[0, 1, 2, 3].map((i) => `<i style="color:${COLORS[i]}">${shape(i)}</i>`).join('')}</span>`;

export function decor() {
  if ($('.decor')) return;
  const d = document.createElement('div');
  d.className = 'decor';
  const items = [[0, 6, 10, 150, 0], [1, 84, 6, 110, 3], [2, 74, 70, 190, 6], [3, 3, 68, 120, 9], [0, 46, 86, 90, 12], [2, 92, 38, 70, 4], [1, 30, 30, 60, 7]];
  d.innerHTML = items.map(([s, x, y, size, delay]) =>
    `<span style="left:${x}%;top:${y}%;width:${size}px;height:${size}px;color:${COLORS[s]};animation-delay:-${delay}s">${shape(s)}</span>`).join('');
  document.body.prepend(d);
}

export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 2200);
}
