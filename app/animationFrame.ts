const requestAnimationFrameFn = requestAnimationFrame;
const cancelAnimationFrameFn = cancelAnimationFrame;
const getNow = Date.now.bind(Date);

export { requestAnimationFrameFn as requestAnimationFrame, cancelAnimationFrameFn as cancelAnimationFrame, getNow };
