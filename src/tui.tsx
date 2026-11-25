import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui/context"
import type { Store } from "solid-js/store"
import { createEffect, createSignal, onCleanup, onMount } from "solid-js"
import { fetchQuota, type Meter, type Quota } from "./quota"

type UI = { width: number; barWidth: number }
type ViewState = { open: boolean }

const FALLBACK_WIDTH = 34
const POLL_MS = 30_000

function trackColor(themeMode: "dark" | "light"): string {
  return themeMode === "light" ? "#d4d4d8" : "#4b5563"
}

function clamped(meter: Meter): number {
  if (!Number.isFinite(meter.percent)) return 0
  return Math.max(0, Math.min(100, meter.percent))
}

function formatReset(at: number, now: number): string {
  if (!Number.isFinite(at) || at <= 0) return ""
  const seconds = Math.max(0, Math.round((at - now) / 1000))
  if (seconds <= 0) return "resetting"
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return "<1m"
}

function formatCredits(value: number): string {
  return value < 10 ? `$${value.toFixed(2)}` : `$${Math.round(value)}`
}

function barColor(theme: Context["theme"], percent: number): string {
  if (percent > 80) return theme.text.feedback.error.base
  if (percent > 50) return theme.text.feedback.warning.base
  return theme.text.feedback.success.base
}

function MeterRow(props: {
  theme: Context["theme"]
  themeMode: "dark" | "light"
  label: string
  meter: Meter
  width: number
  now: number
}) {
  // Props are getters; every derived value stays lazy so the row keeps
  // repainting when the poll lands or the countdown ticks.
  const percent = () => clamped(props.meter)
  const total = () => Math.max(1, props.width)
  const used = () => {
    const value = percent()
    const width = total()
    return value > 0 ? Math.min(width, Math.max(1, Math.round((value / 100) * width))) : 0
  }
  const rest = () => Math.max(0, total() - used())
  const reset = () => formatReset(props.meter.resetsAt, props.now)
  const color = () => barColor(props.theme, percent())
  const amount = () => `${formatCredits(props.meter.used)} / ${formatCredits(props.meter.cap)}`

  return (
    <box flexDirection="column">
      <box flexDirection="row" gap={1}>
        <text fg={props.theme.text.base}>{props.label}</text>
        <text fg={props.theme.text.muted}>{amount()}</text>
        <box flexGrow={1} />
        {reset() ? <text fg={props.theme.text.muted}>{`(${reset()})`}</text> : null}
        <text fg={props.meter.limited ? props.theme.text.feedback.error.base : props.theme.text.muted}>
          {`${Math.round(percent())}%`}
        </text>
      </box>
      <box flexDirection="row" height={1} width="100%">
        {used() > 0 ? <text fg={color()}>{"━".repeat(used())}</text> : null}
        {rest() > 0 ? <text fg={trackColor(props.themeMode)}>{"━".repeat(rest())}</text> : null}
      </box>
    </box>
  )
}

function Panel(props: {
  ctx: Context
  view: Store<ViewState>
  setView: (mutation: (draft: ViewState) => void) => Promise<void>
  ui: Store<UI>
  setUI: (mutation: (draft: UI) => void) => void
}) {
  const theme = props.ctx.theme
  const open = () => props.view.open
  const [quota, setQuota] = createSignal<Quota>()
  const [now, setNow] = createSignal(Date.now())
  const [error, setError] = createSignal("")
  const [loading, setLoading] = createSignal(true)
  const repaint = () => {
    try {
      props.ctx.renderer.requestRender()
    } catch {
      // the renderer is gone during shutdown
    }
  }

  // Repaint as soon as either signal changes; text updates alone do not
  // always schedule a frame in the host renderer.
  createEffect(() => {
    quota()
    now()
    repaint()
  })

  onMount(() => {
    let disposed = false
    let busy = false
    const load = async () => {
      if (busy || disposed) return
      busy = true
      try {
        const next = await fetchQuota()
        if (disposed) return
        if (next) {
          setQuota(next)
          setError("")
          repaint()
        } else if (!quota()) {
          setError("No Command Code key")
        }
      } catch (cause) {
        if (!disposed && !quota()) setError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        busy = false
        if (!disposed) setLoading(false)
      }
    }

    void load()
    const poll = setInterval(() => void load(), POLL_MS)
    const tick = setInterval(() => {
      setNow(Date.now())
      repaint()
    }, 1_000)

    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void load(), 1500)
    }
    const stops = [
      props.ctx.data.on("session.execution.succeeded", schedule),
      props.ctx.data.on("session.execution.failed", schedule),
      props.ctx.data.on("session.execution.interrupted", schedule),
      props.ctx.data.on("session.step.ended", schedule),
      props.ctx.data.on("session.idle", schedule),
    ]

    onCleanup(() => {
      disposed = true
      clearInterval(poll)
      clearInterval(tick)
      if (timer) clearTimeout(timer)
      for (const stop of stops) stop()
    })
  })

  const toggle = () => {
    void props.setView((draft) => {
      draft.open = !draft.open
    }).catch(() => {})
  }

  const summary = () => {
    const data = quota()
    if (!data) return undefined
    const meters = [data.fiveHour, data.weekly, data.monthly].filter((meter): meter is Meter => meter !== null)
    if (!meters.length) return undefined
    return Math.round(Math.max(...meters.map(clamped)))
  }

  const headline = () => {
    const data = quota()
    if (!data) return ""
    const parts: string[] = []
    if (data.plan) parts.push(data.plan)
    parts.push(`${formatCredits(data.remaining.monthly)} left`)
    return ` (${parts.join(" · ")})`
  }

  return (
    <box
      flexDirection="column"
      width="100%"
      ref={((element: any) => {
        if (!element) return
        const update = () => {
          const next = (element.width ?? 0) | 0
          if (!next) return
          props.setUI((draft) => {
            if (draft.width !== next) draft.width = next
          })
        }
        element.onSizeChange = update
        queueMicrotask(update)
      }) as any}
    >
      <box flexDirection="row" gap={1} width="100%" onMouseDown={toggle} ref={((element: any) => {
        if (!element) return
        const update = () => {
          const next = (element.width ?? 0) | 0
          if (!next) return
          props.setUI((draft) => {
            if (draft.barWidth !== next) draft.barWidth = next
          })
        }
        element.onSizeChange = update
        queueMicrotask(update)
      }) as any}>
        <text fg={theme.text.base}>{open() ? "▼" : "▶"}</text>
        <text fg={theme.text.base}>
          <b>Command Code</b>
          {!open() && summary() !== undefined ? (
            <span style={{ fg: theme.text.muted }}>{` (${summary()}% used)`}</span>
          ) : null}
          {open() && quota() ? <span style={{ fg: theme.text.muted }}>{headline()}</span> : null}
        </text>
      </box>

      {!open() ? null : (
        <>
          {loading() && !quota() ? (
            <text fg={theme.text.muted}>Loading…</text>
          ) : error() && !quota() ? (
            <text fg={theme.text.feedback.error.base}>{error()}</text>
          ) : quota() ? (
            <>
              {quota()!.fiveHour ? (
                <MeterRow theme={theme} themeMode={props.ctx.themeMode} label="5h" meter={quota()!.fiveHour!} width={props.ui.barWidth || props.ui.width} now={now()} />
              ) : null}
              {quota()!.weekly ? (
                <MeterRow theme={theme} themeMode={props.ctx.themeMode} label="Weekly" meter={quota()!.weekly!} width={props.ui.barWidth || props.ui.width} now={now()} />
              ) : null}
              <MeterRow theme={theme} themeMode={props.ctx.themeMode} label="Monthly" meter={quota()!.monthly} width={props.ui.barWidth || props.ui.width} now={now()} />
            </>
          ) : (
            <text fg={theme.text.muted}>No Command Code key</text>
          )}
        </>
      )}
    </box>
  )
}

export default Plugin.define({
  id: "commandcode.quota.sidebar",
  setup(ctx: Context) {
    const [view, setView] = ctx.storage.store<ViewState>("view", { initial: { open: true } })
    const [ui, setUI] = ctx.storage.memory<UI>("ui", { initial: { width: FALLBACK_WIDTH, barWidth: 0 } })

    const dispose = ctx.ui.slot({
      prepend: "sidebar.content",
      render: () => (
        <Panel ctx={ctx} view={view} setView={setView} ui={ui} setUI={setUI} />
      ),
    })

    return () => dispose()
  },
})
