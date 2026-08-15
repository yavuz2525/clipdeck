# ClipDeck

A small, fast, privacy-first clipboard history manager for Windows, macOS and Linux.

ClipDeck watches copied **text**, keeps a local history on your device, and lets you search, favorite, delete and re-copy previous clips. Nothing is uploaded anywhere.

## Features

- Automatic clipboard text history
- Instant local search
- Favorite important clips
- One-click copy
- Delete individual clips
- Clear history while preserving favorites
- Pause/resume monitoring
- Configurable history size: 25 / 50 / 100 / 250
- Global show shortcut: `Ctrl/Cmd + Shift + V`
- Close-to-tray behavior: pressing `X` hides the window but keeps clipboard monitoring active
- System tray menu to reopen ClipDeck, pause monitoring or quit completely
- Automatic Windows login startup for packaged builds, launched silently in the background
- Single-instance protection so launching ClipDeck again reuses the running background process
- Dark and light mode based on your system
- Local JSON persistence only
- No account, analytics, telemetry or cloud sync

## Install on Windows

For normal use, you do **not** need Node.js, npm or a CMD window.

1. Open the repository's **Releases** page.
2. Download `ClipDeck-Setup-0.1.0.exe` (or the newest version).
3. Run the installer and complete setup.
4. Launch ClipDeck normally from the Start menu or desktop shortcut.

Once installed, ClipDeck runs like a normal Windows application. Closing the window with `X` keeps it running in the notification area, and Windows login startup launches it silently in the background.

The installer is built automatically on a Windows GitHub Actions runner using the NSIS target.

> The current open-source build is not code-signed, so Windows may show a SmartScreen / unknown publisher warning. Code signing can be added later for trusted public distribution.

## Background behavior

Pressing the window's `X` button does **not** quit ClipDeck. The window is hidden and ClipDeck continues monitoring the clipboard in the background.

On Windows, packaged builds automatically register ClipDeck to start when you sign in. Login startup uses a hidden launch mode, so no application window is shown; ClipDeck starts directly in the notification area and begins monitoring the clipboard.

Use the ClipDeck icon in the system tray / notification area to:

- Open ClipDeck again
- Pause or resume clipboard monitoring
- Quit ClipDeck completely

You can also reopen the window at any time with `Ctrl/Cmd + Shift + V`.

If ClipDeck is already running in the background and you launch it again from the Start menu or executable, the existing window is brought forward instead of starting a second clipboard monitor.

## Privacy

ClipDeck is intentionally local-first. Clipboard text is stored only in the Electron user-data directory on your computer. The app does not make network requests and its renderer Content Security Policy disables network connections.

Clipboard contents can contain sensitive information. Pause monitoring before copying passwords, tokens or other secrets that you do not want stored in history.

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

`npm start` is development mode. Closing the terminal that launched Electron can end that development session. Use the installed `.exe` build for everyday use.

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

The NSIS installer is written to:

```text
dist/ClipDeck-Setup-0.1.0.exe
```

Windows auto-start registration is intentionally enabled only for packaged builds. Running `npm start` during development will not add Electron itself to Windows startup.

## Releases

`.github/workflows/windows-release.yml` builds the x64 Windows installer on every push to `main` and can also be run manually. It creates or updates the GitHub Release matching the version in `package.json` and uploads the installer.

## Tech

- Electron
- electron-builder + NSIS
- Vanilla HTML, CSS and JavaScript
- Node.js built-in test runner
- No frontend framework
- No runtime third-party dependencies

## Roadmap ideas

- Image clipboard history
- Custom keyboard navigation
- Optional encrypted storage
- Exclusion rules for selected applications
- Import/export
- Windows code signing
- Automatic app updates

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Please read [SECURITY.md](SECURITY.md) before reporting a sensitive issue.

## License

MIT © Yavuz Cingöz
