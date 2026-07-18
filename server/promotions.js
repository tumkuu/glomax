const path = require("path");
const fs = require("fs");
const {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} = require("firebase/firestore");
const { firestore } = require("./firebase");

const COLLECTION = "promotions";
const SECTION_ID = "section";

const DEFAULT_SECTION = {
  title: "Урамшуулал",
  subtitle: "Одоогийн хямдрал & зар",
  description: "Онцлох урамшуулал, улирлын хямдралын саналууд.",
  image: "",
  buttonText: "",
  buttonLink: "",
  active: true
};

function promotionsCol() {
  return collection(firestore, COLLECTION);
}

function mapPromotion(id, data = {}) {
  return {
    id,
    title: data.title || "",
    subtitle: data.subtitle || "",
    description: data.description || "",
    image: data.image || "",
    buttonText: data.buttonText || "",
    buttonLink: data.buttonLink || "",
    active: data.active !== false,
    wide: Boolean(data.wide),
    sortOrder: Number(data.sortOrder) || 0,
    kind: data.kind === "section" ? "section" : "card",
    updatedAt: data.updatedAt || null,
    createdAt: data.createdAt || null
  };
}

function normalizePayload(body = {}) {
  const activeRaw = body.active;
  const active =
    activeRaw === true ||
    activeRaw === "true" ||
    activeRaw === "1" ||
    activeRaw === 1;

  return {
    title: String(body.title || "").trim(),
    subtitle: String(body.subtitle || "").trim(),
    description: String(body.description || "").trim(),
    image: String(body.image || "").trim(),
    buttonText: String(body.buttonText || "").trim(),
    buttonLink: String(body.buttonLink || "").trim(),
    active,
    wide:
      body.wide === true ||
      body.wide === "true" ||
      body.wide === "1" ||
      body.wide === 1,
    sortOrder: Number(body.sortOrder) || 0,
    kind: body.kind === "section" ? "section" : "card"
  };
}

function unlinkImage(imagePath) {
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

async function getSection() {
  try {
    const snap = await getDoc(doc(firestore, COLLECTION, SECTION_ID));
    if (!snap.exists()) {
      return mapPromotion(SECTION_ID, { ...DEFAULT_SECTION, kind: "section" });
    }
    return mapPromotion(snap.id, { ...snap.data(), kind: "section" });
  } catch (err) {
    console.warn("getSection failed:", err.message);
    return mapPromotion(SECTION_ID, { ...DEFAULT_SECTION, kind: "section" });
  }
}

async function saveSection(body) {
  const payload = normalizePayload({ ...body, kind: "section", wide: false });
  const ref = doc(firestore, COLLECTION, SECTION_ID);
  const existing = await getDoc(ref);
  const data = {
    ...payload,
    kind: "section",
    wide: false,
    updatedAt: serverTimestamp()
  };
  if (!existing.exists()) {
    data.createdAt = serverTimestamp();
  }
  await setDoc(ref, data, { merge: true });
  const saved = await getDoc(ref);
  return mapPromotion(saved.id, saved.data());
}

async function getAllPromotions({ includeSection = true } = {}) {
  try {
    const snapshot = await getDocs(promotionsCol());
    const items = snapshot.docs.map((d) => mapPromotion(d.id, d.data()));
    const filtered = includeSection
      ? items
      : items.filter((p) => p.kind !== "section" && p.id !== SECTION_ID);

    return filtered.sort((a, b) => {
      if (a.kind === "section") return -1;
      if (b.kind === "section") return 1;
      return a.sortOrder - b.sortOrder || String(a.id).localeCompare(String(b.id));
    });
  } catch (err) {
    console.warn("getAllPromotions failed:", err.message);
    if (includeSection) {
      return [
        mapPromotion(SECTION_ID, { ...DEFAULT_SECTION, kind: "section" }),
        ...FALLBACK_CARDS.map((c) => mapPromotion(c.id, c))
      ];
    }
    return FALLBACK_CARDS.map((c) => mapPromotion(c.id, c));
  }
}

const FALLBACK_CARDS = [
  {
    id: "fallback-1",
    title: "Зуны хямдрал — 30% хүртэл",
    subtitle: "",
    description: "Сонгосон электроник болон хувцасны бараанд.",
    image:
      "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=70&auto=format",
    buttonText: "Үзэх",
    buttonLink: "products.html",
    active: true,
    wide: true,
    sortOrder: 1,
    kind: "card"
  },
  {
    id: "fallback-2",
    title: "Шинэ электроник",
    subtitle: "",
    description: "Ухаалаг төхөөрөмжүүд",
    image:
      "https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=600&q=70&auto=format",
    buttonText: "Нээх",
    buttonLink: "products.html?category=электроник",
    active: true,
    wide: false,
    sortOrder: 2,
    kind: "card"
  },
  {
    id: "fallback-3",
    title: "Гэр ахуй",
    subtitle: "",
    description: "Тав тухтай орчин",
    image:
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=600&q=70&auto=format",
    buttonText: "Нээх",
    buttonLink: "products.html?category=гэр ахуй",
    active: true,
    wide: false,
    sortOrder: 3,
    kind: "card"
  },
  {
    id: "fallback-4",
    title: "Спорт & эрүүл мэнд",
    subtitle: "",
    description: "Идэвхтэй амьдралд",
    image:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=70&auto=format",
    buttonText: "Нээх",
    buttonLink: "products.html?category=спорт",
    active: true,
    wide: false,
    sortOrder: 4,
    kind: "card"
  }
];

function fallbackHome() {
  return {
    section: mapPromotion(SECTION_ID, { ...DEFAULT_SECTION, kind: "section" }),
    cards: FALLBACK_CARDS.map((c) => mapPromotion(c.id, c))
  };
}

async function getActivePromotionsForHome() {
  try {
    const section = await getSection();
    const cards = (await getAllPromotions({ includeSection: false })).filter(
      (p) => p.active
    );
    if (!cards.length && section.active !== false) {
      // Fresh project / seed pending — keep storefront looking correct
      return fallbackHome();
    }
    return { section, cards };
  } catch (err) {
    console.warn("Firestore promotions read failed, using fallback:", err.message);
    return fallbackHome();
  }
}

async function getAllPromotionsRaw() {
  const snapshot = await getDocs(promotionsCol());
  return snapshot.docs.map((d) => mapPromotion(d.id, d.data()));
}

async function getAdminPromotions() {
  const items = await getAllPromotionsRaw();
  const sectionDoc = items.find((p) => p.id === SECTION_ID || p.kind === "section");
  const section = sectionDoc || mapPromotion(SECTION_ID, { ...DEFAULT_SECTION, kind: "section" });
  const cards = items
    .filter((p) => p.id !== SECTION_ID && p.kind !== "section")
    .sort((a, b) => a.sortOrder - b.sortOrder || String(a.id).localeCompare(String(b.id)));
  return { section, cards };
}

async function getPromotionById(id) {
  if (!id) return null;
  if (id === SECTION_ID) return getSection();
  const snap = await getDoc(doc(firestore, COLLECTION, String(id)));
  if (!snap.exists()) return null;
  return mapPromotion(snap.id, snap.data());
}

async function createPromotion(body) {
  const payload = normalizePayload({ ...body, kind: "card" });
  if (!payload.title) {
    throw new Error("Гарчиг заавал шаардлагатай.");
  }

  const all = await getAllPromotions({ includeSection: false });
  const sortOrder =
    payload.sortOrder ||
    (all.reduce((max, p) => Math.max(max, p.sortOrder), 0) + 1);

  const ref = await addDoc(promotionsCol(), {
    ...payload,
    kind: "card",
    sortOrder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  const saved = await getDoc(ref);
  return mapPromotion(saved.id, saved.data());
}

async function updatePromotion(id, body) {
  if (id === SECTION_ID) {
    return saveSection(body);
  }

  const ref = doc(firestore, COLLECTION, String(id));
  const existing = await getDoc(ref);
  if (!existing.exists()) return null;

  const prev = existing.data() || {};
  const payload = normalizePayload({
    title: body.title !== undefined ? body.title : prev.title,
    subtitle: body.subtitle !== undefined ? body.subtitle : prev.subtitle,
    description:
      body.description !== undefined ? body.description : prev.description,
    image: body.image !== undefined ? body.image : prev.image,
    buttonText:
      body.buttonText !== undefined ? body.buttonText : prev.buttonText,
    buttonLink:
      body.buttonLink !== undefined ? body.buttonLink : prev.buttonLink,
    active: body.active !== undefined ? body.active : prev.active,
    wide: body.wide !== undefined ? body.wide : prev.wide,
    sortOrder: body.sortOrder !== undefined ? body.sortOrder : prev.sortOrder,
    kind: "card"
  });

  if (body.image !== undefined && prev.image && prev.image !== payload.image) {
    unlinkImage(prev.image);
  }

  await updateDoc(ref, {
    ...payload,
    kind: "card",
    updatedAt: serverTimestamp()
  });

  const saved = await getDoc(ref);
  return mapPromotion(saved.id, saved.data());
}

async function deletePromotion(id) {
  if (!id || id === SECTION_ID) {
    throw new Error("Хэсгийн тохиргоог устгах боломжгүй.");
  }

  const ref = doc(firestore, COLLECTION, String(id));
  const existing = await getDoc(ref);
  if (!existing.exists()) return null;

  const data = existing.data() || {};
  await deleteDoc(ref);
  unlinkImage(data.image);
  return mapPromotion(existing.id, data);
}

async function ensurePromotionsSeeded() {
  const sectionRef = doc(firestore, COLLECTION, SECTION_ID);
  const sectionSnap = await getDoc(sectionRef);
  if (!sectionSnap.exists()) {
    await setDoc(sectionRef, {
      ...DEFAULT_SECTION,
      kind: "section",
      wide: false,
      sortOrder: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  const snapshot = await getDocs(promotionsCol());
  const hasCards = snapshot.docs.some(
    (d) => d.id !== SECTION_ID && d.data()?.kind !== "section"
  );
  if (hasCards) return;

  for (const card of FALLBACK_CARDS) {
    const { id: _id, ...data } = card;
    await addDoc(promotionsCol(), {
      ...data,
      kind: "card",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  console.log(`Seeded ${FALLBACK_CARDS.length} promotions to Firestore.`);
}

module.exports = {
  SECTION_ID,
  DEFAULT_SECTION,
  getSection,
  saveSection,
  getAllPromotions,
  getActivePromotionsForHome,
  getAdminPromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion,
  ensurePromotionsSeeded,
  unlinkImage
};
