# Similarity-js Project Logbook

## Project Overview
A React-based image similarity search application that interfaces with the National Library of Norway's DHLAB API. This project is a port of an existing Python/Streamlit application.

## Base URL
- API Endpoint: https://api.nb.no/dhlab/similarity

## Development Timeline

### Latest Updates (May 14, 2023)
- ✅ Enhanced mobile viewport handling:
  * Improved handling of wide images on mobile devices
  * Implemented horizontal scrolling for oversized images while keeping UI fixed
  * Added smooth touch scrolling with hardware acceleration
  * Optimized viewport constraints to prevent layout shifts
  * Maintained centered UI while allowing content overflow

### Latest Updates (March 20, 2023)
- ✅ Enhanced user interface and interactions:
  * Improved image hover effect with subtle scale transform
  * Added clean modal dialog for image details
  * Optimized modal sizing for both desktop and mobile
  * Added hardware acceleration for smoother animations
- ✅ Improved mobile experience:
  * Better viewport handling and initial rendering
  * Prevented unwanted zooming and scaling
  * Optimized touch interactions
  * Improved layout stability
- ✅ Added informative header section:
  * Clear title and subtitle
  * Collapsible instructions with examples
  * Search syntax guidance
  * Smooth animations and transitions
- ✅ Improved metadata handling:
  * Implemented correct Norwegian field mapping (Tittel → title, Forfatter → creator, Publisert → publisher/date)
  * Enhanced metadata extraction from IIIF manifests
  * Added year extraction from publication data
  * Improved metadata display in UI

### Initial Setup (Completed)
- ✅ Created React/Vite project structure
- ✅ Configured project with necessary dependencies
- ✅ Set up GitHub Pages deployment
- ✅ Implemented base API client for DHLAB endpoints

### Core Features Implementation (Completed)
- ✅ Text-based image search functionality
- ✅ Responsive image grid display
- ✅ Similar image search capability
- ✅ Book link generation from IIIF URNs
- ✅ Error handling with React Error Boundaries

### Components Created
1. **ImageSearch.jsx**
   - Main search interface
   - Handles both text and image-based searches
   - Responsive grid display
   - Loading states and error handling

2. **ErrorBoundary.jsx**
   - Global error boundary component
   - Graceful error state handling

3. **API Client (similarity.js)**
   - Implements all DHLAB endpoints
   - Error handling and logging
   - URN parsing utilities

### Technical Stack
- React 19.1.0
- Vite 6.3.5
- GitHub Pages for deployment
- Bootstrap for styling

### Current Project State
The application is functional and deployed on GitHub Pages with the following features:
- Text search for images in digitized books
- Similar image search functionality with improved reliability
- Responsive image grid display
- Direct links to original book sources
- Error handling and loading states
- Enhanced metadata display with hoverable popups

### Known Issues
- None currently reported

### Recent Bug Fixes
- Fixed similar image search displaying empty results
- Improved URL validation and filtering
- Enhanced error logging for API responses
- Added timeout handling for popup display

### Future Enhancements
1. **Performance Optimization**
   - [ ] Implement image lazy loading
   - [ ] Add pagination for large result sets
   - [ ] Cache frequent searches

2. **User Experience**
   - [ ] Add search history
   - [ ] Implement advanced search filters
   - [ ] Add image preview modal
   - [ ] Improve mobile responsiveness

3. **Features**
   - [ ] Add collection filtering
   - [ ] Implement batch similar image search
   - [ ] Add export functionality for search results
   - [ ] Integrate similar words search feature
   - [ ] Implement recursive similarity search
     * Allow exploring chains of similar images
     * Control recursion depth
     * Visualize similarity relationships
     * Track and export similarity paths

4. **Development**
   - [ ] Add unit tests
   - [ ] Implement E2E testing
   - [ ] Add TypeScript support
   - [ ] Improve documentation

### Deployment
- Hosted on GitHub Pages
- Base URL: https://yoonsen.github.io/similarity-js
- Deployment via `npm run deploy`

### Dependencies
Key dependencies and their versions:
- react: ^19.1.0
- react-dom: ^19.1.0
- vite: ^6.3.5
- gh-pages: ^6.1.1

## Notes
- The project uses Bootstrap for styling
- API calls are logged to console for debugging
- URN parsing is handled in the API client

## Last Updated
March 21, 2023

---
*This logbook will be updated as the project evolves. Please add entries for any significant changes or decisions.* 