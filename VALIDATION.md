# Validation — 0.9-web.1

Validated against the Android 0.9 source and desktop-hosted WebKit.

- **25 Node tests passed:** existing storage and Android/legacy backups, language separation, all seven UI catalogs, normalized search, reversible suggestions, transactional storage failures, Undo, review-safe imports, malformed-store recovery, root parsing/retry/cancellation, request budgets and optional/shared API transport.
- **20 WebKit checks passed:** native control geometry/colors/vectors, Home and suggestions, sheets/Back, explicit search, result hierarchy and single scrolled header, malformed-root retry, 14×7 conjugations, saved persistence/Undo, long-press preview, all languages/RTL/extra filtering, Settings language selection, failed practice writes, stable quiz choices, navigation dragging, flashcard swiping, enlarged text, offline reopening, Update/Later consent and desktop/Farsi layout.
- Phone viewports: 390×844 and 320×740. Desktop: 1280×900. Enlarged-text check doubles the 16px root to 32px, with dark mode and reduced motion. Screenshots were inspected internally.
- Offline check makes the origin unavailable and verifies cached reopening, saved words, both bundled corpora and a local font. This is an unavailable-origin simulation, not a physical iPhone flight-mode test.
- Update check installs a changed worker, chooses Later, confirms it remains waiting, then accepts Update and confirms saved words survive activation.
- Runtime syntax and service-worker asset paths checked. Corpus and font assets retain Android source bytes and included licensing.

These checks do not certify pixel-identical rendering on a physical iPhone. After uploading, compare the Home Screen app against Android: keyboard show/hide, safe areas, physical swipe/scroll feel, installed speech voices, VoiceOver and flight-mode reopening. AI tests use deterministic fixtures; live model wording can differ even when the request instructions match.

No Android files, GitHub repository or hosted deployment were changed by this package.
