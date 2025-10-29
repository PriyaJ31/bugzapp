import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db/pool.js";

const router = Router();

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: "name, email, password are required" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, role, created_at`,
      [name.trim(), email.trim().toLowerCase(), hash]
    );

    const user = rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "2d" }
    );
    res.status(201).json({ user, token });
  } catch (e) {
    if (e.code === "23505") { // unique_violation
      return res.status(409).json({ error: "Email already registered" });
    }
    res.status(500).json({ error: e.message });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, password_hash FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );
    if (!rows.length) return res.status(401).json({ error: "Invalid credentials" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "2d" }
    );

    // don’t expose password_hash
    delete user.password_hash;
    res.json({ user, token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
