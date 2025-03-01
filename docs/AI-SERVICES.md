# AI Services Documentation

This document explains the AI services architecture in the CosmoVision Telegram Bot and provides guidance on how to use, configure, and extend these capabilities.

## Architecture Overview

The bot uses a modular AI architecture that consists of the following components:

1. **AIProviderManager**: Central manager for selecting and coordinating AI providers
2. **OpenAIService**: Integration with OpenAI's API for embeddings and text processing
3. **HuggingFaceService**: Integration with Hugging Face's API for embeddings and model inference
4. **LocalModelsService**: Provides deterministic embeddings and simple classification without external dependencies
5. **CacheService**: Optimizes performance by caching expensive AI operations
6. **RateLimitService**: Controls API usage to prevent abuse and manage costs

The system is designed to be resilient, with automatic fallbacks between services if one fails or becomes unavailable.

## Provider Selection Logic

The `AIProviderManager` selects the appropriate provider for each operation using the following logic:

1. Check if the user has reached their rate limit for the operation type
2. Select from available providers in the configured preference order for the operation
3. Skip providers that have experienced too many errors recently
4. Fall back to more reliable providers when necessary
5. Use fallback methods that don't require external APIs as a last resort

## Local Models

The bot includes a lightweight local model implementation that doesn't require downloading external models. This approach:

1. Generates deterministic embeddings using text features, hashing, and n-grams
2. Performs keyword-based intent classification
3. Runs entirely in memory without external dependencies
4. Works in environments where TensorFlow.js might be difficult to set up

### Using Local Models

To configure the local models:

1. **Set the environment variables**

   ```
   LOCAL_MODELS_DIR=models
   LOCAL_EMBEDDING_MODEL=simple-embeddings
   LOCAL_EMBEDDING_DIMENSION=256
   ```

2. **The system will automatically use local models when appropriate**

### Algorithm

The deterministic embedding approach:

1. Tokenizes text into words and n-grams
2. Uses hashing to distribute tokens across embedding dimensions
3. Applies positional weighting (early words have more influence)
4. Includes contextual information via n-grams
5. Creates smooth, normalized embeddings suitable for similarity comparisons

This method produces embeddings that can be effectively used for similarity search and other tasks, without requiring external models.

## Intelligent Caching

The caching system optimizes AI performance by:

1. **Memory Caching**: Storing common query results in memory
2. **Disk Caching**: Persisting expensive calculations (like embeddings) to disk
3. **Configuration**: Customizing cache behavior through environment variables:

   ```
   CACHE_MAX_SIZE=10000
   ENABLE_DISK_CACHE=true
   DISK_CACHE_PATH=cache
   DISK_CACHE_MAX_FILES=1000
   DISK_CACHE_MAX_SIZE_MB=100
   ```

## AI Components

The bot includes several AI-powered components:

### NLP Engine

Processes natural language queries, classifies intents, and extracts entities.

```javascript
const result = await NLPEngine.processQuery(userQuery);
```

### Similarity Engine

Finds similar coins based on embedding vectors.

```javascript
const similarCoins = await SimilarityEngine.findSimilarCoins(contractAddress);
```

### Trend Analyzer

Predicts future trends based on historical data.

```javascript
const trends = await TrendAnalyzer.buildHolderGrowthModel(contractAddress);
```

### Risk Analyzer

Assesses the risk level of a coin based on various metrics.

```javascript
const riskScore = await RiskAnalyzer.calculateRiskScore(coin);
```

## Extending with New AI Models

To add a new AI model or provider:

1. Create a new service class following the pattern of existing services
2. Implement the required methods and error handling
3. Register the provider in `AIProviderManager.PROVIDERS`
4. Add the provider to preference lists in `AIProviderManager.providerPreference`

## AI Operation Types

The system defines several operation types that can be performed by AI providers:

- `EMBEDDING`: Generating embedding vectors
- `NLP`: Natural language processing (intent detection, entity extraction)
- `CLASSIFICATION`: Classifying text into categories
- `TREND`: Trend analysis and prediction
- `RISK`: Risk assessment
- `SIMILARITY`: Finding similar items

Each operation type has its own preference order for providers, which can be customized in the `AIProviderManager`.

## Fallback Methods

If all providers fail, the system uses these fallback methods:

1. **Fallback Embeddings**: Deterministic embeddings based on text features
2. **Fallback NLP**: Regex-based intent detection and entity extraction
3. **Fallback Classification**: Keyword-based classification

While these methods are less sophisticated than API-based solutions, they ensure the bot remains functional even when external services are unavailable.

## Performance Considerations

- **Batch Processing**: Embeddings for all coins are generated in batches to optimize performance
- **Caching Strategy**: Results are cached at multiple levels to reduce API calls
- **Provider Switching**: The system tracks error rates and automatically switches between providers
- **Rate Limiting**: User requests are rate-limited to prevent abuse and control costs

## Deployment Notes

When deploying to Vercel, consider the following limitations:

1. **Function Timeout**: Serverless functions have a 10-second timeout (or 60s on paid plans)
2. **Cold Starts**: First invocations may be slower due to loading models
3. **Memory Limits**: Local models require memory, which is limited in serverless environments
4. **Filesystem Access**: Vercel's filesystem is read-only except for `/tmp`

For production deployments with heavy AI usage, consider:

1. Using a dedicated server for model hosting
2. Implementing a more scalable database solution
3. Setting up a separate API for compute-intensive AI operations
4. Using a caching service like Redis instead of disk caching
