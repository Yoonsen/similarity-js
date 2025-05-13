const BASE_URL = 'https://api.nb.no/dhlab/similarity';

/**
 * Search for images based on text query
 * @param {string} search - Search query
 * @param {number} hits - Number of results to return (default: 10)
 * @returns {Promise<Object>} Object mapping book IDs to arrays of image URLs
 */
export const searchImages = async (search = null, hits = 10) => {
  try {
    const params = new URLSearchParams();
    if (search !== null) params.append('search', search);
    if (hits !== null) params.append('hits', hits);

    const url = `${BASE_URL}/images?${params}`;
    console.log('Request URL:', url);
    console.log('Request parameters:', {
      search,
      hits,
      queryString: params.toString()
    });

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Image search failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Search results:', data);
    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

/**
 * Find similar images to a given image
 * @param {string} imageUrl - URL of the image to find similar ones for
 * @param {number} limit - Number of results to return (default: 10)
 * @returns {Promise<Object>} Object mapping book IDs to arrays of image URLs
 */
export const findSimilarImages = async (imageUrl = null, limit = 10) => {
  try {
    const params = new URLSearchParams();
    if (imageUrl !== null) params.append('image_url', imageUrl);
    if (limit !== null) params.append('limit', limit);

    const url = `${BASE_URL}/sim_images?${params}`;
    console.log('Similar image request:', url);

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Similar image search failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Similar images results:', data);
    return data;
  } catch (error) {
    console.error('Similar image fetch error:', error);
    throw error;
  }
};

/**
 * Get available collections
 * @returns {Promise<string>} List of collections
 */
export const getCollections = async () => {
  const response = await fetch(`${BASE_URL}/collections`);
  
  if (!response.ok) {
    throw new Error(`Collections fetch failed: ${response.status}`);
  }
  
  return response.text();
};

/**
 * Find similar words
 * @param {string} word - Word to find similar ones for
 * @param {string} [collectionName] - Optional collection name to search in
 * @returns {Promise<Array<{word: string, score: number}>>} Array of word and score pairs
 */
export const findSimilarWords = async (word, collectionName = null) => {
  const params = new URLSearchParams();
  params.append('word', word);
  if (collectionName) {
    params.append('collection_name', collectionName);
  }
  
  const response = await fetch(`${BASE_URL}/sim_words?${params}`);
  
  if (!response.ok) {
    throw new Error(`Similar words search failed: ${response.status}`);
  }
  
  return response.json();
};

/**
 * Helper function to generate the link to view an image in the library
 * @param {string} imageUrl - The image URL containing the URN
 * @returns {string} The full URL to view the image in the library
 */
export const generateLibraryLink = (imageUrl) => {
  const base = "https://www.nb.no/items/";
  const urnMatch = imageUrl.match(/URN[^/]*/);
  
  if (!urnMatch) {
    throw new Error('Invalid image URL format');
  }
  
  const urnString = urnMatch[0];
  const [prefix, doctyp, urn, page] = urnString.split('_');
  
  return `${base}${prefix}_${doctyp}_${urn}?page=${parseInt(page) + 1}`;
}; 