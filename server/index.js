const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const {
  UPLOADS_DIR,
  initDb,
  getAllProducts,
  getProductById,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  verifyAdmin,
  getStats,
  parseImages
} = require("./db");
const { sendOrderEmail, assertSmtpReady } = require("./mail");
const { seed } = require("./seed");
const {
  getSection,
  saveSection,
  getActivePromotionsForHome,
  getAdminPromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion,
  ensurePromotionsSeeded,
  unlinkImage,
  SECTION_ID
} = require("./promotions");

const uploadHelpers = require("./upload");
const { saveUploadedFiles, saveUploadedFile, isCloud } = uploadHelpers;

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "..");

// Render / Firebase / any reverse proxy
const isHttps =
  process.env.GLOMAX_CLOUD === "1" ||
  process.env.RENDER === "true" ||
  process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

const multerStorage = isCloud()
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
        const safe = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, safe);
      }
    });

const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Зөвхөн зураг файл оруулна уу (jpg, png, webp, gif)."));
    }
  }
});

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    name: "glomax.sid",
    secret: process.env.SESSION_SECRET || "glomax-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/admin", express.static(path.join(ROOT, "admin")));
app.use("/css", express.static(path.join(ROOT, "css")));
app.use("/js", express.static(path.join(ROOT, "js")));

const PAGES = [
  "index.html",
  "products.html",
  "product.html",
  "cart.html",
  "checkout.html",
  "contact.html"
];

PAGES.forEach((page) => {
  app.get("/" + page, (_req, res) => {
    res.sendFile(path.join(ROOT, page));
  });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  return res.status(401).json({ error: "Нэвтрэх шаардлагатай." });
}

function toUploadPaths(files = []) {
  // Local disk only — cloud uses saveUploadedFiles()
  return (files || []).map((f) => `/uploads/${f.filename}`);
}

function firestorePermissionError(res, err) {
  const msg = String(err.message || err);
  if (/permission|insufficient/i.test(msg)) {
    res.status(503).json({
      error:
        "Firestore permissions: Console дээр firestore.rules-ийг Publish хийнэ үү (promotions read/write)."
    });
    return true;
  }
  return false;
}

function handleError(res, err) {
  console.error(err);
  res.status(500).json({ error: err.message || "Алдаа гарлаа." });
}

/* ——— Public API ——— */
app.get("/api/products", async (_req, res) => {
  try {
    res.json(await getAllProducts());
  } catch (err) {
    handleError(res, err);
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: "Бараа олдсонгүй." });
    res.json(product);
  } catch (err) {
    handleError(res, err);
  }
});

app.get("/api/categories", async (_req, res) => {
  try {
    res.json(await getCategories());
  } catch (err) {
    handleError(res, err);
  }
});

app.get("/api/promotions", async (_req, res) => {
  try {
    res.json(await getActivePromotionsForHome());
  } catch (err) {
    handleError(res, err);
  }
});

/* ——— Order email (SMTP credentials stay on server) ——— */
app.post("/api/order-email", async (req, res) => {
  try {
    const body = req.body || {};
    const customerName = String(body.customerName || "").trim();
    const phone = String(body.phone || "").trim();
    const address = String(body.address || "").trim();
    const notes = String(body.notes || "").trim();
    const products = Array.isArray(body.products) ? body.products : [];

    if (!customerName || !phone || !address) {
      return res.status(400).json({ error: "Захиалагчийн мэдээлэл дутуу байна." });
    }
    if (!products.length) {
      return res.status(400).json({ error: "Захиалгын бараа хоосон байна." });
    }

    const result = await sendOrderEmail({
      orderId: body.orderId || null,
      customerName,
      phone,
      address,
      notes,
      products: products.map((p) => ({
        productId: String(p.productId || p.id || ""),
        name: String(p.name || ""),
        image: String(p.image || ""),
        quantity: Math.max(1, Number(p.quantity) || 1),
        price: Number(p.price) || 0,
        total:
          p.total != null
            ? Number(p.total)
            : (Number(p.price) || 0) * (Number(p.quantity) || 1)
      })),
      orderedAt: body.orderedAt || new Date().toISOString()
    });

    res.json({
      ok: true,
      message: "Захиалгын имэйл илгээгдлээ.",
      emailTo: result.to
    });
  } catch (err) {
    console.error("Order email failed:", err.message || err);
    let message = "Захиалгын имэйл илгээж чадсангүй. Дахин оролдоно уу.";
    if (err.code === "SMTP_CONFIG") {
      message =
        "Имэйл илгээх тохиргоо дутуу байна. .env дээр Gmail App Password оруулна уу.";
    } else if (
      /Invalid login|Username and Password not accepted|EAUTH/i.test(
        String(err.message || "")
      )
    ) {
      message =
        "Gmail нэвтрэлт амжилтгүй. SMTP_USER / App Password-оо шалгана уу.";
    }
    res.status(502).json({ error: message });
  }
});

/* ——— Auth ——— */
app.get("/api/auth/me", (req, res) => {
  if (req.session && req.session.admin) {
    return res.json({ authenticated: true, username: req.session.admin });
  }
  res.json({ authenticated: false });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Нэвтрэх нэр, нууц үг оруулна уу." });
    }
    if (!(await verifyAdmin(String(username).trim(), String(password)))) {
      return res.status(401).json({ error: "Нэвтрэх нэр эсвэл нууц үг буруу." });
    }
    req.session.admin = String(username).trim();
    res.json({ ok: true, username: req.session.admin });
  } catch (err) {
    handleError(res, err);
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("glomax.sid");
    res.json({ ok: true });
  });
});

/* ——— Admin API ——— */
app.get("/api/admin/stats", requireAuth, async (_req, res) => {
  try {
    res.json(await getStats());
  } catch (err) {
    handleError(res, err);
  }
});

app.get("/api/admin/products", requireAuth, async (_req, res) => {
  try {
    res.json(await getAllProducts());
  } catch (err) {
    handleError(res, err);
  }
});

app.post(
  "/api/admin/products",
  requireAuth,
  upload.array("images", 10),
  async (req, res) => {
    try {
      const { name, price, description, category, stock } = req.body;
      if (!name || price === undefined || price === "") {
        return res.status(400).json({ error: "Нэр болон үнэ заавал шаардлагатай." });
      }

      const images = await saveUploadedFiles(req.files);
      if (!images.length) {
        return res.status(400).json({ error: "Дор хаяж нэг зураг оруулна уу." });
      }

      const product = await createProduct({
        name: String(name).trim(),
        price: Number(price),
        description: String(description || "").trim(),
        category: String(category || "").trim(),
        stock: Number(stock) || 0,
        images
      });

      res.status(201).json(product);
    } catch (err) {
      res.status(400).json({ error: err.message || "Алдаа гарлаа." });
    }
  }
);

app.put(
  "/api/admin/products/:id",
  requireAuth,
  upload.array("images", 10),
  async (req, res) => {
    try {
      const existing = await getProductById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Бараа олдсонгүй." });
      }

      const { name, price, description, category, stock, keepImages, removeImages } =
        req.body;

      let images = [...existing.images];

      if (keepImages !== undefined) {
        const keep = parseImages(
          typeof keepImages === "string" ? keepImages : JSON.stringify(keepImages)
        );
        images = keep;
      }

      if (removeImages) {
        const removeList = parseImages(
          typeof removeImages === "string"
            ? removeImages
            : JSON.stringify(removeImages)
        );
        images = images.filter((img) => !removeList.includes(img));
        removeList.forEach((img) => {
          if (img.startsWith("/uploads/")) {
            const filePath = path.join(ROOT, img.replace(/^\//, ""));
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
              } catch {
                /* ignore */
              }
            }
          }
        });
      }

      const uploaded = await saveUploadedFiles(req.files);
      images = [...images, ...uploaded];

      if (!images.length) {
        return res.status(400).json({ error: "Бараанд дор хаяж нэг зураг хэрэгтэй." });
      }

      const product = await updateProduct(req.params.id, {
        name: name !== undefined ? String(name).trim() : undefined,
        price: price !== undefined && price !== "" ? Number(price) : undefined,
        description:
          description !== undefined ? String(description).trim() : undefined,
        category: category !== undefined ? String(category).trim() : undefined,
        stock: stock !== undefined && stock !== "" ? Number(stock) : undefined,
        images
      });

      res.json(product);
    } catch (err) {
      res.status(400).json({ error: err.message || "Алдаа гарлаа." });
    }
  }
);

app.delete("/api/admin/products/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await deleteProduct(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Бараа олдсонгүй." });
    res.json({ ok: true, deleted });
  } catch (err) {
    handleError(res, err);
  }
});

/* ——— Admin promotions (Firestore) ——— */
app.get("/api/admin/promotions", requireAuth, async (_req, res) => {
  try {
    res.json(await getAdminPromotions());
  } catch (err) {
    const msg = String(err.message || err);
    if (/permission|insufficient/i.test(msg)) {
      return res.status(503).json({
        error:
          "Firestore permissions: Console дээр firestore.rules-ийг Publish хийнэ үү (promotions read/write)."
      });
    }
    handleError(res, err);
  }
});

app.put(
  "/api/admin/promotions/section",
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    try {
      const existing = await getSection();
      let image = existing.image || "";

      if (req.file) {
        const uploaded = await saveUploadedFile(req.file);
        if (image && image !== uploaded) unlinkImage(image);
        image = uploaded;
      } else if (req.body.image !== undefined) {
        image = String(req.body.image || "").trim();
      }

      const section = await saveSection({
        title: req.body.title,
        subtitle: req.body.subtitle,
        description: req.body.description,
        image,
        buttonText: req.body.buttonText,
        buttonLink: req.body.buttonLink,
        active: req.body.active
      });
      res.json(section);
    } catch (err) {
      if (firestorePermissionError(res, err)) return;
      res.status(400).json({ error: err.message || "Алдаа гарлаа." });
    }
  }
);

app.post(
  "/api/admin/promotions",
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    try {
      const image = req.file
        ? await saveUploadedFile(req.file)
        : String(req.body.image || "").trim();
      if (!image) {
        return res.status(400).json({ error: "Урамшууллын зураг оруулна уу." });
      }

      const promo = await createPromotion({
        title: req.body.title,
        subtitle: req.body.subtitle,
        description: req.body.description,
        image,
        buttonText: req.body.buttonText,
        buttonLink: req.body.buttonLink,
        active: req.body.active,
        wide: req.body.wide,
        sortOrder: req.body.sortOrder
      });
      res.status(201).json(promo);
    } catch (err) {
      if (firestorePermissionError(res, err)) return;
      res.status(400).json({ error: err.message || "Алдаа гарлаа." });
    }
  }
);

app.put(
  "/api/admin/promotions/:id",
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    try {
      const id = req.params.id;
      if (id === SECTION_ID) {
        return res.status(400).json({ error: "Хэсгийн тохиргоог /section endpoint-аар хадгална." });
      }

      const existing = await getPromotionById(id);
      if (!existing) {
        return res.status(404).json({ error: "Урамшуулал олдсонгүй." });
      }

      let image = existing.image || "";
      if (req.file) {
        image = await saveUploadedFile(req.file);
      } else if (req.body.keepImage === "false" || req.body.keepImage === false) {
        image = "";
      } else if (req.body.image !== undefined && req.body.image !== "") {
        image = String(req.body.image).trim();
      }

      if (!image) {
        return res.status(400).json({ error: "Урамшууллын зураг шаардлагатай." });
      }

      const promo = await updatePromotion(id, {
        title: req.body.title,
        subtitle: req.body.subtitle,
        description: req.body.description,
        image,
        buttonText: req.body.buttonText,
        buttonLink: req.body.buttonLink,
        active: req.body.active,
        wide: req.body.wide,
        sortOrder: req.body.sortOrder
      });
      res.json(promo);
    } catch (err) {
      if (firestorePermissionError(res, err)) return;
      res.status(400).json({ error: err.message || "Алдаа гарлаа." });
    }
  }
);

app.delete("/api/admin/promotions/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await deletePromotion(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Урамшуулал олдсонгүй." });
    res.json({ ok: true, deleted });
  } catch (err) {
    if (firestorePermissionError(res, err)) return;
    res.status(400).json({ error: err.message || "Алдаа гарлаа." });
  }
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(ROOT, "admin", "index.html"));
});

app.get("/admin/login", (_req, res) => {
  res.sendFile(path.join(ROOT, "admin", "login.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Алдаа гарлаа." });
});

async function ensureReady() {
  await initDb();
  await seed();
  try {
    await ensurePromotionsSeeded();
  } catch (promoErr) {
    console.warn(
      "Promotions seed skipped (check Firestore rules):",
      promoErr.message || promoErr
    );
  }
  try {
    assertSmtpReady();
  } catch (mailErr) {
    console.warn("[mail]", mailErr.message || mailErr);
  }
}

async function start() {
  try {
    await ensureReady();
    app.listen(PORT, () => {
      console.log(`GloMax running at http://localhost:${PORT}`);
      console.log(`Admin panel: http://localhost:${PORT}/admin`);
      console.log(`Database: Firebase RTDB (products) + Firestore (promotions, orders)`);
      console.log(`Login: admin / admin123`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    console.error(
      "\nFirebase Realtime Database Rules-ийг шалгана уу.\n" +
        "Firebase Console → Realtime Database → Rules → test mode эсвэл read/write зөвшөөрнө үү."
    );
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { app, ensureReady, start };
