export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      body_composition_logs: {
        Row: {
          bmi: number | null
          body_fat_percentage: number | null
          center_id: string | null
          created_at: string | null
          height_cm: number | null
          id: string
          measurement_date: string
          member_id: string
          notes: string | null
          skeletal_muscle_mass_kg: number | null
          weight_kg: number | null
        }
        Insert: {
          bmi?: number | null
          body_fat_percentage?: number | null
          center_id?: string | null
          created_at?: string | null
          height_cm?: number | null
          id?: string
          measurement_date?: string
          member_id: string
          notes?: string | null
          skeletal_muscle_mass_kg?: number | null
          weight_kg?: number | null
        }
        Update: {
          bmi?: number | null
          body_fat_percentage?: number | null
          center_id?: string | null
          created_at?: string | null
          height_cm?: number | null
          id?: string
          measurement_date?: string
          member_id?: string
          notes?: string | null
          skeletal_muscle_mass_kg?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_composition_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_center"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      center_users: {
        Row: {
          center_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          center_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          center_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_users_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      centers: {
        Row: {
          address: string | null
          created_at: string
          description: string | null
          id: string
          kakao_place_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kakao_place_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kakao_place_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          read_at: string | null
          room_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          read_at?: string | null
          room_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          read_at?: string | null
          room_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          created_at: string
          id: string
          last_read_at: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_read_at?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_read_at?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id?: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      commission_rules: {
        Row: {
          center_id: string
          commission_rate: number
          created_at: string
          id: string
          incentive_amount: number
          revenue_threshold: number
          team_incentive_amount: number
          updated_at: string | null
        }
        Insert: {
          center_id: string
          commission_rate: number
          created_at?: string
          id?: string
          incentive_amount?: number
          revenue_threshold: number
          team_incentive_amount?: number
          updated_at?: string | null
        }
        Update: {
          center_id?: string
          commission_rate?: number
          created_at?: string
          id?: string
          incentive_amount?: number
          revenue_threshold?: number
          team_incentive_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          category_l1: string | null
          category_l2: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          target_muscles: string[] | null
          video_url: string | null
        }
        Insert: {
          category_l1?: string | null
          category_l2?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          target_muscles?: string[] | null
          video_url?: string | null
        }
        Update: {
          category_l1?: string | null
          category_l2?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          target_muscles?: string[] | null
          video_url?: string | null
        }
        Relationships: []
      }
      members: {
        Row: {
          bio: string | null
          birth_date: string | null
          center_id: string
          created_at: string | null
          email: string | null
          gender: string | null
          id: string
          managing_trainer_id: string | null
          name: string
          phone_number: string | null
          profile_image_url: string | null
          registration_date: string
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          birth_date?: string | null
          center_id: string
          created_at?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          managing_trainer_id?: string | null
          name: string
          phone_number?: string | null
          profile_image_url?: string | null
          registration_date?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          birth_date?: string | null
          center_id?: string
          created_at?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          managing_trainer_id?: string | null
          name?: string
          phone_number?: string | null
          profile_image_url?: string | null
          registration_date?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          commission_rate: number | null
          contract_date: string | null
          created_at: string
          end_date: string | null
          id: string
          member_id: string
          payment_method: string | null
          plan: string
          registration_type:
            | Database["public"]["Enums"]["registration_type"]
            | null
          remaining_sessions: number
          session_price: number | null
          start_date: string
          total_sessions: number
          trainer_id: string
          updated_at: string
        }
        Insert: {
          commission_rate?: number | null
          contract_date?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          member_id: string
          payment_method?: string | null
          plan: string
          registration_type?:
            | Database["public"]["Enums"]["registration_type"]
            | null
          remaining_sessions: number
          session_price?: number | null
          start_date?: string
          total_sessions: number
          trainer_id: string
          updated_at?: string
        }
        Update: {
          commission_rate?: number | null
          contract_date?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          member_id?: string
          payment_method?: string | null
          plan?: string
          registration_type?:
            | Database["public"]["Enums"]["registration_type"]
            | null
          remaining_sessions?: number
          session_price?: number | null
          start_date?: string
          total_sessions?: number
          trainer_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_read_status: {
        Row: {
          created_at: string
          id: string
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_read_status_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      my_trainer_members: {
        Row: {
          created_at: string
          member_id: string
          trainer_id: string
        }
        Insert: {
          created_at?: string
          member_id: string
          trainer_id: string
        }
        Update: {
          created_at?: string
          member_id?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "my_trainer_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "my_trainer_members_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          metadata: Json | null
          type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json | null
          type: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          center_id: string | null
          created_at: string
          first_name: string | null
          gender: string | null
          id: string
          last_name: string | null
          phone_number: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          center_id?: string | null
          created_at?: string
          first_name?: string | null
          gender?: string | null
          id: string
          last_name?: string | null
          phone_number?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          center_id?: string | null
          created_at?: string
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          phone_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      pt_session_change_logs: {
        Row: {
          change_amount: number
          change_reason: string | null
          changed_by_user_id: string
          created_at: string
          id: string
          member_id: string
          membership_id: string
          new_remaining_sessions: number
          new_total_sessions: number
          previous_remaining_sessions: number
          previous_total_sessions: number
        }
        Insert: {
          change_amount: number
          change_reason?: string | null
          changed_by_user_id: string
          created_at?: string
          id?: string
          member_id: string
          membership_id: string
          new_remaining_sessions: number
          new_total_sessions: number
          previous_remaining_sessions: number
          previous_total_sessions: number
        }
        Update: {
          change_amount?: number
          change_reason?: string | null
          changed_by_user_id?: string
          created_at?: string
          id?: string
          member_id?: string
          membership_id?: string
          new_remaining_sessions?: number
          new_total_sessions?: number
          previous_remaining_sessions?: number
          previous_total_sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "pt_session_change_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_session_change_logs_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      pt_sessions: {
        Row: {
          background_color: string | null
          created_at: string
          end_time: string
          id: string
          member_id: string
          membership_id: string
          notes: string | null
          start_time: string
          status: string
          trainer_id: string
          type: string | null
          updated_at: string
          workout_session_id: string | null
        }
        Insert: {
          background_color?: string | null
          created_at?: string
          end_time: string
          id?: string
          member_id: string
          membership_id: string
          notes?: string | null
          start_time: string
          status?: string
          trainer_id: string
          type?: string | null
          updated_at?: string
          workout_session_id?: string | null
        }
        Update: {
          background_color?: string | null
          created_at?: string
          end_time?: string
          id?: string
          member_id?: string
          membership_id?: string
          notes?: string | null
          start_time?: string
          status?: string
          trainer_id?: string
          type?: string | null
          updated_at?: string
          workout_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pt_sessions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_sessions_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_price_rules: {
        Row: {
          center_id: string
          created_at: string
          id: string
          max_sessions: number | null
          min_sessions: number
          price_per_session: number
          updated_at: string | null
        }
        Insert: {
          center_id: string
          created_at?: string
          id?: string
          max_sessions?: number | null
          min_sessions: number
          price_per_session: number
          updated_at?: string | null
        }
        Update: {
          center_id?: string
          created_at?: string
          id?: string
          max_sessions?: number | null
          min_sessions?: number
          price_per_session?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_price_rules_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      session_status: {
        Row: {
          created_at: string
          id: string
          session_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_status_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          center_id: string
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          member_id: string | null
          priority: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          center_id: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          member_id?: string | null
          priority?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          center_id?: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          member_id?: string | null
          priority?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_settings: {
        Row: {
          center_id: string
          created_at: string
          id: string
          monthly_salary: number
          target_revenue: number
          trainer_id: string
          updated_at: string | null
        }
        Insert: {
          center_id: string
          created_at?: string
          id?: string
          monthly_salary?: number
          target_revenue?: number
          trainer_id: string
          updated_at?: string | null
        }
        Update: {
          center_id?: string
          created_at?: string
          id?: string
          monthly_salary?: number
          target_revenue?: number
          trainer_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainer_settings_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          created_at: string | null
          exercise_id: string
          id: string
          notes: string | null
          order: number
          session_id: string
        }
        Insert: {
          created_at?: string | null
          exercise_id: string
          id?: string
          notes?: string | null
          order: number
          session_id: string
        }
        Update: {
          created_at?: string | null
          exercise_id?: string
          id?: string
          notes?: string | null
          order?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          content: string | null
          created_at: string
          exercises: Json | null
          id: string
          member_id: string
          session_id: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          exercises?: Json | null
          id?: string
          member_id: string
          session_id: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          exercises?: Json | null
          id?: string
          member_id?: string
          session_id?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pt_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_media: {
        Row: {
          created_at: string | null
          file_name: string | null
          id: string
          mime_type: string | null
          storage_path: string
          workout_exercise_id: string
        }
        Insert: {
          created_at?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          storage_path: string
          workout_exercise_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          storage_path?: string
          workout_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_media_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          center_id: string
          created_at: string | null
          id: string
          member_id: string
          notes: string | null
          session_date: string | null
          session_order: number | null
          total_sessions_at_creation: number | null
          trainer_id: string
          updated_at: string | null
        }
        Insert: {
          center_id: string
          created_at?: string | null
          id?: string
          member_id: string
          notes?: string | null
          session_date?: string | null
          session_order?: number | null
          total_sessions_at_creation?: number | null
          trainer_id: string
          updated_at?: string | null
        }
        Update: {
          center_id?: string
          created_at?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          session_date?: string | null
          session_order?: number | null
          total_sessions_at_creation?: number | null
          trainer_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sets: {
        Row: {
          completed: boolean | null
          created_at: string | null
          id: string
          reps: number | null
          set_number: number
          weight: number | null
          workout_exercise_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          reps?: number | null
          set_number: number
          weight?: number | null
          workout_exercise_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          reps?: number | null
          set_number?: number
          weight?: number | null
          workout_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      latest_workout_sessions_view: {
        Row: {
          member_id: string | null
          session_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_unique_constraint: {
        Args: {
          target_table_name: string
          target_column_name: string
          target_schema_name?: string
          custom_constraint_name?: string
        }
        Returns: string
      }
      create_workout_session_and_decrement_pt: {
        Args: {
          p_member_id: string
          p_trainer_id: string
          p_center_id: string
          p_session_date: string
          p_notes: string
          p_session_order: number
          p_total_sessions_at_creation: number
        }
        Returns: string
      }
      get_monthly_new_members: {
        Args: { p_center_id: string; p_months?: number }
        Returns: {
          month_name: string
          member_count: number
        }[]
      }
      get_my_center_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_or_create_direct_chat_room: {
        Args: { user1_id: string; user2_id: string }
        Returns: string
      }
      get_other_participant_id: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: string
      }
      get_unread_message_count: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: number
      }
      leave_chat_room: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: undefined
      }
      mark_chat_messages_as_read: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      registration_type: "new" | "renewal"
      user_role: "trainer" | "member"
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
  public: {
    Enums: {
      registration_type: ["new", "renewal"],
      user_role: ["trainer", "member"],
    },
  },
} as const