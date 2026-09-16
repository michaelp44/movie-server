import type { Json, RsvpStatus, SyncItemAction, SyncMode, SyncStatus } from "@/lib/types";

type Timestamps = {
  created_at: string;
  updated_at: string;
};

type TimestampInsert = {
  created_at?: string;
  updated_at?: string;
};

export type Database = {
  public: {
    Tables: {
      wedding_tables: {
        Row: Timestamps & {
          id: string;
          table_number: string;
          name: string | null;
          capacity: number | null;
          notes: string | null;
          sort_order: number;
        };
        Insert: TimestampInsert & {
          id?: string;
          table_number: string;
          name?: string | null;
          capacity?: number | null;
          notes?: string | null;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["wedding_tables"]["Insert"]>;
        Relationships: [];
      };
      invitations: {
        Row: Timestamps & {
          id: string;
          display_name: string;
          primary_phone: string | null;
          normalized_phone: string | null;
          number_invited: number;
          number_confirmed: number;
          rsvp_status: RsvpStatus;
          table_number: string | null;
          guest_group: string | null;
          secure_token: string;
          source_row_id: string | null;
          source_tab: string | null;
          source_payload: Json;
          source_hash: string | null;
          missing_from_source: boolean;
          last_synced_at: string | null;
          sync_managed: boolean;
          admin_notes: string | null;
        };
        Insert: TimestampInsert & {
          id?: string;
          display_name: string;
          primary_phone?: string | null;
          normalized_phone?: string | null;
          number_invited?: number;
          number_confirmed?: number;
          rsvp_status?: RsvpStatus;
          table_number?: string | null;
          guest_group?: string | null;
          secure_token?: string;
          source_row_id?: string | null;
          source_tab?: string | null;
          source_payload?: Json;
          source_hash?: string | null;
          missing_from_source?: boolean;
          last_synced_at?: string | null;
          sync_managed?: boolean;
          admin_notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["invitations"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "invitations_table_number_fkey";
            columns: ["table_number"];
            isOneToOne: false;
            referencedRelation: "wedding_tables";
            referencedColumns: ["table_number"];
          },
        ];
      };
      guests: {
        Row: Timestamps & {
          id: string;
          invitation_id: string;
          first_name: string;
          last_name: string | null;
          phone: string | null;
          normalized_phone: string | null;
          relationship_category: string | null;
          guest_order: number;
        };
        Insert: TimestampInsert & {
          id?: string;
          invitation_id: string;
          first_name: string;
          last_name?: string | null;
          phone?: string | null;
          normalized_phone?: string | null;
          relationship_category?: string | null;
          guest_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["guests"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "guests_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
        ];
      };
      photo_uploads: {
        Row: Timestamps & {
          id: string;
          invitation_id: string | null;
          uploader_name: string | null;
          table_number: string | null;
          storage_path: string;
          mime_type: string;
          media_kind: "image" | "video";
          file_size: number;
          upload_completed: boolean;
          upload_token_hash: string | null;
          approved: boolean;
          rejected: boolean;
          moderated_at: string | null;
          moderated_by: string | null;
          message: string | null;
          moderation_status: "PENDING" | "APPROVED" | "NEEDS_REVIEW" | "BLOCKED";
          moderation_reason: string | null;
          moderation_categories: Json;
          moderation_confidence: number | null;
          approved_at: string | null;
          hidden_at: string | null;
          illustration_path: string | null;
          illustration_status: "PENDING" | "GENERATING" | "READY" | "SKIPPED" | "FAILED" | "BLOCKED";
          illustration_created_at: string | null;
        };
        Insert: TimestampInsert & {
          id?: string;
          invitation_id?: string | null;
          uploader_name?: string | null;
          table_number?: string | null;
          storage_path: string;
          mime_type: string;
          media_kind: "image" | "video";
          file_size: number;
          upload_completed?: boolean;
          upload_token_hash?: string | null;
          approved?: boolean;
          rejected?: boolean;
          moderated_at?: string | null;
          moderated_by?: string | null;
          message?: string | null;
          moderation_status?: "PENDING" | "APPROVED" | "NEEDS_REVIEW" | "BLOCKED";
          moderation_reason?: string | null;
          moderation_categories?: Json;
          moderation_confidence?: number | null;
          approved_at?: string | null;
          hidden_at?: string | null;
          illustration_path?: string | null;
          illustration_status?: "PENDING" | "GENERATING" | "READY" | "SKIPPED" | "FAILED" | "BLOCKED";
          illustration_created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["photo_uploads"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "photo_uploads_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
        ];
      };
      guestbook_messages: {
        Row: Timestamps & {
          id: string;
          invitation_id: string | null;
          display_name: string;
          message: string;
          approved: boolean;
          rejected: boolean;
          moderated_at: string | null;
          moderated_by: string | null;
          moderation_status: "PENDING" | "APPROVED" | "NEEDS_REVIEW" | "BLOCKED";
          moderation_reason: string | null;
          moderation_categories: Json;
          moderation_confidence: number | null;
          approved_at: string | null;
          hidden_at: string | null;
        };
        Insert: TimestampInsert & {
          id?: string;
          invitation_id?: string | null;
          display_name: string;
          message: string;
          approved?: boolean;
          rejected?: boolean;
          moderated_at?: string | null;
          moderated_by?: string | null;
          moderation_status?: "PENDING" | "APPROVED" | "NEEDS_REVIEW" | "BLOCKED";
          moderation_reason?: string | null;
          moderation_categories?: Json;
          moderation_confidence?: number | null;
          approved_at?: string | null;
          hidden_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["guestbook_messages"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "guestbook_messages_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
        ];
      };
      song_requests: {
        Row: Timestamps & {
          id: string;
          invitation_id: string | null;
          display_name: string | null;
          song: string;
          artist: string;
        };
        Insert: TimestampInsert & {
          id?: string;
          invitation_id?: string | null;
          display_name?: string | null;
          song: string;
          artist: string;
        };
        Update: Partial<Database["public"]["Tables"]["song_requests"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "song_requests_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
        ];
      };
      site_settings: {
        Row: Timestamps & {
          key: string;
          value: Json;
          description: string | null;
        };
        Insert: TimestampInsert & {
          key: string;
          value: Json;
          description?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["site_settings"]["Insert"]>;
        Relationships: [];
      };
      live_wall_reactions: {
        Row: {
          id: string;
          invitation_id: string | null;
          session_hash: string;
          emoji: "❤️" | "🔥" | "😂" | "🥂";
          created_at: string;
        };
        Insert: {
          id?: string;
          invitation_id?: string | null;
          session_hash: string;
          emoji: "❤️" | "🔥" | "😂" | "🥂";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["live_wall_reactions"]["Insert"]>;
        Relationships: [];
      };
      photo_likes: {
        Row: {
          id: string;
          photo_id: string;
          invitation_id: string | null;
          visitor_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          photo_id: string;
          invitation_id?: string | null;
          visitor_hash: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["photo_likes"]["Insert"]>;
        Relationships: [];
      };
      sync_runs: {
        Row: {
          id: string;
          status: SyncStatus;
          mode: SyncMode;
          source_sheet_id: string;
          source_tab: string;
          initiated_by: string | null;
          processed_count: number;
          addition_count: number;
          update_count: number;
          unchanged_count: number;
          conflict_count: number;
          missing_count: number;
          error_count: number;
          report: Json;
          error: string | null;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          status?: SyncStatus;
          mode: SyncMode;
          source_sheet_id: string;
          source_tab: string;
          initiated_by?: string | null;
          processed_count?: number;
          addition_count?: number;
          update_count?: number;
          unchanged_count?: number;
          conflict_count?: number;
          missing_count?: number;
          error_count?: number;
          report?: Json;
          error?: string | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["sync_runs"]["Insert"]>;
        Relationships: [];
      };
      sync_run_items: {
        Row: {
          id: string;
          sync_run_id: string;
          invitation_id: string | null;
          source_row_id: string | null;
          action: SyncItemAction;
          display_name: string | null;
          changes: Json;
          source_payload: Json;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sync_run_id: string;
          invitation_id?: string | null;
          source_row_id?: string | null;
          action: SyncItemAction;
          display_name?: string | null;
          changes?: Json;
          source_payload?: Json;
          error?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sync_run_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "sync_run_items_sync_run_id_fkey";
            columns: ["sync_run_id"];
            isOneToOne: false;
            referencedRelation: "sync_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sync_run_items_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limits: {
        Row: {
          action: string;
          identifier_hash: string;
          bucket_start: string;
          request_count: number;
          expires_at: string;
        };
        Insert: {
          action: string;
          identifier_hash: string;
          bucket_start: string;
          request_count?: number;
          expires_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["rate_limits"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      consume_rate_limit: {
        Args: {
          p_action: string;
          p_identifier_hash: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: {
          allowed: boolean;
          remaining: number;
          reset_at: string;
        }[];
      };
    };
    Enums: {
      rsvp_status: RsvpStatus;
      sync_mode: SyncMode;
      sync_status: SyncStatus;
      sync_item_action: SyncItemAction;
    };
    CompositeTypes: Record<never, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
