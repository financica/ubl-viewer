# UBL Viewer

A fast, native desktop app for viewing UBL e-invoices and credit notes
(Peppol BIS Billing 3.0 / EN 16931). Double-click a UBL `.xml` file and see a
clean, human-readable invoice — no spreadsheet, no portal, no upload.

Built on [`@financica/react-ubl-renderer`](https://github.com/financica/react-ubl-renderer)
and packaged with [Tauri 2](https://tauri.app) so the same React + TypeScript
codebase ships to Windows today and to iOS/Android later.

> **Status:** scaffolding. See [`INSTRUCTIONS.md`](./INSTRUCTIONS.md) for the
> full build plan and architecture.

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

## License

MIT — see [`LICENSE`](./LICENSE).
