/**
 * Auth routes — signup and login.
 */

import { Router, type Request, type Response } from "express";
import { authenticateUser, registerUser, sanitiseUser } from "../services/auth.js";

const router = Router();

router.post("/signup", (req: Request, res: Response): void => {
  try {
    const { email, password, ovatu_api_key } = req.body;

    if (!email || !password || !ovatu_api_key) {
      res.status(400).json({ error: "email, password, and ovatu_api_key are required" });
      return;
    }

    const user = registerUser(email, password, ovatu_api_key);
    res.status(201).json({ user: sanitiseUser(user) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registration failed";
    res.status(409).json({ error: message });
  }
});

router.post("/login", (req: Request, res: Response): void => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const user = authenticateUser(email, password);
    res.json({ user: sanitiseUser(user) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Login failed";
    res.status(401).json({ error: message });
  }
});

export default router;
