# Política de tratamiento de datos personales — SafeTag

> **BORRADOR** para revisión legal. Los campos entre corchetes se completan al
> definir el Responsable del Tratamiento (ver "Modelo de responsabilidad").
> Base normativa: Ley 1581 de 2012 y decretos reglamentarios. Contexto en
> `docs/marco-normativo-y-negocio.md` §3.3.

## 1. Modelo de responsabilidad

La salida jurídicamente más limpia — y coherente con operar dentro del sistema
oficial de gestión del riesgo — es que la entidad coordinadora del operativo
(alcaldía, PMU o gremio de ingenieros) actúe como **Responsable del
Tratamiento** y SafeTag como **Encargado**, mediante contrato de transmisión/
encargo. Mientras ese contrato no exista, SafeTag opera como Responsable
provisional y este documento aplica en su integridad.

- Responsable: **[entidad coordinadora — pendiente]**
- Encargado: SafeTag — **[razón social / responsable técnico]**, contacto:
  **[correo de privacidad]**

## 2. Qué datos se tratan y para qué

| Categoría | Datos | Finalidad | Base |
|---|---|---|---|
| Edificación | Dirección, GPS, identificación catastral, características estructurales, fotos exteriores/estructurales | Priorizar la evaluación estructural y consolidar el estado de las edificaciones para el PMU | Interés legítimo en el marco de la emergencia declarada (Ley 1523) |
| Contacto del inmueble *(sección 12, aún no capturada)* | Nombres, cédula, teléfono | Contactar al responsable del inmueble para seguimiento de la evaluación | Autorización previa e informada |
| Ocupantes *(sección 10, aún no capturada)* | Número de heridos y fallecidos por edificación | Dimensionar la afectación y priorizar la respuesta | **Dato sensible (salud)**: consentimiento expreso; el titular **no está obligado** a autorizar su tratamiento |
| Brigadistas | Nombre, teléfono, ubicación en tiempo real durante misión | Seguridad del personal en campo (alertas, última posición conocida) | Consentimiento expreso al activar el modo "en misión" |
| Revisores | Nombre, matrícula profesional, rama, especialidad | Validez del dictamen (Ley 842 de 2003) y trazabilidad | Ejecución de la relación de voluntariado; deber legal |

**No se recolectan** fotos de personas ni de interiores habitados salvo lo
estrictamente necesario para documentar daño estructural.

## 3. Medidas técnicas ya implementadas

- **Acceso cerrado por defecto**: RLS activo en todas las tablas; solo se
  abren accesos explícitos por rol.
- **PII segregada**: las columnas `contact` y `occupancy` están excluidas del
  permiso de lectura de los usuarios autenticados a nivel de base de datos
  (grant por columna, migración `0006`); su acceso se habilitará solo para el
  rol PMU y el revisor asignado.
- **Minimización de ubicación de brigadistas**: el rastro de posiciones se
  **borra automáticamente a las 24 horas** (job programado en la base de
  datos). Activar el modo "en misión" exige consentimiento registrado — la
  base de datos rechaza el estado sin él (constraint `on_mission_needs_consent`).
- **Aviso en el punto de captura**: el formulario de campo incluye el aviso de
  privacidad y exige confirmar que se comunicó al ocupante o responsable.
- **Trazabilidad del dictamen**: los dictámenes no se borran (auditoría) y toda
  desviación del resultado derivado exige justificación escrita.

## 4. Transferencia internacional

La infraestructura implica transmisión de datos fuera de Colombia:

| Proveedor | Rol | Ubicación |
|---|---|---|
| Supabase (base de datos, almacenamiento de fotos, autenticación) | Encargado sub-contratado | AWS São Paulo, Brasil |
| Vercel (hosting de las aplicaciones web) | Encargado sub-contratado | CDN global |
| KoboToolbox (captura en campo) | Encargado sub-contratado | Servidor global (kf.kobotoolbox.org) |

Los tres operan bajo sus términos de procesamiento de datos. El contrato de
encargo con el Responsable debe declarar esta transmisión internacional
(art. 26 Ley 1581 y régimen de países con nivel adecuado de protección).

## 5. Derechos de los titulares

Conocer, actualizar, rectificar y suprimir sus datos, y revocar la
autorización, escribiendo a **[correo de privacidad]**. Plazos de respuesta:
consultas 10 días hábiles, reclamos 15 días hábiles (art. 14-15 Ley 1581).
La supresión no aplica a los datos de la edificación en sí (no son datos
personales) ni a los dictámenes, que se conservan por deber de auditoría.

## 6. Retención

| Dato | Retención |
|---|---|
| Posiciones de brigadistas | 24 horas (borrado automático) |
| Datos de contacto y ocupantes | Duración de la emergencia + entrega al Responsable; luego supresión en SafeTag |
| Casos, dictámenes y fotos estructurales | Registro histórico del operativo; titularidad del Responsable |

## 7. Aviso de privacidad (texto corto, para el formulario y las apps)

> SafeTag registra ubicación, características y fotografías de edificaciones
> afectadas por el sismo para priorizar su evaluación estructural, bajo la
> Ley 1581 de 2012. La clasificación resultante es un insumo de priorización;
> la habilitación definitiva es competencia de las autoridades. Derechos y
> política completa: **[correo / URL]**.

## 8. Pendientes antes de operar con datos reales

- [ ] Definir Responsable del Tratamiento y firmar contrato de encargo
      (modelo por redactar — objetivo de la reunión con la AIR/alcaldía).
- [ ] Completar los campos entre corchetes y publicar la política.
- [ ] Verificar si aplica registro en el RNBD (SIC) según naturaleza del
      Responsable — el régimen ha cambiado varias veces.
- [ ] Al agregar las secciones 10-12 al formulario: consentimiento expreso
      para datos sensibles, con mención de que no es obligatorio autorizar.
- [ ] Verificar el texto vigente de la Ley 1523 (modificada por Ley 2474 de
      2025) antes de citarla en documentos formales.
