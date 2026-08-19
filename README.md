# AI Agent — n8n + Groq + Next.js (End-to-End Demo)

This project is a minimal, working end-to-end AI agent deployment built for the
Lexavra Infinology DevOps take-home assignment (Part 2 — Hands-On Proof).

It consists of three pieces wired together:

1. **Self-hosted n8n** (Docker) — hosts the workflow/automation engine
2. **A webhook-triggered n8n workflow** — receives a prompt, calls an AI model
   (Groq's Llama 3.3 70B), and returns the response
3. **A Next.js frontend** — a simple page with a textbox that calls the n8n
   webhook and displays the AI's reply

---

## Architecture

```
┌────────────────┐        POST /webhook/ai-agent        ┌──────────────────────┐
│   Next.js App   │ ──────────────────────────────────▶ │   n8n (Docker)        │
│ localhost:3000  │                                       │   localhost:5678      │
│  (form + fetch)  │ ◀────────────────────────────────── │                        │
└────────────────┘        { "reply": "..." }             │  Webhook               │
                                                            │    ↓                  │
                                                            │  HTTP Request         │
                                                            │  (calls Groq API)     │
                                                            │    ↓                  │
                                                            │  Respond to Webhook   │
                                                            └──────────────────────┘
                                                                     │
                                                                     ▼
                                                            ┌──────────────────────┐
                                                            │  Groq API             │
                                                            │  (llama-3.3-70b-      │
                                                            │   versatile model)    │
                                                            └──────────────────────┘
```

---

## Components

### 1. n8n (Docker)

Run via `docker-compose.yml` in the project root. n8n exposes its editor and
webhook endpoints on port `5678`.

**`docker-compose.yml`** (secrets pulled from `.env`, never hardcoded):

```yaml
version: "3.8"

services:
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=${N8N_HOST}
      - N8N_PROTOCOL=${N8N_PROTOCOL}
      - WEBHOOK_URL=${WEBHOOK_URL}
      - GENERIC_TIMEZONE=Asia/Kolkata
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
    volumes:
      - ./n8n-data:/home/node/.n8n
```

**`.env`** (not committed to git — values are examples only):

```
N8N_HOST=localhost
N8N_PROTOCOL=http
WEBHOOK_URL=http://localhost:5678/
N8N_USER=admin
N8N_PASSWORD=changeme
```

Start it with:

```bash
docker compose up -d
```

### 2. n8n Workflow — `ai-agent`

Three nodes, connected in sequence:

| Node | Purpose |
|---|---|
| **Webhook** | `POST /webhook/ai-agent` — receives `{ "prompt": "..." }`, Authentication: None, Respond: *Using 'Respond to Webhook' Node* |
| **HTTP Request** | Calls Groq's OpenAI-compatible chat completions endpoint |
| **Respond to Webhook** | Returns `{ "reply": "<model's answer>" }` as JSON |

**HTTP Request node config:**

- Method: `POST`
- URL: `https://api.groq.com/openai/v1/chat/completions`
- Authentication: Generic Credential Type → Header Auth
  - Header name: `Authorization`
  - Header value: `Bearer <GROQ_API_KEY>` (stored as an n8n credential — never
    hardcoded in the node or committed to git)
- Body (JSON):
  ```json
  {
    "model": "llama-3.3-70b-versatile",
    "messages": [
      { "role": "user", "content": "{{ $json.body.prompt }}" }
    ]
  }
  ```

**Respond to Webhook node config:**

```json
{
  "reply": "{{ $json.choices[0].message.content }}"
}
```

### 3. Next.js Frontend

A single page (`app/page.tsx`) with a textarea and a button. On submit, it
`POST`s the prompt to the n8n production webhook URL and renders the reply.

```
http://localhost:5678/webhook/ai-agent
```

Run locally with:

```bash
cd ai-frontend
npm install
npm run dev
```

Visit `http://localhost:3000`.

---

## Running the Whole Stack Locally

```bash
# 1. Start n8n
docker compose up -d

# 2. Import/build the "ai-agent" workflow in the n8n editor (localhost:5678)
#    — or use n8n's import feature if a workflow JSON export is provided —
#    and Publish it.

# 3. Start the Next.js frontend
cd ai-frontend
npm install
npm run dev

# 4. Open the app
#    http://localhost:3000
```

### Quick test (bypassing the UI)

```bash
curl -X POST http://localhost:5678/webhook/ai-agent \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"Say hello in one sentence\"}"
```

Expected response:

```json
{ "reply": "Hello! How can I help you today?" }
```

---

## Secrets & Credentials

- The **Groq API key** is stored as an n8n credential (Header Auth), not
  pasted into the HTTP Request node body or URL, and not committed to git.
- The **n8n basic auth** username/password and host/protocol config are
  pulled from a local `.env` file, which is excluded via `.gitignore`.
- No API keys or passwords appear in `docker-compose.yml` — only variable
  references (`${VAR_NAME}`).

---

## Live Demo (Part 2 deliverable)

- n8n instance: `<TUNNEL/PUBLIC_URL_HERE>`
- Next.js frontend: `<TUNNEL/PUBLIC_URL_HERE>`

> To make `localhost` reachable publicly for the demo, this was exposed via
> [ngrok](https://ngrok.com) (or a similar tunnel), which also provides
> automatic HTTPS/TLS termination in front of the local services.

---

## What I'd Do Differently at Real Scale

- **Model provider**: use a provider/model with a stable, versioned API
  contract (pin model versions explicitly) instead of relying on "latest"
  aliases that get deprecated without notice — this caused several failures
  during development (Gemini model names changing under us).
- **Secrets management**: move credentials out of `.env`/local n8n credential
  store into a managed secrets service (AWS Secrets Manager, GCP Secret
  Manager, HashiCorp Vault) with rotation policies.
- **Deployment**: run n8n behind a reverse proxy (Caddy/Nginx/Traefik) with a
  real TLS certificate (Let's Encrypt) and a proper domain, rather than a
  tunnel. Deploy on a small managed VM or container service (Railway,
  Render, Fly.io, or an ECS/Cloud Run setup) instead of a local machine.
- **Auth**: replace n8n basic auth with SSO/OAuth for the editor, and add
  request signing or an API key check on the public-facing webhook itself
  to prevent abuse.
- **Observability**: add structured logging, error alerting (e.g. on
  webhook failures or AI API errors), and basic rate limiting in front of
  the webhook.
- **CI/CD**: version the n8n workflow as exported JSON in git, and add a
  pipeline to lint/test the Next.js app and redeploy on merge, rather than
  hand-configuring the workflow through the UI.
- **Environment separation**: maintain distinct dev/staging/prod n8n
  instances and API keys, instead of a single shared instance.
- **Resilience**: add retry/backoff on the HTTP Request node for transient
  AI API failures, and a fallback response if the AI call times out.

---

## Known Issues / Notes from Development

- Initially attempted Google Gemini as the model provider; ran into repeated
  "model not found" errors as Google deprecated model names
  (`gemini-2.0-flash` → `gemini-2.5-flash` → deprecated) mid-development.
  Switched to Groq (`llama-3.3-70b-versatile`) for a more stable free-tier
  API during this demo.
- Encountered transient Docker/WSL network issues (DNS resolution failures
  inside the container) that were resolved by restarting Docker Desktop and
  updating WSL (`wsl --update`).
