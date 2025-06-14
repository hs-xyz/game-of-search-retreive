export interface Article {
  id: string;
  title: string;
  content: string;
  author: string;
  tags: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  type?: 'article' | 'tutorial' | 'research' | 'guide' | 'analysis';
  readTime?: number;
  publishDate?: string;
  views?: number;
  rating?: number;
}

export interface RedisArticle extends Omit<Article, 'tags'> {
  tags: string;
}

export interface BenchmarkQuery {
  query: string;
  category: string;
  description: string;
  expectedResults: 'low' | 'medium' | 'high';
}

const contentTypes = ['article', 'tutorial', 'research', 'guide', 'analysis'];
const difficulties = ['beginner', 'intermediate', 'advanced'];

const titlePrefixes = [
  'Introduction to', 'Advanced', 'Understanding', 'Mastering', 'Deep Dive into',
  'Complete Guide to', 'Best Practices for', 'Fundamentals of', 'Modern', 'Building',
  'Exploring', 'Comprehensive', 'Essential', 'Professional', 'Practical',
  'Ultimate', 'Effective', 'Optimizing', 'Implementing', 'Designing'
];

const subjects = [
  'Machine Learning', 'Database Design', 'Web Development', 'Cloud Computing',
  'Data Structures', 'Algorithms', 'Software Architecture', 'DevOps',
  'Artificial Intelligence', 'Cybersecurity', 'Mobile Development',
  'Frontend Frameworks', 'Backend Systems', 'Microservices', 'Performance Optimization',
  'Blockchain Technology', 'Data Science', 'Quantum Computing', 'Internet of Things',
  'Augmented Reality', 'Virtual Reality', 'Computer Vision', 'Natural Language Processing',
  'API Development', 'System Design', 'Network Security', 'Distributed Systems',
  'Container Orchestration', 'Serverless Computing', 'Edge Computing', 'Robotics',
  'Game Development', 'Embedded Systems', 'Bioinformatics', 'Fintech Solutions'
];

const techTerms = [
  'scalability', 'performance', 'optimization', 'architecture', 'framework',
  'infrastructure', 'deployment', 'monitoring', 'analytics', 'automation',
  'integration', 'testing', 'debugging', 'refactoring', 'documentation',
  'encryption', 'authentication', 'authorization', 'networking', 'protocols'
];

const businessTerms = [
  'productivity', 'efficiency', 'workflow', 'strategy', 'innovation',
  'transformation', 'methodology', 'best practices', 'implementation',
  'solution', 'enterprise', 'startup', 'agile', 'collaboration'
];

const contentTemplates = [
  'This comprehensive exploration delves into the fundamental concepts and practical applications that define modern software development practices. We examine cutting-edge methodologies and their real-world implementations across various industry sectors.',
  
  'A detailed technical analysis covering advanced techniques and optimization strategies used by leading technology companies. This guide provides actionable insights for enterprise-level implementations and scalable solutions.',
  
  'Understanding the core principles behind this technology requires a systematic approach to learning and implementation. We break down complex concepts into manageable components with practical examples and case studies.',
  
  'This in-depth investigation examines the latest trends and emerging patterns in software engineering. We analyze performance metrics, architectural decisions, and their impact on system reliability and maintainability.',
  
  'A practical handbook for developers and architects focusing on real-world problem-solving techniques. This resource combines theoretical foundations with hands-on examples from successful industry projects.',
  
  'Exploring advanced methodologies and frameworks that enable robust, scalable solutions in distributed environments. We cover design patterns, implementation strategies, and performance optimization techniques.',
  
  'This technical deep-dive provides comprehensive coverage of modern development practices and their applications in complex enterprise environments. Includes detailed examples and benchmarking data.',
  
  'An extensive analysis of current trends and future directions in technology innovation. We examine emerging paradigms and their potential impact on software development practices.',
  
  'This professional guide covers essential concepts and advanced techniques for building high-performance applications. Includes practical examples, code samples, and performance optimization strategies.',
  
  'A systematic approach to understanding and implementing cutting-edge technologies in production environments. This resource provides detailed technical specifications and implementation guidelines.',
  
  'Comprehensive coverage of industry best practices and proven methodologies for large-scale software development. Includes case studies from successful enterprise implementations.',
  
  'This detailed examination explores the intersection of technology and business strategy, providing insights into successful digital transformation initiatives and their technical foundations.',
  
  'An advanced technical resource covering sophisticated algorithms, data structures, and their applications in modern computing environments. Includes performance analysis and optimization techniques.',
  
  'This practical guide demonstrates how to effectively leverage modern development tools and frameworks to build robust, maintainable software solutions with optimal performance characteristics.',
  
  'A thorough investigation of emerging technologies and their potential applications in solving complex computational problems. Includes technical specifications and implementation examples.'
];

const authors = [
  'Dr. Sarah Chen', 'Michael Rodriguez', 'Emily Watson', 'David Kim',
  'Dr. James Thompson', 'Maria Garcia', 'Alex Johnson', 'Dr. Lisa Park',
  'Robert Zhang', 'Jennifer Taylor', 'Dr. Ahmed Hassan', 'Sophie Turner',
  'Mark Williams', 'Dr. Anna Petrov', 'Carlos Silva', 'Rachel Green',
  'Dr. Hiroshi Tanaka', 'Olivia Brown', 'Nathan Cooper', 'Dr. Priya Sharma',
  'Lucas Martin', 'Dr. Elena Volkov', 'Jordan Lee', 'Dr. Samuel Adams',
  'Maya Patel', 'Dr. Thomas Weber', 'Isabella Cruz', 'Dr. Raj Kumar',
  'Ethan Miller', 'Dr. Fatima Al-Zahra', 'Grace Liu', 'Dr. Marco Rossi',
  'Zoe Anderson', 'Dr. Viktor Petrov', 'Austin Davis', 'Dr. Kenji Nakamura',
  'Chloe Wilson', 'Dr. Lars Eriksson', 'Cameron White', 'Dr. Yuki Sato'
];

const tagCategories = {
  technology: ['ml', 'ai', 'blockchain', 'iot', 'ar', 'vr', 'quantum', 'edge-computing'],
  programming: ['javascript', 'python', 'java', 'go', 'rust', 'typescript', 'kotlin', 'swift'],
  frameworks: ['react', 'angular', 'vue', 'django', 'spring', 'express', 'fastapi', 'flask'],
  databases: ['mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'neo4j', 'cassandra'],
  cloud: ['aws', 'azure', 'gcp', 'kubernetes', 'docker', 'terraform', 'serverless'],
  methods: ['agile', 'devops', 'cicd', 'tdd', 'bdd', 'microservices', 'api-first'],
  domains: ['fintech', 'healthcare', 'ecommerce', 'gaming', 'education', 'automotive'],
  concepts: ['performance', 'security', 'scalability', 'optimization', 'automation', 'monitoring']
};

const getAllTags = (): string[] => {
  return Object.values(tagCategories).flat();
};

const seededRandom = (seed: number): number => {
  let x = Math.sin(seed) * 100000;
  return x - Math.floor(x);
};

const seededChoice = <T>(array: T[], seed: number): T => {
  return array[Math.floor(seededRandom(seed) * array.length)];
};

const seededMultipleChoice = <T>(array: T[], seed: number, count: number): T[] => {
  const result: T[] = [];
  for (let i = 0; i < count; i++) {
    const item = seededChoice(array, seed + i);
    if (!result.includes(item)) {
      result.push(item);
    }
  }
  return result;
};

const generateEnhancedContent = (seed: number, difficulty: string, type: string): string => {
  const baseContent = seededChoice(contentTemplates, seed);
  const techTermCount = difficulty === 'advanced' ? 4 : difficulty === 'intermediate' ? 2 : 1;
  const businessTermCount = type === 'research' ? 1 : 2;
  
  const selectedTechTerms = seededMultipleChoice(techTerms, seed + 100, techTermCount);
  const selectedBusinessTerms = seededMultipleChoice(businessTerms, seed + 200, businessTermCount);
  
  let enhancedContent = baseContent;
  
  if (type === 'tutorial') {
    enhancedContent += ' This tutorial provides step-by-step instructions with practical examples and hands-on exercises.';
  } else if (type === 'research') {
    enhancedContent += ' This research presents empirical data and statistical analysis from comprehensive studies.';
  } else if (type === 'guide') {
    enhancedContent += ' This guide offers practical recommendations and proven strategies for implementation.';
  }
  
  enhancedContent += ` Key concepts include: ${selectedTechTerms.join(', ')}.`;
  enhancedContent += ` Business impact areas: ${selectedBusinessTerms.join(', ')}.`;
  
  if (difficulty === 'advanced') {
    enhancedContent += ' Advanced practitioners will find detailed technical specifications and performance optimization techniques.';
  } else if (difficulty === 'beginner') {
    enhancedContent += ' Designed for newcomers with clear explanations and foundational concepts.';
  }
  
  return enhancedContent;
};

const generateSmartTags = (title: string, content: string, seed: number): string[] => {
  const titleLower = title.toLowerCase();
  const contentLower = content.toLowerCase();
  const tags: string[] = [];
  
  Object.entries(tagCategories).forEach(([category, categoryTags]) => {
    categoryTags.forEach(tag => {
      if (titleLower.includes(tag) || contentLower.includes(tag)) {
        tags.push(tag);
      }
    });
  });
  
  const allTags = getAllTags();
  const additionalTags = seededMultipleChoice(allTags, seed, 2);
  tags.push(...additionalTags);
  
  return [...new Set(tags)].slice(0, 5);
};

const generateArticle = (index: number): Article => {
  const seed = index + 1;
  const difficulty = seededChoice(difficulties, seed * 2);
  const type = seededChoice(contentTypes, seed * 3);
  
  const titlePrefix = seededChoice(titlePrefixes, seed * 4);
  const subject = seededChoice(subjects, seed * 5);
  const title = `${titlePrefix} ${subject}`;
  
  const content = generateEnhancedContent(seed * 6, difficulty, type);
  const author = seededChoice(authors, seed * 7);
  
  const tags = generateSmartTags(title, content, seed * 8);
  
  const readTime = Math.floor(seededRandom(seed * 9) * 20) + 3;
  const views = Math.floor(seededRandom(seed * 10) * 100000) + 100;
  const rating = Math.round((seededRandom(seed * 11) * 2 + 3) * 10) / 10;
  
  const publishDate = new Date(2020 + Math.floor(seededRandom(seed * 12) * 4), 
                               Math.floor(seededRandom(seed * 13) * 12), 
                               Math.floor(seededRandom(seed * 14) * 28) + 1).toISOString().split('T')[0];

  return {
    id: (index + 1).toString(),
    title,
    content,
    author,
    tags,
    difficulty: difficulty as 'beginner' | 'intermediate' | 'advanced',
    type: type as 'article' | 'tutorial' | 'research' | 'guide' | 'analysis',
    readTime,
    publishDate,
    views,
    rating
  };
};

export const generateSeedData = (count: number = 1000000): Article[] => {
  return Array.from({ length: count }, (_, index) => generateArticle(index));
};

export const seedData = generateSeedData();

export const getRedisData = (): RedisArticle[] => {
  return seedData.map(article => ({
    ...article,
    tags: article.tags.join(',')
  }));
};

export const getClickHouseData = () => {
  return seedData.map(article => ({
    id: parseInt(article.id),
    title: article.title,
    content: article.content,
    author: article.author,
    tags: article.tags,
    difficulty: article.difficulty,
    type: article.type,
    readTime: article.readTime,
    publishDate: article.publishDate,
    views: article.views,
    rating: article.rating
  }));
};

export const getBenchmarkQueries = (): BenchmarkQuery[] => [
  // Single word queries - different frequency patterns
  { query: 'machine', category: 'single-word-common', description: 'Common single word', expectedResults: 'high' },
  { query: 'quantum', category: 'single-word-rare', description: 'Rare technical term', expectedResults: 'low' },
  { query: 'performance', category: 'single-word-common', description: 'Frequent technical term', expectedResults: 'high' },
  
  // Multi-word queries - phrase matching
  { query: 'machine learning', category: 'multi-word-common', description: 'Common tech phrase', expectedResults: 'medium' },
  { query: 'artificial intelligence', category: 'multi-word-common', description: 'Popular AI term', expectedResults: 'medium' },
  { query: 'cloud computing', category: 'multi-word-common', description: 'Infrastructure term', expectedResults: 'medium' },
  
  // Technical compound queries
  { query: 'database optimization performance', category: 'multi-word-technical', description: 'Technical multi-term', expectedResults: 'medium' },
  { query: 'kubernetes docker microservices', category: 'multi-word-technical', description: 'DevOps stack query', expectedResults: 'low' },
  
  // Author-based queries
  { query: 'Dr. Sarah Chen', category: 'author-search', description: 'Specific author search', expectedResults: 'low' },
  { query: 'Chen', category: 'author-partial', description: 'Partial author search', expectedResults: 'low' },
  
  // Long complex queries
  { query: 'advanced machine learning algorithms optimization scalability', category: 'complex-long', description: 'Complex technical query', expectedResults: 'low' },
  
  // Edge cases
  { query: 'javascript', category: 'programming-language', description: 'Programming language', expectedResults: 'medium' },
  { query: 'react angular vue', category: 'framework-comparison', description: 'Framework comparison', expectedResults: 'medium' },
  
  // Domain-specific
  { query: 'healthcare fintech', category: 'domain-specific', description: 'Industry domains', expectedResults: 'low' },
  { query: 'security encryption', category: 'security-focused', description: 'Security concepts', expectedResults: 'medium' },
  
  // Difficulty-based
  { query: 'beginner tutorial', category: 'difficulty-search', description: 'Beginner content search', expectedResults: 'medium' },
  { query: 'advanced guide', category: 'difficulty-search', description: 'Advanced content search', expectedResults: 'medium' },
  
  // Type-based
  { query: 'research analysis', category: 'type-search', description: 'Research content', expectedResults: 'medium' },
  
  // Trending tech
  { query: 'blockchain', category: 'trending-tech', description: 'Blockchain technology', expectedResults: 'low' },
  { query: 'serverless', category: 'trending-tech', description: 'Serverless computing', expectedResults: 'low' }
];

export const getRandomQuery = (): string => {
  const queries = getBenchmarkQueries();
  return queries[Math.floor(Math.random() * queries.length)].query;
};

export const calculateBenchmarkStats = (durations: number[]) => {
  if (durations.length === 0) {
    return {
      totalDuration: '0ms',
      averageDuration: '0ms',
      minDuration: '0ms',
      maxDuration: '0ms',
      medianDuration: '0ms',
      standardDeviation: '0ms',
      durations: []
    };
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const total = durations.reduce((sum, d) => sum + d, 0);
  const average = total / durations.length;
  const median = sorted.length % 2 === 0 
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  const variance = durations.reduce((sum, d) => sum + Math.pow(d - average, 2), 0) / durations.length;
  const standardDeviation = Math.sqrt(variance);

  return {
    totalDuration: `${total}ms`,
    averageDuration: `${Math.round(average)}ms`,
    minDuration: `${Math.min(...durations)}ms`,
    maxDuration: `${Math.max(...durations)}ms`,
    medianDuration: `${Math.round(median)}ms`,
    standardDeviation: `${Math.round(standardDeviation)}ms`,
    durations
  };
};

export const getBenchmarkCategories = (): string[] => {
  const queries = getBenchmarkQueries();
  return [...new Set(queries.map(q => q.category))];
};

export const getQueriesByCategory = (category: string): BenchmarkQuery[] => {
  return getBenchmarkQueries().filter(q => q.category === category);
}; 