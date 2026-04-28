import process from "node:process";
import { checkRateLimit } from "./_rateLimit.js";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "string") return JSON.parse(body);
  return body;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const deviceId = req.headers["x-device-id"];
  const rateLimit = await checkRateLimit(
    deviceId,
    "generate-context",
    req.headers["x-dev-token"],
  );

  if (!rateLimit.allowed) {
    return res.status(429).json({ error: "limit_reached" });
  }

  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: "Missing GROQ_API_KEY" });
  }

  let body;
  try {
    body = parseBody(req.body);
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const word = String(body.word || "").trim();
  const category = String(body.category || "random").trim();

  if (!word) {
    return res.status(400).json({ error: "Missing word" });
  }

  const groqRes = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You generate speaking prompts for a speech trainer. The prompt must put the user directly in a situation (do not just default to one, be creative) and tell them what to talk about. Maximum 2-3 sentences. The user is always the speaker — never a spectator. Write in second person (You are..., You're...). Be direct and specific.",
        },
        {
          role: "user",
          content: `Create a 1-2 sentence speaking prompt for the word '${word}' in a ${category} context. Format: 'You're [situation]. Talk about [topic] using the word ${word}.' Never exceed 2 sentences.`,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!groqRes.ok) {
    const errorText = await groqRes.text();
    return res.status(groqRes.status).json({ error: errorText });
  }

  const data = await groqRes.json();
  const context = data.choices?.[0]?.message?.content?.trim();

  if (!context) {
    return res.status(502).json({ error: "No context returned" });
  }

  return res.status(200).json({ context });
}
