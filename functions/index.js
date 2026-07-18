const path = require("path");
const fs = require("fs");

// Load site .env if present (copied during prepare)
const siteEnv = path.join(__dirname, "site", ".env");
if (fs.existsSync(siteEnv)) {
  require("dotenv").config({ path: siteEnv });
} else {
  require("dotenv").config();
}

process.env.GLOMAX_CLOUD = "1";

const { onRequest } = require("firebase-functions/v2/https");

let cached = null;
let readyPromise = null;

async function getApp() {
  if (!cached) {
    cached = require(path.join(__dirname, "site", "server", "index.js"));
  }
  if (!readyPromise) {
    readyPromise = cached.ensureReady();
  }
  await readyPromise;
  return cached.app;
}

exports.app = onRequest(
  {
    region: "asia-northeast3",
    memory: "1GiB",
    timeoutSeconds: 120,
    maxInstances: 10
  },
  async (req, res) => {
    const app = await getApp();
    return app(req, res);
  }
);
