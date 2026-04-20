import bcrypt from "bcrypt";
import { getModels } from "../db/sequelize.js";

function looksLikeBcrypt(stored) {
  return typeof stored === "string" && stored.startsWith("$2");
}

/**
 * Supports bcrypt hashes (recommended) or a plain string in `password_hash` for quick Supabase/demo rows.
 * @param {string} stored
 * @param {string} password
 */
async function passwordMatches(stored, password) {
  if (looksLikeBcrypt(stored)) {
    try {
      return await bcrypt.compare(password, stored);
    } catch {
      return false;
    }
  }
  return stored === password;
}

export async function loginUser(email, password) {
  const { User } = getModels();
  const user = await User.findOne({
    where: { email: email.toLowerCase().trim() },
  });
  if (!user) return { ok: false, code: "INVALID_CREDENTIALS" };
  const match = await passwordMatches(user.password_hash, password);
  if (!match) return { ok: false, code: "INVALID_CREDENTIALS" };
  return { ok: true, userId: user.id, email: user.email };
}
