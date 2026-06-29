import http from 'http';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';
import { connectDB } from './config/db';
import adminRoutes from './routes/admin.routes';
import forumRoutes from './routes/forum.routes';
import authRoutes from './routes/auth.routes';
import chatRoutes from './routes/chat.routes';
import { createSocketServer } from './socket';

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || 4000);

app.use(helmet());
app.use(cors());
app.use(express.json());

void connectDB();

const io = createSocketServer(server);

app.set('io', io);

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'ReMind API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/forums', forumRoutes);
app.use('/api/chats', chatRoutes);

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export { app, server, io };
