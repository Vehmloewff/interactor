# interactor

`interactor` is a command-line tool for controlling and inspecting live browser sessions from scripts, terminals, and agent workflows.

It gives you a socket-based control surface so you can:

- start a named browser session on a URL
- list running sessions
- execute page/browser/context/locator actions
- discover available actions and input schemas

## Install

```bash
brew install vehmloewff/tap/interactor
```

If you don't use homebrew, you can download your platform's binary from the Github releases page.

## Quick Start

Start a session:

```bash
interactor start https://example.com --name default
```

List running sessions:

```bash
interactor ps
```

Discover actions:

```bash
interactor find click
```

Execute actions:

```bash
interactor execute page.click '{"selector":"button.submit"}'
```

Run multiple actions in sequence:

```bash
interactor execute \
  page.fill '{"selector":"input[name=email]","value":"user@example.com"}' \
  page.click '{"selector":"button[type=submit]"}'
```

## Common Commands

- `interactor start <url> [--name <name>] [--headed]`
- `interactor ps [--global]`
- `interactor execute [--name <name>] <event> <json> [<event> <json> ...]`
- `interactor find [keywords...]`
- `interactor install-browser [--with-deps] [--force] [--dry-run]`
- `interactor mount-agent-skill`

## Contributing

PRs are welcome. Keep changes focused, include a clear description, and run `bun run check` before opening a PR.
