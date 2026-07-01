export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

export const DEFAULT_PAGE_SIZE = 10;

const PAGE_SIZE_STORAGE_KEY = 'pos_page_size';

export function getStoredPageSize() {
  try {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_PAGE_SIZE;
    }
    const raw = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    if (raw == null || raw === '') {
      return DEFAULT_PAGE_SIZE;
    }
    const n = Number(raw);
    if (PAGE_SIZE_OPTIONS.includes(n)) {
      return n;
    }
    return DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

export function setStoredPageSize(size) {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const n = Number(size);
    if (!PAGE_SIZE_OPTIONS.includes(n)) {
      return;
    }
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(n));
  } catch {
    /* ignore quota / private mode */
  }
}
