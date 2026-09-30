import {
  buildFinalReceipt,
  parseReceiptResponse,
  recommendClassification,
  totalCheckMessage,
  totalDifference,
  validateReceipt
} from "./receipt-core.js";
import {
  ACCOUNT_OPTIONS,
  COUNTERPARTY_OPTIONS,
  RECOMMENDATION_RULES
} from "./recommendations.js";

const STORAGE_KEY = "receiptPwaDraftV1";
const SAVED_IDS_KEY = "receiptPwaSavedIdsV1";
const OCR_SHORTCUT_NAME = "伝票OCRテスト";
const SAVE_SHORTCUT_NAME = "伝票JSON保存テスト";
let serviceWorkerRegistrationPromise = null;

const $ = (id) => document.getElementById(id);
const form = $("receiptForm");
const taxLinesElement = $("taxLines");
let unreadableFields = [];
let receiptId = "";
let currentSuggestion = null;

function newReceiptId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function populateSelect(select, options, placeholder) {
  select.replaceChildren();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = placeholder;
  select.append(empty);
  options.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
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
  return {
    receipt_id: receiptId,
    transaction_date: $("transactionDate").value,
    issuer: $("issuer").value,
    facility: $("facility").value,
    account: $("account").value,
    payment_method: "普通預金（三井住友銀行）",
    counterparty: $("counterparty").value,
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
  receiptId = receipt.receipt_id || newReceiptId();
  $("transactionDate").value = receipt.transaction_date ?? "";
  $("issuer").value = receipt.issuer ?? "";
  $("facility").value = receipt.facility ?? "";
  $("account").value = receipt.account ?? "";
  $("counterparty").value = receipt.counterparty ?? "";
  $("totalGross").value = receipt.total_gross ?? "";
  unreadableFields = [...(receipt.unreadable_fields || [])];
  taxLinesElement.replaceChildren();
  (receipt.tax_lines || []).forEach(addTaxLine);
  renderUnreadableFields();
  form.hidden = false;
  $("saveResult").hidden = true;
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

function updateSuggestion(receipt) {
  currentSuggestion = recommendClassification(receipt, RECOMMENDATION_RULES);
  const accountButton = $("applyAccountSuggestion");
  const counterpartyButton = $("applyCounterpartySuggestion");
  const evidence = $("recommendationEvidence");
  if (!currentSuggestion) {
    accountButton.hidden = true;
    counterpartyButton.hidden = true;
    evidence.hidden = true;
    return;
  }
  accountButton.textContent = `候補「${currentSuggestion.account}」を選択`;
  counterpartyButton.textContent = `候補「${currentSuggestion.counterparty}」を選択`;
  accountButton.hidden = $("account").value === currentSuggestion.account;
  counterpartyButton.hidden = $("counterparty").value === currentSuggestion.counterparty;
  evidence.textContent = currentSuggestion.evidence;
  evidence.hidden = false;
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
  updateSuggestion(receipt);
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

function resetEntry() {
  localStorage.removeItem(STORAGE_KEY);
  receiptId = "";
  unreadableFields = [];
  taxLinesElement.replaceChildren();
  form.reset();
  form.hidden = true;
  $("saveResult").hidden = true;
  setReadStatus("撮影を開始できます。");
}

function showSaveResult(kind, heading, detail) {
  form.hidden = kind === "success";
  $("saveResult").hidden = false;
  $("saveResultHeading").textContent = heading;
  $("saveResultDetail").textContent = detail;
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
      writeForm(parseReceiptResponse(result));
      setReadStatus("領収書の読み取り結果を受信しました。内容を確認してください。");
    } else if (flow === "read" && callback === "cancel") {
      loadDraft();
      setReadStatus("撮影をキャンセルしました。入力内容は保持されています。");
    } else if (flow === "read" && callback === "error") {
      loadDraft();
      setReadStatus("読み取りを再実行できます。", errorMessage || "ショートカットでエラーが発生しました。");
    } else if (flow === "save" && callback === "success") {
      const draft = localStorage.getItem(STORAGE_KEY);
      const savedReceipt = draft ? JSON.parse(draft) : null;
      if (savedReceipt?.receipt_id) markSaved(savedReceipt.receipt_id);
      localStorage.removeItem(STORAGE_KEY);
      showSaveResult("success", "iCloud Driveへ保存しました", result || "保存ショートカットから成功結果を受信しました。");
    } else if (flow === "save" && callback === "cancel") {
      loadDraft();
      showSaveResult("cancel", "保存をキャンセルしました", "入力内容を保持しています。");
    } else if (flow === "save" && callback === "error") {
      loadDraft();
      showSaveResult("error", "iCloud Driveへの保存を確認してください", errorMessage || "保存ショートカットからエラーが返されました。入力内容を保持しています。");
    }
  } catch (error) {
    loadDraft();
    setReadStatus("受信内容を確認してください。", `JSON解析エラー: ${error.message}`);
  } finally {
    history.replaceState(null, "", window.location.pathname);
  }
  return true;
}

populateSelect($("account"), ACCOUNT_OPTIONS, "候補から選択してください");
populateSelect($("counterparty"), COUNTERPARTY_OPTIONS, "候補から選択してください");

$("connectionBadge").textContent = window.isSecureContext ? "PWA接続" : "HTTP試験環境";

$("captureButton").addEventListener("click", async () => {
  if (!(await ensureOfflineControl())) return;
  if (!form.hidden) persistDraft(readForm());
  setReadStatus("読み取りショートカットを起動しています。");
  runShortcut(OCR_SHORTCUT_NAME, "read");
});

$("addLine").addEventListener("click", () => {
  addTaxLine();
  updateFormState();
});

$("applyAccountSuggestion").addEventListener("click", () => {
  if (!currentSuggestion) return;
  $("account").value = currentSuggestion.account;
  updateFormState();
});

$("applyCounterpartySuggestion").addEventListener("click", () => {
  if (!currentSuggestion) return;
  $("counterparty").value = currentSuggestion.counterparty;
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

$("clearButton").addEventListener("click", resetEntry);
$("newReceiptButton").addEventListener("click", resetEntry);

if (!receiveCallback()) loadDraft();

if ("serviceWorker" in navigator && window.isSecureContext) {
  serviceWorkerRegistrationPromise = navigator.serviceWorker.register("./sw.js").catch((error) => {
    setReadStatus("PWA登録を確認してください。", error.message);
    throw error;
  });
}
