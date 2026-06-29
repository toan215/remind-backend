import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { verifySocketToken } from '../middlewares/socketAuth.middleware';
import { registerChatHandlers } from './handlers/chat.handler';
import { registerForumGroupHandlers } from './handlers/forumGroup.handler';
import type { ClientToServerEvents, ServerToClientEvents, SocketAuthData } from '../types/chat.types';

export const createSocketServer = (httpServer: HttpServer): SocketIOServer<ClientToServerEvents, ServerToClientEvents, {}, SocketAuthData> => {
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, {}, SocketAuthData>(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const user = verifySocketToken(token);
    if (!user) {
      return next(new Error('Invalid token'));
    }

    socket.data = user;
    next();
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.data.userId} (${socket.data.role})`);

    registerChatHandlers(socket);
    registerForumGroupHandlers(socket);

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.data.userId}`);
    });
  });

  return io;
};
