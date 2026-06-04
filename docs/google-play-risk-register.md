# Google Play Risk Register

This file records Google Play review risks for the GitHub Pages Petdex gallery.
The Android app has its own separate risk register. Update this file after
changes that affect external content display, install links, Petdex data,
reporting, licensing, privacy wording, or takedown handling.

Policy references:

- User Generated Content: https://support.google.com/googleplay/android-developer/answer/9876937
- Data safety: https://support.google.com/googleplay/android-developer/answer/10787469

## Risk Register

### External Petdex content display

- Risk: The Pages gallery displays public Petdex pets and allows users to choose
  content outside the Android APK.
- Why it matters: Google Play review may treat this gallery as part of the app
  experience because it can hand selected content into the app.
- Current mitigation: The gallery is a static browsing and selection surface;
  Android app storage writes are not performed by the browser.
- Required before release: Keep app review notes and privacy/content policy text
  aligned with this external gallery.
- Owner: Gallery owner.
- Status: Open.
- Last reviewed: 2026-06-05.

### UGC, fan work, and rights complaints

- Risk: Petdex entries may be user-submitted, fan-made, or third-party inspired
  works.
- Why it matters: UGC and rights complaints need clear report, moderation, and
  takedown handling before Play release.
- Current mitigation: The gallery consumes a Petdex snapshot and links users to
  app-owned install handling.
- Required before release: Add a visible report link or issue/contact route, a
  content policy/terms link, and a documented takedown/review workflow.
- Owner: Content policy owner.
- Status: Open.
- Last reviewed: 2026-06-05.

### Install deep link handoff

- Risk: `Install / Open in app` links open the Android app with Petdex ZIP
  metadata.
- Why it matters: The gallery can initiate an app-side download/install flow,
  so link shape and destination must remain intentional and reviewable.
- Current mitigation: The browser does not write app storage directly. The app
  is responsible for ZIP download, validation, device-local save, and selection.
- Required before release: Keep install links limited to the documented app
  scheme/App Link behavior and keep Android-side URL validation in place.
- Owner: Android owner and gallery owner.
- Status: Controlled.
- Last reviewed: 2026-06-05.

### Static JSON snapshot

- Risk: The gallery stores and displays a full static `pets.json` snapshot
  generated from Petdex API data once per day.
- Why it matters: Removed or reported content may remain searchable until the
  next nightly snapshot/deploy if takedown handling is not defined.
- Current mitigation: GitHub Actions regenerates the full snapshot daily at JST
  02:17. The UI searches the full snapshot locally while rendering cards in
  batches.
- Required before release: Define emergency content removal steps and ensure
  reported content can be removed or filtered before the next nightly deploy.
- Owner: Gallery owner.
- Status: Open.
- Last reviewed: 2026-06-05.

### Petdex API and asset data

- Risk: The gallery republishes Petdex metadata, spritesheet URLs, ZIP URLs,
  metrics, colors, visual style classifications, and submitter display names in
  public static files.
- Why it matters: Privacy and Data safety explanations must match the public
  content and app handoff flow.
- Current mitigation: The gallery reads public Petdex data only and does not
  collect user data.
- Required before release: Keep privacy policy wording clear that app-side
  personal data is not sent to this gallery.
- Owner: Gallery owner.
- Status: Open.
- Last reviewed: 2026-06-05.

### Pixel art classification

- Risk: The gallery classifies each Petdex spritesheet as `pixel_art` or
  `other` and exposes that classification as a search filter.
- Why it matters: The classification is generated automatically and may be
  wrong for some works, so it should not be presented as a rights, quality, or
  safety decision.
- Current mitigation: The classifier records a confidence score and caches the
  result by slug and spritesheet URL so each unchanged pet is classified once.
  The implementation uses an original lightweight heuristic after reviewing
  public GitHub projects; no third-party classifier code is copied.
- Required before release: Keep the filter label neutral and update the cache
  only through the documented generation script.
- Owner: Gallery owner.
- Status: Controlled.
- Last reviewed: 2026-06-05.

### MIT copied/adapted Petdex UI code

- Risk: The gallery copies and adapts MIT-licensed Petdex UI concepts and code.
- Why it matters: License notices must remain present when copied/adapted code
  is distributed.
- Current mitigation: `THIRD_PARTY_NOTICES.md` includes Petdex attribution and
  MIT license text.
- Required before release: Keep notices updated if additional upstream files are
  copied or adapted.
- Owner: Gallery owner.
- Status: Controlled.
- Last reviewed: 2026-06-05.

## Agent Update Rule

After implementing any feature or policy-affecting change, update this file if
the change affects Google Play review risk. If no update is needed, explicitly
state `Google Play risk register: no update needed` in the final work summary.
