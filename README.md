# UBL Viewer

A fast, native desktop app for viewing UBL e-invoices and credit notes
(Peppol BIS Billing 3.0 / EN 16931). Double-click a UBL `.xml` file and see a
clean, human-readable invoice — no spreadsheet, no portal, no upload.

Built on [`@financica/react-ubl-renderer`](https://github.com/financica/react-ubl-renderer)
and packaged with [Tauri 2](https://tauri.app) so the same React + TypeScript
codebase ships to Windows today and to iOS/Android later.

> **Status:** the React frontend is complete and fully tested; the Tauri/Rust
> shell and MSIX packaging are wired up and need a Windows host with the Rust
> toolchain to compile and ship. See [`INSTRUCTIONS.md`](./INSTRUCTIONS.md) for
> the full build plan and [`docs/packaging.md`](./docs/packaging.md) for the
> Store path.

## Highlights

- **Open on double-click.** Registers as a Windows handler for UBL invoice
  files so opening one is instant.
- **Everything stays local.** Invoices are confidential; this app makes no
  network calls on the document path. Parsing and rendering happen entirely
  on-device.
- **Invoices and credit notes.** Both UBL document types, rendered by the same
  engine.
- **Print / export to PDF**, search, zoom, light/dark, recent files.

## Tech stack

| Layer        | Choice                                              |
| ------------ | --------------------------------------------------- |
| Shell        | Tauri 2 (Rust + system webview)                     |
| UI           | React 19 + TypeScript + Vite                        |
| Rendering    | `@financica/react-ubl-renderer` + `@financica/ubl`  |
| Tooling      | Bun, Biome                                          |

## Development

```sh
bun install

# Frontend only (browser, no native shell) — fast iteration:
bun run dev          # http://localhost:1420

# Full desktop app (needs Rust + WebView2 + MSVC; see docs/packaging.md):
bun tauri dev

# Quality gate (all cross-platform, no Rust needed):
bun run type-check
bun run lint         # Biome
bun run test         # Vitest
bun run build        # tsc + Vite production build
```

The Rust side has its own unit tests: `cd src-tauri && cargo test`.

## Architecture

Every way of opening a file — Explorer double-click (file association), a second
launch (forwarded by single-instance), drag-and-drop, the File→Open dialog, and
the CLI — funnels through one path:

```
bytes ──▶ decodeAndParse ──▶ Doc { invoice | error, xml } ──▶ store ──▶ UI
          (encoding-aware    (parseUblInvoice;
           decode + sniff)    typed errors, never throws)
```

- `src/core/` — framework-free logic: decoding (`decode.ts`), the open funnel
  (`openFile.ts`), the document store (`store.ts`), parsing off-thread for large
  files (`parse.ts` + `parseWorker.ts`), print (`print.ts`), search, theme.
- `src/components/` — the React surface (toolbar, tabs, invoice view, raw-XML
  view, error/empty states).
- `src/hooks/` — the desktop entry points (`useFileOpening`) and shortcuts.
- `src-tauri/` — the native shell: launch-arg capture + single-instance
  forwarding (`src/lib.rs`), capabilities, and the MSIX manifest (`msix/`).

Keeping `openBytes(bytes, …)` as the single funnel is what makes the planned
mobile port (share sheet / document picker) cheap — only the entry layer
changes.

## License

MIT — see [`LICENSE`](./LICENSE).
