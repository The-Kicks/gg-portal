# GG-PORTAL 🎮

Welcome to **GG-Portal**! This is a personal, "for-fun" full-stack project built from scratch to learn and master **TypeScript**, React, and Prisma. Everything in this repository is self-taught, built line by line, and refined with a little help from our LLM friends.

## 🧠 The TypeScript Challenge

The core architectural challenge of this project revolves around type safety versus dynamic data. 

In GG-Portal, users can create all kinds of dynamic themes, layers, and custom entities inside an admin panel. Because this data is completely dynamic and user-generated, TypeScript cannot know the exact shapes of these objects at compile-time. Managing this dynamic data while maintaining strict type safety across the frontend and backend was a massive puzzle—which made building it all the more fun and rewarding!

---

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Node.js, Prisma ORM
- **Database:** MySQL

---

## 🚀 Getting Started

Follow these steps to get your local development environment up and running.

### 1. Prerequisites & Installation
Clone the repository, open the project in your code editor, and install the dependencies:
```bash
npm install
```

### 2. Backend Setup (Prisma & Database)
Make sure your database connection is configured in your `.env` file. Then, run the following commands to push the schema and load the starter dataset:

```bash
# Push the Prisma schema to your MySQL database
npx prisma db push

# Seed the database with the starter dataset (Themes, Entities, Connections)
npx prisma db seed
```

### 3. Run the Development Server
Once the database is ready, spin up the local development server:
```bash
npm run dev
```

---

## 📦 Starter Set Data
This project comes with a built-in JSON seeder containing a rich starter set of data, including:
- **Formula 1 Championship (2026):** Drivers, Constructor Teams, and Governing Bodies.
- **European Football:** Clubs, Leagues, and legendary Players (like Johan Cruijff).