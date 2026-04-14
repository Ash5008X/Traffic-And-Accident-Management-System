require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { connectDB } = require('./config/db');
const socketHandler = require('./sockets/socketHandler');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();

    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        credentials: true
      }
    });

    // Make io accessible in routes
    app.set('io', io);

    // Initialize socket handlers
    socketHandler(io);

    server.listen(PORT, () => {
      console.log(`NexusTRAFFIC server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
