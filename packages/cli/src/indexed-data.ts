import { PostgrestClient } from "@supabase/postgrest-js";

interface IndexedConfig { apiUrl?: string; supabaseUrl?: string; supabaseAnonKey?: string }
export interface IndexedStoryline {
  title: string; writer_address: string; token_address: string; has_deadline: boolean;
  plot_count: number; last_plot_time: string | null; sunset: boolean;
  writer_type: number | null; block_timestamp: string | null;
}

/** Indexed reads need no wallet or signing credential. Legacy config still works. */
export async function readIndexedStoryline(config: IndexedConfig, id: number, factory: string): Promise<IndexedStoryline | null> {
  const publicUrl = config.apiUrl?.replace(/\/+$/, "");
  const cloud = config.supabaseUrl && config.supabaseAnonKey;
  if (!publicUrl && !cloud) return null;
  const client = new PostgrestClient(publicUrl ? `${publicUrl}/api/public-data` : `${config.supabaseUrl!.replace(/\/+$/, "")}/rest/v1`, {
    headers: publicUrl ? {} : { apikey: config.supabaseAnonKey!, Authorization: `Bearer ${config.supabaseAnonKey}` },
  });
  const { data } = await client.from("storylines")
    .select("title, writer_address, token_address, has_deadline, plot_count, last_plot_time, sunset, writer_type, block_timestamp")
    .eq("storyline_id", id).eq("contract_address", factory.toLowerCase()).single();
  return data as IndexedStoryline | null;
}
