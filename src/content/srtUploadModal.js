import React from 'react';
import { createRoot } from 'react-dom/client';
import SrtUpload from '../components/SrtUpload.jsx';
import { inspectNetflixMetadata } from './netflixMetadata.js';
import { fetchTablesFromAirtable } from '../services/airtableTables.js';

let modalRoot = null;

function getModalRoot() {
  if (modalRoot) return modalRoot;

  let modalContainer = document.getElementById('smart-subs-upload-modal-container');
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'smart-subs-upload-modal-container';
    modalContainer.style.position = 'fixed';
    modalContainer.style.top = '0';
    modalContainer.style.left = '0';
    modalContainer.style.right = '0';
    modalContainer.style.bottom = '0';
    modalContainer.style.width = '100vw';
    modalContainer.style.height = '100vh';
    modalContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
    modalContainer.style.zIndex = '2147483648';
    modalContainer.style.display = 'flex';
    modalContainer.style.alignItems = 'center';
    modalContainer.style.justifyContent = 'center';
    modalContainer.style.overflowY = 'auto';
    document.body.appendChild(modalContainer);
  }

  modalRoot = createRoot(modalContainer);
  return modalRoot;
}

// ModalWrapper component - handles state and data fetching
function ModalWrapper({ dependencies, file, parsedSubtitles }) {
  const [tables, setTables] = React.useState([]);
  const [statusSummary, setStatusSummary] = React.useState('');

  // Build mediaMeta from Netflix metadata
  const videoElement = React.useMemo(() => document.querySelector('video'), []);
  const netflixMetadata = React.useMemo(() => inspectNetflixMetadata(videoElement), [videoElement]);
  
  // Extract mediaId from URL or metadata
  const urlMatch = React.useMemo(() => window.location.pathname.match(/\/watch\/(\d+)/), []);
  const mediaId = React.useMemo(() => {
    if (urlMatch && urlMatch[1]) return urlMatch[1];
    return netflixMetadata.videoId || null;
  }, [urlMatch, netflixMetadata.videoId]);
  
  const mediaMeta = React.useMemo(() => ({
    platform: 'netflix',
    mediaId: mediaId,
    title: netflixMetadata.title || null,
    seasonNumber: netflixMetadata.season || null,
    episodeNumber: netflixMetadata.episode || null,
    duration: netflixMetadata.duration || null
  }), [mediaId, netflixMetadata]);

  // Fetch tables on mount
  React.useEffect(() => {
    async function loadTables() {
      setStatusSummary('Loading tables...');
      try {
        const fetchedTables = await fetchTablesFromAirtable();
        setTables(fetchedTables);
        setStatusSummary('');
      } catch (error) {
        setStatusSummary(`Error: ${error.message}`);
      }
    }
    loadTables();
  }, []);

  const handleSubmit = async (submitData, subtitles) => {
    if (dependencies.onUploadSubmit) {
      await dependencies.onUploadSubmit(submitData, subtitles || parsedSubtitles);
    }
  };

  const handleClose = () => {
    hideSRTUploadModal();
  };

  return React.createElement(SrtUpload, {
    isOpen: true,
    onClose: handleClose,
    onSubmit: handleSubmit,
    tables: tables,
    currentTableName: dependencies.currentTableName || null,
    mediaMeta: mediaMeta,
    parsedSubtitleCount: parsedSubtitles?.length || 0,
    fileName: file?.name || '',
    statusSummary: statusSummary || null,
    parsedSubtitles: parsedSubtitles || []
  });
}

export async function showSRTUploadModal(dependencies, overlay, fileInput, file, parsedSubtitles) {
  const root = getModalRoot();
  if (!root) {
    return;
  }

  // Ensure modal container is visible
  const modalContainer = document.getElementById('smart-subs-upload-modal-container');
  if (modalContainer) {
    modalContainer.style.display = 'flex';
  }

  // Render modal wrapper component that handles state
  root.render(
    React.createElement(ModalWrapper, {
      dependencies,
      file,
      parsedSubtitles
    })
  );
}

export function hideSRTUploadModal() {
  const modalContainer = document.getElementById('smart-subs-upload-modal-container');
  if (modalContainer) {
    modalContainer.style.display = 'none';
  }

  if (modalRoot) {
    modalRoot.render(null);
  }
}

