require('dotenv').config();
const mongoose = require('mongoose');

console.log('Testing MongoDB Atlas Connection...');
console.log('Connection String:', process.env.MONGO_URI.replace(/:[^:@]+@/, ':****@'));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Successfully connected to MongoDB Atlas!');
    console.log('Database:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  });