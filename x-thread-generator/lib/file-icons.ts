// Central map for file-type visuals. Used by code frame headers (Supabase,
// Resend, branded Default) and by the FileCard attachment tile. One place to
// add a new language/extension; everywhere picks it up.

export type FileIconBadge = {
  // Small 2–3 letter label shown on the colored square.
  label: string
  // Background color (dominant brand / language color).
  bg: string
  // Foreground (label) color — defaults to white but some bright bgs need dark.
  fg?: string
}

const BADGES: Record<string, FileIconBadge> = {
  // TypeScript / JavaScript family
  ts: { label: "TS", bg: "#3178c6" },
  tsx: { label: "TSX", bg: "#087ea4" },
  js: { label: "JS", bg: "#f7df1e", fg: "#1a1a1a" },
  jsx: { label: "JSX", bg: "#61dafb", fg: "#1a1a1a" },
  mjs: { label: "JS", bg: "#f7df1e", fg: "#1a1a1a" },
  cjs: { label: "JS", bg: "#f7df1e", fg: "#1a1a1a" },
  // Python / Ruby
  py: { label: "PY", bg: "#3776ab" },
  python: { label: "PY", bg: "#3776ab" },
  rb: { label: "RB", bg: "#cc342d" },
  // Systems
  go: { label: "GO", bg: "#00add8" },
  rs: { label: "RS", bg: "#dea584", fg: "#1a1a1a" },
  rust: { label: "RS", bg: "#dea584", fg: "#1a1a1a" },
  java: { label: "JV", bg: "#f89820" },
  kt: { label: "KT", bg: "#7f52ff" },
  swift: { label: "SW", bg: "#f05138" },
  c: { label: "C", bg: "#a8b9cc", fg: "#1a1a1a" },
  cpp: { label: "C++", bg: "#00599c" },
  h: { label: "H", bg: "#a8b9cc", fg: "#1a1a1a" },
  hpp: { label: "H++", bg: "#00599c" },
  cs: { label: "C#", bg: "#239120" },
  // Data / query
  sql: { label: "SQL", bg: "#336791" },
  prisma: { label: "PRI", bg: "#2d3748" },
  graphql: { label: "GQL", bg: "#e535ab" },
  gql: { label: "GQL", bg: "#e535ab" },
  // Shells / infra
  sh: { label: "SH", bg: "#2b2b2b" },
  bash: { label: "SH", bg: "#2b2b2b" },
  zsh: { label: "SH", bg: "#2b2b2b" },
  fish: { label: "SH", bg: "#2b2b2b" },
  dockerfile: { label: "DOCK", bg: "#2496ed" },
  docker: { label: "DOCK", bg: "#2496ed" },
  // Config / data
  json: { label: "JSON", bg: "#cbcb41", fg: "#1a1a1a" },
  jsonc: { label: "JSON", bg: "#cbcb41", fg: "#1a1a1a" },
  yaml: { label: "YML", bg: "#cb171e" },
  yml: { label: "YML", bg: "#cb171e" },
  toml: { label: "TOML", bg: "#9c4221" },
  env: { label: "ENV", bg: "#ecd53f", fg: "#1a1a1a" },
  // Web
  html: { label: "HTML", bg: "#e34f26" },
  css: { label: "CSS", bg: "#1572b6" },
  scss: { label: "SCSS", bg: "#cf649a" },
  less: { label: "LESS", bg: "#1d365d" },
  // Markup
  md: { label: "MD", bg: "#083fa1" },
  mdx: { label: "MDX", bg: "#f9ac00", fg: "#1a1a1a" },
  xml: { label: "XML", bg: "#e54d26" },
  svg: { label: "SVG", bg: "#ffb13b", fg: "#1a1a1a" },
  // Generic doc / archive
  pdf: { label: "PDF", bg: "#dc2626" },
  zip: { label: "ZIP", bg: "#f59e0b", fg: "#1a1a1a" },
  tar: { label: "TAR", bg: "#f59e0b", fg: "#1a1a1a" },
  gz: { label: "GZ", bg: "#f59e0b", fg: "#1a1a1a" },
  // Images / media (used by attachments)
  png: { label: "IMG", bg: "#0ea5e9" },
  jpg: { label: "IMG", bg: "#0ea5e9" },
  jpeg: { label: "IMG", bg: "#0ea5e9" },
  webp: { label: "IMG", bg: "#0ea5e9" },
  gif: { label: "GIF", bg: "#0ea5e9" },
  mp4: { label: "VID", bg: "#8b5cf6" },
  mov: { label: "VID", bg: "#8b5cf6" },
  webm: { label: "VID", bg: "#8b5cf6" },
  // Office
  xlsx: { label: "XLS", bg: "#16a34a" },
  xls: { label: "XLS", bg: "#16a34a" },
  csv: { label: "CSV", bg: "#16a34a" },
  docx: { label: "DOC", bg: "#2563eb" },
  doc: { label: "DOC", bg: "#2563eb" },
  pptx: { label: "PPT", bg: "#ea580c" },
  ppt: { label: "PPT", bg: "#ea580c" },
  key: { label: "KEY", bg: "#ea580c" },
}

const FALLBACK: FileIconBadge = { label: "FILE", bg: "#475569" }

// Resolve an extension OR full filename to a badge.
export function badgeFromExt(ext: string): FileIconBadge {
  return BADGES[ext.toLowerCase()] ?? FALLBACK
}

export function badgeFromFilename(filename: string): FileIconBadge {
  if (!filename) return FALLBACK
  const lower = filename.toLowerCase().trim()
  if (lower === "dockerfile" || lower.endsWith(".dockerfile")) return BADGES.dockerfile
  const dot = filename.lastIndexOf(".")
  if (dot < 0) return FALLBACK
  return badgeFromExt(filename.slice(dot + 1))
}
