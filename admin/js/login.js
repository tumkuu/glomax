async function checkAuth() {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  const data = await res.json();
  if (data.authenticated) {
    location.href = "/admin/";
  }
}

checkAuth().catch(() => {});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const error = document.getElementById("login-error");
  error.classList.remove("is-visible");
  error.textContent = "";

  const username = e.target.username.value.trim();
  const password = e.target.password.value;

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      error.textContent = data.error || "Нэвтрэхэд алдаа гарлаа.";
      error.classList.add("is-visible");
      return;
    }
    location.href = "/admin/";
  } catch {
    error.textContent = "Сервертэй холбогдож чадсангүй.";
    error.classList.add("is-visible");
  }
});
