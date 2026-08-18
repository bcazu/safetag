// Edge Function: webhook de KoboToolbox → inserta caso en `cases` y sus fotos
// en Storage (`photos`) + `public.photos`.
// Los campos del submission llegan con los nombres del XLSForm (kobo/ais.xlsx,
// en español); aquí se mapean a las columnas en inglés del esquema (0004/0017).
// Desde la v2 el formulario agrupa en páginas: Kobo entrega cada campo como
// `grupo/campo`, así que TODO acceso pasa por field() — nunca submission.x.
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
const DIVISION_TYPE: Record<string, string> = {
  urbano: "urban",
  rural: "rural",
};
// tipo de vía (slug del form) → palabra legible para componer la dirección
const VIA_TIPO: Record<string, string> = {
  carrera: "Carrera",
  calle: "Calle",
  transversal: "Transversal",
  diagonal: "Diagonal",
  avenida: "Avenida",
  otra: "Vía",
};
const GLOBAL_DAMAGE: Record<string, string> = {
  ninguno: "none",
  "0_10": "0_10",
  "10_30": "10_30",
  "30_60": "30_60",
  "60_100": "60_100",
  "100": "100",
};
// sección 5.2 (captura v2) — va dentro del jsonb `geotechnical`
const SETTLEMENT: Record<string, string> = {
  evidente: "evident",
  dudas: "suspected",
  ninguno: "none",
};
const SLOPE_FAILURE: Record<string, string> = {
  general: "general",
  puntual: "localized",
  ninguna: "none",
};
// sección 11 (solo el dato no sensible)
const INHABITED: Record<string, string> = {
  si: "yes",
  no: "no",
  no_se_sabe: "unknown",
};
// peligros exteriores (indicadores tabla 3-21) → nonstructural_damage.hazards
const HAZARD: Record<string, string> = {
  fachada_balcon: "facade_or_parapet",
  cubierta_tejas: "roof_elements",
  cielo_raso: "ceilings",
  tanque_elevado: "elevated_tank",
  gas: "gas_leak",
  electricas: "power_lines_down",
  quimicos: "chemical_spill",
  escombros_via: "debris_on_road",
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

function text(value: unknown): string | null {
  const s = value == null ? "" : String(value).trim();
  return s === "" ? null : s;
}

/** Geopoint de Kobo: "lat lon alt acc" → {lat, lon} */
function parseGeopoint(value: unknown): { lat: number; lon: number } | null {
  if (typeof value !== "string") return null;
  const [lat, lon] = value.trim().split(/\s+/).map(Number);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

/** Kobo entrega los campos de un grupo con la ruta `grupo/campo` */
function field(s: Submission, name: string): unknown {
  if (name in s) return s[name];
  const key = Object.keys(s).find((k) => k.endsWith(`/${name}`));
  return key ? s[key] : null;
}

/** select_multiple: string separado por espacios → slugs BD (los no mapeados
 * se descartan; 'ninguna'/'ninguno' produce array vacío) */
function multi(
  table: Record<string, string>,
  value: unknown,
): string[] | null {
  const raw = text(value);
  if (raw == null) return null;
  return raw.split(/\s+/)
    .map((v) => table[v])
    .filter((v): v is string => Boolean(v));
}

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
  const f = (name: string) => field(submission, name);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  /** Dirección legible: "Carrera 7 # 45-12 — La finca junto al puente" */
  function buildAddress(): string | null {
    const via = [
      mapped(VIA_TIPO, f("via_tipo")),
      text(f("via_numero")),
    ].filter(Boolean).join(" ");
    const placa = text(f("numero_placa"));
    const street = via ? (placa ? `${via} # ${placa}` : via) : null;
    const parts = [street, text(f("referencia_ubicacion"))].filter(Boolean);
    // fallback: campo `direccion` del formulario anterior a T5b
    return parts.length > 0 ? parts.join(" — ") : text(f("direccion"));
  }

  /** cat_sector-cat_manzana-cat_predio-cat_mejora; NULL si todos vacíos */
  function cadastralId(): string | null {
    const parts = ["cat_sector", "cat_manzana", "cat_predio", "cat_mejora"]
      .map((name) => text(f(name)))
      .filter(Boolean);
    // fallback: campo `id_catastral` del formulario anterior a T5b
    return parts.length > 0 ? parts.join("-") : text(f("id_catastral"));
  }

  /** Matriz 5.3: {beams: {level, extent_pct}, ...} solo con elementos
   * reportados, + estabilidad 5.1 y ancho de la peor grieta si se midió */
  function structuralDamage(): object | null {
    // deno-lint-ignore no-explicit-any
    const elements: Record<string, any> = {};
    for (const [name, key] of Object.entries(DAMAGE_ELEMENTS)) {
      const level = mapped(DAMAGE_LEVEL, f(`dano_${name}`));
      if (!level) continue;
      elements[key] = {
        level,
        extent_pct: level === "none" ? null : toInt(f(`dano_${name}_pct`)),
      };
    }

    const stability = {
      collapse: mapped(COLLAPSE, f("colapso")),
      tilt: mapped(TILT, f("inclinacion")),
    };
    const worstCrackMm = toNum(f("ancho_grieta_mm"));

    if (
      Object.keys(elements).length === 0 &&
      !stability.collapse &&
      !stability.tilt &&
      worstCrackMm == null
    ) {
      return null;
    }
    return { stability, elements, worst_crack_mm: worstCrackMm };
  }

  /** Sección 5.2 observable → jsonb `geotechnical` (activa enrutamiento a
   * geotecnista en routeCase) */
  function geotechnical(): object | null {
    const settlement = mapped(SETTLEMENT, f("asentamiento"));
    const slopeFailure = mapped(SLOPE_FAILURE, f("falla_talud"));
    const morphology = toInt(f("morfologia"));
    if (!settlement && !slopeFailure && morphology == null) return null;
    return {
      settlement,
      slope_failure: slopeFailure,
      site_morphology: morphology,
    };
  }

  /** Peligros exteriores (tabla 3-21) → jsonb `nonstructural_damage` */
  function nonstructuralDamage(): object | null {
    const hazards = multi(HAZARD, f("peligros_exterior"));
    if (hazards == null) return null;
    return { hazards };
  }

  // "0 No se sabe" del formulario no es un código AIS: la BD exige 1..4 o NULL
  const yearRangeRaw = toInt(f("rango_ano"));
  const yearRange = yearRangeRaw != null && yearRangeRaw >= 1 &&
      yearRangeRaw <= 4
    ? yearRangeRaw
    : null;

  // GPS: `ubicacion` es la fuente de verdad; el start-geopoint de respaldo
  // (gps_fondo) y `_geolocation` son últimos recursos — nunca perder una
  // evaluación por GPS.
  const [geoLat, geoLon] = (submission._geolocation ?? [null, null]) as (
    | number
    | null
  )[];
  const point = parseGeopoint(f("ubicacion")) ??
    parseGeopoint(f("gps")) ?? // nombre anterior a T5b
    parseGeopoint(f("gps_fondo")) ??
    (geoLat != null && geoLon != null ? { lat: geoLat, lon: geoLon } : null);

  // barrio: slug de barrios.csv, u 'OTRO' + texto libre (flag para que el
  // gabinete lo resuelva por ST_Contains — assign_territorial_division)
  const barrio = text(f("barrio"));
  const neighborhoodUnlisted = barrio === "OTRO";

  const { data: caseRow, error } = await supabase
    .from("cases")
    .insert({
      kobo_submission_id: String(submission._id),
      // sección 2
      inspection_type: mapped(INSPECTION_TYPE, f("tipo_inspeccion")),
      not_inspected_reason: mapped(
        NOT_INSPECTED_REASON,
        f("motivo_no_inspeccion"),
      ),
      // ubicación (T5b; municipio = código DIVIPOLA, tal cual)
      municipality: text(f("municipio")),
      division_type: mapped(DIVISION_TYPE, f("tipo_zona")),
      commune: text(f("division_urbana")) ??
        text(f("division_rural")) ??
        text(f("comuna")), // nombre anterior a T5b
      neighborhood: neighborhoodUnlisted ? text(f("barrio_otro")) : barrio,
      neighborhood_unlisted: neighborhoodUnlisted,
      cadastral_id: cadastralId(),
      address: buildAddress(),
      building_name: text(f("nombre_edificacion")),
      location: point ? `POINT(${point.lon} ${point.lat})` : null,
      floors_above: toInt(f("pisos_sobre")),
      basements: toInt(f("sotanos")),
      building_use: toInt(f("uso_predominante")),
      ground_floor_use: toInt(f("uso_planta_baja")),
      front_m: toNum(f("frente_m")),
      depth_m: toNum(f("fondo_m")),
      // sección 4 (los slugs del formulario SON los códigos AIS)
      structural_system: f("sistema_estructural") ?? null,
      floor_system: f("tipo_entrepiso") ?? null,
      year_range: yearRange,
      // secciones 5.1 + 5.3 (+ ancho de grieta, captura v2)
      worst_damaged_floor: toInt(f("piso_mayor_dano")),
      structural_damage: structuralDamage(),
      // sección 5.2 observable (captura v2)
      geotechnical: geotechnical(),
      // peligros exteriores (captura v2)
      nonstructural_damage: nonstructuralDamage(),
      // sección 6
      global_damage_pct: mapped(GLOBAL_DAMAGE, f("dano_global")),
      // sección 11 no sensible + 13 + 14 (captura v2, 0017)
      is_inhabited: mapped(INHABITED, f("habitada")),
      comments: text(f("comentarios")),
      inspector_code: text(f("codigo_brigadista")),
      commission_code: text(f("codigo_comision")),
      // señales rápidas para priorización/IA (select_multiple → array)
      warning_signs: text(f("senales_alarma"))?.split(/\s+/) ?? null,
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

  type KoboAttachment = {
    download_url: string;
    filename: string;
    mimetype: string;
    question_xpath?: string;
  };

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
    for (const photoField of PHOTO_FIELDS) {
      const value = f(photoField);
      if (!value) continue;

      // Kobo reemplaza espacios por guiones bajos en el nombre del archivo;
      // question_xpath llega con la ruta del grupo (fotos/foto_fachada)
      const wanted = String(value).replace(/ /g, "_");
      const att = attachments.find(
        (a) =>
          a.question_xpath === photoField ||
          a.question_xpath?.endsWith(`/${photoField}`) ||
          a.filename.split("/").pop() === wanted,
      );
      if (!att) {
        photoErrors.push(`${photoField}: sin adjunto para ${wanted}`);
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
        const storagePath = `cases/${caseRow.id}/${photoField}${ext}`;

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
          photo_type: photoField.replace(/^foto_/, ""),
        });
        if (rowErr) throw rowErr;
      } catch (e) {
        photoErrors.push(
          `${photoField}: ${e instanceof Error ? e.message : String(e)}`,
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
