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

  async initialize(): Promise<void> {
    const dbOptions = {
      valueEncoding: 'json',
      writeBufferSize: 16 * 1024 * 1024, // 16MB
      cacheSize: 32 * 1024 * 1024, // 32MB cache
      maxOpenFiles: 2000,
      blockSize: 8192 // 8KB blocks
    };

    this.db = new Level('./data', dbOptions);
    this.titleIndex = new Level('./data/title-index', { valueEncoding: 'json', writeBufferSize: 8 * 1024 * 1024 });
    this.contentIndex = new Level('./data/content-index', { valueEncoding: 'json', writeBufferSize: 8 * 1024 * 1024 });
    this.authorIndex = new Level('./data/author-index', { valueEncoding: 'json', writeBufferSize: 4 * 1024 * 1024 });
    this.searchableIndex = new Level('./data/searchable-index', { valueEncoding: 'json', writeBufferSize: 8 * 1024 * 1024 });

    await this.seedData();
    console.log('LevelDB database initialized with optimized configuration');
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 20); // Limit tokens to prevent memory overflow
  }

  private async createInvertedIndexBatch(articles: Article[], indexDb: any, fieldExtractor: (article: Article) => string): Promise<void> {
    const tokenMap = new Map<string, Set<string>>();
    
    // Build token map in memory first
    for (const article of articles) {
      const text = fieldExtractor(article);
      const tokens = this.tokenize(text);
      
      for (const token of tokens) {
        if (!tokenMap.has(token)) {
          tokenMap.set(token, new Set());
        }
        tokenMap.get(token)!.add(article.id);
      }
    }
    
    // Batch write to database
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
        batch.push({ type: 'put', key: indexKey, value: allIds.slice(0, 500) }); // Limit to 500 IDs per token
        
        if (batch.length >= 100) {
          await indexDb.batch(batch.splice(0, 100));
        }
      } catch (error) {
        console.error(`Error processing token ${token}:`, error);
      }
    }
    
    if (batch.length > 0) {
      await indexDb.batch(batch);
    }
  }

  private async seedData(): Promise<void> {
    console.log('Seeding LevelDB with 100k articles using optimized batching...');
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

    // Smaller, sequential batches for better performance
    const batchSize = 1000;
    
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(articles.length / batchSize)} (${batch.length} articles)...`);
      
      // Store articles first
      const articleBatch = batch.map(article => ({
        type: 'put' as const,
        key: `article:${article.id}`,
        value: article
      }));
      
      await this.db.batch(articleBatch);
      
      // Create indexes for this batch sequentially
      await this.createInvertedIndexBatch(batch, this.titleIndex, (article: Article) => article.title);
      await this.createInvertedIndexBatch(batch, this.authorIndex, (article: Article) => article.author);
      await this.createInvertedIndexBatch(batch, this.contentIndex, (article: Article) => article.content.substring(0, 200)); // Limit content
      await this.createInvertedIndexBatch(batch, this.searchableIndex, (article: Article) => 
        `${article.title} ${article.content.substring(0, 100)} ${article.author}`.substring(0, 300)
      );
      
      if ((i + batchSize) % 5000 === 0) {
        console.log(`Processed ${Math.min(i + batchSize, articles.length)} articles...`);
        await new Promise(resolve => setTimeout(resolve, 50)); // Small pause
      }
    }

    console.log(`Seeded ${articles.length} articles to LevelDB with optimized batching`);
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
    const allResults: any[] = [];
    
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
    
    const articlePromises = Array.from(uniqueIds).slice(0, Math.max(limit, 1000)).map(async (articleId) => {
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