import { CURRENCY } from '../config';

export const money = (n) => `${CURRENCY} ${Number(n || 0).toLocaleString('en-US')}`;
