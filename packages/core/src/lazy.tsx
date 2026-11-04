import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * React.lazy for a named export, keeping its props type:
 *   const Page = lazyPage(() => import('./pages/Page'), 'Page');
 * Each page becomes its own chunk, loaded on first visit (and preloaded on link hover).
 */
export function lazyPage<M, K extends keyof M>(
  load: () => Promise<M>,
  name: K,
): M[K] extends ComponentType<infer P> ? LazyExoticComponent<ComponentType<P>> : never {
  return lazy(async () => ({ default: (await load())[name] as ComponentType<unknown> })) as never;
}
