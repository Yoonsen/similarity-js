import { useState, useEffect } from 'react';
import { searchImages, findSimilarImages, fetchImageMetadata } from '../api/similarity';

export default function ImageSearch() {
  const [query, setQuery] = useState('daguerrotypi');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [mode, setMode] = useState('search'); // 'search' or 'similar'
  const [hoveredImageUrl, setHoveredImageUrl] = useState(null);
  const [metadata, setMetadata] = useState({});

  const handleSearch = async () => {
    if (!query.trim()) return; // Don't search if query is empty
    try {
      setLoading(true);
      setError(null);
      setMode('search');
      setSelectedImage(null);
      console.log('Starting search with query:', query);
      const data = await searchImages(query);
      
      // Transform the data into a flat array of image URLs with their book IDs
      const imageUrls = Object.entries(data).flatMap(([bookId, urls]) => 
        urls.map(url => ({
          bookId,
          url,
        }))
      );
      
      setResults(imageUrls);
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'An error occurred during search');
    } finally {
      setLoading(false);
    }
  };

  // Handle key press for search input
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleImageClick = async (url) => {
    if (!url) {
      console.error('No URL provided for similar image search');
      setError('Invalid image URL');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMode('similar');
      setSelectedImage(url);
      
      // Get similar images using the full URL
      const data = await findSimilarImages(url);
      
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response from similar images API');
      }
      
      // Transform the response data the same way as search results
      const imageUrls = Object.entries(data).flatMap(([bookId, urls]) => 
        urls.map(url => ({
          bookId,
          url,
        }))
      );
      
      setResults(imageUrls);
    } catch (err) {
      console.error('Similar image search error:', err);
      setError(err.message || 'An error occurred finding similar images');
      setMode('search'); // Reset to search mode on error
      setSelectedImage(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImageHover = async (url) => {
    setHoveredImageUrl(url);
    if (!metadata[url]) {
      try {
        const imageMetadata = await fetchImageMetadata(url);
        setMetadata(prev => ({
          ...prev,
          [url]: imageMetadata
        }));
      } catch (err) {
        console.error('Metadata fetch error:', err);
        setMetadata(prev => ({
          ...prev,
          [url]: null
        }));
      }
    }
  };

  // Trigger initial search on component mount
  useEffect(() => {
    handleSearch();
  }, []);

  const generateBookLink = (url) => {
    if (!url || typeof url !== 'string') {
      console.error('Invalid URL provided to generateBookLink:', url);
      return '#';
    }

    const urnMatch = url.match(/URN:NBN:no-nb_[\w]+_\d+/);
    if (!urnMatch) {
      console.error('Could not find URN in URL:', url);
      return '#';
    }
    
    const urn = urnMatch[0];
    const baseUrn = urn.replace(/_\d+$/, '');
    const pageMatch = urn.match(/_(\d+)$/);
    const page = pageMatch ? parseInt(pageMatch[1]) + 1 : 1;

    return `https://www.nb.no/items/${baseUrn}?page=${page}`;
  };

  const renderMetadata = (meta) => {
    if (!meta) return null;
    
    return (
      <div className="metadata-display">
        <h6 className="mb-2 text-truncate" title={meta.title}>{meta.title}</h6>
        {meta.creator && (
          <p className="mb-1 small text-muted">
            <strong>Creator:</strong> {meta.creator}
          </p>
        )}
        {meta.date && (
          <p className="mb-1 small text-muted">
            <strong>Date:</strong> {meta.date}
          </p>
        )}
        {meta.publisher && (
          <p className="mb-1 small text-muted">
            <strong>Publisher:</strong> {meta.publisher}
          </p>
        )}
        {meta.language && (
          <p className="mb-1 small text-muted">
            <strong>Language:</strong> {meta.language}
          </p>
        )}
        {meta.rawMetadata && meta.rawMetadata.map((item, idx) => {
          const label = item.label?.no?.[0] || item.label?.['@value']?.[0] || '';
          const value = item.value?.no?.[0] || item.value?.['@value']?.[0] || '';
          if (!label || !value) return null;
          return (
            <p key={idx} className="mb-1 small text-muted">
              <strong>{label}:</strong> {value}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container py-4">
      <div className="row mb-4">
        <div className="col">
          <div className="input-group">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="form-control"
              placeholder="Enter search term and press Enter..."
            />
            <button 
              onClick={handleSearch}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Searching...
                </>
              ) : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {mode === 'similar' && selectedImage && (
        <div className="row mb-4">
          <div className="col">
            <div className="card">
              <div className="card-body d-flex align-items-center">
                <img 
                  src={selectedImage} 
                  alt="Selected image"
                  style={{ height: '100px', marginRight: '1rem' }}
                />
                <div>
                  <h5 className="card-title">Finding similar images</h5>
                  <button 
                    onClick={handleSearch}
                    className="btn btn-sm btn-outline-secondary"
                  >
                    ← Back to search results
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger mb-4">
          <strong>Error:</strong> {error}
          <br />
          <small>Check the browser console for more details.</small>
        </div>
      )}

      <div className="row row-cols-1 row-cols-md-3 g-4">
        {results && results.length > 0 ? (
          results.map(({ url, bookId }, index) => (
            <div key={index} className="col">
              <div 
                className="card h-100"
                style={{ position: 'relative' }}
              >
                <div 
                  className="position-relative"
                  onMouseEnter={() => handleImageHover(url)}
                  onMouseLeave={() => setHoveredImageUrl(null)}
                >
                  <img 
                    src={url} 
                    alt={`Search result ${index + 1}`}
                    className="card-img-top"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleImageClick(url)}
                  />
                  {hoveredImageUrl === url && metadata[url] && (
                    <div 
                      className="position-absolute top-0 start-0 w-100 h-100"
                      style={{
                        background: 'rgba(0, 0, 0, 0.8)',
                        color: 'white',
                        padding: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        overflow: 'auto'
                      }}
                    >
                      <div className="text-center">
                        {renderMetadata(metadata[url])}
                      </div>
                    </div>
                  )}
                </div>
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <a 
                      href={generateBookLink(url)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-primary"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(generateBookLink(url), '_blank');
                      }}
                    >
                      View in Book
                    </a>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleImageClick(url);
                      }}
                    >
                      Find Similar
                    </button>
                  </div>
                  {metadata[url] && (
                    <div className="metadata-section border-top pt-3">
                      {renderMetadata(metadata[url])}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-12 text-center">
            <p className="text-muted">
              {loading ? 'Searching...' : 'No results found'}
              <br />
              <small>Check browser console for details</small>
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 