import mongoose from "mongoose";
import {DB_NAME} from "../constants.js"


async function ConnectMongoDB(){
    try {
        // Serverless instances are short-lived and numerous. A small pool per
        // instance avoids exhausting Atlas connection limits, while idle
        // sockets are released quickly when Vercel scales back.
        const res = await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`, {
            maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 10),
            minPoolSize: 0,
            maxIdleTimeMS: 30000,
            serverSelectionTimeoutMS: 5000,
        });
        console.log("Connected to MongoDB",res.connection.host)
    } catch (error) {
        console.log("Error while connecting to MongoDB",error)
        // Fail the invocation instead of serving requests without a database.
        throw error
    }

}

export default ConnectMongoDB;