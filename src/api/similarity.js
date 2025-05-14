const BASE_URL = 'https://api.nb.no/dhlab/similarity';
const IIIF_BASE_URL = 'https://api.nb.no/catalog/v1/iiif';

/**
 * Search for images based on text query
 * @param {string} search - Search query
 * @param {number} hits - Number of results to return (default: 20)
 * @returns {Promise<Object>} Object mapping book IDs to arrays of image URLs
 */
export const searchImages = async (search = null, hits = 20) => {
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
 * @param {number} limit - Number of results to return (default: 20)
 * @returns {Promise<Object>} Object mapping book IDs to arrays of image URLs
 */
export const findSimilarImages = async (imageUrl = null, limit = 20) => {
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
    console.log('Raw similar images response:', data);
    
    // Validate the response structure
    if (!data || typeof data !== 'object') {
      console.error('Invalid response format:', data);
      throw new Error('Invalid response format from similar images API');
    }

    // Log the structure of each book's images
    Object.entries(data).forEach(([bookId, urls]) => {
      console.log(`Book ${bookId} images:`, urls);
      if (!Array.isArray(urls)) {
        console.error(`Invalid URLs format for book ${bookId}:`, urls);
      }
    });

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
 * Extract URN parts from image URL
 * @param {string} imageUrl - The image URL containing the URN
 * @returns {Object} URN parts {prefix, doctyp, urn, page}
 */
const extractUrnParts = (imageUrl) => {
  const urnMatch = imageUrl.match(/URN[^/]*/);
  
  if (!urnMatch) {
    throw new Error('Invalid image URL format');
  }
  
  const urnString = urnMatch[0];
  const [prefix, doctyp, urn, page] = urnString.split('_');
  
  return {
    prefix,
    doctyp,
    urn,
    page: parseInt(page)
  };
};

/**
 * Fetch metadata for an image from its IIIF manifest
 * @param {string} imageUrl - The image URL containing the URN
 * @returns {Promise<Object>} Image metadata
 */
export const fetchImageMetadata = async (imageUrl) => {
  try {
    const { prefix, doctyp, urn } = extractUrnParts(imageUrl);
    const manifestUrl = `${IIIF_BASE_URL}/${prefix}_${doctyp}_${urn}/manifest`;
    console.log('Fetching manifest from:', manifestUrl);
    
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      throw new Error(`Manifest fetch failed: ${response.status}`);
    }
    
    const manifest = await response.json();
    console.log('Full manifest:', manifest);
    
    // Extract useful metadata
    const metadata = {
      title: manifest.label || '',
      attribution: manifest.attribution || '',
      publisher: '',
      date: '',
      language: '',
      creator: '',
      rawMetadata: manifest.metadata || []
    };

    // Parse metadata from manifest
    if (manifest.metadata && Array.isArray(manifest.metadata)) {
      manifest.metadata.forEach(item => {
        const label = item.label?.toLowerCase() || '';
        const value = item.value || '';
        
        console.log('Processing metadata:', { label, value });

        // Extract year from published info if it exists
        const yearMatch = value.match(/\b\d{4}\b/);
        
        switch(label) {
          case 'tittel':
            metadata.title = value;
            break;
          case 'forfatter':
            metadata.creator = value;
            break;
          case 'publisert':
            metadata.publisher = value;
            if (yearMatch) {
              metadata.date = yearMatch[0];
            }
            break;
          case 'språk':
            metadata.language = value;
            break;
          case 'medforfatter/bidragsyter':
            if (!metadata.creator) {
              metadata.creator = value;
            }
            break;
        }
      });
    }
    
    console.log('Final extracted metadata:', metadata);
    return metadata;
  } catch (error) {
    console.error('Metadata fetch error:', error);
    return null;
  }
};

/**
 * Helper function to generate the link to view an image in the library
 * @param {string} imageUrl - The image URL containing the URN
 * @returns {string} The full URL to view the image in the library
 */
export const generateLibraryLink = (imageUrl) => {
  const { prefix, doctyp, urn, page } = extractUrnParts(imageUrl);
  return `https://www.nb.no/items/${prefix}_${doctyp}_${urn}?page=${page + 1}`;
}; 