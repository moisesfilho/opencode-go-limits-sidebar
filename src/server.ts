import type { Plugin } from "@opencode-ai/plugin"

const server: Plugin = () =>
  Promise.resolve({
    event: async ({ event }) => {
      if (event.type !== "session.error") return
      const data = (event.properties?.error as
        | { data?: { statusCode?: number; metadata?: Record<string, string> } }
        | undefined)?.data
      if (data?.statusCode === 429 && data.metadata?.limitName) {
        console.log(`[opencode-go-limits-sidebar] limit reached: ${data.metadata.limitName}`)
      }
    },
  })

export default { id: "opencode-go-limits-sidebar", server }
