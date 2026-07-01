const fs = require("fs");
const path = require("path");

/**
 * Load `.env` from the first path that exists (later files do not override earlier keys).
 * @param {import("electron").App | undefined} app
 */
function loadEnvFiles(app) {
  /** @type {string[]} */
  const candidates = [path.join(__dirname, "..", ".env")];

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, ".env"));
  }

  try {
    candidates.push(path.join(path.dirname(process.execPath), ".env"));
  } catch {
    /* ignore */
  }

  if (app && typeof app.getPath === "function") {
    try {
      candidates.push(path.join(app.getPath("userData"), ".env"));
    } catch {
      /* ignore */
    }
  }

  for (const envPath of candidates) {
    try {
      if (fs.existsSync(envPath)) {
        require("dotenv").config({ path: envPath });
      }
    } catch {
      /* ignore unreadable env */
    }
  }
}

module.exports = { loadEnvFiles };
