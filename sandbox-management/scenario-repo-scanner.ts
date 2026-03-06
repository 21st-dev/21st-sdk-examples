/**
 * Scenario: Repo Health Scanner
 *
 * A real use case — clone any public repo into a sandbox and run
 * automated analysis: code stats, dependency audit, TODO hunting,
 * git activity. Outputs a structured health report.
 *
 * Usage:
 *   REPO_URL=https://github.com/expressjs/express.git npx tsx --env-file=.env scenario-repo-scanner.ts
 */
import { AnClient } from "@21st-sdk/node"

const AN_API_KEY = process.env.AN_API_KEY!
const REPO_URL = process.env.REPO_URL || "https://github.com/sindresorhus/got.git"
const RELAY_URL = process.env.AN_RELAY_URL || "https://relay.an.dev"

if (!AN_API_KEY) {
  console.error("AN_API_KEY is required.")
  process.exit(1)
}

const client = new AnClient({ apiKey: AN_API_KEY, baseUrl: RELAY_URL })

const repoName = REPO_URL.split("/").pop()?.replace(".git", "") ?? "repo"
console.log(`\n🔍 Scanning: ${REPO_URL}\n${"─".repeat(60)}`)

// ── Setup sandbox & clone ──────────────────────────────────────
const sandbox = await client.sandboxes.create({ agent: "repo-reviewer" })
const sbx = sandbox.id

await client.sandboxes.git.clone({
  sandboxId: sbx,
  url: REPO_URL,
  path: "/home/user/repo",
  depth: 50,
})

const run = async (cmd: string, cwd = "/home/user/repo") => {
  const r = await client.sandboxes.exec({ sandboxId: sbx, command: cmd, cwd })
  return r.stdout.trim()
}

// ── Analysis ───────────────────────────────────────────────────

// 1. Basic stats
const fileCount = await run("find . -type f -not -path './.git/*' | wc -l")
const dirCount = await run("find . -type d -not -path './.git/*' | wc -l")
const totalLines = await run("find . -type f -not -path './.git/*' \\( -name '*.ts' -o -name '*.js' -o -name '*.py' -o -name '*.go' -o -name '*.rs' \\) | xargs wc -l 2>/dev/null | tail -1 || echo '0'")

console.log(`\n📊 Code Stats`)
console.log(`   Files: ${fileCount}`)
console.log(`   Directories: ${dirCount}`)
console.log(`   Lines of code: ${totalLines}`)

// 2. Language breakdown
const langBreakdown = await run(`
  echo "Extension | Files | Lines" && echo "--- | --- | ---" &&
  for ext in ts js tsx jsx py go rs java rb; do
    count=$(find . -not -path './.git/*' -name "*.$ext" 2>/dev/null | wc -l)
    if [ "$count" -gt 0 ]; then
      lines=$(find . -not -path './.git/*' -name "*.$ext" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')
      echo ".$ext | $count | $lines"
    fi
  done
`)
console.log(`\n📂 Languages`)
langBreakdown.split("\n").forEach((l) => console.log(`   ${l}`))

// 3. Dependency check (if package.json exists)
const hasPkg = await run("test -f package.json && echo yes || echo no")
if (hasPkg === "yes") {
  const deps = await run("node -e \"const p=require('./package.json'); console.log('deps:', Object.keys(p.dependencies||{}).length, '| devDeps:', Object.keys(p.devDependencies||{}).length)\"")
  console.log(`\n📦 Dependencies`)
  console.log(`   ${deps}`)

  const outdated = await run("cat package.json | node -e \"const p=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); const deps={...p.dependencies,...p.devDependencies}; const pinned=Object.entries(deps).filter(([,v])=>!v.startsWith('^')&&!v.startsWith('~')).map(([k])=>k); console.log(pinned.length ? pinned.join(', ') : 'none')\"")
  console.log(`   Pinned versions: ${outdated}`)
}

// 4. TODOs and FIXMEs
const todos = await run("grep -rn 'TODO\\|FIXME\\|HACK\\|XXX' --include='*.ts' --include='*.js' --include='*.py' --include='*.go' . 2>/dev/null | head -10 || echo 'none found'")
const todoCount = await run("grep -rn 'TODO\\|FIXME\\|HACK\\|XXX' --include='*.ts' --include='*.js' --include='*.py' --include='*.go' . 2>/dev/null | wc -l || echo '0'")
console.log(`\n🚧 TODOs/FIXMEs (${todoCount} total)`)
todos.split("\n").slice(0, 5).forEach((l) => console.log(`   ${l.slice(0, 120)}`))
if (parseInt(todoCount) > 5) console.log(`   ... and ${parseInt(todoCount) - 5} more`)

// 5. Git activity
const commitCount = await run("git rev-list --count HEAD 2>/dev/null || echo 'unknown'")
const lastCommit = await run("git log -1 --format='%h %s (%ar)' 2>/dev/null || echo 'unknown'")
const contributors = await run("git shortlog -sn --no-merges HEAD 2>/dev/null | head -5 || echo 'unknown'")
console.log(`\n📜 Git Activity`)
console.log(`   Commits: ${commitCount}`)
console.log(`   Last: ${lastCommit}`)
console.log(`   Top contributors:`)
contributors.split("\n").forEach((l) => console.log(`     ${l.trim()}`))

// 6. Large files check
const largeFiles = await run("find . -not -path './.git/*' -type f -size +100k -exec ls -lh {} \\; 2>/dev/null | awk '{print $5, $NF}' | sort -rh | head -5 || echo 'none'")
console.log(`\n⚠️  Large files (>100KB)`)
largeFiles.split("\n").forEach((l) => console.log(`   ${l}`))

// ── Cleanup ────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`)
await client.sandboxes.delete(sbx)
console.log(`✅ Scan complete. Sandbox cleaned up.\n`)
