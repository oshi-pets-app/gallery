# Petdex Gallery GitHub Pages

This folder contains a static GitHub Pages gallery for Pet Overlay Compose.

The page does not write to Android app storage. It lets the user browse a
zero-server Petdex snapshot and opens the app through:

```text
petoverlay://petdex/install?slug=<slug>&zipUrl=<encoded-petdex-zip-url>
```

The Android app validates the ZIP URL against the existing Petdex asset allowlist
and then uses the same download, import, no-backup storage, and active-pet
selection path as the native Search > Petdex gallery.

## Updating the Snapshot

GitHub Actions runs `scripts/build-pets-json.mjs` on a schedule and deploys the
contents of `public/` to GitHub Pages. To generate the snapshot locally:

```powershell
node scripts/build-pets-json.mjs
```

The checked-in `public/pets.json` is only a placeholder so the page has a stable
file path before the first Pages deployment.

