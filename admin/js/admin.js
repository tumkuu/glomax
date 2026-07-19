const titles = {
  overview: ["Хянах самбар", "Ерөнхий үзүүлэлт"],
  products: ["Барааны удирдлага", "Засах, устгах, хайх"],
  add: ["Бараа нэмэх", "Шинэ бүтээгдэхүүн бүртгэх"],
  promotions: ["Promotion Management", "Нүүр хуудасны урамшуулал"]
};

let products = [];
let promoCards = [];
let promoSection = null;
let editKeepImages = [];
let addImageUrls = [];
let editImageUrls = [];

function formatPrice(n) {
  return new Intl.NumberFormat("mn-MN").format(n) + "₮";
}

function normalizeImageUrl(raw) {
  return String(raw || "").trim();
}

function isValidImageUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function showFlash(msg, isError = false) {
  const el = document.getElementById(isError ? "flash-error" : "flash");
  const other = document.getElementById(isError ? "flash" : "flash-error");
  other.classList.remove("is-visible");
  el.textContent = msg;
  el.classList.add("is-visible");
  clearTimeout(showFlash._t);
  showFlash._t = setTimeout(() => el.classList.remove("is-visible"), 3200);
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",
    ...options
  });
  if (res.status === 401) {
    location.href = "/admin/login.html";
    throw new Error("Unauthorized");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Алдаа гарлаа.");
  return data;
}

async function ensureAuth() {
  const me = await api("/api/auth/me");
  if (!me.authenticated) {
    location.href = "/admin/login.html";
    return false;
  }
  document.getElementById("admin-name").textContent = me.username;
  return true;
}

function switchPanel(name) {
  document.querySelectorAll(".panel").forEach((p) => p.classList.remove("is-active"));
  document.getElementById(`panel-${name}`)?.classList.add("is-active");
  document.querySelectorAll(".nav-list button[data-panel]").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.panel === name);
  });
  const [title, sub] = titles[name] || titles.overview;
  document.getElementById("page-title").textContent = title;
  document.getElementById("page-sub").innerHTML =
    `${sub} · <span id="admin-name">${document.getElementById("admin-name").textContent}</span>`;
  setSidebarOpen(false);
}

function setSidebarOpen(open) {
  const sidebar = document.getElementById("sidebar");
  let backdrop = document.querySelector(".sidebar-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "sidebar-backdrop";
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", () => setSidebarOpen(false));
  }
  sidebar.classList.toggle("is-open", open);
  backdrop.classList.toggle("is-visible", open);
  document.body.style.overflow = open ? "hidden" : "";
}

function renderStats(stats) {
  document.getElementById("stat-total").textContent = stats.total;
  document.getElementById("stat-stock").textContent = stats.stock;
  document.getElementById("stat-low").textContent = stats.low;
  document.getElementById("stat-out").textContent = stats.out;
}

function productRow(p, withActions = true) {
  const img = p.image || p.images?.[0] || "";
  const stockBadge =
    p.stock <= 0
      ? `<span class="badge badge--out">Дууссан</span>`
      : `<span class="badge">${p.stock}</span>`;

  return `
    <tr>
      <td data-label="Бараа">
        <div class="product-cell">
          ${img ? `<img src="${img}" alt="" loading="lazy" decoding="async" />` : `<div style="width:48px;height:48px;background:#eee;border-radius:8px"></div>`}
          <strong>${escapeHtml(p.name)}</strong>
        </div>
      </td>
      <td data-label="Ангилал">${escapeHtml(p.category || "—")}</td>
      <td data-label="Үнэ">${formatPrice(p.price)}</td>
      <td data-label="Нөөц">${stockBadge}</td>
      ${
        withActions
          ? `<td data-label="Огноо">${p.created_at ? p.created_at.slice(0, 10) : "—"}</td>
             <td data-label="Үйлдэл" class="actions">
               <button type="button" class="btn btn--outline btn--sm" data-edit="${p.id}">Засах</button>
               <button type="button" class="btn btn--danger btn--sm" data-delete="${p.id}">Устгах</button>
             </td>`
          : ""
      }
    </tr>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderProductsTable(filter = "") {
  const q = filter.trim().toLowerCase();
  const list = q
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q)
      )
    : products;

  const tbody = document.getElementById("products-table");
  const empty = document.getElementById("products-empty");

  if (!list.length) {
    tbody.innerHTML = "";
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  tbody.innerHTML = list.map((p) => productRow(p, true)).join("");
}

function renderOverview() {
  const recent = products.slice(0, 5);
  document.getElementById("overview-table").innerHTML = recent.length
    ? recent
        .map(
          (p) => `
      <tr>
        <td data-label="Бараа">
          <div class="product-cell">
            ${p.image ? `<img src="${p.image}" alt="" loading="lazy" decoding="async" />` : ""}
            <strong>${escapeHtml(p.name)}</strong>
          </div>
        </td>
        <td data-label="Ангилал">${escapeHtml(p.category || "—")}</td>
        <td data-label="Үнэ">${formatPrice(p.price)}</td>
        <td data-label="Нөөц">${p.stock}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="empty">Бараа байхгүй</td></tr>`;
}

function updateCategoryList() {
  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
  document.getElementById("category-list").innerHTML = cats
    .map((c) => `<option value="${escapeHtml(c)}"></option>`)
    .join("");
}

async function refreshAll() {
  const [list, stats] = await Promise.all([
    api("/api/admin/products"),
    api("/api/admin/stats")
  ]);
  products = list;
  renderStats(stats);
  renderOverview();
  renderProductsTable(document.getElementById("admin-search").value);
  updateCategoryList();

  try {
    const promoData = await api("/api/admin/promotions");
    promoSection = promoData.section || null;
    promoCards = promoData.cards || [];
  } catch (err) {
    promoSection = {
      title: "Урамшуулал",
      subtitle: "Одоогийн хямдрал & зар",
      description: "Онцлох урамшуулал, улирлын хямдралын саналууд.",
      active: true
    };
    promoCards = [];
    showFlash(err.message || "Урамшуулал ачаалж чадсангүй.", true);
  }
  renderPromoSectionForm();
  renderPromotionsTable();
}

function renderUrlPreview(containerId, urls, setter) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!urls.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = urls
    .map(
      (src, i) => `
      <div class="image-preview__item">
        <img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" />
        <button type="button" data-remove-url="${i}" aria-label="Устгах">×</button>
      </div>`
    )
    .join("");

  el.querySelectorAll("[data-remove-url]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = [...urls];
      next.splice(Number(btn.dataset.removeUrl), 1);
      setter(next);
    });
  });
}

function setAddImageUrls(urls) {
  addImageUrls = urls;
  renderUrlPreview("add-preview", addImageUrls, setAddImageUrls);
}

function setEditImageUrls(urls) {
  editImageUrls = urls;
  renderUrlPreview("edit-preview", editImageUrls, setEditImageUrls);
}

function addUrlFromInput(inputId, currentUrls, setter) {
  const input = document.getElementById(inputId);
  const url = normalizeImageUrl(input.value);
  if (!url) {
    showFlash("Зургийн холбоос оруулна уу.", true);
    return;
  }
  if (!isValidImageUrl(url)) {
    showFlash("Зөв http(s) холбоос оруулна уу.", true);
    return;
  }
  if (currentUrls.includes(url)) {
    showFlash("Энэ зураг аль хэдийн нэмэгдсэн.", true);
    return;
  }
  setter([...currentUrls, url]);
  input.value = "";
  input.focus();
}

function renderKeepImages() {
  const el = document.getElementById("edit-current-images");
  el.innerHTML = editKeepImages
    .map(
      (src, i) => `
      <div class="image-preview__item">
        <img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" />
        <button type="button" data-remove-keep="${i}" aria-label="Устгах">×</button>
      </div>`
    )
    .join("");

  el.querySelectorAll("[data-remove-keep]").forEach((btn) => {
    btn.addEventListener("click", () => {
      editKeepImages.splice(Number(btn.dataset.removeKeep), 1);
      renderKeepImages();
    });
  });
}

function openEdit(id) {
  const p = products.find((x) => x.id === Number(id));
  if (!p) return;

  document.getElementById("edit-id").value = p.id;
  document.getElementById("edit-name").value = p.name;
  document.getElementById("edit-price").value = p.price;
  document.getElementById("edit-category").value = p.category || "";
  document.getElementById("edit-stock").value = p.stock;
  document.getElementById("edit-description").value = p.description || "";
  editKeepImages = [...(p.images || [])];
  setEditImageUrls([]);
  document.getElementById("edit-image-url").value = "";
  renderKeepImages();
  document.getElementById("edit-modal").classList.add("is-open");
}

function closeEdit() {
  document.getElementById("edit-modal").classList.remove("is-open");
  setEditImageUrls([]);
  document.getElementById("edit-image-url").value = "";
}

document.querySelectorAll("[data-panel]").forEach((btn) => {
  btn.addEventListener("click", () => switchPanel(btn.dataset.panel));
});

document.querySelectorAll("[data-panel-jump]").forEach((btn) => {
  btn.addEventListener("click", () => switchPanel(btn.dataset.panelJump));
});

document.getElementById("menu-toggle").addEventListener("click", () => {
  const sidebar = document.getElementById("sidebar");
  setSidebarOpen(!sidebar.classList.contains("is-open"));
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  location.href = "/admin/login.html";
});

document.getElementById("admin-search").addEventListener("input", (e) => {
  renderProductsTable(e.target.value);
});

document.getElementById("products-table").addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit]");
  const delBtn = e.target.closest("[data-delete]");

  if (editBtn) {
    openEdit(editBtn.dataset.edit);
    return;
  }

  if (delBtn) {
    const id = delBtn.dataset.delete;
    const p = products.find((x) => x.id === Number(id));
    if (!confirm(`"${p?.name}" барааг устгах уу?`)) return;
    try {
      await api(`/api/admin/products/${id}`, { method: "DELETE" });
      showFlash("Бараа устгагдлаа.");
      await refreshAll();
    } catch (err) {
      showFlash(err.message, true);
    }
  }
});

document.getElementById("add-image-btn").addEventListener("click", () => {
  addUrlFromInput("add-image-url", addImageUrls, setAddImageUrls);
});

document.getElementById("add-image-url").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addUrlFromInput("add-image-url", addImageUrls, setAddImageUrls);
  }
});

document.getElementById("edit-image-btn").addEventListener("click", () => {
  addUrlFromInput("edit-image-url", editImageUrls, setEditImageUrls);
});

document.getElementById("edit-image-url").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addUrlFromInput("edit-image-url", editImageUrls, setEditImageUrls);
  }
});

document.getElementById("add-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const pending = normalizeImageUrl(document.getElementById("add-image-url").value);
  let images = [...addImageUrls];
  if (pending) {
    if (!isValidImageUrl(pending)) {
      showFlash("Зөв http(s) холбоос оруулна уу.", true);
      return;
    }
    if (!images.includes(pending)) images.push(pending);
  }

  if (!images.length) {
    showFlash("Дор хаяж нэг зургийн холбоос нэмнэ үү.", true);
    return;
  }

  const payload = {
    name: e.target.name.value.trim(),
    price: e.target.price.value,
    category: e.target.category.value.trim(),
    stock: e.target.stock.value || "0",
    description: e.target.description.value.trim(),
    images
  };

  try {
    await api("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    showFlash("Бараа амжилттай нэмэгдлээ.");
    e.target.reset();
    setAddImageUrls([]);
    await refreshAll();
    switchPanel("products");
  } catch (err) {
    showFlash(err.message, true);
  }
});

document.getElementById("edit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("edit-id").value;

  const pending = normalizeImageUrl(document.getElementById("edit-image-url").value);
  let extra = [...editImageUrls];
  if (pending) {
    if (!isValidImageUrl(pending)) {
      showFlash("Зөв http(s) холбоос оруулна уу.", true);
      return;
    }
    if (!extra.includes(pending) && !editKeepImages.includes(pending)) {
      extra.push(pending);
    }
  }

  const images = [...editKeepImages, ...extra];

  if (!images.length) {
    showFlash("Дор хаяж нэг зураг үлдээх эсвэл нэмнэ үү.", true);
    return;
  }

  const payload = {
    name: document.getElementById("edit-name").value.trim(),
    price: document.getElementById("edit-price").value,
    category: document.getElementById("edit-category").value.trim(),
    stock: document.getElementById("edit-stock").value || "0",
    description: document.getElementById("edit-description").value.trim(),
    images
  };

  try {
    await api(`/api/admin/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    showFlash("Өөрчлөлт хадгалагдлаа.");
    closeEdit();
    await refreshAll();
  } catch (err) {
    showFlash(err.message, true);
  }
});

document.getElementById("edit-cancel").addEventListener("click", closeEdit);
document.getElementById("edit-modal").addEventListener("click", (e) => {
  if (e.target.id === "edit-modal") closeEdit();
});

function renderPromoSectionForm() {
  if (!promoSection) return;
  document.getElementById("section-title").value = promoSection.title || "";
  document.getElementById("section-subtitle").value = promoSection.subtitle || "";
  document.getElementById("section-description").value = promoSection.description || "";
  document.getElementById("section-active").checked = promoSection.active !== false;
}

function renderPromotionsTable() {
  const tbody = document.getElementById("promotions-table");
  const empty = document.getElementById("promotions-empty");
  if (!tbody) return;

  if (!promoCards.length) {
    tbody.innerHTML = "";
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  tbody.innerHTML = promoCards
    .map((p) => {
      const img = p.image
        ? `<img src="${escapeHtml(p.image)}" alt="" loading="lazy" decoding="async" style="width:56px;height:40px;object-fit:cover;border-radius:6px" />`
        : `<div style="width:56px;height:40px;background:#eee;border-radius:6px"></div>`;
      const activeBadge = p.active
        ? `<span class="badge">Идэвхтэй</span>`
        : `<span class="badge badge--out">Идэвхгүй</span>`;
      return `
        <tr>
          <td data-label="Зураг">${img}</td>
          <td data-label="Title"><strong>${escapeHtml(p.title)}</strong></td>
          <td data-label="Subtitle">${escapeHtml(p.subtitle || p.description || "—")}</td>
          <td data-label="Товч">${escapeHtml(p.buttonText || "—")}</td>
          <td data-label="Active">${activeBadge}</td>
          <td data-label="Үйлдэл" class="actions">
            <button type="button" class="btn btn--outline btn--sm" data-promo-edit="${escapeHtml(p.id)}">Засах</button>
            <button type="button" class="btn btn--danger btn--sm" data-promo-delete="${escapeHtml(p.id)}">Устгах</button>
          </td>
        </tr>`;
    })
    .join("");
}

function renderPromoImagePreview(url) {
  const el = document.getElementById("promo-preview");
  const src = normalizeImageUrl(url);
  if (!src) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <div class="image-preview__item">
      <img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" />
    </div>`;
}

function openPromoModal(id = null) {
  const isNew = !id;
  document.getElementById("promo-modal-title").textContent = isNew
    ? "Шинэ урамшуулал"
    : "Урамшуулал засах";
  document.getElementById("promo-id").value = id || "";

  const p = id ? promoCards.find((x) => x.id === id) : null;
  document.getElementById("promo-title").value = p?.title || "";
  document.getElementById("promo-subtitle").value = p?.subtitle || "";
  document.getElementById("promo-description").value = p?.description || "";
  document.getElementById("promo-button-text").value = p?.buttonText || "";
  document.getElementById("promo-button-link").value = p?.buttonLink || "";
  document.getElementById("promo-active").checked = p ? p.active !== false : true;
  document.getElementById("promo-wide").checked = Boolean(p?.wide);
  document.getElementById("promo-image-url").value = p?.image || "";
  renderPromoImagePreview(p?.image || "");
  document.getElementById("promo-modal").classList.add("is-open");
}

function closePromoModal() {
  document.getElementById("promo-modal").classList.remove("is-open");
  document.getElementById("promo-image-url").value = "";
  renderPromoImagePreview("");
}

document.getElementById("promo-section-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    title: document.getElementById("section-title").value.trim(),
    subtitle: document.getElementById("section-subtitle").value.trim(),
    description: document.getElementById("section-description").value.trim(),
    active: document.getElementById("section-active").checked
  };

  try {
    await api("/api/admin/promotions/section", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    showFlash("Хэсгийн мэдээлэл хадгалагдлаа.");
    await refreshAll();
  } catch (err) {
    showFlash(err.message, true);
  }
});

document.getElementById("promo-add-btn").addEventListener("click", () => openPromoModal());

document.getElementById("promotions-table").addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-promo-edit]");
  const delBtn = e.target.closest("[data-promo-delete]");

  if (editBtn) {
    openPromoModal(editBtn.dataset.promoEdit);
    return;
  }

  if (delBtn) {
    const id = delBtn.dataset.promoDelete;
    const p = promoCards.find((x) => x.id === id);
    if (!confirm(`"${p?.title || "Урамшуулал"}" устгах уу?`)) return;
    try {
      await api(`/api/admin/promotions/${id}`, { method: "DELETE" });
      showFlash("Урамшуулал устгагдлаа.");
      await refreshAll();
    } catch (err) {
      showFlash(err.message, true);
    }
  }
});

document.getElementById("promo-image-url").addEventListener("input", (e) => {
  renderPromoImagePreview(e.target.value);
});

document.getElementById("promo-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("promo-id").value;
  const isNew = !id;
  const image = normalizeImageUrl(document.getElementById("promo-image-url").value);

  if (!image) {
    showFlash("Урамшууллын зургийн холбоос оруулна уу.", true);
    return;
  }
  if (!isValidImageUrl(image)) {
    showFlash("Зөв http(s) холбоос оруулна уу.", true);
    return;
  }

  const payload = {
    title: document.getElementById("promo-title").value.trim(),
    subtitle: document.getElementById("promo-subtitle").value.trim(),
    description: document.getElementById("promo-description").value.trim(),
    buttonText: document.getElementById("promo-button-text").value.trim(),
    buttonLink: document.getElementById("promo-button-link").value.trim(),
    active: document.getElementById("promo-active").checked,
    wide: document.getElementById("promo-wide").checked,
    image
  };

  try {
    if (isNew) {
      await api("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      showFlash("Урамшуулал нэмэгдлээ.");
    } else {
      await api(`/api/admin/promotions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      showFlash("Урамшуулал хадгалагдлаа.");
    }
    closePromoModal();
    await refreshAll();
  } catch (err) {
    showFlash(err.message, true);
  }
});

document.getElementById("promo-cancel").addEventListener("click", closePromoModal);
document.getElementById("promo-modal").addEventListener("click", (e) => {
  if (e.target.id === "promo-modal") closePromoModal();
});

(async function init() {
  const ok = await ensureAuth();
  if (!ok) return;
  await refreshAll();
  initAdminMobileNav();
})();

function initAdminMobileNav() {
  if (window.matchMedia("(min-width: 801px)").matches) return;
  if (document.querySelector(".admin-bottom-nav")) return;

  const nav = document.createElement("nav");
  nav.className = "admin-bottom-nav";
  nav.setAttribute("aria-label", "Админ цэс");
  nav.innerHTML = `
    <div class="admin-bottom-nav__inner">
      <button type="button" data-panel="overview">Самбар</button>
      <button type="button" data-panel="products">Бараа</button>
      <button type="button" data-panel="add">Нэмэх</button>
      <button type="button" data-panel="promotions">Урамшуулал</button>
      <a href="/">Дэлгүүр</a>
    </div>
  `;
  document.body.appendChild(nav);
  document.body.classList.add("has-admin-bottom-nav");

  nav.querySelectorAll("[data-panel]").forEach((btn) => {
    btn.addEventListener("click", () => switchPanel(btn.dataset.panel));
  });
}
