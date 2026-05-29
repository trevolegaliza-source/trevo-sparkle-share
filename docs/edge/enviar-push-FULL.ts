// =============================================
// Edge Function: enviar-push
// =============================================
// Recebe payload com subscription_ids e dispara Web Push.
// A edge resolve as subscriptions via admin client (service role), garantindo
// que cada subscription_id pertence a um user da MESMA empresa do caller
// autenticado. Evita que um master de empresa A consiga enviar push pra
// devices de empresa B só conhecendo o id (ou pior, enumerando).
//
// Body esperado:
//   {
//     title: string, body: string, url?: string, tag?: string,
//     subscription_ids: string[]
//   }
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:dani.ai@trevolegaliza.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// AUDIT-004 (29/05/2026): allowlist de URL — aceita só path relativo ou
// origin oficial *.trevolegaliza.com.br. Evita open redirect via notif.
// Path relativo: ^/[a-zA-Z0-9/_?&=-]*$  (sem `#`/`%`/espaço)
// Origin oficial: ^https://.+\.trevolegaliza\.com\.br
const URL_REL_RE = /^\/[a-zA-Z0-9/_?&=-]*$/;
const URL_ORIGIN_RE = /^https:\/\/.+\.trevolegaliza\.com\.br(\/[a-zA-Z0-9/_?&=-]*)?$/;

function isUrlSegura(u: string | undefined | null): boolean {
  if (!u) return true; // url vazia → padrão "/" usado downstream
  if (URL_REL_RE.test(u)) return true;
  if (URL_ORIGIN_RE.test(u)) return true;
  return false;
}

interface PayloadIn {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  unread_count?: number;
  subscription_ids: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(
      JSON.stringify({ error: "VAPID_KEYS_MISSING" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // AUDIT-004 (29/05/2026): adicionada auth — JWT obrigatório + role master/gerente.
  // Antes a edge era pública: qualquer um com a URL conseguia mandar push pra
  // qualquer endpoint conhecido (e o trigger SQL passava raw endpoint/keys, então
  // bastava vazar uma vez o payload pra spammar). Agora:
  //   1. JWT do caller deve ser válido (auth Supabase)
  //   2. role do caller ∈ {master, gerente}
  //   3. todas as subscription_ids[] precisam pertencer a users da MESMA empresa
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "MISSING_AUTH" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "INVALID_SESSION" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: profile } = await admin
    .from("profiles")
    .select("role, empresa_id, ativo")
    .eq("id", user.id)
    .single();
  if (!profile || !(profile as any).ativo) {
    return new Response(JSON.stringify({ error: "USER_INACTIVE" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const role = (profile as any).role;
  const callerEmpresaId = (profile as any).empresa_id;
  if (!["master", "gerente"].includes(role)) {
    return new Response(JSON.stringify({ error: "FORBIDDEN_ROLE" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: PayloadIn;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "INVALID_JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { title, body, url, tag, unread_count, subscription_ids } = payload;
  if (!title || !body) {
    return new Response(JSON.stringify({ error: "MISSING_FIELDS" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // AUDIT-004 (29/05/2026): valida URL contra allowlist (evita open redirect).
  if (!isUrlSegura(url)) {
    return new Response(JSON.stringify({ error: "URL_NAO_PERMITIDA", url }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!Array.isArray(subscription_ids) || subscription_ids.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // AUDIT-004 (29/05/2026): resolve subscription_ids via admin SOMENTE quando
  // pertencem a users da MESMA empresa do caller. JOIN profiles → match empresa.
  // Subscriptions de empresas diferentes (ou orfãs) são silenciosamente filtradas
  // — evita leakage de existência via diferenças de erro.
  const { data: subRows, error: subErr } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_id, profiles!inner(empresa_id)")
    .in("id", subscription_ids)
    .eq("profiles.empresa_id", callerEmpresaId);

  if (subErr) {
    console.error("[enviar-push] erro buscando subscriptions:", subErr);
    return new Response(JSON.stringify({ error: "DB_ERROR" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const subscriptions = (subRows ?? []) as Array<{
    id: string; endpoint: string; p256dh: string; auth: string;
  }>;

  if (subscriptions.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions_matched" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const pushPayload = JSON.stringify({ title, body, url: url ?? "/", tag, unread_count });
  const expired: string[] = [];
  const errors: Array<{ id: string; status?: number; error?: string }> = [];

  const results = await Promise.allSettled(
    subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          pushPayload,
        );
        return { id: s.id, ok: true };
      } catch (err: any) {
        const status = err?.statusCode ?? 0;
        if (status === 404 || status === 410) {
          expired.push(s.id);
        } else {
          errors.push({ id: s.id, status, error: String(err?.message ?? err) });
        }
        return { id: s.id, ok: false, status, error: String(err?.message ?? err) };
      }
    }),
  );

  const ok = results.filter((r) => r.status === "fulfilled" && (r as any).value.ok).length;

  return new Response(
    JSON.stringify({
      sent: ok,
      total: subscriptions.length,
      requested: subscription_ids.length,
      filtered_out: subscription_ids.length - subscriptions.length,
      expired,
      errors,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
