import ImageSearch from './components/ImageSearch'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

function App() {
  return (
    <div className="container mt-4">
      <h1 className="display-4 mb-4">Image Search</h1>
      <ErrorBoundary>
        <ImageSearch />
      </ErrorBoundary>
    </div>
  )
}

export default App
