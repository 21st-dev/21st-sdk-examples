"use client"

import { atom } from "jotai"

/** Left sidebar open state. */
export const isSidebarOpenAtom = atom<boolean>(true)

/** Active tab in the left sidebar. */
export type SidebarTab = "pages" | "shapes" | "design" | "help"
export const activeSidebarTabAtom = atom<SidebarTab>("pages")

/** Is the help-center dialog open? */
export const isHelpCenterOpenAtom = atom<boolean>(false)

/** Is plan mode on? Swaps the agent's approach from execute to plan-first. */
export const isPlanModeAtom = atom<boolean>(false)

/** Has the user seen the first-run tour? */
export const hasSeenTourAtom = atom<boolean>(
  typeof window !== "undefined" &&
    localStorage.getItem("canvas-template:seen-tour") === "1",
)
