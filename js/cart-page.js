document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("cart-root");
  if (!root) return;

  try {
    await loadProducts();
  } catch {
    /* stock limits fall back to cart qty */
  }

  let rendering = false;

  function render() {
    if (rendering) return;
    rendering = true;

    try {
      const items = Cart.get();

      if (!items.length) {
        root.innerHTML = `
          <div class="empty-state">
            <h3>Сагс хоосон байна</h3>
            <p>Таалагдсан бараагаа нэмээд захиалгаа эхлүүлнэ үү.</p>
            <a href="/products.html" class="btn btn--primary" style="margin-top:1rem">Бараа үзэх</a>
          </div>`;
        return;
      }

      const shipping = Cart.shipping();
      const subtotal = Cart.subtotal();
      const total = Cart.total();

      root.innerHTML = `
        <div class="cart-layout">
          <div class="cart-list">
            ${items
              .map((item) => {
                const product = getProductById(item.id);
                const max = product && product.stock > 0 ? product.stock : item.quantity;
                const img =
                  typeof optimizeImageUrl === "function"
                    ? optimizeImageUrl(item.image, 200)
                    : item.image;
                const safeImg = img || "";
                return `
                <article class="cart-item" data-id="${item.id}">
                  <a href="/product.html?id=${item.id}" class="cart-item__img">
                    ${
                      safeImg
                        ? `<img src="${safeImg}" alt="${item.name}" loading="lazy" decoding="async" />`
                        : `<div class="cart-item__placeholder" aria-hidden="true"></div>`
                    }
                  </a>
                  <div class="cart-item__info">
                    <h3 class="cart-item__name">
                      <a href="/product.html?id=${item.id}">${item.name}</a>
                    </h3>
                    <p class="cart-item__price">${formatPrice(item.price)}</p>
                    <div class="qty">
                      <button type="button" data-qty-change="-1" aria-label="Бууруулах">−</button>
                      <input type="number" value="${item.quantity}" min="1" max="${max}" readonly />
                      <button type="button" data-qty-change="1" aria-label="Нэмэгдүүлэх">+</button>
                    </div>
                    <button type="button" class="cart-item__remove" data-remove>Устгах</button>
                  </div>
                  <div class="cart-item__line">${formatPrice(
                    item.price * item.quantity
                  )}</div>
                </article>`;
              })
              .join("")}
          </div>

          <aside class="cart-summary">
            <h2>Захиалгын дүн</h2>
            <div class="summary-row">
              <span>Дэд нийлбэр</span>
              <strong>${formatPrice(subtotal)}</strong>
            </div>
            <div class="summary-row">
              <span>Хүргэлт</span>
              <strong>${shipping === 0 ? "Үнэгүй" : formatPrice(shipping)}</strong>
            </div>
            <div class="summary-row summary-row--total">
              <span>Нийт</span>
              <span>${formatPrice(total)}</span>
            </div>
            <p class="summary-note">
              ${formatPrice(SITE.freeShippingFrom)}-с дээш захиалгад хүргэлт үнэгүй.
            </p>
            <a href="/checkout.html" class="btn btn--primary btn--block">Захиалга үргэлжлүүлэх</a>
            <a href="/products.html" class="btn btn--outline btn--block">Үргэлжлүүлэн худалдан авах</a>
          </aside>
        </div>
      `;

      root.querySelectorAll(".cart-item").forEach((el) => {
        const id = Number(el.dataset.id);

        el.querySelectorAll("[data-qty-change]").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const current = Cart.get().find((i) => Number(i.id) === id);
            if (!current) return;
            const delta = Number(btn.dataset.qtyChange);
            Cart.setQuantity(id, current.quantity + delta);
          });
        });

        const removeBtn = el.querySelector("[data-remove]");
        if (removeBtn) {
          removeBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            Cart.remove(id);
            showToast("Бараа сагснаас хасагдлаа");
          });
        }
      });
    } finally {
      rendering = false;
    }
  }

  window.addEventListener("cartUpdated", render);
  render();
});
