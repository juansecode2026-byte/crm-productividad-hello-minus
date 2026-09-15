import cors from 'cors';
import { config } from '../config.js';

export const corsAcotado = cors({
  origin: config.CORS_ORIGINS,
  methods: ['GET', 'POST', 'PATCH'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  maxAge: 600,
});
