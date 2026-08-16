// Edge Function: webhook de KoboToolbox → inserta caso en `casos`.
// Kobo envía un POST JSON por cada submission (REST Services / webhooks).
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Secreto compartido configurado en el REST Service de Kobo
  const secret = Deno.env.get("KOBO_WEBHOOK_SECRET");
  if (secret && req.headers.get("x-webhook-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const submission = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // TODO: mapear los nombres de campo reales del XLSForm (kobo/) cuando exista.
  const [lat, lon] = (submission._geolocation ?? [null, null]) as (
    | number
    | null
  )[];

  const { error } = await supabase.from("casos").insert({
    kobo_submission_id: String(submission._id),
    ubicacion: lat != null && lon != null ? `POINT(${lon} ${lat})` : null,
    direccion: submission.direccion ?? null,
    barrio: submission.barrio ?? null,
    sistema_constructivo: submission.sistema_constructivo ?? null,
    num_pisos: submission.num_pisos ?? null,
    senales_alarma: submission.senales_alarma ?? null,
  });

  if (error) {
    // 23505 = duplicado (reintento de Kobo): responder 200 para que no reintente
    if (error.code === "23505") return new Response("ok (duplicate)");
    console.error(error);
    return new Response("Insert failed", { status: 500 });
  }

  return new Response("ok");
});
