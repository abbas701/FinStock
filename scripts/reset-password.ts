import "dotenv/config";
import { getDb, getUserByEmail } from "../server/db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { sdk } from "../server/_core/sdk";

async function main() {
    console.log("Resetting admin password...");

    const db = await getDb();
    if (!db) {
        throw new Error("Database connection failed");
    }

    const email = "admin@example.com";
    const newPassword = "password123";

    // 1. Check if user exists
    const existingUser = await getUserByEmail(email);
    if (!existingUser) {
        console.log(`User ${email} does not exist. Creating...`);
        // Create new
        const hashedPassword = await sdk.hashPassword(newPassword);
        await db.insert(users).values({
            email,
            name: "Admin User",
            password: hashedPassword,
            role: "admin",
            loginMethod: "password",
            openId: null,
            lastSignedIn: new Date()
        });
        console.log("User created.");
    } else {
        console.log(`User ${email} found (ID: ${existingUser.id}). Updating password...`);
        const hashedPassword = await sdk.hashPassword(newPassword);

        // Direct update to avoid any upsert complexity
        await db.update(users)
            .set({
                password: hashedPassword,
                loginMethod: "password",
                updatedAt: new Date()
            })
            .where(eq(users.id, existingUser.id));

        console.log("Password updated successfully.");
    }

    // Verify
    const verifiedUser = await getUserByEmail(email);
    console.log("Verification:");
    console.log(`- Email: ${verifiedUser?.email}`);
    console.log(`- Has Password: ${!!verifiedUser?.password}`);
    console.log(`- Login Method: ${verifiedUser?.loginMethod}`);

    if (verifiedUser?.password) {
        const match = await sdk.comparePassword(newPassword, verifiedUser.password);
        console.log(`- Password Match Check: ${match ? "PASS" : "FAIL"}`);
    }
}

main()
    .catch(e => {
        console.error("Error:", e);
        process.exit(1);
    });
