function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createPromoCard(promo, index) {
  const href = promo.buttonLink || "products.html";
  const wideClass = promo.wide || index === 0 ? " promo-card--wide" : "";
  const btnClass = promo.wide || index === 0 ? "btn--secondary" : "btn--ghost";
  const title = promo.title || "";
  const bodyText = promo.description || promo.subtitle || "";
  const buttonText = promo.buttonText || "Үзэх";
  const image = promo.image || "";

  return `
    <a href="${escapeHtml(href)}" class="promo-card${wideClass} reveal">
      <div
        class="promo-card__bg"
        style="background-image: url('${escapeHtml(image)}')"
      ></div>
      <div class="promo-card__overlay"></div>
      <div class="promo-card__body">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(bodyText)}</p>
        <span class="btn ${btnClass} btn--sm">${escapeHtml(buttonText)}</span>
      </div>
    </a>`;
}

async function loadPromotions() {
  const sectionEl = document.getElementById("promo");
  const grid = document.getElementById("promo-grid");
  if (!sectionEl || !grid) return;

  try {
    const res = await fetch("/api/promotions");
    if (!res.ok) throw new Error("Failed to load promotions");
    const data = await res.json();
    const section = data.section || {};
    const cards = Array.isArray(data.cards) ? data.cards : [];

    if (section.active === false || !cards.length) {
      sectionEl.hidden = true;
      return;
    }

    document.getElementById("promo-eyebrow").textContent = section.title || "";
    document.getElementById("promo-title").textContent = section.subtitle || "";
    document.getElementById("promo-lead").textContent = section.description || "";

    grid.innerHTML = cards.map((card, i) => createPromoCard(card, i)).join("");
    sectionEl.hidden = false;

    grid.querySelectorAll(".promo-card").forEach((card, i) => {
      card.style.transitionDelay = `${(i % 4) * 0.06}s`;
    });

    if (typeof initScrollReveal === "function") {
      initScrollReveal();
    }
  } catch (err) {
    console.error("Promotions load failed:", err);
    sectionEl.hidden = true;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("home-products");

  await loadPromotions();

  if (!grid) return;

  try {
    await loadProducts();
  } catch {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>Бараа ачаалж чадсангүй</h3>
        <p>Сервер ажиллаж байгаа эсэхийг шалгана уу.</p>
      </div>`;
    return;
  }

  if (!PRODUCTS.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>Бараа байхгүй байна</h3>
        <p>Тун удахгүй шинэ бараа нэмэгдэнэ.</p>
      </div>`;
    return;
  }

  grid.innerHTML = PRODUCTS.map(createProductCard).join("");
  grid.querySelectorAll(".product-card").forEach((card, i) => {
    card.classList.add("reveal");
    card.style.transitionDelay = `${(i % 4) * 0.06}s`;
  });

  initScrollReveal();
});
