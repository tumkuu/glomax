document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(location.search);
  const idParam = params.get("id");
  const root = document.getElementById("product-root");
  if (!root) return;

  const id = Number(idParam);
  let product = null;

  if (!idParam || !Number.isFinite(id) || id <= 0) {
    root.innerHTML = `
      <div class="empty-state">
        <h3>Бараа олдсонгүй</h3>
        <p>Буруу холбоос байна.</p>
        <a href="/products.html" class="btn btn--primary" style="margin-top:1rem">Бараа руу буцах</a>
      </div>`;
    return;
  }

  try {
    await loadProducts();
    product = getProductById(id) || (await fetchProductById(id));
  } catch {
    root.innerHTML = `
      <div class="empty-state">
        <h3>Бараа ачаалж чадсангүй</h3>
        <p>Сервер ажиллаж байгаа эсэхийг шалгана уу.</p>
      </div>`;
    return;
  }

  if (!product) {
    root.innerHTML = `
      <div class="empty-state">
        <h3>Бараа олдсонгүй</h3>
        <p>Энэ бүтээгдэхүүн байхгүй эсвэл устгагдсан байна.</p>
        <a href="/products.html" class="btn btn--primary" style="margin-top:1rem">Бараа руу буцах</a>
      </div>`;
    return;
  }

  if (!getProductById(product.id)) {
    PRODUCTS.push(product);
  }

  document.title = `${product.name} — GloMax`;

  const images =
    product.images && product.images.length
      ? product.images
      : product.image
        ? [product.image]
        : [];

  const inStock = Number(product.stock) > 0;
  let qty = 1;
  let activeImage = 0;

  function render() {
    const mainSrc =
      typeof optimizeImageUrl === "function"
        ? optimizeImageUrl(images[activeImage] || "", 900)
        : images[activeImage] || "";

    root.innerHTML = `
      <nav class="breadcrumb">
        <a href="/index.html">Нүүр</a>
        <span>/</span>
        <a href="/products.html">Бараа</a>
        <span>/</span>
        <span>${product.name}</span>
      </nav>

      <div class="product-detail">
        <div class="gallery">
          <div class="gallery__main">
            <img
              src="${mainSrc}"
              alt="${product.name}"
              id="main-image"
              decoding="async"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          ${
            images.length > 1
              ? `<div class="gallery__thumbs">
            ${images
              .map((img, i) => {
                const thumb =
                  typeof optimizeImageUrl === "function"
                    ? optimizeImageUrl(img, 200)
                    : img;
                return `
              <button type="button" class="gallery__thumb${
                i === activeImage ? " is-active" : ""
              }" data-thumb="${i}" aria-label="Зураг ${i + 1}">
                <img src="${thumb}" alt="" loading="lazy" decoding="async" />
              </button>`;
              })
              .join("")}
          </div>`
              : ""
          }
        </div>

        <div class="detail-info">
          <p class="detail__category">${product.category || ""}</p>
          <h1 class="detail__title">${product.name}</h1>
          <div class="detail__price">
            <span class="price">${formatPrice(product.price)}</span>
          </div>
          <div class="stock ${inStock ? "stock--in" : "stock--out"}">
            ${inStock ? `✓ Бэлэн байна (${product.stock} ширхэг)` : "✗ Дууссан"}
          </div>
          <p class="detail__desc">${product.description || ""}</p>

          <div class="qty-row">
            <span style="font-weight:600">Тоо ширхэг:</span>
            <div class="qty">
              <button type="button" data-qty="-1" aria-label="Бууруулах">−</button>
              <input type="number" id="qty-input" value="${qty}" min="1" max="${Math.max(
                Number(product.stock) || 1,
                1
              )}" readonly />
              <button type="button" data-qty="1" aria-label="Нэмэгдүүлэх">+</button>
            </div>
          </div>

          <div class="detail__actions">
            <button type="button" class="btn btn--primary" id="add-cart-btn" ${
              inStock ? "" : "disabled"
            }>Сагсанд нэмэх</button>
            <button type="button" class="btn btn--secondary" id="buy-now-btn" ${
              inStock ? "" : "disabled"
            }>Одоо худалдаж авах</button>
          </div>
        </div>
      </div>
    `;

    root.querySelectorAll("[data-thumb]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeImage = Number(btn.dataset.thumb);
        render();
      });
    });

    root.querySelectorAll("[data-qty]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const delta = Number(btn.dataset.qty);
        const max = Math.max(1, Number(product.stock) || 1);
        qty = Math.min(max, Math.max(1, qty + delta));
        const input = document.getElementById("qty-input");
        if (input) input.value = qty;
      });
    });

    const addBtn = document.getElementById("add-cart-btn");
    const buyBtn = document.getElementById("buy-now-btn");

    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const ok = Cart.add(product.id, qty, product);
        if (ok) showToast("Бараа сагсанд нэмэгдлээ");
        else showToast("Бараа нэмэхэд алдаа гарлаа");
      });
    }

    if (buyBtn) {
      buyBtn.addEventListener("click", () => {
        const ok = Cart.add(product.id, qty, product);
        if (ok) location.href = "/checkout.html";
        else showToast("Бараа нэмэхэд алдаа гарлаа");
      });
    }
  }

  render();

  const related = getRelatedProducts(product);
  if (related.length) {
    const section = document.getElementById("related-section");
    const relatedGrid = document.getElementById("related-products");
    if (section) section.hidden = false;
    if (relatedGrid) relatedGrid.innerHTML = related.map(createProductCard).join("");
  }
});
