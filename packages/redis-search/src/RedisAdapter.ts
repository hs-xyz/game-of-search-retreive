import { createClient, SchemaFieldTypes } from 'redis';
import { DatabaseAdapter } from 'search-framework';
import { getRedisData, getBenchmarkQueries } from 'shared-utils';

export class RedisAdapter implements DatabaseAdapter {
  public readonly name = 'Redis Stack';
  private client: any;

  async initialize(): Promise<void> {
    this.client = createClient({
      password: 'redis123',
      socket: {
        host: 'redis-stack',
        port: 6379
      }
    });

    await this.client.connect();
    console.log('Connected to Redis Stack');

    try {
      await this.client.ft.dropIndex('articles');
    } catch (error) {
      // Index might not exist
    }

    await this.client.ft.create('articles', {
      id: SchemaFieldTypes.NUMERIC,
      title: SchemaFieldTypes.TEXT,
      content: SchemaFieldTypes.TEXT,
      author: SchemaFieldTypes.TEXT,
      tags: SchemaFieldTypes.TAG
    }, {
      ON: 'HASH',
      PREFIX: 'article:'
    });

    console.log('Redis FT.SEARCH index created');
    await this.seedData();
  }

  private async seedData(): Promise<void> {
    console.log('Seeding Redis with 100k articles...');
    const articles = getRedisData();

    for (const article of articles) {
      await this.client.hSet(`article:${article.id}`, {
        id: article.id,
        title: article.title,
        content: article.content,
        author: article.author,
        tags: article.tags
      });
    }
    console.log(`Seeded ${articles.length} articles to Redis`);
  }

  async search(query: string, limit: number): Promise<{ results: any[]; total: number }> {
    const results = await this.client.ft.search('articles', query, {
      LIMIT: { from: 0, size: limit }
    });

    return {
      results: results.documents.map((doc: any) => ({
        id: doc.id.replace('article:', ''),
        ...doc.value
      })),
      total: results.total
    };
  }

  async getAllRecords(limit: number, offset: number): Promise<{ results: any[]; total: number; offset: number; limit: number }> {
    const results = await this.client.ft.search('articles', '*', {
      LIMIT: { from: offset, size: limit }
    });

    return {
      results: results.documents.map((doc: any) => ({
        id: doc.id.replace('article:', ''),
        ...doc.value
      })),
      total: results.total,
      offset,
      limit
    };
  }

  async benchmark(queries: string[]): Promise<{ benchmarks: any[]; averageDuration: string }> {
    const benchmarkQueries = getBenchmarkQueries();
    const results = [];

    for (const query of benchmarkQueries) {
      const start = Date.now();
      const result = await this.client.ft.search('articles', query);
      const duration = Date.now() - start;
      
      results.push({
        query,
        resultCount: result.total,
        duration: `${duration}ms`
      });
    }

    return {
      benchmarks: results,
      averageDuration: `${results.reduce((sum, r) => sum + parseInt(r.duration), 0) / results.length}ms`
    };
  }
} 