# Publishing @varbyte-dev/signals-core to npm

## Pre-publish Checklist

### ✅ Completed
- [x] Package metadata configured (name, version, description, author)
- [x] Repository URLs configured
- [x] License file created (MIT)
- [x] README.md with complete documentation
- [x] API.md with detailed API reference
- [x] .npmignore configured to exclude dev files
- [x] .gitignore configured
- [x] Git repository initialized with initial commit
- [x] All 112 tests passing
- [x] Build successful (ESM + CJS)
- [x] Bundle size verified: **1.42 KB gzipped** (target: < 5KB) ✅
- [x] TypeScript declarations generated
- [x] `prepublishOnly` script configured (runs tests + build automatically)

### ⚠️ Before Publishing

1. **Update package.json if needed**
   - [ ] Change author from "VarByte" to your actual name/organization
   - [ ] Update repository URLs if different from `varbyte-dev/signals`
   - [ ] Verify npm scope `@varbyte` is correct or change to your scope

2. **Create GitHub repository** (recommended)
   ```bash
   # Create repo on GitHub first, then:
   git remote add origin https://github.com/varbyte-dev/signals.git
   git branch -M main
   git push -u origin main
   ```

3. **Verify npm account**
   ```bash
   npm whoami
   # If not logged in:
   npm login
   ```

4. **If using a scoped package (@varbyte/)**
   - Make sure your npm account has access to the `@varbyte` scope
   - Or publish as public: `npm publish --access public`

---

## Publishing Steps

### Option 1: Publish to npm Registry (Public)

```bash
# 1. Verify everything is ready
npm run typecheck
npm run test
npm run build

# 2. Check what files will be published
npm pack --dry-run

# 3. Publish (for scoped packages, add --access public)
npm publish --access public

# 4. Verify publication
npm view @varbyte-dev/signals-core
```

### Option 2: Test Locally First

```bash
# 1. Create a tarball
npm pack

# 2. This creates: varbyte-signals-core-1.0.0.tgz
# Install it in another project to test:
cd /path/to/test-project
npm install /path/to/signals/varbyte-signals-core-1.0.0.tgz

# 3. Test the import
# In test-project:
import { signal, computed, effect } from '@varbyte-dev/signals-core'

# 4. If everything works, publish for real
cd /path/to/signals
npm publish --access public
```

### Option 3: Publish to GitHub Packages (Alternative)

If you prefer GitHub Packages instead of npm:

```bash
# 1. Create .npmrc in project root:
echo "@varbyte:registry=https://npm.pkg.github.com" > .npmrc

# 2. Authenticate with GitHub
npm login --registry=https://npm.pkg.github.com

# 3. Publish
npm publish
```

---

## Post-publish Steps

1. **Create GitHub Release**
   - Tag: `v1.0.0`
   - Title: "signals-core v1.0.0 - Initial Release"
   - Description: Copy from README features section

2. **Verify Installation**
   ```bash
   npm install @varbyte-dev/signals-core
   ```

3. **Update Documentation**
   - Add installation badge to README
   - Add npm version badge
   - Add bundle size badge

4. **Share**
   - Tweet about the release
   - Share on Reddit (r/javascript, r/typescript)
   - Post on Dev.to or Medium

---

## Updating After Initial Publish

For future releases:

```bash
# 1. Make changes
# 2. Update version
npm version patch   # 1.0.0 -> 1.0.1 (bug fixes)
npm version minor   # 1.0.0 -> 1.1.0 (new features)
npm version major   # 1.0.0 -> 2.0.0 (breaking changes)

# 3. Push tag
git push --follow-tags

# 4. Publish
npm publish --access public
```

---

## Troubleshooting

**Error: You do not have permission to publish**
- Make sure you're logged in: `npm whoami`
- For scoped packages, use `--access public`
- Verify you own the npm scope

**Error: Package already exists**
- Package name might be taken
- Change name in package.json or use a scope

**Error: No repository field**
- Already configured, but verify package.json has `repository` field

**Error: prepublishOnly script failed**
- Tests or build failed
- Fix issues and try again

---

## Quick Commands Reference

```bash
# Check what will be published
npm pack --dry-run

# Publish as public scoped package
npm publish --access public

# Publish specific version
npm publish --tag beta

# Unpublish (within 72 hours only)
npm unpublish @varbyte-dev/signals-core@1.0.0 --force

# View published package info
npm view @varbyte-dev/signals-core
```

---

## Current Package Status

✅ **Ready for v1.0.0 release**

- Version: 1.0.0
- Bundle: 1.42 KB gzipped
- Tests: 112 passing
- Documentation: Complete
- License: MIT
- Zero dependencies

**Next step**: `npm publish --access public`
