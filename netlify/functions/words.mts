import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

export default async (req: Request, context: Context) => {
  const store = getStore("vocabulary");
  const user = context.clientContext?.user;
  const isAdmin = user?.app_metadata?.roles?.includes("admin");

  if (req.method === "GET") {
    const data = (await store.get("words", { type: "json" })) || [];
    return new Response(JSON.stringify({ words: data }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!user || !isAdmin) {
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
