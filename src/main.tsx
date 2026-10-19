// Force-disable React DevTools profiling hooks to bypass a known browser extension bug in React 19.
// This prevents the runtime crash "Internal React error: Expected static flag was missing."
if (typeof window !== 'undefined') {
  const dummyHook = {
    isDisabled: true,
    supportsFiber: true,
    inject: () => {},
    onCommitFiberRoot: () => {},
    onCommitFiberUnmount: () => {},
  };
  Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
    value: dummyHook,
    writable: false,
    configurable: true,
  });
}

// Add ES2025 Map.prototype.getOrInsert and getOrInsertComputed polyfills
// to support newer libraries like framer-motion/motion v12 which use them
if (typeof Map !== 'undefined') {
  if (!(Map.prototype as any).getOrInsert) {
    (Map.prototype as any).getOrInsert = function (this: Map<any, any>, key: any, value: any) {
      if (this.has(key)) {
        return this.get(key);
      }
      this.set(key, value);
      return value;
    };
  }

  if (!(Map.prototype as any).getOrInsertComputed) {
    (Map.prototype as any).getOrInsertComputed = function (this: Map<any, any>, key: any, callback: (key: any, map: Map<any, any>) => any) {
      if (this.has(key)) {
        return this.get(key);
      }
      const value = callback(key, this);
      this.set(key, value);
      return value;
    };
  }
}

// Add ES2025 WeakMap.prototype.getOrInsert and getOrInsertComputed polyfills
if (typeof WeakMap !== 'undefined') {
  if (!(WeakMap.prototype as any).getOrInsert) {
    (WeakMap.prototype as any).getOrInsert = function (this: WeakMap<any, any>, key: any, value: any) {
      if (this.has(key)) {
        return this.get(key);
      }
      this.set(key, value);
      return value;
    };
  }

  if (!(WeakMap.prototype as any).getOrInsertComputed) {
    (WeakMap.prototype as any).getOrInsertComputed = function (this: WeakMap<any, any>, key: any, callback: (key: any, map: WeakMap<any, any>) => any) {
      if (this.has(key)) {
        return this.get(key);
      }
      const value = callback(key, this);
      this.set(key, value);
      return value;
    };
  }
}

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <App />
);

