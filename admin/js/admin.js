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
let addFiles = [];
let editFiles = [];
let promoImageFile = null;
let promoCurrentImage = "";

function formatPrice(n) {
  return new Intl.NumberFormat("mn-MN").format(n) + "₮";
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

function setupDropzone(dropzoneId, inputId, onFiles) {
  const zone = document.getElementById(dropzoneId);
  const input = document.getElementById(inputId);

  zone.addEventListener("click", (e) => {
    if (e.target !== input) input.click();
  });

  ["dragenter", "dragover"].forEach((ev) => {
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.add("is-drag");
    });
  });

  ["dragleave", "drop"].forEach((ev) => {
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.remove("is-drag");
    });
  });

  zone.addEventListener("drop", (e) => {
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
    onFiles(files);
  });

  input.addEventListener("change", () => {
    onFiles([...input.files]);
    input.value = "";
  });
}

function renderFilePreview(containerId, files, setter) {
  const el = document.getElementById(containerId);
  el.innerHTML = files
    .map((file, i) => {
      const url = URL.createObjectURL(file);
      return `
        <div class="image-preview__item">
          <img src="${url}" alt="" />
          <button type="button" data-remove-file="${i}" aria-label="Устгах">×</button>
        </div>`;
    })
    .join("");

  el.querySelectorAll("[data-remove-file]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = [...files];
      next.splice(Number(btn.dataset.removeFile), 1);
      setter(next);
    });
  });
}

function setAddFiles(files) {
  addFiles = files;
  renderFilePreview("add-preview", addFiles, setAddFiles);
}

function setEditFiles(files) {
  editFiles = files;
  renderFilePreview("edit-preview", editFiles, setEditFiles);
}

function renderKeepImages() {
  const el = document.getElementById("edit-current-images");
  el.innerHTML = editKeepImages
    .map(
      (src, i) => `
      <div class="image-preview__item">
        <img src="${src}" alt="" />
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
  editFiles = [];
  renderKeepImages();
  setEditFiles([]);
  document.getElementById("edit-modal").classList.add("is-open");
}

function closeEdit() {
  document.getElementById("edit-modal").classList.remove("is-open");
  setEditFiles([]);
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

setupDropzone("add-dropzone", "add-images", (files) => {
  setAddFiles([...addFiles, ...files]);
});

setupDropzone("edit-dropzone", "edit-images", (files) => {
  setEditFiles([...editFiles, ...files]);
});

document.getElementById("add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!addFiles.length) {
    showFlash("Дор хаяж нэг зураг оруулна уу.", true);
    return;
  }

  const fd = new FormData();
  fd.append("name", e.target.name.value.trim());
  fd.append("price", e.target.price.value);
  fd.append("category", e.target.category.value.trim());
  fd.append("stock", e.target.stock.value || "0");
  fd.append("description", e.target.description.value.trim());
  addFiles.forEach((f) => fd.append("images", f));

  try {
    await api("/api/admin/products", { method: "POST", body: fd });
    showFlash("Бараа амжилттай нэмэгдлээ.");
    e.target.reset();
    setAddFiles([]);
    await refreshAll();
    switchPanel("products");
  } catch (err) {
    showFlash(err.message, true);
  }
});

document.getElementById("edit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("edit-id").value;

  if (!editKeepImages.length && !editFiles.length) {
    showFlash("Дор хаяж нэг зураг үлдээх эсвэл нэмнэ үү.", true);
    return;
  }

  const fd = new FormData();
  fd.append("name", document.getElementById("edit-name").value.trim());
  fd.append("price", document.getElementById("edit-price").value);
  fd.append("category", document.getElementById("edit-category").value.trim());
  fd.append("stock", document.getElementById("edit-stock").value || "0");
  fd.append("description", document.getElementById("edit-description").value.trim());
  fd.append("keepImages", JSON.stringify(editKeepImages));
  editFiles.forEach((f) => fd.append("images", f));

  try {
    await api(`/api/admin/products/${id}`, { method: "PUT", body: fd });
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

function setPromoImageFile(files) {
  promoImageFile = files[0] || null;
  const el = document.getElementById("promo-preview");
  if (!promoImageFile) {
    el.innerHTML = "";
    return;
  }
  const url = URL.createObjectURL(promoImageFile);
  el.innerHTML = `
    <div class="image-preview__item">
      <img src="${url}" alt="" />
      <button type="button" data-clear-promo-file aria-label="Устгах">×</button>
    </div>`;
  el.querySelector("[data-clear-promo-file]")?.addEventListener("click", () => {
    setPromoImageFile([]);
  });
}

function renderPromoCurrentImage() {
  const el = document.getElementById("promo-current-image");
  if (!promoCurrentImage) {
    el.innerHTML = `<p style="opacity:.7;margin:0;font-size:.9rem">Зураг байхгүй</p>`;
    return;
  }
  el.innerHTML = `
    <div class="image-preview__item">
      <img src="${escapeHtml(promoCurrentImage)}" alt="" />
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
  promoCurrentImage = p?.image || "";
  promoImageFile = null;
  renderPromoCurrentImage();
  setPromoImageFile([]);
  document.getElementById("promo-modal").classList.add("is-open");
}

function closePromoModal() {
  document.getElementById("promo-modal").classList.remove("is-open");
  promoImageFile = null;
  promoCurrentImage = "";
  setPromoImageFile([]);
}

document.getElementById("promo-section-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData();
  fd.append("title", document.getElementById("section-title").value.trim());
  fd.append("subtitle", document.getElementById("section-subtitle").value.trim());
  fd.append("description", document.getElementById("section-description").value.trim());
  fd.append("active", document.getElementById("section-active").checked ? "true" : "false");

  try {
    await api("/api/admin/promotions/section", { method: "PUT", body: fd });
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

setupDropzone("promo-dropzone", "promo-image", (files) => {
  setPromoImageFile(files.slice(0, 1));
});

document.getElementById("promo-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("promo-id").value;
  const isNew = !id;

  if (isNew && !promoImageFile && !promoCurrentImage) {
    showFlash("Урамшууллын зураг оруулна уу.", true);
    return;
  }
  if (!isNew && !promoImageFile && !promoCurrentImage) {
    showFlash("Урамшууллын зураг шаардлагатай.", true);
    return;
  }

  const fd = new FormData();
  fd.append("title", document.getElementById("promo-title").value.trim());
  fd.append("subtitle", document.getElementById("promo-subtitle").value.trim());
  fd.append("description", document.getElementById("promo-description").value.trim());
  fd.append("buttonText", document.getElementById("promo-button-text").value.trim());
  fd.append("buttonLink", document.getElementById("promo-button-link").value.trim());
  fd.append("active", document.getElementById("promo-active").checked ? "true" : "false");
  fd.append("wide", document.getElementById("promo-wide").checked ? "true" : "false");
  if (promoImageFile) fd.append("image", promoImageFile);
  else if (promoCurrentImage) fd.append("image", promoCurrentImage);

  try {
    if (isNew) {
      await api("/api/admin/promotions", { method: "POST", body: fd });
      showFlash("Урамшуулал нэмэгдлээ.");
    } else {
      await api(`/api/admin/promotions/${id}`, { method: "PUT", body: fd });
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
