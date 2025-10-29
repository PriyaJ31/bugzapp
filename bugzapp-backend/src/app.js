import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db/pool.js";
import bugsRouter from "./routes/bugs.js";
import usersRouter from "./routes/users.js";
import authRouter from "./routes/auth.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Simple health check (also verifies DB connectivity)
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/bugs", bugsRouter);
app.use("/api/users", usersRouter);


const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on ${port}`));
