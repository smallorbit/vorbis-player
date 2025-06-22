import { Dropbox } from 'dropbox';

const accessToken = import.meta.env.VITE_DROPBOX_ACCESS_TOKEN;

if (import.meta.env.DEV) {
  console.log('Dropbox Access Token Status:', {
    exists: !!accessToken,
    length: accessToken?.length || 0,
    preview: accessToken ? `${accessToken.substring(0, 10)}...` : 'Not found',
    type: accessToken?.startsWith('sl.') ? 'Short-lived token' : 
          accessToken?.startsWith('aal_') ? 'App access token' :
          accessToken?.length > 100 ? 'Possible refresh token' : 'Standard token'
  });
}

if (!accessToken) {
  throw new Error("Dropbox access token is not defined. Please set VITE_DROPBOX_ACCESS_TOKEN in your .env.local file.");
}

const dbx = new Dropbox({ 
  accessToken,
  fetch: fetch.bind(window) // Properly bind fetch to maintain context
});

export interface Track {
  title: string;
  src: string;
  duration?: string;
}

const getFileName = (path: string): string => {
  const parts = path.split('/');
  let fileName = parts[parts.length - 1];
  // Remove the extension for a cleaner title
  fileName = fileName.replace(/\.[^/.]+$/, "");
  return fileName;
}

const getAudioDuration = (src: string): Promise<string> => {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      if (isNaN(duration)) {
        resolve('--:--');
        return;
      }
      
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      resolve(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };
    
    audio.onerror = () => {
      resolve('--:--');
    };
    
    audio.src = src;
  });
}

export const getDropboxAudioFiles = async (folderPath: string): Promise<Track[]> => {
  try {
    if (import.meta.env.DEV) {
      console.log('Attempting to list folder:', folderPath || '(root/app folder)');
    }
    
    // For App Folder access, use empty string or null
    const pathToUse = folderPath === '' ? '' : folderPath;
    
    const response = await dbx.filesListFolder({ 
      path: pathToUse, 
      recursive: false 
    });
    
    if (import.meta.env.DEV) {
      console.log('Dropbox API response:', response.result);
    }
    
    const audioFileEntries = response.result.entries.filter(
      (entry) => entry['.tag'] === 'file' && /\.(mp3|wav|flac|m4a)$/i.test(entry.name)
    );

    if (import.meta.env.DEV) {
      console.log(`Found ${audioFileEntries.length} audio files:`, audioFileEntries.map(f => f.name));
    }

    const trackPromises = audioFileEntries.map(async (file) => {
      if (!file.path_lower) {
        return null;
      }
      try {
        const tempLinkResult = await dbx.filesGetTemporaryLink({ path: file.path_lower });
        const src = tempLinkResult.result.link;
        const duration = await getAudioDuration(src);
        
        return {
          title: getFileName(file.name),
          src,
          duration,
        };
      } catch (linkError) {
        if (import.meta.env.DEV) {
          console.error(`Error getting link for ${file.name}:`, linkError);
        }
        return null;
      }
    });

    const tracks = (await Promise.all(trackPromises)).filter((track): track is Track => track !== null);
    
    return tracks;
  } catch (error: unknown) {
    const errorObj = error as { status?: number; message?: string; response?: unknown; error?: { error_summary?: string } };
    
    if (import.meta.env.DEV) {
      console.error("Error fetching files from Dropbox:", error);
      console.error("Error details:", {
        status: errorObj?.status,
        message: errorObj?.message,
        response: errorObj?.response,
        error_summary: errorObj?.error?.error_summary
      });
    }
    
    if (errorObj && errorObj.status === 401) {
      if (accessToken?.startsWith('sl.')) {
        throw new Error("Your Dropbox token appears to be a short-lived token that may have expired. Please generate a new access token from your Dropbox app settings.");
      }
      throw new Error("Dropbox authentication failed. Please check your access token. Make sure it's valid and has the required permissions (files.metadata.read, files.content.read).");
    }
    if (errorObj && errorObj.status === 409) {
      throw new Error(`Dropbox path conflict. The path "${folderPath}" might be incorrect or not a folder. For App Folder access, use an empty string "" to access the root.`);
    }
    if (errorObj && errorObj.status === 403) {
      throw new Error("Access forbidden. Make sure your Dropbox app has the correct permissions and the folder exists.");
    }
    throw new Error(`Could not fetch tracks from Dropbox: ${errorObj?.message || 'Unknown error'}`);
  }
}; 