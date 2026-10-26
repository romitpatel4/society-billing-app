
"use strict";

// ============================================
// BILLSTUDIO - SOCIETY BILLING APPLICATION
// ============================================

const STORAGE_KEY = "billstudio_records_v1";
const ORG_KEY = "billstudio_organization_v1";

const $ = (id) => document.getElementById(id);

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2
  }).format(Number(amount) || 0);

const today = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
};

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

function loadRecords() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

let records = loadRecords();
let selectedReceiptId = null;
let toastTimer;

function saveRecords() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    showToast("Storage failed. Export your records and check browser storage.");
    return false;
  }
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function generateReceiptNumber() {
  const year = new Date().getFullYear();
  let number;

  do {
    const highest = records.reduce((max, record) => {
      const match = String(record.id).match(/^BS-(\d{4})-(\d+)$/);
      return match && Number(match[1]) === year
        ? Math.max(max, Number(match[2]))
        : max;
    }, 0);

    number = `BS-${year}-${String(highest + 1).padStart(4, "0")}`;
  } while (records.some((r) => r.id === number));

  return number;
}

function getStatus(record) {
  const amount = Number(record.amount);
  const paid = Number(record.paid);

  if (paid >= amount) return "Paid";
  if (paid > 0) return "Partial";
  return "Pending";
}

function getBalance(record) {
  return Math.max(0, Number(record.amount) - Number(record.paid));
}

// ============================================
// DASHBOARD
// ============================================

function renderDashboard() {
  const collected = records.reduce(
    (sum, record) => sum + Number(record.paid), 0
  );

  const pending = records.reduce(
    (sum, record) => sum + getBalance(record), 0
  );

  // A customer is identified by phone number + society.
  const customers = new Set(
    records.map((r) =>
      `${r.society.toLowerCase()}|${r.phone.replace(/\D/g, "")}`
    )
  );

  $("totalCollected").textContent = money(collected);
  $("totalPending").textContent = money(pending);
  $("totalReceipts").textContent = records.length;
  $("totalCustomers").textContent = customers.size;
}

// ============================================
// PAYMENT HISTORY
// ============================================

function statusHTML(record) {
  const status = getStatus(record);

  const className = {
    Paid: "status-paid",
    Partial: "status-partial",
    Pending: "status-pending"
  }[status];

  return `<span class="status ${className}">${status}</span>`;
}

function renderHistory() {
  const search = $("searchInput").value.trim().toLowerCase();
  const filter = $("statusFilter").value;

  const filtered = [...records]
    .sort((a, b) =>
      b.date.localeCompare(a.date) || b.createdAt - a.createdAt
    )
    .filter((r) => {
      const text = [
        r.id, r.name, r.phone, r.society, r.address,
        r.purpose, r.reference, r.period
      ].join(" ").toLowerCase();

      return text.includes(search) &&
        (filter === "All" || getStatus(r) === filter);
    });

  $("recordCount").textContent =
    `Showing ${filtered.length} of ${records.length} receipts`;

  if (!filtered.length) {
    $("historyBody").innerHTML = `
      <tr><td colspan="7" style="text-align:center;padding:35px">
        No matching records found.
      </td></tr>`;
    return;
  }

  $("historyBody").innerHTML = filtered.map((r) => `
    <tr data-receipt="${escapeHTML(r.id)}" tabindex="0"
        aria-label="Open receipt ${escapeHTML(r.id)}">
      <td>
        <span class="record-primary">${escapeHTML(r.id)}</span>
        <span class="record-secondary">${escapeHTML(r.date)}</span>
      </td>
      <td>
        <span class="record-primary">${escapeHTML(r.name)}</span>
        <span class="record-secondary">${escapeHTML(r.phone)}</span>
      </td>
      <td>${escapeHTML(r.purpose)}</td>
      <td>${money(r.amount)}</td>
      <td>${money(r.paid)}</td>
      <td>${money(getBalance(r))}</td>
      <td>${statusHTML(r)}</td>
    </tr>
  `).join("");
}

function renderCustomerHistory(phone, society) {
  const customerRecords = records
    .filter((r) =>
      r.phone.replace(/\D/g, "") === phone.replace(/\D/g, "") &&
      r.society.toLowerCase() === society.toLowerCase()
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!customerRecords.length) return;

  const customer = customerRecords[0];

  $("customerHistoryTitle").textContent = customer.name;
  $("customerHistoryInfo").textContent =
    `${customer.phone} · ${customer.society}`;

  $("customerBilled").textContent = money(
    customerRecords.reduce((sum, r) => sum + Number(r.amount), 0)
  );

  $("customerPaid").textContent = money(
    customerRecords.reduce((sum, r) => sum + Number(r.paid), 0)
  );

  $("customerBalance").textContent = money(
    customerRecords.reduce((sum, r) => sum + getBalance(r), 0)
  );

  $("customerHistoryBody").innerHTML = customerRecords.map((r) => `
    <tr data-receipt="${escapeHTML(r.id)}" tabindex="0">
      <td>
        <span class="record-primary">${escapeHTML(r.id)}</span>
        <span class="record-secondary">${escapeHTML(r.date)}</span>
      </td>
      <td>${escapeHTML(r.purpose)}</td>
      <td>${money(r.amount)}</td>
      <td>${money(r.paid)}</td>
      <td>${money(getBalance(r))}</td>
      <td>${statusHTML(r)}</td>
    </tr>
  `).join("");

  $("customerHistory").classList.remove("hidden");
}

// ============================================
// RECEIPT PREVIEW
// ============================================

function renderReceipt(record) {
  if (!record) return;

  selectedReceiptId = record.id;

  $("receiptPreview").innerHTML = `
    <div class="receipt-header">
      <div>
        <h2>${escapeHTML(record.society)}</h2>
        <p>${escapeHTML(record.address || "Address not provided")}</p>
        <p>Contact: ${escapeHTML(record.phone)}</p>
      </div>
      <div class="receipt-tag">PAYMENT RECEIPT</div>
    </div>

    <div class="receipt-details">
      <div>
        <small>RECEIPT NUMBER</small>
        <strong>${escapeHTML(record.id)}</strong>
      </div>
      <div>
        <small>DATE</small>
        <strong>${escapeHTML(record.date)}</strong>
      </div>
      <div>
        <small>RECEIVED FROM</small>
        <strong>${escapeHTML(record.name)}</strong>
      </div>
      <div>
        <small>CUSTOMER CONTACT</small>
        <strong>${escapeHTML(record.phone)}</strong>
      </div>
      <div>
        <small>PAYMENT FOR</small>
        <strong>${escapeHTML(record.purpose)}</strong>
      </div>
      <div>
        <small>PAYMENT METHOD</small>
        <strong>${escapeHTML(record.method)}</strong>
      </div>
      <div>
        <small>FINANCIAL PERIOD</small>
        <strong>${escapeHTML(record.period || "Not specified")}</strong>
      </div>
      <div>
        <small>TRANSACTION REFERENCE</small>
        <strong>${escapeHTML(record.reference || "Not provided")}</strong>
      </div>
    </div>

    <div class="receipt-total">
      <div><span>Total bill amount</span><strong>${money(record.amount)}</strong></div>
      <div><span>Amount received</span><strong>${money(record.paid)}</strong></div>
      <div class="grand-total">
        <span>Balance due</span><span>${money(getBalance(record))}</span>
      </div>
      <div><span>Payment status</span><strong>${getStatus(record)}</strong></div>
    </div>

    ${record.notes ? `
      <div class="receipt-notes">
        <strong>Notes:</strong> ${escapeHTML(record.notes)}
      </div>` : ""}

    <p class="receipt-thanks">
      Thank you for your contribution!
    </p>
    <p class="muted small" style="text-align:center;margin-top:12px">
      Computer-generated receipt · ${escapeHTML(record.id)}
    </p>
  `;
}

function openReceipt(id) {
  const record = records.find((r) => r.id === id);
  if (!record) {
    showToast("Receipt not found.");
    return;
  }

  renderReceipt(record);

  renderCustomerHistory(record.phone, record.society);

  $("receipt").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ============================================
// CREATE AND SAVE BILL
// ============================================

$("billForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const amount = Number($("amount").value);
  const paid = Number($("paid").value);
  const phone = $("phone").value.trim();
  const date = $("date").value;

  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("Enter a valid bill amount.");
    return;
  }

  if (!Number.isFinite(paid) || paid < 0 || paid > amount) {
    showToast("Paid amount must be between ₹0 and the bill amount.");
    return;
  }

  if (!/^[+\d\s()-]{7,20}$/.test(phone)) {
    showToast("Please enter a valid contact number.");
    return;
  }

  if (!date || date > today()) {
    showToast("Enter a valid receipt date, not a future date.");
    return;
  }

  const record = {
    id: generateReceiptNumber(),
    name: $("customerName").value.trim(),
    phone,
    society: $("society").value.trim(),
    address: $("address").value.trim(),
    date,
    purpose: $("purpose").value,
    method: $("method").value,
    amount: Number(amount.toFixed(2)),
    paid: Number(paid.toFixed(2)),
    reference: $("reference").value.trim(),
    period: $("period").value.trim(),
    notes: $("notes").value.trim(),
    createdAt: Date.now()
  };

  if (!record.name || !record.society) {
    showToast("Enter the customer and organization names.");
    return;
  }

  records.push(record);

  if (!saveRecords()) {
    records.pop();
    return;
  }

  renderDashboard();
  renderHistory();
  renderReceipt(record);

  // Keep the same customer and society ready for another bill.
  $("billForm").reset();
  $("date").value = today();
  $("receiptNo").value = generateReceiptNumber();

  $("receipt").scrollIntoView({ behavior: "smooth" });
  showToast(`Receipt ${record.id} saved successfully!`);
});

// ============================================
// SEARCH AND CLICK HISTORY
// ============================================

$("searchInput").addEventListener("input", renderHistory);
$("statusFilter").addEventListener("change", renderHistory);

function handleReceiptRow(event) {
  const row = event.target.closest("tr[data-receipt]");
  if (row) openReceipt(row.dataset.receipt);
}

$("historyBody").addEventListener("click", handleReceiptRow);
$("customerHistoryBody").addEventListener("click", handleReceiptRow);

function handleRowKeyboard(event) {
  if (event.key === "Enter" || event.key === " ") {
    const row = event.target.closest("tr[data-receipt]");
    if (row) {
      event.preventDefault();
      openReceipt(row.dataset.receipt);
    }
  }
}

$("historyBody").addEventListener("keydown", handleRowKeyboard);
$("customerHistoryBody").addEventListener("keydown", handleRowKeyboard);

$("closeCustomerHistory").addEventListener("click", () => {
  $("customerHistory").classList.add("hidden");
});

// ============================================
// PRINT OR SAVE RECEIPT AS PDF
// ============================================

$("printBtn").addEventListener("click", () => {
  if (!selectedReceiptId) {
    showToast("Select or create a receipt first.");
    return;
  }

  window.print();
});

// ============================================
// WHATSAPP RECEIPT MESSAGE
// ============================================

$("whatsappBtn").addEventListener("click", () => {
  const record = records.find((r) => r.id === selectedReceiptId);

  if (!record) {
    showToast("Select a receipt first.");
    return;
  }

  // WhatsApp numbers require country code, without + or spaces.
  let phone = record.phone.replace(/\D/g, "");

  if (phone.length === 10) phone = "91" + phone;

  if (phone.length < 10 || phone.length > 15) {
    showToast("Check the customer's WhatsApp number.");
    return;
  }

  const message = [
    `Hello ${record.name},`,
    "",
    `Here is your payment receipt from ${record.society}.`,
    `Receipt No: ${record.id}`,
    `Date: ${record.date}`,
    `Purpose: ${record.purpose}`,
    `Total Amount: ${money(record.amount)}`,
    `Amount Paid: ${money(record.paid)}`,
    `Balance Due: ${money(getBalance(record))}`,
    `Status: ${getStatus(record)}`,
    "",
    "Thank you!"
  ].join("\n");

  const url =
    `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  window.open(url, "_blank", "noopener,noreferrer");

  showToast("WhatsApp opened. Review and send the message.");
});

// ============================================
// EXPORT BILLING DATA TO CSV
// ============================================

$("exportBtn").addEventListener("click", () => {
  if (!records.length) {
    showToast("No records available to export.");
    return;
  }

  const headers = [
    "Receipt Number", "Date", "Customer Name", "Phone",
    "Society", "Address", "Purpose", "Payment Method",
    "Total Amount", "Amount Paid", "Balance", "Status",
    "Reference", "Financial Period", "Notes"
  ];

  // Prevent spreadsheet formula injection in text fields.
  function csvCell(value) {
    let text = String(value ?? "");

    if (/^[\s]*[=+\-@]/.test(text)) {
      text = "'" + text;
    }

    return `"${text.replace(/"/g, '""')}"`;
  }

  const rows = records.map((r) => [
    r.id, r.date, r.name, r.phone, r.society, r.address,
    r.purpose, r.method, r.amount, r.paid, getBalance(r),
    getStatus(r), r.reference, r.period, r.notes
  ]);

  const csv = "\uFEFF" + [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(","))
  ].join("\r\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `billstudio-${today()}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast("Billing data exported successfully.");
});

// ============================================
// NAVIGATION AND INITIALIZATION
// ============================================

$("newBillBtn").addEventListener("click", () => {
  $("billing").scrollIntoView({ behavior: "smooth" });
  $("customerName").focus();
});

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach((item) =>
      item.classList.remove("active")
    );

    link.classList.add("active");
  });
});

$("billForm").addEventListener("reset", () => {
  setTimeout(() => {
    $("date").value = today();
    $("receiptNo").value = generateReceiptNumber();
  }, 0);
});

$("date").value = today();
$("receiptNo").value = generateReceiptNumber();
$("year").textContent = new Date().getFullYear();

renderDashboard();
renderHistory();
