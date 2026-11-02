// Écran de jeu (grand écran) : lobby, questions, résultats, classement, podium
import { getDB, MODE } from './net.js';
import { LEADERBOARD_EVERY } from './config.js';
import * as S from './store.js';
import { COLORS, shape, esc, $, decor, roomCode, ICON, logo, star, avatar } from './ui.js';

decor();
const stage = $('#stage');
const bar = $('#bar');

const quizId = new URLSearchParams(location.search).get('quiz');
const quiz = quizId ? await S.getQuiz(quizId) : null;
if (!quiz) {
  stage.innerHTML = `<div class="center-msg">${star('scheme', 'msg-star')}<h1>Quiz introuvable</h1><a class="btn primary" href="index.html">Retour aux quiz</a></div>`;
} else {
  await main();
}

async function main() {
  const db = await getDB();
  const code = roomCode();
  const R = `rooms/${code}`;
  const total = quiz.questions.length;
  const joinURL = new URL(`play.html?room=${code}`, location.href).href;
  const media = await Promise.all(quiz.questions.map((q) => S.mediaURL(q.media)));
  const answerMedia = await Promise.all(quiz.questions.map((q) => S.mediaURL(q.answerMedia)));

  let players = {};
  let phase = 'lobby';
  let qi = -1;
  let answers = {};
  let unsubAns = null;
  let tick = null;
  let startedAt = 0;
  let closing = false;
  let primary = null;
  let pod = { seq: [], step: 0 };
  const seen = new Set();

  if (MODE === 'local') await db.remove('rooms');
  await db.set(R, { state: { phase: 'lobby', title: quiz.title, total }, createdAt: db.now() });
  db.on(`${R}/players`, (v) => {
    players = v || {};
    if (phase === 'lobby') renderChips();
    if (phase === 'question') checkAllAnswered();
    setBar();
  });

  const nPlayers = () => Object.keys(players).length;
  const ranked = () => Object.entries(players).sort((a, b) => (b[1].score || 0) - (a[1].score || 0));
  const isLast = () => qi + 1 >= total;
  const leaderboardDue = () => (qi + 1) % LEADERBOARD_EVERY === 0;

  /* ───────────── Barre de contrôle ───────────── */
  function action() {
    const n = nPlayers();
    switch (phase) {
      case 'lobby': return ['Lancer la partie', () => startQuestion(0), n === 0];
      case 'video': return ['Passer la vidéo', () => startAnswers(qi)];
      case 'question': return ['Terminer la question', closeQuestion];
      case 'reveal':
        return isLast() ? ['Résultats', showResults]
          : leaderboardDue() ? ['Classement', showLeaderboard]
          : ['Question suivante', () => startQuestion(qi + 1)];
      case 'leaderboard': return ['Question suivante', () => startQuestion(qi + 1)];
      case 'end': {
        const k = pod.seq[pod.step];
        return k === undefined ? ['Nouvelle partie', () => location.reload()]
          : [`Révéler la ${['1re', '2e', '3e'][k]} place`, revealPodium];
      }
    }
  }

  function setBar() {
    const n = nPlayers();
    const [label, fn, disabled] = action();
    primary = disabled ? null : fn;
    const showAV = phase === 'reveal' && answerMedia[qi];
    bar.innerHTML = `
      <div class="bar-l">${logo()}<span class="bar-brand">Lutèce <b>Quiz</b></span><span class="bar-code">${code}</span>
        <span class="muted">${n} joueur${n > 1 ? 's' : ''}${!['lobby', 'end'].includes(phase) ? ` · Q${qi + 1}/${total}` : ''}</span></div>
      <div class="bar-r">
        <button class="icon-btn" id="fs" title="Plein écran (F)">${ICON.full}</button>
        <a class="btn ghost sm" href="index.html" id="quit">Quitter</a>
        ${showAV ? `<button class="btn" id="av">${ICON.video} Vidéo réponse</button>` : ''}
        <button class="btn primary" id="go" ${disabled ? 'disabled' : ''} title="Espace / Entrée">${label} ${ICON.next}</button>
      </div>`;
    $('#go').onclick = () => primary?.();
    $('#fs').onclick = toggleFS;
    $('#av')?.addEventListener('click', showAnswerVideo);
    $('#quit').onclick = (e) => {
      if (phase !== 'end' && phase !== 'lobby' && !confirm('Quitter la partie en cours ?')) { e.preventDefault(); return; }
      db.update(`${R}/state`, { phase: 'closed' });
    };
  }
  const toggleFS = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}));
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.code === 'Space' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); primary?.(); }
    if (e.key === 'f' || e.key === 'F') toggleFS();
  });

  /* ───────────── Lobby ───────────── */
  function renderLobby() {
    const shortURL = joinURL.replace(/^https?:\/\//, '').replace(/\?.*$/, '');
    stage.innerHTML = `<div class="lobby">
      <div class="lobby-join">
        <p class="eyebrow">Scanne pour jouer</p>
        <div class="qr" id="qr"></div>
        <p class="muted">ou va sur <b>${esc(shortURL)}</b><br>avec le code</p>
        <div class="room-code">${code.split('').map((c) => `<span>${c}</span>`).join('')}</div>
        ${MODE === 'local' ? `<div class="demo-note">Mode démo local : les téléphones ne peuvent pas rejoindre.<button class="btn sm" id="testp">Ouvrir un joueur test</button></div>` : ''}
      </div>
      <div class="lobby-side">
        <h1 class="lobby-title">${esc(quiz.title)}</h1>
        <div class="pcount" id="pcount"></div>
        <div class="chips" id="chips"></div>
        ${star('happy', 'lobby-star')}
      </div>
    </div>`;
    try {
      const qr = qrcode(0, 'M');
      qr.addData(joinURL);
      qr.make();
      $('#qr').innerHTML = qr.createSvgTag({ cellSize: 8, margin: 0, scalable: true }).replace(/fill="black"/g, 'fill="#2e0e30"');
    } catch { $('#qr').remove(); }
    $('#testp')?.addEventListener('click', () => window.open(joinURL, '_blank'));
    renderChips();
    setBar();
  }

  function renderChips() {
    const chips = $('#chips');
    if (!chips) return;
    const list = Object.entries(players).sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
    const n = list.length;
    $('#pcount').innerHTML = `<b>${n}</b> joueur${n > 1 ? 's' : ''} connecté${n > 1 ? 's' : ''}`;
    chips.innerHTML = n ? list.map(([pid, p]) => {
      const isNew = !seen.has(pid);
      seen.add(pid);
      return `<button class="chip-p ${isNew ? 'new' : ''}" data-kick="${pid}" title="Retirer ce joueur">${avatar(p.avatar)}<span>${esc(p.name)}</span>${ICON.x}</button>`;
    }).join('') : `<p class="waiting">En attente des joueurs…</p>`;
    chips.onclick = (e) => {
      const b = e.target.closest('[data-kick]');
      if (b && confirm(`Retirer ${players[b.dataset.kick]?.name} de la partie ?`)) db.remove(`${R}/players/${b.dataset.kick}`);
    };
  }

  /* ───────────── Question ───────────── */
  // Question vidéo : on regarde d'abord la vidéo en entier, puis les réponses s'affichent.
  function startQuestion(i) {
    const q = quiz.questions[i];
    if (q.media?.type === 'video' && media[i]) playQuestionVideo(i);
    else startAnswers(i);
  }

  async function playQuestionVideo(i) {
    qi = i; phase = 'video';
    const q = quiz.questions[i];
    await db.set(`${R}/state`, { phase: 'video', q: i, total, text: q.text });
    renderQuestion(q, 'video');
    setBar();
    const v = $('#mv');
    v.onended = () => { if (phase === 'video' && qi === i) startAnswers(i); };
    v.onerror = () => { if (phase === 'video' && qi === i) startAnswers(i); };
    v.play().catch(() => {
      // Autoplay bloqué : on attend un clic sur la vidéo
      $('#qsm').insertAdjacentHTML('beforeend', `<button class="play-overlay" id="po">${ICON.play}</button>`);
      $('#po').onclick = () => { $('#po').remove(); v.play(); };
    });
  }

  async function startAnswers(i) {
    $('#mv')?.pause();
    qi = i; phase = 'question'; closing = false; answers = {};
    primary = null;
    const q = quiz.questions[i];
    unsubAns?.();
    await db.remove(`${R}/answers/${i}`);
    await db.set(`${R}/state`, {
      phase: 'question', q: i, total, text: q.text, choices: q.answers.map((a) => a.text),
      duration: q.time, points: q.points, startedAt: db.now(),
    });
    startedAt = await db.get(`${R}/state/startedAt`);
    renderQuestion(q, 'answers');
    setBar();
    unsubAns = db.on(`${R}/answers/${i}`, (v) => {
      answers = v || {};
      const ac = $('#ac');
      if (ac) ac.textContent = validCount();
      checkAllAnswered();
    });
    const t0 = performance.now();
    const dur = q.time * 1000;
    clearInterval(tick);
    tick = setInterval(() => {
      const left = Math.max(0, dur - (performance.now() - t0));
      updateTimer(left / 1000, q.time);
      if (left <= 0) closeQuestion();
    }, 100);
    $('#ma')?.play().catch(() => {});
  }

  const validCount = () => Object.keys(answers).filter((p) => players[p]).length;
  function checkAllAnswered() {
    const n = nPlayers();
    if (phase !== 'question' || closing || !n || validCount() < n) return;
    const at = qi;
    setTimeout(() => { if (qi === at) closeQuestion(); }, 700);
  }

  function mediaBlock(q, mode) {
    const m = q.media;
    const url = media[qi];
    if (!m || !url) return star('point', 'qs-star');
    if (m.type === 'image') return `<img src="${esc(url)}" alt="">`;
    if (m.type === 'video') return mode === 'video' ? `<video src="${esc(url)}" id="mv" playsinline></video>` : star('point', 'qs-star');
    return `<div class="audio-viz"><div class="eq"><i></i><i></i><i></i><i></i><i></i></div><audio src="${esc(url)}" id="ma"></audio></div>`;
  }

  function renderQuestion(q, mode) {
    const badge = q.points === 2 ? '<span class="pill gold">Points doubles</span>' : q.points === 0 ? '<span class="pill">Sans points</span>' : '';
    const answersMode = mode === 'answers';
    stage.innerHTML = `<div class="qs ${answersMode ? '' : 'video-mode'}" id="qs">
      <div class="qs-top"><span class="pill">Question ${qi + 1} / ${total}</span>${badge}${answersMode ? '' : '<span class="pill">Regardez bien…</span>'}</div>
      <h1 class="qs-text">${esc(q.text)}</h1>
      <div class="qs-mid">
        ${answersMode ? `<div class="timer" id="timer"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="track"/><circle cx="50" cy="50" r="44" class="prog" id="tprog"/></svg><span id="tnum">${q.time}</span></div>` : ''}
        <div class="qs-media" id="qsm">${mediaBlock(q, mode)}</div>
        ${answersMode ? `<div class="acount"><b id="ac">0</b><span>réponses</span></div>` : ''}
      </div>
      ${answersMode ? `<div class="tiles n${q.answers.length}">${q.answers.map((a, j) => `
        <div class="tile" style="--c:${COLORS[j]}" data-j="${j}">${shape(j)}<span>${esc(a.text)}</span></div>`).join('')}
      </div>` : ''}
    </div>`;
  }

  function updateTimer(left, totalSec) {
    const p = $('#tprog');
    if (!p) return;
    p.style.strokeDashoffset = 276.5 * (1 - left / totalSec);
    $('#tnum').textContent = Math.ceil(left);
    $('#timer').classList.toggle('hurry', left <= 5 && left > 0);
  }

  async function closeQuestion() {
    if (phase !== 'question' || closing) return;
    closing = true;
    clearInterval(tick);
    unsubAns?.(); unsubAns = null;
    $('#ma')?.pause();
    const q = quiz.questions[qi];
    answers = (await db.get(`${R}/answers/${qi}`)) || answers;

    const counts = q.answers.map(() => 0);
    const res = {};
    for (const [pid, p] of Object.entries(players)) {
      const a = answers[pid];
      if (a && a.choice >= 0 && a.choice < counts.length) counts[a.choice]++;
      const ok = !!a && a.choice === q.correct;
      let gained = 0;
      if (ok && q.points) {
        const el = Math.max(0, ((a.at ?? startedAt) - startedAt) / 1000);
        gained = Math.round(1000 * (1 - Math.min(1, el / q.time) / 2)) * q.points;
      }
      res[pid] = { score: (p.score || 0) + gained, gained, ok, answered: !!a, prevRank: p.last?.rank ?? null };
    }
    const order = Object.keys(res).sort((a, b) => res[b].score - res[a].score);
    const upd = {};
    order.forEach((pid, k) => {
      const r = res[pid];
      upd[`players/${pid}/score`] = r.score;
      upd[`players/${pid}/last`] = { q: qi, ok: r.ok, gained: r.gained, answered: r.answered, rank: k + 1, prevRank: r.prevRank };
    });
    if (order.length) await db.update(R, upd);
    await db.set(`${R}/state`, { phase: 'reveal', q: qi, total, text: q.text, choices: q.answers.map((a) => a.text), correct: q.correct });
    phase = 'reveal';
    renderReveal(q, counts);
    setBar();
  }

  function renderReveal(q, counts) {
    const qs = $('#qs');
    qs.classList.add('revealed');
    $('#timer').classList.add('done');
    $('#timer').classList.remove('hurry');
    qs.querySelectorAll('.tile').forEach((t) => {
      const ok = +t.dataset.j === q.correct;
      t.classList.add(ok ? 'right' : 'wrong');
      if (ok) t.insertAdjacentHTML('beforeend', `<span class="ok-badge">${ICON.check}</span>`);
    });
    const max = Math.max(1, ...counts);
    $('#qsm').innerHTML = `<div class="bars">${counts.map((c, j) => `
      <div class="bar-col ${j === q.correct ? 'right' : ''}" style="--c:${COLORS[j]}">
        <b>${c}</b><div class="bar-fill" style="--h:${c / max}"></div>
        <span class="bar-shape">${shape(j)}${j === q.correct ? ICON.check : ''}</span>
      </div>`).join('')}</div>`;
  }

  function showAnswerVideo() {
    const url = answerMedia[qi];
    if (!url) return;
    $('#qs').classList.add('show-av');
    $('#qsm').innerHTML = `<video src="${esc(url)}" id="avid" playsinline controls></video>`;
    const v = $('#avid');
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    $('#av')?.remove();
  }

  /* ───────────── Classement provisoire (top 10) ───────────── */
  function showLeaderboard() {
    $('#avid')?.pause();
    phase = 'leaderboard';
    db.set(`${R}/state`, { phase: 'leaderboard', q: qi, total });
    const list = ranked().slice(0, 10);
    stage.innerHTML = `<div class="lb">
      <div class="lb-head">${star('point', 'lb-star')}<h1 class="big-title">Classement</h1></div>
      ${list.length ? `<ol class="lb-list ${list.length > 5 ? 'two-cols' : ''}">${list.map(([, p], k) => {
        const up = p.last?.prevRank && p.last.rank < p.last.prevRank;
        return `<li style="--i:${k}" class="${k === 0 ? 'first' : ''}">
          <span class="lb-rank">${k + 1}</span>
          ${avatar(p.avatar, 'lb-av')}
          <span class="lb-name">${esc(p.name)}${up ? '<em>▲</em>' : ''}</span>
          <span class="lb-score">${p.score || 0}</span>
        </li>`;
      }).join('')}</ol>` : `<p class="muted">Personne n'a joué…</p>`}
    </div>`;
    setBar();
  }

  /* ───────────── Résultats : podium progressif ───────────── */
  function showResults() {
    $('#avid')?.pause();
    phase = 'end';
    const list = ranked();
    const top = list.slice(0, 3);
    pod = { seq: [2, 1, 0].filter((k) => top[k]), step: 0 };
    db.set(`${R}/state`, { phase: 'end', total, final: pod.seq.length === 0 });
    stage.innerHTML = `<div class="end">
      <div class="end-head">${star('scheme', 'end-star')}<h1 class="big-title">Podium</h1></div>
      <div class="podium">${[1, 0, 2].map((k) => !top[k] ? '' : `
        <div class="pod p${k + 1}" id="pod${k}">
          <div class="pod-who">${avatar(top[k][1].avatar, 'pod-av')}
            <div class="pod-name">${esc(top[k][1].name)}</div>
            <div class="pod-score">${top[k][1].score || 0} pts</div></div>
          <div class="pod-block"><span>${k + 1}</span></div>
        </div>`).join('')}</div>
      ${list.length > 3 ? `<ol class="rest" id="rest">${list.slice(3, 10).map(([, p], k) => `<li>${avatar(p.avatar)}${k + 4}. ${esc(p.name)}<b>${p.score || 0}</b></li>`).join('')}</ol>` : ''}
    </div>
    <div class="confetti" id="confetti"></div>`;
    setBar();
  }

  function revealPodium() {
    const k = pod.seq[pod.step++];
    if (k === undefined) return;
    $(`#pod${k}`).classList.add('shown');
    const done = pod.step >= pod.seq.length;
    if (k === 0) {
      setTimeout(() => burst($(`#pod0 .pod-block`)), 500);
      const s = $('.end-star');
      s.src = 'img/star-happy.png';
      s.classList.add('cheer');
    }
    if (done) {
      setTimeout(() => $('#rest')?.classList.add('shown'), 1600);
      db.update(`${R}/state`, { final: true });
    }
    setBar();
  }

  function burst(anchor) {
    const box = $('#confetti');
    const r = anchor.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top;
    const pal = [...COLORS, '#ffcf00', '#ffffff'];
    let html = '';
    for (let i = 0; i < 140; i++) {
      const a = Math.random() * Math.PI - Math.PI;
      const v = 25 + Math.random() * 45;
      html += `<i class="b" style="left:${x}px;top:${y}px;background:${pal[i % pal.length]};--dx:${Math.cos(a) * v}vw;--dy:${Math.sin(a) * v}vh;--r:${Math.random() * 900 - 450}deg;animation-duration:${1.6 + Math.random() * 1.4}s"></i>`;
    }
    for (let i = 0; i < 60; i++) {
      html += `<i style="left:${Math.random() * 100}%;background:${pal[i % pal.length]};animation-duration:${3 + Math.random() * 3}s;animation-delay:${1 + Math.random() * 4}s"></i>`;
    }
    box.innerHTML = html;
  }

  renderLobby();
}
