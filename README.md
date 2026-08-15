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
- Dark and light mode based on your system
- Local JSON persistence only
- No account, analytics, telemetry or cloud sync

## Background behavior

Pressing the window's `X` button does **not** quit ClipDeck. The window is hidden and ClipDeck continues monitoring the clipboard in the background.

Use the ClipDeck icon in the system tray / notification area to:

- Open ClipDeck again
- Pause or resume clipboard monitoring
- Quit ClipDeck completely

You can also reopen the window at any time with `Ctrl/Cmd + Shift + V`.

## Privacy

ClipDeck is intentionally local-first. Clipboard text is stored only in the Electron user-data directory on your computer. The app does not make network requests and its renderer Content Security Policy disables network connections.

Clipboard contents can contain sensitive information. Pause monitoring before copying passwords, tokens or other secrets that you do not want stored in history.

## Run locally

Requirements:

- Node.js 22.12+
- npm

```bash
git clone https://github.com/yavuz2525/clipdeck.git
cd clipdeck
npm install
npm start
```

## Validate

```bash
npm run check
npm test
```

## Package the app

```bash
npm run package
```

The packaged application is written to `dist/` for the operating system you run the command on.

> Note: production distribution should use code signing, especially on Windows and macOS, to avoid operating-system trust warnings.

## Tech

- Electron
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

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Please read [SECURITY.md](SECURITY.md) before reporting a sensitive issue.

## License

MIT © Yavuz Cingöz
