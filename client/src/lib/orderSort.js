export const ORDER_SORT_STORAGE_KEY = 'pos_orders_sort';

export const ORDER_SORT_FIELDS = {
  none: 'none',
  createdAt: 'created_at',
  weight: 'weight',
};

export const ORDER_SORT_DIRECTIONS = {
  asc: 'asc',
  desc: 'desc',
};

const DEFAULT_SORT = {
  field: ORDER_SORT_FIELDS.none,
  direction: ORDER_SORT_DIRECTIONS.desc,
};

/**
 * @returns {{ field: string, direction: string }}
 */
export function getStoredOrderSort() {
  try {
    if (typeof localStorage === 'undefined') {
      return { ...DEFAULT_SORT };
    }
    const raw = localStorage.getItem(ORDER_SORT_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SORT };
    }
    const parsed = JSON.parse(raw);
    const field = String(parsed?.field || '').trim();
    const direction = String(parsed?.direction || '').trim().toLowerCase();

    const validField = Object.values(ORDER_SORT_FIELDS).includes(field)
      ? field
      : DEFAULT_SORT.field;
    const validDirection =
      direction === ORDER_SORT_DIRECTIONS.asc ||
      direction === ORDER_SORT_DIRECTIONS.desc
        ? direction
        : DEFAULT_SORT.direction;

    return { field: validField, direction: validDirection };
  } catch {
    return { ...DEFAULT_SORT };
  }
}

/**
 * @param {{ field: string, direction: string }} sort
 */
export function setStoredOrderSort(sort) {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const field = Object.values(ORDER_SORT_FIELDS).includes(sort.field)
      ? sort.field
      : DEFAULT_SORT.field;
    const direction =
      sort.direction === ORDER_SORT_DIRECTIONS.asc
        ? ORDER_SORT_DIRECTIONS.asc
        : ORDER_SORT_DIRECTIONS.desc;
    localStorage.setItem(
      ORDER_SORT_STORAGE_KEY,
      JSON.stringify({ field, direction }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}
