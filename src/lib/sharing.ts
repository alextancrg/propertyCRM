// Maximum number of other property managers a single Property Manager may be
// linked to for shared property visibility ("your team" size cap). Sharing
// visibility is bidirectional, so this limits how many managers a manager can
// directly share/link with. Administrators are not subject to the cap (they
// already see the whole portfolio).
export const MAX_SHARING_PARTNERS = 5;
