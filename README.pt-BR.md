# opencode-go-limits-sidebar

![version](https://img.shields.io/badge/version-0.1.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![platform](https://img.shields.io/badge/platform-linux%20%7C%20macOS%20%7C%20windows-lightgrey)
![ci](https://img.shields.io/github/actions/workflow/status/moisesfilho/opencode-go-limits-sidebar/ci.yml)

**Idiomas:** [English](README.md) | [Português](README.pt-BR.md)

Plugin TUI para opencode que mostra o uso do seu plano OpenCode Go direto no
sidebar: as janelas de uso de 5 horas, semanal e mensal contra seus limites,
com barra de progresso, valor gasto, limite e tempo estimado de reset.

## Funcionalidades

- **3 janelas de uso** — 5 horas ($12), semanal ($30) e mensal ($60)
- **Barra de progresso** por janela com percentual usado
- **Valores gasto / limite** em USD
- **Reset estimado** para cada janela
- **Atualização automática** a cada 30 segundos (configurável)
- **Detecção de limite estourado** — marca a janela como `LIMIT` quando o
  gateway retorna HTTP 429 com metadata `limitName`
- **Aware de tema** — as cores seguem o tema ativo do opencode

## Instalação

Requer OpenCode >= 1.3.13.

```bash
cd ~/Projetos/opencode-go-limits-sidebar
npm install
npm run build
opencode plugin "$PWD" -g
```

Reinicie o opencode. O bloco `OPENCODE GO` aparece no sidebar.

## Uso

Nenhuma configuração é necessária — o plugin funciona com os limites padrão do
OpenCode Go. Para personalizar, adicione opções à entrada do plugin no seu
`opencode.json`:

```json
{
  "plugin": [
    ["/caminho/para/opencode-go-limits-sidebar", {
      "provider": "opencode-go",
      "limits": { "hour5": 12, "weekly": 30, "monthly": 60 },
      "subscriptionDate": null,
      "refreshMs": 30000
    }]
  ]
}
```

## Configuração

| Opção | Tipo | Padrão | Descrição |
| --- | --- | --- | --- |
| `provider` | string | `opencode-go` | ID do provider a monitorar (`session.model.providerID`) |
| `limits.hour5` | number | `12` | Limite da janela de 5 horas em USD |
| `limits.weekly` | number | `30` | Limite da janela semanal em USD |
| `limits.monthly` | number | `60` | Limite da janela mensal em USD |
| `subscriptionDate` | string \| null | `null` | Data da assinatura (ISO). Quando definida, ancora a janela mensal; caso contrário, aproxima pelo mês calendário UTC |
| `refreshMs` | number | `30000` | Intervalo de polling em milissegundos |

## Como funciona

Não existe API pública de cota do OpenCode Go, então o plugin aproxima o
consumo usando o **custo local das sessões** registrado pelo opencode, obtido
via SDK (`client.session.list()`). As sessões são filtradas por provider e o
`cost` é somado por janela:

- **5 horas** — janela deslizante: sessões atualizadas nas últimas 5 horas
- **Semanal** — semana calendário começando segunda 00:00 UTC
- **Mensal** — mês calendário (UTC), ou ancorado em `subscriptionDate` quando definido

> **Nota:** o custo local das sessões é uma aproximação do uso real do
> gateway. A fonte oficial é o console do OpenCode Go
> (https://opencode.ai/auth).

## Estrutura do projeto

```
src/
  index.tsx      Entrada TUI — slot do sidebar, polling, detecção 429
  limits.ts      palette, formatação, percentual e helpers de reset
  storage.ts     limites das janelas e cálculo de uso (session.list)
  server.ts      Entrada server — loga eventos de limite 429
  *.test.ts      Suites vitest
```

## Testes

```bash
npm test
```

Executa o build e a suíte vitest (limites das janelas, formatação, cálculo de
uso).

## Licença

MIT