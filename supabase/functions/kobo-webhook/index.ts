// Edge Function: webhook de KoboToolbox → inserta caso en `cases`.
// Los campos del submission llegan con los nombres del XLSForm (en español);
// aquí se mapean a las columnas en inglés del esquema.
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

  const { error } = await supabase.from("cases").insert({
    kobo_submission_id: String(submission._id),
    location: lat != null && lon != null ? `POINT(${lon} ${lat})` : null,
    address: submission.direccion ?? null,
    neighborhood: submission.barrio ?? null,
    construction_system: submission.sistema_constructivo ?? null,
    num_floors: submission.num_pisos ?? null,
    warning_signs: submission.senales_alarma ?? null,
  });

  if (error) {
    // 23505 = duplicado (reintento de Kobo): responder 200 para que no reintente
    if (error.code === "23505") return new Response("ok (duplicate)");
    console.error(error);
    return new Response(
      JSON.stringify({ code: error.code, message: error.message, details: error.details }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  return new Response("ok");
});
