/** QA-only renderer selection. Hardware/native acceptance remains a separate gate. */
export function motionRendererArgs({ paint = false } = {}) {
  const renderer = process.env.QP_MOTION_RENDERER ?? 'default';
  if (renderer !== 'default' && renderer !== 'software')
    throw new Error('QP_MOTION_RENDERER must be default or software');
  if (paint) return ['--disable-gpu', '--deterministic-mode', '--disable-skia-runtime-opts', '--force-color-profile=srgb'];
  return renderer === 'software' ? ['--force-color-profile=srgb', '--disable-gpu'] : ['--force-color-profile=srgb'];
}
