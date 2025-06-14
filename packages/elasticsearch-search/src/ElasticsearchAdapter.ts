import { Client } from '@elastic/elasticsearch';
import { DatabaseAdapter } from 'search-framework';
import { seedData as generatedArticles } from 'shared-utils';

export class ElasticsearchAdapter implements DatabaseAdapter {
  public readonly name = 'Elasticsearch';
  private client!: Client;
  private indexName = 'articles';

  async initialize(): Promise<void> {
    this.client = new Client({
      node: 'http://elasticsearch:9200'
    });

    await this.client.indices.delete({ index: this.indexName }).catch(() => {});

    await this.client.indices.create({
      index: this.indexName,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          max_result_window: 2147483647,
          "index.max_result_window": 2147483647,
          analysis: {
            analyzer: {
              article_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: [
                  'lowercase',
                  'stop',
                  'snowball'
                ]
              }
            }
          }
        },
        mappings: {
          properties: {
            id: { type: 'integer' },
            title: { 
              type: 'text',
              analyzer: 'article_analyzer',
              fields: {
                keyword: { type: 'keyword' },
                suggest: { type: 'completion' }
              }
            },
            content: { 
              type: 'text',
              analyzer: 'article_analyzer'
            },
            author: { 
              type: 'text',
              analyzer: 'article_analyzer',
              fields: {
                keyword: { type: 'keyword' }
              }
            },
            tags: { 
              type: 'keyword'
            },
            searchable_text: {
              type: 'text',
              analyzer: 'article_analyzer'
            },
            difficulty: { type: 'keyword' },
            type: { type: 'keyword' },
            readTime: { type: 'integer' },
            publishDate: { type: 'date' },
            views: { type: 'integer' },
            rating: { type: 'float' },
            created_at: { type: 'date' }
          }
        }
      }
    });

    console.log('Elasticsearch index created with unlimited result window');
    await this.seedData();
  }

  private async seedData(): Promise<void> {
    console.log('Seeding Elasticsearch with 100k articles...');
    const articles = generatedArticles;

    const batchSize = 1000;
    
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      
      const body = batch.flatMap(article => [
        { index: { _index: this.indexName, _id: article.id } },
        {
          ...article,
          id: parseInt(article.id),
          difficulty: (article as any).difficulty || 'beginner',
          type: (article as any).type || 'article',
          readTime: (article as any).readTime || 5,
          publishDate: (article as any).publishDate || '2023-01-01',
          views: (article as any).views || 1000,
          rating: (article as any).rating || 4.0,
          searchable_text: `${article.title} ${article.content} ${article.author} ${article.tags.join(' ')}`,
          created_at: new Date()
        }
      ]);

      await this.client.bulk({ body });
      
      if ((i + batchSize) % 100000 === 0) {
        console.log(`Indexed ${Math.min(i + batchSize, articles.length)} articles...`);
      }
    }

    await this.client.indices.refresh({ index: this.indexName });
    console.log(`Seeded ${articles.length} articles to Elasticsearch with enhanced features`);
  }

  async search(query: string, limit: number): Promise<{ results: any[]; total: number }> {
    const effectiveLimit = Math.min(limit, 100);
    
    const response = await this.client.search({
      index: this.indexName,
      body: {
        query: {
          multi_match: {
            query,
            fields: ['title^3', 'content', 'author^2', 'tags'],
            type: 'best_fields'
          }
        },
        size: effectiveLimit,
        track_total_hits: true
      }
    });

    const results = (response.hits?.hits || []).map((hit: any) => hit._source);
    const total = (response.hits?.total as any)?.value || response.hits?.total || 0;

    return {
      results,
      total
    };
  }

  async getAllRecords(limit: number, offset: number): Promise<{ results: any[]; total: number; offset: number; limit: number }> {
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

    const response = await this.client.search({
      index: this.indexName,
      body: {
        query: { match_all: {} },
        from: offset,
        size: effectiveLimit,
        sort: [{ id: 'asc' }],
        track_total_hits: true
      }
    });

    const results = (response.hits?.hits || []).map((hit: any) => hit._source);

    return {
      results,
      total,
      offset,
      limit: effectiveLimit
    };
  }

  private async getFastCount(): Promise<number> {
    try {
      const response = await this.client.count({
        index: this.indexName
      });
      return response.count || 0;
    } catch (error) {
      console.warn('Fast count failed, falling back to search count:', error);
      try {
        const response = await this.client.search({
          index: this.indexName,
          body: {
            query: { match_all: {} },
            size: 0,
            track_total_hits: true
          }
        });
        return (response.hits?.total as any)?.value || response.hits?.total || 0;
      } catch (error) {
        console.warn('Fallback count failed:', error);
        return 0;
      }
    }
  }

  public searchVariants = {
    phrase: async (query: string, limit: number) => {
      const effectiveLimit = Math.min(limit, 100);
      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            multi_match: {
              query,
              fields: ['title^2', 'content', 'author'],
              type: 'phrase'
            }
          },
          size: effectiveLimit,
          track_total_hits: true
        }
      });

      const results = response.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...(hit._source || {})
      }));

      const total = (response.hits?.total as any)?.value || response.hits?.total || 0;

      return { results, total };
    },

    bool: async (query: string, limit: number) => {
      const effectiveLimit = Math.min(limit, 100);
      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            bool: {
              should: [
                { match: { title: { query, boost: 2 } } },
                { match: { content: query } },
                { match: { author: query } }
              ]
            }
          },
          size: effectiveLimit,
          track_total_hits: true
        }
      });

      const results = response.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...(hit._source || {})
      }));

      const total = (response.hits?.total as any)?.value || response.hits?.total || 0;

      return { results, total };
    }
  };
} 