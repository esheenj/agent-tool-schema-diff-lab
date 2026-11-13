# Agent Tool Schema Diff Lab

**Agent tools change. Know what breaks.**

Offline, MIT-licensed compatibility checker for MCP-style tools, Anthropic tool catalogs, and OpenAI function-tool declarations. Compare a previous and proposed JSON tool list to catch changes that are easy to miss in reviews: removed tools, newly required parameters, narrowed types or enums, tightened numeric bounds and changed object shapes.

Designed and maintained by **Esheen Labs**. Fictional examples; no account, paid API, telemetry, backend or private service required.

## Try it

**Browser demo (GitHub Pages):** https://esheenj.github.io/agent-tool-schema-diff-lab/

Or run the command-line tool with Node.js 20+:

```bash
git clone https://github.com/esheenj/agent-tool-schema-diff-lab.git
cd agent-tool-schema-diff-lab
npm test
npm run compare
```

The demo is a deliberate breaking-change example. Exit codes: `0` = compatible within supported subset, `2` = breaking changes, `3` = manual review needed without a detected break, `1` = invalid inputs.

For your own tool catalogs:

```bash
node src/cli.mjs old-tools.json new-tools.json
npm run build
python3 -m http.server 8000 --directory dist --bind 127.0.0.1
```

Open http://127.0.0.1:8000 to use the browser UI. Input is held in the page only and not sent anywhere. The browser **does not** load files from elsewhere; paste your own JSON locally, or load the synthetic examples.

## Input conventions

Accepts either a JSON array or `{"tools":[...]}` and supports:

- MCP: `{"name":"search","inputSchema":{"type":"object","properties":{...}}}`
- Anthropic-style: `{"name":"search","input_schema":{...}}`
- OpenAI function tool: `{"type":"function","function":{"name":"search","parameters":{...}}}`

All names must be unique. Up to 500 tools per catalog and 1 MiB per CLI file or browser text input.

## What is checked

| Change | Classification |
| --- | --- |
| Tool removed, declared field removed | Breaking |
| New required field | Breaking |
| Accepted JSON type or enum member removed | Breaking |
| Type restriction, constant or tighter numeric/string/array bounds introduced | Breaking |
| Additional object properties newly disallowed | Breaking |
| New tool, optional field or wider range/enum | Informational |
| Descriptions changed | Informational |
| Changed `$ref`, oneOf/anyOf/allOf, dynamic or unsupported rules | Manual review |

This is a **conservative contract inspection**, not a complete JSON Schema compatibility verifier. Semantic meaning, tool runtime behavior, authentication, privacy policies, response/output schemas, handler availability, model performance and external agent identity are beyond scope. Unchanged advanced constraints do not imply their semantics were tested.

## Development

- `src/diff.mjs`: pure deterministic library, no network or dependencies
- `src/cli.mjs`: local CLI with explicit exit statuses
- `site/`: keyboard-usable static interface, no external fonts/assets/telemetry
- `scripts/build.mjs`: stages a reproducible Pages bundle in `dist/`
- `tests/`: unit and adversarial checks via Node's built-in test runner
- `.github/workflows/`: tested public Pages release from `main`

**Contributions:** please open a small issue describing the tool schema shape and expected classification. Do not include secrets, private prompts, customer data or proprietary schema examples; create fictional reproducers instead.

## Project boundaries

No private Cortex/Commander/SIGMA code, credentials, trading authority, financial integrations or owner infrastructure is bundled or used. This public tool neither verifies an agent's identity nor authorizes its actions.

MIT License. © 2026 Esheen Labs.
