# Local Models Directory

This directory is used for the CosmoVision Telegram Bot's local AI capabilities.

## Purpose

The bot now uses a deterministic embedding approach that doesn't require downloading external AI models. This provides several advantages:

1. No dependency on external model files
2. Works reliably in serverless environments
3. No model loading or compatibility issues
4. Consistent results across different platforms

## How It Works

The bot generates embeddings using a combination of:

- Text tokenization
- N-gram extraction
- Hash-based dimension mapping
- Positional weighting
- Vector normalization

This approach creates semantically meaningful embeddings suitable for similarity search and other tasks.

## Configuration

Configure the local embedding generation with these environment variables:

```
LOCAL_MODELS_DIR=models
LOCAL_EMBEDDING_MODEL=simple-embeddings
LOCAL_EMBEDDING_DIMENSION=256
```

## Extending

If you want to add true neural network-based models in the future, the system is designed to be extendable:

1. Implement loading logic in the `LocalModelsService`
2. Update the environment configuration
3. The AI provider manager will automatically use your implementation

## Note About TensorFlow.js

The original implementation attempted to use TensorFlow.js models, but this approach encountered compatibility issues in serverless environments. The current deterministic approach is more reliable and doesn't require external dependencies.

If you still want to experiment with TensorFlow.js models:

1. Create a custom `LocalModelsService` class that implements TensorFlow.js model loading
2. Install the required dependencies (`@tensorflow/tfjs-node`)
3. Register your custom service with the `AIProviderManager`
