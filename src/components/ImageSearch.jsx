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

  const renderHoverOverlay = (url, meta) => {
    if (!meta) return null;
    
    return (
      <div 
        className="position-absolute top-0 start-0 w-100 h-100"
        style={{
          background: 'rgba(0, 0, 0, 0.85)',
          color: 'white',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 1000,
          opacity: 0,
          transition: 'opacity 0.2s ease',
          cursor: 'default'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        onClick={(e) => e.stopPropagation()} // Prevent image click-through
      >
        {/* Top section with title and metadata */}
        <div>
          <h6 
            className="mb-2"
            style={{ 
              fontSize: '1rem',
              lineHeight: '1.2',
              marginBottom: '0.5rem'
            }}
          >
            {meta.title}
          </h6>
          <div className="small" style={{ opacity: 0.9 }}>
            {meta.creator && <div>{meta.creator}</div>}
            {meta.date && <div>{meta.date}</div>}
          </div>
        </div>

        {/* Bottom section with actions */}
        <div className="action-buttons" style={{ marginTop: 'auto' }}>
          <div className="d-flex flex-column gap-2">
            <button
              className="btn btn-sm btn-outline-light w-100"
              onClick={(e) => {
                e.stopPropagation();
                window.open(generateBookLink(url), '_blank');
              }}
              style={{ fontSize: '0.8rem' }}
            >
              View in Book
            </button>
            <button
              className="btn btn-sm btn-outline-light w-100"
              onClick={(e) => {
                e.stopPropagation();
                handleImageClick(url);
              }}
              style={{ fontSize: '0.8rem' }}
            >
              Find Similar Images
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container-fluid py-4">
      {/* Search input section */}
      <div className="row mb-4">
        <div className="col-md-8 mx-auto">
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

      {/* Similar image header */}
      {mode === 'similar' && selectedImage && (
        <div className="row mb-4">
          <div className="col-md-8 mx-auto">
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

      {/* Error display */}
      {error && (
        <div className="row mb-4">
          <div className="col-md-8 mx-auto">
            <div className="alert alert-danger">
              <strong>Error:</strong> {error}
              <br />
              <small>Check the browser console for more details.</small>
            </div>
          </div>
        </div>
      )}

      {/* Image grid */}
      <div 
        className="row g-2" 
        style={{ 
          columns: '6 200px',
          columnGap: '1rem',
          padding: '0 1rem'
        }}
      >
        {results && results.length > 0 ? (
          results.map(({ url, bookId }, index) => (
            <div 
              key={index} 
              style={{ 
                breakInside: 'avoid',
                marginBottom: '1rem'
              }}
            >
              <div 
                className="position-relative"
                onMouseEnter={() => handleImageHover(url)}
                onMouseLeave={() => setHoveredImageUrl(null)}
                style={{ cursor: 'pointer' }}
              >
                <img 
                  src={url} 
                  alt={`Search result ${index + 1}`}
                  className="img-fluid w-100"
                  style={{ 
                    display: 'block',
                    borderRadius: '4px',
                    backgroundColor: '#f8f9fa'
                  }}
                />
                {hoveredImageUrl === url && metadata[url] && renderHoverOverlay(url, metadata[url])}
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