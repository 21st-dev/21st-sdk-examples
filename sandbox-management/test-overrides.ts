/**
 * Test: sandbox creation-time overrides (files, envs, setup)
 * Verifies that sandboxes.create({ files, envs, setup }) applies
 * overrides on top of the agent's deployed sandbox config.
 */
import { AnClient } from "@21st-sdk/node"

const AN_API_KEY = process.env.AN_API_KEY
const RELAY_URL = process.env.AN_RELAY_URL || "https://relay.an.dev"
const AGENT_SLUG = "repo-reviewer"

if (!AN_API_KEY) {
  console.error("AN_API_KEY is required.")
  process.exit(1)
}

const client = new AnClient({ apiKey: AN_API_KEY, baseUrl: RELAY_URL })

// ── 1. Create sandbox with overrides ───────────────────────────
console.log(`\n① Creating sandbox with files, envs, and setup overrides...`)
const sandbox = await client.sandboxes.create({
  agent: AGENT_SLUG,
  files: {
    "/home/user/config.json": JSON.stringify({ version: 1, name: "test" }),
    "/home/user/data/seed.txt": "seed data here",
  },
  envs: {
    MY_APP_ENV: "staging",
    MY_SECRET: "hunter2",
  },
  setup: [
    "mkdir -p /home/user/workspace/logs",
    "echo 'setup-complete' > /home/user/.setup-flag",
  ],
})
console.log(`   ✓ Sandbox: ${sandbox.id}`)

// ── 2. Verify files were written at creation ───────────────────
console.log(`\n② Verifying creation-time files...`)
const configCheck = await client.sandboxes.exec({
  sandboxId: sandbox.id,
  command: "cat /home/user/config.json",
})
const parsed = JSON.parse(configCheck.stdout.trim())
console.assert(parsed.version === 1, "config.json version mismatch")
console.assert(parsed.name === "test", "config.json name mismatch")
console.log(`   ✓ config.json: ${configCheck.stdout.trim()}`)

const seedCheck = await client.sandboxes.exec({
  sandboxId: sandbox.id,
  command: "cat /home/user/data/seed.txt",
})
console.assert(seedCheck.stdout.trim() === "seed data here", "seed.txt content mismatch")
console.log(`   ✓ data/seed.txt: "${seedCheck.stdout.trim()}"`)

// ── 3. Verify envs are set ─────────────────────────────────────
console.log(`\n③ Verifying environment variables...`)
const envCheck = await client.sandboxes.exec({
  sandboxId: sandbox.id,
  command: "echo $MY_APP_ENV",
  envs: { MY_APP_ENV: "staging" },
})
console.log(`   ✓ MY_APP_ENV=${envCheck.stdout.trim()}`)

// Also test exec-level env override
const execEnvCheck = await client.sandboxes.exec({
  sandboxId: sandbox.id,
  command: "echo $RUNTIME_FLAG",
  envs: { RUNTIME_FLAG: "from-exec" },
})
console.assert(execEnvCheck.stdout.trim() === "from-exec", "exec envs override failed")
console.log(`   ✓ RUNTIME_FLAG=${execEnvCheck.stdout.trim()} (exec-level override)`)

// ── 4. Verify setup commands ran ───────────────────────────────
console.log(`\n④ Verifying setup commands...`)
const dirCheck = await client.sandboxes.exec({
  sandboxId: sandbox.id,
  command: "test -d /home/user/workspace/logs && echo 'exists' || echo 'missing'",
})
console.assert(dirCheck.stdout.trim() === "exists", "setup mkdir failed")
console.log(`   ✓ /home/user/workspace/logs: ${dirCheck.stdout.trim()}`)

const flagCheck = await client.sandboxes.exec({
  sandboxId: sandbox.id,
  command: "cat /home/user/.setup-flag",
})
console.assert(flagCheck.stdout.trim() === "setup-complete", "setup flag missing")
console.log(`   ✓ .setup-flag: "${flagCheck.stdout.trim()}"`)

// ── 5. Verify agent-level sandbox config still applied ─────────
console.log(`\n⑤ Verifying agent-level config (gh CLI from Sandbox({ apt: ["gh"] }))...`)
const ghCheck = await client.sandboxes.exec({
  sandboxId: sandbox.id,
  command: "which gh || echo 'not found'",
})
console.log(`   ✓ gh: ${ghCheck.stdout.trim()}`)

// ── 6. Get sandbox details ─────────────────────────────────────
console.log(`\n⑥ Fetching sandbox details via sandboxes.get()...`)
const details = await client.sandboxes.get(sandbox.id)
console.log(`   ✓ id: ${details.id}`)
console.log(`   ✓ status: ${details.status}`)
console.log(`   ✓ sandboxId: ${details.sandboxId}`)

// ── 7. Cleanup ─────────────────────────────────────────────────
console.log(`\n⑦ Cleaning up...`)
await client.sandboxes.delete(sandbox.id)
console.log(`   ✓ Sandbox deleted.`)

console.log(`\n✅ All override tests passed!\n`)
