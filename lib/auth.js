import { getAdminAuth } from "./firebaseAdmin.js";
import { HttpError, apiError } from "./errors.js";
export async function requireStaff(
  req,
  verify = (token) => getAdminAuth().verifyIdToken(token, true),
) {
  const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || "");
  if (!match) throw new HttpError(401, "A staff sign-in token is required.");
  let claims;
  try {
    claims = await verify(match[1]);
  } catch (err) {
    if (
      err.code?.startsWith("auth/") &&
      !["auth/internal-error", "auth/invalid-credential"].includes(err.code)
    )
      throw new HttpError(
        401,
        "Session is invalid or expired. Please sign in again.",
      );
    throw err;
  }
  return claims;
}
export function withStaff(handler, authorize = requireStaff) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      req.staff = await authorize(req);
      return await handler(req, res);
    } catch (error) {
      return apiError(res, error);
    }
  };
}
