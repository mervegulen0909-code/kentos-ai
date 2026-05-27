/**
 * .pnpmfile.cjs — resolution hooks for security-patching transitive deps
 *
 * Forces patched versions of packages that have known high-severity
 * vulnerabilities in their older releases, regardless of what parent packages
 * request.  Keep in sync with the `overrides` block in pnpm-workspace.yaml.
 */

'use strict';

/** @type {Record<string, string>} */
const FORCED_VERSIONS = {
  glob: '^13.0.6',
  lodash: '^4.18.1',
  multer: '^2.1.1',
  picomatch: '^4.0.4',
  tmp: '>=0.2.6',
};

/**
 * @param {{ name: string; version: string; dependencies?: Record<string,string>; devDependencies?: Record<string,string> }} pkg
 */
function readPackage(pkg) {
  for (const [name, range] of Object.entries(FORCED_VERSIONS)) {
    if (pkg.dependencies?.[name] !== undefined) {
      pkg.dependencies[name] = range;
    }
    if (pkg.devDependencies?.[name] !== undefined) {
      pkg.devDependencies[name] = range;
    }
  }
  return pkg;
}

module.exports = {
  hooks: { readPackage },
};
