import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

export default async (req: Request, context: Context) => {
  const store = getStore("vocabulary");
  
  // Hier werden Benutzername und Passwort direkt abgeglichen
  const user = req.headers.get("x-user");
  const pass = req.headers.get("x-pass");
  const isAdmin = (user === "TimCook" && pass === "Tessi");

  if (req.method === "GET") {
    const data = (await store.get("words", { type: "json" })) || [];
    return new Response(JSON.stringify({ words: data }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Wenn man was speichern oder löschen will, aber die Daten falsch sind:
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Nicht autorisiert" }), { status: 401 });
  }

  let words: any[] = (await store.get("words", { type: "json" })) || [];

  if (req.method === "POST") {
    const newWord = await req.json();
    newWord.id = String(Date.now());
    words.unshift(newWord);
    await store.setJSON("words", words);
    return new Response(JSON.stringify({ words }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "DELETE") {
    const { id } = await req.json();
    words = words.filter((w: any) => w.id !== id);
    await store.setJSON("words", words);
    return new Response(JSON.stringify({ words }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = {
  path: "/api/words",
};
