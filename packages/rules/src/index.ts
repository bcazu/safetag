// @safetag/rules — reglas de negocio del Formulario Único AIS.
// Única fuente de verdad: la consumen la app de revisión y, en fase 2, el
// servicio de IA. No duplicar estos criterios en UI ni en SQL.
export * from "./habitability";
export * from "./crack-thresholds";
export * from "./risk-criteria";
export * from "./saturation-elements";
export * from "./structural-systems";
export * from "./routing";
