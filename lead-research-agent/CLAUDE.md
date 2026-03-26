# Lead Research Agent

## Tools

**Built-in** (Claude Code): WebSearch, WebFetch — use for web search and URL fetching.

**Custom** (3 tools):
- `exaSearch` — Exa.ai search (optional, when EXA_API_KEY set)
- `readLeadCriteria` — read skills/lead-criteria.md
- `sendSlackMessage` — send Slack alert

## Constraints

- Use built-in WebSearch/WebFetch for search and fetch; exaSearch when EXA_API_KEY is set.
- Call `sendSlackMessage` only when the lead qualifies as interesting per criteria.
