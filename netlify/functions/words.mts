import { getDeployStore, getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';
import type { Config } from '@netlify/functions';

type VocabWord = { id: string; unit: number; french: string; german: string; notes: string };

const initialWords: VocabWord[] = [
  { id: 'welcome-1', unit: 1, french: 'bonjour', german: 'guten Tag', notes: 'Begrüßung' },
  { id: 'welcome-2', unit: 1, french: 'merci', german: 'danke', notes: '' },
  { id: 'welcome-3', unit: 2, french: 'la maison', german: 'das Haus', notes: 'Plural: les maisons' }
];
const response = (body: object, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const isAdmin = (user: any) => user?.app_metadata?.roles?.includes('admin');
const store = () => Netlify.context?.deploy.context === 'production'
  ? getStore({ name: 'vocabulary', consistency: 'strong' })
  : getDeployStore({ name: 'vocabulary', consistency: 'strong' });

async function readWords(): Promise<VocabWord[]> {
  const stored = await store().get('words', { type: 'json' });
  return Array.isArray(stored) ? stored as VocabWord[] : initialWords;
}
async function writeWords(words: VocabWord[]) { await store().setJSON('words', words); }
function validWord(word: any): word is Omit<VocabWord, 'id'> {
  return word && Number.isInteger(word.unit) && word.unit >= 1 && word.unit <= 5 && typeof word.french === 'string' && word.french.trim() && typeof word.german === 'string' && word.german.trim();
}

export default async (request: Request) => {
  if (request.method === 'GET') return response({ words: await readWords() });
  if (!['POST', 'DELETE'].includes(request.method)) return response({ error: 'Methode nicht erlaubt.' }, 405);

  const user = await getUser();
  if (!user) return response({ error: 'Bitte melde dich an.' }, 401);
  if (!isAdmin(user)) return response({ error: 'Dieses Konto darf keine Vokabeln verwalten.' }, 403);

  const body = await request.json().catch(() => null);
  const words = await readWords();
  if (request.method === 'POST') {
    if (!validWord(body)) return response({ error: 'Unvollständige oder ungültige Vokabel.' }, 400);
    const word: VocabWord = { id: crypto.randomUUID(), unit: body.unit, french: body.french.trim(), german: body.german.trim(), notes: typeof body.notes === 'string' ? body.notes.trim() : '' };
    const next = [word, ...words]; await writeWords(next); return response({ words: next }, 201);
  }
  if (!body?.id || typeof body.id !== 'string') return response({ error: 'Ungültige Vokabel.' }, 400);
  const next = words.filter(word => word.id !== body.id); await writeWords(next); return response({ words: next });
};

export const config: Config = { path: '/api/words' };
