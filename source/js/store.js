// Stockage local des quiz et des médias (IndexedDB, sur la machine admin/host)
import { uid } from './ui.js';

let dbp = null;
function open() {
  return (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open('quizlive', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('quizzes', { keyPath: 'id' });
      r.result.createObjectStore('media', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}
async function tx(store, mode, fn) {
  const d = await open();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
  });
}

export const listQuizzes = async () => (await tx('quizzes', 'readonly', (s) => s.getAll())).sort((a, b) => b.updatedAt - a.updatedAt);
export const getQuiz = (id) => tx('quizzes', 'readonly', (s) => s.get(id));
export const saveQuiz = (q) => { q.updatedAt = Date.now(); return tx('quizzes', 'readwrite', (s) => s.put(q)); };
export const getMedia = (id) => tx('media', 'readonly', (s) => s.get(id));
export const deleteMedia = (id) => tx('media', 'readwrite', (s) => s.delete(id));
export async function putMedia(blob) {
  const id = uid(14);
  await tx('media', 'readwrite', (s) => s.put({ id, blob, type: blob.type, name: blob.name || '' }));
  return id;
}

export async function deleteQuiz(id) {
  const q = await getQuiz(id);
  if (q) for (const qq of q.questions) for (const k of SLOTS) if (qq[k]?.id) await deleteMedia(qq[k].id);
  return tx('quizzes', 'readwrite', (s) => s.delete(id));
}

// media : média de la question · answerMedia : vidéo réponse (questions vidéo)
export const SLOTS = ['media', 'answerMedia'];

export const newQuestion = () => ({
  id: uid(), text: '', media: null, answerMedia: null,
  answers: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
  correct: 0, time: 20, points: 1, tf: false,
});
export const newQuiz = (title, n) => ({ id: uid(), title, questions: Array.from({ length: n }, newQuestion), updatedAt: Date.now() });

export function questionIssues(qq) {
  const m = [];
  if (!qq.text.trim()) m.push('texte');
  if (qq.answers.some((a) => !a.text.trim())) m.push('réponses');
  if (qq.media && !qq.media.id && !qq.media.url) m.push('média');
  if (qq.answerMedia && !qq.answerMedia.id && !qq.answerMedia.url) m.push('vidéo réponse');
  return m;
}
export const issues = (q) => q.questions.map((qq, i) => ({ i, m: questionIssues(qq) })).filter((x) => x.m.length);

export async function mediaURL(media) {
  if (!media) return null;
  if (media.url) return media.url;
  if (media.id) { const m = await getMedia(media.id); return m ? URL.createObjectURL(m.blob) : null; }
  return null;
}

async function cloneMedia(qq) {
  for (const k of SLOTS) if (qq[k]?.id) { const m = await getMedia(qq[k].id); qq[k].id = m ? await putMedia(m.blob) : null; }
}
export async function duplicateQuestion(qq) {
  const c = structuredClone(qq);
  c.id = uid();
  await cloneMedia(c);
  return c;
}
export async function duplicateQuiz(q) {
  const c = structuredClone(q);
  c.id = uid();
  c.title = `${q.title} (copie)`;
  for (const qq of c.questions) { qq.id = uid(); await cloneMedia(qq); }
  await saveQuiz(c);
  return c;
}

const toDataURL = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
export async function exportQuiz(q) {
  const copy = structuredClone(q);
  for (const qq of copy.questions) {
    for (const k of SLOTS) {
      if (!qq[k]?.id) continue;
      const m = await getMedia(qq[k].id);
      if (m) qq[k].data = await toDataURL(m.blob);
      delete qq[k].id;
    }
  }
  return JSON.stringify({ format: 'quizlive', version: 1, quiz: copy });
}
export async function importQuiz(text) {
  const j = JSON.parse(text);
  const q = j.quiz || j;
  if (!q || !Array.isArray(q.questions)) throw new Error('Fichier invalide');
  q.id = uid();
  for (const qq of q.questions) {
    qq.id = uid();
    for (const k of SLOTS) {
      if (!qq[k]?.data) continue;
      const blob = await (await fetch(qq[k].data)).blob();
      qq[k].id = await putMedia(blob);
      delete qq[k].data;
    }
  }
  await saveQuiz(q);
  return q;
}
