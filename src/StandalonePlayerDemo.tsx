import SpotifyAudioPlayer from './components/SpotifyAudioPlayer';
// Import spotifyPlayer service to ensure global callback is set up
import './services/spotifyPlayer';

const StandalonePlayerDemo = () => {
  return (
    <div >
      <SpotifyAudioPlayer 
        
        showPlaylist={false}
        autoPlay={true}
      />
    </div>
  );
};

export default StandalonePlayerDemo;
