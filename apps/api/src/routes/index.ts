import { Router } from 'express';
import { healthRouter } from './health.js';
import { videosRouter } from '../modules/videos/videosRoutes.js';
import { favoritesRouter } from '../modules/favorites/favoritesRoutes.js';
import { playlistsRouter } from '../modules/playlists/playlistsRoutes.js';
import { historyRouter } from '../modules/history/historyRoutes.js';
import { notesRouter } from '../modules/notes/notesRoutes.js';
import { downloadsRouter } from '../modules/downloads/downloadsRoutes.js';
import { mediaRouter } from '../modules/media/mediaRoutes.js';
import { libraryRouter } from '../modules/library/libraryRoutes.js';
import { feedRouter } from '../modules/feed/feedRoutes.js';
import { proxyRouter } from '../modules/proxy/proxyRoutes.js';
import { authRouter } from '../modules/auth/authRoutes.js';

export const apiRouter = Router();

// 1. Health checks
apiRouter.use('/', healthRouter);

// 2. Authentication (login / session / me)
apiRouter.use(authRouter);

// 3. Domain Modules
apiRouter.use(videosRouter);
apiRouter.use(feedRouter);
apiRouter.use(libraryRouter);
apiRouter.use(favoritesRouter);
apiRouter.use(playlistsRouter);
apiRouter.use(historyRouter);
apiRouter.use(notesRouter);
apiRouter.use(downloadsRouter);
apiRouter.use(mediaRouter);
apiRouter.use(proxyRouter);
