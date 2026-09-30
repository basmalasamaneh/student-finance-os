import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler, notFound } from "./middlewares/errors";

const app: Express = express();
// One managed reverse-proxy hop; req.ip uses the proxy's appended address,
// not an arbitrary client-supplied leftmost X-Forwarded-For value.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "32kb" }));

app.use("/api", router);
app.use(notFound);
app.use(errorHandler);

export default app;
