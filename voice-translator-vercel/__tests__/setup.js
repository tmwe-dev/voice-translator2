// Vitest setup file
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Next.js server imports
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data, init) => ({
      ...new Response(JSON.stringify(data), init),
      json: async () => data,
      status: init?.status || 200,
    }),
    next: () => new Response(null),
  },
}));

// Mock localStorage
const store = {};
global.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, val) => { store[key] = String(val); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};
