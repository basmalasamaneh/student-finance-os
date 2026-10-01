import { Router, type IRouter } from "express";
import { queryAssistant } from "../lib/assistant";
import { AssistantUnavailable } from "../lib/assistant-planner";
import { ApiError } from "../lib/http-errors";

export function createAssistantRouter(query = queryAssistant): IRouter {
  const router: IRouter = Router();
  router.post("/assistant/query", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    res.json(await query(res.locals.principal, req.body));
  } catch (error) {
    if (error instanceof AssistantUnavailable) {
      res.status(503).json({ error: { code: "ASSISTANT_UNAVAILABLE",
        message: req.body?.language === "ar" ? "المساعد غير متاح مؤقتاً. أعد المحاولة." : "Assistant temporarily unavailable. Please retry." } });
      return;
    }
    // Do not pass raw driver/SDK errors into the shared logger.
    throw error instanceof ApiError ? error : new ApiError("INTERNAL_ERROR");
  }
  });
  return router;
}
export default createAssistantRouter();