import type { SessionSnapshot } from '@/services/sessionPersistence';
import { PlayIcon } from '@/components/icons/PlaybackIcons';
import {
  LibraryRoot,
  LibraryArt,
  LibraryText,
  LibraryTrackName,
  LibraryArtistName,
  LibraryCollectionName,
  LibraryResumeButton,
  PanelSection,
  PanelArt,
  PanelText,
  PanelEyebrow,
  PanelTitle,
  PanelSubtitle,
  PanelResumeButton,
} from './ResumeHero.styled';

export type ResumeHeroVariant = 'library' | 'panel';

interface ResumeHeroProps {
  session: SessionSnapshot;
  onResume: () => void;
  variant: ResumeHeroVariant;
}

function ArtSlot({ image }: { image: string | undefined }) {
  if (image) {
    return <img src={image} alt="" loading="lazy" />;
  }
  return <span aria-hidden="true">♪</span>;
}

const ResumeHero = ({ session, onResume, variant }: ResumeHeroProps) => {
  const title = session.trackTitle ?? session.collectionName;

  if (variant === 'library') {
    return (
      <LibraryRoot data-testid="library-section-resume" aria-label={`Resume ${title}`}>
        <LibraryArt>
          <ArtSlot image={session.trackImage} />
        </LibraryArt>
        <LibraryText>
          <LibraryTrackName>{title}</LibraryTrackName>
          {session.trackArtist && <LibraryArtistName>{session.trackArtist}</LibraryArtistName>}
          <LibraryCollectionName>{session.collectionName}</LibraryCollectionName>
        </LibraryText>
        <LibraryResumeButton type="button" onClick={onResume} data-testid="library-resume-button">
          Resume
        </LibraryResumeButton>
      </LibraryRoot>
    );
  }

  const subtitleParts = [session.trackArtist, session.collectionName].filter(Boolean);
  const subtitle = subtitleParts.join(' • ') || session.collectionName;

  return (
    <PanelSection aria-labelledby="qap-resume-hero-title">
      <PanelArt>
        <ArtSlot image={session.trackImage} />
      </PanelArt>
      <PanelText>
        <PanelEyebrow>Pick up where you left off</PanelEyebrow>
        <PanelTitle id="qap-resume-hero-title">{title}</PanelTitle>
        <PanelSubtitle>{subtitle}</PanelSubtitle>
      </PanelText>
      <PanelResumeButton type="button" onClick={onResume} aria-label={`Resume ${title}`}>
        <PlayIcon />
        Resume
      </PanelResumeButton>
    </PanelSection>
  );
};

ResumeHero.displayName = 'ResumeHero';
export default ResumeHero;
