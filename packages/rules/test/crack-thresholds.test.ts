import { describe, expect, it } from "vitest";

import {
  AIS_STRUCTURAL_SYSTEMS,
  CRACK_THRESHOLDS_META,
  DAMAGE_LEVELS,
  damageLevelThresholds,
  RISK_CRITERIA,
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

  it("bahareque (51) devuelve 'unknown' — la tabla 3-8 NO está verificada y es distinta de tapia", () => {
    const lookup = damageLevelThresholds("51");
    expect(lookup.status).toBe("unknown");
    if (lookup.status === "unknown") {
      expect(lookup.reason).toContain("TODO(tabla 3-8)");
    }
  });

  it("acero (3-9) y madera (3-10) devuelven 'unknown' con su TODO rastreable", () => {
    for (const system of ["31", "32", "33"] as const) {
      const lookup = damageLevelThresholds(system);
      expect(lookup.status).toBe("unknown");
      if (lookup.status === "unknown") {
        expect(lookup.reason).toContain("TODO(tabla 3-9)");
      }
    }
    for (const system of ["41", "42"] as const) {
      const lookup = damageLevelThresholds(system);
      expect(lookup.status).toBe("unknown");
      if (lookup.status === "unknown") {
        expect(lookup.reason).toContain("TODO(tabla 3-10)");
      }
    }
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

  it("los entrepisos (tabla 3-11) están declarados como pendientes en la metadata", () => {
    expect(CRACK_THRESHOLDS_META.floorSlabs.todo).toContain("TODO(tabla 3-11)");
  });
});

describe("RISK_CRITERIA (tablas 3-2 y 3-3 verificadas; 3-13 y 3-21 no)", () => {
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
