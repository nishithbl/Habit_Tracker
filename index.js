const express = require('express');
const socketIo = require('socket.io');
const http = require('http');
const cron = require('node-cron');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// In-memory storage for habits (simulating a database)
let habits = [];

// Middleware to parse JSON
app.use(express.json());

// 1. Add Habit - POST /habits
app.post('/habits', (req, res) => {
  const { name, dailyGoal } = req.body;
  
  if (!name || !dailyGoal) {
    return res.status(400).json({ error: "Name and dailyGoal are required" });
  }

  const newHabit = {
    id: habits.length + 1, 
    name, 
    dailyGoal, 
    completionStatus: [] // Track daily completion (true for completed, false for not completed)
  };

  habits.push(newHabit);
  res.status(201).json(newHabit);
});

// 2. Update Habit - PUT /habits/:id
app.put('/habits/:id', (req, res) => {
  const habitId = parseInt(req.params.id, 10);
  const habit = habits.find(h => h.id === habitId);

  if (!habit) {
    return res.status(404).json({ error: "Habit not found" });
  }

  // Mark the habit as completed for today
  habit.completionStatus.push(true);
  res.status(200).json(habit);
});

// 3. Get Habits - GET /habits
app.get('/habits', (req, res) => {
  res.status(200).json(habits);
});

// 4. Weekly Report - GET /habits/report
app.get('/habits/report', (req, res) => {
  const reports = habits.map(habit => ({
    name: habit.name,
    completionRate: (habit.completionStatus.filter(status => status).length / habit.completionStatus.length) || 0
  }));

  let dataString = JSON.stringify(reports);
  //console.log(dataString);
  fs.appendFile("log.txt",dataString,(err)=>{})

  res.status(200).json(reports);
});


// WebSocket for real-time notifications
let socketClients = [];
io.on('connection', (socket) => {
  console.log('User connected');
  socketClients.push(socket);

  socket.on('disconnect', () => {
    console.log('User disconnected');
    socketClients = socketClients.filter(client => client !== socket);
  });
});

// Cron job for daily reminders (every day at 8:00 AM)
cron.schedule('1 5 * * *', () => {
  // Check all habits and send reminders if any are incomplete
  habits.forEach(habit => {
    if (habit.completionStatus[habit.completionStatus.length - 1] !== true) {
      // Send reminder to all connected clients
      socketClients.forEach(client => {
        client.emit('reminder', {
          message: `Reminder: You need to complete your habit "${habit.name}" today!`,
        });
      });
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
