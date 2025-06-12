export { SearchApp } from './SearchApp';
export * from './types';

export function createSearchApp(config: import('./types').SearchAppConfig): import('./SearchApp').SearchApp {
  return new SearchApp(config);
}

import { SearchApp } from './SearchApp';
export { SearchApp as default }; 