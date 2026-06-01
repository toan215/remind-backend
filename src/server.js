require("dotenv").config();
const express = require("express");
const connectDB = require("./configs/db");
const userRoutes = require("./routes/userRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

// Kết nối đến cơ sở dữ liệu MongoDB
connectDB();

// Middleware để parse dữ liệu JSON từ body request
app.use(express.json());

// Routes
app.use("/api/users", userRoutes);

app.get('/', (req, res) => {
    res.send("hello world");
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
});