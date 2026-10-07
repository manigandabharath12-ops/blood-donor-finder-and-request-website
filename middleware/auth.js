const jwt = require("jsonwebtoken");

// Verify the bearer token and attach only the donor ID to the request.
module.exports = function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Please log in to continue." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.donorId = payload.donorId;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Your session is invalid or has expired. Please log in again." });
  }
};
