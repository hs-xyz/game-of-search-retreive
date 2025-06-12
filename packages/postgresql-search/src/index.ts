import { SearchApp } from 'search-framework';
import { PostgreSQLAdapter } from './PostgreSQLAdapter';

const adapter = new PostgreSQLAdapter();
const app = new SearchApp({
  adapter,
  port: parseInt(process.env.PORT || '3000')
});

app.start(); 