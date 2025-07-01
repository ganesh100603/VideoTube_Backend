# VideoTube_Backend
This is my first personal backend project made using Tech Stack- NodeJS, ExpressJS, MongoDB, Mongoose etc..
# 🎬 Video Streaming Platform

This is a backend REST API for a full-featured video streaming platform, built with **Node.js**, **Express.js**, **MongoDB**, and **Cloudinary**. It supports **user registration**, **authentication**, **video uploads**, and more — making it ideal as the backend of a MERN stack YouTube-like clone.

---

## 🚀 Features

- 🔐 **User Authentication**
  - JWT-based auth with secure cookie handling
  - Login, registration, and user sessions
- 📤 **Video Upload**
  - Upload videos and thumbnails using `multer`
  - Store media on **Cloudinary**
- 🖼️ **User Profile**
  - Upload avatar and cover images
  - Update profile with image cleanup if needed
- ❤️ **Like/Comment System**
  - Like/dislike videos and comments
  - Add, edit, delete comments
- 📊 **Analytics & Engagement**
  - Video views and user watch history
  - Channel subscriptions
- 📂 **Pagination and Sorting**
  - Paginated video listings
  - Sort by date or popularity

---

## 🛠️ Tech Stack

- **Node.js + Express.js**
- **MongoDB + Mongoose**
- **Cloudinary** – media hosting
- **Multer** – file uploads
- **JWT (jsonwebtoken)** – authentication
- **Cookie-Parser** – JWT token management
- **CORS** – cross-origin support
- **bcryptjs** – password hashing
- **dotenv** – environment configuration
- **nodemon** – dev dependency for auto-reload

---

## 📦 Installation

1.bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
npm install

2.Create a .env file
PORT = YOUR_PORT
CORS_ORIGIN = YOUR_CORS_ORIGIN
MONGODB_URI = mongodb+srv://<username>:<password>@cluster0.n8ugg.mongodb.net
ACCESS_TOKEN_SECRET=YOUR_GENERATED_ACCESS_TOKEN_SECRET
ACCESS_TOKEN_EXPIRY=GIVE_ACCESS_TOKEN_EXPIRY_TIME
REFRESH_TOKEN_SECRET=YOUR_GENERATED_REFRESH_TOKEN_SECRET
REFRESH_TOKEN_EXPIRY=GIVE_REFRESH_TOKEN_EXPIRY_TIME
CLOUDINARY_CLOUD_NAME=YOUR_CLOUDINARY_ACCOUNT_NAME
CLOUDINARY_API_KEY=CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET=CLOUDINARY_API_SECRET_KEY

3.Run the Server
npm run dev

