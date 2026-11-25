# OpenCode Command Code quota sidebar

A local OpenCode V2 TUI plugin that shows your Command Code credit balance and
rolling usage windows in the session sidebar.

## What it shows

| Row | Meaning |
| --- | --- |
| 5h | Rolling five-hour credit window |
| Weekly | Rolling weekly credit window |
| Monthly | Subscription credit pool for the current billing period |

Each row prints the spent and total credit value (`$0.06 / $14`), the used
percentage, and a reset countdown such as `(4h 58m)`. The used part of each bar
is green up to 50%, yellow above 50%, and red above 80%. The remaining part is
gray. Click the `Command Code` header to collapse the panel; when collapsed the
header shows the highest used percentage. Expanded, the header shows the plan
name and the monthly credit balance.

## Data

The plugin reads the CLI credential, then calls the Command Code web API
directly:

- `~/.commandcode/auth.json` for the API key, or `COMMAND_CODE_API_KEY` /
  `COMMANDCODE_API_KEY` from the environment.
- `GET /alpha/billing/credits` for the monthly, purchased, and free credit
  balances plus the 5-hour and weekly windows.
- `GET /alpha/billing/subscriptions` for the plan name and current period end.

Set `COMMANDCODE_API_URL` to point at a staging or proxy base URL; the default is
`https://api.commandcode.ai`. The key is never written anywhere; it is cached in
memory for one minute.

Note that per-model allowances are not exposed by the API. The monthly bar shows
the whole plan pool, not the share reserved for a single model.

The panel refreshes every 30 seconds and shortly after each assistant turn.

## Install

The package is TUI-only, so load it from `cli.json`:

```json
{
  "plugins": ["/absolute/path/to/command-code-quota-sidebar"]
}
```

On Windows, write the path with forward slashes, for example
`C:/Users/you/.config/opencode/plugins/command-code-quota-sidebar`. Reload or
restart the TUI if it does not appear.

## Development

```sh
npm install
npm run typecheck
npm run build
```

`npm run build` compiles `src/tui.tsx` and `src/quota.ts` into `dist/` with the
Solid JSX transform. OpenCode provides `@opencode/*` and `@opentui/*` at
runtime.

## Requirements

- OpenCode V2 with plugin support (`@opencode/plugin` 2.2 or newer).
- A Command Code account, signed in at least once with the `cmd` CLI so that
  `~/.commandcode/auth.json` exists.
- The Go plan works: the web API accepts the same key as the CLI, unlike the
  Provider API, which Go cannot use.
