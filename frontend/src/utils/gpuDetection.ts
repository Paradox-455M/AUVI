export const checkWebGLSupport = (): boolean => {
  try { return !!(document.createElement('canvas').getContext('webgl')); } catch { return false; }
};
