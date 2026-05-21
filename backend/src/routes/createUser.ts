import { db } from "../db";

// POST /api/users
// Body: { name: string }
export async function handleCreateUser(body: any) {
  const { name } = body;
  const result = db.run(`INSERT INTO users (name) VALUES (?)`, [name]);
  return { success: true, userId: result.lastInsertRowid, name };
}
