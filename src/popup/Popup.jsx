import React, { useState, useEffect } from 'react'
import { parseSubtitlesFromText } from '../utils/srtParser.js'
// TODO: These functions need to be implemented or moved
const bulkUploadSubtitles = async () => { throw new Error('Not implemented'); };
const checkExistingEpisode = async () => { return false; };

function Popup() {
  const [file, setFile] = useState(null)
  const [parsedSubtitles, setParsedSubtitles] = useState(null)
  const [uploadStatus, setUploadStatus] = useState(null) // { type: 'uploading'|'success'|'error', message: string, progress?: number }
  const [isUploading, setIsUploading] = useState(false)
  const [mediaMeta, setMediaMeta] = useState(null) // { platform: 'netflix', mediaId: string, title?: string, seasonNumber?: number, episodeNumber?: number }
  const [tableName, setTableName] = useState('')
  const [season, setSeason] = useState('')
  const [episode, setEpisode] = useState('')
  const [existingEpisodeFound, setExistingEpisodeFound] = useState(false)
  const [userConfirmedOverwrite, setUserConfirmedOverwrite] = useState(false)
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)

  // Read media metadata from chrome.storage on mount
  useEffect(() => {
    chrome.storage.local.get(['smartsubs_media_meta'], (result) => {
      if (result.smartsubs_media_meta) {
        setMediaMeta(result.smartsubs_media_meta)
        // Prefill season/episode if available
        if (result.smartsubs_media_meta.seasonNumber) {
          setSeason(String(result.smartsubs_media_meta.seasonNumber))
        }
        if (result.smartsubs_media_meta.episodeNumber) {
          setEpisode(String(result.smartsubs_media_meta.episodeNumber))
        }
      }
    })
  }, [])

  // Check for existing episode when tableName and mediaId are available
  useEffect(() => {
    const checkDuplicates = async () => {
      if (tableName && tableName.trim() !== '' && mediaMeta?.mediaId) {
        setCheckingDuplicates(true)
        setExistingEpisodeFound(false)
        setUserConfirmedOverwrite(false)
        
        try {
          const exists = await checkExistingEpisode(tableName.trim(), mediaMeta.mediaId)
          setExistingEpisodeFound(exists)
        } catch (error) {
          // Allow upload by default if check fails
          setExistingEpisodeFound(false)
        } finally {
          setCheckingDuplicates(false)
        }
      } else {
        // Reset state if conditions not met
        setExistingEpisodeFound(false)
        setUserConfirmedOverwrite(false)
      }
    }

    checkDuplicates()
  }, [tableName, mediaMeta?.mediaId])

  const completedSteps = [
    { id: 1, label: 'Chrome Extension setup (Manifest V3)', status: 'completed' },
    { id: 2, label: 'Content script injection on Netflix watch pages', status: 'completed' },
    { id: 3, label: 'Subtitle overlay display with hard-coded Thai text', status: 'completed' },
    { id: 4, label: 'Edit icon and inline text editing functionality', status: 'completed' },
    { id: 5, label: 'Save functionality (updates overlay display)', status: 'completed' },
    { id: 6, label: 'Popup UI with React + Tailwind', status: 'completed' },
    { id: 7, label: 'Vite build configuration for extension', status: 'completed' },
    { id: 8, label: 'Airtable API integration setup', status: 'completed' },
    { id: 9, label: 'Detect current video timestamp from Netflix player', status: 'completed' },
    { id: 10, label: 'Load subtitles from Airtable by timestamp', status: 'completed' },
    { id: 12, label: 'Save edited subtitles to Airtable with timestamp', status: 'completed' },
  ]

  const pendingSteps = [
    { id: 11, label: 'Extract original Netflix subtitle text from DOM', status: 'pending' },
    { id: 13, label: 'Word tokenization for subtitle text', status: 'pending' },
    { id: 14, label: 'Clickable words with grammar/vocabulary info', status: 'pending' },
    { id: 15, label: 'Sync overlay with Netflix subtitle timing', status: 'pending' },
    { id: 16, label: 'Persistence across page reloads', status: 'pending' },
  ]

  const handleFileSelect = async (event) => {
    const selectedFile = event.target.files[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setUploadStatus(null)
    setParsedSubtitles(null)
    setExistingEpisodeFound(false)
    setUserConfirmedOverwrite(false)

    // Read file content
    try {
      const text = await selectedFile.text()
      const subtitles = parseSubtitlesFromText(text)

      setParsedSubtitles(subtitles)
      setUploadStatus({
        type: 'success',
        message: `Parsed ${subtitles.length} subtitles successfully. Ready to upload.`
      })
    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: `Error parsing subtitle file: ${error.message}`
      })
    }
  }

  const handleUpload = async () => {
    if (!parsedSubtitles || parsedSubtitles.length === 0) {
      setUploadStatus({
        type: 'error',
        message: 'No subtitles to upload. Please select an SRT file first.'
      })
      return
    }

    if (!tableName || tableName.trim() === '') {
      setUploadStatus({
        type: 'error',
        message: 'Please enter a target Airtable table name.'
      })
      return
    }

    setIsUploading(true)
    setUploadStatus({
      type: 'uploading',
      message: 'Uploading subtitles...',
      progress: 0
    })

    try {
      const options = {
        tableName: tableName.trim(),
        mediaId: mediaMeta?.mediaId || null,
        season: season ? parseInt(season, 10) : null,
        episode: episode ? parseInt(episode, 10) : null
      }

      const result = await bulkUploadSubtitles(parsedSubtitles, (current, total) => {
        setUploadStatus({
          type: 'uploading',
          message: `Uploading... ${current}/${total}`,
          progress: Math.round((current / total) * 100)
        })
      }, options)

      if (result.failed > 0) {
        setUploadStatus({
          type: 'error',
          message: `Upload completed with errors: ${result.success} succeeded, ${result.failed} failed.`
        })
      } else {
        setUploadStatus({
          type: 'success',
          message: `Successfully uploaded ${result.success} subtitles to Airtable!`
        })
        // Clear parsed data and form fields after successful upload
        setParsedSubtitles(null)
        setFile(null)
        setTableName('')
        setSeason('')
        setEpisode('')
        setExistingEpisodeFound(false)
        setUserConfirmedOverwrite(false)
        // Reset file input
        const fileInput = document.getElementById('srt-file-input')
        if (fileInput) fileInput.value = ''
      }
    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: `Upload failed: ${error.message}`
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="w-96 p-6 bg-white">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Smart Subs</h1>
      <p className="text-sm text-gray-600 mb-6">
        Edit and enhance Netflix subtitles for language learning
      </p>

      {/* Integration Status Section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Integration Status</h2>
        
        {/* Completed Steps */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-green-700">✓ Completed ({completedSteps.length})</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {completedSteps.map((step) => (
              <div key={step.id} className="flex items-start gap-2 text-sm">
                <span className="text-green-600 mt-0.5">✓</span>
                <span className="text-gray-700">{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Steps */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-amber-700">⏳ Pending ({pendingSteps.length})</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {pendingSteps.map((step) => (
              <div key={step.id} className="flex items-start gap-2 text-sm">
                <span className="text-amber-600 mt-0.5">○</span>
                <span className="text-gray-600">{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SRT Upload Section */}
      <div className="border-t pt-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Upload Subtitle File</h2>
        
        <div className="space-y-3">
          {/* File Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Subtitle File (SRT or WebVTT)
            </label>
            <input
              id="srt-file-input"
              type="file"
              accept=".srt,.vtt"
              onChange={handleFileSelect}
              disabled={isUploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Preview */}
          {parsedSubtitles && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-700 mb-1">
                <span className="font-medium">Parsed:</span> {parsedSubtitles.length} subtitles
              </p>
              {parsedSubtitles.length > 0 && (
                <div className="text-xs text-gray-600 mt-2 max-h-32 overflow-y-auto">
                  <p className="font-medium mb-1">First subtitle:</p>
                  <p className="font-mono text-xs">{parsedSubtitles[0].startSec}s → {parsedSubtitles[0].endSec}s</p>
                  <p className="text-xs mt-1">{parsedSubtitles[0].text.substring(0, 100)}...</p>
                </div>
              )}
            </div>
          )}

          {/* Mapping Section */}
          {parsedSubtitles && parsedSubtitles.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">Mapping</h3>
              
              {/* Media ID (read-only) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Media ID
                </label>
                <input
                  type="text"
                  value={mediaMeta?.mediaId || 'Unknown'}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-100 text-gray-600"
                />
              </div>

              {/* Target Table Name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Target Airtable table name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="e.g., BlueEyeSamurai"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Season and Episode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Season (optional)
                  </label>
                  <input
                    type="number"
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    placeholder="e.g., 1"
                    min="1"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Episode (optional)
                  </label>
                  <input
                    type="number"
                    value={episode}
                    onChange={(e) => setEpisode(e.target.value)}
                    placeholder="e.g., 1"
                    min="1"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Duplicate Warning */}
          {existingEpisodeFound && !userConfirmedOverwrite && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-900 mb-2">
                Subtitles already exist in Airtable for this episode. Continue?
              </p>
              <button
                onClick={() => setUserConfirmedOverwrite(true)}
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium py-1.5 px-3 rounded-md transition-colors"
              >
                Proceed anyway
              </button>
            </div>
          )}

          {/* Upload Button */}
          {parsedSubtitles && parsedSubtitles.length > 0 && (
            <button
              onClick={handleUpload}
              disabled={
                isUploading || 
                !tableName || 
                tableName.trim() === '' || 
                checkingDuplicates ||
                (existingEpisodeFound && !userConfirmedOverwrite)
              }
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {checkingDuplicates 
                ? 'Checking for duplicates...' 
                : isUploading 
                ? 'Uploading...' 
                : `Upload ${parsedSubtitles.length} Subtitles to Airtable`}
            </button>
          )}

          {/* Status Messages */}
          {uploadStatus && (
            <div className={`rounded-lg p-3 ${
              uploadStatus.type === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : uploadStatus.type === 'error'
                ? 'bg-red-50 border border-red-200'
                : 'bg-blue-50 border border-blue-200'
            }`}>
              <p className={`text-xs font-medium ${
                uploadStatus.type === 'success'
                  ? 'text-green-900'
                  : uploadStatus.type === 'error'
                  ? 'text-red-900'
                  : 'text-blue-900'
              }`}>
                {uploadStatus.message}
              </p>
              {uploadStatus.progress !== undefined && uploadStatus.progress > 0 && (
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadStatus.progress}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Current Status */}
      <div className="border-t pt-4 mt-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
          <p className="text-xs font-medium text-green-900 mb-1">Current Functionality:</p>
          <p className="text-xs text-green-800">
            The extension now loads subtitles from Airtable based on the current video timestamp. 
            The overlay displays Thai text that matches the current playback time. You can upload SRT files to bulk import subtitles.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-medium text-amber-900 mb-1">Next Steps:</p>
          <p className="text-xs text-amber-800">
            Next: Add word tokenization, clickable words with grammar/vocabulary info, and sync overlay timing with Netflix subtitles.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Popup
