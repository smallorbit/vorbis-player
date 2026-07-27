import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { CatalogProvider } from '@/types/providers';

const mockRegistryGet = vi.fn();
vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    get: (...args: unknown[]) => mockRegistryGet(...args),
  },
}));

import { MosaicThumbnail } from '../MosaicThumbnail';

/**
 * Class-based catalog whose resolveArtwork depends on `this` — mirrors the
 * real adapters (DropboxCatalogAdapter, MockCatalogAdapter). Guards against
 * detaching the method from its instance, which would lose the binding and
 * reject every call.
 */
class StubCatalog {
  private art: Record<string, string | null>;

  constructor(art: Record<string, string | null>) {
    this.art = art;
  }

  async resolveArtwork(albumPath: string): Promise<string | null> {
    return this.art[albumPath] ?? null;
  }
}

function registerCatalog(catalog: Partial<CatalogProvider> | undefined): void {
  mockRegistryGet.mockReturnValue(catalog ? { catalog } : undefined);
}

describe('MosaicThumbnail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves artwork through the catalog instance (this-binding regression)', async () => {
    // #given — a class-based catalog whose resolveArtwork reads instance state
    const catalog = new StubCatalog({
      '/music/a': 'data:image/png;base64,aaa',
      '/music/b': 'data:image/png;base64,bbb',
    });
    registerCatalog(catalog);

    // #when
    render(
      <MosaicThumbnail provider="dropbox" albumPaths={['/music/a', '/music/b']} alt="Mix" />,
    );

    // #then — both covers render (a detached method would reject every call
    // and the component would render nothing)
    await waitFor(() => {
      expect(screen.getByAltText('Mix cover 1')).toBeInTheDocument();
    });
    expect(screen.getByAltText('Mix cover 1')).toHaveAttribute('src', 'data:image/png;base64,aaa');
  });

  it('degrades a rejecting path to a placeholder instead of failing the whole mosaic', async () => {
    // #given — one path resolves, the other rejects
    registerCatalog({
      resolveArtwork: vi.fn((path: string) =>
        path === '/music/good'
          ? Promise.resolve('data:image/png;base64,good')
          : Promise.reject(new Error('network down')),
      ),
    });

    // #when
    render(
      <MosaicThumbnail provider="dropbox" albumPaths={['/music/good', '/music/bad']} alt="Mix" />,
    );

    // #then — the mosaic still renders: the rejection degrades to null and
    // diagonal duplication fills the failed slot with the good cover
    await waitFor(() => {
      expect(screen.getByAltText('Mix cover 1')).toBeInTheDocument();
    });
    const covers = screen.getAllByAltText(/Mix cover/);
    expect(covers).toHaveLength(4);
    for (const cover of covers) {
      expect(cover).toHaveAttribute('src', 'data:image/png;base64,good');
    }
  });

  it('renders nothing when the provider has no artwork resolver', async () => {
    // #given — a catalog without resolveArtwork (e.g. the real Spotify adapter)
    registerCatalog({});

    // #when
    const { container } = render(
      <MosaicThumbnail provider="spotify" albumPaths={['/music/a', '/music/b']} alt="Mix" />,
    );

    // #then
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
