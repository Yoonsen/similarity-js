# similarity-js

React/Vite frontend for exploring historical image similarity in digitized books from the National Library of Norway.

The app lets users search for images from books published up until 1900, inspect metadata, find visually similar images, open the source page in Nettbiblioteket, and explore recursive similarity clusters.

## How It Works

The backend is based on a Qdrant vector database with images extracted from 19th-century books. Text queries are resolved through a full-text/search API that finds images close to the query text. Image-to-image similarity then retrieves nearby images by vector proximity.

The frontend uses the National Library DHLAB similarity API:

- `GET https://api.nb.no/dhlab/similarity/images`
- `GET https://api.nb.no/dhlab/similarity/sim_images`
- `GET https://api.nb.no/dhlab/similarity/collections`
- `GET https://api.nb.no/dhlab/similarity/sim_words`

Metadata is fetched from IIIF manifests at `https://api.nb.no/catalog/v1/iiif`, and book/page links point to `https://www.nb.no/items/...`.

## Recursive Clustering

The app can build a recursive image similarity graph from a selected image. For each image in the first result set, it can fetch similar images recursively up to depth 3, filter by similarity score, and cluster the resulting graph with Louvain community detection.

Users can click graph nodes to inspect the image, metadata, source book link, and the cluster/community that the selected node belongs to.

## Development

```bash
npm install
npm run dev
```

Other useful commands:

```bash
npm run build
npm run lint
npm run preview
npm run deploy
```

## Project Structure

- `src/components/ImageSearch.jsx`: main search UI, image modal, recursive graph modal, Louvain clustering and graph layouts.
- `src/api/similarity.js`: DHLAB API calls, IIIF metadata lookup, response normalization, recursive graph construction, URN parsing, Nettbiblioteket links.
- `src/App.jsx`: page shell and instructions.
- `src/components/ErrorBoundary.jsx`: React error fallback.
- `AGENTS.md`: detailed context for future coding agents.
