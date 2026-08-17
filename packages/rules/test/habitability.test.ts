import { describe, expect, it } from "vitest";

import {
  allowedResults,
  deriveHabitability,
  type RiskLevel,
  type Risks,
} from "../src/index";

function risks(
  globalStability: RiskLevel,
  geotechnical: RiskLevel,
  structural: RiskLevel,
  nonstructural: RiskLevel,
): Risks {
  return { globalStability, geotechnical, structural, nonstructural };
}

describe("deriveHabitability (AIS sección 7)", () => {
  it("los cuatro riesgos bajos → verde (habitable)", () => {
    expect(deriveHabitability(risks("low", "low", "low", "low"))).toBe("green");
  });

  it("al menos un 'bajo después de medidas' → amarillo (uso restringido)", () => {
    expect(
      deriveHabitability(risks("low", "low_after_measures", "low", "low")),
    ).toBe("yellow");
    expect(
      deriveHabitability(
        risks(
          "low_after_measures",
          "low_after_measures",
          "low_after_measures",
          "low_after_measures",
        ),
      ),
    ).toBe("yellow");
  });

  it("al menos un riesgo alto → naranja (no habitable)", () => {
    expect(deriveHabitability(risks("high", "low", "low", "low"))).toBe(
      "orange",
    );
    // 'high' domina sobre 'low_after_measures'
    expect(
      deriveHabitability(risks("high", "low_after_measures", "low", "low")),
    ).toBe("orange");
  });

  it("exactamente dos altos sigue siendo naranja", () => {
    expect(deriveHabitability(risks("high", "high", "low", "low"))).toBe(
      "orange",
    );
  });

  it("más de dos altos → rojo (peligro de colapso)", () => {
    expect(deriveHabitability(risks("high", "high", "high", "low"))).toBe(
      "red",
    );
    expect(deriveHabitability(risks("high", "high", "high", "high"))).toBe(
      "red",
    );
  });

  it("cualquier riesgo muy alto → rojo, sin importar el resto", () => {
    expect(deriveHabitability(risks("very_high", "low", "low", "low"))).toBe(
      "red",
    );
    expect(
      deriveHabitability(
        risks("very_high", "low_after_measures", "high", "low"),
      ),
    ).toBe("red");
  });
});

describe("allowedResults", () => {
  it("captura remota: nunca ofrece verde (no hay verde definitivo por foto)", () => {
    const remote = allowedResults("remote");
    expect(remote).not.toContain("green");
    expect(remote).toEqual(["yellow", "orange", "red", "site_visit"]);
  });

  it("inspección presencial: verde disponible", () => {
    expect(allowedResults("field")).toContain("green");
  });
});
