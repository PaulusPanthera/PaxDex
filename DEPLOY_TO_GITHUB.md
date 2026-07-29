# Deploy PaxDex with GitHub Pages

## 1. Upload the project

Create a repository and place the **contents of the `PaxDex` folder** in the repository root. The root should contain `index.html`, `data`, `js`, `css`, `sprites` and `.github`.

Do not commit `input/dump.zip` to a public repository. The included `.gitignore` excludes it.

## 2. Enable Pages

Open:

`Repository Settings → Pages → Build and deployment → Source → GitHub Actions`

## 3. Push to `main`

The included workflow:

1. validates all generated data and sprites;
2. checks JavaScript syntax;
3. packages only production website files;
4. deploys the static site to GitHub Pages.

Pull requests run validation without deploying.

## Updating the Pokédex

1. Put the newest dump at `input/dump.zip` locally.
2. Run `UPDATE_FROM_DUMP.bat`.
3. Run `VALIDATE_DATA.bat`.
4. Commit the regenerated `data` and `sprites` folders.
5. Push to GitHub.
