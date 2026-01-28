/**
 * Report Object Structure Schema
 * This is ONLY a structure definition - no logic, no functions
 * Contains ONLY what the report table needs to display
 */

/**
 * Complete report object structure
 * Helper-first architecture - flat by helper name
 */
export const REPORT_OBJECT_SCHEMA = {
  reportVersion: '2.0',
  subtitleId: null,
  helpers: {
    // 'helper-name.js': {
    //   helper: 'helper-name.js',
    //   needsWork: false,
    //   needsSave: false,
    //   fields: [
    //     {
    //       field: 'thai',
    //       fieldPath: 'thai',
    //       workmap: false,
    //       helperCalled: 'parse-vtt.js',
    //       cached: false,
    //       saved: false,
    //       displayed: false,
    //       present: false,
    //       dataLoaded: false,
    //       dataStatus: 'clean',
    //       validation: false,
    //       value: null,
    //       error: null
    //     },
    //     ...
    //   ]
    // }
  }
};
