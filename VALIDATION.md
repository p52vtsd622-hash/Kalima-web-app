# Validation — 0.8-web.1

Validated on 18 October 2026.

- **25 Node tests passed**: old storage, legacy/Android backups, canonical translation separation, all seven UI catalogs, search normalization, 90-word reversible suggestion pool, storage transaction failure, Undo, import/review preservation, malformed-store recovery, root wrappers/retries/cancellation, prompt budgets and optional-key/shared API behavior.
- **18 WebKit browser checks passed** using deterministic model fixtures: Home/pills, suggestions, native sheets/Back, explicit search, malformed-root retry, 14×7 table/match, saved persistence/Undo, long-press preview, all app languages/RTL/extra filtering, Settings language selection, storage-failed practice grading, stable quiz choices, lens drag, flashcard swipe, enlarged text, offline reopening and worker Update/Later consent, plus desktop/Farsi layout.
- Phone viewport checks used 390×844 and 320×740; desktop used 1280×900. The enlarged-text check forces a 34px root (twice the normal 17px), checks a usable reading area and bounded dock, and uses dark/reduced-motion settings. Pills form an equal 2×2 grid where large text or narrow width needs it. Screenshots were reviewed internally.
- The offline check makes the app's origin unavailable, reopens the cached app, retains words and loads/searches both bundled corpora and local fonts. WebKit's context-wide offline switch caused a browser-internal navigation error, so an unavailable-origin simulation was used instead. This is not an iOS flight-mode test.
- The update test installs a changed worker, chooses Later and verifies it remains waiting, then explicitly accepts Update and verifies saved words survive activation.
- JavaScript syntax checks passed. Quran and Nahj data are copied unchanged from Android 0.8, including source/license text. Font licenses are included.

These are desktop-hosted WebKit checks, not physical iPhone certification. After publishing, check Add to Home Screen, opening from the installed icon, keyboard show/hide, Arabic speech with the device's installed voices, physical swipe feel, VoiceOver and flight-mode reopening. The AI service can produce different answers from the deterministic fixtures; its parsing/retry safeguards are tested, not the accuracy of every future answer.

The package has not been uploaded to GitHub or published. START-HERE.md explains the upload to the existing GitHub Pages address. Android source and APK packaging are unchanged.
