/** What can be searched for on a server (cabinet → Серверы → server). More options will be added here. */
export type SearchFilter = { id: string; label: string };

export const SEARCH_FILTERS: SearchFilter[] = [
  { id: 'lonely-ladies', label: 'Одинокие дамы' },
  { id: 'ladies', label: 'Дамы' },
];
