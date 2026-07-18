const nodemailer = require("nodemailer");
const dns = require("dns");

// Prefer IPv4 everywhere in this process (Render has broken/no IPv6 egress)
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  /* older Node */
}

function getOrderEmailFrom() {
  return (process.env.SMTP_USER || "tumkuu1223@gmail.com").trim();
}

function getOrderEmailTo() {
  return (process.env.ORDER_EMAIL_TO || "glomex654@gmail.com").trim();
}

function getSmtpPass() {
  return String(process.env.SMTP_PASS || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, "");
}

function formatMoney(amount) {
  return new Intl.NumberFormat("mn-MN").format(Number(amount) || 0) + " MNT";
}

function formatDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("mn-MN", {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone: "Asia/Ulaanbaatar"
  }).format(date);
}

function buildOrderEmail({ customer, products, orderedAt, orderId }) {
  const lines = [];
  const list = Array.isArray(products) ? products : [];
  const differentProducts = list.length;
  const totalQuantity = list.reduce(
    (sum, p) => sum + (Number(p.quantity) || 0),
    0
  );
  const grandTotal = list.reduce(
    (sum, p) =>
      sum +
      (Number(p.total) ||
        (Number(p.price) || 0) * (Number(p.quantity) || 0)),
    0
  );

  const name = customer.customerName || customer.fullName || "";
  const phone = customer.phone || "";
  const address = customer.address || "";
  const notes = customer.notes || "";

  lines.push("ШИНЭ ЗАХИАЛГА — GloMax");
  lines.push("========================");
  if (orderId) {
    lines.push(`Захиалгын дугаар: ${orderId}`);
  }
  lines.push(`Огноо: ${formatDateTime(orderedAt)}`);
  lines.push("");
  lines.push("—— Захиалагчийн мэдээлэл ——");
  lines.push(`Нэр: ${name}`);
  lines.push(`Утас: ${phone}`);
  lines.push(`Хаяг: ${address}`);
  lines.push(`Тэмдэглэл: ${notes || "байхгүй"}`);
  lines.push("");
  lines.push("—— Захиалсан бараа ——");

  list.forEach((item, index) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    const total = Number(item.total) || price * qty;
    lines.push(`${index + 1}. ${item.name || "Бараа"}`);
    lines.push(`   Тоо: ${qty}`);
    lines.push(`   Үнэ: ${formatMoney(price)}`);
    lines.push(`   Дүн: ${formatMoney(total)}`);
  });

  lines.push("");
  lines.push("—— Нийт ——");
  lines.push(`Барааны төрөл: ${differentProducts}`);
  lines.push(`Нийт тоо ширхэг: ${totalQuantity}`);
  lines.push(`Нийт төлбөр: ${formatMoney(grandTotal)}`);
  lines.push("");
  lines.push("Харилцагчтай утсаар холбогдож баталгаажуулна уу.");

  return {
    subject: `Шинэ захиалга: ${name || "GloMax"} — ${formatMoney(grandTotal)}`,
    text: lines.join("\n"),
    totals: { differentProducts, totalQuantity, grandTotal }
  };
}

async function resolveIpv4(hostname) {
  const { address } = await dns.promises.lookup(hostname, { family: 4 });
  if (!address || address.includes(":")) {
    throw new Error(`IPv4 resolve failed for ${hostname}: ${address}`);
  }
  return address;
}

async function createTransporter() {
  const user = getOrderEmailFrom();
  const pass = getSmtpPass();
  const hostname = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const port = 465;

  if (!user || !pass) {
    const err = new Error(
      "SMTP тохиргоо дутуу. Render Environment дээр SMTP_USER болон SMTP_PASS оруулна уу."
    );
    err.code = "SMTP_CONFIG";
    throw err;
  }

  const ipv4 = await resolveIpv4(hostname);
  console.log(`[mail] SMTP connect ${hostname} → ${ipv4}:${port} (IPv4 only)`);

  return nodemailer.createTransport({
    host: ipv4,
    port,
    secure: true,
    auth: { user, pass },
    // Bind to IPv4 so Node does not open an IPv6 local socket
    localAddress: "0.0.0.0",
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
    tls: {
      rejectUnauthorized: true,
      servername: hostname
    }
  });
}

/** HTTPS email — works on Render when SMTP ports/IPv6 are broken. Free: https://resend.com */
async function sendViaResend({ from, to, subject, text }) {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) return null;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: from.includes("@") ? from : `GloMax <onboarding@resend.dev>`,
      to: [to],
      subject,
      text
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      data.message || data.error || `Resend failed (${res.status})`
    );
    err.code = "RESEND_ERROR";
    throw err;
  }

  console.log(`[mail] Sent via Resend → ${to}`);
  return data;
}

async function sendOrderEmail(orderPayload) {
  const orderedAt = orderPayload.orderedAt
    ? new Date(orderPayload.orderedAt)
    : new Date();

  const customer = {
    customerName:
      orderPayload.customerName ||
      (orderPayload.customer && orderPayload.customer.fullName) ||
      "",
    phone:
      orderPayload.phone ||
      (orderPayload.customer && orderPayload.customer.phone) ||
      "",
    address:
      orderPayload.address ||
      (orderPayload.customer && orderPayload.customer.address) ||
      "",
    notes:
      orderPayload.notes ||
      (orderPayload.customer && orderPayload.customer.notes) ||
      ""
  };

  const products =
    orderPayload.products ||
    (orderPayload.items || []).map((item) => ({
      productId: item.productId || item.id,
      name: item.name,
      image: item.image || "",
      quantity: item.quantity,
      price: item.price,
      total: item.total != null ? item.total : item.price * item.quantity
    }));

  if (!products.length) {
    const err = new Error("Захиалгын бараа хоосон байна.");
    err.code = "EMPTY_PRODUCTS";
    throw err;
  }

  const { subject, text, totals } = buildOrderEmail({
    customer,
    products,
    orderedAt,
    orderId: orderPayload.orderId || null
  });

  const to = getOrderEmailTo();
  const fromRaw =
    process.env.SMTP_FROM || `GloMax Orders <${getOrderEmailFrom()}>`;
  const from = String(fromRaw).trim().replace(/^["']|["']$/g, "");

  // Prefer Resend HTTPS if configured (avoids SMTP/IPv6 on Render)
  if (process.env.RESEND_API_KEY) {
    await sendViaResend({ from, to, subject, text });
    return { to, from, subject, totals, orderedAt, via: "resend" };
  }

  try {
    const transporter = await createTransporter();
    await transporter.sendMail({ from, to, subject, text });
  } catch (err) {
    console.error("[mail] sendMail error:", {
      code: err.code,
      responseCode: err.responseCode,
      message: err.message,
      response: err.response
    });
    throw err;
  }

  console.log(`[mail] Sent order email → ${to}`);
  return { to, from, subject, totals, orderedAt, via: "smtp" };
}

async function assertSmtpReady() {
  const to = getOrderEmailTo();

  if (process.env.RESEND_API_KEY) {
    console.log(`[mail] Using Resend HTTPS → ${to}`);
    return true;
  }

  const user = (process.env.SMTP_USER || "").trim();
  const pass = getSmtpPass();
  if (!user || !pass) {
    console.warn(
      "[mail] SMTP not configured. Set SMTP_USER/SMTP_PASS, or RESEND_API_KEY (recommended on Render)."
    );
    return false;
  }

  console.log(`[mail] Order emails: ${user} → ${to}`);
  try {
    const ipv4 = await resolveIpv4(
      (process.env.SMTP_HOST || "smtp.gmail.com").trim()
    );
    console.log(`[mail] Resolved smtp IPv4: ${ipv4}`);
    const transporter = await createTransporter();
    await transporter.verify();
    console.log("[mail] SMTP connection verified OK");
    return true;
  } catch (err) {
    console.error("[mail] SMTP verify FAILED:", err.message || err);
    console.error(
      "[mail] Tip: Render often blocks SMTP/IPv6. Add free RESEND_API_KEY from https://resend.com"
    );
    return false;
  }
}

module.exports = {
  sendOrderEmail,
  buildOrderEmail,
  assertSmtpReady,
  getOrderEmailTo,
  getOrderEmailFrom
};
