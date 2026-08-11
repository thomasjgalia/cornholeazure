# Cornhole App Icon Set

## What's in here
- `icon-1024-master.png` — master image, keep for future re-exports (app store listing, etc.)
- `apple-touch-icon.png` (180×180) — the one iOS actually uses for "Add to Home Screen"
- `apple-touch-icon-152x152.png`, `apple-touch-icon-167x167.png`, `apple-touch-icon-120x120.png` — legacy iPad/iPhone sizes, optional but nice to include
- `favicon.ico` — multi-size (16/32/48) classic favicon for browser tabs
- `favicon-16x16.png`, `favicon-32x32.png` — standalone PNG favicons
- `icon-192.png`, `icon-512.png` — standard PWA manifest icons (Android + general web app installs)
- `manifest.json` — sample web app manifest, edit the name/colors/URLs to match your app

## Why these specific sizes
iOS ignores `manifest.json` icons and the regular `<link rel="icon">` favicon when you "Add to Home Screen." It only looks for `apple-touch-icon`. If that's missing, iOS will take a screenshot of your page instead — that's the #1 cause of "my icon doesn't show up right" on iPhone. So the apple-touch-icon tag below is the one that actually matters for your use case.

## HTML to add to your `<head>`
```html
<!-- iOS home screen icon (this is the one that matters for "Add to Home Screen") -->
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon-152x152.png">
<link rel="apple-touch-icon" sizes="167x167" href="/apple-touch-icon-167x167.png">
<link rel="apple-touch-icon" sizes="120x120" href="/apple-touch-icon-120x120.png">

<!-- Makes iOS treat it as a standalone app (hides Safari UI, own task-switcher card) -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Cornhole">

<!-- Regular browser favicon -->
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="shortcut icon" href="/favicon.ico">

<!-- PWA manifest (Android / desktop installs) -->
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#1F6B3A">
```

## Deployment notes
- Put all these PNG/ICO files at the **root** of your site (e.g. `/apple-touch-icon.png`), or update the `href` paths above to match wherever you host them.
- Don't add your own rounded corners — iOS automatically masks the icon into its rounded-square shape. The square, edge-to-edge artwork here is intentional so nothing gets cut off oddly.
- Apple touch icons should NOT be transparent — this set is fully opaque, which is correct (transparent areas render black on iOS otherwise).
- After deploying, test on an actual iPhone: Safari → Share → Add to Home Screen. If you had an old version of the site cached, you may need to fully close Safari or clear the site data first, since iOS caches the touch icon aggressively.
