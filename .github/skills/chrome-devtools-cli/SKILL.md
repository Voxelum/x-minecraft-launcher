---
name: chrome-devtools-cli
description: "Use when: validating XMCL UI, Electron main/preload/runtime integration, renderer behavior, console errors, network requests, screenshots, or performance in the real development launcher through the Chrome DevTools CLI."
---

# Chrome DevTools CLI

Use the official `chrome-devtools` CLI to inspect and drive the running XMCL
Electron app. Do not configure, enable, or call Chrome DevTools through MCP
tools. The npm package name still contains `mcp`, but the `chrome-devtools`
binary is its standalone CLI client and does not require an MCP client config.

Use this command prefix without adding a project dependency:

```bash
npx -y -p chrome-devtools-mcp@latest chrome-devtools
```

## Connect to XMCL

1. Reuse the running `dev:main` and `dev:renderer` tasks. Do not start duplicate
   tasks or another Electron app.
2. Discover the active debugging port from the Electron process arguments or
   task output. Probe likely ports only as a fallback:

   ```bash
   curl --fail --silent http://127.0.0.1:9222/json/list
   curl --fail --silent http://127.0.0.1:9300/json/list
   ```

3. Stop a stale CLI daemon, connect it to the discovered port, then verify the
   selected launcher page:

   ```bash
   npx -y -p chrome-devtools-mcp@latest chrome-devtools stop
   npx -y -p chrome-devtools-mcp@latest chrome-devtools start --browserUrl http://127.0.0.1:<port>
   npx -y -p chrome-devtools-mcp@latest chrome-devtools list_pages --output-format=json
   ```

   The real development page must be titled `X Minecraft Launcher` or `XMCL`
   and load from `http://localhost:3000`, not `http://xmcl.runtime`. Keep its
   numeric page ID for every page-scoped command.

## Drive and inspect

Take a fresh accessibility snapshot before resolving element UIDs. UIDs can
change after navigation, hot reload, dialogs, or other DOM updates.

```bash
npx -y -p chrome-devtools-mcp@latest chrome-devtools take_snapshot <pageId> --output-format=json
npx -y -p chrome-devtools-mcp@latest chrome-devtools click <pageId> <uid>
npx -y -p chrome-devtools-mcp@latest chrome-devtools fill <pageId> <uid> "value"
npx -y -p chrome-devtools-mcp@latest chrome-devtools press_key <pageId> "Enter"
npx -y -p chrome-devtools-mcp@latest chrome-devtools evaluate_script "() => ({ title: document.title, href: location.href })" --pageId <pageId> --output-format=json
```

Inspect renderer failures and relevant requests after exercising the complete
workflow:

```bash
npx -y -p chrome-devtools-mcp@latest chrome-devtools list_console_messages <pageId> --output-format=json
npx -y -p chrome-devtools-mcp@latest chrome-devtools list_network_requests <pageId> --output-format=json
```

Use `<command> --help` before relying on an unfamiliar or version-sensitive
flag. Prefer JSON output so results can be checked precisely. Screenshots for
temporary inspection belong outside the repository unless the task explicitly
requires review evidence:

```bash
npx -y -p chrome-devtools-mcp@latest chrome-devtools take_screenshot <pageId> --filePath "$TEMP/xmcl-devtools.png"
```

For the main launcher, validate at `1200x720` and, when layout risk warrants
it, `800x400`. Do not use mobile-like viewport sizes.

## Finish

- Preserve user state and remove only temporary resources created by the test.
- After a main/runtime rebuild, restart only this repository's Electron app,
  reconnect the CLI, and repeat the same workflow.
- Run the narrowest automated test plus type-check or lint required by
  `AGENTS.md`; CLI validation does not replace those checks.
- Stop the CLI daemon when validation is complete:

  ```bash
  npx -y -p chrome-devtools-mcp@latest chrome-devtools stop
  ```

- Report the route and controls exercised, observed state transitions, relevant
  console/network results, screenshots if requested, and cleanup performed.