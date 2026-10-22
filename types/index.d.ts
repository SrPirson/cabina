export type RateLimit = { kind: string; percentUsed: number; resetsAt?: string }

// Un subagente (o compañero de equipo) de la sesión y lo que lleva gastado.
export type AgentStat = {
  id: string
  type: string
  desc: string
  parentId?: string
  tokens: number
  out: number
  tools: number
  startedAt: number
  endedAt?: number
}

// Último disparo de un evento con hooks en settings.json (PreToolUse, Stop…).
export type HookStat = { at: number; busy: boolean; blocked: boolean; detail?: string }

export type Snapshot = {
  model: string
  effort?: string
  ctxTokens?: number
  ctxWindow: number
  ctxPercent?: number
  limits: RateLimit[]
  costUsd?: number
  compactions: number
  busySince?: number
  tool?: string
  agents: string[]
  crew: AgentStat[]
  hooks: Record<string, HookStat>
  lastTurn?: { durationMs: number; costUsd: number }
  cwd: string
  branch?: string
  git?: { changed: number; plus: number; minus: number }
  files: string[]
  tools: Record<string, number>
  prompts: number
  startedAt?: number
  ctxTrend: number[]
  costTrend: number[]
  termLight?: boolean
  turnCostStart?: number
  schema?: number
  version?: string
  latest?: string
  updating?: 'running' | 'done'
  now: number
}

export type Strings = {
  context: string; h5: string; d7: string; spend: string; cost: string; last: string
  agents: string; running: string; idle: string; compact: string; compacted: string
  opened: string; closed: string; describe: string
  settings: string; language: string; theme: string; auto: string; other: string; otherHint: string; close: string; hint: string
  session: string; prompts: string; tools: string; trend: string; files: string; uncommitted: string; clean: string
  background: string; bgAuto: string; bgDark: string; bgLight: string
  secUsage: string; secCost: string; secActivity: string; secProject: string; total: string; duration: string; edited: string
  sections: string; secTrend: string; secAgents: string; secHooks: string; blocked: string; ago: string
  tClassic: string; tColorblind: string; tContrast: string; tMono: string
  updated: string
}

declare module 'claude-code' {
  interface PluginState {
    cabina: { snap: Snapshot; text: Strings; view: 'main' | 'settings' }
  }
}
