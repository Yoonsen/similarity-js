import { useState } from 'react'
import ImageSearch from './components/ImageSearch'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

function App() {
  const [showInstructions, setShowInstructions] = useState(true);

  return (
    <div className="container-fluid px-3 px-sm-4 mt-4" style={{ maxWidth: '100vw', overflowX: 'hidden' }}>
      <div className="row justify-content-center">
        <div className="col-12" style={{ maxWidth: '2000px', margin: '0 auto', position: 'relative' }}>
          <div className="header-section mb-4">
            <h3 
              className="display-6 mb-2 text-primary"
              style={{ cursor: 'pointer' }}
              onClick={() => setShowInstructions(!showInstructions)}
              data-expanded={showInstructions.toString()}
            >
              Historical Image Search
              <small className="d-block fs-6 text-muted mt-1" style={{ fontSize: '0.85rem' }}>
                National Library of Norway
              </small>
            </h3>
            
            <div 
              className="instructions"
              style={{
                maxHeight: showInstructions ? '150px' : '0',
                overflow: 'hidden',
                transition: 'max-height 0.3s ease-in-out',
              }}
            >
              <p className="lead text-muted mb-2" style={{ fontSize: '0.95rem' }}>
                Search for images in books from the National Library of Norway published up until 1900.
              </p>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                Use text to search, like <code>fjeldheim</code> or truncated like <code>fjeldheim*</code>. 
                Click on images to view details and find similar images.
              </p>
              <div className="text-end">
                <button 
                  className="btn btn-sm btn-link text-muted"
                  onClick={() => setShowInstructions(false)}
                >
                  Hide instructions
                </button>
              </div>
            </div>
          </div>
          <ErrorBoundary>
            <ImageSearch />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}

export default App
