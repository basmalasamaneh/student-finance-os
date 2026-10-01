import { Router, type IRouter } from "express";
import healthRouter from "./health";
import onboardingRouter from "./onboarding";
import financeRouter from "./finance";
import campusRouter from "./campus";
import planningRouter from "./planning";
import goalsRouter from "./goals";
import familyRouter from "./family";

const router: IRouter = Router();

router.use(healthRouter);
router.use(onboardingRouter);
router.use(financeRouter);
router.use(campusRouter);
router.use(planningRouter);
router.use(goalsRouter);
router.use(familyRouter);

export default router;
