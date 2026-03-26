# Lead Research Agent

Research people by email or name, qualify leads, and get Slack alerts for interesting prospects.

**Use cases:** new signups, form submissions, deploy events from high-value teams.

```bash
git clone https://github.com/21st-dev/21st-sdk-examples.git
cd 21st-sdk-examples/lead-research-agent
npm install
npx @21st-sdk/cli login
npx @21st-sdk/cli deploy
```

## Slack

1. [api.slack.com/apps](https://api.slack.com/apps) → Create New App → From scratch → Incoming Webhooks → Activate → Add to Workspace
2. 21st dashboard → your agent → Environment Variables → `SLACK_WEBHOOK_URL=...`
3. Redeploy

Optional: `EXA_API_KEY` for Exa.ai search (better for people/companies than built-in WebSearch).

## Customization

- **Lead criteria** — `agents/lead-research/template/skills/lead-criteria.md`
- **Exa** — add `EXA_API_KEY` for richer search on people/companies

## Example prompts

- "Research john@acme.ai — just deployed their first agent"
- "Look up Jane Doe from Stripe"
- "Is sarah@startup.io worth reaching out to?"
