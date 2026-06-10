import dotenv from "dotenv"
import app from "./app.js";
import connectDB from "./db/index.js";

dotenv.config()


const PORT = process.env.PORT

connectDB()
.then(()=>{
    app.listen(PORT,()=> {
        console.log(`Server is running on port ${PORT}`)
    })
})
.catch((err)=> {
    console.log("Mongodb connection error", err)
})