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
    this.db = new Level('./data', { valueEncoding: 'json' });
    this.titleIndex = new Level('./data/title-index', { valueEncoding: 'json' });
    this.contentIndex = new Level('./data/content-index', { valueEncoding: 'json' });
    this.authorIndex = new Level('./data/author-index', { valueEncoding: 'json' });
    this.searchableIndex = new Level('./data/searchable-index', { valueEncoding: 'json' });

    await this.seedData();
    console.log('LevelDB database initialized with enhanced indexing');
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  private async createInvertedIndex(field: string, text: string, articleId: string, indexDb: any): Promise<void> {
    const tokens = this.tokenize(text);
    
    for (const token of tokens) {
      const indexKey = `token:${token}`;
      let existingIds: string[] = [];
      
      try {
        existingIds = await indexDb.get(indexKey) || [];
      } catch (error) {
        // Key doesn't exist yet
      }
      
      if (!existingIds.includes(articleId)) {
        existingIds.push(articleId);
        await indexDb.put(indexKey, existingIds);
      }
    }
  }

  private async searchInvertedIndex(query: string, indexDb: any): Promise<string[]> {
    const tokens = this.tokenize(query);
    const results: Map<string, number> = new Map();
    
    for (const token of tokens) {
      const indexKey = `token:${token}`;
      try {
        const articleIds: string[] = await indexDb.get(indexKey) || [];
        for (const id of articleIds) {
          results.set(id, (results.get(id) || 0) + 1);
        }
      } catch (error) {
        // Token not found in index
      }
    }
    
    return Array.from(results.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
  }

  private async seedData(): Promise<void> {
    console.log('Seeding LevelDB with 100k articles and building inverted indexes...');
    const articles = generatedArticles;

    await this.db.clear();
    await this.titleIndex.clear();
    await this.contentIndex.clear();
    await this.authorIndex.clear();
    await this.searchableIndex.clear();

    const batchSize = 1000;
    
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      
      for (const article of batch) {
        await this.db.put(`article:${article.id}`, article);
      }
      
      for (const article of batch) {
        const searchableText = `${article.title} ${article.content} ${article.author} ${article.tags.join(' ')}`;
        
        await Promise.all([
          this.createInvertedIndex('title', article.title, article.id, this.titleIndex),
          this.createInvertedIndex('content', article.content, article.id, this.contentIndex),
          this.createInvertedIndex('author', article.author, article.id, this.authorIndex),
          this.createInvertedIndex('searchable', searchableText, article.id, this.searchableIndex)
        ]);
      }
      
      if ((i + batchSize) % 10000 === 0) {
        console.log(`Processed ${Math.min(i + batchSize, articles.length)} articles...`);
      }
    }

    console.log(`Seeded ${articles.length} articles to LevelDB with optimized inverted indexes`);
  }

  async search(query: string, limit: number): Promise<{ results: any[]; total: number }> {
    const [titleResults, contentResults, authorResults, searchableResults] = await Promise.all([
      this.searchInvertedIndex(query, this.titleIndex),
      this.searchInvertedIndex(query, this.contentIndex),
      this.searchInvertedIndex(query, this.authorIndex),
      this.searchInvertedIndex(query, this.searchableIndex)
    ]);
    
    const scoreMap = new Map<string, number>();
    
    titleResults.forEach((id, index) => {
      scoreMap.set(id, (scoreMap.get(id) || 0) + (10 * (titleResults.length - index)));
    });
    
    contentResults.forEach((id, index) => {
      scoreMap.set(id, (scoreMap.get(id) || 0) + (5 * (contentResults.length - index)));
    });
    
    authorResults.forEach((id, index) => {
      scoreMap.set(id, (scoreMap.get(id) || 0) + (8 * (authorResults.length - index)));
    });
    
    searchableResults.forEach((id, index) => {
      scoreMap.set(id, (scoreMap.get(id) || 0) + (1 * (searchableResults.length - index)));
    });
    
    const totalCount = scoreMap.size;
    
    const sortedResults = Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
    
    const results = [];
    for (const [articleId, score] of sortedResults) {
      try {
        const article = await this.db.get(`article:${articleId}`) as unknown as Article;
        results.push({ ...(article as any), relevanceScore: score });
      } catch (error) {
        // Article not found, skip
      }
    }

    return {
      results,
      total: totalCount
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
    const benchmarkQueries = getBenchmarkQueries();
    const results = [];

    for (const query of benchmarkQueries) {
      const start = Date.now();
      const searchResults = await this.searchInvertedIndex(query, this.searchableIndex);
      const duration = Date.now() - start;
      
      results.push({
        query,
        resultCount: searchResults.length,
        duration: `${duration}ms`
      });
    }

    return {
      benchmarks: results,
      averageDuration: `${results.reduce((sum, r) => sum + parseInt(r.duration), 0) / results.length}ms`
    };
  }
} 