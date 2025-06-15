import app from "../server/index";
import { createServer } from "http";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default (req: VercelRequest, res: VercelResponse) => {
  const server = createServer(app);
  server.emit("request", req, res);
};