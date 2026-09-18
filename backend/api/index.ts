import express from 'express';
import { config } from './config.js';
import { exigirSesion } from './middleware/autenticacion.js';
import { corsAcotado } from './middleware/cors.js';
import { manejarErrores, rutaNoEncontrada } from './middleware/errores.js';
import { personas } from './routes/personas.js';
import { proyectos } from './routes/proyectos.js';
import { repos } from './routes/repos.js';

const app = express();

app.disable('x-powered-by');
app.use(corsAcotado);
app.use(express.json({ limit: '100kb' }));

// Nunca el valor, solo si están cargadas — sirve para diagnosticar sin
// exponer nada: "¿el backend arrancó con las claves opcionales puestas?".
app.get('/salud', (_req, res) => {
  res.json({
    estado: 'ok',
    githubTokenCargado: Boolean(config.GITHUB_TOKEN),
    anthropicApiKeyCargada: Boolean(config.ANTHROPIC_API_KEY),
  });
});

app.use('/proyectos', exigirSesion, proyectos);
app.use('/personas', exigirSesion, personas);
app.use('/repos', exigirSesion, repos);

app.use(rutaNoEncontrada);
app.use(manejarErrores);

app.listen(config.PORT, (error) => {
  if (error) throw error;
  console.log(`API escuchando en el puerto ${config.PORT}`);
});
