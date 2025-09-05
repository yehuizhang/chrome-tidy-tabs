export const MAX_BROWSER_HISTORY_AGE_IN_DAYS = 365;
export const MAX_BROWSER_HISTORY_COUNT = 1_000_000;

export enum StorageKeys {
  VISIT_DATA = 'visit_data',
  ERROR_MESSAGES = 'error_messages',
  EXCLUDED_URLS = 'excluded_urls',
}

export const SEARCH_MAX_RESULTS = 20;
export const SEARCH_MAX_RESULT_TO_DISPLAY = 8;
export const SEARCH_FUSE_RESULT_WEIGHT = 0.7;
export const SEARCH_VISIT_COUNT_WEIGHT = 0.3;
export const SEARCH_MAX_CLICK_BOOST = 2.0;
