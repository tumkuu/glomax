const nodemailer = require("nodemailer");

const ORDER_EMAIL_FROM =
  process.env.SMTP_USER || "tumkuu1223@gmail.com";
const ORDER_EMAIL_TO =
  process.env.ORDER_EMAIL_TO || "kh.tuguldur99@gmail.com";

function formatMoney(amount) {
  return new Intl.NumberFormat("mn-MN").format(Number(amount) || 0) + " MNT";
}

function formatDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone: "Asia/Ulaanbaatar"
  }).format(date);
}

function buildOrderEmail({ customer, products, orderedAt }) {
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

  lines.push("Customer Information:");
  lines.push("");
  lines.push("Name:");
  lines.push(customer.customerName || customer.fullName || "");
  lines.push("");
  lines.push("Phone:");
  lines.push(customer.phone || "");
  lines.push("");
  lines.push("Address:");
  lines.push(customer.address || "");
  lines.push("");
  lines.push("Notes:");
  lines.push(customer.notes || "(none)");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("Ordered Products:");
  lines.push("");

  list.forEach((item, index) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    const total = Number(item.total) || price * qty;
    lines.push(`Product ${index + 1}:`);
    lines.push("Name:");
    lines.push(item.name || "");
    lines.push("Quantity:");
    lines.push(String(qty));
    lines.push("Price:");
    lines.push(formatMoney(price));
    lines.push("Total:");
    lines.push(formatMoney(total));
    lines.push("");
  });

  lines.push("---");
  lines.push("");
  lines.push("Order Summary:");
  lines.push("");
  lines.push("Total different products:");
  lines.push(String(differentProducts));
  lines.push("");
  lines.push("Total quantity:");
  lines.push(String(totalQuantity));
  lines.push("");
  lines.push("Grand Total:");
  lines.push(formatMoney(grandTotal));
  lines.push("");
  lines.push("Order date:");
  lines.push(formatDateTime(orderedAt));
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("Please contact the customer as soon as possible.");

  return {
    subject: "New Order Received - Online Shop",
    text: lines.join("\n"),
    totals: { differentProducts, totalQuantity, grandTotal }
  };
}

function createTransporter() {
  const user = (process.env.SMTP_USER || ORDER_EMAIL_FROM).trim();
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
    orderedAt
  });

  const from =
    process.env.SMTP_FROM ||
    `"GloMax Orders" <${process.env.SMTP_USER || ORDER_EMAIL_FROM}>`;

  await transporter.sendMail({
    from,
    to: ORDER_EMAIL_TO,
    subject,
    text
  });

  return { to: ORDER_EMAIL_TO, from, subject, totals, orderedAt };
}

function assertSmtpReady() {
  const user = (process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").replace(/\s+/g, "");
  if (!user || !pass) {
    console.warn(
      "[mail] SMTP not configured. Set SMTP_USER and SMTP_PASS in .env " +
        "(Gmail App Password for tumkuu1223@gmail.com)."
    );
    return false;
  }
  console.log(
    `[mail] Order emails: ${user} → ${ORDER_EMAIL_TO}`
  );
  return true;
}

module.exports = {
  sendOrderEmail,
  buildOrderEmail,
  assertSmtpReady,
  ORDER_EMAIL_TO,
  ORDER_EMAIL_FROM
};
