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

    return normalizeSimilarImagesResponse(data);
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

const extractBookIdFromImageUrl = (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return null;
  }

  const urnMatch = imageUrl.match(/URN:NBN:no-nb_[^/_]+_[^/]+/);
  return urnMatch ? urnMatch[0] : null;
};

const normalizeSimilarImagesResponse = (data) => {
  const entries = [];

  // New API format: [[url, score], [url, score], ...]
  if (Array.isArray(data)) {
    data.forEach((item) => {
      if (Array.isArray(item) && typeof item[0] === 'string') {
        entries.push({
          url: item[0],
          score: typeof item[1] === 'number' ? item[1] : null,
          bookId: extractBookIdFromImageUrl(item[0]),
        });
      } else if (typeof item === 'string') {
        entries.push({
          url: item,
          score: null,
          bookId: extractBookIdFromImageUrl(item),
        });
      }
    });
  }

  // Legacy API format: {bookId: [url, ...]} or {bookId: [[url, score], ...]}
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    Object.entries(data).forEach(([bookId, urls]) => {
      if (!Array.isArray(urls)) return;

      urls.forEach((item) => {
        if (Array.isArray(item) && typeof item[0] === 'string') {
          entries.push({
            url: item[0],
            score: typeof item[1] === 'number' ? item[1] : null,
            bookId,
          });
        } else if (typeof item === 'string') {
          entries.push({
            url: item,
            score: null,
            bookId,
          });
        }
      });
    });
  }

  // Deduplicate URLs by keeping the strongest score
  const byUrl = new Map();
  entries.forEach((entry) => {
    if (!entry.url || !entry.url.includes('URN:NBN:no-nb_')) return;
    const existing = byUrl.get(entry.url);
    if (!existing) {
      byUrl.set(entry.url, entry);
      return;
    }

    const existingScore = existing.score ?? -Infinity;
    const incomingScore = entry.score ?? -Infinity;
    if (incomingScore > existingScore) {
      byUrl.set(entry.url, entry);
    }
  });

  return Array.from(byUrl.values()).sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
};

export const buildRecursiveImageSimilarityGraph = async (
  rootImageUrl,
  {
    depth = 2,
    limit = 10,
    minSimilarity = 0.8,
    maxNodes = 200,
    maxEdges = 1000,
    includeSelfLoops = false,
    onProgress = null,
  } = {}
) => {
  if (!rootImageUrl || typeof rootImageUrl !== 'string') {
    throw new Error('A valid root image URL is required');
  }

  const maxDepth = Math.max(1, Number(depth) || 1);
  const maxPerNode = Math.max(1, Number(limit) || 1);
  const similarityThreshold = Number.isFinite(Number(minSimilarity)) ? Number(minSimilarity) : 0;

  const nodesByUrl = new Map();
  const edgesByKey = new Map();
  const queue = [{ url: rootImageUrl, depth: 0 }];
  const expanded = new Set();

  nodesByUrl.set(rootImageUrl, {
    id: rootImageUrl,
    url: rootImageUrl,
    depth: 0,
    isRoot: true,
    bookId: extractBookIdFromImageUrl(rootImageUrl),
  });

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= maxDepth) continue;
    if (expanded.has(current.url)) continue;
    if (nodesByUrl.size >= maxNodes || edgesByKey.size >= maxEdges) break;

    expanded.add(current.url);

    const similar = await findSimilarImages(current.url, maxPerNode);
    const filtered = similar
      .filter((item) => item?.url)
      .filter((item) => item.url !== current.url || includeSelfLoops)
      .filter((item) => item.score == null || item.score >= similarityThreshold)
      .slice(0, maxPerNode);

    filtered.forEach((neighbor) => {
      if (nodesByUrl.size >= maxNodes || edgesByKey.size >= maxEdges) return;

      const nextDepth = current.depth + 1;
      if (!nodesByUrl.has(neighbor.url)) {
        nodesByUrl.set(neighbor.url, {
          id: neighbor.url,
          url: neighbor.url,
          depth: nextDepth,
          isRoot: false,
          bookId: neighbor.bookId || extractBookIdFromImageUrl(neighbor.url),
        });
      } else {
        const existingNode = nodesByUrl.get(neighbor.url);
        if (nextDepth < existingNode.depth) {
          existingNode.depth = nextDepth;
        }
      }

      const source = current.url;
      const target = neighbor.url;
      if (source === target && !includeSelfLoops) return;

      const edgeKey = source < target ? `${source}::${target}` : `${target}::${source}`;
      const edgeWeight = typeof neighbor.score === 'number' ? neighbor.score : 0;
      const existingEdge = edgesByKey.get(edgeKey);

      if (!existingEdge) {
        edgesByKey.set(edgeKey, {
          id: edgeKey,
          source,
          target,
          weight: edgeWeight,
        });
      } else if (edgeWeight > existingEdge.weight) {
        existingEdge.weight = edgeWeight;
      }

      if (nextDepth <= maxDepth && !expanded.has(neighbor.url)) {
        queue.push({ url: neighbor.url, depth: nextDepth });
      }
    });

    if (typeof onProgress === 'function') {
      onProgress({
        expandedNodes: expanded.size,
        queuedNodes: queue.length,
        nodes: nodesByUrl.size,
        edges: edgesByKey.size,
      });
    }
  }

  return {
    root: rootImageUrl,
    params: {
      depth: maxDepth,
      limit: maxPerNode,
      minSimilarity: similarityThreshold,
      maxNodes,
      maxEdges,
    },
    nodes: Array.from(nodesByUrl.values()).sort((a, b) => a.depth - b.depth),
    edges: Array.from(edgesByKey.values()).sort((a, b) => b.weight - a.weight),
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