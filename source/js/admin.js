// Interface d'administration : liste des quiz + éditeur
import * as S from './store.js';
import { COLORS, shape, esc, $, $$, logo, decor, toast, ICON, star } from './ui.js';
import { MODE } from './net.js';

decor();
const app = $('#app');
let quiz = null;
let saveTimer = null;
const urlCache = new Map();

const TIMES = [5, 10, 15, 20, 30, 45, 60, 90, 120];
const POINTS = [[1, 'Points normaux'], [2, 'Points doubles'], [0, 'Sans points']];
const MEDIA_TYPES = [['none', 'Texte seul', ICON.text], ['image', 'Image', ICON.image], ['video', 'Vidéo', ICON.video], ['audio', 'Son', ICON.audio]];
const ACCEPT = { image: 'image/*', video: 'video/*', audio: 'audio/*' };
const LABEL = { image: 'une image', video: 'une vidéo', audio: 'un son' };

window.addEventListener('hashchange', route);
route();

async function route() {
  const m = location.hash.match(/^#\/edit\/(.+)$/);
  if (m) {
    quiz = await S.getQuiz(m[1]);
    if (!quiz) { location.hash = ''; return; }
    renderEditor();
  } else {
    if (quiz) await commit();
    quiz = null;
    renderList();
  }
}

const fmtDate = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const topbar = (inner) => `<header class="topbar"><a class="brand" href="#">${logo()}<span>Lutèce <b>Quiz</b></span></a>${inner}</header>`;
const modePill = () => MODE === 'firebase'
  ? `<span class="mode-pill firebase" title="Les joueurs rejoignent depuis leur mobile">● En ligne</span>`
  : `<span class="mode-pill local" title="Pas de config Firebase : test dans plusieurs onglets de ce navigateur">● Mode démo local</span>`;

/* ───────────── Liste ───────────── */
async function renderList() {
  const list = await S.listQuizzes();
  app.innerHTML = topbar(`<span class="spacer"></span>${modePill()}`) + `
  <main class="wrap">
    <div class="list-head">
      <div><h1>Mes quiz</h1><p class="muted">Prépare tes questions, puis lance la partie sur le grand écran.</p></div>
      <div class="row">
        <label class="btn ghost">Importer<input type="file" accept=".json,application/json" id="imp" hidden></label>
        <button class="btn primary" data-act="new">+ Nouveau quiz</button>
      </div>
    </div>
    ${list.length ? `<div class="grid">${list.map(cardHTML).join('')}</div>` : `
    <div class="empty">${star('point', 'empty-star')}<h2>Aucun quiz pour l'instant</h2><p class="muted">Crée ton premier quiz en quelques clics.</p>
      <button class="btn primary" data-act="new">+ Créer un quiz</button></div>`}
  </main>`;
}

function cardHTML(q) {
  const n = S.issues(q).length;
  const nq = q.questions.length;
  return `<article class="qz" data-id="${q.id}">
    <div class="qz-band">${[0, 1, 2, 3].map((i) => `<i style="background:${COLORS[i]}">${shape(i)}</i>`).join('')}</div>
    <h3>${esc(q.title || 'Sans titre')}</h3>
    <p class="muted">${nq} question${nq > 1 ? 's' : ''} · modifié le ${fmtDate(q.updatedAt)}</p>
    ${n ? `<span class="tag warn">${n} question${n > 1 ? 's' : ''} à compléter</span>` : `<span class="tag ok">Prêt à jouer</span>`}
    <div class="qz-actions">
      <button class="btn primary sm" data-act="launch">${ICON.play} Lancer</button>
      <button class="btn sm" data-act="edit">Modifier</button>
      <span class="spacer"></span>
      <button class="icon-btn" data-act="dup" title="Dupliquer">${ICON.dup}</button>
      <button class="icon-btn" data-act="export" title="Exporter (.json)">${ICON.download}</button>
      <button class="icon-btn" data-act="del" title="Supprimer">${ICON.trash}</button>
    </div>
  </article>`;
}

function newQuizDialog() {
  const d = document.createElement('dialog');
  d.className = 'modal';
  d.innerHTML = `<form method="dialog">
    <h2>Nouveau quiz</h2>
    <label class="field"><span>Titre</span><input name="title" required maxlength="80" placeholder="Ex. Le grand quiz de fin d'année" autofocus></label>
    <div class="field"><span>Nombre de questions</span>
      <div class="stepper"><button type="button" data-s="-1">−</button><input name="n" type="number" min="1" max="100" value="10"><button type="button" data-s="1">+</button></div>
    </div>
    <div class="presets">${[5, 10, 15, 20].map((n) => `<button type="button" class="chip" data-p="${n}">${n}</button>`).join('')}</div>
    <div class="row end"><button type="button" class="btn ghost" data-close>Annuler</button><button class="btn primary" value="ok">Créer le quiz</button></div>
  </form>`;
  document.body.append(d);
  d.showModal();
  const n = d.querySelector('[name=n]');
  const clamp = (v) => Math.max(1, Math.min(100, Math.round(+v) || 1));
  d.addEventListener('click', (e) => {
    const t = e.target;
    if (t.dataset.s) n.value = clamp(+n.value + +t.dataset.s);
    if (t.dataset.p) n.value = t.dataset.p;
    if ('close' in t.dataset) d.close('cancel');
  });
  d.addEventListener('close', async () => {
    if (d.returnValue === 'ok') {
      const q = S.newQuiz(d.querySelector('[name=title]').value.trim() || 'Nouveau quiz', clamp(n.value));
      await S.saveQuiz(q);
      location.hash = `#/edit/${q.id}`;
    }
    d.remove();
  });
}

async function exportQ(id) {
  const q = await S.getQuiz(id);
  const blob = new Blob([await S.exportQuiz(q)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(q.title || 'quiz').toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')}.quizlive.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function launch(id) {
  if (quiz?.id === id) await commit();
  const q = await S.getQuiz(id);
  const iss = S.issues(q);
  if (iss.length && !confirm(`${iss.length} question(s) incomplète(s) (n° ${iss.map((x) => x.i + 1).join(', ')}). Lancer quand même ?`)) return;
  location.href = `host.html?quiz=${encodeURIComponent(id)}`;
}

/* ───────────── Éditeur ───────────── */
function renderEditor() {
  const y = window.scrollY;
  app.innerHTML = topbar(`
    <a class="btn ghost sm" href="#">${ICON.back} Mes quiz</a>
    <input class="title-input" data-f="title" value="${esc(quiz.title)}" placeholder="Titre du quiz" aria-label="Titre du quiz" maxlength="80">
    <span class="save-state" id="ss">Enregistré</span>
    <button class="btn primary" data-act="launch">${ICON.play} Lancer</button>`) + `
  <main class="wrap editor">
    ${quiz.questions.map(qHTML).join('')}
    <button class="add-q" data-act="addq">+ Ajouter une question</button>
  </main>`;
  window.scrollTo(0, y);
  hydrateMedia();
}

function qHTML(qq, i) {
  const n = quiz.questions.length;
  const mt = qq.media?.type || 'none';
  return `<section class="qe ${S.questionIssues(qq).length ? 'incomplete' : ''}" data-i="${i}">
    <div class="qe-head">
      <span class="qnum">${i + 1}</span>
      <span class="qe-label">Question ${i + 1} <small class="muted">/ ${n}</small></span>
      <span class="spacer"></span>
      <label class="mini" title="Temps pour répondre">Temps <select data-f="time">${TIMES.map((t) => `<option value="${t}" ${t === qq.time ? 'selected' : ''}>${t} s</option>`).join('')}</select></label>
      <label class="mini" title="Points">
        <select data-f="points">${POINTS.map(([v, l]) => `<option value="${v}" ${v === qq.points ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <span class="tools">
        <button class="icon-btn" data-act="up" ${i === 0 ? 'disabled' : ''} title="Monter">${ICON.up}</button>
        <button class="icon-btn" data-act="down" ${i === n - 1 ? 'disabled' : ''} title="Descendre">${ICON.down}</button>
        <button class="icon-btn" data-act="dupq" title="Dupliquer">${ICON.dup}</button>
        <button class="icon-btn" data-act="delq" ${n === 1 ? 'disabled' : ''} title="Supprimer">${ICON.trash}</button>
      </span>
    </div>
    <textarea data-f="text" rows="2" maxlength="200" placeholder="Écris ta question…">${esc(qq.text)}</textarea>
    <div class="seg media-seg">${MEDIA_TYPES.map(([t, l, ic]) => `<button class="${mt === t ? 'on' : ''}" data-act="mtype" data-type="${t}">${ic}<span>${l}</span></button>`).join('')}</div>
    ${qq.media ? mediaHTML(qq.media, 'media') : ''}
    ${mt === 'video' ? `<div class="video-note">${ICON.video}<span>La vidéo est lue en entier sur le grand écran, puis les réponses s'affichent et le temps démarre.</span></div>
    <div class="answer-media"><span class="am-label">Vidéo réponse <small class="muted">(optionnelle, proposée après la révélation)</small></span>
      ${qq.answerMedia ? mediaHTML(qq.answerMedia, 'answerMedia') : `<button class="btn sm ghost" data-act="addamedia">+ Ajouter une vidéo réponse</button>`}</div>` : ''}
    <div class="ans-head">
      <span class="muted">Réponses · coche la bonne</span>
      <div class="seg">${[2, 3, 4].map((k) => `<button class="${qq.answers.length === k && !qq.tf ? 'on' : ''}" data-act="count" data-n="${k}">${k} choix</button>`).join('')}
        <button class="${qq.tf ? 'on' : ''}" data-act="tf">Vrai / Faux</button></div>
    </div>
    <div class="answers">${qq.answers.map((a, j) => `
      <div class="ans ${qq.correct === j ? 'is-correct' : ''}" style="--c:${COLORS[j]}">
        <span class="ans-shape">${shape(j)}</span>
        <input data-f="ans" data-j="${j}" value="${esc(a.text)}" maxlength="80" placeholder="Réponse ${j + 1}">
        <button class="check" data-act="correct" data-j="${j}" title="Bonne réponse" aria-pressed="${qq.correct === j}">${ICON.check}</button>
      </div>`).join('')}
    </div>
  </section>`;
}

function mediaHTML(m, slot) {
  if (!m.id && !m.url) {
    return `<div class="media-pick" data-slot="${slot}">
      <label class="drop" data-drop>${ICON[m.type]}<span>Glisse ${LABEL[m.type]} ici ou <u>parcours tes fichiers</u></span>
        <input type="file" accept="${ACCEPT[m.type]}" data-f="file" hidden></label>
      <div class="row nowrap"><input data-f="murl" placeholder="…ou colle une URL (https://…)">
      ${slot === 'answerMedia' ? `<button class="btn sm ghost" data-act="mremove">Annuler</button>` : ''}</div>
    </div>`;
  }
  return `<div class="media-prev" data-slot="${slot}">
    <div class="mp ${m.type === 'audio' ? 'is-audio' : ''}" data-media="${esc(JSON.stringify(m))}"></div>
    <div class="mp-actions">
      <label class="btn sm ghost">Remplacer<input type="file" accept="${ACCEPT[m.type]}" data-f="file" hidden></label>
      <button class="btn sm ghost" data-act="${slot === 'answerMedia' ? 'mremove' : 'mclear'}">Retirer</button>
    </div>
  </div>`;
}
const slotOf = (el) => el.closest('[data-slot]')?.dataset.slot || 'media';

async function hydrateMedia() {
  for (const el of $$('.mp[data-media]')) {
    const m = JSON.parse(el.dataset.media);
    let url = m.url;
    if (!url && m.id) {
      if (!urlCache.has(m.id)) urlCache.set(m.id, await S.mediaURL(m));
      url = urlCache.get(m.id);
    }
    if (!url) { el.innerHTML = '<span class="muted">Média introuvable</span>'; continue; }
    el.innerHTML = m.type === 'image' ? `<img src="${esc(url)}" alt="">`
      : m.type === 'video' ? `<video src="${esc(url)}" controls muted playsinline preload="metadata"></video>`
      : `<audio src="${esc(url)}" controls preload="metadata"></audio>`;
  }
}

function schedule() {
  const ss = $('#ss');
  if (ss) ss.textContent = 'Enregistrement…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(commit, 500);
}
async function commit() {
  clearTimeout(saveTimer);
  if (!quiz) return;
  await S.saveQuiz(quiz);
  const ss = $('#ss');
  if (ss) ss.textContent = 'Enregistré ✓';
}

async function setFile(qq, file, slot = 'media') {
  const t = (file.type || '').split('/')[0];
  if (!['image', 'video', 'audio'].includes(t)) return toast('Format non reconnu');
  if (slot === 'answerMedia' && t !== 'video') return toast('La réponse doit être une vidéo');
  if (qq[slot]?.id) S.deleteMedia(qq[slot].id);
  qq[slot] = { type: t, id: await S.putMedia(file), url: '' };
  if (slot === 'media' && t !== 'video' && qq.answerMedia) { if (qq.answerMedia.id) S.deleteMedia(qq.answerMedia.id); qq.answerMedia = null; }
  await commit();
  renderEditor();
}

/* ───────────── Événements ───────────── */
app.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  const card = b.closest('[data-id]');
  const sec = b.closest('.qe');
  const i = sec ? +sec.dataset.i : -1;
  const qq = i >= 0 ? quiz.questions[i] : null;

  switch (act) {
    case 'new': return newQuizDialog();
    case 'edit': location.hash = `#/edit/${card.dataset.id}`; return;
    case 'launch': return launch(card ? card.dataset.id : quiz.id);
    case 'dup': await S.duplicateQuiz(await S.getQuiz(card.dataset.id)); toast('Quiz dupliqué'); return renderList();
    case 'export': return exportQ(card.dataset.id);
    case 'del': {
      const q = await S.getQuiz(card.dataset.id);
      if (confirm(`Supprimer « ${q.title} » ? C'est définitif.`)) { await S.deleteQuiz(q.id); renderList(); }
      return;
    }
    case 'addq':
      quiz.questions.push(S.newQuestion());
      await commit(); renderEditor();
      $$('.qe').at(-1).scrollIntoView({ behavior: 'smooth', block: 'center' });
      $$('.qe').at(-1).querySelector('textarea').focus({ preventScroll: true });
      return;
    case 'up': case 'down': {
      const j = act === 'up' ? i - 1 : i + 1;
      [quiz.questions[i], quiz.questions[j]] = [quiz.questions[j], quiz.questions[i]];
      break;
    }
    case 'dupq': quiz.questions.splice(i + 1, 0, await S.duplicateQuestion(qq)); break;
    case 'delq':
      if (!confirm(`Supprimer la question ${i + 1} ?`)) return;
      for (const k of S.SLOTS) if (qq[k]?.id) S.deleteMedia(qq[k].id);
      quiz.questions.splice(i, 1);
      break;
    case 'mtype': {
      const t = b.dataset.type;
      if (t === 'none') { if (qq.media?.id) S.deleteMedia(qq.media.id); qq.media = null; }
      else if (qq.media?.type !== t) { if (qq.media?.id) S.deleteMedia(qq.media.id); qq.media = { type: t, id: null, url: '' }; }
      if (t !== 'video' && qq.answerMedia) { if (qq.answerMedia.id) S.deleteMedia(qq.answerMedia.id); qq.answerMedia = null; }
      break;
    }
    case 'addamedia': qq.answerMedia = { type: 'video', id: null, url: '' }; break;
    case 'mremove':
      if (qq.answerMedia?.id) S.deleteMedia(qq.answerMedia.id);
      qq.answerMedia = null;
      break;
    case 'mclear':
      if (qq.media.id) S.deleteMedia(qq.media.id);
      qq.media = { type: qq.media.type, id: null, url: '' };
      break;
    case 'count': {
      const n = +b.dataset.n;
      if (qq.tf) { qq.answers = []; qq.tf = false; }
      while (qq.answers.length < n) qq.answers.push({ text: '' });
      qq.answers.length = n;
      if (qq.correct >= n) qq.correct = 0;
      break;
    }
    case 'tf':
      qq.tf = true;
      qq.answers = [{ text: 'Vrai' }, { text: 'Faux' }];
      if (qq.correct > 1) qq.correct = 0;
      break;
    case 'correct': qq.correct = +b.dataset.j; break;
    default: return;
  }
  await commit();
  renderEditor();
});

app.addEventListener('input', (e) => {
  const f = e.target.dataset.f;
  if (!f || !quiz) return;
  if (f === 'title') { quiz.title = e.target.value; return schedule(); }
  const sec = e.target.closest('.qe');
  if (!sec) return;
  const qq = quiz.questions[+sec.dataset.i];
  if (f === 'text') qq.text = e.target.value;
  else if (f === 'ans') qq.answers[+e.target.dataset.j].text = e.target.value;
  else return;
  sec.classList.toggle('incomplete', S.questionIssues(qq).length > 0);
  schedule();
});

app.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.id === 'imp' && t.files[0]) {
    try { const q = await S.importQuiz(await t.files[0].text()); toast(`« ${q.title} » importé`); renderList(); }
    catch { toast('Fichier invalide'); }
    return;
  }
  const f = t.dataset.f;
  const sec = t.closest('.qe');
  if (!f || !sec) return;
  const qq = quiz.questions[+sec.dataset.i];
  if (f === 'time') { qq.time = +t.value; await commit(); }
  else if (f === 'points') { qq.points = +t.value; await commit(); }
  else if (f === 'file' && t.files[0]) await setFile(qq, t.files[0], slotOf(t));
  else if (f === 'murl') {
    const v = t.value.trim();
    if (/^https?:\/\//.test(v)) { qq[slotOf(t)].url = v; await commit(); renderEditor(); }
    else if (v) toast('L’URL doit commencer par https://');
  }
});

app.addEventListener('dragover', (e) => {
  const d = e.target.closest('[data-drop]');
  if (d) { e.preventDefault(); d.classList.add('over'); }
});
app.addEventListener('dragleave', (e) => e.target.closest('[data-drop]')?.classList.remove('over'));
app.addEventListener('drop', async (e) => {
  const d = e.target.closest('[data-drop]');
  if (!d) return;
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) await setFile(quiz.questions[+d.closest('.qe').dataset.i], file, slotOf(d));
});
window.addEventListener('beforeunload', () => { if (quiz) S.saveQuiz(quiz); });
