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
      admin_users: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          permissions: string[]
          profile_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          permissions?: string[]
          profile_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          permissions?: string[]
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_users_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          admin_rating: number | null
          bio: string | null
          brand_name: string | null
          budget_range: string | null
          categories: string[] | null
          city: string | null
          created_at: string
          discover: boolean
          email: string
          followers_count: number | null
          full_name: string
          id: string
          image_path: string | null
          invited_at: string | null
          looking_for: string | null
          message: string | null
          phone: string | null
          portfolio_url: string | null
          profile: Json
          profile_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          social_handle: string | null
          social_platform: string | null
          status: string
          video_path: string | null
          website: string | null
        }
        Insert: {
          admin_rating?: number | null
          bio?: string | null
          brand_name?: string | null
          budget_range?: string | null
          categories?: string[] | null
          city?: string | null
          created_at?: string
          discover?: boolean
          email: string
          followers_count?: number | null
          full_name: string
          id?: string
          image_path?: string | null
          invited_at?: string | null
          looking_for?: string | null
          message?: string | null
          phone?: string | null
          portfolio_url?: string | null
          profile?: Json
          profile_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role: string
          social_handle?: string | null
          social_platform?: string | null
          status?: string
          video_path?: string | null
          website?: string | null
        }
        Update: {
          admin_rating?: number | null
          bio?: string | null
          brand_name?: string | null
          budget_range?: string | null
          categories?: string[] | null
          city?: string | null
          created_at?: string
          discover?: boolean
          email?: string
          followers_count?: number | null
          full_name?: string
          id?: string
          image_path?: string | null
          invited_at?: string | null
          looking_for?: string | null
          message?: string | null
          phone?: string | null
          portfolio_url?: string | null
          profile?: Json
          profile_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string
          social_handle?: string | null
          social_platform?: string | null
          status?: string
          video_path?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["actor_role"] | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: number
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["actor_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["actor_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          brand_logo_url: string | null
          brand_name: string
          brand_pronunciation: string | null
          brand_slug: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          id: string
          industry: string | null
          instagram_url: string | null
          location: string | null
          profile_id: string
          pronunciation_audio_url: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          brand_logo_url?: string | null
          brand_name: string
          brand_pronunciation?: string | null
          brand_slug?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          instagram_url?: string | null
          location?: string | null
          profile_id: string
          pronunciation_audio_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          brand_logo_url?: string | null
          brand_name?: string
          brand_pronunciation?: string | null
          brand_slug?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          instagram_url?: string | null
          location?: string | null
          profile_id?: string
          pronunciation_audio_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brief_attachments: {
        Row: {
          brief_id: string
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          brief_id: string
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          brief_id?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brief_attachments_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brief_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      briefs: {
        Row: {
          brand_id: string
          budget: number | null
          campaign_objective: string | null
          category_id: string | null
          content_type: string | null
          created_at: string
          creator_id: string | null
          deadline: string | null
          deliverables: string | null
          do_not_say: string[]
          id: string
          platform: string | null
          product_description: string | null
          product_name: string | null
          product_url: string | null
          reference_links: string[]
          responded_at: string | null
          response_note: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["brief_status"]
          talking_points: string[]
          target_audience: string | null
          title: string
          tone: string | null
          updated_at: string
          usage_rights: string | null
        }
        Insert: {
          brand_id: string
          budget?: number | null
          campaign_objective?: string | null
          category_id?: string | null
          content_type?: string | null
          created_at?: string
          creator_id?: string | null
          deadline?: string | null
          deliverables?: string | null
          do_not_say?: string[]
          id?: string
          platform?: string | null
          product_description?: string | null
          product_name?: string | null
          product_url?: string | null
          reference_links?: string[]
          responded_at?: string | null
          response_note?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["brief_status"]
          talking_points?: string[]
          target_audience?: string | null
          title: string
          tone?: string | null
          updated_at?: string
          usage_rights?: string | null
        }
        Update: {
          brand_id?: string
          budget?: number | null
          campaign_objective?: string | null
          category_id?: string | null
          content_type?: string | null
          created_at?: string
          creator_id?: string | null
          deadline?: string | null
          deliverables?: string | null
          do_not_say?: string[]
          id?: string
          platform?: string | null
          product_description?: string | null
          product_name?: string | null
          product_url?: string | null
          reference_links?: string[]
          responded_at?: string | null
          response_note?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["brief_status"]
          talking_points?: string[]
          target_audience?: string | null
          title?: string
          tone?: string | null
          updated_at?: string
          usage_rights?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "briefs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefs_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          profile_id: string | null
          status: string
          topic: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          profile_id?: string | null
          status?: string
          topic?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          profile_id?: string | null
          status?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_categories: {
        Row: {
          category_id: string
          created_at: string
          creator_id: string
          is_primary: boolean
        }
        Insert: {
          category_id: string
          created_at?: string
          creator_id: string
          is_primary?: boolean
        }
        Update: {
          category_id?: string
          created_at?: string
          creator_id?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "creator_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_categories_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_earnings: {
        Row: {
          available_at: string | null
          created_at: string
          creator_id: string
          gross_amount: number
          id: string
          net_amount: number
          order_id: string
          paid_at: string | null
          payout_request_id: string | null
          platform_fee: number
          status: Database["public"]["Enums"]["earning_status"]
          updated_at: string
        }
        Insert: {
          available_at?: string | null
          created_at?: string
          creator_id: string
          gross_amount: number
          id?: string
          net_amount: number
          order_id: string
          paid_at?: string | null
          payout_request_id?: string | null
          platform_fee: number
          status?: Database["public"]["Enums"]["earning_status"]
          updated_at?: string
        }
        Update: {
          available_at?: string | null
          created_at?: string
          creator_id?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          order_id?: string
          paid_at?: string | null
          payout_request_id?: string | null
          platform_fee?: number
          status?: Database["public"]["Enums"]["earning_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_earnings_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_earnings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_earnings_payout_request_id_fkey"
            columns: ["payout_request_id"]
            isOneToOne: false
            referencedRelation: "payout_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_languages: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          language: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          language: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          language?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_languages_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_profile_views: {
        Row: {
          created_at: string
          creator_id: string
          id: number
          viewer_id: string | null
          viewer_role: Database["public"]["Enums"]["user_role"] | null
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: never
          viewer_id?: string | null
          viewer_role?: Database["public"]["Enums"]["user_role"] | null
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: never
          viewer_id?: string | null
          viewer_role?: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_profile_views_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_profile_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_rankings: {
        Row: {
          admin_rating: number | null
          creator_id: string
          note: string | null
          pinned_at: string | null
          sort_order: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_rating?: number | null
          creator_id: string
          note?: string | null
          pinned_at?: string | null
          sort_order?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_rating?: number | null
          creator_id?: string
          note?: string | null
          pinned_at?: string | null
          sort_order?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_rankings_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_rankings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_services: {
        Row: {
          active: boolean
          archived_at: string | null
          content_type: string
          created_at: string
          creator_id: string
          delivery_days: number
          description: string | null
          id: string
          includes: string[]
          platform: Database["public"]["Enums"]["social_platform"] | null
          price: number
          requires_shipping: boolean
          revisions_included: number
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          content_type?: string
          created_at?: string
          creator_id: string
          delivery_days: number
          description?: string | null
          id?: string
          includes?: string[]
          platform?: Database["public"]["Enums"]["social_platform"] | null
          price: number
          requires_shipping?: boolean
          revisions_included?: number
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          content_type?: string
          created_at?: string
          creator_id?: string
          delivery_days?: number
          description?: string | null
          id?: string
          includes?: string[]
          platform?: Database["public"]["Enums"]["social_platform"] | null
          price?: number
          requires_shipping?: boolean
          revisions_included?: number
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_services_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_social_accounts: {
        Row: {
          created_at: string
          creator_id: string
          followers_count: number
          id: string
          platform: Database["public"]["Enums"]["social_platform"]
          profile_url: string | null
          updated_at: string
          username: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          creator_id: string
          followers_count?: number
          id?: string
          platform: Database["public"]["Enums"]["social_platform"]
          profile_url?: string | null
          updated_at?: string
          username: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          creator_id?: string
          followers_count?: number
          id?: string
          platform?: Database["public"]["Enums"]["social_platform"]
          profile_url?: string | null
          updated_at?: string
          username?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "creator_social_accounts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_types: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          max_followers: number | null
          min_followers: number | null
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          max_followers?: number | null
          min_followers?: number | null
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          max_followers?: number | null
          min_followers?: number | null
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      creator_verifications: {
        Row: {
          address_line: string | null
          city: string | null
          created_at: string
          creator_id: string
          date_of_birth: string | null
          document_number_last4: string | null
          document_path: string | null
          document_type: string | null
          id: string
          legal_name: string
          note: string | null
          postal_code: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string | null
          status: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          city?: string | null
          created_at?: string
          creator_id: string
          date_of_birth?: string | null
          document_number_last4?: string | null
          document_path?: string | null
          document_type?: string | null
          id?: string
          legal_name: string
          note?: string | null
          postal_code?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          city?: string | null
          created_at?: string
          creator_id?: string
          date_of_birth?: string | null
          document_number_last4?: string | null
          document_path?: string | null
          document_type?: string | null
          id?: string
          legal_name?: string
          note?: string | null
          postal_code?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_verifications_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          age: number | null
          approved_at: string | null
          available: boolean
          barter_available: boolean
          bio: string | null
          city: string | null
          completed_orders: number
          content_types: string[]
          country: string
          cover_image_url: string | null
          created_at: string
          creator_type: string | null
          deleted_at: string | null
          display_name: string
          engagement_rate: number | null
          fastest_delivery_days: number | null
          featured: boolean
          followers_count: number
          gender: Database["public"]["Enums"]["gender_type"] | null
          headline: string | null
          id: string
          intro_video_url: string | null
          onboarding_step: number
          profile_id: string
          profile_image_url: string | null
          profile_views: number
          published_at: string | null
          rating: number
          rejection_reason: string | null
          response_time: string | null
          review_count: number
          search_vector: unknown
          slug: string
          starting_price: number | null
          state: string | null
          status: Database["public"]["Enums"]["creator_status"]
          updated_at: string
          verified: boolean
          wishlist_count: number
        }
        Insert: {
          age?: number | null
          approved_at?: string | null
          available?: boolean
          barter_available?: boolean
          bio?: string | null
          city?: string | null
          completed_orders?: number
          content_types?: string[]
          country?: string
          cover_image_url?: string | null
          created_at?: string
          creator_type?: string | null
          deleted_at?: string | null
          display_name: string
          engagement_rate?: number | null
          fastest_delivery_days?: number | null
          featured?: boolean
          followers_count?: number
          gender?: Database["public"]["Enums"]["gender_type"] | null
          headline?: string | null
          id?: string
          intro_video_url?: string | null
          onboarding_step?: number
          profile_id: string
          profile_image_url?: string | null
          profile_views?: number
          published_at?: string | null
          rating?: number
          rejection_reason?: string | null
          response_time?: string | null
          review_count?: number
          search_vector?: unknown
          slug: string
          starting_price?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["creator_status"]
          updated_at?: string
          verified?: boolean
          wishlist_count?: number
        }
        Update: {
          age?: number | null
          approved_at?: string | null
          available?: boolean
          barter_available?: boolean
          bio?: string | null
          city?: string | null
          completed_orders?: number
          content_types?: string[]
          country?: string
          cover_image_url?: string | null
          created_at?: string
          creator_type?: string | null
          deleted_at?: string | null
          display_name?: string
          engagement_rate?: number | null
          fastest_delivery_days?: number | null
          featured?: boolean
          followers_count?: number
          gender?: Database["public"]["Enums"]["gender_type"] | null
          headline?: string | null
          id?: string
          intro_video_url?: string | null
          onboarding_step?: number
          profile_id?: string
          profile_image_url?: string | null
          profile_views?: number
          published_at?: string | null
          rating?: number
          rejection_reason?: string | null
          response_time?: string | null
          review_count?: number
          search_vector?: unknown
          slug?: string
          starting_price?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["creator_status"]
          updated_at?: string
          verified?: boolean
          wishlist_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "creators_creator_type_fkey"
            columns: ["creator_type"]
            isOneToOne: false
            referencedRelation: "creator_types"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "creators_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_deliveries: {
        Row: {
          attempts: number
          category: string
          created_at: string
          email_type: string
          id: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          notification_id: string | null
          provider: string | null
          provider_message_id: string | null
          recipient_email: string
          sent_at: string | null
          status: string
          subject: string | null
          user_id: string | null
        }
        Insert: {
          attempts?: number
          category?: string
          created_at?: string
          email_type: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          notification_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          recipient_email: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          attempts?: number
          category?: string
          created_at?: string
          email_type?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          notification_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          recipient_email?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: true
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          emailed_at: string | null
          id: string
          message: string | null
          read: boolean
          read_at: string | null
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          emailed_at?: string | null
          id?: string
          message?: string | null
          read?: boolean
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          emailed_at?: string | null
          id?: string
          message?: string | null
          read?: boolean
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_deliverables: {
        Row: {
          created_at: string
          external_url: string | null
          file_name: string | null
          id: string
          mime_type: string | null
          note: string | null
          order_id: string
          revision_id: string | null
          round: number
          size_bytes: number | null
          storage_path: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          external_url?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          note?: string | null
          order_id: string
          revision_id?: string | null
          round?: number
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          external_url?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          note?: string | null
          order_id?: string
          revision_id?: string | null
          round?: number
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_deliverables_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_deliverables_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "order_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_deliverables_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          addon_id: string | null
          created_at: string
          description: string | null
          id: string
          item_type: string
          metadata: Json
          name: string
          order_id: string
          quantity: number
          service_id: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          addon_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          item_type: string
          metadata?: Json
          name: string
          order_id: string
          quantity?: number
          service_id?: string | null
          total_price: number
          unit_price: number
        }
        Update: {
          addon_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          item_type?: string
          metadata?: Json
          name?: string
          order_id?: string
          quantity?: number
          service_id?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "service_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "creator_services"
            referencedColumns: ["id"]
          },
        ]
      }
      order_revisions: {
        Row: {
          attachments: Json
          created_at: string
          id: string
          instructions: string | null
          order_id: string
          reason: string
          requested_by: string | null
          resolved_at: string | null
          revision_number: number
          status: Database["public"]["Enums"]["revision_status"]
          submitted_at: string | null
        }
        Insert: {
          attachments?: Json
          created_at?: string
          id?: string
          instructions?: string | null
          order_id: string
          reason: string
          requested_by?: string | null
          resolved_at?: string | null
          revision_number: number
          status?: Database["public"]["Enums"]["revision_status"]
          submitted_at?: string | null
        }
        Update: {
          attachments?: Json
          created_at?: string
          id?: string
          instructions?: string | null
          order_id?: string
          reason?: string
          requested_by?: string | null
          resolved_at?: string | null
          revision_number?: number
          status?: Database["public"]["Enums"]["revision_status"]
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_revisions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_revisions_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          actor_role: Database["public"]["Enums"]["actor_role"]
          changed_by: string | null
          created_at: string
          id: string
          metadata: Json
          new_status: Database["public"]["Enums"]["order_status"]
          old_status: Database["public"]["Enums"]["order_status"] | null
          order_id: string
          reason: string | null
        }
        Insert: {
          actor_role?: Database["public"]["Enums"]["actor_role"]
          changed_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_status: Database["public"]["Enums"]["order_status"]
          old_status?: Database["public"]["Enums"]["order_status"] | null
          order_id: string
          reason?: string | null
        }
        Update: {
          actor_role?: Database["public"]["Enums"]["actor_role"]
          changed_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_status?: Database["public"]["Enums"]["order_status"]
          old_status?: Database["public"]["Enums"]["order_status"] | null
          order_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_transitions: {
        Row: {
          actor: Database["public"]["Enums"]["actor_role"]
          description: string | null
          from_status: Database["public"]["Enums"]["order_status"]
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          actor: Database["public"]["Enums"]["actor_role"]
          description?: string | null
          from_status: Database["public"]["Enums"]["order_status"]
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          actor?: Database["public"]["Enums"]["actor_role"]
          description?: string | null
          from_status?: Database["public"]["Enums"]["order_status"]
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: []
      }
      orders: {
        Row: {
          accepted_at: string | null
          addons_total: number
          approved_at: string | null
          brand_id: string
          brief_id: string | null
          brief_snapshot: Json | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          content_type: string | null
          created_at: string
          creator_earning_amount: number
          creator_id: string
          currency: string
          delivered_at: string | null
          delivery_days: number
          due_at: string | null
          id: string
          order_number: string
          paid_at: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          refund_required: boolean
          requirements: string | null
          requires_shipping: boolean
          revisions_allowed: number
          revisions_used: number
          service_description: string | null
          service_id: string | null
          service_title: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          addons_total?: number
          approved_at?: string | null
          brand_id: string
          brief_id?: string | null
          brief_snapshot?: Json | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          content_type?: string | null
          created_at?: string
          creator_earning_amount: number
          creator_id: string
          currency?: string
          delivered_at?: string | null
          delivery_days: number
          due_at?: string | null
          id?: string
          order_number?: string
          paid_at?: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          refund_required?: boolean
          requirements?: string | null
          requires_shipping?: boolean
          revisions_allowed?: number
          revisions_used?: number
          service_description?: string | null
          service_id?: string | null
          service_title: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          addons_total?: number
          approved_at?: string | null
          brand_id?: string
          brief_id?: string | null
          brief_snapshot?: Json | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          content_type?: string | null
          created_at?: string
          creator_earning_amount?: number
          creator_id?: string
          currency?: string
          delivered_at?: string | null
          delivery_days?: number
          due_at?: string | null
          id?: string
          order_number?: string
          paid_at?: string | null
          platform_fee_amount?: number
          platform_fee_percent?: number
          refund_required?: boolean
          requirements?: string | null
          requires_shipping?: boolean
          revisions_allowed?: number
          revisions_used?: number
          service_description?: string | null
          service_id?: string | null
          service_title?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "creator_services"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_refunds: {
        Row: {
          amount: number
          created_at: string
          id: string
          initiated_by: string | null
          order_id: string
          payment_id: string
          provider_refund_id: string | null
          raw_response: Json | null
          reason: string | null
          status: Database["public"]["Enums"]["refund_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          initiated_by?: string | null
          order_id: string
          payment_id: string
          provider_refund_id?: string | null
          raw_response?: Json | null
          reason?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          initiated_by?: string | null
          order_id?: string
          payment_id?: string
          provider_refund_id?: string | null
          raw_response?: Json | null
          reason?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_refunds_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          captured_at: string | null
          created_at: string
          currency: string
          error_code: string | null
          error_description: string | null
          id: string
          method: string | null
          order_id: string
          payer_id: string | null
          provider: string
          provider_order_id: string | null
          provider_payment_id: string | null
          raw_response: Json | null
          refunded_amount: number
          signature: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          captured_at?: string | null
          created_at?: string
          currency?: string
          error_code?: string | null
          error_description?: string | null
          id?: string
          method?: string | null
          order_id: string
          payer_id?: string | null
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          raw_response?: Json | null
          refunded_amount?: number
          signature?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          captured_at?: string | null
          created_at?: string
          currency?: string
          error_code?: string | null
          error_description?: string | null
          id?: string
          method?: string | null
          order_id?: string
          payer_id?: string | null
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          raw_response?: Json | null
          refunded_amount?: number
          signature?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_methods: {
        Row: {
          account_holder_name: string
          bank_account_last4: string | null
          bank_account_number: string | null
          bank_name: string | null
          created_at: string
          creator_id: string
          id: string
          ifsc_code: string | null
          method_type: Database["public"]["Enums"]["payout_method_type"]
          updated_at: string
          upi_id: string | null
          verified: boolean
        }
        Insert: {
          account_holder_name: string
          bank_account_last4?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string
          creator_id: string
          id?: string
          ifsc_code?: string | null
          method_type: Database["public"]["Enums"]["payout_method_type"]
          updated_at?: string
          upi_id?: string | null
          verified?: boolean
        }
        Update: {
          account_holder_name?: string
          bank_account_last4?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string
          creator_id?: string
          id?: string
          ifsc_code?: string | null
          method_type?: Database["public"]["Enums"]["payout_method_type"]
          updated_at?: string
          upi_id?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payout_methods_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          creator_id: string
          currency: string
          id: string
          notes: string | null
          payout_method_snapshot: Json
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          creator_id: string
          currency?: string
          id?: string
          notes?: string | null
          payout_method_snapshot?: Json
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          creator_id?: string
          currency?: string
          id?: string
          notes?: string | null
          payout_method_snapshot?: Json
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_transactions: {
        Row: {
          amount: number
          created_at: string
          failure_reason: string | null
          id: string
          metadata: Json
          payout_request_id: string
          processed_by: string | null
          provider: string
          provider_reference: string | null
          status: Database["public"]["Enums"]["payout_txn_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          metadata?: Json
          payout_request_id: string
          processed_by?: string | null
          provider?: string
          provider_reference?: string | null
          status?: Database["public"]["Enums"]["payout_txn_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          metadata?: Json
          payout_request_id?: string
          processed_by?: string | null
          provider?: string
          provider_reference?: string | null
          status?: Database["public"]["Enums"]["payout_txn_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_transactions_payout_request_id_fkey"
            columns: ["payout_request_id"]
            isOneToOne: false
            referencedRelation: "payout_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_transactions_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_items: {
        Row: {
          brand_name: string | null
          category_id: string | null
          created_at: string
          creator_id: string
          description: string | null
          duration_seconds: number | null
          height: number | null
          id: string
          is_hidden: boolean
          media_url: string
          platform: Database["public"]["Enums"]["social_platform"] | null
          sort_order: number
          storage_path: string | null
          thumbnail_url: string | null
          title: string | null
          type: Database["public"]["Enums"]["portfolio_item_type"]
          updated_at: string
          width: number | null
        }
        Insert: {
          brand_name?: string | null
          category_id?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          duration_seconds?: number | null
          height?: number | null
          id?: string
          is_hidden?: boolean
          media_url: string
          platform?: Database["public"]["Enums"]["social_platform"] | null
          sort_order?: number
          storage_path?: string | null
          thumbnail_url?: string | null
          title?: string | null
          type: Database["public"]["Enums"]["portfolio_item_type"]
          updated_at?: string
          width?: number | null
        }
        Update: {
          brand_name?: string | null
          category_id?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          duration_seconds?: number | null
          height?: number | null
          id?: string
          is_hidden?: boolean
          media_url?: string
          platform?: Database["public"]["Enums"]["social_platform"] | null
          sort_order?: number
          storage_path?: string | null
          thumbnail_url?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["portfolio_item_type"]
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_items_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          email_account: boolean
          email_campaigns: boolean
          email_marketing: boolean
          email_notifications: boolean
          email_orders: boolean
          email_payments: boolean
          full_name: string | null
          id: string
          last_seen_at: string | null
          onboarding_completed: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          email_account?: boolean
          email_campaigns?: boolean
          email_marketing?: boolean
          email_notifications?: boolean
          email_orders?: boolean
          email_payments?: boolean
          full_name?: string | null
          id: string
          last_seen_at?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          email_account?: boolean
          email_campaigns?: boolean
          email_marketing?: boolean
          email_notifications?: boolean
          email_orders?: boolean
          email_payments?: boolean
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_note: string | null
          created_at: string
          description: string | null
          id: string
          reason: string
          reported_by: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reported_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reported_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          brand_id: string
          comment: string | null
          created_at: string
          creator_id: string
          id: string
          order_id: string
          rating: number
          responded_at: string | null
          response: string | null
          reviewer_id: string
          reviewer_role: Database["public"]["Enums"]["actor_role"]
          status: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          comment?: string | null
          created_at?: string
          creator_id: string
          id?: string
          order_id: string
          rating: number
          responded_at?: string | null
          response?: string | null
          reviewer_id: string
          reviewer_role: Database["public"]["Enums"]["actor_role"]
          status?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          comment?: string | null
          created_at?: string
          creator_id?: string
          id?: string
          order_id?: string
          rating?: number
          responded_at?: string | null
          response?: string | null
          reviewer_id?: string
          reviewer_role?: Database["public"]["Enums"]["actor_role"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      search_events: {
        Row: {
          created_at: string
          filters: Json
          id: number
          profile_id: string | null
          query: string | null
          results_count: number | null
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: never
          profile_id?: string | null
          query?: string | null
          results_count?: number | null
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: never
          profile_id?: string | null
          query?: string | null
          results_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "search_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_addons: {
        Row: {
          active: boolean
          addon_type: Database["public"]["Enums"]["addon_type"]
          created_at: string
          delivery_days_override: number | null
          description: string | null
          extra_revisions: number
          id: string
          name: string
          price: number
          service_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          addon_type?: Database["public"]["Enums"]["addon_type"]
          created_at?: string
          delivery_days_override?: number | null
          description?: string | null
          extra_revisions?: number
          id?: string
          name: string
          price: number
          service_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          addon_type?: Database["public"]["Enums"]["addon_type"]
          created_at?: string
          delivery_days_override?: number | null
          description?: string | null
          extra_revisions?: number
          id?: string
          name?: string
          price?: number
          service_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_addons_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "creator_services"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_details: {
        Row: {
          address: string | null
          address_submitted_at: string | null
          city: string | null
          country: string | null
          courier: string | null
          created_at: string
          id: string
          notes: string | null
          order_id: string
          phone: string | null
          postal_code: string | null
          received_at: string | null
          recipient_name: string | null
          shipped_at: string | null
          shipping_required: boolean
          state: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          address_submitted_at?: string | null
          city?: string | null
          country?: string | null
          courier?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          phone?: string | null
          postal_code?: string | null
          received_at?: string | null
          recipient_name?: string | null
          shipped_at?: string | null
          shipping_required?: boolean
          state?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          address_submitted_at?: string | null
          city?: string | null
          country?: string | null
          courier?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          phone?: string | null
          postal_code?: string | null
          received_at?: string | null
          recipient_name?: string | null
          shipped_at?: string | null
          shipping_required?: boolean
          state?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_details_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          note: string | null
          wishlist_id: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          note?: string | null
          wishlist_id: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          note?: string | null
          wishlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_wishlist_id_fkey"
            columns: ["wishlist_id"]
            isOneToOne: false
            referencedRelation: "wishlists"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          brand_id: string
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_order: {
        Args: { p_order_id: string; p_shipping?: Json }
        Returns: {
          accepted_at: string | null
          addons_total: number
          approved_at: string | null
          brand_id: string
          brief_id: string | null
          brief_snapshot: Json | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          content_type: string | null
          created_at: string
          creator_earning_amount: number
          creator_id: string
          currency: string
          delivered_at: string | null
          delivery_days: number
          due_at: string | null
          id: string
          order_number: string
          paid_at: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          refund_required: boolean
          requirements: string | null
          requires_shipping: boolean
          revisions_allowed: number
          revisions_used: number
          service_description: string | null
          service_id: string | null
          service_title: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_application_stats: { Args: never; Returns: Json }
      admin_broadcast_notification: {
        Args: {
          p_action_url?: string
          p_audience: string
          p_message: string
          p_title: string
        }
        Returns: number
      }
      admin_creator_rankings: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          admin_rating: number
          city: string
          display_name: string
          featured: boolean
          followers_count: number
          id: string
          pinned_at: string
          profile_image_url: string
          rank_position: number
          rating: number
          review_count: number
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["creator_status"]
          total_count: number
          verified: boolean
        }[]
      }
      admin_dashboard_stats: { Args: never; Returns: Json }
      admin_email_stats: { Args: never; Returns: Json }
      admin_list_brands: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_sort?: string
          p_status?: string
        }
        Returns: {
          account_status: Database["public"]["Enums"]["account_status"]
          brand_logo_url: string
          brand_name: string
          brand_slug: string
          contact_email: string
          contact_phone: string
          email: string
          id: string
          industry: string
          joined_at: string
          last_activity_at: string
          location: string
          orders_count: number
          profile_id: string
          spend: number
          total_count: number
        }[]
      }
      admin_list_creators: {
        Args: {
          p_featured?: boolean
          p_include_deleted?: boolean
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_sort?: string
          p_status?: string
          p_verified?: boolean
        }
        Returns: {
          account_status: Database["public"]["Enums"]["account_status"]
          available: boolean
          categories: string[]
          city: string
          deleted_at: string
          display_name: string
          email: string
          featured: boolean
          followers_count: number
          id: string
          joined_at: string
          orders_count: number
          profile_id: string
          profile_image_url: string
          rating: number
          revenue: number
          review_count: number
          slug: string
          state: string
          status: Database["public"]["Enums"]["creator_status"]
          total_count: number
          verified: boolean
        }[]
      }
      admin_list_people: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_role?: string
          p_search?: string
          p_sort?: string
          p_status?: string
        }
        Returns: {
          avatar_url: string
          created_at: string
          display_name: string
          email: string
          entity_id: string
          full_name: string
          id: string
          is_admin: boolean
          last_seen_at: string
          onboarding_completed: boolean
          orders_count: number
          role: string
          status: string
          total_count: number
          total_value: number
          verified: boolean
        }[]
      }
      admin_moderate_portfolio_item: {
        Args: { p_hidden: boolean; p_item_id: string }
        Returns: {
          brand_name: string | null
          category_id: string | null
          created_at: string
          creator_id: string
          description: string | null
          duration_seconds: number | null
          height: number | null
          id: string
          is_hidden: boolean
          media_url: string
          platform: Database["public"]["Enums"]["social_platform"] | null
          sort_order: number
          storage_path: string | null
          thumbnail_url: string | null
          title: string | null
          type: Database["public"]["Enums"]["portfolio_item_type"]
          updated_at: string
          width: number | null
        }
        SetofOptions: {
          from: "*"
          to: "portfolio_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_moderate_review: {
        Args: { p_review_id: string; p_status: string }
        Returns: {
          brand_id: string
          comment: string | null
          created_at: string
          creator_id: string
          id: string
          order_id: string
          rating: number
          responded_at: string | null
          response: string | null
          reviewer_id: string
          reviewer_role: Database["public"]["Enums"]["actor_role"]
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_people_stats: { Args: never; Returns: Json }
      admin_pin_creator: {
        Args: { p_creator_id: string; p_pinned?: boolean }
        Returns: undefined
      }
      admin_rate_application: {
        Args: { p_id: string; p_rating: number }
        Returns: {
          admin_rating: number | null
          bio: string | null
          brand_name: string | null
          budget_range: string | null
          categories: string[] | null
          city: string | null
          created_at: string
          discover: boolean
          email: string
          followers_count: number | null
          full_name: string
          id: string
          image_path: string | null
          invited_at: string | null
          looking_for: string | null
          message: string | null
          phone: string | null
          portfolio_url: string | null
          profile: Json
          profile_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          social_handle: string | null
          social_platform: string | null
          status: string
          video_path: string | null
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_reorder_creators: { Args: { p_ids: string[] }; Returns: undefined }
      admin_restore_creator: {
        Args: { p_creator_id: string }
        Returns: {
          age: number | null
          approved_at: string | null
          available: boolean
          barter_available: boolean
          bio: string | null
          city: string | null
          completed_orders: number
          content_types: string[]
          country: string
          cover_image_url: string | null
          created_at: string
          creator_type: string | null
          deleted_at: string | null
          display_name: string
          engagement_rate: number | null
          fastest_delivery_days: number | null
          featured: boolean
          followers_count: number
          gender: Database["public"]["Enums"]["gender_type"] | null
          headline: string | null
          id: string
          intro_video_url: string | null
          onboarding_step: number
          profile_id: string
          profile_image_url: string | null
          profile_views: number
          published_at: string | null
          rating: number
          rejection_reason: string | null
          response_time: string | null
          review_count: number
          search_vector: unknown
          slug: string
          starting_price: number | null
          state: string | null
          status: Database["public"]["Enums"]["creator_status"]
          updated_at: string
          verified: boolean
          wishlist_count: number
        }
        SetofOptions: {
          from: "*"
          to: "creators"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_reveal_payout_method: {
        Args: { p_payout_request_id: string }
        Returns: Json
      }
      admin_revenue_summary: { Args: never; Returns: Json }
      admin_review_application: {
        Args: { p_id: string; p_note?: string; p_status: string }
        Returns: {
          admin_rating: number | null
          bio: string | null
          brand_name: string | null
          budget_range: string | null
          categories: string[] | null
          city: string | null
          created_at: string
          discover: boolean
          email: string
          followers_count: number | null
          full_name: string
          id: string
          image_path: string | null
          invited_at: string | null
          looking_for: string | null
          message: string | null
          phone: string | null
          portfolio_url: string | null
          profile: Json
          profile_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          social_handle: string | null
          social_platform: string | null
          status: string
          video_path: string | null
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_review_creator_verification: {
        Args: { p_id: string; p_note?: string; p_status: string }
        Returns: {
          address_line: string | null
          city: string | null
          created_at: string
          creator_id: string
          date_of_birth: string | null
          document_number_last4: string | null
          document_path: string | null
          document_type: string | null
          id: string
          legal_name: string
          note: string | null
          postal_code: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string | null
          status: string
          submitted_at: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "creator_verifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_application_discover: {
        Args: { p_discover: boolean; p_id: string }
        Returns: {
          admin_rating: number | null
          bio: string | null
          brand_name: string | null
          budget_range: string | null
          categories: string[] | null
          city: string | null
          created_at: string
          discover: boolean
          email: string
          followers_count: number | null
          full_name: string
          id: string
          image_path: string | null
          invited_at: string | null
          looking_for: string | null
          message: string | null
          phone: string | null
          portfolio_url: string | null
          profile: Json
          profile_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          social_handle: string | null
          social_platform: string | null
          status: string
          video_path: string | null
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_creator_flags: {
        Args: {
          p_creator_id: string
          p_featured?: boolean
          p_verified?: boolean
        }
        Returns: {
          age: number | null
          approved_at: string | null
          available: boolean
          barter_available: boolean
          bio: string | null
          city: string | null
          completed_orders: number
          content_types: string[]
          country: string
          cover_image_url: string | null
          created_at: string
          creator_type: string | null
          deleted_at: string | null
          display_name: string
          engagement_rate: number | null
          fastest_delivery_days: number | null
          featured: boolean
          followers_count: number
          gender: Database["public"]["Enums"]["gender_type"] | null
          headline: string | null
          id: string
          intro_video_url: string | null
          onboarding_step: number
          profile_id: string
          profile_image_url: string | null
          profile_views: number
          published_at: string | null
          rating: number
          rejection_reason: string | null
          response_time: string | null
          review_count: number
          search_vector: unknown
          slug: string
          starting_price: number | null
          state: string | null
          status: Database["public"]["Enums"]["creator_status"]
          updated_at: string
          verified: boolean
          wishlist_count: number
        }
        SetofOptions: {
          from: "*"
          to: "creators"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_creator_rating: {
        Args: { p_creator_id: string; p_rating: number }
        Returns: undefined
      }
      admin_set_creator_status: {
        Args: {
          p_creator_id: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["creator_status"]
        }
        Returns: {
          age: number | null
          approved_at: string | null
          available: boolean
          barter_available: boolean
          bio: string | null
          city: string | null
          completed_orders: number
          content_types: string[]
          country: string
          cover_image_url: string | null
          created_at: string
          creator_type: string | null
          deleted_at: string | null
          display_name: string
          engagement_rate: number | null
          fastest_delivery_days: number | null
          featured: boolean
          followers_count: number
          gender: Database["public"]["Enums"]["gender_type"] | null
          headline: string | null
          id: string
          intro_video_url: string | null
          onboarding_step: number
          profile_id: string
          profile_image_url: string | null
          profile_views: number
          published_at: string | null
          rating: number
          rejection_reason: string | null
          response_time: string | null
          review_count: number
          search_vector: unknown
          slug: string
          starting_price: number | null
          state: string | null
          status: Database["public"]["Enums"]["creator_status"]
          updated_at: string
          verified: boolean
          wishlist_count: number
        }
        SetofOptions: {
          from: "*"
          to: "creators"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_user_status: {
        Args: {
          p_profile_id: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["account_status"]
        }
        Returns: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          email_account: boolean
          email_campaigns: boolean
          email_marketing: boolean
          email_notifications: boolean
          email_orders: boolean
          email_payments: boolean
          full_name: string | null
          id: string
          last_seen_at: string | null
          onboarding_completed: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_soft_delete_creator: {
        Args: { p_creator_id: string; p_reason?: string }
        Returns: {
          age: number | null
          approved_at: string | null
          available: boolean
          barter_available: boolean
          bio: string | null
          city: string | null
          completed_orders: number
          content_types: string[]
          country: string
          cover_image_url: string | null
          created_at: string
          creator_type: string | null
          deleted_at: string | null
          display_name: string
          engagement_rate: number | null
          fastest_delivery_days: number | null
          featured: boolean
          followers_count: number
          gender: Database["public"]["Enums"]["gender_type"] | null
          headline: string | null
          id: string
          intro_video_url: string | null
          onboarding_step: number
          profile_id: string
          profile_image_url: string | null
          profile_views: number
          published_at: string | null
          rating: number
          rejection_reason: string | null
          response_time: string | null
          review_count: number
          search_vector: unknown
          slug: string
          starting_price: number | null
          state: string | null
          status: Database["public"]["Enums"]["creator_status"]
          updated_at: string
          verified: boolean
          wishlist_count: number
        }
        SetofOptions: {
          from: "*"
          to: "creators"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_timeseries: {
        Args: { p_days?: number }
        Returns: {
          conversion_rate: number
          day: string
          gmv: number
          new_brands: number
          new_creators: number
          orders_completed: number
          orders_created: number
          orders_paid: number
          platform_revenue: number
        }[]
      }
      admin_transition_order: {
        Args: {
          p_actor_id: string
          p_order_id: string
          p_reason: string
          p_to: Database["public"]["Enums"]["order_status"]
        }
        Returns: {
          accepted_at: string | null
          addons_total: number
          approved_at: string | null
          brand_id: string
          brief_id: string | null
          brief_snapshot: Json | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          content_type: string | null
          created_at: string
          creator_earning_amount: number
          creator_id: string
          currency: string
          delivered_at: string | null
          delivery_days: number
          due_at: string | null
          id: string
          order_number: string
          paid_at: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          refund_required: boolean
          requirements: string | null
          requires_shipping: boolean
          revisions_allowed: number
          revisions_used: number
          service_description: string | null
          service_id: string | null
          service_title: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_brand: {
        Args: { p_brand_id: string; p_patch: Json }
        Returns: {
          brand_logo_url: string | null
          brand_name: string
          brand_pronunciation: string | null
          brand_slug: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          id: string
          industry: string | null
          instagram_url: string | null
          location: string | null
          profile_id: string
          pronunciation_audio_url: string | null
          updated_at: string
          website_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "brands"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_contact_message: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      admin_update_creator: {
        Args: { p_creator_id: string; p_patch: Json }
        Returns: {
          age: number | null
          approved_at: string | null
          available: boolean
          barter_available: boolean
          bio: string | null
          city: string | null
          completed_orders: number
          content_types: string[]
          country: string
          cover_image_url: string | null
          created_at: string
          creator_type: string | null
          deleted_at: string | null
          display_name: string
          engagement_rate: number | null
          fastest_delivery_days: number | null
          featured: boolean
          followers_count: number
          gender: Database["public"]["Enums"]["gender_type"] | null
          headline: string | null
          id: string
          intro_video_url: string | null
          onboarding_step: number
          profile_id: string
          profile_image_url: string | null
          profile_views: number
          published_at: string | null
          rating: number
          rejection_reason: string | null
          response_time: string | null
          review_count: number
          search_vector: unknown
          slug: string
          starting_price: number | null
          state: string | null
          status: Database["public"]["Enums"]["creator_status"]
          updated_at: string
          verified: boolean
          wishlist_count: number
        }
        SetofOptions: {
          from: "*"
          to: "creators"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_report: {
        Args: {
          p_note?: string
          p_report_id: string
          p_status: Database["public"]["Enums"]["report_status"]
        }
        Returns: {
          admin_note: string | null
          created_at: string
          description: string | null
          id: string
          reason: string
          reported_by: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: {
          description: string | null
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        SetofOptions: {
          from: "*"
          to: "platform_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_order: {
        Args: { p_order_id: string }
        Returns: {
          accepted_at: string | null
          addons_total: number
          approved_at: string | null
          brand_id: string
          brief_id: string | null
          brief_snapshot: Json | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          content_type: string | null
          created_at: string
          creator_earning_amount: number
          creator_id: string
          currency: string
          delivered_at: string | null
          delivery_days: number
          due_at: string | null
          id: string
          order_number: string
          paid_at: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          refund_required: boolean
          requirements: string | null
          requires_shipping: boolean
          revisions_allowed: number
          revisions_used: number
          service_description: string | null
          service_id: string | null
          service_title: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      auto_approve_stale_deliveries: { Args: never; Returns: number }
      auto_cancel_unaccepted_orders: { Args: never; Returns: number }
      calculate_creator_earnings: { Args: { p_amount: number }; Returns: Json }
      calculate_order_total: {
        Args: { p_addon_ids?: string[]; p_service_id: string }
        Returns: Json
      }
      calculate_platform_fee: { Args: { p_amount: number }; Returns: number }
      cancel_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: {
          accepted_at: string | null
          addons_total: number
          approved_at: string | null
          brand_id: string
          brief_id: string | null
          brief_snapshot: Json | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          content_type: string | null
          created_at: string
          creator_earning_amount: number
          creator_id: string
          currency: string
          delivered_at: string | null
          delivery_days: number
          due_at: string | null
          id: string
          order_number: string
          paid_at: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          refund_required: boolean
          requirements: string | null
          requires_shipping: boolean
          revisions_allowed: number
          revisions_used: number
          service_description: string | null
          service_id: string | null
          service_title: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_pending_emails: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          category: string
          created_at: string
          email_type: string
          id: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          notification_id: string | null
          provider: string | null
          provider_message_id: string | null
          recipient_email: string
          sent_at: string | null
          status: string
          subject: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "email_deliveries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_onboarding: {
        Args: never
        Returns: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          email_account: boolean
          email_campaigns: boolean
          email_marketing: boolean
          email_notifications: boolean
          email_orders: boolean
          email_payments: boolean
          full_name: string | null
          id: string
          last_seen_at: string | null
          onboarding_completed: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_payout: {
        Args: {
          p_action: string
          p_actor_id: string
          p_metadata?: Json
          p_note?: string
          p_payout_request_id: string
          p_provider?: string
          p_reference?: string
        }
        Returns: {
          admin_note: string | null
          amount: number
          created_at: string
          creator_id: string
          currency: string
          id: string
          notes: string | null
          payout_method_snapshot: Json
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payout_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_order_payment: {
        Args: {
          p_amount_paise?: number
          p_method?: string
          p_provider_order_id: string
          p_provider_payment_id: string
          p_raw?: Json
          p_signature?: string
        }
        Returns: {
          accepted_at: string | null
          addons_total: number
          approved_at: string | null
          brand_id: string
          brief_id: string | null
          brief_snapshot: Json | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          content_type: string | null
          created_at: string
          creator_earning_amount: number
          creator_id: string
          currency: string
          delivered_at: string | null
          delivery_days: number
          due_at: string | null
          id: string
          order_number: string
          paid_at: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          refund_required: boolean
          requirements: string | null
          requires_shipping: boolean
          revisions_allowed: number
          revisions_used: number
          service_description: string | null
          service_id: string | null
          service_title: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_audit_log: {
        Args: {
          p_action: string
          p_actor_id: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      create_order: {
        Args: {
          p_addon_ids?: string[]
          p_brief_id?: string
          p_requirements?: string
          p_service_id: string
        }
        Returns: {
          accepted_at: string | null
          addons_total: number
          approved_at: string | null
          brand_id: string
          brief_id: string | null
          brief_snapshot: Json | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          content_type: string | null
          created_at: string
          creator_earning_amount: number
          creator_id: string
          currency: string
          delivered_at: string | null
          delivery_days: number
          due_at: string | null
          id: string
          order_number: string
          paid_at: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          refund_required: boolean
          requirements: string | null
          requires_shipping: boolean
          revisions_allowed: number
          revisions_used: number
          service_description: string | null
          service_id: string | null
          service_title: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_payout_request: {
        Args: { p_notes?: string; p_profile_id: string }
        Returns: {
          admin_note: string | null
          amount: number
          created_at: string
          creator_id: string
          currency: string
          id: string
          notes: string | null
          payout_method_snapshot: Json
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payout_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_report: {
        Args: {
          p_description?: string
          p_reason: string
          p_target_id: string
          p_target_type: Database["public"]["Enums"]["report_target"]
        }
        Returns: {
          admin_note: string | null
          created_at: string
          description: string | null
          id: string
          reason: string
          reported_by: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decline_order: {
        Args: { p_order_id: string; p_reason: string }
        Returns: {
          accepted_at: string | null
          addons_total: number
          approved_at: string | null
          brand_id: string
          brief_id: string | null
          brief_snapshot: Json | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          content_type: string | null
          created_at: string
          creator_earning_amount: number
          creator_id: string
          currency: string
          delivered_at: string | null
          delivery_days: number
          due_at: string | null
          id: string
          order_number: string
          paid_at: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          refund_required: boolean
          requirements: string | null
          requires_shipping: boolean
          revisions_allowed: number
          revisions_used: number
          service_description: string | null
          service_id: string | null
          service_title: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_pending_payments: { Args: never; Returns: number }
      get_brand_dashboard_stats: { Args: never; Returns: Json }
      get_creator_completion: { Args: { p_creator_id?: string }; Returns: Json }
      get_creator_dashboard_stats: { Args: never; Returns: Json }
      get_creator_requirements: {
        Args: { p_creator_id?: string }
        Returns: Json
      }
      get_creator_reviews: {
        Args: { p_creator_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          brand_logo_url: string
          brand_name: string
          comment: string
          created_at: string
          id: string
          rating: number
          responded_at: string
          response: string
          service_title: string
          total_count: number
        }[]
      }
      get_earnings_summary: { Args: never; Returns: Json }
      get_public_stats: { Args: never; Returns: Json }
      get_unread_counts: { Args: never; Returns: Json }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_application_invited: {
        Args: { p_application_id: string }
        Returns: undefined
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      mark_order_shipped: {
        Args: {
          p_courier: string
          p_order_id: string
          p_tracking_number: string
          p_tracking_url?: string
        }
        Returns: {
          accepted_at: string | null
          addons_total: number
          approved_at: string | null
          brand_id: string
          brief_id: string | null
          brief_snapshot: Json | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          content_type: string | null
          created_at: string
          creator_earning_amount: number
          creator_id: string
          currency: string
          delivered_at: string | null
          delivery_days: number
          due_at: string | null
          id: string
          order_number: string
          paid_at: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          refund_required: boolean
          requirements: string | null
          requires_shipping: boolean
          revisions_allowed: number
          revisions_used: number
          service_description: string | null
          service_id: string | null
          service_title: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_payment_failed: {
        Args: {
          p_error_code?: string
          p_error_description?: string
          p_provider_order_id: string
          p_provider_payment_id?: string
          p_raw?: Json
        }
        Returns: {
          amount: number
          captured_at: string | null
          created_at: string
          currency: string
          error_code: string | null
          error_description: string | null
          id: string
          method: string | null
          order_id: string
          payer_id: string | null
          provider: string
          provider_order_id: string | null
          provider_payment_id: string | null
          raw_response: Json | null
          refunded_amount: number
          signature: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_product_received: {
        Args: { p_order_id: string }
        Returns: {
          accepted_at: string | null
          addons_total: number
          approved_at: string | null
          brand_id: string
          brief_id: string | null
          brief_snapshot: Json | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          content_type: string | null
          created_at: string
          creator_earning_amount: number
          creator_id: string
          currency: string
          delivered_at: string | null
          delivery_days: number
          due_at: string | null
          id: string
          order_number: string
          paid_at: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          refund_required: boolean
          requirements: string | null
          requires_shipping: boolean
          revisions_allowed: number
          revisions_used: number
          service_description: string | null
          service_id: string | null
          service_title: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      provision_application_account: {
        Args: { p_application_id: string; p_media?: Json; p_profile_id: string }
        Returns: {
          admin_rating: number | null
          bio: string | null
          brand_name: string | null
          budget_range: string | null
          categories: string[] | null
          city: string | null
          created_at: string
          discover: boolean
          email: string
          followers_count: number | null
          full_name: string
          id: string
          image_path: string | null
          invited_at: string | null
          looking_for: string | null
          message: string | null
          phone: string | null
          portfolio_url: string | null
          profile: Json
          profile_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          social_handle: string | null
          social_platform: string | null
          status: string
          video_path: string | null
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_creator_profile: {
        Args: never
        Returns: {
          age: number | null
          approved_at: string | null
          available: boolean
          barter_available: boolean
          bio: string | null
          city: string | null
          completed_orders: number
          content_types: string[]
          country: string
          cover_image_url: string | null
          created_at: string
          creator_type: string | null
          deleted_at: string | null
          display_name: string
          engagement_rate: number | null
          fastest_delivery_days: number | null
          featured: boolean
          followers_count: number
          gender: Database["public"]["Enums"]["gender_type"] | null
          headline: string | null
          id: string
          intro_video_url: string | null
          onboarding_step: number
          profile_id: string
          profile_image_url: string | null
          profile_views: number
          published_at: string | null
          rating: number
          rejection_reason: string | null
          response_time: string | null
          review_count: number
          search_vector: unknown
          slug: string
          starting_price: number | null
          state: string | null
          status: Database["public"]["Enums"]["creator_status"]
          updated_at: string
          verified: boolean
          wishlist_count: number
        }
        SetofOptions: {
          from: "*"
          to: "creators"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_auth_event: { Args: { p_event: string }; Returns: undefined }
      record_email_result: {
        Args: {
          p_error?: string
          p_id: string
          p_message_id?: string
          p_provider?: string
          p_status: string
        }
        Returns: undefined
      }
      record_profile_view: {
        Args: { p_creator_id: string }
        Returns: undefined
      }
      record_refund: {
        Args: {
          p_actor_id?: string
          p_amount: number
          p_payment_id: string
          p_provider_refund_id: string
          p_raw?: Json
          p_reason?: string
          p_status: Database["public"]["Enums"]["refund_status"]
        }
        Returns: {
          amount: number
          created_at: string
          id: string
          initiated_by: string | null
          order_id: string
          payment_id: string
          provider_refund_id: string | null
          raw_response: Json | null
          reason: string | null
          status: Database["public"]["Enums"]["refund_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payment_refunds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_search_event: {
        Args: { p_filters?: Json; p_query: string; p_results_count?: number }
        Returns: undefined
      }
      register_payment_attempt: {
        Args: {
          p_amount: number
          p_currency?: string
          p_order_id: string
          p_payer_id: string
          p_provider_order_id: string
          p_raw?: Json
        }
        Returns: {
          amount: number
          captured_at: string | null
          created_at: string
          currency: string
          error_code: string | null
          error_description: string | null
          id: string
          method: string | null
          order_id: string
          payer_id: string | null
          provider: string
          provider_order_id: string | null
          provider_payment_id: string | null
          raw_response: Json | null
          refunded_amount: number
          signature: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_matured_earnings: {
        Args: { p_creator_id?: string }
        Returns: number
      }
      request_creator_verification: {
        Args: {
          p_address_line?: string
          p_city?: string
          p_date_of_birth?: string
          p_document_number_last4?: string
          p_document_path?: string
          p_document_type?: string
          p_legal_name: string
          p_note?: string
          p_postal_code?: string
          p_state?: string
        }
        Returns: {
          address_line: string | null
          city: string | null
          created_at: string
          creator_id: string
          date_of_birth: string | null
          document_number_last4: string | null
          document_path: string | null
          document_type: string | null
          id: string
          legal_name: string
          note: string | null
          postal_code: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string | null
          status: string
          submitted_at: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "creator_verifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_revision: {
        Args: {
          p_attachments?: Json
          p_instructions?: string
          p_order_id: string
          p_reason: string
        }
        Returns: {
          attachments: Json
          created_at: string
          id: string
          instructions: string | null
          order_id: string
          reason: string
          requested_by: string | null
          resolved_at: string | null
          revision_number: number
          status: Database["public"]["Enums"]["revision_status"]
          submitted_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "order_revisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_to_brief: {
        Args: { p_accept: boolean; p_brief_id: string; p_note?: string }
        Returns: {
          brand_id: string
          budget: number | null
          campaign_objective: string | null
          category_id: string | null
          content_type: string | null
          created_at: string
          creator_id: string | null
          deadline: string | null
          deliverables: string | null
          do_not_say: string[]
          id: string
          platform: string | null
          product_description: string | null
          product_name: string | null
          product_url: string | null
          reference_links: string[]
          responded_at: string | null
          response_note: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["brief_status"]
          talking_points: string[]
          target_audience: string | null
          title: string
          tone: string | null
          updated_at: string
          usage_rights: string | null
        }
        SetofOptions: {
          from: "*"
          to: "briefs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_to_review: {
        Args: { p_response: string; p_review_id: string }
        Returns: {
          brand_id: string
          comment: string | null
          created_at: string
          creator_id: string
          id: string
          order_id: string
          rating: number
          responded_at: string | null
          response: string | null
          reviewer_id: string
          reviewer_role: Database["public"]["Enums"]["actor_role"]
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_payout_method: {
        Args: {
          p_account_holder_name: string
          p_bank_account_number?: string
          p_bank_name?: string
          p_ifsc_code?: string
          p_method_type: Database["public"]["Enums"]["payout_method_type"]
          p_upi_id?: string
        }
        Returns: Json
      }
      search_creators: {
        Args: {
          p_available_only?: boolean
          p_barter?: boolean
          p_category?: string
          p_city?: string
          p_content_type?: string
          p_creator_type?: string
          p_gender?: string
          p_languages?: string[]
          p_limit?: number
          p_max_age?: number
          p_max_delivery_days?: number
          p_max_followers?: number
          p_max_price?: number
          p_min_age?: number
          p_min_followers?: number
          p_min_price?: number
          p_min_rating?: number
          p_offset?: number
          p_platform?: string
          p_query?: string
          p_sort?: string
          p_state?: string
          p_verified_only?: boolean
        }
        Returns: {
          age: number
          available: boolean
          categories: Json
          city: string
          completed_orders: number
          content_types: string[]
          country: string
          cover_image_url: string
          creator_type: string
          display_name: string
          engagement_rate: number
          fastest_delivery_days: number
          featured: boolean
          followers_count: number
          gender: Database["public"]["Enums"]["gender_type"]
          headline: string
          id: string
          intro_video_url: string
          languages: string[]
          last_seen_at: string
          platforms: string[]
          portfolio_preview: Json
          profile_image_url: string
          published_at: string
          rating: number
          response_time: string
          review_count: number
          slug: string
          starting_price: number
          state: string
          total_count: number
          verified: boolean
        }[]
      }
      send_brief: {
        Args: { p_brief_id: string; p_creator_id: string }
        Returns: {
          brand_id: string
          budget: number | null
          campaign_objective: string | null
          category_id: string | null
          content_type: string | null
          created_at: string
          creator_id: string | null
          deadline: string | null
          deliverables: string | null
          do_not_say: string[]
          id: string
          platform: string | null
          product_description: string | null
          product_name: string | null
          product_url: string | null
          reference_links: string[]
          responded_at: string | null
          response_note: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["brief_status"]
          talking_points: string[]
          target_audience: string | null
          title: string
          tone: string | null
          updated_at: string
          usage_rights: string | null
        }
        SetofOptions: {
          from: "*"
          to: "briefs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_creator_categories: {
        Args: { p_category_ids: string[]; p_primary_id?: string }
        Returns: undefined
      }
      set_creator_languages: {
        Args: { p_languages: string[] }
        Returns: undefined
      }
      set_initial_role: {
        Args: { p_role: Database["public"]["Enums"]["user_role"] }
        Returns: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          email_account: boolean
          email_campaigns: boolean
          email_marketing: boolean
          email_notifications: boolean
          email_orders: boolean
          email_payments: boolean
          full_name: string | null
          id: string
          last_seen_at: string | null
          onboarding_completed: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_order_work: {
        Args: { p_order_id: string }
        Returns: {
          accepted_at: string | null
          addons_total: number
          approved_at: string | null
          brand_id: string
          brief_id: string | null
          brief_snapshot: Json | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          content_type: string | null
          created_at: string
          creator_earning_amount: number
          creator_id: string
          currency: string
          delivered_at: string | null
          delivery_days: number
          due_at: string | null
          id: string
          order_number: string
          paid_at: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          refund_required: boolean
          requirements: string | null
          requires_shipping: boolean
          revisions_allowed: number
          revisions_used: number
          service_description: string | null
          service_id: string | null
          service_title: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_deliverables: {
        Args: { p_items: Json; p_note?: string; p_order_id: string }
        Returns: {
          accepted_at: string | null
          addons_total: number
          approved_at: string | null
          brand_id: string
          brief_id: string | null
          brief_snapshot: Json | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          content_type: string | null
          created_at: string
          creator_earning_amount: number
          creator_id: string
          currency: string
          delivered_at: string | null
          delivery_days: number
          due_at: string | null
          id: string
          order_number: string
          paid_at: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          refund_required: boolean
          requirements: string | null
          requires_shipping: boolean
          revisions_allowed: number
          revisions_used: number
          service_description: string | null
          service_id: string | null
          service_title: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_review: {
        Args: { p_comment?: string; p_order_id: string; p_rating: number }
        Returns: {
          brand_id: string
          comment: string | null
          created_at: string
          creator_id: string
          id: string
          order_id: string
          rating: number
          responded_at: string | null
          response: string | null
          reviewer_id: string
          reviewer_role: Database["public"]["Enums"]["actor_role"]
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_shipping_address: {
        Args: { p_order_id: string; p_shipping: Json }
        Returns: {
          address: string | null
          address_submitted_at: string | null
          city: string | null
          country: string | null
          courier: string | null
          created_at: string
          id: string
          notes: string | null
          order_id: string
          phone: string | null
          postal_code: string | null
          received_at: string | null
          recipient_name: string | null
          shipped_at: string | null
          shipping_required: boolean
          state: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "shipping_details"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      touch_last_seen: { Args: never; Returns: undefined }
    }
    Enums: {
      account_status: "active" | "suspended" | "deleted"
      actor_role: "brand" | "creator" | "admin" | "system"
      addon_type:
        | "extra_revision"
        | "express_delivery"
        | "raw_footage"
        | "extra_content"
        | "usage_rights"
        | "custom"
      brief_status: "draft" | "sent" | "accepted" | "rejected" | "completed"
      conversation_type: "direct" | "order"
      creator_status:
        | "draft"
        | "pending_review"
        | "published"
        | "rejected"
        | "suspended"
      earning_status: "pending" | "available" | "paid" | "held" | "refunded"
      gender_type: "female" | "male" | "non_binary" | "prefer_not_to_say"
      message_type: "text" | "image" | "file" | "system"
      order_status:
        | "draft"
        | "payment_pending"
        | "order_placed"
        | "creator_pending"
        | "accepted"
        | "awaiting_shipment"
        | "shipped"
        | "received"
        | "in_progress"
        | "delivered"
        | "revision_requested"
        | "revision_submitted"
        | "approved"
        | "completed"
        | "cancelled"
        | "disputed"
        | "refunded"
      payment_status:
        | "created"
        | "authorized"
        | "captured"
        | "failed"
        | "refunded"
        | "partially_refunded"
      payout_method_type: "upi" | "bank_transfer"
      payout_status: "pending" | "processing" | "paid" | "failed" | "rejected"
      payout_txn_status:
        | "initiated"
        | "processing"
        | "success"
        | "failed"
        | "reversed"
      portfolio_item_type: "image" | "video" | "link"
      refund_status: "pending" | "processed" | "failed"
      report_status: "open" | "under_review" | "resolved" | "dismissed"
      report_target:
        | "creator"
        | "brand"
        | "message"
        | "portfolio"
        | "review"
        | "order"
      revision_status: "requested" | "submitted" | "resolved" | "cancelled"
      social_platform:
        | "instagram"
        | "youtube"
        | "x"
        | "threads"
        | "facebook"
        | "other"
      user_role: "brand" | "creator" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
    Enums: {
      account_status: ["active", "suspended", "deleted"],
      actor_role: ["brand", "creator", "admin", "system"],
      addon_type: [
        "extra_revision",
        "express_delivery",
        "raw_footage",
        "extra_content",
        "usage_rights",
        "custom",
      ],
      brief_status: ["draft", "sent", "accepted", "rejected", "completed"],
      conversation_type: ["direct", "order"],
      creator_status: [
        "draft",
        "pending_review",
        "published",
        "rejected",
        "suspended",
      ],
      earning_status: ["pending", "available", "paid", "held", "refunded"],
      gender_type: ["female", "male", "non_binary", "prefer_not_to_say"],
      message_type: ["text", "image", "file", "system"],
      order_status: [
        "draft",
        "payment_pending",
        "order_placed",
        "creator_pending",
        "accepted",
        "awaiting_shipment",
        "shipped",
        "received",
        "in_progress",
        "delivered",
        "revision_requested",
        "revision_submitted",
        "approved",
        "completed",
        "cancelled",
        "disputed",
        "refunded",
      ],
      payment_status: [
        "created",
        "authorized",
        "captured",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      payout_method_type: ["upi", "bank_transfer"],
      payout_status: ["pending", "processing", "paid", "failed", "rejected"],
      payout_txn_status: [
        "initiated",
        "processing",
        "success",
        "failed",
        "reversed",
      ],
      portfolio_item_type: ["image", "video", "link"],
      refund_status: ["pending", "processed", "failed"],
      report_status: ["open", "under_review", "resolved", "dismissed"],
      report_target: [
        "creator",
        "brand",
        "message",
        "portfolio",
        "review",
        "order",
      ],
      revision_status: ["requested", "submitted", "resolved", "cancelled"],
      social_platform: [
        "instagram",
        "youtube",
        "x",
        "threads",
        "facebook",
        "other",
      ],
      user_role: ["brand", "creator", "admin"],
    },
  },
} as const
