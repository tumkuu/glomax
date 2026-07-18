function optimizeImageUrl(url, width = 640) {
  if (!url) return "";
  try {
    if (url.includes("images.unsplash.com")) {
      const u = new URL(url);
      u.searchParams.set("w", String(width));
      u.searchParams.set("q", "72");
      u.searchParams.set("auto", "format");
      u.searchParams.set("fit", "crop");
      return u.toString();
    }
  } catch {
    /* keep original */
  }
  return url;
}

function getCurrentPage() {
  const parts = location.pathname.split("/").filter(Boolean);
  let page = parts[parts.length - 1] || "index.html";
  if (page === "admin") return "admin";
  if (!page.includes(".")) {
    if (page === "index") return "index.html";
    page = `${page}.html`;
  }
  return page;
}

function createProductCard(product) {
  const raw = product.image || (product.images && product.images[0]) || "";
  const image = optimizeImageUrl(raw, 640);
  const desc = product.shortDesc || product.description || "";
  const id = Number(product.id);

  return `
    <article class="product-card" data-id="${id}">
      <a href="product.html?id=${id}" class="product-card__media">
        <img
          src="${image}"
          alt="${product.name}"
          loading="lazy"
          decoding="async"
          sizes="(max-width: 480px) 100vw, (max-width: 900px) 50vw, 25vw"
        />
      </a>
      <div class="product-card__body">
        <p class="product-card__category">${product.category || ""}</p>
        <h3 class="product-card__title">
          <a href="product.html?id=${id}">${product.name}</a>
        </h3>
        <p class="product-card__desc">${desc}</p>
        <div class="product-card__price">
          <span class="price">${formatPrice(product.price)}</span>
        </div>
        <div class="product-card__actions">
          <a href="product.html?id=${id}" class="btn btn--outline btn--sm">Дэлгэрэнгүй</a>
          <button type="button" class="btn btn--primary btn--sm" data-add-cart="${id}">
            Сагсанд нэмэх
          </button>
        </div>
      </div>
    </article>
  `;
}

function showToast(message, type = "success") {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.className = `toast toast--${type} toast--show`;
  toast.textContent = message;

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove("toast--show");
  }, 2600);
}

function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".nav-menu");
  const navRow = document.querySelector(".nav");
  let backdrop = document.querySelector(".nav-backdrop");
  const mobileQuery = window.matchMedia("(max-width: 900px)");

  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "nav-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    document.body.appendChild(backdrop);
  }

  function ensureMenuStructure() {
    if (!menu) return;

    if (!menu.querySelector(".nav-menu__close")) {
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "nav-menu__close";
      closeBtn.setAttribute("aria-label", "Цэс хаах");
      closeBtn.innerHTML = "&times;";
      menu.insertBefore(closeBtn, menu.firstChild);
      closeBtn.addEventListener("click", () => setNavOpen(false));
    }

    let links = menu.querySelector(".nav-menu__links");
    if (!links) {
      links = document.createElement("div");
      links.className = "nav-menu__links";
      [...menu.children].forEach((child) => {
        if (
          child.classList.contains("nav-menu__close") ||
          child.classList.contains("nav-menu__links")
        ) {
          return;
        }
        links.appendChild(child);
      });
      menu.appendChild(links);
    }
  }

  function placeMenuForViewport() {
    if (!menu || !navRow) return;
    if (mobileQuery.matches) {
      if (menu.parentElement !== document.body) {
        document.body.appendChild(menu);
      }
    } else {
      if (menu.parentElement !== navRow) {
        navRow.appendChild(menu);
      }
      setNavOpen(false);
    }
  }

  function setNavOpen(open) {
    if (!menu || !toggle) return;
    menu.classList.toggle("is-open", open);
    toggle.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    backdrop.classList.toggle("is-visible", open);
    backdrop.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("nav-open", open);
  }

  ensureMenuStructure();
  placeMenuForViewport();

  if (toggle && menu) {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (mobileQuery.matches) placeMenuForViewport();
      setNavOpen(!menu.classList.contains("is-open"));
    });

    backdrop.addEventListener("click", () => setNavOpen(false));

    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setNavOpen(false));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setNavOpen(false);
    });
  }

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", placeMenuForViewport);
  } else if (typeof mobileQuery.addListener === "function") {
    mobileQuery.addListener(placeMenuForViewport);
  }

  const path = getCurrentPage();
  document.querySelectorAll(".nav-menu a").forEach((link) => {
    const href = (link.getAttribute("href") || "").split("/").pop();
    if (href === path || (path === "index.html" && href === "index.html")) {
      link.classList.add("is-active");
    }
  });

  Cart.updateBadge();
}

function buildBottomNavHtml(path) {
  const is = (page) =>
    path === page || (page === "index.html" && (path === "" || path === "index.html"));

  return `
    <div class="mobile-bottom-nav__inner">
      <a href="/index.html" class="${is("index.html") ? "is-active" : ""}" aria-label="Нүүр">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V9.5z"/></svg>
        <span>Нүүр</span>
      </a>
      <a href="/products.html" class="${is("products.html") ? "is-active" : ""}" aria-label="Бараа">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        <span>Бараа</span>
      </a>
      <a href="/cart.html" class="nav-cart ${is("cart.html") ? "is-active" : ""}" aria-label="Сагс">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="20" r="1"/><circle cx="17" cy="20" r="1"/><path d="M2 3h2l2.4 12.4a1 1 0 001 .8h9.2a1 1 0 00.98-.8L20 7H6"/></svg>
        <span>Сагс</span>
        <span class="cart-badge" data-cart-count hidden>0</span>
      </a>
      <a href="/contact.html" class="${is("contact.html") ? "is-active" : ""}" aria-label="Холбоо барих">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4v8z"/></svg>
        <span>Холбоо</span>
      </a>
    </div>
  `;
}

function initMobileBottomNav() {
  const path = getCurrentPage();
  let nav = document.querySelector(".mobile-bottom-nav");

  if (!nav) {
    nav = document.createElement("nav");
    nav.className = "mobile-bottom-nav";
    nav.setAttribute("aria-label", "Утасны цэс");
    document.body.appendChild(nav);
  }

  if (!nav.querySelector(".mobile-bottom-nav__inner")) {
    nav.innerHTML = buildBottomNavHtml(path);
  } else {
    nav.querySelectorAll("a").forEach((link) => {
      const href = (link.getAttribute("href") || "").split("/").pop() || "";
      const active =
        href === path ||
        (path === "index.html" && (href === "index.html" || href === ""));
      link.classList.toggle("is-active", active);
    });
  }

  document.body.classList.add("has-bottom-nav");
  Cart.updateBadge();
}

function initGlobalSearch() {
  const form = document.querySelector("[data-global-search]");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = form.querySelector("input").value.trim();
    const url = q
      ? `/products.html?q=${encodeURIComponent(q)}`
      : "/products.html";
    location.href = url;
  });
}

function initAddToCartButtons(root = document) {
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-add-cart]");
    if (!btn) return;

    e.preventDefault();
    const id = Number(btn.dataset.addCart);
    if (!Number.isFinite(id)) return;

    btn.disabled = true;
    try {
      let product = getProductById(id);
      if (!product) {
        if (!PRODUCTS.length) {
          try {
            await loadProducts();
          } catch {
            /* fetch single below */
          }
          product = getProductById(id);
        }
      }
      if (!product) {
        product = await fetchProductById(id);
        if (product && !getProductById(product.id)) PRODUCTS.push(product);
      }

      const ok = Cart.add(id, 1, product);
      if (ok) {
        showToast("Бараа сагсанд нэмэгдлээ");
        btn.classList.add("btn--pulse");
        setTimeout(() => btn.classList.remove("btn--pulse"), 400);
      } else {
        showToast("Бараа нэмэхэд алдаа гарлаа");
      }
    } finally {
      btn.disabled = false;
    }
  });
}

function initScrollReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!els.length || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  els.forEach((el) => io.observe(el));
}

function initSmoothAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/** Keep focused inputs visible above mobile keyboard */
function initMobileKeyboardSafeInputs(root = document) {
  if (!window.matchMedia("(max-width: 768px)").matches) return;

  root.querySelectorAll("input, textarea, select").forEach((el) => {
    el.addEventListener("focus", () => {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 280);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initMobileBottomNav();
  initGlobalSearch();
  initAddToCartButtons();
  initScrollReveal();
  initSmoothAnchors();
  initMobileKeyboardSafeInputs();
  Cart.updateBadge();
});
