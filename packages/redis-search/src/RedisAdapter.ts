import { createClient, SchemaFieldTypes } from 'redis';
import { DatabaseAdapter } from 'search-framework';
import { getRedisData, getBenchmarkQueries } from 'shared-utils';

export class RedisAdapter implements DatabaseAdapter {
  public readonly name = 'Redis Stack';
  private client: any;
  private maxRetries = 10;
  private baseDelay = 1000;

  async initialize(): Promise<void> {
    await this.connectWithRetry();
    await this.waitForRedisReady();
    await this.setupIndex();
    await this.seedData();
  }

  private async connectWithRetry(): Promise<void> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Attempting Redis connection (${attempt}/${this.maxRetries})...`);
        
        this.client = createClient({
          password: 'redis123',
          socket: {
            host: 'redis-stack',
            port: 6379,
            connectTimeout: 10000
          }
        });

        this.client.on('error', (err: any) => {
          console.log('Redis Client Error:', err.message);
        });

        this.client.on('connect', () => {
          console.log('Redis client connected');
        });

        this.client.on('ready', () => {
          console.log('Redis client ready');
        });

        await this.client.connect();
        console.log('Successfully connected to Redis Stack');
        return;
        
      } catch (error: any) {
        console.log(`Redis connection attempt ${attempt} failed:`, error.message);
        
        if (attempt === this.maxRetries) {
          throw new Error(`Failed to connect to Redis after ${this.maxRetries} attempts: ${error.message}`);
        }
        
        const delay = this.baseDelay * Math.pow(2, attempt - 1);
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private async waitForRedisReady(): Promise<void> {
    const maxWaitTime = 60000;
    const checkInterval = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        await this.client.ping();
        console.log('Redis is ready for operations');
        return;
      } catch (error: any) {
        if (error.message.includes('LOADING')) {
          console.log('Redis is still loading dataset, waiting...');
          await new Promise(resolve => setTimeout(resolve, checkInterval));
        } else {
          throw error;
        }
      }
    }
    
    throw new Error('Redis did not become ready within the timeout period');
  }

  private async setupIndex(): Promise<void> {
    try {
      console.log('Setting up Redis search index...');
      
      try {
        await this.client.ft.dropIndex('articles');
        console.log('Dropped existing index');
      } catch (error) {
        console.log('No existing index to drop');
      }

      await this.client.ft.create('articles', {
        id: SchemaFieldTypes.NUMERIC,
        title: SchemaFieldTypes.TEXT,
        content: SchemaFieldTypes.TEXT,
        author: SchemaFieldTypes.TEXT,
        tags: SchemaFieldTypes.TEXT
      }, {
        ON: 'HASH',
        PREFIX: 'article:'
      });

      console.log('Redis FT.SEARCH index created successfully');
    } catch (error: any) {
      console.error('Failed to setup Redis index:', error.message);
      throw error;
    }
  }

  private async seedData(): Promise<void> {
    console.log('Seeding Redis with 100k articles...');
    const articles = getRedisData();
    const batchSize = 1000;
    let processed = 0;

    try {
      for (let i = 0; i < articles.length; i += batchSize) {
        const batch = articles.slice(i, i + batchSize);
        const pipeline = this.client.multi();

        for (const article of batch) {
          pipeline.hSet(`article:${article.id}`, {
            id: article.id,
            title: article.title,
            content: article.content,
            author: article.author,
            tags: article.tags.replace(/,/g, ' ')
          });
        }

        await pipeline.exec();
        processed += batch.length;

        if (processed % 10000 === 0) {
          console.log(`Seeded ${processed} articles...`);
        }
      }

      console.log(`Successfully seeded ${articles.length} articles to Redis`);
    } catch (error: any) {
      console.error('Error during data seeding:', error.message);
      throw error;
    }
  }

  async search(query: string, limit: number): Promise<{ results: any[]; total: number }> {
    try {
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
    } catch (error: any) {
      console.error('Search error:', error.message);
      throw error;
    }
  }

  async getAllRecords(limit: number, offset: number): Promise<{ results: any[]; total: number; offset: number; limit: number }> {
    try {
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
    } catch (error: any) {
      console.error('Get all records error:', error.message);
      throw error;
    }
  }

  async benchmark(queries: string[]): Promise<{ benchmarks: any[]; averageDuration: string }> {
    const benchmarkQueries = getBenchmarkQueries();
    const results = [];

    for (const query of benchmarkQueries) {
      try {
        const start = Date.now();
        const result = await this.client.ft.search('articles', query);
        const duration = Date.now() - start;
        
        results.push({
          query,
          resultCount: result.total,
          duration: `${duration}ms`
        });
      } catch (error: any) {
        console.error(`Benchmark error for query "${query}":`, error.message);
        results.push({
          query,
          resultCount: 0,
          duration: '0ms',
          error: error.message
        });
      }
    }

    return {
      benchmarks: results,
      averageDuration: `${results.reduce((sum, r) => sum + parseInt(r.duration), 0) / results.length}ms`
    };
  }
} 