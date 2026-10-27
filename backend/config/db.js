const dns = require('dns');
if (!process.env.VERCEL) dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');

const connectDB = async () => {
  for (let i = 1; i <= 3; i++) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
      console.log('MongoDB connected');
      return;
    } catch (err) {
      console.error(`MongoDB connection failed (try ${i}/3):`, err.message);
      if (i === 3) process.exit(1);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
};

module.exports = connectDB;