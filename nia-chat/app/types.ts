export interface ThreadItem {
  id: string
  name?: string | null
  status: string
  createdAt: string
}

export interface ChatSession {
  id: string
  name: string
  repository: string
  sandboxId: string
  threadId: string
  createdAt: string
}
