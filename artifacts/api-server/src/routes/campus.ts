import { Router, type IRouter, type Request } from "express";
import { eq } from "drizzle-orm";
import { db, universities, campuses, campusServices, campusProducts, financeAccounts } from "@workspace/db";
import {
  ListCampusCatalogResponse, InstallCampusDemoResponse, CreateCampusUniversityBody, CreateCampusUniversityResponse,
  CreateCampusBody, CreateCampusResponse, CreateCampusServiceBody, CreateCampusServiceResponse,
  UpdateCampusServiceBody, UpdateCampusServiceResponse, CreateCampusProductBody, CreateCampusProductResponse,
  UpdateCampusProductBody, UpdateCampusProductResponse, CreateCampusPaymentBody, CreateCampusPaymentResponse,
  UpdateCampusUniversityBody, UpdateCampusUniversityResponse, UpdateCampusBody, UpdateCampusResponse,
} from "@workspace/api-zod";
import { requireRole, requirePrincipal, type TrustedPrincipal } from "../lib/authorization";
import { ApiError } from "../lib/http-errors";
import { once, lockedAccounts, post, checked } from "../lib/finance";

const router: IRouter = Router();
const student = (req: Request) => requireRole(req.res?.locals.principal as TrustedPrincipal | undefined, "student").userId;
const admin = (req: Request) => requireRole(req.res?.locals.principal as TrustedPrincipal | undefined, "admin").userId;
function parse<T>(schema: { parse: (v: unknown) => T }, value: unknown): T {
  try { return schema.parse(value); } catch { throw new ApiError("BAD_REQUEST"); }
}
function id(req: Request) {
  const raw = req.params.id;
  if (typeof raw !== "string" || !/^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}$/i.test(raw)) throw new ApiError("BAD_REQUEST");
  return raw;
}
const productDto = (p: typeof campusProducts.$inferSelect) => ({
  id: p.id, serviceId: p.serviceId, name: p.name, arabicName: p.arabicName,
  active: p.active, price: { minor: Number(p.priceMinor), currency: p.currency },
});
async function catalog() {
  const [us, cs, ss, ps] = await Promise.all([
    db.select().from(universities), db.select().from(campuses), db.select().from(campusServices), db.select().from(campusProducts),
  ]);
  return us.map(u => ({
    id: u.id, name: u.name, arabicName: u.arabicName,
    campuses: cs.filter(c => c.universityId === u.id).map(c => ({
      id: c.id, universityId: c.universityId, name: c.name, arabicName: c.arabicName,
      services: ss.filter(s => s.campusId === c.id).map(s => ({
        id: s.id, universityId: u.id, campusId: c.id, name: s.name, arabicName: s.arabicName,
        category: s.category, description: s.description, location: s.location, active: s.active,
        paymentEnabled: s.paymentEnabled, integrationStatus: s.integrationStatus,
        products: ps.filter(p => p.serviceId === s.id).map(productDto),
      })),
    })),
  }));
}
router.get("/campus/catalog", async (req, res) => {
  const principal = requirePrincipal(req.res?.locals.principal as TrustedPrincipal | undefined);
  if (!principal.roles.some(r => r === "student" || r === "admin")) throw new ApiError("FORBIDDEN");
  res.json(ListCampusCatalogResponse.parse(await catalog()));
});
router.post("/campus/demo/install", async (req, res) => {
  student(req);
  // Global fictional directory, installed only after explicit student opt-in.
  await db.transaction(async tx => {
    await tx.execute("select pg_advisory_xact_lock(847329211)");
    const [u] = await tx.insert(universities).values({ name: "Demo University (fictional)", arabicName: "جامعة تجريبية (خيالية)", demo: true })
      .onConflictDoNothing().returning();
    if (!u) {
      const [existing] = await tx.select().from(universities).where(eq(universities.name, "Demo University (fictional)"));
      if (!existing?.demo) throw new ApiError("CONFLICT");
      return;
    }
    const [c] = await tx.insert(campuses).values({ universityId: u.id, name: "Demo Campus", arabicName: "الحرم التجريبي" }).returning();
    for (const service of [
      { name: "Demo Cafeteria", arabicName: "المقصف التجريبي", category: "food", products: [["Sandwich", "ساندويتش", 1200], ["Coffee", "قهوة", 500], ["Water", "ماء", 200]] as const },
      { name: "Demo Bookstore", arabicName: "المكتبة التجريبية", category: "books", products: [["Notebook", "دفتر", 800], ["Pen", "قلم", 300]] as const },
      { name: "Demo Printing Center", arabicName: "مركز الطباعة التجريبي", category: "printing", products: [["Black and white page", "صفحة أبيض وأسود", 50], ["Color page", "صفحة ملونة", 150], ["Binding", "تجليد", 1000]] as const },
    ]) {
      const [s] = await tx.insert(campusServices).values({
        campusId: c!.id, name: service.name, arabicName: service.arabicName, category: service.category,
        description: "Fictional demo service; prices are illustrative only.", location: "Demo Campus",
        active: true, paymentEnabled: true,
      }).returning();
      await tx.insert(campusProducts).values(service.products.map(([name, arabicName, price]) => ({
        serviceId: s!.id, name, arabicName, priceMinor: BigInt(price), currency: "ILS", active: true,
      })));
    }
  });
  res.json(InstallCampusDemoResponse.parse(await catalog()));
});
router.post("/campus/admin/universities", async (req, res) => {
  admin(req); const input = parse(CreateCampusUniversityBody, req.body);
  if (!input.name.trim() || !input.arabicName.trim()) throw new ApiError("BAD_REQUEST");
  const [u] = await db.insert(universities).values(input).returning();
  res.status(201).json(CreateCampusUniversityResponse.parse({ ...u, campuses: [] }));
});
router.put("/campus/admin/universities/:id", async (req, res) => {
  admin(req); const input = parse(UpdateCampusUniversityBody, req.body);
  if (!input.name.trim() || !input.arabicName.trim()) throw new ApiError("BAD_REQUEST");
  const [u] = await db.update(universities).set(input).where(eq(universities.id, id(req))).returning();
  if (!u) throw new ApiError("NOT_FOUND");
  const all = await catalog();
  res.json(UpdateCampusUniversityResponse.parse(all.find(row => row.id === u.id)));
});
router.post("/campus/admin/campuses", async (req, res) => {
  admin(req); const input = parse(CreateCampusBody, req.body);
  if (!input.name.trim() || !input.arabicName.trim()) throw new ApiError("BAD_REQUEST");
  const [parent] = await db.select().from(universities).where(eq(universities.id, input.universityId));
  if (!parent) throw new ApiError("NOT_FOUND");
  const [c] = await db.insert(campuses).values(input).returning();
  res.status(201).json(CreateCampusResponse.parse({ ...c, services: [] }));
});
router.put("/campus/admin/campuses/:id", async (req, res) => {
  admin(req); const input = parse(UpdateCampusBody, req.body);
  if (!input.name.trim() || !input.arabicName.trim()) throw new ApiError("BAD_REQUEST");
  const [prior] = await db.select().from(campuses).where(eq(campuses.id, id(req)));
  if (!prior) throw new ApiError("NOT_FOUND");
  if (prior.universityId !== input.universityId) throw new ApiError("CONFLICT");
  const [university] = await db.select().from(universities).where(eq(universities.id, input.universityId));
  if (!university) throw new ApiError("NOT_FOUND");
  const [c] = await db.update(campuses).set(input).where(eq(campuses.id, id(req))).returning();
  if (!c) throw new ApiError("NOT_FOUND");
  const all = await catalog();
  res.json(UpdateCampusResponse.parse(all.flatMap(u => u.campuses).find(row => row.id === c.id)));
});
async function saveService(req: Request, create: boolean) {
  admin(req);
  const input = parse(create ? CreateCampusServiceBody : UpdateCampusServiceBody, req.body);
  if (!input.name.trim() || !input.arabicName.trim()) throw new ApiError("BAD_REQUEST");
  const [campus] = await db.select().from(campuses).where(eq(campuses.id, input.campusId));
  if (!campus) throw new ApiError("NOT_FOUND");
  if (!create) {
    const [prior] = await db.select().from(campusServices).where(eq(campusServices.id, id(req)));
    if (!prior) throw new ApiError("NOT_FOUND");
    if (prior.campusId !== input.campusId) throw new ApiError("CONFLICT");
  }
  const [service] = create ? await db.insert(campusServices).values(input).returning()
    : await db.update(campusServices).set(input).where(eq(campusServices.id, id(req))).returning();
  if (!service) throw new ApiError("NOT_FOUND");
  const products = await db.select().from(campusProducts).where(eq(campusProducts.serviceId, service.id));
  return { ...service, universityId: campus.universityId, products: products.map(productDto) };
}
router.post("/campus/admin/services", async (req, res) => res.status(201).json(CreateCampusServiceResponse.parse(await saveService(req, true))));
router.put("/campus/admin/services/:id", async (req, res) => res.json(UpdateCampusServiceResponse.parse(await saveService(req, false))));
router.delete("/campus/admin/services/:id", async (req, res) => {
  admin(req);
  const [s] = await db.update(campusServices).set({ active: false, paymentEnabled: false }).where(eq(campusServices.id, id(req))).returning();
  if (!s) throw new ApiError("NOT_FOUND");
  res.status(204).end();
});
async function saveProduct(req: Request, create: boolean) {
  admin(req);
  const input = parse(create ? CreateCampusProductBody : UpdateCampusProductBody, req.body);
  if (!input.name.trim() || !input.arabicName.trim() || !Number.isSafeInteger(input.price.minor)) throw new ApiError("BAD_REQUEST");
  const [service] = await db.select().from(campusServices).where(eq(campusServices.id, input.serviceId));
  if (!service) throw new ApiError("NOT_FOUND");
  if (!create) {
    const [prior] = await db.select().from(campusProducts).where(eq(campusProducts.id, id(req)));
    if (!prior) throw new ApiError("NOT_FOUND");
    if (prior.serviceId !== input.serviceId) throw new ApiError("CONFLICT");
  }
  const values = { serviceId: input.serviceId, name: input.name, arabicName: input.arabicName, active: input.active, currency: input.price.currency, priceMinor: BigInt(input.price.minor) };
  const [product] = create ? await db.insert(campusProducts).values(values).returning()
    : await db.update(campusProducts).set(values).where(eq(campusProducts.id, id(req))).returning();
  if (!product) throw new ApiError("NOT_FOUND");
  return productDto(product);
}
router.post("/campus/admin/products", async (req, res) => res.status(201).json(CreateCampusProductResponse.parse(await saveProduct(req, true))));
router.put("/campus/admin/products/:id", async (req, res) => res.json(UpdateCampusProductResponse.parse(await saveProduct(req, false))));
router.delete("/campus/admin/products/:id", async (req, res) => {
  admin(req);
  const [p] = await db.update(campusProducts).set({ active: false }).where(eq(campusProducts.id, id(req))).returning();
  if (!p) throw new ApiError("NOT_FOUND");
  res.status(204).end();
});
router.post("/campus/payments", async (req, res) => {
  const userId = student(req), input = parse(CreateCampusPaymentBody, req.body);
  if (input.items.length === 0 || new Set(input.items.map(i => i.productId)).size !== input.items.length) throw new ApiError("BAD_REQUEST");
  const receipt = await once(userId, req.get("Idempotency-Key"), "campus-payment", input, async tx => {
    const [account] = await tx.select().from(financeAccounts).where(eq(financeAccounts.id, input.accountId));
    if (!account || account.userId !== userId) throw new ApiError("NOT_FOUND");
    const [service] = await tx.select().from(campusServices).where(eq(campusServices.id, input.serviceId)).for("share");
    if (!service || !service.active || !service.paymentEnabled || service.integrationStatus !== "simulated") throw new ApiError("CONFLICT");
    const items = [];
    let total = 0n;
    for (const requested of [...input.items].sort((a, b) => a.productId.localeCompare(b.productId))) {
      const [p] = await tx.select().from(campusProducts).where(eq(campusProducts.id, requested.productId)).for("share");
      if (!p || p.serviceId !== service.id || !p.active || p.currency !== account.currency) throw new ApiError("CONFLICT");
      const line = checked(p.priceMinor * BigInt(requested.quantity));
      total = checked(total + line);
      items.push({ productId: p.id, name: p.name, quantity: requested.quantity,
        unitPrice: { currency: p.currency, minor: Number(p.priceMinor) },
        lineTotal: { currency: p.currency, minor: Number(line) } });
    }
    if (total <= 0n) throw new ApiError("BAD_REQUEST");
    const current = (await lockedAccounts(tx, [account.id])).get(account.id)!;
    return post(tx, current, -total, { kind: "payment", category: service.category, serviceId: service.id, merchantName: service.name, items });
  });
  res.status(201).json(CreateCampusPaymentResponse.parse(receipt));
});
export default router;