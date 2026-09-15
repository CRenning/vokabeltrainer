import { getUser, handleAuthCallback, login } from 'https://esm.sh/@netlify/identity';

const LOCAL_STORAGE_KEY = 'mot-a-mot-vocabulary-v1';
const seedWords = [
  { id: 'welcome-1', unit: 1, french: 'bonjour', german: 'guten Tag', notes: 'Begrüßung' },
  { id: 'welcome-2', unit: 1, french: 'merci', german: 'danke', notes: '' },
  { id: 'welcome-3', unit: 2, french: 'la maison', german: 'das Haus', notes: 'Plural: les maisons' }
];

let words = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || 'null') || seedWords;
let remoteMode = false;
let selectedListUnit = 'all';
let pendingAction = null;
let admin = null;
let session = { answered: 0, correct: 0, current: null, wasChecked: false };

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHtml = (value = '') => value.replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const unitName = unit => `Unité ${unit}`;
const normalize = value => value.trim().toLocaleLowerCase('de-DE').replace(/[.!?;:,]/g, '').replace(/\s+/g, ' ');

async function api(path = '/api/words', options = {}) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const error = new Error(detail.error || 'Die Anfrage konnte nicht verarbeitet werden.');
    error.status = response.status;
    throw error;
  }
  return response.json();
}
async function loadWords() {
  try { const data = await api(); words = data.words; remoteMode = true; } catch (_) { remoteMode = false; }
  renderEverything();
}
function saveLocal() { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(words)); }

function switchView(name) {
  $$('.view').forEach(view => view.classList.toggle('active', view.id === name));
  $$('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.view === name));
  if (name === 'learn') renderLearn();
  if (name === 'add') renderList();
  if (name === 'home') renderOverview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function showToast(message) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2700);
}
function renderEverything() { renderOverview(); renderList(); if ($('#learn').classList.contains('active')) renderLearn(); }

function renderOverview() {
  const target = $('#unitOverview'); target.innerHTML = '';
  for (let unit = 1; unit <= 5; unit++) {
    const count = words.filter(word => word.unit === unit).length;
    const fragment = $('#unitCardTemplate').content.cloneNode(true);
    fragment.querySelector('.unit-label').textContent = unitName(unit);
    fragment.querySelector('.unit-count').textContent = `${count} ${count === 1 ? 'Wort' : 'Wörter'}`;
    fragment.querySelector('.unit-line i').style.width = `${Math.min(count * 20, 100)}%`;
    fragment.querySelector('.unit-card').addEventListener('click', () => { $('#learnUnit').value = unit; switchView('learn'); });
    target.append(fragment);
  }
  $('#totalCount').textContent = words.length;
}
function renderFilters() {
  $('#listFilters').innerHTML = ['all', 1, 2, 3, 4, 5].map(unit => `<button class="${selectedListUnit === String(unit) ? 'active' : ''}" data-filter="${unit}">${unit === 'all' ? 'Alle' : `U${unit}`}</button>`).join('');
  $$('[data-filter]').forEach(button => button.addEventListener('click', () => { selectedListUnit = button.dataset.filter; renderList(); }));
}
function renderList() {
  renderFilters();
  const shown = selectedListUnit === 'all' ? words : words.filter(word => word.unit === Number(selectedListUnit));
  const list = $('#vocabList');
  if (!shown.length) { list.innerHTML = '<div class="empty-list">Hier sind noch keine Vokabeln für diese Unité gespeichert.</div>'; return; }
  list.innerHTML = shown.map(word => `<div class="vocab-row"><span class="unit-tag">U${word.unit}</span><span class="vocab-word">${escapeHtml(word.french)}</span><span class="vocab-translation">${escapeHtml(word.german)}</span><span class="vocab-note">${escapeHtml(word.notes || '—')}</span><button class="delete" data-delete="${word.id}" aria-label="${escapeHtml(word.french)} löschen">×</button></div>`).join('');
  $$('[data-delete]').forEach(button => button.addEventListener('click', () => { const word = words.find(item => item.id === button.dataset.delete); requestAdmin(() => deleteWord(word)); }));
}
function selectedWords() { const unit = $('#learnUnit').value; return unit === 'all' ? words : words.filter(word => word.unit === Number(unit)); }
function newQuestion() {
  const choices = selectedWords(); if (!choices.length) return null;
  const candidates = choices.filter(word => word.id !== session.current?.word.id);
  const word = candidates[Math.floor(Math.random() * candidates.length)] || choices[0];
  const chosenDirection = $('#direction').value;
  session.current = { word, direction: chosenDirection === 'mixed' ? (Math.random() > .5 ? 'fr-de' : 'de-fr') : chosenDirection };
  session.wasChecked = false; return session.current;
}
function renderLearn() {
  const stage = $('#learnStage'); const available = selectedWords(); $('#totalCount').textContent = words.length;
  if (!available.length) {
    stage.innerHTML = '<div class="empty-learn"><span class="empty-icon">☼</span><h2>Hier ist es noch ganz still.</h2><p>Für diese Auswahl sind noch keine Vokabeln vorhanden. Wähle eine andere Unité oder füge welche hinzu.</p><button class="button primary" data-view="add">Vokabeln einpflegen <span>→</span></button></div>';
    stage.querySelector('[data-view]')?.addEventListener('click', () => switchView('add')); $('#sessionBar').hidden = true; return;
  }
  const current = newQuestion(); const frenchPrompt = current.direction === 'fr-de'; const prompt = frenchPrompt ? current.word.french : current.word.german;
  stage.innerHTML = `<div class="flashcard"><div class="question-meta"><span>${unitName(current.word.unit)}</span><span>${available.length} Wörter verfügbar</span></div><div class="prompt-label">${frenchPrompt ? 'Was heißt das auf Deutsch?' : 'Comment dit-on en français ?'}</div><div class="prompt-word">${escapeHtml(prompt)}</div><div class="answer-row"><input id="answer" autocomplete="off" placeholder="Deine Antwort" aria-label="Deine Antwort" /><button class="button primary" id="checkAnswer">Prüfen <span>→</span></button></div><div class="feedback" id="feedback" hidden></div><div class="card-actions" id="cardActions" hidden><button class="button secondary" id="nextQuestion">Nächstes Wort <span>→</span></button></div></div>`;
  $('#sessionBar').hidden = false; updateSession(); bindQuestion();
}
function bindQuestion() { const answer = $('#answer'); answer.focus(); $('#checkAnswer').addEventListener('click', checkAnswer); answer.addEventListener('keydown', event => { if (event.key === 'Enter') session.wasChecked ? renderLearn() : checkAnswer(); }); $('#nextQuestion').addEventListener('click', renderLearn); }
function checkAnswer() {
  if (session.wasChecked || !$('#answer').value.trim()) return;
  const expected = session.current.direction === 'fr-de' ? session.current.word.german : session.current.word.french;
  const correct = normalize($('#answer').value) === normalize(expected); session.wasChecked = true; session.answered++; if (correct) session.correct++;
  $('#answer').disabled = true; $('#checkAnswer').hidden = true;
  const feedback = $('#feedback'); feedback.hidden = false; feedback.className = `feedback ${correct ? 'correct' : 'wrong'}`;
  feedback.innerHTML = correct ? 'Très bien! Das war richtig. ✦' : `Fast! Die richtige Antwort ist:<span class="solution">${escapeHtml(expected)}</span>`;
  if (session.current.word.notes) feedback.innerHTML += `<small>Notiz: ${escapeHtml(session.current.word.notes)}</small>`;
  $('#cardActions').hidden = false; updateSession();
}
function updateSession() { $('#sessionStatus').textContent = `${session.answered} beantwortet`; $('#sessionCorrect').textContent = `${session.correct} richtig`; $('#progressFill').style.width = `${session.answered ? session.correct / session.answered * 100 : 0}%`; }

function requestAdmin(action) {
  if (!remoteMode || admin) return action();
  pendingAction = action; $('#authModal').hidden = false; $('#authError').hidden = true; $('#adminPassword').value = ''; setTimeout(() => $('#adminEmail').focus(), 0);
}
function closeAuth() { $('#authModal').hidden = true; pendingAction = null; }
async function submitWord(word) {
  try {
    if (remoteMode) words = (await api('/api/words', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(word) })).words;
    else { words.unshift({ ...word, id: String(Date.now()) }); saveLocal(); }
    $('#vocabForm').reset(); $('#unit').value = '1'; renderEverything(); showToast(`„${word.french}“ ist gespeichert.`);
  } catch (error) { if (error.status === 401) { admin = null; showToast('Bitte melde dich erneut als Admin an.'); } else showToast(error.message); }
}
async function deleteWord(word) {
  try {
    if (remoteMode) words = (await api('/api/words', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: word.id }) })).words;
    else { words = words.filter(item => item.id !== word.id); saveLocal(); }
    renderEverything(); showToast(`„${word.french}“ wurde gelöscht.`);
  } catch (error) { if (error.status === 401) { admin = null; showToast('Bitte melde dich erneut als Admin an.'); } else showToast(error.message); }
}

$('#vocabForm').addEventListener('submit', event => { event.preventDefault(); const word = { unit: Number($('#unit').value), french: $('#french').value.trim(), german: $('#german').value.trim(), notes: $('#notes').value.trim() }; if (word.french && word.german) requestAdmin(() => submitWord(word)); });
$('#authForm').addEventListener('submit', async event => {
  event.preventDefault(); const button = $('#authForm button[type="submit"]'); button.disabled = true;
  try { admin = await login($('#adminEmail').value.trim(), $('#adminPassword').value); const action = pendingAction; closeAuth(); action?.(); }
  catch (error) { $('#authError').textContent = error.message || 'Anmeldung fehlgeschlagen.'; $('#authError').hidden = false; }
  finally { button.disabled = false; }
});
$('#closeAuth').addEventListener('click', closeAuth);
$('#authModal').addEventListener('click', event => { if (event.target === $('#authModal')) closeAuth(); });
$$('[data-view]').forEach(element => element.addEventListener('click', event => { event.preventDefault(); switchView(element.dataset.view); }));
$('#learnUnit').addEventListener('change', renderLearn); $('#direction').addEventListener('change', renderLearn);
async function initializeAuth() { await handleAuthCallback(); admin = await getUser(); }
renderEverything(); initializeAuth().finally(loadWords);
