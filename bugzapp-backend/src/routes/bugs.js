import { Router } from "express";
import { pool } from "../db/pool.js";

const router = Router();

/** GET all bugs */
router.get("/", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM bug_reports ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST create a new bug */
router.post("/", async (req, res) => {
  const { title, description, severity } = req.body;
  if (!title)
    return res.status(400).json({ error: "Bug title is required" });

  try {
    const { rows } = await pool.query(
      `INSERT INTO bug_reports (title, description, severity)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [title, description ?? null, severity ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** PATCH update bug status */
router.patch("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // must be 'Pending' | 'Approved' | 'Resolved'
  if (!["Pending", "Approved", "Resolved"].includes(status))
    return res.status(400).json({ error: "Invalid status" });

  try {
    const { rows } = await pool.query(
      `UPDATE bug_reports SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Bug not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** DELETE a bug (optional for cleanup) */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query(`DELETE FROM bug_reports WHERE id = $1`, [id]);
    if (rowCount === 0) return res.status(404).json({ error: "Bug not found" });
    res.json({ message: "Bug deleted successfully" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET single bug by id */
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM bug_reports WHERE id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Bug not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** PUT update status or severity (optionally both) */
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { status, severity } = req.body;

  // validate status only if provided (enum: Pending | Approved | Resolved)
  if (status !== undefined && !["Pending", "Approved", "Resolved"].includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  // build dynamic update
  const sets = [];
  const vals = [];
  let i = 1;

  if (status !== undefined) {
    sets.push(`status = $${i++}`);
    vals.push(status);
  }
  if (severity !== undefined) {
    sets.push(`severity = $${i++}`);
    vals.push(severity);
  }

  if (sets.length === 0) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  vals.push(id);
  const sql = `UPDATE bug_reports SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`;

  try {
    const { rows } = await pool.query(sql, vals);
    if (!rows.length) return res.status(404).json({ error: "Bug not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


export default router;
