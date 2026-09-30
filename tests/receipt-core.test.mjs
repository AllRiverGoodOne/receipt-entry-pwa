import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFinalReceipt,
  isValidDate,
  parseReceiptResponse,
  stripJsonFence,
  totalCheckMessage,
  validateReceipt
} from "../receipt-core.js";

const completeReceipt = {
  receipt_id: "test-id",
  transaction_date: "2026/09/27",
  issuer: "アパサービス株式会社",
  facility: "アパホテル〈広島駅前新幹線口〉",
  account: "出張経費",
  payment_method: "普通預金（三井住友銀行）",
  counterparty: "宿泊",
  total_gross: 8200,
  tax_lines: [
    { description: "宿泊代", amount_gross: 8000, tax_rate: "10%" },
    { description: "宿泊税", amount_gross: 200, tax_rate: "対象外" }
  ],
  unreadable_fields: []
};

test("JSONだけの応答を解析できる", () => {
  const value = JSON.stringify(completeReceipt);
  assert.equal(parseReceiptResponse(value).issuer, "アパサービス株式会社");
});

test("jsonコードフェンスを除去できる", () => {
  const value = `\`\`\`json\n${JSON.stringify(completeReceipt)}\n\`\`\``;
  assert.equal(parseReceiptResponse(value).total_gross, 8200);
});

test("言語名なしのコードフェンスを除去できる", () => {
  assert.equal(stripJsonFence("```\n{\"ok\":true}\n```"), "{\"ok\":true}");
});

test("不正JSONは解析エラーになる", () => {
  assert.throws(() => parseReceiptResponse("{broken"), SyntaxError);
});

test("実在する日付だけを受け付ける", () => {
  assert.equal(isValidDate("2026/09/27"), true);
  assert.equal(isValidDate("2026/02/29"), false);
  assert.equal(isValidDate("2026-09-27"), false);
});

test("宿泊税が欠けた差額を表示する", () => {
  const receipt = { ...completeReceipt, tax_lines: [completeReceipt.tax_lines[0]] };
  assert.equal(totalCheckMessage(receipt), "明細が200円不足しています。");
  assert.ok(validateReceipt(receipt).includes("明細が200円不足しています。"));
});

test("8%と10%の混在明細を保持する", () => {
  const receipt = {
    ...completeReceipt,
    total_gross: 1483,
    tax_lines: [
      { description: "シウマイ炒飯弁当軽", amount_gross: 1480, tax_rate: "8%" },
      { description: "ポリ袋（小）", amount_gross: 3, tax_rate: "10%" }
    ]
  };
  const finalReceipt = buildFinalReceipt(receipt);
  assert.equal(validateReceipt(receipt).length, 0);
  assert.equal(finalReceipt.tax_lines[0].description, "シウマイ炒飯弁当軽");
  assert.deepEqual(finalReceipt.tax_lines.map((line) => line.tax_rate), ["8%", "10%"]);
});

test("未確認項目がある場合は検証エラーになる", () => {
  const receipt = { ...completeReceipt, unreadable_fields: ["transaction_date"] };
  assert.ok(validateReceipt(receipt).some((message) => message.includes("読み取れなかった項目")));
});

test("候補未確認では保存条件を満たさない", () => {
  const receipt = { ...completeReceipt, account: "", counterparty: "" };
  const errors = validateReceipt(receipt);
  assert.ok(errors.includes("勘定科目を確認してください。"));
  assert.ok(errors.includes("取引先を確認してください。"));
});

test("税率記載なしは10%を初期値にする", () => {
  const source = JSON.stringify({
    ...completeReceipt,
    tax_lines: [{ description: "宿泊代", amount_gross: 8200 }]
  });
  assert.equal(parseReceiptResponse(source).tax_lines[0].tax_rate, "10%");
});

test("許可外の税率は検証エラーになる", () => {
  const receipt = {
    ...completeReceipt,
    tax_lines: [{ description: "宿泊代", amount_gross: 8200, tax_rate: "5%" }]
  };
  assert.ok(validateReceipt(receipt).includes("明細1の税率を確認してください。"));
});
