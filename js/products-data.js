const SITE = {
  name: "GloMax",
  tagline: "Чанартай бараа — хурдан хүргэлт",
  phone: "+976 7711-2233",
  email: "info@glomax.mn",
  address: "Улаанбаатар хот, Сүхбаатар дүүрэг, Энхтайваны өргөн чөлөө 15",
  facebook: "https://facebook.com",
  instagram: "https://instagram.com",
  shippingFee: 5000,
  freeShippingFrom: 200000
};

let PRODUCTS = [];
let CATEGORIES = [{ value: "all", label: "Бүгд" }];

function formatPrice(amount) {
  return new Intl.NumberFormat("mn-MN").format(amount) + "₮";
}

function rebuildCategories() {
  const unique = [
    ...new Set(
      PRODUCTS.map((p) => p.category).filter((c) => c && String(c).trim())
    )
  ].sort((a, b) => a.localeCompare(b, "mn"));

  CATEGORIES = [
    { value: "all", label: "Бүгд" },
    ...unique.map((c) => ({ value: c, label: c }))
  ];
}

async function loadProducts() {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("Бараа ачаалж чадсангүй");
  PRODUCTS = await res.json();
  rebuildCategories();
  return PRODUCTS;
}

async function fetchProductById(id) {
  const res = await fetch(`/api/products/${id}`);
  if (!res.ok) return null;
  return res.json();
}

function getProductById(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return undefined;
  return PRODUCTS.find((p) => Number(p.id) === n);
}

function getRelatedProducts(product, limit = 4) {
  const id = Number(product.id);
  return PRODUCTS.filter(
    (p) => p.category === product.category && Number(p.id) !== id
  ).slice(0, limit);
}
