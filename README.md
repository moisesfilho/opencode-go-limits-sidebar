# opencode-go-limits-sidebar

![version](https://img.shields.io/badge/version-0.1.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![platform](https://img.shields.io/badge/platform-linux%20%7C%20macOS%20%7C%20windows-lightgrey)
![ci](https://img.shields.io/github/actions/workflow/status/moisesfilho/opencode-go-limits-sidebar/ci.yml)

**Languages:** [English](README.md) | [Português](README.pt-BR.md)

OpenCode TUI plugin that shows your OpenCode Go plan usage directly in the
sidebar: the 5-hour, weekly and monthly usage windows against their limits,
with a progress bar, spent amount, limit and estimated reset time.

## Features

- **3 usage windows** — 5 hours ($12), Weekly ($30) and Monthly ($60) limits
- **Progress bar** per window with percentage used
- **Spent / limit** amounts in USD
- **Estimated reset** time for each window
- **Auto-refresh** every 30 seconds (configurable)
- **Limit reached detection** — marks the window as `LIMIT` when the gateway
  returns HTTP 429 with a `limitName` metadata
- **Theme aware** — colors follow the active OpenCode theme

## Installation

Requires OpenCode >= 1.3.13.

```bash
cd ~/Projetos/opencode-go-limits-sidebar
npm install
npm run build
opencode plugin "$PWD" -g
```

Restart opencode. The `OPENCODE GO` block appears in the sidebar.

## Usage

No configuration is required — the plugin works out of the box with the
default OpenCode Go limits. To customize, add options to the plugin entry in
your `opencode.json`:

```json
{
  "plugin": [
    ["/path/to/opencode-go-limits-sidebar", {
      "provider": "opencode-go",
      "limits": { "hour5": 12, "weekly": 30, "monthly": 60 },
      "subscriptionDate": null,
      "refreshMs": 30000
    }]
  ]
}
```

## Config

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `provider` | string | `opencode-go` | Provider ID to monitor (`session.model.providerID`) |
| `limits.hour5` | number | `12` | 5-hour window limit in USD |
| `limits.weekly` | number | `30` | Weekly window limit in USD |
| `limits.monthly` | number | `60` | Monthly window limit in USD |
| `subscriptionDate` | string \| null | `null` | Subscription date (ISO). When set, the monthly window is anchored to it; otherwise it approximates to the UTC calendar month |
| `refreshMs` | number | `30000` | Polling interval in milliseconds |

## How it works

There is no public quota API for OpenCode Go, so the plugin approximates
consumption using the **local session costs** recorded by opencode, fetched
through the SDK (`client.session.list()`). Sessions are filtered by provider
and their `cost` is summed per window:

- **5 hours** — rolling window: sessions updated in the last 5 hours
- **Weekly** — calendar week starting Monday 00:00 UTC
- **Monthly** — calendar month (UTC), or anchored to `subscriptionDate` when set

> **Note:** local session cost is an approximation of the actual gateway
> usage. The authoritative source is the OpenCode Go console
> (https://opencode.ai/auth).

## Project structure

```
src/
  index.tsx      TUI entry — sidebar slot, polling, 429 detection
  limits.ts      palette, formatting, percentage and reset helpers
  storage.ts     window bounds and usage computation (session.list)
  server.ts      server entry — logs 429 limit events
  *.test.ts      vitest suites
```

## Tests

```bash
npm test
```

Runs the build and the vitest suite (window bounds, formatting, usage
computation).

## License

MIT