// Explanations shown in the campaign's "Resumen" tab (labels and legend, as in the Matriz).
import type { Lang } from "./catalog";

type L = Record<Lang, string>;

export const PRIORITY_HELP: Record<string, L> = {
  P1: { es: "Vencidas hace 3 años o menos, o empresa con 2+ establecimientos (más probable que siga operando y que renueve).", en: "Expired 3 years ago or less, or company with 2+ establishments (most likely still operating and renewing)." },
  P2: { es: "Vencidas hace 3 a 5 años; sin licencia de empresas con un solo establecimiento.", en: "Expired 3 to 5 years ago; no licence, single-establishment companies." },
  P3: { es: "Vencidas hace más de 5 años: objetivo principal = confirmar si siguen operando (depuración).", en: "Expired more than 5 years ago: main goal = confirm whether still operating (clean-up)." },
};

// What happens to the task after each call result ({days} = the campaign's follow-up days).
export const CALL_HELP: Record<string, L> = {
  "01": { es: "Se registra la fecha de compromiso; seguimiento {days} días hábiles después de esa fecha.", en: "The commitment date is recorded; follow-up {days} business days after it." },
  "02": { es: "Ya inició el trámite: la tarea termina (se confirma con el estatus SIGTUR).", en: "Already applied: the task ends (confirmed with the SIGTUR status)." },
  "03": { es: "Necesita ayuda o cita: seguimiento en {days} días hábiles, o pasa a visita si se marca.", en: "Needs help or an appointment: follow-up in {days} business days, or sent to visit if ticked." },
  "04": { es: "Se niega o no le interesa: pasa a visita.", en: "Refuses or not interested: sent to visit." },
  "05": { es: "Cerró: cuenta como cerrado (depuración) y la tarea termina.", en: "Closed down: counts as closed (clean-up) and the task ends." },
  "06": { es: "Cambió dueño, nombre o dirección: seguimiento el siguiente día hábil para actualizar datos.", en: "Changed owner, name or address: follow-up next business day to update the data." },
  "07": { es: "El número se marca como equivocado; se reintenta con otro número o pasa a visita si no queda ninguno.", en: "The number is marked wrong; retried with another number, or sent to visit if none is left." },
  "08": { es: "Se reintenta el siguiente día hábil. Al llegar al máximo de intentos pasa a visita.", en: "Retried next business day. At the maximum number of attempts it is sent to visit." },
  "09": { es: "El número se marca fuera de servicio; se reintenta con otro número o pasa a visita.", en: "The number is marked out of service; retried with another number, or sent to visit." },
  "10": { es: "Buzón o pidió devolver la llamada: se reintenta en 3 horas.", en: "Voicemail or asked to call back: retried in 3 hours." },
};

export const VISIT_HELP: Record<string, L> = {
  V1: { es: "El establecimiento inició la solicitud durante la visita.", en: "The establishment applied during the visit." },
  V2: { es: "Sigue operando y se compromete a solicitar en una fecha.", en: "Still operating and commits to apply by a date." },
  V3: { es: "Sigue operando pero se niega a formalizarse.", en: "Still operating but refuses to formalise." },
  V4: { es: "Se comprobó en sitio que cerró (depuración).", en: "Confirmed closed on site (clean-up)." },
  V5: { es: "No se encontró en la dirección registrada.", en: "Not found at the registered address." },
  V6: { es: "El responsable no estaba; hay que volver.", en: "The person in charge was not there; visit again." },
  V7: { es: "Cambió de dirección o de razón social.", en: "Changed address or company name." },
};

export const SIGTUR_HELP: Record<string, L> = {
  Vencida: { es: "Tuvo licencia y venció.", en: "Had a licence that expired." },
  "Sin licencia": { es: "Nunca tuvo licencia.", en: "Never had a licence." },
  Incompleta: { es: "Solicitud empezada pero incompleta.", en: "Application started but incomplete." },
  "En proceso": { es: "Solicitud presentada y en revisión (cuenta como logro).", en: "Application submitted and under review (counts as achieved)." },
  Vigente: { es: "Licencia al día.", en: "Licence up to date." },
  "Inactivo (depurado)": { es: "Dado de baja por cierre.", en: "Removed because it closed." },
};

export const CHANNEL_HELP: Record<string, L> = {
  Correo: { es: "Se formalizó tras el correo masivo.", en: "Formalised after the mass email." },
  Llamada: { es: "Se formalizó tras una llamada.", en: "Formalised after a call." },
  Visita: { es: "Se formalizó tras una visita.", en: "Formalised after a visit." },
  "Jornada de formalización": { es: "Se formalizó en una jornada presencial.", en: "Formalised at an in-person event." },
  "Iniciativa propia": { es: "Se formalizó sin gestión del equipo.", en: "Formalised without the team's contact." },
};

export const STATUS_HELP: Record<string, L> = {
  pending: { es: "Asignada y aún sin llamar.", en: "Assigned, not called yet." },
  retry: { es: "No se logró contacto; se vuelve a llamar en la fecha indicada.", en: "No contact; call again on the scheduled date." },
  followup: { es: "Hubo contacto; se llama de nuevo en la fecha de seguimiento.", en: "Contacted; call again on the follow-up date." },
  visit: { es: "Se envió a los inspectores para visita.", en: "Sent to the inspectors for a visit." },
  done: { es: "No requiere más llamadas.", en: "No more calls needed." },
};
