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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_name: string | null
          account_type: string | null
          created_at: string
          current_balance: number
          family_id: string
          id: string
          institution_name: string | null
          last_synced_at: string | null
          owner_member_id: string | null
          teller_account_id: string
          teller_enrollment_id: string | null
        }
        Insert: {
          account_name?: string | null
          account_type?: string | null
          created_at?: string
          current_balance?: number
          family_id: string
          id?: string
          institution_name?: string | null
          last_synced_at?: string | null
          owner_member_id?: string | null
          teller_account_id: string
          teller_enrollment_id?: string | null
        }
        Update: {
          account_name?: string | null
          account_type?: string | null
          created_at?: string
          current_balance?: number
          family_id?: string
          id?: string
          institution_name?: string | null
          last_synced_at?: string | null
          owner_member_id?: string | null
          teller_account_id?: string
          teller_enrollment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_owner_member_id_fkey"
            columns: ["owner_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_teller_enrollment_id_fkey"
            columns: ["teller_enrollment_id"]
            isOneToOne: false
            referencedRelation: "teller_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      buckets: {
        Row: {
          allocated_amount: number
          created_at: string
          display_order: number
          family_id: string
          id: string
          name: string
          owner_member_id: string | null
        }
        Insert: {
          allocated_amount?: number
          created_at?: string
          display_order?: number
          family_id: string
          id?: string
          name: string
          owner_member_id?: string | null
        }
        Update: {
          allocated_amount?: number
          created_at?: string
          display_order?: number
          family_id?: string
          id?: string
          name?: string
          owner_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buckets_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buckets_owner_member_id_fkey"
            columns: ["owner_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_bucket_order: {
        Row: {
          bucket_id: string
          display_order: number
          member_id: string
        }
        Insert: {
          bucket_id: string
          display_order: number
          member_id: string
        }
        Update: {
          bucket_id?: string
          display_order?: number
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_bucket_order_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_bucket_order_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          id: string
          join_code: string
          name: string
          plan: string
        }
        Insert: {
          created_at?: string
          id?: string
          join_code?: string
          name: string
          plan?: string
        }
        Update: {
          created_at?: string
          id?: string
          join_code?: string
          name?: string
          plan?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          avatar_url: string | null
          created_at: string
          family_id: string
          id: string
          name: string
          pin_failed_attempts: number
          pin_hash: string | null
          pin_locked: boolean
          pin_set_at: string | null
          role: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          family_id: string
          id?: string
          name: string
          pin_failed_attempts?: number
          pin_hash?: string | null
          pin_locked?: boolean
          pin_set_at?: string | null
          role: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          family_id?: string
          id?: string
          name?: string
          pin_failed_attempts?: number
          pin_hash?: string | null
          pin_locked?: boolean
          pin_set_at?: string | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      teller_enrollments: {
        Row: {
          access_token: string
          created_at: string
          enrollment_id: string
          family_id: string
          id: string
          institution_id: string | null
          institution_name: string | null
          last_synced_at: string | null
          status: string
        }
        Insert: {
          access_token: string
          created_at?: string
          enrollment_id: string
          family_id: string
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          last_synced_at?: string | null
          status?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          enrollment_id?: string
          family_id?: string
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          last_synced_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "teller_enrollments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      teller_events: {
        Row: {
          account_id: string | null
          created_at: string
          event_type: string
          family_id: string
          id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          event_type: string
          family_id: string
          id?: string
          payload: Json
          processed_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string
          event_type?: string
          family_id?: string
          id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teller_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teller_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          family_id: string
          from_bucket_id: string | null
          from_member_id: string | null
          id: string
          note: string | null
          to_bucket_id: string | null
          to_member_id: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          family_id: string
          from_bucket_id?: string | null
          from_member_id?: string | null
          id?: string
          note?: string | null
          to_bucket_id?: string | null
          to_member_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          family_id?: string
          from_bucket_id?: string | null
          from_member_id?: string | null
          id?: string
          note?: string | null
          to_bucket_id?: string | null
          to_member_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_from_bucket_id_fkey"
            columns: ["from_bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_from_member_id_fkey"
            columns: ["from_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_bucket_id_fkey"
            columns: ["to_bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_member_id_fkey"
            columns: ["to_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_family_id: { Args: never; Returns: string }
      auth_member_id: { Args: never; Returns: string }
      auth_role: { Args: never; Returns: string }
      move_money: {
        Args: {
          p_amount: number
          p_from_bucket_id: string
          p_note?: string
          p_to_bucket_id: string
        }
        Returns: string
      }
      reorder_bucket: {
        Args: { p_bucket_id: string; p_direction: string }
        Returns: undefined
      }
      ensure_member_bucket_orders: { Args: never; Returns: undefined }
      rotate_family_join_code: { Args: never; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
