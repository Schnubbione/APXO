// Load environment variables for production
if (process.env.NODE_ENV === 'production') {
  import('dotenv').then(dotenv => {
    dotenv.config({ path: './server/.env.production' });
    import('./server/server.js');
  });
} else {
  import('./server/server.js');
}
