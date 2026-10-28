const DRAFT_KEY = 'psicologa:booking-draft';
const DRAFT_TTL = 60 * 60 * 1000;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function getStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveBookingDraft({ date, horario } = {}) {
  const storage = getStorage();
  if (!storage || !datePattern.test(date || '')) return;
  const draft = {
    date,
    ...(timePattern.test(horario || '') ? { horario } : {}),
    savedAt: Date.now(),
  };
  storage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function readBookingDraft() {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const draft = JSON.parse(storage.getItem(DRAFT_KEY));
    if (!datePattern.test(draft?.date || '') || !Number.isFinite(draft?.savedAt) || Date.now() - draft.savedAt > DRAFT_TTL) {
      storage.removeItem(DRAFT_KEY);
      return null;
    }
    return { date: draft.date, ...(timePattern.test(draft.horario || '') ? { horario: draft.horario } : {}) };
  } catch {
    storage.removeItem(DRAFT_KEY);
    return null;
  }
}

export function clearBookingDraft() {
  getStorage()?.removeItem(DRAFT_KEY);
}
