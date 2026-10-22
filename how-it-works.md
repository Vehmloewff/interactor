# How `interactor` Works

## Overview

`interactor` is a Bun-based CLI that starts a Playwright-controlled Chromium browser, exposes that browser over a Unix socket, and lets other terminal commands send typed requests into the live session.

At a high level, the project has two halves:

1. **A CLI client** for commands like `start`, `ps`, `find`, and `execute`
2. **A socket server** that owns a live Playwright browser session and performs browser actions on demand

The result is a small local automation service you can drive from scripts, terminals, or agent workflows.

---

## Main pieces

### `src/main.ts`
This is the CLI entrypoint.

It uses `commander` to define commands:

- `start`: launch a browser session and socket server
- `ps`: list running interactors
- `execute`: send one or more events to a running interactor
- `find`: search supported events
- `install-browser`: install Playwright Chromium runtime
- `mount-agent-skill`: copy the included `SKILL.md` into `~/.agents/skills/interactor/SKILL.md`

`main.ts` is responsible for:

- parsing CLI arguments
- validating JSON input for `execute`
- validating event input against Zod schemas before sending it
- resolving which running interactor to talk to
- printing results back to stdout

### `src/server.ts`
This starts the actual live interactor server.

When `interactor start <url>` runs, the server:

1. validates the requested interactor name
2. checks that another interactor with the same name is not already running
3. launches Chromium with Playwright
4. opens a browser context and page
5. navigates the page to the requested URL
6. starts a Unix socket server
7. writes metadata about the running interactor to disk
8. waits forever until the process is terminated

The server also captures browser runtime data:

- console messages from `page.on('console', ...)`
- page errors from `page.on('pageerror', ...)`

These are stored in memory and exposed through events like `page.console.list` and `page.errors.list`.

### `src/socket.ts`
This file handles discovery and transport.

It provides:

- socket path generation
- metadata file management
- listing known and live interactors
- resolving a single interactor by name or by auto-selection
- creating the Unix socket server
- sending requests to a socket server

There are two storage scopes:

- **local**: `./.interactor` inside the current project
- **global**: `${tmpdir()}/interactors`

A running interactor has:

- a `.sock` file for requests
- a `.meta.json` file containing its name, pid, url, start time, and socket path

`ps` and `execute` discover interactors by reading metadata files, checking whether the process is alive, and sending an `info` request to confirm the socket responds.

### `src/schema.ts`
This defines the wire protocol using `zod`.

There are three request kinds:

- `info`
- `events`
- `execute`

And two response shapes:

- success: `{ ok: 'true', dataJson: ... }`
- failure: `{ ok: 'false', error: ... }`

The protocol is intentionally simple: requests and responses are newline-delimited JSON messages over a Unix socket.

---

## Request flow

## 1. Starting a session

Example:

```bash
interactor start https://example.com --name default
```

This calls `startInteractorServer()` in `src/server.ts`.

That function launches Chromium, opens the URL, creates a socket server, and writes metadata so future commands can find it.

The process stays alive and becomes the owner of that browser session.

## 2. Discovering sessions

Example:

```bash
interactor ps
```

This calls `listLiveInteractors()` in `src/socket.ts`.

Discovery works by:

1. reading `.meta.json` files from the local and/or global interactor directory
2. parsing them with Zod
3. checking whether the recorded PID is still alive
4. sending an `info` request to the socket
5. keeping only the interactors that still respond

## 3. Discovering available actions

Example:

```bash
interactor find click
```

This searches the in-memory event definitions exported from `src/events` and prints:

- event name
- human description
- input schema as JSON Schema

The event catalog is built from the arrays in:

- `src/events/page.ts`
- `src/events/context.ts`
- `src/events/browser.ts`
- `src/events/locator.ts`

## 4. Executing actions

Example:

```bash
interactor execute page.click '{"selector":"button.submit"}'
```

Execution works like this:

1. `main.ts` resolves the target interactor
2. it parses the JSON input string
3. it validates that input against the matching Zod schema
4. it sends an `execute` request over the socket
5. the server runs the corresponding Playwright action
6. the result is serialized and returned
7. the CLI prints either `ok ...` or `error ...`

Although the CLI accepts multiple `<event> <json>` pairs, the current implementation sends them as separate one-event socket requests and executes them one after another.

---

## Event system

The event system is the core abstraction of the project.

### Definition shape

`src/events/define-event.ts` defines a standard event shape:

- `name`
- `description`
- `keywords`
- `inputModel` (a Zod schema)
- `run()` (the implementation)

This gives the project three useful properties:

1. **Validation**: every event input is schema-checked
2. **Discoverability**: `find` can expose event names, descriptions, and schemas
3. **Execution**: the server can dispatch by event name

### Event groups

Events are grouped by Playwright target:

- **page events**: navigation, clicking, filling, screenshots, evaluation, content reads, waits, etc.
- **context events**: cookies, permissions, storage state, headers, geolocation, etc.
- **browser events**: browser status, new pages, contexts, close, version, etc.
- **locator events**: locator-based interactions and reads

`src/events/index.ts` merges all of these into a single registry and exposes helpers to:

- find an event by name
- get its schema
- validate its input
- execute it
- search across event metadata

### Transport-safe results

Some Playwright APIs return complex objects that are not naturally JSON-safe.

To handle that, the project uses `sanitizeForTransport()` from `src/events/method-utils.ts` to convert values into simpler JSON-serializable forms.

Examples:

- `Date` becomes ISO text
- `bigint` becomes a string
- functions become `"[function]"`
- circular references become `"[circular]"`
- complex class instances become a simplified string or type object

---

## Socket protocol details

The socket server is line-based JSON over Node's `net` module.

### Server side

`createInteractorSocketServer()`:

- listens on a Unix socket path
- buffers incoming bytes until a newline
- parses one JSON request
- validates it with Zod
- calls the request handler
- returns one JSON response line

### Client side

`requestInteractor()`:

- connects to the Unix socket
- writes one newline-terminated JSON request
- waits for one newline-terminated JSON response
- validates the response with Zod
- resolves the parsed result

This protocol is intentionally minimal and works well for local tooling.

---

## Execution model and ordering

The server keeps one shared Playwright runtime:

- one `browser`
- one `context`
- one primary `page`
- one in-memory runtime buffer for console logs and page errors

To avoid overlapping operations, `src/server.ts` uses a `pendingOperationPromise` gate. Before handling a new `execute` request, it waits for the previous request to finish.

That means browser actions are serialized in request order, which helps avoid race conditions when multiple commands hit the same interactor.

Inside a single execute request, the server also runs events sequentially and collects results into an array.

---

## Browser installation

`src/playwright-install.ts` wraps Playwright's internal registry API to install browser binaries programmatically.

This powers two things:

1. the explicit `interactor install-browser` command
2. automatic Chromium installation fallback when `start` fails because the browser runtime is missing

The project currently defaults to installing Chromium.

---

## Agent skill support

The repository includes `SKILL.md`, which documents how agents should use the CLI.

`src/agent-skill.ts` implements `mount-agent-skill`, which copies that file into the agent skills directory:

- default destination: `~/.agents/skills/interactor/SKILL.md`
- override base home with `AGENTS_HOME`

This makes `interactor` easier to integrate into local agent workflows.

---

## Error handling

The code uses a small custom `Err` class in `src/utils.ts` mostly as a lightweight project-specific error type.

In practice, errors are handled by:

- validating names with `INTERACTOR_NAME_REGEX`
- validating all wire messages with Zod
- validating event inputs with per-event Zod schemas
- catching JSON parse failures
- returning socket-level `{ ok: 'false', error: ... }` responses
- setting `process.exitCode` based on failed `execute` pairs

This keeps the CLI predictable even when users send bad JSON, use an unknown event, or target a missing interactor.

---

## Important implementation notes

- The project is written in **TypeScript** and runs with **Bun**.
- It uses **Commander** for CLI parsing.
- It uses **Playwright** to drive Chromium.
- It uses **Unix domain sockets**, not HTTP.
- Interactor names must match `^[a-z0-9][a-z0-9-_]{0,63}$`.
- Session metadata is file-based, which makes discovery simple and shell-friendly.
- Runtime console logs and page errors are buffered in memory and trimmed to at most 1000 entries.

---

## End-to-end example

A typical lifecycle looks like this:

1. Start an interactor:
   ```bash
   interactor start https://example.com --name default
   ```
2. In another terminal, inspect running sessions:
   ```bash
   interactor ps
   ```
3. Search for an action:
   ```bash
   interactor find screenshot
   ```
4. Run an action:
   ```bash
   interactor execute --name default page.title '{}'
   ```
5. Run a sequence of actions:
   ```bash
   interactor execute --name default \
     page.fill '{"selector":"input[name=email]","value":"user@example.com"}' \
     page.click '{"selector":"button[type=submit]"}'
   ```
6. Read captured browser logs:
   ```bash
   interactor execute --name default page.console.list '{"limit":20}'
   ```

---

## In one sentence

`interactor` is a thin local automation server: the CLI discovers a live Playwright browser process over Unix sockets, validates named event inputs with Zod, executes Playwright actions in that long-lived session, and returns JSON-safe results back to the terminal.
