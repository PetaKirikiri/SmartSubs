(function() {
  'use strict';

  window.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== 'SMARTSUBS_SEEK' || typeof event.data.timeSeconds !== 'number') {
      return;
    }

    const timeSeconds = event.data.timeSeconds;
    if (isNaN(timeSeconds) || timeSeconds < 0) {
      return;
    }

    try {
      const appContext = window.netflix?.appContext;
      if (!appContext?.state?.playerApp) {
        return;
      }

      const getAPI = appContext.state.playerApp.getAPI;
      if (!getAPI || typeof getAPI !== 'function') {
        return;
      }

      const videoPlayerAPI = getAPI()?.videoPlayer;
      if (!videoPlayerAPI) {
        return;
      }

      const getAllPlayerSessionIds = videoPlayerAPI.getAllPlayerSessionIds;
      if (!getAllPlayerSessionIds || typeof getAllPlayerSessionIds !== 'function') {
        return;
      }

      const sessionIds = getAllPlayerSessionIds();
      if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
        return;
      }

      const player = videoPlayerAPI.getVideoPlayerBySessionId(sessionIds[0]);
      if (!player || typeof player.seek !== 'function') {
        return;
      }

      const targetMs = Math.round(timeSeconds * 1000);
      if (targetMs < 0) {
        return;
      }

      player.seek(targetMs);
    } catch (error) {
      // Silently fail - Netflix API may not be available or may have changed
    }
  });
})();
