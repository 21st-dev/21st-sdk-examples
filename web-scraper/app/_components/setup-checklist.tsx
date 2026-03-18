"use client"

import { useEffect, useState } from "react"

interface EnvStatus {
  apiKey: boolean
  browserUseKey: boolean
}

interface SetupChecklistProps {
  agentOnline: boolean
}

const CheckIcon = ({ done }: { done: boolean }) =>
  done ? (
    <span className="shrink-0 w-[15px] h-[15px] rounded-full bg-emerald-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] flex items-center justify-center">
      <svg width="8" height="8" viewBox="0 0 10 8" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 4 3.5 6.5 9 1" />
      </svg>
    </span>
  ) : (
    <span className="shrink-0 w-[15px] h-[15px] rounded-full inline-block border-[0.5px] border-black/25 dark:border-white/25" />
  )

const steps = [
  {
    id: "api_key",
    label: "Set API_KEY_21ST",
    hint: "Get it at 21st.dev/settings/api",
    hintUrl: "https://21st.dev/settings/api",
    env: "apiKey" as keyof EnvStatus,
  },
  {
    id: "browser_use_key",
    label: "Set BROWSER_USE_API_KEY",
    hint: "Get it at browser-use.com",
    hintUrl: "https://browser-use.com",
    env: "browserUseKey" as keyof EnvStatus,
  },
  {
    id: "deploy",
    label: "Deploy the agent",
    hint: "Run: npx 21st deploy",
    hintUrl: null,
    env: null,
  },
]

export function SetupChecklist({ agentOnline }: SetupChecklistProps) {
  const [status, setStatus] = useState<EnvStatus | null>(null)

  useEffect(() => {
    fetch("/api/agent/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {})
  }, [])

  if (!status) return null

  const stepsDone = {
    apiKey: status.apiKey,
    browserUseKey: status.browserUseKey,
    deploy: agentOnline,
  }

  return (
    <section className="space-y-1">
      <p className="px-2 text-[10px] font-medium uppercase tracking-widest text-black/25 dark:text-white/25 pb-0.5">
        Get started
      </p>
      <ul className="space-y-0.5">
        {steps.map((step) => {
          const done = step.env ? stepsDone[step.env as keyof typeof stepsDone] : stepsDone.deploy
          return (
            <li key={step.id} className="flex items-start gap-2.5 px-2 py-1">
              <div className="mt-px">
                <CheckIcon done={done} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-medium leading-snug ${done ? "text-black/25 dark:text-white/25" : "text-black/65 dark:text-white/65"}`}>
                  {step.label}
                </p>
                {!done && (
                  <p className="text-[11px] text-black/30 dark:text-white/30 mt-0.5 leading-snug">
                    {step.hintUrl ? (
                      <a
                        href={step.hintUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-black/60 dark:hover:text-white/60 underline underline-offset-2 transition-colors"
                      >
                        {step.hint}
                      </a>
                    ) : (
                      <code className="font-mono">{step.hint}</code>
                    )}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
