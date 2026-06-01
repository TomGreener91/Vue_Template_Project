# Unified Release Process

This project uses a highly automated, sequential release pipeline powered by `semantic-release` and GitHub Actions. This ensures a consistent, secure, and fully hands-off workflow for versioning, publishing, and documenting every package.

## How It Works

The release process relies on a tightly coupled architecture using `workflow_call` rather than disconnected, tag-based triggers.

### 1. The Versioning Engine (`release.yml`)

The primary orchestrator is `.github/workflows/release.yml`.

- **Trigger:** Pushing commits or merging pull requests into `master`, `main`, `dev`, or `development`.
- **Process:**
  1. The workflow spins up and runs `semantic-release`.
  2. `semantic-release` parses your commit history looking for [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat:`, `fix:`, `BREAKING CHANGE:`).
  3. It calculates the correct next semantic version.
  4. It bumps the `version` field in your `package.json`, generates a new `CHANGELOG.md` entry, creates a Git tag, and publishes a GitHub Release.
  5. Finally, if a new release was created, it strictly passes the new version number to the deployment workflow.

### 2. The Deployment Execution

Once `semantic-release` finishes, `release.yml` triggers the secondary publish workflow natively configured for your project type (e.g., `publish_package.yml` for NPM plugins, or `release-electron.yml` for Electron apps).

#### NPM Packages (`publish_package.yml`)
- Runs a build of the workspace (`npm run build`).
- **Dry Run:** On a Pull Request, it runs `npm publish --dry-run` to validate package integrity safely.
- **Production Publish:** On a successful push to your main branches, it runs `npm publish --access public` using the `NPM_TOKEN` to push the package to the NPM registry.

#### Application Deployments (`deploy-webapp.yml`, `release-electron.yml`, etc.)
- Depending on the architecture scaffolded by the setup script, the pipeline will build and upload your compiled application (e.g., to Firebase, Azure, or as a GitHub Release binary artifact).

### 3. The Documentation Stage (VitePress)

If you elected to deploy documentation to GitHub Pages when scaffolding your plugin:
- A `DEPLOY_DOCS` flag is permanently embedded in your `publish_package.yml`.
- Immediately after your NPM publish succeeds, a composite action (`deploy-github-pages`) natively triggers within the same runner.
- It builds your VitePress site (`npm run docs:build`) and securely pushes the artifacts to GitHub Pages without requiring separate orchestration.

---

## Your Role

Because this system is completely automated and sequential, your only responsibility as a developer is to **write meaningful commit messages** following the [Conventional Commits specification](https://www.conventionalcommits.org/en/v1.0.0/). 

The automation will handle the versioning, changelogs, publishing, and documentation hosting entirely on its own!
