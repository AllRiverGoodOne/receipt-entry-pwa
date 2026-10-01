const ALLOWED_TAX_RATES = new Set(["10%", "8%", "対象外"]);

export function stripJsonFence(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (match ? match[1] : text).trim();
}

export function parseReceiptResponse(value) {
  const parsed = JSON.parse(stripJsonFence(value));
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new TypeError("JSONの最上位はオブジェクトにしてください。");
  }
  return {
    transaction_date: typeof parsed.transaction_date === "string" ? parsed.transaction_date : "",
    issuer: typeof parsed.issuer === "string" ? parsed.issuer : "",
    facility: typeof parsed.facility === "string" ? parsed.facility : "",
    memo: typeof parsed.memo === "string" ? parsed.memo : "",
    total_gross: parsed.total_gross ?? "",
    tax_lines: Array.isArray(parsed.tax_lines) ? parsed.tax_lines.map((line) => ({
      description: typeof line?.description === "string" ? line.description : "",
      amount_gross: line?.amount_gross ?? "",
      tax_rate: typeof line?.tax_rate === "string" && line.tax_rate.trim()
        ? line.tax_rate.trim()
        : "10%"
    })) : [],
    unreadable_fields: Array.isArray(parsed.unreadable_fields)
      ? parsed.unreadable_fields.filter((field) => typeof field === "string" && field.trim()).map((field) => field.trim())
      : []
  };
}

export function isValidDate(value) {
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("/").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function isPositiveInteger(value) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isInteger(numeric) && numeric > 0;
}

export function totalDifference(receipt) {
  const total = Number(receipt.total_gross);
  const detailTotal = receipt.tax_lines.reduce((sum, line) => sum + Number(line.amount_gross || 0), 0);
  return total - detailTotal;
}

export function totalCheckMessage(receipt) {
  const difference = totalDifference(receipt);
  if (difference === 0) return "明細合計と税込合計金額が一致しています。";
  if (difference > 0) return `明細が${difference.toLocaleString("ja-JP")}円不足しています。`;
  return `明細が${Math.abs(difference).toLocaleString("ja-JP")}円超過しています。`;
}

export function validateReceipt(receipt) {
  const errors = [];
  if (!isValidDate(receipt.transaction_date)) errors.push("取引日をYYYY/MM/DD形式の有効な日付で入力してください。");
  if (!receipt.facility?.trim()) errors.push("店舗名・ホテル名を入力してください。");
  if (!receipt.account?.trim()) errors.push("勘定科目を確認してください。");
  if (!receipt.counterparty?.trim()) errors.push("取引先を確認してください。");
  if (receipt.payment_method !== "普通預金（三井住友銀行）") {
    errors.push("取引手段は普通預金（三井住友銀行）です。");
  }
  if (!isPositiveInteger(receipt.total_gross)) errors.push("税込合計金額を1円以上の整数で入力してください。");
  if (!Array.isArray(receipt.tax_lines) || receipt.tax_lines.length === 0) {
    errors.push("明細を1件以上入力してください。");
  } else {
    receipt.tax_lines.forEach((line, index) => {
      const position = index + 1;
      if (!line.description?.trim()) errors.push(`明細${position}の明細内容を入力してください。`);
      if (!isPositiveInteger(line.amount_gross)) errors.push(`明細${position}の税込金額を1円以上の整数で入力してください。`);
      if (!ALLOWED_TAX_RATES.has(line.tax_rate)) errors.push(`明細${position}の税率を確認してください。`);
    });
  }
  if (Array.isArray(receipt.unreadable_fields) && receipt.unreadable_fields.length > 0) {
    errors.push("読み取れなかった項目をすべて確認済みにしてください。");
  }
  if (isPositiveInteger(receipt.total_gross)
    && receipt.tax_lines.length > 0
    && receipt.tax_lines.every((line) => isPositiveInteger(line.amount_gross))
    && totalDifference(receipt) !== 0) {
    errors.push(totalCheckMessage(receipt));
  }
  return errors;
}

export function recommendClassification(receipt, rules) {
  const haystack = [
    receipt.issuer,
    receipt.facility,
    ...(receipt.tax_lines || []).map((line) => line.description)
  ].filter(Boolean).join(" ").toLocaleLowerCase("ja-JP");

  return rules.find((rule) => rule.keywords.some((keyword) => haystack.includes(keyword.toLocaleLowerCase("ja-JP")))) || null;
}

export function buildFinalReceipt(receipt) {
  return {
    receipt_id: receipt.receipt_id,
    transaction_date: receipt.transaction_date.trim(),
    issuer: receipt.issuer?.trim() ?? "",
    facility: receipt.facility.trim(),
    memo: receipt.memo?.trim() ?? "",
    account: receipt.account,
    payment_method: "普通預金（三井住友銀行）",
    counterparty: receipt.counterparty,
    total_gross: Number(receipt.total_gross),
    tax_lines: receipt.tax_lines.map((line) => ({
      description: line.description.trim(),
      amount_gross: Number(line.amount_gross),
      tax_rate: line.tax_rate
    })),
    unreadable_fields: []
  };
}
