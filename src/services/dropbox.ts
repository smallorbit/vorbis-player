import { Dropbox } from 'dropbox';

const accessToken = import.meta.env.VITE_DROPBOX_ACCESS_TOKEN;

console.log('Dropbox Access Token Status:', {
  exists: !!accessToken,
  length: accessToken?.length || 0,
  preview: accessToken ? `${accessToken.substring(0, 10)}...` : 'Not found',
  type: accessToken?.startsWith('sl.') ? 'Short-lived token' : 
        accessToken?.startsWith('aal_') ? 'App access token' :
        accessToken?.length > 100 ? 'Possible refresh token' : 'Standard token'
});

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
}

const getFileName = (path: string): string => {
  const parts = path.split('/');
  let fileName = parts[parts.length - 1];
  // Remove the extension for a cleaner title
  fileName = fileName.replace(/\.[^/.]+$/, "");
  return fileName;
}

export const getDropboxAudioFiles = async (folderPath: string): Promise<Track[]> => {
  try {
    console.log('Attempting to list folder:', folderPath || '(root/app folder)');
    
    // For App Folder access, use empty string or null
    const pathToUse = folderPath === '' ? '' : folderPath;
    
    const response = await dbx.filesListFolder({ 
      path: pathToUse, 
      recursive: false 
    });
    
    console.log('Dropbox API response:', response.result);
    
    const audioFileEntries = response.result.entries.filter(
      (entry) => entry['.tag'] === 'file' && /\.(mp3|wav|flac|m4a)$/i.test(entry.name)
    );

    console.log(`Found ${audioFileEntries.length} audio files:`, audioFileEntries.map(f => f.name));

    const trackPromises = audioFileEntries.map(async (file) => {
      if (!file.path_lower) {
        return null;
      }
      try {
        const tempLinkResult = await dbx.filesGetTemporaryLink({ path: file.path_lower });
        return {
          title: getFileName(file.name),
          src: tempLinkResult.result.link,
        };
      } catch (linkError) {
        console.error(`Error getting link for ${file.name}:`, linkError);
        return null;
      }
    });

    const tracks = (await Promise.all(trackPromises)).filter((track): track is Track => track !== null);
    
    return tracks;
  } catch (error: any) {
    console.error("Error fetching files from Dropbox:", error);
    console.error("Error details:", {
      status: error?.status,
      message: error?.message,
      response: error?.response,
      error_summary: error?.error?.error_summary
    });
    
    if (error && error.status === 401) {
      if (accessToken?.startsWith('sl.')) {
        throw new Error("Your Dropbox token appears to be a short-lived token that may have expired. Please generate a new access token from your Dropbox app settings.");
      }
      throw new Error("Dropbox authentication failed. Please check your access token. Make sure it's valid and has the required permissions (files.metadata.read, files.content.read).");
    }
    if (error && error.status === 409) {
      throw new Error(`Dropbox path conflict. The path "${folderPath}" might be incorrect or not a folder. For App Folder access, use an empty string "" to access the root.`);
    }
    if (error && error.status === 403) {
      throw new Error("Access forbidden. Make sure your Dropbox app has the correct permissions and the folder exists.");
    }
    throw new Error(`Could not fetch tracks from Dropbox: ${error.message || 'Unknown error'}`);
  }
}; 