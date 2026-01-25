import { getDb } from "./db";
import { passwordResetTokens } from "../drizzle/schema";
import { eq, gt } from "drizzle-orm";
import { nanoid } from "nanoid";

const TOKEN_EXPIRY_MS = 1000 * 60 * 60; // 1 hour

export async function createPasswordResetToken(userId: number) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    await db.insert(passwordResetTokens).values({
        userId,
        token,
        expiresAt,
    });

    return token;
}

export async function verifyPasswordResetToken(token: string) {
    const db = await getDb();
    if (!db) return null;

    const results = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, token))
        .limit(1);

    if (results.length === 0) return null;

    const record = results[0];

    if (record.expiresAt < new Date()) {
        // Deleted expired token (optional cleanup)
        await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
        return null;
    }

    return record;
}

export async function deletePasswordResetToken(token: string) {
    const db = await getDb();
    if (!db) return;
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
}
