# Building UBL Viewer

This document is the build spec for **UBL Viewer**: a high-quality, fast,
full-featured desktop application that renders UBL e-invoices and credit notes
using [`@financica/react-ubl-renderer`](https://github.com/financica/react-ubl-renderer).

It is written to be followed end-to-end by a developer (or an agent) who has
never seen the project. Read it top to bottom once before writing any code.

---

## 1. Product goals

In priority order:

1. **Open a UBL file on double-click.** A user receives an e-invoice as an
   `.xml` file. They double-click it in Windows Explorer and UBL Viewer opens
   instantly with a clean, readable rendering. This is the defining feature —
   the app must be a first-class file handler that Windows offers (and that the
   Microsoft Store surfaces) when a user opens a UBL invoice file.
2. **Render beautifully and correctly.** Invoices and credit notes
   (Peppol BIS Billing 3.0 / EN 16931) render exactly as the renderer library
   produces them: header, supplier/customer, line items, VAT breakdown, totals,
   payment details. Nothing truncated, nothing mangled.
3. **Be fast.** Cold start to first paint should feel instant. Opening a file
   should never show a multi-second spinner for a normal-sized invoice.
4. **Stay local and private.** Invoices are confidential financial documents.
   The app makes **no network requests on the document path** — no upload, no
   telemetry of file contents, no remote fonts. Everything is parsed and
   rendered on-device.
5. **Be full-featured.** Print/PDF export, search, zoom, light/dark, recent
   files, multi-document, drag-and-drop, raw-XML view, graceful errors.
6. **Have a clean path to mobile.** The same React frontend should later ship
   to iOS and Android via Tauri 2's mobile targets without a rewrite.

---

## 2. Tech stack (decided)

| Layer            | Choice                                  | Why |
| ---------------- | --------------------------------------- | --- |
| App shell        | **Tauri 2**                             | One React codebase → Windows now, iOS/Android later. Small bundles (system webview). Native file association + MSIX. |
| Frontend build   | **Vite**                                | Tauri's default; instant HMR. |
| UI               | **React 19 + TypeScript (strict)**      | The renderer is a React component; drop-in. |
| Rendering engine | **`@financica/react-ubl-renderer`**     | Parses + renders UBL invoices/credit notes. Published on npm. |
| UBL parser       | **`@financica/ubl`**                    | Peer dep of the renderer; we also use `decodeXmlBytes` and `documentType` directly. |
| Package manager  | **Bun**                                 | Matches the rest of the `@financica` ecosystem. |
| Lint/format      | **Biome**                               | Matches the renderer repo's config. |

> **Why not Electron?** Electron has easier Store packaging but no mobile path —
> the iOS/Android port would be a full React Native rewrite, and React Native
> cannot reuse this DOM-based renderer. Tauri keeps one codebase across all
> targets; the only cost is MSIX packaging being slightly less turnkey (§8).

---

## 3. Prerequisites

Install before scaffolding:

- **Bun** ≥ 1.3 — `curl -fsSL https://bun.sh/install | bash`
- **Rust (stable)** — `rustup default stable` (Tauri's native side is Rust).
  Confirm with `cargo --version`.
- **Tauri system dependencies** — follow <https://tauri.app/start/prerequisites/>
  for your OS. On Windows the build host needs **WebView2** (preinstalled on
  Windows 11) and the **MSVC build tools**.
- For Store packaging (§8): **Windows 10/11 SDK** (provides `makeappx`,
  `signtool`) and a **Microsoft Partner Center** account.

---

## 4. Scaffolding the project

From `ubl-viewer/`:

```sh
# Scaffold a Tauri 2 + React + TS + Vite app into the current repo.
bun create tauri-app@latest .
#   Frontend language: TypeScript
#   Package manager:    bun
#   UI template:        React
#   UI flavor:          TypeScript

# Add the renderer and parser (parser is a peer dep — install it explicitly so
# we can import decodeXmlBytes / types directly).
bun add @financica/react-ubl-renderer @financica/ubl

# Tauri plugins we rely on (see §6/§7):
bun add @tauri-apps/plugin-fs @tauri-apps/plugin-dialog @tauri-apps/plugin-cli
# Rust side:
cargo add tauri-plugin-single-instance --manifest-path src-tauri/Cargo.toml
```

Wire Biome to match the renderer repo (copy its `biome.json`) and set
`tsconfig` to `strict: true`.

Import the renderer's stylesheet once, at the app root:

```ts
import "@financica/react-ubl-renderer/styles.css";
```

---

## 5. The rendering core

The entire viewing surface is the renderer library. The app's job is to get
**bytes → string → parsed invoice → component**, and to handle the cases where
that fails.

```tsx
// src/InvoiceView.tsx
import { decodeXmlBytes } from "@financica/ubl";
import {
  parseUblInvoice,
  UblInvoice,
  type UblInvoiceData,
} from "@financica/react-ubl-renderer";
import "@financica/react-ubl-renderer/styles.css";

export function decodeAndParse(bytes: Uint8Array): UblInvoiceData | null {
  // decodeXmlBytes respects the XML encoding declaration + strips the BOM,
  // so we never hand mojibake to the parser.
  const xml = decodeXmlBytes(bytes);
  return parseUblInvoice(xml); // null if it isn't a UBL invoice/credit note
}

export function InvoiceView({ invoice }: { invoice: UblInvoiceData }) {
  // documentType is "Invoice" | "CreditNote" — use it for the window title,
  // tab label, and any doc-type-specific chrome. The component renders both.
  return (
    <UblInvoice
      invoice={invoice}
      locale={navigator.language}
      fallback={<NotAnInvoice />}
    />
  );
}
```

**Rules:**

- Always read **bytes** (not a string) from disk and decode with
  `decodeXmlBytes`. UBL files in the wild are UTF-8, UTF-16, or declare some
  other encoding; trusting the OS default corrupts non-ASCII party names.
- `parseUblInvoice` returns `null` for anything that isn't a UBL invoice or
  credit note. Treat `null` as "this is not a file we render" (§6 sniffing,
  §9 error UI) — never crash.
- Use `documentType` to label the UI ("Invoice" vs "Credit note").
- For PDF export / printing, you may reuse `renderUblInvoiceHtml(invoice)` from
  the renderer to get a self-contained HTML document (§9).

---

## 6. Opening files (the four entry points)

All four must converge on the same `openBytes(bytes, path)` function.

1. **File association (double-click in Explorer).** When Windows launches the
   app to open a file, the file path arrives as a process argument.
2. **Second double-click while running.** A new launch must not spawn a second
   process — forward the path to the running instance (single-instance plugin).
3. **Drag-and-drop** onto the window.
4. **File → Open** dialog, and **CLI** (`ubl-viewer invoice.xml`).

### 6a. Rust side — capture the launch path and forward subsequent ones

```rust
// src-tauri/src/main.rs
use tauri::{Emitter, Manager};

fn main() {
    tauri::Builder::default()
        // Single instance: a second launch forwards its argv to the first.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(path) = file_arg(&argv) {
                let _ = app.emit("open-file", path);
            }
            // Focus the existing window.
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_cli::init())
        .setup(|app| {
            // First launch: the file (if any) is in this process's argv.
            if let Some(path) = file_arg(&std::env::args().collect::<Vec<_>>()) {
                app.manage(LaunchFile(std::sync::Mutex::new(Some(path))));
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![take_launch_file])
        .run(tauri::generate_context!())
        .expect("error while running UBL Viewer");
}

struct LaunchFile(std::sync::Mutex<Option<String>>);

/// Returns the first argument that looks like a file path (skips flags/exe).
fn file_arg(argv: &[String]) -> Option<String> {
    argv.iter()
        .skip(1)
        .find(|a| !a.starts_with('-'))
        .cloned()
}

/// The frontend calls this once on startup to pick up a launch-time file.
#[tauri::command]
fn take_launch_file(state: tauri::State<LaunchFile>) -> Option<String> {
    state.0.lock().ok()?.take()
}
```

> The exact plugin/event API can shift between Tauri 2 minor versions — confirm
> signatures against the version you install (`tauri.app/plugin/single-instance`,
> `/plugin/cli`). The shape above (argv on launch + `emit` on re-launch) is the
> stable pattern.

### 6b. Frontend side — one funnel for every entry point

```tsx
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";

async function openPath(path: string) {
  const bytes = await readFile(path); // Uint8Array
  const invoice = decodeAndParse(bytes);
  // → push into app state: render, or show NotAnInvoice / ParseError
}

export function useFileOpening() {
  useEffect(() => {
    // 1. launch-time file (double-click / CLI on first start)
    invoke<string | null>("take_launch_file").then((p) => p && openPath(p));

    // 2. subsequent double-clicks routed by single-instance
    const offOpen = listen<string>("open-file", (e) => openPath(e.payload));

    // 3. drag-and-drop
    const offDrop = getCurrentWebview().onDragDropEvent((e) => {
      if (e.payload.type === "drop") e.payload.paths.forEach(openPath);
    });

    return () => {
      offOpen.then((f) => f());
      offDrop.then((f) => f());
    };
  }, []);
}
```

### 6c. Detecting "is this actually a UBL file?"

`.xml` is a generic extension — many `.xml` files are not invoices. Do **not**
assume; sniff:

- Cheap pre-check: the document root is `<Invoice>` or `<CreditNote>` in a UBL
  namespace (`urn:oasis:names:specification:ubl:schema:xsd:Invoice-2` /
  `…CreditNote-2`).
- Authoritative check: `parseUblInvoice` returns non-`null`.

If it isn't a UBL invoice/credit note, show the `NotAnInvoice` state (§9) with
the option to view raw XML — never a blank screen or a crash.

---

## 7. Windows file association & Store discovery (the key capability)

The headline feature is that Windows offers UBL Viewer when a user opens a UBL
invoice, and that the Microsoft Store surfaces it for users who don't have it
yet. This is achieved by declaring a **file type association** in the **MSIX**
package manifest. (Store distribution requires MSIX — see §8.)

### 7a. The association declaration

In the packaged app's `AppxManifest.xml`, under the application's
`<Extensions>`:

```xml
<Extensions>
  <uap:Extension Category="windows.fileTypeAssociation">
    <uap:FileTypeAssociation Name="ublinvoice">
      <uap:DisplayName>UBL e-invoice</uap:DisplayName>
      <uap:Logo>Assets\invoice.png</uap:Logo>
      <uap:SupportedFileTypes>
        <uap:FileType>.xml</uap:FileType>
        <!-- If/when UBL files arrive with dedicated extensions, add them too:
        <uap:FileType>.ubl</uap:FileType> -->
      </uap:SupportedFileTypes>
    </uap:FileTypeAssociation>
  </uap:Extension>
</Extensions>
```

**Critical design rule — do not hijack `.xml`.** `.xml` is shared by countless
apps. UBL Viewer must register as a *handler*, not force itself as the default.
Declaring the association is what makes Windows:

- list UBL Viewer in the **"Open with"** menu for `.xml` files, and
- (for users without the app) show it in the **"Look for an app in the Store"**
  flow when they try to open a file type this app declares.

The user always chooses; we never silently steal the default handler. Combined
with the content sniffing in §6c, a user who points us at a non-UBL `.xml` gets
a clean "not a UBL invoice" message rather than a broken view.

### 7b. Receiving the activation

When launched via the association, MSIX passes the file path on the command
line — the same `file_arg(argv)` path from §6a handles it. (If you later adopt
the richer `windows.activatableClass` / activation-events API for verb support,
revisit this; for plain "open file" the argv path is sufficient and simplest.)

### 7c. Icon

Ship a distinct, recognizable file icon (`Assets\invoice.png` above) so
associated UBL files are visually identifiable in Explorer.

---

## 8. Packaging for the Microsoft Store (MSIX)

Tauri's default Windows output is `.msi` (WiX) and NSIS. The Store requires
**MSIX**. Path:

1. **Build the app** (`bun tauri build`) to produce the binaries.
2. **Author/patch `AppxManifest.xml`** with the package identity from Partner
   Center (`Name`, `Publisher`, `Version`) and the §7a file association.
3. **Package** with `makeappx pack` (from the Windows SDK) or via the **MSIX
   Packaging Tool** / Advanced Installer if you prefer a GUI. Evaluate
   `cargo-packager`, which can emit MSIX and may streamline this.
4. **Sign** for local testing (`signtool` with a self-signed cert); for the
   Store, Partner Center signs on submission so a local trusted cert isn't
   required for the uploaded package.
5. **Submit** via Partner Center: reserve the name, fill the listing, set
   pricing/availability, upload the `.msixupload`, pass certification.

Keep this packaging flow in CI (a Windows runner) so every release is
reproducible. Document the exact commands in `docs/packaging.md` once settled.

> Note: the Store also accepts traditional installers ("bring your own
> installer"), but MSIX is what unlocks first-class file-type-association
> declarations and Store-driven app suggestions — so MSIX is the target.

---

## 9. Feature checklist (full-featured & high quality)

**Core**
- [ ] Render invoices and credit notes (`documentType`-aware chrome).
- [ ] Four open paths converge on `openPath` (§6): association, drag-drop,
      dialog, CLI.
- [ ] Single-instance; second open focuses the window and loads the file.
- [ ] Robust errors: not-a-UBL-file, malformed XML, unreadable file, empty file
      — each a clear, non-technical message with a "View raw XML" escape hatch.

**Viewing**
- [ ] Print and **export to PDF** (use the system print dialog; or render
      `renderUblInvoiceHtml(invoice)` into a hidden frame and print that for a
      clean, app-chrome-free page).
- [ ] In-document **search** (highlight matches).
- [ ] **Zoom** (Ctrl +/-/0) and fit-to-width.
- [ ] **Light/dark** theme following the OS, with manual override.
- [ ] **Raw XML** view toggle (read-only, syntax-highlighted).
- [ ] Locale-aware currency/number/date formatting (pass `locale`).

**Workflow**
- [ ] **Recent files** list + Windows **Jump List** integration.
- [ ] **Multi-document** (tabs) or fast switching between open invoices.
- [ ] Keyboard shortcuts (open, print, find, zoom, next/prev tab, close).
- [ ] Remember window size/position.

**Quality**
- [ ] Full keyboard navigation and screen-reader labels.
- [ ] App chrome i18n (start with EN; the rendered invoice is already localized
      by the renderer).
- [ ] No layout shift on open; skeleton only if parse is slow.

---

## 10. Performance

- **Cold start:** keep the initial bundle minimal; the renderer is lightweight.
  Don't block first paint on anything but the invoice currently being opened.
- **Large files:** normal invoices are small (KB). For pathologically large
  documents, decode + parse in a Web Worker so the UI thread never janks; show a
  determinate progress state only past a size threshold.
- **No remote assets:** bundle all fonts/styles. A network fetch on the document
  path is both a privacy leak and a latency hit (§11).
- **Memory:** release parsed documents when their tab closes; don't retain raw
  XML strings for closed files.

---

## 11. Privacy & security (non-negotiable)

- **No network on the document path.** Parsing, rendering, printing — all local.
  If telemetry is ever added, it must be opt-in, must never include document
  contents, and must be clearly disclosed.
- **All text is escaped** by the renderer; never inject raw invoice strings into
  the DOM yourself.
- Lock down Tauri's allowlist/capabilities to the minimum: filesystem read for
  user-chosen/associated paths, dialog, print. No shell, no arbitrary fs write.
- Lean on MSIX sandboxing.

---

## 12. Mobile (later, not now)

Tauri 2 targets iOS and Android from this same React frontend:

- `bun tauri ios init` / `bun tauri android init`, then `… dev` / `… build`.
- The renderer (DOM + CSS) carries over unchanged.
- File entry differs: replace the desktop association/argv path with the
  platform **share sheet** / **document picker** (mobile equivalents of §6).
  Keep `openBytes(bytes, …)` as the shared funnel so only the entry layer
  changes.
- Re-test rendering in WKWebView (iOS) and Android System WebView.

Don't build mobile until desktop ships and there's demand — but keep the
`openBytes` funnel and avoid desktop-only assumptions leaking into the renderer
layer so the port stays cheap.

---

## 13. Testing

- **Fixtures:** a set of real-world Peppol BIS 3.0 invoices **and** credit notes
  (varied currencies, VAT scenarios, multi-line, attachments, non-ASCII party
  names, UTF-16) under `fixtures/`.
- **Unit:** `decodeAndParse` over every fixture; assert `documentType` and that
  non-UBL XML yields `null`.
- **Component:** render each fixture, snapshot key fields (totals, VAT, parties).
- **E2E (desktop):** launch with a file argument → asserts it renders; second
  launch → focuses + loads in the same instance; drag-drop; print produces a
  PDF.
- Wire `type-check`, `lint`, `test`, and a Windows packaging smoke test into CI.

---

## 14. Repo conventions

- Match the `@financica` ecosystem: **Bun**, **Biome**, strict TypeScript,
  small focused modules.
- Conventional commits; CI green (type-check + lint + test) before merge.
- Keep `INSTRUCTIONS.md` (this file) updated as decisions land; move settled
  operational detail (exact packaging commands, signing) into `docs/`.
- **License: MIT** — this is an open-source project.

---

## 15. Build order (suggested)

1. Scaffold (§4), wire renderer + `styles.css`, render a hardcoded fixture.
2. `openPath` funnel + File→Open dialog + drag-drop (§6b).
3. Rust launch-arg + single-instance forwarding (§6a); double-click works from
   a dev build.
4. Error states + content sniffing (§6c, §9).
5. Print/PDF, search, zoom, theme, raw-XML, recent files (§9).
6. MSIX packaging + file association (§7, §8); verify Explorer double-click and
   "Open with" on a real install.
7. Partner Center submission.
8. Polish: a11y, shortcuts, perf pass (§10), window state.
9. (Later) mobile (§12).
