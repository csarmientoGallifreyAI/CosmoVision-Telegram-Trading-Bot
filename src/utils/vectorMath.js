/**
 * Vector Math Utilities
 *
 * Provides mathematical operations for working with vectors,
 * particularly useful for embeddings and similarity calculations.
 */

/**
 * Calculates cosine similarity between two vectors
 * @param {Array} vec1 - First vector
 * @param {Array} vec2 - Second vector
 * @returns {number} - Similarity score between 0 and 1
 */
function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) {
    return 0; // Handle invalid inputs
  }

  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    mag1 += vec1[i] * vec1[i];
    mag2 += vec2[i] * vec2[i];
  }

  mag1 = Math.sqrt(mag1);
  mag2 = Math.sqrt(mag2);

  if (mag1 === 0 || mag2 === 0) return 0;

  return dotProduct / (mag1 * mag2);
}

/**
 * Calculates Euclidean distance between two vectors
 * @param {Array} vec1 - First vector
 * @param {Array} vec2 - Second vector
 * @returns {number} - Distance value (lower means more similar)
 */
function euclideanDistance(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) {
    return Infinity; // Handle invalid inputs
  }

  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    const diff = vec1[i] - vec2[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Normalizes a vector to unit length
 * @param {Array} vec - Vector to normalize
 * @returns {Array} - Normalized vector
 */
function normalizeVector(vec) {
  if (!vec || vec.length === 0) {
    return vec;
  }

  let magnitude = 0;
  for (let i = 0; i < vec.length; i++) {
    magnitude += vec[i] * vec[i];
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude === 0) return vec.map(() => 0);

  return vec.map((v) => v / magnitude);
}

/**
 * Averages multiple vectors into a single vector
 * @param {Array<Array<number>>} vectors - Array of vectors to average
 * @returns {Array<number>|null} - Averaged vector or null if input is invalid
 */
function averageVectors(vectors) {
  if (!vectors || vectors.length === 0) {
    return null;
  }

  // Check if all vectors have the same dimension
  const dimension = vectors[0].length;
  if (!vectors.every((v) => v.length === dimension)) {
    return null;
  }

  // Initialize result vector with zeros
  const result = new Array(dimension).fill(0);

  // Sum all vectors
  for (const vec of vectors) {
    for (let i = 0; i < dimension; i++) {
      result[i] += vec[i];
    }
  }

  // Divide by count to get average
  return result.map((sum) => sum / vectors.length);
}

/**
 * Calculate the dot product of two vectors
 * @param {Array<number>} a - First vector
 * @param {Array<number>} b - Second vector
 * @returns {number} Dot product
 */
function dotProduct(a, b) {
  if (!a || !b || !a.length || !b.length || a.length !== b.length) {
    throw new Error('Vectors must be non-empty and have the same dimensions');
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result += a[i] * b[i];
  }

  return result;
}

/**
 * Calculate the magnitude (L2 norm) of a vector
 * @param {Array<number>} vector - Input vector
 * @returns {number} Magnitude
 */
function vectorMagnitude(vector) {
  if (!vector || !vector.length) {
    throw new Error('Vector must be non-empty');
  }

  let sum = 0;
  for (let i = 0; i < vector.length; i++) {
    sum += vector[i] * vector[i];
  }

  return Math.sqrt(sum);
}

module.exports = {
  cosineSimilarity,
  euclideanDistance,
  normalizeVector,
  averageVectors,
  dotProduct,
  vectorMagnitude,
};
