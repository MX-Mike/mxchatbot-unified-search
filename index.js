require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Configuration
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.MXCHATBOT_API_KEY || 'dev-key-12345';

// Zendesk configuration
const ZENDESK_BASE = `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`;
const ZENDESK_AUTH = Buffer.from(`${process.env.ZENDESK_EMAIL}/token:${process.env.ZENDESK_API_TOKEN}`).toString('base64');

/**
 * AUTHENTICATION MIDDLEWARE
 * Validates API key for secure access to unified search
 */
function authenticateApiKey(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization header. Use: Authorization: Bearer YOUR_API_KEY'
    });
  }
  
  const providedKey = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  if (providedKey !== API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key'
    });
  }
  
  next();
}

/**
 * UNIFIED SEARCH ENDPOINT
 * Searches across multiple knowledge sources and returns unified results
 * 
 * @route POST /api/search/unified
 * @param {string} query - Search query
 * @param {number} [limit=10] - Maximum results to return
 * @param {object} [filters] - Optional search filters
 * @param {string[]} [sources] - Specific sources to search
 * @returns {object} Unified search results with relevance scoring
 */
app.post('/api/search/unified', authenticateApiKey, async (req, res) => {
  try {
    const { 
      query, 
      limit = 10, 
      filters = {}, 
      sources = ['zendesk', 'docs', 'knowledge_base'],
      include_snippets = true,
      sort_by = 'relevance'
    } = req.body;
    
    console.log('🔍 Unified search request:', {
      query,
      limit,
      sources: sources.length,
      timestamp: new Date().toISOString()
    });
    
    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 2 characters long',
        query: query || ''
      });
    }
    
    const searchPromises = [];
    const enabledSources = [];
    
    // Search Zendesk Help Center
    if (sources.includes('zendesk')) {
      enabledSources.push('zendesk');
      searchPromises.push(searchZendesk(query, Math.ceil(limit * 0.4))); // 40% of results from Zendesk
    }
    
    // Search Documentation (simulated)
    if (sources.includes('docs')) {
      enabledSources.push('docs');
      searchPromises.push(searchDocumentation(query, Math.ceil(limit * 0.3))); // 30% from docs
    }
    
    // Search Knowledge Base (simulated)
    if (sources.includes('knowledge_base')) {
      enabledSources.push('knowledge_base');
      searchPromises.push(searchKnowledgeBase(query, Math.ceil(limit * 0.3))); // 30% from KB
    }
    
    // Execute all searches in parallel
    const searchResults = await Promise.allSettled(searchPromises);
    
    // Combine and process results
    let allResults = [];
    
    searchResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        allResults = allResults.concat(result.value);
        console.log(`✅ ${enabledSources[index]} search: ${result.value.length} results`);
      } else {
        console.log(`⚠️ ${enabledSources[index]} search failed:`, result.reason?.message || 'Unknown error');
      }
    });
    
    // Rank and filter results
    const rankedResults = rankResults(allResults, query);
    const finalResults = rankedResults.slice(0, limit);
    
    console.log(`🎯 Unified search completed: ${finalResults.length} results from ${enabledSources.length} sources`);
    
    // Return unified response
    res.json({
      success: true,
      results: finalResults,
      total: allResults.length,
      returned: finalResults.length,
      query: query.trim(),
      sources: enabledSources,
      timestamp: new Date().toISOString(),
      api_version: 'unified_v1'
    });
    
  } catch (error) {
    console.error('❌ Unified search error:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Unified search service error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * SEARCH ZENDESK HELP CENTER
 * Searches Zendesk articles and returns standardized results
 */
async function searchZendesk(query, limit = 5) {
  try {
    const response = await axios.get(
      `${ZENDESK_BASE}/help_center/articles/search.json`,
      {
        params: {
          query: query.trim(),
          locale: 'en-us',
          per_page: limit
        },
        headers: {
          Authorization: `Basic ${ZENDESK_AUTH}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }
    );
    
    return response.data.results.map(article => ({
      id: `zendesk_${article.id}`,
      title: article.title,
      url: article.html_url,
      snippet: stripHtmlAndCreateSnippet(article.body, 200),
      content: article.body,
      score: article.score || 0,
      source: 'zendesk',
      category: article.section_id ? `Section ${article.section_id}` : null,
      section: article.section_id,
      last_updated: article.updated_at,
      metadata: {
        locale: article.locale,
        created_at: article.created_at,
        article_id: article.id
      }
    }));
    
  } catch (error) {
    console.error('Zendesk search error:', error.message);
    return [];
  }
}

/**
 * SEARCH DOCUMENTATION
 * Uses real Docusaurus search index from help.getmaintainx.com
 * Searches through the actual documentation site content
 */
async function searchDocumentation(query, limit = 3) {
  try {
    console.log(`🔍 Searching Docusaurus documentation for: "${query}"`);
    
    // Fetch the Docusaurus search index
    const indexResponse = await axios.get(
      'https://help.getmaintainx.com/search-index.json',
      {
        timeout: 5000,
        headers: {
          'User-Agent': 'MXchatbot-UnifiedSearch/1.0'
        }
      }
    );
    
    if (!indexResponse.data || !Array.isArray(indexResponse.data)) {
      console.warn('Invalid Docusaurus search index format');
      return [];
    }
    
    const searchIndex = indexResponse.data[0]; // Get the first search index
    if (!searchIndex || !searchIndex.documents) {
      console.warn('No documents found in Docusaurus search index');
      return [];
    }
    
    // Search through documents
    const queryLower = query.toLowerCase().trim();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
    
    const results = [];
    
    searchIndex.documents.forEach(doc => {
      if (!doc.t || !doc.u) return; // Skip docs without title or URL
      
      const titleLower = doc.t.toLowerCase();
      const breadcrumbText = doc.b ? doc.b.join(' ').toLowerCase() : '';
      
      let score = 0;
      
      // Check for exact phrase match in title (highest priority)
      if (titleLower.includes(queryLower)) {
        score += 100;
      }
      
      // Check for exact phrase match in breadcrumbs
      if (breadcrumbText.includes(queryLower)) {
        score += 50;
      }
      
      // Check for individual word matches
      queryWords.forEach(word => {
        if (titleLower.includes(word)) {
          score += 20;
        }
        if (breadcrumbText.includes(word)) {
          score += 10;
        }
      });
      
      // Only include if we have some relevance
      if (score > 0) {
        results.push({
          id: `docs_${doc.i}`,
          title: doc.t,
          url: `https://help.getmaintainx.com${doc.u}`,
          snippet: `${doc.b ? doc.b.join(' › ') : 'Documentation'} - ${doc.t}`,
          content: `${doc.t} - ${doc.b ? doc.b.join(', ') : ''}`,
          score: score * 0.9, // Slightly lower than Zendesk results
          source: 'docs',
          category: doc.b && doc.b.length > 0 ? doc.b[0] : 'Documentation',
          section: doc.b && doc.b.length > 1 ? doc.b[1] : null,
          last_updated: new Date().toISOString(), // Docusaurus doesn't provide timestamps
          metadata: {
            breadcrumbs: doc.b || [],
            docusaurus_id: doc.i,
            search_type: 'docusaurus'
          }
        });
      }
    });
    
    // Sort by score and limit results
    results.sort((a, b) => b.score - a.score);
    const limitedResults = results.slice(0, limit);
    
    console.log(`✅ Docusaurus search found ${limitedResults.length} results`);
    return limitedResults;
    
  } catch (error) {
    console.error('Docusaurus documentation search error:', error.message);
    return [];
  }
}

/**
 * SEARCH KNOWLEDGE BASE
 * Uses Zendesk API to search for FAQ and knowledge base style articles
 * Focuses on articles tagged with troubleshooting, FAQ, or how-to content
 */
async function searchKnowledgeBase(query, limit = 3) {
  try {
    // Search Zendesk with focus on FAQ and troubleshooting content
    const response = await axios.get(
      `${ZENDESK_BASE}/help_center/articles/search.json`,
      {
        params: {
          query: `${query.trim()} (FAQ OR troubleshooting OR "how to" OR problem OR issue OR error)`,
          locale: 'en-us',
          per_page: limit
        },
        headers: {
          Authorization: `Basic ${ZENDESK_AUTH}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }
    );
    
    return response.data.results.map(article => ({
      id: `kb_${article.id}`,
      title: article.title,
      url: article.html_url,
      snippet: stripHtmlAndCreateSnippet(article.body, 200),
      content: article.body,
      score: (article.score || 0) * 0.8, // Lower priority than main Zendesk results
      source: 'knowledge_base',
      category: 'Knowledge Base',
      section: article.section_id,
      last_updated: article.updated_at,
      metadata: {
        locale: article.locale,
        created_at: article.created_at,
        article_id: article.id,
        search_type: 'knowledge_base'
      }
    }));
    
  } catch (error) {
    console.error('Knowledge base search error:', error.message);
    return [];
  }
}

/**
 * RESULT RANKING ALGORITHM
 * Ranks search results by relevance, recency, and source priority
 */
function rankResults(results, query) {
  const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
  
  return results.map(result => {
    let score = result.score || 0;
    
    // Boost score based on title matches
    const titleMatches = queryTerms.filter(term => 
      result.title.toLowerCase().includes(term)
    ).length;
    score += titleMatches * 20;
    
    // Boost score based on exact phrase matches
    if (result.title.toLowerCase().includes(query.toLowerCase())) {
      score += 30;
    }
    
    // Source priority boost
    const sourcePriority = {
      'zendesk': 10,
      'knowledge_base': 8,
      'docs': 6
    };
    score += sourcePriority[result.source] || 0;
    
    // Recency boost (more recent = higher score)
    if (result.last_updated) {
      const daysSinceUpdate = (new Date() - new Date(result.last_updated)) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 30) score += 5;
      if (daysSinceUpdate < 7) score += 10;
    }
    
    return { ...result, score };
  }).sort((a, b) => b.score - a.score);
}

/**
 * CALCULATE RELEVANCE SCORE
 * Simple relevance scoring for mock data
 */
function calculateRelevanceScore(item, query) {
  const queryLower = query.toLowerCase();
  const titleLower = item.title.toLowerCase();
  const contentLower = item.content.toLowerCase();
  
  let score = 0;
  
  // Title match
  if (titleLower.includes(queryLower)) score += 50;
  
  // Content match
  if (contentLower.includes(queryLower)) score += 25;
  
  // Word matches
  const queryWords = queryLower.split(' ');
  queryWords.forEach(word => {
    if (word.length > 2) {
      if (titleLower.includes(word)) score += 10;
      if (contentLower.includes(word)) score += 5;
    }
  });
  
  return Math.min(score, 100); // Cap at 100
}

/**
 * UTILITY: Strip HTML and create snippet
 */
function stripHtmlAndCreateSnippet(htmlText, maxLength = 200) {
  if (!htmlText || typeof htmlText !== 'string') {
    return 'No preview available';
  }
  
  let cleanText = htmlText
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  
  if (cleanText.length > maxLength) {
    const truncated = cleanText.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > maxLength * 0.7) {
      cleanText = truncated.substring(0, lastSpaceIndex) + '...';
    } else {
      cleanText = truncated + '...';
    }
  }
  
  return cleanText || 'No preview available';
}

/**
 * HEALTH CHECK ENDPOINT
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'MXchatbot Unified Search',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    sources: {
      zendesk: !!process.env.ZENDESK_SUBDOMAIN,
      docs: true, // Simulated
      knowledge_base: true // Simulated
    }
  });
});

/**
 * ROOT ENDPOINT
 */
app.get('/', (req, res) => {
  res.json({
    service: 'MXchatbot Unified Search API',
    version: '1.0.0',
    status: 'Running',
    endpoints: [
      'POST /api/search/unified - Unified search across all sources',
      'GET /health - Health check'
    ],
    authentication: 'Bearer token required for /api/ endpoints'
  });
});

/**
 * START SERVER
 */
app.listen(PORT, () => {
  console.log(`
🚀 MXchatbot Unified Search API Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Server: http://localhost:${PORT}
🔑 API Key: ${API_KEY}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Available Sources:
   ✅ Zendesk Help Center (${process.env.ZENDESK_SUBDOMAIN || 'NOT_CONFIGURED'})
   ✅ Docusaurus Documentation (help.getmaintainx.com)
   ✅ Knowledge Base (Simulated)

🔍 Unified Search Features:
   • Multi-source parallel search
   • Relevance-based ranking
   • Source prioritization
   • Secure API key authentication
   • Rate limiting protection

Ready for unified search requests! 🔍
  `);
});
