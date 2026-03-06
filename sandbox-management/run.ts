import { AnClient } from "@21st-sdk/node"

const AN_API_KEY = process.env.AN_API_KEY
const REPO_URL = process.env.REPO_URL || "https://github.com/anthropics/anthropic-cookbook.git"
const GH_TOKEN = process.env.GH_TOKEN
const RELAY_URL = process.env.AN_RELAY_URL || "https://relay.an.dev"
const AGENT_SLUG = "repo-reviewer"

if (!AN_API_KEY) {
  console.error("AN_API_KEY is required. Set it in .env or environment.")
  process.exit(1)
}

const client = new AnClient({ apiKey: AN_API_KEY, baseUrl: RELAY_URL })

// ── 1. Create sandbox ──────────────────────────────────────────
console.log(`\n① Creating sandbox for "${AGENT_SLUG}"...`)
const sandbox = await client.sandboxes.create({ agent: AGENT_SLUG })
console.log(`   ✓ Sandbox created: ${sandbox.id} (e2b: ${sandbox.sandboxId})`)

// ── 2. Clone repo into sandbox ─────────────────────────────────
console.log(`\n② Cloning ${REPO_URL}...`)
const clone = await client.sandboxes.git.clone({
  sandboxId: sandbox.id,
  url: REPO_URL,
  path: "/home/user/repo",
  ...(GH_TOKEN && { token: GH_TOKEN }),
  depth: 1,
})
console.log(`   ✓ Cloned to ${clone.path}`)

// ── 3. Exec: list files ────────────────────────────────────────
console.log(`\n③ Listing repo contents...`)
const ls = await client.sandboxes.exec({
  sandboxId: sandbox.id,
  command: "ls /home/user/repo",
})
console.log(`   ✓ Files:\n${ls.stdout.split("\n").map((f: string) => `     ${f}`).join("\n")}`)

// ── 4. Exec: check gh CLI was installed by sandbox config ──────
console.log(`\n④ Checking gh CLI (installed via Sandbox({ apt: ["gh"] }))...`)
const gh = await client.sandboxes.exec({
  sandboxId: sandbox.id,
  command: "which gh && gh --version",
})
console.log(`   ✓ ${gh.stdout.trim()}`)

// ── 5. Write a file into sandbox ───────────────────────────────
console.log(`\n⑤ Writing a file...`)
await client.sandboxes.files.write({
  sandboxId: sandbox.id,
  files: [{ path: "/home/user/test.txt", content: "Hello from the SDK!" }],
})
const cat = await client.sandboxes.exec({
  sandboxId: sandbox.id,
  command: "cat /home/user/test.txt",
})
console.log(`   ✓ File content: "${cat.stdout.trim()}"`)

// ── 6. Read a file from sandbox ────────────────────────────────
console.log(`\n⑥ Reading README from cloned repo...`)
const readme = await client.sandboxes.files.read({
  sandboxId: sandbox.id,
  path: "/home/user/repo/README.md",
})
const preview = readme.content?.slice(0, 200) ?? "(empty)"
console.log(`   ✓ First 200 chars:\n     ${preview}...`)

// ── 7. Exec with cwd ──────────────────────────────────────────
console.log(`\n⑦ Exec with cwd (git log inside repo)...`)
const gitLog = await client.sandboxes.exec({
  sandboxId: sandbox.id,
  command: "git log --oneline -5",
  cwd: "/home/user/repo",
})
console.log(`   ✓ Recent commits:\n${gitLog.stdout.split("\n").map((l: string) => `     ${l}`).join("\n")}`)

// ── 8. Cleanup ─────────────────────────────────────────────────
console.log(`\n⑧ Cleaning up...`)
await client.sandboxes.delete(sandbox.id)
console.log(`   ✓ Sandbox deleted.`)

console.log(`\n✅ All sandbox operations passed!\n`)
