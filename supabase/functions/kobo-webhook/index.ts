// Edge Function: webhook de KoboToolbox → inserta caso en `cases` y sus fotos
// en Storage (`photos`) + `public.photos`.
// Los campos del submission llegan con los nombres del XLSForm (kobo/ais.xlsx,
// en español); aquí se mapean a las columnas en inglés del esquema (0004).
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

// slugs del formulario (es) → slugs de la BD (en)
const INSPECTION_TYPE: Record<string, string> = {
  exterior: "exterior",
  parcial: "partial",
  completa: "complete",
  no_inspeccionada: "not_inspected",
};
const NOT_INSPECTED_REASON: Record<string, string> = {
  no_permitido: "not_allowed",
  desocupada: "unoccupied",
  colapso: "collapse",
  demolida: "demolished",
  otro: "other",
};
const COLLAPSE: Record<string, string> = {
  total: "total",
  parcial_mayor_50: "partial_ge_50",
  parcial_menor_50: "partial_lt_50",
  ninguno: "none",
};
const TILT: Record<string, string> = {
  evidente: "evident",
  dudas: "suspected",
  ninguna: "none",
};
const DAMAGE_LEVEL: Record<string, string> = {
  ninguno: "none",
  leve: "light",
  moderado: "moderate",
  fuerte: "heavy",
  severo: "severe",
};
const GLOBAL_DAMAGE: Record<string, string> = {
  ninguno: "none",
  "0_10": "0_10",
  "10_30": "10_30",
  "30_60": "30_60",
  "60_100": "60_100",
  "100": "100",
};

// campo del formulario (sin prefijo dano_) → clave en structural_damage.elements
const DAMAGE_ELEMENTS: Record<string, string> = {
  vigas: "beams",
  columnas: "columns",
  nudos: "joints",
  conexiones: "connections",
  muros: "structural_walls",
  muros_portantes: "bearing_walls",
  columnetas: "confinement_columns",
  vigas_confinamiento: "confinement_beams",
  entrepisos: "floor_slabs",
};

// deno-lint-ignore no-explicit-any
type Submission = Record<string, any>;

function mapped(
  table: Record<string, string>,
  value: unknown,
): string | null {
  return value == null ? null : table[String(value)] ?? null;
}

function toInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Matriz 5.3: {beams: {level, extent_pct}, ...} solo con elementos reportados */
function structuralDamage(s: Submission): object | null {
  // deno-lint-ignore no-explicit-any
  const elements: Record<string, any> = {};
  for (const [field, key] of Object.entries(DAMAGE_ELEMENTS)) {
    const level = mapped(DAMAGE_LEVEL, s[`dano_${field}`]);
    if (!level) continue;
    elements[key] = {
      level,
      extent_pct: level === "none" ? null : toInt(s[`dano_${field}_pct`]),
    };
  }

  const stability = {
    collapse: mapped(COLLAPSE, s.colapso),
    tilt: mapped(TILT, s.inclinacion),
  };

  if (
    Object.keys(elements).length === 0 &&
    !stability.collapse &&
    !stability.tilt
  ) {
    return null;
  }
  return { stability, elements };
}

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

  const submission: Submission = await req.json();

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
      // sección 2
      inspection_type: mapped(INSPECTION_TYPE, submission.tipo_inspeccion),
      not_inspected_reason: mapped(
        NOT_INSPECTED_REASON,
        submission.motivo_no_inspeccion,
      ),
      // sección 1
      commune: submission.comuna ?? null,
      neighborhood: submission.barrio ?? null,
      cadastral_id: submission.id_catastral ?? null,
      // sección 3
      address: submission.direccion ?? null,
      building_name: submission.nombre_edificacion ?? null,
      location: lat != null && lon != null ? `POINT(${lon} ${lat})` : null,
      floors_above: toInt(submission.pisos_sobre),
      basements: toInt(submission.sotanos),
      building_use: toInt(submission.uso_predominante),
      ground_floor_use: toInt(submission.uso_planta_baja),
      front_m: toNum(submission.frente_m),
      depth_m: toNum(submission.fondo_m),
      // sección 4 (los slugs del formulario SON los códigos AIS)
      structural_system: submission.sistema_estructural ?? null,
      floor_system: submission.tipo_entrepiso ?? null,
      year_range: toInt(submission.rango_ano),
      // secciones 5.1 + 5.3
      worst_damaged_floor: toInt(submission.piso_mayor_dano),
      structural_damage: structuralDamage(submission),
      // sección 6
      global_damage_pct: mapped(GLOBAL_DAMAGE, submission.dano_global),
      // señales rápidas para priorización/IA (select_multiple → array)
      warning_signs: submission.senales_alarma?.split(" ") ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = duplicado (reintento de Kobo): responder 200 para que no reintente
    if (error.code === "23505") return new Response("ok (duplicate)");
    console.error(error);
    return new Response(
      JSON.stringify({
        code: error.code,
        message: error.message,
        details: error.details,
      }),
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

        const ext = wanted.includes(".")
          ? wanted.slice(wanted.lastIndexOf("."))
          : ".jpg";
        const storagePath = `cases/${caseRow.id}/${field}${ext}`;

        const { error: upErr } = await supabase.storage
          .from("photos")
          .upload(storagePath, bytes, {
            contentType: att.mimetype,
            upsert: true,
          });
        if (upErr) throw upErr;

        const { error: rowErr } = await supabase.from("photos").insert({
          case_id: caseRow.id,
          storage_path: storagePath,
          photo_type: field.replace(/^foto_/, ""),
        });
        if (rowErr) throw rowErr;
      } catch (e) {
        photoErrors.push(
          `${field}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  if (photoErrors.length > 0) {
    console.error("Fotos con error:", photoErrors);
    return new Response(`ok (fotos con error: ${photoErrors.join("; ")})`);
  }
  return new Response("ok");
});
