import { Router } from "express";
import { pool } from "../db/pool.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = Router();

/** GET all bugs (public) */
router.get("/", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, description, severity, status, user_id, created_at
       FROM bug_reports
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET single bug (public) */
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, title, description, severity, status, user_id, created_at
       FROM bug_reports WHERE id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Bug not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST create bug (auth) */
router.post("/", authenticate, async (req, res) => {
  const { title, description, severity } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "title is required" });

  try {
    const { rows } = await pool.query(
      `INSERT INTO bug_reports (title, description, severity, user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, description, severity, status, user_id, created_at`,
      [title.trim(), description ?? null, severity ?? null, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** PATCH update bug status (auth + owner/admin) */
router.patch("/:id/status", authenticate, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'Pending' | 'Approved' | 'Resolved'

  if (!["Pending", "Approved", "Resolved"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    // ensure bug exists and check ownership
    const own = await pool.query(
      "SELECT user_id FROM bug_reports WHERE id = $1",
      [id]
    );
    if (!own.rowCount) return res.status(404).json({ error: "Bug not found" });

    const isOwner = own.rows[0].user_id === req.user.id;
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { rows } = await pool.query(
      `UPDATE bug_reports
       SET status = $1
       WHERE id = $2
       RETURNING id, title, description, severity, status, user_id, created_at`,
      [status, id]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** DELETE bug (auth) */
router.delete("/:id", authenticate, async (req, res) => {
  const { id } = req.params;

  // (Optional: owner/admin guard — uncomment to enforce)
  // const own = await pool.query(`SELECT user_id FROM bug_reports WHERE id = $1`, [id]);
  // if (!own.rowCount) return res.status(404).json({ error: "Bug not found" });
  // if (own.rows[0].user_id !== req.user.id && req.user.role !== "admin") {
  //   return res.status(403).json({ error: "Forbidden" });
  // }

  try {
    const { rowCount } = await pool.query(`DELETE FROM bug_reports WHERE id = $1`, [id]);
    if (!rowCount) return res.status(404).json({ error: "Bug not found" });
    res.json({ message: "Bug deleted successfully" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



/** PUT update status/severity (auth) */
router.put("/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const { status, severity } = req.body;

  if (status !== undefined && !["Pending", "Approved", "Resolved"].includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  const sets = [];
  const vals = [];
  let i = 1;

  if (status !== undefined) { sets.push(`status = $${i++}`); vals.push(status); }
  if (severity !== undefined) { sets.push(`severity = $${i++}`); vals.push(severity); }
  if (!sets.length) return res.status(400).json({ error: "Nothing to update" });

  // (Optional: ensure only owner can update — uncomment this block to enforce)
  // const own = await pool.query(`SELECT user_id FROM bug_reports WHERE id = $1`, [id]);
  // if (!own.rowCount) return res.status(404).json({ error: "Bug not found" });
  // if (own.rows[0].user_id !== req.user.id && req.user.role !== "admin") {
  //   return res.status(403).json({ error: "Forbidden" });
  // }

  vals.push(id);
  const sql = `UPDATE bug_reports SET ${sets.join(", ")} WHERE id = $${i}
               RETURNING id, title, description, severity, status, user_id, created_at`;

  try {
    const { rows } = await pool.query(sql, vals);
    if (!rows.length) return res.status(404).json({ error: "Bug not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



export default router;
