/** @type {import('@vercel/node').VercelRequest} */
import { Formidable } from "formidable";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { checkRateLimit } from "./_rateLimit.js";

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export default async function handler(req, res) {
  console.log("GROQ key present:", !!GROQ_API_KEY);
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const deviceId = req.headers["x-device-id"];
  const rateLimit = await checkRateLimit(deviceId, "transcribe");
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: "limit_reached" });
  }

  const form = new Formidable({});
  let files;
  try {
    [, files] = await form.parse(req);
    console.log("Parsed files:", JSON.stringify(files));
  } catch {
    return res.status(400).json({ error: "Failed to parse form data" });
  }

  const audioFile = files.audio?.[0];
  if (!audioFile) {
    return res.status(400).json({ error: "Missing audio field" });
  }

  const audioBuffer = await readFile(audioFile.filepath);
  const mimeType = audioFile.mimetype || "audio/webm";

  const groqForm = new FormData();
  groqForm.append(
    "file",
    new Blob([audioBuffer], { type: mimeType }),
    "recording.webm",
  );
  groqForm.append("model", "whisper-large-v3");
  groqForm.append("response_format", "verbose_json");
  groqForm.append("timestamp_granularities[]", "word");
  groqForm.append("temperature", "0");
  groqForm.append(
    "prompt",
    "Transcribe exactly what is said including filler words like um, uh, like, you know, basically, and anything else you see fit. Do not clean up or remove any words.",
  );

  const groqRes = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: groqForm,
    },
  );

  if (!groqRes.ok) {
    const errorText = await groqRes.text();
    return res.status(groqRes.status).json({ error: errorText });
  }

  const data = await groqRes.json();

  if (!data.words || data.words.length === 0) {
    return res.status(422).json({
      error: 'no_speech',
      message: "We couldn't transcribe that clearly. Try speaking a little closer to your mic.",
    });
  }

  return res.json(data);
}
