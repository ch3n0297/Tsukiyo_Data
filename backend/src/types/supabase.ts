export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_configs: {
        Row: {
          account_id: string
          client_name: string
          created_at: string | null
          id: string
          platform: string
          refresh_days: number
          sheet_id: string | null
          sheet_tab: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          client_name: string
          created_at?: string | null
          id?: string
          platform: string
          refresh_days?: number
          sheet_id?: string | null
          sheet_tab?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          client_name?: string
          created_at?: string | null
          id?: string
          platform?: string
          refresh_days?: number
          sheet_id?: string | null
          sheet_tab?: string | null
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          account_config_id: string
          account_id: string | null
          account_key: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          platform: string | null
          queued_at: string | null
          refresh_days: number
          request_source: string | null
          started_at: string | null
          status: string
          system_message: string | null
          trigger_source: string
          user_id: string
        }
        Insert: {
          account_config_id: string
          account_id?: string | null
          account_key?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          platform?: string | null
          queued_at?: string | null
          refresh_days: number
          request_source?: string | null
          started_at?: string | null
          status?: string
          system_message?: string | null
          trigger_source: string
          user_id: string
        }
        Update: {
          account_config_id?: string
          account_id?: string | null
          account_key?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          platform?: string | null
          queued_at?: string | null
          refresh_days?: number
          request_source?: string | null
          started_at?: string | null
          status?: string
          system_message?: string | null
          trigger_source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_account_config_id_fkey"
            columns: ["account_config_id"]
            isOneToOne: false
            referencedRelation: "account_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      normalized_records: {
        Row: {
          account_id: string
          caption: string | null
          comment_count: number | null
          created_at: string | null
          extra_data: Json | null
          id: string
          job_id: string | null
          like_count: number | null
          media_type: string | null
          platform: string
          post_id: string
          post_timestamp: string | null
          share_count: number | null
          user_id: string
          view_count: number | null
        }
        Insert: {
          account_id: string
          caption?: string | null
          comment_count?: number | null
          created_at?: string | null
          extra_data?: Json | null
          id?: string
          job_id?: string | null
          like_count?: number | null
          media_type?: string | null
          platform: string
          post_id: string
          post_timestamp?: string | null
          share_count?: number | null
          user_id: string
          view_count?: number | null
        }
        Update: {
          account_id?: string
          caption?: string | null
          comment_count?: number | null
          created_at?: string | null
          extra_data?: Json | null
          id?: string
          job_id?: string | null
          like_count?: number | null
          media_type?: string | null
          platform?: string
          post_id?: string
          post_timestamp?: string | null
          share_count?: number | null
          user_id?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "normalized_records_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_tokens: {
        Row: {
          access_token: string
          account_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          platform: string
          refresh_token: string | null
          scopes: string[] | null
          token_metadata: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          account_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          platform: string
          refresh_token?: string | null
          scopes?: string[] | null
          token_metadata?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          account_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          platform?: string
          refresh_token?: string | null
          scopes?: string[] | null
          token_metadata?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      raw_records: {
        Row: {
          account_id: string
          fetched_at: string | null
          id: string
          job_id: string | null
          platform: string
          post_id: string
          raw_data: Json
          user_id: string
        }
        Insert: {
          account_id: string
          fetched_at?: string | null
          id?: string
          job_id?: string | null
          platform: string
          post_id: string
          raw_data: Json
          user_id: string
        }
        Update: {
          account_id?: string
          fetched_at?: string | null
          id?: string
          job_id?: string | null
          platform?: string
          post_id?: string
          raw_data?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_records_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_snapshots: {
        Row: {
          account_config_id: string
          current_job_id: string | null
          id: string
          last_success_at: string | null
          refresh_status: string | null
          system_message: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_config_id: string
          current_job_id?: string | null
          id?: string
          last_success_at?: string | null
          refresh_status?: string | null
          system_message?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_config_id?: string
          current_job_id?: string | null
          id?: string
          last_success_at?: string | null
          refresh_status?: string | null
          system_message?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheet_snapshots_account_config_id_fkey"
            columns: ["account_config_id"]
            isOneToOne: false
            referencedRelation: "account_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheet_snapshots_current_job_id_fkey"
            columns: ["current_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
