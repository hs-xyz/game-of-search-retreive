import { SearchApp } from 'search-framework';
import { MongoDBAdapter } from './MongoDBAdapter';

const adapter = new MongoDBAdapter();
const app = new SearchApp({
  adapter,
  port: parseInt(process.env.PORT || '3000')
});

app.start(); 