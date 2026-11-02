// Vue joueur (mobile) — les scores restent cachés jusqu'à la fin pour garder le suspense
import { getDB, MODE } from './net.js';
import { AVATAR_COUNT } from './config.js';
import { COLORS, shape, esc, $, $$, uid, ordinal, ICON, decor, star, avatar, avatarSrc } from './ui.js';

decor();
const app = $('#app');
const db = await getDB();
const KEY = 'quizlive-player';
// En démo locale, une identité par onglet (pour ouvrir plusieurs joueurs test)
const store = MODE === 'local' ? sessionStorage : localStorage;
const params = new URLSearchParams(location.search);

let code = (params.get('room') || '').toUpperCase();
let pid = null;
let me = null;
let state = null;
let unsubs = [];
let joined = false;
let lastQ = -1;
let myChoice = null;
let recvAt = 0;
let cd = null;

const saved = (() => { try { return JSON.parse(store.getItem(KEY)); } catch { return null; } })();
if (!code && saved) code = saved.code;

// Reconnexion automatique (téléphone verrouillé, onglet rechargé…)
if (saved && saved.code === code && (await db.get(`rooms/${code}/players/${saved.pid}`))) {
  pid = saved.pid;
  start();
} else {
  renderJoin();
}

function renderJoin(msg = '') {
  delete document.body.dataset.res;
  delete document.body.dataset.phase;
  app.innerHTML = `<form class="join" id="jf" autocomplete="off">
    ${star('run', 'join-star')}
    <h1>Lutèce <b>Quiz</b></h1>
    <input name="code" class="code-in" placeholder="CODE" maxlength="4" autocapitalize="characters" value="${esc(code)}" aria-label="Code de la partie">
    <input name="name" placeholder="Ton pseudo" maxlength="16" value="${esc(saved?.name || '')}" aria-label="Pseudo">
    <button class="btn primary big" id="jb">C'est parti !</button>
    <p class="err" id="err">${esc(msg)}</p>
  </form>`;
  (code ? $('[name=name]') : $('[name=code]')).focus();
  $('#jf').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const c = String(f.get('code')).trim().toUpperCase();
    const n = String(f.get('name')).trim();
    const err = $('#err');
    if (c.length !== 4) return (err.textContent = 'Le code fait 4 lettres.');
    if (!n) return (err.textContent = 'Choisis un pseudo.');
    $('#jb').disabled = true;
    const st = await db.get(`rooms/${c}/state`);
    const fail = (m) => { err.textContent = m; $('#jb').disabled = false; };
    if (!st) return fail('Partie introuvable. Vérifie le code.');
    if (st.phase === 'end' || st.phase === 'closed') return fail('Cette partie est terminée.');
    const ps = (await db.get(`rooms/${c}/players`)) || {};
    if (Object.values(ps).some((p) => p.name.toLowerCase() === n.toLowerCase())) return fail('Ce pseudo est déjà pris.');
    // Avatar par défaut : un avatar pas encore pris, au hasard
    const taken = new Set(Object.values(ps).map((p) => p.avatar));
    const free = [...Array(AVATAR_COUNT).keys()].filter((i) => !taken.has(i));
    const pool = free.length ? free : [...Array(AVATAR_COUNT).keys()];
    code = c;
    pid = uid(12);
    await db.set(`rooms/${code}/players/${pid}`, { name: n, avatar: pool[Math.floor(Math.random() * pool.length)], score: 0, joinedAt: db.now() });
    store.setItem(KEY, JSON.stringify({ code, pid, name: n }));
    start();
  };
}

function start() {
  joined = true;
  unsubs.forEach((u) => u());
  unsubs = [
    db.on(`rooms/${code}/state`, (v) => { state = v; render(); }),
    db.on(`rooms/${code}/players/${pid}`, (v) => {
      if (!v && joined) {
        joined = false;
        unsubs.forEach((u) => u());
        store.removeItem(KEY);
        renderJoin('Tu as été retiré de la partie.');
        return;
      }
      me = v;
      render();
    }),
  ];
}

function answer(j) {
  if (myChoice !== null || state?.phase !== 'question') return;
  myChoice = j;
  navigator.vibrate?.(40);
  db.set(`rooms/${code}/answers/${state.q}/${pid}`, { choice: j, at: db.now() });
  render();
}

function pickAvatar(i) {
  if (i === me.avatar) return;
  me.avatar = i;
  updateLobby();
  db.update(`rooms/${code}/players/${pid}`, { avatar: i });
}

// Mise à jour légère du lobby (évite de reconstruire la grille et de perdre le scroll)
function updateLobby() {
  $$('.p-me .av, .p-head .av').forEach((img) => (img.src = avatarSrc(me.avatar)));
  $$('.av-grid button').forEach((b) => b.classList.toggle('on', +b.dataset.av === me.avatar));
}

const center = (inner) => `<div class="p-center">${inner}</div>`;

function render() {
  if (!me) return;
  clearInterval(cd);
  const ph = state?.phase || 'closed';
  if (ph === 'question' && state.q !== lastQ) { lastQ = state.q; recvAt = Date.now(); myChoice = null; }
  if (ph === 'lobby' && $('.av-grid')) return updateLobby();

  const last = me.last && state && me.last.q === state.q ? me.last : null;
  if (ph === 'reveal' && last) document.body.dataset.res = last.ok ? 'ok' : 'ko';
  else delete document.body.dataset.res;
  document.body.dataset.phase = ph;

  const head = `<header class="p-head">${avatar(me.avatar)}<span class="p-name">${esc(me.name)}</span>${state?.total && ['video', 'question', 'reveal'].includes(ph) ? `<span class="p-qn">${Math.min((state.q ?? 0) + 1, state.total)}/${state.total}</span>` : ''}</header>`;
  let body = '';

  switch (ph) {
    case 'lobby':
      body = `<div class="p-lobby">
        <div class="p-me">${avatar(me.avatar, 'av-big')}<div><h1>Tu es dans la partie !</h1><p>Choisis ton avatar en attendant le début.</p></div></div>
        <div class="av-grid">${Array.from({ length: AVATAR_COUNT }, (_, i) =>
          `<button data-av="${i}" class="${i === me.avatar ? 'on' : ''}" aria-label="Avatar ${i + 1}">${avatar(i)}</button>`).join('')}</div>
      </div>`;
      break;
    case 'video':
      body = center(`${star('point', 'p-star')}<h1>Regarde l'écran !</h1><p>Une vidéo passe sur le grand écran.<br>Les réponses arrivent juste après.</p>`);
      break;
    case 'question':
      body = myChoice !== null
        ? center(`<div class="sent" style="--c:${COLORS[myChoice]}">${shape(myChoice)}</div>${star('run', 'p-star sm')}<h1>Réponse envoyée !</h1><p>Croise les doigts…</p>`)
        : `<div class="p-q">
            <div class="p-qtop"><span>Question ${state.q + 1}/${state.total}</span><span class="p-cd" id="cd"></span></div>
            <p class="p-qtext">${esc(state.text)}</p>
            <div class="p-btns n${state.choices.length}">${state.choices.map((c, j) =>
              `<button data-j="${j}" style="--c:${COLORS[j]}">${shape(j)}<span>${esc(c)}</span></button>`).join('')}</div>
          </div>`;
      break;
    case 'reveal':
      if (!last) body = center(`${star('scheme', 'p-star')}<h1>Résultats…</h1>`);
      else if (last.ok) body = center(`<div class="res ok">${ICON.check}</div><h1>Bonne réponse !</h1><p>Ton score reste secret jusqu'à la fin…</p>`);
      else body = center(`<div class="res ko">${ICON.x}</div><h1>${last.answered ? 'Raté !' : 'Trop tard !'}</h1>
        <p>La bonne réponse : <b>${esc(state.choices[state.correct])}</b></p>`);
      break;
    case 'leaderboard':
      body = center(`${star('point', 'p-star')}<h1>Classement provisoire</h1><p>Regarde le grand écran :<br>es-tu dans le top 10 ?</p>`);
      break;
    case 'end': {
      if (!state.final) { body = center(`${star('scheme', 'p-star')}<h1>Suspense…</h1><p>Le podium se dévoile sur le grand écran.</p>`); break; }
      const rank = me.last?.rank;
      const medal = rank && rank <= 3 ? ['#ffcf00', '#3fa3e0', '#e8384f'][rank - 1] : null;
      body = center(`
        ${medal ? `<div class="medal" style="background:${medal};color:${rank === 1 ? '#2e0e30' : '#fff'}">${rank}</div>` : `<p>Tu termines</p><div class="rank-big">${rank ? ordinal(rank) : '–'}</div>`}
        ${rank === 1 ? star('happy', 'p-star sm') : ''}
        <h1>${rank === 1 ? 'Victoire !' : medal ? 'Sur le podium !' : 'Partie terminée'}</h1>
        <p>${me.score || 0} points · Merci d'avoir joué !</p>`);
      break;
    }
    default:
      body = center(`${star('happy', 'p-star')}<h1>Partie terminée</h1><p>Merci d'avoir joué !</p>`);
  }

  app.innerHTML = head + body;
  if (ph === 'lobby') {
    $('.av-grid').onclick = (e) => { const b = e.target.closest('[data-av]'); if (b) pickAvatar(+b.dataset.av); };
  }
  if (ph === 'question' && myChoice === null) {
    $$('.p-btns button').forEach((b) => (b.onclick = () => answer(+b.dataset.j)));
    const upd = () => {
      const el = $('#cd');
      if (el) el.textContent = Math.max(0, Math.ceil(state.duration - (Date.now() - recvAt) / 1000));
    };
    upd();
    cd = setInterval(upd, 250);
  }
}
