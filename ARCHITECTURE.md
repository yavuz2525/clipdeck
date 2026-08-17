# ClipDeck Architecture

ClipDeck uses a strict Electron process boundary so UI code never needs direct Node.js or Electron access.

## Process layers

### Main process

- `main.js` owns the core Electron lifecycle, text clipboard history, snippets, Vault, shortcuts, tray and updates.
- `bootstrap.js` adds image history, local OCR, QR tools and snippet suggestions.
- Store/service modules under `src/` own persistence and domain logic.

### Preload bridge

`preload.js` is intentionally DOM-free. It exposes a small allowlisted API through `contextBridge` and maps only known renderer actions to known IPC channels.

It must not:

- query or mutate DOM nodes;
- create renderer UI;
- attach browser event handlers;
- expose raw `ipcRenderer` to the renderer.

`tests/architecture.test.js` enforces this boundary.

### Renderer

- `src/renderer/app.js` owns History, Snippets, Vault and core Settings behavior.
- `src/renderer/shortcut-settings.js` owns snippet-expansion shortcut capture UI.
- `src/renderer/media-ui.js` owns Images, OCR, QR and media Settings behavior.
- `src/renderer/index.html` contains the static application views and Settings markup.
- CSS remains split by responsibility (`styles.css`, `enhancements.css`, `media-tools.css`).

### Focused utility windows

- `src/quick/` contains the Quick Paste window.
- `src/suggest/` contains the snippet suggestion popup and its Windows keyboard-hook controller.

## Data flow

```text
Renderer UI
    ↓ window.clipdeck (contextBridge)
preload.js
    ↓ allowlisted IPC
main.js / bootstrap.js
    ↓
Stores + local services
```

The renderer has `nodeIntegration: false`, `contextIsolation: true` and a restrictive Content Security Policy.
