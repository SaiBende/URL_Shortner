import dotenv from "dotenv";
import ConnectMongoDB from "./db/ConnectMongoDB.js";
import {app } from "./app.js"


dotenv.config(
    {
        path: "./.env"
    }
);


ConnectMongoDB()
.then(
   () => {
    app.listen(process.env.PORT || 8000,()=>{
        console.log(`Server is running on port ${process.env.PORT}`)
    })
   }
)
.catch((err) => console.log(err));