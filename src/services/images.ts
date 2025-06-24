export interface ImageResult {
  id: string;
  url: string;
  thumbnailUrl: string;
  title?: string;
  author?: string;
  source?: string;
}

export interface ImageSearchResult {
  images: ImageResult[];
  error?: string;
}

class ImageService {
  private unsplashAccessKey: string | null = null;

  constructor() {
    this.unsplashAccessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY || null;
  }

  async searchImages(query: string, count: number = 3): Promise<ImageSearchResult> {
    if (!this.unsplashAccessKey) {
      return this.getMockImages(query, count);
    }

    try {
      const searchUrl = new URL('https://api.unsplash.com/search/photos');
      searchUrl.searchParams.set('query', query);
      searchUrl.searchParams.set('per_page', count.toString());
      searchUrl.searchParams.set('orientation', 'landscape');

      const response = await fetch(searchUrl.toString(), {
        headers: {
          'Authorization': `Client-ID ${this.unsplashAccessKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Unsplash API error: ${response.status}`);
      }

      const data = await response.json();
      
      const images: ImageResult[] = data.results?.map((item: any) => ({
        id: item.id,
        url: item.urls.regular,
        thumbnailUrl: item.urls.small,
        title: item.alt_description || `${query} photo`,
        author: item.user.name,
        source: 'Unsplash'
      })) || [];

      return { images };
    } catch (error) {
      console.error('Image search error:', error);
      return {
        images: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private getMockImages(query: string, count: number): ImageSearchResult {
    // Generate mock images using placeholder services
    const themes = ['music', 'abstract', 'nature', 'urban', 'vintage', 'neon'];
    // const colors = ['1a1a1a', '2563eb', '7c3aed', 'dc2626', 'ea580c', '059669']; // Unused for now
    
    const images: ImageResult[] = Array.from({ length: count }, (_, i) => {
      const theme = themes[i % themes.length];
      // const color = colors[i % colors.length]; // Unused for now
      const width = 400;
      const height = 300;
      
      return {
        id: `image-mock-${query.replace(/\s+/g, '-')}-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        url: `https://picsum.photos/seed/${query}-${i}/${width}/${height}`,
        thumbnailUrl: `https://picsum.photos/seed/${query}-${i}/${width/2}/${height/2}`,
        title: `${query} ${theme} ${i + 1}`,
        author: 'Mock Artist',
        source: 'Placeholder'
      };
    });

    return { images };
  }

  // Alternative method using different image sources
  async searchImagesMultiSource(query: string, count: number = 3): Promise<ImageSearchResult> {
    // Try Unsplash first, fall back to other sources
    let result = await this.searchImages(query, count);
    
    if (result.images.length === 0 && !result.error) {
      // Could implement other image sources here (Pexels, Pixabay, etc.)
      result = this.getMockImages(query, count);
    }
    
    return result;
  }

  // Create a collage-style image URL (for services that support it)
  createCollageUrl(query: string, dimensions: { width: number; height: number }): string {
    return `https://source.unsplash.com/${dimensions.width}x${dimensions.height}/?${encodeURIComponent(query)}`;
  }

  // Get a random image from a category
  getRandomImage(category: string = 'music', dimensions: { width: number; height: number } = { width: 400, height: 300 }): string {
    return `https://source.unsplash.com/${dimensions.width}x${dimensions.height}/?${encodeURIComponent(category)}`;
  }
}

export const imageService = new ImageService();