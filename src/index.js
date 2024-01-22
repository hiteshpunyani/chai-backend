// require('dotenv').config({path:'./env'})
import dotenv from "dotenv"
import { app } from "./app.js";
import connectDB from "./db/index.js";

dotenv.config({
    path:'./env'
})

connectDB()
.then(()=>{
  app.listen(process.env.PORT || 8000,()=>{
    console.log(` Server is running up at port: ${process.env.PORT}`);
  })
})
.catch((err)=>{
  console.log("MongoDb connection failed !!!",err);
})






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
