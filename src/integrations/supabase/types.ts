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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ad_controls: {
        Row: {
          ad_zone_id: string | null
          allowed_formats: Json
          blocked_advertisers: Json
          blocked_categories: Json
          created_at: string
          id: string
          lazy_loading_enabled: boolean
          max_frequency: number | null
          organization_id: string
          refresh_interval_seconds: number | null
          refresh_mode: Database["public"]["Enums"]["ad_refresh_mode"]
          responsive_enabled: boolean
          updated_at: string
          website_id: string
        }
        Insert: {
          ad_zone_id?: string | null
          allowed_formats?: Json
          blocked_advertisers?: Json
          blocked_categories?: Json
          created_at?: string
          id?: string
          lazy_loading_enabled?: boolean
          max_frequency?: number | null
          organization_id: string
          refresh_interval_seconds?: number | null
          refresh_mode?: Database["public"]["Enums"]["ad_refresh_mode"]
          responsive_enabled?: boolean
          updated_at?: string
          website_id: string
        }
        Update: {
          ad_zone_id?: string | null
          allowed_formats?: Json
          blocked_advertisers?: Json
          blocked_categories?: Json
          created_at?: string
          id?: string
          lazy_loading_enabled?: boolean
          max_frequency?: number | null
          organization_id?: string
          refresh_interval_seconds?: number | null
          refresh_mode?: Database["public"]["Enums"]["ad_refresh_mode"]
          responsive_enabled?: boolean
          updated_at?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_controls_ad_zone_id_fkey"
            columns: ["ad_zone_id"]
            isOneToOne: false
            referencedRelation: "ad_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_controls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_controls_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_groups: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          name: string
          organization_id: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_groups_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_reports: {
        Row: {
          ad_id: string
          ad_zone_id: string
          admin_notes: string | null
          campaign_id: string
          created_at: string
          description: string | null
          id: string
          organization_id: string
          reason: Database["public"]["Enums"]["ad_report_reason"]
          reporter_ip: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["ad_report_status"]
          user_agent: string | null
          website_id: string
        }
        Insert: {
          ad_id: string
          ad_zone_id: string
          admin_notes?: string | null
          campaign_id: string
          created_at?: string
          description?: string | null
          id?: string
          organization_id: string
          reason: Database["public"]["Enums"]["ad_report_reason"]
          reporter_ip?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["ad_report_status"]
          user_agent?: string | null
          website_id: string
        }
        Update: {
          ad_id?: string
          ad_zone_id?: string
          admin_notes?: string | null
          campaign_id?: string
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string
          reason?: Database["public"]["Enums"]["ad_report_reason"]
          reporter_ip?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["ad_report_status"]
          user_agent?: string | null
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_reports_ad_zone_id_fkey"
            columns: ["ad_zone_id"]
            isOneToOne: false
            referencedRelation: "ad_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_reports_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_zones: {
        Row: {
          created_at: string
          format: Database["public"]["Enums"]["ad_format"]
          height: number | null
          id: string
          name: string
          organization_id: string
          publisher_id: string
          responsive: boolean
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          website_id: string
          width: number | null
          zone_key: string
        }
        Insert: {
          created_at?: string
          format: Database["public"]["Enums"]["ad_format"]
          height?: number | null
          id?: string
          name: string
          organization_id: string
          publisher_id: string
          responsive?: boolean
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          website_id: string
          width?: number | null
          zone_key: string
        }
        Update: {
          created_at?: string
          format?: Database["public"]["Enums"]["ad_format"]
          height?: number | null
          id?: string
          name?: string
          organization_id?: string
          publisher_id?: string
          responsive?: boolean
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          website_id?: string
          width?: number | null
          zone_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_zones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_zones_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_zones_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      ads: {
        Row: {
          ad_group_id: string
          ad_type: Database["public"]["Enums"]["ad_type"]
          approval_status: Database["public"]["Enums"]["approval_status"]
          brand_name: string | null
          campaign_id: string
          created_at: string
          cta: string | null
          descriptions: Json
          destination_url: string
          format: Database["public"]["Enums"]["ad_format"]
          headlines: Json
          id: string
          logo_media_asset_id: string | null
          long_headline: string | null
          media_asset_id: string | null
          name: string
          optimization: string
          organization_id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["entity_status"]
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          ad_group_id: string
          ad_type?: Database["public"]["Enums"]["ad_type"]
          approval_status?: Database["public"]["Enums"]["approval_status"]
          brand_name?: string | null
          campaign_id: string
          created_at?: string
          cta?: string | null
          descriptions?: Json
          destination_url: string
          format?: Database["public"]["Enums"]["ad_format"]
          headlines?: Json
          id?: string
          logo_media_asset_id?: string | null
          long_headline?: string | null
          media_asset_id?: string | null
          name: string
          optimization?: string
          organization_id: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          ad_group_id?: string
          ad_type?: Database["public"]["Enums"]["ad_type"]
          approval_status?: Database["public"]["Enums"]["approval_status"]
          brand_name?: string | null
          campaign_id?: string
          created_at?: string
          cta?: string | null
          descriptions?: Json
          destination_url?: string
          format?: Database["public"]["Enums"]["ad_format"]
          headlines?: Json
          id?: string
          logo_media_asset_id?: string | null
          long_headline?: string | null
          media_asset_id?: string | null
          name?: string
          optimization?: string
          organization_id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_ad_group_id_fkey"
            columns: ["ad_group_id"]
            isOneToOne: false
            referencedRelation: "ad_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_logo_media_asset_id_fkey"
            columns: ["logo_media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_txt_records: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_verified: boolean
          last_verified_at: string | null
          organization_id: string
          seller_record: string
          updated_at: string
          verification_error: string | null
          website_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_verified?: boolean
          last_verified_at?: string | null
          organization_id: string
          seller_record: string
          updated_at?: string
          verification_error?: string | null
          website_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_verified?: boolean
          last_verified_at?: string | null
          organization_id?: string
          seller_record?: string
          updated_at?: string
          verification_error?: string | null
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_txt_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_txt_records_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      advertisers: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          business_name: string
          contact_email: string
          contact_phone: string | null
          created_at: string
          id: string
          industry: string | null
          organization_id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          business_name: string
          contact_email: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          organization_id: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          business_name?: string
          contact_email?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          organization_id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advertisers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          key_id: string
          last_used_at: string | null
          organization_id: string
          permissions: Json
          secret_hash: string
          secret_last4: string
          status: Database["public"]["Enums"]["api_key_status"]
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_id: string
          last_used_at?: string | null
          organization_id: string
          permissions?: Json
          secret_hash: string
          secret_last4: string
          status?: Database["public"]["Enums"]["api_key_status"]
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_id?: string
          last_used_at?: string | null
          organization_id?: string
          permissions?: Json
          secret_hash?: string
          secret_last4?: string
          status?: Database["public"]["Enums"]["api_key_status"]
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          ip_address: string | null
          method: string
          organization_id: string
          request_body: Json | null
          response_body: Json | null
          response_time_ms: number | null
          status: Database["public"]["Enums"]["api_request_status"]
          status_code: number
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method: string
          organization_id: string
          request_body?: Json | null
          response_body?: Json | null
          response_time_ms?: number | null
          status?: Database["public"]["Enums"]["api_request_status"]
          status_code?: number
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method?: string
          organization_id?: string
          request_body?: Json | null
          response_body?: Json | null
          response_time_ms?: number | null
          status?: Database["public"]["Enums"]["api_request_status"]
          status_code?: number
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_request_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string
          actor_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json
          target_id: string
          target_label: string | null
          target_type: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          target_id: string
          target_label?: string | null
          target_type: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          target_id?: string
          target_label?: string | null
          target_type?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      auto_ads_config: {
        Row: {
          ad_load: Database["public"]["Enums"]["ad_load_level"]
          anchor_ads_enabled: boolean
          banner_ads_enabled: boolean
          created_at: string
          enabled_formats: Json
          excluded_pages: Json
          excluded_selectors: Json
          id: string
          min_spacing: number
          mobile_ads_enabled: boolean
          organization_id: string
          overlay_ads_enabled: boolean
          responsive_ads_enabled: boolean
          status: Database["public"]["Enums"]["auto_ads_status"]
          updated_at: string
          website_id: string
        }
        Insert: {
          ad_load?: Database["public"]["Enums"]["ad_load_level"]
          anchor_ads_enabled?: boolean
          banner_ads_enabled?: boolean
          created_at?: string
          enabled_formats?: Json
          excluded_pages?: Json
          excluded_selectors?: Json
          id?: string
          min_spacing?: number
          mobile_ads_enabled?: boolean
          organization_id: string
          overlay_ads_enabled?: boolean
          responsive_ads_enabled?: boolean
          status?: Database["public"]["Enums"]["auto_ads_status"]
          updated_at?: string
          website_id: string
        }
        Update: {
          ad_load?: Database["public"]["Enums"]["ad_load_level"]
          anchor_ads_enabled?: boolean
          banner_ads_enabled?: boolean
          created_at?: string
          enabled_formats?: Json
          excluded_pages?: Json
          excluded_selectors?: Json
          id?: string
          min_spacing?: number
          mobile_ads_enabled?: boolean
          organization_id?: string
          overlay_ads_enabled?: boolean
          responsive_ads_enabled?: boolean
          status?: Database["public"]["Enums"]["auto_ads_status"]
          updated_at?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_ads_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_ads_config_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_ips: {
        Row: {
          blocked_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          ip_address: string
          reason: string
          updated_at: string
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_address: string
          reason: string
          updated_at?: string
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_address?: string
          reason?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaign_daily_stats: {
        Row: {
          campaign_id: string
          clicks: number
          conversions: number
          cpc: number
          cpm: number
          created_at: string
          ctr: number
          date: string
          id: string
          impressions: number
          organization_id: string
          spend: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          clicks?: number
          conversions?: number
          cpc?: number
          cpm?: number
          created_at?: string
          ctr?: number
          date: string
          id?: string
          impressions?: number
          organization_id: string
          spend?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          clicks?: number
          conversions?: number
          cpc?: number
          cpm?: number
          created_at?: string
          ctr?: number
          date?: string
          id?: string
          impressions?: number
          organization_id?: string
          spend?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_daily_stats_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_daily_stats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_spend: {
        Row: {
          ad_id: string | null
          ad_zone_id: string | null
          amount: number
          campaign_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["billing_event_type"]
          id: string
          organization_id: string
          platform_amount: number
          publisher_amount: number
          publisher_id: string | null
          request_id: string
          revenue_share: number
          updated_at: string
          website_id: string | null
        }
        Insert: {
          ad_id?: string | null
          ad_zone_id?: string | null
          amount: number
          campaign_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["billing_event_type"]
          id?: string
          organization_id: string
          platform_amount: number
          publisher_amount: number
          publisher_id?: string | null
          request_id: string
          revenue_share: number
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          ad_id?: string | null
          ad_zone_id?: string | null
          amount?: number
          campaign_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["billing_event_type"]
          id?: string
          organization_id?: string
          platform_amount?: number
          publisher_amount?: number
          publisher_id?: string | null
          request_id?: string
          revenue_share?: number
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_spend_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_spend_ad_zone_id_fkey"
            columns: ["ad_zone_id"]
            isOneToOne: false
            referencedRelation: "ad_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_spend_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_spend_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_spend_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_spend_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_targeting: {
        Row: {
          browsers: Database["public"]["Enums"]["browser_type"][]
          campaign_id: string
          cities: string[]
          counties: string[]
          countries: string[]
          created_at: string
          devices: Database["public"]["Enums"]["device_type"][]
          id: string
          operating_systems: Database["public"]["Enums"]["os_type"][]
          organization_id: string
          schedule: Json
          updated_at: string
          website_categories: Database["public"]["Enums"]["website_category"][]
        }
        Insert: {
          browsers?: Database["public"]["Enums"]["browser_type"][]
          campaign_id: string
          cities?: string[]
          counties?: string[]
          countries?: string[]
          created_at?: string
          devices?: Database["public"]["Enums"]["device_type"][]
          id?: string
          operating_systems?: Database["public"]["Enums"]["os_type"][]
          organization_id: string
          schedule?: Json
          updated_at?: string
          website_categories?: Database["public"]["Enums"]["website_category"][]
        }
        Update: {
          browsers?: Database["public"]["Enums"]["browser_type"][]
          campaign_id?: string
          cities?: string[]
          counties?: string[]
          countries?: string[]
          created_at?: string
          devices?: Database["public"]["Enums"]["device_type"][]
          id?: string
          operating_systems?: Database["public"]["Enums"]["os_type"][]
          organization_id?: string
          schedule?: Json
          updated_at?: string
          website_categories?: Database["public"]["Enums"]["website_category"][]
        }
        Relationships: [
          {
            foreignKeyName: "campaign_targeting_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_targeting_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          advertiser_id: string
          approval_status: Database["public"]["Enums"]["approval_status"]
          bid_amount: number
          bid_type: Database["public"]["Enums"]["bid_type"]
          clicks_count: number
          created_at: string
          daily_budget: number | null
          end_date: string | null
          id: string
          impressions_count: number
          landing_page_url: string | null
          name: string
          objective: Database["public"]["Enums"]["campaign_objective"]
          organization_id: string
          priority: number
          rejection_reason: string | null
          reviewed_at: string | null
          spent_amount: number
          start_date: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          submitted_at: string | null
          total_budget: number
          updated_at: string
        }
        Insert: {
          advertiser_id: string
          approval_status?: Database["public"]["Enums"]["approval_status"]
          bid_amount?: number
          bid_type?: Database["public"]["Enums"]["bid_type"]
          clicks_count?: number
          created_at?: string
          daily_budget?: number | null
          end_date?: string | null
          id?: string
          impressions_count?: number
          landing_page_url?: string | null
          name: string
          objective?: Database["public"]["Enums"]["campaign_objective"]
          organization_id: string
          priority?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          spent_amount?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          submitted_at?: string | null
          total_budget?: number
          updated_at?: string
        }
        Update: {
          advertiser_id?: string
          approval_status?: Database["public"]["Enums"]["approval_status"]
          bid_amount?: number
          bid_type?: Database["public"]["Enums"]["bid_type"]
          clicks_count?: number
          created_at?: string
          daily_budget?: number | null
          end_date?: string | null
          id?: string
          impressions_count?: number
          landing_page_url?: string | null
          name?: string
          objective?: Database["public"]["Enums"]["campaign_objective"]
          organization_id?: string
          priority?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          spent_amount?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          submitted_at?: string | null
          total_budget?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clicks: {
        Row: {
          ad_id: string
          ad_zone_id: string
          campaign_id: string
          created_at: string
          id: string
          impression_id: string
          publisher_id: string
          request_id: string
          website_id: string
        }
        Insert: {
          ad_id: string
          ad_zone_id: string
          campaign_id: string
          created_at?: string
          id?: string
          impression_id: string
          publisher_id: string
          request_id: string
          website_id: string
        }
        Update: {
          ad_id?: string
          ad_zone_id?: string
          campaign_id?: string
          created_at?: string
          id?: string
          impression_id?: string
          publisher_id?: string
          request_id?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clicks_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clicks_ad_zone_id_fkey"
            columns: ["ad_zone_id"]
            isOneToOne: false
            referencedRelation: "ad_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clicks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clicks_impression_id_fkey"
            columns: ["impression_id"]
            isOneToOne: false
            referencedRelation: "impressions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clicks_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clicks_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
      Row: {
        created_at: string
        email: string
        id: string
        message: string
        name: string
        status: string
        subject: string
        updated_at: string
      }
      Insert: {
        created_at?: string
        email: string
        id?: string
        message: string
        name: string
        status?: string
        subject: string
        updated_at?: string
      }
      Update: {
        created_at?: string
        email?: string
        message?: string
        name?: string
        status?: string
        subject?: string
        updated_at?: string
      }
      Relationships: []
    }
    domain_verifications: {
        Row: {
          attempts: number
          created_at: string
          expires_at: string
          id: string
          last_error: string | null
          method: Database["public"]["Enums"]["verification_method"]
          organization_id: string
          status: Database["public"]["Enums"]["verification_status"]
          verification_token: string
          verified_at: string | null
          website_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: string
          last_error?: string | null
          method: Database["public"]["Enums"]["verification_method"]
          organization_id: string
          status?: Database["public"]["Enums"]["verification_status"]
          verification_token: string
          verified_at?: string | null
          website_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: string
          last_error?: string | null
          method?: Database["public"]["Enums"]["verification_method"]
          organization_id?: string
          status?: Database["public"]["Enums"]["verification_status"]
          verification_token?: string
          verified_at?: string | null
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_verifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_verifications_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_events: {
        Row: {
          actor_id: string | null
          actor_type: string | null
          country: string | null
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          score: number
          severity: string
          signals: Json
          status: string
          target_id: string | null
          target_type: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string | null
          country?: string | null
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          severity?: string
          signals?: Json
          status?: string
          target_id?: string | null
          target_type?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string | null
          country?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          severity?: string
          signals?: Json
          status?: string
          target_id?: string | null
          target_type?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      impressions: {
        Row: {
          ad_id: string
          ad_zone_id: string
          browser: Database["public"]["Enums"]["browser_type"] | null
          campaign_id: string
          country: string | null
          created_at: string
          device_type: Database["public"]["Enums"]["device_type"] | null
          id: string
          operating_system: Database["public"]["Enums"]["os_type"] | null
          publisher_id: string
          request_id: string
          website_id: string
        }
        Insert: {
          ad_id: string
          ad_zone_id: string
          browser?: Database["public"]["Enums"]["browser_type"] | null
          campaign_id: string
          country?: string | null
          created_at?: string
          device_type?: Database["public"]["Enums"]["device_type"] | null
          id?: string
          operating_system?: Database["public"]["Enums"]["os_type"] | null
          publisher_id: string
          request_id: string
          website_id: string
        }
        Update: {
          ad_id?: string
          ad_zone_id?: string
          browser?: Database["public"]["Enums"]["browser_type"] | null
          campaign_id?: string
          country?: string | null
          created_at?: string
          device_type?: Database["public"]["Enums"]["device_type"] | null
          id?: string
          operating_system?: Database["public"]["Enums"]["os_type"] | null
          publisher_id?: string
          request_id?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impressions_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impressions_ad_zone_id_fkey"
            columns: ["ad_zone_id"]
            isOneToOne: false
            referencedRelation: "ad_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impressions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impressions_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impressions_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          ad_id: string | null
          advertiser_id: string | null
          bucket: string
          campaign_id: string | null
          checksum: string | null
          created_at: string
          file_name: string
          file_size: number
          height: number | null
          id: string
          mime_type: string
          organization_id: string
          status: Database["public"]["Enums"]["media_status"]
          storage_path: string
          storage_provider: Database["public"]["Enums"]["storage_provider"]
          updated_at: string
          width: number | null
        }
        Insert: {
          ad_id?: string | null
          advertiser_id?: string | null
          bucket?: string
          campaign_id?: string | null
          checksum?: string | null
          created_at?: string
          file_name: string
          file_size: number
          height?: number | null
          id?: string
          mime_type: string
          organization_id: string
          status?: Database["public"]["Enums"]["media_status"]
          storage_path: string
          storage_provider?: Database["public"]["Enums"]["storage_provider"]
          updated_at?: string
          width?: number | null
        }
        Update: {
          ad_id?: string | null
          advertiser_id?: string | null
          bucket?: string
          campaign_id?: string | null
          checksum?: string | null
          created_at?: string
          file_name?: string
          file_size?: number
          height?: number | null
          id?: string
          mime_type?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["media_status"]
          storage_path?: string
          storage_provider?: Database["public"]["Enums"]["storage_provider"]
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["organization_role"]
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          type: Database["public"]["Enums"]["organization_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          type: Database["public"]["Enums"]["organization_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          type?: Database["public"]["Enums"]["organization_type"]
          updated_at?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          active: boolean
          country_code: string
          created_at: string
          currency_code: string
          description: string | null
          display_name: string
          icon_url: string | null
          id: string
          maximum_amount: number | null
          minimum_amount: number
          name: string
          provider_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          country_code: string
          created_at?: string
          currency_code: string
          description?: string | null
          display_name: string
          icon_url?: string | null
          id?: string
          maximum_amount?: number | null
          minimum_amount?: number
          name: string
          provider_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          country_code?: string
          created_at?: string
          currency_code?: string
          description?: string | null
          display_name?: string
          icon_url?: string | null
          id?: string
          maximum_amount?: number | null
          minimum_amount?: number
          name?: string
          provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "payment_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_providers: {
        Row: {
          active: boolean
          api_base_url: string
          config: Json | null
          created_at: string
          display_name: string
          id: string
          name: string
          supported_countries: Json
          supported_currencies: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          api_base_url: string
          config?: Json | null
          created_at?: string
          display_name: string
          id?: string
          name: string
          supported_countries?: Json
          supported_currencies?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          api_base_url?: string
          config?: Json | null
          created_at?: string
          display_name?: string
          id?: string
          name?: string
          supported_countries?: Json
          supported_currencies?: Json
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          callback_received_at: string | null
          completed_at: string | null
          created_at: string
          currency: string
          failed_at: string | null
          failure_reason: string | null
          id: string
          organization_id: string
          payment_url: string | null
          phone_number: string | null
          provider: string
          provider_receipt: string | null
          provider_reference: string | null
          provider_transaction_id: string | null
          reference: string
          status: string
          updated_at: string
          user_id: string | null
          verified_at: string | null
          wallet_id: string
        }
        Insert: {
          amount: number
          callback_received_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          organization_id: string
          payment_url?: string | null
          phone_number?: string | null
          provider?: string
          provider_receipt?: string | null
          provider_reference?: string | null
          provider_transaction_id?: string | null
          reference: string
          status?: string
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
          wallet_id: string
        }
        Update: {
          amount?: number
          callback_received_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          organization_id?: string
          payment_url?: string | null
          phone_number?: string | null
          provider?: string
          provider_receipt?: string | null
          provider_reference?: string | null
          provider_transaction_id?: string | null
          reference?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          created_at: string
          destination: string
          id: string
          method: string
          organization_id: string
          paid_at: string | null
          payment_reference: string | null
          publisher_id: string
          rejection_reason: string | null
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          destination: string
          id?: string
          method: string
          organization_id: string
          paid_at?: string | null
          payment_reference?: string | null
          publisher_id: string
          rejection_reason?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          destination?: string
          id?: string
          method?: string
          organization_id?: string
          paid_at?: string | null
          payment_reference?: string | null
          publisher_id?: string
          rejection_reason?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["platform_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["platform_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          assumed_ctr: number
          campaign_minimum_budget: number
          created_at: string
          currency: string
          default_bid_amount: number
          default_total_budget: number
          earnings_hold_days: number
          id: boolean
          maximum_bid_amount: number
          maximum_campaign_budget: number
          maximum_creative_size_bytes: number
          maximum_daily_budget: number
          minimum_daily_budget: number
          minimum_payout_amount: number
          platform_status: string
          publisher_revenue_share: number
          starting_cpc: number
          supported_countries: string[]
          supported_currencies: string[]
          updated_at: string
        }
        Insert: {
          assumed_ctr?: number
          campaign_minimum_budget?: number
          created_at?: string
          currency?: string
          default_bid_amount?: number
          default_total_budget?: number
          earnings_hold_days?: number
          id?: boolean
          maximum_bid_amount?: number
          maximum_campaign_budget?: number
          maximum_creative_size_bytes?: number
          maximum_daily_budget?: number
          minimum_daily_budget?: number
          minimum_payout_amount?: number
          platform_status?: string
          publisher_revenue_share?: number
          starting_cpc?: number
          supported_countries?: string[]
          supported_currencies?: string[]
          updated_at?: string
        }
        Update: {
          assumed_ctr?: number
          campaign_minimum_budget?: number
          created_at?: string
          currency?: string
          default_bid_amount?: number
          default_total_budget?: number
          earnings_hold_days?: number
          id?: boolean
          maximum_bid_amount?: number
          maximum_campaign_budget?: number
          maximum_creative_size_bytes?: number
          maximum_daily_budget?: number
          minimum_daily_budget?: number
          minimum_payout_amount?: number
          platform_status?: string
          publisher_revenue_share?: number
          starting_cpc?: number
          supported_countries?: string[]
          supported_currencies?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      policies: {
        Row: {
          category: Database["public"]["Enums"]["policy_category"]
          created_at: string
          description: string
          id: string
          is_published: boolean
          last_updated: string
          related_policies: Json
          sections: Json
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["policy_category"]
          created_at?: string
          description: string
          id?: string
          is_published?: boolean
          last_updated?: string
          related_policies?: Json
          sections?: Json
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["policy_category"]
          created_at?: string
          description?: string
          id?: string
          is_published?: boolean
          last_updated?: string
          related_policies?: Json
          sections?: Json
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      policy_violations: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string
          evidence: Json | null
          id: string
          organization_id: string
          policy_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["violation_severity"]
          status: Database["public"]["Enums"]["violation_status"]
          violation_type: string
          website_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description: string
          evidence?: Json | null
          id?: string
          organization_id: string
          policy_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["violation_severity"]
          status?: Database["public"]["Enums"]["violation_status"]
          violation_type: string
          website_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string
          evidence?: Json | null
          id?: string
          organization_id?: string
          policy_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["violation_severity"]
          status?: Database["public"]["Enums"]["violation_status"]
          violation_type?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_violations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_violations_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "publisher_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_violations_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_violations_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      publisher_daily_stats: {
        Row: {
          clicks: number
          created_at: string
          ctr: number
          date: string
          earnings: number
          id: string
          impressions: number
          organization_id: string
          publisher_id: string
          rpm: number
          updated_at: string
        }
        Insert: {
          clicks?: number
          created_at?: string
          ctr?: number
          date: string
          earnings?: number
          id?: string
          impressions?: number
          organization_id: string
          publisher_id: string
          rpm?: number
          updated_at?: string
        }
        Update: {
          clicks?: number
          created_at?: string
          ctr?: number
          date?: string
          earnings?: number
          id?: string
          impressions?: number
          organization_id?: string
          publisher_id?: string
          rpm?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publisher_daily_stats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publisher_daily_stats_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      publisher_earnings: {
        Row: {
          ad_zone_id: string | null
          available_at: string
          campaign_id: string
          campaign_spend_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["billing_event_type"]
          gross_amount: number
          id: string
          organization_id: string
          paid_at: string | null
          payout_id: string | null
          platform_amount: number
          publisher_amount: number
          publisher_id: string
          revenue_share: number
          status: Database["public"]["Enums"]["earning_status"]
          updated_at: string
          website_id: string | null
        }
        Insert: {
          ad_zone_id?: string | null
          available_at?: string
          campaign_id: string
          campaign_spend_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["billing_event_type"]
          gross_amount: number
          id?: string
          organization_id: string
          paid_at?: string | null
          payout_id?: string | null
          platform_amount: number
          publisher_amount: number
          publisher_id: string
          revenue_share: number
          status?: Database["public"]["Enums"]["earning_status"]
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          ad_zone_id?: string | null
          available_at?: string
          campaign_id?: string
          campaign_spend_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["billing_event_type"]
          gross_amount?: number
          id?: string
          organization_id?: string
          paid_at?: string | null
          payout_id?: string | null
          platform_amount?: number
          publisher_amount?: number
          publisher_id?: string
          revenue_share?: number
          status?: Database["public"]["Enums"]["earning_status"]
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publisher_earnings_ad_zone_id_fkey"
            columns: ["ad_zone_id"]
            isOneToOne: false
            referencedRelation: "ad_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publisher_earnings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publisher_earnings_campaign_spend_id_fkey"
            columns: ["campaign_spend_id"]
            isOneToOne: false
            referencedRelation: "campaign_spend"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publisher_earnings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publisher_earnings_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publisher_earnings_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publisher_earnings_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      publisher_policies: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          organization_id: string
          severity: Database["public"]["Enums"]["violation_severity"]
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          organization_id: string
          severity?: Database["public"]["Enums"]["violation_severity"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          severity?: Database["public"]["Enums"]["violation_severity"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publisher_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      publishers: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          business_name: string
          contact_email: string
          contact_phone: string | null
          created_at: string
          id: string
          organization_id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          website_url: string | null
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          business_name: string
          contact_email: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          organization_id: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          business_name?: string
          contact_email?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publishers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action: string
          bucket_key: string
          created_at: string
          id: string
          request_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          action: string
          bucket_key: string
          created_at?: string
          id?: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          action?: string
          bucket_key?: string
          created_at?: string
          id?: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      supported_currencies: {
        Row: {
          active: boolean
          country_code: string
          country_name: string
          created_at: string
          currency_code: string
          currency_name: string
          decimal_places: number
          id: string
          minimum_deposit: number
          symbol: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          country_code: string
          country_name: string
          created_at?: string
          currency_code: string
          currency_name: string
          decimal_places?: number
          id?: string
          minimum_deposit?: number
          symbol: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          country_code?: string
          country_name?: string
          created_at?: string
          currency_code?: string
          currency_name?: string
          decimal_places?: number
          id?: string
          minimum_deposit?: number
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          idempotency_key: string
          organization_id: string
          reference_id: string | null
          reference_type: string | null
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          idempotency_key: string
          organization_id: string
          reference_id?: string | null
          reference_type?: string | null
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          idempotency_key?: string
          organization_id?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance_amount: number
          country_code: string
          created_at: string
          currency: string
          id: string
          lifetime_deposited: number
          lifetime_spent: number
          low_balance_threshold: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          balance_amount?: number
          country_code?: string
          created_at?: string
          currency?: string
          id?: string
          lifetime_deposited?: number
          lifetime_spent?: number
          low_balance_threshold?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          balance_amount?: number
          country_code?: string
          created_at?: string
          currency?: string
          id?: string
          lifetime_deposited?: number
          lifetime_spent?: number
          low_balance_threshold?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      website_daily_stats: {
        Row: {
          ad_zone_id: string | null
          clicks: number
          created_at: string
          ctr: number
          date: string
          earnings: number
          id: string
          impressions: number
          organization_id: string
          publisher_id: string
          rpm: number
          updated_at: string
          website_id: string
        }
        Insert: {
          ad_zone_id?: string | null
          clicks?: number
          created_at?: string
          ctr?: number
          date: string
          earnings?: number
          id?: string
          impressions?: number
          organization_id: string
          publisher_id: string
          rpm?: number
          updated_at?: string
          website_id: string
        }
        Update: {
          ad_zone_id?: string | null
          clicks?: number
          created_at?: string
          ctr?: number
          date?: string
          earnings?: number
          id?: string
          impressions?: number
          organization_id?: string
          publisher_id?: string
          rpm?: number
          updated_at?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_daily_stats_ad_zone_id_fkey"
            columns: ["ad_zone_id"]
            isOneToOne: false
            referencedRelation: "ad_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_daily_stats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_daily_stats_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_daily_stats_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      website_health_checks: {
        Row: {
          check_type: Database["public"]["Enums"]["health_check_type"]
          checked_at: string
          details: Json | null
          id: string
          organization_id: string
          passed: boolean
          score: number
          website_id: string
        }
        Insert: {
          check_type: Database["public"]["Enums"]["health_check_type"]
          checked_at?: string
          details?: Json | null
          id?: string
          organization_id: string
          passed: boolean
          score?: number
          website_id: string
        }
        Update: {
          check_type?: Database["public"]["Enums"]["health_check_type"]
          checked_at?: string
          details?: Json | null
          id?: string
          organization_id?: string
          passed?: boolean
          score?: number
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_health_checks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_health_checks_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      website_policy_status: {
        Row: {
          created_at: string
          id: string
          last_checked_at: string | null
          organization_id: string
          status: Database["public"]["Enums"]["policy_status"]
          updated_at: string
          website_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_checked_at?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["policy_status"]
          updated_at?: string
          website_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_checked_at?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["policy_status"]
          updated_at?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_policy_status_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_policy_status_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      websites: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          category: Database["public"]["Enums"]["website_category"]
          created_at: string
          description: string | null
          domain: string
          id: string
          monthly_pageviews: number
          name: string
          organization_id: string
          publisher_id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          category?: Database["public"]["Enums"]["website_category"]
          created_at?: string
          description?: string | null
          domain: string
          id?: string
          monthly_pageviews?: number
          name: string
          organization_id: string
          publisher_id: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          category?: Database["public"]["Enums"]["website_category"]
          created_at?: string
          description?: string | null
          domain?: string
          id?: string
          monthly_pageviews?: number
          name?: string
          organization_id?: string
          publisher_id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "websites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "websites_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_payment: {
        Args: { _payment_id: string; _provider?: string }
        Returns: {
          payment_id: string
          status: string
        }[]
      }
      charge_campaign_event: {
        Args: {
          _ad_id: string
          _ad_zone_id: string
          _campaign_id: string
          _event_type: Database["public"]["Enums"]["billing_event_type"]
          _publisher_id: string
          _request_id: string
          _website_id: string
        }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          _action: string
          _ip_address: string
          _key: string
          _limit: number
          _organization_id?: string
          _user_id?: string
          _window_seconds: number
        }
        Returns: boolean
      }
      complete_payment: {
        Args: {
          _payment_id: string
          _provider?: string
          _provider_receipt?: string
          _provider_reference?: string
          _provider_transaction_id?: string
        }
        Returns: {
          payment_id: string
          status: string
          wallet_balance: number
        }[]
      }
      create_organization: {
        Args: {
          _name: string
          _slug: string
          _type: Database["public"]["Enums"]["organization_type"]
        }
        Returns: {
          created_at: string
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          type: Database["public"]["Enums"]["organization_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_payment: {
        Args: {
          _amount?: number
          _currency?: string
          _id: string
          _organization_id: string
          _payment_url?: string
          _phone_number?: string
          _provider?: string
          _reference?: string
          _user_id: string
          _wallet_id: string
        }
        Returns: {
          id: string
          payment_url: string
          reference: string
        }[]
      }
      deposit_to_wallet: {
        Args: {
          _amount: number
          _description?: string
          _idempotency_key: string
          _organization_id: string
        }
        Returns: {
          balance_amount: number
          country_code: string
          created_at: string
          currency: string
          id: string
          lifetime_deposited: number
          lifetime_spent: number
          low_balance_threshold: number
          organization_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "wallets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      deposit_to_wallet_for_currency: {
        Args: {
          _amount: number
          _currency?: string
          _description?: string
          _idempotency_key?: string
          _organization_id: string
        }
        Returns: {
          balance: number
          currency: string
          duplicate: boolean
          ok: boolean
        }[]
      }
      ensure_advertiser: {
        Args: {
          _business_name: string
          _contact_email: string
          _contact_phone?: string
          _industry?: string
          _organization_id: string
        }
        Returns: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          business_name: string
          contact_email: string
          contact_phone: string | null
          created_at: string
          id: string
          industry: string | null
          organization_id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "advertisers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_profile: {
        Args: { _full_name?: string }
        Returns: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_publisher: {
        Args: {
          _business_name: string
          _contact_email: string
          _contact_phone?: string
          _organization_id: string
          _website_url?: string
        }
        Returns: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          business_name: string
          contact_email: string
          contact_phone: string | null
          created_at: string
          id: string
          organization_id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          website_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "publishers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_wallet: {
        Args: { _organization_id: string }
        Returns: {
          balance_amount: number
          country_code: string
          created_at: string
          currency: string
          id: string
          lifetime_deposited: number
          lifetime_spent: number
          low_balance_threshold: number
          organization_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "wallets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_wallet_for_currency: {
        Args: {
          _country_code?: string
          _currency?: string
          _organization_id: string
        }
        Returns: {
          balance_amount: number
          country_code: string
          created_at: string
          currency: string
          id: string
          lifetime_deposited: number
          lifetime_spent: number
          low_balance_threshold: number
          organization_id: string
          updated_at: string
        }[]
      }
      fail_payment: {
        Args: {
          _failure_reason?: string
          _payment_id: string
          _provider?: string
        }
        Returns: {
          payment_id: string
          status: string
        }[]
      }
      generate_zone_key: { Args: never; Returns: string }
      get_supported_payment_methods: {
        Args: { _country_code: string; _currency: string }
        Returns: {
          description: string
          display_name: string
          icon_url: string
          id: string
          maximum_amount: number
          minimum_amount: number
          name: string
          provider_id: string
          provider_name: string
        }[]
      }
      get_user_wallets: {
        Args: { _organization_id: string }
        Returns: {
          balance_amount: number
          country_code: string
          currency: string
          id: string
          lifetime_deposited: number
          lifetime_spent: number
        }[]
      }
      is_org_admin: {
        Args: { _organization_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _organization_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_platform_staff: { Args: { _user_id: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          _action: string
          _actor_email: string
          _actor_id: string
          _ip_address?: string
          _metadata?: Json
          _target_id: string
          _target_label?: string
          _target_type: string
          _user_agent?: string
        }
        Returns: undefined
      }
      mark_payment_failed: {
        Args: { _failure_reason?: string; _id: string }
        Returns: {
          payment_id: string
          status: string
        }[]
      }
      mature_publisher_earnings: {
        Args: { _organization_id?: string }
        Returns: undefined
      }
      refund_campaign_spend: {
        Args: { _campaign_spend_id: string; _reason?: string }
        Returns: Json
      }
      request_payout: {
        Args: {
          _destination: string
          _method: string
          _organization_id: string
        }
        Returns: {
          amount: number
          created_at: string
          destination: string
          id: string
          method: string
          organization_id: string
          paid_at: string | null
          payment_reference: string | null
          publisher_id: string
          rejection_reason: string | null
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_payout: {
        Args: {
          _payment_reference?: string
          _payout_id: string
          _reason?: string
          _status: string
        }
        Returns: {
          amount: number
          created_at: string
          destination: string
          id: string
          method: string
          organization_id: string
          paid_at: string | null
          payment_reference: string | null
          publisher_id: string
          rejection_reason: string | null
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_payment_details: {
        Args: { _id: string; _payment_url: string; _provider_reference: string }
        Returns: {
          id: string
          payment_url: string
          provider_reference: string
        }[]
      }
      update_platform_billing_settings: {
        Args: {
          _earnings_hold_days: number
          _minimum_payout_amount: number
          _publisher_revenue_share: number
        }
        Returns: {
          assumed_ctr: number
          campaign_minimum_budget: number
          created_at: string
          currency: string
          default_bid_amount: number
          default_total_budget: number
          earnings_hold_days: number
          id: boolean
          maximum_bid_amount: number
          maximum_campaign_budget: number
          maximum_creative_size_bytes: number
          maximum_daily_budget: number
          minimum_daily_budget: number
          minimum_payout_amount: number
          platform_status: string
          publisher_revenue_share: number
          starting_cpc: number
          supported_countries: string[]
          supported_currencies: string[]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "platform_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      ad_format:
        | "300x250"
        | "336x280"
        | "728x90"
        | "970x250"
        | "320x50"
        | "320x100"
        | "responsive"
      ad_load_level: "low" | "balanced" | "high"
      ad_refresh_mode: "none" | "time_based" | "scroll_based"
      ad_report_reason:
        | "inappropriate"
        | "misleading"
        | "malicious"
        | "repetitive"
        | "other"
      ad_report_status: "pending" | "reviewed" | "resolved" | "dismissed"
      ad_type: "static_image" | "responsive_display" | "native" | "html5"
      api_key_status: "active" | "revoked" | "expired"
      api_request_status:
        | "success"
        | "client_error"
        | "server_error"
        | "rate_limited"
      approval_status: "pending" | "approved" | "rejected"
      auto_ads_status: "enabled" | "disabled"
      bid_type: "cpm" | "cpc"
      billing_event_type: "impression" | "click"
      browser_type: "chrome" | "firefox" | "safari" | "edge" | "opera" | "other"
      campaign_objective:
        | "awareness"
        | "traffic"
        | "engagement"
        | "conversions"
        | "app_installs"
      campaign_status:
        | "draft"
        | "pending_review"
        | "approved"
        | "active"
        | "paused"
        | "completed"
        | "rejected"
      device_type: "desktop" | "mobile" | "tablet"
      earning_status: "pending" | "available" | "paid" | "reversed"
      entity_status: "active" | "pending" | "suspended"
      health_check_type:
        | "domain_verification"
        | "https"
        | "privacy_policy"
        | "terms_page"
        | "ads_txt"
        | "website_status"
        | "policy_status"
        | "ad_placement"
        | "traffic_quality"
      media_status: "pending" | "ready" | "rejected" | "archived"
      organization_role: "owner" | "admin" | "manager" | "analyst" | "member"
      organization_type: "advertiser" | "publisher" | "platform"
      os_type: "windows" | "macos" | "linux" | "android" | "ios" | "other"
      payout_status: "pending" | "approved" | "paid" | "rejected"
      platform_role: "super_admin" | "admin" | "analyst"
      policy_category:
        | "ad_policies"
        | "publisher_guidelines"
        | "traffic_quality"
        | "prohibited_content"
        | "data_privacy"
        | "compliance"
        | "advertiser_policies"
        | "publisher_policies"
      policy_status: "good" | "warning" | "restricted" | "suspended"
      storage_provider: "supabase" | "s3" | "gcs" | "cloudflare_r2"
      verification_method: "dns_txt" | "meta_tag" | "html_file"
      verification_status: "unverified" | "pending" | "verified" | "failed"
      violation_severity: "low" | "medium" | "high" | "critical"
      violation_status: "open" | "in_review" | "resolved" | "dismissed"
      wallet_transaction_type: "deposit" | "spend" | "refund" | "adjustment"
      website_category:
        | "news"
        | "technology"
        | "business"
        | "finance"
        | "entertainment"
        | "sports"
        | "lifestyle"
        | "health"
        | "education"
        | "travel"
        | "gaming"
        | "automotive"
        | "food"
        | "science"
        | "other"
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
      ad_format: [
        "300x250",
        "336x280",
        "728x90",
        "970x250",
        "320x50",
        "320x100",
        "responsive",
      ],
      ad_load_level: ["low", "balanced", "high"],
      ad_refresh_mode: ["none", "time_based", "scroll_based"],
      ad_report_reason: [
        "inappropriate",
        "misleading",
        "malicious",
        "repetitive",
        "other",
      ],
      ad_report_status: ["pending", "reviewed", "resolved", "dismissed"],
      ad_type: ["static_image", "responsive_display", "native", "html5"],
      api_key_status: ["active", "revoked", "expired"],
      api_request_status: [
        "success",
        "client_error",
        "server_error",
        "rate_limited",
      ],
      approval_status: ["pending", "approved", "rejected"],
      auto_ads_status: ["enabled", "disabled"],
      bid_type: ["cpm", "cpc"],
      billing_event_type: ["impression", "click"],
      browser_type: ["chrome", "firefox", "safari", "edge", "opera", "other"],
      campaign_objective: [
        "awareness",
        "traffic",
        "engagement",
        "conversions",
        "app_installs",
      ],
      campaign_status: [
        "draft",
        "pending_review",
        "approved",
        "active",
        "paused",
        "completed",
        "rejected",
      ],
      device_type: ["desktop", "mobile", "tablet"],
      earning_status: ["pending", "available", "paid", "reversed"],
      entity_status: ["active", "pending", "suspended"],
      health_check_type: [
        "domain_verification",
        "https",
        "privacy_policy",
        "terms_page",
        "ads_txt",
        "website_status",
        "policy_status",
        "ad_placement",
        "traffic_quality",
      ],
      media_status: ["pending", "ready", "rejected", "archived"],
      organization_role: ["owner", "admin", "manager", "analyst", "member"],
      organization_type: ["advertiser", "publisher", "platform"],
      os_type: ["windows", "macos", "linux", "android", "ios", "other"],
      payout_status: ["pending", "approved", "paid", "rejected"],
      platform_role: ["super_admin", "admin", "analyst"],
      policy_category: [
        "ad_policies",
        "publisher_guidelines",
        "traffic_quality",
        "prohibited_content",
        "data_privacy",
        "compliance",
        "advertiser_policies",
        "publisher_policies",
      ],
      policy_status: ["good", "warning", "restricted", "suspended"],
      storage_provider: ["supabase", "s3", "gcs", "cloudflare_r2"],
      verification_method: ["dns_txt", "meta_tag", "html_file"],
      verification_status: ["unverified", "pending", "verified", "failed"],
      violation_severity: ["low", "medium", "high", "critical"],
      violation_status: ["open", "in_review", "resolved", "dismissed"],
      wallet_transaction_type: ["deposit", "spend", "refund", "adjustment"],
      website_category: [
        "news",
        "technology",
        "business",
        "finance",
        "entertainment",
        "sports",
        "lifestyle",
        "health",
        "education",
        "travel",
        "gaming",
        "automotive",
        "food",
        "science",
        "other",
      ],
    },
  },
} as const
