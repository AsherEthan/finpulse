/** Collection can run continuously while editorial work waits for review. */
export function workerMode(value: string | undefined): "full" | "collection" {
  if (!value || value === "full") return "full";
  if (value === "collection") return "collection";
  throw new Error("WORKER_MODE must be full or collection");
}
