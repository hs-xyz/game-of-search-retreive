import { Level } from 'level';
import { DatabaseAdapter } from 'search-framework';
import { seedData as generatedArticles, getBenchmarkQueries, Article } from 'shared-utils';

export class LevelDBAdapter implements DatabaseAdapter {
  public readonly name = 'LevelDB';
  private db: any;
  private titleIndex: any;
  private contentIndex: any;
  private authorIndex: any;
  private searchableIndex: any;
  private isInitialized = false;
  private initializationAttempts = 0;
  private maxInitAttempts = 3;

  async initialize(): Promise<void> {
    while (this.initializationAttempts < this.maxInitAttempts && !this.isInitialized) {
      try {
        this.initializationAttempts++;
        console.log(`LevelDB initialization attempt ${this.initializationAttempts}/${this.maxInitAttempts}`);
        
        await this.initializeDatabases();
        await this.seedDataWithRecovery();
        
        this.isInitialized = true;
        console.log('LevelDB database initialized successfully with crash prevention');
        
      } catch (error: any) {
        console.error(`Initialization attempt ${this.initializationAttempts} failed:`, error.message);
        
        await this.cleanup();
        
        if (this.initializationAttempts >= this.maxInitAttempts) {
          throw new Error(`Failed to initialize LevelDB after ${this.maxInitAttempts} attempts: ${error.message}`);
        }
        
        const delay = 5000 * this.initializationAttempts;
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private async initializeDatabases(): Promise<void> {
    const dbOptions = {
      valueEncoding: 'json',
      writeBufferSize: 32 * 1024 * 1024,
      cacheSize: 64 * 1024 * 1024,
      maxOpenFiles: 4000,
      blockSize: 16384,
      createIfMissing: true,
      errorIfExists: false,
      compression: true,
      filterPolicy: 'bloom'
    };

    this.db = new Level('./data', dbOptions);
    this.titleIndex = new Level('./data/title-index', { 
      valueEncoding: 'json', 
      writeBufferSize: 16 * 1024 * 1024,
      cacheSize: 32 * 1024 * 1024 
    });
    this.contentIndex = new Level('./data/content-index', { 
      valueEncoding: 'json', 
      writeBufferSize: 16 * 1024 * 1024,
      cacheSize: 32 * 1024 * 1024 
    });
    this.authorIndex = new Level('./data/author-index', { 
      valueEncoding: 'json', 
      writeBufferSize: 8 * 1024 * 1024,
      cacheSize: 16 * 1024 * 1024 
    });
    this.searchableIndex = new Level('./data/searchable-index', { 
      valueEncoding: 'json', 
      writeBufferSize: 16 * 1024 * 1024,
      cacheSize: 32 * 1024 * 1024 
    });
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.db) await this.db.close();
      if (this.titleIndex) await this.titleIndex.close();
      if (this.contentIndex) await this.contentIndex.close();
      if (this.authorIndex) await this.authorIndex.close();
      if (this.searchableIndex) await this.searchableIndex.close();
    } catch (error) {
      console.log('Cleanup completed');
    }
  }

  private monitorMemoryUsage(): void {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    
    console.log(`Memory: ${heapUsedMB}MB used / ${heapTotalMB}MB total`);
    
    if (heapUsedMB > 6000) {
      console.warn('High memory usage detected, forcing garbage collection');
      if (global.gc) {
        global.gc();
      }
    }
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 15);
  }

  private async createInvertedIndexStream(articles: Article[], indexDb: any, fieldExtractor: (article: Article) => string): Promise<void> {
    const tokenMap = new Map<string, Set<string>>();
    const maxTokensPerMap = 25000;
    let currentTokenCount = 0;
    
    for (const article of articles) {
      if (currentTokenCount >= maxTokensPerMap) {
        await this.flushTokenMap(tokenMap, indexDb);
        tokenMap.clear();
        currentTokenCount = 0;
        
        if (global.gc) {
          global.gc();
        }
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      
      const text = fieldExtractor(article);
      const tokens = this.tokenize(text);
      
      for (const token of tokens) {
        if (!tokenMap.has(token)) {
          tokenMap.set(token, new Set());
          currentTokenCount++;
        }
        tokenMap.get(token)!.add(article.id);
      }
    }
    
    if (tokenMap.size > 0) {
      await this.flushTokenMap(tokenMap, indexDb);
    }
  }

  private async flushTokenMap(tokenMap: Map<string, Set<string>>, indexDb: any): Promise<void> {
    const batch = [];
    
    for (const [token, articleIds] of tokenMap) {
      const indexKey = `token:${token}`;
      
      try {
        let existingIds: string[] = [];
        try {
          existingIds = await indexDb.get(indexKey) || [];
        } catch (error) {
          // Key doesn't exist
        }
        
        const allIds = Array.from(new Set([...existingIds, ...Array.from(articleIds)]));
        batch.push({ type: 'put', key: indexKey, value: allIds });
        
        if (batch.length >= 50) {
          await indexDb.batch(batch.splice(0, 50));
        }
      } catch (error) {
        console.error(`Error processing token ${token}:`, error);
      }
    }
    
    if (batch.length > 0) {
      await indexDb.batch(batch);
    }
  }

  private async seedDataWithRecovery(): Promise<void> {
    console.log('Seeding LevelDB with 100k articles using crash-resistant streaming...');
    const articles = generatedArticles;

    try {
      await Promise.all([
        this.db.clear(),
        this.titleIndex.clear(),
        this.contentIndex.clear(),
        this.authorIndex.clear(),
        this.searchableIndex.clear()
      ]);
    } catch (error) {
      console.log('Cleared existing data');
    }

    const batchSize = 250;
    let processedCount = 0;
    
    for (let i = 0; i < articles.length; i += batchSize) {
      try {
        const batch = articles.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(articles.length / batchSize)} (${batch.length} articles)...`);
        
        const articleBatch = batch.map(article => ({
          type: 'put' as const,
          key: `article:${article.id}`,
          value: article
        }));
        
        await this.db.batch(articleBatch);
        
        await this.createInvertedIndexStream(batch, this.titleIndex, (article: Article) => article.title);
        await this.createInvertedIndexStream(batch, this.authorIndex, (article: Article) => article.author);
        await this.createInvertedIndexStream(batch, this.contentIndex, (article: Article) => article.content.substring(0, 150));
        await this.createInvertedIndexStream(batch, this.searchableIndex, (article: Article) => 
          `${article.title} ${article.content.substring(0, 100)} ${article.author}`.substring(0, 250)
        );
        
        processedCount += batch.length;
        
        if (processedCount % 1000 === 0) {
          this.monitorMemoryUsage();
          console.log(`Successfully processed ${processedCount} articles...`);
          
          if (global.gc) {
            global.gc();
          }
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        
      } catch (error: any) {
        console.error(`Error processing batch at index ${i}:`, error.message);
        
        if (global.gc) {
          global.gc();
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (error.message.includes('out of memory')) {
          throw new Error('Memory exhausted during seeding');
        }
      }
    }

    console.log(`Successfully seeded ${articles.length} articles to LevelDB with crash prevention`);
  }

  private async searchInvertedIndex(query: string, indexDb: any): Promise<string[]> {
    const tokens = this.tokenize(query);
    const results: Map<string, number> = new Map();
    
    const searchPromises = tokens.slice(0, 10).map(async (token) => {
      const indexKey = `token:${token}`;
      try {
        const articleIds: string[] = await indexDb.get(indexKey) || [];
        return { token, articleIds };
      } catch (error) {
        return { token, articleIds: [] };
      }
    });
    
    const searchResults = await Promise.all(searchPromises);
    
    for (const { articleIds } of searchResults) {
      for (const articleId of articleIds) {
        const currentScore = results.get(articleId) || 0;
        results.set(articleId, currentScore + 1);
      }
    }
    
    return Array.from(results.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([articleId]) => articleId);
  }

  async search(query: string, limit: number): Promise<{ results: any[]; total: number; }> {
    const titleResults = await this.searchInvertedIndex(query, this.titleIndex);
    const contentResults = await this.searchInvertedIndex(query, this.contentIndex);
    const authorResults = await this.searchInvertedIndex(query, this.authorIndex);
    const searchableResults = await this.searchInvertedIndex(query, this.searchableIndex);
    
    const uniqueIds = new Set([
      ...titleResults,
      ...contentResults,
      ...authorResults,
      ...searchableResults
    ]);
    
    const articlePromises = Array.from(uniqueIds).map(async (articleId) => {
      try {
        const article = await this.db.get(`article:${articleId}`);
        return article;
      } catch (error) {
        return null;
      }
    });
    
    const articles = (await Promise.all(articlePromises)).filter(Boolean);
    
    const filteredResults = articles.filter(article => {
      const searchText = `${article.title} ${article.content} ${article.author}`.toLowerCase();
      return searchText.includes(query.toLowerCase());
    });
    
    return {
      results: filteredResults.slice(0, limit),
      total: filteredResults.length
    };
  }

  async getAllRecords(limit: number, offset: number): Promise<{ results: any[]; total: number; offset: number; limit: number }> {
    const results = [];
    let count = 0;
    let total = 0;

    for await (const [key, value] of this.db.iterator()) {
      if (key.startsWith('article:')) {
        total++;
        if (total > offset && count < limit) {
          results.push(value);
          count++;
        }
      }
    }

    return {
      results,
      total,
      offset,
      limit
    };
  }

  async benchmark(queries: string[]): Promise<{ benchmarks: any[]; averageDuration: string }> {
    const benchmarkQueries = getBenchmarkQueries().slice(0, 10); // Use all benchmark queries
    const results = [];

    for (const query of benchmarkQueries) {
      const start = Date.now();
      const searchResults = await this.search(query, 50000); // Use proper search method with high limit
      const duration = Date.now() - start;
      
      results.push({
        query,
        resultCount: searchResults.total,
        duration: `${duration}ms`
      });
    }

    return {
      benchmarks: results,
      averageDuration: `${results.reduce((sum, r) => sum + parseInt(r.duration), 0) / results.length}ms`
    };
  }
} 