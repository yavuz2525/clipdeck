# Security Policy

ClipDeck handles clipboard data, which may contain sensitive information.

## Reporting a vulnerability

Please do not publish exploit details in a public GitHub issue. Contact the maintainer privately through the email listed on the GitHub profile and include reproduction steps, affected versions and impact.

## Security principles

- No remote content is loaded in the renderer.
- Node integration is disabled in the renderer.
- Context isolation and sandboxing are enabled.
- Native clipboard access is exposed only through a narrow preload API.
- Clipboard history is stored locally.
