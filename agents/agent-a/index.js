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
const pubsub = new PubSub();
const SYSTEM_PROMPT = fs.readFileSync(
  path.join("prompts", "system_prompt.txt"),
  "utf-8"
);

// -------- Create Embeddings for Search --------
async function createEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

// ----------------------------------------------
// 型定義：Supabase にそのまま INSERT できる構造
// ----------------------------------------------
// interface SpecMetadata {
//   title:           string;        // 仕様書の # 見出し
//   summary:         string;        // 120 字以内の要約
//   keywords:        string[];      // 検索用キーワード
//   techStack: {
//     frontend:      string[];
//     backend:       string[];
//     infra:         string[];
//     language:      string[];
//     others?:       string[];
//   };
//   architecturePatterns: string[]; // 例: "microservices", "event‑driven"
//   designPatterns:       string[]; // 例: "CQRS", "Factory Method"
//   db:                   string[]; // 例: "Supabase", "PostgreSQL"
//   cloudProvider:        string;   // GCP / AWS / Azure / Vercel
//   softwareType:         string;   // webアプリ / AI Agent …
//   deployTarget:         string;   // ユーザ選択
//   createdAt:            string;   // ISO8601
// }

// -------- Extract metadata from spec document --------
async function extractMetadata(specMd, idea, softwareType, deployTarget) {
  // Function Callingで使用するスキーマ定義
  const METADATA_SCHEMA = {
    name: "build_spec_metadata",
    description: "開発仕様書から検索用メタデータを抽出する",
    parameters: {
      type: "object",
      properties: {
        title:             { type: "string" },
        summary:           { type: "string", maxLength: 120 },
        keywords:          { type: "array",  items: { type: "string" } },
        techStack: {
          type: "object",
          properties: {
            frontend: { type: "array", items: { type: "string" } },
            backend:  { type: "array", items: { type: "string" } },
            infra:    { type: "array", items: { type: "string" } },
            language: { type: "array", items: { type: "string" } },
            others:   { type: "array", items: { type: "string" } }
          },
          required: ["frontend","backend","infra","language"]
        },
        architecturePatterns: { type: "array", items: { type: "string" } },
        designPatterns:       { type: "array", items: { type: "string" } },
        db:                   { type: "array", items: { type: "string" } },
        cloudProvider:        { type: "string" },
        softwareType:         { type: "string" },
        deployTarget:         { type: "string" },
        createdAt:            { type: "string", format: "date-time" }
      },
      required: ["title","summary","keywords","techStack","cloudProvider",
                "softwareType","deployTarget","createdAt"]
    }
  };

  try {
    // トークン効率：2000字超は先頭 + 末尾をサンプル化
    const MAX_CHARS = 2500;
    const snippet =
      specMd.length <= MAX_CHARS
        ? specMd
        : `${specMd.slice(0, 1800)}\n...\n${specMd.slice(-600)}`;

    // Chat Completion with Function Calling
    const { choices } = await openai.chat.completions.create({
      model: "o3-2025-04-16",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "あなたはソフトウェア設計ドキュメントのメタデータ抽出エンジンです。" +
            "要求された JSON スキーマに **完全一致** するフィールド名と型で出力してください。" +
            "いかなる追加キーも、文字列化したオブジェクトも不可。"
        },
        {
          role: "user",
          content: [
            `製品アイデア: ${idea}`,
            `ソフトウェア種別: ${softwareType}`,
            `Deploy環境: ${deployTarget}`,
            "",
            "以下の仕様書から検索に役立つメタデータを抽出してください。",
            "仕様書:",
            "````md",
            snippet,
            "````"
          ].join("\n")
        }
      ],
      functions: [METADATA_SCHEMA],
      function_call: { name: "build_spec_metadata" }
    });

    // パース & 最小バリデーション
    const functionCall = choices[0].message.function_call;
    if (!functionCall || !functionCall.arguments) {
      throw new Error("Function calling failed");
    }
    
    const raw = JSON.parse(functionCall.arguments);
    const meta = {
      ...raw,
      cloudProvider: deployTarget,
      softwareType,
      deployTarget,
      createdAt: new Date().toISOString()
    };

    // 型安全チェック（簡易）
    if (!Array.isArray(meta.keywords) || meta.keywords.length === 0) {
      throw new Error("metadata extraction failed: keywords missing");
    }
    
    console.log('Successfully extracted metadata');
    return meta;
  } catch (err) {
    console.error('Metadata extraction error:', err);
    // フォールバック: 基本情報だけのメタデータを返す
    return {
      title: specMd.split('\n')[0].replace('# ', '').replace(' 基本設計書', '').trim(),
      summary: idea.slice(0, 120),
      keywords: softwareType.split(' '),
      techStack: {
        frontend: [],
        backend: [],
        infra: [deployTarget],
        language: []
      },
      architecturePatterns: [],
      designPatterns: [],
      db: [],
      cloudProvider: deployTarget,
      softwareType: softwareType,
      deployTarget: deployTarget,
      createdAt: new Date().toISOString()
    };
  }
}

// 仕様書をユーザーアーカイブに追加する
async function addToUserArchive(userId, specId) {
  try {
    const { error } = await supabase
      .from('user_archives')
      .insert({
        user_id: userId,
        spec_id: specId,
        is_favorite: true, // 新規作成した仕様書は自動的にお気に入りに
        notes: '自動生成された仕様書'
      });
    
    if (error) {
      console.error('Error adding spec to user archive:', error);
      return false;
    }
    
    console.log(`Added spec ${specId} to user ${userId} archive`);
    return true;
  } catch (err) {
    console.error('Failed to add spec to user archive:', err);
    return false;
  }
}

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

    console.log(`Processing request for user: ${userId}`);
    console.log(`Software Type: ${softwareType}, Deploy Target: ${deployTarget}`);

    // -------- LLM Call with updated parameters --------
    const completion = await openai.chat.completions.create({
      model: "o3-2025-04-16",
      temperature: 0.3,
      top_p: 0.95,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `
アイデア: ${idea}
ソフトウェア種別: ${softwareType || "webアプリ"}
Deploy環境: ${deployTarget || "GCP"}
` },
      ],
    });

    const specMd = completion.choices[0].message.content;
    
    // Extract title from the first line of Markdown
    const titleLine = specMd.split('\n')[0];
    const title = titleLine.replace('# ', '').replace(' 基本設計書', '').trim() + '_basic_design.md';

    // Generate embedding for Supabase Vector Search
    const contentEmbedding = await createEmbedding(specMd);
    
    // Extract metadata from the specification
    const metadata = await extractMetadata(specMd, idea, softwareType, deployTarget);
    console.log('Extracted metadata:', metadata);

    // -------- Persist to Supabase --------
    const { data, error } = await supabase.from("spec_documents").insert({
      user_id: userId,
      title: title,
      content: specMd,
      software_type: softwareType,
      deploy_target: deployTarget,
      content_embedding: contentEmbedding,
      metadata: metadata
    }).select('id');
    
    if (error) throw error;
    
    // 仕様書IDを取得
    const specId = data && data[0] ? data[0].id : null;
    
    if (specId) {
      // ユーザーアーカイブに追加
      await addToUserArchive(userId, specId);
    }

    console.log(`Specification generated and stored with title: ${title}`);

    // ACK
    return res.status(204).send();
  } catch (err) {
    console.error('Error processing request:', err);
    return res.status(500).send();
  }
});

// Health Check
app.get("/healthz", (_, res) => res.status(200).send("ok"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Agent‑A running on :${PORT}`)); 