---
name: interactor
description: Guidance for using the interactor CLI to drive a running browser session via socket events.
---

# Interactor CLI Skill

Use this skill when you need to inspect or automate a web app through the `interactor` CLI.

## Core Rules

1. Never start interactors yourself.
2. If no interactor is running, ask the user to start one and share the command they should run.
3. If the user does not specify an interactor name, assume the default selection behavior:
   - Try without `--name`.
   - If it fails due to multiple interactors, run `interactor ps` and ask the user which one to use.
4. Once a target interactor is known, consistently use that interactor for subsequent commands.
5. Prefer one `execute` call with multiple event/input pairs when actions must happen immediately in sequence.

## Interactor Selection Workflow

1. Check available interactors:
   - `interactor ps`
2. If exactly one is running:
   - Proceed without `--name`.
3. If multiple are running and no name is provided:
   - Ask user which interactor name to use.
4. If none are running:
   - Ask user to start one, for example:
   - `interactor start https://example.com --name default`

## Event Discovery

Use `find` to discover event names and input schemas:

- `interactor find click`
- `interactor find console`
- `interactor find wait`

When passing multiple keywords, `find` uses AND matching (all keywords must match).
Example: `interactor find screenshot title` only returns events matching both terms.

Output format is:

- `eventName<TAB>description<TAB>schema`

Use schema comments to understand each input field.

## Executing Events

`execute` takes repeated pairs:

- `<eventName> <jsonInput>`

The pairs are sent in one socket request and executed in order.
Results are returned in the same order, one JSON result per line.

## Examples

Single event:

```bash
interactor execute page.title '{}'
```

Sequential events in one request:

```bash
interactor execute \
  page.click '{"selector":"button[type=submit]"}' \
  page.waitForTimeout '{"timeoutMs":500}' \
  page.screenshot '{"fullPage":true}'
```

Read captured console errors/logs:

```bash
interactor execute page.console.list '{"type":"error","limit":20}'
```

Target a specific interactor:

```bash
interactor execute --name my-app page.url '{}'
```

## Error Handling Guidance

If execution fails:

1. Re-check schema with `interactor find <keyword>`.
2. Ensure JSON input is valid JSON (double quotes, proper braces).
3. If name ambiguity occurs, resolve with `interactor ps` and ask user which interactor to use.
