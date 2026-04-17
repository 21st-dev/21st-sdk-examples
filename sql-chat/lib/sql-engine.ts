// Demo SQL engine — also used by agents/sql-agent.ts, where it is inlined to
// stay self-contained for CLI bundling. Keep the two in sync.

export type Value = string | number | boolean | null
export type Row = Value[]
export type QueryOk = {
  ok: true
  sql: string
  columns: string[]
  rows: Row[]
  rowCount: number
}
export type QueryErr = { ok: false; sql: string; error: string }
export type QueryResult = QueryOk | QueryErr

type Table = { columns: string[]; rows: Row[] }

export const SCHEMA: Record<string, Table> = {
  customers: {
    columns: ["id", "name", "email", "country", "signup_month"],
    rows: [
      [1, "Ada Reyes", "ada@example.com", "US", "2024-11"],
      [2, "Kenji Tanaka", "kenji@example.com", "JP", "2025-01"],
      [3, "Lena Schmidt", "lena@example.com", "DE", "2025-02"],
      [4, "Ola Kim", "ola@example.com", "KR", "2025-03"],
      [5, "Mateo Silva", "mateo@example.com", "BR", "2025-04"],
      [6, "Priya Rao", "priya@example.com", "IN", "2025-05"],
    ],
  },
  products: {
    columns: ["id", "name", "category", "price_cents"],
    rows: [
      [101, "Starter Plan", "plan", 900],
      [102, "Pro Plan", "plan", 2900],
      [103, "Team Plan", "plan", 9900],
      [201, "Branded Mug", "merch", 1500],
      [202, "Hoodie", "merch", 4500],
    ],
  },
  orders: {
    columns: ["id", "customer_id", "total_cents", "status", "created_at", "notes"],
    rows: [
      [5001, 1, 2900, "paid", "2025-03-04", "renewal"],
      [5002, 2, 9900, "paid", "2025-03-10", ""],
      [5003, 3, 1500, "refunded", "2025-03-11", ""],
      [5004, 1, 4500, "paid", "2025-03-14", "rush delivery"],
      [5005, 4, 9900, "paid", "2025-03-19", ""],
      [5006, 5, 2900, "pending", "2025-03-21", ""],
      [5007, 6, 4500, "paid", "2025-03-22", "gift"],
      [5008, 2, 900, "paid", "2025-04-01", ""],
    ],
  },
  order_items: {
    columns: ["id", "order_id", "product_id", "qty"],
    rows: [
      [1, 5001, 102, 1],
      [2, 5002, 103, 1],
      [3, 5003, 201, 1],
      [4, 5004, 202, 1],
      [5, 5005, 103, 1],
      [6, 5006, 102, 1],
      [7, 5007, 202, 1],
      [8, 5008, 101, 1],
    ],
  },
}

const WRITE_GUARD =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|replace|merge)\b/i

function stripStringLiterals(sql: string): string {
  return sql
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
}

export function runSql(sqlRaw: string): QueryResult {
  const sql = sqlRaw.trim().replace(/;+\s*$/, "")
  if (!sql) return { ok: false, sql, error: "Empty query." }
  if (WRITE_GUARD.test(stripStringLiterals(sql))) {
    return { ok: false, sql, error: "Write operations are not allowed in this demo engine." }
  }

  const countMatch = sql.match(
    /^SELECT\s+COUNT\(\*\)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+LIMIT\s+\d+)?$/i,
  )
  if (countMatch) {
    const [, table, where] = countMatch
    const tbl = SCHEMA[table.toLowerCase()]
    if (!tbl) return { ok: false, sql, error: `Unknown table: ${table}` }
    const filtered = where
      ? filterRows(tbl.rows, tbl.columns, where)
      : ({ ok: true, rows: tbl.rows } as FilterResult)
    if (!filtered.ok) return { ok: false, sql, error: filtered.error }
    return { ok: true, sql, columns: ["count"], rows: [[filtered.rows.length]], rowCount: 1 }
  }

  const selectMatch = sql.match(
    /^SELECT\s+(\*|[\w\s,]+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?)?(?:\s+LIMIT\s+(\d+))?$/i,
  )
  if (!selectMatch) {
    return {
      ok: false,
      sql,
      error:
        "Demo engine supports: SELECT <cols|*> FROM <table> [WHERE col <op> value] [ORDER BY col [ASC|DESC]] [LIMIT n], and SELECT COUNT(*) FROM <table>. No JOINs, no GROUP BY.",
    }
  }

  const [, colsRaw, table, where, orderCol, orderDir, limit] = selectMatch
  const tbl = SCHEMA[table.toLowerCase()]
  if (!tbl) {
    return {
      ok: false,
      sql,
      error: `Unknown table: ${table}. Available: ${Object.keys(SCHEMA).join(", ")}`,
    }
  }

  const allCols = tbl.columns
  const selectedCols =
    colsRaw.trim() === "*" ? allCols.slice() : colsRaw.split(",").map((c) => c.trim())
  for (const c of selectedCols) {
    if (!allCols.includes(c)) {
      return { ok: false, sql, error: `Unknown column "${c}" in ${table}` }
    }
  }

  let rows: Row[] = tbl.rows.slice()
  if (where) {
    const filtered = filterRows(rows, allCols, where)
    if (!filtered.ok) return { ok: false, sql, error: filtered.error }
    rows = filtered.rows
  }

  if (orderCol) {
    const idx = allCols.indexOf(orderCol)
    if (idx === -1) return { ok: false, sql, error: `Unknown column in ORDER BY: ${orderCol}` }
    const dir = orderDir?.toUpperCase() === "DESC" ? -1 : 1
    rows.sort((a, b) => {
      const av = a[idx]
      const bv = b[idx]
      if (av === bv) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return av < bv ? -1 * dir : 1 * dir
    })
  }

  if (limit) rows = rows.slice(0, parseInt(limit, 10))

  const colIdx = selectedCols.map((c) => allCols.indexOf(c))
  const projected = rows.map((r) => colIdx.map((i) => r[i]))
  return { ok: true, sql, columns: selectedCols, rows: projected, rowCount: projected.length }
}

type FilterResult = { ok: true; rows: Row[] } | { ok: false; error: string }

function filterRows(rows: Row[], cols: string[], whereRaw: string): FilterResult {
  const where = whereRaw.trim()
  const m = where.match(
    /^(\w+)\s*(=|!=|<>|<=|>=|<|>|LIKE)\s*(?:'([^']*)'|"([^"]*)"|(-?\d+(?:\.\d+)?))$/i,
  )
  if (!m) {
    return {
      ok: false,
      error: `Unsupported WHERE clause: "${whereRaw}". Supported form: col <op> 'string' | number. Ops: = != <> < <= > >= LIKE.`,
    }
  }
  const [, col, opRaw, s1, s2, numRaw] = m
  const idx = cols.indexOf(col)
  if (idx === -1) return { ok: false, error: `Unknown column in WHERE: ${col}` }
  const op = opRaw.toUpperCase()
  const target: Value = s1 !== undefined ? s1 : s2 !== undefined ? s2 : Number(numRaw)

  const test = (v: Value): boolean => {
    if (op === "LIKE") {
      const pattern = String(target)
        .replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")
        .replace(/\\%/g, ".*")
      return new RegExp(`^${pattern}$`, "i").test(String(v))
    }
    if (op === "!=" || op === "<>") return v !== target
    if (op === "=") return v === target
    if (typeof v === "number" && typeof target === "number") {
      if (op === "<") return v < target
      if (op === "<=") return v <= target
      if (op === ">") return v > target
      if (op === ">=") return v >= target
    }
    return false
  }
  return { ok: true, rows: rows.filter((r) => test(r[idx])) }
}

export function schemaSummary() {
  return Object.entries(SCHEMA).map(([name, t]) => ({
    name,
    columns: t.columns,
    sampleRowCount: t.rows.length,
  }))
}
