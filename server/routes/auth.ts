import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { upsertUser, getUserByEmail, getUserByOpenId } from "../db";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { ENV } from "../_core/env";

export const authRouter = router({
  signup: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1),
        role: z.enum(["user", "admin"]).optional().default("user"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existingUser = await getUserByEmail(input.email);
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User with this email already exists",
        });
      }

      const hashedPassword = await sdk.hashPassword(input.password);
      // We use email as openId for password users to keep uniqueness constraint if needed, 
      // or we just trust the new schema which allows openId to be optional if we relaxed it.
      // But the schema currently strictly enforces openId unique IF not null.
      // The updated schema has openId nullable? Let's check. 
      // I made openId nullable in my previous edit? 
      // "openId: varchar("openId", { length: 64 }).unique()" -> It doesn't say notNull(). 
      // So it is nullable.

      await upsertUser({
        email: input.email,
        password: hashedPassword,
        name: input.name,
        role: input.role,
        loginMethod: "password",
        openId: null, // Explicitly null for password users
      });

      return { success: true };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await getUserByEmail(input.email);
      if (!user || !user.password) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const isValid = await sdk.comparePassword(input.password, user.password);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // Create session
      const sessionToken = await sdk.createSessionToken(user.id, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
        type: 'userId'
      });

      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: ONE_YEAR_MS,
        path: "/",
      });

      return { success: true, user };
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie(COOKIE_NAME);
    return { success: true };
  }),

  me: publicProcedure.query(({ ctx }) => {
    return ctx.user || null;
  }),

  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const user = await getUserByEmail(input.email);
      if (user) {
        const { createPasswordResetToken } = await import("../auth-utils");
        const token = await createPasswordResetToken(user.id);
        const appBaseUrl = ENV.appBaseUrl || "http://localhost:3000";
        // In a real app, send email here. For now, log link.
        console.log(
          `[Auth] Password reset link for ${input.email}: ${appBaseUrl}/reset-password?token=${token}`
        );
      }
      // Always return success to prevent email enumeration
      return { success: true };
    }),

  resetPassword: publicProcedure
    .input(z.object({ token: z.string(), newPassword: z.string().min(8) }))
    .mutation(async ({ input }) => {
      const { verifyPasswordResetToken, deletePasswordResetToken } = await import("../auth-utils");
      const record = await verifyPasswordResetToken(input.token);
      if (!record) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired reset token",
        });
      }

      const hashedPassword = await sdk.hashPassword(input.newPassword);
      await upsertUser({
        id: record.userId,
        password: hashedPassword,
        updatedAt: new Date(),
      } as any); // Type cast if necessary as partial update

      await deletePasswordResetToken(input.token);

      return { success: true };
    }),
});
