# Agent Project Context

## What This Project Is

`similarity-js` is a React/Vite frontend for exploring image similarity in digitized books from the National Library of Norway. The current UI is titled "Historical Image Search" and focuses on images from books published up until 1900.

The backend data source is a Qdrant vector database containing images extracted from 19th-century books. Text queries are resolved through a separate full-text/search API that finds images close to the query text. From there, image-to-image similarity is based on vector proximity in Qdrant.

In short: text can retrieve nearby images, images can retrieve nearby images, and the frontend lets users navigate those relationships with metadata and links back to the original book in Nettbiblioteket.

## User-Facing Workflow

1. The user enters a text query such as `fjeldheim`, `fjeldheim*`, or the default `spyd`.
2. The app calls the DHLAB similarity API to find image URLs associated with books.
3. Results are shown in a responsive image grid.
4. Hovering or opening an image fetches IIIF metadata from the National Library manifest.
5. Clicking an image can:
   - show details and metadata,
   - open the source book/page in `www.nb.no`,
   - find directly similar images,
   - build a recursive similarity graph.

## Important APIs

The API client lives in `src/api/similarity.js`.

- Base similarity API: `https://api.nb.no/dhlab/similarity`
- IIIF manifest API: `https://api.nb.no/catalog/v1/iiif`
- Text-to-image search: `GET /images?search=<query>&hits=<n>`
- Image-to-image similarity: `GET /sim_images?image_url=<url>&limit=<n>`
- Collections: `GET /collections`
- Similar words: `GET /sim_words?word=<word>&collection_name=<optional>`
- Metadata: `GET https://api.nb.no/catalog/v1/iiif/<URN>/manifest`

The current code supports both newer similar-image responses like `[[url, score], ...]` and older object responses like `{ bookId: [url, ...] }`.

## Recursive Clustering

Recursive clustering starts from one selected image and builds a graph by repeatedly fetching similar images for each discovered image.

The implementation is `buildRecursiveImageSimilarityGraph()` in `src/api/similarity.js`. It performs a depth-limited breadth-first traversal with these controls:

- `depth`: maximum recursion depth, exposed in the UI as 1 to 3.
- `limit`: top-N similar images fetched per expanded node.
- `minSimilarity`: minimum score filter.
- `maxNodes`: guardrail against overly large graphs.
- `maxEdges`: guardrail against overly dense graphs.

The UI default is depth `2`, top-N `8`, minimum similarity `0.85`, and max nodes `180`. The graph builder deduplicates nodes by URL and deduplicates undirected edges while keeping the strongest score.

Clustering is computed client-side in `src/components/ImageSearch.jsx` using:

- `graphology`
- `graphology-communities-louvain`

The Louvain communities are used as image clusters. The graph can be shown with either a circular/radial layout or a simple force-directed layout. Clicking a node opens that image in the modal and shows the node's cluster thumbnails, so the user can inspect the selected image together with its community.

## Source Map

- `src/App.jsx`: page shell, title, instructions, and `ErrorBoundary` wrapper.
- `src/components/ImageSearch.jsx`: main UI, search flow, image modal, graph modal, clustering, layout, metadata interactions.
- `src/api/similarity.js`: all external API calls, response normalization, URN parsing, recursive graph building, IIIF metadata, Nettbiblioteket link generation.
- `src/components/ErrorBoundary.jsx`: fallback UI for uncaught React errors.
- `src/main.jsx`: React entrypoint.
- `src/App.css` and `src/index.css`: global styling, mobile viewport handling, hover animation, basic layout.
- `LOGBOOK.md`: project history and current state.
- `TODO.md`: older task list; some items may be stale compared with implemented code.

## Development Commands

- Install dependencies: `npm install`
- Run locally: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Preview production build: `npm run preview`
- Deploy to GitHub Pages: `npm run deploy`

The deployed homepage is configured as `https://yoonsen.github.io/similarity-js`.

## Implementation Notes For Future Agents

- Keep API work centralized in `src/api/similarity.js`.
- Preserve support for both current and legacy similar-image response shapes unless the API contract is intentionally changed.
- Image identity is URL-based; graph nodes use the image URL as `id`.
- URNs are parsed from image URLs and are used to build IIIF manifest URLs and Nettbiblioteket links.
- Metadata labels from IIIF manifests are Norwegian (`tittel`, `forfatter`, `publisert`, `språk`, `medforfatter/bidragsyter`).
- The graph is intentionally bounded; avoid removing depth, node, edge, and similarity guardrails without adding another safety mechanism.
- There are no unit tests yet. For behavior changes, run at least `npm run lint` and `npm run build`.
- The README may lag behind the code; prefer `src/api/similarity.js`, `src/components/ImageSearch.jsx`, and this file for current behavior.
