# ClipDeck

A small, fast, privacy-first clipboard history manager for Windows, macOS and Linux.

ClipDeck watches copied **text**, keeps a local history on your device, and lets you search, favorite, delete and re-copy previous clips. Clipboard contents are never uploaded anywhere.

## Features

- Automatic clipboard text history
- Quick Paste panel with `Ctrl/Cmd + Shift + V`
- Settings screen with a recordable global Quick Paste shortcut
- Automatic Windows update checks and background downloads from GitHub Releases
- Keyboard-first quick search with arrow keys, Enter and Escape
- History timeline grouped into Today / Yesterday / This Week / Older
- Automatic local tags: URL, Email, JSON, SQL, Command, Code, Phone, Color, IP, Path and Text
- Filter history by automatic tag
- Instant local search across text and tags
- Favorite important clips
- One-click copy
- Delete individual clips
- Clear history while preserving favorites
- Pause/resume monitoring
- Configurable history size: 25 / 50 / 100 / 250
- Close-to-tray behavior: pressing `X` hides the window but keeps clipboard monitoring active
- System tray menu to open the main window, show Quick Paste, pause monitoring or quit completely
- Automatic Windows login startup for packaged builds, launched silently in the background
- Single-instance protection so launching ClipDeck again reuses the running background process
- Dark and light mode based on your system
- Local JSON persistence only
- No account, analytics, telemetry or cloud sync

## Quick Paste

Press `Ctrl + Shift + V` on Windows/Linux or `Cmd + Shift + V` on macOS from anywhere to open the compact Quick Paste panel.

- Start typing to search clipboard text or automatic tags.
- Use `↑` / `↓` to move through results.
- Press `Enter` to copy the selected result back to the clipboard and close the panel.
- Press `Esc` to close without changing the clipboard.

The main ClipDeck window remains available from the system tray.

## Automatic tags

Tag detection runs entirely on-device with deterministic rules. Clipboard content is not sent to an AI service or any network API.

Currently detected types:

`URL` · `Email` · `JSON` · `SQL` · `Command` · `Code` · `Phone` · `Color` · `IP` · `Path` · `Text`

Existing history entries are classified automatically when ClipDeck loads them.

## History timeline

The main history view groups clips into:

- Today
- Yesterday
- This Week
- Older

Search, favorites and tag filters work across the timeline.

## Install on Windows

For normal use, you do **not** need Node.js, npm or a CMD window.

1. Open the repository's **Releases** page.
2. Download `ClipDeck-Setup-0.3.0.exe` (or the newest version).
3. Run the installer and complete setup.
4. Launch ClipDeck normally from the Start menu or desktop shortcut.

Once installed, ClipDeck runs like a normal Windows application. Closing the window with `X` keeps it running in the notification area, and Windows login startup launches it silently in the background.

The installer is built automatically on a Windows GitHub Actions runner using the NSIS target.

> The current open-source build is not code-signed, so Windows may show a SmartScreen / unknown publisher warning. Code signing can be added later for trusted public distribution.

## Automatic updates

Installed Windows builds use `electron-updater` with GitHub Releases. ClipDeck checks shortly after startup and then periodically while it remains running. When a newer version exists, the installer downloads in the background.

Open **Settings** to see the update status, manually check for updates, or choose **Restart and update** after a download completes. A downloaded update is also installed on a normal app exit.

Every Windows release publishes the installer together with `latest.yml` and the NSIS blockmap required by the updater.

The project is currently unsigned. To keep auto-update functional until Windows code signing is added, update code-signature verification is disabled in the Windows build configuration. Production/public distribution should add a signing certificate and re-enable signature verification.

## Settings

Open the gear button in the main ClipDeck window. The quick-panel global shortcut can be changed by clicking the shortcut field and pressing a new key combination. ClipDeck only saves the new shortcut after Electron successfully registers it; if the shortcut is unavailable, the previous working shortcut remains active.

## Background behavior

Pressing the window's `X` button does **not** quit ClipDeck. The window is hidden and ClipDeck continues monitoring the clipboard in the background.

On Windows, packaged builds automatically register ClipDeck to start when you sign in. Login startup uses a hidden launch mode, so no application window is shown; ClipDeck starts directly in the notification area and begins monitoring the clipboard.

Use the ClipDeck icon in the system tray / notification area to:

- Open the main ClipDeck window
- Open Quick Paste
- Pause or resume clipboard monitoring
- Quit ClipDeck completely

If ClipDeck is already running in the background and you launch it again from the Start menu or executable, the existing main window is brought forward instead of starting a second clipboard monitor.

## Privacy

ClipDeck is intentionally local-first. Clipboard text is stored only in the Electron user-data directory on your computer and is never sent to the update service. The renderer Content Security Policy disables network connections. Packaged Windows builds make update-check requests to the project's GitHub Releases channel so they can discover and download new versions.

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
dist/ClipDeck-Setup-0.3.0.exe
```

Windows auto-start registration is intentionally enabled only for packaged builds. Running `npm start` during development will not add Electron itself to Windows startup.

## Releases

`.github/workflows/windows-release.yml` builds the x64 Windows installer on every push to `main` and can also be run manually. It creates or updates the GitHub Release matching the version in `package.json` and uploads the installer plus `latest.yml` and the NSIS blockmap used for automatic updates.

## Tech

- Electron
- electron-builder + NSIS
- Vanilla HTML, CSS and JavaScript
- Node.js built-in test runner
- No frontend framework
- `electron-updater` for packaged Windows update delivery

## Roadmap ideas

- Image clipboard history
- Optional encrypted storage
- Exclusion rules for selected applications
- Import/export
- Windows code signing

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Please read [SECURITY.md](SECURITY.md) before reporting a sensitive issue.

## License

MIT © Yavuz Cingöz
