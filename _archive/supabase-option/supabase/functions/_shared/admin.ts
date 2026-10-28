import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// Service-role client for writes, after checking the caller is the cron job or a listed admin.
export async function authorize(req: Request): Promise<SupabaseClient | null> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") === cronSecret) return admin;
  const { data } = await admin.auth.getUser(token);
  const email = data.user?.email?.toLowerCase();
  if (!email) return null;
  const { data: row } = await admin.from("admins").select("email").ilike("email", email).maybeSingle();
  return row ? admin : null;
}

export async function triggerDeploy() {
  const hook = Deno.env.get("DEPLOY_HOOK_URL");
  if (!hook) return false;
  const res = await fetch(hook, { method: "POST" });
  return res.ok;
}
