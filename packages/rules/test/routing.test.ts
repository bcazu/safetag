import { describe, expect, it } from "vitest";

import { routeCase } from "../src/index";

describe("routeCase (AIS + Ley 842 art. 19)", () => {
  it("educacional (3), salud (4) e institucional (8) exigen estructural", () => {
    for (const buildingUse of [3, 4, 8]) {
      expect(routeCase({ buildingUse })).toEqual(["structural"]);
    }
  });

  it("residencial/comercial sin hallazgos geotécnicos: sin especialidad requerida", () => {
    expect(routeCase({ buildingUse: 1 })).toEqual([]);
    expect(routeCase({ buildingUse: 2, geotechnical: null })).toEqual([]);
    expect(routeCase({})).toEqual([]);
  });

  it("asentamiento o falla en talud exigen geotecnista", () => {
    expect(
      routeCase({ buildingUse: 1, geotechnical: { settlement: "evident" } }),
    ).toEqual(["geotechnical"]);
    expect(
      routeCase({ buildingUse: 1, geotechnical: { settlement: "suspected" } }),
    ).toEqual(["geotechnical"]);
    expect(
      routeCase({
        buildingUse: 1,
        geotechnical: { slope_failure: "localized" },
      }),
    ).toEqual(["geotechnical"]);
  });

  it("'ninguno' explícito no dispara enrutamiento geotécnico", () => {
    expect(
      routeCase({
        buildingUse: 1,
        geotechnical: { settlement: "none", slope_failure: "none" },
      }),
    ).toEqual([]);
  });

  it("un colegio con falla en talud exige ambas especialidades", () => {
    expect(
      routeCase({
        buildingUse: 3,
        geotechnical: { slope_failure: "general" },
      }),
    ).toEqual(["structural", "geotechnical"]);
  });
});
