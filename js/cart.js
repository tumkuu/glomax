const CART_KEY = "glomax_cart";

function sameProductId(a, b) {
  return Number(a) === Number(b);
}

const Cart = {
  get() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY));
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((i) => i && i.id != null && Number(i.quantity) > 0)
        .map((i) => ({
          id: Number(i.id),
          name: String(i.name || ""),
          price: Number(i.price) || 0,
          image: String(i.image || ""),
          quantity: Math.max(1, Number(i.quantity) || 1)
        }));
    } catch {
      return [];
    }
  },

  save(items) {
    const cleaned = (items || [])
      .filter((i) => i && i.id != null && Number(i.quantity) > 0)
      .map((i) => ({
        id: Number(i.id),
        name: String(i.name || ""),
        price: Number(i.price) || 0,
        image: String(i.image || ""),
        quantity: Math.max(1, Number(i.quantity) || 1)
      }));
    localStorage.setItem(CART_KEY, JSON.stringify(cleaned));
    this.updateBadge();
    window.dispatchEvent(new CustomEvent("cartUpdated"));
  },

  add(productId, quantity = 1, fallbackProduct = null) {
    const id = Number(productId);
    if (!Number.isFinite(id)) return false;

    let product = getProductById(id);
    if (!product && fallbackProduct && Number(fallbackProduct.id) === id) {
      product = fallbackProduct;
    }
    if (!product) return false;

    const stock = Number(product.stock);
    const maxStock = Number.isFinite(stock) && stock > 0 ? stock : Infinity;
    if (!(maxStock > 0)) return false;

    const qtyToAdd = Math.max(1, Number(quantity) || 1);
    const items = this.get();
    const existing = items.find((i) => sameProductId(i.id, id));
    const image =
      product.image ||
      (product.images && product.images[0]) ||
      (existing && existing.image) ||
      "";

    if (existing) {
      existing.quantity = Math.min(existing.quantity + qtyToAdd, maxStock);
      existing.name = product.name || existing.name;
      existing.price = Number(product.price) || existing.price;
      if (image) existing.image = image;
    } else {
      items.push({
        id,
        name: product.name,
        price: Number(product.price) || 0,
        image,
        quantity: Math.min(qtyToAdd, maxStock)
      });
    }

    this.save(items);
    return true;
  },

  setQuantity(productId, quantity) {
    const id = Number(productId);
    let items = this.get();
    const item = items.find((i) => sameProductId(i.id, id));
    if (!item) return;

    const product = getProductById(id);
    const stock = product ? Number(product.stock) : NaN;
    const maxStock = Number.isFinite(stock) && stock > 0 ? stock : Infinity;

    if (quantity <= 0) {
      items = items.filter((i) => !sameProductId(i.id, id));
    } else {
      item.quantity = Math.min(Math.max(1, Number(quantity) || 1), maxStock);
    }

    this.save(items);
  },

  remove(productId) {
    const id = Number(productId);
    this.save(this.get().filter((i) => !sameProductId(i.id, id)));
  },

  clear() {
    this.save([]);
  },

  count() {
    return this.get().reduce((sum, i) => sum + i.quantity, 0);
  },

  subtotal() {
    return this.get().reduce((sum, i) => sum + i.price * i.quantity, 0);
  },

  shipping() {
    const sub = this.subtotal();
    if (sub === 0) return 0;
    return sub >= SITE.freeShippingFrom ? 0 : SITE.shippingFee;
  },

  total() {
    return this.subtotal() + this.shipping();
  },

  updateBadge() {
    const badges = document.querySelectorAll("[data-cart-count]");
    const count = this.count();
    badges.forEach((el) => {
      el.textContent = String(count);
      if (count === 0) el.setAttribute("hidden", "");
      else el.removeAttribute("hidden");
    });
  }
};
