import { SearchApp } from 'search-framework';
import { RedisAdapter } from './RedisAdapter';

const adapter = new RedisAdapter();
const app = new SearchApp({
  adapter,
  port: parseInt(process.env.PORT || '3000')
});

app.start(); 