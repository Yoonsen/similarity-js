import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { UndirectedGraph } from 'graphology';
import louvain from 'graphology-communities-louvain';
import {
  searchImages,
  findSimilarImages,
  fetchImageMetadata,
  buildRecursiveImageSimilarityGraph,
} from '../api/similarity';

const COMMUNITY_COLORS = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
  '#bcbd22',
  '#17becf',
];

const GRAPH_WIDTH = 1200;
const GRAPH_HEIGHT = 860;

const getCommunityColor = (communityId) => {
  if (communityId === null || communityId === undefined) return '#6c757d';
  return COMMUNITY_COLORS[Math.abs(Number(communityId)) % COMMUNITY_COLORS.length];
};

const computeCommunities = (graphData) => {
  if (!graphData?.nodes?.length) return {};

  try {
    const graph = new UndirectedGraph();
    graphData.nodes.forEach((node) => {
      if (!graph.hasNode(node.id)) {
        graph.addNode(node.id);
      }
    });

    graphData.edges.forEach((edge) => {
      if (!edge?.source || !edge?.target) return;
      if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) return;
      if (edge.source === edge.target) return;
      if (graph.hasEdge(edge.source, edge.target)) return;
      graph.addUndirectedEdge(edge.source, edge.target, {
        weight: Math.max(edge.weight ?? 0.001, 0.001),
      });
    });

    return louvain(graph, { getEdgeWeight: 'weight' });
  } catch (error) {
    console.warn('Louvain clustering failed, falling back to single community:', error);
    return Object.fromEntries(graphData.nodes.map((node) => [node.id, 0]));
  }
};

const buildRadialLayout = (graphData, communities) => {
  const centerX = GRAPH_WIDTH / 2;
  const centerY = GRAPH_HEIGHT / 2;
  const layerSpacing = 140;
  const baseRadius = 40;

  const nodesByDepth = graphData.nodes.reduce((acc, node) => {
    const depth = Number(node.depth ?? 0);
    if (!acc[depth]) acc[depth] = [];
    acc[depth].push(node);
    return acc;
  }, {});

  const positionedNodes = [];
  Object.entries(nodesByDepth).forEach(([depthKey, layerNodes]) => {
    const depth = Number(depthKey);
    if (depth === 0) {
      const rootNode = layerNodes[0];
      positionedNodes.push({
        ...rootNode,
        x: centerX,
        y: centerY,
        radius: 14,
        community: communities[rootNode.id] ?? 0,
      });
      return;
    }

    layerNodes.sort((a, b) => {
      const cA = communities[a.id] ?? 0;
      const cB = communities[b.id] ?? 0;
      if (cA !== cB) return cA - cB;
      return a.id.localeCompare(b.id);
    });

    const radius = baseRadius + depth * layerSpacing;
    const angleStep = (Math.PI * 2) / layerNodes.length;
    layerNodes.forEach((node, index) => {
      const angle = index * angleStep - Math.PI / 2;
      positionedNodes.push({
        ...node,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        radius: 7,
        community: communities[node.id] ?? 0,
      });
    });
  });

  const nodeById = new Map(positionedNodes.map((node) => [node.id, node]));
  const positionedEdges = graphData.edges
    .map((edge) => {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) return null;
      return {
        ...edge,
        x1: source.x,
        y1: source.y,
        x2: target.x,
        y2: target.y,
      };
    })
    .filter(Boolean);

  return {
    nodes: positionedNodes,
    edges: positionedEdges,
  };
};

const buildForceDirectedLayout = (graphData, communities) => {
  if (!graphData?.nodes?.length) {
    return { nodes: [], edges: [] };
  }

  const centerX = GRAPH_WIDTH / 2;
  const centerY = GRAPH_HEIGHT / 2;
  const nodeState = graphData.nodes.map((node, index) => {
    const angle = (index / Math.max(graphData.nodes.length, 1)) * Math.PI * 2;
    const radius = 60 + (node.depth ?? 0) * 90;
    return {
      ...node,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      radius: node.isRoot ? 13 : 7,
      community: communities[node.id] ?? 0,
    };
  });

  const byId = new Map(nodeState.map((node) => [node.id, node]));
  const edges = graphData.edges
    .map((edge) => {
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      if (!source || !target) return null;
      return { ...edge, sourceRef: source, targetRef: target };
    })
    .filter(Boolean);

  const iterations = 280;
  const repulsion = 3500;
  const springK = 0.0085;
  const damping = 0.85;
  const minDistance = 10;

  for (let step = 0; step < iterations; step += 1) {
    for (let i = 0; i < nodeState.length; i += 1) {
      const a = nodeState[i];
      for (let j = i + 1; j < nodeState.length; j += 1) {
        const b = nodeState[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distSq = dx * dx + dy * dy;
        if (distSq < minDistance * minDistance) {
          distSq = minDistance * minDistance;
          dx += (Math.random() - 0.5) * 0.5;
          dy += (Math.random() - 0.5) * 0.5;
        }

        const dist = Math.sqrt(distSq);
        const force = repulsion / distSq;
        const fx = (force * dx) / dist;
        const fy = (force * dy) / dist;

        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    edges.forEach((edge) => {
      const source = edge.sourceRef;
      const target = edge.targetRef;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), minDistance);
      const desired = 80 + Math.max(Math.min(source.depth ?? 0, target.depth ?? 0), 0) * 35;
      const stretch = dist - desired;
      const edgeStrength = 0.8 + Math.min(edge.weight ?? 0, 1) * 1.2;
      const force = springK * stretch * edgeStrength;
      const fx = (force * dx) / dist;
      const fy = (force * dy) / dist;

      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    });

    nodeState.forEach((node) => {
      if (node.isRoot) {
        node.x += (centerX - node.x) * 0.08;
        node.y += (centerY - node.y) * 0.08;
        node.vx *= 0.4;
        node.vy *= 0.4;
      } else {
        node.vx *= damping;
        node.vy *= damping;
        node.x += node.vx;
        node.y += node.vy;
      }

      node.x = Math.max(30, Math.min(GRAPH_WIDTH - 30, node.x));
      node.y = Math.max(30, Math.min(GRAPH_HEIGHT - 30, node.y));
    });
  }

  const positionedEdges = edges.map((edge) => ({
    ...edge,
    x1: edge.sourceRef.x,
    y1: edge.sourceRef.y,
    x2: edge.targetRef.x,
    y2: edge.targetRef.y,
  }));

  return {
    nodes: nodeState,
    edges: positionedEdges,
  };
};

export default function ImageSearch() {
  const [query, setQuery] = useState('spyd');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [mode, setMode] = useState('search');
  const [hoveredImageUrl, setHoveredImageUrl] = useState(null);
  const [metadata, setMetadata] = useState({});
  const hideTimeoutRef = useRef(null);
  const hasSearchedInitiallyRef = useRef(false);
  const [selectedImageForModal, setSelectedImageForModal] = useState(null);

  const [graphModalOpen, setGraphModalOpen] = useState(false);
  const [graphSourceImage, setGraphSourceImage] = useState(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState(null);
  const [graphProgress, setGraphProgress] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [graphConfig, setGraphConfig] = useState({
    depth: 2,
    limit: 8,
    minSimilarity: 0.85,
    maxNodes: 180,
  });
  const [layoutMode, setLayoutMode] = useState('circular');

  const ensureMetadata = useCallback(async (url) => {
    if (!url || metadata[url] !== undefined) return metadata[url] ?? null;
    try {
      const imageMetadata = await fetchImageMetadata(url);
      setMetadata((prev) => ({ ...prev, [url]: imageMetadata }));
      return imageMetadata;
    } catch (err) {
      console.error('Metadata fetch error:', err);
      setMetadata((prev) => ({ ...prev, [url]: null }));
      return null;
    }
  }, [metadata]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    try {
      setLoading(true);
      setError(null);
      setMode('search');
      setSelectedImage(null);
      const data = await searchImages(query, 20);
      const imageUrls = Object.entries(data).flatMap(([bookId, urls]) =>
        urls.map((url) => ({ bookId, url }))
      );
      setResults(imageUrls);
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'An error occurred during search');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleImageClick = async (url) => {
    if (!url) {
      setError('Invalid image URL');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMode('similar');
      setSelectedImage(url);
      const data = await findSimilarImages(url, 20);
      const imageUrls = data
        .filter((item) => item?.url && item.url.includes('URN:NBN:no-nb_'))
        .map((item) => ({
          bookId: item.bookId || 'unknown',
          url: item.url,
          score: item.score,
        }));
      setResults(imageUrls);
    } catch (err) {
      console.error('Similar image search error:', err);
      setError(err.message || 'An error occurred finding similar images');
      setMode('search');
      setSelectedImage(null);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGraphModal = async (url) => {
    if (!url) return;
    setGraphSourceImage(url);
    setGraphModalOpen(true);
    setSelectedImageForModal(null);
    await ensureMetadata(url);
  };

  const handleBuildGraph = useCallback(async (overrideUrl = null) => {
    const sourceUrl = overrideUrl || graphSourceImage;
    if (!sourceUrl) return;

    try {
      setGraphLoading(true);
      setGraphError(null);
      setGraphProgress({ expandedNodes: 0, queuedNodes: 0, nodes: 0, edges: 0 });

      const rawGraph = await buildRecursiveImageSimilarityGraph(sourceUrl, {
        depth: graphConfig.depth,
        limit: graphConfig.limit,
        minSimilarity: graphConfig.minSimilarity,
        maxNodes: graphConfig.maxNodes,
        onProgress: (progress) => setGraphProgress(progress),
      });

      const communityByNode = computeCommunities(rawGraph);
      setGraphData({
        ...rawGraph,
        communities: communityByNode,
      });
    } catch (err) {
      console.error('Graph build error:', err);
      setGraphError(err.message || 'Could not build recursive similarity graph');
    } finally {
      setGraphLoading(false);
    }
  }, [graphSourceImage, graphConfig]);

  const handleImageHover = async (url, isEntering) => {
    if (isEntering) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setHoveredImageUrl(url);
      await ensureMetadata(url);
    } else {
      hideTimeoutRef.current = setTimeout(() => {
        setHoveredImageUrl(null);
      }, 300);
    }
  };

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (hasSearchedInitiallyRef.current) return;
    hasSearchedInitiallyRef.current = true;
    handleSearch();
  }, [handleSearch]);

  useEffect(() => {
    if (graphModalOpen && graphSourceImage && !graphData && !graphLoading) {
      handleBuildGraph(graphSourceImage);
    }
  }, [graphModalOpen, graphSourceImage, graphData, graphLoading, handleBuildGraph]);

  useEffect(() => {
    if (selectedImageForModal) {
      ensureMetadata(selectedImageForModal);
    }
  }, [selectedImageForModal, ensureMetadata]);

  const generateBookLink = (url) => {
    if (!url || typeof url !== 'string') return '#';
    const urnMatch = url.match(/URN:NBN:no-nb_[\w]+_\d+/);
    if (!urnMatch) return '#';
    const urn = urnMatch[0];
    const baseUrn = urn.replace(/_\d+$/, '');
    const pageMatch = urn.match(/_(\d+)$/);
    const page = pageMatch ? parseInt(pageMatch[1], 10) + 1 : 1;
    return `https://www.nb.no/items/${baseUrn}?page=${page}`;
  };

  const selectedCommunityId = useMemo(() => {
    if (!selectedImageForModal || !graphData?.communities) return null;
    const community = graphData.communities[selectedImageForModal];
    return community === undefined ? null : community;
  }, [selectedImageForModal, graphData]);

  const selectedClusterNodes = useMemo(() => {
    if (selectedCommunityId === null || !graphData?.nodes?.length || !graphData?.communities) return [];

    return graphData.nodes
      .filter((node) => graphData.communities[node.id] === selectedCommunityId)
      .sort((a, b) => {
        if ((a.depth ?? 0) !== (b.depth ?? 0)) return (a.depth ?? 0) - (b.depth ?? 0);
        return a.id.localeCompare(b.id);
      });
  }, [selectedCommunityId, graphData]);

  const graphLayout = useMemo(() => {
    if (!graphData?.nodes?.length) return null;
    if (layoutMode === 'force') {
      return buildForceDirectedLayout(graphData, graphData.communities || {});
    }
    return buildRadialLayout(graphData, graphData.communities || {});
  }, [graphData, layoutMode]);

  return (
    <div className="container-fluid py-4">
      <div className="mb-4">
        <div className="input-group">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="form-control"
            placeholder="Enter search term and press Enter..."
            style={{ fontSize: '0.95rem' }}
          />
          <button onClick={handleSearch} disabled={loading} className="btn btn-primary" style={{ fontSize: '0.95rem' }}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Searching...
              </>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </div>

      {mode === 'similar' && selectedImage && (
        <div className="row mb-4">
          <div className="col-md-8 mx-auto">
            <div className="card">
              <div className="card-body d-flex align-items-center">
                <img src={selectedImage} alt="Selected image" style={{ height: '100px', marginRight: '1rem' }} />
                <div>
                  <h5 className="card-title">Finding similar images</h5>
                  <button onClick={handleSearch} className="btn btn-sm btn-outline-secondary">
                    ← Back to search results
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="row mb-4">
          <div className="col-md-8 mx-auto">
            <div className="alert alert-danger">
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.25rem',
          justifyContent: 'center',
          alignItems: 'flex-start',
          width: '100%',
          margin: '0 auto',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          maxWidth: '100vw',
          padding: '0.5rem',
        }}
      >
        {results?.length > 0 ? (
          results.map(({ url }, index) => (
            <div
              key={url || index}
              className="position-relative"
              style={{
                height: '200px',
                flexGrow: 0,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1px',
              }}
            >
              <div
                className="position-relative"
                onMouseEnter={() => handleImageHover(url, true)}
                onMouseLeave={() => handleImageHover(url, false)}
                onClick={() => setSelectedImageForModal(url)}
                style={{
                  cursor: 'pointer',
                  height: '100%',
                  border: '1px solid #f8f9fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.2s ease-in-out',
                  transform: hoveredImageUrl === url ? 'scale(1.02)' : 'scale(1)',
                }}
              >
                <img
                  src={url}
                  alt={`Search result ${index + 1}`}
                  style={{
                    height: '100%',
                    width: 'auto',
                    maxWidth: 'none',
                    objectFit: 'contain',
                    borderRadius: '2px',
                    backgroundColor: '#f8f9fa',
                  }}
                  onLoad={(e) => {
                    const aspectRatio = e.target.naturalWidth / e.target.naturalHeight;
                    const width = 200 * aspectRatio;
                    e.target.parentElement.style.width = `${width}px`;
                  }}
                />
                {hoveredImageUrl === url && metadata[url] && (
                  <div
                    className="position-absolute"
                    style={{
                      inset: 0,
                      background: 'rgba(0, 0, 0, 0.4)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      animation: 'fadeIn 0.2s ease-in-out forwards',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.75rem',
                        textAlign: 'center',
                        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                        maxWidth: '90%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                      }}
                    >
                      <div style={{ fontWeight: '500' }}>{metadata[url].title}</div>
                      {(metadata[url].creator || metadata[url].date) && (
                        <div style={{ fontSize: '0.65rem', opacity: 0.9, display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                          {metadata[url].creator && <span>{metadata[url].creator}</span>}
                          {metadata[url].date && <span>{metadata[url].date}</span>}
                        </div>
                      )}
                      <div style={{ fontSize: '0.65rem', marginTop: '0.25rem', opacity: 0.8, fontStyle: 'italic' }}>Click for details</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-12 text-center">
            <p className="text-muted">{loading ? 'Searching...' : 'No results found'}</p>
          </div>
        )}
      </div>

      {selectedImageForModal && (
        <div
          className="modal show"
          style={{
            display: 'block',
            backgroundColor: 'rgba(0,0,0,0.5)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: graphModalOpen ? 1080 : 1050,
            overflowY: 'auto',
            padding: '1rem',
          }}
          onClick={() => setSelectedImageForModal(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ maxWidth: 'min(90vw, 800px)', width: 'fit-content', margin: '1.75rem auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content" style={{ overflowY: 'auto', maxHeight: '90vh' }}>
              <div className="modal-header">
                <h5
                  className="modal-title"
                  style={{ fontSize: '1rem', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {metadata[selectedImageForModal]?.title || 'Loading metadata...'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setSelectedImageForModal(null)}></button>
              </div>
              <div className="modal-body" style={{ padding: '1rem' }}>
                <div style={{ maxHeight: '70vh', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <img
                    src={selectedImageForModal}
                    alt={metadata[selectedImageForModal]?.title || 'Selected image'}
                    style={{ maxWidth: '100%', maxHeight: '60vh', height: 'auto', objectFit: 'contain', marginBottom: '1rem' }}
                  />
                </div>
                <div className="metadata" style={{ fontSize: '0.9rem' }}>
                  {metadata[selectedImageForModal]?.creator && (
                    <p className="mb-1">
                      <strong>Creator:</strong> {metadata[selectedImageForModal]?.creator}
                    </p>
                  )}
                  {metadata[selectedImageForModal]?.date && (
                    <p className="mb-1">
                      <strong>Date:</strong> {metadata[selectedImageForModal]?.date}
                    </p>
                  )}
                  {metadata[selectedImageForModal]?.publisher && (
                    <p className="mb-1">
                      <strong>Publisher:</strong> {metadata[selectedImageForModal]?.publisher}
                    </p>
                  )}
                  {metadata[selectedImageForModal] === undefined && (
                    <p className="mb-0 text-muted">Loading metadata...</p>
                  )}
                </div>

                {selectedClusterNodes.length > 0 && (
                  <div className="mt-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="mb-0">
                        Cluster {String(selectedCommunityId)} ({selectedClusterNodes.length} images)
                      </h6>
                      <small className="text-muted">Click a thumbnail to switch image</small>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                        gap: '0.5rem',
                        maxHeight: '220px',
                        overflowY: 'auto',
                        padding: '0.25rem',
                        border: '1px solid #e9ecef',
                        borderRadius: '6px',
                        background: '#fbfbfb',
                      }}
                    >
                      {selectedClusterNodes.map((node) => (
                        <button
                          type="button"
                          key={node.id}
                          className="btn p-0 border-0"
                          style={{
                            borderRadius: '4px',
                            overflow: 'hidden',
                            boxShadow: node.url === selectedImageForModal ? `0 0 0 3px ${getCommunityColor(selectedCommunityId)}` : 'none',
                          }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            await ensureMetadata(node.url);
                            setSelectedImageForModal(node.url);
                          }}
                        >
                          <img
                            src={node.url}
                            alt={metadata[node.url]?.title || `Cluster image depth ${node.depth}`}
                            style={{ width: '100%', height: '90px', objectFit: 'cover', display: 'block' }}
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ padding: '0.75rem', gap: '0.5rem' }}>
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(generateBookLink(selectedImageForModal), '_blank');
                  }}
                >
                  View in Book
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleImageClick(selectedImageForModal);
                    setSelectedImageForModal(null);
                  }}
                >
                  Find Similar Images
                </button>
                <button
                  className="btn btn-outline-dark btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenGraphModal(selectedImageForModal);
                  }}
                >
                  Build Similarity Graph
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {graphModalOpen && (
        <div
          className="modal show"
          style={{
            display: 'block',
            backgroundColor: 'rgba(0,0,0,0.55)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1060,
            overflowY: 'auto',
            padding: '1rem',
          }}
          onClick={() => setGraphModalOpen(false)}
        >
          <div className="modal-dialog modal-xl" style={{ margin: '1.25rem auto', maxWidth: 'min(95vw, 1300px)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title mb-1">Recursive image similarity graph</h5>
                  <small className="text-muted">Depth-limited BFS with Louvain communities</small>
                </div>
                <button type="button" className="btn-close" onClick={() => setGraphModalOpen(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-2 align-items-end mb-3">
                  <div className="col-sm-3">
                    <label className="form-label mb-1">Depth</label>
                    <select
                      className="form-select form-select-sm"
                      value={graphConfig.depth}
                      onChange={(e) => setGraphConfig((prev) => ({ ...prev, depth: Number(e.target.value) }))}
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </div>
                  <div className="col-sm-3">
                    <label className="form-label mb-1">Top-N per node</label>
                    <input
                      type="number"
                      min={2}
                      max={25}
                      className="form-control form-control-sm"
                      value={graphConfig.limit}
                      onChange={(e) => setGraphConfig((prev) => ({ ...prev, limit: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="col-sm-3">
                    <label className="form-label mb-1">Min similarity</label>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      className="form-control form-control-sm"
                      value={graphConfig.minSimilarity}
                      onChange={(e) => setGraphConfig((prev) => ({ ...prev, minSimilarity: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="col-sm-3">
                    <button className="btn btn-primary btn-sm w-100" disabled={graphLoading} onClick={() => handleBuildGraph()}>
                      {graphLoading ? 'Building...' : 'Rebuild graph'}
                    </button>
                  </div>
                </div>

                {graphProgress && (
                  <div className="small text-muted mb-2">
                    Expanded: {graphProgress.expandedNodes} | Queue: {graphProgress.queuedNodes} | Nodes: {graphProgress.nodes} | Edges:{' '}
                    {graphProgress.edges}
                  </div>
                )}

                {graphError && <div className="alert alert-danger py-2">{graphError}</div>}

                {graphLoading && (
                  <div className="d-flex align-items-center gap-2 py-2">
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <span>Building graph...</span>
                  </div>
                )}

                {!graphLoading && graphLayout && (
                  <>
                    <div className="small text-muted mb-2">
                      Nodes: {graphData.nodes.length} | Edges: {graphData.edges.length} | Communities:{' '}
                      {new Set(Object.values(graphData.communities)).size}
                    </div>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="small text-muted">Layout:</span>
                      <div className="btn-group btn-group-sm" role="group" aria-label="Layout mode toggle">
                        <button
                          type="button"
                          className={`btn ${layoutMode === 'circular' ? 'btn-primary' : 'btn-outline-primary'}`}
                          onClick={() => setLayoutMode('circular')}
                        >
                          Circular
                        </button>
                        <button
                          type="button"
                          className={`btn ${layoutMode === 'force' ? 'btn-primary' : 'btn-outline-primary'}`}
                          onClick={() => setLayoutMode('force')}
                        >
                          Force-directed
                        </button>
                      </div>
                    </div>
                    <div style={{ border: '1px solid #e9ecef', borderRadius: '6px', overflow: 'hidden', background: '#fafafa' }}>
                      <svg viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} width="100%" role="img" aria-label="Similarity graph">
                        {graphLayout.edges.map((edge) => (
                          <line
                            key={edge.id}
                            x1={edge.x1}
                            y1={edge.y1}
                            x2={edge.x2}
                            y2={edge.y2}
                            stroke="#6c757d"
                            strokeOpacity={0.2 + Math.min(edge.weight ?? 0, 1) * 0.5}
                            strokeWidth={1 + Math.min(edge.weight ?? 0, 1) * 2}
                          />
                        ))}
                        {graphLayout.nodes.map((node) => (
                          <g key={node.id}>
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={node.radius}
                              fill={getCommunityColor(node.community)}
                              stroke={node.isRoot ? '#111827' : '#fff'}
                              strokeWidth={node.isRoot ? 3 : 1.5}
                              style={{ cursor: 'pointer' }}
                              onClick={async () => {
                                await ensureMetadata(node.url);
                                setSelectedImageForModal(node.url);
                              }}
                            >
                              <title>{metadata[node.url]?.title || node.url}</title>
                            </circle>
                          </g>
                        ))}
                      </svg>
                    </div>
                    <div className="small text-muted mt-2">Tip: Click a node to open image metadata and actions.</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}