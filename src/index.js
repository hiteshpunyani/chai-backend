// require('dotenv').config({path:'./env'})
import dotenv from "dotenv"
import connectDB from "./db/index.js";

dotenv.config({
    path:'./env'
})

connectDB();






/*import express from "express";
const app = express();

//IIFE
(async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    app.on("Error", (error) => {
      console.log("ERRR: ", error);
      throw error;
    });
  } catch (error) {
    console.error("Error: ", error);
  }
})();

*/
