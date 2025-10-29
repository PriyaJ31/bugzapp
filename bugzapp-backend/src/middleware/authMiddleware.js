import jwt from "jsonwebtoken";

export function authenticate(req, res, next) {
  const header = req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, role }
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
