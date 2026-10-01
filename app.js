import {
  buildFinalReceipt,
  parseReceiptResponse,
  totalCheckMessage,
  totalDifference,
  validateReceipt
} from "./receipt-core.js";

const STORAGE_KEY = "receiptPwaDraftV1";
const SAVED_IDS_KEY = "receiptPwaSavedIdsV1";
const MODE_KEY = "receiptPwaEntryModeV1";
const OCR_SHORTCUT_NAME = "伝票OCRテスト";
const SAVE_SHORTCUT_NAME = "伝票JSON保存テスト";
const ENTRY_MODES = {
  convenience: {
    label: "コンビニ",
    account: "出張経費",
    counterparty: "コンビニ"
  },
  lodging: {
    label: "宿泊",
    account: "出張経費",
    counterparty: "宿泊"
  }
};
let serviceWorkerRegistrationPromise = null;

const $ = (id) => document.getElementById(id);
const form = $("receiptForm");
const taxLinesElement = $("taxLines");
let unreadableFields = [];
let receiptId = "";
let currentMode = "";

function newReceiptId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function entryMode() {
  return ENTRY_MODES[currentMode] || null;
}

function callbackUrl(flow, status) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("flow", flow);
  url.searchParams.set("callback", status);
  return url.toString();
}

function runShortcut(name, flow, inputText) {
  const url = new URL("shortcuts://x-callback-url/run-shortcut");
  url.searchParams.set("name", name);
  if (typeof inputText === "string") {
    url.searchParams.set("input", "text");
    url.searchParams.set("text", inputText);
  }
  url.searchParams.set("x-success", callbackUrl(flow, "success"));
  url.searchParams.set("x-cancel", callbackUrl(flow, "cancel"));
  url.searchParams.set("x-error", callbackUrl(flow, "error"));
  window.location.href = url.toString();
}

async function ensureOfflineControl() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return true;
  try {
    await serviceWorkerRegistrationPromise;
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      setReadStatus("PWAの初期設定を完了するため、画面を再読み込みします。");
      window.location.reload();
      return false;
    }
    return true;
  } catch (error) {
    setReadStatus("PWA登録を確認してください。", error.message);
    return false;
  }
}

function setReadStatus(message, error = "") {
  $("shortcutStatus").textContent = message;
  $("readError").textContent = error;
  $("readError").hidden = !error;
}

function addTaxLine(line = {}) {
  const fragment = $("taxLineTemplate").content.cloneNode(true);
  const element = fragment.querySelector(".tax-line");
  element.querySelector(".line-description").value = line.description ?? "";
  element.querySelector(".line-amount").value = line.amount_gross ?? "";
  element.querySelector(".line-rate").value = line.tax_rate ?? "10%";
  element.querySelector(".remove-line").addEventListener("click", () => {
    element.remove();
    renumberLines();
    updateFormState();
  });
  element.querySelectorAll("input, select").forEach((control) => {
    control.addEventListener("input", updateFormState);
    control.addEventListener("change", updateFormState);
  });
  taxLinesElement.append(element);
  renumberLines();
}

function renumberLines() {
  [...taxLinesElement.children].forEach((line, index) => {
    line.querySelector("h3").textContent = `明細 ${index + 1}`;
  });
}

function readForm() {
  const mode = entryMode();
  return {
    receipt_id: receiptId,
    entry_mode: currentMode,
    transaction_date: $("transactionDate").value,
    issuer: $("issuer").value,
    facility: $("facility").value,
    memo: $("memo").value,
    account: mode?.account ?? "",
    payment_method: "普通預金（三井住友銀行）",
    counterparty: mode?.counterparty ?? "",
    total_gross: $("totalGross").value,
    tax_lines: [...taxLinesElement.querySelectorAll(".tax-line")].map((line) => ({
      description: line.querySelector(".line-description").value,
      amount_gross: line.querySelector(".line-amount").value,
      tax_rate: line.querySelector(".line-rate").value
    })),
    unreadable_fields: [...unreadableFields]
  };
}

function writeForm(receipt) {
  currentMode = receipt.entry_mode || localStorage.getItem(MODE_KEY) || "";
  const mode = entryMode();
  if (!mode) throw new Error("利用場面を選択してください。");
  localStorage.setItem(MODE_KEY, currentMode);
  receiptId = receipt.receipt_id || newReceiptId();
  $("transactionDate").value = receipt.transaction_date ?? "";
  $("issuer").value = receipt.issuer ?? "";
  $("facility").value = receipt.facility ?? "";
  $("memo").value = receipt.memo ?? "";
  $("totalGross").value = receipt.total_gross ?? "";
  unreadableFields = [...(receipt.unreadable_fields || [])];
  taxLinesElement.replaceChildren();
  (receipt.tax_lines || []).forEach(addTaxLine);
  renderUnreadableFields();
  $("selectedModeBadge").textContent = mode.label;
  $("modeSelection").hidden = true;
  form.hidden = false;
  updateFormState();
}

function renderUnreadableFields() {
  const list = $("unreadableFields");
  list.replaceChildren();
  unreadableFields.forEach((field, index) => {
    const item = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = field;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "確認済み";
    button.addEventListener("click", () => {
      unreadableFields.splice(index, 1);
      renderUnreadableFields();
      updateFormState();
    });
    item.append(text, button);
    list.append(item);
  });
  $("unreadableSection").hidden = unreadableFields.length === 0;
}

function updateFormState() {
  if (form.hidden) return;
  const receipt = readForm();
  const errors = validateReceipt(receipt);
  const totalCheck = $("totalCheck");
  const amountsReady = receipt.total_gross !== ""
    && receipt.tax_lines.length > 0
    && receipt.tax_lines.every((line) => line.amount_gross !== "");
  if (amountsReady) {
    totalCheck.textContent = totalCheckMessage(receipt);
    totalCheck.className = `total-check ${totalDifference(receipt) === 0 ? "ok" : "error"}`;
  } else {
    totalCheck.textContent = "合計金額と明細金額を入力すると差額を確認できます。";
    totalCheck.className = "total-check";
  }

  const summary = $("validationSummary");
  if (errors.length === 0) {
    summary.textContent = "保存に必要な確認が完了しています。";
    summary.className = "validation-summary ready";
  } else {
    summary.replaceChildren();
    const intro = document.createElement("span");
    intro.textContent = "保存前に確認してください。";
    const list = document.createElement("ul");
    errors.forEach((error) => {
      const item = document.createElement("li");
      item.textContent = error;
      list.append(item);
    });
    summary.append(intro, list);
    summary.className = "validation-summary";
  }
  $("saveButton").disabled = errors.length > 0 || savedIds().includes(receiptId);
  persistDraft(receipt);
}

function persistDraft(receipt) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(receipt));
}

function loadDraft() {
  const value = localStorage.getItem(STORAGE_KEY);
  if (!value) return false;
  try {
    writeForm(JSON.parse(value));
    setReadStatus("保存前の入力内容を復元しました。");
    return true;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
}

function savedIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(SAVED_IDS_KEY) || "[]");
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

function markSaved(id) {
  const ids = [...new Set([...savedIds(), id])].slice(-500);
  localStorage.setItem(SAVED_IDS_KEY, JSON.stringify(ids));
}

function resetEntry(status = "利用場面を選択してください。") {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(MODE_KEY);
  receiptId = "";
  currentMode = "";
  unreadableFields = [];
  taxLinesElement.replaceChildren();
  form.reset();
  form.hidden = true;
  $("modeSelection").hidden = false;
  setReadStatus(status);
}

function receiveCallback() {
  const params = new URLSearchParams(window.location.search);
  const flow = params.get("flow");
  const callback = params.get("callback");
  const result = params.get("result");
  const errorMessage = params.get("errorMessage") || params.get("error-message") || "";
  if (!callback) return false;

  try {
    if (flow === "read" && callback === "success") {
      if (result === null) throw new Error("読み取り結果が返されませんでした。");
      const mode = localStorage.getItem(MODE_KEY) || "";
      writeForm({ ...parseReceiptResponse(result), entry_mode: mode });
      setReadStatus("領収書の読み取り結果を受信しました。内容を確認してください。");
    } else if (flow === "read" && callback === "cancel") {
      resetEntry("撮影をキャンセルしました。利用場面を選び直せます。");
    } else if (flow === "read" && callback === "error") {
      resetEntry("読み取りを再実行できます。");
      setReadStatus("読み取りを再実行できます。", errorMessage || "ショートカットでエラーが発生しました。");
    } else if (flow === "save" && callback === "success") {
      const draft = localStorage.getItem(STORAGE_KEY);
      const savedReceipt = draft ? JSON.parse(draft) : null;
      if (savedReceipt?.receipt_id) markSaved(savedReceipt.receipt_id);
      resetEntry("iCloud Driveへ保存しました。次の利用場面を選択できます。");
    } else if (flow === "save" && callback === "cancel") {
      loadDraft();
      setReadStatus("保存をキャンセルしました。入力内容を保持しています。");
    } else if (flow === "save" && callback === "error") {
      loadDraft();
      setReadStatus("iCloud Driveへの保存を確認してください。", errorMessage || "保存ショートカットからエラーが返されました。入力内容を保持しています。");
    }
  } catch (error) {
    loadDraft();
    setReadStatus("受信内容を確認してください。", `JSON解析エラー: ${error.message}`);
  } finally {
    history.replaceState(null, "", window.location.pathname);
  }
  return true;
}

$("connectionBadge").textContent = window.isSecureContext ? "PWA接続" : "HTTP試験環境";

document.querySelectorAll("[data-entry-mode]").forEach((button) => {
  button.addEventListener("click", async () => {
    const mode = button.dataset.entryMode;
    const configuration = ENTRY_MODES[mode];
    if (!configuration || !(await ensureOfflineControl())) return;
    currentMode = mode;
    receiptId = newReceiptId();
    localStorage.setItem(MODE_KEY, mode);
    localStorage.removeItem(STORAGE_KEY);
    setReadStatus(`${configuration.label}の読み取りショートカットを起動しています。`);
    runShortcut(OCR_SHORTCUT_NAME, "read");
  });
});

$("addLine").addEventListener("click", () => {
  addTaxLine();
  updateFormState();
});

form.addEventListener("input", updateFormState);
form.addEventListener("change", updateFormState);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!(await ensureOfflineControl())) return;
  const receipt = readForm();
  const errors = validateReceipt(receipt);
  if (errors.length > 0 || savedIds().includes(receiptId)) {
    updateFormState();
    return;
  }
  const finalReceipt = buildFinalReceipt(receipt);
  persistDraft(finalReceipt);
  setReadStatus("保存ショートカットを起動しています。");
  runShortcut(SAVE_SHORTCUT_NAME, "save", JSON.stringify(finalReceipt));
});

$("clearButton").addEventListener("click", () => resetEntry());

if (!receiveCallback()) loadDraft();

if ("serviceWorker" in navigator && window.isSecureContext) {
  serviceWorkerRegistrationPromise = navigator.serviceWorker.register("./sw.js").catch((error) => {
    setReadStatus("PWA登録を確認してください。", error.message);
    throw error;
  });
}
