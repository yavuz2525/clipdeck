# Changelog

## 0.6.1

- Removed the obsolete Quick Panel brand stylesheet and merged active logo rules into the main Quick Panel stylesheet.
- Removed unused internal module exports from media settings, password generation, Vault, and snippet suggestions.
- Removed an unused cached snippet identifier from the suggestion controller.
- Reused the ImageStore public-item mapper instead of duplicating field stripping logic.
- Updated the package description to match ClipDeck's current Windows-first focus.

## 0.6.0

- Added local image and screenshot clipboard history.
- Added pinned image history with local PNG storage.
- Added offline English + Turkish OCR for saved clipboard images.
- Added QR Center for generating QR images and scanning clipboard/saved images.
- Added Windows snippet trigger suggestion popup while typing.
- Added Settings toggles for image history and snippet suggestions.
- Added tests for image persistence, QR round trips and suggestion token handling.

## 0.5.2

- Added the current ClipDeck branding and text-based brand asset generation workflow.
- Made the snippet expansion shortcut configurable from Settings.
- Improved the GitHub README and release presentation.

## 0.5.1

- Added inline snippet trigger expansion on Windows.
- Integrated the ClipDeck app logo into the Windows build.

## 0.4.0

- Added pinned clips.
- Added snippets and templates.
- Added local password generator and OS-encrypted Vault.
- Added System, Dark and Light themes.

## 0.3.0

- Added automatic Windows updates through GitHub Releases.
- Added configurable Quick Paste global shortcut.

## 0.2.0

- Added Quick Paste panel, history timeline and automatic local tags.

## 0.1.0

- Initial ClipDeck clipboard history release.
