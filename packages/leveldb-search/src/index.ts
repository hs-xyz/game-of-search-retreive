import { SearchApp } from 'search-framework';
import { LevelDBAdapter } from './LevelDBAdapter';

const adapter = new LevelDBAdapter();
const app = new SearchApp({
  adapter,
  port: parseInt(process.env.PORT || '3000')
});

app.start(); 