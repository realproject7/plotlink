import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Browser-side client (anon key, respects RLS)
export const supabase: SupabaseClient<Database> | null =
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey)
    : null;

// Server-side client (service role, bypasses RLS)
export function createServerClient(): SupabaseClient<Database> | null {
  return createServiceRoleClient();
}

// Explicit service-role client for admin / privileged operations.
// Uses SUPABASE_SERVICE_ROLE_KEY — never expose to the browser.
export function createServiceRoleClient(): SupabaseClient<Database> | null {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ---------------------------------------------------------------------------
// Database types
// ---------------------------------------------------------------------------

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      storylines: {
        Row: {
          id: number;
          storyline_id: number;
          writer_address: string;
          token_address: string;
          title: string;
          plot_count: number;
          last_plot_time: string | null;
          has_deadline: boolean;
          sunset: boolean;
          writer_type: number | null;
          hidden: boolean;
          tx_hash: string;
          log_index: number;
          block_timestamp: string | null;
          indexed_at: string;
          view_count: number;
          contract_address: string;
        };
        Insert: {
          id?: never;
          storyline_id: number;
          writer_address: string;
          token_address: string;
          title: string;
          plot_count?: number;
          last_plot_time?: string | null;
          has_deadline?: boolean;
          sunset?: boolean;
          writer_type?: number | null;
          hidden?: boolean;
          tx_hash: string;
          log_index: number;
          block_timestamp?: string | null;
          indexed_at?: string;
          view_count?: number;
          contract_address: string;
        };
        Update: {
          id?: never;
          storyline_id?: number;
          writer_address?: string;
          token_address?: string;
          title?: string;
          plot_count?: number;
          last_plot_time?: string | null;
          has_deadline?: boolean;
          sunset?: boolean;
          writer_type?: number | null;
          hidden?: boolean;
          tx_hash?: string;
          log_index?: number;
          block_timestamp?: string | null;
          indexed_at?: string;
          view_count?: number;
          contract_address?: string;
        };
        Relationships: [];
      };
      page_views: {
        Row: {
          id: number;
          storyline_id: number;
          plot_index: number | null;
          viewer_address: string | null;
          session_id: string;
          viewed_at: string;
          contract_address: string;
        };
        Insert: {
          id?: never;
          storyline_id: number;
          plot_index?: number | null;
          viewer_address?: string | null;
          session_id: string;
          viewed_at?: string;
          contract_address: string;
        };
        Update: {
          id?: never;
          storyline_id?: number;
          plot_index?: number | null;
          viewer_address?: string | null;
          session_id?: string;
          viewed_at?: string;
          contract_address?: string;
        };
        Relationships: [];
      };
      plots: {
        Row: {
          id: number;
          storyline_id: number;
          plot_index: number;
          writer_address: string;
          title: string;
          content: string | null;
          content_cid: string;
          content_hash: string;
          hidden: boolean;
          tx_hash: string;
          log_index: number;
          block_timestamp: string | null;
          indexed_at: string;
          contract_address: string;
        };
        Insert: {
          id?: never;
          storyline_id: number;
          plot_index: number;
          writer_address: string;
          title?: string;
          content?: string | null;
          content_cid: string;
          content_hash: string;
          hidden?: boolean;
          tx_hash: string;
          log_index: number;
          block_timestamp?: string | null;
          indexed_at?: string;
          contract_address: string;
        };
        Update: {
          id?: never;
          storyline_id?: number;
          plot_index?: number;
          writer_address?: string;
          title?: string;
          content?: string | null;
          content_cid?: string;
          content_hash?: string;
          hidden?: boolean;
          tx_hash?: string;
          log_index?: number;
          block_timestamp?: string | null;
          indexed_at?: string;
          contract_address?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          id: number;
          storyline_id: number;
          plot_index: number;
          commenter_address: string;
          content: string;
          created_at: string;
          hidden: boolean;
          contract_address: string;
        };
        Insert: {
          id?: never;
          storyline_id: number;
          plot_index: number;
          commenter_address: string;
          content: string;
          created_at?: string;
          hidden?: boolean;
          contract_address: string;
        };
        Update: {
          id?: never;
          storyline_id?: number;
          plot_index?: number;
          commenter_address?: string;
          content?: string;
          created_at?: string;
          hidden?: boolean;
          contract_address?: string;
        };
        Relationships: [];
      };
      donations: {
        Row: {
          id: number;
          storyline_id: number;
          donor_address: string;
          amount: string;
          tx_hash: string;
          log_index: number;
          block_timestamp: string | null;
          indexed_at: string;
          contract_address: string;
        };
        Insert: {
          id?: never;
          storyline_id: number;
          donor_address: string;
          amount: string;
          tx_hash: string;
          log_index: number;
          block_timestamp?: string | null;
          indexed_at?: string;
          contract_address: string;
        };
        Update: {
          id?: never;
          storyline_id?: number;
          donor_address?: string;
          amount?: string;
          tx_hash?: string;
          log_index?: number;
          block_timestamp?: string | null;
          indexed_at?: string;
          contract_address?: string;
        };
        Relationships: [];
      };
      ratings: {
        Row: {
          id: number;
          storyline_id: number;
          rater_address: string;
          rating: number;
          comment: string | null;
          created_at: string;
          updated_at: string;
          contract_address: string;
        };
        Insert: {
          id?: never;
          storyline_id: number;
          rater_address: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
          contract_address: string;
        };
        Update: {
          id?: never;
          storyline_id?: number;
          rater_address?: string;
          rating?: number;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
          contract_address?: string;
        };
        Relationships: [];
      };
      backfill_cursor: {
        Row: {
          id: number;
          last_block: number;
          updated_at: string;
        };
        Insert: {
          id?: number;
          last_block: number;
          updated_at?: string;
        };
        Update: {
          id?: number;
          last_block?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      increment_view_count: {
        Args: { sid: number; caddr: string };
        Returns: void;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Convenience type aliases
export type Storyline = Database["public"]["Tables"]["storylines"]["Row"];
export type Plot = Database["public"]["Tables"]["plots"]["Row"];
export type Donation = Database["public"]["Tables"]["donations"]["Row"];
export type Rating = Database["public"]["Tables"]["ratings"]["Row"];
export type Comment = Database["public"]["Tables"]["comments"]["Row"];
