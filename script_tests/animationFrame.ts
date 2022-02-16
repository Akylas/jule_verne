export const requestAnimationFrame = setImmediate;
export const cancelAnimationFrame = (...args) => {};
export const getNow = Date.now.bind(Date);
