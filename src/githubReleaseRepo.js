const fs = require("fs");
const path = require("path");

/**
 * @param {string | undefined | null} raw
 * @returns {{ owner: string, repo: string } | null}
 */
function parseGithubReleaseRepoInput(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/github\.com[/:]([^/]+)\/([^/#\s?]+)/i);
  if (m) {
    return { owner: m[1], repo: m[2].replace(/\.git$/i, "") };
  }
  const parts = s.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return { owner: parts[0], repo: parts[1].replace(/\.git$/i, "") };
  }
  return null;
}

/**
 * @param {unknown} pkg
 * @returns {string | null}
 */
function getRepositoryUrlFromPackageJson(pkg) {
  if (!pkg || typeof pkg !== "object") return null;
  const r = /** @type {{ repository?: string | { url?: string } }} */ (pkg).repository;
  if (typeof r === "string" && r.trim()) return r.trim();
  if (r && typeof r === "object" && typeof r.url === "string" && r.url.trim()) return r.url.trim();
  return null;
}

/**
 * @param {string} packageJsonPath
 * @returns {{ owner: string, repo: string } | null}
 */
function parseGithubReleaseRepoFromPackageJsonPath(packageJsonPath) {
  try {
    const txt = fs.readFileSync(packageJsonPath, "utf8");
    const pkg = JSON.parse(txt);
    const url = getRepositoryUrlFromPackageJson(pkg);
    if (!url) return null;
    return parseGithubReleaseRepoInput(url);
  } catch {
    return null;
  }
}

/**
 * @param {string} appRootDir directory that contains package.json (e.g. app.getAppPath())
 * @returns {{ owner: string, repo: string } | null}
 */
function parseGithubReleaseRepoFromAppRoot(appRootDir) {
  return parseGithubReleaseRepoFromPackageJsonPath(path.join(appRootDir, "package.json"));
}

module.exports = {
  parseGithubReleaseRepoInput,
  getRepositoryUrlFromPackageJson,
  parseGithubReleaseRepoFromPackageJsonPath,
  parseGithubReleaseRepoFromAppRoot,
};
