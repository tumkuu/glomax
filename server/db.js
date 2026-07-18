const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { ref, get, set, update, remove, runTransaction } = require("firebase/database");
const { database } = require("./firebase");

const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const productsRef = () => ref(database, "products");
const adminsRef = () => ref(database, "admins");
const nextIdRef = () => ref(database, "meta/nextProductId");

function parseImages(raw) {
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function mapProduct(row) {
  if (!row) return null;
  const images = parseImages(row.images);
  const description = row.description || "";
  return {
    id: Number(row.id),
    name: row.name,
    price: Number(row.price),
    description,
    category: row.category || "",
    stock: Number(row.stock) || 0,
    images,
    image: images[0] || "",
    shortDesc:
      description.length > 110 ? description.slice(0, 110).trim() + "…" : description,
    created_at: row.created_at || ""
  };
}

async function ensureAdmin() {
  const snapshot = await get(ref(database, "admins/admin"));
  if (!snapshot.exists()) {
    const hash = bcrypt.hashSync("admin123", 10);
    await set(ref(database, "admins/admin"), {
      username: "admin",
      password_hash: hash,
      created_at: new Date().toISOString()
    });
  }
}

async function getNextProductId() {
  const result = await runTransaction(nextIdRef(), (current) => {
    if (current === null) return 1;
    return current + 1;
  });
  return result.snapshot.val();
}

async function getAllProducts() {
  const snapshot = await get(productsRef());
  if (!snapshot.exists()) return [];

  return Object.values(snapshot.val())
    .map(mapProduct)
    .sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA || b.id - a.id;
    });
}

async function getProductById(id) {
  const snapshot = await get(ref(database, `products/${Number(id)}`));
  if (!snapshot.exists()) return null;
  return mapProduct(snapshot.val());
}

async function getCategories() {
  const products = await getAllProducts();
  return [
    ...new Set(
      products.map((p) => p.category).filter((c) => c && String(c).trim())
    )
  ].sort((a, b) => a.localeCompare(b, "mn"));
}

async function createProduct({ name, price, description, category, stock, images }) {
  const id = await getNextProductId();
  const product = {
    id,
    name,
    price: Number(price),
    description: description || "",
    category: category || "",
    stock: Number(stock) || 0,
    images: images || [],
    created_at: new Date().toISOString()
  };

  await set(ref(database, `products/${id}`), product);
  return mapProduct(product);
}

async function updateProduct(id, data) {
  const productId = Number(id);
  const existingSnap = await get(ref(database, `products/${productId}`));
  if (!existingSnap.exists()) return null;

  const existing = existingSnap.val();
  const images =
    data.images !== undefined ? data.images : parseImages(existing.images);

  const updated = {
    id: productId,
    name: data.name ?? existing.name,
    price: data.price !== undefined ? Number(data.price) : Number(existing.price),
    description: data.description ?? existing.description,
    category: data.category ?? existing.category,
    stock: data.stock !== undefined ? Number(data.stock) : Number(existing.stock),
    images,
    created_at: existing.created_at || new Date().toISOString()
  };

  await set(ref(database, `products/${productId}`), updated);
  return mapProduct(updated);
}

async function deleteProduct(id) {
  const product = await getProductById(id);
  if (!product) return null;

  await remove(ref(database, `products/${Number(id)}`));

  product.images.forEach((img) => {
    if (img.startsWith("/uploads/")) {
      const filePath = path.join(__dirname, "..", img.replace(/^\//, ""));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          /* ignore */
        }
      }
    }
  });

  return product;
}

async function verifyAdmin(username, password) {
  const snapshot = await get(ref(database, `admins/${username}`));
  if (!snapshot.exists()) return false;
  const admin = snapshot.val();
  return bcrypt.compareSync(password, admin.password_hash);
}

async function getStats() {
  const products = await getAllProducts();
  const total = products.length;
  const stock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
  const low = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const out = products.filter((p) => p.stock === 0).length;
  const categories = (await getCategories()).length;

  return { total, stock, low, out, categories };
}

async function initDb() {
  await ensureAdmin();
}

module.exports = {
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
  parseImages,
  mapProduct
};
