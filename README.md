<p align="center">
  <img src="https://github.com/yavuz2525/clipdeck/releases/latest/download/clipdeck-logo.png" alt="ClipDeck logo" width="150" />
</p>

<h1 align="center">ClipDeck</h1>

<p align="center">
  A privacy-first Windows clipboard productivity app with Quick Paste, text and image history, reusable snippets, local OCR/QR tools, password generation and an OS-encrypted local vault.
</p>

<p align="center">
  <a href="https://github.com/yavuz2525/clipdeck/releases/latest"><img alt="Download for Windows" src="https://img.shields.io/badge/Download-Windows%20Setup-0078D4?style=for-the-badge&logo=windows11&logoColor=white"></a>
</p>

<p align="center">
  <a href="https://github.com/yavuz2525/clipdeck/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/yavuz2525/clipdeck/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/yavuz2525/clipdeck/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/yavuz2525/clipdeck"></a>
  <img alt="License" src="https://img.shields.io/github/license/yavuz2525/clipdeck">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-0078D4">
</p>

---

## Highlights

| Feature | What it does |
| --- | --- |
| **Quick Paste** | Open a compact global panel, search recent clipboard text and copy an item with the keyboard. |
| **Text history** | Timeline, search, automatic local tags, favorites and pinned clips. |
| **Image / screenshot history** | Keeps copied images and screenshots locally as PNG files in a dedicated Images view. |
| **Local OCR** | Extracts English and Turkish text from saved clipboard images without sending them to an API. |
| **QR Center** | Generate QR images from text/URLs and scan QR codes from the clipboard or saved images. |
| **Snippets & templates** | Save reusable text and `{{variable}}` templates. |
| **Inline snippet expansion** | Type a trigger such as `mail`, press the configurable expansion shortcut and replace it inline on Windows. |
| **Snippet suggestions** | Shows matching snippet triggers in a small popup while you type. |
| **Password generator** | Creates passwords locally using cryptographic randomness. |
| **Local Vault** | Stores login details using Electron `safeStorage` / Windows DPAPI. |
| **Themes** | System, Dark and Light modes. |
| **Automatic updates** | Installed Windows builds download new GitHub Releases in the background. |
| **Tray + startup** | Closing the window keeps ClipDeck alive; packaged Windows builds start silently at sign-in. |

## Quick Paste

Default shortcut:

```text
Ctrl + Shift + V
```

Open the panel, type to search, use `↑` / `↓`, then press `Enter` to copy the selected text item.

## Image history, OCR and QR

Copy a screenshot or image and ClipDeck stores a local PNG copy in the **Images** section. Images can be pinned, copied again, deleted, processed with OCR, or scanned for a QR code.

OCR runs locally using bundled English + Turkish Tesseract language data. The image is not uploaded to a cloud OCR service.

The **QR** section can:

- Generate a QR code from text or a URL.
- Copy the generated QR as an image.
- Scan a QR code from the current clipboard image.
- Scan QR codes from images already stored in Image History.

Generated QR images can also become part of Image History.

## Snippets, inline expansion and suggestions

Create a snippet:

```text
Name / trigger: mail
Template: you@example.com
```

Type `mail` in another Windows application. ClipDeck can show a small matching-trigger suggestion popup while you type. To replace the trigger, press the snippet expansion shortcut.

Default:

```text
Ctrl + Alt + E
```

Both the Quick Paste shortcut and snippet expansion shortcut are configurable in **Settings**. Snippet suggestions can also be disabled there.

Templates containing variables such as `Hello {{name}}` still use **Fill & copy**.

> The suggestion feature uses a Windows global keyboard hook. ClipDeck keeps only the current short trigger-shaped token in memory for matching; the typed token is not written to disk. The popup does not intercept your keys. Disable **Snippet suggestions** in Settings if you do not want global suggestion monitoring.

> Inline expansion uses simulated keyboard input on Windows. Elevated/admin applications and unusual editors may block it.

## Password generator & local Vault

The generator supports configurable length plus lowercase, uppercase, number and symbol character classes.

Vault entries can store title, username/email, password, URL and notes. Vault payloads are encrypted before disk storage with Electron `safeStorage`; on Windows this uses DPAPI tied to the logged-in user. Passwords copied through the Vault or generator are excluded from ClipDeck's own clipboard history.

> ClipDeck Vault is a convenient local OS-encrypted store, not a replacement for a dedicated independently audited password manager.

## Install on Windows

For everyday use you do **not** need Node.js, npm or a CMD window.

1. Open the [latest ClipDeck release](https://github.com/yavuz2525/clipdeck/releases/latest).
2. Download `ClipDeck-Setup-x.y.z.exe`.
3. Run the installer.
4. Launch ClipDeck from the Start menu or desktop shortcut.

Closing the main window with `X` keeps ClipDeck running in the notification area.

> Current public builds are not code-signed, so Windows may show a SmartScreen / unknown publisher warning.

## Automatic updates

Installed Windows builds use `electron-updater`. ClipDeck checks GitHub Releases, downloads newer versions in the background and offers **Restart and update** when ready.

Each release publishes:

```text
ClipDeck-Setup-x.y.z.exe
ClipDeck-Setup-x.y.z.exe.blockmap
latest.yml
clipdeck-logo.png
```

## Privacy & local storage

- Text clipboard history stays local.
- Clipboard images are stored locally under ClipDeck's Electron user-data directory.
- OCR runs locally with bundled language data.
- QR generation/scanning runs locally.
- Snippets and settings stay local.
- Snippet suggestions keep only the current bounded trigger candidate in RAM and do not persist typed input.
- Renderer Node integration is disabled and context isolation is enabled.
- Vault data is stored separately and encrypted with the operating-system protection layer.
- Passwords copied through ClipDeck's password tools are excluded from ClipDeck history.

Clipboard history can still contain sensitive content copied from other applications. Pause monitoring or disable the relevant history feature before copying anything you do not want stored.

## Development

Requirements:

- Node.js 22.12+
- npm

```bash
git clone https://github.com/yavuz2525/clipdeck.git
cd clipdeck
npm install
npm start
```

### Validate

```bash
npm run check
npm test
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the Electron process boundary and renderer/preload responsibilities.

### Build the Windows installer

```bash
npm install
npm run dist:win
```

Output for this release:

```text
dist/ClipDeck-Setup-0.6.2.exe
```

## Tech

- Electron
- electron-builder + NSIS
- electron-updater
- Tesseract.js with bundled English/Turkish language data
- qrcode + jsQR + pngjs
- uiohook-napi for Windows snippet suggestions
- Electron `safeStorage`
- Vanilla HTML, CSS and JavaScript
- Node.js built-in `crypto`
- Node.js built-in test runner

## Brand asset workflow

The app logo is stored as a compact text source at `assets/brand/icon.hex`. `npm run brand:generate` reconstructs `build/icon.png` before development and packaging, avoiding large binary/Base64 GitHub blob uploads.

## Roadmap

- App exclusion rules for password managers and selected applications
- Import / export
- Optional master-password layer for the Vault
- Windows code signing
- Direct paste into the previously focused application
- Variable-aware inline snippet expansion
- Richer image search and OCR indexing

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Please read [SECURITY.md](SECURITY.md) before reporting a sensitive issue.

## License

MIT © Yavuz Cingöz
