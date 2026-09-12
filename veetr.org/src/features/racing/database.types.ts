export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
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
      boat_members: {
        Row: {
          boat_id: string
          role: string
          user_id: string
        }
        Insert: {
          boat_id: string
          role: string
          user_id: string
        }
        Update: {
          boat_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boat_members_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boat_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      boats: {
        Row: {
          class_name: string | null
          id: string
          length_m: number | null
          name: string
          owner_id: string
          sail_number: string
          skipper_name: string | null
          updated_at: string
        }
        Insert: {
          class_name?: string | null
          id: string
          length_m?: number | null
          name: string
          owner_id: string
          sail_number: string
          skipper_name?: string | null
          updated_at?: string
        }
        Update: {
          class_name?: string | null
          id?: string
          length_m?: number | null
          name?: string
          owner_id?: string
          sail_number?: string
          skipper_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boats_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      race_categories: {
        Row: {
          id: string
          name: string
          series_id: string
        }
        Insert: {
          id: string
          name: string
          series_id: string
        }
        Update: {
          id?: string
          name?: string
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_categories_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      race_entries: {
        Row: {
          boat_id: string
          race_id: string
          series_id: string | null
        }
        Insert: {
          boat_id: string
          race_id: string
          series_id?: string | null
        }
        Update: {
          boat_id?: string
          race_id?: string
          series_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "race_entries_race_id_series_id_fkey"
            columns: ["race_id", "series_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id", "series_id"]
          },
          {
            foreignKeyName: "race_entries_series_id_boat_id_fkey"
            columns: ["series_id", "boat_id"]
            isOneToOne: false
            referencedRelation: "series_entries"
            referencedColumns: ["series_id", "boat_id"]
          },
        ]
      }
      race_officials: {
        Row: {
          role: string
          series_id: string
          user_id: string
        }
        Insert: {
          role: string
          series_id: string
          user_id: string
        }
        Update: {
          role?: string
          series_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_officials_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_officials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      race_results: {
        Row: {
          boat_id: string
          category_id: string
          finished_at: string | null
          position: number | null
          race_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          boat_id: string
          category_id: string
          finished_at?: string | null
          position?: number | null
          race_id: string
          status: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          boat_id?: string
          category_id?: string
          finished_at?: string | null
          position?: number | null
          race_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "race_results_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "race_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_race_id_boat_id_fkey"
            columns: ["race_id", "boat_id"]
            isOneToOne: true
            referencedRelation: "race_entries"
            referencedColumns: ["race_id", "boat_id"]
          },
          {
            foreignKeyName: "race_results_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      races: {
        Row: {
          id: string
          name: string
          race_date: string
          race_order: number
          series_id: string
          status: string
          weight: number
        }
        Insert: {
          id: string
          name: string
          race_date: string
          race_order: number
          series_id: string
          status: string
          weight: number
        }
        Update: {
          id?: string
          name?: string
          race_date?: string
          race_order?: number
          series_id?: string
          status?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "races_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          created_at: string
          description: string
          document: Json
          id: string
          name: string
          owner_id: string
          revision: number
          status: string
          updated_at: string
          updated_by: string | null
          year: number
        }
        Insert: {
          created_at?: string
          description?: string
          document: Json
          id: string
          name: string
          owner_id: string
          revision?: number
          status: string
          updated_at?: string
          updated_by?: string | null
          year: number
        }
        Update: {
          created_at?: string
          description?: string
          document?: Json
          id?: string
          name?: string
          owner_id?: string
          revision?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "series_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      series_changes: {
        Row: {
          actor_id: string
          created_at: string
          document: Json
          mutation_id: string
          revision: number
          series_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          document: Json
          mutation_id: string
          revision: number
          series_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          document?: Json
          mutation_id?: string
          revision?: number
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_changes_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_changes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      series_entries: {
        Row: {
          boat_id: string
          category_id: string
          series_id: string
        }
        Insert: {
          boat_id: string
          category_id: string
          series_id: string
        }
        Update: {
          boat_id?: string
          category_id?: string
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_entries_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_entries_category_id_series_id_fkey"
            columns: ["category_id", "series_id"]
            isOneToOne: false
            referencedRelation: "race_categories"
            referencedColumns: ["id", "series_id"]
          },
          {
            foreignKeyName: "series_entries_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_race_entity: { Args: {series_id: string; expected_revision: number; event_id?: string; heat_id?: string}; Returns: undefined };
      delete_boat: { Args: {boat_id: string}; Returns: undefined };
      boat_directory: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      boat_results: {
        Args: {
          boat_id: string
        }
        Returns: Json
      }
      can_edit_boat: {
        Args: {
          boat_id: string
        }
        Returns: boolean
      }
      create_boat: {
        Args: {
          boat_id: string
          boat_name: string
          boat_class: string
          boat_length?: number
        }
        Returns: string
      }
      is_official: {
        Args: {
          sid: string
          admin_only?: boolean
        }
        Returns: boolean
      }
      public_series_directory: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      public_standings: {
        Args: {
          series_id: string
        }
        Returns: Json
      }
      save_series: {
        Args: {
          payload: Json
          expected_revision: number
          mutation_id: string
        }
        Returns: number
      }
      series_team: {
        Args: {
          series_id: string
        }
        Returns: Json
      }
      set_race_official: {
        Args: {
          series_id: string
          official_id: string
          official_role: string
        }
        Returns: undefined
      }
      set_series_member: {
        Args: {
          series_id: string
          member_email: string
          member_role: string
        }
        Returns: undefined
      }
      update_boat: {
        Args: {
          boat_id: string
          boat_name: string
          boat_class: string
          boat_length: number
          expected: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_insert_object: {
        Args: {
          bucketid: string
          name: string
          owner: string
          metadata: Json
        }
        Returns: undefined
      }
      extension: {
        Args: {
          name: string
        }
        Returns: string
      }
      filename: {
        Args: {
          name: string
        }
        Returns: string
      }
      foldername: {
        Args: {
          name: string
        }
        Returns: string[]
      }
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>
        Returns: {
          size: number
          bucket_id: string
        }[]
      }
      search: {
        Args: {
          prefix: string
          bucketname: string
          limits?: number
          levels?: number
          offsets?: number
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

