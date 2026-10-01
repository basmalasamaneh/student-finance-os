import { Router, type IRouter } from "express";
import { CompareAffordabilityResponse } from "@workspace/api-zod";
import { requireRole, type TrustedPrincipal } from "../lib/authorization";
import { compareAffordability } from "../lib/affordability";

const router: IRouter = Router();
router.post("/planning/affordability", async (req, res) => {
  const userId = requireRole(res.locals.principal as TrustedPrincipal | undefined, "student").userId;
  const now = new Date();
  res.json(CompareAffordabilityResponse.parse(await compareAffordability(userId, req.body, now)));
});
export default router;