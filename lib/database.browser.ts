import { PostgrestClient } from "@supabase/postgrest-js";
import type { Database } from "./supabase";

// The same-origin gateway accepts only public reads. No JWT reaches the browser.
export const supabase = typeof window === "undefined"
  ? null
  : new PostgrestClient<Database>(`${window.location.origin}/api/public-data`);
