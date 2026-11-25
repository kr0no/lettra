# Development

Notes for building and releasing Lettra. For using the app, see the [README](../README.md).

## Setup

You need macOS, Node 24+ and pnpm 10 (`corepack enable`).

```bash
pnpm install
```

```bash
pnpm dev
```

Electron downloads its binary the first time it runs. If that fails, run `pnpm exec install-electron`.

| Command         |                                                    |
| --------------- | -------------------------------------------------- |
| `pnpm dev`      | Run with hot reload                                |
| `pnpm test`     | Run the tests (Vitest)                             |
| `pnpm check`    | Typecheck, lint and test                           |
| `pnpm format`   | Prettier                                           |
| `pnpm build`    | Build main, preload and renderer into `out/`       |
| `pnpm dist`     | Build the universal DMG and zip into `dist/`       |
| `pnpm snapshot` | Refresh the bundled Google catalog in `resources/` |
| `pnpm icon`     | Regenerate `build/icon.icns`                       |

## Commits and versions

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), and versions follow [Semantic Versioning](https://semver.org/). The commit types since the last release decide the next version:

| Commits since the last release            | Bump  | Example        |
| ----------------------------------------- | ----- | -------------- |
| Only `fix:`                               | patch | 1.0.0 -> 1.0.1 |
| At least one `feat:`                      | minor | 1.0.1 -> 1.1.0 |
| A `feat!:`, `fix!:` or `BREAKING CHANGE:` | major | 1.1.0 -> 2.0.0 |

`docs:`, `test:`, `refactor:`, `chore:`, `ci:` and `build:` don't need a release on their own.

For an app, "breaking" means something users notice: a minimum macOS version going up, data in `~/Library/Application Support/Lettra/` that older versions can't read, or a feature removed.

## Releasing

1. Bump the version. It updates `package.json`, commits and creates the tag (`v1.1.0` here):

   ```bash
   pnpm version minor -m "chore(release): v%s"
   ```

   Use `patch`, `minor` or `major` as the table above says. Without `-m` the commit message is just the number, which isn't a conventional commit.

2. Push the commit and the tag. The release workflow runs the checks, builds the universal DMG and zip, and attaches them to a draft release:

   ```bash
   git push --follow-tags
   ```

3. Edit the draft's notes on GitHub (group them by Features and Fixes) and publish it. Installed copies pick it up within a day.

Keep versions as plain `x.y.z`, without pre-release suffixes: the updater compares them, `releases/latest` skips pre-releases anyway, and the zip has to keep the `Lettra-<version>-universal.zip` name.

## Code layout

- `src/main`: font scanning (fontkit, in a worker thread), the `lettra-font://` protocol that serves font files to the window and splits `.ttc` collections into single faces, the folder watcher, and all downloads and file changes.
- `src/preload`: a typed `window.fontAPI` built from `src/shared/ipc-contract.ts`. Context isolation and the sandbox are on, Node is off.
- `src/renderer`: React 19, Tailwind 4, TanStack Query and Virtual, Zustand, i18next.

Google Fonts doesn't require an API key here. The catalog comes from `fonts.google.com/metadata/fonts`, static installs use the CSS2 API and variable installs pull files from the `google/fonts` repo. The API key in Settings is only a fallback in case the CSS2 approach stops working.

## Data files

Everything is in `~/Library/Application Support/Lettra/`:

| File                     | Contents                                                                 |
| ------------------------ | ------------------------------------------------------------------------ |
| `settings.json`          | App settings. The optional API key is encrypted with the macOS Keychain. |
| `library.json`           | Favorites and collections                                                |
| `installed-google.json`  | Google families Lettra installed (the only ones it will uninstall)       |
| `cache/local-fonts.json` | Parsed font metadata, keyed by path, modification time and size          |
| `cache/gf-catalog.json`  | The Google Fonts catalog                                                 |
| `window-state.json`      | Window size and position                                                 |

You can delete `cache/` at any time.

Logs go to `~/Library/Logs/Lettra/main.log`, rotated at 1 MB. Messages are always in English.

Running `pnpm dev` uses a separate `Lettra Dev` folder, so it never touches the data of an installed copy.
