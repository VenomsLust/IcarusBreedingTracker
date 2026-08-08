# Icarus Breeding Tracker — Portable

A browser-based version of the Icarus Breeding Tracker. No install, no Electron —
just a web page that runs in any modern browser (Chrome, Edge, Firefox).

## How data is saved

There's no autosave and no server. The app holds your data in memory while
you work, and you explicitly control persistence with three buttons in the
top bar:

- **Save** — downloads your current data as a `.json` file (defaults to
  `icarus-breeding-data.json`, or whatever file you last loaded/saved).
- **Load…** — pick a previously saved `.json` file to restore it.
- **New** — clear everything and start over.

If you have unsaved changes, an **● Unsaved changes** badge appears in the
top bar, and the browser will warn you before closing the tab or navigating
away.

## Local development

```bash
npm install
npm run dev
```

## Building

```bash
npm run build
```

This produces a single file: `dist/index.html`. Everything — JS, CSS, the
whole app — is bundled into that one file, so it's fully portable two ways:

1. **Hand someone the file.** They can double-click `dist/index.html` and it
   runs directly in their browser, no server needed.
2. **Host it anywhere that serves static files**, including GitHub Pages
   (see below).

## Deploying to GitHub Pages (free)

1. Create a new GitHub repo (public repos get free Pages hosting; a free
   account works fine).
2. Push this project's source to it as normal (the `dist/` folder is
   git-ignored — Pages will be built from a dedicated branch, not committed
   build output, so your source repo stays clean).
3. Easiest option — use the `gh-pages` package to publish `dist/` to a
   `gh-pages` branch:

   ```bash
   npm install --save-dev gh-pages
   npx gh-pages -d dist
   ```

4. In the repo's **Settings → Pages**, set the source to the `gh-pages`
   branch (root). GitHub will give you a URL like
   `https://<username>.github.io/<repo-name>/`.

Each person who opens that URL gets their own private, local copy of the
data in their browser — nothing is stored on GitHub. Re-run `npx gh-pages -d
dist` any time you rebuild and want to push an update to the hosted page.
