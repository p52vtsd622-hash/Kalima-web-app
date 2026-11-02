# Kalima web — Android 0.9 parity release

This package rebuilds the web presentation around the approved Android 0.9 source, including its slimmer controls and breathing room. It has not been published to GitHub.

## Upload from your phone or iPad

1. Export a saved-words backup from your current web app.
2. Extract `kalima-webapp.zip` in Files.
3. Open your existing Kalima-web-app repository on GitHub. Upload **all files directly inside the extracted folder** to the repository root, replacing existing files. Upload the contents, rather than the ZIP or an extra enclosing folder. All fonts are now individual files beside `index.html`: there is no fonts folder to create. The `tests` and `docs` folders are optional development references and do not need uploading.
4. Commit the upload and wait for GitHub Pages to deploy. The Android APK build workflow does not need changing for this web release.
5. Reopen https://p52vtsd622-hash.github.io/Kalima-web-app/ and accept Update when offered. On the first migration, close all Kalima browser tabs and Home Screen windows and reopen if the previous version remains visible.

Keep the same website address. Do not clear website data or delete the Home Screen app to update. Existing saved words, history, language preferences and review progress retain their original storage keys. There is no account or automatic Android/web sync; JSON export/import transfers saved words and review progress.

## On iPhone

Open the site in Safari, then Share → Add to Home Screen. Enable Open as Web App if offered. Launch that icon for the full app window. Allow the first online visit to finish before testing offline reopening. New AI requests require internet; saved results, practice, fonts and bundled Quran/Nahj texts are cached.

## What now follows Android 0.9

- Original navigation, history and search vectors, font files, light/dark colors and slimmer control measurements.
- The four familiar pills and sliding language, search-direction and Fast/Deep menus.
- The same result hierarchy: Meaning, combined Grammar/Wazn, tiled root card, expandable explanations and conjugations. Scrolling replaces the existing header title with the word rather than adding another bar.
- Saved cards, centered word previews, flashcard flip/swipe, quizzes and inline Settings groups.
- Seven app languages, RTL layout, independent extra translations, reversible suggestions, scoped loading/retry and the Android lookup instructions.

Update/Later reloads a prepared web release and retains local data. It does not install an Android APK. Keep occasional backups because device/browser storage can be removed.

## Device differences

This is a web implementation of the Android interface, not the APK running on iOS. Safari still controls the keyboard, text selection, speech voices, file sharing and browser chrome. iPhone Safari does not expose Android-style vibration or system-wide selected-text lookup. Font rasterization and gesture timing may vary across devices. See VALIDATION.md for tested behavior and the remaining physical-device checks.
