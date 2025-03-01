#!/usr/bin/env node
/**
 * Model Downloader Script
 *
 * Downloads and saves TensorFlow.js models from TensorFlow Hub or Hugging Face
 * Usage: npm run download-model -- --model="universal-sentence-encoder" --source="tfhub"
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { program } = require('commander');
const { execSync } = require('child_process');

const MODELS_DIR = path.join(process.cwd(), 'models');

program
  .name('download-model')
  .description('Download and setup TensorFlow.js models from TensorFlow Hub or Hugging Face')
  .version('1.0.0')
  .option(
    '-m, --model <model>',
    'Model name (e.g., "universal-sentence-encoder" or "sentence-transformers/all-MiniLM-L6-v2")'
  )
  .option('-s, --source <source>', 'Model source ("tfhub" or "huggingface")', 'tfhub')
  .option('-t, --type <type>', 'Model type (embedding, classification, etc.)', 'embedding')
  .option('-d, --dir <directory>', 'Custom directory to save the model', MODELS_DIR)
  .option('-f, --force', 'Force redownload if model already exists', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .parse(process.argv);

const options = program.opts();

// Print help if no arguments provided
if (!process.argv.slice(2).length) {
  program.help();
}

// TensorFlow Hub model URLs for TensorFlow.js format
const TFHUB_MODELS = {
  'universal-sentence-encoder':
    'https://tfhub.dev/tensorflow/tfjs-model/universal-sentence-encoder/1/default/1',
  'universal-sentence-encoder-lite':
    'https://tfhub.dev/tensorflow/tfjs-model/universal-sentence-encoder-lite/1/default/1',
  bert: 'https://tfhub.dev/tensorflow/tfjs-model/bert_en_uncased_L-12_H-768_A-12/1/default/1',
  mobilenet: 'https://tfhub.dev/tensorflow/tfjs-model/mobilenet_v2_1.0_224/1/default/1',
};

async function downloadModel() {
  try {
    const { model, source, type, dir, force, verbose } = options;

    if (!model) {
      console.error('Error: Model ID is required. Use --model option.');
      process.exit(1);
    }

    // Create model directory name based on source and model
    let modelDirName;
    if (source === 'tfhub') {
      modelDirName = `tfhub_${model.replace(/\//g, '_')}`;
    } else {
      modelDirName = model.replace(/\//g, '_');
    }

    const modelDir = path.join(dir, modelDirName);

    if (fs.existsSync(modelDir) && !force) {
      console.log(`Model already exists at ${modelDir}. Use --force to redownload.`);
      return;
    }

    console.log(`Downloading model: ${model} from ${source} (type: ${type})`);
    console.log(`Target directory: ${modelDir}`);

    if (!fs.existsSync(dir)) {
      console.log(`Creating models directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(modelDir) && force) {
      console.log(`Removing existing model directory...`);
      fs.rmSync(modelDir, { recursive: true, force: true });
    }

    fs.mkdirSync(modelDir, { recursive: true });

    if (source === 'tfhub') {
      await downloadFromTFHub(model, modelDir, verbose);
    } else {
      await downloadFromHuggingFace(model, modelDir, verbose);
    }

    console.log('\nModel downloaded successfully!');
    console.log(`\nTo use this model, update your .env file with:`);
    console.log(`LOCAL_MODELS_DIR=${dir}`);
    console.log(`LOCAL_EMBEDDING_MODEL=${modelDirName}`);
  } catch (error) {
    console.error('Error:', error.message);
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

async function downloadFromTFHub(modelName, modelDir, verbose) {
  // Get the appropriate URL from the known models
  const modelUrl = TFHUB_MODELS[modelName];

  if (!modelUrl) {
    console.error(`Model ${modelName} not found in known TensorFlow Hub models.`);
    console.log('Available models:', Object.keys(TFHUB_MODELS).join(', '));
    throw new Error('Unknown TensorFlow Hub model');
  }

  console.log(`Downloading from TensorFlow Hub: ${modelUrl}`);

  // First download the model.json
  const modelJsonUrl = `${modelUrl}/model.json`;
  console.log('Fetching model.json...');

  try {
    const modelJsonResponse = await axios.get(modelJsonUrl);
    const modelJson = modelJsonResponse.data;

    // Save model.json
    fs.writeFileSync(path.join(modelDir, 'model.json'), JSON.stringify(modelJson, null, 2));

    // Parse the model.json to find weight files
    if (modelJson.weightsManifest) {
      for (const manifest of modelJson.weightsManifest) {
        if (manifest.paths) {
          for (const weightFile of manifest.paths) {
            const weightUrl = `${modelUrl}/${weightFile}`;
            console.log(`Downloading weight file: ${weightFile}`);

            const weightResponse = await axios.get(weightUrl, { responseType: 'arraybuffer' });

            // Ensure the directory structure exists
            const weightFilePath = path.join(modelDir, weightFile);
            const weightFileDir = path.dirname(weightFilePath);
            if (!fs.existsSync(weightFileDir)) {
              fs.mkdirSync(weightFileDir, { recursive: true });
            }

            fs.writeFileSync(weightFilePath, Buffer.from(weightResponse.data));
          }
        }
      }
    }

    // Download vocab.txt if it exists (for BERT-like models)
    try {
      const vocabUrl = `${modelUrl}/vocab.txt`;
      console.log('Trying to download vocab.txt...');
      const vocabResponse = await axios.get(vocabUrl);
      fs.writeFileSync(path.join(modelDir, 'vocab.txt'), vocabResponse.data);
      console.log('Downloaded vocab.txt');
    } catch (error) {
      if (verbose) {
        console.log('No vocab.txt found. This is normal for many models.');
      }
    }
  } catch (error) {
    console.error('Error downloading from TensorFlow Hub:', error.message);
    throw error;
  }
}

async function downloadFromHuggingFace(model, modelDir, verbose) {
  // Try multiple possible paths for TF.js model on Hugging Face
  const possiblePaths = [
    'tf_model/model.json', // Standard TF.js export path
    'model.json', // Root path
    'tfjs_model/model.json', // Alternative export path
    'tensorflow/tfjs/model.json', // Another possible path
  ];

  let modelJson = null;
  let successPath = '';

  for (const path of possiblePaths) {
    try {
      const modelJsonUrl = `https://huggingface.co/${model}/resolve/main/${path}`;
      console.log(`Trying to fetch model.json from: ${modelJsonUrl}`);

      const response = await axios.get(modelJsonUrl);
      modelJson = response.data;
      successPath = path;
      console.log(`Found model.json at ${successPath}`);
      break;
    } catch (error) {
      if (verbose) {
        console.log(`Path ${path} not found on Hugging Face`);
      }
    }
  }

  if (!modelJson) {
    throw new Error(`Model not found on Hugging Face in TensorFlow.js format.
Try using a TensorFlow Hub model instead:
npm run download-model -- --model="universal-sentence-encoder" --source="tfhub"
    `);
  }

  // Save model.json
  fs.writeFileSync(path.join(modelDir, 'model.json'), JSON.stringify(modelJson, null, 2));

  // Get the base URL path
  const basePath = successPath.substring(0, successPath.lastIndexOf('/') + 1);

  // Extract weight file names from model.json and download them
  if (modelJson.weightsManifest) {
    for (const manifest of modelJson.weightsManifest) {
      if (manifest.paths) {
        for (const weightFile of manifest.paths) {
          const weightUrl = `https://huggingface.co/${model}/resolve/main/${basePath}${weightFile}`;
          console.log(`Downloading weight file: ${weightFile}`);

          try {
            const weightResponse = await axios.get(weightUrl, { responseType: 'arraybuffer' });

            // Ensure the directory structure exists
            const weightFilePath = path.join(modelDir, weightFile);
            const weightFileDir = path.dirname(weightFilePath);
            if (!fs.existsSync(weightFileDir)) {
              fs.mkdirSync(weightFileDir, { recursive: true });
            }

            fs.writeFileSync(weightFilePath, Buffer.from(weightResponse.data));
          } catch (error) {
            console.error(`Error downloading weight file ${weightFile}:`, error.message);
            throw error;
          }
        }
      }
    }
  }

  // Try to download vocab and tokenizer files if they exist
  const metadataFiles = ['vocab.json', 'tokenizer.json', 'tokenizer_config.json', 'vocab.txt'];
  for (const file of metadataFiles) {
    try {
      const fileUrl = `https://huggingface.co/${model}/resolve/main/${file}`;
      console.log(`Trying to download ${file}...`);

      const fileResponse = await axios.get(fileUrl);
      // Check if response is JSON or text
      if (typeof fileResponse.data === 'object') {
        fs.writeFileSync(path.join(modelDir, file), JSON.stringify(fileResponse.data, null, 2));
      } else {
        fs.writeFileSync(path.join(modelDir, file), fileResponse.data);
      }
      console.log(`Downloaded ${file}`);
    } catch (error) {
      if (verbose) {
        console.log(`${file} not found or not applicable for this model`);
      }
    }
  }
}

downloadModel();
