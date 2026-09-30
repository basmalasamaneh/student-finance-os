import { Router, type IRouter } from "express";
import healthRouter from "./health";
import onboardingRouter from "./onboarding";
import financeRouter from "./finance";
import campusRouter from "./campus";

const router: IRouter = Router();

router.use(healthRouter);
router.use(onboardingRouter);
router.use(financeRouter);
router.use(campusRouter);

export default router;
