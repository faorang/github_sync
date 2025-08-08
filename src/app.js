const express = require('express');
const fileRoutes = require('./routes/files');
const uploadMiddleware = require('./middleware/uploadMiddleware');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(uploadMiddleware);

// Routes
app.use('/api/files', fileRoutes);

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});