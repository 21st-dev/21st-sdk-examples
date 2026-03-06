/**
 * Scenario: Safe Code Runner
 *
 * A real use case — users submit code snippets, we run them in
 * an isolated sandbox and return the output. Like a hosted REPL
 * (CodeSandbox, Replit) but via API.
 *
 * Demonstrates: files.write → exec → files.read, multiple languages,
 * timeout handling, error capture.
 *
 * Usage:
 *   npx tsx --env-file=.env scenario-code-runner.ts
 */
import { AnClient } from "@21st-sdk/node"

const AN_API_KEY = process.env.AN_API_KEY!
const RELAY_URL = process.env.AN_RELAY_URL || "https://relay.an.dev"

if (!AN_API_KEY) {
  console.error("AN_API_KEY is required.")
  process.exit(1)
}

const client = new AnClient({ apiKey: AN_API_KEY, baseUrl: RELAY_URL })

// ── Simulated user submissions ─────────────────────────────────
const submissions = [
  {
    name: "Fibonacci (Node.js)",
    file: "/home/user/submissions/fib.js",
    code: `
function fib(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
  return b;
}
console.log("fib(10) =", fib(10));
console.log("fib(30) =", fib(30));
console.log("fib(50) =", fib(50));
    `.trim(),
    run: "node /home/user/submissions/fib.js",
  },
  {
    name: "HTTP server test (Node.js)",
    file: "/home/user/submissions/server-test.js",
    code: `
const http = require("http");

// Start a server, hit it, print response, shut down
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
});

server.listen(0, async () => {
  const port = server.address().port;
  const res = await fetch("http://localhost:" + port);
  const data = await res.json();
  console.log("Server responded:", JSON.stringify(data));
  console.log("Port:", port);
  server.close();
});
    `.trim(),
    run: "node /home/user/submissions/server-test.js",
  },
  {
    name: "Shell pipeline (bash)",
    file: "/home/user/submissions/pipeline.sh",
    code: `
#!/bin/bash
# Generate fake log data and analyze it
for i in $(seq 1 100); do
  level=$((RANDOM % 3))
  case $level in
    0) echo "$(date -u +%Y-%m-%dT%H:%M:%S) INFO  Request processed in $((RANDOM % 500))ms" ;;
    1) echo "$(date -u +%Y-%m-%dT%H:%M:%S) WARN  Slow query: $((RANDOM % 2000 + 500))ms" ;;
    2) echo "$(date -u +%Y-%m-%dT%H:%M:%S) ERROR Connection refused to db-$((RANDOM % 3))" ;;
  esac
done > /tmp/app.log

echo "=== Log Analysis ==="
echo "Total lines: $(wc -l < /tmp/app.log)"
echo "INFO:  $(grep -c INFO /tmp/app.log)"
echo "WARN:  $(grep -c WARN /tmp/app.log)"
echo "ERROR: $(grep -c ERROR /tmp/app.log)"
echo ""
echo "=== Slowest queries ==="
grep WARN /tmp/app.log | sort -t: -k4 -rn | head -3
echo ""
echo "=== Error breakdown ==="
grep ERROR /tmp/app.log | grep -oP 'db-\\d+' | sort | uniq -c | sort -rn
    `.trim(),
    run: "bash /home/user/submissions/pipeline.sh",
  },
  {
    name: "Intentional error (Node.js)",
    file: "/home/user/submissions/bad.js",
    code: `
// This should fail — test error capture
const result = JSON.parse("not valid json {{{");
console.log(result);
    `.trim(),
    run: "node /home/user/submissions/bad.js",
  },
]

// ── Run all submissions in a single sandbox ────────────────────
console.log(`\n🖥️  Code Runner — ${submissions.length} submissions\n${"─".repeat(60)}`)

const sandbox = await client.sandboxes.create({ agent: "repo-reviewer" })
const sbx = sandbox.id
console.log(`Sandbox ready: ${sbx}\n`)

// Create submissions directory
await client.sandboxes.exec({ sandboxId: sbx, command: "mkdir -p /home/user/submissions" })

for (const sub of submissions) {
  console.log(`▸ ${sub.name}`)

  // Write code to sandbox
  await client.sandboxes.files.write({
    sandboxId: sbx,
    files: [{ path: sub.file, content: sub.code }],
  })

  // Execute with timeout
  const result = await client.sandboxes.exec({
    sandboxId: sbx,
    command: sub.run,
    timeoutMs: 10_000,
  })

  if (result.exitCode === 0) {
    console.log(`  ✓ exit: 0`)
    result.stdout.split("\n").forEach((l: string) => console.log(`  │ ${l}`))
  } else {
    console.log(`  ✗ exit: ${result.exitCode}`)
    result.stderr.split("\n").slice(0, 5).forEach((l: string) => console.log(`  │ ${l}`))
  }
  console.log()
}

// ── Cleanup ────────────────────────────────────────────────────
await client.sandboxes.delete(sbx)
console.log(`${"─".repeat(60)}`)
console.log(`✅ All submissions executed. Sandbox cleaned up.\n`)
