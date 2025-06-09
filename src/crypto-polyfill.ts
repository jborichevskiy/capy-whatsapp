// Crypto polyfill for Baileys compatibility with Node.js 18
import * as nodeCrypto from 'node:crypto';

// Set up globalThis.crypto for Baileys
if (!globalThis.crypto) {
  try {
    // Try using webcrypto from node:crypto first
    Object.defineProperty(globalThis, 'crypto', {
      value: nodeCrypto.webcrypto,
      writable: false,
      enumerable: true,
      configurable: false
    });
    console.log('🔐 Crypto polyfill loaded (using webcrypto)');
  } catch (error) {
    // Fallback to crypto module directly
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        subtle: (nodeCrypto as any).webcrypto?.subtle || {
          digest: async (algorithm: string, data: any) => {
            const hash = nodeCrypto.createHash(algorithm.replace('-', '').toLowerCase());
            hash.update(data);
            return hash.digest();
          }
        },
        getRandomValues: (array: any) => {
          return nodeCrypto.randomFillSync(array);
        }
      },
      writable: false,
      enumerable: true,
      configurable: false
    });
    console.log('🔐 Crypto polyfill loaded (using fallback)');
  }
}

// Also ensure window.crypto exists for any browser-like code
if (typeof window !== 'undefined' && !window.crypto) {
  (window as any).crypto = globalThis.crypto;
} 