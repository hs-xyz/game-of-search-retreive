import { MongoClient } from 'mongodb';
import { DatabaseAdapter } from 'search-framework';
import { seedData as generatedArticles, getBenchmarkQueries } from 'shared-utils';

export class MongoDBAdapter implements DatabaseAdapter {
  public readonly name = 'MongoDB';
  private client!: MongoClient;
  private db: any;
  private collection: any;

  async initialize(): Promise<void> {
    const uri = 'mongodb://admin:mongo123@mongodb:27017/fulltext_db?authSource=admin';
    this.client = new MongoClient(uri);
    
    await this.client.connect();
    console.log('Connected to MongoDB');
    
    this.db = this.client.db('fulltext_db');
    this.collection = this.db.collection('articles');
    
    try {
      await this.collection.dropIndexes();
      console.log('Dropped existing indexes');
    } catch (error) {
      console.log('No indexes to drop or error dropping indexes:', error);
    }
    
    await this.collection.createIndex({
      title: 'text',
      content: 'text',
      author: 'text',
      searchable_text: 'text'
    }, {
      weights: {
        title: 10,
        content: 1,
        author: 5,
        searchable_text: 2
      },
      name: 'comprehensive_text_index'
    });
    
    await this.collection.createIndex({ title: 1 });
    await this.collection.createIndex({ author: 1 });
    
    console.log('Comprehensive text index created with weights');
    await this.seedData();
  }

  private async seedData(): Promise<void> {
    console.log('Seeding MongoDB with 100k articles...');
    const articles = generatedArticles;

    await this.collection.deleteMany({});
    
    const articlesWithSearchableText = articles.map(article => ({
      ...article,
      searchable_text: `${article.title} ${article.content} ${article.author} ${article.tags.join(' ')}`
    }));

    await this.collection.insertMany(articlesWithSearchableText);
    console.log(`Seeded ${articles.length} articles to MongoDB with enhanced search fields`);
  }

  async search(query: string, limit: number): Promise<{ results: any[]; total: number; }> {
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    
    const wordConditions = queryWords.map(word => {
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundaryRegex = new RegExp(`\\b${escapedWord}\\b`, 'i');
      
      return {
        $or: [
          { title: { $regex: wordBoundaryRegex } },
          { content: { $regex: wordBoundaryRegex } },
          { author: { $regex: wordBoundaryRegex } },
          { searchable_text: { $regex: wordBoundaryRegex } }
        ]
      };
    });

    const searchCondition = wordConditions.length === 1 
      ? wordConditions[0] 
      : { $and: wordConditions };

    const results = await this.collection.find(searchCondition)
      .limit(limit)
      .toArray();

    const total = await this.collection.countDocuments(searchCondition);

    return {
      results,
      total
    };
  }

  async getAllRecords(limit: number, offset: number): Promise<{ results: any[]; total: number; offset: number; limit: number }> {
    const total = await this.collection.countDocuments();
    const results = await this.collection.find()
      .skip(offset)
      .limit(limit)
      .toArray();

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
      const searchResult = await this.search(query, 50000);
      const duration = Date.now() - start;
      
      results.push({
        query,
        resultCount: searchResult.total,
        duration: `${duration}ms`
      });
    }

    return {
      benchmarks: results,
      averageDuration: `${results.reduce((sum, r) => sum + parseInt(r.duration), 0) / results.length}ms`
    };
  }

  public searchVariants = {
    regex: async (query: string, limit: number) => {
      const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 0);
      
      const regexQueries = queryWords.map(word => ({
        $or: [
          { title: { $regex: word, $options: 'i' } },
          { content: { $regex: word, $options: 'i' } },
          { author: { $regex: word, $options: 'i' } },
          { searchable_text: { $regex: word, $options: 'i' } }
        ]
      }));

      const searchQuery = { $and: regexQueries };
      const total = await this.collection.countDocuments(searchQuery);
      const results = await this.collection
        .find(searchQuery)
        .limit(limit)
        .toArray();

      return { results, total };
    }
  };
} 