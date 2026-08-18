import { describe, expect, it } from "vitest";

import {
  AIS_STRUCTURAL_SYSTEMS,
  CRACK_THRESHOLDS_META,
  DAMAGE_LEVELS,
  damageLevelThresholds,
  floorSlabThresholds,
  RISK_CRITERIA,
  SATURATION_ELEMENTS,
  SATURATION_ELEMENTS_META,
  type AisStructuralSystem,
  type CrackThreshold,
  type DamageLevel,
} from "../src/index";

function levels(system: AisStructuralSystem): CrackThreshold[] {
  const lookup = damageLevelThresholds(system);
  expect(lookup.status).toBe("verified");
  return lookup.status === "verified" ? lookup.levels : [];
}

function range(
  thresholds: CrackThreshold[],
  level: DamageLevel,
): [number | null, number | null] {
  const t = thresholds.find((x) => x.level === level)!;
  return [t.minWidthMm, t.maxWidthMm];
}

function qualitative(thresholds: CrackThreshold[], level: DamageLevel): string {
  return thresholds.find((x) => x.level === level)!.qualitative ?? "";
}

describe("damageLevelThresholds (AIS sección 5.3, datos versionados)", () => {
  it("concreto reforzado: <0.2 / 0.2-1.0 / 1.0-2.0 / >2.0 / cualitativo", () => {
    const t = levels("11");
    expect(range(t, "none")).toEqual([null, 0.2]);
    expect(range(t, "light")).toEqual([0.2, 1.0]);
    expect(range(t, "moderate")).toEqual([1.0, 2.0]);
    expect(range(t, "heavy")).toEqual([2.0, null]);
    expect(t.find((x) => x.level === "heavy")!.qualitative).toMatch(/refuerzo/);
    // severo no se define por ancho sino por aplastamiento/pandeo
    expect(range(t, "severe")).toEqual([null, null]);
  });

  it("mampostería: moderado llega a 3.0 mm (no 2.0 como el concreto)", () => {
    const t = levels("21");
    expect(range(t, "moderate")).toEqual([1.0, 3.0]);
    expect(range(t, "heavy")).toEqual([3.0, null]);
  });

  it("tapia/adobe (52) tolera más fisura: <0.4 / 0.4-2.0 / 2.0-4.0 / >4.0", () => {
    const t = levels("52");
    expect(range(t, "none")).toEqual([null, 0.4]);
    expect(range(t, "light")).toEqual([0.4, 2.0]);
    expect(range(t, "moderate")).toEqual([2.0, 4.0]);
    expect(range(t, "heavy")).toEqual([4.0, null]);
  });

  it("no existe umbral global: el mismo ancho cambia de nivel según material", () => {
    // una grieta de 2.5 mm es 'heavy' en concreto pero 'moderate' en
    // mampostería — la regla "3 mm → evacuar" del doc viejo era falsa
    expect(range(levels("11"), "heavy")[0]).toBe(2.0);
    expect(range(levels("21"), "moderate")[1]).toBe(3.0);
  });

  it("bahareque (51, tabla 3-8): verificada, CUALITATIVA (sin mm) y con variantes", () => {
    const lookup = damageLevelThresholds("51");
    expect(lookup.status).toBe("verified");
    if (lookup.status !== "verified") return;
    // el manual NO define anchos en mm para bahareque: todos null
    for (const l of lookup.levels) {
      expect(l.minWidthMm).toBeNull();
      expect(l.maxWidthMm).toBeNull();
    }
    // distingue no-encementado y encementado
    expect(lookup.variantLabels).toEqual({
      non_cemented: "Bahareque no encementado",
      cemented: "Bahareque encementado",
    });
    const moderate = lookup.levels.find((l) => l.level === "moderate")!;
    expect(moderate.variants?.non_cemented).toMatch(/vertical de esquinas/);
    expect(moderate.variants?.cemented).toMatch(/diagonales en algunos muros/);
    // severo comparte criterio entre variantes: sin campo variants
    const severe = lookup.levels.find((l) => l.level === "severe")!;
    expect(severe.variants).toBeUndefined();
    expect(severe.qualitative).toMatch(/desplome/);
    // y NO hereda los umbrales de tapia
    expect(range(lookup.levels, "none")).toEqual([null, null]);
  });

  it("acero (31-33, tabla 3-9): verificada, cualitativa; fuera/dentro de articulación plástica", () => {
    for (const system of ["31", "32", "33"] as const) {
      const t = levels(system);
      for (const l of t) {
        expect(l.minWidthMm).toBeNull();
        expect(l.maxWidthMm).toBeNull();
        expect(l.qualitative).toBeTruthy();
      }
      expect(qualitative(t, "none")).toMatch(/Sin defectos visibles/);
      expect(qualitative(t, "heavy")).toMatch(/fuera de zonas/);
      expect(qualitative(t, "severe")).toMatch(/dentro de zonas/);
      expect(qualitative(t, "severe")).toMatch(/soldaduras/);
    }
  });

  it("madera (41-42, tabla 3-10): verificada, cualitativa", () => {
    for (const system of ["41", "42"] as const) {
      const t = levels(system);
      for (const l of t) {
        expect(l.minWidthMm).toBeNull();
        expect(l.maxWidthMm).toBeNull();
        expect(l.qualitative).toBeTruthy();
      }
      expect(qualitative(t, "moderate")).toMatch(/uniones/);
      expect(qualitative(t, "severe")).toMatch(/sección transversal/);
    }
  });

  it("entrepisos (tabla 3-11): mismos anchos que concreto en los 3 primeros niveles", () => {
    const lookup = floorSlabThresholds();
    expect(lookup.status).toBe("verified");
    if (lookup.status !== "verified") return;
    const t = lookup.levels;
    expect(t.map((l) => l.level)).toEqual([...DAMAGE_LEVELS]);
    expect(range(t, "none")).toEqual([null, 0.2]);
    expect(range(t, "light")).toEqual([0.2, 1.0]);
    expect(range(t, "moderate")).toEqual([1.0, 2.0]);
    // fuerte y severo son cualitativos en la tabla 3-11 (sin ancho explícito)
    expect(range(t, "heavy")).toEqual([null, null]);
    expect(qualitative(t, "heavy")).toMatch(/apreciable/);
    expect(range(t, "severe")).toEqual([null, null]);
    expect(qualitative(t, "severe")).toMatch(/aplastamiento/);
  });

  it("mixta (50) y otros (60) devuelven 'unknown' sin romper", () => {
    expect(damageLevelThresholds("50").status).toBe("unknown");
    expect(damageLevelThresholds("60").status).toBe("unknown");
  });

  it("todos los códigos AIS tienen entrada y las tablas verificadas traen los 5 niveles", () => {
    for (const system of Object.keys(
      AIS_STRUCTURAL_SYSTEMS,
    ) as AisStructuralSystem[]) {
      const lookup = damageLevelThresholds(system);
      expect(["verified", "unknown"]).toContain(lookup.status);
      if (lookup.status === "verified") {
        expect(lookup.levels.map((l) => l.level)).toEqual([...DAMAGE_LEVELS]);
      }
    }
  });

  it("la metadata refleja la verificación completa del manual (v2)", () => {
    expect(CRACK_THRESHOLDS_META.version).toBeGreaterThanOrEqual(2);
    expect(CRACK_THRESHOLDS_META.source).toContain(
      "manual-ais-tablas-verificadas",
    );
  });
});

describe("SATURATION_ELEMENTS (tabla 3-12, dato versionado, sin lógica)", () => {
  it("trae las 8 filas del manual en orden", () => {
    expect(SATURATION_ELEMENTS.map((r) => r.key)).toEqual([
      "concrete_frame",
      "concrete_frame_with_walls",
      "steel",
      "wood",
      "unconfined_masonry",
      "reinforced_masonry",
      "confined_masonry",
      "earthen",
    ]);
  });

  it("cada fila tiene etiqueta y elementos del manual, y sistemas AIS válidos", () => {
    const validCodes = Object.keys(AIS_STRUCTURAL_SYSTEMS);
    for (const row of SATURATION_ELEMENTS) {
      expect(row.systemLabel).toBeTruthy();
      expect(row.elements).toBeTruthy();
      for (const code of row.systems) {
        expect(validCodes).toContain(code);
      }
    }
  });

  it("mapea acero a 31-33 y tapia/adobe/bahareque a 51-52", () => {
    const steel = SATURATION_ELEMENTS.find((r) => r.key === "steel")!;
    expect(steel.systems).toEqual(["31", "32", "33"]);
    expect(steel.elements).toMatch(/riostras/);
    const earthen = SATURATION_ELEMENTS.find((r) => r.key === "earthen")!;
    expect(earthen.systems).toEqual(["51", "52"]);
    expect(earthen.elements).toBe("Muros de soporte");
  });

  it("los sistemas sin fila propia en la tabla (12, 14, 50, 60) NO están mapeados", () => {
    const mapped = new Set(SATURATION_ELEMENTS.flatMap((r) => r.systems));
    for (const code of ["12", "14", "50", "60"]) {
      expect(mapped.has(code as AisStructuralSystem)).toBe(false);
    }
    expect(SATURATION_ELEMENTS_META.note).toMatch(/sin mapeo/);
  });
});

describe("RISK_CRITERIA (tablas 3-2 y 3-3 verificadas; 3-13 y 3-21 sin volcar)", () => {
  it("estabilidad global y geotécnico traen criterios para los 4 niveles", () => {
    for (const key of ["globalStability", "geotechnical"] as const) {
      const c = RISK_CRITERIA[key];
      expect(c.status).toBe("verified");
      if (c.status === "verified") {
        expect(Object.keys(c.criteria).sort()).toEqual(
          ["high", "low", "low_after_measures", "very_high"].sort(),
        );
      }
    }
  });

  it("riesgo estructural y no estructural quedan 'unknown' — sin sugerencia automática", () => {
    expect(RISK_CRITERIA.structural.status).toBe("unknown");
    expect(RISK_CRITERIA.nonstructural.status).toBe("unknown");
    if (RISK_CRITERIA.structural.status === "unknown") {
      expect(RISK_CRITERIA.structural.todo).toContain("TODO(tabla 3-13)");
    }
    if (RISK_CRITERIA.nonstructural.status === "unknown") {
      expect(RISK_CRITERIA.nonstructural.todo).toContain("TODO(tabla 3-21)");
    }
  });
});
