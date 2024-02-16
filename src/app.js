import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

//We use "app.use" when we need to call a middleware or to config the data.
//Middleware is nothing just a function that can modify the given req data acc to our need
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public")); //This express.static middleware is used to store static files in the public directory
app.use(cookieParser());

//routes import
import userRouter from "./routes/user.routes.js";

//routes declaration
app.use("/api/v1/users",userRouter);

//http://localhost:8000/api/v1/users/register

export { app };
