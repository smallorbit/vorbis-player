# Task 3: Set Up Container Queries

## Objective
Implement modern CSS container queries to enable component-level responsive behavior, allowing the player to adapt its internal layout based on its own size rather than just the viewport.

## Container Query Benefits
- **Component-level responsiveness**: Player adapts based on its own size
- **Better modularity**: Components can be responsive independently
- **Improved performance**: More efficient than viewport-based queries
- **Future-proof**: Modern CSS standard for responsive design

## Implementation Plan

### 3.1 Container Query Setup
```css
/* Define container context */
.player-container {
  container-type: inline-size;
  container-name: player;
}

/* Container queries for different player sizes */
@container player (max-width: 400px) {
  .player-content {
    font-size: 0.875rem;
    padding: 0.5rem;
  }
  
  .player-controls {
    flex-direction: column;
    gap: 0.25rem;
  }
}

@container player (min-width: 800px) {
  .player-content {
    font-size: 1.125rem;
    padding: 1rem;
  }
  
  .player-controls {
    flex-direction: row;
    gap: 1rem;
  }
}
```

### 3.2 Container Query Utilities
```typescript
// src/utils/containerQueries.ts
export const containerQueries = {
  mobile: '(max-width: 400px)',
  tablet: '(min-width: 401px) and (max-width: 768px)',
  desktop: '(min-width: 769px)'
} as const;

export const createContainerQuery = (query: string) => 
  `@container player ${query}`;
```

## Tasks

### 3.1 Add Container Query Support
- [ ] Add container query polyfill if needed for browser support
- [ ] Update PlayerContent.tsx to use container-type
- [ ] Create container query CSS structure
- [ ] Test container query functionality

### 3.2 Implement Component-Level Responsiveness
- [ ] Add container queries to PlayerControls
- [ ] Update AlbumArt component for different sizes
- [ ] Make VisualEffectsContainer responsive
- [ ] Update PlaylistDrawer with container queries

### 3.3 Create Container Query Utilities
- [ ] Create container query helper functions
- [ ] Add TypeScript types for container queries
- [ ] Create responsive component wrapper
- [ ] Add container query testing utilities

### 3.4 Performance Optimization
- [ ] Optimize container query performance
- [ ] Add container query debugging tools
- [ ] Test container query impact on performance
- [ ] Create container query best practices guide

## Implementation Details

### Container Query CSS Structure
```css
/* src/styles/container-queries.css */

/* Mobile player (small containers) */
@container player (max-width: 400px) {
  .player-content {
    --content-padding: 0.5rem;
    --font-size-base: 0.875rem;
    --control-gap: 0.25rem;
  }
  
  .album-art {
    --art-size: 200px;
    --art-border-radius: 0.5rem;
  }
  
  .player-controls {
    --control-size: 2rem;
    --control-spacing: 0.5rem;
  }
}

/* Tablet player (medium containers) */
@container player (min-width: 401px) and (max-width: 768px) {
  .player-content {
    --content-padding: 1rem;
    --font-size-base: 1rem;
    --control-gap: 0.5rem;
  }
  
  .album-art {
    --art-size: 300px;
    --art-border-radius: 0.75rem;
  }
  
  .player-controls {
    --control-size: 2.5rem;
    --control-spacing: 0.75rem;
  }
}

/* Desktop player (large containers) */
@container player (min-width: 769px) {
  .player-content {
    --content-padding: 1.5rem;
    --font-size-base: 1.125rem;
    --control-gap: 1rem;
  }
  
  .album-art {
    --art-size: 400px;
    --art-border-radius: 1rem;
  }
  
  .player-controls {
    --control-size: 3rem;
    --control-spacing: 1rem;
  }
}
```

### Container Query Hook
```typescript
// src/hooks/useContainerQuery.ts
export const useContainerQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  const containerRef = useRef<HTMLElement>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const { inlineSize } = entry.contentBoxSize[0];
      
      // Parse query and check if it matches
      const matches = evaluateContainerQuery(query, inlineSize);
      setMatches(matches);
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [query]);
  
  return { matches, containerRef };
};
```

## Deliverables
- Container query CSS implementation
- Container query utilities and hooks
- Updated components with container queries
- Performance testing results

## Success Criteria
- [ ] Container queries working across all components
- [ ] Smooth responsive behavior at component level
- [ ] Performance maintained or improved
- [ ] Browser compatibility ensured
- [ ] Container query utilities properly typed
