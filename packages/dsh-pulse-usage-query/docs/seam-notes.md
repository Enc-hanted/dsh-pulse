# Seam notes — how a plugin exposes a tool to the model

Research record for ROADMAP P3-2 (#9). Verified against the host snapshot
`@deepseek-ai` **0.2.1-alpha.5** at
`C:\Users\Enc\AppData\Local\npm-cache\_npx\ebf017b61addb8bd\node_modules\@deepseek-ai\`
(≈270 packages; the runtime the user actually runs). Paths below are relative
to that `@deepseek-ai\` directory unless noted.

## TL;DR

- **Host service name: `tools`** — the Cordis context member `ctx.tools`
  (`ToolRuntime`, "Tool registry and execution pipeline").
- **Registration call: `ctx.tools.register(definition) → disposer`**, where
  `definition` is a plain object: `name`, `description`,
  `parameters` (raw JSON Schema object), mandatory
  `output: { schema, render(args, value) → ContentBlock[] }`, and
  `execute(args, exec) → Promise<value>`.
- **Parameter declaration is neither schemastery nor zod**: the first-party
  authoring path is `defineTool` from `@deepseek-ai/dsh-tools`, whose
  parameter DSL (`ParameterSchemaSpec`) is its own JSON-schema-like spec.
  A hand-built plain definition with a raw JSON-Schema `parameters` object is
  equally acceptable to `register` — that is what this package does, so it
  needs no runtime import of `@deepseek-ai/dsh-tools`.
- The plugin's own `Config` (deployment config) is schemastery — a separate
  concern from tool parameters.

## The seam, with evidence

### 1. Service name and context member

`dsh-tools/lib/types/index.d.ts:32-35` declares the Cordis interface
augmentation:

```ts
declare module '@deepseek-ai/cordis' {
    interface Context {
        tools: ToolRuntime;
    }
}
```

The service directory (host `Service.listService` inspection) lists key
`tools` — "Tool registry and execution pipeline" — with
`register(definition: ToolDefinition): () => void` among its methods.
`dsh-tools/lib/index.js:2760-2761`: `var ToolRuntime = class extends Service
{ static inject = ["systemPrompt"]; ... }` (the registry itself depends only
on the prompt service).

### 2. Registration call and its runtime validation

`dsh-tools/lib/index.js:2974-2983`:

```js
register(definition) {
    const name = definition.name;
    const output = definition.output;
    if (output === void 0 || typeof output !== "object"
        || typeof output.render !== "function"
        || output.presentationMeta !== void 0 && typeof output.presentationMeta !== "function")
        throw new TypeError(`tool "${name}" must declare output { schema, render, presentationMeta? }`);
    assertSupportedJsonSchema(output.schema);
    ...
    if (name === "run_code") throw new Error(...reserved...);
    return this.layers.effect(this.ctx, (layer) => layer.tools.insert(name, definition),
        { label: "tools.register()" });
}
```

So `register` reads only `name`, `output` (shape + schema subset), and
optionally `timeoutMs`; the definition is stored whole. Definitions built by
`defineTool` and hand-built plain objects are indistinguishable to it.

### 3. Definition shape

`dsh-llm/lib/types/types.d.ts:472-483` — the base:

```ts
export interface ToolSchema {
    deferLoading?: true;
    name: string;
    description: string;
    /** JSON Schema object for the arguments. */
    parameters: Record<string, unknown>;
}
```

`dsh-tools/lib/types/index.d.ts:114-128` — the extension:

```ts
export interface ToolDefinition extends ToolSchema {
    readonly output: ToolOutputDefinition;   // { schema: JsonSchemaNode, render, presentationMeta? }
    execute(args: unknown, exec: ToolRunContext): Promise<unknown>;
    // optional: timeoutMs, isConcurrencySafe, presentCall, presentResult,
    //           projectContent, finalizeContent
}
```

`ToolRunContext` (dsh-tools/lib/types/index.d.ts:305-322) extends the frozen
execution (`callId`, `name`, `arguments`, optional `agent`, `signal`, ...) with
`deferContext`/`concludeTurn`. A read-only tool can ignore it.

### 4. What the model actually sees

`dsh-tools/lib/index.js:3119-3145` — `schemas()`/`schemaOf()` project each
visible definition to exactly `{name, description, parameters[, deferLoading]}`
(deep-cloned); execution and presentation callbacks never leave the host.
`timeoutMs` is explicitly documented as never model-visible
(dsh-tools/lib/types/index.d.ts:151-158).

### 5. Execution and output enforcement

`dsh-tools/lib/index.js:3390-3415` — `dispatchToolBody` calls
`tool.execute(exec.arguments, exec)`, wraps the returned value via
`createSuccessResult` (validated against `output.schema`; a violation throws
`ToolOutputError`), and a thrown error becomes the tool's error result
(`toolErrorResult(error)`) — i.e. **throwing a short `Error` is the error
surface** for this package's "出错返回简短错误字符串".

The output schema must sit inside the enforced JSON Schema subset
(`dsh-tools/lib/types/json-schema.d.ts:24-49`): per node `type`, `properties`,
`required` (name array), boolean `additionalProperties`, `items`, scalar
`enum`/`const`, `oneOf` (≥2 branches), plus annotations. **No
`minimum`/`maximum`** — hence `usage_query`'s 1–20 `top` range is stated in
the parameter description and enforced inside `execute`.

### 6. First-party idiom (the template this package follows)

`dsh-tool-todo/lib/index.js:11-12`:

```js
const name = "tool-todo";
const inject = ["tools", "sessionProjections"];
```

and `dsh-tool-todo/lib/index.js:95-119`:

```js
ctx.tools.register(defineTool({
    name: "todo_write",
    description: describe(allowParallel),
    parameters: { todos: { type: "array", required: true, description: "...", items: {...} } },
    output: { schema: {...}, render: (_args, value) => [{ type: "text", text: `...` }] },
    execute(args, exec) { ... },
}));
```

`defineTool` (`dsh-tools/lib/index.js:838-887`,
`dsh-tools/lib/types/schema.d.ts:177-248`) compiles the author DSL
(`ParameterSchemaSpec`, schema.d.ts:74-84 — per-property `required: true`
annotations, NOT zod/schemastery) into the raw JSON-Schema `parameters` and
wraps `execute` with argument validation. Plugin config in the same file is
schemastery (`dsh-tool-todo/lib/index.js:1,20`). A hand-built definition must
therefore validate its arguments itself — which `usageQueryInput` does.

### 7. Scope and lifecycle

`register` on an unscoped plugin context inserts into the **global layer**
(`dsh-tools/lib/index.js:2982`, `layers.effect(this.ctx, ...)`), and
`view()` (`lib/index.js:3055-3069`) inherits global tools into every scope:
a globally registered tool is visible to **every agent** in the host. The
`layers.effect` tie means the registration dies with the registering fiber;
wrapping the returned disposer in `ctx.effect` (as dsh-pulse's host half
does for its routes) makes the cleanup explicit. Registration emits
`tools/change` (`lib/index.js:2783-2785`), which re-assembles prompts.

### 8. Read-only concurrency

Only an explicit opt-in joins parallel sibling calls:
`isConcurrencySafe(args) → true` (dsh-tools/lib/types/index.d.ts:160-172;
classifier at `lib/index.js:3153-3161`, everything else is exclusive).
`usage_query` is a read over caches designed for concurrent readers, so it
opts in. `timeoutMs` asserts cooperative signal forwarding
(dsh-tools/lib/types/index.d.ts:151-158) — deliberately NOT declared, since
`buildStats` does not observe abort signals.

## The second seam: dsh-pulse's aggregation

The tool does not refold anything itself; it calls dsh-pulse's exported
`buildStats(ctx, resolveConfig, input, snapshotsOf?)` (repository
`src/index.js:155-193`, exported at `src/index.js:21`), whose ctx needs
exactly four read services — declared in this package's `inject`:
`sessionQuery` (corpus listing + log reads), `sessions` (live store),
`sessionProjections` (snapshots), `sessionProjectionCache` (cold-fold
ladder). `dsh-pulse` must be mounted for those projections to exist. The
`import ... from "dsh-pulse"` in `src/index.js` resolves in a host through
the loader's linked-root interception of `peerDependencies` names
(`dsh-app-boot/lib/index.js:1676-1704`, `readPeerNames` at L1684 — the same
mechanism ROADMAP D0 pinned for dsh-credentials/dsh-storage-domain).

## Why no runtime dependency on `@deepseek-ai/dsh-tools`

`register` accepts any conformant plain definition (§2), so importing
`defineTool` would add a host-seam package to `peerDependencies` for sugar
only. Skipping it also keeps the package importable in this repository's dev
tree, whose `node_modules/@deepseek-ai` does not include `dsh-tools`. The
cost is manual argument validation in `usageQueryInput` — which is needed
anyway for the `top` range the schema subset cannot express (§5).
