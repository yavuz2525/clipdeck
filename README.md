# ClipDeck

A fast, privacy-first clipboard productivity app for Windows, macOS and Linux.

ClipDeck keeps clipboard text history locally, gives you a keyboard-first Quick Paste panel, reusable snippets/templates, pinned clips, and an OS-encrypted local password vault. Clipboard content is not uploaded to a cloud service.

## Features

### Clipboard history

- Automatic clipboard text history
- Quick Paste panel with a configurable global shortcut
- Keyboard navigation with arrow keys, Enter and Escape
- History timeline grouped into Today / Yesterday / This Week / Older
- Pinned clips shown in a dedicated Pinned group and prioritized in Quick Paste
- Favorites
- Automatic local tags: URL, Email, JSON, SQL, Command, Code, Phone, Color, IP, Path and Text
- Search and tag filters
- Clear regular history while preserving favorites and pinned clips
- Configurable history size: 25 / 50 / 100 / 250
- Close-to-tray background behavior
- Silent Windows login startup for packaged builds

### Snippets and templates

Save frequently reused text as a snippet. Templates support placeholders such as:

```text
Hello {{name}}, your order {{order_id}} is ready.
```

When a template contains variables, ClipDeck asks for the values before copying the rendered result. Any clipboard item can also be converted into a snippet from its card.

### Password generator and local vault

ClipDeck includes a local password generator using Node.js cryptographic randomness, with configurable length and character classes.

Vault entries can store:

- Title
- Username / email
- Password
- URL
- Notes

Vault payloads are encrypted before being written to disk using Electron `safeStorage`. On Windows this uses DPAPI tied to the logged-in Windows user. Passwords copied from the generator or Vault are deliberately excluded from ClipDeck's own clipboard history.

> The Vault is a convenient local OS-encrypted store, not a replacement for a dedicated audited password manager. On Linux, protection depends on the desktop secret-store backend; ClipDeck warns when strong OS-level protection is unavailable.

### Themes and settings

Settings include:

- Theme: System / Dark / Light
- Configurable Quick Paste global shortcut
- Automatic update status and manual update check

The chosen theme is also applied to the Quick Paste window.

### Automatic updates

Installed Windows builds use `electron-updater`. ClipDeck checks GitHub Releases automatically, downloads a new version in the background, and offers **Restart and update** when it is ready.

Each Windows release publishes:

```text
ClipDeck-Setup-x.y.z.exe
ClipDeck-Setup-x.y.z.exe.blockmap
latest.yml
```

## Install on Windows

For normal use you do **not** need Node.js, npm or a CMD window.

1. Open the repository's **Releases** page.
2. Download `ClipDeck-Setup-0.4.0.exe` or the newest version.
3. Run the installer.
4. Launch ClipDeck from the Start menu or desktop shortcut.

Closing the main window with `X` keeps ClipDeck running in the notification area. Packaged Windows builds also start silently after Windows sign-in.

> The current open-source build is not code-signed, so Windows may show a SmartScreen / unknown publisher warning.

## Privacy and security

Clipboard history, snippets and settings stay in the Electron user-data directory on the local machine. The renderer has Node integration disabled, uses context isolation, and its Content Security Policy blocks network connections.

Vault secrets are stored in a separate encrypted file. Clipboard passwords copied through the Vault/generator API are not added to clipboard history.

Clipboard history itself can still contain sensitive information copied from other applications. Pause monitoring before copying secrets that you do not want stored in history.

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

`npm start` is development mode. Use the installed Windows build for normal everyday use.

## Validate

```bash
npm run check
npm test
```

## Build the Windows installer locally

On Windows:

```bash
npm install
npm run dist:win
```

Output:

```text
dist/ClipDeck-Setup-0.4.0.exe
```

## Tech

- Electron
- electron-builder + NSIS
- electron-updater
- Electron safeStorage for local Vault encryption
- Vanilla HTML, CSS and JavaScript
- Node.js built-in `crypto` for password generation
- Node.js built-in test runner
- No frontend framework

## Roadmap ideas

- Image clipboard history
- Exclusion rules for password managers and selected applications
- Import/export
- Optional master-password layer for the Vault
- Windows code signing
- Direct paste into the previously focused application

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Please read [SECURITY.md](SECURITY.md) before reporting a sensitive issue.

## License

MIT © Yavuz Cingöz
