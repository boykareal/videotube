import mongoose from "mongoose";
import {DB_NAME} from "../constants.js"

const connectDB = async() => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.URI}`)

        console.log(`\n mongoDB connected ! DB host: ${connectionInstance.connection.host}`)
        
    } catch (err) {
        console.log("MongoDB connection error", err)
        process.exit(1)
    }
}

export default connectDB