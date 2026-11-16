import config from '../config.js';

export const money = (n) => `${config.currency} ${Number(n || 0).toLocaleString('en-US')}`;
