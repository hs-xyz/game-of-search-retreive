import { DuckDBAdapter } from './DuckDBAdapter';
import { createSearchApp } from 'search-framework';

const adapter = new DuckDBAdapter();
const app = createSearchApp({ 
  adapter,
  port: Number(process.env.PORT) || 3000
});

app.start(); 