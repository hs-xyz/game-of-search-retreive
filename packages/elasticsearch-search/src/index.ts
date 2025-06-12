import { SearchApp } from 'search-framework';
import { ElasticsearchAdapter } from './ElasticsearchAdapter';

const adapter = new ElasticsearchAdapter();
const app = new SearchApp({
  adapter,
  port: parseInt(process.env.PORT || '3000')
});

app.start(); 