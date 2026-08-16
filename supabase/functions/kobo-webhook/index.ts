// Edge Function: webhook de KoboToolbox → inserta caso en `cases` y sus fotos
// en Storage (`photos`) + `public.photos`.
// Los campos del submission llegan con los nombres del XLSForm (kobo/atc20.xlsx,
// en español); aquí se mapean a las columnas en inglés del esquema.
import { createClient } from "npm:@supabase/supabase-js@2";

// Preguntas de imagen del XLSForm → photo_type (prefijo `foto_` fuera)
const PHOTO_FIELDS = [
  "foto_fachada",
  "foto_esquina_1",
  "foto_esquina_2",
  "foto_esquina_3",
  "foto_esquina_4",
  "foto_grieta",
  "foto_columnas",
];

type KoboAttachment = {
  download_url: string;
  filename: string;
  mimetype: string;
  question_xpath?: string;
};

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

  const [lat, lon] = (submission._geolocation ?? [null, null]) as (
    | number
    | null
  )[];

  const { data: caseRow, error } = await supabase
    .from("cases")
    .insert({
      kobo_submission_id: String(submission._id),
      location: lat != null && lon != null ? `POINT(${lon} ${lat})` : null,
      address: submission.direccion ?? null,
      neighborhood:
        submission.barrio === "otro"
          ? submission.barrio_otro ?? "otro"
          : submission.barrio ?? null,
      construction_system: submission.sistema_constructivo ?? null,
      num_floors: submission.num_pisos ?? null,
      // select_multiple llega como string separado por espacios
      warning_signs: submission.senales_alarma?.split(" ") ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = duplicado (reintento de Kobo): responder 200 para que no reintente
    if (error.code === "23505") return new Response("ok (duplicate)");
    console.error(error);
    return new Response(
      JSON.stringify({ code: error.code, message: error.message, details: error.details }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  // Fotos: best-effort — si una falla se registra y se continúa, para no
  // provocar reintentos de Kobo que duplicarían el caso (23505 los corta,
  // pero dejaría fotos a medias). Recuperación manual vía API de Kobo.
  const koboToken = Deno.env.get("KOBO_API_TOKEN");
  const attachments = (submission._attachments ?? []) as KoboAttachment[];
  if (!koboToken && attachments.length > 0) {
    console.warn("KOBO_API_TOKEN no configurado: se omiten las fotos");
  }

  const photoErrors: string[] = [];
  if (koboToken) {
    for (const field of PHOTO_FIELDS) {
      const value = submission[field];
      if (!value) continue;

      // Kobo reemplaza espacios por guiones bajos en el nombre del archivo
      const wanted = String(value).replace(/ /g, "_");
      const att = attachments.find(
        (a) =>
          a.question_xpath === field ||
          a.filename.split("/").pop() === wanted,
      );
      if (!att) {
        photoErrors.push(`${field}: sin adjunto para ${wanted}`);
        continue;
      }

      try {
        const res = await fetch(att.download_url, {
          headers: { Authorization: `Token ${koboToken}` },
        });
        if (!res.ok) throw new Error(`descarga HTTP ${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());

        const ext = wanted.includes(".") ? wanted.slice(wanted.lastIndexOf(".")) : ".jpg";
        const storagePath = `cases/${caseRow.id}/${field}${ext}`;

        const { error: upErr } = await supabase.storage
          .from("photos")
          .upload(storagePath, bytes, { contentType: att.mimetype, upsert: true });
        if (upErr) throw upErr;

        const { error: rowErr } = await supabase.from("photos").insert({
          case_id: caseRow.id,
          storage_path: storagePath,
          photo_type: field.replace(/^foto_/, ""),
        });
        if (rowErr) throw rowErr;
      } catch (e) {
        photoErrors.push(`${field}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  if (photoErrors.length > 0) {
    console.error("Fotos con error:", photoErrors);
    return new Response(`ok (fotos con error: ${photoErrors.join("; ")})`);
  }
  return new Response("ok");
});
