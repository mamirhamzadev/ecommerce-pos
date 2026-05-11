const path = require("path");
const {
  parseGithubReleaseRepoInput,
  parseGithubReleaseRepoFromPackageJsonPath,
} = require("./src/githubReleaseRepo");
require("dotenv").config({ path: path.join(__dirname, ".env") });

function parseGithubRepo() {
  const fromEnv = parseGithubReleaseRepoInput(process.env.GITHUB_RELEASE_REPO?.trim());
  if (fromEnv) return fromEnv;
  return parseGithubReleaseRepoFromPackageJsonPath(path.join(__dirname, "package.json"));
}

const gh = parseGithubRepo();

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: "com.posmushtaq.app",
  productName: process.env.APP_NAME?.trim() || "POS Mushtaq",
  directories: {
    output: "release",
    buildResources: "build",
  },
  files: ["dist/**/*", "main.js", "preload.js", "src/**/*", "package.json"],
  asarUnpack: ["**/*.node"],
  win: {
    target: [{ target: "nsis", arch: ["x64"] }],
    /** Avoid winCodeSign extraction (symlinks) on machines without Developer Mode / admin symlink rights */
    signAndEditExecutable: false,
    verifyUpdateCodeSignature: false,
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    artifactName: "${productName}-Setup-${version}.${ext}",
  },
  mac: {
    target: [{ target: "dmg", arch: ["x64", "arm64"] }],
    category: "public.app-category.business",
  },
  linux: {
    target: ["AppImage"],
    category: "Office",
  },
  publish: gh ? [{ provider: "github", owner: gh.owner, repo: gh.repo }] : undefined,
};
