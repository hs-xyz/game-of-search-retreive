import { MongoClient } from 'mongodb';
import { DatabaseAdapter } from 'search-framework';
import { seedData as generatedArticles } from 'shared-utils';

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
      difficulty: (article as any).difficulty || 'beginner',
      type: (article as any).type || 'article',
      readTime: (article as any).readTime || 5,
      publishDate: (article as any).publishDate || '2023-01-01',
      views: (article as any).views || 1000,
      rating: (article as any).rating || 4.0,
      searchable_text: `${article.title} ${article.content} ${article.author} ${article.tags.join(' ')}`
    }));

    await this.collection.insertMany(articlesWithSearchableText);
    console.log(`Seeded ${articles.length} articles to MongoDB with enhanced search fields`);
  }

  async search(query: string, limit: number): Promise<{ results: any[]; total: number; }> {
    const effectiveLimit = Math.min(limit, 100);
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
      .limit(effectiveLimit)
      .toArray();

    const total = await this.collection.countDocuments(searchCondition);

    return {
      results,
      total
    };
  }

  async getAllRecords(limit: number, offset: number): Promise<{ results: any[]; total: number; offset: number; limit: number }> {
    const effectiveLimit = Math.min(limit, 100);
    const total = await this.getFastCount();

    const documents = await this.collection.find({})
      .skip(offset)
      .limit(effectiveLimit)
      .toArray();

    return {
      results: documents.map((doc: any) => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        author: doc.author,
        tags: doc.tags,
        difficulty: doc.difficulty,
        type: doc.type,
        readTime: doc.readTime,
        publishDate: doc.publishDate,
        views: doc.views,
        rating: doc.rating
      })),
      total,
      offset,
      limit: effectiveLimit
    };
  }

  private async getFastCount(): Promise<number> {
    try {
      return await this.collection.estimatedDocumentCount();
    } catch (error) {
      console.warn('Fast count failed, falling back to accurate count:', error);
      try {
        return await this.collection.countDocuments({}, { hint: "_id_" });
      } catch (error) {
        console.warn('Accurate count with hint failed, using basic count:', error);
        return await this.collection.countDocuments({});
      }
    }
  }

  public searchVariants = {
    regex: async (query: string, limit: number) => {
      const effectiveLimit = Math.min(limit, 100);
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
        .limit(effectiveLimit)
        .toArray();

      return { results, total };
    }
  };
} 