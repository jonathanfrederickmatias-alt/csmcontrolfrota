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
          observations: string | null
          operator_name: string
          photo_url: string | null
          status: string
          tenant_id: string
          type: string
        }
        Insert: {
          created_at?: string
          date?: string
          equipment_id: string
          hour_meter: number
          id?: string
          items?: Json
          observations?: string | null
          operator_name: string
          photo_url?: string | null
          status?: string
          tenant_id: string
          type?: string
        }
        Update: {
          created_at?: string
          date?: string
          equipment_id?: string
          hour_meter?: number
          id?: string
          items?: Json
          observations?: string | null
          operator_name?: string
          photo_url?: string | null
          status?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_documents: {
        Row: {
          created_at: string
          document_name: string | null
          document_number: string | null
          document_type: string
          equipment_id: string
          expiry_date: string | null
          id: string
          issue_date: string | null
          notes: string | null
          photo_url: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_name?: string | null
          document_number?: string | null
          document_type: string
          equipment_id: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          photo_url?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_name?: string | null
          document_number?: string | null
          document_type?: string
          equipment_id?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          photo_url?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipments: {
        Row: {
          brand: string | null
          chassis: string | null
          cost_center: string | null
          cost_per_hour: number
          created_at: string
          current_fuel: number | null
          current_hour_meter: number
          fuel_capacity: number | null
          id: string
          model: string | null
          name: string
          obra_id: string | null
          ownership: string
          plate: string | null
          status: string
          tenant_id: string
          track_hour_meter: boolean
          type: string
          updated_at: string
          year: number | null
        }
        Insert: {
          brand?: string | null
          chassis?: string | null
          cost_center?: string | null
          cost_per_hour?: number
          created_at?: string
          current_fuel?: number | null
          current_hour_meter?: number
          fuel_capacity?: number | null
          id?: string
          model?: string | null
          name: string
          obra_id?: string | null
          ownership?: string
          plate?: string | null
          status?: string
          tenant_id: string
          track_hour_meter?: boolean
          type: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          brand?: string | null
          chassis?: string | null
          cost_center?: string | null
          cost_per_hour?: number
          created_at?: string
          current_fuel?: number | null
          current_hour_meter?: number
          fuel_capacity?: number | null
          id?: string
          model?: string | null
          name?: string
          obra_id?: string | null
          ownership?: string
          plate?: string | null
          status?: string
          tenant_id?: string
          track_hour_meter?: boolean
          type?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipments_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipments_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_pins: {
        Row: {
          created_at: string
          id: string
          pin: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pin?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pin?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_pins_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_pins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_price_settings: {
        Row: {
          created_at: string
          fuel_type: string
          id: string
          tenant_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fuel_type: string
          id?: string
          tenant_id: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fuel_type?: string
          id?: string
          tenant_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_price_settings_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_price_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_records: {
        Row: {
          combo_equipment_id: string | null
          created_at: string
          date: string
          extra_items: Json
          fuel_type: string | null
          hour_meter: number | null
          id: string
          liters: number
          operator_name: string
          photo_url: string | null
          target_equipment_id: string | null
          tenant_id: string
        }
        Insert: {
          combo_equipment_id?: string | null
          created_at?: string
          date?: string
          extra_items?: Json
          fuel_type?: string | null
          hour_meter?: number | null
          id?: string
          liters: number
          operator_name: string
          photo_url?: string | null
          target_equipment_id?: string | null
          tenant_id: string
        }
        Update: {
          combo_equipment_id?: string | null
          created_at?: string
          date?: string
          extra_items?: Json
          fuel_type?: string | null
          hour_meter?: number | null
          id?: string
          liters?: number
          operator_name?: string
          photo_url?: string | null
          target_equipment_id?: string | null
          tenant_id?: string
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
          {
            foreignKeyName: "fuel_records_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_supply_records: {
        Row: {
          combo_equipment_id: string
          created_at: string
          date: string
          extra_items: Json
          id: string
          invoice_number: string | null
          liters: number
          notes: string | null
          photo_url: string | null
          responsible_name: string
          supplier: string | null
          tenant_id: string
        }
        Insert: {
          combo_equipment_id: string
          created_at?: string
          date?: string
          extra_items?: Json
          id?: string
          invoice_number?: string | null
          liters: number
          notes?: string | null
          photo_url?: string | null
          responsible_name: string
          supplier?: string | null
          tenant_id: string
        }
        Update: {
          combo_equipment_id?: string
          created_at?: string
          date?: string
          extra_items?: Json
          id?: string
          invoice_number?: string | null
          liters?: number
          notes?: string | null
          photo_url?: string | null
          responsible_name?: string
          supplier?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_supply_records_combo_equipment_id_fkey"
            columns: ["combo_equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_supply_records_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_supply_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_records: {
        Row: {
          created_at: string
          end_date: string
          equipment_ids: Json
          id: string
          insurance_company: string
          notes: string | null
          policy_number: string | null
          start_date: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          equipment_ids?: Json
          id?: string
          insurance_company: string
          notes?: string | null
          policy_number?: string | null
          start_date: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          equipment_ids?: Json
          id?: string
          insurance_company?: string
          notes?: string | null
          policy_number?: string | null
          start_date?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_records_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_history: {
        Row: {
          costs_validated: boolean
          costs_validated_at: string | null
          costs_validated_by: string | null
          created_at: string
          description: string
          equipment_id: string | null
          executed_at: string
          hour_meter: number
          id: string
          labor_cost: number | null
          notes: string | null
          operator_name: string | null
          parts_cost: number | null
          photo_url: string | null
          plan_id: string | null
          tenant_id: string
        }
        Insert: {
          costs_validated?: boolean
          costs_validated_at?: string | null
          costs_validated_by?: string | null
          created_at?: string
          description: string
          equipment_id?: string | null
          executed_at?: string
          hour_meter?: number
          id?: string
          labor_cost?: number | null
          notes?: string | null
          operator_name?: string | null
          parts_cost?: number | null
          photo_url?: string | null
          plan_id?: string | null
          tenant_id: string
        }
        Update: {
          costs_validated?: boolean
          costs_validated_at?: string | null
          costs_validated_by?: string | null
          created_at?: string
          description?: string
          equipment_id?: string | null
          executed_at?: string
          hour_meter?: number
          id?: string
          labor_cost?: number | null
          notes?: string | null
          operator_name?: string | null
          parts_cost?: number | null
          photo_url?: string | null
          plan_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_history_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_history_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "maintenance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_history_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          interval_days: number | null
          interval_hours: number | null
          last_done_at: number | null
          last_done_date: string | null
          last_executed_at: string | null
          next_due_at: number | null
          next_due_date: string | null
          plan_type: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          equipment_id: string
          id?: string
          interval_days?: number | null
          interval_hours?: number | null
          last_done_at?: number | null
          last_done_date?: string | null
          last_executed_at?: string | null
          next_due_at?: number | null
          next_due_date?: string | null
          plan_type?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          equipment_id?: string
          id?: string
          interval_days?: number | null
          interval_hours?: number | null
          last_done_at?: number | null
          last_done_date?: string | null
          last_executed_at?: string | null
          next_due_at?: number | null
          next_due_date?: string | null
          plan_type?: string
          status?: string
          tenant_id?: string
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
          {
            foreignKeyName: "maintenance_plans_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          items: Json
          notes: string | null
          operator_name: string
          photo_end_url: string | null
          photo_start_url: string | null
          priority: string
          resolved_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          equipment_id: string
          id?: string
          items?: Json
          notes?: string | null
          operator_name: string
          photo_end_url?: string | null
          photo_start_url?: string | null
          priority?: string
          resolved_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          equipment_id?: string
          id?: string
          items?: Json
          notes?: string | null
          operator_name?: string
          photo_end_url?: string | null
          photo_start_url?: string | null
          priority?: string
          resolved_at?: string | null
          status?: string
          tenant_id?: string
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
          {
            foreignKeyName: "maintenance_requests_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          client: string | null
          cnpj: string | null
          contract_number: string | null
          created_at: string
          expected_end_date: string | null
          id: string
          location: string | null
          name: string
          start_date: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          client?: string | null
          cnpj?: string | null
          contract_number?: string | null
          created_at?: string
          expected_end_date?: string | null
          id?: string
          location?: string | null
          name: string
          start_date?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          client?: string | null
          cnpj?: string | null
          contract_number?: string | null
          created_at?: string
          expected_end_date?: string | null
          id?: string
          location?: string | null
          name?: string
          start_date?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obras_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          ativo: boolean
          cep: string | null
          cidade: string | null
          cnpj: string | null
          cor_alerta: string | null
          cor_primaria: string | null
          cor_secundaria: string | null
          created_at: string
          email_admin: string | null
          email_alertas: string | null
          endereco: string | null
          estado: string | null
          favicon_url: string | null
          fuso_horario: string | null
          horario_operacao: string | null
          id: string
          inscricao_estadual: string | null
          logo_url: string | null
          moeda: string | null
          name: string
          nome_exibicao: string | null
          nome_fantasia: string | null
          razao_social: string | null
          relatorio_assinatura: string | null
          relatorio_mostrar_cnpj: boolean
          relatorio_mostrar_logo: boolean
          relatorio_rodape: string | null
          responsavel_principal: string | null
          site: string | null
          slug: string
          status: string
          telefone: string | null
          tipo_empresa: string | null
          updated_at: string
          whatsapp: string | null
          whatsapp_alertas: string | null
        }
        Insert: {
          ativo?: boolean
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          cor_alerta?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string
          email_admin?: string | null
          email_alertas?: string | null
          endereco?: string | null
          estado?: string | null
          favicon_url?: string | null
          fuso_horario?: string | null
          horario_operacao?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          moeda?: string | null
          name: string
          nome_exibicao?: string | null
          nome_fantasia?: string | null
          razao_social?: string | null
          relatorio_assinatura?: string | null
          relatorio_mostrar_cnpj?: boolean
          relatorio_mostrar_logo?: boolean
          relatorio_rodape?: string | null
          responsavel_principal?: string | null
          site?: string | null
          slug: string
          status?: string
          telefone?: string | null
          tipo_empresa?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_alertas?: string | null
        }
        Update: {
          ativo?: boolean
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          cor_alerta?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string
          email_admin?: string | null
          email_alertas?: string | null
          endereco?: string | null
          estado?: string | null
          favicon_url?: string | null
          fuso_horario?: string | null
          horario_operacao?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          moeda?: string | null
          name?: string
          nome_exibicao?: string | null
          nome_fantasia?: string | null
          razao_social?: string | null
          relatorio_assinatura?: string | null
          relatorio_mostrar_cnpj?: boolean
          relatorio_mostrar_logo?: boolean
          relatorio_rodape?: string | null
          responsavel_principal?: string | null
          site?: string | null
          slug?: string
          status?: string
          telefone?: string | null
          tipo_empresa?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_alertas?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          cause_identified: string | null
          completed_at: string | null
          created_at: string
          description: string
          equipment_id: string | null
          execution_meter: number
          final_status:
            | Database["public"]["Enums"]["work_order_final_status"]
            | null
          id: string
          invoice_number: string | null
          labor_cost: number | null
          machine_released: boolean
          maintenance_plan_id: string | null
          maintenance_request_id: string
          maintenance_type:
            | Database["public"]["Enums"]["maintenance_execution_type"]
            | null
          mechanic_name: string | null
          notes: string | null
          os_number: number
          part_code: string | null
          parts: Json
          parts_cost: number | null
          photo_end_url: string | null
          photo_start_url: string | null
          priority: string
          service_executed: string | null
          started_at: string | null
          status: string
          technical_observations: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cause_identified?: string | null
          completed_at?: string | null
          created_at?: string
          description: string
          equipment_id?: string | null
          execution_meter?: number
          final_status?:
            | Database["public"]["Enums"]["work_order_final_status"]
            | null
          id?: string
          invoice_number?: string | null
          labor_cost?: number | null
          machine_released?: boolean
          maintenance_plan_id?: string | null
          maintenance_request_id: string
          maintenance_type?:
            | Database["public"]["Enums"]["maintenance_execution_type"]
            | null
          mechanic_name?: string | null
          notes?: string | null
          os_number?: number
          part_code?: string | null
          parts?: Json
          parts_cost?: number | null
          photo_end_url?: string | null
          photo_start_url?: string | null
          priority?: string
          service_executed?: string | null
          started_at?: string | null
          status?: string
          technical_observations?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cause_identified?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          equipment_id?: string | null
          execution_meter?: number
          final_status?:
            | Database["public"]["Enums"]["work_order_final_status"]
            | null
          id?: string
          invoice_number?: string | null
          labor_cost?: number | null
          machine_released?: boolean
          maintenance_plan_id?: string | null
          maintenance_request_id?: string
          maintenance_type?:
            | Database["public"]["Enums"]["maintenance_execution_type"]
            | null
          mechanic_name?: string | null
          notes?: string | null
          os_number?: number
          part_code?: string | null
          parts?: Json
          parts_cost?: number | null
          photo_end_url?: string | null
          photo_start_url?: string | null
          priority?: string
          service_executed?: string | null
          started_at?: string | null
          status?: string
          technical_observations?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_maintenance_plan_id_fkey"
            columns: ["maintenance_plan_id"]
            isOneToOne: false
            referencedRelation: "maintenance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_assign_user_to_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      admin_create_tenant: {
        Args: { _name: string; _slug: string }
        Returns: string
      }
      admin_create_user_in_tenant: {
        Args: {
          _display_name: string
          _email: string
          _password: string
          _pin?: string
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
        }
        Returns: string
      }
      admin_update_tenant_branding: {
        Args: {
          _ativo?: boolean
          _cor_alerta?: string
          _cor_primaria?: string
          _cor_secundaria?: string
          _logo_url?: string
          _nome_exibicao?: string
          _tenant_id: string
        }
        Returns: boolean
      }
      get_default_tenant_id: { Args: never; Returns: string }
      get_my_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_my_tenant_branding: {
        Args: never
        Returns: {
          ativo: boolean
          cep: string
          cidade: string
          cnpj: string
          cor_alerta: string
          cor_primaria: string
          cor_secundaria: string
          email_admin: string
          email_alertas: string
          endereco: string
          estado: string
          favicon_url: string
          fuso_horario: string
          horario_operacao: string
          id: string
          inscricao_estadual: string
          logo_url: string
          moeda: string
          name: string
          nome_exibicao: string
          nome_fantasia: string
          razao_social: string
          relatorio_assinatura: string
          relatorio_mostrar_cnpj: boolean
          relatorio_mostrar_logo: boolean
          relatorio_rodape: string
          responsavel_principal: string
          site: string
          slug: string
          telefone: string
          tipo_empresa: string
          whatsapp: string
          whatsapp_alertas: string
        }[]
      }
      get_my_tenant_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_tenant: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      list_my_tenants: {
        Args: never
        Returns: {
          created_at: string
          id: string
          name: string
          slug: string
          status: string
        }[]
      }
      update_my_tenant_branding: {
        Args: {
          _cep?: string
          _cidade?: string
          _cnpj?: string
          _cor_alerta?: string
          _cor_primaria?: string
          _cor_secundaria?: string
          _email_admin?: string
          _email_alertas?: string
          _endereco?: string
          _estado?: string
          _favicon_url?: string
          _fuso_horario?: string
          _horario_operacao?: string
          _inscricao_estadual?: string
          _logo_url?: string
          _moeda?: string
          _nome_exibicao?: string
          _nome_fantasia?: string
          _razao_social?: string
          _relatorio_assinatura?: string
          _relatorio_mostrar_cnpj?: boolean
          _relatorio_mostrar_logo?: boolean
          _relatorio_rodape?: string
          _responsavel_principal?: string
          _site?: string
          _telefone?: string
          _tipo_empresa?: string
          _whatsapp?: string
          _whatsapp_alertas?: string
        }
        Returns: boolean
      }
      verify_fuel_pin: {
        Args: { input_pin: string }
        Returns: {
          tenant_id: string
          user_id: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "gestor" | "mecanico" | "abastecedor"
      maintenance_execution_type: "preventiva" | "corretiva"
      work_order_final_status:
        | "concluida"
        | "aguardando_peca"
        | "servico_externo"
        | "maquina_parada"
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
    Enums: {
      app_role: ["admin", "gestor", "mecanico", "abastecedor"],
      maintenance_execution_type: ["preventiva", "corretiva"],
      work_order_final_status: [
        "concluida",
        "aguardando_peca",
        "servico_externo",
        "maquina_parada",
      ],
    },
  },
} as const
