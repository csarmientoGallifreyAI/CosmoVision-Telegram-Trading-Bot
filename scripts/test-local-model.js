/**
 * Test Local Model Loading
 *
 * This script tests whether the LocalModelsService can properly load and use
 * the downloaded TensorFlow Hub model.
 */

require('dotenv').config();
const LocalModelsService = require('../src/services/localModels');
const Logger = require('../src/services/logger');

async function testLocalModel() {
  try {
    console.log('Testing local model loading...');

    // Create a LocalModelsService instance
    const localModels = new LocalModelsService();

    console.log('Initializing local models service...');
    const initialized = await localModels.initialize();

    if (!initialized) {
      console.error('Failed to initialize local models service');
      process.exit(1);
    }

    console.log('Local models service initialized successfully');
    console.log('Service status:', localModels.checkStatus());

    // Test generating an embedding
    console.log('\nTesting embedding generation...');
    const testText = 'This is a test sentence to generate embeddings for';
    const embedding = await localModels.generateEmbedding(testText);

    console.log(`Generated embedding with ${embedding.length} dimensions`);
    console.log('First 5 values:', embedding.slice(0, 5));

    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error testing local model:', error);
    process.exit(1);
  }
}

// Run the test
testLocalModel();
