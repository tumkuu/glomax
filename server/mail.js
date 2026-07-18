const nodemailer = require("nodemailer");

function getOrderEmailFrom() {
  return (process.env.SMTP_USER || "tumkuu1223@gmail.com").trim();
}

function getOrderEmailTo() {
  return (
    process.env.ORDER_EMAIL_TO ||
    "glomex654@gmail.com"
  ).trim();
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

function createTransporter() {
  const user = getOrderEmailFrom();
  const pass = String(process.env.SMTP_PASS || "").replace(/\s+/g, "");
  const host = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const port = Number(process.env.SMTP_PORT || 587);

  if (!user || !pass) {
    const err = new Error(
      "SMTP тохиргоо дутуу байна. .env файлд SMTP_USER болон SMTP_PASS (Gmail App Password) оруулна уу."
    );
    err.code = "SMTP_CONFIG";
    throw err;
  }

  // Prefer Gmail well-known service; fall back to explicit host/port
  if (!process.env.SMTP_HOST || host === "smtp.gmail.com") {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass }
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

async function sendOrderEmail(orderPayload) {
  const transporter = createTransporter();
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
    process.env.SMTP_FROM ||
    `"GloMax Orders" <${getOrderEmailFrom()}>`;
  // Render env UI sometimes stores quotes literally — strip outer quotes
  const from = String(fromRaw).trim().replace(/^["']|["']$/g, "");

  await transporter.sendMail({
    from,
    to,
    subject,
    text
  });

  console.log(`[mail] Sent order email → ${to}`);
  return { to, from, subject, totals, orderedAt };
}

function assertSmtpReady() {
  const user = (process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").replace(/\s+/g, "");
  const to = getOrderEmailTo();
  if (!user || !pass) {
    console.warn(
      "[mail] SMTP not configured. Set SMTP_USER and SMTP_PASS in Environment Variables."
    );
    return false;
  }
  console.log(`[mail] Order emails: ${user} → ${to}`);
  return true;
}

module.exports = {
  sendOrderEmail,
  buildOrderEmail,
  assertSmtpReady,
  getOrderEmailTo,
  getOrderEmailFrom
};
