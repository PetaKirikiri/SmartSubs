import React, { useState, useEffect } from 'react';

export default function SrtUpload({
  isOpen,
  onClose,
  onSubmit,
  tables = [],
  currentTableName = null,
  mediaMeta = null,
  parsedSubtitleCount = 0,
  fileName = '',
  statusSummary = null,
  parsedSubtitles = []
}) {
  const [tableName, setTableName] = useState(currentTableName || '');
  const [season, setSeason] = useState(mediaMeta?.seasonNumber ? String(mediaMeta.seasonNumber) : '');
  const [episode, setEpisode] = useState(mediaMeta?.episodeNumber ? String(mediaMeta.episodeNumber) : '');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (currentTableName) {
      setTableName(currentTableName);
    }
  }, [currentTableName]);

  useEffect(() => {
    if (mediaMeta?.seasonNumber) {
      setSeason(String(mediaMeta.seasonNumber));
    }
    if (mediaMeta?.episodeNumber) {
      setEpisode(String(mediaMeta.episodeNumber));
    }
  }, [mediaMeta]);

  if (!isOpen) return null;

  const mediaId = mediaMeta?.mediaId || null;
  const duration = mediaMeta?.duration ? Math.floor(mediaMeta.duration) : null;
  const title = mediaMeta?.title || null;

  const handleSubmit = async () => {
    if (!tableName || tableName.trim() === '') {
      alert('Please select a target Airtable table name.');
      return;
    }

    if (!mediaId) {
      alert('Media ID is required. Please ensure you are on a Netflix watch page.');
      return;
    }

    if (!parsedSubtitles || parsedSubtitles.length === 0) {
      alert('No subtitles to upload. Please select a valid subtitle file.');
      return;
    }

    setIsUploading(true);

    const submitData = {
      tableName: tableName.trim(),
      mediaId: mediaId,
      duration: duration,
      season: season.trim() ? parseInt(season.trim(), 10) : null,
      episode: episode.trim() ? parseInt(episode.trim(), 10) : null
    };

    try {
      await onSubmit(submitData, parsedSubtitles);
      setIsUploading(false);
    } catch (error) {
      setIsUploading(false);
      // Error is already handled in onSubmit
    }
  };

  const canUpload = tableName && tableName.trim() !== '' && mediaId;

  return (
    <div style={{
      width: '90%',
      maxWidth: '600px',
      padding: '24px',
      color: '#FFD700',
      boxSizing: 'border-box',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      borderRadius: '8px',
      border: '2px solid rgba(255, 215, 0, 0.5)'
    }}>
      <h2 style={{
        marginTop: '0',
        marginBottom: '20px',
        fontSize: '20px',
        fontWeight: '600',
        color: '#FFD700'
      }}>
        Upload SRT File
      </h2>

      {statusSummary && (
        <div style={{
          marginBottom: '16px',
          padding: '8px 12px',
          backgroundColor: 'rgba(255, 215, 0, 0.1)',
          border: '1px solid rgba(255, 215, 0, 0.3)',
          borderRadius: '4px',
          color: 'rgba(255, 215, 0, 0.9)',
          fontSize: '14px'
        }}>
          {statusSummary}
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: '500',
          color: '#FFD700'
        }}>
          SRT File
        </label>
        <div style={{
          padding: '8px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 215, 0, 0.3)',
          borderRadius: '4px',
          color: 'rgba(255, 215, 0, 0.8)',
          fontSize: '14px'
        }}>
          {fileName} ({parsedSubtitleCount} subtitles)
        </div>
      </div>

      {title && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#FFD700'
          }}>
            Title
          </label>
          <input
            type="text"
            value={title}
            readOnly
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              borderRadius: '4px',
              color: 'rgba(255, 215, 0, 0.7)',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: '500',
          color: '#FFD700'
        }}>
          Media ID *
        </label>
        <input
          type="text"
          value={mediaId || ''}
          readOnly
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            borderRadius: '4px',
            color: 'rgba(255, 215, 0, 0.7)',
            fontSize: '14px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: '500',
          color: '#FFD700'
        }}>
          Duration (seconds)
        </label>
        <input
          type="text"
          value={duration !== null ? String(duration) : ''}
          readOnly
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            borderRadius: '4px',
            color: 'rgba(255, 215, 0, 0.7)',
            fontSize: '14px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: '500',
          color: '#FFD700'
        }}>
          Target Airtable Table Name *
        </label>
        <select
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(255, 215, 0, 0.5)',
            borderRadius: '4px',
            color: '#FFD700',
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            boxSizing: 'border-box',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          {!tableName && <option value="">Select a table…</option>}
          {tables.map(table => (
            <option key={table} value={table}>{table}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: '500',
          color: '#FFD700'
        }}>
          Season (optional)
        </label>
        <input
          type="number"
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          placeholder="Enter season number"
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(255, 215, 0, 0.5)',
            borderRadius: '4px',
            color: '#FFD700',
            fontSize: '14px',
            boxSizing: 'border-box',
            outline: 'none'
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: '500',
          color: '#FFD700'
        }}>
          Episode (optional)
        </label>
        <input
          type="number"
          value={episode}
          onChange={(e) => setEpisode(e.target.value)}
          placeholder="Enter episode number"
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(255, 215, 0, 0.5)',
            borderRadius: '4px',
            color: '#FFD700',
            fontSize: '14px',
            boxSizing: 'border-box',
            outline: 'none'
          }}
        />
      </div>

      <div style={{
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end',
        alignItems: 'center'
      }}>
        <button
          onClick={onClose}
          style={{
            padding: '10px 20px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 215, 0, 0.5)',
            borderRadius: '4px',
            color: '#FFD700',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canUpload || isUploading}
          style={{
            padding: '10px 20px',
            backgroundColor: (canUpload && !isUploading) ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 215, 0, 0.1)',
            border: '1px solid rgba(255, 215, 0, 0.5)',
            borderRadius: '4px',
            color: '#FFD700',
            cursor: (canUpload && !isUploading) ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: '600',
            opacity: (canUpload && !isUploading) ? 1 : 0.5
          }}
        >
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </div>
  );
}
