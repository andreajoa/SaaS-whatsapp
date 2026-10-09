import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import type { QualityPolicy } from "./contracts";
// Ponte local estrita enquanto o integrador regenera database.types.ts.
// Sem any/strings RPC não verificadas espalhadas nas rotas.
type PolicyRow = QualityPolicy & { organization_id: string; updated_at: string };
type SurveyRow = {
  id: string;
  organization_id: string;
  conversation_id: string;
  service_started_at: string | null;
  token_hash: string;
  requested_by_user_id: string | null;
  created_at: string;
  expires_at: string;
  responded_at: string | null;
  score: number | null;
  comment: string | null;
};
type QualityDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Database["public"]["Tables"] & {
      service_quality_policies: {
        Row: PolicyRow;
        Insert: QualityPolicy & { organization_id: string; updated_at?: string };
        Update: Partial<PolicyRow>;
        Relationships: [];
      };
      service_quality_surveys: {
        Row: SurveyRow;
        Insert: Partial<SurveyRow> & {
          organization_id: string;
          conversation_id: string;
          token_hash: string;
          expires_at: string;
        };
        Update: Partial<SurveyRow>;
        Relationships: [];
      };
    };
    Functions: Database["public"]["Functions"] & {
      fn_service_quality_surveys: {
        Args: { p_org: string; p_conversations: string[]; p_limit?: number };
        Returns: Json;
      };
      fn_service_quality_facts: {
        Args: { p_org: string; p_after?: string; p_limit?: number; p_conversation?: string };
        Returns: Json;
      };
      fn_service_quality_request: {
        Args: { p_org: string; p_conversation: string; p_hash: string; p_expires: string };
        Returns: Json;
      };
      fn_service_quality_respond: {
        Args: { p_hash: string; p_score: number; p_comment?: string };
        Returns: Json;
      };
    };
  };
};
export function qualityDatabase(client: SupabaseClient<Database>): SupabaseClient<QualityDatabase> {
  return client as unknown as SupabaseClient<QualityDatabase>;
}
