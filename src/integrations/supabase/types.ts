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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      checklists: {
        Row: {
          created_at: string
          date: string
          equipment_id: string
          hour_meter: number
          id: string
          items: Json
          operator_name: string
          status: string
        }
        Insert: {
          created_at?: string
          date?: string
          equipment_id: string
          hour_meter: number
          id?: string
          items?: Json
          operator_name: string
          status?: string
        }
        Update: {
          created_at?: string
          date?: string
          equipment_id?: string
          hour_meter?: number
          id?: string
          items?: Json
          operator_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
        ]
      }
      equipments: {
        Row: {
          created_at: string
          current_fuel: number | null
          current_hour_meter: number
          fuel_capacity: number | null
          id: string
          model: string | null
          name: string
          plate: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_fuel?: number | null
          current_hour_meter?: number
          fuel_capacity?: number | null
          id?: string
          model?: string | null
          name: string
          plate?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_fuel?: number | null
          current_hour_meter?: number
          fuel_capacity?: number | null
          id?: string
          model?: string | null
          name?: string
          plate?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      fuel_records: {
        Row: {
          combo_equipment_id: string
          created_at: string
          date: string
          id: string
          liters: number
          operator_name: string
          target_equipment_id: string
        }
        Insert: {
          combo_equipment_id: string
          created_at?: string
          date?: string
          id?: string
          liters: number
          operator_name: string
          target_equipment_id: string
        }
        Update: {
          combo_equipment_id?: string
          created_at?: string
          date?: string
          id?: string
          liters?: number
          operator_name?: string
          target_equipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_records_combo_equipment_id_fkey"
            columns: ["combo_equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_records_target_equipment_id_fkey"
            columns: ["target_equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_supply_records: {
        Row: {
          combo_equipment_id: string
          created_at: string
          date: string
          id: string
          invoice_number: string | null
          liters: number
          notes: string | null
          responsible_name: string
          supplier: string | null
        }
        Insert: {
          combo_equipment_id: string
          created_at?: string
          date?: string
          id?: string
          invoice_number?: string | null
          liters: number
          notes?: string | null
          responsible_name: string
          supplier?: string | null
        }
        Update: {
          combo_equipment_id?: string
          created_at?: string
          date?: string
          id?: string
          invoice_number?: string | null
          liters?: number
          notes?: string | null
          responsible_name?: string
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_supply_records_combo_equipment_id_fkey"
            columns: ["combo_equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_plans: {
        Row: {
          created_at: string
          description: string
          equipment_id: string
          id: string
          interval_hours: number
          last_done_at: number
          last_executed_at: string | null
          next_due_at: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          equipment_id: string
          id?: string
          interval_hours: number
          last_done_at?: number
          last_executed_at?: string | null
          next_due_at: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          equipment_id?: string
          id?: string
          interval_hours?: number
          last_done_at?: number
          last_executed_at?: string | null
          next_due_at?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_plans_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          created_at: string
          description: string
          equipment_id: string
          id: string
          notes: string | null
          operator_name: string
          priority: string
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          equipment_id: string
          id?: string
          notes?: string | null
          operator_name: string
          priority?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          equipment_id?: string
          id?: string
          notes?: string | null
          operator_name?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
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
