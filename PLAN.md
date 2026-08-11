# Plano: `opencode-go-limits-sidebar`

Plugin TUI para opencode que renderiza no sidebar o uso do plano **OpenCode Go**.

**Objetivo:** mostrar 3 janelas de uso — **5 horas / semanal / mensal** — contra os
limites do plano **$12 / $30 / $60**, com barra de progresso, valor gasto, limite e refresh.
Bônus v2: captura do **HTTP 429** (`metadata.limitName`) quando um limite for estourado.

## Contexto (por que existe)

- O plugin original `opencode-limits-sidebar` (hkay-dev) é **macOS-only**: faz polling do
  daemon menu-bar `openusage` em `http://127.0.0.1:6736/v1/usage`.
- Não existe **API pública de cota** do OpenCode Go (sem `/account`, `/usage`, `/limit`
  no gateway; SDK sem método de quota; `opencode stats` mostra só custo local).
- Única fonte oficial de uso: console web `https://opencode.ai/auth`.
- Portanto o plugin usa o **custo local das sessões** (registrado pelo próprio opencode)
  como aproximação do consumo do plano. Limites conhecidos do plano:
  **5h = $12, semanal = $30, mensal = $60**.

## Fonte de dados (decisão central — validada no spike)

**Sem acesso direto ao DB.** O plugin usa o `client` do SDK (`@opencode-ai/sdk`, já
disponível no `TuiPluginApi`), que fala com o server local via HTTP:

- `client.session.list()` → `Session[]` com `cost`, `model.providerID`, `time.created/updated/archived`.
- Filtro por provider: `session.model.providerID === provider` (configurável).
- Soma `cost` das sessions dentro de cada janela (abaixo).

### Janelas (semântica exata do server, fonte `packages/console/core/src/subscription.ts`)
| Janela | Semântica | Cálculo no plugin |
|---|---|---|
| 5 horas | **rolling** (`now - 5h`) | `time.updated >= now - 5h` |
| Semanal | **calendário, segunda 00:00 UTC** (`getWeekBounds`) | `time.updated >= segunda 00:00 UTC` |
| Mensal | **calendário ancorado na data da assinatura** (`getMonthlyBounds(now, timeSubscribed)`, UTC, clamp fim do mês) | aprox.: início do mês UTC, ou `subscriptionDate` na config |

- Unidade do server: **microCents** (custo local em USD → ×1_000_000).
- Reset exibido = fim da janela − now (o server retorna `resetInSec`).

### Reconciliação com `opencode stats` (validada)
`opencode stats --days N` = `SUM(session.cost)` das sessions com `time.updated` na janela.
Confirmado empiricamente: stats 7d = **$11.42** = SQL `SUM(cost)` = **11.4176**.
(Divergências anteriores eram uso em tempo real crescendo entre leituras.)

## Arquitetura (espelha o upstream, troca a fonte)

| Camada | Arquivo | Papel |
|---|---|---|
| TUI | `src/index.tsx` | Slot `sidebar_content`, SolidJS + @opentui/solid, polling |
| Dados | `src/limits.ts` + `src/storage.ts` | Tipos, cálculo das janelas, `client.session.list()` |
| Server | `src/server.ts` | No-op no v1; v2: hook p/ capturar 429 no event bus |

## Fases

### Fase 0 — Spike ✅ (concluída)
1. **Acesso a dados:** resolvido via SDK — `client.session.list()` expõe `cost`/`provider`/`time`.
   Sem fs, sem sqlite, sem dependências nativas. (Node local v24.18.1; `node:sqlite` existe como fallback, não é necessário.)
2. **Reconciliação do stats:** `SUM(session.cost)` na janela — método replicado (ver acima).
3. **Janelas:** 5h rolling; semana calendário (segunda UTC); mês ancorado na assinatura (aprox. calendário).
4. **Registro local:** `opencode plugin <module>` só aceita npm. Local = `plugin: ["file:///abs/path"]`
   (ou `./path`) no `~/.config/opencode/opencode.json`.

### Fase 1 — Scaffold
`~/Projetos/opencode-go-limits-sidebar`:
- `package.json` (exports `./server` e `./tui`, scripts build=tsc / dev=opencode plugin dev / test=vitest)
- `tsconfig.json`, deps `@opentui/solid`, `solid-js`; devDeps `@opencode-ai/plugin`, `vitest`

### Fase 2 — Data layer
- `storage.ts`: `client.session.list()` + filtro por provider + soma por janela (5h/week/month).
- `limits.ts`: formatação, % usado, reset, palette do theme (portado do upstream).

### Fase 3 — UI
- Header "OPENCODE GO", 3 `LimitRow` (label, barra %, `$gasto / $limite`, reset estimado).
- Polling 30–60s; estado vazio quando sem sessões do provider.

### Fase 4 — 429 capture (v2)
- Hook `event` no server-side detecta `limitName` ("5 hour" | "weekly" | "monthly")
  e marca a janela como *limit reached* na UI.

### Fase 5 — Verificação
- vitest: cálculo de janelas (rolling/segunda-UTC/mês), formatação, parsing.
- Números do sidebar × `opencode stats` × console `opencode.ai/auth`.
- Registro global, restart do opencode, validação visual no TUI.

## Config exposta (via options do plugin)
```json
{
  "provider": "opencode-go",
  "limits": { "hour5": 12, "weekly": 30, "monthly": 60 },
  "subscriptionDate": null,
  "refreshMs": 30000
}
```
- `provider`: `providerID` a monitorar, escolhido pelo usuário dentre os providers configurados
  (ex.: `opencode-go`, `opencode`, `ollama`). Padrão `opencode-go`.
- `limits`: limites por janela do provider monitorado (padrão: valores do plano OpenCode Go).
- `subscriptionDate`: data da assinatura (ISO) p/ janela mensal exata; `null` = aproximação por mês calendário UTC.

## Riscos
- **Aproximação:** custo local ≠ consumo real do gateway (documentado; validar no console na Fase 5).
- **Janela mensal:** sem `subscriptionDate`, o mês é aproximado por calendário (divergência possível no dia da assinatura).
- **Sessões arquivadas:** `session.list()` exclui arquivadas por padrão — decidir se entram na soma (o server conta uso real, não sessões).
- **Polling:** `session.list()` sem filtro de tempo → buscar com `limit` alto e filtrar no cliente (poucas sessões; ok).

## DoD
Sidebar mostra 3 janelas corretas e auto-atualizáveis, números batem com o stats,
instalado globalmente, testes verdes.