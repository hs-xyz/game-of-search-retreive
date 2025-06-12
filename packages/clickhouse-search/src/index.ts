import { SearchApp } from 'search-framework';
import { ClickHouseAdapter } from './ClickHouseAdapter';

const adapter = new ClickHouseAdapter();
const app = new SearchApp({
  adapter,
  port: parseInt(process.env.PORT || '3000')
});

app.start(); 