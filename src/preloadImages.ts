import { Asset } from 'expo-asset';
import { IMAGE_MAP } from './imageMap';

export async function preloadOptimizedImages() {
  const mods = Object.values(IMAGE_MAP).flatMap(e => [e.thumb, e.detail]).filter(Boolean);
  await Promise.all(mods.map(m => Asset.fromModule(m as any).downloadAsync().catch(() => {})));
}
