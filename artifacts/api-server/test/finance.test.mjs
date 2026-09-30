import test from "node:test";
import assert from "node:assert/strict";
import {
  CreateFinanceAccountBody, CreateFinanceMovementBody, CreateMoneyRequestBody,
  DecideMoneyRequestBody, CreateCampusPaymentBody, CreateCampusProductBody,
  CreateFinanceMovementResponse, CreateCampusPaymentResponse,
} from "../../../lib/api-zod/src/generated/api.ts";
import { positive, checked } from "../src/lib/finance-money.ts";

test("financial inputs reject balances, invalid money, wrong decisions and client-priced carts", () => {
  const account = { name: "Wallet", type: "wallet", currency: "ILS" };
  assert.equal("balance" in CreateFinanceAccountBody.parse({ ...account, balance: { minor: 900, currency: "ILS" } }), false);
  assert.equal(CreateFinanceAccountBody.safeParse(account).success, true);
  const accountId = "3899c034-a246-465e-8ccb-8845d8c4c339";
  const amount = { minor: 100, currency: "ILS" };
  assert.equal(CreateFinanceMovementBody.safeParse({ kind: "send", accountId, amount: { minor: -100, currency: "ILS" }, recipientAccountId: accountId }).success, false);
  assert.equal(CreateFinanceMovementBody.safeParse({ kind: "transfer", accountId, amount: { minor: 1.5, currency: "ILS" } }).success, false);
  assert.equal(CreateFinanceMovementBody.safeParse({ kind: "receive", accountId, amount }).success, true);
  assert.equal(CreateFinanceMovementBody.safeParse({ kind: "payment", accountId, amount }).success, true);
  assert.equal(CreateMoneyRequestBody.safeParse({ recipientAccountId: accountId, payerAccountId: accountId, amount }).success, true);
  assert.equal(DecideMoneyRequestBody.safeParse({ action: "approve" }).success, false);
  assert.equal("price" in CreateCampusPaymentBody.parse({ accountId, serviceId: accountId, items: [{ productId: accountId, quantity: 1, price: amount }] }).items[0], false);
  assert.equal(CreateCampusPaymentBody.safeParse({ accountId, serviceId: accountId, items: [{ productId: accountId, quantity: 1 }] }).success, true);
  assert.equal(CreateCampusProductBody.safeParse({ serviceId: accountId, name: "Demo", arabicName: "تجريبي", price: { minor: Number.MAX_SAFE_INTEGER + 1, currency: "ILS" }, active: true }).success, false);
});

test("money is positive integer minor units and overflow fails closed", () => {
  assert.equal(positive({ minor: 100, currency: "ILS" }), 100n);
  for (const value of [0, -1, 0.1, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => positive({ minor: value, currency: "ILS" }), { code: "BAD_REQUEST" });
  }
  assert.equal(checked(BigInt(Number.MAX_SAFE_INTEGER)), BigInt(Number.MAX_SAFE_INTEGER));
  assert.throws(() => checked(BigInt(Number.MAX_SAFE_INTEGER) + 1n), { code: "CONFLICT" });
  assert.throws(() => checked(-1n), { code: "CONFLICT" });
});

test("receipts require server-owned posting fields", () => {
  const accountId = "3899c034-a246-465e-8ccb-8845d8c4c339";
  const receipt = {
    id: accountId, userId: accountId, accountId, kind: "payment", type: "payment",
    category: "food", direction: "debit", description: "Simulated payment",
    source: "Account", destination: "External (simulated)",
    relatedGoalId: null, relatedBudgetId: null, parentTransferId: null,
    campusServiceId: null, universityId: null, campusId: null, recurringExpenseId: null,
    amount: { minor: 1700, currency: "ILS" }, balanceAfter: { minor: 0, currency: "ILS" },
    status: "simulated_payment", createdAt: new Date().toISOString(),
  };
  assert.equal(CreateFinanceMovementResponse.safeParse(receipt).success, true);
  assert.equal(CreateCampusPaymentResponse.safeParse(receipt).success, true);
});