# Cortex — Edward's interactive portfolio

The home page shows your experience, projects, publications, skills, interests and quotes as
**neurons** in a floating network. Visitors can click a neuron to see details, or turn on the
mic and ask **Cortex**, your AI, a question. Cortex looks up your content in a vector database
(RAG), answers with Claude, speaks the answer aloud and opens the neuron it's talking about.

## Quick start

```bash
npm install
cp .env.example .env        # then paste your ANTHROPIC_API_KEY
npm run ingest              # embeds content/ into data/vectors.json + data/edges.json
npm run dev                 # http://localhost:5173
```

Requires Node 20+. Node 22.17+ is recommended: it lets you upgrade to SvelteKit 3 / Vite 8 later.
The first `ingest` downloads a ~23 MB embedding model into `.cache/`.

## Adding your information

All of it lives in [`content/`](content/README.md). There's one markdown file per neuron, and
fill-in templates are in [`content/_templates/`](content/_templates).

```bash
npm run new-node -- project proj-my-app "My App"   # scaffold from a template
# edit content/projects/proj-my-app.md
npm run ingest                                       # re-embed + recompute edges
```

- Images go in `static/images/` and are referenced as `/images/x.png`.
- Videos: add YouTube/Vimeo URLs or `/videos/x.mp4` files under `videos:`. On desktop, a node's
  pictures and videos float in a column on the left; on screens 1024px and narrower they appear
  inside the info panel.
- Links (GitHub, paper, demo…) go in the `links:` frontmatter list.
- `related:` lists node ids to always connect to. Similarity edges are added automatically.
- Name, contact info, footer links, voice and colours are set in [`src/lib/config/site.ts`](src/lib/config/site.ts).
- Logo: replace [`static/logo.svg`](static/logo.svg).

## How it works

```
Browser                                         Server (SvelteKit, Node)
───────                                         ────────────────────────
mic ─▶ getUserMedia (permission + level meter)
     ─▶ Web Speech API (speech → text)
question ───────── POST /api/ask ──────────────▶ embed question (transformers.js)
                                                 ─▶ cosine search data/vectors.json
                 ◀── SSE: sources ──────────────    (top chunks)
neurons glow                                     ─▶ Claude (claude-opus-5-5), streamed
                 ◀── SSE: focus, delta… ────────    "<focus>node-id</focus> answer…"
speechSynthesis speaks sentence by sentence
node panel pops up for the focus node
```

| Piece | File |
|---|---|
| Neuron graph (d3-force + canvas, moods) | `src/lib/components/NeuralGraph.svelte` |
| Pop-up info panel | `src/lib/components/NodePanel.svelte` |
| Mic / captions / text input | `src/lib/components/CortexDock.svelte` |
| State machine (idle → listening → thinking → speaking) | `src/lib/cortex.svelte.ts` |
| Mic, speech-to-text, text-to-speech | `src/lib/voice/speech.ts` |
| Content loader + graph edges | `src/lib/server/content.ts` |
| Embeddings | `src/lib/server/embeddings.ts` |
| Vector store (swappable) | `src/lib/server/vectorstore.ts` |
| Chunking + retrieval | `src/lib/server/rag.ts` |
| Claude prompt + streaming | `src/lib/server/llm.ts` |
| API endpoint (+ rate limit) | `src/routes/api/ask/+server.ts` |
| Ingest pipeline | `scripts/ingest.ts` |

### Swapping parts

- **Vector DB:** implement the `VectorStore` interface in `vectorstore.ts` (pgvector, Pinecone,
  Qdrant…). The JSON store is fine up to a few thousand chunks.
- **Embeddings:** replace `embed()` in `embeddings.ts`, for example with Voyage AI, then re-run ingest.
- **Voice:** `speech.ts` uses free browser APIs. For a more natural voice, swap `Speaker` for a
  TTS API (e.g. ElevenLabs/OpenAI TTS) behind a server route; for Firefox support swap
  `Recognizer` for server-side Whisper.
- **Model / cost:** set `CORTEX_MODEL` and `CORTEX_EFFORT` in `.env`.

## Cortex's personality and guardrails

Edit [`content/cortex-persona.md`](content/cortex-persona.md). Changes apply to the next question;
no restart or ingest needed.

- **personality / tagline**: how Cortex sounds and acts.
- **About Cortex** (body): the only facts Cortex shares about itself.
- **refusal**: the fixed reply to anything that isn't about Edward or Cortex.
- **blockedMessage**: shown and spoken when chat is disabled.
- **blockedTerms**: words that disable chat instantly, without asking the model.

How it works: every answer starts with a hidden `<scope>` tag the model must write first:
`edward`, `cortex`, `off_topic` or `inappropriate`. Text is held back until the scope is known.
- `edward` / `cortex` → answered (Edward questions only from the knowledge base).
- `off_topic` (or a missing/unknown tag) → the model is stopped and the **refusal** is shown.
- `inappropriate` (or a model safety refusal, or a **blockedTerms** hit) → the visitor's chat is
  disabled for `CORTEX_BLOCK_HOURS` (default 24). This is enforced on the server by IP, and the
  browser remembers it too. The neurons stay clickable.

The block list lives in memory, so restarting the server clears it. Behind a proxy (Fly, Render,
nginx), set adapter-node's `ADDRESS_HEADER=X-Forwarded-For` so visitors are told apart by their real IP.

## Login, question limits, members and the audit log

**Setup**
1. `npm run gen-keys` → adds `AUTH_ENC_KEY` and `AUTH_HMAC_KEY` to `.env` (encryption keys; never
   change them once set, or stored data becomes unreadable; back them up).
2. Set `ORIGIN` to your public URL (e.g. `https://edng5.com`).
3. Email sign-in: set `SMTP_URL` and `EMAIL_FROM`. Without SMTP, codes are printed to the server console.
4. Google sign-in (optional): create an OAuth client (Web) in Google Cloud Console, add the redirect
   URI `<ORIGIN>/auth/google/callback`, and set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. Members: `MEMBER_EMAILS=a@x.com,b@y.com` unlocks the hidden **Surprise!** node
   (`content/surprise/surprise.md`, set its `playlist:` URL).

**Limits** (`QUOTA_ANON`, `QUOTA_USER_DAILY`, `QUOTA_MEMBER_DAILY`): 5 questions ever per network
for visitors who aren't logged in, 10 per day when logged in. Failed answers are refunded.

**Security**
- No passwords: Google OAuth 2.0 with PKCE + state, or a single-use 4-digit email code (10 min, stored as an HMAC; 5 wrong tries burns it, 15 a day
  locks the email until the next day, 5 codes an hour).
- Session cookie: 32 random bytes, `HttpOnly`, `SameSite=Lax`, `Secure` over HTTPS, 30 days; only
  its SHA-256 hash is stored.
- Emails, IPs and prompt text are AES-256-GCM encrypted at rest; lookups use HMAC blind indexes.
- Members-only nodes are never sent to, or searched for, anyone else (including in Cortex's answers).
- Sign-in emails are rate-limited per IP and per address.

**Audit log**: logins, sign-in code requests, logouts, every Cortex prompt (with its outcome),
blocks and limit hits. Read it with `npm run audit -- --days 7 [--event chat_prompt]`. Entries
older than 90 days are deleted automatically (hourly).

Data lives in `data/app.db` (SQLite, git-ignored). Behind a proxy, set adapter-node's
`ADDRESS_HEADER=X-Forwarded-For` so visitors are told apart by their real IP.

## Notes

- **Browser support:** speech recognition works in Chrome, Edge and Safari. Chrome sends the
  audio to Google's speech service. On other browsers, visitors can type their question.
- **Mic permission** needs HTTPS in production (localhost is exempt).
- **Cost control:** `/api/ask` is rate-limited per IP (`CORTEX_RATE_LIMIT`, default 20 per 10 min)
  and questions are capped at 500 characters. Set a spend limit in the Anthropic Console too.
- **Refusals:** requests opt in to server-side fallback (`fallbacks: "default"`), so a
  safety-classifier false positive is retried on Anthropic's recommended fallback model.
- **Deploy:** `npm run build && npm start` (adapter-node). Works on Fly.io, Render, Railway,
  or a VPS. Ship the `content/`, `data/` and `.cache/` folders, or run `npm run ingest` at build time.
