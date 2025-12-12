// NOTE: The original storage proxy helper (which uploaded files to an
// external service) has been intentionally disabled. This project is
// being simplified to keep persistence in PostgreSQL. Image generation
// now returns data URLs; do not call these helpers.

export async function storagePut(): Promise<never> {
  throw new Error(
    "storagePut was removed. Image generation returns data URLs. Remove storage usage or set BUILT_IN_FORGE_* to re-enable (not recommended)."
  );
}

export async function storageGet(): Promise<never> {
  throw new Error(
    "storageGet was removed. Image storage disabled."
  );
}
