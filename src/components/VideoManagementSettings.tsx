import { useState, useEffect, memo } from 'react';
import styled from 'styled-components';
import { videoManagementService } from '../services/videoManagementService';

interface VideoManagementSettingsProps {
  className?: string;
}

const Container = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;
  padding: 1.5rem;
`;

const Title = styled.h3`
  color: white;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
`;

const SettingItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  &:last-child {
    border-bottom: none;
  }
`;

const SettingInfo = styled.div`
  flex: 1;
`;

const SettingLabel = styled.div`
  color: white;
  font-weight: 500;
  margin-bottom: 0.25rem;
`;

const SettingDescription = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
  line-height: 1.4;
`;

const Switch = styled.label`
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
  margin-left: 1rem;
`;

const SwitchInput = styled.input`
  opacity: 0;
  width: 0;
  height: 0;

  &:checked + span {
    background-color: rgba(255, 215, 0, 0.8);
  }

  &:checked + span:before {
    transform: translateX(26px);
  }
`;

const SwitchSlider = styled.span`
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.2);
  transition: 0.3s;
  border-radius: 24px;

  &:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }
`;

const StatsSection = styled.div`
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  margin-top: 0.75rem;
`;

const StatItem = styled.div`
  text-align: center;
`;

const StatValue = styled.div`
  color: rgba(255, 215, 0, 0.9);
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
`;

const StatLabel = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8rem;
`;

const BackupSection = styled.div`
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
`;

const BackupActions = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  background: ${props =>
    props.variant === 'primary' ? 'rgba(255, 215, 0, 0.8)' :
      props.variant === 'danger' ? 'rgba(255, 0, 0, 0.8)' :
        'rgba(255, 255, 255, 0.1)'
  };
  color: ${props => props.variant === 'primary' ? 'black' : 'white'};
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.8;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const VideoManagementSettings = memo(({ className }: VideoManagementSettingsProps) => {
  const [preferences, setPreferences] = useState(videoManagementService.getPreferences());
  const [stats, setStats] = useState(videoManagementService.getManagementStats());

  useEffect(() => {
    // Refresh stats when component mounts
    setStats(videoManagementService.getManagementStats());
  }, []);

  const handlePreferenceChange = (key: keyof typeof preferences, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    videoManagementService.updatePreferences({ [key]: value });
  };

  const handleExport = () => {
    try {
      const data = videoManagementService.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vorbis-player-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export settings:', error);
      alert('Failed to export settings');
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const result = videoManagementService.importData(content);

        if (result.success) {
          // Refresh preferences and stats
          setPreferences(videoManagementService.getPreferences());
          setStats(videoManagementService.getManagementStats());
          alert('Settings imported successfully!');
        } else {
          alert('Failed to import settings: ' + result.message);
        }
      } catch (error) {
        console.error('Failed to import settings:', error);
        alert('Failed to import settings');
      }
    };
    reader.readAsText(file);

    // Reset file input
    event.target.value = '';
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all video associations? This cannot be undone.')) {
      const result = videoManagementService.clearAllAssociations();
      if (result.success) {
        setStats(videoManagementService.getManagementStats());
        alert(result.message);
      } else {
        alert('Failed to clear associations: ' + result.message);
      }
    }
  };

  return (
    <Container className={className}>
      {/* <Title>Video Management Settings</Title> */}

      <SettingItem>
        <SettingInfo>
          <SettingLabel>Remember Video Choices</SettingLabel>
          <SettingDescription>
            Save your video selections for each track to avoid re-searching every time
          </SettingDescription>
        </SettingInfo>
        <Switch>
          <SwitchInput
            type="checkbox"
            checked={preferences.rememberVideoChoices}
            onChange={(e) => handlePreferenceChange('rememberVideoChoices', e.target.checked)}
          />
          <SwitchSlider />
        </Switch>
      </SettingItem>

      <SettingItem>
        <SettingInfo>
          <SettingLabel>Enable Backup</SettingLabel>
          <SettingDescription>
            Allow exporting and importing of your video associations and settings
          </SettingDescription>
        </SettingInfo>
        <Switch>
          <SwitchInput
            type="checkbox"
            checked={preferences.backupEnabled}
            onChange={(e) => handlePreferenceChange('backupEnabled', e.target.checked)}
          />
          <SwitchSlider />
        </Switch>
      </SettingItem>

      <StatsSection>
        <SettingLabel>Statistics</SettingLabel>
        <StatsGrid>
          <StatItem>
            <StatValue>{stats.totalAssociations}</StatValue>
            <StatLabel>Total Videos</StatLabel>
          </StatItem>
          <StatItem>
            <StatValue>{stats.userSetCount}</StatValue>
            <StatLabel>Manual</StatLabel>
          </StatItem>
          <StatItem>
            <StatValue>{stats.autoDiscoveredCount}</StatValue>
            <StatLabel>Auto-Found</StatLabel>
          </StatItem>
        </StatsGrid>
      </StatsSection>

      {preferences.backupEnabled && (
        <BackupSection>
          <SettingLabel>Backup & Restore</SettingLabel>
          <SettingDescription style={{ marginTop: '0.5rem' }}>
            Export your settings to backup your video associations, or import from a previous backup.
          </SettingDescription>
          <BackupActions>
            <ActionButton variant="primary" onClick={handleExport}>
              Export Settings
            </ActionButton>
            <ActionButton variant="secondary" onClick={() => document.getElementById('import-file')?.click()}>
              Import Settings
            </ActionButton>
            <ActionButton variant="danger" onClick={handleClearAll}>
              Clear All
            </ActionButton>
          </BackupActions>
          <HiddenFileInput
            id="import-file"
            type="file"
            accept=".json"
            onChange={handleImport}
          />
        </BackupSection>
      )}
    </Container>
  );
});

VideoManagementSettings.displayName = 'VideoManagementSettings';

export default VideoManagementSettings;