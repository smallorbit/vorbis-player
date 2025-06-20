import { Dropbox } from 'dropbox';

const accessToken = import.meta.env.VITE_DROPBOX_ACCESS_TOKEN;

if (!accessToken) {
  throw new Error("Dropbox access token is not defined. Please set VITE_DROPBOX_ACCESS_TOKEN in your .env.local file.");
}

const dbx = new Dropbox({ accessToken });

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
    const response = await dbx.filesListFolder({ path: folderPath, recursive: false });
    const audioFileEntries = response.result.entries.filter(
      (entry) => entry['.tag'] === 'file' && /\.(mp3|wav|flac|m4a)$/i.test(entry.name)
    );

    const trackPromises = audioFileEntries.map(async (file) => {
      if (!file.path_lower) {
        return null;
      }
      const tempLinkResult = await dbx.filesGetTemporaryLink({ path: file.path_lower });
      return {
        title: getFileName(file.name),
        src: tempLinkResult.result.link,
      };
    });

    const tracks = (await Promise.all(trackPromises)).filter((track): track is Track => track !== null);
    
    return tracks;
  } catch (error: any) {
    console.error("Error fetching files from Dropbox:", error);
    // You might want to handle different error types, e.g., auth errors vs. network errors
    if (error && error.status === 401) {
      throw new Error("Dropbox authentication failed. Please check your access token.");
    }
    if (error && error.status === 409) {
      throw new Error(`Dropbox path conflict. The path "${folderPath}" might be incorrect or not a folder. For App Folder access, use an empty string "" to access the root.`);
    }
    throw new Error("Could not fetch tracks from Dropbox.");
  }
}; 