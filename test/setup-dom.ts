import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// findBy* waits up to 10s: role queries on a full app page are slow in jsdom on small machines.
configure({ asyncUtilTimeout: 10_000 });

afterEach(() => cleanup());
