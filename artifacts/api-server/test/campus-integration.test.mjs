import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { build } from "esbuild";

test("Prompt 10: persisted config, profile catalog links, full monthly owner ledger and unchanged atomic checkout", { skip: !process.env.DATABASE_URL }, async () => {
  process.env.SESSION_SECRET ??= "isolated-campus-test-session-secret-not-a-credential";
  const compiled = await build({
    stdin: {
      contents: `
        export { default as campusRouter } from "./src/routes/campus.ts";
        export { default as profileRouter } from "./src/routes/onboarding.ts";
        export { once, lockedAccounts, post } from "./src/lib/finance.ts";
        export { historyDetail } from "./src/routes/finance-history.ts";
        export * from "@workspace/db";
        export { eq, inArray } from "drizzle-orm";`,
      resolveDir: new URL("..", import.meta.url).pathname, loader: "ts",
    },
    bundle: true, platform: "node", format: "cjs", write: false, external: ["*.node"],
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const m = module.exports, { db, pool, eq, inArray } = m;
  const userIds = [], universityIds = [], campusIds = [], serviceIds = [], productIds = [], accountIds = [];
  const marker = randomUUID();
  const month = new Date().toISOString().slice(0, 7);
  async function call(router, method, path, actor, body, params = {}, query = {}, key = randomUUID()) {
    const layer = router.stack.find(l => l.route?.path === path && l.route.stack.some(h => h.method === method));
    assert(layer, `${method} ${path}`);
    const res = {
      locals: { principal: actor === null ? undefined : { userId: userIds[actor], roles: [actor === 2 ? "admin" : actor === 3 ? "parent" : "student"] } },
      status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; },
      end() { return this; },
    };
    await layer.route.stack.find(h => h.method === method).handle({ body, params, query, res, get: () => key }, res);
    return res.data;
  }
  const c = (...args) => call(m.campusRouter, ...args);
  const p = (...args) => call(m.profileRouter, ...args);
  const summary = (query = {}, actor = 0) => c("get", "/campus/spending-summary", actor, undefined, {}, query);
  try {
    for (const role of ["student", "student", "admin", "parent"]) {
      const [u] = await db.insert(m.users).values({ name: `Campus test ${role}`, email: `${marker}-${userIds.length}@example.invalid`,
        role, passwordHash: "synthetic-not-a-credential" }).returning();
      userIds.push(u.id);
    }
    const metadata = { city: "Configured city", housingAvailability: "Ask housing office",
      transportationContext: "Configured transport", tuitionConfiguration: "Consult the registrar",
      scholarshipConfiguration: "Contact aid office" };
    const universityInput = { name: `Synthetic ${marker}`, arabicName: "جامعة اختبار", ...metadata };
    for (const actor of [0, 1, 3]) {
      await assert.rejects(c("post", "/campus/admin/universities", actor, universityInput), { code: "FORBIDDEN" });
      await assert.rejects(c("put", "/campus/admin/campuses/:id", actor, {}, { id: randomUUID() }), { code: "FORBIDDEN" });
      await assert.rejects(c("delete", "/campus/admin/services/:id", actor, undefined, { id: randomUUID() }), { code: "FORBIDDEN" });
    }
    await assert.rejects(c("post", "/campus/admin/universities", 2, { ...universityInput, city: "a".repeat(161) }), { code: "BAD_REQUEST" });
    await assert.rejects(c("post", "/campus/admin/universities", 2, { ...universityInput, tuitionConfiguration: "a".repeat(2001) }), { code: "BAD_REQUEST" });
    const u = await c("post", "/campus/admin/universities", 2, universityInput);
    universityIds.push(u.id);
    for (const [key, value] of Object.entries(metadata)) assert.equal(u[key], value);
    const legacyU = await c("post", "/campus/admin/universities", 2, { name: `Legacy ${marker}`, arabicName: "جامعة قديمة" });
    universityIds.push(legacyU.id);
    for (const key of Object.keys(metadata)) assert.equal(legacyU[key], "");
    const campusInput = { universityId: u.id, name: "Configured campus", arabicName: "حرم اختبار",
      city: "Campus city", locationDescription: "Configured location", transportationContext: "Transport office",
      housingContext: "Housing office" };
    const campus = await c("post", "/campus/admin/campuses", 2, campusInput);
    campusIds.push(campus.id);
    const otherCampus = await c("post", "/campus/admin/campuses", 2, { universityId: legacyU.id, name: "Other", arabicName: "آخر" });
    campusIds.push(otherCampus.id);
    const secondCampus = await c("post", "/campus/admin/campuses", 2, { universityId: u.id, name: "Second", arabicName: "ثاني" });
    campusIds.push(secondCampus.id);
    assert.equal(otherCampus.housingContext, "");
    const updated = await c("put", "/campus/admin/universities/:id", 2,
      { name: u.name, arabicName: u.arabicName, city: "Updated city", scholarshipConfiguration: "" }, { id: u.id });
    assert.equal(updated.city, "Updated city");
    assert.equal(updated.tuitionConfiguration, metadata.tuitionConfiguration);
    assert.equal(updated.scholarshipConfiguration, "");
    const updatedCampus = await c("put", "/campus/admin/campuses/:id", 2,
      { universityId: u.id, name: campus.name, arabicName: campus.arabicName, housingContext: "" }, { id: campus.id });
    assert.equal(updatedCampus.locationDescription, campusInput.locationDescription);
    assert.equal(updatedCampus.housingContext, "");
    assert.equal((await db.select().from(m.campuses).where(eq(m.campuses.id, campus.id)))[0].city, campusInput.city);
    await assert.rejects(c("put", "/campus/admin/campuses/:id", 2,
      { ...campusInput, housingContext: "x".repeat(2001) }, { id: campus.id }), { code: "BAD_REQUEST" });
    await assert.rejects(c("put", "/campus/admin/campuses/:id", 2,
      { ...campusInput, universityId: legacyU.id }, { id: campus.id }), { code: "CONFLICT" });
    assert.equal((await c("get", "/campus/catalog", 0)).find(row => row.id === u.id).city, "Updated city");
    await assert.rejects(c("get", "/campus/catalog", 3), { code: "FORBIDDEN" });

    // Legacy/manual education remains valid. Supplied education replaces the section.
    const manual = { studentType: "university", university: "Manual institution", campus: "Manual campus", major: "Science" };
    assert.deepEqual((await p("put", "/profile", 0, { education: manual })).education, manual);
    const linked = { studentType: "university", universityId: u.id, campusId: campus.id,
      university: "Forged name", campus: "Forged campus", major: "Science" };
    let profile = await p("put", "/profile", 0, { education: linked });
    assert.equal(profile.education.university, u.name);
    assert.equal(profile.education.campus, campus.name);
    assert.equal((await db.select().from(m.users).where(eq(m.users.id, userIds[0])))[0].education.campusId, campus.id);
    const upperLinked = { ...linked, universityId: u.id.toUpperCase(), campusId: campus.id.toUpperCase() };
    profile = await p("put", "/profile", 0, { education: upperLinked });
    assert.equal(profile.education.university, u.name);
    assert.equal(profile.education.campus, campus.name);
    assert.equal((await p("get", "/profile", 0)).education.campus, campus.name);
    await assert.rejects(p("put", "/profile", 0, { education: { ...upperLinked, campusId: otherCampus.id.toUpperCase() } }), { code: "BAD_REQUEST" });
    for (const education of [
      { studentType: "university", universityId: u.id },
      { studentType: "university", campusId: campus.id },
      { ...linked, campusId: otherCampus.id },
    ]) await assert.rejects(p("put", "/profile", 0, { education }), { code: "BAD_REQUEST" });
    await assert.rejects(p("put", "/profile", 0, { education: { ...linked, campusId: randomUUID() } }), { code: "NOT_FOUND" });
    await assert.rejects(p("put", "/profile", 1, { education: { ...linked, universityId: "bad" } }), { code: "BAD_REQUEST" });
    await assert.rejects(p("put", "/profile", 3, { education: linked }), { code: "FORBIDDEN" });
    assert.equal((await p("get", "/profile", 1)).education, undefined);
    await c("put", "/campus/admin/universities/:id", 2, { name: `${u.name} renamed`, arabicName: u.arabicName }, { id: u.id });
    await c("put", "/campus/admin/campuses/:id", 2, { universityId: u.id, name: "Renamed campus", arabicName: campus.arabicName }, { id: campus.id });
    profile = await p("get", "/profile", 0);
    assert.equal(profile.education.university, `${u.name} renamed`);
    assert.equal(profile.education.campus, "Renamed campus");
    profile = await p("put", "/profile", 0, { education: { ...linked, campusId: secondCampus.id } });
    assert.equal(profile.education.campus, secondCampus.name);
    profile = await p("put", "/profile", 0, { education: { ...linked, studentType: "school", school: "School", grade: "10" } });
    assert.deepEqual(profile.education, { studentType: "school", school: "School", grade: "10" });
    assert.deepEqual((await p("put", "/profile", 0, { education: manual })).education, manual);
    await p("put", "/profile", 0, { name: "Updated student" });
    assert.deepEqual((await p("get", "/profile", 0)).education, manual);

    const serviceInput = { campusId: campus.id, name: "Test cafeteria", arabicName: "مقصف", category: "food",
      description: "Synthetic service", location: "Test", active: true, paymentEnabled: true };
    const service = await c("post", "/campus/admin/services", 2, serviceInput);
    serviceIds.push(service.id);
    const otherService = await c("post", "/campus/admin/services", 2, { ...serviceInput, campusId: otherCampus.id });
    serviceIds.push(otherService.id);
    const makeProduct = async currency => {
      const product = await c("post", "/campus/admin/products", 2, { serviceId: service.id, name: `Test ${currency}`,
        arabicName: "اختبار", price: { minor: 125, currency }, active: true });
      productIds.push(product.id);
      return product;
    };
    const ilsProduct = await makeProduct("ILS"), jodProduct = await makeProduct("JOD");
    for (const actor of [0, 3]) {
      await assert.rejects(c("put", "/campus/admin/universities/:id", actor, universityInput, { id: u.id }), { code: "FORBIDDEN" });
      await assert.rejects(c("post", "/campus/admin/campuses", actor, campusInput), { code: "FORBIDDEN" });
      await assert.rejects(c("post", "/campus/admin/services", actor, serviceInput), { code: "FORBIDDEN" });
      await assert.rejects(c("put", "/campus/admin/services/:id", actor, serviceInput, { id: service.id }), { code: "FORBIDDEN" });
      await assert.rejects(c("post", "/campus/admin/products", actor, {}), { code: "FORBIDDEN" });
      await assert.rejects(c("put", "/campus/admin/products/:id", actor, {}, { id: ilsProduct.id }), { code: "FORBIDDEN" });
      await assert.rejects(c("delete", "/campus/admin/products/:id", actor, undefined, { id: ilsProduct.id }), { code: "FORBIDDEN" });
    }
    for (const [actor, currency] of [[0, "ILS"], [0, "JOD"], [1, "ILS"]]) {
      const [account] = await db.insert(m.financeAccounts).values({ userId: userIds[actor], name: "Synthetic account", type: "wallet", currency }).returning();
      accountIds.push(account.id);
      await m.once(userIds[actor], randomUUID(), "test-fund", {}, async tx =>
        m.post(tx, (await m.lockedAccounts(tx, [account.id])).get(account.id), 100000n, { kind: "receive", category: "external_income" }));
    }
    const payment = (accountId = accountIds[0], productId = ilsProduct.id, actor = 0, key) =>
      c("post", "/campus/payments", actor, { accountId, serviceId: service.id, items: [{ productId, quantity: 1 }] }, {}, {}, key);
    const replayKey = randomUUID();
    const [empty] = await db.insert(m.financeAccounts).values({ userId: userIds[0], name: "Empty checkout source",
      type: "wallet", currency: "ILS" }).returning();
    const failedKey = randomUUID();
    await assert.rejects(payment(empty.id, ilsProduct.id, 0, failedKey), { code: "INSUFFICIENT_FUNDS" });
    assert.equal((await db.select().from(m.financeTransactions).where(eq(m.financeTransactions.accountId, empty.id))).length, 0);
    assert.equal((await db.select().from(m.financeIdempotency).where(eq(m.financeIdempotency.key, failedKey))).length, 0);
    const [receipt, replay] = await Promise.all([payment(undefined, undefined, 0, replayKey), payment(undefined, undefined, 0, replayKey)]);
    assert.equal(receipt.id, replay.id);
    assert.equal(receipt.amount.minor, 125);
    assert.equal(receipt.campusName, "Renamed campus");
    await assert.rejects(c("post", "/campus/payments", 0, { accountId: accountIds[0], serviceId: service.id,
      items: [{ productId: ilsProduct.id, quantity: 2 }] }, {}, {}, replayKey), { code: "CONFLICT" });
    // Full ledger must include more than ten payments, without double counting replays.
    for (let i = 0; i < 11; i++) await payment();
    const jodReceipt = await payment(accountIds[1], jodProduct.id);
    await payment(accountIds[2], ilsProduct.id, 1);
    await assert.rejects(payment(accountIds[2]), { code: "NOT_FOUND" });
    await assert.rejects(payment(accountIds[0], jodProduct.id), { code: "CONFLICT" });
    let result = await summary();
    assert.equal(result.month, month);
    assert.equal(result.totals.find(t => t.currency === "ILS").spending.minor, 1500);
    assert.equal(result.totals.find(t => t.currency === "JOD").spending.minor, 125);
    assert.equal(result.totals.find(t => t.currency === "ILS").printing.minor, 0);
    for (const category of ["books", "printing", "transportation", "fees", "other"]) {
      await c("put", "/campus/admin/services/:id", 2, { ...serviceInput, category }, { id: service.id });
      await payment();
    }
    // Reclassification never changes the category or item price of earlier receipts.
    const beforeDisable = await summary({ month, campusId: campus.id, serviceId: service.id });
    for (const filters of [
      { campusId: campus.id.toUpperCase(), serviceId: service.id.toUpperCase() },
      { campusId: campus.id.toUpperCase(), serviceId: service.id },
      { campusId: campus.id, serviceId: service.id.toUpperCase() },
    ]) assert.deepEqual((await summary({ month, ...filters })).totals, beforeDisable.totals);
    await assert.rejects(summary({ month, campusId: otherCampus.id.toUpperCase(), serviceId: service.id.toUpperCase() }), { code: "BAD_REQUEST" });
    const ils = beforeDisable.totals.find(t => t.currency === "ILS");
    assert.equal(ils.spending.minor, 2125);
    assert.equal(ils.food.minor, 1500);
    for (const category of ["books", "printing", "transportation", "fees", "other"]) assert.equal(ils[category].minor, 125);
    await c("put", "/campus/admin/products/:id", 2, { serviceId: service.id, name: ilsProduct.name,
      arabicName: ilsProduct.arabicName, active: true, price: { minor: 999, currency: "ILS" } }, { id: ilsProduct.id });
    await c("delete", "/campus/admin/products/:id", 2, undefined, { id: ilsProduct.id });
    await assert.rejects(payment(), { code: "CONFLICT" });
    await c("delete", "/campus/admin/services/:id", 2, undefined, { id: service.id });
    await assert.rejects(payment(accountIds[1], jodProduct.id), { code: "CONFLICT" });
    assert.deepEqual(await summary({ month, campusId: campus.id, serviceId: service.id }), beforeDisable);
    const historic = await m.historyDetail(userIds[0], receipt.id);
    assert.equal(historic.items[0].unitPrice.minor, 125);
    assert.equal(historic.category, "food");
    assert.equal((await m.historyDetail(userIds[0], jodReceipt.id)).amount.currency, "JOD");
    assert.equal((await payment(undefined, undefined, 0, replayKey)).id, receipt.id);
    assert.equal(await m.historyDetail(userIds[1], receipt.id), null);
    assert.deepEqual((await summary({ campusId: otherCampus.id })).totals, []);
    assert.deepEqual((await summary({ serviceId: otherService.id })).totals, []);
    assert.equal((await summary({}, 1)).totals[0].spending.minor, 125);
    for (const actor of [2, 3]) await assert.rejects(summary({}, actor), { code: "FORBIDDEN" });
    await assert.rejects(summary({}, null), { code: "UNAUTHENTICATED" });
    for (const query of [{ month: "0000-01" }, { month: "2025-13" }, { month: "2025-1" },
      { month: ["2025-01"] }, { campusId: "bad" }, { userId: userIds[1] },
      { campusId: otherCampus.id, serviceId: service.id }]) {
      await assert.rejects(summary(query), { code: "BAD_REQUEST" });
    }
    await assert.rejects(summary({ campusId: randomUUID() }), { code: "NOT_FOUND" });
    await assert.rejects(summary({ serviceId: randomUUID() }), { code: "NOT_FOUND" });
    // Precisely exercise half-open UTC month boundaries, including legacy provenance.
    await db.update(m.financeTransactions).set({ createdAt: new Date("2024-02-01T00:00:00Z"), campusId: null })
      .where(eq(m.financeTransactions.id, receipt.id));
    await db.update(m.financeTransactions).set({ createdAt: new Date("2024-02-29T23:59:59.999Z") })
      .where(eq(m.financeTransactions.id, jodReceipt.id));
    assert.equal((await summary({ month: "2024-02", campusId: campus.id })).totals.length, 2);
    assert.equal((await summary({ month: "2024-02", serviceId: service.id })).totals[0].spending.minor, 125);
    assert.deepEqual((await summary({ month: "2024-01" })).totals, []);
    assert.deepEqual((await summary({ month: "2024-03" })).totals, []);
    // Unknown historic categories are preserved as other, not silently omitted.
    await db.update(m.financeTransactions).set({ category: "legacy-university-charge" }).where(eq(m.financeTransactions.id, receipt.id));
    assert.equal((await summary({ month: "2024-02" })).totals.find(t => t.currency === "ILS").other.minor, 125);
    assert.equal((await summary({ month: "2024-02" }, 1)).totals.length, 0);
    // Synthetic fixture mutation verifies overflow fails explicitly, never rounds.
    const [historicRow] = await db.select().from(m.financeTransactions).where(eq(m.financeTransactions.id, receipt.id));
    await db.insert(m.financeTransactions).values({ ...historicRow, id: randomUUID(), amountMinor: BigInt(Number.MAX_SAFE_INTEGER) });
    await assert.rejects(summary({ month: "2024-02" }), { code: "CONFLICT" });
  } finally {
    if (userIds.length) {
      await db.delete(m.financeEvents).where(inArray(m.financeEvents.userId, userIds));
      await db.delete(m.financeIdempotency).where(inArray(m.financeIdempotency.userId, userIds));
      await db.delete(m.financeTransactions).where(inArray(m.financeTransactions.userId, userIds));
      await db.delete(m.financeAccounts).where(inArray(m.financeAccounts.userId, userIds));
      await db.delete(m.users).where(inArray(m.users.id, userIds));
    }
    if (productIds.length) await db.delete(m.campusProducts).where(inArray(m.campusProducts.id, productIds));
    if (serviceIds.length) await db.delete(m.campusServices).where(inArray(m.campusServices.id, serviceIds));
    if (campusIds.length) await db.delete(m.campuses).where(inArray(m.campuses.id, campusIds));
    if (universityIds.length) await db.delete(m.universities).where(inArray(m.universities.id, universityIds));
    await pool.end();
  }
});