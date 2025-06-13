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
          max_result_window: 200000,
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
            created_at: { type: 'date' }
          }
        }
      }
    });

    console.log('Elasticsearch index created with optimized mapping and increased max_result_window');
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
          searchable_text: `${article.title} ${article.content} ${article.author} ${article.tags.join(' ')}`,
          created_at: new Date()
        }
      ]);

      await this.client.bulk({ body });
      
      if ((i + batchSize) % 10000 === 0) {
        console.log(`Indexed ${Math.min(i + batchSize, articles.length)} articles...`);
      }
    }

    await this.client.indices.refresh({ index: this.indexName });
    console.log(`Seeded ${articles.length} articles to Elasticsearch with enhanced features`);
  }

  async search(query: string, limit: number): Promise<{ results: any[]; total: number; }> {
    const searchBody = {
      query: {
        bool: {
          should: [
            {
              match: {
                title: {
                  query: query,
                  operator: 'and' as const
                }
              }
            },
            {
              match: {
                content: {
                  query: query,
                  operator: 'and' as const
                }
              }
            },
            {
              match: {
                author: {
                  query: query,
                  operator: 'and' as const
                }
              }
            },
            {
              match: {
                searchable_text: {
                  query: query,
                  operator: 'and' as const
                }
              }
            }
          ],
          minimum_should_match: 1
        }
      },
      size: limit === 0 ? 0 : limit,
      track_total_hits: true,
      _source: ['id', 'title', 'content', 'author', 'tags']
    };

    const response = await this.client.search({
      index: 'articles',
      body: searchBody
    });

    const hits = response.hits.hits.map((hit: any) => hit._source);
    const total = typeof response.hits.total === 'object' 
      ? response.hits.total.value || 0
      : response.hits.total || 0;

    return {
      results: hits,
      total: total
    };
  }

  async getAllRecords(limit: number, offset: number): Promise<{ results: any[]; total: number; offset: number; limit: number }> {
    const response = await this.client.search({
      index: this.indexName,
      body: {
        query: { match_all: {} },
        from: offset,
        size: limit,
        sort: [{ id: 'asc' }],
        track_total_hits: true
      }
    });

    const results = (response.hits?.hits || []).map((hit: any) => hit._source);
    const total = (response.hits?.total as any)?.value || response.hits?.total || 0;

    return {
      results,
      total,
      offset,
      limit
    };
  }

  public searchVariants = {
    phrase: async (query: string, limit: number) => {
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
          size: limit
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
          size: limit
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