// 12s, 41m, 2h 41m, 3d 4h. Aparte de register.tsx para que elapsed.tsx (módulo de superficie) lo use sin el motor.
export const span = (ms: number) => {
  if (ms < 60_000) return `${Math.max(0, Math.floor(ms / 1000))}s`
  const m = Math.round(ms / 60_000)
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60)
  return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m}m`
}
