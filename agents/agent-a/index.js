import express from "express";
import { PubSub } from "@google-cloud/pubsub";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import "dotenv/config";

const app = express();
app.use(express.json());

// ---------- Env & Client Init ----------
const {
  OPENAI_API_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
} = process.env;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const SYSTEM_PROMPT = fs.readFileSync(
  path.join("prompts", "system_prompt.txt"),
  "utf-8"
);

// Pub/Sub push endpoint (root URL)
app.post("/", async (req, res) => {
  try {
    // Validate Pub/Sub envelope
    const envelope = req.body.message;
    if (!envelope || !envelope.data) {
      return res.status(400).send("Bad Request: no Pub/Sub message");
    }

    const decoded = Buffer.from(envelope.data, "base64").toString();
    const { idea, userId, softwareType, deployTarget } = JSON.parse(decoded);

    // -------- LLM Call --------
    const completion = await openai.chat.completions.create({
      model: "o3-2025-04-16",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: idea },
      ],
    });

    const specMd = completion.choices[0].message.content;

    // -------- Persist to Supabase --------
    const { error } = await supabase.from("spec_documents").insert({
      user_id: userId,
      title: "title_basic_design.md",
      content: specMd,
      software_type: softwareType,
      deploy_target: deployTarget,
    });
    if (error) throw error;

    // ACK
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).send();
  }
});

// Health Check
app.get("/healthz", (_, res) => res.status(200).send("ok"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Agent‑A running on :${PORT}`)); 