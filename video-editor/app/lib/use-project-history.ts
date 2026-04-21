"use client"

import { useCallback, useRef, useState } from "react"
import type { Project } from "./project"
import { type Op, applyOps } from "./project-ops"

const HISTORY_CAP = 100

export interface ProjectHistory {
  project: Project
  apply: (ops: Op[]) => void
  /** Replace the whole project (used by hydration or `clear_timeline`). */
  set: (project: Project, snapshot?: boolean) => void
  undo: () => boolean
  redo: () => boolean
  canUndo: boolean
  canRedo: boolean
}

/**
 * History-aware project state. Every mutation pushes the *previous* project
 * onto an undo stack; redo is cleared on any forward mutation.
 *
 * `snapshot = false` on `set` skips the history entry — used during
 * hydration so the restored project doesn't show up as "one undo away".
 *
 * We keep a single "version" counter in React state to force re-renders
 * when the history stacks change; `canUndo` / `canRedo` are *derived* from
 * the ref stacks so we never get into an inconsistent state where the UI
 * disagrees with the actual stacks.
 */
export function useProjectHistory(initial: Project): ProjectHistory {
  const [project, setProjectState] = useState<Project>(initial)
  // Version bumps force a render so canUndo/canRedo are re-read.
  const [, bumpVersion] = useState(0)
  const undoStackRef = useRef<Project[]>([])
  const redoStackRef = useRef<Project[]>([])

  const forceRerender = useCallback(() => {
    bumpVersion((v) => v + 1)
  }, [])

  const apply = useCallback(
    (ops: Op[]) => {
      setProjectState((prev) => {
        const next = applyOps(prev, ops)
        if (next === prev) return prev
        undoStackRef.current.push(prev)
        if (undoStackRef.current.length > HISTORY_CAP) undoStackRef.current.shift()
        redoStackRef.current = []
        return next
      })
      forceRerender()
    },
    [forceRerender],
  )

  const set = useCallback(
    (next: Project, snapshot = true) => {
      setProjectState((prev) => {
        if (prev === next) return prev
        if (snapshot) {
          undoStackRef.current.push(prev)
          if (undoStackRef.current.length > HISTORY_CAP) undoStackRef.current.shift()
          redoStackRef.current = []
        }
        return next
      })
      forceRerender()
    },
    [forceRerender],
  )

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return false
    setProjectState((prev) => {
      const target = undoStackRef.current.pop()!
      redoStackRef.current.push(prev)
      return target
    })
    forceRerender()
    return true
  }, [forceRerender])

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return false
    setProjectState((prev) => {
      const target = redoStackRef.current.pop()!
      undoStackRef.current.push(prev)
      return target
    })
    forceRerender()
    return true
  }, [forceRerender])

  return {
    project,
    apply,
    set,
    undo,
    redo,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
  }
}
