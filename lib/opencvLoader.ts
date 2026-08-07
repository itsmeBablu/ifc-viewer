/**
 * Lazy-load OpenCV.js via CDN script (client-only).
 * Avoids bundling the huge WASM blob through Next/Turbopack.
 */

export type CvRuntime = {
  Mat: new (...args: unknown[]) => { delete: () => void };
  matFromImageData: (img: ImageData) => { delete: () => void };
  [key: string]: unknown;
};

declare global {
  interface Window {
    cv?: CvRuntime & {
      onRuntimeInitialized?: () => void;
      then?: (onFulfilled: (cv: CvRuntime) => void) => void;
    };
  }
}

const OPENCV_CDN = "https://docs.opencv.org/4.10.0/opencv.js";

let loadPromise: Promise<CvRuntime> | null = null;

function waitForCv(cv: NonNullable<Window["cv"]>): Promise<CvRuntime> {
  return new Promise((resolve, reject) => {
    const finish = (ready: CvRuntime) => {
      if (!ready?.Mat) {
        reject(new Error("OpenCV.js loaded without Mat"));
        return;
      }
      resolve(ready);
    };
    if (cv.Mat) {
      finish(cv);
      return;
    }
    if (typeof cv.then === "function") {
      cv.then((ready) => finish(ready));
      return;
    }
    const prev = cv.onRuntimeInitialized;
    cv.onRuntimeInitialized = () => {
      prev?.();
      finish(cv as CvRuntime);
    };
    window.setTimeout(() => {
      if (cv.Mat) finish(cv as CvRuntime);
      else reject(new Error("OpenCV.js init timed out"));
    }, 30000);
  });
}

/** Load OpenCV.js once; safe to call repeatedly. Browser-only. */
export function loadOpenCv(): Promise<CvRuntime> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV.js requires a browser"));
  }
  if (window.cv?.Mat) return Promise.resolve(window.cv as CvRuntime);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<CvRuntime>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-opencv-js="1"]',
    );
    if (existing && window.cv) {
      waitForCv(window.cv).then(resolve, reject);
      return;
    }
    const script = document.createElement("script");
    script.src = OPENCV_CDN;
    script.async = true;
    script.dataset.opencvJs = "1";
    script.onload = () => {
      if (!window.cv) {
        reject(new Error("OpenCV.js script loaded but window.cv missing"));
        return;
      }
      waitForCv(window.cv).then(resolve, reject);
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load OpenCV.js from CDN"));
    };
    document.head.appendChild(script);
  }).catch((err) => {
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}
