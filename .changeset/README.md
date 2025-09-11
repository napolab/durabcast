# Changesets

This project uses [Changesets](https://github.com/changesets/changesets) to manage versioning and package publishing.

## How to Use

### Adding a Changeset

When you make a change that should be included in the next release, add a changeset:

```bash
pnpm changeset
```

This will prompt you to:
1. Select the type of change (patch, minor, major)
2. Write a summary of your change

The changeset will be saved as a markdown file in `.changeset/` directory.

### Release Process

1. **Create Changesets**: Add changesets for all changes that should be released
2. **Version**: Run the version command to consume changesets and update package versions
   ```bash
   pnpm changeset version
   ```
3. **Publish**: Publish the new version to npm
   ```bash
   pnpm release
   ```

### Changeset Types

- **patch**: Bug fixes and small changes
- **minor**: New features that don't break existing functionality
- **major**: Breaking changes

### Current Configuration

- **Access**: Public (packages are published as public)
- **Base Branch**: `main`
- **Commit**: Automatically commits version changes
- **Changelog**: Generated automatically from changesets

### Recent Releases

- v0.2.2 (2024-10-31)
- v0.2.1 (2024-10-15)
- v0.2.0 (2024-09-17)

For more information, see the [Changesets documentation](https://github.com/changesets/changesets).