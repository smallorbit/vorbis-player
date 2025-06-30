import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { videoManagementService } from '../services/videoManagementService';
import { trackVideoAssociationService } from '../services/trackVideoAssociationService';
import VideoManagementSettings from './VideoManagementSettings';

const Container = styled.div`
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 1rem;
  color: white;
`;

const Title = styled.h1`
  color: white;
  margin-bottom: 2rem;
  text-align: center;
`;

const Section = styled.div`
  margin-bottom: 2rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 0.5rem;
`;

const SectionTitle = styled.h2`
  color: rgba(255, 215, 0, 0.9);
  font-size: 1.2rem;
  margin-bottom: 1rem;
`;

const ActionButton = styled.button`
  background: rgba(255, 215, 0, 0.8);
  color: black;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  margin-right: 0.5rem;
  margin-bottom: 0.5rem;
  font-weight: 500;
  
  &:hover {
    opacity: 0.8;
  }
`;

const InfoBox = styled.div`
  background: rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 0.5rem;
  margin: 1rem 0;
  font-family: monospace;
  font-size: 0.9rem;
`;

const VideoManagementDemo = () => {
  const [stats, setStats] = useState(videoManagementService.getManagementStats());
  const [preferences, setPreferences] = useState(videoManagementService.getPreferences());
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    // Refresh stats when component mounts
    setStats(videoManagementService.getManagementStats());
    setPreferences(videoManagementService.getPreferences());
  }, []);

  const refreshData = () => {
    setStats(videoManagementService.getManagementStats());
    setPreferences(videoManagementService.getPreferences());
  };

  const runBasicTests = () => {
    const results: string[] = [];
    
    try {
      // Test 1: Create a mock track-video association
      const mockTrack = {
        id: 'test-track-1',
        name: 'Test Song',
        artists: 'Test Artist',
        album: 'Test Album',
        duration_ms: 180000,
        uri: 'spotify:track:test',
      };

      results.push('✓ Created mock track data');

      // Test 2: Set a video association
      const result = videoManagementService.setVideoForTrack(
        mockTrack,
        'dQw4w9WgXcQ', // Rick Roll video ID
        'Rick Astley - Never Gonna Give You Up',
        'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
      );

      if (result) {
        results.push('✓ Successfully set video association');
      } else {
        results.push('✗ Failed to set video association');
      }

      // Test 3: Retrieve the association
      const association = trackVideoAssociationService.getVideoForTrack(mockTrack.id);
      if (association && association.videoId === 'dQw4w9WgXcQ') {
        results.push('✓ Successfully retrieved video association');
      } else {
        results.push('✗ Failed to retrieve video association');
      }

      // Test 4: Test URL validation
      const validUrl = videoManagementService.validateYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      if (validUrl.valid && validUrl.videoId === 'dQw4w9WgXcQ') {
        results.push('✓ URL validation works correctly');
      } else {
        results.push('✗ URL validation failed');
      }

      // Test 5: Test preferences
      const currentPrefs = videoManagementService.getPreferences();
      videoManagementService.updatePreferences({ rememberVideoChoices: !currentPrefs.rememberVideoChoices });
      const updatedPrefs = videoManagementService.getPreferences();
      
      if (updatedPrefs.rememberVideoChoices !== currentPrefs.rememberVideoChoices) {
        results.push('✓ Preferences update works');
        // Restore original preference
        videoManagementService.updatePreferences({ rememberVideoChoices: currentPrefs.rememberVideoChoices });
      } else {
        results.push('✗ Preferences update failed');
      }

      // Test 6: Test backup/restore
      const backupData = videoManagementService.exportData();
      if (backupData && backupData.includes('associations')) {
        results.push('✓ Export functionality works');
        
        // Test import (this will overwrite current data)
        const importSuccess = videoManagementService.importData(backupData);
        if (importSuccess.success) {
          results.push('✓ Import functionality works');
        } else {
          results.push('✗ Import functionality failed');
        }
      } else {
        results.push('✗ Export functionality failed');
      }

      results.push('');
      results.push('All basic tests completed!');
      
    } catch (error) {
      results.push(`✗ Error during testing: ${error}`);
    }

    setTestResults(results);
    refreshData();
  };

  const clearTestData = () => {
    const result = videoManagementService.clearAllAssociations();
    if (result.success) {
      setTestResults(['✓ All test data cleared']);
      refreshData();
    } else {
      setTestResults(['✗ Failed to clear test data']);
    }
  };

  return (
    <Container>
      <Title>Video Management System Demo</Title>
      
      <Section>
        <SectionTitle>Current Statistics</SectionTitle>
        <InfoBox>
          Total Associations: {stats.totalAssociations}<br/>
          User Set: {stats.userSetCount}<br/>
          Auto Discovered: {stats.autoDiscoveredCount}<br/>
          {stats.oldestAssociation && `Oldest: ${new Date(stats.oldestAssociation).toLocaleDateString()}`}<br/>
          {stats.newestAssociation && `Newest: ${new Date(stats.newestAssociation).toLocaleDateString()}`}
        </InfoBox>
      </Section>

      <Section>
        <SectionTitle>Current Preferences</SectionTitle>
        <InfoBox>
          Remember Video Choices: {preferences.rememberVideoChoices ? 'Yes' : 'No'}<br/>
          Auto Play Next: {preferences.autoPlayNext ? 'Yes' : 'No'}<br/>
          Backup Enabled: {preferences.backupEnabled ? 'Yes' : 'No'}
        </InfoBox>
      </Section>

      <Section>
        <SectionTitle>Test Operations</SectionTitle>
        <ActionButton onClick={runBasicTests}>
          Run Basic Tests
        </ActionButton>
        <ActionButton onClick={clearTestData}>
          Clear Test Data
        </ActionButton>
        <ActionButton onClick={refreshData}>
          Refresh Data
        </ActionButton>
        
        {testResults.length > 0 && (
          <InfoBox>
            {testResults.map((result, index) => (
              <div key={index}>{result}</div>
            ))}
          </InfoBox>
        )}
      </Section>

      <Section>
        <SectionTitle>Video Management Settings</SectionTitle>
        <VideoManagementSettings />
      </Section>
    </Container>
  );
};

export default VideoManagementDemo;