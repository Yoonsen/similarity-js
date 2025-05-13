import { useState, useEffect, useRef } from 'react';
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
  const hideTimeoutRef = useRef(null);

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
      
      // Transform the response data and filter out invalid URLs
      const imageUrls = Object.entries(data).flatMap(([bookId, urls]) => 
        urls
          .filter(url => url && typeof url === 'string' && url.includes('URN:NBN:no-nb_'))
          .map(url => ({
            bookId,
            url,
          }))
      );
      
      console.log('Filtered similar images:', imageUrls);
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

  const handleImageHover = async (url, isEntering) => {
    if (isEntering) {
      // Clear any existing timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
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
    } else {
      // Set a timeout before hiding
      hideTimeoutRef.current = setTimeout(() => {
        setHoveredImageUrl(null);
      }, 300); // 300ms delay before hiding
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

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
        className="position-absolute"
        style={{
          background: 'rgba(51, 65, 85, 0.97)',
          color: 'white',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 1000,
          minWidth: '200px',
          minHeight: '180px',
          width: 'max-content',
          maxWidth: '300px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '10px',
          cursor: 'default'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top section with title and metadata */}
        <div>
          <h6 
            className="mb-2"
            style={{ 
              fontSize: '1rem',
              lineHeight: '1.2',
              marginBottom: '0.5rem',
              wordBreak: 'break-word'
            }}
          >
            {meta.title}
          </h6>
          <div className="small" style={{ opacity: 0.9 }}>
            {meta.creator && <div className="mb-1">{meta.creator}</div>}
            {meta.date && <div className="mb-1">{meta.date}</div>}
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

        {/* Arrow pointing to the image */}
        <div 
          style={{
            position: 'absolute',
            bottom: '-6px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '12px',
            height: '12px',
            background: 'rgba(51, 65, 85, 0.97)',
            clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
          }}
        />
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
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '0.5rem',
          padding: '0 1rem',
          maxWidth: '1800px',
          margin: '0 auto'
        }}
      >
        {results && results.length > 0 ? (
          results.map(({ url, bookId }, index) => (
            <div 
              key={index} 
              className="position-relative"
              style={{
                aspectRatio: '1', // Make it square
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div 
                className="position-relative"
                onMouseEnter={() => handleImageHover(url, true)}
                onMouseLeave={() => handleImageHover(url, false)}
                style={{ 
                  cursor: 'pointer',
                  width: '100%',
                  height: '100%'
                }}
              >
                <img 
                  src={url} 
                  alt={`Search result ${index + 1}`}
                  style={{ 
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '4px',
                    backgroundColor: '#f8f9fa'
                  }}
                />
                {hoveredImageUrl === url && metadata[url] && (
                  <div 
                    className="position-absolute"
                    onMouseEnter={() => {
                      if (hideTimeoutRef.current) {
                        clearTimeout(hideTimeoutRef.current);
                        hideTimeoutRef.current = null;
                      }
                    }}
                    onMouseLeave={() => handleImageHover(url, false)}
                    style={{
                      background: 'rgba(51, 65, 85, 0.97)',
                      color: 'white',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      zIndex: 1000,
                      minWidth: '200px',
                      minHeight: '180px',
                      width: 'max-content',
                      maxWidth: '300px',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginBottom: '10px',
                      cursor: 'default'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Top section with title and metadata */}
                    <div>
                      <h6 
                        className="mb-2"
                        style={{ 
                          fontSize: '1rem',
                          lineHeight: '1.2',
                          marginBottom: '0.5rem',
                          wordBreak: 'break-word'
                        }}
                      >
                        {metadata[url].title}
                      </h6>
                      <div className="small" style={{ opacity: 0.9 }}>
                        {metadata[url].creator && <div className="mb-1">{metadata[url].creator}</div>}
                        {metadata[url].date && <div className="mb-1">{metadata[url].date}</div>}
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

                    {/* Arrow pointing to the image */}
                    <div 
                      style={{
                        position: 'absolute',
                        bottom: '-6px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '12px',
                        height: '12px',
                        background: 'rgba(51, 65, 85, 0.97)',
                        clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
                      }}
                    />
                  </div>
                )}
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