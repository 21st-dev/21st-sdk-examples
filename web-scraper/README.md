# 21st SDK - Web Scraper (Browser Use)

Web scraping agent that **must use Browser Use Cloud** to extract structured data from dynamic pages and SPAs.

User flow:
- User gives URL + what to extract
- Agent runs a Browser Use task on that page
- Agent returns clean structured JSON (`url`, `request`, `data`, `notes`)

## Project structure

```
web-scraper/
├── agents/
│   └── web-scraper.ts         # Agent definition (deploy this)
├── app/
│   ├── api/an/
│   │   ├── sandbox/route.ts   # Creates/caches agent sandboxes
│   │   ├── threads/route.ts   # Creates/lists chat threads
│   │   └── token/route.ts     # Token handler (server-side)
│   ├── components/
│   │   ├── thread-sidebar.tsx
│   │   └── extraction-tool-renderers.tsx
│   ├── page.tsx               # Chat UI (client-side)
│   ├── layout.tsx
│   └── globals.css
├── .env.example
└── package.json
```

## Setup

### 1) Configure environment

```bash
cp .env.example .env.local
```

Set:
- `AN_API_KEY`
- `BROWSER_USE_API_KEY`
- optional `BROWSER_USE_BASE_URL`

### 2) Install and deploy

```bash
npm install
npx an login
npx an deploy
```

Deploy `agents/web-scraper.ts` as slug `web-scraper` (or update slug references if you choose a different name).

### 3) Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Example prompts

- `Get all product names and prices from https://example.com/store`
- `From https://example.com/jobs extract title, company, location, salary`
- `Extract all H2 headings and links from https://example.com/blog`

## Browser Use API integration

The agent calls:
- `POST https://api.browser-use.com/api/v2/tasks`
- `GET https://api.browser-use.com/api/v2/tasks/{task_id}/status` (polling)

It sends a structured output JSON schema and normalizes the response into:

```json
{
  "url": "https://example.com/store",
  "request": "all product names and prices",
  "data": [{ "name": "Item 1", "price": "$19.99" }],
  "notes": null
}
```
