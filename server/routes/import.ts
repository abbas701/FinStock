import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { importExcelFile } from "../excel-import";

export const importRouter = router({
  /**
   * Import Excel file
   */
  excel: protectedProcedure
    .input(z.object({ fileData: z.string(), filename: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const fileBuffer = Buffer.from(input.fileData, "base64");
        const result = await importExcelFile(fileBuffer, input.filename);
        return result;
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to import Excel: ${error.message}`,
        });
      }
    }),
});

