import { createClient, SchemaFieldTypes } from 'redis';
import { DatabaseAdapter } from 'search-framework';
import { getRedisData } from 'shared-utils';

export class RedisAdapter implements DatabaseAdapter {
  public readonly name = 'Redis Stack';
  private client: any;
  private maxRetries = 10;
  private baseDelay = 1000;

  async initialize(): Promise<void> {
    await this.connectWithRetry();
    await this.waitForRedisReady();
    await this.fastClearData();
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

  private async fastClearData(): Promise<void> {
    console.log('Fast clearing existing Redis data...');
    const startTime = Date.now();
    
    await this.client.flushDb();
    console.log(`Cleared Redis database in ${Date.now() - startTime}ms using FLUSHDB`);
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

      await this.client.ft.configSet('MAXSEARCHRESULTS', '-1');
      await this.client.ft.configSet('MAXAGGREGATERESULTS', '-1');
      console.log('Removed Redis search result limits');

      await this.client.ft.create('articles', {
        id: SchemaFieldTypes.NUMERIC,
        title: SchemaFieldTypes.TEXT,
        content: SchemaFieldTypes.TEXT,
        author: SchemaFieldTypes.TEXT,
        tags: SchemaFieldTypes.TEXT,
        difficulty: SchemaFieldTypes.TAG,
        type: SchemaFieldTypes.TAG,
        readTime: SchemaFieldTypes.NUMERIC,
        publishDate: SchemaFieldTypes.TEXT,
        views: SchemaFieldTypes.NUMERIC,
        rating: SchemaFieldTypes.NUMERIC
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
    console.log('Seeding Redis with 1M articles...');
    const articles = getRedisData();
    
    // Use larger batch sizes for better performance
    const batchSize = 5000;
    const pipelineSize = 10; // Number of batches to process in parallel
    let processed = 0;

    try {
      // Process articles in large batches using parallel pipelines
      for (let i = 0; i < articles.length; i += batchSize * pipelineSize) {
        const promises = [];
        
        // Create multiple pipelines to run in parallel
        for (let p = 0; p < pipelineSize && (i + p * batchSize) < articles.length; p++) {
          const startIdx = i + p * batchSize;
          const endIdx = Math.min(startIdx + batchSize, articles.length);
          const batch = articles.slice(startIdx, endIdx);
          
          if (batch.length === 0) break;
          
          // Create a pipeline for this batch
          const pipeline = this.client.multi();
          
          // Add all operations to the pipeline
          for (const article of batch) {
            pipeline.hSet(`article:${article.id}`, {
              id: article.id,
              title: article.title,
              content: article.content,
              author: article.author,
              tags: article.tags.replace(/,/g, ' '),
              difficulty: (article as any).difficulty || 'beginner',
              type: (article as any).type || 'article',
              readTime: (article as any).readTime || 5,
              publishDate: (article as any).publishDate || '2023-01-01',
              views: (article as any).views || 1000,
              rating: (article as any).rating || 4.0
            });
          }
          
          // Add the pipeline execution to promises array
          promises.push(pipeline.exec());
        }
        
        // Execute all pipelines in parallel
        await Promise.all(promises);
        processed += Math.min(batchSize * pipelineSize, articles.length - i);
        
        // Progress reporting
        if (processed % 50000 === 0 || processed >= articles.length) {
          console.log(`Seeded ${processed}/${articles.length} articles (${Math.round(processed/articles.length*100)}%)`);
        }
      }

      console.log(`Successfully seeded ${articles.length} articles to Redis using optimized batching`);
      
      // Wait for Redis to catch up before indexing verification
      console.log('Waiting for Redis to stabilize...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Verify indexing with optimized approach
      await this.waitForIndexing(articles.length);
      
    } catch (error: any) {
      console.error('Error during optimized data seeding:', error.message);
      throw error;
    }
  }

  private async waitForIndexing(expectedCount: number): Promise<void> {
    console.log('Waiting for Redis search indexing to complete...');
    const maxAttempts = 20;
    const targetPercentage = 0.95; // Accept 95% indexing as complete
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const indexedCount = await this.client.ft.search('articles', '*', { 
          LIMIT: { from: 0, size: 0 } 
        });
        
        const percentage = (indexedCount.total / expectedCount) * 100;
        console.log(`Redis index contains ${indexedCount.total.toLocaleString()} searchable records (${percentage.toFixed(1)}% - attempt ${attempt})`);
        
        if (indexedCount.total >= expectedCount * targetPercentage) {
          console.log(`Redis indexing completed successfully! (${indexedCount.total.toLocaleString()} records)`);
          return;
        }
        
        // Progressive backoff - wait longer as attempts increase
        const waitTime = Math.min(5000 + (attempt * 1000), 15000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
      } catch (error: any) {
        console.error(`Error checking index status (attempt ${attempt}): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('Redis indexing verification completed (may still be in progress in background)');
  }

  async search(query: string, limit: number): Promise<{ results: any[]; total: number }> {
    try {
      const effectiveLimit = Math.min(limit, 100);
      const results = await this.client.ft.search('articles', query, {
        LIMIT: { from: 0, size: effectiveLimit }
      });

      return {
        results: results.documents.map((doc: any) => ({
          id: doc.id.replace('article:', ''),
          ...doc.value,
          readTime: parseInt(doc.value.readTime) || 5,
          views: parseInt(doc.value.views) || 1000,
          rating: parseFloat(doc.value.rating) || 4.0
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
      const effectiveLimit = Math.min(limit, 100);
      const total = await this.getFastCount();
      
      if (effectiveLimit === 0) {
        return {
          results: [],
          total,
          offset,
          limit: effectiveLimit
        };
      }

      const results = await this.client.ft.search('articles', '*', {
        LIMIT: { from: offset, size: effectiveLimit }
      });

      return {
        results: results.documents.map((doc: any) => ({
          id: doc.id.replace('article:', ''),
          ...doc.value,
          readTime: parseInt(doc.value.readTime) || 5,
          views: parseInt(doc.value.views) || 1000,
          rating: parseFloat(doc.value.rating) || 4.0
        })),
        total,
        offset,
        limit: effectiveLimit
      };
    } catch (error: any) {
      console.error('Get all records error:', error.message);
      throw error;
    }
  }

  private async getFastCount(): Promise<number> {
    try {
      const results = await this.client.ft.search('articles', '*', {
        LIMIT: { from: 0, size: 0 }
      });
      return results.total;
    } catch (error: any) {
      console.warn('Fast count failed:', error.message);
      return 0;
    }
  }
} 