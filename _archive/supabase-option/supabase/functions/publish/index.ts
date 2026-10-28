// Rebuilds the static site on Vercel (Deploy Hook). Admins only.
import { authorize, cors, json, triggerDeploy } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = await authorize(req);
  if (!db) return json({ error: "Sign in as an admin to publish." }, 401);
  const ok = await triggerDeploy();
  return ok ? json({ ok: true }) : json({ error: "Publishing isn't set up yet: add DEPLOY_HOOK_URL to the function secrets." }, 500);
});
