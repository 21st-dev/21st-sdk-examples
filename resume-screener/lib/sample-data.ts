export const SAMPLE_JD = `Senior Backend Engineer — Infra team

We're hiring a senior backend engineer to own our core data pipelines and API layer.
You'll work on a TypeScript/Node + Postgres stack with heavy use of Redis and background workers.

Must have:
- 5+ years building production backend systems
- Strong TypeScript or Go
- Experience with Postgres at scale (indexing, query planning, partitioning)
- Distributed systems fundamentals (queues, idempotency, retries)

Nice to have:
- Startup experience (0→1 ownership)
- Built CI/CD or deploy tooling
- Experience with Kubernetes or managed container platforms
- Open source contributions`

export type Candidate = {
  id: string
  name: string
  headline: string
  text: string
}

export const SAMPLE_CANDIDATES: Candidate[] = [
  {
    id: "c1",
    name: "Jordan Mercer",
    headline: "Staff Engineer · 9 yrs · TypeScript/Go · ex-Stripe",
    text: `Staff engineer with 9 years of production backend experience. Spent 4 years at Stripe on the payments data platform, owning Postgres partitioning for a 40-billion-row ledger table. Shipped a Redis-backed idempotency layer that eliminated double-charge bugs. Wrote the team's CI/CD tooling in TypeScript (replaced a 3-year-old Jenkins setup). Before that, 3 years at an early-stage Series A fintech as a founding engineer — built the initial API, auth, and billing from scratch. Open source: maintainer of a small Postgres client library. Comfortable with Kubernetes in production (EKS, 200+ services). Strong preference for small, focused teams.`,
  },
  {
    id: "c2",
    name: "Priya Shah",
    headline: "Senior Engineer · 6 yrs · Go · distributed systems",
    text: `Senior backend engineer with 6 years shipping distributed systems in Go. Currently at Cloudflare on the Workers platform team, where I built a multi-tenant job scheduler processing 2M jobs/day. Deep Postgres chops — wrote a migration that re-indexed a live 5TB table without downtime using pg_repack. Led the team's on-call rotation and runbook program. At my previous gig (a 30-person startup), I was employee #7 and built the entire backend stack end-to-end. Some TypeScript experience (React admin tools) but primarily a Go engineer. No K8s experience — we used Nomad. Open source: small contributions to Temporal.`,
  },
  {
    id: "c3",
    name: "Marcus Okafor",
    headline: "Senior Engineer · 8 yrs · Node/TypeScript · infra",
    text: `Senior TypeScript engineer with 8 years across three startups and a mid-size SaaS. Built the data ingestion pipeline at my current company (Segment-like, ~500k events/sec at peak) using Node streams, Kafka, and Postgres. Strong on indexing and query planning — authored the team's internal "query review" checklist. Shipped CI/CD in GitHub Actions + custom Go runners. Kubernetes in production for 4 years (GKE, Helm, ArgoCD). Led two 0→1 projects including a background worker framework now used by 12 services. Looking for a senior IC role where I can own a major system end to end.`,
  },
  {
    id: "c4",
    name: "Elena Rossi",
    headline: "Backend Engineer · 4 yrs · Python/TypeScript",
    text: `Backend engineer with 4 years of experience, primarily at a large ad-tech company. Built ETL pipelines in Python (Airflow) and recently shifted to TypeScript for a new API service. Postgres experience is solid at application level but I haven't worked on partitioning or anything beyond basic index tuning. Built one background worker system using BullMQ — learned Redis patterns like idempotency keys and retry backoff through that project. No K8s production experience (only dev playground). Interested in growing into a senior role; this JD feels like a stretch but exciting.`,
  },
  {
    id: "c5",
    name: "Ben Whitaker",
    headline: "Full-stack Developer · 3 yrs · JavaScript/React",
    text: `Full-stack developer with 3 years of experience, mostly React + Express. Built a small e-commerce platform for a boutique client and maintained the backend (Node/Express, MongoDB). Limited Postgres exposure. No direct distributed-systems work — my services have all been single-instance. Interested in backend roles and willing to learn; recently finished a "designing data-intensive applications" reading group. No CI/CD tooling work beyond writing basic GitHub Actions workflows for my own projects.`,
  },
]
