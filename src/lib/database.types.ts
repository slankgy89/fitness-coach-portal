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
      assigned_habits: {
        Row: {
          client_id: string
          coach_id: string
          created_at: string
          end_date: string | null
          habit_id: string
          id: string
          is_active: boolean | null
          start_date: string
        }
        Insert: {
          client_id: string
          coach_id: string
          created_at?: string
          end_date?: string | null
          habit_id: string
          id?: string
          is_active?: boolean | null
          start_date: string
        }
        Update: {
          client_id?: string
          coach_id?: string
          created_at?: string
          end_date?: string | null
          habit_id?: string
          id?: string
          is_active?: boolean | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "assigned_habits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_habits_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_habits_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      assigned_nutrition: {
        Row: {
          assigned_date: string
          client_id: string
          coach_id: string
          created_at: string
          id: string
          notes: string | null
          nutrition_plan_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_date: string
          client_id: string
          coach_id: string
          created_at?: string
          id?: string
          notes?: string | null
          nutrition_plan_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_date?: string
          client_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          nutrition_plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assigned_nutrition_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_nutrition_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_nutrition_nutrition_plan_id_fkey"
            columns: ["nutrition_plan_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      assigned_nutrition_programs: {
        Row: {
          client_id: string
          coach_id: string
          created_at: string
          end_date: string | null
          id: string
          program_template_id: string
          start_date: string
          status: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          coach_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          program_template_id: string
          start_date: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          coach_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          program_template_id?: string
          start_date?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assigned_nutrition_programs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_nutrition_programs_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_nutrition_programs_program_template_id_fkey"
            columns: ["program_template_id"]
            isOneToOne: false
            referencedRelation: "nutrition_program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      assigned_workouts: {
        Row: {
          assigned_date: string
          client_id: string
          coach_id: string
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean | null
          name: string
          notes: string | null
          updated_at: string
          workout_template_id: string | null
        }
        Insert: {
          assigned_date: string
          client_id: string
          coach_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean | null
          name: string
          notes?: string | null
          updated_at?: string
          workout_template_id?: string | null
        }
        Update: {
          assigned_date?: string
          client_id?: string
          coach_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean | null
          name?: string
          notes?: string | null
          updated_at?: string
          workout_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assigned_workouts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_workouts_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_workouts_workout_template_id_fkey"
            columns: ["workout_template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booked_at: string
          check_in_time: string | null
          client_id: string
          id: string
          slot_id: string
          status: string | null
        }
        Insert: {
          booked_at?: string
          check_in_time?: string | null
          client_id: string
          id?: string
          slot_id: string
          status?: string | null
        }
        Update: {
          booked_at?: string
          check_in_time?: string | null
          client_id?: string
          id?: string
          slot_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "schedule_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_requests: {
        Row: {
          client_id: string
          client_reason: string | null
          coach_id: string
          coach_response: string | null
          counter_offer_plan_id: string | null
          id: string
          plan_id: string
          processed_at: string | null
          refund_amount: number | null
          requested_at: string
          status: string
          subscription_id: string
        }
        Insert: {
          client_id: string
          client_reason?: string | null
          coach_id: string
          coach_response?: string | null
          counter_offer_plan_id?: string | null
          id?: string
          plan_id: string
          processed_at?: string | null
          refund_amount?: number | null
          requested_at?: string
          status?: string
          subscription_id: string
        }
        Update: {
          client_id?: string
          client_reason?: string | null
          coach_id?: string
          coach_response?: string | null
          counter_offer_plan_id?: string | null
          id?: string
          plan_id?: string
          processed_at?: string | null
          refund_amount?: number | null
          requested_at?: string
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_requests_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_requests_counter_offer_plan_id_fkey"
            columns: ["counter_offer_plan_id"]
            isOneToOne: false
            referencedRelation: "coach_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "coach_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_subscription"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      client_submissions: {
        Row: {
          client_id: string
          client_notes: string | null
          coach_feedback: string | null
          coach_id: string
          id: string
          image_url: string
          meal_type: string | null
          reviewed_at: string | null
          status: string
          submission_date: string
          submitted_at: string
        }
        Insert: {
          client_id: string
          client_notes?: string | null
          coach_feedback?: string | null
          coach_id: string
          id?: string
          image_url: string
          meal_type?: string | null
          reviewed_at?: string | null
          status?: string
          submission_date?: string
          submitted_at?: string
        }
        Update: {
          client_id?: string
          client_notes?: string | null
          coach_feedback?: string | null
          coach_id?: string
          id?: string
          image_url?: string
          meal_type?: string | null
          reviewed_at?: string | null
          status?: string
          submission_date?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_submissions_coach_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_submissions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_plans: {
        Row: {
          coach_id: string
          created_at: string | null
          currency: string
          description: string | null
          features: string[] | null
          id: string
          interval: string
          interval_count: number
          is_active: boolean | null
          name: string
          price: number
          requires_approval: boolean | null
          stripe_price_id: string
          stripe_product_id: string
          updated_at: string | null
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          currency?: string
          description?: string | null
          features?: string[] | null
          id?: string
          interval: string
          interval_count?: number
          is_active?: boolean | null
          name: string
          price: number
          requires_approval?: boolean | null
          stripe_price_id: string
          stripe_product_id: string
          updated_at?: string | null
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          currency?: string
          description?: string | null
          features?: string[] | null
          id?: string
          interval?: string
          interval_count?: number
          is_active?: boolean | null
          name?: string
          price?: number
          requires_approval?: boolean | null
          stripe_price_id?: string
          stripe_product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_plans_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          coach_id: string
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          uses_count: number | null
        }
        Insert: {
          coach_id: string
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          uses_count?: number | null
        }
        Update: {
          coach_id?: string
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          uses_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_agreements: {
        Row: {
          agreed_at: string
          client_id: string
          document_id: string
          document_version: number
          id: string
        }
        Insert: {
          agreed_at?: string
          client_id: string
          document_id: string
          document_version: number
          id?: string
        }
        Update: {
          agreed_at?: string
          client_id?: string
          document_id?: string
          document_version?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_agreements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_agreements_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          coach_id: string
          content: string
          created_at: string
          id: string
          is_active: boolean | null
          title: string
          updated_at: string
          version: number | null
        }
        Insert: {
          coach_id: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          title: string
          updated_at?: string
          version?: number | null
        }
        Update: {
          coach_id?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          title?: string
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          body_part: string
          coach_id: string
          created_at: string
          description: string | null
          exercise_type: string
          id: string
          instructions: string | null
          machine_type: string
          name: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          body_part?: string
          coach_id: string
          created_at?: string
          description?: string | null
          exercise_type?: string
          id?: string
          instructions?: string | null
          machine_type?: string
          name: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          body_part?: string
          coach_id?: string
          created_at?: string
          description?: string | null
          exercise_type?: string
          id?: string
          instructions?: string | null
          machine_type?: string
          name?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          api_id: string | null
          brand_owner: string | null
          calories: number
          carbs_g: number
          coach_id: string
          created_at: string
          fat_g: number
          fdc_id: number | null
          fiber_g: number | null
          full_nutrients: Json | null
          id: string
          name: string
          protein_g: number
          serving_size_qty: number
          serving_size_unit: string
          sodium_mg: number | null
          source: string
          sugar_g: number | null
          updated_at: string
        }
        Insert: {
          api_id?: string | null
          brand_owner?: string | null
          calories: number
          carbs_g?: number
          coach_id: string
          created_at?: string
          fat_g?: number
          fdc_id?: number | null
          fiber_g?: number | null
          full_nutrients?: Json | null
          id?: string
          name: string
          protein_g?: number
          serving_size_qty: number
          serving_size_unit: string
          sodium_mg?: number | null
          source?: string
          sugar_g?: number | null
          updated_at?: string
        }
        Update: {
          api_id?: string | null
          brand_owner?: string | null
          calories?: number
          carbs_g?: number
          coach_id?: string
          created_at?: string
          fat_g?: number
          fdc_id?: number | null
          fiber_g?: number | null
          full_nutrients?: Json | null
          id?: string
          name?: string
          protein_g?: number
          serving_size_qty?: number
          serving_size_unit?: string
          sodium_mg?: number | null
          source?: string
          sugar_g?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "foods_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          assigned_habit_id: string
          id: string
          is_completed: boolean
          log_date: string
          logged_at: string
          notes: string | null
        }
        Insert: {
          assigned_habit_id: string
          id?: string
          is_completed: boolean
          log_date: string
          logged_at?: string
          notes?: string | null
        }
        Update: {
          assigned_habit_id?: string
          id?: string
          is_completed?: boolean
          log_date?: string
          logged_at?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_assigned_habit_id_fkey"
            columns: ["assigned_habit_id"]
            isOneToOne: false
            referencedRelation: "assigned_habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          coach_id: string
          created_at: string
          description: string | null
          frequency: string | null
          id: string
          name: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          description?: string | null
          frequency?: string | null
          id?: string
          name: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          description?: string | null
          frequency?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          quantity: number | null
          total_price: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          quantity?: number | null
          total_price: number
          unit_price: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          coach_id: string
          created_at: string
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          status: string
          stripe_invoice_id: string | null
          total_amount: number
        }
        Insert: {
          client_id: string
          coach_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date: string
          status?: string
          stripe_invoice_id?: string | null
          total_amount: number
        }
        Update: {
          client_id?: string
          coach_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          status?: string
          stripe_invoice_id?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_items: {
        Row: {
          created_at: string
          food_id: string
          id: string
          meal_id: string
          quantity: number
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          food_id: string
          id?: string
          meal_id: string
          quantity: number
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          food_id?: string
          id?: string
          meal_id?: string
          quantity?: number
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          coach_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_logs: {
        Row: {
          calories: number | null
          carbs_g: number | null
          client_id: string
          fat_g: number | null
          food_name: string
          id: string
          log_date: string
          logged_at: string
          meal_time: string | null
          notes: string | null
          protein_g: number | null
          serving_size: string | null
        }
        Insert: {
          calories?: number | null
          carbs_g?: number | null
          client_id: string
          fat_g?: number | null
          food_name: string
          id?: string
          log_date: string
          logged_at?: string
          meal_time?: string | null
          notes?: string | null
          protein_g?: number | null
          serving_size?: string | null
        }
        Update: {
          calories?: number | null
          carbs_g?: number | null
          client_id?: string
          fat_g?: number | null
          food_name?: string
          id?: string
          log_date?: string
          logged_at?: string
          meal_time?: string | null
          notes?: string | null
          protein_g?: number | null
          serving_size?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_plan_items: {
        Row: {
          custom_food_name: string | null
          id: string
          item_order: number | null
          meal_time: string | null
          notes: string | null
          plan_id: string
          recipe_id: string | null
          serving_size: string | null
        }
        Insert: {
          custom_food_name?: string | null
          id?: string
          item_order?: number | null
          meal_time?: string | null
          notes?: string | null
          plan_id: string
          recipe_id?: string | null
          serving_size?: string | null
        }
        Update: {
          custom_food_name?: string | null
          id?: string
          item_order?: number | null
          meal_time?: string | null
          notes?: string | null
          plan_id?: string
          recipe_id?: string | null
          serving_size?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_plan_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_plans: {
        Row: {
          coach_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_plans_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_program_meal_items: {
        Row: {
          created_at: string
          food_id: string
          id: string
          item_order: number
          meal_id: string
          quantity: number
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          food_id: string
          id?: string
          item_order?: number
          meal_id: string
          quantity: number
          unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          food_id?: string
          id?: string
          item_order?: number
          meal_id?: string
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_program_meal_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_program_meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "nutrition_program_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_program_meals: {
        Row: {
          created_at: string
          day_number: number
          id: string
          meal_name: string
          meal_order: number
          program_template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_number?: number
          id?: string
          meal_name: string
          meal_order?: number
          program_template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_number?: number
          id?: string
          meal_name?: string
          meal_order?: number
          program_template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_program_meals_program_template_id_fkey"
            columns: ["program_template_id"]
            isOneToOne: false
            referencedRelation: "nutrition_program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_program_templates: {
        Row: {
          calorie_target_type: string | null
          category: string | null
          coach_id: string
          created_at: string
          description: string | null
          duration_unit: string | null
          duration_value: number | null
          id: string
          max_calories: number | null
          max_carb_grams: number | null
          max_fat_grams: number | null
          max_protein_grams: number | null
          max_sugar_grams: number | null
          min_calories: number | null
          min_carb_grams: number | null
          min_fat_grams: number | null
          min_protein_grams: number | null
          min_sugar_grams: number | null
          name: string
          supplements: Json | null
          target_meals_per_day: number | null
          updated_at: string
        }
        Insert: {
          calorie_target_type?: string | null
          category?: string | null
          coach_id: string
          created_at?: string
          description?: string | null
          duration_unit?: string | null
          duration_value?: number | null
          id?: string
          max_calories?: number | null
          max_carb_grams?: number | null
          max_fat_grams?: number | null
          max_protein_grams?: number | null
          max_sugar_grams?: number | null
          min_calories?: number | null
          min_carb_grams?: number | null
          min_fat_grams?: number | null
          min_protein_grams?: number | null
          min_sugar_grams?: number | null
          name: string
          supplements?: Json | null
          target_meals_per_day?: number | null
          updated_at?: string
        }
        Update: {
          calorie_target_type?: string | null
          category?: string | null
          coach_id?: string
          created_at?: string
          description?: string | null
          duration_unit?: string | null
          duration_value?: number | null
          id?: string
          max_calories?: number | null
          max_carb_grams?: number | null
          max_fat_grams?: number | null
          max_protein_grams?: number | null
          max_sugar_grams?: number | null
          min_calories?: number | null
          min_carb_grams?: number | null
          min_fat_grams?: number | null
          min_protein_grams?: number | null
          min_sugar_grams?: number | null
          name?: string
          supplements?: Json | null
          target_meals_per_day?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_program_templates_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          coach_id: string
          created_at: string
          currency: string
          description: string | null
          id: string
          status: string
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount: number
          client_id: string
          coach_id: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          status: string
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount?: number
          client_id?: string
          coach_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          status?: string
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transactions: {
        Row: {
          amount: number
          client_id: string | null
          coach_id: string
          currency: string
          description: string | null
          id: string
          payment_method: string | null
          stripe_charge_id: string | null
          transaction_time: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          coach_id: string
          currency?: string
          description?: string | null
          id?: string
          payment_method?: string | null
          stripe_charge_id?: string | null
          transaction_time?: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          coach_id?: string
          currency?: string
          description?: string | null
          id?: string
          payment_method?: string | null
          stripe_charge_id?: string | null
          transaction_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          client_type: string | null
          coach_id: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          role: string
          stripe_account_id: string | null
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          client_type?: string | null
          coach_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          role?: string
          stripe_account_id?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          client_type?: string | null
          coach_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: string
          stripe_account_id?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_photos: {
        Row: {
          client_id: string
          id: string
          notes: string | null
          photo_url: string
          taken_date: string
          uploaded_at: string
        }
        Insert: {
          client_id: string
          id?: string
          notes?: string | null
          photo_url: string
          taken_date: string
          uploaded_at?: string
        }
        Update: {
          client_id?: string
          id?: string
          notes?: string | null
          photo_url?: string
          taken_date?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_photos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          coach_id: string
          cook_time_minutes: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          ingredients: string | null
          instructions: string | null
          name: string
          prep_time_minutes: number | null
          servings: number | null
          updated_at: string
        }
        Insert: {
          coach_id: string
          cook_time_minutes?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          instructions?: string | null
          name: string
          prep_time_minutes?: number | null
          servings?: number | null
          updated_at?: string
        }
        Update: {
          coach_id?: string
          cook_time_minutes?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          instructions?: string | null
          name?: string
          prep_time_minutes?: number | null
          servings?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_slots: {
        Row: {
          coach_id: string
          created_at: string
          description: string | null
          end_time: string
          id: string
          max_attendees: number | null
          slot_type: string
          start_time: string
          title: string | null
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          max_attendees?: number | null
          slot_type?: string
          start_time: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          max_attendees?: number | null
          slot_type?: string
          start_time?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_slots_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          id: string
          plan_id: string | null
          status: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          status?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          status?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "coach_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          assigned_workout_id: string
          client_id: string | null
          duration_seconds: number | null
          exercise_id: string
          id: string
          logged_at: string
          notes: string | null
          reps_completed: number | null
          rest_taken_seconds: number | null
          set_number: number
          weight_unit: string | null
          weight_used: number | null
        }
        Insert: {
          assigned_workout_id: string
          client_id?: string | null
          duration_seconds?: number | null
          exercise_id: string
          id?: string
          logged_at?: string
          notes?: string | null
          reps_completed?: number | null
          rest_taken_seconds?: number | null
          set_number: number
          weight_unit?: string | null
          weight_used?: number | null
        }
        Update: {
          assigned_workout_id?: string
          client_id?: string | null
          duration_seconds?: number | null
          exercise_id?: string
          id?: string
          logged_at?: string
          notes?: string | null
          reps_completed?: number | null
          rest_taken_seconds?: number | null
          set_number?: number
          weight_unit?: string | null
          weight_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_assigned_workout_id_fkey"
            columns: ["assigned_workout_id"]
            isOneToOne: false
            referencedRelation: "assigned_workouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_template_items: {
        Row: {
          alt_set_details: Json | null
          alternative_exercise_id: string | null
          exercise_id: string
          group_id: number | null
          group_order: number | null
          id: string
          item_order: number
          notes: string | null
          reps: string | null
          rest_period: string | null
          set_details: Json | null
          sets: string | null
          superset_exercise_id: string | null
          superset_set_details: Json | null
          template_id: string
          updated_at: string
        }
        Insert: {
          alt_set_details?: Json | null
          alternative_exercise_id?: string | null
          exercise_id: string
          group_id?: number | null
          group_order?: number | null
          id?: string
          item_order: number
          notes?: string | null
          reps?: string | null
          rest_period?: string | null
          set_details?: Json | null
          sets?: string | null
          superset_exercise_id?: string | null
          superset_set_details?: Json | null
          template_id: string
          updated_at?: string
        }
        Update: {
          alt_set_details?: Json | null
          alternative_exercise_id?: string | null
          exercise_id?: string
          group_id?: number | null
          group_order?: number | null
          id?: string
          item_order?: number
          notes?: string | null
          reps?: string | null
          rest_period?: string | null
          set_details?: Json | null
          sets?: string | null
          superset_exercise_id?: string | null
          superset_set_details?: Json | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_template_items_alternative_exercise_id_fkey"
            columns: ["alternative_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_template_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_template_items_superset_exercise_id_fkey"
            columns: ["superset_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          coach_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_templates_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      pending_cancellations: {
        Row: {
          client_email: string | null
          client_id: string | null
          client_reason: string | null
          coach_id: string | null
          coach_response: string | null
          counter_offer_plan_id: string | null
          id: string | null
          plan_id: string | null
          plan_name: string | null
          processed_at: string | null
          refund_amount: number | null
          requested_at: string | null
          status: string | null
          subscription_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_requests_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_requests_counter_offer_plan_id_fkey"
            columns: ["counter_offer_plan_id"]
            isOneToOne: false
            referencedRelation: "coach_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "coach_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_subscription"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
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
