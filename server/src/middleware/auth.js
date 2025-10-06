import jwt from "jsonwebtoken";

export const auth = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Chưa đăng nhập" });

  try {
    const data = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.userId = data.sub;
    req.userRole = data.role;
    next();
  } catch {
    return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};
