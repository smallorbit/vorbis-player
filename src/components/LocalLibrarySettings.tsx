import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { LocalLibrarySettings as SettingsType } from '../types/spotify';
import { localLibraryScanner } from '../services/localLibraryScanner';
import { Button } from './styled/Button';
import { Card } from './styled/Card';
import { ScrollArea } from './ui/scroll-area';

const SettingsContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
`;

const SettingsHeader = styled.div`
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const SettingsTitle = styled.h2`
  color: white;
  font-size: 24px;
  font-weight: 600;
  margin: 0;
`;

const SettingsContent = styled.div`
  flex: 1;
  overflow: hidden;
`;

const SettingsSection = styled.div`
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  
  &:last-child {
    border-bottom: none;
  }
`;

const SectionTitle = styled.h3`
  color: white;
  font-size: 18px;
  font-weight: 500;
  margin: 0 0 16px 0;
`;

const SectionDescription = styled.p`
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  margin: 0 0 16px 0;
  line-height: 1.5;
`;

const DirectoriesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
`;

const DirectoryItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
`;

const DirectoryPath = styled.div`
  color: white;
  font-size: 14px;
  font-family: monospace;
  flex: 1;
  margin-right: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RemoveButton = styled(Button)`
  background: rgba(220, 53, 69, 0.2);
  border: 1px solid rgba(220, 53, 69, 0.4);
  color: #dc3545;
  padding: 6px 12px;
  font-size: 12px;
  
  &:hover {
    background: rgba(220, 53, 69, 0.3);
    border-color: rgba(220, 53, 69, 0.6);
  }
`;

const AddDirectoryButton = styled(Button)`
  background: rgba(40, 167, 69, 0.2);
  border: 1px solid rgba(40, 167, 69, 0.4);
  color: #28a745;
  
  &:hover {
    background: rgba(40, 167, 69, 0.3);
    border-color: rgba(40, 167, 69, 0.6);
  }
`;

const SettingRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SettingLabel = styled.label`
  color: white;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
`;

const SettingDescription = styled.span`
  color: rgba(255, 255, 255, 0.6);
  font-weight: normal;
  font-size: 12px;
`;

const Toggle = styled.input.attrs({ type: 'checkbox' })`
  appearance: none;
  width: 48px;
  height: 24px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:checked {
    background: rgba(40, 167, 69, 0.6);
    border-color: rgba(40, 167, 69, 0.8);
  }
  
  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s ease;
    transform: ${props => props.checked ? 'translateX(24px)' : 'translateX(0)'};
  }
`;

const ScanProgress = styled.div`
  margin-top: 16px;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
`;

const ProgressFill = styled.div<{ progress: number }>`
  height: 100%;
  background: linear-gradient(90deg, #28a745, #20c997);
  width: ${props => props.progress}%;
  transition: width 0.3s ease;
`;

const ProgressText = styled.div`
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  display: flex;
  justify-content: space-between;
`;

const ScanActions = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 16px;
`;

const ScanButton = styled(Button)`
  background: rgba(0, 123, 255, 0.2);
  border: 1px solid rgba(0, 123, 255, 0.4);
  color: #007bff;
  
  &:hover {
    background: rgba(0, 123, 255, 0.3);
    border-color: rgba(0, 123, 255, 0.6);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    
    &:hover {
      background: rgba(0, 123, 255, 0.2);
      border-color: rgba(0, 123, 255, 0.4);
    }
  }
`;

const ErrorMessage = styled.div`
  color: #dc3545;
  font-size: 12px;
  background: rgba(220, 53, 69, 0.1);
  border: 1px solid rgba(220, 53, 69, 0.3);
  border-radius: 4px;
  padding: 8px 12px;
  margin-top: 8px;
`;

export const LocalLibrarySettings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsType>({
    musicDirectories: [],
    watchForChanges: true,
    scanOnStartup: true,
    autoIndexNewFiles: true,
    supportedFormats: ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac'],
    excludePatterns: ['.*', 'node_modules', '.git'],
    includeSubdirectories: true
  });

  const [scanProgress, setScanProgress] = useState({
    isScanning: false,
    progress: 0,
    currentFile: '',
    scannedFiles: 0,
    totalFiles: 0,
    errors: [] as string[]
  });

  const [isAddingDirectory, setIsAddingDirectory] = useState(false);

  useEffect(() => {
    // Load current settings
    const currentSettings = localLibraryScanner.getSettings();
    setSettings(currentSettings);

    // Set up scan progress listener
    const handleScanProgress = (progress: any) => {
      setScanProgress(prev => ({
        ...prev,
        progress: progress.progress,
        currentFile: progress.currentFile,
        scannedFiles: progress.scannedFiles,
        totalFiles: progress.totalFiles
      }));
    };

    const handleScanStarted = () => {
      setScanProgress(prev => ({ ...prev, isScanning: true, errors: [] }));
    };

    const handleScanCompleted = (result: any) => {
      setScanProgress(prev => ({
        ...prev,
        isScanning: false,
        progress: 100,
        errors: result.errors || []
      }));
    };

    const handleScanError = (error: any) => {
      setScanProgress(prev => ({
        ...prev,
        isScanning: false,
        errors: [error.error.toString()]
      }));
    };

    localLibraryScanner.on('scanProgress', handleScanProgress);
    localLibraryScanner.on('scanStarted', handleScanStarted);
    localLibraryScanner.on('scanCompleted', handleScanCompleted);
    localLibraryScanner.on('scanError', handleScanError);

    // Get initial scan progress
    const currentProgress = localLibraryScanner.getScanProgress();
    setScanProgress(prev => ({
      ...prev,
      isScanning: currentProgress.isScanning,
      progress: currentProgress.totalFiles > 0 
        ? (currentProgress.scannedFiles / currentProgress.totalFiles) * 100 
        : 0,
      currentFile: currentProgress.currentFile,
      scannedFiles: currentProgress.scannedFiles,
      totalFiles: currentProgress.totalFiles,
      errors: currentProgress.errors
    }));

    return () => {
      localLibraryScanner.off('scanProgress', handleScanProgress);
      localLibraryScanner.off('scanStarted', handleScanStarted);
      localLibraryScanner.off('scanCompleted', handleScanCompleted);
      localLibraryScanner.off('scanError', handleScanError);
    };
  }, []);

  const handleAddDirectory = useCallback(async () => {
    if (!window.electronAPI) {
      alert('Directory selection is only available in the desktop app');
      return;
    }

    setIsAddingDirectory(true);
    try {
      const directory = await window.electronAPI.selectMusicDirectory();
      if (directory) {
        await localLibraryScanner.addMusicDirectory(directory);
        const updatedSettings = localLibraryScanner.getSettings();
        setSettings(updatedSettings);
      }
    } catch (error) {
      console.error('Failed to add directory:', error);
      alert('Failed to add directory. Please try again.');
    } finally {
      setIsAddingDirectory(false);
    }
  }, []);

  const handleRemoveDirectory = useCallback(async (directory: string) => {
    if (confirm(`Remove "${directory}" from your music library?`)) {
      try {
        await localLibraryScanner.removeMusicDirectory(directory);
        const updatedSettings = localLibraryScanner.getSettings();
        setSettings(updatedSettings);
      } catch (error) {
        console.error('Failed to remove directory:', error);
        alert('Failed to remove directory. Please try again.');
      }
    }
  }, []);

  const handleSettingChange = useCallback((key: keyof SettingsType, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localLibraryScanner.updateSettings({ [key]: value });
  }, [settings]);

  const handleStartScan = useCallback(async () => {
    try {
      await localLibraryScanner.scanAllDirectories();
    } catch (error) {
      console.error('Failed to start scan:', error);
      alert('Failed to start library scan. Please try again.');
    }
  }, []);

  return (
    <SettingsContainer>
      <SettingsHeader>
        <SettingsTitle>Local Library Settings</SettingsTitle>
      </SettingsHeader>

      <SettingsContent>
        <ScrollArea>
          <SettingsSection>
            <SectionTitle>Music Directories</SectionTitle>
            <SectionDescription>
              Add directories containing your music files. The app will scan these directories
              and add all supported audio files to your library.
            </SectionDescription>

            <DirectoriesList>
              {settings.musicDirectories.length === 0 ? (
                <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontStyle: 'italic' }}>
                  No directories added yet
                </div>
              ) : (
                settings.musicDirectories.map((directory, index) => (
                  <DirectoryItem key={index}>
                    <DirectoryPath>{directory}</DirectoryPath>
                    <RemoveButton onClick={() => handleRemoveDirectory(directory)}>
                      Remove
                    </RemoveButton>
                  </DirectoryItem>
                ))
              )}
            </DirectoriesList>

            <AddDirectoryButton 
              onClick={handleAddDirectory}
              disabled={isAddingDirectory}
            >
              {isAddingDirectory ? 'Selecting...' : 'Add Directory'}
            </AddDirectoryButton>
          </SettingsSection>

          <SettingsSection>
            <SectionTitle>Scan Options</SectionTitle>
            <SectionDescription>
              Configure how the app scans and monitors your music directories.
            </SectionDescription>

            <SettingRow>
              <SettingLabel>
                Watch for Changes
                <SettingDescription>
                  Automatically detect when files are added, modified, or removed
                </SettingDescription>
              </SettingLabel>
              <Toggle
                checked={settings.watchForChanges}
                onChange={(e) => handleSettingChange('watchForChanges', e.target.checked)}
              />
            </SettingRow>

            <SettingRow>
              <SettingLabel>
                Scan on Startup
                <SettingDescription>
                  Automatically scan for new files when the app starts
                </SettingDescription>
              </SettingLabel>
              <Toggle
                checked={settings.scanOnStartup}
                onChange={(e) => handleSettingChange('scanOnStartup', e.target.checked)}
              />
            </SettingRow>

            <SettingRow>
              <SettingLabel>
                Auto-index New Files
                <SettingDescription>
                  Automatically add new files found in watched directories
                </SettingDescription>
              </SettingLabel>
              <Toggle
                checked={settings.autoIndexNewFiles}
                onChange={(e) => handleSettingChange('autoIndexNewFiles', e.target.checked)}
              />
            </SettingRow>

            <SettingRow>
              <SettingLabel>
                Include Subdirectories
                <SettingDescription>
                  Scan all subdirectories within music directories
                </SettingDescription>
              </SettingLabel>
              <Toggle
                checked={settings.includeSubdirectories}
                onChange={(e) => handleSettingChange('includeSubdirectories', e.target.checked)}
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection>
            <SectionTitle>Library Scan</SectionTitle>
            <SectionDescription>
              Manually scan your music directories for new or changed files.
            </SectionDescription>

            {scanProgress.isScanning && (
              <ScanProgress>
                <ProgressBar>
                  <ProgressFill progress={scanProgress.progress} />
                </ProgressBar>
                <ProgressText>
                  <span>
                    {scanProgress.scannedFiles} of {scanProgress.totalFiles} files
                  </span>
                  <span>{Math.round(scanProgress.progress)}%</span>
                </ProgressText>
                {scanProgress.currentFile && (
                  <div style={{ 
                    color: 'rgba(255, 255, 255, 0.6)', 
                    fontSize: '11px', 
                    marginTop: '4px',
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {scanProgress.currentFile}
                  </div>
                )}
              </ScanProgress>
            )}

            <ScanActions>
              <ScanButton 
                onClick={handleStartScan}
                disabled={scanProgress.isScanning || settings.musicDirectories.length === 0}
              >
                {scanProgress.isScanning ? 'Scanning...' : 'Start Scan'}
              </ScanButton>
            </ScanActions>

            {scanProgress.errors.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ color: 'white', fontSize: '14px', marginBottom: '8px' }}>
                  Scan Errors ({scanProgress.errors.length}):
                </div>
                {scanProgress.errors.slice(0, 5).map((error, index) => (
                  <ErrorMessage key={index}>{error}</ErrorMessage>
                ))}
                {scanProgress.errors.length > 5 && (
                  <div style={{ 
                    color: 'rgba(255, 255, 255, 0.6)', 
                    fontSize: '12px', 
                    marginTop: '8px' 
                  }}>
                    ... and {scanProgress.errors.length - 5} more errors
                  </div>
                )}
              </div>
            )}
          </SettingsSection>
        </ScrollArea>
      </SettingsContent>
    </SettingsContainer>
  );
};

export default LocalLibrarySettings;