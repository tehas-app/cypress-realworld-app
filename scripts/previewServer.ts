// The preview's one port: the built app, and the API under /api, passed on to
// the backend on localhost. The API's paths (/notifications, /transactions)
// are the app's routes too, so they cannot share the root. See preview/.
import path from "path";
import express from "express";
import history from "connect-history-api-fallback";
const proxy = require("http-proxy-middleware");

const app = express();
const backend = `http://localhost:${process.env.VITE_BACKEND_PORT}`;

app.use(
  "/api",
  proxy({ target: backend, changeOrigin: true, pathRewrite: { "^/api": "" }, logLevel: "warn" })
);
app.use(history());
app.use(express.static(path.join(__dirname, "../build")));

app.listen(Number(process.env.PREVIEW_PORT || 8080));
