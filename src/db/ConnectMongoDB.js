import mongoose from "mongoose";
import {DB_NAME} from "../constants.js"


async function ConnectMongoDB(){
    try {
        const res= await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
        console.log("Connected to MongoDB",res.connection.host)
    } catch (error) {
        console.log("Error while connecting to MongoDB",error)
        
    }

}

export default ConnectMongoDB;