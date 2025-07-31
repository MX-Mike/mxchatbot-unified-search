# MXchatbot Unified Search API

A powerful unified search service that aggregates results from multiple knowledge sources including Zendesk Help Center, documentation, and knowledge bases.

## 🚀 Features

- **Multi-Source Search**: Searches across Zendesk, docs, and knowledge bases simultaneously
- **Intelligent Ranking**: Advanced relevance scoring with source prioritization
- **Secure Authentication**: API key-based authentication
- **Rate Limiting**: Built-in protection against abuse
- **Parallel Processing**: Concurrent searches for optimal performance
- **Fallback Handling**: Graceful degradation when sources are unavailable

## 📦 Installation

```bash
# Navigate to the unified search directory
cd mxchatbot-unified-search

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your configuration
# Add your Zendesk credentials and generate an API key

# Start the server
npm start

# For development with auto-reload
npm run dev
```

## ⚙️ Configuration

### Required Environment Variables

```bash
# API Security
MXCHATBOT_API_KEY=your_secure_api_key_here

# Zendesk Configuration
ZENDESK_SUBDOMAIN=your-subdomain
ZENDESK_EMAIL=your-email@company.com
ZENDESK_API_TOKEN=your_zendesk_api_token

# Server Configuration
NODE_ENV=production
PORT=3001
```

### Generate API Key

For security, generate a strong API key:

```bash
# Option 1: Use Node.js crypto
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Use online generator
# Visit: https://generate-random.org/api-key-generator
```

## 🔗 API Endpoints

### POST /api/search/unified

Main unified search endpoint that searches across all configured sources.

**Authentication**: Bearer token required

**Request:**
```bash
curl -X POST http://localhost:3001/api/search/unified \
  -H "Authorization: Bearer your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "password reset",
    "limit": 10,
    "sources": ["zendesk", "docs", "knowledge_base"],
    "include_snippets": true,
    "sort_by": "relevance"
  }'
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "zendesk_123",
      "title": "How to Reset Your Password",
      "url": "https://help.company.com/articles/123",
      "snippet": "Step-by-step instructions for resetting...",
      "score": 95.5,
      "source": "zendesk",
      "category": "Account Management",
      "last_updated": "2025-07-01T14:30:00Z"
    }
  ],
  "total": 25,
  "returned": 10,
  "query": "password reset",
  "sources": ["zendesk", "docs", "knowledge_base"],
  "timestamp": "2025-07-31T11:30:00.000Z",
  "api_version": "unified_v1"
}
```

### GET /health

Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "OK",
  "service": "MXchatbot Unified Search",
  "version": "1.0.0",
  "sources": {
    "zendesk": true,
    "docs": true,
    "knowledge_base": true
  }
}
```

## 🏗️ Architecture

### Search Sources

1. **Zendesk Help Center** (Production Ready)
   - Real-time search via Zendesk API
   - Full text search with relevance scoring
   - Rich metadata and categorization

2. **Documentation** (Simulated - Ready for Integration)
   - Mock documentation search
   - Replace with your actual docs API
   - Supports categorization and tagging

3. **Knowledge Base** (Simulated - Ready for Integration)
   - Mock knowledge base search  
   - Replace with your actual KB API
   - Tag-based searching and filtering

### Ranking Algorithm

Results are ranked using multiple factors:
- **Query Relevance**: Exact matches get higher scores
- **Title vs Content**: Title matches weighted higher
- **Source Priority**: Zendesk > Knowledge Base > Docs
- **Recency**: Recently updated content gets boost
- **Exact Phrase**: Complete phrase matches get bonus

## 🔧 Customization

### Adding New Search Sources

1. Create a new search function:
```javascript
async function searchNewSource(query, limit) {
  // Your search implementation
  return standardizedResults;
}
```

2. Add to the unified search:
```javascript
if (sources.includes('new_source')) {
  enabledSources.push('new_source');
  searchPromises.push(searchNewSource(query, limit));
}
```

3. Update ranking priorities as needed.

### Modifying Ranking Algorithm

Edit the `rankResults()` function to adjust:
- Source priority weights
- Relevance scoring factors
- Recency boost calculations
- Category/tag influences

## 🚀 Deployment

### Local Development
```bash
npm run dev
```

### Production Deployment

#### Option 1: Render.com
1. Create new Web Service on Render.com
2. Connect your Git repository
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables in Render dashboard

#### Option 2: Docker
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 🔒 Security Features

- **API Key Authentication**: Secure bearer token authentication
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Helmet.js**: Security headers protection
- **CORS**: Cross-origin request handling
- **Input Validation**: Query parameter sanitization

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3001/health
```

### Metrics to Monitor
- Response times per source
- Search success/failure rates
- API key usage patterns
- Error frequencies by source

## 🛠️ Development

### Project Structure
```
mxchatbot-unified-search/
├── index.js              # Main server file
├── package.json          # Dependencies
├── .env.example          # Environment template
├── README.md            # This file
└── .gitignore           # Git ignore rules
```

### Adding Tests
```bash
npm install --save-dev jest supertest
```

### Error Handling
- All search sources have individual error handling
- Failed sources don't break the overall search
- Comprehensive logging for debugging
- Graceful degradation when sources are unavailable

## 🔄 Integration with ChatbotMX

Your main chatbot backend is already configured to use this API. Update your Render.com environment:

```bash
# In your main chatbot backend environment
MXCHATBOT_API_URL=https://your-unified-search.onrender.com
MXCHATBOT_API_KEY=your_api_key_here
```

## 📋 TODO / Future Enhancements

- [ ] Real documentation search integration
- [ ] Real knowledge base search integration  
- [ ] Elasticsearch integration
- [ ] Search analytics and metrics
- [ ] Caching layer for performance
- [ ] Multi-language support
- [ ] Advanced filtering options
- [ ] Machine learning ranking improvements

---

**Version**: 1.0.0  
**Last Updated**: July 31, 2025  
**Status**: Production Ready
