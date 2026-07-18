const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DEST = path.join(ROOT, "functions", "site");

const COPY_DIRS = ["server", "admin", "css", "js", "uploads"];
const COPY_FILES = [
  "index.html",
  "products.html",
  "product.html",
  "cart.html",
  "checkout.html",
  "contact.html",
  "package.json"
];

function rmDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (name === "node_modules") continue;
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

rmDir(DEST);
fs.mkdirSync(DEST, { recursive: true });

for (const dir of COPY_DIRS) {
  copyRecursive(path.join(ROOT, dir), path.join(DEST, dir));
}
for (const file of COPY_FILES) {
  const src = path.join(ROOT, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DEST, file));
  }
}

// Ensure uploads folder exists in the bundle
fs.mkdirSync(path.join(DEST, "uploads"), { recursive: true });

// Copy .env so Cloud Function has SMTP settings (do not commit .env)
const envSrc = path.join(ROOT, ".env");
if (fs.existsSync(envSrc)) {
  fs.copyFileSync(envSrc, path.join(DEST, ".env"));
  console.log("Copied .env into functions/site");
}

console.log("Prepared functions/site for Firebase deploy.");
