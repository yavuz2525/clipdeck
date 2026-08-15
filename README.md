<p align="center">
  <img src="https://github.com/yavuz2525/clipdeck/releases/latest/download/clipdeck-logo.png" alt="ClipDeck logo" width="150" />
</p>

<h1 align="center">ClipDeck</h1>

<p align="center">
  A fast, privacy-first clipboard productivity app with Quick Paste, smart history, reusable snippets, password tools and a local encrypted vault.
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

## Why ClipDeck?

ClipDeck keeps the things you copy close at hand without turning clipboard history into a cloud service. Text history, snippets, settings and vault data stay local to your machine. The main workflow is keyboard-first: open Quick Paste, search, choose, continue working.

## Highlights

| Feature | What it does |
| --- | --- |
| **Quick Paste** | Open a compact global panel, search your recent clipboard and copy an item with the keyboard. |
| **History timeline** | Groups clips into Today, Yesterday, This Week and Older. |
| **Automatic tags** | Detects URL, Email, JSON, SQL, Command, Code, Phone, Color, IP, Path and Text locally. |
| **Pinned clips** | Keeps important clipboard entries above regular history. |
| **Snippets & templates** | Save reusable text and `{{variable}}` templates. |
| **Inline snippet expansion** | Type a snippet trigger such as `mail`, press your expansion shortcut and replace it inline on Windows. |
| **Password generator** | Creates passwords locally using cryptographic randomness. |
| **Local Vault** | Stores login details using Electron `safeStorage` / Windows DPAPI. |
| **Themes** | System, Dark and Light modes. |
| **Automatic updates** | Installed Windows builds can download new GitHub Releases in the background. |
| **Tray + startup** | Closing the window keeps ClipDeck alive; packaged Windows builds can start silently at sign-in. |

## Quick workflows

### Quick Paste

Default shortcut:

```text
Ctrl + Shift + V
```

Open the panel, type to search, use `↑` / `↓`, then press `Enter` to copy the selected item.

### Inline snippet expansion

Create a snippet:

```text
Name / trigger: mail
Template: you@example.com
```

Then type:

```text
mail
```

and press the snippet expansion shortcut. ClipDeck replaces the word immediately before the caret with the snippet content.

Default on Windows:

```text
Ctrl + Alt + E
```

Both the Quick Paste shortcut and the snippet expansion shortcut can be changed from **Settings**.

Templates containing variables such as `Hello {{name}}` still use the **Fill & copy** flow.

> Inline expansion uses simulated keyboard input on Windows. Elevated/admin applications and some unusual editors may block it.

## Password generator & local Vault

The generator supports configurable length plus lowercase, uppercase, number and symbol character classes.

Vault entries can store:

- Title
- Username / email
- Password
- URL
- Notes

Vault payloads are encrypted before they are written to disk with Electron `safeStorage`. On Windows this uses DPAPI tied to the logged-in Windows user. Passwords copied through the Vault or generator are deliberately excluded from ClipDeck's own clipboard history.

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

Installed Windows builds use `electron-updater`. ClipDeck periodically checks GitHub Releases, downloads a newer version in the background and offers **Restart and update** when it is ready.

Each release publishes:

```text
ClipDeck-Setup-x.y.z.exe
ClipDeck-Setup-x.y.z.exe.blockmap
latest.yml
clipdeck-logo.png
```

## Privacy & security

- Clipboard history stays local.
- Snippets and settings stay local.
- Renderer Node integration is disabled.
- Context isolation is enabled.
- Renderer CSP blocks network connections.
- Vault data is stored separately and encrypted with the operating system protection layer.
- Passwords copied through ClipDeck's password tools are not inserted into ClipDeck history.

Clipboard history can still contain secrets copied from other applications. Pause monitoring before copying anything you do not want saved.

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

`npm start` is development mode. The pre-start script reconstructs `build/icon.png` from the repository's text-based brand source before Electron launches.

### Validate

```bash
npm run check
npm test
```

### Build the Windows installer

On Windows:

```bash
npm install
npm run dist:win
```

Output:

```text
dist/ClipDeck-Setup-0.5.2.exe
```

## Brand asset workflow

The app logo is stored in the repository as a compact text source at `assets/brand/icon.hex`. `npm run brand:generate` reconstructs `build/icon.png` before development and packaging. This avoids requiring binary/Base64 GitHub blob uploads when updating the logo.

The generated PNG is used for the app window, tray and Windows package source. electron-builder converts the PNG into the platform-specific icon formats needed by the Windows build.

## Tech

- Electron
- electron-builder + NSIS
- electron-updater
- Electron `safeStorage`
- Vanilla HTML, CSS and JavaScript
- Node.js built-in `crypto`
- Node.js built-in test runner
- No frontend framework

## Roadmap

- Image clipboard history
- App exclusion rules for password managers and selected applications
- Import / export
- Optional master-password layer for the Vault
- Windows code signing
- Direct paste into the previously focused application
- Variable-aware inline snippet expansion

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Please read [SECURITY.md](SECURITY.md) before reporting a sensitive issue.

## License

MIT © Yavuz Cingöz
