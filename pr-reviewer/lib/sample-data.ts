export type PatchLine = {
  line: number
  kind: "add" | "remove" | "context"
  text: string
}

export type PatchFile = {
  path: string
  patch: PatchLine[]
}

export type SamplePr = {
  id: string
  title: string
  description: string
  files: PatchFile[]
}

export const SAMPLE_PRS: SamplePr[] = [
  {
    id: "pr-001",
    title: "feat: add redis caching for user lookups",
    description:
      "Adds a Redis-backed cache in front of the users table. Cache TTL is 5 minutes. Invalidation on update.",
    files: [
      {
        path: "src/users/service.ts",
        patch: [
          { line: 10, kind: "context", text: "import { redis } from '../lib/redis'" },
          { line: 11, kind: "context", text: "import { db } from '../lib/db'" },
          { line: 12, kind: "context", text: "" },
          { line: 13, kind: "context", text: "export async function getUser(id: string) {" },
          { line: 14, kind: "add", text: "  const cached = await redis.get(`user:${id}`)" },
          { line: 15, kind: "add", text: "  if (cached) return JSON.parse(cached)" },
          { line: 16, kind: "context", text: "  const user = await db.users.findUnique({ where: { id } })" },
          { line: 17, kind: "add", text: "  await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 300)" },
          { line: 18, kind: "context", text: "  return user" },
          { line: 19, kind: "context", text: "}" },
        ],
      },
      {
        path: "src/users/mutations.ts",
        patch: [
          { line: 4, kind: "context", text: "import { db } from '../lib/db'" },
          { line: 5, kind: "add", text: "import { redis } from '../lib/redis'" },
          { line: 6, kind: "context", text: "" },
          { line: 7, kind: "context", text: "export async function updateUser(id: string, patch: Partial<User>) {" },
          { line: 8, kind: "context", text: "  const user = await db.users.update({ where: { id }, data: patch })" },
          { line: 9, kind: "add", text: "  await redis.del(`user:${id}`)" },
          { line: 10, kind: "context", text: "  return user" },
          { line: 11, kind: "context", text: "}" },
        ],
      },
    ],
  },
  {
    id: "pr-002",
    title: "fix: auth middleware off-by-one on session expiry",
    description: "Session expiry was compared with `<` instead of `<=`, causing last-second rejections.",
    files: [
      {
        path: "src/auth/middleware.ts",
        patch: [
          { line: 22, kind: "context", text: "  const session = await getSession(token)" },
          { line: 23, kind: "context", text: "  if (!session) return res.status(401).end()" },
          { line: 24, kind: "remove", text: "  if (session.expiresAt < Date.now()) {" },
          { line: 24, kind: "add", text: "  if (session.expiresAt <= Date.now()) {" },
          { line: 25, kind: "context", text: "    return res.status(401).end()" },
          { line: 26, kind: "context", text: "  }" },
          { line: 27, kind: "context", text: "  req.userId = session.userId" },
          { line: 28, kind: "context", text: "  next()" },
        ],
      },
    ],
  },
  {
    id: "pr-003",
    title: "refactor: clean up orders queries",
    description: "Pulls order filtering logic out of the controller and into the service layer.",
    files: [
      {
        path: "src/orders/service.ts",
        patch: [
          { line: 12, kind: "add", text: "export async function listOrdersForUser(userId: string) {" },
          { line: 13, kind: "add", text: "  const orders = await db.orders.findMany({ where: { userId } })" },
          { line: 14, kind: "add", text: "  const enriched = []" },
          { line: 15, kind: "add", text: "  for (const o of orders) {" },
          { line: 16, kind: "add", text: "    const items = await db.order_items.findMany({ where: { orderId: o.id } })" },
          { line: 17, kind: "add", text: "    enriched.push({ ...o, items })" },
          { line: 18, kind: "add", text: "  }" },
          { line: 19, kind: "add", text: "  return enriched" },
          { line: 20, kind: "add", text: "}" },
        ],
      },
      {
        path: "src/orders/search.ts",
        patch: [
          { line: 7, kind: "context", text: "export async function searchOrders(q: string) {" },
          { line: 8, kind: "remove", text: "  const rows = await db.orders.findMany({ where: { notes: { contains: q } } })" },
          { line: 8, kind: "add", text: "  const sql = `SELECT * FROM orders WHERE notes LIKE '%${q}%'`" },
          { line: 9, kind: "add", text: "  const rows = await db.$queryRawUnsafe(sql)" },
          { line: 10, kind: "context", text: "  return rows" },
          { line: 11, kind: "context", text: "}" },
        ],
      },
    ],
  },
]

export function getPr(id: string): SamplePr | undefined {
  return SAMPLE_PRS.find((p) => p.id === id)
}
