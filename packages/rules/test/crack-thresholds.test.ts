import { describe, expect, it } from "vitest";

import {
  damageLevelThresholds,
  type CrackThreshold,
  type DamageLevel,
} from "../src/index";

function range(
  thresholds: CrackThreshold[],
  level: DamageLevel,
): [number | null, number | null] {
  const t = thresholds.find((x) => x.level === level)!;
  return [t.minWidthMm, t.maxWidthMm];
}

describe("damageLevelThresholds (AIS sección 5.3)", () => {
  it("concreto reforzado: <0.2 / 0.2-1.0 / 1.0-2.0 / >2.0 / cualitativo", () => {
    const t = damageLevelThresholds("11")!;
    expect(range(t, "none")).toEqual([null, 0.2]);
    expect(range(t, "light")).toEqual([0.2, 1.0]);
    expect(range(t, "moderate")).toEqual([1.0, 2.0]);
    expect(range(t, "heavy")).toEqual([2.0, null]);
    expect(t.find((x) => x.level === "heavy")!.qualitative).toMatch(
      /refuerzo/,
    );
    // severo no se define por ancho sino por aplastamiento/pandeo
    expect(range(t, "severe")).toEqual([null, null]);
  });

  it("mampostería: moderado llega a 3.0 mm (no 2.0 como el concreto)", () => {
    const t = damageLevelThresholds("21")!;
    expect(range(t, "moderate")).toEqual([1.0, 3.0]);
    expect(range(t, "heavy")).toEqual([3.0, null]);
  });

  it("tapia/adobe tolera más fisura: <0.4 / 0.4-2.0 / 2.0-4.0 / >4.0", () => {
    const t = damageLevelThresholds("52")!;
    expect(range(t, "none")).toEqual([null, 0.4]);
    expect(range(t, "light")).toEqual([0.4, 2.0]);
    expect(range(t, "moderate")).toEqual([2.0, 4.0]);
    expect(range(t, "heavy")).toEqual([4.0, null]);
  });

  it("no existe umbral global: el mismo ancho cambia de nivel según material", () => {
    // una grieta de 2.5 mm es 'heavy' en concreto, 'moderate' en mampostería
    // y 'moderate' en tapia — la regla "3 mm → evacuar" del doc viejo era falsa
    expect(range(damageLevelThresholds("11")!, "heavy")[0]).toBe(2.0);
    expect(range(damageLevelThresholds("21")!, "moderate")[1]).toBe(3.0);
    expect(range(damageLevelThresholds("51")!, "moderate")[1]).toBe(4.0);
  });

  it("acero, madera, mixta y otros no tienen criterio de ancho de grieta", () => {
    for (const system of ["31", "33", "41", "50", "60"] as const) {
      expect(damageLevelThresholds(system)).toBeNull();
    }
  });

  it("todas las variantes de concreto y mampostería comparten tabla", () => {
    expect(damageLevelThresholds("14")).toEqual(damageLevelThresholds("11"));
    expect(damageLevelThresholds("23")).toEqual(damageLevelThresholds("21"));
    expect(damageLevelThresholds("51")).toEqual(damageLevelThresholds("52"));
  });
});
