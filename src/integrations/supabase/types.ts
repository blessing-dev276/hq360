export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      resource_requests: {
        Row: {
          created_at: string;
          email: string;
          emailed_at: string | null;
          id: string;
          resource_slug: string;
          resource_title: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          emailed_at?: string | null;
          id?: string;
          resource_slug: string;
          resource_title: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          emailed_at?: string | null;
          id?: string;
          resource_slug?: string;
          resource_title?: string;
        };
        Relationships: [];
      };
      project_inquiries: {
        Row: {
          budget_range: string | null;
          company: string | null;
          created_at: string;
          email: string;
          forwarded_at: string | null;
          help_with: string[];
          id: string;
          industry: string | null;
          message: string | null;
          name: string;
          primary_goal: string | null;
          source_industry: string | null;
          source_path: string | null;
          status: string;
          timeline: string | null;
          website: string | null;
        };
        Insert: {
          budget_range?: string | null;
          company?: string | null;
          created_at?: string;
          email: string;
          forwarded_at?: string | null;
          help_with?: string[];
          id?: string;
          industry?: string | null;
          message?: string | null;
          name: string;
          primary_goal?: string | null;
          source_industry?: string | null;
          source_path?: string | null;
          status?: string;
          timeline?: string | null;
          website?: string | null;
        };
        Update: {
          budget_range?: string | null;
          company?: string | null;
          created_at?: string;
          email?: string;
          forwarded_at?: string | null;
          help_with?: string[];
          id?: string;
          industry?: string | null;
          message?: string | null;
          name?: string;
          primary_goal?: string | null;
          source_industry?: string | null;
          source_path?: string | null;
          status?: string;
          timeline?: string | null;
          website?: string | null;
        };
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          source_path: string | null;
          status: string;
          unsubscribed_at: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          source_path?: string | null;
          status?: string;
          unsubscribed_at?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          source_path?: string | null;
          status?: string;
          unsubscribed_at?: string | null;
        };
        Relationships: [];
      };
      growth_audit_requests: {
        Row: {
          audit_focus: string | null;
          created_at: string;
          email: string;
          emailed_at: string | null;
          forwarded_at: string | null;
          id: string;
          industry: string | null;
          name: string | null;
          source_path: string | null;
          status: string;
          website: string | null;
        };
        Insert: {
          audit_focus?: string | null;
          created_at?: string;
          email: string;
          emailed_at?: string | null;
          forwarded_at?: string | null;
          id?: string;
          industry?: string | null;
          name?: string | null;
          source_path?: string | null;
          status?: string;
          website?: string | null;
        };
        Update: {
          audit_focus?: string | null;
          created_at?: string;
          email?: string;
          emailed_at?: string | null;
          forwarded_at?: string | null;
          id?: string;
          industry?: string | null;
          name?: string | null;
          source_path?: string | null;
          status?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      portfolio_items: {
        Row: {
          capability_slug: string;
          created_at: string;
          description: string | null;
          external_link: string | null;
          id: string;
          industry_slug: string | null;
          media_type: string;
          media_url: string;
          published: boolean;
          sort_order: number;
          thumbnail_url: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          capability_slug: string;
          created_at?: string;
          description?: string | null;
          external_link?: string | null;
          id?: string;
          industry_slug?: string | null;
          media_type?: string;
          media_url: string;
          published?: boolean;
          sort_order?: number;
          thumbnail_url?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          capability_slug?: string;
          created_at?: string;
          description?: string | null;
          external_link?: string | null;
          id?: string;
          industry_slug?: string | null;
          media_type?: string;
          media_url?: string;
          published?: boolean;
          sort_order?: number;
          thumbnail_url?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      testimonials: {
        Row: {
          capability_slug: string | null;
          created_at: string;
          id: string;
          industry_slug: string | null;
          media_type: string;
          media_url: string;
          published: boolean;
          quote: string | null;
          sort_order: number;
          thumbnail_url: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          capability_slug?: string | null;
          created_at?: string;
          id?: string;
          industry_slug?: string | null;
          media_type?: string;
          media_url: string;
          published?: boolean;
          quote?: string | null;
          sort_order?: number;
          thumbnail_url?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          capability_slug?: string | null;
          created_at?: string;
          id?: string;
          industry_slug?: string | null;
          media_type?: string;
          media_url?: string;
          published?: boolean;
          quote?: string | null;
          sort_order?: number;
          thumbnail_url?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          blurb: string | null;
          created_at: string;
          id: string;
          image_url: string | null;
          name: string;
          published: boolean;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          blurb?: string | null;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          name: string;
          published?: boolean;
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          blurb?: string | null;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          name?: string;
          published?: boolean;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      case_studies: {
        Row: {
          approach: string[];
          capabilities: string[];
          challenge: string;
          client: string;
          created_at: string;
          deliverables: string[];
          id: string;
          industry: string;
          media: Json;
          metrics: Json;
          outcome: string;
          published: boolean;
          slug: string;
          sort_order: number;
          status: string;
          summary: string;
          testimonial: Json | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          approach?: string[];
          capabilities?: string[];
          challenge?: string;
          client?: string;
          created_at?: string;
          deliverables?: string[];
          id?: string;
          industry?: string;
          media?: Json;
          metrics?: Json;
          outcome?: string;
          published?: boolean;
          slug: string;
          sort_order?: number;
          status?: string;
          summary?: string;
          testimonial?: Json | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          approach?: string[];
          capabilities?: string[];
          challenge?: string;
          client?: string;
          created_at?: string;
          deliverables?: string[];
          id?: string;
          industry?: string;
          media?: Json;
          metrics?: Json;
          outcome?: string;
          published?: boolean;
          slug?: string;
          sort_order?: number;
          status?: string;
          summary?: string;
          testimonial?: Json | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
