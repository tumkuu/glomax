document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(location.search);
  let state = {
    category: params.get("category") || "all",
    query: (params.get("q") || "").trim().toLowerCase(),
    sort: "default"
  };

  const grid = document.getElementById("products-grid");
  const countEl = document.getElementById("result-count");
  const filtersEl = document.getElementById("category-filters");
  const sortEl = document.getElementById("sort-select");
  const searchInput = document.getElementById("products-search-input");

  if (searchInput && state.query) {
    searchInput.value = params.get("q");
  }

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

  filtersEl.innerHTML = CATEGORIES.map(
    (c) =>
      `<button type="button" class="filter-btn${
        state.category === c.value ? " is-active" : ""
      }" data-category="${c.value}">${c.label}</button>`
  ).join("");

  function getFiltered() {
    let list = [...PRODUCTS];

    if (state.category !== "all") {
      list = list.filter((p) => p.category === state.category);
    }

    if (state.query) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(state.query) ||
          (p.shortDesc || "").toLowerCase().includes(state.query) ||
          (p.description || "").toLowerCase().includes(state.query) ||
          (p.category || "").toLowerCase().includes(state.query)
      );
    }

    switch (state.sort) {
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name, "mn"));
        break;
      default:
        break;
    }

    return list;
  }

  function render() {
    const list = getFiltered();
    countEl.textContent = `${list.length} бараа олдлоо`;

    if (!list.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>Бараа олдсонгүй</h3>
          <p>Хайлт эсвэл шүүлтийг өөрчилж үзнэ үү.</p>
          <a href="products.html" class="btn btn--primary" style="margin-top:1rem">Бүх бараа</a>
        </div>`;
      return;
    }

    grid.innerHTML = list.map(createProductCard).join("");
  }

  filtersEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-category]");
    if (!btn) return;
    state.category = btn.dataset.category;
    filtersEl.querySelectorAll(".filter-btn").forEach((b) =>
      b.classList.toggle("is-active", b === btn)
    );
    render();
  });

  sortEl.addEventListener("change", () => {
    state.sort = sortEl.value;
    render();
  });

  const searchForm = document.querySelector("[data-global-search]");
  if (searchForm) {
    searchForm.addEventListener(
      "submit",
      (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        state.query = searchForm.querySelector("input").value.trim().toLowerCase();
        const url = new URL(location.href);
        if (state.query) url.searchParams.set("q", state.query);
        else url.searchParams.delete("q");
        history.replaceState(null, "", url);
        render();
      },
      true
    );
  }

  render();
});
