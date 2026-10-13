/**
 * How choosing units in the lead form fills in the rest of the brief.
 *
 * A unit is a fact (its typology, its programme's city, its price); the brief
 * is what the buyer wants. So a unit only fills a field that is empty, or one it
 * filled itself. A field the user typed in is theirs and is never overwritten,
 * and taking the units away clears only what they put there.
 *
 * Pure, so the rules are proved in scripts/verify without a browser.
 */

/** A unit as the picker returns it (PICKER_LOT_SELECT). */
export interface PickedLot {
    id: string;
    lotNumber: string;
    type: string;
    typology: string | null;
    floor: number;
    bedrooms: number | null;
    surfaceArea: number;
    totalPrice: number;
    status?: string;
    building: { name: string } | null;
    program: { id: string; name: string; city: string | null };
}

export const AUTO_FIELDS = ['interestedTypology', 'preferredLocation', 'budgetMin', 'budgetMax'] as const;
export type AutoField = (typeof AUTO_FIELDS)[number];

export type BriefDraft = Record<AutoField, string>;

/** Which fields hold a value taken from units, and from which (for the hint). */
export type AutoFilled = Partial<Record<AutoField, string>>;

/** What the chosen units say about each field; empty where they say nothing. */
export function valuesFromLots(lots: readonly PickedLot[]): BriefDraft {
    if (lots.length === 0) return { interestedTypology: '', preferredLocation: '', budgetMin: '', budgetMax: '' };
    const typologies = Array.from(new Set(lots.map((l) => l.typology?.trim()).filter((t): t is string => !!t)));
    const prices = lots.map((l) => l.totalPrice).filter((p) => p > 0);
    return {
        interestedTypology: typologies.join(', ').slice(0, 40),
        preferredLocation: lots[0].program.city?.trim() ?? '',
        // One unit is one price, so it is the ceiling and the floor stays the
        // buyer's. Several give a range.
        budgetMin: prices.length > 1 ? String(Math.min(...prices)) : '',
        budgetMax: prices.length > 0 ? String(Math.max(...prices)) : '',
    };
}

/**
 * The brief after the chosen units changed. Fills empty fields and refreshes
 * the ones the units filled before; leaves typed ones alone.
 */
export function applyLots(
    brief: BriefDraft,
    autoFilled: AutoFilled,
    lots: readonly PickedLot[]
): { brief: BriefDraft; autoFilled: AutoFilled } {
    const derived = valuesFromLots(lots);
    const source = lots.map((l) => l.lotNumber).join(', ');
    const next = { ...brief };
    const nextAuto: AutoFilled = {};

    for (const field of AUTO_FIELDS) {
        const ours = field in autoFilled;
        if (!ours && brief[field].trim() !== '') continue;
        next[field] = derived[field];
        if (derived[field] !== '') nextAuto[field] = source;
    }

    // A filled budget end must not cross one the user typed. Units alone always
    // give min <= max, so a crossing means one end is typed: drop the end we
    // filled rather than produce a range the server refuses.
    if (next.budgetMin !== '' && next.budgetMax !== '' && Number(next.budgetMin) > Number(next.budgetMax)) {
        for (const field of ['budgetMin', 'budgetMax'] as const) {
            if (nextAuto[field]) {
                next[field] = '';
                delete nextAuto[field];
            }
        }
    }

    return { brief: next, autoFilled: nextAuto };
}

/** The user typed in a field: from now on it is theirs. */
export function markEdited(autoFilled: AutoFilled, field: string): AutoFilled {
    if (!(field in autoFilled)) return autoFilled;
    const next = { ...autoFilled };
    delete next[field as AutoField];
    return next;
}

/** The project changed: units from another project go, and the brief follows. */
export function changeProgram(
    brief: BriefDraft,
    autoFilled: AutoFilled,
    lots: readonly PickedLot[],
    programId: string
): { brief: BriefDraft; autoFilled: AutoFilled; lots: PickedLot[] } {
    const kept = lots.filter((l) => l.program.id === programId);
    return { ...applyLots(brief, autoFilled, kept), lots: kept };
}
