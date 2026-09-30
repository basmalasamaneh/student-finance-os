import { Router, type IRouter } from "express";
import healthRouter from "./health";
import onboardingRouter from "./onboarding";
import financeRouter from "./finance";
import campusRouter from "./campus";
import planningRouter from "./planning";

const router: IRouter = Router();

router.use(healthRouter);
router.use(onboardingRouter);
router.use(financeRouter);
router.use(campusRouter);
router.use(planningRouter);

export default router;
