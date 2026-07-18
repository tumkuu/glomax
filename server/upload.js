const path = require("path");
const fs = require("fs");

let admin = null;
let bucket = null;

function isCloud() {
  return (
    process.env.GLOMAX_CLOUD === "1" ||
    Boolean(process.env.FUNCTION_TARGET) ||
    Boolean(process.env.K_SERVICE)
  );
}

function getBucket() {
  if (bucket) return bucket;
  if (!admin) {
    admin = require("firebase-admin");
    if (!admin.apps.length) {
      admin.initializeApp();
    }
  }
  bucket = admin.storage().bucket();
  return bucket;
}

/**
 * Save uploaded multer files. Returns public URL paths/strings.
 * Local: /uploads/filename
 * Cloud: Firebase Storage download URL
 */
async function saveUploadedFiles(files = []) {
  if (!files || !files.length) return [];

  if (!isCloud()) {
    return files.map((f) => `/uploads/${f.filename}`);
  }

  const b = getBucket();
  const urls = [];

  for (const file of files) {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const name = `uploads/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const gcsFile = b.file(name);
    const buffer = file.buffer;
    if (!buffer) {
      throw new Error("Cloud upload requires memory storage (file.buffer missing).");
    }
    await gcsFile.save(buffer, {
      metadata: {
        contentType: file.mimetype || "image/jpeg",
        cacheControl: "public, max-age=31536000"
      },
      public: true,
      resumable: false
    });
    urls.push(
      `https://storage.googleapis.com/${b.name}/${encodeURI(name)}`
    );
  }

  return urls;
}

async function saveUploadedFile(file) {
  if (!file) return "";
  const [url] = await saveUploadedFiles([file]);
  return url || "";
}

function unlinkLocalUpload(imagePath) {
  if (!imagePath || !imagePath.startsWith("/uploads/")) return;
  const filePath = path.join(__dirname, "..", imagePath.replace(/^\//, ""));
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  }
}

module.exports = {
  isCloud,
  saveUploadedFiles,
  saveUploadedFile,
  unlinkLocalUpload
};
