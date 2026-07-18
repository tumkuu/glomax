document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("checkout-form");
  const summary = document.getElementById("order-summary");
  const content = document.getElementById("checkout-content");
  const success = document.getElementById("success-banner");
  const submitBtn = form.querySelector('button[type="submit"]');

  let submitting = false;
  let submitted = false;

  function renderSummary() {
    const items = Cart.get();

    if (!items.length) {
      summary.innerHTML = `
        <h2>Таны захиалга</h2>
        <p style="color:var(--text-muted)">Сагс хоосон байна.</p>
        <a href="products.html" class="btn btn--outline btn--block" style="margin-top:1rem">Бараа сонгох</a>
      `;
      return;
    }

    summary.innerHTML = `
      <h2>Таны захиалга</h2>
      ${items
        .map(
          (item) => `
        <div class="order-mini">
          <img src="${
            typeof optimizeImageUrl === "function"
              ? optimizeImageUrl(item.image, 120)
              : item.image
          }" alt="${item.name}" loading="lazy" decoding="async" />
          <div class="order-mini__info">
            <strong>${item.name}</strong>
            <span>${item.quantity} × ${formatPrice(item.price)}</span>
          </div>
          <strong>${formatPrice(item.price * item.quantity)}</strong>
        </div>`
        )
        .join("")}
      <div class="summary-row">
        <span>Дэд нийлбэр</span>
        <strong>${formatPrice(Cart.subtotal())}</strong>
      </div>
      <div class="summary-row">
        <span>Хүргэлт</span>
        <strong>${
          Cart.shipping() === 0 ? "Үнэгүй" : formatPrice(Cart.shipping())
        }</strong>
      </div>
      <div class="summary-row summary-row--total">
        <span>Нийт</span>
        <span>${formatPrice(Cart.total())}</span>
      </div>
    `;
  }

  function setError(name, message) {
    const input = form.querySelector(`[name="${name}"]`);
    const err = form.querySelector(`[data-error="${name}"]`);
    if (input) input.classList.toggle("is-invalid", Boolean(message));
    if (err) err.textContent = message || "";
  }

  function validate() {
    let ok = true;
    const fullName = form.fullName.value.trim();
    const phone = form.phone.value.trim();
    const address = form.address.value.trim();

    setError("fullName", "");
    setError("phone", "");
    setError("address", "");

    if (!fullName) {
      setError("fullName", "Бүтэн нэрээ оруулна уу.");
      ok = false;
    } else if (fullName.length < 2) {
      setError("fullName", "Нэр хэт богино байна.");
      ok = false;
    }

    const phoneDigits = phone.replace(/\D/g, "");
    if (!phone) {
      setError("phone", "Утасны дугаар оруулна уу.");
      ok = false;
    } else if (phoneDigits.length < 8) {
      setError("phone", "Утасны дугаар буруу байна.");
      ok = false;
    }

    if (!address) {
      setError("address", "Гэрийн хаягаа оруулна уу.");
      ok = false;
    } else if (address.length < 5) {
      setError("address", "Хаягийг илүү дэлгэрэнгүй бичнэ үү.");
      ok = false;
    }

    if (!Cart.get().length) {
      showToast("Сагс хоосон байна");
      ok = false;
    }

    return ok;
  }

  function setSubmitting(state) {
    submitting = state;
    if (!submitBtn) return;
    submitBtn.disabled = state || submitted;
    submitBtn.textContent = state
      ? "Илгээж байна..."
      : submitted
        ? "Илгээгдсэн"
        : "Захиалга илгээх";
  }

  function buildOrderDocument(customer, cartItems) {
    const products = cartItems.map((item) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const price = Number(item.price) || 0;
      return {
        productId: String(item.id),
        name: String(item.name || ""),
        image: String(item.image || ""),
        quantity,
        price,
        total: price * quantity
      };
    });

    const totalItems = products.reduce((sum, p) => sum + p.quantity, 0);
    const totalAmount = products.reduce((sum, p) => sum + p.total, 0);

    return {
      customerName: customer.fullName,
      phone: customer.phone,
      address: customer.address,
      notes: customer.notes || "",
      products,
      totalItems,
      totalAmount,
      shipping: Cart.shipping(),
      grandTotal: Cart.total(),
      status: "pending",
      createdAt: FirebaseOrders.serverTimestamp(),
      createdAtIso: new Date().toISOString()
    };
  }

  function firebaseErrorMessage(err) {
    const code = err && (err.code || err.name);
    if (code === "permission-denied") {
      return "Firestore дүрэм зөвшөөрөхгүй байна. Админтай холбогдоно уу.";
    }
    if (code === "unavailable") {
      return "Firebase холболт алдаатай. Интернэтээ шалгаад дахин оролдоно уу.";
    }
    return (err && err.message) || "Захиалга хадгалахад алдаа гарлаа.";
  }

  async function sendOrderEmailNotification(order, orderId) {
    let res;
    try {
      res = await fetch("/api/order-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          customerName: order.customerName,
          phone: order.phone,
          address: order.address,
          notes: order.notes,
          products: order.products,
          totalItems: order.totalItems,
          totalAmount: order.totalAmount,
          shipping: order.shipping,
          orderedAt: order.createdAtIso
        })
      });
    } catch (netErr) {
      throw new Error(
        "Сервертэй холбогдож чадсангүй. Сайт нойрсож байж магадгүй — 30 сек хүлээгээд дахин оролдоно уу."
      );
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Имэйл илгээж чадсангүй.");
    }
    return data;
  }

  function showSuccess() {
    submitted = true;
    Cart.clear();
    Cart.updateBadge();
    content.hidden = true;
    success.classList.add("is-visible");
    const title = success.querySelector("h2");
    if (title) title.textContent = "Таны захиалга амжилттай илгээгдлээ.";
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => {
      location.href = "/index.html";
    }, 1800);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitting || submitted) return;
    if (!validate()) return;

    const cartItems = Cart.get();
    if (!cartItems.length) {
      showToast("Сагс хоосон байна");
      return;
    }

    setSubmitting(true);

    const customer = {
      fullName: form.fullName.value.trim(),
      phone: form.phone.value.trim(),
      address: form.address.value.trim(),
      notes: form.notes.value.trim()
    };

    const orderDoc = buildOrderDocument(customer, cartItems);
    let savedOrderId = null;

    try {
      // Email first (required). Firestore save in background — don't block UX.
      const emailPromise = sendOrderEmailNotification(orderDoc, null);

      if (window.FirebaseOrders) {
        FirebaseOrders.saveOrderToFirestore(orderDoc)
          .then((saved) => {
            savedOrderId = saved.id;
          })
          .catch((fbErr) => {
            console.warn("Firestore save failed:", fbErr);
          });
      }

      const emailResult = await emailPromise;
      console.log("Order email sent to:", emailResult.emailTo);
      showSuccess();
    } catch (err) {
      if (savedOrderId && window.FirebaseOrders) {
        try {
          await FirebaseOrders.deleteOrderFromFirestore(savedOrderId);
        } catch {
          /* rollback best-effort */
        }
      }
      showToast(err.message || firebaseErrorMessage(err));
      setSubmitting(false);
    }
  });

  ["fullName", "phone", "address"].forEach((name) => {
    form[name].addEventListener("input", () => setError(name, ""));
  });

  renderSummary();
  window.addEventListener("cartUpdated", renderSummary);
});
