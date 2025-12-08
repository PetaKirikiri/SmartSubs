import React from 'react';
import TaskbarPane from '../content/TaskbarPane.jsx';
import { SubtitleStagePanel } from '../content/SubtitleStagePanel.jsx';
import { readAndParseSubtitleFile } from '../content/srtUpload.js';
import { showSRTUploadModal } from '../content/srtUploadModal.js';

export default function SubtitlePane({
  subtitle,
  displayMode,
  taskbarChildren,
  dependencies,
  onScriptConfirmed,
  onSkip,
  onSplitRequested,
  onSplitEditRequested,
  onSplitConfirmed,
  onWordDataRequested,
  onWordReviewConfirmed,
  onWordClicked,
  onReopenForEdit
}) {
  const handleUploadClick = async (file) => {
    try {
      const parsedSubtitles = await readAndParseSubtitleFile(file);
      const overlay = document.getElementById('smart-subs-overlay');
      const fileInput = document.createElement('input');
      
      if (overlay && dependencies) {
        await showSRTUploadModal(dependencies, overlay, fileInput, file, parsedSubtitles);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%'
    }}>
      <TaskbarPane onUploadClick={handleUploadClick}>
        {taskbarChildren}
      </TaskbarPane>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <SubtitleStagePanel
          subtitle={subtitle}
          displayMode={displayMode}
          onScriptConfirmed={onScriptConfirmed}
          onSkip={onSkip}
          onSplitRequested={onSplitRequested}
          onSplitEditRequested={onSplitEditRequested}
          onSplitConfirmed={onSplitConfirmed}
          onWordDataRequested={onWordDataRequested}
          onWordReviewConfirmed={onWordReviewConfirmed}
          onWordClicked={onWordClicked}
          onReopenForEdit={onReopenForEdit}
        />
      </div>
    </div>
  );
}

