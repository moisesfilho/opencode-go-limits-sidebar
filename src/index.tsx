/** @jsxImportSource @opentui/solid */
import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import type { TuiEventBus, TuiPlugin } from "@opencode-ai/plugin/tui"
import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import {
  REFRESH_INTERVAL_MS,
  RESET_COLUMN_WIDTH,
  SIDEBAR_ORDER,
  USED_COLUMN_WIDTH,
  formatUsd,
  getPalette,
  percentUsed,
  resetText,
  rightAlign,
  type ColorValue,
  type Palette,
} from "./limits.js"
import {
  fetchUsage,
  type LimitsConfig,
  type WindowKind,
  type WindowUsage,
} from "./storage.js"

function ProgressBar(props: { percent: number; fg: ColorValue; bg: ColorValue }) {
  const pct = Math.max(0, Math.min(100, props.percent))
  return (
    <box width="100%" flexDirection="row" height={1}>
      <box flexGrow={pct} backgroundColor={props.fg} />
      <box flexGrow={100 - pct} backgroundColor={props.bg} />
    </box>
  )
}

function LimitRow(props: {
  palette: Palette
  line: WindowUsage
  limitReached: boolean
}) {
  const pct = percentUsed(props.line.used, props.line.limit)
  return (
    <box flexDirection="column" marginBottom={1}>
      <box flexDirection="row" width="100%">
        <box flexGrow={1}>
          <text fg={props.palette.text}>{props.line.label}</text>
        </box>
        <box width={USED_COLUMN_WIDTH} justifyContent="flex-end">
          <text fg={props.limitReached ? props.palette.warning : props.palette.text}>
            {rightAlign(`${pct}%`, USED_COLUMN_WIDTH)}
          </text>
        </box>
        <box width={RESET_COLUMN_WIDTH} justifyContent="flex-end" marginLeft={1}>
          <text fg={props.palette.muted}>
            {rightAlign(resetText(props.line.resetsAt), RESET_COLUMN_WIDTH)}
          </text>
        </box>
      </box>
      <box marginTop={1}>
        <ProgressBar
          percent={pct}
          fg={props.limitReached ? props.palette.warning : props.palette.accent}
          bg={props.palette.subtle}
        />
      </box>
      <box marginTop={1} flexDirection="row" width="100%">
        <text fg={props.palette.muted}>
          {formatUsd(props.line.used)} / {formatUsd(props.line.limit)}
        </text>
        <Show when={props.limitReached}>
          <text fg={props.palette.warning} marginLeft={1}>
            <b>LIMIT</b>
          </text>
        </Show>
      </box>
    </box>
  )
}

function SidebarLimits(props: {
  theme: Record<string, unknown>
  client: OpencodeClient
  config: LimitsConfig
  event: TuiEventBus
}) {
  const palette = createMemo(() => getPalette(props.theme))
  const [windows, setWindows] = createSignal<WindowUsage[]>([])
  const [loading, setLoading] = createSignal(true)
  const [errorMsg, setErrorMsg] = createSignal("")
  const [limitReached, setLimitReached] = createSignal<Record<WindowKind, boolean>>({
    hour5: false,
    weekly: false,
    monthly: false,
  })

  const fetch = async () => {
    try {
      setWindows(await fetchUsage(props.client, props.config))
      setErrorMsg("")
    } catch {
      setErrorMsg("cannot reach opencode server")
    } finally {
      setLoading(false)
    }
  }

  onMount(() => {
    void fetch()
    const refreshMs =
      (props.config as { refreshMs?: number }).refreshMs ?? REFRESH_INTERVAL_MS
    const timer = setInterval(() => void fetch(), refreshMs)
    onCleanup(() => clearInterval(timer))
  })

  onMount(() => {
    const off = props.event.on("session.error", (ev) => {
      const d = (ev.properties?.error as
        | { data?: { statusCode?: number; metadata?: Record<string, string> } }
        | undefined)?.data
      if (d?.statusCode === 429 && d.metadata?.limitName) {
        const name = d.metadata.limitName.toLowerCase()
        let kind: WindowKind | undefined
        if (name.includes("hour")) kind = "hour5"
        else if (name.includes("week")) kind = "weekly"
        else if (name.includes("month")) kind = "monthly"
        if (kind) setLimitReached((prev) => ({ ...prev, [kind]: true }))
      }
    })
    onCleanup(off)
  })

  return (
    <box flexDirection="column" width="100%">
      <box flexDirection="row" justifyContent="space-between" width="100%">
        <text fg={palette().accent}>
          <b>OPENCODE GO</b>
        </text>
        <Show when={loading()}>
          <text fg={palette().muted}>...</text>
        </Show>
      </box>
      <Show when={errorMsg()}>
        <text fg={palette().warning}>{errorMsg()}</text>
      </Show>
      <Show when={windows().length > 0}>
        <For each={windows()}>
          {(line) => (
            <LimitRow
              palette={palette()}
              line={line}
              limitReached={!!limitReached()[line.kind]}
            />
          )}
        </For>
      </Show>
      <Show when={loading() && windows().length === 0}>
        <text fg={palette().muted}>...</text>
      </Show>
      <Show
        when={
          errorMsg() === "" &&
          !loading() &&
          windows().every((w) => w.used === 0)
        }
      >
        <text fg={palette().muted}>No usage for {props.config.provider} yet</text>
      </Show>
    </box>
  )
}

const DEFAULT_CONFIG: LimitsConfig = {
  provider: "opencode-go",
  limits: { hour5: 12, weekly: 30, monthly: 60 },
  subscriptionDate: null,
}

const tui: TuiPlugin = (api, options) => {
  const config = { ...DEFAULT_CONFIG, ...((options ?? {}) as Partial<LimitsConfig>) }

  api.slots.register({
    order: SIDEBAR_ORDER,
    slots: {
      sidebar_content(ctx) {
        return (
          <SidebarLimits
            theme={ctx.theme.current as unknown as Record<string, unknown>}
            client={api.client}
            config={config}
            event={api.event}
          />
        )
      },
    },
  })

  return Promise.resolve()
}

export default { id: "opencode-go-limits-sidebar", tui }
