# How `interactor` Could Be

## The big idea

Instead of exposing a large Playwright-flavored API, `interactor` could act like a tiny set of browser commands that are easy for both humans and agents to remember.

The model is closer to the blog post's script collection than to a full automation framework:

- start a browser
- go somewhere
- run a little JavaScript in the page
- take a screenshot
- maybe add one or two special-purpose helpers later

The API surface should feel so small that an agent can hold the whole thing in its head after reading one short README.

---

## Design goals

### 1. Tiny command surface

The ideal CLI would have only a handful of commands:

- `interactor start`
- `interactor nav`
- `interactor eval`
- `interactor screenshot`

Optionally later:

- `interactor pick`
- `interactor cookies`

That is enough for a surprising amount of real work.

### 2. Bash-first, agent-friendly

The CLI should be usable directly from a shell without ceremony.

Examples should look like this:

```bash
interactor start
interactor start --profile
interactor nav https://example.com
interactor nav https://example.com --new
interactor eval 'document.title'
interactor eval 'Array.from(document.querySelectorAll("a")).map(a => a.href)'
interactor screenshot
```

An agent should not need to learn a big object model, a session protocol, or dozens of action names. It should just call a command.

### 3. Page-context by default

The most important capability is: "run JavaScript in the active page."

That lets the agent use what it already knows:

- the DOM API
- browser JavaScript
- CSS selectors
- async JavaScript

Instead of asking the agent to think in Playwright concepts, we let it think in browser concepts.

### 4. Output that composes well

Each command should print plain, useful output:

- short success messages
- raw scalar values
- JSON when structured data matters
- file paths for screenshots

This makes the CLI easy to combine with shell redirection, scripts, and agent workflows.

### 5. Easy to extend

If a workflow needs one more command, it should be trivial to add.

The system should encourage small custom commands over a giant universal interface.

---

## Ideal user experience

## 1. Start a browser

```bash
interactor start
```

Starts Chrome or Chromium with remote debugging enabled.

Optional:

```bash
interactor start --profile
```

This starts the browser using a copied local profile so the user stays logged in.

What this command should guarantee:

- the browser is running
- a debugging connection is available
- future commands know how to find the active session
- success is obvious from the output

Example output:

```text
✓ Browser started on :9222
```

Or:

```text
✓ Browser started on :9222 with your profile
```

The command should be idempotent enough for agent use. If a previous session exists, it can reuse or replace it predictably.

---

## 2. Navigate

```bash
interactor nav https://example.com
```

Navigates the active tab.

```bash
interactor nav https://example.com --new
```

Opens a new tab and navigates there.

This command should do one thing only: load a URL and wait until the page is usable.

Example output:

```text
✓ Navigated to: https://example.com
```

Or:

```text
✓ Opened: https://example.com
```

No extra concepts like contexts, pages, locators, or targets need to leak into the user-facing API.

---

## 3. Evaluate JavaScript

```bash
interactor eval 'document.title'
```

This is the heart of the tool.

The command executes JavaScript in the active page context, ideally as async code, and prints the result.

Examples:

```bash
interactor eval 'document.title'
interactor eval 'location.href'
interactor eval 'document.querySelector("h1")?.textContent?.trim()'
interactor eval 'document.querySelectorAll("a").length'
interactor eval 'Array.from(document.querySelectorAll("a")).slice(0, 5).map(a => ({ text: a.textContent?.trim(), href: a.href }))'
```

This is powerful because it collapses many browser tasks into one primitive:

- inspect the page
- extract data
- click things
- fill fields
- scroll
- remove overlays
- wait for app state
- prototype a scraper

For example:

```bash
interactor eval 'document.querySelector("button.submit")?.click()'
interactor eval 'document.querySelector("input[name=email]").value = "me@example.com"'
interactor eval 'window.scrollTo(0, document.body.scrollHeight)'
```

The output format should stay minimal:

- strings print as strings
- numbers print as numbers
- arrays/objects print as JSON or a compact readable form

Ideal rule: if the result is structured, it should be easy to pipe into `jq` or save to a file.

For example:

```bash
interactor eval 'Array.from(document.querySelectorAll("article")).map(a => ({title: a.querySelector("h2")?.textContent?.trim()}))' > articles.json
```

That composability is one of the whole points.

---

## 4. Screenshot

```bash
interactor screenshot
```

Takes a screenshot of the current viewport and prints the path.

Example output:

```text
/tmp/interactor-screenshot-2026-03-30T10-45-00-000Z.png
```

That is enough for an agent to immediately read the image and reason about it.

Optional flags could stay very small and obvious:

```bash
interactor screenshot --fullpage
interactor screenshot --out page.png
```

But even those are optional. The essential behavior is: take a shot, return a file path.

---

## The mental model

The ideal mental model is not:

> I am controlling Playwright through a rich automation protocol.

It is:

> I have a live browser, and a few shell commands for working with the active tab.

That model is simpler for everyone:

- humans can remember it
- agents can remember it
- docs stay short
- failures are easier to understand
- custom additions are easy to imagine

---

## Why this is better than exposing all of Playwright

A full Playwright-shaped CLI tends to inherit Playwright's complexity:

- many commands
- many nouns
- many parameters
- many result shapes
- more docs than an agent can comfortably keep active

This idealized `interactor` would deliberately reject that.

It would optimize for the most common collaboration loop:

1. start browser
2. open page
3. inspect or manipulate page with JavaScript
4. take screenshot when visual feedback is needed
5. repeat

That loop covers:

- frontend debugging
- scraping exploration
- login-assisted data collection
- quick one-off automations
- interactive agent collaboration

Most of the time, that is enough.

---

## What `eval` replaces

A lot of specialized browser commands become unnecessary if `eval` is good enough.

For example, these do not need their own first-class CLI commands:

- get title
- get URL
- query selector
- count elements
- click selector
- set input value
- read text
- inspect local storage
- read DOM attributes
- scroll page
- extract table rows

All of them can be expressed through page JavaScript.

Examples:

```bash
interactor eval 'document.title'
interactor eval 'document.querySelectorAll(".product").length'
interactor eval 'document.querySelector("button.buy")?.click()'
interactor eval 'localStorage.getItem("token")'
interactor eval 'Array.from(document.querySelectorAll("tr")).map(tr => tr.innerText)'
```

That keeps the API small without making it weak.

---

## Session behavior

To preserve the simplicity of the blog post approach, session handling should be nearly invisible.

The user should not need to think about socket paths, request schemas, or process metadata.

Ideally:

- `interactor start` creates or replaces the current session
- other commands automatically talk to that session
- there is one obvious active browser unless the user explicitly asks for more

If named sessions ever exist, they should remain optional and lightweight:

```bash
interactor start --name work
interactor nav https://example.com --name work
```

But the default experience should avoid making session management part of every command.

---

## Error behavior

Errors should be short and actionable.

Examples:

```text
✗ No browser session running. Run: interactor start
```

```text
✗ No active tab found
```

```text
✗ Failed to evaluate JavaScript: Cannot read properties of null
```

The CLI should avoid dumping giant internal traces unless explicitly asked.

---

## Ideal README shape

The whole interface should fit in a tiny README.

Something like this:

```markdown
# interactor

Minimal browser tools for collaborative site exploration.

## Start

```bash
interactor start
interactor start --profile
```

Start a browser with remote debugging enabled.

## Navigate

```bash
interactor nav https://example.com
interactor nav https://example.com --new
```

Navigate current tab or open a new tab.

## Evaluate JavaScript

```bash
interactor eval 'document.title'
interactor eval 'document.querySelectorAll("a").length'
```

Execute JavaScript in the active tab.

## Screenshot

```bash
interactor screenshot
```

Take a screenshot of the active tab and print the file path.
```

If an agent can read that and immediately become effective, the design is succeeding.

---

## Optional extensions

The blog post's best point is not just that the core API is tiny. It is that adding one more tool is easy.

So `interactor` could keep a tiny core and allow a few high-value additions.

### `interactor pick`

An interactive element picker for when the human wants to help the agent identify elements quickly.

Example:

```bash
interactor pick "Click the submit button"
```

This could return a compact JSON object with useful information about the selected element:

- tag
- id
- classes
- text
- small HTML snippet
- parent path

This is much more valuable than exposing dozens of low-level selector inspection commands.

### `interactor cookies`

A command for reading HTTP-only cookies when automation outside the browser needs them.

Example:

```bash
interactor cookies
interactor cookies --json
interactor cookies --domain example.com
```

Again, small, direct, purpose-built.

---

## Non-goals

To stay true to this design, `interactor` should not try to become:

- a complete Playwright wrapper
- a giant browser automation DSL
- a general event bus with hundreds of actions
- a protocol the user has to study before doing useful work

It can use Playwright internally if that is convenient. But that should be an implementation detail, not the user experience.

---

## A good default workflow

A realistic agent workflow could look like this:

```bash
interactor start --profile
interactor nav https://news.ycombinator.com
interactor eval 'document.title'
interactor eval 'Array.from(document.querySelectorAll(".athing")).slice(0,3).map(row => ({ title: row.querySelector(".titleline a")?.textContent, href: row.querySelector(".titleline a")?.href }))'
interactor screenshot
```

That already supports:

- loading an authenticated or unauthenticated browser
- moving around the web
- extracting structured data
- visually checking the page

Nothing about that flow feels heavy.

---

## The ideal architecture behind the scenes

Internally, `interactor` can still have whatever machinery it needs:

- a local background process
- a socket server
- Playwright or CDP
- metadata files
- temp files

But all of that should exist in service of a very small user-facing contract.

Internals can be sophisticated.
The interface should not be.

---

## Success criteria

`interactor` would feel like the right abstraction if:

- the docs fit on one screen
- an agent can learn the whole tool from a short README
- most browser tasks are solved with `eval`
- screenshots are one command away
- adding one new special-purpose command is easier than extending a big framework
- users think in terms of "browser + shell commands," not "automation platform"

---

## In one sentence

The ideal version of `interactor` is a tiny browser companion for Bash and agents: start, navigate, evaluate JavaScript, screenshot, and only add more commands when a real workflow proves they are worth it.
