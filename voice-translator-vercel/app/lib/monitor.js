// Lightweight client-side monitoring module for BarTalk
// Tracks errors, metrics, Web Vitals, and system health

let errorStore = [];
let metricsStore = {};
let startTime = Date.now();

// IndexedDB setup for persistent error storage
const initIndexedDB = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('vt-monitoring', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('vt-errors')) {
        db.createObjectStore('vt-errors', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

/**
 * Report an error to monitoring system
 * Logs to console and stores in IndexedDB (max 100 errors)
 */
export const reportError = async (error, context = {}) => {
  const timestamp = new Date().toISOString();
  const errorRecord = {
    timestamp,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
  };

  // Log to console
  console.error('[VT Monitor]', errorRecord.message, context);

  // Store in memory
  errorStore.push(errorRecord);
  if (errorStore.length > 100) {
    errorStore = errorStore.slice(-100);
  }

  // Persist to IndexedDB
  try {
    const db = await initIndexedDB();
    const transaction = db.transaction(['vt-errors'], 'readwrite');
    const store = transaction.objectStore('vt-errors');
    store.add(errorRecord);

    // Keep only last 100 errors
    const countRequest = store.count();
    countRequest.onsuccess = () => {
      if (countRequest.result > 100) {
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => {
          const allErrors = getAllRequest.result;
          for (let i = 0; i < allErrors.length - 100; i++) {
            store.delete(allErrors[i].id);
          }
        };
      }
    };
  } catch (e) {
    console.warn('[VT Monitor] IndexedDB unavailable:', e.message);
  }

  // Send to analytics endpoint (optional, fire-and-forget)
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics', JSON.stringify(errorRecord));
    }
  } catch (e) {
    // Silently fail
  }
};

/**
 * Report a performance metric
 * Stores in memory and optionally sends to analytics
 */
export const reportMetric = async (name, value, tags = {}) => {
  const metric = {
    name,
    value,
    tags,
    timestamp: new Date().toISOString(),
  };

  metricsStore[name] = metric;

  // Optional: Send to analytics endpoint
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics', JSON.stringify({ metric }));
    }
  } catch (e) {
    // Silently fail
  }
};

/**
 * Get stored error log from IndexedDB
 */
export const getErrorLog = async () => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['vt-errors'], 'readonly');
      const store = transaction.objectStore('vt-errors');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('[VT Monitor] Could not retrieve error log:', e.message);
    return errorStore;
  }
};

/**
 * Get comprehensive health report
 */
export const getHealthReport = async () => {
  const uptime = Date.now() - startTime;

  // Get average latency from stored metrics
  let avgLatency = 0;
  if (metricsStore['latency']) {
    avgLatency = metricsStore['latency'].value;
  }

  // Memory usage (if available)
  let memoryUsage = 0;
  if (typeof performance !== 'undefined' && performance.memory) {
    memoryUsage = performance.memory.usedJSHeapSize / 1048576; // Convert to MB
  }

  // Connection type (if available)
  let connectionType = 'unknown';
  if (typeof navigator !== 'undefined' && navigator.connection) {
    connectionType = navigator.connection.effectiveType || 'unknown';
  }

  const errorLog = await getErrorLog();

  return {
    uptime,
    errorCount: errorLog.length,
    avgLatency,
    memoryUsage,
    connectionType,
    timestamp: new Date().toISOString(),
    webVitals: {
      lcp: metricsStore['LCP']?.value || null,
      fid: metricsStore['FID']?.value || null,
      cls: metricsStore['CLS']?.value || null,
      ttfb: metricsStore['TTFB']?.value || null,
    },
  };
};

/**
 * Track Web Vitals via PerformanceObserver
 */
const initWebVitalsTracking = () => {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return;
  }

  // Largest Contentful Paint (LCP)
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      reportMetric('LCP', lastEntry.renderTime || lastEntry.loadTime, { vital: true });
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
  } catch (e) {
    console.warn('[VT Monitor] LCP observer failed:', e.message);
  }

  // Cumulative Layout Shift (CLS)
  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          reportMetric('CLS', clsValue, { vital: true });
        }
      }
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });
  } catch (e) {
    console.warn('[VT Monitor] CLS observer failed:', e.message);
  }

  // First Input Delay (FID) - deprecated but still tracked
  try {
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        reportMetric('FID', entry.processingDuration, { vital: true });
      });
    });
    fidObserver.observe({ entryTypes: ['first-input'] });
  } catch (e) {
    console.warn('[VT Monitor] FID observer failed:', e.message);
  }

  // Time to First Byte (TTFB)
  try {
    const ttfbObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.responseStart) {
          reportMetric('TTFB', entry.responseStart, { vital: true });
        }
      });
    });
    ttfbObserver.observe({ entryTypes: ['navigation'] });
  } catch (e) {
    console.warn('[VT Monitor] TTFB observer failed:', e.message);
  }
};

/**
 * Initialize global error handlers
 */
const initErrorHandlers = () => {
  if (typeof window === 'undefined') {
    return;
  }

  // Unhandled errors
  window.onerror = (message, source, lineno, colno, error) => {
    reportError(error || new Error(message), {
      source,
      lineno,
      colno,
      type: 'uncaught-error',
    });
    return true; // Prevent default handling
  };

  // Unhandled promise rejections
  window.onunhandledrejection = (event) => {
    reportError(event.reason || new Error('Unhandled promise rejection'), {
      type: 'unhandled-rejection',
    });
  };

  // Resource errors (images, scripts, etc.)
  window.addEventListener('error', (event) => {
    if (event.target !== window) {
      reportError(new Error(`Resource failed to load: ${event.target.src || event.target.href}`), {
        type: 'resource-error',
        url: event.target.src || event.target.href,
      });
    }
  }, true);
};

/**
 * Initialize all monitoring
 */
export const initMonitoring = () => {
  if (typeof window === 'undefined') {
    return;
  }

  console.log('[VT Monitor] Initializing monitoring system');

  // Set up error handlers
  initErrorHandlers();

  // Set up Web Vitals tracking
  initWebVitalsTracking();

  // Log initialization
  reportMetric('monitoring-initialized', 1, { timestamp: new Date().toISOString() });

  // Periodically check health (every 5 minutes)
  setInterval(async () => {
    try {
      const health = await getHealthReport();
      if (health.errorCount > 10) {
        console.warn('[VT Monitor] High error count detected:', health.errorCount);
      }
      if (health.memoryUsage > 100) {
        console.warn('[VT Monitor] High memory usage:', health.memoryUsage, 'MB');
      }
    } catch (e) {
      // Silently fail
    }
  }, 300000); // 5 minutes
};

export default {
  initMonitoring,
  reportError,
  reportMetric,
  getErrorLog,
  getHealthReport,
};
