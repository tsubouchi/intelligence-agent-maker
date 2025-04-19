# AI-Powered Development Specification Generation System – Basic Design Document

---

## 1. 概要（Overview）
本システムは、ユーザが自然言語で入力した「商品開発アイデア／要望」から、AI Agent が自律的に高品質・網羅的なソフトウェア開発仕様書（Markdown 形式）を生成・保存する Web アプリケーションである。生成された仕様書はライブラリ機能で閲覧・検索でき、開発は全て CLI ベース（gcloud / supabase / firebase / vercel など）で完結する設計とする。

---

## 2. 目的（Purpose）
1. 企画フェーズの言語化コストを削減し、開発着手までのリードタイムを最短化する。
2. AI Agent によりヒューマンエラーを最小化した一貫性の高いドキュメントを提供する。
3. Pub/Sub を介したマイクロサービス化により Agents の水平スケール・機能拡張を容易にする。

---

## 3. フレームワーク & 技術スタック
| レイヤ | 採用技術 | 理由 |
| --- | --- | --- |
| フロントエンド | Next.js 14 (App Router) | SPA/SSR ハイブリッド, 高速開発 |
| UI コンポーネント | Tailwind CSS + Headless UI | モダン・白黒 2 色デザイン |
| 認証 | Firebase Authentication (Google / GitHub) | Cloud Run との連携容易 |
| バックエンド | Cloud Run（Node.js 20） | コンテナ化 & オートスケール |
| Message Bus | Cloud Pub/Sub | 非同期 A2A 通信 |
| DB | Supabase (PostgreSQL) on GCP | OSS, Row‑Level Security, Vector Store |
| ナレッジ検索 | Supabase MCP | Embedding & NL 検索 |
| AI モデル | OpenAI o3‑2025‑04‑16 | 高精度 LLM |
| IaC | gcloud CLI / Terraform（将来） | 再現性、CI/CD |
| Monitoring | Cloud Logging / Cloud Monitoring | SRE |

---

## 4. アーキテクチャ（Architecture）

```mermaid
graph TD
    subgraph Frontend (Next.js)
        FE["/ (Web UI)"]
    end

    subgraph Cloud Run Services
        A["Agent‑A 仕様書生成"]
        B["(将来) Agent‑B コーディング"]
    end

    FE -- HTTPS --> CloudLoadBalancing
    CloudLoadBalancing -- JWT --> A
    FE -- Supabase JS --> DB[(Supabase/PostgreSQL)]

    A -- Pub/Sub publish --> T1[doc-generation-topic]
    T1 -- push --> B

    A -- Supabase REST --> DB
    B -- Supabase REST --> DB

    classDef future fill:#eee,stroke:#aaa,stroke-dasharray: 5 5;
    B:::future
```

### コンポーネント説明
1. **Frontend (Next.js)**：ログイン、入力フォーム、マイページ、ライブラリ UI を提供。Firebase Auth ID トークンを Cloud Run へ送信。
2. **Agent‑A**：今回実装対象。入力文から仕様書を生成し `spec_documents` テーブルへ保存。必要に応じ Pub/Sub で次工程にパブリッシュ。
3. **Supabase**：PostgreSQL + Storage + Edge Functions。MCP 拡張により NL 検索 API を提供。
4. **Cloud Pub/Sub**：Agent 間の疎結合通信。Push サブスクリプションで Cloud Run エンドポイントに POST。

---

## 5. ディレクトリ構成（Monorepo）
```
AutoSpecGenerator/
├── app/                     # Next.js (frontend)
├── agents/
│   ├── agent-a/
│   │   ├── Dockerfile
│   │   ├── index.js
│   │   ├── package.json
│   │   └── prompts/
│   │       └── system_prompt.txt
│   ├── agent-b/             # 予備フォルダ（未実装）
│   └── agent-c/             # 〃
├── infra/                   # gcloud スクリプト / Terraform
├── docs/
│   ├── basic_design.md      # 本書
│   └── diagrams/
└── README.md
```

---

## 6. 機能要件（Functional Requirements）
1. **仕様書生成**
   - 入力：自然言語テキスト（必須）、Deploy 環境選択（Vercel/GCP/AWS/Azure）、ソフトウェア種別（Web App / AI Agent）
   - 出力：Markdown 仕様書 `title_basic_design.md`
   - 保存：Supabase `spec_documents` テーブル
2. **ライブラリ閲覧**
   - 自ユーザの仕様書一覧/詳細表示、Delete
3. **自然言語検索**
   - Supabase MCP で embedding 検索
4. **認証／認可**
   - Google / GitHub ログイン
   - RLS：運営 Admin（`t@bonginkan.ai`）は全件読取
5. **Secrets 管理**
   - OPENAI_API_KEY, SUPABASE_SERVICE_KEY, GITHUB_PAT などを Secret Manager に保存
6. **CLI 自動化**
   - Cloud Build YAML or Makefile によりローカル CLI 手順を再現

---

## 7. 非機能要件（Non‑Functional Requirements）
| 項目 | 内容 |
| --- | --- |
| 可用性 | Cloud Run min = 0, concurrency = 80, Multi‑Zone |
| パフォーマンス | 仕様書生成 < 30 s |
| セキュリティ | HTTPS, IAM, RLS, Secrets Manager |
| スケーラビリティ | Pub/Sub & Cloud Run により水平拡張 |
| 監視 | Cloud Monitoring アラート, Error Reporting |
| 運用 | GitHub Actions → Cloud Build / Deploy |

---

## 8. 開発手順書（High‑Level Steps）
1. **ローカル準備**
   ```bash
   git clone git@github.com:USER/AutoSpecGenerator.git
   cd AutoSpecGenerator
   cp .env.sample .env.local  # 秘密値を記入するローカル専用ファイル
   npx supabase start # ローカル確認用
   ```
2. **GCP 初期化**
   ```bash
   gcloud auth login
   gcloud config set project <PROJECT_ID>
   gcloud services enable run.googleapis.com pubsub.googleapis.com secretmanager.googleapis.com
   ```
3. **Secrets 登録**
   ```bash
   gcloud secrets create OPENAI_API_KEY --replication-policy="automatic"
   echo -n "$OPENAI_API_KEY" | gcloud secrets versions add OPENAI_API_KEY --data-file=-
   ```
4. **Supabase プロジェクト作成 & MCP 追加**
   ```bash
   supabase org switch <org>
   supabase projects create <db-id> --region ap-northeast-1
   npm i -g supabase-mcp
   supabase-mcp init
   ```
5. **Agent‑A デプロイ**
   ```bash
   gcloud builds submit ./agents/agent-a --tag gcr.io/$PROJECT_ID/agent-a
   gcloud run deploy agent-a \
     --image gcr.io/$PROJECT_ID/agent-a \
     --platform managed \
     --region asia-northeast1 \
     --set-secrets "OPENAI_API_KEY=projects/$PROJECT_ID/secrets/OPENAI_API_KEY:latest" \
     --allow-unauthenticated
   ```
6. **Pub/Sub トピック & Push サブスクリプション作成**
   ```bash
   gcloud pubsub topics create doc-generation-topic
   gcloud pubsub subscriptions create agent-a-sub \
     --topic=doc-generation-topic \
     --push-endpoint="https://agent-a-<hash>-uc.a.run.app/" \
     --push-auth-service-account="agent-a-sa@$PROJECT_ID.iam.gserviceaccount.com"
   ```

---

## 9. 開発計画（Milestones）
| Phase | 期間 | Deliverables |
| --- | --- | --- |
| 0. Kick‑off | Wk‑0 | 本ドキュメント承認 |
| 1. 基盤構築 | Wk‑1〜2 | GCP / Supabase / Firebase 初期設定 |
| 2. Agent‑A 実装 | Wk‑3〜4 | 仕様書生成 API＆UI 完了 |
| 3. ライブラリ & 検索 | Wk‑5 | MCP 組込み |
| 4. QA / Hardening | Wk‑6 | 負荷試験, 脆弱性診断 |
| 5. リリース | Wk‑7 | v1.0 GA |

---

## 10. 拡張機能（Future Work）
- Agent‑B：生成仕様書 → コードベース scaffold（Next.js + Prisma など）
- Agent‑C：E2E Test / CI 設定自動生成
- Multi‑Cloud deploy (AWS Amplify, Azure Static Web Apps)
- ChatOps（Slack Bot）経由でアイデア投稿

---

## 11. 環境変数（Secrets）一覧
| Key | 用途 |
| --- | --- |
| OPENAI_API_KEY | o3 API 呼び出し |
| GEMINI_API_KEY | Google GenAI (Gemini) 呼び出し |
| SUPABASE_URL | Supabase REST URL |
| SUPABASE_SERVICE_KEY | サーバ側管理キー |
| SUPABASE_MCP_TOKEN | Supabase MCP サービス用トークン |
| GITHUB_PAT | GitHub Actions / gh CLI 認証 |
| GOOGLE_APPLICATION_CREDENTIALS | Cloud SDK SA JSON |

---

## 12. Agent‑A システムプロンプト
`agents/agent-a/prompts/system_prompt.txt`
```text
あなたは "Agent‑A" です。
目的: 与えられた製品アイデアを基に、エンジニアリングチームがそのまま開発に着手できる網羅的かつ無駄のないソフトウェア開発仕様書 (Markdown) を出力してください。
必須要件:
1. 構成要素: 概要、目的、フレームワーク、技術スタック、アーキテクチャ図 (mermaid)、ディレクトリ構成、機能要件、非機能要件、開発手順書、開発計画、拡張機能、環境変数、その他必要情報。
2. 生成物名: `title_basic_design.md` (title はアイデアから自動生成)。
3. ユーザが選択したソフトウェア種別と Deploy 環境を必ず反映。
4. CLI 前提でコマンド例を提示。GUI 操作は記述しない。
5. 配色は白・黒 2 色のみと明記。
6. 出力は *Markdown 表現* のみ。ファイル冒頭に `# <タイトル>` を置く。
7. 必ず 1 つのコードブロックにアーキテクチャ図 (mermaid) を含める。
8. 正確・最新のベストプラクティスを優先。
```

---

## 13. Agent‑A コード一式

### 13.1 Dockerfile
```Dockerfile
# agents/agent-a/Dockerfile
FROM node:20-slim

# システムロケール & tzdata 省略で軽量化
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
```

### 13.2 package.json
```json
// agents/agent-a/package.json
{
  "name": "agent-a",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "@google-cloud/pubsub": "^3.12.0",
    "@supabase/supabase-js": "^2.39.0",
    "dotenv": "^10.0.0",
    "express": "^4.19.2",
    "openai": "^4.13.0"
  }
}
```

### 13.3 index.js
```javascript
// agents/agent-a/index.js
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
```

### 13.4 .env.sample
```bash
# agents/agent-a/.env.sample
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
```

### 13.5 .env.local
```bash
# agents/agent-a/.env.local
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
```

---

## 14. テーブル定義（Supabase）
```sql
-- specs table
create table public.spec_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  title text not null,
  content text not null,
  software_type text,
  deploy_target text,
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.spec_documents enable row level security;
create policy "Users can view own docs" on public.spec_documents
  for select using (auth.uid() = user_id or auth.uid() = 'admin-uuid');
```

---

## 15. 環境変数ファイル運用
| ファイル | 用途 | Git 管理 |
| --- | --- | --- |
| `.env.sample` | 参考となるキー一覧と説明を記載。値は空欄。 | **含める** |
| `.env.local`  | 実際のシークレット値を記入。`.gitignore` で除外。 | **含めない** |

> `.env.sample` でキーを追加した際は、開発者各自が `.env.local` を更新してください。

---

### 完了
> 上記 `basic_design.md` が初版の基本設計書です。コードブロックをファイルとして保存し、`gcloud builds submit` で即時 Cloud Run へデプロイ可能です。 